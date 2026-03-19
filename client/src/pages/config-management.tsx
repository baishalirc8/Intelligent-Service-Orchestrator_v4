import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DiscoveredAsset } from "@shared/schema";
import {
  Settings2, Zap, ClipboardList, ChevronRight, CheckCircle2, XCircle,
  AlertTriangle, Info, Loader2, Play, FileText, RotateCcw,
  Clock, User, Cpu, Network, Lock, Server, Trash2,
  BookOpen, Layers, BarChart3, GitBranch, Target
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface ConfigRfc {
  id: string;
  rfcNumber: string;
  title: string;
  changeType: string;
  category: string;
  standard: string;
  mode: string;
  status: string;
  risk: string;
  summary: string | null;
  impact: string | null;
  driftFindings: DriftFinding[];
  changes: ConfigChange[];
  rollbackPlan: string | null;
  maintenanceWindow: string | null;
  complianceScoreBefore: number | null;
  complianceScoreTarget: number | null;
  aiModel: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assetId: string;
}

interface DriftFinding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  currentState: string;
  requiredState: string;
  gap: string;
  category: string;
}

interface ConfigChange {
  id: string;
  title: string;
  description: string;
  findingRef: string;
  priority: number;
  riskLevel: string;
  estimatedDuration: string;
  script: string;
  rollbackScript: string;
  verification: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const STANDARDS = [
  { value: "cis_l1", label: "CIS Benchmark L1", badge: "CIS", desc: "Conservative controls for general use" },
  { value: "cis_l2", label: "CIS Benchmark L2", badge: "CIS", desc: "Defense-in-depth for high-security" },
  { value: "disa_stig", label: "DISA STIG", badge: "DoD", desc: "DoD Security Technical Implementation" },
  { value: "iso27001", label: "ISO/IEC 27001", badge: "ISO", desc: "Information security management" },
  { value: "pci_dss", label: "PCI DSS v4.0", badge: "PCI", desc: "Payment card security standard" },
  { value: "nist_800_53", label: "NIST SP 800-53", badge: "NIST", desc: "Federal security controls" },
  { value: "itil_baseline", label: "ITIL Baseline", badge: "ITIL", desc: "Service management baseline" },
];

const SCOPES = [
  { value: "all", label: "All Areas", icon: Layers },
  { value: "security", label: "Security", icon: Lock },
  { value: "network", label: "Network", icon: Network },
  { value: "services", label: "Services", icon: Server },
  { value: "os", label: "OS & System", icon: Cpu },
];

const STATUS_CONFIG: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  draft:        { color: "bg-muted/50 text-muted-foreground border-border", icon: FileText, label: "Draft" },
  pending_cab:  { color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: Clock, label: "Pending CAB" },
  approved:     { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: CheckCircle2, label: "Approved" },
  in_progress:  { color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", icon: Loader2, label: "In Progress" },
  completed:    { color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2, label: "Completed" },
  rejected:     { color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle, label: "Rejected" },
  rolled_back:  { color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: RotateCcw, label: "Rolled Back" },
};

const RISK_CONFIG: Record<string, string> = {
  low: "bg-green-500/10 text-green-400 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
};

const SEVERITY_CONFIG: Record<string, { color: string; dot: string }> = {
  critical: { color: "text-red-400", dot: "bg-red-500" },
  high:     { color: "text-orange-400", dot: "bg-orange-500" },
  medium:   { color: "text-yellow-400", dot: "bg-yellow-500" },
  low:      { color: "text-blue-400", dot: "bg-blue-500" },
  info:     { color: "text-muted-foreground", dot: "bg-muted-foreground" },
};

// ── Score Gauge ────────────────────────────────────────────────────────────────
function ScoreGauge({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ * 0.75;
  const color = score >= 80 ? "#4ade80" : score >= 60 ? "#facc15" : "#f87171";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth="7"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeDashoffset={circ * 0.375}
          strokeLinecap="round" className="text-border" transform={`rotate(-225 ${size / 2} ${size / 2})`} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${filled} ${circ - filled}`} strokeDashoffset={circ * 0.375}
          strokeLinecap="round" transform={`rotate(-225 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize={size * 0.22} fontWeight="700">{score}%</text>
      </svg>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

// ── RFC Detail Panel ───────────────────────────────────────────────────────────
function RfcDetail({ rfc, asset, onClose, onRefresh }: {
  rfc: ConfigRfc; asset?: DiscoveredAsset | null;
  onClose: () => void; onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const approveMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", `/api/config-rfcs/${rfc.id}/approve`, {}); return r.json(); },
    onSuccess: () => { toast({ title: "RFC Approved", description: `${rfc.rfcNumber} is ready for execution` }); onRefresh(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const executeMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", `/api/config-rfcs/${rfc.id}/execute`, {}); return r.json(); },
    onSuccess: (d) => { toast({ title: "Executing RFC", description: `${d.tasksCreated} changes dispatched to probe` }); onRefresh(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("DELETE", `/api/config-rfcs/${rfc.id}`, {}); return r.json(); },
    onSuccess: () => { toast({ title: "RFC Deleted" }); onClose(); onRefresh(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusCfg = STATUS_CONFIG[rfc.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const findings = (rfc.driftFindings as unknown as DriftFinding[]) || [];
  const changes = (rfc.changes as unknown as ConfigChange[]) || [];
  const stdLabel = STANDARDS.find(s => s.value === rfc.standard)?.label || rfc.standard;

  const severityCounts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1; return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{rfc.rfcNumber}</span>
            <Badge className={`text-[10px] border ${statusCfg.color} gap-1`}>
              <StatusIcon className="h-2.5 w-2.5" />{statusCfg.label}
            </Badge>
            <Badge className={`text-[10px] border ${RISK_CONFIG[rfc.risk] || RISK_CONFIG.medium}`}>
              {rfc.risk.toUpperCase()} RISK
            </Badge>
            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">
              {stdLabel}
            </Badge>
          </div>
          <h3 className="text-sm font-semibold mt-1 leading-snug">{rfc.title}</h3>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Server className="h-3 w-3" />{asset?.hostname || asset?.ipAddress || rfc.assetId.slice(0, 8)}</span>
            <span className="flex items-center gap-1"><Layers className="h-3 w-3" />{rfc.category}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(rfc.createdAt).toLocaleDateString()}</span>
            {rfc.approvedBy && <span className="flex items-center gap-1"><User className="h-3 w-3" />Approved by {rfc.approvedBy}</span>}
          </div>
        </div>
        {/* Score gauges */}
        {rfc.complianceScoreBefore != null && (
          <div className="flex items-center gap-3 shrink-0">
            <ScoreGauge score={rfc.complianceScoreBefore} label="Before" size={72} />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            {rfc.complianceScoreTarget != null && <ScoreGauge score={rfc.complianceScoreTarget} label="Target" size={72} />}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 shrink-0 bg-muted/20">
        {rfc.status === "draft" && (
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} data-testid="button-approve-rfc">
            {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Approve RFC
          </Button>
        )}
        {rfc.status === "approved" && (
          <Button size="sm" className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => executeMutation.mutate()} disabled={executeMutation.isPending} data-testid="button-execute-rfc">
            {executeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Execute Changes
          </Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-delete-rfc">
          <Trash2 className="h-3 w-3" /> Delete
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Close</Button>
      </div>

      {/* Body tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <TabsList className="rounded-none border-b border-border/50 bg-transparent h-8 px-4 shrink-0 justify-start gap-0">
          {[
            { id: "overview", label: "Overview" },
            { id: "findings", label: `Findings (${findings.length})` },
            { id: "changes", label: `Changes (${changes.length})` },
            { id: "rollback", label: "Rollback Plan" },
          ].map(t => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-8 px-3">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="overview" className="m-0 p-4 space-y-4">
            {/* Summary */}
            {rfc.summary && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Executive Summary</h4>
                <p className="text-sm leading-relaxed">{rfc.summary}</p>
              </div>
            )}
            {/* Impact */}
            {rfc.impact && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Impact Analysis</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{rfc.impact}</p>
              </div>
            )}
            {/* Maintenance window */}
            {rfc.maintenanceWindow && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <Clock className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-blue-400">Recommended Maintenance Window</p>
                  <p className="text-sm text-muted-foreground">{rfc.maintenanceWindow}</p>
                </div>
              </div>
            )}
            {/* Severity breakdown */}
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Findings by Severity</h4>
              <div className="flex items-center gap-2 flex-wrap">
                {(["critical", "high", "medium", "low", "info"] as const).map(s => severityCounts[s] ? (
                  <div key={s} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-card border border-border/50">
                    <div className={`h-2 w-2 rounded-full ${SEVERITY_CONFIG[s].dot}`} />
                    <span className="text-xs font-medium capitalize">{s}</span>
                    <span className="text-xs text-muted-foreground">{severityCounts[s]}</span>
                  </div>
                ) : null)}
              </div>
            </div>
            {/* AI Model note */}
            {rfc.aiModel && (
              <p className="text-[10px] text-muted-foreground/50 font-mono">Generated by {rfc.aiModel}</p>
            )}
          </TabsContent>

          <TabsContent value="findings" className="m-0 p-4 space-y-2">
            {findings.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No drift findings</p>}
            {findings.map((f, i) => (
              <div key={f.id || i} className="border border-border/50 rounded-lg p-3 space-y-2 bg-card/50" data-testid={`finding-${f.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full shrink-0 mt-1 ${SEVERITY_CONFIG[f.severity]?.dot || "bg-muted-foreground"}`} />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-muted-foreground">{f.id}</span>
                        <Badge className="text-[9px] bg-muted border-border">{f.category}</Badge>
                      </div>
                      <p className="text-sm font-medium leading-tight">{f.title}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] capitalize shrink-0 ${RISK_CONFIG[f.severity] || RISK_CONFIG.medium}`}>{f.severity}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Current State</p>
                    <p className="text-foreground/80">{f.currentState}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-medium text-primary/80 uppercase tracking-wide">Required State</p>
                    <p className="text-foreground/80">{f.requiredState}</p>
                  </div>
                </div>
                {f.gap && <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">{f.gap}</p>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="changes" className="m-0 p-4 space-y-2">
            {changes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No changes defined</p>}
            <Accordion type="multiple" className="space-y-2">
              {changes.sort((a, b) => (a.priority || 0) - (b.priority || 0)).map((c, i) => (
                <AccordionItem key={c.id || i} value={c.id || String(i)} className="border border-border/50 rounded-lg bg-card/50 overflow-hidden" data-testid={`change-${c.id}`}>
                  <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/30">
                    <div className="flex items-center gap-2 text-left flex-1">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">{c.priority || i + 1}</span>
                      <span className="text-sm font-medium">{c.title}</span>
                      <div className="flex items-center gap-1 ml-auto mr-2">
                        {c.findingRef && <Badge className="text-[9px] bg-muted border-border font-mono">{c.findingRef}</Badge>}
                        <Badge className={`text-[9px] ${RISK_CONFIG[c.riskLevel] || RISK_CONFIG.medium}`}>{c.riskLevel}</Badge>
                        {c.estimatedDuration && <Badge className="text-[9px] bg-muted/50 border-border/50 text-muted-foreground">{c.estimatedDuration}</Badge>}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3 space-y-3">
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    {c.script && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Implementation Script</p>
                        <pre className="text-xs bg-[#0d1117] text-green-400 p-3 rounded-md overflow-x-auto font-mono leading-relaxed">{c.script}</pre>
                      </div>
                    )}
                    {c.rollbackScript && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-orange-400/80 uppercase tracking-wide">Rollback Script</p>
                        <pre className="text-xs bg-[#0d1117] text-orange-400/80 p-3 rounded-md overflow-x-auto font-mono leading-relaxed">{c.rollbackScript}</pre>
                      </div>
                    )}
                    {c.verification && (
                      <div className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{c.verification}</span>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="rollback" className="m-0 p-4">
            {rfc.rollbackPlan ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <RotateCcw className="h-4 w-4 text-orange-400 shrink-0" />
                  <p className="text-xs text-orange-400 font-medium">ITIL Rollback Procedure</p>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{rfc.rollbackPlan}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No rollback plan defined</p>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ── Streaming Analysis ─────────────────────────────────────────────────────────
function AnalysisStream({ onComplete }: { onComplete: (rfcId: string) => void }) {
  const { toast } = useToast();
  const [assetId, setAssetId] = useState("");
  const [standard, setStandard] = useState("cis_l1");
  const [scope, setScope] = useState("all");
  const [mode, setMode] = useState<"audit" | "scratch">("audit");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<{ stage: string; message: string; done: boolean }[]>([]);
  const [streamedText, setStreamedText] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { data: assets = [] } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const probeAssets = assets.filter(a => a.probeId);
  const allAssets = assets;

  const markStage = (s: string, msg: string) => {
    setStages(prev => {
      const existing = prev.find(x => x.stage === s);
      if (existing) return prev.map(x => x.stage === s ? { ...x, message: msg, done: false } : x);
      return [...prev, { stage: s, message: msg, done: false }];
    });
  };
  const completeStage = (s: string) => {
    setStages(prev => prev.map(x => x.stage === s ? { ...x, done: true } : x));
  };

  const run = useCallback(async () => {
    if (!assetId || !standard) return;
    setRunning(true); setStreamedText(""); setError(""); setStages([]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch("/api/config-rfcs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, standard, scope, mode }),
        signal: ctrl.signal,
      });

      if (!resp.ok) { throw new Error(await resp.text()); }

      const reader = resp.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "progress") {
              markStage(ev.stage, ev.message);
              // complete the previous stage when the next one starts
              if (ev.stage === "analyzing") completeStage("reading");
              if (ev.stage === "generating") completeStage("analyzing");
              if (ev.stage === "saving") completeStage("generating");
            }
            if (ev.type === "chunk") { setStreamedText(t => t + ev.text); }
            if (ev.type === "done") { completeStage("saving"); toast({ title: "RFC Created", description: ev.rfcNumber }); onComplete(ev.rfcId); }
            if (ev.type === "error") { setError(ev.error || "Analysis failed"); }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "Failed");
    } finally { setRunning(false); }
  }, [assetId, standard, scope, mode, onComplete, toast]);

  const stop = () => { abortRef.current?.abort(); setRunning(false); };

  const STAGE_LABELS: Record<string, string> = {
    reading: "Reading asset configuration",
    analyzing: "Running gap analysis",
    generating: "Generating RFC with AI",
    saving: "Saving RFC to CMDB",
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Config form */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Target Asset</label>
          <Select value={assetId} onValueChange={setAssetId}>
            <SelectTrigger className="h-9" data-testid="select-config-asset">
              <SelectValue placeholder="Select asset to audit..." />
            </SelectTrigger>
            <SelectContent>
              {probeAssets.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-green-400 uppercase tracking-wide">Probe Enrolled</div>
                  {probeAssets.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
                        <span className="font-mono text-sm">{a.hostname || a.ipAddress}</span>
                        <span className="text-muted-foreground text-xs">{a.type} · {(a.metadata as any)?.software?.os?.split(" ").slice(0, 2).join(" ")}</span>
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
              {allAssets.filter(a => !a.probeId).length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Inventory (no probe)</div>
                  {allAssets.filter(a => !a.probeId).map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="font-mono text-sm text-muted-foreground">{a.hostname || a.ipAddress}</span>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Compliance Standard</label>
            <Select value={standard} onValueChange={setStandard}>
              <SelectTrigger className="h-9" data-testid="select-config-standard">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STANDARDS.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 shrink-0">{s.badge}</Badge>
                      <span>{s.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Scope</label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-9" data-testid="select-config-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{s.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mode selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">AI Agent Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "audit" as const, title: "Audit & Improve", desc: "Identify gaps in current config", icon: BarChart3 },
              { id: "scratch" as const, title: "Configure from Scratch", desc: "Design a full baseline config", icon: GitBranch },
            ].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${mode === m.id ? "border-primary bg-primary/5" : "border-border/50 hover:border-border hover:bg-muted/30"}`}
                data-testid={`mode-${m.id}`}>
                <m.icon className={`h-4 w-4 mt-0.5 shrink-0 ${mode === m.id ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className={`text-xs font-medium ${mode === m.id ? "text-primary" : ""}`}>{m.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <Button className="w-full gap-2" onClick={running ? stop : run} disabled={!assetId} data-testid="button-run-analysis">
          {running ? (<><Loader2 className="h-4 w-4 animate-spin" />Stop Analysis</>) : (<><Zap className="h-4 w-4" />Run AI Analysis</>)}
        </Button>
      </div>

      {/* Stages */}
      {stages.length > 0 && (
        <div className="space-y-1.5">
          {stages.map(s => (
            <div key={s.stage} className="flex items-center gap-2.5 text-xs">
              {s.done
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                : running ? <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                : <div className="h-3.5 w-3.5 shrink-0" />
              }
              <span className={s.done ? "text-green-400" : "text-muted-foreground"}>{STAGE_LABELS[s.stage] || s.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Live streaming preview */}
      {streamedText && (
        <div className="rounded-lg border border-primary/20 bg-[#0d1117] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-primary/10 bg-primary/5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400">AI generating RFC…</span>
          </div>
          <pre className="text-[10px] font-mono text-green-300/70 p-3 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {streamedText.slice(-1200)}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ITIL note */}
      {!running && stages.length === 0 && (
        <div className="border border-border/30 rounded-lg p-3 space-y-1 bg-muted/10">
          <div className="flex items-center gap-1.5 text-xs font-medium"><BookOpen className="h-3.5 w-3.5 text-primary" /> ITIL-Aligned Process</div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            The AI agent follows ITIL Service Configuration Management practices — auditing CIs against your selected standard, documenting drift, and generating a formal RFC with change type classification, risk/impact assessment, implementation plan, and rollback procedure ready for CAB review.
          </p>
        </div>
      )}
    </div>
  );
}

// ── RFC List ───────────────────────────────────────────────────────────────────
function RfcList({ rfcs, assets, selectedId, onSelect, loading }: {
  rfcs: ConfigRfc[]; assets: DiscoveredAsset[];
  selectedId: string | null; onSelect: (id: string) => void; loading: boolean;
}) {
  if (loading) return (
    <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  );
  if (rfcs.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
      <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">No RFCs yet</p>
      <p className="text-xs text-muted-foreground/60">Run an AI analysis to create your first RFC</p>
    </div>
  );

  return (
    <div className="space-y-1.5 p-2">
      {rfcs.map(rfc => {
        const asset = assets.find(a => a.id === rfc.assetId);
        const cfg = STATUS_CONFIG[rfc.status] || STATUS_CONFIG.draft;
        const StatusIcon = cfg.icon;
        const findings = (rfc.driftFindings as unknown as DriftFinding[]) || [];
        const critCount = findings.filter(f => f.severity === "critical" || f.severity === "high").length;
        return (
          <button key={rfc.id} onClick={() => onSelect(rfc.id)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${selectedId === rfc.id ? "border-primary bg-primary/5" : "border-border/40 hover:border-border hover:bg-muted/30"}`}
            data-testid={`rfc-item-${rfc.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground">{rfc.rfcNumber}</span>
                  <Badge className={`text-[9px] border ${cfg.color} gap-1 py-0`}>
                    <StatusIcon className="h-2 w-2" />{cfg.label}
                  </Badge>
                </div>
                <p className="text-xs font-medium mt-0.5 truncate">{rfc.title}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>{asset?.hostname || asset?.ipAddress || "Unknown"}</span>
                  <span>·</span>
                  <span>{STANDARDS.find(s => s.value === rfc.standard)?.badge || rfc.standard}</span>
                  {critCount > 0 && <><span>·</span><span className="text-red-400">{critCount} critical/high</span></>}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <Badge className={`text-[9px] ${RISK_CONFIG[rfc.risk] || RISK_CONFIG.medium}`}>{rfc.risk}</Badge>
                {rfc.complianceScoreBefore != null && (
                  <span className="text-[10px] text-muted-foreground">{rfc.complianceScoreBefore}% → {rfc.complianceScoreTarget ?? "?"}%</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ConfigManagement() {
  const [view, setView] = useState<"analyze" | "rfcs">("analyze");
  const [selectedRfcId, setSelectedRfcId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: rfcs = [], isLoading: rfcsLoading } = useQuery<ConfigRfc[]>({
    queryKey: ["/api/config-rfcs"],
    refetchInterval: 15000,
  });

  const { data: assets = [] } = useQuery<DiscoveredAsset[]>({
    queryKey: ["/api/discovered-assets"],
  });

  const selectedRfc = rfcs.find(r => r.id === selectedRfcId);
  const selectedAsset = selectedRfc ? assets.find(a => a.id === selectedRfc.assetId) : null;

  const handleAnalysisComplete = (rfcId: string) => {
    queryClient.invalidateQueries({ queryKey: ["/api/config-rfcs"] });
    setSelectedRfcId(rfcId);
    setView("rfcs");
  };

  // Summary counts
  const draftCount = rfcs.filter(r => r.status === "draft").length;
  const approvedCount = rfcs.filter(r => r.status === "approved").length;
  const inProgressCount = rfcs.filter(r => r.status === "in_progress").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Top stats bar */}
      {rfcs.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border/30 bg-muted/10 shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">{rfcs.length} RFC{rfcs.length !== 1 ? "s" : ""}</span>
            {draftCount > 0 && <span className="flex items-center gap-1 text-muted-foreground"><FileText className="h-3 w-3" />{draftCount} draft</span>}
            {approvedCount > 0 && <span className="flex items-center gap-1 text-blue-400"><CheckCircle2 className="h-3 w-3" />{approvedCount} approved</span>}
            {inProgressCount > 0 && <span className="flex items-center gap-1 text-indigo-400"><Loader2 className="h-3 w-3 animate-spin" />{inProgressCount} in progress</span>}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: tabs + content */}
        <div className="w-80 flex flex-col border-r border-border/50 shrink-0 overflow-hidden">
          {/* View switcher */}
          <div className="flex border-b border-border/50 shrink-0">
            <button onClick={() => setView("analyze")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${view === "analyze" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-analyze">
              <Zap className="h-3.5 w-3.5" />New Analysis
            </button>
            <button onClick={() => setView("rfcs")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${view === "rfcs" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              data-testid="tab-rfcs">
              <ClipboardList className="h-3.5 w-3.5" />RFCs
              {rfcs.length > 0 && <Badge className="text-[9px] bg-muted border-border h-4 px-1">{rfcs.length}</Badge>}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {view === "analyze" ? (
              <AnalysisStream onComplete={handleAnalysisComplete} />
            ) : (
              <RfcList
                rfcs={rfcs} assets={assets}
                selectedId={selectedRfcId} onSelect={setSelectedRfcId}
                loading={rfcsLoading}
              />
            )}
          </div>
        </div>

        {/* Right panel: RFC detail or empty state */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedRfc ? (
            <RfcDetail
              rfc={selectedRfc} asset={selectedAsset}
              onClose={() => setSelectedRfcId(null)}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["/api/config-rfcs"] })}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center">
                  <Settings2 className="h-9 w-9 text-primary/40" />
                </div>
              </div>
              <div className="space-y-2 max-w-md">
                <h2 className="text-lg font-semibold">AI Configuration Management</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Select an asset, choose a compliance standard, and let the AI agent audit the current configuration — then generate a formal ITIL Request for Change with findings, remediation scripts, and a rollback plan.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full">
                {[
                  { icon: BarChart3, title: "Gap Analysis", desc: "Compare actual vs standard" },
                  { icon: FileText, title: "RFC Generation", desc: "ITIL-compliant RFC with CAB workflow" },
                  { icon: Play, title: "Automated Fix", desc: "Dispatch changes via probe" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border/40 bg-muted/10">
                    <item.icon className="h-5 w-5 text-primary/60" />
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {STANDARDS.map(s => (
                  <Badge key={s.value} className="text-[10px] bg-muted/50 border-border/50 text-muted-foreground">
                    {s.badge} {s.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
