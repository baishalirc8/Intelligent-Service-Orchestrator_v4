/**
 * kafka-pipeline.ts — Production Kafka integration for log ingestion
 *
 * Architecture:
 *   Ingest endpoint → Kafka Producer → "logs.ingest" topic
 *                                              ↓
 *                                    Kafka Consumer Group
 *                                    (one consumer per instance)
 *                                              ↓
 *                                    PostgreSQL batch writer
 *
 * Multi-instance / container clustering:
 *   - Multiple instances produce to the same topic; Kafka handles load balancing
 *   - Each instance runs a consumer in the same consumer group
 *   - Kafka distributes partitions across the group automatically
 *   - Stateless horizontal scale-out: add more instances and Kafka rebalances
 *
 * Fallback:
 *   If KAFKA_BROKERS is not set, or if the Kafka cluster is unreachable,
 *   the caller falls back to the in-process LogIngestBuffer automatically.
 *
 * All configuration is via environment variables — no code changes needed
 * to switch between broker providers (Confluent Cloud, AWS MSK, Redpanda, etc.).
 */

import { Kafka, Producer, Consumer, logLevel, CompressionTypes } from "kafkajs";
import type { SASLOptions } from "kafkajs";
import { storage } from "./storage";

// ── Config ────────────────────────────────────────────────────────────────────
const RAW_BROKERS   = process.env.KAFKA_BROKERS ?? "";           // "b1:9092,b2:9092"
const BROKERS       = RAW_BROKERS.split(",").map(s => s.trim()).filter(Boolean);
const TOPIC         = process.env.KAFKA_LOG_TOPIC         ?? "logs.ingest";
const GROUP_ID      = process.env.KAFKA_CONSUMER_GROUP    ?? "holocron-log-consumer";
const CLIENT_ID     = process.env.KAFKA_CLIENT_ID         ?? "holocron-ai";
const USE_SSL       = process.env.KAFKA_SSL               === "true";
const SASL_MECH     = (process.env.KAFKA_SASL_MECHANISM   ?? "") as "plain" | "scram-sha-256" | "scram-sha-512" | "";
const SASL_USER     = process.env.KAFKA_SASL_USERNAME     ?? "";
const SASL_PASS     = process.env.KAFKA_SASL_PASSWORD     ?? "";
const PARTITIONS    = Number(process.env.KAFKA_TOPIC_PARTITIONS    ?? 6);
const REPLICATION   = Number(process.env.KAFKA_REPLICATION_FACTOR  ?? 1);
const RETENTION_MS  = Number(process.env.KAFKA_RETENTION_MS        ?? 7 * 24 * 60 * 60 * 1000); // 7 days
const BATCH_SIZE    = Number(process.env.KAFKA_CONSUMER_BATCH_SIZE  ?? 500);

/** True when a broker list is configured — gates all Kafka code paths */
export const kafkaEnabled = BROKERS.length > 0;

// ── Internal state ────────────────────────────────────────────────────────────
let kafka:    Kafka    | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;

