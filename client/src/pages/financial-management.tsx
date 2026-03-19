import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Sparkles,
  BarChart3, PiggyBank, CheckCircle, RefreshCw, Info,
  GitPullRequest, Bug, BellRing, FileSearch, ShieldAlert,
  Loader2, ArrowRight, Check, Bot, Play, Clock, XCircle, SkipForward,
  ChevronDown, ChevronUp, Zap, User,
} from "lucide-react";

interface ServiceFinancial {
  id: number;
  serviceName: string;
  costCenter: string;
  annualBudget: number;
  ytdSpend: number;
  monthlyRunRate: number;
  forecastedAnnual: number;
  costModel: string;
  currency: string;
  owner: string;
  notes?: string;
}

interface AiRecommendation {
  id: string;
  title: string;
  rationale: string;
  estimatedSaving: number;
  effort: "low" | "medium" | "high";
  actionType: "raise_change" | "raise_problem" | "notify_owner" | "review_contract" | "budget_alert";
  actionLabel: string;
  actionServiceName?: string;
}

interface AiAnalysis {
  summary: string;
  budgetHealth: "good" | "warning" | "critical";
  overallUtilization: number;
  alerts: { service: string; type: string; message: string; impact: "high" | "medium" | "low" }[];
  recommendations: AiRecommendation[];
  topCostDrivers: { service: string; annualBudget: number; pctOfPortfolio: number }[];
}

interface ExecLogEntry {
  recId: string;
  actionType: string;
  status: "success" | "failed" | "skipped";
  title: string;
  agentNote: string;
  recordId?: string | number;
  recordType?: string;
  skippedReason?: string;
  error?: string;
  executedAt: string;
}

interface AgentExecution {
  agentReasoning: string;
  executionLog: ExecLogEntry[];
  summary: { total: number; succeeded: number; failed: number; skipped: number };
  executedAt: string;
}

/* ─── style maps ─── */
const healthBg: Record<string, string> = {
  good: "bg-green-500/10 border-green-500/30",
  warning: "bg-yellow-500/10 border-yellow-500/30",
  critical: "bg-red-500/10 border-red-500/30",
};
const healthColor: Record<string, string> = {
  good: "text-green-400",
  warning: "text-yellow-400",
  critical: "text-red-400",
};
const impactBadge: Record<string, string> = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-blue-500/20 text-blue-400",
};
const effortBadge: Record<string, string> = {
  low: "bg-green-500/20 text-green-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  high: "bg-red-500/20 text-red-400",
};
const actionMeta: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  raise_change:    { icon: GitPullRequest, color: "text-blue-400",   bg: "border-blue-500/40 hover:bg-blue-500/10",   label: "Raise RFC" },
  raise_problem:   { icon: Bug,            color: "text-orange-400",  bg: "border-orange-500/40 hover:bg-orange-500/10", label: "Raise Problem" },
  notify_owner:    { icon: BellRing,       color: "text-purple-400",  bg: "border-purple-500/40 hover:bg-purple-500/10", label: "Notify Owner" },
  review_contract: { icon: FileSearch,     color: "text-cyan-400",    bg: "border-cyan-500/40 hover:bg-cyan-500/10",   label: "Review Contract" },
  budget_alert:    { icon: ShieldAlert,    color: "text-red-400",     bg: "border-red-500/40 hover:bg-red-500/10",     label: "Raise Alert" },
  skipped:         { icon: SkipForward,    color: "text-muted-foreground", bg: "", label: "Skipped" },
};
const execStatusMeta = {
  success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  failed:  { icon: XCircle,     color: "text-red-400",   bg: "bg-red-500/10 border-red-500/30" },
  skipped: { icon: SkipForward, color: "text-muted-foreground", bg: "bg-muted/30 border-border/50" },
};

