import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import {
  Users, Heart, Star, RefreshCw, Sparkles, AlertTriangle,
  CheckCircle, Calendar, ClipboardList, UserCheck, MessageSquare,
} from "lucide-react";

interface Stakeholder {
  id: number;
  name: string;
  title?: string;
  department?: string;
  email?: string;
  relationshipType: string;
  satisfactionScore?: number;
  lastReviewDate?: string;
  nextReviewDate?: string;
  services?: string[];
  notes?: string;
}

interface ServiceReview {
  id: number;
  title: string;
  reviewDate: string;
  status: string;
  stakeholder?: string;
  slaPerformance?: number;
  csatScore?: number;
  openIncidents: number;
  keyOutcomes?: string[];
  actionItems?: string[];
  notes?: string;
}

interface AiAnalysis {
  summary: string;
  relationshipHealth: "strong" | "adequate" | "at_risk" | "critical";
  avgSatisfaction: number;
  atRiskStakeholders: { name: string; department: string; issue: string; satisfactionScore: number; recommendation: string }[];
  reviewAlerts: { title: string; stakeholder: string; issue: string; daysOverdue: number; recommendation: string }[];
  recommendations: { id: string; title: string; rationale: string; priority: "high" | "medium" | "low"; stakeholder: string }[];
  upcomingReviews: { title: string; reviewDate: string; stakeholder: string }[];
}

const healthBg: Record<string, string> = {
  strong:   "bg-green-500/10 border-green-500/30",
  adequate: "bg-blue-500/10 border-blue-500/30",
  at_risk:  "bg-yellow-500/10 border-yellow-500/30",
  critical: "bg-red-500/10 border-red-500/30",
};
const healthLabel: Record<string, string> = {
  strong:   "text-green-400",
  adequate: "text-blue-400",
  at_risk:  "text-yellow-400",
  critical: "text-red-400",
};
const priorityBadge: Record<string, string> = {
  high:   "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low:    "bg-blue-500/20 text-blue-400",
};
const statusBadge: Record<string, string> = {
  completed:   "bg-green-500/20 text-green-400",
  scheduled:   "bg-blue-500/20 text-blue-400",
  overdue:     "bg-red-500/20 text-red-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
};