const stats = {
  producedMessages:  0,
  consumedEntries:   0,
  producerErrors:    0,
  consumerErrors:    0,
  consumerConnected: false,
  producerConnected: false,
  lastProducedAt:    null as Date | null,
  lastConsumedAt:    null as Date | null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildSasl(): SASLOptions | undefined {
  if (!SASL_MECH || !SASL_USER || !SASL_PASS) return undefined;
  // Confluent Cloud / MSK use "plain" or SCRAM variants
  return {
    mechanism: SASL_MECH,
    username:  SASL_USER,
    password:  SASL_PASS,
  } as SASLOptions;
}

function createKafkaClient(): Kafka {
  const sasl = buildSasl();
  return new Kafka({
    clientId: CLIENT_ID,
    brokers:  BROKERS,
    // TLS is required when SASL is configured, or when KAFKA_SSL=true
    ssl:  USE_SSL || !!sasl,
    sasl: sasl,
    // Suppress info-level noise in app logs; errors/warnings only
    logLevel: logLevel.WARN,
    retry: {
      initialRetryTime: 300,
      retries: 8,
    },
  });
}

// ── Topic provisioning ────────────────────────────────────────────────────────
async function ensureTopic(kafka: Kafka): Promise<void> {
  const admin = kafka.admin();
  try {
    await admin.connect();
    const existing = await admin.listTopics();
    if (!existing.includes(TOPIC)) {
      await admin.createTopics({
        topics: [{
          topic:             TOPIC,
          numPartitions:     PARTITIONS,
          replicationFactor: Math.max(1, Math.min(REPLICATION, BROKERS.length)),
          configEntries: [
            { name: "retention.ms",       value: String(RETENTION_MS) },
            { name: "compression.type",   value: "gzip" },
            { name: "cleanup.policy",     value: "delete" },
            { name: "min.insync.replicas", value: "1" },
          ],
        }],
      });
      console.log(`[kafka] topic "${TOPIC}" created (${PARTITIONS} partitions, retention ${RETENTION_MS / 3600000}h)`);
    } else {
      console.log(`[kafka] topic "${TOPIC}" verified`);
    }
  } finally {
    await admin.disconnect().catch(() => {});
  }
}

// ── Producer ──────────────────────────────────────────────────────────────────
/**
 * Send a batch of log entries to the Kafka topic.
 * Keys by sourceId so all entries from the same source land on the same partition
 * (preserving intra-source ordering).
 * Returns { sent: true } on success, { sent: false, error } on failure.
 */
export async function kafkaSend(
  entries: Parameters<(typeof storage)["createLogEntriesBatch"]>[0],
): Promise<{ sent: boolean; error?: string }> {
  if (!producer) return { sent: false, error: "Kafka producer not connected" };
  try {
    const key = String(entries[0]?.sourceId ?? "unkeyed");
    await producer.send({
      topic:       TOPIC,
      compression: CompressionTypes.GZIP,
      messages:    [{ key, value: JSON.stringify(entries) }],
    });
    stats.producedMessages++;
    stats.lastProducedAt = new Date();
    return { sent: true };
  } catch (err: any) {
    stats.producerErrors++;
    return { sent: false, error: err.message };
  }
}

// ── Consumer ──────────────────────────────────────────────────────────────────
/**
 * Runs the Kafka consumer in-process.
 *
 * For large-scale deployments, this consumer can be extracted into a dedicated
 * worker container — but running it co-located is correct for most deployments
 * and avoids the operational overhead of a separate service.
 *
 * Each container instance joins the same consumer group. Kafka distributes
 * partitions across the group members, so N instances naturally share the work.
 */
async function runConsumer(): Promise<void> {
  if (!kafka || !consumer) return;

  await consumer.connect();
  stats.consumerConnected = true;

  // fromBeginning: false — only consume messages produced after startup.
  // In a fresh cluster, this is equivalent to latest offset.
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  const pending: Parameters<(typeof storage)["createLogEntriesBatch"]>[0] = [];

  const flush = async (): Promise<void> => {
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    try {
      await storage.createLogEntriesBatch(batch);
      stats.consumedEntries += batch.length;
      stats.lastConsumedAt  = new Date();
    } catch (err) {
      stats.consumerErrors++;
      console.error("[kafka] consumer DB write error:", err);
      // Re-queue failed entries so they are not silently dropped
      pending.unshift(...batch);
    }
  };

  await consumer.run({
    // eachBatch gives us full control over offset commits and heartbeats
    eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning }) => {
      for (const message of batch.messages) {
        if (!isRunning()) break;
        if (!message.value) { resolveOffset(message.offset); continue; }

        try {
          const entries = JSON.parse(message.value.toString()) as
            Parameters<(typeof storage)["createLogEntriesBatch"]>[0];
          pending.push(...entries);
          resolveOffset(message.offset);

          if (pending.length >= BATCH_SIZE) {
            await flush();
          }
          // Heartbeat every message to prevent session timeout under high load
          await heartbeat();
        } catch (err) {
          stats.consumerErrors++;
          console.error("[kafka] message parse error:", err);
          resolveOffset(message.offset); // skip unparseable message
        }
      }
      // Flush the tail of this batch before committing
      await flush();
    },
  });
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
export async function startKafkaPipeline(): Promise<void> {
  if (!kafkaEnabled) return;

  try {
    kafka = createKafkaClient();

    // 1. Ensure the ingest topic exists (idempotent)
    await ensureTopic(kafka);

    // 2. Start producer (idempotent = exactly-once at the producer level)
    producer = kafka.producer({
      allowAutoTopicCreation: false,
      idempotent:             true,   // Kafka >=0.11: no duplicate messages on retry
    });
    await producer.connect();
    stats.producerConnected = true;
    console.log(`[kafka] producer connected → ${BROKERS.join(", ")} (SSL:${USE_SSL || !!buildSasl()})`);

    // 3. Start consumer group (non-blocking — runs in background)
    consumer = kafka.consumer({
      groupId:           GROUP_ID,
      sessionTimeout:    30_000,
      heartbeatInterval: 3_000,
      maxBytesPerPartition: 1_048_576, // 1 MB per partition per fetch
    });

    runConsumer()
      .then(() => console.log(`[kafka] consumer group "${GROUP_ID}" active on topic "${TOPIC}"`))
      .catch(err => {
        stats.consumerErrors++;
        console.error("[kafka] consumer startup error:", err);
      });

  } catch (err: any) {
    console.error(
      `[kafka] startup failed — falling back to in-process buffer. Error: ${err.message}`
    );
    // Reset so kafkaSend returns { sent: false } and callers use the fallback buffer
    producer = null;
    consumer = null;
  }
}

/**
 * Disconnect the Kafka producer and consumer cleanly.
 * Called during graceful shutdown (SIGTERM) before process.exit().
 */
export async function stopKafkaPipeline(): Promise<void> {
  if (!kafkaEnabled) return;
  try {
    await Promise.allSettled([
      producer?.disconnect(),
      consumer?.disconnect(),
    ]);
    console.log("[kafka] producer and consumer disconnected");
  } catch (err) {
    console.error("[kafka] disconnect error:", err);
  }
}

/** Returns live stats for the /health endpoint */
export function getKafkaStats() {
  return {
    enabled:           kafkaEnabled,
    brokers:           kafkaEnabled ? BROKERS : [],
    topic:             TOPIC,
    partitions:        PARTITIONS,
    consumerGroup:     GROUP_ID,
    producerConnected: stats.producerConnected,
    consumerConnected: stats.consumerConnected,
    producedMessages:  stats.producedMessages,
    consumedEntries:   stats.consumedEntries,
    producerErrors:    stats.producerErrors,
    consumerErrors:    stats.consumerErrors,
    lastProducedAt:    stats.lastProducedAt,
    lastConsumedAt:    stats.lastConsumedAt,
    mode:              kafkaEnabled ? "kafka" : "in-process-buffer",
  };
}