function fmt(n: number) {
  return n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K`
    : `$${n.toFixed(0)}`;
}

function inferActionType(rec: AiRecommendation): AiRecommendation["actionType"] {
  if (rec.actionType && actionMeta[rec.actionType]) return rec.actionType;
  const text = `${rec.title} ${rec.rationale}`.toLowerCase();
  if (/contract|vendor|supplier|licens|renew|sla/.test(text)) return "review_contract";
  if (/chronic|systemic|investig|root cause|recurring|repeated/.test(text)) return "raise_problem";
  if (/exceed|breach|over budget|threshold|alert/.test(text)) return "budget_alert";
  if (/notify|flag.*owner|inform|escalat.*owner/.test(text)) return "notify_owner";
  return "raise_change";
}

function inferActionLabel(rec: AiRecommendation): string {
  if (rec.actionLabel) return rec.actionLabel;
  const t = inferActionType(rec);
  return actionMeta[t]?.label ?? "Take Action";
}

/* ─── Agent Execution Log Panel ─── */
function AgentExecutionPanel({ execution, onClose }: { execution: AgentExecution; onClose: () => void }) {
  const [, navigate] = useLocation();
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="border border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary shrink-0" />
            AI Agent Execution Report
            <Badge className="text-[10px] bg-green-500/20 text-green-400">
              {execution.summary.succeeded} Actioned
            </Badge>
            {execution.summary.failed > 0 && (
              <Badge className="text-[10px] bg-red-500/20 text-red-400">
                {execution.summary.failed} Failed
              </Badge>
            )}
            {execution.summary.skipped > 0 && (
              <Badge className="text-[10px] bg-muted text-muted-foreground">
                {execution.summary.skipped} Skipped
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setExpanded(e => !e)}>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground" onClick={onClose}>
              <XCircle className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 italic">"{execution.agentReasoning}"</p>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {execution.executionLog.map((entry, i) => {
              const sm = execStatusMeta[entry.status] ?? execStatusMeta.skipped;
              const am = actionMeta[entry.actionType] ?? actionMeta.notify_owner;
              const StatusIcon = sm.icon;
              const ActionIcon = am.icon;
              const ts = new Date(entry.executedAt).toLocaleTimeString();
              return (
                <div
                  key={i}
                  className={`flex flex-col sm:flex-row sm:items-start gap-2 p-2.5 rounded-lg border text-xs ${sm.bg}`}
                  data-testid={`exec-log-${i}`}
                >
                  <div className="flex items-center gap-2 sm:w-6 shrink-0">
                    <StatusIcon className={`h-4 w-4 ${sm.color} shrink-0`} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ActionIcon className={`h-3 w-3 ${am.color} shrink-0`} />
                      <span className="font-semibold truncate">{entry.title || entry.recId}</span>
                      {entry.recordType && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          {entry.recordType === "change_request" ? "RFC Created" : entry.recordType === "problem" ? "Problem Created" : entry.actionType}
                        </Badge>
                      )}
                    </div>
                    {entry.agentNote && (
                      <p className="text-muted-foreground italic">Agent note: {entry.agentNote}</p>
                    )}
                    {entry.skippedReason && (
                      <p className="text-muted-foreground">Skipped: {entry.skippedReason}</p>
                    )}
                    {entry.error && (
                      <p className="text-red-400">Error: {entry.error}</p>
                    )}
                    {entry.recordId && entry.recordType === "change_request" && (
                      <button
                        className="text-blue-400 underline underline-offset-2 hover:text-blue-300 cursor-pointer text-[11px] mt-0.5"
                        onClick={() => navigate("/change-management")}
                      >
                        View in Change Management →
                      </button>
                    )}
                    {entry.recordId && entry.recordType === "problem" && (
                      <button
                        className="text-orange-400 underline underline-offset-2 hover:text-orange-300 cursor-pointer text-[11px] mt-0.5"
                        onClick={() => navigate("/problem-management")}
                      >
                        View in Problem Management →
                      </button>
                    )}
                  </div>
                  <span className="text-muted-foreground text-[10px] shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{ts}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 text-right">
            AI Agent executed at {new Date(execution.executedAt).toLocaleString()}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

/* ─── Single Recommendation Card ─── */
function RecommendationCard({
  rec, idx, agentActionedRecIds, onHumanActioned,
}: {
  rec: AiRecommendation;
  idx: number;
  agentActionedRecIds: Set<string>;
  onHumanActioned: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [humanActioned, setHumanActioned] = useState(false);

  const effectiveActionType = inferActionType(rec);
  const effectiveActionLabel = inferActionLabel(rec);
  const meta = actionMeta[effectiveActionType] ?? actionMeta.notify_owner;
  const ActionIcon = meta.icon;

  const agentActioned = agentActionedRecIds.has(rec.id);
  const actioned = humanActioned || agentActioned;

  const raiseChangeMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/change-requests", {
        title: `[AI Financial] ${rec.title}`,
        description: `AI-generated financial optimisation action.\n\nRationale: ${rec.rationale}\n\nTarget service: ${rec.actionServiceName ?? "Portfolio-wide"}\nEstimated annual saving: ${fmt(rec.estimatedSaving)}`,
        type: "standard", status: "draft", priority: "medium",
        riskLevel: rec.effort === "high" ? "high" : rec.effort === "medium" ? "medium" : "low",
        impactAssessment: `Cost optimisation suggested by HOLOCRON AI Financial Agent. Est. saving: ${fmt(rec.estimatedSaving)}/yr. Effort: ${rec.effort}.`,
        rollbackPlan: "Revert cost model or configuration to previous state.",
        affectedCIs: rec.actionServiceName ? [rec.actionServiceName] : [],
      });
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/change-requests"] });
      setHumanActioned(true);
      onHumanActioned(rec.id);
      toast({ title: "Change Request Raised", description: `RFC "${data.title ?? rec.title}" created — review in Change Management.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const raiseProblemMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/problems", {
        title: `[AI Financial] ${rec.title}`,
        description: `AI-detected chronic financial issue.\n\nRationale: ${rec.rationale}\n\nTarget: ${rec.actionServiceName ?? "Portfolio-wide"}`,
        status: "open", priority: rec.effort === "high" ? "high" : "medium",
        category: "financial", affectedServices: rec.actionServiceName ? [rec.actionServiceName] : [],
        relatedIncidentCount: 0,
      });
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/problems"] });
      setHumanActioned(true);
      onHumanActioned(rec.id);
      toast({ title: "Problem Record Raised", description: `Problem "${data.title ?? rec.title}" created — track in Problem Management.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isPending = raiseChangeMutation.isPending || raiseProblemMutation.isPending;

  function handleHumanAction() {
    switch (effectiveActionType) {
      case "raise_change":    raiseChangeMutation.mutate(); break;
      case "raise_problem":   raiseProblemMutation.mutate(); break;
      case "review_contract": navigate("/supplier-management"); break;
      case "notify_owner":
      case "budget_alert":
        setHumanActioned(true);
        onHumanActioned(rec.id);
        toast({
          title: effectiveActionType === "budget_alert" ? "Budget Alert Raised" : "Owner Notified",
          description: `${rec.actionServiceName ?? "Service"} flagged: "${rec.title}". Logged by AI Financial Agent.`,
        });
        break;
    }
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-start gap-3 p-3 rounded-lg border transition-colors ${
        actioned ? "bg-green-500/5 border-green-500/20" : "bg-background/50 border-border/50"
      }`}
      data-testid={`rec-financial-${idx}`}
    >
      <CheckCircle className={`h-4 w-4 mt-0.5 shrink-0 hidden sm:block ${actioned ? "text-green-500" : "text-muted-foreground/40"}`} />

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-xs font-semibold">{rec.title}</p>
          {rec.actionServiceName && (
            <Badge variant="outline" className="text-[10px] py-0">{rec.actionServiceName}</Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">{rec.rationale}</p>
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {rec.estimatedSaving > 0 && (
            <span className="text-[11px] text-green-400 font-medium">Est. saving: {fmt(rec.estimatedSaving)}/yr</span>
          )}
          <Badge className={`text-[10px] ${effortBadge[rec.effort]}`}>{rec.effort} effort</Badge>
        </div>
      </div>

      <div className="shrink-0 self-start sm:self-center flex flex-col items-end gap-1">
        {actioned ? (
          <div className={`flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1.5 ${
            agentActioned ? "text-primary border-primary/30 bg-primary/5" : "text-green-400 border-green-500/30 bg-green-500/10"
          }`}>
            {agentActioned ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            <span>{agentActioned ? "Agent Actioned" : "You Actioned"}</span>
          </div>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm" variant="outline"
                  className={`text-xs h-8 gap-1.5 ${meta.bg} ${meta.color} border`}
                  onClick={handleHumanAction}
                  disabled={isPending}
                  data-testid={`button-action-rec-${idx}`}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ActionIcon className="h-3.5 w-3.5" />}
                  {effectiveActionLabel}
                  {effectiveActionType === "review_contract" && <ArrowRight className="h-3 w-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs max-w-[200px]">
                {effectiveActionType === "raise_change" && "Raises a formal Change Request pre-filled with this AI recommendation."}
                {effectiveActionType === "raise_problem" && "Creates a Problem Record to track this chronic financial issue."}
                {effectiveActionType === "notify_owner" && "Flags this issue to the service owner via the AI Financial Agent."}
                {effectiveActionType === "review_contract" && "Opens Supplier Management to review related vendor contracts."}
                {effectiveActionType === "budget_alert" && "Raises an immediate budget threshold alert."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
          <User className="h-2.5 w-2.5" /> human &nbsp;·&nbsp; <Bot className="h-2.5 w-2.5" /> agent
        </span>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function FinancialManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [agentExecution, setAgentExecution] = useState<AgentExecution | null>(null);
  const [humanActionedIds, setHumanActionedIds] = useState<Set<string>>(new Set());
  const [agentActionedIds, setAgentActionedIds] = useState<Set<string>>(new Set());

  const { data: financials = [], isLoading } = useQuery<ServiceFinancial[]>({
    queryKey: ["/api/financial-management"],
  });

  const analysisMutation = useMutation({
    mutationFn: async (data: ServiceFinancial[]) => {
      const r = await apiRequest("POST", "/api/financial-management/ai-analysis", { financials: data });
      return r.json();
    },
    onSuccess: (data) => { setAnalysis(data); setAnalysisError(null); setAgentExecution(null); setAgentActionedIds(new Set()); setHumanActionedIds(new Set()); },
    onError: (e: Error) => setAnalysisError(e.message),
  });

  const agentExecuteMutation = useMutation({
    mutationFn: async () => {
      if (!analysis?.recommendations?.length) throw new Error("No recommendations to execute");
      const r = await apiRequest("POST", "/api/financial-management/ai-execute", {
        financials,
        recommendations: analysis.recommendations,
      });
      return r.json() as Promise<AgentExecution>;
    },
    onSuccess: (data) => {
      setAgentExecution(data);
      const succeeded = data.executionLog.filter(e => e.status === "success").map(e => e.recId);
      setAgentActionedIds(new Set(succeeded));
      qc.invalidateQueries({ queryKey: ["/api/change-requests"] });
      qc.invalidateQueries({ queryKey: ["/api/problems"] });
      toast({
        title: `AI Agent Completed — ${data.summary.succeeded} action${data.summary.succeeded !== 1 ? "s" : ""} taken`,
        description: `${data.summary.succeeded} executed, ${data.summary.skipped} skipped, ${data.summary.failed} failed. See the execution log below.`,
      });
    },
    onError: (e: Error) => toast({ title: "Agent Error", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (financials.length > 0 && !analysis && !analysisMutation.isPending) {
      analysisMutation.mutate(financials);
    }
  }, [financials]);

  const totalBudget   = financials.reduce((s, f) => s + (f.annualBudget ?? 0), 0);
  const totalSpend    = financials.reduce((s, f) => s + (f.ytdSpend ?? 0), 0);
  const totalForecast = financials.reduce((s, f) => s + (f.forecastedAnnual ?? 0), 0);
  const utilPct       = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;

  const recs = analysis?.recommendations ?? [];
  const totalActioned = humanActionedIds.size + agentActionedIds.size;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto overflow-x-hidden">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <span className="truncate">Service Financial Management</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            ITIL 4 — Budget governance, cost modelling &amp; spend analytics across {financials.length} IT services
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => { setAnalysis(null); analysisMutation.mutate(financials); }}
          disabled={analysisMutation.isPending || isLoading}
          data-testid="button-refresh-analysis"
          className="shrink-0 self-start"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${analysisMutation.isPending ? "animate-spin" : ""}`} />
          Re-analyse
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Portfolio Budget", value: fmt(totalBudget), icon: PiggyBank, color: "text-blue-500" },
          { label: "YTD Spend", value: fmt(totalSpend), icon: BarChart3, color: "text-purple-500" },
          { label: "Forecasted Annual", value: fmt(totalForecast), icon: TrendingUp, color: totalForecast > totalBudget ? "text-red-500" : "text-green-500" },
          { label: "Budget Utilisation", value: `${utilPct}%`, icon: utilPct > 90 ? TrendingDown : TrendingUp, color: utilPct > 90 ? "text-red-500" : "text-green-500" },
        ].map((k) => (
          <Card key={k.label} data-testid={`card-kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <k.icon className={`h-6 w-6 sm:h-8 sm:w-8 ${k.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate">{k.label}</p>
                <p className="text-lg sm:text-xl font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Analysis Card */}
      <Card className={`border ${analysis ? healthBg[analysis.budgetHealth] : "border-border"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            AI Financial Agent — Insights &amp; Actions
            {analysis && (
              <Badge className={`text-[10px] ${healthColor[analysis.budgetHealth]}`} variant="outline">
                {analysis.budgetHealth.toUpperCase()}
              </Badge>
            )}
            {analysisMutation.isPending && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Analysing portfolio…
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysisMutation.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" />
              <div className="pt-2 space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" /><Skeleton className="h-16 w-full rounded-lg" /><Skeleton className="h-16 w-full rounded-lg" />
              </div>
            </div>
          )}
          {analysisError && (
            <p className="text-red-400 text-sm flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 shrink-0" />{analysisError}
            </p>
          )}
          {analysis && !analysisMutation.isPending && (
            <div className="space-y-5">
              <p className="text-xs sm:text-sm text-muted-foreground">{analysis.summary}</p>

              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Portfolio Budget Utilisation</span>
                  <span>{analysis.overallUtilization != null ? Math.round(analysis.overallUtilization * 100) : utilPct}%</span>
                </div>
                <Progress value={analysis.overallUtilization != null ? Math.round(analysis.overallUtilization * 100) : utilPct} className="h-2" />
              </div>

              {/* Financial Alerts */}
              {analysis.alerts?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Financial Alerts</p>
                  {analysis.alerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`alert-financial-${i}`}>
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{a.service}</span>
                        <span className="text-muted-foreground"> — {a.message}</span>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${impactBadge[a.impact]}`}>{a.impact}</Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations + AI Agent Controls */}
              {recs.length > 0 && (
                <div className="space-y-3">
                  {/* Section header with Run AI Agent button */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 flex-wrap">
                      <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                        AI Recommendations &amp; Actions
                      </p>
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                        {recs.length} actionable
                      </Badge>
                      {totalActioned > 0 && (
                        <Badge className="text-[10px] bg-green-500/20 text-green-400">
                          {totalActioned} actioned
                        </Badge>
                      )}
                    </div>

                    {/* Run AI Agent button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => agentExecuteMutation.mutate()}
                              disabled={agentExecuteMutation.isPending || !recs.length}
                              data-testid="button-run-ai-agent"
                            >
                              {agentExecuteMutation.isPending
                                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Agent Running…</>
                                : <><Zap className="h-3.5 w-3.5" /><Bot className="h-3.5 w-3.5" /> Run AI Agent</>
                              }
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs max-w-[220px]">
                            The HOLOCRON AI Financial Agent will autonomously review all recommendations, decide which to execute, and create real records (Change Requests, Problem records) on your behalf — showing a full execution log.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Mode explanation */}
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/50 text-[11px] text-muted-foreground">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                    <span>
                      Each action can be taken by <span className="text-foreground font-medium"><User className="inline h-3 w-3" /> you</span> (click the button on each card) or by the <span className="text-foreground font-medium"><Bot className="inline h-3 w-3" /> AI Agent</span> autonomously (click "Run AI Agent" above). Both paths create real records in the platform.
                    </span>
                  </div>

                  {/* Agent execution pending */}
                  {agentExecuteMutation.isPending && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                      <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                      <div className="text-xs">
                        <p className="font-medium text-primary">AI Financial Agent is executing…</p>
                        <p className="text-muted-foreground">Analysing recommendations, deciding actions, creating records in real-time.</p>
                      </div>
                    </div>
                  )}

                  {/* Agent execution log */}
                  {agentExecution && (
                    <AgentExecutionPanel
                      execution={agentExecution}
                      onClose={() => setAgentExecution(null)}
                    />
                  )}

                  <Separator className="opacity-30" />

                  {/* Recommendation cards */}
                  {recs.map((r, i) => (
                    <RecommendationCard
                      key={r.id ?? i}
                      rec={r}
                      idx={i}
                      agentActionedRecIds={agentActionedIds}
                      onHumanActioned={(id) => setHumanActionedIds(prev => new Set([...prev, id]))}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Cost Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary shrink-0" />
            IT Service Cost Ledger ({financials.length} services)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[800px]">
                <thead>
                  <tr className="border-b border-border">
                    {["Service", "Cost Center", "Owner", "Model", "Annual Budget", "YTD Spend", "Run Rate/mo", "Forecasted", "Utilisation"].map((h) => (
                      <th key={h} className="p-3 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {financials.map((f) => {
                    const util = f.annualBudget > 0 ? Math.round((f.ytdSpend / f.annualBudget) * 100) : 0;
                    const overForecast = f.forecastedAnnual > f.annualBudget;
                    return (
                      <tr key={f.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-financial-${f.id}`}>
                        <td className="p-3 font-medium whitespace-nowrap">{f.serviceName}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{f.costCenter}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{f.owner}</td>
                        <td className="p-3 whitespace-nowrap"><Badge variant="outline" className="text-[10px]">{f.costModel}</Badge></td>
                        <td className="p-3 font-mono whitespace-nowrap">{fmt(f.annualBudget)}</td>
                        <td className="p-3 font-mono whitespace-nowrap">{fmt(f.ytdSpend)}</td>
                        <td className="p-3 font-mono whitespace-nowrap">{fmt(f.monthlyRunRate)}</td>
                        <td className={`p-3 font-mono whitespace-nowrap ${overForecast ? "text-red-400" : "text-green-400"}`}>
                          {fmt(f.forecastedAnnual)}{overForecast && <TrendingUp className="inline h-3 w-3 ml-1" />}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Progress value={util} className="h-1.5 w-14 shrink-0" />
                            <span className={`whitespace-nowrap ${util > 90 ? "text-red-400" : util > 75 ? "text-yellow-400" : "text-green-400"}`}>{util}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Cost Drivers */}
      {analysis?.topCostDrivers?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-primary shrink-0" />
              Top Cost Drivers (AI-identified)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.topCostDrivers.map((d, i) => (
                <div key={i} className="flex items-center gap-2 sm:gap-3" data-testid={`cost-driver-${i}`}>
                  <span className="text-xs font-medium w-28 sm:w-40 truncate shrink-0">{d.service}</span>
                  <Progress value={d.pctOfPortfolio} className="flex-1 h-2 min-w-0" />
                  <span className="text-xs text-muted-foreground w-10 sm:w-12 text-right shrink-0">{d.pctOfPortfolio?.toFixed(1)}%</span>
                  <span className="text-xs font-mono text-muted-foreground w-16 sm:w-20 text-right shrink-0 hidden sm:block">{fmt(d.annualBudget)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
