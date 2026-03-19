import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  TerminalSquare, Play, Search, CheckCircle2, XCircle, Loader2, Clock,
  Smartphone, Server, Monitor, ChevronDown, ChevronRight, Trash2, BookOpen,
  Activity, Layers, Database, ShieldAlert, ClipboardCheck, AppWindow, Cloud,
  AlertTriangle, AlertOctagon, User, Bot, Link2, RotateCcw, Network,
  AlertCircle, Plus, Library, Send, FlaskConical, Package, Star, Eye,
  PenLine, Zap, Archive, RefreshCw, CheckCheck, X, Lock, Shield,
  HardDrive, Wifi, Users, Settings, Sparkles, History, CalendarClock,
  ShieldCheck, ShieldX, TrendingUp, Info, Lightbulb, HeartPulse, Repeat,
  Filter, ChevronUp, Ban, ThumbsUp, ThumbsDown, SquareTerminal,
} from "lucide-react";
import type { DiscoveryProbe, RemediationTask } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────
type DiscoveredAsset = {
  id: string; name: string; type: string; vendor: string | null;
  model: string | null; ipAddress: string | null; status: string;
  probeId: string | null; lastSeen: string | null;
  metadata?: Record<string, any> | null;
};
type OSFamily = "windows" | "linux" | "macos" | "android" | "unknown";
type CatalogEntry = {
  id: string; userId: string; name: string; description: string | null;
  category: string; scriptType: string; script: string; riskLevel: string;
  authorType: string; authorName: string | null;
  compatibleOs: string[] | null; tags: string[] | null; status: string;
  dryRunAssetId: string | null; dryRunBatchId: string | null;
  dryRunResult: string | null; dryRunError: string | null; dryRunAt: string | null;
  publishedAt: string | null; version: number; usageCount: number;
  changeRef: string | null; createdAt: string; updatedAt: string;
  aiReviewStatus: string | null; aiReviewVerdict: string | null;
  aiReviewScore: number | null; aiReviewNotes: any | null;
  aiReviewAt: string | null; aiReviewCacheHit: boolean | null;
  rollbackScript: string | null;
};
type ScopeUser = { id: string; username: string; displayName: string; role: string; commandScopes: string[] };
type CommandSchedule = {
  id: string; userId: string; name: string; description: string | null;
  script: string; scriptType: string; assetIds: string[];
  cronExpression: string; nextRunAt: string | null; lastRunAt: string | null;
  enabled: boolean; riskLevel: string; category: string;
  catalogEntryId: string | null; changeRef: string | null; runCount: number;
  createdAt: string; updatedAt: string;
};
type CommandApproval = {
  id: string; taskId: string; batchId: string; title: string;
  script: string; scriptType: string; assetId: string; assetName: string | null;
  riskLevel: string; changeRef: string | null;
  requestedById: string; requestedByName: string | null;
  approvedById: string | null; approvedByName: string | null;
  status: string; notes: string | null; requestedAt: string;
  resolvedAt: string | null; expiresAt: string | null;
};

