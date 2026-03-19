import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as childProcess from "child_process";
import { buildTransportChain, TransportChain } from "./transports";

const HOLOCRON_TOKEN = process.env.HOLOCRON_TOKEN || "";
const HOLOCRON_HMAC_SECRET = process.env.HOLOCRON_HMAC_SECRET || "";
const PROBE_VERSION = "4.1.0-coupled";
let heartbeatInterval = parseInt(process.env.HEARTBEAT_INTERVAL || "60", 10) * 1000;

let transport: TransportChain;

interface CpuTimes { user: number; nice: number; system: number; idle: number; iowait: number; irq: number; softirq: number; steal: number; }

function readProcStat(): CpuTimes {
  try {
    const stat = fs.readFileSync("/proc/stat", "utf8");
    const line = stat.split("\n")[0];
    const parts = line.split(/\s+/).slice(1).map(Number);
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
    const statvfs = fs.statfsSync("/");
    const total = statvfs.blocks * statvfs.bsize;
    const free = statvfs.bfree * statvfs.bsize;
    return total === 0 ? 0 : Math.round(((total - free) / total) * 1000) / 10;
  } catch { return 0; }
}

function getLoadAverage(): number { return Math.round(os.loadavg()[0] * 100) / 100; }

function getUptime(): number {
  try {
    const uptime = fs.readFileSync("/proc/uptime", "utf8");
    return Math.floor(parseFloat(uptime.split(" ")[0]));
  } catch { return Math.floor(os.uptime()); }
}

function getTemperature(): number {
  try {
    const temp = fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8");
    return Math.round(parseInt(temp.trim(), 10) / 100) / 10;
  } catch { return 0; }
}

function getNetworkInterfaces(): any[] {
  try {
    const netDev = fs.readFileSync("/proc/net/dev", "utf8");
    const lines = netDev.split("\n").slice(2);
    const ifaces: any[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/[:\s]+/);
      if (parts.length < 10) continue;
      const name = parts[0];
      if (name === "lo") continue;
      const rxBytes = parseInt(parts[1], 10);
      const txBytes = parseInt(parts[9], 10);
      const type = name.startsWith("wl") ? "wireless" : name.startsWith("wwan") ? "cellular" : "ethernet";
      ifaces.push({ name, type, status: "active", rxBytes, txBytes });
    }
    return ifaces;
  } catch { return []; }
}

function getSystemInfo() {
  const cpus = os.cpus();
  return {
    hostname: os.hostname(),
    ip: getLocalIp(),
    osInfo: `${os.type()} ${os.release()} ${os.arch()}`,
    macAddress: getMacAddress(),
    manufacturer: readDmiField("/sys/class/dmi/id/sys_vendor", "Unknown"),
    model: readDmiField("/sys/class/dmi/id/product_name", "Unknown"),
    cpuInfo: cpus.length > 0 ? `${cpus[0].model} (${cpus.length} cores)` : "Unknown",
    totalMemoryGB: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    systemType: detectSystemType(),
  };
}

function getLocalIp(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

function getMacAddress(): string {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") return iface.mac;
    }
  }
  return "unknown";
}

function readDmiField(path: string, fallback: string): string {
  try { return fs.readFileSync(path, "utf8").trim(); } catch { return fallback; }
}

function detectSystemType(): string {
  try {
    if (fs.existsSync("/.dockerenv")) return "container";
    const cgroup = fs.readFileSync("/proc/1/cgroup", "utf8");
    if (/docker|lxc|kubepods/.test(cgroup)) return "container";
  } catch {}
  try {
    const product = fs.readFileSync("/sys/class/dmi/id/product_name", "utf8").toLowerCase();
    if (/virtual|vmware|kvm|qemu|xen|hyperv/.test(product)) return "virtual-machine";
  } catch {}
  return "physical";
}

function log(msg: string) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function enroll(): Promise<boolean> {
  const sys = getSystemInfo();
  log(`Enrolling probe...`);
  log(`  Hostname: ${sys.hostname}`);
  log(`  IP: ${sys.ip}`);
  log(`  OS: ${sys.osInfo}`);
  log(`  CPU: ${sys.cpuInfo}`);
  log(`  Memory: ${sys.totalMemoryGB} GB`);
  log(`  Type: ${sys.systemType}`);
  log(`  Transport: ${transport.getActiveTransport()} (chain: ${transport.getTransportNames().join(" → ")})`);

  try {
    const result = await transport.send("/api/probe-enroll", {
      siteToken: HOLOCRON_TOKEN, hostname: sys.hostname, ipAddress: sys.ip,
      osInfo: sys.osInfo, probeVersion: PROBE_VERSION, deploymentType: "bare-metal",
      macAddress: sys.macAddress, manufacturer: sys.manufacturer, model: sys.model,
      cpuInfo: sys.cpuInfo, totalMemoryGB: sys.totalMemoryGB, systemType: sys.systemType,
    });
    if (result.success && result.data?.success) {
      log(`Enrolled (ID: ${result.data.probeId}) via ${result.transport}`);
      return true;
    }
    log(`Enrollment failed: ${result.error || result.data?.error || "unknown"}`);
    return false;
  } catch (e: any) { log(`Enrollment error: ${e.message}`); return false; }
}

