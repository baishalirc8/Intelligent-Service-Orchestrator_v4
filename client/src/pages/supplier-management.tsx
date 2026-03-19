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
  Handshake, AlertTriangle, CheckCircle, RefreshCw, Sparkles,
  FileText, Calendar, ShieldAlert, Users, TrendingUp,
} from "lucide-react";

interface Supplier {
  id: number;
  name: string;
  category: string;
  contactName?: string;
  contactEmail?: string;
  riskTier: string;
  status: string;
  country?: string;
  services?: string[];
  notes?: string;
}

interface SupplierContract {
  id: number;
  supplierId?: number;
  name: string;
  contractType: string;
  status: string;
  startDate?: string;
  endDate?: string;
  contractValue?: number;
  currency?: string;
  slaUptimeTarget?: number;
  actualUptime?: number;
  renewalNoticeDays?: number;
  autoRenews?: boolean;
  services?: string[];
  owner?: string;
}

interface AiAnalysis {
  summary: string;
  portfolioRisk: "critical" | "high" | "medium" | "low";
  contractAlerts: { contractName: string; supplier: string; daysUntilExpiry: number; value: number; urgency: "immediate" | "urgent" | "normal"; recommendation: string }[];
  underperformingSuppliers: { supplier: string; issue: string; slaTarget: number; actual: number; recommendation: string }[];
  riskConcentration: { risk: string; mitigation: string }[];
  recommendations: { id: string; title: string; rationale: string; priority: "high" | "medium" | "low" }[];
}

