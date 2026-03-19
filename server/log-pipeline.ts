/**
 * log-pipeline.ts — Production-grade log ingestion pipeline
 *
 * Provides:
 *  - Async write buffer with configurable flush interval and batch size
 *  - Per-source + global sliding-window rate limiting (per process)
 *  - Source counter coalescer (debounced logCount / lastSeen updates)
 *  - Automated retention scheduler (all users, hourly)
 *  - Idempotent DB index bootstrap (BRIN + GIN trigram) on startup
 *  - drain() for graceful shutdown on SIGTERM
 *
 * All limits are env-configurable so ops can tune without code changes.
 * Multiple container instances each own their pipeline — they flush
 * independently to the shared PostgreSQL backend (stateless scale-out).
 */

import { storage, db } from "./storage";
import { sql } from "drizzle-orm";
import { startKafkaPipeline, kafkaEnabled, getKafkaStats } from "./kafka-pipeline";

// ── Configuration (all tunable via env vars) ──────────────────────────────────
const FLUSH_INTERVAL_MS     = Number(process.env.LOG_FLUSH_INTERVAL_MS     ?? 500);
const MAX_BUFFER_SIZE       = Number(process.env.LOG_MAX_BUFFER_SIZE        ?? 10_000);
const MAX_BATCH_SIZE        = Number(process.env.LOG_MAX_BATCH_SIZE         ?? 500);
const RETENTION_INTERVAL_MS = Number(process.env.LOG_RETENTION_INTERVAL_MS  ?? 3_600_000); // 1 hour
const COUNTER_FLUSH_MS      = Number(process.env.LOG_COUNTER_FLUSH_MS       ?? 2_000);
const RATE_WINDOW_MS        = 1_000;
const RATE_MAX_PER_SOURCE   = Number(process.env.LOG_RATE_MAX_PER_SOURCE    ?? 2_000);
const RATE_MAX_GLOBAL       = Number(process.env.LOG_RATE_MAX_GLOBAL        ?? 20_000);

// ── Rate Limiter (sliding window, per process) ────────────────────────────────
interface RateWindow { count: number; windowStart: number }
const rateMap = new Map<string, RateWindow>();

export function checkRateLimit(sourceKey: string): { allowed: boolean; reason?: string } {
  const now = Date.now();

  const advance = (key: string, max: number): boolean => {
    let w = rateMap.get(key);
    if (!w || now - w.windowStart > RATE_WINDOW_MS) {
      w = { count: 0, windowStart: now };
    }
    if (w.count >= max) { rateMap.set(key, w); return false; }
    w.count++;
    rateMap.set(key, w);
    return true;
  };

  if (!advance("__global", RATE_MAX_GLOBAL))    return { allowed: false, reason: "global rate limit exceeded" };
  if (!advance(sourceKey, RATE_MAX_PER_SOURCE)) return { allowed: false, reason: `source rate limit exceeded (max ${RATE_MAX_PER_SOURCE}/s per source)` };
  return { allowed: true };
}

// ── Write Buffer ──────────────────────────────────────────────────────────────
type BufferedEntry = Parameters<(typeof storage)["createLogEntriesBatch"]>[0][0];

class LogIngestBuffer {
  private queue: BufferedEntry[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private _dropped   = 0;
  private _flushed   = 0;
  private _errors    = 0;
  private _lastFlush: Date | null = null;

  start(): void {
    this.timer = setInterval(() => { this.flush().catch(() => {}); }, FLUSH_INTERVAL_MS);
    console.log(
      `[log-pipeline] write buffer started — flush every ${FLUSH_INTERVAL_MS}ms, ` +
      `max buffer ${MAX_BUFFER_SIZE}, batch ${MAX_BATCH_SIZE}`,
    );
  }

  enqueue(entries: BufferedEntry[]): { accepted: number; dropped: number } {
    const available = MAX_BUFFER_SIZE - this.queue.length;
    if (available <= 0) {
      this._dropped += entries.length;
      return { accepted: 0, dropped: entries.length };
    }
    const toAdd   = entries.slice(0, available);
    const dropped = entries.length - toAdd.length;
    this.queue.push(...toAdd);
    this._dropped += dropped;
    return { accepted: toAdd.length, dropped };
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, MAX_BATCH_SIZE);
        await storage.createLogEntriesBatch(batch);
        this._flushed += batch.length;
      }
      this._lastFlush = new Date();
    } catch (err) {
      this._errors++;
      console.error("[log-pipeline] flush error:", err);
    } finally {
      this.flushing = false;
    }
  }

  async drain(): Promise<void> {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    await this.flush();
    console.log(
      `[log-pipeline] drained — total flushed: ${this._flushed}, ` +
      `dropped: ${this._dropped}, errors: ${this._errors}`,
    );
  }

  stats() {
    return {
      bufferDepth:     this.queue.length,
      maxBufferSize:   MAX_BUFFER_SIZE,
      totalFlushed:    this._flushed,
      dropped:         this._dropped,
      errors:          this._errors,
      lastFlushAt:     this._lastFlush,
      flushIntervalMs: FLUSH_INTERVAL_MS,
    };
  }
}

export const logIngestBuffer = new LogIngestBuffer();