async function executeRemediationTask(task: any): Promise<void> {
  const { id, scriptType, script, remediationScript, title } = task;
  const scriptContent: string = script || remediationScript || "";

  if (!id) return;
  if (!scriptContent) { log(`  [TASK] ${id}: empty script — skipping`); return; }
  if (scriptType && scriptType !== "bash" && scriptType !== "shell" && scriptType !== "sh") {
    log(`  [TASK] ${id}: unsupported type '${scriptType}' — skipping`); return;
  }

  log(`  [TASK] Executing ${id} (${scriptType || "bash"})`);

  const reportStatus = async (status: string, extras: Record<string, string> = {}) => {
    try {
      await transport.send("/api/probe-task-report", { siteToken: HOLOCRON_TOKEN, taskId: id, status, ...extras });
    } catch {}
  };

  await reportStatus("executing");

  const tmpFile = path.join(os.tmpdir(), `holocron_task_${id.replace(/[^a-z0-9]/gi, "_")}.sh`);
  try {
    fs.writeFileSync(tmpFile, scriptContent, { mode: 0o700 });

    const isLongRunning = /install|update|patch|upgrade|download|deploy|setup|apt|yum|dnf/i.test(title || "");
    const timeoutMs = isLongRunning ? 3600_000 : 1800_000;

    const result = childProcess.spawnSync("bash", [tmpFile], {
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = (result.stdout || "") + (result.stderr ? `\nSTDERR: ${result.stderr}` : "");
    if (result.status === 0) {
      log(`  [TASK] ${id}: completed`);
      await reportStatus("completed", { result: output.slice(0, 4000) });
    } else {
      const reason = result.error?.message || `Exit ${result.status ?? "timeout"}`;
      log(`  [TASK] ${id}: failed — ${reason}`);
      await reportStatus("failed", { error: `${reason}\n${output}`.slice(0, 4000) });
    }
  } catch (e: any) {
    log(`  [TASK] ${id}: error — ${e.message}`);
    await reportStatus("failed", { error: e.message });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

async function sendHeartbeat(): Promise<boolean> {
  const cpu = await getCpuUsage();
  const mem = getMemoryUsage();
  const disk = getDiskUsage();
  const sys = getSystemInfo();
  const net = getNetworkInterfaces();

  try {
    const result = await transport.send("/api/probe-heartbeat", {
      siteToken: HOLOCRON_TOKEN, hostname: sys.hostname, ipAddress: sys.ip,
      osInfo: sys.osInfo, probeVersion: PROBE_VERSION,
      cpuUsage: cpu, memoryUsage: mem, diskUsage: disk,
      taskQueueDepth: 0, activeTasks: 0, avgScanDurationMs: 0,
      networkInterfaces: net,
    });
    if (result.success && result.data?.success !== false) {
      if (result.data?.nextHeartbeat) heartbeatInterval = result.data.nextHeartbeat * 1000;
      log(`♥ CPU:${cpu}% Mem:${mem}% Disk:${disk}% via ${result.transport} (next: ${heartbeatInterval / 1000}s)`);
      const pendingTasks: any[] = result.data?.pendingTasks || [];
      for (const task of pendingTasks) {
        executeRemediationTask(task).catch(() => {});
      }
      return true;
    }
    log(`Heartbeat failed: ${result.error || "unknown"}`);
    return false;
  } catch (e: any) { log(`Heartbeat error: ${e.message}`); return false; }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║     HOLOCRON AI Coupled Probe Agent            ║");
  console.log(`║     Node.js v${PROBE_VERSION}  Multi-Transport    ║`);
  console.log("║     Kernel-direct · Zero OS dependency         ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log();

  if (!HOLOCRON_TOKEN) { log("ERROR: HOLOCRON_TOKEN is required"); process.exit(1); }

  transport = buildTransportChain(HOLOCRON_HMAC_SECRET);
  await transport.connect();

  log(`Token: ${HOLOCRON_TOKEN.slice(0, 10)}...${HOLOCRON_TOKEN.slice(-4)}`);
  log(`PID:   ${process.pid}`);
  log(`Chain: ${transport.getTransportNames().join(" → ")}`);
  log("");

  if (!await enroll()) { log("Failed to enroll. Exiting."); process.exit(1); }

  log(`Probe online. Heartbeat every ${heartbeatInterval / 1000}s`);
  log("");

  let retries = 0;
  const maxRetries = 5;

  const tick = async () => {
    if (await sendHeartbeat()) {
      retries = 0;
    } else {
      retries++;
      if (retries >= maxRetries) {
        log("Max retries reached. Re-enrolling...");
        if (await enroll()) retries = 0;
      }
    }
    setTimeout(tick, heartbeatInterval * Math.min(retries + 1, 5));
  };

  process.on("SIGTERM", () => { log("SIGTERM received. Shutting down."); transport.disconnect(); process.exit(0); });
  process.on("SIGINT", () => { log("SIGINT received. Shutting down."); transport.disconnect(); process.exit(0); });

  tick();
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
