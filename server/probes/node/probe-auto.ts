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
const PROBE_VERSION = "4.0.0-auto";

let transport: TransportChain;
const DATA_DIR = process.env.HOLOCRON_DATA_DIR || "/var/lib/holocron/autonomous";
const REMEDIATION_ENABLED = process.env.HOLOCRON_REMEDIATION !== "false";
const MAX_LOG_ENTRIES = parseInt(process.env.HOLOCRON_MAX_ENTRIES || "50000", 10);
let heartbeatInterval = parseInt(process.env.HEARTBEAT_INTERVAL || "300", 10) * 1000;

interface CpuTimes { user: number; nice: number; system: number; idle: number; iowait: number; irq: number; softirq: number; steal: number; }
interface Metrics { timestamp: string; cpuUsage: number; memoryUsage: number; diskUsage: number; temperature: number; loadAverage: number; uptime: number; processCount: number; openFiles: number; networkInterfaces: any[]; }
interface AiDecision { decision: string; reasoning: string; action: string | null; model: string; timestamp: string; }

function readProcStat(): CpuTimes {
  try {
    const parts = fs.readFileSync("/proc/stat", "utf8").split("\n")[0].split(/\s+/).slice(1).map(Number);
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
    const m = fs.readFileSync("/proc/meminfo", "utf8");
    const total = parseInt(m.match(/MemTotal:\s+(\d+)/)?.[1] || "0", 10);
    const avail = parseInt(m.match(/MemAvailable:\s+(\d+)/)?.[1] || "0", 10);
    return total === 0 ? 0 : Math.round(((total - avail) / total) * 1000) / 10;
  } catch { return 0; }
}