// ── Source Counter Coalescer ──────────────────────────────────────────────────
// Avoids a per-ingest SELECT + UPDATE by accumulating deltas and flushing
// as a single SQL UPDATE per source every COUNTER_FLUSH_MS.
const sourceCounters = new Map<string, { delta: number; lastSeen: Date }>();

export function incrementSourceCounter(sourceId: string, delta: number): void {
  const existing = sourceCounters.get(sourceId);
  if (existing) {
    existing.delta += delta;
    existing.lastSeen = new Date();
  } else {
    sourceCounters.set(sourceId, { delta, lastSeen: new Date() });
  }
}

async function flushSourceCounters(): Promise<void> {
  if (sourceCounters.size === 0) return;
  const snapshot = new Map(sourceCounters);
  sourceCounters.clear();
  for (const [sourceId, { delta, lastSeen }] of snapshot) {
    try {
      await db.execute(sql`
        UPDATE log_sources
        SET    log_count = COALESCE(log_count, 0) + ${delta},
               last_seen = ${lastSeen}
        WHERE  id = ${sourceId}
      `);
    } catch (err) {
      console.error(`[log-pipeline] counter flush error for source ${sourceId}:`, err);
    }
  }
}

// ── Retention Scheduler ───────────────────────────────────────────────────────
async function runRetentionSweep(): Promise<void> {
  console.log("[log-pipeline] starting retention sweep...");
  try {
    const rows = await db.execute<{ user_id: string }>(sql`
      SELECT DISTINCT user_id FROM log_entries
      LIMIT 5000
    `);
    let purgedTotal = 0;
    for (const row of rows.rows) {
      try {
        const policies = await storage.getLogRetentionPolicies(row.user_id);
        if (policies.length === 0) {
          purgedTotal += await storage.purgeExpiredLogs(row.user_id, 90);
        } else {
          for (const p of policies) {
            purgedTotal += await storage.purgeExpiredLogs(row.user_id, p.retentionDays, p.sourceId ?? undefined);
          }
        }
      } catch (err) {
        console.error(`[log-pipeline] retention error for user ${row.user_id}:`, err);
      }
    }
    console.log(`[log-pipeline] retention sweep complete — ${rows.rows.length} users, ${purgedTotal} rows purged`);
  } catch (err) {
    console.error("[log-pipeline] retention sweep failed:", err);
  }
}

// ── Index Bootstrap (idempotent, non-blocking) ────────────────────────────────
async function ensureLogIndexes(): Promise<void> {
  try {
    // pg_trgm enables fast ILIKE / similarity search via GIN
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // BRIN is extremely compact for append-only time-series data.
    // Each 128-page region stores min/max timestamps — perfect for range queries.
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS log_entries_ts_brin
      ON log_entries USING brin(log_timestamp)
    `);

    // GIN trigram index enables fast ILIKE '%search%' on the message column
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS log_entries_message_trgm
      ON log_entries USING gin(message gin_trgm_ops)
    `);

    // Composite covering index for the most common query pattern:
    // WHERE user_id = ? ORDER BY log_timestamp DESC LIMIT n
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS log_entries_userid_ts_desc
      ON log_entries(user_id, log_timestamp DESC)
    `);

    // Partial index for error/critical logs (dashboards query these most)
    await db.execute(sql`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS log_entries_errors_partial
      ON log_entries(user_id, log_timestamp DESC)
      WHERE level IN ('error', 'critical', 'fatal')
    `);

    console.log("[log-pipeline] log indexes verified OK");
  } catch (err: any) {
    // Non-fatal — CONCURRENTLY cannot run inside a transaction; warn and continue
    console.warn("[log-pipeline] index bootstrap warning (non-fatal):", err.message);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function startLogPipeline(): void {
  // Always start the in-process buffer — used as fallback when Kafka is unavailable
  logIngestBuffer.start();

  setInterval(() => { flushSourceCounters().catch(() => {}); }, COUNTER_FLUSH_MS);

  // Stagger the first retention run by 2 minutes so it doesn't hit at startup
  setTimeout(() => {
    runRetentionSweep();
    setInterval(() => { runRetentionSweep(); }, RETENTION_INTERVAL_MS);
  }, 2 * 60 * 1000);

  console.log(
    `[log-pipeline] retention scheduler armed ` +
    `(first run +2min, then every ${RETENTION_INTERVAL_MS / 60_000}min)`,
  );

  // Index bootstrap runs async — does not block server start
  ensureLogIndexes().catch(() => {});

  // Start Kafka pipeline if KAFKA_BROKERS is configured
  if (kafkaEnabled) {
    startKafkaPipeline().catch(err =>
      console.error("[log-pipeline] Kafka startup error:", err)
    );
    console.log("[log-pipeline] Kafka mode active — in-process buffer retained as fallback");
  } else {
    console.log("[log-pipeline] Kafka not configured — using in-process buffer exclusively");
  }
}

export function getLogPipelineStats() {
  return {
    mode:     kafkaEnabled ? "kafka+buffer-fallback" : "in-process-buffer",
    buffer:   logIngestBuffer.stats(),
    kafka:    getKafkaStats(),
    rateLimit: {
      windowMs:      RATE_WINDOW_MS,
      maxPerSource:  RATE_MAX_PER_SOURCE,
      maxGlobal:     RATE_MAX_GLOBAL,
    },
  };
}
