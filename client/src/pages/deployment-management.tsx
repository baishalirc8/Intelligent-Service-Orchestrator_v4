import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import {
  Rocket, CheckCircle2, XCircle, RotateCcw, Clock,
  RefreshCw, Sparkles, AlertTriangle, Activity, Server,
} from "lucide-react";

interface Deployment {
  id: number;
  name: string;
  version: string;
  environment: string;
  status: string;
  deploymentType: string;
  deployedBy: string;
  deployedAt?: string;
  rollbackVersion?: string;
  durationMinutes?: number;
  affectedServices?: string[];
  notes?: string;
  createdAt?: string;
}

interface AiAnalysis {
  summary: string;
  pipelineHealth: "healthy" | "degraded" | "critical";
  successRate: number;
  failurePatterns: { pattern: string; affectedDeployments: string[]; rootCause: string; recommendation: string }[];
  riskAssessment: { deployment: string; risk: "high" | "medium" | "low"; rationale: string }[];
  recommendations: { id: string; title: string; rationale: string; priority: "high" | "medium" | "low" }[];
  environmentHealth: { production: string; staging: string; development: string };
}

const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; badge: string }> = {
  successful:  { icon: CheckCircle2, color: "text-green-500",  badge: "bg-green-500/20 text-green-400" },
  failed:      { icon: XCircle,      color: "text-red-500",    badge: "bg-red-500/20 text-red-400" },
  rolled_back: { icon: RotateCcw,    color: "text-yellow-500", badge: "bg-yellow-500/20 text-yellow-400" },
  in_progress: { icon: Clock,        color: "text-blue-500",   badge: "bg-blue-500/20 text-blue-400" },
  scheduled:   { icon: Clock,        color: "text-purple-500", badge: "bg-purple-500/20 text-purple-400" },
};
const healthBg: Record<string, string> = {
  healthy:  "bg-green-500/10 border-green-500/30",
  degraded: "bg-yellow-500/10 border-yellow-500/30",
  critical: "bg-red-500/10 border-red-500/30",
};
const envHealthColor: Record<string, string> = {
  healthy:  "text-green-400",
  degraded: "text-yellow-400",
  critical: "text-red-400",
};
const priorityBadge: Record<string, string> = {
  high:   "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low:    "bg-blue-500/20 text-blue-400",
};
const riskBadge: Record<string, string> = {
  high:   "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low:    "bg-blue-500/20 text-blue-400",
};

