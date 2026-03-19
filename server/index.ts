import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { setupAuth } from "./auth";
import { createServer } from "http";
import { logIngestBuffer } from "./log-pipeline";
import { stopKafkaPipeline } from "./kafka-pipeline";
import { join } from "path";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Extract the first well-formed JSON object from a string, ignoring trailing garbage.
// This makes probe heartbeat endpoints resilient to malformed bodies from Android scripts.
function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return null;
}

// Sanitizing body-parser for probe endpoints — must be registered BEFORE express.json()
// Buffers the raw body, extracts the first valid JSON object, logs any trailing garbage.
function probeBodySanitizer(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'POST') return next();
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const extracted = extractFirstJsonObject(raw);
      if (extracted) {
        try {
          parsed = JSON.parse(extracted);
          if (raw.trim() !== extracted.trim()) {
            console.warn(`[PROBE] Stripped trailing content (${raw.length - extracted.length}B): "${raw.slice(extracted.length, extracted.length + 80).trim()}"`);
          }
        } catch (e2) {
          console.error(`[PROBE] JSON parse failed even after extraction. Raw(200): ${raw.slice(0, 200)}`);
          return res.status(400).json({ error: 'Invalid JSON' });
        }
      } else {
        console.error(`[PROBE] No JSON object found. Raw(200): ${raw.slice(0, 200)}`);
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }
    (req as any).body = parsed;
    (req as any)._body = true;
    next();
  });
  req.on('error', () => res.status(400).json({ error: 'Body read error' }));
}

// Register sanitizer for all probe-facing endpoints BEFORE the global json() parser
const PROBE_PATHS = [
  '/api/probe-heartbeat',
  '/api/probe-enroll',
  '/api/probe-heartbeat-buffered',
  '/api/probe-heartbeat-batch',
  '/api/probe-task-report',
];
for (const p of PROBE_PATHS) app.use(p, probeBodySanitizer);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Serve uploaded probe media files
app.use("/uploads", express.static(join(process.cwd(), "uploads")));

setupAuth(app);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      log(`Port ${port} already in use — retrying in 1s`, "startup");
      setTimeout(() => {
        httpServer.close();
        httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
          log(`serving on port ${port}`);
        });
      }, 1000);
    } else {
      throw err;
    }
  });
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // ── Graceful shutdown (container-safe) ───────────────────────────────────────
  // On SIGTERM (Kubernetes pod eviction, rolling deploy) or SIGINT (Ctrl+C):
  //  1. Stop accepting new HTTP connections
  //  2. Drain the log write buffer (flush remaining entries to DB)
  //  3. Exit cleanly so the orchestrator can schedule a replacement
  const gracefulShutdown = async (signal: string) => {
    log(`${signal} received — starting graceful shutdown`, "shutdown");
    httpServer.close(async () => {
      log("HTTP server closed — draining pipeline", "shutdown");
      try {
        // 1. Disconnect Kafka producer first so no new messages can be sent
        await stopKafkaPipeline();
        log("Kafka pipeline stopped", "shutdown");
      } catch (err) {
        log(`Kafka shutdown error: ${err}`, "shutdown");
      }
      try {
        // 2. Drain the in-process buffer (catches Kafka fallback entries too)
        await logIngestBuffer.drain();
        log("log write buffer drained", "shutdown");
      } catch (err) {
        log(`buffer drain error: ${err}`, "shutdown");
      }
      process.exit(0);
    });
    // Force exit after 15s if in-flight requests do not finish
    setTimeout(() => {
      log("forced exit after 15s timeout", "shutdown");
      process.exit(1);
    }, 15_000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT",  () => gracefulShutdown("SIGINT"));
})();
