import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Patch, PatchJob } from "@shared/schema";
import type { DiscoveredAsset } from "@shared/schema";
import {
  ShieldCheck, ShieldAlert, Shield, Sparkles, Play, Trash2, Plus, RefreshCw,
  CheckCircle2, XCircle, Clock, AlertTriangle, BarChart3, Server, Activity,
  ChevronRight, Layers, FileText, Target, TrendingUp
} from "lucide-react";

const SEVERITY_CONFIG: Record<string, { color: string; badge: string; icon: typeof Shield }> = {
  critical: { color: "text-red-400", badge: "bg-red-500/20 text-red-400 border-red-500/30", icon: ShieldAlert },
  high:     { color: "text-orange-400", badge: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: ShieldAlert },
  medium:   { color: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Shield },
  low:      { color: "text-green-400", badge: "bg-green-500/20 text-green-400 border-green-500/30", icon: ShieldCheck },
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  available:  { label: "Available", badge: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  scheduled:  { label: "Scheduled", badge: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  deploying:  { label: "Deploying", badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  deployed:   { label: "Deployed", badge: "bg-green-500/20 text-green-400 border-green-500/30" },
  failed:     { label: "Failed", badge: "bg-red-500/20 text-red-400 border-red-500/30" },
  skipped:    { label: "Skipped", badge: "bg-muted text-muted-foreground border-border" },
};

const JOB_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  pending:     { label: "Pending",     icon: Clock,         color: "text-muted-foreground" },
  executing:   { label: "Executing",   icon: Activity,      color: "text-yellow-400" },
  completed:   { label: "Completed",   icon: CheckCircle2,  color: "text-green-400" },
  failed:      { label: "Failed",      icon: XCircle,       color: "text-red-400" },
  rolled_back: { label: "Rolled Back", icon: RefreshCw,     color: "text-purple-400" },
};

const EMPTY_PATCH = {
  title: "", description: "", severity: "medium", cvssScore: undefined as number | undefined,
  cveId: "", vendor: "", product: "", patchType: "security", scriptType: "powershell",
  patchScript: "", rollbackScript: "", changeRef: "", tags: [] as string[],
};

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.medium;
  return <Badge className={`text-[10px] border ${cfg.badge}`}>{severity.toUpperCase()}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.available;
  return <Badge className={`text-[10px] border ${cfg.badge}`}>{cfg.label}</Badge>;
}

function CvssBar({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const color = score >= 9 ? "bg-red-500" : score >= 7 ? "bg-orange-500" : score >= 4 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(score / 10) * 100}%` }} />
      </div>
      <span className="text-xs font-mono font-bold">{score.toFixed(1)}</span>
    </div>
  );
}

// ── Dashboard sub-view ────────────────────────────────────────────────────────
function DashboardView({ patches, jobs }: { patches: Patch[]; jobs: PatchJob[] }) {
  const bySeverity = {
    critical: patches.filter(p => p.severity === "critical").length,
    high:     patches.filter(p => p.severity === "high").length,
    medium:   patches.filter(p => p.severity === "medium").length,
    low:      patches.filter(p => p.severity === "low").length,
  };
  const byStatus = {
    available:  patches.filter(p => p.status === "available").length,
    scheduled:  patches.filter(p => p.status === "scheduled").length,
    deploying:  patches.filter(p => p.status === "deploying").length,
    deployed:   patches.filter(p => p.status === "deployed").length,
    failed:     patches.filter(p => p.status === "failed").length,
  };
  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const failedJobs = jobs.filter(j => j.status === "failed").length;
  const totalJobs = jobs.length;
  const deployRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;
  const topPriority = [...patches].sort((a, b) => (b.aiPriority || 0) - (a.aiPriority || 0)).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Patches", value: patches.length, icon: Shield, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Critical / High", value: bySeverity.critical + bySeverity.high, icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Deployed", value: byStatus.deployed, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Deploy Success Rate", value: `${deployRate}%`, icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} className="border-border/50 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bg}`}><Icon className={`h-5 w-5 ${color}`} /></div>
              <div>
                <div className="text-xl font-bold" data-testid={`kpi-${label.replace(/ /g,"-").toLowerCase()}`}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Severity breakdown */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />By Severity</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(["critical","high","medium","low"] as const).map(sev => {
              const count = bySeverity[sev];
              const pct = patches.length > 0 ? Math.round((count / patches.length) * 100) : 0;
              const cfg = SEVERITY_CONFIG[sev];
              return (
                <div key={sev} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className={`capitalize font-medium ${cfg.color}`}>{sev}</span>
                    <span className="text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* AI-prioritized top patches */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-400" />AI Top Priority Patches</CardTitle></CardHeader>
          <CardContent>
            {topPriority.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No patches prioritized yet. Run AI Prioritization from the Registry tab.</p>
            ) : (
              <div className="space-y-2">
                {topPriority.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="text-xs font-bold text-muted-foreground w-5">#{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-xs">{p.title}</div>
                      {p.aiNotes && <div className="text-[10px] text-muted-foreground truncate">{p.aiNotes}</div>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <SeverityBadge severity={p.severity} />
                      <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30">{p.aiPriority}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deployment stats */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Deployment Pipeline Status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 lg:grid-cols-5 gap-3 text-center">
            {Object.entries(byStatus).map(([status, count]) => {
              const cfg = STATUS_CONFIG[status];
              return (
                <div key={status} className="space-y-1">
                  <div className="text-lg font-bold">{count}</div>
                  <Badge className={`text-[10px] border ${cfg.badge}`}>{cfg.label}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Registry sub-view ─────────────────────────────────────────────────────────
function RegistryView({
  patches, onEdit, onCreate, onDelete, onAiPrioritize, isPrioritizing
}: {
  patches: Patch[];
  onEdit: (p: Patch) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onAiPrioritize: () => void;
  isPrioritizing: boolean;
}) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = patches.filter(p => {
    if (severityFilter !== "all" && p.severity !== severityFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.cveId?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search patches or CVE..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs max-w-xs"
          data-testid="input-patch-search"
        />
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-8 text-xs w-32" data-testid="select-severity-filter">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-32" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          size="sm" variant="outline"
          onClick={onAiPrioritize}
          disabled={isPrioritizing || patches.length === 0}
          className="h-8 text-xs gap-1.5"
          data-testid="button-ai-prioritize"
        >
          {isPrioritizing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-purple-400" />}
          AI Prioritize
        </Button>
        <Button size="sm" onClick={onCreate} className="h-8 text-xs gap-1.5" data-testid="button-add-patch">
          <Plus className="h-3 w-3" /> Add Patch
        </Button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {patches.length === 0 ? "No patches in registry. Click 'Add Patch' to create one." : "No patches match the current filters."}
          </div>
        )}
        {filtered.map(patch => {
          const SevIcon = SEVERITY_CONFIG[patch.severity]?.icon || Shield;
          return (
            <Card key={patch.id} className="border-border/50 bg-card/50 hover:border-border transition-colors" data-testid={`card-patch-${patch.id}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <SevIcon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_CONFIG[patch.severity]?.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{patch.title}</span>
                      {patch.cveId && <Badge className="text-[10px] bg-muted border-border font-mono">{patch.cveId}</Badge>}
                      <SeverityBadge severity={patch.severity} />
                      <StatusBadge status={patch.status} />
                      {(patch.aiPriority ?? 0) > 0 && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30 gap-1">
                              <Sparkles className="h-2.5 w-2.5" />{patch.aiPriority}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{patch.aiNotes || "AI Priority Score"}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {patch.vendor && <span>{patch.vendor}{patch.product ? ` / ${patch.product}` : ""}</span>}
                      <span className="capitalize">{patch.patchType} patch</span>
                      <span className="font-mono">{patch.scriptType}</span>
                    </div>
                    {patch.cvssScore != null && (
                      <div className="mt-1.5 max-w-[160px]"><CvssBar score={patch.cvssScore} /></div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(patch)} data-testid={`button-edit-patch-${patch.id}`}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => onDelete(patch.id)}
                      data-testid={`button-delete-patch-${patch.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Deploy sub-view ────────────────────────────────────────────────────────────
function DeployView({
  patches, jobs, assets, onDeploy, isDeploying, onRefreshJobs
}: {
  patches: Patch[];
  jobs: PatchJob[];
  assets: DiscoveredAsset[];
  onDeploy: (patchId: string, assetIds: string[]) => void;
  isDeploying: boolean;
  onRefreshJobs: () => void;
}) {
  const [selectedPatch, setSelectedPatch] = useState<string>("");
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);

  const deployable = patches.filter(p => ["available", "scheduled", "failed"].includes(p.status));
  const assetsWithProbe = assets.filter(a => a.probeId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Deployment Configurator */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Play className="h-4 w-4 text-green-400" />Deploy Patch</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs mb-1 block">Select Patch</Label>
              <Select value={selectedPatch} onValueChange={setSelectedPatch}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-deploy-patch">
                  <SelectValue placeholder="Choose patch to deploy..." />
                </SelectTrigger>
                <SelectContent>
                  {deployable.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]">{p.title}</span>
                        {p.cveId && <span className="text-[10px] text-muted-foreground font-mono">{p.cveId}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Target Assets ({selectedAssets.length} selected)</Label>
              <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border border-border/50 p-2">
                {assetsWithProbe.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No enrolled assets with probes found</p>
                )}
                {assetsWithProbe.map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-0.5">
                    <Checkbox
                      id={`asset-${a.id}`}
                      checked={selectedAssets.includes(a.id)}
                      onCheckedChange={chk => {
                        setSelectedAssets(prev => chk ? [...prev, a.id] : prev.filter(x => x !== a.id));
                      }}
                      data-testid={`checkbox-asset-${a.id}`}
                    />
                    <label htmlFor={`asset-${a.id}`} className="text-xs cursor-pointer flex items-center gap-1.5">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{a.hostname || a.ipAddress}</span>
                      {a.operatingSystem && <span className="text-muted-foreground">({a.operatingSystem})</span>}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full gap-2"
              disabled={!selectedPatch || selectedAssets.length === 0 || isDeploying}
              onClick={() => {
                onDeploy(selectedPatch, selectedAssets);
                setSelectedPatch("");
                setSelectedAssets([]);
              }}
              data-testid="button-deploy-patch"
            >
              {isDeploying ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Deploy to {selectedAssets.length} Asset{selectedAssets.length !== 1 ? "s" : ""}
            </Button>
          </CardContent>
        </Card>

        {/* Job tracker */}
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Live Job Tracker</CardTitle>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefreshJobs} data-testid="button-refresh-jobs">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No deployment jobs yet.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {jobs.slice(0, 20).map(job => {
                  const jcfg = JOB_STATUS_CONFIG[job.status] || JOB_STATUS_CONFIG.pending;
                  const JIcon = jcfg.icon;
                  const patch = patches.find(p => p.id === job.patchId);
                  const asset = null; // We'd need assets enrichment here
                  return (
                    <div key={job.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 text-xs" data-testid={`job-${job.id}`}>
                      <JIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${jcfg.color} ${job.status === "executing" ? "animate-pulse" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{patch?.title || "Unknown Patch"}</div>
                        <div className="text-muted-foreground font-mono text-[10px]">Asset: {job.assetId.slice(0, 8)}…</div>
                        {job.result && <div className="text-green-400 text-[10px] mt-0.5 truncate">{job.result.slice(0, 80)}</div>}
                        {job.error && <div className="text-red-400 text-[10px] mt-0.5 truncate">{job.error.slice(0, 80)}</div>}
                      </div>
                      <Badge className={`text-[10px] border ${jcfg.color === "text-green-400" ? "bg-green-500/20 text-green-400 border-green-500/30" : jcfg.color === "text-red-400" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-muted text-muted-foreground border-border"}`}>
                        {jcfg.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Compliance sub-view ────────────────────────────────────────────────────────
function ComplianceView({ patches, jobs }: { patches: Patch[]; jobs: PatchJob[] }) {
  const criticalUnpatched = patches.filter(p => p.severity === "critical" && p.status !== "deployed");
  const highUnpatched = patches.filter(p => p.severity === "high" && p.status !== "deployed");
  const patchedPct = patches.length > 0
    ? Math.round((patches.filter(p => p.status === "deployed").length / patches.length) * 100)
    : 0;
  const critCompliance = patches.filter(p => p.severity === "critical").length > 0
    ? Math.round((patches.filter(p => p.severity === "critical" && p.status === "deployed").length / patches.filter(p => p.severity === "critical").length) * 100)
    : 100;

  const complianceItems = [
    { label: "Overall Patch Compliance", value: patchedPct, threshold: 80, unit: "%" },
    { label: "Critical Patch Compliance", value: critCompliance, threshold: 95, unit: "%" },
    { label: "Unpatched Critical CVEs", value: criticalUnpatched.length, threshold: 0, unit: "", inverted: true },
    { label: "Unpatched High CVEs", value: highUnpatched.length, threshold: 5, unit: "", inverted: true },
  ];

  return (
    <div className="space-y-4">
      {/* Compliance score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-green-400" />Compliance KPIs</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {complianceItems.map(item => {
              const pass = item.inverted ? item.value <= item.threshold : item.value >= item.threshold;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span>{item.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold ${pass ? "text-green-400" : "text-red-400"}`}>
                        {item.value}{item.unit}
                      </span>
                      {pass ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <AlertTriangle className="h-3 w-3 text-red-400" />}
                    </div>
                  </div>
                  {item.unit === "%" && <Progress value={item.value} className="h-1.5" />}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-400" />Unpatched Critical / High</CardTitle></CardHeader>
          <CardContent>
            {criticalUnpatched.length + highUnpatched.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <ShieldCheck className="h-8 w-8 text-green-400" />
                <p className="text-sm text-green-400 font-medium">All critical & high patches deployed</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...criticalUnpatched, ...highUnpatched].map(p => (
                  <div key={p.id} className="flex items-center gap-2 p-2 rounded bg-muted/20 text-xs" data-testid={`compliance-unpatched-${p.id}`}>
                    <ShieldAlert className={`h-3.5 w-3.5 shrink-0 ${SEVERITY_CONFIG[p.severity]?.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.title}</div>
                      {p.cveId && <div className="text-muted-foreground font-mono text-[10px]">{p.cveId}</div>}
                    </div>
                    <SeverityBadge severity={p.severity} />
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance table */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4" />Full Patch Status</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left pb-2 pr-3 font-medium">Patch Title</th>
                  <th className="text-left pb-2 pr-3 font-medium">CVE</th>
                  <th className="text-left pb-2 pr-3 font-medium">Severity</th>
                  <th className="text-left pb-2 pr-3 font-medium">CVSS</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {patches.map(p => (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20" data-testid={`compliance-row-${p.id}`}>
                    <td className="py-1.5 pr-3 max-w-[200px]"><span className="truncate block">{p.title}</span></td>
                    <td className="py-1.5 pr-3 font-mono text-muted-foreground">{p.cveId || "—"}</td>
                    <td className="py-1.5 pr-3"><SeverityBadge severity={p.severity} /></td>
                    <td className="py-1.5 pr-3 w-24"><CvssBar score={p.cvssScore} /></td>
                    <td className="py-1.5"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
                {patches.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No patches in registry</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Patch Edit/Create Dialog ──────────────────────────────────────────────────
function PatchDialog({
  open, onClose, editPatch, onSave, isSaving
}: {
  open: boolean;
  onClose: () => void;
  editPatch: Patch | null;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(EMPTY_PATCH);

  useEffect(() => {
    if (editPatch) {
      setForm({
        title: editPatch.title,
        description: editPatch.description || "",
        severity: editPatch.severity,
        cvssScore: editPatch.cvssScore ?? undefined,
        cveId: editPatch.cveId || "",
        vendor: editPatch.vendor || "",
        product: editPatch.product || "",
        patchType: editPatch.patchType,
        scriptType: editPatch.scriptType,
        patchScript: editPatch.patchScript,
        rollbackScript: editPatch.rollbackScript || "",
        changeRef: editPatch.changeRef || "",
        tags: editPatch.tags || [],
      });
    } else {
      setForm(EMPTY_PATCH);
    }
  }, [editPatch, open]);

  const handleSave = () => {
    const payload: any = { ...form };
    if (payload.cvssScore === undefined || payload.cvssScore === "") delete payload.cvssScore;
    else payload.cvssScore = parseFloat(payload.cvssScore);
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {editPatch ? "Edit Patch" : "Register New Patch"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Windows Print Spooler RCE Fix" className="h-8 text-sm mt-1" data-testid="input-patch-title" />
            </div>
            <div>
              <Label className="text-xs">CVE ID</Label>
              <Input value={form.cveId} onChange={e => setForm(f => ({ ...f, cveId: e.target.value }))} placeholder="CVE-2024-XXXXX" className="h-8 text-sm mt-1 font-mono" data-testid="input-patch-cve" />
            </div>
            <div>
              <Label className="text-xs">CVSS Score (0–10)</Label>
              <Input
                type="number" min={0} max={10} step={0.1}
                value={form.cvssScore ?? ""}
                onChange={e => {
                  const score = e.target.value ? parseFloat(e.target.value) : undefined;
                  let severity = form.severity;
                  if (score !== undefined) {
                    if (score >= 9.0) severity = "critical";
                    else if (score >= 7.0) severity = "high";
                    else if (score >= 4.0) severity = "medium";
                    else severity = "low";
                  }
                  setForm(f => ({ ...f, cvssScore: score, severity }));
                }}
                placeholder="9.8"
                className="h-8 text-sm mt-1"
                data-testid="input-patch-cvss"
              />
            </div>
            <div>
              <Label className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={v => setForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-patch-severity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Patch Type</Label>
              <Select value={form.patchType} onValueChange={v => setForm(f => ({ ...f, patchType: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-patch-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="hotfix">Hotfix</SelectItem>
                  <SelectItem value="firmware">Firmware</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vendor</Label>
              <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Microsoft" className="h-8 text-sm mt-1" data-testid="input-patch-vendor" />
            </div>
            <div>
              <Label className="text-xs">Product</Label>
              <Input value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))} placeholder="Windows 11" className="h-8 text-sm mt-1" data-testid="input-patch-product" />
            </div>
            <div>
              <Label className="text-xs">Script Type</Label>
              <Select value={form.scriptType} onValueChange={v => setForm(f => ({ ...f, scriptType: v }))}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-patch-script-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                  <SelectItem value="bash">Bash</SelectItem>
                  <SelectItem value="sh">Shell (sh)</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Change Reference</Label>
              <Input value={form.changeRef} onChange={e => setForm(f => ({ ...f, changeRef: e.target.value }))} placeholder="CHG-001" className="h-8 text-sm mt-1 font-mono" data-testid="input-patch-changeref" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the vulnerability and fix..." className="text-sm mt-1 min-h-[60px]" data-testid="textarea-patch-description" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Patch Script *</Label>
              <Textarea value={form.patchScript} onChange={e => setForm(f => ({ ...f, patchScript: e.target.value }))} placeholder="# Enter patch deployment script..." className="text-sm mt-1 min-h-[100px] font-mono" data-testid="textarea-patch-script" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Rollback Script</Label>
              <Textarea value={form.rollbackScript} onChange={e => setForm(f => ({ ...f, rollbackScript: e.target.value }))} placeholder="# Enter rollback script (optional)..." className="text-sm mt-1 min-h-[80px] font-mono" data-testid="textarea-patch-rollback" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-patch-dialog-cancel">Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !form.title || !form.patchScript} data-testid="button-patch-dialog-save">
            {isSaving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            {editPatch ? "Save Changes" : "Register Patch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PatchManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPatch, setEditPatch] = useState<Patch | null>(null);

  const { data: patches = [], isLoading: patchLoading } = useQuery<Patch[]>({
    queryKey: ["/api/patches"],
  });

  const { data: jobs = [], refetch: refetchJobs } = useQuery<PatchJob[]>({
    queryKey: ["/api/patch-jobs"],
    refetchInterval: 5000,
  });

  const { data: assets = [] } = useQuery<DiscoveredAsset[]>({
    queryKey: ["/api/discovered-assets"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/patches", data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/patches"] }); setDialogOpen(false); toast({ title: "Patch registered" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/patches/${id}`, data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/patches"] }); setDialogOpen(false); toast({ title: "Patch updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/patches/${id}`);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/patches"] }); toast({ title: "Patch deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const prioritizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/patches/ai-prioritize", {});
      return res.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["/api/patches"] });
      toast({ title: "AI Prioritization Complete", description: `${d.updated} patches prioritized` });
    },
    onError: (e: any) => toast({ title: "AI Error", description: e.message, variant: "destructive" }),
  });

  const deployMutation = useMutation({
    mutationFn: async ({ patchId, assetIds }: { patchId: string; assetIds: string[] }) => {
      const res = await apiRequest("POST", `/api/patches/${patchId}/deploy`, { assetIds });
      return res.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["/api/patches"] });
      qc.invalidateQueries({ queryKey: ["/api/patch-jobs"] });
      toast({ title: "Deployment Started", description: `${d.jobs?.length || 0} job(s) dispatched` });
      setActiveTab("deploy");
    },
    onError: (e: any) => toast({ title: "Deploy Error", description: e.message, variant: "destructive" }),
  });

  const handleSave = (data: any) => {
    if (editPatch) updateMutation.mutate({ id: editPatch.id, data });
    else createMutation.mutate(data);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-400" />
          <div>
            <h2 className="text-sm font-semibold">AI-Driven Patch Management</h2>
            <p className="text-[10px] text-muted-foreground">CVE Registry · AI Prioritization · Deployment Pipeline · Compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge className="text-[10px] bg-muted border-border">{patches.length} patches</Badge>
          <Badge className="text-[10px] bg-muted border-border">{jobs.length} jobs</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8 mb-4">
            <TabsTrigger value="dashboard" className="text-xs h-7 gap-1.5" data-testid="tab-patch-dashboard">
              <BarChart3 className="h-3 w-3" />Dashboard
            </TabsTrigger>
            <TabsTrigger value="registry" className="text-xs h-7 gap-1.5" data-testid="tab-patch-registry">
              <Shield className="h-3 w-3" />Registry
            </TabsTrigger>
            <TabsTrigger value="deploy" className="text-xs h-7 gap-1.5" data-testid="tab-patch-deploy">
              <Play className="h-3 w-3" />Deploy
            </TabsTrigger>
            <TabsTrigger value="compliance" className="text-xs h-7 gap-1.5" data-testid="tab-patch-compliance">
              <ShieldCheck className="h-3 w-3" />Compliance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            {patchLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>
            ) : (
              <DashboardView patches={patches} jobs={jobs} />
            )}
          </TabsContent>

          <TabsContent value="registry" className="mt-0">
            <RegistryView
              patches={patches}
              onEdit={p => { setEditPatch(p); setDialogOpen(true); }}
              onCreate={() => { setEditPatch(null); setDialogOpen(true); }}
              onDelete={id => deleteMutation.mutate(id)}
              onAiPrioritize={() => prioritizeMutation.mutate()}
              isPrioritizing={prioritizeMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="deploy" className="mt-0">
            <DeployView
              patches={patches}
              jobs={jobs}
              assets={assets}
              onDeploy={(patchId, assetIds) => deployMutation.mutate({ patchId, assetIds })}
              isDeploying={deployMutation.isPending}
              onRefreshJobs={() => refetchJobs()}
            />
          </TabsContent>

          <TabsContent value="compliance" className="mt-0">
            <ComplianceView patches={patches} jobs={jobs} />
          </TabsContent>
        </Tabs>
      </div>

      <PatchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editPatch={editPatch}
        onSave={handleSave}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