export default function DeploymentManagement() {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const { data: deployments = [], isLoading } = useQuery<Deployment[]>({
    queryKey: ["/api/deployment-management"],
  });

  const analysisMutation = useMutation({
    mutationFn: async (deps: Deployment[]) => {
      const r = await apiRequest("POST", "/api/deployment-management/ai-analysis", { deployments: deps });
      return r.json();
    },
    onSuccess: (data) => { setAnalysis(data); setAnalysisError(null); },
    onError: (e: Error) => setAnalysisError(e.message),
  });

  useEffect(() => {
    if (deployments.length > 0 && !analysis && !analysisMutation.isPending) {
      analysisMutation.mutate(deployments);
    }
  }, [deployments]);

  const successful  = deployments.filter((d) => d.status === "successful").length;
  const failed      = deployments.filter((d) => d.status === "failed").length;
  const rolledBack  = deployments.filter((d) => d.status === "rolled_back").length;
  const inProgress  = deployments.filter((d) => d.status === "in_progress").length;
  const successRate = deployments.length > 0 ? Math.round((successful / deployments.length) * 100) : 0;

  const kpis = [
    { label: "Success Rate", value: `${successRate}%`, color: successRate >= 80 ? "text-green-500" : successRate >= 60 ? "text-yellow-500" : "text-red-500", icon: Activity },
    { label: "Successful",   value: successful,         color: "text-green-500",                                                                              icon: CheckCircle2 },
    { label: "Failed",       value: failed,             color: failed > 0 ? "text-red-500" : "text-muted-foreground",                                         icon: XCircle },
    { label: "Rolled Back",  value: rolledBack,         color: rolledBack > 0 ? "text-yellow-500" : "text-muted-foreground",                                  icon: RotateCcw },
    { label: "In Progress",  value: inProgress,         color: inProgress > 0 ? "text-blue-500" : "text-muted-foreground",                                    icon: Clock },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <span className="truncate">Deployment Management</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 line-clamp-2">
            ITIL 4 Technical Management — Release pipeline health, deployment velocity &amp; risk across {deployments.length} deployments
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => analysisMutation.mutate(deployments)}
          disabled={analysisMutation.isPending || isLoading}
          data-testid="button-refresh-analysis"
          className="shrink-0 self-start"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${analysisMutation.isPending ? "animate-spin" : ""}`} />
          Re-analyse
        </Button>
      </div>

      {/* KPI Row — 2 cols on mobile, 3 at sm, 5 at lg */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <Card key={k.label} data-testid={`card-kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
              <k.icon className={`h-6 w-6 sm:h-7 sm:w-7 ${k.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate">{k.label}</p>
                <p className="text-lg sm:text-xl font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Analysis */}
      <Card className={`border ${analysis ? (healthBg[analysis.pipelineHealth] ?? "border-border") : "border-border"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            AI Pipeline Health Analysis
            {analysis && (
              <Badge className="text-[10px]" variant="outline">
                {analysis.pipelineHealth.toUpperCase()}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysisMutation.isPending && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
          {analysisError && (
            <p className="text-red-400 text-sm flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 shrink-0" />{analysisError}
            </p>
          )}
          {analysis && !analysisMutation.isPending && (
            <div className="space-y-4">
              <p className="text-xs sm:text-sm text-muted-foreground">{analysis.summary}</p>

              {/* Success Rate Bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Deployment Success Rate</span>
                  <span>{analysis.successRate ?? successRate}%</span>
                </div>
                <Progress value={analysis.successRate ?? successRate} className="h-2" />
              </div>

              {/* Environment Health */}
              {analysis.environmentHealth && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Environment Health</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {Object.entries(analysis.environmentHealth).map(([env, health]) => (
                      <div key={env} className="bg-background/50 rounded p-2 text-center">
                        <Server className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-[10px] sm:text-xs font-medium capitalize">{env}</p>
                        <p className={`text-[10px] sm:text-xs font-bold capitalize ${envHealthColor[health] ?? "text-muted-foreground"}`}>{health}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.failurePatterns?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Failure Patterns Detected</p>
                  {analysis.failurePatterns.map((p, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`failure-pattern-${i}`}>
                      <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{p.pattern}</p>
                        <p className="text-muted-foreground">Root cause: {p.rootCause}</p>
                        <p className="text-green-400">{p.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analysis.riskAssessment?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Deployment Risk Assessment</p>
                  {analysis.riskAssessment.map((ra, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`risk-${i}`}>
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{ra.deployment}</p>
                        <p className="text-muted-foreground">{ra.rationale}</p>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${riskBadge[ra.risk]}`}>{ra.risk}</Badge>
                    </div>
                  ))}
                </div>
              )}

              {analysis.recommendations?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Recommendations</p>
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`rec-${i}`}>
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-muted-foreground">{r.rationale}</p>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${priorityBadge[r.priority]}`}>{r.priority}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deployments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary shrink-0" />
            Deployment Ledger ({deployments.length} records)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-border">
                    {["Name", "Version", "Environment", "Type", "Deployed By", "Duration", "Status"].map((h) => (
                      <th key={h} className="p-3 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d) => {
                    const cfg = statusConfig[d.status] ?? statusConfig.scheduled;
                    const StatusIcon = cfg.icon;
                    return (
                      <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-deployment-${d.id}`}>
                        <td className="p-3 font-medium whitespace-nowrap">{d.name}</td>
                        <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">{d.version}</td>
                        <td className="p-3 whitespace-nowrap"><Badge variant="outline" className="text-[10px]">{d.environment}</Badge></td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap capitalize">{d.deploymentType?.replace("_", " ")}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{d.deployedBy}</td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{d.durationMinutes != null ? `${d.durationMinutes}min` : "—"}</td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge className={`text-[10px] flex items-center gap-1 w-fit ${cfg.badge}`}>
                            <StatusIcon className="h-2.5 w-2.5 shrink-0" />
                            {d.status.replace("_", " ")}
                          </Badge>
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
    </div>
  );
}