function getDiskUsage(): number {
  try {
    const s = fs.statfsSync("/");
    const total = s.blocks * s.bsize;
    return total === 0 ? 0 : Math.round(((total - s.bfree * s.bsize) / total) * 1000) / 10;
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

function getOpenFiles(): number {
  try { return parseInt(fs.readFileSync("/proc/sys/fs/file-nr", "utf8").split("\t")[0], 10); }
  catch { return 0; }
}

function getNetworkInterfaces(): any[] {
  try {
    return fs.readFileSync("/proc/net/dev", "utf8").split("\n").slice(2).filter(l => l.trim()).map(line => {
      const p = line.trim().split(/[:\s]+/);
      if (p[0] === "lo") return null;
      return { name: p[0], type: p[0].startsWith("wl") ? "wireless" : "ethernet", status: "active", rxBytes: parseInt(p[1], 10), txBytes: parseInt(p[9], 10) };
    }).filter(Boolean) as any[];
  } catch { return []; }
}

function getLocalIp(): string {
  for (const ifaces of Object.values(os.networkInterfaces()))
    for (const i of ifaces || [])
      if (i.family === "IPv4" && !i.internal) return i.address;
  return "127.0.0.1";
}

function getMacAddress(): string {
  for (const ifaces of Object.values(os.networkInterfaces()))
    for (const i of ifaces || [])
      if (!i.internal && i.mac && i.mac !== "00:00:00:00:00:00") return i.mac;
  return "unknown";
}

function readFile(p: string, fb: string): string {
  try { return fs.readFileSync(p, "utf8").trim(); } catch { return fb; }
}

function detectSystemType(): string {
  try { if (fs.existsSync("/.dockerenv")) return "container"; } catch {}
  try { if (/docker|lxc|kubepods/.test(fs.readFileSync("/proc/1/cgroup", "utf8"))) return "container"; } catch {}
  return "autonomous-node";
}

function getSystemInfo() {
  const cpus = os.cpus();
  return {
    hostname: os.hostname(), ip: getLocalIp(),
    osInfo: `${os.type()} ${os.release()} ${os.arch()}`,
    macAddress: getMacAddress(),
    manufacturer: readFile("/sys/class/dmi/id/sys_vendor", "Autonomous Node"),
    model: readFile("/sys/class/dmi/id/product_name", "Container"),
    cpuInfo: cpus.length > 0 ? `${cpus[0].model} (${cpus.length} cores)` : "Edge CPU",
    totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    systemType: detectSystemType(),
  };
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
    openFiles: getOpenFiles(),
    networkInterfaces: getNetworkInterfaces(),
  };
}

function ruleEngineReason(m: Metrics): AiDecision {
  const ts = new Date().toISOString();
  if (m.cpuUsage > 95) return { decision: "remediate", reasoning: `CPU critically high at ${m.cpuUsage}%. Identifying top process.`, action: "kill_top_cpu_process", model: "rule-engine-v2-auto", timestamp: ts };
  if (m.memoryUsage > 95) return { decision: "remediate", reasoning: `Memory critically high at ${m.memoryUsage}%. Clearing caches.`, action: "clear_memory", model: "rule-engine-v2-auto", timestamp: ts };
  if (m.diskUsage > 95) return { decision: "remediate", reasoning: `Disk critically full at ${m.diskUsage}%. Purging old files.`, action: "cleanup_disk", model: "rule-engine-v2-auto", timestamp: ts };
  if (m.temperature > 85) return { decision: "remediate", reasoning: `Thermal emergency at ${m.temperature}°C. Throttling.`, action: "throttle_workload", model: "rule-engine-v2-auto", timestamp: ts };
  if (m.cpuUsage > 80) return { decision: "alert", reasoning: `CPU usage elevated at ${m.cpuUsage}%.`, action: null, model: "rule-engine-v2-auto", timestamp: ts };
  if (m.memoryUsage > 85) return { decision: "alert", reasoning: `Memory pressure at ${m.memoryUsage}%.`, action: null, model: "rule-engine-v2-auto", timestamp: ts };
  if (m.diskUsage > 85) return { decision: "warn", reasoning: `Disk usage at ${m.diskUsage}%.`, action: null, model: "rule-engine-v2-auto", timestamp: ts };
  if (m.temperature > 75) return { decision: "warn", reasoning: `Temperature elevated at ${m.temperature}°C.`, action: null, model: "rule-engine-v2-auto", timestamp: ts };
  return { decision: "normal", reasoning: "All systems nominal", action: null, model: "rule-engine-v2-auto", timestamp: ts };
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

async function aiReason(metrics: Metrics): Promise<AiDecision> {
  if (!OPENAI_API_KEY) return ruleEngineReason(metrics);

  try {
    const url = new URL(`${OPENAI_BASE_URL}/v1/chat/completions`);
    const body = JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: "You are an autonomous HOLOCRON AI edge agent. You operate independently with zero server dependency. Analyze metrics and decide: {decision: normal|warn|alert|remediate, reasoning: string, action: null|kill_top_cpu_process|clear_memory|cleanup_disk|throttle_workload}. Respond with valid JSON only." },
        { role: "user", content: `System: CPU=${metrics.cpuUsage}%, Mem=${metrics.memoryUsage}%, Disk=${metrics.diskUsage}%, Temp=${metrics.temperature}°C, Load=${metrics.loadAverage}, Procs=${metrics.processCount}, OpenFiles=${metrics.openFiles}` },
      ],
      max_tokens: 300, temperature: 0.1,
    });
    const resp = await httpRequest(url, "POST", body, { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` });
    const content = resp?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
      return { ...parsed, model: OPENAI_MODEL, timestamp: new Date().toISOString() };
    }
  } catch (e: any) { log(`AI fallback: ${e.message}`); }
  return ruleEngineReason(metrics);
}

function findTopCpuProcess(): { pid: number; name: string; cpuTime: number } | null {
  try {
    const pids = fs.readdirSync("/proc").filter(f => /^\d+$/.test(f)).map(Number).filter(p => p > 1 && p !== process.pid);
    let top: { pid: number; name: string; cpuTime: number } | null = null;
    for (const pid of pids) {
      try {
        const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
        const parts = stat.match(/\(([^)]+)\)\s+(.*)/);
        if (!parts) continue;
        const name = parts[1];
        const fields = parts[2].split(/\s+/);
        const utime = parseInt(fields[11], 10) || 0;
        const stime = parseInt(fields[12], 10) || 0;
        const totalTime = utime + stime;
        if (!top || totalTime > top.cpuTime) top = { pid, name, cpuTime: totalTime };
      } catch {}
    }
    return top;
  } catch { return null; }
}

function walkDir(dir: string, ext: string[], maxAge: number, limit: number): string[] {
  const results: string[] = [];
  const now = Date.now();
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (results.length >= limit) break;
      const full = path.join(dir, e.name);
      try {
        if (e.isDirectory()) {
          results.push(...walkDir(full, ext, maxAge, limit - results.length));
        } else if (e.isFile()) {
          const matches = ext.length === 0 || ext.some(x => e.name.endsWith(x));
          if (matches) {
            const stat = fs.statSync(full);
            if (now - stat.atimeMs > maxAge) results.push(full);
          }
        }
      } catch {}
    }
  } catch {}
  return results;
}

function executeRemediation(action: string, reasoning: string): { status: string; details: string } {
  if (!REMEDIATION_ENABLED) {
    log(`  Remediation disabled. Action '${action}' logged only.`);
    return { status: "skipped", details: "remediation_disabled" };
  }

  log(`  Executing self-remediation: ${action}`);

  switch (action) {
    case "kill_top_cpu_process": {
      const top = findTopCpuProcess();
      if (!top) return { status: "skipped", details: "No suitable process found" };
      try {
        process.kill(top.pid, "SIGTERM");
        log(`    Killed PID ${top.pid} (${top.name})`);
        return { status: "success", details: `Killed PID ${top.pid}: ${top.name}` };
      } catch (e: any) { return { status: "failed", details: e.message }; }
    }

    case "clear_memory": {
      try {
        fs.writeFileSync("/proc/sys/vm/drop_caches", "3");
        log("    Cleared page cache, dentries, inodes");
        return { status: "success", details: "Caches cleared" };
      } catch {
        log("    Cannot clear caches (no permission)");
        return { status: "no_permission", details: "Requires root" };
      }
    }

    case "cleanup_disk": {
      let freedMB = 0;
      try {
        const DAY_MS = 86400000;
        const tmpFiles = walkDir("/tmp", [], DAY_MS, 100);
        for (const f of tmpFiles) { try { const s = fs.statSync(f); freedMB += s.size / (1024 * 1024); fs.unlinkSync(f); } catch {} }
        const logFiles = walkDir("/var/log", [".gz", ".old", ".1", ".2", ".3"], 0, 50);
        for (const f of logFiles) { try { const s = fs.statSync(f); freedMB += s.size / (1024 * 1024); fs.unlinkSync(f); } catch {} }
        log(`    Cleaned old files (freed ~${Math.round(freedMB)}MB)`);
        return { status: "success", details: `Freed ${Math.round(freedMB)}MB` };
      } catch (e: any) { return { status: "partial", details: `Freed ${Math.round(freedMB)}MB, some errors: ${e.message}` }; }
    }

    case "throttle_workload": {
      const pids = fs.readdirSync("/proc").filter(f => /^\d+$/.test(f)).map(Number).filter(p => p > 1 && p !== process.pid);
      let throttled = 0;
      const topPids: { pid: number; cpuTime: number }[] = [];
      for (const pid of pids) {
        try {
          const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
          const parts = stat.match(/\(([^)]+)\)\s+(.*)/);
          if (!parts) continue;
          const fields = parts[2].split(/\s+/);
          const utime = parseInt(fields[11], 10) || 0;
          const stime = parseInt(fields[12], 10) || 0;
          topPids.push({ pid, cpuTime: utime + stime });
        } catch {}
      }
      topPids.sort((a, b) => b.cpuTime - a.cpuTime);
      for (const { pid } of topPids.slice(0, 5)) {
        try {
          const oomPath = `/proc/${pid}/oom_score_adj`;
          fs.writeFileSync(oomPath, "500");
          throttled++;
        } catch {}
      }
      log(`    Throttled ${throttled} processes (raised OOM score)`);
      return { status: "success", details: `Throttled ${throttled} processes via OOM score adjustment` };
    }

    default:
      return { status: "unknown_action", details: action };
  }
}

function log(msg: string) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

class DataStore {
  private metricsFile: string;
  private decisionsFile: string;
  private actionsFile: string;
  private reasoningFile: string;

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.metricsFile = path.join(dir, "metrics.jsonl");
    this.decisionsFile = path.join(dir, "decisions.jsonl");
    this.actionsFile = path.join(dir, "actions.jsonl");
    this.reasoningFile = path.join(dir, "reasoning.log");
    for (const f of [this.metricsFile, this.decisionsFile, this.actionsFile, this.reasoningFile])
      if (!fs.existsSync(f)) fs.writeFileSync(f, "");
  }

  writeMetrics(m: Metrics) { this.append(this.metricsFile, JSON.stringify(m)); }

  writeDecision(m: Metrics, d: AiDecision) {
    this.append(this.decisionsFile, JSON.stringify({ timestamp: m.timestamp, metrics: { cpu: m.cpuUsage, mem: m.memoryUsage, disk: m.diskUsage, temp: m.temperature, load: m.loadAverage }, decision: d.decision, reasoning: d.reasoning, action: d.action }));
    this.append(this.reasoningFile, `[${m.timestamp.slice(11, 19)}] ${d.decision} | CPU:${m.cpuUsage}% Mem:${m.memoryUsage}% Disk:${m.diskUsage}% Temp:${m.temperature}°C Load:${m.loadAverage} | ${d.reasoning}`);
  }

  writeAction(action: string, result: { status: string; details: string }, reasoning: string) {
    this.append(this.actionsFile, JSON.stringify({ timestamp: new Date().toISOString(), action, status: result.status, details: result.details, reasoning }));
  }

  private append(file: string, line: string) {
    fs.appendFileSync(file, line + "\n");
    try {
      const count = fs.readFileSync(file, "utf8").split("\n").length;
      if (count > MAX_LOG_ENTRIES) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        fs.writeFileSync(file, lines.slice(Math.floor(MAX_LOG_ENTRIES / 2)).join("\n"));
      }
    } catch {}
  }

  getStats(): { metrics: number; decisions: number; actions: number } {
    const count = (f: string) => { try { return fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).length; } catch { return 0; } };
    return { metrics: count(this.metricsFile), decisions: count(this.decisionsFile), actions: count(this.actionsFile) };
  }

  showRecent(type: "reasoning" | "actions" | "metrics", n: number = 20): string {
    const file = type === "reasoning" ? this.reasoningFile : type === "actions" ? this.actionsFile : this.metricsFile;
    try {
      const lines = fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean);
      return lines.slice(-n).join("\n");
    } catch { return "No data yet."; }
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║   HOLOCRON AI Fully Autonomous Probe           ║");
  console.log(`║   Node.js v${PROBE_VERSION}  Multi-Transport      ║`);
  console.log("║   Kernel-direct · Self-Healing · Independent    ║");
  console.log("║   Zero Server Dependency                        ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log();

  transport = buildTransportChain(HOLOCRON_HMAC_SECRET);
  await transport.connect();

  const store = new DataStore(DATA_DIR);
  log(`Data:    ${DATA_DIR}`);
  log(`AI:      ${OPENAI_API_KEY ? `OpenAI (${OPENAI_MODEL})` : "Rule Engine v2 (local)"}`);
  log(`Heal:    ${REMEDIATION_ENABLED ? "Self-remediation enabled" : "Remediation disabled"}`);
  log(`Chain:   ${transport.getTransportNames().join(" → ")}`);
  log(`PID:     ${process.pid}`);
  log("");

  if (HOLOCRON_TOKEN) {
    try {
      const sys = getSystemInfo();
      const result = await transport.send("/api/probe-enroll", {
        siteToken: HOLOCRON_TOKEN, hostname: sys.hostname, ipAddress: sys.ip,
        osInfo: sys.osInfo, probeVersion: PROBE_VERSION, deploymentType: "autonomous",
        macAddress: sys.macAddress, manufacturer: sys.manufacturer, model: sys.model,
        cpuInfo: sys.cpuInfo, totalMemoryGB: sys.totalMemoryGB, systemType: sys.systemType,
      });
      if (result.success && result.data?.success) log(`Registered with server (ID: ${result.data.probeId}) via ${result.transport}`);
    } catch { log("All transports unavailable — proceeding autonomously"); }
  }

  log("Autonomous probe operational. No server dependency.");
  log("");

  const tick = async () => {
    const metrics = await collectMetrics();
    store.writeMetrics(metrics);

    log("Autonomous reasoning...");
    const decision = await aiReason(metrics);
    store.writeDecision(metrics, decision);

    const stats = store.getStats();
    const icon = decision.decision === "remediate" ? "FIX" : decision.decision.startsWith("alert") ? "!!!" : decision.decision.startsWith("warn") ? "??" : "ok";
    log(`[${icon}] CPU:${metrics.cpuUsage}% Mem:${metrics.memoryUsage}% Disk:${metrics.diskUsage}% Temp:${metrics.temperature}°C Load:${metrics.loadAverage} [AI:${decision.decision}] (${stats.metrics}m/${stats.actions}a)`);

    if (decision.decision === "remediate" && decision.action) {
      const result = executeRemediation(decision.action, decision.reasoning);
      store.writeAction(decision.action, result, decision.reasoning);
    }

    setTimeout(tick, heartbeatInterval);
  };

  process.on("SIGTERM", () => { const s = store.getStats(); log(`Shutting down. Metrics:${s.metrics} Decisions:${s.decisions} Actions:${s.actions}`); log(`Data preserved at ${DATA_DIR}`); transport.disconnect(); process.exit(0); });
  process.on("SIGINT", () => { const s = store.getStats(); log(`Shutting down. Metrics:${s.metrics} Decisions:${s.decisions} Actions:${s.actions}`); log(`Data preserved at ${DATA_DIR}`); transport.disconnect(); process.exit(0); });

  tick();
}

const cmd = process.argv[2];
if (cmd === "test") {
  (async () => {
    const store = new DataStore(DATA_DIR);
    log("Running autonomous probe test...");
    const metrics = await collectMetrics();
    log(`Metrics: CPU=${metrics.cpuUsage}% Mem=${metrics.memoryUsage}% Disk=${metrics.diskUsage}% Temp=${metrics.temperature}°C Load=${metrics.loadAverage} Procs=${metrics.processCount} Files=${metrics.openFiles}`);
    const decision = await aiReason(metrics);
    log(`Decision: ${decision.decision} (${decision.model})`);
    log(`Reasoning: ${decision.reasoning}`);
    if (decision.action) log(`Action: ${decision.action}`);
    store.writeMetrics(metrics);
    store.writeDecision(metrics, decision);
    log("Test complete.");
  })();
} else if (cmd === "status") {
  const store = new DataStore(DATA_DIR);
  const s = store.getStats();
  console.log("HOLOCRON AI Autonomous Probe Status");
  console.log(`  Metrics:    ${s.metrics} collected`);
  console.log(`  Decisions:  ${s.decisions} made`);
  console.log(`  Actions:    ${s.actions} taken`);
  console.log(`  Data Dir:   ${DATA_DIR}`);
  console.log(`  AI Engine:  ${OPENAI_API_KEY ? `OpenAI (${OPENAI_MODEL})` : "Rule Engine v2"}`);
  console.log(`  Remediation: ${REMEDIATION_ENABLED ? "Enabled" : "Disabled"}`);
} else if (cmd === "reason") {
  const store = new DataStore(DATA_DIR);
  console.log("Recent Autonomous Decisions (last 30):");
  console.log(store.showRecent("reasoning", 30));
} else if (cmd === "actions") {
  const store = new DataStore(DATA_DIR);
  console.log("Remediation Action History (last 20):");
  console.log(store.showRecent("actions", 20));
} else if (cmd === "metrics") {
  const store = new DataStore(DATA_DIR);
  console.log("Recent Metrics (last 10):");
  console.log(store.showRecent("metrics", 10));
} else {
  main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
}