// ── Command Scope domains ─────────────────────────────────────────────────────
const SCOPE_DOMAINS = [
  { id: "network",  label: "Network",   icon: Network,    color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30",   assetTypes: ["switch","router","firewall","load_balancer","vpn","access_point","network_device"] },
  { id: "compute",  label: "Compute",   icon: Server,     color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", assetTypes: ["server","workstation","hypervisor","vm"] },
  { id: "endpoint", label: "Endpoint",  icon: Monitor,    color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/30",   assetTypes: ["endpoint","laptop","desktop","mobile","phone"] },
  { id: "database", label: "Database",  icon: Database,   color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", assetTypes: ["database","db_server"] },
  { id: "security", label: "Security",  icon: Shield,     color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    assetTypes: ["ids","ips","siem","hsm"] },
  { id: "cloud",    label: "Cloud",     icon: Cloud,      color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/30",    assetTypes: ["cloud","cloud_instance","cloud_storage","cloud_function"] },
  { id: "storage",  label: "Storage",   icon: HardDrive,  color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30",  assetTypes: ["storage","nas","san"] },
  { id: "iot",      label: "IoT",       icon: Wifi,       color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  assetTypes: ["iot_sensor","iot_device","iot"] },
] as const;
type ScopeDomainId = typeof SCOPE_DOMAINS[number]["id"];

function getAllowedAssetTypes(scopes: string[]): string[] | null {
  if (!scopes || scopes.length === 0) return null; // unrestricted
  const types = new Set<string>();
  for (const scope of scopes) {
    const domain = SCOPE_DOMAINS.find(d => d.id === scope);
    if (domain) domain.assetTypes.forEach(t => types.add(t));
  }
  return [...types];
}
function isAssetInScope(assetType: string, allowedTypes: string[] | null): boolean {
  if (!allowedTypes) return true;
  return allowedTypes.includes(assetType);
}
function getAssetDomain(assetType: string): string | null {
  for (const d of SCOPE_DOMAINS) { if ((d.assetTypes as readonly string[]).includes(assetType)) return d.id; }
  return null;
}

// ── OS Detection ──────────────────────────────────────────────────────────────
function detectAssetOS(asset: DiscoveredAsset): OSFamily {
  const meta = asset.metadata as any;
  const osStr = (meta?.software?.os || "").toLowerCase();
  const name = (asset.name || "").toLowerCase();
  const type = (asset.type || "").toLowerCase();
  if (osStr.includes("windows") || name.startsWith("desktop-") || name.startsWith("srv-win") || name.startsWith("win-")) return "windows";
  if (osStr.includes("android") || osStr.includes("samsung") || name.includes("sm-f") || (type === "endpoint" && (name.includes("samsung") || name.includes("sm-")))) return "android";
  if (osStr.includes("darwin") || osStr.includes("macos") || osStr.includes("mac os") || name.includes("macbook") || name.includes("mac-") || (name.endsWith(".local") && type === "endpoint")) return "macos";
  if (osStr.includes("linux") || osStr.includes("ubuntu") || osStr.includes("debian") || osStr.includes("centos") || osStr.includes("rhel") || osStr.includes("fedora") || osStr.includes("alpine")) return "linux";
  if (type === "workstation") return "windows";
  if (type === "server" || type === "iot_sensor" || type === "switch" || type === "router") return "linux";
  return "unknown";
}
const OS_LABELS: Record<OSFamily, string> = { windows: "Windows", linux: "Linux", macos: "macOS", android: "Android", unknown: "Unknown" };
const OS_COLORS: Record<OSFamily, string> = { windows: "text-sky-400", linux: "text-orange-400", macos: "text-purple-400", android: "text-green-400", unknown: "text-muted-foreground" };
const OS_BG: Record<OSFamily, string> = { windows: "bg-sky-500/10", linux: "bg-orange-500/10", macos: "bg-purple-500/10", android: "bg-green-500/10", unknown: "bg-muted/20" };

// ── Script ↔ OS Compatibility ─────────────────────────────────────────────────
const SCRIPT_COMPAT: Record<string, OSFamily[]> = {
  bash: ["linux", "macos", "android"], powershell: ["windows", "linux", "macos"],
  python: ["windows", "linux", "macos", "android", "unknown"], vbscript: ["windows"],
  batch: ["windows"], sql: ["windows", "linux", "macos", "android", "unknown"],
  ansible: ["linux", "macos"], perl: ["linux", "macos", "android"],
};
const SCRIPT_INCOMPAT_REASON: Record<string, Partial<Record<OSFamily, string>>> = {
  bash: { windows: "Bash is not natively available on Windows. Use PowerShell or Batch instead." },
  vbscript: { linux: "VBScript is Windows-only.", macos: "VBScript is Windows-only.", android: "VBScript is Windows-only." },
  batch: { linux: "Batch (.bat) files are Windows-only.", macos: "Batch (.bat) files are Windows-only.", android: "Batch (.bat) files are Windows-only." },
  ansible: { windows: "Ansible control node requires Linux/macOS.", android: "Ansible does not run on Android." },
  perl: { windows: "Perl is not natively available on Windows." },
  powershell: { android: "PowerShell is not available on Android." },
};
function compatibleOS(scriptType: string, os: OSFamily): boolean {
  if (os === "unknown") return true;
  const allowed = SCRIPT_COMPAT[scriptType];
  return !allowed || allowed.includes(os);
}
function incompatReason(scriptType: string, os: OSFamily): string {
  return SCRIPT_INCOMPAT_REASON[scriptType]?.[os] ?? `${scriptType} may not be available on ${OS_LABELS[os]}.`;
}

// ── ITIL Categories ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "network",     label: "Network Ops",   icon: Network,        color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/30"   },
  { id: "database",    label: "Database",       icon: Database,       color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  { id: "security",    label: "Cybersecurity",  icon: ShieldAlert,    color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30"    },
  { id: "compliance",  label: "Compliance",     icon: ClipboardCheck, color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30"  },
  { id: "application", label: "Application",    icon: AppWindow,      color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30"  },
  { id: "endpoint",    label: "Endpoint",       icon: Monitor,        color: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/30"   },
  { id: "cloud",       label: "Cloud & Infra",  icon: Cloud,          color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/30"    },
  { id: "monitoring",  label: "Monitoring",     icon: Activity,       color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
] as const;
type CategoryId = typeof CATEGORIES[number]["id"];

const SCRIPT_TYPES = [
  { id: "bash", label: "Bash", color: "text-green-400" }, { id: "powershell", label: "PowerShell", color: "text-blue-400" },
  { id: "python", label: "Python", color: "text-yellow-400" }, { id: "vbscript", label: "VBScript", color: "text-cyan-400" },
  { id: "batch", label: "Batch (.bat)", color: "text-orange-400" }, { id: "sql", label: "SQL", color: "text-purple-400" },
  { id: "ansible", label: "Ansible", color: "text-red-400" }, { id: "perl", label: "Perl", color: "text-pink-400" },
];

const RISK_LEVELS = [
  { id: "low",    label: "Low",    icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", desc: "Read-only / audit" },
  { id: "medium", label: "Medium", icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25",   desc: "Config changes" },
  { id: "high",   label: "High",   icon: AlertOctagon,  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25",     desc: "Destructive" },
] as const;
type RiskId = typeof RISK_LEVELS[number]["id"];

// ── Catalog status config ─────────────────────────────────────────────────────
const CATALOG_STATUS: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  draft:            { label: "Draft",           color: "text-muted-foreground", bg: "bg-muted/20",         border: "border-border/40",        icon: PenLine     },
  dry_run_pending:  { label: "Dry Run Running", color: "text-primary",          bg: "bg-primary/10",       border: "border-primary/30",       icon: FlaskConical},
  dry_run_passed:   { label: "Dry Run ✓",       color: "text-emerald-400",      bg: "bg-emerald-500/10",   border: "border-emerald-500/30",   icon: CheckCheck  },
  dry_run_failed:   { label: "Dry Run ✗",       color: "text-red-400",          bg: "bg-red-500/10",       border: "border-red-500/30",       icon: XCircle     },
  published:        { label: "Published",        color: "text-violet-400",       bg: "bg-violet-500/10",    border: "border-violet-500/30",    icon: Package     },
  deprecated:       { label: "Deprecated",       color: "text-muted-foreground", bg: "bg-muted/10",         border: "border-border/20",        icon: Archive     },
};

// ── Small shared UI ───────────────────────────────────────────────────────────
const assetTypeIcon = (type: string) => { if (type === "endpoint") return Smartphone; if (type === "server") return Server; if (type === "workstation") return Monitor; if (type === "switch" || type === "router") return Network; return Layers; };
const statusDot: Record<string, string> = { online: "bg-emerald-500", offline: "bg-gray-500", degraded: "bg-amber-500" };
function timeAgo(ts: string | null | undefined) {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; return `${Math.floor(s / 3600)}h ago`;
}
function RiskBadge({ risk }: { risk: string }) {
  const r = RISK_LEVELS.find(x => x.id === risk) ?? RISK_LEVELS[0]; const Icon = r.icon;
  return <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${r.color} ${r.bg} ${r.border}`}><Icon className="h-2.5 w-2.5" />{r.label}</span>;
}
function CatBadge({ cat }: { cat: string }) {
  const c = CATEGORIES.find(x => x.id === cat); if (!c) return null; const Icon = c.icon;
  return <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${c.color} ${c.bg} ${c.border}`}><Icon className="h-2.5 w-2.5" />{c.label}</span>;
}
function OSBadge({ os }: { os: string }) {
  const o = os as OSFamily;
  return <span className={`inline-flex items-center gap-0.5 text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${OS_COLORS[o] ?? "text-muted-foreground"} ${OS_BG[o] ?? "bg-muted/20"}`}>{OS_LABELS[o] ?? os}</span>;
}
function StatusBadge({ status }: { status: string }) {
  const s = CATALOG_STATUS[status] ?? CATALOG_STATUS.draft; const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${s.color} ${s.bg} ${s.border}`}><Icon className="h-2.5 w-2.5" />{s.label}</span>;
}
function ScopeDomainBadge({ scopeId }: { scopeId: string }) {
  const d = SCOPE_DOMAINS.find(x => x.id === scopeId); if (!d) return null; const Icon = d.icon;
  return <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${d.color} ${d.bg} ${d.border}`}><Icon className="h-2.5 w-2.5" />{d.label}</span>;
}

// ── Task result card ──────────────────────────────────────────────────────────
const CONFIDENCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high:   { label: "High confidence",   color: "text-emerald-400", bg: "bg-emerald-500/10" },
  medium: { label: "Medium confidence", color: "text-amber-400",   bg: "bg-amber-500/10"   },
  low:    { label: "Low confidence",    color: "text-red-400",     bg: "bg-red-500/10"     },
};

function TaskResultCard({ task, assetName, onDebug, debugLoading, debugResult, debugError, onApplyFix, onApplyRedispatch }: {
  task: RemediationTask; assetName: string;
  onDebug: () => void; debugLoading: boolean;
  debugResult: any | null; debugError: string | null;
  onApplyFix: (script: string) => void;
  onApplyRedispatch: (script: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [showFixScript, setShowFixScript] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<any | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const isRunning = ["queued", "dispatched", "executing"].includes(task.status);
  const isPendingApproval = task.status === "pending_approval";
  const isDone = task.status === "completed"; const isFailed = task.status === "failed";
  const canDebug = isFailed && (task.error || task.result);
  const hasRollback = isDone && !!(task as any).rollbackScript;

  const rollbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${task.id}/rollback`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rollback initiated", description: "Rollback script queued for execution." });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks"] });
    },
    onError: (e: any) => toast({ title: "Rollback failed", description: e.message, variant: "destructive" }),
  });

  async function handleAnalyze() {
    setAnalyzeOpen(true); setAnalyzeLoading(true); setAnalyzeError(null);
    try {
      const res = await apiRequest("POST", `/api/remediation-tasks/${task.id}/ai-analyze`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalyzeResult(data);
    } catch (e: any) { setAnalyzeError(e.message); }
    finally { setAnalyzeLoading(false); }
  }

  const verdictColor: Record<string, string> = { healthy: "text-emerald-400", warning: "text-amber-400", degraded: "text-orange-400", critical: "text-red-400" };
  const severityColor: Record<string, string> = { info: "text-blue-400", warning: "text-amber-400", critical: "text-red-400" };

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${isDone ? "border-emerald-500/30 bg-emerald-500/5" : isFailed ? "border-red-500/30 bg-red-500/5" : isPendingApproval ? "border-amber-500/30 bg-amber-500/5" : "border-border/40 bg-muted/20"}`}>
      <button className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30" onClick={() => setOpen(o => !o)} data-testid={`button-expand-${task.id}`}>
        {isRunning && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />}
        {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
        {isFailed && <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
        {isPendingApproval && <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
        {task.status === "timed-out" && <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
        <span className="text-xs font-semibold truncate flex-1">{assetName}</span>
        <span className={`text-[9px] font-bold capitalize px-1.5 py-0.5 rounded ${isDone ? "text-emerald-400 bg-emerald-500/10" : isFailed ? "text-red-400 bg-red-500/10" : isPendingApproval ? "text-amber-400 bg-amber-500/10" : "text-primary bg-primary/10"}`}>{task.status.replace(/_/g, " ")}</span>
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1.5">
          {isPendingApproval && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-2">
              <Clock className="h-3 w-3 shrink-0" />Awaiting 4-Eyes approval before execution
            </div>
          )}
          {(task.result || task.error) ? (
            <pre className="text-[10px] font-mono text-foreground/80 bg-background/60 border border-border/30 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-28 overflow-y-auto">{task.result || task.error}</pre>
          ) : isRunning ? (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Waiting for probe heartbeat…</div>
          ) : null}
          {task.completedAt && <p className="text-[9px] text-muted-foreground">Done {timeAgo(task.completedAt as any)}</p>}

          {/* Completed task action row */}
          {isDone && (
            <div className="flex gap-1.5 mt-1">
              <button
                className={`flex-1 flex items-center justify-center gap-1 text-[9px] font-semibold px-2 py-1.5 rounded-lg border transition-colors ${analyzeOpen && analyzeResult ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-teal-500/20 bg-teal-500/5 text-teal-400 hover:border-teal-500/40 hover:bg-teal-500/10"}`}
                onClick={handleAnalyze} disabled={analyzeLoading}
                data-testid={`button-ai-analyze-${task.id}`}>
                {analyzeLoading ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing…</> : <><TrendingUp className="h-3 w-3" />AI Analyze</>}
              </button>
              {hasRollback && (
                <button
                  className="flex-1 flex items-center justify-center gap-1 text-[9px] font-semibold px-2 py-1.5 rounded-lg border border-orange-500/20 bg-orange-500/5 text-orange-400 hover:border-orange-500/40 hover:bg-orange-500/10 transition-colors"
                  onClick={() => rollbackMutation.mutate()} disabled={rollbackMutation.isPending}
                  data-testid={`button-rollback-${task.id}`}>
                  {rollbackMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Rolling back…</> : <><RotateCcw className="h-3 w-3" />Rollback</>}
                </button>
              )}
            </div>
          )}

          {/* AI Analyze result panel */}
          {analyzeOpen && (analyzeLoading || analyzeResult || analyzeError) && (
            <div className="mt-1.5 rounded-lg border border-teal-500/30 bg-teal-500/5 space-y-2 overflow-hidden">
              <div className="px-2.5 pt-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <HeartPulse className="h-3 w-3 text-teal-400" />
                  <span className="text-[10px] font-semibold text-teal-300">AI Output Analysis</span>
                  {analyzeResult?.cacheHit && <span className="text-[8px] text-primary bg-primary/10 border border-primary/20 px-1 rounded-full">cached</span>}
                </div>
                {analyzeResult?.healthScore != null && (
                  <span className={`text-[9px] font-bold ${verdictColor[analyzeResult.verdict] ?? "text-foreground"}`}>
                    Health {analyzeResult.healthScore}/100
                  </span>
                )}
              </div>
              {analyzeLoading && <div className="px-2.5 pb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Running analysis…</div>}
              {analyzeError && <p className="px-2.5 pb-2 text-[9px] text-red-400">{analyzeError}</p>}
              {analyzeResult && (
                <>
                  <div className="px-2.5"><p className="text-[10px] text-foreground/70">{analyzeResult.summary}</p></div>
                  {analyzeResult.findings?.length > 0 && (
                    <div className="px-2.5 space-y-0.5">
                      <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Findings</p>
                      {analyzeResult.findings.map((f: any, i: number) => (
                        <div key={i} className="flex items-start gap-1 text-[9px]">
                          <Info className={`h-2.5 w-2.5 shrink-0 mt-0.5 ${severityColor[f.severity] ?? "text-muted-foreground"}`} />
                          <span className={severityColor[f.severity] ?? "text-foreground/60"}>{f.title}: <span className="text-foreground/50">{f.detail}</span></span>
                        </div>
                      ))}
                    </div>
                  )}
                  {analyzeResult.recommendations?.length > 0 && (
                    <div className="px-2.5 pb-2 space-y-0.5">
                      <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Recommendations</p>
                      {analyzeResult.recommendations.map((r: string, i: number) => (
                        <div key={i} className="flex items-start gap-1 text-[9px] text-emerald-400"><Lightbulb className="h-2.5 w-2.5 shrink-0 mt-0.5" />{r}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* AI Debug button (only for failed tasks) */}
          {canDebug && !debugResult && (
            <button
              className={`w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold px-2 py-1.5 rounded-lg border transition-colors mt-1 ${debugLoading ? "border-violet-500/40 bg-violet-500/10 text-violet-400" : "border-red-500/20 bg-red-500/5 text-red-400 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-400"}`}
              onClick={onDebug} disabled={debugLoading}
              data-testid={`button-ai-debug-${task.id}`}>
              {debugLoading ? <><Loader2 className="h-3 w-3 animate-spin" />AI Agent analyzing error…</> : <><Bot className="h-3 w-3" />Debug with AI Agent</>}
            </button>
          )}
          {debugError && <p className="text-[9px] text-red-400">{debugError}</p>}

          {/* AI Debug result panel */}
          {debugResult && (
            <div className="mt-1.5 rounded-lg border border-violet-500/30 bg-violet-500/5 space-y-2 overflow-hidden">
              {/* Header */}
              <div className="px-2.5 pt-2 flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <Bot className="h-3 w-3 text-violet-400" />
                  <span className="text-[10px] font-semibold text-violet-300">AI Agent Fix</span>
                  {debugResult.cacheHit && <span className="text-[8px] text-primary bg-primary/10 border border-primary/20 px-1 rounded-full">0 tokens · cached</span>}
                </div>
                {debugResult.confidence && (
                  <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${CONFIDENCE_CONFIG[debugResult.confidence]?.color} ${CONFIDENCE_CONFIG[debugResult.confidence]?.bg}`}>
                    {CONFIDENCE_CONFIG[debugResult.confidence]?.label}
                  </span>
                )}
              </div>

              {/* Root cause */}
              <div className="px-2.5">
                <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Root Cause</p>
                <p className="text-[10px] text-red-300">{debugResult.rootCause}</p>
              </div>

              {/* Explanation */}
              <div className="px-2.5">
                <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">What was fixed</p>
                <p className="text-[10px] text-foreground/70">{debugResult.explanation}</p>
              </div>

              {/* Changes list */}
              {debugResult.changes?.length > 0 && (
                <div className="px-2.5">
                  <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider font-semibold mb-0.5">Changes</p>
                  <div className="space-y-0.5">
                    {debugResult.changes.map((c: string, i: number) => (
                      <div key={i} className="flex items-start gap-1 text-[9px] text-emerald-400">
                        <CheckCheck className="h-2.5 w-2.5 shrink-0 mt-0.5" />{c}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debugResult.requiresElevation && (
                <div className="px-2.5">
                  <span className="text-[9px] text-amber-400 flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" />Requires elevated privileges (sudo)</span>
                </div>
              )}

              {/* Fixed script toggle */}
              <div className="px-2.5">
                <button className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground" onClick={() => setShowFixScript(s => !s)}>
                  {showFixScript ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}View fixed script
                </button>
                {showFixScript && (
                  <pre className="mt-1 text-[9px] font-mono text-foreground/70 bg-background/60 border border-border/30 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">{debugResult.fixedScript}</pre>
                )}
              </div>

              {/* Action buttons */}
              <div className="px-2.5 pb-2.5 flex gap-1.5">
                <button
                  className="flex-1 flex items-center justify-center gap-1 text-[9px] font-semibold px-2 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-colors"
                  onClick={() => onApplyFix(debugResult.fixedScript)}
                  data-testid={`button-apply-fix-${task.id}`}>
                  <PenLine className="h-2.5 w-2.5" />Apply to Composer
                </button>
                {debugResult.canAutoRetry && (
                  <button
                    className="flex-1 flex items-center justify-center gap-1 text-[9px] font-semibold px-2 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                    onClick={() => onApplyRedispatch(debugResult.fixedScript)}
                    data-testid={`button-apply-redispatch-${task.id}`}>
                    <RefreshCw className="h-2.5 w-2.5" />Fix & Retry
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AI Review verdict config ──────────────────────────────────────────────────
const AI_VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  approved: { label: "AI Approved",  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2  },
  warned:   { label: "AI Warned",    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   icon: AlertTriangle },
  blocked:  { label: "AI Blocked",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",     icon: AlertOctagon  },
  pending:  { label: "AI Reviewing…",color: "text-primary",     bg: "bg-primary/10",     border: "border-primary/30",     icon: Loader2       },
  error:    { label: "Review Error", color: "text-muted-foreground", bg: "bg-muted/10", border: "border-border/30",       icon: AlertCircle   },
};
function AIVerdictBadge({ verdict, cacheHit }: { verdict: string; cacheHit?: boolean | null }) {
  const cfg = AI_VERDICT_CONFIG[verdict] ?? AI_VERDICT_CONFIG.error;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <Icon className={`h-2.5 w-2.5 ${verdict === "pending" ? "animate-spin" : ""}`} />
      {cfg.label}
      {cacheHit && <span className="opacity-60 ml-0.5">·cached</span>}
    </span>
  );
}
function AIScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400"}`}>{score}/100</span>
    </div>
  );
}

// ── Catalog Entry Card ────────────────────────────────────────────────────────
function CatalogCard({ entry, onDryRun, onPublish, onLoad, onEdit, onDelete, onAiReview, aiReviewPending }: {
  entry: CatalogEntry;
  onDryRun: () => void; onPublish: () => void; onLoad: () => void;
  onEdit: () => void; onDelete: () => void;
  onAiReview: () => void; aiReviewPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const st = SCRIPT_TYPES.find(s => s.id === entry.scriptType);
  const hasReview = !!entry.aiReviewVerdict && entry.aiReviewVerdict !== "pending";
  const notes = entry.aiReviewNotes as any;

  return (
    <div className={`rounded-xl border bg-card transition-all ${entry.status === "published" ? "border-violet-500/20" : entry.status === "dry_run_passed" ? "border-emerald-500/20" : entry.status === "dry_run_failed" ? "border-red-500/20" : entry.aiReviewVerdict === "blocked" ? "border-red-500/20" : "border-border/40"}`}
      data-testid={`card-catalog-${entry.id}`}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${entry.authorType === "agent" ? "bg-violet-500/10 border border-violet-500/20" : "bg-primary/10 border border-primary/20"}`}>
            {entry.authorType === "agent" ? <Bot className="h-4 w-4 text-violet-400" /> : <User className="h-4 w-4 text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold truncate">{entry.name}</h3>
              <StatusBadge status={entry.status} />
              {entry.aiReviewVerdict && <AIVerdictBadge verdict={entry.aiReviewVerdict} cacheHit={entry.aiReviewCacheHit} />}
            </div>
            {entry.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{entry.description}</p>}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <CatBadge cat={entry.category} />
              <RiskBadge risk={entry.riskLevel} />
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/30 ${st?.color ?? "text-muted-foreground"}`}>{st?.label ?? entry.scriptType}</span>
              {(entry.compatibleOs || []).map(os => <OSBadge key={os} os={os} />)}
              {entry.authorType === "agent" && (
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border text-violet-400 bg-violet-500/10 border-violet-500/25">
                  <Bot className="h-2.5 w-2.5" />{entry.authorName || "AI Agent"}
                </span>
              )}
              {entry.usageCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground/60">
                  <Zap className="h-2.5 w-2.5" />{entry.usageCount} use{entry.usageCount !== 1 ? "s" : ""}
                </span>
              )}
              {entry.aiReviewScore !== null && entry.aiReviewScore !== undefined && (
                <span className={`text-[9px] font-bold tabular-nums ${entry.aiReviewScore >= 80 ? "text-emerald-400" : entry.aiReviewScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                  QA {entry.aiReviewScore}/100
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground" onClick={() => setExpanded(e => !e)} title="Preview script" data-testid={`button-preview-${entry.id}`}><Eye className="h-3.5 w-3.5" /></button>
            {hasReview && <button className={`p-1 rounded transition-colors ${showReview ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`} onClick={() => setShowReview(s => !s)} title="View AI Review" data-testid={`button-show-review-${entry.id}`}><Bot className="h-3.5 w-3.5" /></button>}
            <button className={`p-1 rounded transition-colors ${aiReviewPending ? "text-primary animate-pulse" : "text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10"}`} onClick={onAiReview} title="Request AI Review" disabled={aiReviewPending} data-testid={`button-ai-review-${entry.id}`}>
              {aiReviewPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
            </button>
            <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground" onClick={onEdit} title="Edit" data-testid={`button-edit-${entry.id}`}><PenLine className="h-3.5 w-3.5" /></button>
            {entry.status !== "published" && (
              <button className="p-1 rounded hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400" onClick={onDryRun} title="Dry Run" data-testid={`button-dryrun-${entry.id}`}><FlaskConical className="h-3.5 w-3.5" /></button>
            )}
            {(entry.status === "dry_run_passed" || entry.status === "draft") && (
              <button className="p-1 rounded hover:bg-violet-500/10 text-muted-foreground hover:text-violet-400" onClick={onPublish} title="Publish" data-testid={`button-publish-${entry.id}`}><Package className="h-3.5 w-3.5" /></button>
            )}
            {entry.status === "published" && (
              <Button size="sm" variant="outline" className="h-6 text-[9px] gap-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 px-2" onClick={onLoad} data-testid={`button-load-${entry.id}`}>
                <Play className="h-2.5 w-2.5" /> Load
              </Button>
            )}
            <button className="p-1 rounded hover:bg-red-500/10 text-muted-foreground/40 hover:text-red-400" onClick={onDelete} title="Delete" data-testid={`button-delete-${entry.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>

      {/* AI Review Panel */}
      {showReview && hasReview && notes && (
        <div className={`mx-4 mb-3 rounded-xl border p-3 space-y-2 ${entry.aiReviewVerdict === "approved" ? "border-emerald-500/20 bg-emerald-500/5" : entry.aiReviewVerdict === "blocked" ? "border-red-500/20 bg-red-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold">AI Quality Review</span>
              {entry.aiReviewCacheHit && <span className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-semibold">CACHED · 0 tokens</span>}
              {!entry.aiReviewCacheHit && <span className="text-[8px] bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded-full">gpt-4o-mini</span>}
            </div>
            {entry.aiReviewAt && <span className="text-[8px] text-muted-foreground/50">{timeAgo(entry.aiReviewAt)}</span>}
          </div>
          {entry.aiReviewScore !== null && entry.aiReviewScore !== undefined && <AIScoreBar score={entry.aiReviewScore} />}
          {notes.summary && <p className="text-[10px] text-foreground/70 italic">{notes.summary}</p>}
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <span className={`px-1.5 py-0.5 rounded border ${notes.idempotent ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : "text-amber-400 border-amber-500/20 bg-amber-500/5"}`}>
              {notes.idempotent ? "✓ Idempotent" : "⚠ Not idempotent"}
            </span>
            <span className={`px-1.5 py-0.5 rounded border ${notes.destructive ? "text-red-400 border-red-500/20 bg-red-500/5" : "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"}`}>
              {notes.destructive ? "⚠ Destructive" : "✓ Non-destructive"}
            </span>
          </div>
          {notes.issues && notes.issues.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Issues</p>
              <div className="space-y-1">
                {notes.issues.map((issue: any, i: number) => (
                  <div key={i} className={`flex items-start gap-1.5 text-[9px] p-1.5 rounded border ${issue.severity === "critical" ? "text-red-400 border-red-500/20 bg-red-500/5" : issue.severity === "warning" ? "text-amber-400 border-amber-500/20 bg-amber-500/5" : "text-muted-foreground border-border/20 bg-muted/10"}`}>
                    <AlertCircle className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                    <span>{issue.message}{issue.line ? ` (line ${issue.line})` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {notes.suggestions && notes.suggestions.length > 0 && (
            <div>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Suggestions</p>
              <div className="space-y-0.5">
                {notes.suggestions.map((s: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-foreground/60">
                    <CheckCircle2 className="h-2.5 w-2.5 text-primary/50 shrink-0 mt-0.5" />{s}
                  </div>
                ))}
              </div>
            </div>
          )}
          {notes.osNotes && <p className="text-[9px] text-muted-foreground/60 italic border-t border-border/20 pt-1.5">{notes.osNotes}</p>}
        </div>
      )}

      {expanded && (
        <div className="border-t border-border/30 mx-4 mb-3">
          <pre className="text-[10px] font-mono text-foreground/70 bg-background/50 rounded-lg p-3 mt-3 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">{entry.script}</pre>
          {entry.dryRunResult && (
            <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
              <p className="text-[9px] text-emerald-400 font-semibold mb-1">Dry Run Output:</p>
              <pre className="text-[10px] font-mono text-foreground/60 max-h-28 overflow-y-auto whitespace-pre-wrap">{entry.dryRunResult}</pre>
            </div>
          )}
          {entry.dryRunError && (
            <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2">
              <p className="text-[9px] text-red-400 font-semibold mb-1">Dry Run Error:</p>
              <pre className="text-[10px] font-mono text-foreground/60 max-h-28 overflow-y-auto whitespace-pre-wrap">{entry.dryRunError}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Scope Manager dialog ──────────────────────────────────────────────────────
function ScopeManagerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editScopes, setEditScopes] = useState<string[]>([]);

  const { data: scopeUsers = [], isLoading } = useQuery<ScopeUser[]>({
    queryKey: ["/api/command-scopes/users"],
    queryFn: async () => { const r = await fetch("/api/command-scopes/users", { credentials: "include" }); return r.json(); },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ userId, scopes }: { userId: string; scopes: string[] }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/command-scopes`, { scopes });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/command-scopes/users"] }); qc.invalidateQueries({ queryKey: ["/api/users/me/command-scopes"] }); setEditUserId(null); toast({ title: "Scope updated", description: "User command scope saved." }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const startEdit = (u: ScopeUser) => { setEditUserId(u.id); setEditScopes(u.commandScopes || []); };
  const toggleDomain = (d: string) => setEditScopes(s => s.includes(d) ? s.filter(x => x !== d) : [...s, d]);
  const isUnrestricted = (u: ScopeUser) => !u.commandScopes || u.commandScopes.length === 0;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />Command Scope Manager
          </DialogTitle>
          <DialogDescription>
            Restrict which asset domains each user can target with commands. Empty scope = unrestricted admin access.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 py-2">
          {isLoading && <div className="text-center py-8"><Loader2 className="h-6 w-6 mx-auto animate-spin text-primary/30" /></div>}
          {scopeUsers.map(u => (
            <div key={u.id} className={`rounded-xl border transition-all ${editUserId === u.id ? "border-primary/40 bg-primary/5" : "border-border/40 bg-card"}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{u.displayName}</span>
                    <span className="text-[9px] text-muted-foreground/60 font-mono">@{u.username}</span>
                    <Badge variant="outline" className="text-[8px] h-4 px-1">{u.role}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {isUnrestricted(u) ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Unrestricted (All Domains)
                      </span>
                    ) : (
                      u.commandScopes.map(s => <ScopeDomainBadge key={s} scopeId={s} />)
                    )}
                  </div>
                </div>
                <Button size="sm" variant={editUserId === u.id ? "default" : "outline"} className="h-7 text-[10px] shrink-0"
                  onClick={() => editUserId === u.id ? setEditUserId(null) : startEdit(u)}
                  data-testid={`button-edit-scope-${u.id}`}>
                  {editUserId === u.id ? "Cancel" : <><PenLine className="h-3 w-3 mr-1" />Edit</>}
                </Button>
              </div>
              {editUserId === u.id && (
                <div className="border-t border-border/30 px-4 py-3 space-y-3">
                  <div>
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">Allowed Domains — <span className="text-primary">empty = unrestricted</span></p>
                    <div className="flex flex-wrap gap-1.5">
                      {SCOPE_DOMAINS.map(d => {
                        const sel = editScopes.includes(d.id); const Icon = d.icon;
                        return (
                          <button key={d.id}
                            className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${sel ? `${d.color} ${d.bg} ${d.border}` : "border-border/30 text-muted-foreground/60 hover:border-border/60 hover:text-muted-foreground"}`}
                            onClick={() => toggleDomain(d.id)} data-testid={`button-scope-domain-${d.id}`}>
                            <Icon className="h-3 w-3" />{d.label}
                          </button>
                        );
                      })}
                    </div>
                    {editScopes.length > 0 && (
                      <p className="text-[9px] text-muted-foreground/60 mt-1.5">
                        Allowed asset types: <span className="text-foreground/60">{SCOPE_DOMAINS.filter(d => editScopes.includes(d.id)).flatMap(d => d.assetTypes).join(", ")}</span>
                      </p>
                    )}
                    {editScopes.length === 0 && (
                      <p className="text-[9px] text-emerald-400/70 mt-1.5">No domains selected → unrestricted admin access</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditUserId(null)}>Cancel</Button>
                    <Button size="sm" className="h-7 text-[10px]"
                      disabled={saveMutation.isPending}
                      onClick={() => saveMutation.mutate({ userId: u.id, scopes: editScopes })}
                      data-testid={`button-save-scope-${u.id}`}>
                      {saveMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Saving…</> : <><CheckCircle2 className="h-3 w-3 mr-1" />Save Scope</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-border/30 pt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Lock className="h-3 w-3" />Scope is enforced at both the API and UI level. Restricted users cannot dispatch to out-of-scope assets even via direct API calls.
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CommandControlCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [view, setView] = useState<"dispatch" | "catalog" | "history" | "schedules" | "approvals">("dispatch");

  // ── Dispatch state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [script, setScript] = useState("");
  const [rollbackScript, setRollbackScript] = useState("");
  const [showRollbackEditor, setShowRollbackEditor] = useState(false);
  const [scriptType, setScriptType] = useState("bash");
  const [commandTitle, setCommandTitle] = useState("");
  const [category, setCategory] = useState<CategoryId>("endpoint");
  const [riskLevel, setRiskLevel] = useState<RiskId>("low");
  const [originType, setOriginType] = useState<"human" | "agent">("human");
  const [changeRef, setChangeRef] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);
  const [expandedLibCat, setExpandedLibCat] = useState<CategoryId | null>("endpoint");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [showHighRiskDialog, setShowHighRiskDialog] = useState(false);
  const [showIncompatDialog, setShowIncompatDialog] = useState(false);
  const [pendingDispatch, setPendingDispatch] = useState<any>(null);
  const [incompatAssets, setIncompatAssets] = useState<DiscoveredAsset[]>([]);
  const [showScopeManager, setShowScopeManager] = useState(false);
  const [showAiCompose, setShowAiCompose] = useState(false);
  const [aiIntent, setAiIntent] = useState("");
  const [aiComposing, setAiComposing] = useState(false);
  const [aiComposeResult, setAiComposeResult] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Var fill dialog ─────────────────────────────────────────────────────────
  const [showVarFill, setShowVarFill] = useState(false);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [pendingVarDispatch, setPendingVarDispatch] = useState<any>(null);

  // ── Schedule state ──────────────────────────────────────────────────────────
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editSchedule, setEditSchedule] = useState<CommandSchedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ name: "", description: "", cronExpression: "0 * * * *", riskLevel: "low", category: "general", changeRef: "" });

  // ── History filter state ────────────────────────────────────────────────────
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyAsset, setHistoryAsset] = useState("");
  const [historySearch, setHistorySearch] = useState("");

  // ── Catalog state ───────────────────────────────────────────────────────────
  const [catalogFilter, setCatalogFilter] = useState<string>("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<CatalogEntry | null>(null);
  const [dryRunEntry, setDryRunEntry] = useState<CatalogEntry | null>(null);
  const [dryRunAssetId, setDryRunAssetId] = useState("");
  const [dryRunStatus, setDryRunStatus] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [dryRunOutput, setDryRunOutput] = useState<{ result?: string; error?: string } | null>(null);
  const dryRunPollRef = useRef<any>(null);

  const [form, setForm] = useState({
    name: "", description: "", category: "endpoint", scriptType: "bash",
    script: "", rollbackScript: "", riskLevel: "low", authorType: "human", authorName: "",
    compatibleOs: [] as string[], tags: [] as string[], changeRef: "",
  });

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: assets = [], isLoading: assetsLoading } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const { data: probes = [] } = useQuery<DiscoveryProbe[]>({ queryKey: ["/api/discovery-probes"] });
  const { data: catalogEntries = [], isLoading: catalogLoading } = useQuery<CatalogEntry[]>({ queryKey: ["/api/command-catalog"] });
  const { data: myScopes } = useQuery<{ scopes: string[] }>({
    queryKey: ["/api/users/me/command-scopes"],
    queryFn: async () => { const r = await fetch("/api/users/me/command-scopes", { credentials: "include" }); return r.json(); },
  });

  const probeMap = new Map(probes.map(p => [p.id, p]));
  const probedAssets = assets.filter(a => a.probeId && probeMap.get(a.probeId)?.enrolled);
  const assetOsMap = new Map<string, OSFamily>(probedAssets.map(a => [a.id, detectAssetOS(a)]));

  // Scope enforcement
  const userScopes = myScopes?.scopes || [];
  const allowedAssetTypes = getAllowedAssetTypes(userScopes);
  const isUnrestrictedUser = !allowedAssetTypes;

  const inScopeAssets = probedAssets.filter(a => isAssetInScope(a.type, allowedAssetTypes));
  const outOfScopeAssets = probedAssets.filter(a => !isAssetInScope(a.type, allowedAssetTypes));

  // ── Dispatch batch tasks ────────────────────────────────────────────────────
  const { data: batchTasks = [] } = useQuery<RemediationTask[]>({
    queryKey: ["/api/remediation-tasks", { batchId: activeBatchId }],
    queryFn: async () => {
      if (!activeBatchId) return [];
      const res = await fetch(`/api/remediation-tasks?batchId=${activeBatchId}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!activeBatchId,
    refetchInterval: (query) => {
      const tasks = (query as any)?.state?.data;
      if (!Array.isArray(tasks) || tasks.length === 0) return 3000;
      const allDone = tasks.every((t: RemediationTask) => ["completed", "failed", "timed-out", "cancelled"].includes(t.status));
      return allDone ? false : 3000;
    },
  });

  // ── History / Schedules / Approvals queries ─────────────────────────────────
  const { data: historyData, isLoading: historyLoading } = useQuery<{ tasks: RemediationTask[]; total: number }>({
    queryKey: ["/api/command-history", historyStatus, historyAsset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (historyStatus) params.set("status", historyStatus);
      if (historyAsset) params.set("assetId", historyAsset);
      const r = await fetch(`/api/command-history?${params}`, { credentials: "include" });
      return r.json();
    },
    enabled: view === "history",
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<CommandSchedule[]>({
    queryKey: ["/api/command-schedules"],
    enabled: view === "schedules",
  });

  const { data: approvals = [], isLoading: approvalsLoading, refetch: refetchApprovals } = useQuery<CommandApproval[]>({
    queryKey: ["/api/command-approvals"],
    queryFn: async () => {
      const r = await fetch("/api/command-approvals?status=pending", { credentials: "include" });
      return r.json();
    },
    refetchInterval: view === "approvals" ? 10000 : false,
  });
  const pendingApprovalCount = approvals.length;

  // ── Approval mutations ──────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/command-approvals/${id}/approve`, { notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Command approved", description: "Task moved to queued — probe will pick it up on next heartbeat." });
      qc.invalidateQueries({ queryKey: ["/api/command-approvals"] });
      qc.invalidateQueries({ queryKey: ["/api/remediation-tasks"] });
    },
    onError: (e: any) => toast({ title: "Approve failed", description: e.message, variant: "destructive" }),
  });
  const rejectMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/command-approvals/${id}/reject`, { notes });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Command rejected", description: "Task has been cancelled." });
      qc.invalidateQueries({ queryKey: ["/api/command-approvals"] });
    },
    onError: (e: any) => toast({ title: "Reject failed", description: e.message, variant: "destructive" }),
  });

  // ── Schedule mutations ──────────────────────────────────────────────────────
  const createScheduleMutation = useMutation({
    mutationFn: async (body: any) => { const res = await apiRequest("POST", "/api/command-schedules", body); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/command-schedules"] }); setShowScheduleDialog(false); toast({ title: "Schedule created" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => { const res = await apiRequest("PATCH", `/api/command-schedules/${id}`, body); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/command-schedules"] }); setShowScheduleDialog(false); setEditSchedule(null); toast({ title: "Schedule updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/command-schedules/${id}`); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/command-schedules"] }); toast({ title: "Schedule deleted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const toggleScheduleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => { const res = await apiRequest("PATCH", `/api/command-schedules/${id}`, { enabled }); return res.json(); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/command-schedules"] }),
  });

  // ── Dispatch mutation ───────────────────────────────────────────────────────
  const dispatchMutation = useMutation({
    mutationFn: async (payload: any) => { const res = await apiRequest("POST", "/api/command-batches", payload); return res.json(); },
    onSuccess: (data) => {
      setActiveBatchId(data.batchId);
      qc.invalidateQueries({ queryKey: ["/api/remediation-tasks"] });
      qc.invalidateQueries({ queryKey: ["/api/command-approvals"] });
      const blockedMsg = data.blocked > 0 ? ` (${data.blocked} blocked by scope)` : "";
      if (data.requiresApproval) {
        toast({ title: "Awaiting 4-Eyes approval", description: `${data.pendingApprovals} task${data.pendingApprovals !== 1 ? "s" : ""} queued for approval (high/critical risk).${blockedMsg}`, variant: "default" });
      } else {
        toast({ title: "Command dispatched", description: `Queued on ${data.dispatched} asset${data.dispatched !== 1 ? "s" : ""}${blockedMsg}.` });
      }
    },
    onError: (e: any) => toast({ title: "Dispatch failed", description: e.message, variant: "destructive" }),
  });

  // ── Catalog mutations ───────────────────────────────────────────────────────
  const createCatalogMutation = useMutation({
    mutationFn: async (body: any) => { const res = await apiRequest("POST", "/api/command-catalog", body); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/command-catalog"] }); setShowCreateDialog(false); toast({ title: "Entry created", description: "Added to catalog as Draft." }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const updateCatalogMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: any }) => { const res = await apiRequest("PATCH", `/api/command-catalog/${id}`, body); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/command-catalog"] }); setEditEntry(null); toast({ title: "Entry updated" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const deleteCatalogMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/command-catalog/${id}`); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/command-catalog"] }); toast({ title: "Entry deleted" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const publishMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/command-catalog/${id}/publish`); return res.json(); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/command-catalog"] }); toast({ title: "Published!", description: "Command is now live in the catalog." }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  // ── AI Compose mutation ─────────────────────────────────────────────────────
  const aiComposeMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("POST", "/api/command-catalog/ai-compose", payload);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Compose failed"); }
      return res.json();
    },
    onMutate: () => { setAiComposing(true); setAiComposeResult(null); },
    onSuccess: (data) => {
      setAiComposing(false);
      setAiComposeResult(data);
      // Populate composer fields
      setScript(data.script || "");
      if (data.scriptType) setScriptType(data.scriptType);
      if (data.title) setCommandTitle(data.title);
      if (data.riskLevel) setRiskLevel(data.riskLevel as RiskId);
      if (data.category) setCategory((data.category as CategoryId) || "endpoint");
      toast({
        title: `Script Generated${data.cacheHit ? " (Cached)" : ""}`,
        description: `${data.title} · ${data.cacheHit ? "0 tokens (KB cache hit)" : `${data.tokensUsed ?? "?"} tokens used`}`,
      });
    },
    onError: (e: any) => { setAiComposing(false); toast({ title: "Compose failed", description: e.message, variant: "destructive" }); },
  });

  function handleAiCompose() {
    if (!aiIntent.trim()) return;
    // Gather context from selected assets
    const selAssets = assets.filter(a => selectedAssets.has(a.id));
    const primaryAsset = selAssets[0];
    const assetTypes = [...new Set(selAssets.map(a => a.type))];
    const oses = [...new Set(selAssets.map(a => a.metadata?.software?.os || a.type))];
    const protocols = [...new Set(selAssets.map(a => a.protocol))].filter(Boolean);

    aiComposeMutation.mutate({
      intent: aiIntent.trim(),
      scriptType,
      assetType: assetTypes.join(",") || "generic",
      os: oses[0] || "linux",
      protocol: protocols[0] || "",
      vendor: primaryAsset?.vendor || "",
      model: primaryAsset?.model || "",
      selectedAssets: selAssets.map(a => ({ id: a.id, name: a.name, type: a.type, os: a.metadata?.software?.os, ipAddress: a.ipAddress })),
    });
  }

  // ── AI Debug state (per task) ───────────────────────────────────────────────
  const [taskDebugStates, setTaskDebugStates] = useState<Map<string, { loading: boolean; result: any | null; error: string | null }>>(new Map());

  const aiDebugMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${taskId}/ai-debug`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Debug failed"); }
      return res.json();
    },
    onMutate: (taskId) => {
      setTaskDebugStates(prev => { const n = new Map(prev); n.set(taskId, { loading: true, result: null, error: null }); return n; });
    },
    onSuccess: (data, taskId) => {
      setTaskDebugStates(prev => { const n = new Map(prev); n.set(taskId, { loading: false, result: data, error: null }); return n; });
      toast({
        title: `AI Agent: ${data.confidence === "high" ? "Fix found" : "Fix suggested"} ${data.cacheHit ? "(cached)" : ""}`,
        description: data.rootCause,
      });
    },
    onError: (e: any, taskId) => {
      setTaskDebugStates(prev => { const n = new Map(prev); n.set(taskId, { loading: false, result: null, error: e.message }); return n; });
      toast({ title: "Debug failed", description: e.message, variant: "destructive" });
    },
  });

  function applyFixToComposer(fixedScript: string) {
    setScript(fixedScript);
    toast({ title: "Fix applied", description: "The AI-fixed script is now in the composer. Review it and dispatch when ready." });
  }

  function applyAndRedispatch(taskId: string, fixedScript: string) {
    const task = batchTasks.find(t => t.id === taskId);
    if (!task) return;
    setScript(fixedScript);
    // Create new batch ID and dispatch just to this asset
    const newBatchId = crypto.randomUUID();
    setActiveBatchId(newBatchId);
    dispatchMutation.mutate({
      batchId: newBatchId,
      script: fixedScript,
      scriptType,
      assetIds: [task.assetId],
      title: commandTitle || `AI Fix Retry: ${task.title}`,
      riskLevel,
      category,
      changeRef,
    });
    toast({ title: "AI Fix dispatched", description: `Retrying on ${assetNameMap.get(task.assetId) || task.assetId}` });
  }

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const aiReviewMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/command-catalog/${id}/ai-review`); if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Review failed"); } return res.json(); },
    onMutate: (id) => { setReviewingId(id); },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/command-catalog"] });
      setReviewingId(null);
      const verdict = data.verdict as string;
      const emoji = verdict === "approved" ? "✓" : verdict === "blocked" ? "🚫" : "⚠";
      const cacheMsg = data.cacheHit ? " (KB cache hit · 0 tokens used)" : ` · ${data.tokensUsed ?? "?"} tokens`;
      toast({ title: `AI Review: ${verdict.toUpperCase()} ${emoji}`, description: `Score ${data.score}/100 — ${data.summary}${cacheMsg}` });
    },
    onError: (e: any) => { setReviewingId(null); toast({ title: "AI Review failed", description: e.message, variant: "destructive" }); },
  });

  const useCatalogMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("POST", `/api/command-catalog/${id}/use`); return res.json(); },
    onSuccess: (entry: CatalogEntry) => {
      setScript(entry.script); setScriptType(entry.scriptType);
      setCommandTitle(entry.name); setRiskLevel(entry.riskLevel as RiskId);
      setCategory((entry.category as CategoryId) || "endpoint");
      if (entry.rollbackScript) { setRollbackScript(entry.rollbackScript); setShowRollbackEditor(true); }
      setView("dispatch");
      qc.invalidateQueries({ queryKey: ["/api/command-catalog"] });
      toast({ title: "Loaded into composer", description: "Command ready to dispatch." });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  // ── Dry Run ─────────────────────────────────────────────────────────────────
  const startDryRunMutation = useMutation({
    mutationFn: async ({ id, assetId }: { id: string; assetId: string }) => {
      const res = await apiRequest("POST", `/api/command-catalog/${id}/dry-run`, { assetId });
      return res.json();
    },
    onSuccess: (data, { id }) => { setDryRunStatus("running"); pollDryRun(id); },
    onError: (e: any) => { setDryRunStatus("failed"); toast({ title: "Dry run failed to start", description: e.message, variant: "destructive" }); },
  });

  const pollDryRun = useCallback((catalogId: string) => {
    if (dryRunPollRef.current) clearInterval(dryRunPollRef.current);
    dryRunPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/command-catalog/${catalogId}/dry-run/finalize`, {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
        });
        const data = await res.json();
        if (data.status === "passed") {
          clearInterval(dryRunPollRef.current); setDryRunStatus("passed");
          setDryRunOutput({ result: data.result }); qc.invalidateQueries({ queryKey: ["/api/command-catalog"] });
        } else if (data.status === "failed") {
          clearInterval(dryRunPollRef.current); setDryRunStatus("failed");
          setDryRunOutput({ error: data.error }); qc.invalidateQueries({ queryKey: ["/api/command-catalog"] });
        }
      } catch { }
    }, 3000);
  }, [qc]);

  useEffect(() => { return () => { if (dryRunPollRef.current) clearInterval(dryRunPollRef.current); }; }, []);

  const openDryRunDialog = (entry: CatalogEntry) => {
    setDryRunEntry(entry); setDryRunAssetId(""); setDryRunStatus("idle"); setDryRunOutput(null);
  };

  // ── Form helpers ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({ name: "", description: "", category: "endpoint", scriptType: "bash", script: "", rollbackScript: "", riskLevel: "low", authorType: "human", authorName: "", compatibleOs: [], tags: [], changeRef: "" });
    setShowCreateDialog(true); setEditEntry(null);
  };
  const openEdit = (entry: CatalogEntry) => {
    setForm({ name: entry.name, description: entry.description || "", category: entry.category, scriptType: entry.scriptType, script: entry.script, rollbackScript: entry.rollbackScript || "", riskLevel: entry.riskLevel, authorType: entry.authorType, authorName: entry.authorName || "", compatibleOs: entry.compatibleOs || [], tags: entry.tags || [], changeRef: entry.changeRef || "" });
    setEditEntry(entry); setShowCreateDialog(true);
  };
  const submitForm = () => {
    if (!form.name.trim() || !form.script.trim()) return toast({ title: "Name and script are required", variant: "destructive" });
    const payload = { ...form, authorName: form.authorName || null, description: form.description || null, changeRef: form.changeRef || null };
    if (editEntry) { updateCatalogMutation.mutate({ id: editEntry.id, body: payload }); }
    else { createCatalogMutation.mutate(payload); }
  };

  // ── Dispatch helpers ────────────────────────────────────────────────────────
  const filteredAssets = inScopeAssets.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.ipAddress || "").includes(search));
  const grouped: Record<string, DiscoveredAsset[]> = {};
  for (const a of filteredAssets) { const g = a.type || "other"; (grouped[g] = grouped[g] || []).push(a); }

  const selectedAssetsList = inScopeAssets.filter(a => selectedAssets.has(a.id));
  const incompatibleSelected = selectedAssetsList.filter(a => { const os = assetOsMap.get(a.id) ?? "unknown"; return os !== "unknown" && !compatibleOS(scriptType, os); });
  const compatibleSelected = selectedAssetsList.filter(a => { const os = assetOsMap.get(a.id) ?? "unknown"; return os === "unknown" || compatibleOS(scriptType, os); });

  const doDispatch = useCallback((payload: any) => { dispatchMutation.mutate(payload); }, [dispatchMutation]);

  // Extract {{VAR_NAME}} tokens from a script string
  function extractVars(s: string): string[] {
    const matches = s.match(/\{\{([A-Z0-9_]+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  }
  function substituteVars(s: string, values: Record<string, string>): string {
    return s.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, k) => values[k] ?? `{{${k}}}`);
  }

  const handleExecute = () => {
    if (!script.trim()) return toast({ title: "Empty script", variant: "destructive" });
    const effectiveSelected = [...selectedAssets].filter(id => inScopeAssets.some(a => a.id === id));
    if (effectiveSelected.length === 0) return toast({ title: "No in-scope assets selected", variant: "destructive" });
    const batchId = crypto.randomUUID();
    const compatIds = compatibleSelected.map(a => a.id);
    const payload = {
      batchId,
      title: commandTitle.trim() || `CMD: ${script.split('\n')[0].substring(0, 60)}`,
      script: script.trim(),
      rollbackScript: rollbackScript.trim() || undefined,
      scriptType, assetIds: compatIds.length > 0 ? compatIds : effectiveSelected,
      category, riskLevel, originType, changeRef: changeRef.trim() || undefined,
    };

    // Check for {{VAR}} tokens — prompt to fill before dispatch
    const vars = extractVars(script);
    if (vars.length > 0) {
      const initVals: Record<string, string> = {};
      vars.forEach(v => { initVals[v] = ""; });
      setVarValues(initVals);
      setPendingVarDispatch(payload);
      setShowVarFill(true);
      return;
    }

    if (incompatibleSelected.length > 0) { setPendingDispatch(payload); setIncompatAssets(incompatibleSelected); setShowIncompatDialog(true); return; }
    if (riskLevel === "high" || riskLevel === "critical") { setPendingDispatch(payload); setShowHighRiskDialog(true); } else { doDispatch(payload); }
  };

  function handleVarFillDispatch() {
    if (!pendingVarDispatch) return;
    const filledScript = substituteVars(pendingVarDispatch.script, varValues);
    const payload = { ...pendingVarDispatch, script: filledScript };
    setShowVarFill(false); setPendingVarDispatch(null);
    if (incompatibleSelected.length > 0) { setPendingDispatch(payload); setIncompatAssets(incompatibleSelected); setShowIncompatDialog(true); return; }
    if (riskLevel === "high" || riskLevel === "critical") { setPendingDispatch(payload); setShowHighRiskDialog(true); } else { doDispatch(payload); }
  }

  const toggleAsset = (assetId: string, inScope: boolean) => {
    if (!inScope) return; // silently ignore out-of-scope clicks
    setSelectedAssets(prev => { const n = new Set(prev); n.has(assetId) ? n.delete(assetId) : n.add(assetId); return n; });
  };

  const assetNameMap = new Map(assets.map(a => [a.id, a.name]));
  const runningCount = batchTasks.filter(t => ["queued", "dispatched", "executing"].includes(t.status)).length;
  const doneCount = batchTasks.filter(t => ["completed", "failed"].includes(t.status)).length;

  const filteredCatalog = catalogEntries.filter(e => {
    const matchStatus = catalogFilter === "all" || e.status === catalogFilter || (catalogFilter === "dry_run" && e.status.startsWith("dry_run"));
    const matchSearch = !catalogSearch || e.name.toLowerCase().includes(catalogSearch.toLowerCase()) || (e.description || "").toLowerCase().includes(catalogSearch.toLowerCase());
    return matchStatus && matchSearch;
  });
  const catalogCounts = {
    all: catalogEntries.length,
    draft: catalogEntries.filter(e => e.status === "draft").length,
    dry_run: catalogEntries.filter(e => e.status.startsWith("dry_run")).length,
    published: catalogEntries.filter(e => e.status === "published").length,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <TerminalSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold">Command Control Center</h1>
              <Badge variant="outline" className="text-[8px] h-4 font-semibold px-1.5 border-primary/30 text-primary">ITIL v4</Badge>
              {/* Current scope indicator */}
              {!isUnrestrictedUser && userScopes.length > 0 && (
                <div className="flex items-center gap-1 border border-border/40 rounded-full px-2 py-0.5 bg-muted/20">
                  <Lock className="h-2.5 w-2.5 text-amber-400" />
                  <span className="text-[9px] text-amber-400 font-semibold">Scoped:</span>
                  {userScopes.map(s => {
                    const d = SCOPE_DOMAINS.find(x => x.id === s); if (!d) return null;
                    return <span key={s} className={`text-[9px] font-semibold ${d.color}`}>{d.label}</span>;
                  }).reduce((a: any, el, i) => i === 0 ? [el] : [...a, <span key={`sep-${i}`} className="text-muted-foreground/30 text-[9px]">,</span>, el], [])}
                </div>
              )}
              {isUnrestrictedUser && (
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400">
                  <CheckCircle2 className="h-2.5 w-2.5" />Unrestricted
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">OS-aware dispatch · Command Catalog · Human & AI authored · Full audit trail</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Scope manager button */}
          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1.5 border-border/40 text-muted-foreground hover:text-foreground"
            onClick={() => setShowScopeManager(true)} data-testid="button-scope-manager">
            <Users className="h-3 w-3" /> Scope
          </Button>
          {/* View toggle */}
          <div className="flex rounded-lg border border-border/40 bg-muted/20 p-0.5 gap-0.5">
            <button className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors ${view === "dispatch" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("dispatch")} data-testid="button-view-dispatch">
              <Send className="h-3 w-3" /> Dispatch
            </button>
            <button className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors ${view === "catalog" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("catalog")} data-testid="button-view-catalog">
              <Library className="h-3 w-3" /> Catalog
              {catalogCounts.published > 0 && <span className="ml-0.5 text-[8px] bg-violet-500/15 text-violet-400 rounded-full px-1">{catalogCounts.published}</span>}
            </button>
            <button className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors ${view === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("history")} data-testid="button-view-history">
              <History className="h-3 w-3" /> History
            </button>
            <button className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors ${view === "schedules" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("schedules")} data-testid="button-view-schedules">
              <CalendarClock className="h-3 w-3" /> Schedules
            </button>
            <button className={`relative flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors ${view === "approvals" ? "bg-background text-foreground shadow-sm" : pendingApprovalCount > 0 ? "text-amber-400 hover:text-amber-300" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("approvals")} data-testid="button-view-approvals">
              <ShieldCheck className="h-3 w-3" /> Approvals
              {pendingApprovalCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-bold text-black">{pendingApprovalCount}</span>
              )}
            </button>
          </div>
          {view === "catalog" && (
            <Button size="sm" className="h-7 text-[10px] gap-1.5" onClick={openCreate} data-testid="button-new-catalog-entry">
              <Plus className="h-3 w-3" /> New Command
            </Button>
          )}
          {view === "schedules" && (
            <Button size="sm" className="h-7 text-[10px] gap-1.5" onClick={() => { setEditSchedule(null); setScheduleForm({ name: "", description: "", cronExpression: "0 * * * *", riskLevel: "low", category: "general", changeRef: "" }); setShowScheduleDialog(true); }} data-testid="button-new-schedule">
              <Plus className="h-3 w-3" /> New Schedule
            </Button>
          )}
          {view === "dispatch" && activeBatchId && (
            <>
              {runningCount > 0 && <span className="flex items-center gap-1.5 text-[10px] text-primary font-semibold"><Loader2 className="h-3 w-3 animate-spin" />{runningCount} running</span>}
              {doneCount > 0 && <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold"><CheckCircle2 className="h-3 w-3" />{doneCount} done</span>}
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1.5 text-muted-foreground" onClick={() => setActiveBatchId(null)} data-testid="button-clear-results">
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ════ CATALOG VIEW ════════════════════════════════════════════════════ */}
      {view === "catalog" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-3 px-5 py-2 border-b border-border/30 bg-muted/10 shrink-0">
            <div className="flex items-center gap-0.5">
              {[
                { id: "all", label: "All", count: catalogCounts.all },
                { id: "draft", label: "Draft", count: catalogCounts.draft },
                { id: "dry_run", label: "Dry Run", count: catalogCounts.dry_run },
                { id: "published", label: "Published", count: catalogCounts.published },
              ].map(t => (
                <button key={t.id}
                  className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${catalogFilter === t.id ? "bg-primary/10 border-primary/30 text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
                  onClick={() => setCatalogFilter(t.id)} data-testid={`button-filter-${t.id}`}>
                  {t.label}{t.count > 0 && <span className="text-[8px] bg-muted/50 px-1 rounded-full">{t.count}</span>}
                </button>
              ))}
            </div>
            <div className="ml-auto relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
              <Input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} placeholder="Search commands…" className="pl-6 h-7 text-[10px] w-52 bg-background/50" data-testid="input-catalog-search" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-5 space-y-3">
              {catalogLoading && <div className="text-center py-16"><Loader2 className="h-8 w-8 mx-auto animate-spin text-primary/30 mb-3" /></div>}
              {!catalogLoading && filteredCatalog.length === 0 && (
                <div className="text-center py-20">
                  <Library className="h-10 w-10 mx-auto mb-4 opacity-15" />
                  <p className="text-sm font-medium text-muted-foreground">No commands in catalog</p>
                  <Button size="sm" variant="outline" onClick={openCreate} className="mt-4" data-testid="button-empty-new">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Create First Command
                  </Button>
                </div>
              )}
              {!catalogLoading && catalogEntries.length > 0 && (
                <div className="flex items-center gap-4 rounded-xl border border-border/30 bg-muted/10 px-4 py-2.5 mb-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Lifecycle →</span>
                  {[
                    { label: "Draft", count: catalogCounts.draft, color: "text-muted-foreground", icon: PenLine },
                    { label: "Dry Run", count: catalogCounts.dry_run, color: "text-amber-400", icon: FlaskConical },
                    { label: "Published", count: catalogCounts.published, color: "text-violet-400", icon: Package },
                  ].map((s, i) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
                      <s.icon className={`h-3 w-3 ${s.color}`} />
                      <span className={`text-[10px] font-semibold ${s.color}`}>{s.count} {s.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {filteredCatalog.map(entry => (
                <CatalogCard key={entry.id} entry={entry}
                  onDryRun={() => openDryRunDialog(entry)}
                  onPublish={() => publishMutation.mutate(entry.id)}
                  onLoad={() => useCatalogMutation.mutate(entry.id)}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => { if (confirm(`Delete "${entry.name}"?`)) deleteCatalogMutation.mutate(entry.id); }}
                  onAiReview={() => aiReviewMutation.mutate(entry.id)}
                  aiReviewPending={reviewingId === entry.id}
                />
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ════ DISPATCH VIEW ═══════════════════════════════════════════════════ */}
      {view === "dispatch" && (
        <>
          {/* ITIL context bar */}
          <div className="flex items-center gap-3 px-5 py-2 border-b border-border/30 bg-muted/10 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Origin</span>
              {(["human", "agent"] as const).map(o => (
                <button key={o} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border transition-colors ${originType === o ? "bg-primary/10 border-primary/30 text-primary" : "border-border/30 text-muted-foreground hover:border-border/60"}`}
                  onClick={() => setOriginType(o)} data-testid={`button-origin-${o}`}>
                  {o === "human" ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}{o === "human" ? "Human" : "AI Agent"}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-border/40" />
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Risk</span>
              {RISK_LEVELS.map(r => { const Icon = r.icon; return (
                <button key={r.id} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border transition-colors ${riskLevel === r.id ? `${r.color} ${r.bg} ${r.border}` : "border-border/30 text-muted-foreground hover:border-border/60"}`}
                  onClick={() => setRiskLevel(r.id)} data-testid={`button-risk-${r.id}`} title={r.desc}>
                  <Icon className="h-2.5 w-2.5" />{r.label}
                </button>
              ); })}
            </div>
            <div className="h-4 w-px bg-border/40" />
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Category</span>
              {CATEGORIES.map(c => { const Icon = c.icon; return (
                <button key={c.id} className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${category === c.id ? `${c.color} ${c.bg} ${c.border}` : "border-border/20 text-muted-foreground/60 hover:border-border/50 hover:text-muted-foreground"}`}
                  onClick={() => setCategory(c.id)} data-testid={`button-cat-${c.id}`}>
                  <Icon className="h-2.5 w-2.5" />{c.label}
                </button>
              ); })}
            </div>
          </div>

          {/* 3-panel body */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left: Asset selector */}
            <div className="w-60 shrink-0 border-r border-border/40 flex flex-col">
              <div className="px-3 py-2 border-b border-border/30 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Assets</span>
                  <div className="flex gap-1">
                    <button className="text-[9px] text-primary hover:text-primary/80" onClick={() => setSelectedAssets(new Set(inScopeAssets.map(a => a.id)))} data-testid="button-select-all">All</button>
                    <span className="text-[9px] text-muted-foreground/40">·</span>
                    <button className="text-[9px] text-muted-foreground hover:text-foreground" onClick={() => setSelectedAssets(new Set())} data-testid="button-select-none">None</button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" className="pl-6 h-7 text-[10px] bg-background/50" data-testid="input-asset-search" />
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {assetsLoading && <p className="text-[10px] text-muted-foreground text-center py-6">Loading…</p>}
                  {!assetsLoading && probedAssets.length === 0 && (
                    <div className="text-center py-8"><TerminalSquare className="h-6 w-6 mx-auto mb-2 opacity-20" /><p className="text-[10px] text-muted-foreground">No probe-connected assets</p></div>
                  )}
                  {/* In-scope assets */}
                  {Object.entries(grouped).map(([grp, items]) => (
                    <div key={grp}>
                      <p className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider px-1 mb-1 capitalize">{grp}</p>
                      {items.map(asset => {
                        const sel = selectedAssets.has(asset.id);
                        const os = assetOsMap.get(asset.id) ?? "unknown";
                        const isIncompat = os !== "unknown" && !compatibleOS(scriptType, os);
                        const Icon = assetTypeIcon(asset.type);
                        return (
                          <button key={asset.id}
                            className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left mb-0.5 transition-all ${sel ? (isIncompat ? "bg-amber-500/8 border border-amber-500/35" : "bg-primary/10 border border-primary/25") : isIncompat ? "border border-amber-500/15 hover:bg-amber-500/5 opacity-70" : "border border-transparent hover:bg-muted/40"}`}
                            onClick={() => toggleAsset(asset.id, true)} data-testid={`button-asset-${asset.id}`}>
                            <div className="relative shrink-0">
                              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${sel ? (isIncompat ? "bg-amber-500/15" : "bg-primary/15") : "bg-muted/50"}`}>
                                <Icon className={`h-3.5 w-3.5 ${sel ? (isIncompat ? "text-amber-400" : "text-primary") : "text-muted-foreground"}`} />
                              </div>
                              <div className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-background ${statusDot[asset.status] ?? "bg-gray-500"}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <p className="text-[11px] font-semibold truncate">{asset.name}</p>
                                {isIncompat && <AlertCircle className="h-2.5 w-2.5 text-amber-400 shrink-0" />}
                              </div>
                              <OSBadge os={os} />
                            </div>
                            {sel && !isIncompat && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {/* Out-of-scope assets — locked */}
                  {!isUnrestrictedUser && outOfScopeAssets.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 px-1 mb-1 mt-2">
                        <Lock className="h-2.5 w-2.5 text-amber-400/60" />
                        <p className="text-[9px] text-amber-400/60 font-semibold uppercase tracking-wider">Out of Scope ({outOfScopeAssets.length})</p>
                      </div>
                      {outOfScopeAssets.map(asset => {
                        const Icon = assetTypeIcon(asset.type);
                        const domain = getAssetDomain(asset.type);
                        const domainConfig = domain ? SCOPE_DOMAINS.find(d => d.id === domain) : null;
                        return (
                          <div key={asset.id}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 mb-0.5 border border-border/20 opacity-40 cursor-not-allowed"
                            title={`Locked: ${asset.name} is in the "${domainConfig?.label ?? asset.type}" domain — not in your scope`}
                            data-testid={`asset-locked-${asset.id}`}>
                            <div className="relative shrink-0">
                              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/30">
                                <Icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold truncate text-muted-foreground/50">{asset.name}</p>
                              <div className="flex items-center gap-1">
                                {domainConfig && <span className={`text-[8px] font-semibold ${domainConfig.color}`}>{domainConfig.label}</span>}
                              </div>
                            </div>
                            <Lock className="h-3 w-3 text-amber-400/50 shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="px-3 py-2 border-t border-border/30 shrink-0 space-y-0.5">
                <p className="text-[9px] text-muted-foreground">{selectedAssets.size} selected · {inScopeAssets.length} in-scope</p>
                {!isUnrestrictedUser && outOfScopeAssets.length > 0 && (
                  <p className="text-[9px] text-amber-400/70 flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" />{outOfScopeAssets.length} asset{outOfScopeAssets.length !== 1 ? "s" : ""} locked by scope
                  </p>
                )}
                {incompatibleSelected.length > 0 && (
                  <p className="text-[9px] text-amber-400 flex items-center gap-1"><AlertCircle className="h-2.5 w-2.5" />{incompatibleSelected.length} incompatible with {scriptType}</p>
                )}
              </div>
            </div>

            {/* Center: Command composer */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-border/40">
              <div className="px-4 py-2 border-b border-border/30 shrink-0 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mr-1">Script</span>
                  {SCRIPT_TYPES.map(st => (
                    <button key={st.id} className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${scriptType === st.id ? `border-primary/30 bg-primary/10 ${st.color}` : "border-border/30 text-muted-foreground hover:border-border/60"}`}
                      onClick={() => setScriptType(st.id)} data-testid={`button-st-${st.id}`}>
                      {st.label}
                    </button>
                  ))}
                  <div className="ml-auto flex gap-1.5">
                    <button
                      className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border transition-colors ${showAiCompose ? "border-violet-500/40 bg-violet-500/10 text-violet-400" : "border-border/30 text-muted-foreground hover:border-violet-500/40 hover:text-violet-400"}`}
                      onClick={() => setShowAiCompose(s => !s)} data-testid="button-ai-compose-toggle">
                      <Sparkles className="h-2.5 w-2.5" /> AI Compose
                    </button>
                    <button className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border transition-colors ${showLibrary ? "border-primary/30 bg-primary/10 text-primary" : "border-border/30 text-muted-foreground hover:border-border/60"}`}
                      onClick={() => setShowLibrary(l => !l)} data-testid="button-toggle-library">
                      <BookOpen className="h-2.5 w-2.5" /> Library
                    </button>
                    <button className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded border border-border/30 text-muted-foreground hover:border-violet-500/40 hover:text-violet-400 transition-colors"
                      onClick={() => setView("catalog")} data-testid="button-open-catalog">
                      <Library className="h-2.5 w-2.5" /> Catalog
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input value={commandTitle} onChange={e => setCommandTitle(e.target.value)} placeholder="Command title (optional)…" className="flex-1 h-7 text-[11px] bg-background/50 border-border/40" data-testid="input-command-title" />
                  <div className="flex items-center gap-1 shrink-0">
                    <Link2 className="h-3 w-3 text-muted-foreground/50" />
                    <Input value={changeRef} onChange={e => setChangeRef(e.target.value)} placeholder="CHG-0000" className="w-36 h-7 text-[10px] bg-background/50 border-border/40 font-mono" data-testid="input-change-ref" />
                  </div>
                </div>
              </div>
              <div className="flex flex-1 min-h-0">
                <div className="flex-1 flex flex-col min-w-0">
                  {/* AI Compose Panel */}
                  {showAiCompose && (
                    <div className="mx-4 mt-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 space-y-2.5 shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-violet-300">AI Command Composer</p>
                            <p className="text-[9px] text-muted-foreground/70">Describe what you want to do in plain English</p>
                          </div>
                        </div>
                        <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground/50 hover:text-muted-foreground" onClick={() => setShowAiCompose(false)}><X className="h-3 w-3" /></button>
                      </div>

                      {/* Context pills */}
                      {selectedAssets.size > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">Context:</span>
                          {[...new Set(assets.filter(a => selectedAssets.has(a.id)).map(a => a.type))].slice(0, 4).map(t => (
                            <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">{t}</span>
                          ))}
                          {[...new Set(assets.filter(a => selectedAssets.has(a.id)).map(a => a.metadata?.software?.os).filter(Boolean))].slice(0, 2).map(os => (
                            <span key={os} className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">{os}</span>
                          ))}
                          {[...new Set(assets.filter(a => selectedAssets.has(a.id)).map(a => a.protocol).filter(Boolean))].slice(0, 2).map(p => (
                            <span key={p} className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{p}</span>
                          ))}
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">{scriptType}</span>
                        </div>
                      )}

                      {/* Intent input */}
                      <div className="flex gap-2">
                        <textarea
                          value={aiIntent}
                          onChange={e => setAiIntent(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAiCompose(); } }}
                          placeholder={selectedAssets.size > 0
                            ? `e.g. "Restart the web server", "Show running processes", "Check disk usage and alert if over 90%"…`
                            : `e.g. "Disable a user account on Windows AD", "Backup PostgreSQL database to S3"…`}
                          className="flex-1 min-h-[56px] resize-none bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40"
                          data-testid="textarea-ai-intent"
                        />
                        <Button
                          size="sm" disabled={!aiIntent.trim() || aiComposing}
                          className="self-end h-9 px-3 bg-violet-600 hover:bg-violet-700 text-white gap-1.5 text-[11px]"
                          onClick={handleAiCompose}
                          data-testid="button-ai-compose-generate">
                          {aiComposing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</> : <><Sparkles className="h-3.5 w-3.5" />Generate</>}
                        </Button>
                      </div>

                      {/* Result info bar */}
                      {aiComposeResult && (
                        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[9px] ${aiComposeResult.cacheHit ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-violet-500/20 bg-violet-500/5 text-violet-400"}`}>
                          {aiComposeResult.cacheHit
                            ? <><CheckCircle2 className="h-2.5 w-2.5 shrink-0" /><span className="font-semibold">KB Cache Hit · 0 tokens</span></>
                            : <><Sparkles className="h-2.5 w-2.5 shrink-0" /><span className="font-semibold">{aiComposeResult.tokensUsed} tokens used</span></>}
                          <span className="text-muted-foreground/60 ml-1">{aiComposeResult.notes}</span>
                          {aiComposeResult.riskLevel === "high" && (
                            <span className="ml-auto text-red-400 font-semibold flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5" /> High-Risk Script</span>
                          )}
                        </div>
                      )}

                      <p className="text-[8px] text-muted-foreground/40">Tip: Select assets first to give AI the exact asset type, OS, and protocol context · ⌘/Ctrl+Enter to generate</p>
                    </div>
                  )}

                  {incompatibleSelected.length > 0 && (
                    <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-semibold text-amber-400">Script incompatibility detected</p>
                        <p className="text-[9px] text-amber-400/70 mt-0.5">{incompatibleSelected.map(a => a.name).join(", ")} — {incompatReason(scriptType, assetOsMap.get(incompatibleSelected[0].id) ?? "unknown")}</p>
                      </div>
                    </div>
                  )}
                  <textarea ref={textareaRef} value={script} onChange={e => setScript(e.target.value)}
                    placeholder={`# ${scriptType} · Write your commands here…\n# Use {{VAR_NAME}} for parameterized inputs`}
                    className="flex-1 w-full resize-none bg-background/20 font-mono text-xs p-4 text-foreground placeholder:text-muted-foreground/35 outline-none border-0 focus:ring-0"
                    spellCheck={false} data-testid="textarea-script" />
                  {/* Variables indicator */}
                  {script && (() => { const vars = (script.match(/\{\{([A-Z0-9_]+)\}\}/g) || []).map(m => m.slice(2,-2)); const unique = [...new Set(vars)]; return unique.length > 0 ? (
                    <div className="px-4 py-1.5 border-t border-border/30 bg-amber-500/5 flex items-center gap-2 shrink-0">
                      <Zap className="h-3 w-3 text-amber-400 shrink-0" />
                      <span className="text-[9px] text-amber-400 font-semibold">Parameterized:</span>
                      {unique.map(v => <code key={v} className="text-[9px] bg-amber-500/15 text-amber-300 px-1.5 py-0.5 rounded font-mono">{`{{${v}}}`}</code>)}
                      <span className="text-[9px] text-muted-foreground/60">— values will be prompted before dispatch</span>
                    </div>
                  ) : null; })()}
                  {/* Rollback script editor toggle */}
                  <div className="shrink-0 border-t border-border/30">
                    <button className="w-full flex items-center gap-1.5 px-4 py-1.5 text-[9px] font-semibold text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-colors"
                      onClick={() => setShowRollbackEditor(r => !r)} data-testid="button-toggle-rollback">
                      <RotateCcw className="h-3 w-3" />
                      {showRollbackEditor ? "Hide rollback script" : "Add rollback script (optional)"}
                      {rollbackScript.trim() && !showRollbackEditor && <span className="text-[8px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded-full">has rollback</span>}
                      {showRollbackEditor ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                    </button>
                    {showRollbackEditor && (
                      <textarea value={rollbackScript} onChange={e => setRollbackScript(e.target.value)}
                        placeholder={`# ${scriptType} · Rollback / undo script — executed if you click Rollback after completion`}
                        className="w-full resize-none bg-orange-500/3 font-mono text-xs p-3 text-foreground placeholder:text-muted-foreground/35 outline-none border-0 focus:ring-0 min-h-20"
                        spellCheck={false} data-testid="textarea-rollback-script" />
                    )}
                  </div>
                  <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-muted/10 shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-muted-foreground font-mono">{script.split('\n').length}L · {script.length}c</span>
                      {compatibleSelected.length > 0 && <span className="text-[9px] text-primary font-semibold">→ {compatibleSelected.length} compatible{incompatibleSelected.length > 0 ? ` (${incompatibleSelected.length} skipped)` : ""}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1.5" onClick={() => { setScript(""); setCommandTitle(""); setActiveBatchId(null); }} data-testid="button-clear-script">
                        <RotateCcw className="h-3 w-3" /> Clear
                      </Button>
                      {script.trim() && (
                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                          onClick={() => { setForm({ name: commandTitle || "Untitled Command", description: "", category, scriptType, script, rollbackScript: rollbackScript, riskLevel, authorType: originType, authorName: "", compatibleOs: [], tags: [], changeRef }); setEditEntry(null); setShowCreateDialog(true); }}
                          data-testid="button-save-to-catalog">
                          <Library className="h-3 w-3" /> Save to Catalog
                        </Button>
                      )}
                      <Button size="sm" className={`h-7 text-[10px] gap-1.5 ${riskLevel === "high" ? "bg-red-600 hover:bg-red-700" : riskLevel === "medium" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                        onClick={handleExecute} disabled={!script.trim() || selectedAssets.size === 0 || dispatchMutation.isPending} data-testid="button-execute">
                        {dispatchMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Dispatching…</> : <><Play className="h-3 w-3" />Execute on {compatibleSelected.length || selectedAssets.size}</>}
                      </Button>
                    </div>
                  </div>
                </div>
                {showLibrary && (
                  <div className="w-56 shrink-0 border-l border-border/30 flex flex-col">
                    <div className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Scripts</p>
                      <button className="text-violet-400 text-[9px] hover:underline" onClick={() => setView("catalog")}>Full Catalog →</button>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-2">
                        {catalogEntries.filter(e => e.status === "published").map(e => (
                          <button key={e.id} className="w-full text-left px-2 py-2 rounded hover:bg-muted/40 group mb-0.5"
                            onClick={() => { useCatalogMutation.mutate(e.id); setShowLibrary(false); }}
                            data-testid={`button-catalog-load-${e.id}`}>
                            <div className="flex items-center gap-1">
                              {e.authorType === "agent" ? <Bot className="h-2.5 w-2.5 text-violet-400 shrink-0" /> : <User className="h-2.5 w-2.5 text-primary/50 shrink-0" />}
                              <span className="text-[10px] text-muted-foreground group-hover:text-foreground flex-1 truncate">{e.name}</span>
                            </div>
                            <div className="flex gap-1 mt-0.5"><CatBadge cat={e.category} /><RiskBadge risk={e.riskLevel} /></div>
                          </button>
                        ))}
                        {catalogEntries.filter(e => e.status === "published").length === 0 && (
                          <p className="text-[9px] text-muted-foreground/40 text-center py-4">No published commands yet.</p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Live results */}
            <div className="w-72 shrink-0 flex flex-col">
              <div className="px-3 py-2 border-b border-border/30 shrink-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Live Results</span>
                  {activeBatchId && <Badge variant="outline" className="text-[8px] h-4 font-mono px-1 text-muted-foreground/50">{activeBatchId.substring(0, 8)}…</Badge>}
                </div>
                {(() => {
                  const failedTasks = batchTasks.filter(t => t.status === "failed");
                  const undebugged = failedTasks.filter(t => !taskDebugStates.has(t.id));
                  if (failedTasks.length === 0) return null;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-red-400 flex items-center gap-1"><XCircle className="h-2.5 w-2.5" />{failedTasks.length} failed</span>
                      {undebugged.length > 0 && (
                        <button
                          className="ml-auto flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"
                          onClick={() => undebugged.forEach(t => aiDebugMutation.mutate(t.id))}
                          data-testid="button-debug-all-failed">
                          <Bot className="h-2.5 w-2.5" />Debug all ({undebugged.length})
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {!activeBatchId && (
                    <div className="text-center py-14 text-muted-foreground">
                      <TerminalSquare className="h-9 w-9 mx-auto mb-3 opacity-15" />
                      <p className="text-xs font-medium">No active session</p>
                      <p className="text-[10px] mt-1 opacity-50">Select assets, compose a command,<br />and click Execute</p>
                    </div>
                  )}
                  {activeBatchId && batchTasks.length === 0 && (
                    <div className="text-center py-10"><Clock className="h-5 w-5 mx-auto mb-2 opacity-30" /><p className="text-[10px] text-muted-foreground">Waiting for probe heartbeat</p></div>
                  )}
                  {batchTasks.map(task => {
                    const ds = taskDebugStates.get(task.id);
                    return (
                      <TaskResultCard key={task.id} task={task}
                        assetName={assetNameMap.get(task.assetId) || task.assetId.substring(0, 8)}
                        onDebug={() => aiDebugMutation.mutate(task.id)}
                        debugLoading={ds?.loading ?? false}
                        debugResult={ds?.result ?? null}
                        debugError={ds?.error ?? null}
                        onApplyFix={(s) => applyFixToComposer(s)}
                        onApplyRedispatch={(s) => applyAndRedispatch(task.id, s)}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
              {activeBatchId && batchTasks.length > 0 && (
                <div className="px-4 py-2 border-t border-border/30 shrink-0">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[{ l: "Running", v: runningCount, c: "text-primary" }, { l: "Done", v: doneCount, c: "text-emerald-400" }, { l: "Total", v: batchTasks.length, c: "text-muted-foreground" }].map(s => (
                      <div key={s.l}><div className={`text-sm font-bold ${s.c}`}>{s.v}</div><div className="text-[9px] text-muted-foreground">{s.l}</div></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ════ HISTORY VIEW ═══════════════════════════════════════════════════ */}
      {view === "history" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-3 px-5 py-2 border-b border-border/30 bg-muted/10 shrink-0 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <select value={historyStatus} onChange={e => setHistoryStatus(e.target.value)}
                className="h-7 rounded-md border border-border/40 bg-background text-[10px] px-2 text-foreground" data-testid="select-history-status">
                <option value="">All Statuses</option>
                {["completed","failed","queued","executing","cancelled","pending_approval"].map(s => <option key={s} value={s}>{s.replace(/_/g," ")}</option>)}
              </select>
              <select value={historyAsset} onChange={e => setHistoryAsset(e.target.value)}
                className="h-7 rounded-md border border-border/40 bg-background text-[10px] px-2 text-foreground" data-testid="select-history-asset">
                <option value="">All Assets</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <Input value={historySearch} onChange={e => setHistorySearch(e.target.value)}
                placeholder="Search title…" className="h-7 w-40 text-[10px]" data-testid="input-history-search" />
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setHistoryStatus(""); setHistoryAsset(""); setHistorySearch(""); }}>Clear filters</Button>
            {historyData && <span className="text-[9px] text-muted-foreground ml-auto">{historyData.total} tasks total</span>}
          </div>
          <ScrollArea className="flex-1">
            {historyLoading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : !historyData?.tasks?.length ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <History className="h-8 w-8 opacity-30" />
                <p className="text-sm">No command history yet</p>
              </div>
            ) : (() => {
              // Group by batchId
              const byBatch: Record<string, RemediationTask[]> = {};
              const orderedBatches: string[] = [];
              for (const t of (historyData.tasks as RemediationTask[])) {
                const bid = t.batchId || t.id;
                if (!byBatch[bid]) { byBatch[bid] = []; orderedBatches.push(bid); }
                byBatch[bid].push(t);
              }
              const filtered = historySearch
                ? orderedBatches.filter(bid => byBatch[bid].some(t => (t.title || "").toLowerCase().includes(historySearch.toLowerCase())))
                : orderedBatches;
              return (
                <div className="divide-y divide-border/20">
                  {filtered.map(bid => {
                    const tasks = byBatch[bid];
                    const first = tasks[0];
                    const allDone = tasks.every(t => t.status === "completed");
                    const anyFailed = tasks.some(t => t.status === "failed");
                    const anyPending = tasks.some(t => t.status === "pending_approval");
                    const batchColor = allDone ? "text-emerald-400" : anyFailed ? "text-red-400" : anyPending ? "text-amber-400" : "text-primary";
                    const BatchIcon = allDone ? CheckCircle2 : anyFailed ? XCircle : anyPending ? Clock : Loader2;
                    return (
                      <div key={bid} className="px-5 py-3 hover:bg-muted/10 transition-colors" data-testid={`history-batch-${bid}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <BatchIcon className={`h-3.5 w-3.5 ${batchColor} shrink-0`} />
                          <span className="text-xs font-semibold truncate flex-1">{first.title || bid}</span>
                          <RiskBadge risk={first.riskLevel || "low"} />
                          <span className="text-[9px] text-muted-foreground shrink-0">{timeAgo(first.createdAt as any)}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-5">
                          <span className="text-[9px] text-muted-foreground font-mono truncate">{bid}</span>
                          <span className="text-[9px] text-muted-foreground">·</span>
                          <span className="text-[9px] text-muted-foreground">{tasks.length} asset{tasks.length !== 1 ? "s" : ""}</span>
                          <span className="text-[9px] text-muted-foreground">·</span>
                          <span className={`text-[9px] font-semibold ${batchColor}`}>
                            {allDone ? "All completed" : anyFailed ? `${tasks.filter(t=>t.status==="failed").length} failed` : anyPending ? "Pending approval" : "In progress"}
                          </span>
                          <div className="ml-auto flex gap-1">
                            {tasks.map(t => {
                              const aName = assetNameMap.get(t.assetId) || t.assetId;
                              const tColor = t.status === "completed" ? "bg-emerald-500" : t.status === "failed" ? "bg-red-500" : "bg-amber-500";
                              return (
                                <div key={t.id} title={`${aName}: ${t.status}`} className={`h-2.5 w-2.5 rounded-full ${tColor}`} data-testid={`history-task-dot-${t.id}`} />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </ScrollArea>
        </div>
      )}

      {/* ════ SCHEDULES VIEW ══════════════════════════════════════════════════ */}
      {view === "schedules" && (
        <div className="flex flex-col flex-1 min-h-0">
          {schedulesLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !schedules.length ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
              <CalendarClock className="h-10 w-10 opacity-30" />
              <p className="text-sm">No scheduled commands yet</p>
              <Button size="sm" onClick={() => { setEditSchedule(null); setShowScheduleDialog(true); }} data-testid="button-new-schedule-empty">
                <Plus className="h-3.5 w-3.5 mr-1.5" />Create First Schedule
              </Button>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border/20">
                {schedules.map(s => (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors" data-testid={`schedule-row-${s.id}`}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${s.enabled ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate">{s.name}</span>
                        <RiskBadge risk={s.riskLevel} />
                        <CatBadge cat={s.category} />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-[9px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">{s.cronExpression}</code>
                        <span className="text-[9px] text-muted-foreground">{s.assetIds.length} asset{s.assetIds.length !== 1 ? "s" : ""}</span>
                        {s.lastRunAt && <span className="text-[9px] text-muted-foreground">Last run: {timeAgo(s.lastRunAt)}</span>}
                        {s.nextRunAt && <span className="text-[9px] text-muted-foreground">Next: {timeAgo(s.nextRunAt)}</span>}
                        <span className="text-[9px] text-muted-foreground">Runs: {s.runCount}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        className={`text-[9px] font-semibold px-2 py-1 rounded-lg border transition-colors ${s.enabled ? "border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30" : "border-border/40 text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30"}`}
                        onClick={() => toggleScheduleMutation.mutate({ id: s.id, enabled: !s.enabled })}
                        data-testid={`button-toggle-schedule-${s.id}`}>
                        {s.enabled ? "Enabled" : "Disabled"}
                      </button>
                      <button className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditSchedule(s); setScheduleForm({ name: s.name, description: s.description || "", cronExpression: s.cronExpression, riskLevel: s.riskLevel, category: s.category, changeRef: s.changeRef || "" }); setShowScheduleDialog(true); }}
                        data-testid={`button-edit-schedule-${s.id}`}><PenLine className="h-3 w-3" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                        onClick={() => deleteScheduleMutation.mutate(s.id)}
                        data-testid={`button-delete-schedule-${s.id}`}><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* ════ APPROVALS VIEW ══════════════════════════════════════════════════ */}
      {view === "approvals" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-5 py-2 border-b border-border/30 bg-muted/10 shrink-0 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold">4-Eyes Approval Gate</span>
            {pendingApprovalCount > 0 && <span className="text-[9px] font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">{pendingApprovalCount} pending</span>}
            <p className="text-[10px] text-muted-foreground ml-2">High/critical-risk commands require a second person to approve before execution.</p>
            <button className="ml-auto text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1" onClick={() => refetchApprovals()}><RefreshCw className="h-3 w-3" />Refresh</button>
          </div>
          {approvalsLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : !approvals.length ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground">
              <ShieldCheck className="h-10 w-10 opacity-30 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">No pending approvals</p>
              <p className="text-xs">All high-risk commands have been reviewed. Good work!</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="divide-y divide-border/20">
                {approvals.map(a => {
                  const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();
                  const approving = approveMutation.isPending;
                  const rejecting = rejectMutation.isPending;
                  return (
                    <div key={a.id} className={`px-5 py-4 hover:bg-muted/10 transition-colors ${isExpired ? "opacity-60" : ""}`} data-testid={`approval-row-${a.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                          <ShieldAlert className="h-4 w-4 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold truncate">{a.title}</span>
                            <RiskBadge risk={a.riskLevel} />
                            {isExpired && <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full border border-red-500/20">Expired</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[9px] text-muted-foreground">
                            <span>Asset: <strong className="text-foreground/70">{a.assetName || a.assetId}</strong></span>
                            <span>·</span>
                            <span>Requested by: <strong className="text-foreground/70">{a.requestedByName || a.requestedById}</strong></span>
                            <span>·</span>
                            <span>{timeAgo(a.requestedAt)}</span>
                            {a.expiresAt && <><span>·</span><span>Expires: {timeAgo(a.expiresAt)}</span></>}
                            {a.changeRef && <><span>·</span><span className="text-primary font-mono">{a.changeRef}</span></>}
                          </div>
                          {/* Script preview */}
                          <pre className="mt-2 text-[9px] font-mono text-foreground/60 bg-background/60 border border-border/30 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-20 overflow-y-auto">{a.script.substring(0, 300)}{a.script.length > 300 ? "\n…" : ""}</pre>
                        </div>
                        {!isExpired && (
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button
                              className="flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
                              onClick={() => approveMutation.mutate({ id: a.id })} disabled={approving || rejecting}
                              data-testid={`button-approve-${a.id}`}>
                              {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}Approve
                            </button>
                            <button
                              className="flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
                              onClick={() => rejectMutation.mutate({ id: a.id })} disabled={approving || rejecting}
                              data-testid={`button-reject-${a.id}`}>
                              {rejecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* ════ DIALOGS ════════════════════════════════════════════════════════ */}

      {/* {{VAR}} Fill Dialog */}
      <Dialog open={showVarFill} onOpenChange={setShowVarFill}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-400" />Fill Parameterized Values</DialogTitle>
            <DialogDescription>Your script contains variables. Fill in the values before dispatch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {Object.keys(varValues).map(varName => (
              <div key={varName}>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block"><code className="text-amber-400">{`{{${varName}}}`}</code></label>
                <Input value={varValues[varName]} onChange={e => setVarValues(v => ({ ...v, [varName]: e.target.value }))}
                  placeholder={`Value for ${varName}…`} className="h-8 text-sm font-mono" data-testid={`input-var-${varName}`} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowVarFill(false)}>Cancel</Button>
            <Button onClick={handleVarFillDispatch} disabled={Object.values(varValues).some(v => !v.trim())}
              data-testid="button-var-fill-dispatch">
              <Play className="h-3.5 w-3.5 mr-1.5" />Dispatch with Values
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Create/Edit Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" />{editSchedule ? "Edit Schedule" : "New Scheduled Command"}</DialogTitle>
            <DialogDescription>Recurring command dispatch using cron syntax. Scripts run from the Command Composer when triggered.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Schedule Name</label>
              <Input value={scheduleForm.name} onChange={e => setScheduleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Nightly Disk Cleanup" className="h-8" data-testid="input-schedule-name" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Cron Expression</label>
              <Input value={scheduleForm.cronExpression} onChange={e => setScheduleForm(f => ({ ...f, cronExpression: e.target.value }))} placeholder="0 2 * * *" className="h-8 font-mono" data-testid="input-schedule-cron" />
              <div className="mt-1 flex gap-2 flex-wrap">
                {[["0 * * * *","Every hour"],["0 2 * * *","Daily 2am"],["0 0 * * 0","Weekly Sun"],["*/15 * * * *","Every 15min"]].map(([c,l]) => (
                  <button key={c} className="text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded hover:bg-primary/20 font-mono" onClick={() => setScheduleForm(f => ({ ...f, cronExpression: c }))}>{l} ({c})</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Risk Level</label>
                <select value={scheduleForm.riskLevel} onChange={e => setScheduleForm(f => ({ ...f, riskLevel: e.target.value }))} className="w-full h-8 rounded-md border border-border/40 bg-background text-[10px] px-2" data-testid="select-schedule-risk">
                  {["low","medium","high","critical"].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Category</label>
                <select value={scheduleForm.category} onChange={e => setScheduleForm(f => ({ ...f, category: e.target.value }))} className="w-full h-8 rounded-md border border-border/40 bg-background text-[10px] px-2" data-testid="select-schedule-category">
                  {["general","endpoint","network","compute","database","security","cloud","storage"].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Change Reference (optional)</label>
              <Input value={scheduleForm.changeRef} onChange={e => setScheduleForm(f => ({ ...f, changeRef: e.target.value }))} placeholder="CHG-12345" className="h-8 font-mono" data-testid="input-schedule-change-ref" />
            </div>
            {!editSchedule && (
              <div className="rounded-lg border border-border/30 bg-muted/10 p-3 text-[10px] text-muted-foreground">
                <p className="font-semibold text-foreground/70 mb-1">Script & Assets</p>
                <p>The current script in the Dispatch Composer (<strong>{script.split('\n').length}L</strong>) and all selected assets (<strong>{selectedAssets.size}</strong>) will be used for this schedule. Switch to Dispatch view to configure them first.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button
              disabled={!scheduleForm.name.trim() || !scheduleForm.cronExpression.trim() || createScheduleMutation.isPending || updateScheduleMutation.isPending}
              onClick={() => {
                if (editSchedule) {
                  updateScheduleMutation.mutate({ id: editSchedule.id, body: scheduleForm });
                } else {
                  createScheduleMutation.mutate({ ...scheduleForm, script: script.trim(), scriptType, assetIds: [...selectedAssets] });
                }
              }}
              data-testid="button-save-schedule">
              {createScheduleMutation.isPending || updateScheduleMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />{editSchedule ? "Update Schedule" : "Create Schedule"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scope Manager */}
      <ScopeManagerDialog open={showScopeManager} onClose={() => setShowScopeManager(false)} />

      {/* Create / Edit Catalog Entry */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-4 w-4 text-violet-400" />
              {editEntry ? "Edit Catalog Entry" : "New Catalog Command"}
            </DialogTitle>
            <DialogDescription>Commands go through Draft → Dry Run → Published before being usable in dispatch.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-20">Author</span>
              <div className="flex gap-1">
                {(["human", "agent"] as const).map(a => (
                  <button key={a} className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-colors ${form.authorType === a ? "bg-primary/10 border-primary/30 text-primary" : "border-border/30 text-muted-foreground hover:border-border/60"}`}
                    onClick={() => setForm(f => ({ ...f, authorType: a }))} data-testid={`button-form-author-${a}`}>
                    {a === "human" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}{a === "human" ? "Human" : "AI Agent"}
                  </button>
                ))}
              </div>
              {form.authorType === "agent" && (
                <Input value={form.authorName} onChange={e => setForm(f => ({ ...f, authorName: e.target.value }))} placeholder="Agent name (optional)" className="flex-1 h-7 text-[10px]" data-testid="input-form-author-name" />
              )}
            </div>
            <div className="space-y-2">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Command name *" className="h-8" data-testid="input-form-name" />
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="h-8" data-testid="input-form-description" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Category</p>
                <div className="flex flex-wrap gap-1">
                  {CATEGORIES.map(c => { const Icon = c.icon; return (
                    <button key={c.id} className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${form.category === c.id ? `${c.color} ${c.bg} ${c.border}` : "border-border/20 text-muted-foreground/50 hover:border-border/50"}`}
                      onClick={() => setForm(f => ({ ...f, category: c.id }))} data-testid={`button-form-cat-${c.id}`}>
                      <Icon className="h-2.5 w-2.5" />{c.label}
                    </button>
                  ); })}
                </div>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Script Type</p>
                <div className="flex flex-wrap gap-1">
                  {SCRIPT_TYPES.map(st => (
                    <button key={st.id} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${form.scriptType === st.id ? `border-primary/30 bg-primary/10 ${st.color}` : "border-border/20 text-muted-foreground/50 hover:border-border/50"}`}
                      onClick={() => setForm(f => ({ ...f, scriptType: st.id }))} data-testid={`button-form-st-${st.id}`}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Risk Level</p>
                <div className="flex flex-wrap gap-1">
                  {RISK_LEVELS.map(r => { const Icon = r.icon; return (
                    <button key={r.id} className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border transition-colors ${form.riskLevel === r.id ? `${r.color} ${r.bg} ${r.border}` : "border-border/20 text-muted-foreground/50 hover:border-border/50"}`}
                      onClick={() => setForm(f => ({ ...f, riskLevel: r.id }))} data-testid={`button-form-risk-${r.id}`}>
                      <Icon className="h-2.5 w-2.5" />{r.label}
                    </button>
                  ); })}
                </div>
              </div>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Compatible OS</p>
              <div className="flex gap-1.5 flex-wrap">
                {(["windows", "linux", "macos", "android"] as OSFamily[]).map(os => {
                  const sel = form.compatibleOs.includes(os);
                  return (
                    <button key={os} className={`text-[9px] font-semibold px-2 py-1 rounded-full border transition-colors ${sel ? `${OS_COLORS[os]} ${OS_BG[os]}` : "border-border/30 text-muted-foreground/50 hover:border-border/60"}`}
                      onClick={() => setForm(f => ({ ...f, compatibleOs: sel ? f.compatibleOs.filter(o => o !== os) : [...f.compatibleOs, os] }))}
                      data-testid={`button-form-os-${os}`}>
                      {OS_LABELS[os]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Script *</p>
              <Textarea value={form.script} onChange={e => setForm(f => ({ ...f, script: e.target.value }))}
                placeholder={`# ${form.scriptType} script…`}
                className="font-mono text-xs min-h-32 max-h-64 resize-y" data-testid="textarea-form-script" />
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <RotateCcw className="h-3 w-3 text-orange-400" />Rollback Script <span className="text-muted-foreground/40 font-normal normal-case">(optional — run to undo this command)</span>
              </p>
              <Textarea value={form.rollbackScript} onChange={e => setForm(f => ({ ...f, rollbackScript: e.target.value }))}
                placeholder={`# Rollback / undo script (optional)…`}
                className="font-mono text-xs min-h-20 max-h-40 resize-y" data-testid="textarea-form-rollback-script" />
            </div>
            <div className="flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground/50" />
              <Input value={form.changeRef} onChange={e => setForm(f => ({ ...f, changeRef: e.target.value }))} placeholder="CHG-0000 (optional)" className="w-48 h-7 text-[10px] font-mono" data-testid="input-form-changeref" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={submitForm} disabled={createCatalogMutation.isPending || updateCatalogMutation.isPending} data-testid="button-form-submit">
              {(createCatalogMutation.isPending || updateCatalogMutation.isPending) ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : editEntry ? "Save Changes" : "Create Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dry Run dialog */}
      <Dialog open={!!dryRunEntry} onOpenChange={o => { if (!o) { setDryRunEntry(null); if (dryRunPollRef.current) clearInterval(dryRunPollRef.current); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-amber-400" />Dry Run — {dryRunEntry?.name}
            </DialogTitle>
            <DialogDescription>Execute this command on a test asset to verify it before publishing to the catalog.</DialogDescription>
          </DialogHeader>
          {dryRunEntry && (
            <div className="space-y-4 py-2">
              <pre className="text-[10px] font-mono text-foreground/70 bg-muted/20 border border-border/30 rounded-lg p-3 max-h-32 overflow-y-auto whitespace-pre-wrap">{dryRunEntry.script}</pre>
              {dryRunStatus === "idle" && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Select test asset</p>
                  <div className="grid gap-1.5 max-h-48 overflow-y-auto">
                    {inScopeAssets.map(asset => {
                      const os = assetOsMap.get(asset.id) ?? "unknown";
                      const incompat = os !== "unknown" && !compatibleOS(dryRunEntry.scriptType, os);
                      return (
                        <button key={asset.id}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left border transition-colors ${dryRunAssetId === asset.id ? "bg-primary/10 border-primary/30" : incompat ? "border-amber-500/20 opacity-60 hover:opacity-80" : "border-border/30 hover:bg-muted/30"}`}
                          onClick={() => setDryRunAssetId(asset.id)} data-testid={`button-dryrun-asset-${asset.id}`}>
                          <div className={`h-2 w-2 rounded-full shrink-0 ${statusDot[asset.status] ?? "bg-gray-500"}`} />
                          <span className="text-[11px] font-semibold flex-1 truncate">{asset.name}</span>
                          <OSBadge os={os} />
                          {incompat && <span className="text-[8px] text-amber-400 font-semibold">may fail</span>}
                          {dryRunAssetId === asset.id && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {dryRunStatus === "running" && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div><p className="text-sm font-semibold">Dry run in progress…</p><p className="text-[10px] text-muted-foreground">Waiting for probe heartbeat (~30s)</p></div>
                </div>
              )}
              {dryRunStatus === "passed" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /><p className="text-sm font-semibold text-emerald-400">Dry run passed!</p>
                  </div>
                  {dryRunOutput?.result && <pre className="text-[10px] font-mono text-foreground/70 bg-muted/20 border border-border/30 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{dryRunOutput.result}</pre>}
                </div>
              )}
              {dryRunStatus === "failed" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
                    <XCircle className="h-4 w-4 text-red-400" /><p className="text-sm font-semibold text-red-400">Dry run failed</p>
                  </div>
                  {dryRunOutput?.error && <pre className="text-[10px] font-mono text-foreground/70 bg-red-500/5 border border-red-500/20 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">{dryRunOutput.error}</pre>}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDryRunEntry(null)}>Close</Button>
            {dryRunStatus === "idle" && (
              <Button variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                disabled={!dryRunAssetId || startDryRunMutation.isPending} onClick={() => dryRunEntry && startDryRunMutation.mutate({ id: dryRunEntry.id, assetId: dryRunAssetId })}
                data-testid="button-start-dry-run">
                {startDryRunMutation.isPending ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Starting…</> : <><FlaskConical className="h-3.5 w-3.5 mr-1.5" />Run Dry Run</>}
              </Button>
            )}
            {dryRunStatus === "passed" && (
              <Button className="bg-violet-600 hover:bg-violet-700"
                onClick={() => { if (dryRunEntry) { publishMutation.mutate(dryRunEntry.id); setDryRunEntry(null); } }}
                data-testid="button-publish-after-dryrun">
                <Package className="h-3.5 w-3.5 mr-1.5" />Publish to Catalog
              </Button>
            )}
            {dryRunStatus === "failed" && (
              <Button variant="outline" onClick={() => { if (dryRunEntry) { openEdit(dryRunEntry); setDryRunEntry(null); } }} data-testid="button-edit-after-failed">
                <PenLine className="h-3.5 w-3.5 mr-1.5" />Edit Command
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incompatibility dialog */}
      <Dialog open={showIncompatDialog} onOpenChange={setShowIncompatDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400"><AlertCircle className="h-5 w-5" />Script / OS Mismatch</DialogTitle>
            <DialogDescription>Some selected assets are incompatible with <strong>{scriptType}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
              {incompatAssets.map(a => { const os = assetOsMap.get(a.id) ?? "unknown"; return (
                <div key={a.id} className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold">{a.name}</span><OSBadge os={os} />
                  <span className="text-[9px] text-amber-400/70 flex-1 truncate">{incompatReason(scriptType, os)}</span>
                </div>
              ); })}
            </div>
            {compatibleSelected.length > 0 && <p className="text-[10px] text-muted-foreground"><strong className="text-emerald-400">{compatibleSelected.length} compatible asset{compatibleSelected.length !== 1 ? "s" : ""}</strong> will receive the command if you choose "Compatible only".</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowIncompatDialog(false)}>Cancel</Button>
            {compatibleSelected.length > 0 && (
              <Button variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => { setShowIncompatDialog(false); const p = { ...pendingDispatch, assetIds: compatibleSelected.map(a => a.id) }; if (riskLevel === "high") { setPendingDispatch(p); setShowHighRiskDialog(true); } else { doDispatch(p); setPendingDispatch(null); } }}
                data-testid="button-compat-only">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Compatible only ({compatibleSelected.length})
              </Button>
            )}
            <Button variant="destructive" onClick={() => { setShowIncompatDialog(false); if (riskLevel === "high") setShowHighRiskDialog(true); else { doDispatch(pendingDispatch); setPendingDispatch(null); } }} data-testid="button-execute-all">Execute all anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* High-risk confirmation */}
      <Dialog open={showHighRiskDialog} onOpenChange={setShowHighRiskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400"><AlertOctagon className="h-5 w-5" />High-Risk Confirmation</DialogTitle>
            <DialogDescription>This command may cause destructive changes, stop critical services, or wipe data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <pre className="text-[10px] font-mono text-foreground/70 max-h-24 overflow-y-auto whitespace-pre-wrap">{script.substring(0, 300)}{script.length > 300 ? "\n…" : ""}</pre>
            </div>
            {changeRef && <p className="text-[10px] text-amber-400 font-mono">Change reference: <strong>{changeRef}</strong></p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowHighRiskDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (pendingDispatch) doDispatch(pendingDispatch); setShowHighRiskDialog(false); setPendingDispatch(null); }} data-testid="button-confirm-high-risk">
              <AlertOctagon className="h-3.5 w-3.5 mr-1.5" />Confirm & Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