const riskBg: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/30",
  high:     "bg-orange-500/10 border-orange-500/30",
  medium:   "bg-yellow-500/10 border-yellow-500/30",
  low:      "bg-green-500/10 border-green-500/30",
};
const riskText: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-yellow-400",
  low:      "text-green-400",
};
const urgencyBadge: Record<string, string> = {
  immediate: "bg-red-500/20 text-red-400",
  urgent:    "bg-yellow-500/20 text-yellow-400",
  normal:    "bg-blue-500/20 text-blue-400",
};
const priorityBadge: Record<string, string> = {
  high:   "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low:    "bg-blue-500/20 text-blue-400",
};

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`;
}
function daysUntil(dateStr?: string) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function SupplierManagement() {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/supplier-management/suppliers"],
  });
  const { data: contracts = [], isLoading: loadingContracts } = useQuery<SupplierContract[]>({
    queryKey: ["/api/supplier-management/contracts"],
  });

  const analysisMutation = useMutation({
    mutationFn: async (args: { suppliers: Supplier[]; contracts: SupplierContract[] }) => {
      const r = await apiRequest("POST", "/api/supplier-management/ai-analysis", args);
      return r.json();
    },
    onSuccess: (data) => { setAnalysis(data); setAnalysisError(null); },
    onError: (e: Error) => setAnalysisError(e.message),
  });

  useEffect(() => {
    if (suppliers.length > 0 && contracts.length > 0 && !analysis && !analysisMutation.isPending) {
      analysisMutation.mutate({ suppliers, contracts });
    }
  }, [suppliers, contracts]);

  const isLoading = loadingSuppliers || loadingContracts;
  const expiringContracts = contracts.filter((c) => { const d = daysUntil(c.endDate); return d !== null && d <= 90 && d > 0; });
  const totalContractValue = contracts.reduce((s, c) => s + (c.contractValue ?? 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Handshake className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <span className="truncate">Supplier Management</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 line-clamp-2">
            ITIL 4 — Vendor relationships, contracts, SLA performance &amp; risk across {suppliers.length} suppliers
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => analysisMutation.mutate({ suppliers, contracts })}
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
          { label: "Total Suppliers",    value: suppliers.length,                                                     icon: Users,      color: "text-blue-500" },
          { label: "Active Contracts",   value: contracts.filter((c) => c.status === "active").length,                icon: FileText,   color: "text-purple-500" },
          { label: "Expiring in 90d",    value: expiringContracts.length,                                             icon: Calendar,   color: expiringContracts.length > 0 ? "text-yellow-500" : "text-green-500" },
          { label: "Portfolio Value",    value: fmt(totalContractValue),                                              icon: TrendingUp, color: "text-green-500" },
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
      <Card className={`border ${analysis ? (riskBg[analysis.portfolioRisk] ?? "border-border") : "border-border"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            AI Supplier Portfolio Analysis
            {analysis && (
              <Badge className={`text-[10px] ${riskText[analysis.portfolioRisk]}`} variant="outline">
                {analysis.portfolioRisk.toUpperCase()} RISK
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

              {analysis.contractAlerts?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Contract Renewal Alerts</p>
                  {analysis.contractAlerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`alert-contract-${i}`}>
                      <Calendar className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{a.contractName} <span className="text-muted-foreground font-normal">({a.supplier})</span></p>
                        <p className="text-muted-foreground">{a.recommendation}</p>
                        <p className="text-yellow-400 mt-0.5">{a.daysUntilExpiry}d remaining · {fmt(a.value)}</p>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${urgencyBadge[a.urgency]}`}>{a.urgency}</Badge>
                    </div>
                  ))}
                </div>
              )}

              {analysis.underperformingSuppliers?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">SLA Underperformers</p>
                  {analysis.underperformingSuppliers.map((u, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`alert-sla-${i}`}>
                      <ShieldAlert className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{u.supplier}</p>
                        <p className="text-muted-foreground">{u.issue}</p>
                        <p className="mt-0.5">
                          Target: <span className="text-muted-foreground">{u.slaTarget}%</span>
                          {" · "}Actual: <span className="text-red-400">{u.actual}%</span>
                        </p>
                        <p className="text-green-400">{u.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analysis.recommendations?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Recommendations</p>
                  {analysis.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2 bg-background/50 p-2 rounded text-xs" data-testid={`rec-supplier-${i}`}>
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
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

      {/* Tabs: Suppliers / Contracts */}
      <Tabs defaultValue="suppliers">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="suppliers" className="flex-1 sm:flex-none text-xs sm:text-sm" data-testid="tab-suppliers">
            Suppliers ({suppliers.length})
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex-1 sm:flex-none text-xs sm:text-sm" data-testid="tab-contracts">
            Contracts ({contracts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="border-b border-border">
                        {["Name", "Category", "Country", "Contact", "Services", "Risk Tier", "Status"].map((h) => (
                          <th key={h} className="p-3 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.map((s) => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-supplier-${s.id}`}>
                          <td className="p-3 font-medium whitespace-nowrap">{s.name}</td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{s.category}</td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{s.country ?? "—"}</td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{s.contactName ?? "—"}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {(s.services ?? []).slice(0, 2).map((sv, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] whitespace-nowrap">{sv}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <Badge className={`text-[10px] ${riskText[s.riskTier?.toLowerCase()] ?? ""}`} variant="outline">
                              {s.riskTier}
                            </Badge>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <Badge variant={s.status === "active" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[680px]">
                    <thead>
                      <tr className="border-b border-border">
                        {["Contract", "Type", "Value", "Expires", "SLA Target", "Actual Uptime", "Status"].map((h) => (
                          <th key={h} className="p-3 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contracts.map((c) => {
                        const days = daysUntil(c.endDate);
                        const slaBreach = c.slaUptimeTarget != null && c.actualUptime != null && c.actualUptime < c.slaUptimeTarget;
                        return (
                          <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`row-contract-${c.id}`}>
                            <td className="p-3 font-medium whitespace-nowrap">{c.name}</td>
                            <td className="p-3 whitespace-nowrap"><Badge variant="outline" className="text-[10px]">{c.contractType}</Badge></td>
                            <td className="p-3 font-mono whitespace-nowrap">{c.contractValue ? fmt(c.contractValue) : "—"}</td>
                            <td className={`p-3 whitespace-nowrap ${days !== null && days <= 30 ? "text-red-400" : days !== null && days <= 90 ? "text-yellow-400" : "text-muted-foreground"}`}>
                              {c.endDate ?? "—"} {days !== null && `(${days}d)`}
                            </td>
                            <td className="p-3 whitespace-nowrap">{c.slaUptimeTarget != null ? `${c.slaUptimeTarget}%` : "—"}</td>
                            <td className={`p-3 whitespace-nowrap ${slaBreach ? "text-red-400" : "text-green-400"}`}>
                              {c.actualUptime != null ? `${c.actualUptime}%` : "—"}
                              {slaBreach && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
