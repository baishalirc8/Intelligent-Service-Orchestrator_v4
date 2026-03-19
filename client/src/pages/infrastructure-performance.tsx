import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Server, Activity, Cpu, HardDrive, Clock, Zap,
  Shield, Network, Wifi, Router, Monitor, Database,
  AlertTriangle, CheckCircle2, XCircle, Eye,
  ChevronDown, ChevronUp, Search, TrendingUp, TrendingDown,
  Globe, ThermometerSun, Gauge, BarChart3,
  Bot, Loader2, ShieldCheck, ArrowUpRight, CircleDot,
  FileText, Wrench, Target, BrainCircuit,
} from "lucide-react";
import type { DiscoveredAsset, MonitoredApplication, DeviceMetric, AgentAlert, NetworkDevice, OrgRole } from "@shared/schema";

type AssetCategory = "all" | "network" | "security" | "servers" | "databases" | "iot" | "applications";

interface CategoryDef {
  key: AssetCategory;
  label: string;
  icon: typeof Server;
  types: string[];
  description: string;
}

const categories: CategoryDef[] = [
  { key: "all", label: "All Assets", icon: BarChart3, types: [], description: "Fleet overview" },
  { key: "network", label: "Network", icon: Network, types: ["switch", "access_point", "router"], description: "Switches, Routers, APs" },
  { key: "security", label: "Security", icon: Shield, types: ["firewall", "gateway"], description: "Firewalls & Gateways" },
  { key: "servers", label: "Servers", icon: Server, types: ["server"], description: "Windows, Linux, VMs" },
  { key: "databases", label: "Databases", icon: Database, types: ["server"], description: "Database servers" },
  { key: "iot", label: "IoT / OT", icon: ThermometerSun, types: ["iot_sensor", "meter", "hvac", "plc", "camera"], description: "Sensors, PLCs, HVAC" },
  { key: "applications", label: "Services", icon: Globe, types: [], description: "Running services" },
];

