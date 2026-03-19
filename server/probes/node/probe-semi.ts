import * as fs from "fs";
import * as os from "os";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { buildTransportChain, TransportChain } from "./transports";

const HOLOCRON_TOKEN = process.env.HOLOCRON_TOKEN || "";
const HOLOCRON_API = (process.env.HOLOCRON_API || "").replace(/\/$/, "");
const HOLOCRON_HMAC_SECRET = process.env.HOLOCRON_HMAC_SECRET || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const PROBE_VERSION = "4.0.0-semi";

let transport: TransportChain;
const BUFFER_DIR = process.env.HOLOCRON_BUFFER_DIR || "/var/lib/holocron/buffer";
const BUFFER_MAX = parseInt(process.env.HOLOCRON_BUFFER_MAX || "10000", 10);
const SYNC_STRATEGY = process.env.HOLOCRON_SYNC || "opportunistic";
let heartbeatInterval = parseInt(process.env.HEARTBEAT_INTERVAL || "120", 10) * 1000;

interface CpuTimes { user: number; nice: number; system: number; idle: number; iowait: number; irq: number; softirq: number; steal: number; }
interface Metrics { timestamp: string; cpuUsage: number; memoryUsage: number; diskUsage: number; temperature: number; loadAverage: number; uptime: number; processCount: number; networkInterfaces: any[]; }
interface AiDecision { decision: string; reasoning: string; action: string | null; model: string; timestamp: string; }

function readProcStat(): CpuTimes {
  try {
    const stat = fs.readFileSync("/proc/stat", "utf8");
    const parts = stat.split("\n")[0].split(/\s+/).slice(1).map(Number);
    return { user: parts[0], nice: parts[1], system: parts[2], idle: parts[3], iowait: parts[4] || 0, irq: parts[5] || 0, softirq: parts[6] || 0, steal: parts[7] || 0 };
  } catch { return { user: 0, nice: 0, system: 0, idle: 0, iowait: 0, irq: 0, softirq: 0, steal: 0 }; }
}

function cpuTotal(t: CpuTimes): number { return t.user + t.nice + t.system + t.idle + t.iowait + t.irq + t.softirq + t.steal; }
function cpuActive(t: CpuTimes): number { return t.user + t.nice + t.system + t.irq + t.softirq + t.steal; }

async function getCpuUsage(): Promise<number> {
  const t1 = readProcStat();
  await new Promise(r => setTimeout(r, 1000));
  const t2 = readProcStat();
  const totalDelta = cpuTotal(t2) - cpuTotal(t1);
  const activeDelta = cpuActive(t2) - cpuActive(t1);
  return totalDelta === 0 ? 0 : Math.round((activeDelta / totalDelta) * 1000) / 10;
}

function getMemoryUsage(): number {
  try {
    const meminfo = fs.readFileSync("/proc/meminfo", "utf8");
    const total = parseInt(meminfo.match(/MemTotal:\s+(\d+)/)?.[1] || "0", 10);
    const available = parseInt(meminfo.match(/MemAvailable:\s+(\d+)/)?.[1] || "0", 10);
    return total === 0 ? 0 : Math.round(((total - available) / total) * 1000) / 10;
  } catch { return 0; }
}

function getDiskUsage(): number {
  try {
    const s = fs.statfsSync("/");
    const total = s.blocks * s.bsize;
    const free = s.bfree * s.bsize;
    return total === 0 ? 0 : Math.round(((total - free) / total) * 1000) / 10;
  } catch { return 0; }
}