function SatisfactionDots({ score }: { score?: number }) {
  if (score == null) return <span className="text-muted-foreground text-xs">Not rated</span>;
  return (
    <div className="flex items-center gap-0.5 overflow-hidden">
      <div className="flex gap-0.5 shrink-0">
        {Array(10).fill(0).map((_, i) => (
          <div key={i} className={`h-1.5 w-1.5 rounded-full ${i < score ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground ml-1 shrink-0">{score}/10</span>
    </div>
  );
}

export default function RelationshipManagement() {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const { data: stakeholders = [], isLoading: loadingStakeholders } = useQuery<Stakeholder[]>({
    queryKey: ["/api/relationship-management/stakeholders"],
  });
  const { data: reviews = [], isLoading: loadingReviews } = useQuery<ServiceReview[]>({
    queryKey: ["/api/relationship-management/reviews"],
  });

  const analysisMutation = useMutation({
    mutationFn: async (args: { stakeholders: Stakeholder[]; reviews: ServiceReview[] }) => {
      const r = await apiRequest("POST", "/api/relationship-management/ai-analysis", args);
      return r.json();
    },
    onSuccess: (data) => { setAnalysis(data); setAnalysisError(null); },
    onError: (e: Error) => setAnalysisError(e.message),
  });

  useEffect(() => {
    if (stakeholders.length > 0 && reviews.length > 0 && !analysis && !analysisMutation.isPending) {
      analysisMutation.mutate({ stakeholders, reviews });
    }
  }, [stakeholders, reviews]);

  const isLoading = loadingStakeholders || loadingReviews;
  const scored = stakeholders.filter((s) => s.satisfactionScore != null);
  const avgSat = scored.length > 0
    ? (scored.reduce((a, s) => a + (s.satisfactionScore ?? 0), 0) / scored.length)
    : 0;
  const overdueReviews = reviews.filter((r) => r.status === "overdue").length;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <span className="truncate">Relationship Management</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 line-clamp-2">
            ITIL 4 — Stakeholder satisfaction, service reviews &amp; value co-creation across {stakeholders.length} relationships
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => analysisMutation.mutate({ stakeholders, reviews })}
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
          { label: "Stakeholders",    value: stakeholders.length,                                                     icon: Users,        color: "text-blue-500" },
          { label: "Avg Satisfaction", value: avgSat > 0 ? `${avgSat.toFixed(1)}/10` : "N/A",                        icon: Star,         color: avgSat >= 7 ? "text-green-500" : avgSat >= 5 ? "text-yellow-500" : "text-red-500" },
          { label: "Service Reviews", value: reviews.length,                                                           icon: ClipboardList, color: "text-purple-500" },
          { label: "Overdue Reviews", value: overdueReviews,                                                           icon: AlertTriangle, color: overdueReviews > 0 ? "text-red-500" : "text-muted-foreground" },
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

      {/* AI Analysis */}
      <Card className={`border ${analysis ? (healthBg[analysis.relationshipHealth] ?? "border-border") : "border-border"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            AI Relationship Intelligence
            {analysis && (
              <Badge className={`text-[10px] ${healthLabel[analysis.relationshipHealth]}`} variant="outline">
                {analysis.relationshipHealth.replace("_", " ").toUpperCase()}
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

              {analysis.avgSatisfaction > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Average Stakeholder Satisfaction</span>
                    <span>{analysis.avgSatisfaction.toFixed(1)}/10</span>
                  </div>
                  <Progress value={analysis.avgSatisfaction * 10} className="h-2" />
                </div>
              )}

              {analysis.atRiskStakeholders?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">At-Risk Relationships</p>
                  {analysis.atRiskStakeholders.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`at-risk-${i}`}>
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.name} <span className="text-muted-foreground font-normal">({s.department})</span></p>
                        <p className="text-muted-foreground">{s.issue}</p>
                        <p className="text-green-400">{s.recommendation}</p>
                      </div>
                      <span className="text-xs text-red-400 font-mono shrink-0">{s.satisfactionScore}/10</span>
                    </div>
                  ))}
                </div>
              )}

              {analysis.reviewAlerts?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Review Alerts</p>
                  {analysis.reviewAlerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`review-alert-${i}`}>
                      <Calendar className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{a.title} <span className="text-muted-foreground font-normal">· {a.stakeholder}</span></p>
                        <p className="text-muted-foreground capitalize">
                          {a.issue.replace("_", " ")}
                          {a.daysOverdue > 0 && ` — ${a.daysOverdue}d overdue`}
                        </p>
                        <p className="text-green-400">{a.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analysis.recommendations?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Recommendations</p>
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`rec-rel-${i}`}>
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-muted-foreground">{r.rationale}</p>
                        {r.stakeholder && <p className="text-blue-400 truncate">→ {r.stakeholder}</p>}
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

      {/* Tabs */}
      <Tabs defaultValue="stakeholders">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="stakeholders" className="flex-1 sm:flex-none text-xs sm:text-sm" data-testid="tab-stakeholders">
            Stakeholders ({stakeholders.length})
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex-1 sm:flex-none text-xs sm:text-sm" data-testid="tab-reviews">
            Service Reviews ({reviews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stakeholders" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[580px]">
                    <thead>
                      <tr className="border-b border-border">
                        {["Name", "Department", "Relationship", "Services", "Satisfaction", "Next Review"].map((h) => (
                          <th key={h} className="p-3 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stakeholders.map((s) => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-stakeholder-${s.id}`}>
                          <td className="p-3 whitespace-nowrap">
                            <p className="font-medium">{s.name}</p>
                            <p className="text-muted-foreground">{s.title}</p>
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{s.department}</td>
                          <td className="p-3 whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px]">{s.relationshipType}</Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(s.services ?? []).slice(0, 2).map((sv, i) => (
                                <Badge key={i} variant="secondary" className="text-[10px] whitespace-nowrap">{sv}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <SatisfactionDots score={s.satisfactionScore} />
                          </td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{s.nextReviewDate ?? "Not scheduled"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <div className="space-y-3">
            {isLoading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : (
              reviews.map((r) => (
                <Card key={r.id} data-testid={`card-review-${r.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-sm">{r.title}</span>
                        <Badge className={`text-[10px] ${statusBadge[r.status] ?? "bg-muted text-muted-foreground"}`}>
                          {r.status}
                        </Badge>
                      </div>
                    </div>

                    {/* Meta row — wraps on mobile */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 shrink-0" />{r.reviewDate}
                      </span>
                      {r.stakeholder && (
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3 shrink-0" />{r.stakeholder}
                        </span>
                      )}
                      {r.slaPerformance != null && (
                        <span>
                          SLA: <span className={r.slaPerformance >= 99 ? "text-green-400" : r.slaPerformance >= 95 ? "text-yellow-400" : "text-red-400"}>
                            {r.slaPerformance}%
                          </span>
                        </span>
                      )}
                      {r.csatScore != null && (
                        <span>
                          CSAT: <span className={r.csatScore >= 4 ? "text-green-400" : r.csatScore >= 3 ? "text-yellow-400" : "text-red-400"}>
                            {r.csatScore}/5
                          </span>
                        </span>
                      )}
                      <span>
                        Open Incidents: <span className={r.openIncidents > 0 ? "text-yellow-400" : "text-green-400"}>
                          {r.openIncidents}
                        </span>
                      </span>
                    </div>

                    {r.keyOutcomes && r.keyOutcomes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {r.keyOutcomes.map((o, i) => (
                          <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{o}</span>
                        ))}
                      </div>
                    )}

                    {r.actionItems && r.actionItems.length > 0 && (
                      <div className="space-y-0.5">
                        {r.actionItems.map((a, i) => (
                          <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                            <MessageSquare className="h-2.5 w-2.5 shrink-0 mt-0.5" />{a}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