const statusConfig: Record<string, { color: string; bg: string; dot: string }> = {
  online: { color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  running: { color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  healthy: { color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  degraded: { color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400" },
  warning: { color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-400" },
  offline: { color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-400" },
  critical: { color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-400" },
  stopped: { color: "text-red-400", bg: "bg-red-500/10", dot: "bg-red-400" },
  unknown: { color: "text-gray-400", bg: "bg-gray-500/10", dot: "bg-gray-400" },
};

const typeIcons: Record<string, typeof Server> = {
  switch: Network, router: Router, access_point: Wifi, firewall: Shield, gateway: Shield,
  server: Server, iot_sensor: ThermometerSun, meter: Gauge, hvac: Monitor, plc: Cpu, camera: Eye,
};

function getStatus(s: string) { return statusConfig[s] || statusConfig.unknown; }

function MetricGauge({ value, max, label, unit, warn, crit, compact }: {
  value: number | null; max?: number; label: string; unit?: string; warn?: number; crit?: number; compact?: boolean;
}) {
  const v = value ?? 0;
  const m = max ?? 100;
  const pct = m > 0 ? Math.min(100, (v / m) * 100) : 0;
  const color = (crit && v >= crit) ? "bg-red-500" : (warn && v >= warn) ? "bg-amber-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = (crit && v >= crit) ? "text-red-400" : (warn && v >= warn) ? "text-amber-400" : pct >= 80 ? "text-amber-400" : "text-emerald-400";

  if (compact) {
    return (
      <div className="flex flex-col gap-0.5" data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`}>
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className={`text-[10px] font-bold ${textColor}`}>{v}{unit || '%'}</span>
        </div>
        <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
          <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1" data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5" className="stroke-muted/15" />
          <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5"
            strokeDasharray={`${pct * 0.975} 100`}
            className={color.replace('bg-', 'stroke-')}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[10px] font-bold ${textColor}`}>{v}<span className="text-[7px]">{unit || '%'}</span></span>
        </div>
      </div>
      <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

function HealthBar({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 80 ? "bg-emerald-500" : s >= 50 ? "bg-amber-500" : "bg-red-500";
  const textColor = s >= 80 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${s}%` }} />
      </div>
      <span className={`text-[11px] font-bold w-8 text-right ${textColor}`}>{s}%</span>
    </div>
  );
}

function KpiStat({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: typeof Server; color: string; sub?: string;
}) {
  return (
    <div className={`rounded-xl border border-border/10 ${color} p-4 flex items-start gap-3`} data-testid={`kpi-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background/30">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
        {sub && <span className="text-[9px] text-muted-foreground/70 mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}

interface RemediationResult {
  rootCause: string;
  impact: string;
  immediateActions: string[];
  preventiveMeasures: string[];
  status: "resolved" | "mitigated" | "escalated";
  statusMessage: string;
  confidenceScore: number;
}

function AlertDetailPanel({ alerts, asset, role }: {
  alerts: AgentAlert[];
  asset: DiscoveredAsset;
  role?: OrgRole;
}) {
  const { toast } = useToast();
  const [remediations, setRemediations] = useState<Record<string, RemediationResult>>({});

  const remediateMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/agent-alerts/${alertId}/remediate`);
      return res.json();
    },
    onSuccess: (data, alertId) => {
      if (data.remediation) {
        setRemediations(prev => ({ ...prev, [alertId]: data.remediation }));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notifications"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] });
      }, 15000);
      toast({
        title: "AI Remediation Complete",
        description: data.remediation?.statusMessage || "Agent has taken action",
      });
    },
    onError: () => {
      toast({ title: "Remediation Failed", description: "Unable to run AI remediation", variant: "destructive" });
    },
  });

  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const otherAlerts = alerts.filter(a => a.severity !== "critical");
  const sortedAlerts = [...criticalAlerts, ...otherAlerts];

  const sevConfig: Record<string, { color: string; bg: string; border: string; icon: typeof AlertTriangle }> = {
    critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle },
    high: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle },
    warning: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle },
    medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: CircleDot },
    low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: CircleDot },
  };

  const getTimeAgo = (date: Date | string | null) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const statusBadge = (status: string) => {
    if (status === "resolved") return <Badge className="text-[8px] h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/20 gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" />Resolved</Badge>;
    if (status === "mitigated") return <Badge className="text-[8px] h-4 bg-blue-500/15 text-blue-400 border-blue-500/20 gap-0.5"><ShieldCheck className="h-2.5 w-2.5" />Mitigated</Badge>;
    return <Badge className="text-[8px] h-4 bg-amber-500/15 text-amber-400 border-amber-500/20 gap-0.5"><ArrowUpRight className="h-2.5 w-2.5" />Escalated</Badge>;
  };

  return (
    <div className="rounded-lg border border-border/10 overflow-hidden">
      <div className="px-3 py-2 border-b border-border/10 flex items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 text-amber-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">Active Alerts</span>
        {criticalAlerts.length > 0 && (
          <Badge className="text-[8px] h-4 bg-red-500/15 text-red-400 border-red-500/20 ml-1">{criticalAlerts.length} critical</Badge>
        )}
        <Badge variant="outline" className="ml-auto text-[8px] h-4 border-border/15">{alerts.length} total</Badge>
      </div>
      <div className="divide-y divide-border/5">
        {sortedAlerts.map(alert => {
          const sev = sevConfig[alert.severity] || sevConfig.medium;
          const SevIcon = sev.icon;
          const remediation = remediations[alert.id];
          const isRemediating = remediateMutation.isPending && remediateMutation.variables === alert.id;

          return (
            <div key={alert.id} className={`p-3 space-y-2 ${alert.severity === "critical" ? "bg-red-500/[0.03]" : ""}`} data-testid={`alert-item-${alert.id}`}>
              <div className="flex items-start gap-2">
                <SevIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${sev.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge className={`text-[7px] h-4 shrink-0 ${sev.bg} ${sev.color} border ${sev.border}`}>{alert.severity}</Badge>
                    <Badge variant="outline" className="text-[7px] h-4 border-border/15">{alert.type.replace(/_/g, ' ')}</Badge>
                    {alert.acknowledged && <Badge className="text-[7px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/15">ACK</Badge>}
                    <span className="text-[9px] text-muted-foreground/60 ml-auto">{getTimeAgo(alert.createdAt)}</span>
                  </div>
                  <p className="text-[11px] font-medium leading-snug">{alert.message}</p>
                </div>
              </div>

              {alert.details && (
                <div className="rounded-lg bg-muted/5 border border-border/10 p-2.5 ml-5" data-testid={`alert-details-${alert.id}`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Details</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-foreground/80" data-testid={`text-alert-details-${alert.id}`}>{alert.details}</p>
                </div>
              )}

              <div className="rounded-lg bg-muted/5 border border-border/10 p-2.5 ml-5" data-testid={`alert-asset-${alert.id}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Server className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Affected Asset</span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="font-medium" data-testid={`text-asset-name-${alert.id}`}>{asset.name}</span>
                  <Badge variant="outline" className="text-[7px] h-3.5 border-border/15">{asset.type}</Badge>
                  <span className="text-muted-foreground" data-testid={`text-asset-ip-${alert.id}`}>{asset.ipAddress}</span>
                  {role && <span className="text-primary/70" data-testid={`text-agent-role-${alert.id}`}>{role.name}</span>}
                </div>
              </div>

              {remediation ? (
                <div className="rounded-lg border border-border/10 overflow-hidden ml-5" data-testid={`remediation-report-${alert.id}`}>
                  <div className="px-2.5 py-2 bg-primary/[0.03] border-b border-border/10 flex items-center gap-1.5">
                    <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">AI Remediation Report</span>
                    {statusBadge(remediation.status)}
                    <div className="ml-auto flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground">Confidence:</span>
                      <span className={`text-[10px] font-bold ${remediation.confidenceScore >= 80 ? "text-emerald-400" : remediation.confidenceScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                        {remediation.confidenceScore}%
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 space-y-2.5">
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Target className="h-3 w-3 text-red-400" />
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Root Cause</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-foreground/80">{remediation.rootCause}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Impact</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-foreground/80">{remediation.impact}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Wrench className="h-3 w-3 text-emerald-400" />
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Actions Taken</span>
                      </div>
                      <div className="space-y-1">
                        {remediation.immediateActions.map((action, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span className="text-[11px] text-foreground/80">{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {remediation.preventiveMeasures.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <ShieldCheck className="h-3 w-3 text-blue-400" />
                          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Preventive Measures</span>
                        </div>
                        <div className="space-y-1">
                          {remediation.preventiveMeasures.map((measure, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <CircleDot className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
                              <span className="text-[11px] text-foreground/80">{measure}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-1 border-t border-border/10">
                      <p className="text-[10px] text-muted-foreground italic">{remediation.statusMessage}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 ml-5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remediateMutation.mutate(alert.id)}
                    disabled={isRemediating}
                    className="h-7 text-[11px] gap-1.5"
                    data-testid={`button-remediate-${alert.id}`}
                  >
                    {isRemediating ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        AI Agent Analyzing...
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3" />
                        AI Auto-Remediate
                      </>
                    )}
                  </Button>
                  {!alert.acknowledged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        apiRequest("PATCH", `/api/agent-alerts/${alert.id}`, { acknowledged: true })
                          .then(() => queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] }));
                      }}
                      className="h-7 text-[11px] gap-1"
                      data-testid={`button-acknowledge-${alert.id}`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Acknowledge
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AnalysisResult {
  rootCause: string;
  impact: string;
  proposedActions: string[];
  preventiveMeasures: string[];
  expectedOutcome: "resolved" | "mitigated" | "escalated";
  rationale: string;
  riskLevel: "low" | "medium" | "high";
  confidenceScore: number;
}

function FleetAlertCommandCenter({ alerts, assets, roles }: {
  alerts: AgentAlert[];
  assets: DiscoveredAsset[];
  roles: OrgRole[];
}) {
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [remediations, setRemediations] = useState<Record<string, RemediationResult>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const analyzedRef = useRef<Set<string>>(new Set());

  const activeAlerts = useMemo(() => alerts.filter(a => !a.resolvedAt && !a.falsePositive), [alerts]);
  const criticalAlerts = activeAlerts.filter(a => a.severity === "critical");
  const highAlerts = activeAlerts.filter(a => a.severity === "high");
  const otherAlerts = activeAlerts.filter(a => a.severity !== "critical" && a.severity !== "high");
  const sortedAlerts = useMemo(() => [...criticalAlerts, ...highAlerts, ...otherAlerts], [criticalAlerts, highAlerts, otherAlerts]);

  const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);
  const roleMap = useMemo(() => new Map(roles.map(r => [r.id, r])), [roles]);

  const [autoRemediating, setAutoRemediating] = useState<Set<string>>(new Set());

  const autoRemediate = useCallback(async (alertId: string) => {
    setAutoRemediating(prev => new Set(prev).add(alertId));
    try {
      const res = await apiRequest("POST", `/api/agent-alerts/${alertId}/remediate`);
      const data = await res.json();
      if (data.remediation) {
        setRemediations(prev => ({ ...prev, [alertId]: data.remediation }));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notifications"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] });
      }, 15000);
    } catch {
    } finally {
      setAutoRemediating(prev => { const next = new Set(prev); next.delete(alertId); return next; });
    }
  }, []);

  const analyzeAlert = useCallback(async (alertId: string, severity?: string) => {
    if (analyzedRef.current.has(alertId)) return;
    analyzedRef.current.add(alertId);
    setAnalyzing(prev => new Set(prev).add(alertId));
    try {
      const res = await apiRequest("POST", `/api/agent-alerts/${alertId}/analyze`);
      const data = await res.json();
      if (data.analysis) {
        setAnalyses(prev => ({ ...prev, [alertId]: data.analysis }));
        if (severity === "medium" || severity === "low" || severity === "warning") {
          autoRemediate(alertId);
        }
      }
    } catch {
      analyzedRef.current.delete(alertId);
    } finally {
      setAnalyzing(prev => { const next = new Set(prev); next.delete(alertId); return next; });
    }
  }, [autoRemediate]);

  useEffect(() => {
    const proactiveAlerts = activeAlerts.filter(a =>
      a.severity === "critical" || a.severity === "high" || a.severity === "medium"
    );
    proactiveAlerts.forEach(alert => {
      if (!analyses[alert.id] && !analyzing.has(alert.id) && !remediations[alert.id]) {
        analyzeAlert(alert.id, alert.severity);
      }
    });
  }, [activeAlerts, analyses, analyzing, remediations, analyzeAlert]);

  const remediateMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const res = await apiRequest("POST", `/api/agent-alerts/${alertId}/remediate`);
      return res.json();
    },
    onSuccess: (data, alertId) => {
      if (data.remediation) {
        setRemediations(prev => ({ ...prev, [alertId]: data.remediation }));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notifications"] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] });
      }, 15000);
      toast({
        title: "Remediation Executed",
        description: data.remediation?.statusMessage || "Agent has completed the approved actions",
      });
    },
    onError: () => {
      toast({ title: "Execution Failed", description: "Unable to execute remediation actions", variant: "destructive" });
    },
  });

  if (activeAlerts.length === 0) return null;

  const sevConfig: Record<string, { color: string; bg: string; border: string; icon: typeof AlertTriangle; cardBorder: string }> = {
    critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle, cardBorder: "border-red-500/30" },
    high: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle, cardBorder: "border-orange-500/20" },
    warning: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle, cardBorder: "border-amber-500/15" },
    medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: CircleDot, cardBorder: "border-border/15" },
    low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: CircleDot, cardBorder: "border-border/10" },
  };

  const getTimeAgo = (date: Date | string | null) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const riskBadge = (risk: string) => {
    if (risk === "low") return <Badge className="text-[8px] h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/20 gap-0.5"><ShieldCheck className="h-2.5 w-2.5" />Low Risk</Badge>;
    if (risk === "medium") return <Badge className="text-[8px] h-4 bg-amber-500/15 text-amber-400 border-amber-500/20 gap-0.5"><AlertTriangle className="h-2.5 w-2.5" />Medium Risk</Badge>;
    return <Badge className="text-[8px] h-4 bg-red-500/15 text-red-400 border-red-500/20 gap-0.5"><XCircle className="h-2.5 w-2.5" />High Risk</Badge>;
  };

  const outcomeBadge = (outcome: string) => {
    if (outcome === "resolved") return <Badge className="text-[8px] h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/20">Will Resolve</Badge>;
    if (outcome === "mitigated") return <Badge className="text-[8px] h-4 bg-blue-500/15 text-blue-400 border-blue-500/20">Will Mitigate</Badge>;
    return <Badge className="text-[8px] h-4 bg-amber-500/15 text-amber-400 border-amber-500/20">Needs Escalation</Badge>;
  };

  const executedStatusBadge = (status: string) => {
    if (status === "resolved") return <Badge className="text-[8px] h-4 bg-emerald-500/15 text-emerald-400 border-emerald-500/20 gap-0.5"><CheckCircle2 className="h-2.5 w-2.5" />Resolved</Badge>;
    if (status === "mitigated") return <Badge className="text-[8px] h-4 bg-blue-500/15 text-blue-400 border-blue-500/20 gap-0.5"><ShieldCheck className="h-2.5 w-2.5" />Mitigated</Badge>;
    return <Badge className="text-[8px] h-4 bg-amber-500/15 text-amber-400 border-amber-500/20 gap-0.5"><ArrowUpRight className="h-2.5 w-2.5" />Escalated</Badge>;
  };

  const analyzingCount = analyzing.size;
  const analyzedCount = Object.keys(analyses).length + Object.keys(remediations).length;

  return (
    <div className="rounded-xl border border-border/15 overflow-hidden bg-gradient-to-b from-red-500/[0.02] to-transparent" data-testid="fleet-alert-command-center">
      <div className="px-4 py-3 border-b border-border/10 flex items-center gap-2 bg-red-500/[0.03]">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
          <BrainCircuit className="h-4 w-4 text-red-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">AI Agent Alert Center</span>
            {criticalAlerts.length > 0 && (
              <Badge className="text-[8px] h-4 bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">{criticalAlerts.length} critical</Badge>
            )}
            {highAlerts.length > 0 && (
              <Badge className="text-[8px] h-4 bg-orange-500/15 text-orange-400 border-orange-500/20">{highAlerts.length} high</Badge>
            )}
            {analyzingCount > 0 && (
              <Badge className="text-[8px] h-4 bg-primary/10 text-primary border-primary/15 gap-0.5 animate-pulse" data-testid="badge-analyzing">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />Analyzing {analyzingCount} alert{analyzingCount !== 1 ? "s" : ""}...
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground" data-testid="text-alert-summary">
            {activeAlerts.length} active alert{activeAlerts.length !== 1 ? "s" : ""} — AI agents are proactively analyzing threats and proposing remediation actions for your approval
          </p>
        </div>
        <Badge variant="outline" className="text-[9px] h-5 border-border/15 px-2">{activeAlerts.length} total</Badge>
      </div>

      <div className="divide-y divide-border/5">
        {sortedAlerts.map(alert => {
          const sev = sevConfig[alert.severity] || sevConfig.medium;
          const SevIcon = sev.icon;
          const analysis = analyses[alert.id];
          const remediation = remediations[alert.id];
          const isAnalyzing = analyzing.has(alert.id);
          const isRemediating = remediateMutation.isPending && remediateMutation.variables === alert.id;
          const isAutoRemediating = autoRemediating.has(alert.id);
          const targetAsset = alert.deviceId ? assetMap.get(alert.deviceId) : undefined;
          const assignedRole = targetAsset?.assignedAgentRoleId ? roleMap.get(targetAsset.assignedAgentRoleId) : undefined;
          const isDismissed = dismissed.has(alert.id);
          const isAutoResolvable = alert.severity === "medium" || alert.severity === "low" || alert.severity === "warning";

          return (
            <div key={alert.id} className={`transition-all ${alert.severity === "critical" ? "bg-red-500/[0.02]" : ""}`} data-testid={`fleet-alert-${alert.id}`}>
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${sev.bg} shrink-0 mt-0.5`}>
                    <SevIcon className={`h-4 w-4 ${sev.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`text-[8px] h-4 ${sev.bg} ${sev.color} border ${sev.border} font-bold uppercase`}>{alert.severity}</Badge>
                      <Badge variant="outline" className="text-[8px] h-4 border-border/15">{alert.type.replace(/_/g, ' ')}</Badge>
                      {alert.acknowledged && <Badge className="text-[8px] h-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/15">ACK</Badge>}
                      {targetAsset && (
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Server className="h-3 w-3" />
                          <span className="font-medium text-foreground/70" data-testid={`text-fleet-asset-name-${alert.id}`}>{targetAsset.name}</span>
                          <span className="text-muted-foreground/40" data-testid={`text-fleet-asset-ip-${alert.id}`}>({targetAsset.ipAddress})</span>
                        </div>
                      )}
                      {assignedRole && (
                        <Badge className="text-[8px] h-4 bg-primary/10 text-primary/80 border-primary/15 gap-0.5" data-testid={`text-fleet-agent-role-${alert.id}`}>
                          <Bot className="h-2.5 w-2.5" />{assignedRole.name}
                        </Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground/50 ml-auto shrink-0">{getTimeAgo(alert.createdAt)}</span>
                    </div>
                    <p className="text-[12px] font-medium leading-snug mb-1" data-testid={`text-alert-message-${alert.id}`}>{alert.message}</p>

                    {alert.details && (
                      <p className="text-[11px] leading-relaxed text-muted-foreground mb-2" data-testid={`text-alert-details-${alert.id}`}>{alert.details}</p>
                    )}

                    {remediation ? (
                      <div className={`rounded-lg border ${sev.cardBorder} overflow-hidden mt-2`} data-testid={`remediation-report-${alert.id}`}>
                        <div className="px-3 py-2 bg-emerald-500/[0.03] border-b border-border/10 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Remediation Executed</span>
                          {executedStatusBadge(remediation.status)}
                          <div className="ml-auto flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground">Confidence:</span>
                            <span className={`text-[10px] font-bold ${remediation.confidenceScore >= 80 ? "text-emerald-400" : remediation.confidenceScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                              {remediation.confidenceScore}%
                            </span>
                          </div>
                        </div>
                        <div className="p-3 space-y-2">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Wrench className="h-3 w-3 text-emerald-400" />
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Actions Completed</span>
                            </div>
                            <div className="space-y-1">
                              {remediation.immediateActions.map((action, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                                  <span className="text-[11px] text-foreground/80">{action}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="pt-1 border-t border-border/10">
                            <p className="text-[10px] text-muted-foreground italic">{remediation.statusMessage}</p>
                          </div>
                        </div>
                      </div>
                    ) : isAutoRemediating ? (
                      <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 mt-2 flex items-center gap-3" data-testid={`auto-remediating-${alert.id}`}>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <div>
                          <p className="text-[11px] font-medium text-primary">AI Agent is autonomously resolving this alert...</p>
                          <p className="text-[10px] text-muted-foreground">
                            {assignedRole ? `${assignedRole.name} is ` : "Agent is "}executing remediation actions — no approval needed for {alert.severity} severity
                          </p>
                        </div>
                      </div>
                    ) : analysis && !isDismissed ? (
                      <div className={`rounded-lg border ${sev.cardBorder} overflow-hidden mt-2`} data-testid={`analysis-proposal-${alert.id}`}>
                        <div className="px-3 py-2 bg-primary/[0.03] border-b border-border/10 flex items-center gap-1.5 flex-wrap">
                          <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">{isAutoResolvable ? "AI Agent Auto-Resolving" : "AI Agent Proposed Action Plan"}</span>
                          {riskBadge(analysis.riskLevel)}
                          {outcomeBadge(analysis.expectedOutcome)}
                          <div className="ml-auto flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground">Confidence:</span>
                            <span className={`text-[10px] font-bold ${analysis.confidenceScore >= 80 ? "text-emerald-400" : analysis.confidenceScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                              {analysis.confidenceScore}%
                            </span>
                          </div>
                        </div>
                        <div className="p-3 space-y-2.5">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Target className="h-3 w-3 text-red-400" />
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Root Cause Analysis</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-foreground/80" data-testid={`text-root-cause-${alert.id}`}>{analysis.rootCause}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <AlertTriangle className="h-3 w-3 text-amber-400" />
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Impact Assessment</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-foreground/80" data-testid={`text-impact-${alert.id}`}>{analysis.impact}</p>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Wrench className="h-3 w-3 text-primary" />
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Proposed Corrective Actions</span>
                            </div>
                            <div className="space-y-1">
                              {analysis.proposedActions.map((action, i) => (
                                <div key={i} className="flex items-start gap-1.5" data-testid={`text-proposed-action-${alert.id}-${i}`}>
                                  <CircleDot className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                                  <span className="text-[11px] text-foreground/80">{action}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {analysis.preventiveMeasures.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <ShieldCheck className="h-3 w-3 text-blue-400" />
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Preventive Measures</span>
                              </div>
                              <div className="space-y-1">
                                {analysis.preventiveMeasures.map((measure, i) => (
                                  <div key={i} className="flex items-start gap-1.5">
                                    <CircleDot className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
                                    <span className="text-[11px] text-foreground/80">{measure}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="rounded-lg bg-muted/5 border border-border/10 p-2">
                            <p className="text-[10px] text-muted-foreground italic" data-testid={`text-rationale-${alert.id}`}>{analysis.rationale}</p>
                          </div>
                          <div className="flex items-center gap-2 pt-1 border-t border-border/10">
                            {isAutoResolvable ? (
                              <div className="flex items-center gap-2 py-1">
                                {isAutoRemediating ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                    <span className="text-[11px] font-medium text-primary">Autonomously resolving...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-[11px] font-medium text-emerald-400">Auto-resolution in progress</span>
                                  </>
                                )}
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant={alert.severity === "critical" ? "destructive" : "default"}
                                onClick={() => remediateMutation.mutate(alert.id)}
                                disabled={isRemediating}
                                className="h-8 text-[11px] gap-1.5"
                                data-testid={`button-approve-${alert.id}`}
                              >
                                {isRemediating ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Executing Actions...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Approve & Execute
                                  </>
                                )}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDismissed(prev => new Set(prev).add(alert.id))}
                              className="h-8 text-[11px] gap-1"
                              data-testid={`button-dismiss-${alert.id}`}
                            >
                              <XCircle className="h-3 w-3" />
                              Dismiss
                            </Button>
                            {!alert.acknowledged && !isAutoResolvable && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  apiRequest("PATCH", `/api/agent-alerts/${alert.id}`, { acknowledged: true })
                                    .then(() => queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] }));
                                }}
                                className="h-8 text-[11px] gap-1"
                                data-testid={`button-acknowledge-${alert.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Acknowledge Only
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : isAnalyzing ? (
                      <div className="rounded-lg border border-primary/15 bg-primary/[0.02] p-3 mt-2 flex items-center gap-3" data-testid={`analyzing-${alert.id}`}>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <div>
                          <p className="text-[11px] font-medium text-primary">AI Agent is analyzing this alert...</p>
                          <p className="text-[10px] text-muted-foreground">
                            {assignedRole ? `${assignedRole.name} is ` : "Agent is "}
                            {isAutoResolvable
                              ? "evaluating root cause and will autonomously resolve this alert"
                              : "evaluating root cause and preparing a remediation plan for your approval"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { analyzedRef.current.delete(alert.id); analyzeAlert(alert.id); }}
                          className="h-8 text-[11px] gap-1.5"
                          data-testid={`button-analyze-${alert.id}`}
                        >
                          <Bot className="h-3.5 w-3.5" />
                          Request AI Analysis
                        </Button>
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              apiRequest("PATCH", `/api/agent-alerts/${alert.id}`, { acknowledged: true })
                                .then(() => queryClient.invalidateQueries({ queryKey: ["/api/agent-alerts"] }));
                            }}
                            className="h-8 text-[11px] gap-1"
                            data-testid={`button-acknowledge-${alert.id}`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssetPerformanceCard({ asset, services, metrics, alerts, roles, expanded, onToggle }: {
  asset: DiscoveredAsset; services: MonitoredApplication[]; metrics: DeviceMetric[];
  alerts: AgentAlert[]; roles: OrgRole[]; expanded: boolean; onToggle: () => void;
}) {
  const st = getStatus(asset.status);
  const Icon = typeIcons[asset.type] || Server;
  const activeAlerts = alerts.filter(a => !a.resolvedAt && !a.falsePositive);
  const critAlerts = activeAlerts.filter(a => a.severity === "critical").length;
  const role = roles.find(r => r.id === asset.assignedAgentRoleId);

  const avgCpu = services.length > 0 ? Math.round(services.reduce((s, svc) => s + (svc.cpuUsage ?? 0), 0) / services.length) : null;
  const avgMem = services.length > 0 ? Math.round(services.reduce((s, svc) => s + (svc.memoryUsage ?? 0), 0) / services.length) : null;
  const avgHealth = services.length > 0 ? Math.round(services.reduce((s, svc) => s + (svc.healthScore ?? 0), 0) / services.length) : null;
  const avgResp = services.length > 0 ? Math.round(services.reduce((s, svc) => s + (svc.responseTime ?? 0), 0) / services.length * 10) / 10 : null;
  const avgUptime = services.length > 0 ? Math.round(services.reduce((s, svc) => s + (svc.uptime ?? 0), 0) / services.length * 10) / 10 : null;

  const runningServices = services.filter(s => s.status === "running").length;
  const degradedServices = services.filter(s => s.status === "degraded").length;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        expanded ? "border-primary/20 bg-primary/[0.02] shadow-[0_0_20px_-4px_hsl(var(--primary)/0.08)]" : "border-border/10 hover:border-border/20"
      }`}
      data-testid={`asset-card-${asset.id}`}
    >
      <button onClick={onToggle} className="w-full text-left p-4" data-testid={`button-expand-${asset.id}`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${st.bg} shrink-0`}>
            <Icon className={`h-5 w-5 ${st.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold truncate">{asset.name}</span>
              <div className={`h-2 w-2 rounded-full ${st.dot}`} />
              <Badge variant="outline" className="text-[8px] h-4 border-border/15">{asset.type}</Badge>
              {critAlerts > 0 && (
                <Badge className="text-[8px] h-4 bg-red-500/15 text-red-400 border-red-500/20 gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />{critAlerts}
                </Badge>
              )}
              {activeAlerts.length > 0 && critAlerts === 0 && (
                <Badge className="text-[8px] h-4 bg-amber-500/15 text-amber-400 border-amber-500/20 gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />{activeAlerts.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>{asset.vendor} {asset.model}</span>
              <span className="text-muted-foreground/40">|</span>
              <span>{asset.ipAddress}</span>
              {role && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="text-primary/70">{role.name}</span>
                </>
              )}
              <span className="text-muted-foreground/40">|</span>
              <span>{services.length} services ({runningServices} up{degradedServices > 0 ? `, ${degradedServices} degraded` : ""})</span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {avgCpu !== null && <MetricGauge value={avgCpu} label="CPU" warn={70} crit={90} />}
            {avgMem !== null && <MetricGauge value={avgMem} label="MEM" warn={75} crit={90} />}
            {avgHealth !== null && <MetricGauge value={avgHealth} label="Health" />}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground/60" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/60" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/10 px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="rounded-lg bg-muted/5 border border-border/5 p-2.5 text-center">
              <span className="text-lg font-bold text-emerald-400">{avgCpu ?? "—"}<span className="text-[9px] text-muted-foreground/40">%</span></span>
              <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mt-0.5">Avg CPU</p>
            </div>
            <div className="rounded-lg bg-muted/5 border border-border/5 p-2.5 text-center">
              <span className="text-lg font-bold text-blue-400">{avgMem ?? "—"}<span className="text-[9px] text-muted-foreground/40">%</span></span>
              <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mt-0.5">Avg Memory</p>
            </div>
            <div className="rounded-lg bg-muted/5 border border-border/5 p-2.5 text-center">
              <span className="text-lg font-bold text-purple-400">{avgResp ?? "—"}<span className="text-[9px] text-muted-foreground/40">ms</span></span>
              <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mt-0.5">Avg Response</p>
            </div>
            <div className="rounded-lg bg-muted/5 border border-border/5 p-2.5 text-center">
              <span className="text-lg font-bold text-cyan-400">{avgUptime ?? "—"}<span className="text-[9px] text-muted-foreground/40">%</span></span>
              <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mt-0.5">Avg Uptime</p>
            </div>
            <div className="rounded-lg bg-muted/5 border border-border/5 p-2.5 text-center">
              <span className="text-lg font-bold text-amber-400">{activeAlerts.length}</span>
              <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mt-0.5">Active Alerts</p>
            </div>
          </div>

          {services.length > 0 && (
            <div className="rounded-lg border border-border/10 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/5 flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-primary/50" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Service Performance</span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border/5 text-muted-foreground/40">
                    <th className="text-left py-1.5 px-3 font-medium">Service</th>
                    <th className="text-center py-1.5 px-2 font-medium">Status</th>
                    <th className="text-right py-1.5 px-2 font-medium">CPU</th>
                    <th className="text-right py-1.5 px-2 font-medium">Memory</th>
                    <th className="text-right py-1.5 px-2 font-medium">Response</th>
                    <th className="text-right py-1.5 px-2 font-medium">Uptime</th>
                    <th className="py-1.5 px-3 font-medium">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {[...services].sort((a, b) => (a.healthScore ?? 100) - (b.healthScore ?? 100)).map(svc => {
                    const ss = getStatus(svc.status);
                    return (
                      <tr key={svc.id} className="border-b border-border/3 last:border-0 hover:bg-muted/5">
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{svc.name}</span>
                            {svc.version && <span className="text-[9px] text-muted-foreground/30">v{svc.version}</span>}
                            {svc.port && <Badge variant="outline" className="text-[7px] h-3 border-border/10">:{svc.port}</Badge>}
                          </div>
                        </td>
                        <td className="text-center py-1.5 px-2">
                          <Badge className={`text-[8px] h-4 ${ss.bg} ${ss.color}`}>{svc.status}</Badge>
                        </td>
                        <td className="text-right py-1.5 px-2">
                          <span className={svc.cpuUsage && svc.cpuUsage > 80 ? "text-red-400 font-bold" : svc.cpuUsage && svc.cpuUsage > 60 ? "text-amber-400" : ""}>{svc.cpuUsage?.toFixed(1) ?? "—"}%</span>
                        </td>
                        <td className="text-right py-1.5 px-2">
                          <span className={svc.memoryUsage && svc.memoryUsage > 80 ? "text-red-400 font-bold" : svc.memoryUsage && svc.memoryUsage > 60 ? "text-amber-400" : ""}>{svc.memoryUsage?.toFixed(1) ?? "—"}%</span>
                        </td>
                        <td className="text-right py-1.5 px-2">
                          <span className={svc.responseTime && svc.responseTime > 50 ? "text-amber-400" : ""}>{svc.responseTime?.toFixed(1) ?? "—"}ms</span>
                        </td>
                        <td className="text-right py-1.5 px-2">
                          {svc.uptime?.toFixed(1) ?? "—"}%
                        </td>
                        <td className="py-1.5 px-3 w-28">
                          <HealthBar score={svc.healthScore} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {metrics.length > 0 && (
            <div className="rounded-lg border border-border/10 overflow-hidden">
              <div className="px-3 py-2 border-b border-border/5 flex items-center gap-1.5">
                <Gauge className="h-3 w-3 text-primary/50" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Device Metrics</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
                {metrics.map(m => (
                  <div key={m.id} className="rounded-lg bg-muted/5 border border-border/5 p-2">
                    <MetricGauge
                      value={m.value}
                      max={m.thresholdCritical ? m.thresholdCritical * 1.2 : 100}
                      label={m.metricName}
                      unit={m.unit === "%" ? "%" : ` ${m.unit}`}
                      warn={m.thresholdWarning ?? undefined}
                      crit={m.thresholdCritical ?? undefined}
                      compact
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeAlerts.length > 0 && (
            <AlertDetailPanel alerts={activeAlerts} asset={asset} role={role} />
          )}
        </div>
      )}
    </div>
  );
}

function ServicePerformanceView({ services, assets, search }: { services: MonitoredApplication[]; assets: DiscoveredAsset[]; search: string }) {
  const [sortBy, setSortBy] = useState<"health" | "cpu" | "memory" | "response">("health");
  const assetMap = useMemo(() => new Map(assets.map(a => [a.id, a])), [assets]);

  const sorted = useMemo(() => {
    let filtered = services;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s => {
        const asset = assetMap.get(s.assetId);
        return s.name.toLowerCase().includes(q) ||
          (asset?.name || "").toLowerCase().includes(q) ||
          (s.category || "").toLowerCase().includes(q) ||
          (s.processName || "").toLowerCase().includes(q);
      });
    }
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "health": return (a.healthScore ?? 100) - (b.healthScore ?? 100);
        case "cpu": return (b.cpuUsage ?? 0) - (a.cpuUsage ?? 0);
        case "memory": return (b.memoryUsage ?? 0) - (a.memoryUsage ?? 0);
        case "response": return (b.responseTime ?? 0) - (a.responseTime ?? 0);
        default: return 0;
      }
    });
  }, [services, sortBy, search, assetMap]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Sort by:</span>
        {(["health", "cpu", "memory", "response"] as const).map(key => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`text-[10px] px-2 py-1 rounded ${sortBy === key ? "bg-primary/10 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
            data-testid={`sort-${key}`}
          >
            {key === "health" ? "Health" : key === "cpu" ? "CPU %" : key === "memory" ? "Memory %" : "Response Time"}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border/10 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border/5 text-muted-foreground/40 bg-muted/3">
              <th className="text-left py-2 px-3 font-medium">Service</th>
              <th className="text-left py-2 px-2 font-medium">Asset</th>
              <th className="text-center py-2 px-2 font-medium">Status</th>
              <th className="text-center py-2 px-2 font-medium">Criticality</th>
              <th className="text-right py-2 px-2 font-medium">CPU</th>
              <th className="text-right py-2 px-2 font-medium">Memory</th>
              <th className="text-right py-2 px-2 font-medium">Response</th>
              <th className="text-right py-2 px-2 font-medium">Uptime</th>
              <th className="py-2 px-3 font-medium w-24">Health</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(svc => {
              const ss = getStatus(svc.status);
              const asset = assetMap.get(svc.assetId);
              const critColors: Record<string, string> = {
                mission_critical: "text-red-400 bg-red-500/10",
                business: "text-amber-400 bg-amber-500/10",
                supporting: "text-blue-400 bg-blue-500/10",
                utility: "text-gray-400 bg-gray-500/10",
              };
              return (
                <tr key={svc.id} className="border-b border-border/3 last:border-0 hover:bg-muted/5">
                  <td className="py-1.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{svc.name}</span>
                      {svc.port && <span className="text-[9px] text-muted-foreground/25">:{svc.port}</span>}
                    </div>
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground/50">{asset?.name || "—"}</td>
                  <td className="text-center py-1.5 px-2">
                    <Badge className={`text-[8px] h-4 ${ss.bg} ${ss.color}`}>{svc.status}</Badge>
                  </td>
                  <td className="text-center py-1.5 px-2">
                    <Badge className={`text-[8px] h-4 ${critColors[svc.criticality ?? ""] || critColors.utility}`}>
                      {svc.criticality === "mission_critical" ? "Critical" : svc.criticality || "—"}
                    </Badge>
                  </td>
                  <td className="text-right py-1.5 px-2">
                    <span className={svc.cpuUsage && svc.cpuUsage > 80 ? "text-red-400 font-bold" : svc.cpuUsage && svc.cpuUsage > 60 ? "text-amber-400" : ""}>{svc.cpuUsage?.toFixed(1) ?? "—"}%</span>
                  </td>
                  <td className="text-right py-1.5 px-2">
                    <span className={svc.memoryUsage && svc.memoryUsage > 80 ? "text-red-400 font-bold" : svc.memoryUsage && svc.memoryUsage > 60 ? "text-amber-400" : ""}>{svc.memoryUsage?.toFixed(1) ?? "—"}%</span>
                  </td>
                  <td className="text-right py-1.5 px-2">
                    <span className={svc.responseTime && svc.responseTime > 50 ? "text-amber-400" : ""}>{svc.responseTime?.toFixed(1) ?? "—"}ms</span>
                  </td>
                  <td className="text-right py-1.5 px-2">{svc.uptime?.toFixed(1) ?? "—"}%</td>
                  <td className="py-1.5 px-3 w-24"><HealthBar score={svc.healthScore} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function CategoryHeatmap({ assets, services }: { assets: DiscoveredAsset[]; services: MonitoredApplication[] }) {
  const assetHealth = useMemo(() => {
    return assets.map(a => {
      const svcs = services.filter(s => s.assetId === a.id);
      const avgHealth = svcs.length > 0 ? Math.round(svcs.reduce((s, svc) => s + (svc.healthScore ?? 0), 0) / svcs.length) : (a.status === "online" ? 85 : a.status === "offline" ? 0 : 50);
      return { asset: a, health: avgHealth, services: svcs.length };
    }).sort((a, b) => a.health - b.health);
  }, [assets, services]);

  return (
    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-14 gap-1" data-testid="asset-heatmap">
      {assetHealth.map(({ asset, health }) => {
        const bg = health >= 90 ? "bg-emerald-500/40" : health >= 75 ? "bg-emerald-500/20" : health >= 50 ? "bg-amber-500/30" : health >= 25 ? "bg-red-500/30" : "bg-red-500/50";
        return (
          <Tooltip key={asset.id}>
            <TooltipTrigger asChild>
              <div className={`aspect-square rounded ${bg} flex items-center justify-center cursor-default transition-all hover:scale-110`} data-testid={`heatmap-${asset.id}`}>
                <span className="text-[7px] font-bold opacity-70">{health}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="font-medium text-xs">{asset.name}</p>
              <p className="text-[10px] text-muted-foreground">{asset.vendor} {asset.model}</p>
              <p className="text-[10px]">Health: {health}% | Status: {asset.status}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export default function InfrastructurePerformance() {
  const [activeCategory, setActiveCategory] = useState<AssetCategory>("all");
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: assets = [], isLoading: assetsLoading } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const { data: services = [], isLoading: servicesLoading } = useQuery<MonitoredApplication[]>({ queryKey: ["/api/monitored-applications"] });
  const { data: networkDevices = [] } = useQuery<NetworkDevice[]>({ queryKey: ["/api/network-devices"] });
  const { data: deviceMetrics = [] } = useQuery<DeviceMetric[]>({ queryKey: ["/api/device-metrics"] });
  const { data: alerts = [] } = useQuery<AgentAlert[]>({ queryKey: ["/api/agent-alerts"] });
  const { data: roles = [] } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });

  const activeAlerts = useMemo(() => alerts.filter(a => !a.resolvedAt && !a.falsePositive), [alerts]);
  const metricsMap = useMemo(() => {
    const m = new Map<string, DeviceMetric[]>();
    deviceMetrics.forEach(dm => {
      const arr = m.get(dm.deviceId) || [];
      arr.push(dm);
      m.set(dm.deviceId, arr);
    });
    return m;
  }, [deviceMetrics]);

  const servicesMap = useMemo(() => {
    const m = new Map<string, MonitoredApplication[]>();
    services.forEach(s => {
      const arr = m.get(s.assetId) || [];
      arr.push(s);
      m.set(s.assetId, arr);
    });
    return m;
  }, [services]);

  const alertsMap = useMemo(() => {
    const m = new Map<string, AgentAlert[]>();
    alerts.forEach(a => {
      if (a.deviceId) {
        const arr = m.get(a.deviceId) || [];
        arr.push(a);
        m.set(a.deviceId, arr);
      }
    });
    return m;
  }, [alerts]);

  const dbAssetIds = useMemo(() => {
    const dbNames = new Set(["DB-SRV-01", "DB-PRIMARY-01"]);
    const dbServiceNames = new Set(["database", "db_server"]);
    return new Set(assets.filter(a => {
      if (dbNames.has(a.name)) return true;
      const svcs = servicesMap.get(a.id) || [];
      return svcs.some(s => s.category === "database" || dbServiceNames.has(s.category ?? ""));
    }).map(a => a.id));
  }, [assets, servicesMap]);

  const filteredAssets = useMemo(() => {
    let result = assets;
    const cat = categories.find(c => c.key === activeCategory);
    if (cat && cat.types.length > 0) {
      if (activeCategory === "databases") {
        result = result.filter(a => dbAssetIds.has(a.id));
      } else {
        result = result.filter(a => cat.types.includes(a.type));
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.vendor?.toLowerCase().includes(q) ||
        a.model?.toLowerCase().includes(q) ||
        a.ipAddress?.toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      const aHealth = getAssetAvgHealth(a);
      const bHealth = getAssetAvgHealth(b);
      return aHealth - bHealth;
    });
  }, [assets, activeCategory, search, dbAssetIds]);

  function getAssetAvgHealth(a: DiscoveredAsset) {
    const svcs = servicesMap.get(a.id) || [];
    if (svcs.length === 0) return a.status === "online" ? 85 : 0;
    return Math.round(svcs.reduce((s, svc) => s + (svc.healthScore ?? 0), 0) / svcs.length);
  }

  const totalAssets = assets.length;
  const onlineAssets = assets.filter(a => a.status === "online").length;
  const totalServices = services.length;
  const runningServices = services.filter(s => s.status === "running").length;
  const degradedServices = services.filter(s => s.status === "degraded").length;
  const avgFleetHealth = services.length > 0 ? Math.round(services.reduce((s, svc) => s + (svc.healthScore ?? 0), 0) / services.length) : 0;
  const critAlertCount = activeAlerts.filter(a => a.severity === "critical").length;

  const isLoading = assetsLoading || servicesLoading;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KpiStat label="Total Assets" value={totalAssets} icon={Server} color="bg-blue-500/5" sub={`${onlineAssets} online`} />
          <KpiStat label="Services" value={totalServices} icon={Activity} color="bg-emerald-500/5" sub={`${runningServices} running`} />
          <KpiStat label="Fleet Health" value={`${avgFleetHealth}%`} icon={TrendingUp} color="bg-purple-500/5" sub={`${degradedServices} degraded`} />
          <KpiStat label="Critical Alerts" value={critAlertCount} icon={AlertTriangle} color="bg-red-500/5" sub={`${activeAlerts.length} total active`} />
          <KpiStat label="Network Devices" value={networkDevices.length} icon={Network} color="bg-cyan-500/5" sub={`${assets.filter(a => ["switch", "router", "access_point"].includes(a.type)).length} discovered`} />
          <KpiStat label="Avg Response" value={`${services.length > 0 ? Math.round(services.reduce((s, svc) => s + (svc.responseTime ?? 0), 0) / services.length * 10) / 10 : 0}ms`} icon={Clock} color="bg-amber-500/5" />
        </div>

        <FleetAlertCommandCenter alerts={alerts} assets={assets} roles={roles} />

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">Fleet Health Heatmap</span>
          </div>
          <CategoryHeatmap assets={assets} services={services} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;
            let count = 0;
            if (cat.key === "all") count = assets.length;
            else if (cat.key === "applications") count = services.length;
            else if (cat.key === "databases") count = dbAssetIds.size;
            else count = assets.filter(a => cat.types.includes(a.type)).length;

            return (
              <button
                key={cat.key}
                onClick={() => { setActiveCategory(cat.key); setExpandedAsset(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 border border-transparent"
                }`}
                data-testid={`category-${cat.key}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
                <Badge variant="outline" className="text-[8px] h-4 border-border/15 ml-1">{count}</Badge>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/30" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search assets by name, vendor, IP..."
              className="pl-9 h-8 text-xs"
              data-testid="input-search-assets"
            />
          </div>
          <Badge variant="outline" className="text-[10px] h-6 border-border/15 px-2" data-testid="text-result-count">
            {activeCategory === "applications" ? `${services.length} services` : `${filteredAssets.length} assets`}
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 rounded-xl bg-muted/5 border border-border/5 animate-pulse" />
            ))}
          </div>
        ) : activeCategory === "applications" ? (
          <ServicePerformanceView services={services} assets={assets} search={search} />
        ) : (
          <div className="space-y-2">
            {filteredAssets.map(asset => (
              <AssetPerformanceCard
                key={asset.id}
                asset={asset}
                services={servicesMap.get(asset.id) || []}
                metrics={metricsMap.get(asset.id) || []}
                alerts={alertsMap.get(asset.id) || []}
                roles={roles}
                expanded={expandedAsset === asset.id}
                onToggle={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
              />
            ))}
            {filteredAssets.length === 0 && (
              <div className="text-center py-12 text-muted-foreground/40">
                <Server className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No assets found matching your criteria</p>
              </div>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