function getTemperature(): number {
  try { return Math.round(parseInt(fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8").trim(), 10) / 100) / 10; }
  catch { return 0; }
}

function getProcessCount(): number {
  try { return fs.readdirSync("/proc").filter(f => /^\d+$/.test(f)).length; }
  catch { return 0; }
}

function getNetworkInterfaces(): any[] {
  try {
    const lines = fs.readFileSync("/proc/net/dev", "utf8").split("\n").slice(2);
    return lines.filter(l => l.trim()).map(line => {
      const parts = line.trim().split(/[:\s]+/);
      if (parts[0] === "lo") return null;
      return { name: parts[0], type: parts[0].startsWith("wl") ? "wireless" : "ethernet", status: "active", rxBytes: parseInt(parts[1], 10), txBytes: parseInt(parts[9], 10) };
    }).filter(Boolean) as any[];
  } catch { return []; }
}

function getSystemInfo() {
  const cpus = os.cpus();
  return {
    hostname: os.hostname(), ip: getLocalIp(),
    osInfo: `${os.type()} ${os.release()} ${os.arch()}`,
    macAddress: getMacAddress(),
    manufacturer: readFile("/sys/class/dmi/id/sys_vendor", "Edge Device"),
    model: readFile("/sys/class/dmi/id/product_name", "Embedded"),
    cpuInfo: cpus.length > 0 ? `${cpus[0].model} (${cpus.length} cores)` : "ARM/Edge",
    totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    systemType: detectSystemType(),
  };
}

function getLocalIp(): string {
  for (const ifaces of Object.values(os.networkInterfaces()))
    for (const iface of ifaces || [])
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
  return "127.0.0.1";
}

function getMacAddress(): string {
  for (const ifaces of Object.values(os.networkInterfaces()))
    for (const iface of ifaces || [])
      if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") return iface.mac;
  return "unknown";
}

function readFile(p: string, fallback: string): string {
  try { return fs.readFileSync(p, "utf8").trim(); } catch { return fallback; }
}

function detectSystemType(): string {
  try { if (fs.existsSync("/.dockerenv")) return "container"; } catch {}
  try { if (/docker|lxc|kubepods/.test(fs.readFileSync("/proc/1/cgroup", "utf8"))) return "container"; } catch {}
  return "edge-device";
}

async function collectMetrics(): Promise<Metrics> {
  return {
    timestamp: new Date().toISOString(),
    cpuUsage: await getCpuUsage(),
    memoryUsage: getMemoryUsage(),
    diskUsage: getDiskUsage(),
    temperature: getTemperature(),
    loadAverage: Math.round(os.loadavg()[0] * 100) / 100,
    uptime: Math.floor(os.uptime()),
    processCount: getProcessCount(),
    networkInterfaces: getNetworkInterfaces(),
  };
}

function ruleEngineReason(m: Metrics): AiDecision {
  const ts = new Date().toISOString();
  if (m.cpuUsage > 90) return { decision: "alert_cpu", reasoning: `CPU critically high at ${m.cpuUsage}%`, action: null, model: "rule-engine-v1", timestamp: ts };
  if (m.memoryUsage > 90) return { decision: "alert_memory", reasoning: `Memory critically high at ${m.memoryUsage}%`, action: null, model: "rule-engine-v1", timestamp: ts };
  if (m.diskUsage > 90) return { decision: "alert_disk", reasoning: `Disk critically high at ${m.diskUsage}%`, action: null, model: "rule-engine-v1", timestamp: ts };
  if (m.temperature > 80) return { decision: "alert_thermal", reasoning: `Temperature at ${m.temperature}°C — throttling risk`, action: null, model: "rule-engine-v1", timestamp: ts };
  if (m.cpuUsage > 70) return { decision: "warn_cpu", reasoning: `CPU elevated at ${m.cpuUsage}%`, action: null, model: "rule-engine-v1", timestamp: ts };
  if (m.memoryUsage > 80) return { decision: "warn_memory", reasoning: `Memory high at ${m.memoryUsage}%`, action: null, model: "rule-engine-v1", timestamp: ts };
  return { decision: "normal", reasoning: "All metrics within acceptable ranges", action: null, model: "rule-engine-v1", timestamp: ts };
}

async function aiReason(metrics: Metrics): Promise<AiDecision> {
  if (!OPENAI_API_KEY) return ruleEngineReason(metrics);

  try {
    const url = new URL(`${OPENAI_BASE_URL}/v1/chat/completions`);
    const body = JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "You are a HOLOCRON AI edge probe agent monitoring system health. Respond with valid JSON only: {decision: normal|warn|alert, reasoning: string, action: null}" },
        { role: "user", content: `Analyze: CPU=${metrics.cpuUsage}%, Mem=${metrics.memoryUsage}%, Disk=${metrics.diskUsage}%, Temp=${metrics.temperature}°C, Load=${metrics.loadAverage}, Processes=${metrics.processCount}` },
      ],
      max_tokens: 200, temperature: 0.1,
    });

    const resp = await httpRequest(url, "POST", body, { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` });
    const content = resp?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
      return { ...parsed, model: OPENAI_MODEL, timestamp: new Date().toISOString() };
    }
  } catch (e: any) { log(`AI reasoning fallback: ${e.message}`); }
  return ruleEngineReason(metrics);
}

function httpRequest(url: URL, method: string, body: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const opts = { hostname: url.hostname, port: url.port || (isHttps ? 443 : 80), path: url.pathname + url.search, method, headers: { ...headers, "Content-Length": Buffer.byteLength(body).toString() }, timeout: 30000 };
    const req = (isHttps ? https : http).request(opts, res => {
      let raw = "";
      res.on("data", (c: Buffer) => raw += c.toString());
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve({ raw }); } });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body);
    req.end();
  });
}


function log(msg: string) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

class LocalBuffer {
  private metricsFile: string;
  private decisionsFile: string;
  private reasoningFile: string;

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.metricsFile = path.join(dir, "metrics.jsonl");
    this.decisionsFile = path.join(dir, "decisions.jsonl");
    this.reasoningFile = path.join(dir, "reasoning.log");
    for (const f of [this.metricsFile, this.decisionsFile, this.reasoningFile])
      if (!fs.existsSync(f)) fs.writeFileSync(f, "");
  }

  writeMetrics(m: Metrics) { this.appendRotate(this.metricsFile, JSON.stringify(m)); }

  writeDecision(m: Metrics, d: AiDecision) {
    this.appendRotate(this.decisionsFile, JSON.stringify({ timestamp: m.timestamp, metrics: { cpu: m.cpuUsage, mem: m.memoryUsage, disk: m.diskUsage, temp: m.temperature }, aiResult: d }));
    fs.appendFileSync(this.reasoningFile, `[${m.timestamp.slice(11, 19)}] ${d.decision} | CPU:${m.cpuUsage}% Mem:${m.memoryUsage}% Disk:${m.diskUsage}% Temp:${m.temperature}°C | ${d.reasoning}\n`);
  }

  private appendRotate(file: string, line: string) {
    fs.appendFileSync(file, line + "\n");
    try {
      const count = fs.readFileSync(file, "utf8").split("\n").length;
      if (count > BUFFER_MAX) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        fs.writeFileSync(file, lines.slice(Math.floor(BUFFER_MAX / 2)).join("\n"));
        log(`Buffer rotated: ${file}`);
      }
    } catch {}
  }

  getCount(): number {
    try {
      const mc = fs.readFileSync(this.metricsFile, "utf8").trim().split("\n").filter(Boolean).length;
      const dc = fs.readFileSync(this.decisionsFile, "utf8").trim().split("\n").filter(Boolean).length;
      return mc + dc;
    } catch { return 0; }
  }

  flush(type: "metrics" | "decisions", batchSize: number = 50): { entries: any[]; remaining: number } {
    const file = type === "metrics" ? this.metricsFile : this.decisionsFile;
    try {
      const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
      if (lines.length === 0) return { entries: [], remaining: 0 };
      const batch = lines.slice(0, batchSize);
      const remaining = lines.slice(batchSize);
      const entries = batch.map(l => {
        const data = JSON.parse(l);
        return { taskType: type, timestamp: data.timestamp || new Date().toISOString(), hostname: os.hostname(), ipAddress: getLocalIp(), data };
      });
      fs.writeFileSync(file, remaining.join("\n") + (remaining.length ? "\n" : ""));
      return { entries, remaining: remaining.length };
    } catch { return { entries: [], remaining: 0 }; }
  }

  restoreEntries(type: "metrics" | "decisions", entries: any[]) {
    const file = type === "metrics" ? this.metricsFile : this.decisionsFile;
    const existing = fs.readFileSync(file, "utf8");
    const lines = entries.map(e => JSON.stringify(e.data));
    fs.writeFileSync(file, lines.join("\n") + "\n" + existing);
  }

  getStats(): string {
    const mc = fs.readFileSync(this.metricsFile, "utf8").trim().split("\n").filter(Boolean).length;
    const dc = fs.readFileSync(this.decisionsFile, "utf8").trim().split("\n").filter(Boolean).length;
    return `Metrics: ${mc}, Decisions: ${dc}, Total: ${mc + dc}`;
  }
}

async function checkServerReachable(): Promise<boolean> {
  if (!transport) return false;
  try {
    const result = await transport.send("/api/probe-heartbeat", { siteToken: "ping" });
    return result.success;
  } catch { return false; }
}

async function syncBuffer(buffer: LocalBuffer): Promise<boolean> {
  if (!await checkServerReachable()) return false;
  log("Server reachable — syncing buffer...");
  for (const type of ["metrics", "decisions"] as const) {
    const { entries, remaining } = buffer.flush(type);
    if (entries.length === 0) continue;
    try {
      const resp = (await transport.send("/api/probe-heartbeat-buffered", { siteToken: HOLOCRON_TOKEN, bufferedData: entries })).data;
      if (resp.success) {
        log(`Flushed ${entries.length} ${type} entries (${remaining} remaining)`);
      } else {
        buffer.restoreEntries(type, entries);
        log(`Flush failed for ${type}: ${resp.error || "unknown"}`);
      }
    } catch (e: any) {
      buffer.restoreEntries(type, entries);
      log(`Flush error for ${type}: ${e.message}`);
    }
  }
  return true;
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   HOLOCRON AI Semi-Autonomous Probe            ║");
  console.log(`║   Node.js v${PROBE_VERSION}  Multi-Transport      ║`);
  console.log("║   Kernel-direct · Local AI · Store&Forward      ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log();

  if (!HOLOCRON_TOKEN) { log("ERROR: HOLOCRON_TOKEN is required"); process.exit(1); }

  transport = buildTransportChain(HOLOCRON_HMAC_SECRET);
  await transport.connect();

  const buffer = new LocalBuffer(BUFFER_DIR);
  log(`Buffer: ${BUFFER_DIR} (max ${BUFFER_MAX} entries)`);
  log(`Sync:   ${SYNC_STRATEGY}`);
  log(`AI:     ${OPENAI_API_KEY ? `OpenAI (${OPENAI_MODEL})` : "Rule Engine v1 (local)"}`);
  log(`Chain:  ${transport.getTransportNames().join(" → ")}`);
  log(`PID:    ${process.pid}`);
  log("");

  let enrolled = false;
  if (await checkServerReachable()) {
    try {
      const sys = getSystemInfo();
      const result = await transport.send("/api/probe-enroll", {
        siteToken: HOLOCRON_TOKEN, hostname: sys.hostname, ipAddress: sys.ip,
        osInfo: sys.osInfo, probeVersion: PROBE_VERSION, deploymentType: "semi-autonomous",
        macAddress: sys.macAddress, manufacturer: sys.manufacturer, model: sys.model,
        cpuInfo: sys.cpuInfo, totalMemoryGB: sys.totalMemoryGB, systemType: sys.systemType,
      });
      if (result.success && result.data?.success) { enrolled = true; log(`Enrolled (ID: ${result.data.probeId}) via ${result.transport}`); }
    } catch (e: any) { log(`Enrollment deferred: ${e.message}`); }
  } else {
    log("All transports unreachable — starting in offline mode");
  }

  log("Semi-autonomous probe operational. Collecting and reasoning locally.");
  log("");

  let cycle = 0;
  const syncEvery = 5;

  const tick = async () => {
    cycle++;
    const metrics = await collectMetrics();
    buffer.writeMetrics(metrics);

    log("AI reasoning...");
    const decision = await aiReason(metrics);
    buffer.writeDecision(metrics, decision);

    const bufCount = buffer.getCount();
    const severity = decision.decision.startsWith("alert") ? "!!" : decision.decision.startsWith("warn") ? "?" : "ok";
    log(`[${severity}] CPU:${metrics.cpuUsage}% Mem:${metrics.memoryUsage}% Disk:${metrics.diskUsage}% Temp:${metrics.temperature}°C [AI:${decision.decision}] Buffer:${bufCount}`);

    if (SYNC_STRATEGY === "opportunistic" && (cycle % syncEvery === 0 || !enrolled)) {
      const synced = await syncBuffer(buffer);
      if (synced && !enrolled) {
        try {
          const sys = getSystemInfo();
          const result = await transport.send("/api/probe-enroll", { siteToken: HOLOCRON_TOKEN, hostname: sys.hostname, ipAddress: sys.ip, osInfo: sys.osInfo, probeVersion: PROBE_VERSION, deploymentType: "semi-autonomous", macAddress: sys.macAddress, manufacturer: sys.manufacturer, model: sys.model, cpuInfo: sys.cpuInfo, totalMemoryGB: sys.totalMemoryGB, systemType: sys.systemType });
          if (result.success && result.data?.success) { enrolled = true; log(`Enrolled (ID: ${result.data.probeId}) via ${result.transport}`); }
        } catch {}
      }
    }

    setTimeout(tick, heartbeatInterval);
  };

  process.on("SIGTERM", () => { log(`Shutting down. Buffer: ${buffer.getStats()}`); log(`Buffer preserved at ${BUFFER_DIR}`); transport.disconnect(); process.exit(0); });
  process.on("SIGINT", () => { log(`Shutting down. Buffer: ${buffer.getStats()}`); log(`Buffer preserved at ${BUFFER_DIR}`); transport.disconnect(); process.exit(0); });

  tick();
}

if (process.argv.includes("test")) {
  (async () => {
    log("Running semi-autonomous probe test...");
    const metrics = await collectMetrics();
    log(`Metrics: CPU=${metrics.cpuUsage}% Mem=${metrics.memoryUsage}% Disk=${metrics.diskUsage}% Temp=${metrics.temperature}°C Load=${metrics.loadAverage}`);
    const decision = await aiReason(metrics);
    log(`AI Decision: ${decision.decision} (${decision.model})`);
    log(`Reasoning: ${decision.reasoning}`);
    if (HOLOCRON_API) {
      const reachable = await checkServerReachable();
      log(`Server: ${reachable ? "reachable" : "unreachable"}`);
    }
    log("Test complete.");
  })();
} else {
  main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
}
