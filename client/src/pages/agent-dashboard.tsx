import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity, Shield, Cpu, HardDrive, Clock, Lock, ShieldCheck,
  CheckCircle2, Bug, Box, ScanSearch, Wrench, Server, Gauge,
  AlertTriangle, Zap, Radio, Eye, Layers, MonitorSmartphone,
  Timer, Database, Globe, Settings, ArrowLeft, Brain,
  TrendingUp, ShieldAlert, Lightbulb, CalendarClock, Sparkles,
  BarChart3, Target, Mail, FileText, RefreshCw, Code,
  CircleDot, Network, Wifi, Router, Monitor,
} from "lucide-react";
import type {
  ServiceMetric, AgentMetricProfile, AgentOperationalInsights, DiscoveredAsset,
} from "@shared/schema";

type OrgRole = {
  id: string; name: string; title: string; department: string; division: string | null;
  level: string; description: string; responsibilities: string[]; aiCapabilities: string[];
  icon: string; color: string;
};

type EnrichedProfile = AgentMetricProfile & { metric: ServiceMetric | null };

type InsightItem = {
  title: string;
  description: string;
  severity?: string;
  frequency?: string;
  impact?: string;
  category?: string;
  icon?: string;
};

const iconMap: Record<string, typeof Activity> = {
  Activity, Shield, Cpu, HardDrive, Clock, Lock, ShieldCheck,
  CheckCircle2, Bug, Box, ScanSearch, Wrench, Server, Gauge,
  AlertTriangle, Zap, Radio, Eye, Layers, MonitorSmartphone,
  Timer, Database, Globe, Settings, Mail, FileText, RefreshCw, Code,
  TrendingUp, ShieldAlert, Lightbulb, Target, Brain, BarChart3,
  Network, Wifi, Router, Monitor, CircleDot, CalendarClock, Sparkles,
};

const modeConfig: Record<string, { label: string; color: string; textColor: string; borderColor: string; bgGradient: string; icon: typeof Activity; glowColor: string }> = {
  continuous: { label: "Continuous", color: "#22c55e", textColor: "text-emerald-400", borderColor: "border-emerald-500/30", bgGradient: "from-emerald-500/10 to-emerald-500/5", icon: Radio, glowColor: "shadow-emerald-500/10" },
  scheduled: { label: "Scheduled", color: "#3b82f6", textColor: "text-blue-400", borderColor: "border-blue-500/30", bgGradient: "from-blue-500/10 to-blue-500/5", icon: CalendarClock, glowColor: "shadow-blue-500/10" },
  on_demand: { label: "On-Demand", color: "#f59e0b", textColor: "text-amber-400", borderColor: "border-amber-500/30", bgGradient: "from-amber-500/10 to-amber-500/5", icon: Zap, glowColor: "shadow-amber-500/10" },
};

const categoryConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  health: { label: "Health", color: "text-emerald-400", bgColor: "bg-emerald-500/15" },
  security: { label: "Security", color: "text-red-400", bgColor: "bg-red-500/15" },
  performance: { label: "Performance", color: "text-cyan-400", bgColor: "bg-cyan-500/15" },
  compliance: { label: "Compliance", color: "text-purple-400", bgColor: "bg-purple-500/15" },
  availability: { label: "Availability", color: "text-blue-400", bgColor: "bg-blue-500/15" },
};

const priorityConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  critical: { label: "Essential", color: "text-red-400", dotColor: "bg-red-400" },
  recommended: { label: "Suggested", color: "text-blue-400", dotColor: "bg-blue-400" },
  optional: { label: "Optional", color: "text-muted-foreground", dotColor: "bg-muted-foreground" },
};

function RadialProgress({ value, max, size = 80, strokeWidth = 6, color, label }: {
  value: number; max: number; size?: number; strokeWidth?: number; color: string; label: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/20" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold" style={{ color }}>{value}</span>
        </div>
      </div>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
    </div>
  );
}

function MetricRow({ profile, metric }: { profile: EnrichedProfile; metric: ServiceMetric }) {
  const Icon = iconMap[metric.icon] || Activity;
  const pri = priorityConfig[profile.priority] || priorityConfig.recommended;
  const cat = categoryConfig[metric.category] || categoryConfig.health;

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background/50 border border-border/20 hover:border-primary/20 hover:bg-primary/5 transition-all" data-testid={`dashboard-metric-${profile.id}`}>
      <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${cat.bgColor}`}>
        <Icon className={`h-3.5 w-3.5 ${cat.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium truncate">{metric.name}</span>
          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${pri.dotColor}`} />
        </div>
        {profile.reasoning && (
          <p className="text-[9px] text-muted-foreground truncate mt-0.5">{profile.reasoning}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className={`text-[8px] px-1.5 py-0 h-4 border-0 ${cat.bgColor} ${cat.color}`}>{cat.label}</Badge>
        {metric.warningThreshold !== null && metric.warningThreshold !== undefined && (
          <Tooltip>
            <TooltipTrigger>
              <span className="text-[9px] text-amber-400/80 font-mono bg-amber-500/10 px-1 rounded">W:{metric.warningThreshold}{metric.unit === "%" ? "%" : ""}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Warning threshold</TooltipContent>
          </Tooltip>
        )}
        {metric.criticalThreshold !== null && metric.criticalThreshold !== undefined && (
          <Tooltip>
            <TooltipTrigger>
              <span className="text-[9px] text-red-400/80 font-mono bg-red-500/10 px-1 rounded">C:{metric.criticalThreshold}{metric.unit === "%" ? "%" : ""}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Critical threshold</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function InsightPanel({ title, icon: IconComp, iconColor, bgColor, borderColor, glowClass, items }: {
  title: string;
  icon: typeof Activity;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  glowClass: string;
  items: InsightItem[];
}) {
  if (items.length === 0) return null;

  return (
    <Card className={`overflow-hidden border ${borderColor} ${glowClass}`} data-testid={`insight-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className={`px-4 py-3 ${bgColor} border-b ${borderColor}`}>
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-background/60 backdrop-blur`}>
            <IconComp className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-semibold">{title}</h3>
            <p className="text-[9px] text-muted-foreground">{items.length} measure{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>
      <CardContent className="p-3 space-y-2">
        {items.map((item, idx) => {
          const ItemIcon = iconMap[item.icon || ""] || IconComp;
          return (
            <div key={idx} className="group px-3 py-2.5 rounded-lg bg-muted/5 border border-border/15 hover:border-primary/20 hover:bg-primary/5 transition-all" data-testid={`insight-item-${idx}`}>
              <div className="flex items-start gap-2">
                <ItemIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${iconColor} opacity-60`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-medium">{item.title}</span>
                    {item.severity && (
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                        item.severity === "high" || item.severity === "critical" ? "bg-red-500/15 text-red-400" :
                        item.severity === "medium" ? "bg-amber-500/15 text-amber-400" :
                        "bg-blue-500/15 text-blue-400"
                      }`}>{item.severity}</span>
                    )}
                    {item.frequency && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-muted/20 text-muted-foreground">{item.frequency}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function AgentDashboard({ roleId: propRoleId }: { roleId?: string }) {
  const params = useParams<{ roleId: string }>();
  const [, setLocation] = useLocation();
  const roleId = propRoleId || params.roleId;

  const { data: roles, isLoading: rolesLoading } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: metrics } = useQuery<ServiceMetric[]>({ queryKey: ["/api/service-metrics"] });
  const { data: allProfiles } = useQuery<AgentMetricProfile[]>({ queryKey: ["/api/agent-metric-profiles"] });
  const { data: assets } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const { data: insights, isError: insightsError } = useQuery<AgentOperationalInsights>({
    queryKey: ["/api/agent-operational-insights", roleId],
    enabled: !!roleId,
  });

  const role = roles?.find(r => r.id === roleId);
  const metricMap = new Map((metrics || []).map(m => [m.id, m]));
  const roleProfiles: EnrichedProfile[] = (allProfiles || [])
    .filter(p => p.roleId === roleId)
    .map(p => ({ ...p, metric: metricMap.get(p.metricId) || null }));

  const agentAssets = (assets || []).filter(a => a.assignedAgentRoleId === roleId);
  const criticalCount = roleProfiles.filter(p => p.priority === "critical").length;
  const recommendedCount = roleProfiles.filter(p => p.priority === "recommended").length;
  const optionalCount = roleProfiles.filter(p => p.priority === "optional").length;
  const totalInsights = ((insights?.predictiveMeasures || []) as InsightItem[]).length +
    ((insights?.preventiveMeasures || []) as InsightItem[]).length +
    ((insights?.prescriptiveMeasures || []) as InsightItem[]).length;

  const predictiveMeasures = (insights?.predictiveMeasures || []) as InsightItem[];
  const preventiveMeasures = (insights?.preventiveMeasures || []) as InsightItem[];
  const prescriptiveMeasures = (insights?.prescriptiveMeasures || []) as InsightItem[];
  const maintenanceActivities = (insights?.maintenanceActivities || []) as InsightItem[];
  const bestPractices = (insights?.bestPractices || []) as InsightItem[];

  if (rolesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => setLocation("/infrastructure/service-metrics")} data-testid="button-back-not-found">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Service Metrics
        </Button>
        <div className="mt-16 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Agent role not found</p>
        </div>
      </div>
    );
  }

  const RoleIcon = iconMap[role.icon] || Activity;

  return (
    <ScrollArea className="h-full">
      <div className="max-w-[1400px] mx-auto">

        <div className="relative overflow-hidden" data-testid="agent-dashboard-header">
          <div className="absolute inset-0 opacity-[0.03]" style={{ background: `radial-gradient(ellipse at 30% 50%, ${role.color}, transparent 70%)` }} />
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${role.color}60, transparent)` }} />

          <div className="px-6 pt-4 pb-6">
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 text-muted-foreground hover:text-foreground -ml-2"
              onClick={() => setLocation("/infrastructure/service-metrics")}
              data-testid="button-back-to-metrics"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Service Metrics
            </Button>

            <div className="flex items-start gap-5">
              <div className="relative">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border-2" style={{
                  backgroundColor: `${role.color}15`,
                  borderColor: `${role.color}30`,
                  boxShadow: `0 0 30px ${role.color}15`,
                }}>
                  <RoleIcon className="h-8 w-8" style={{ color: role.color }} />
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                  <CheckCircle2 className="h-3 w-3 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold gradient-text" data-testid="text-agent-title">{role.title}</h1>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge className="text-[10px] px-2 py-0.5 h-5 border-0" style={{ backgroundColor: `${role.color}20`, color: role.color }}>{role.department}</Badge>
                  {role.division && <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 text-muted-foreground">{role.division}</Badge>}
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 text-muted-foreground capitalize">{role.level}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2 max-w-2xl leading-relaxed" data-testid="text-agent-description">{role.description}</p>

                {role.aiCapabilities && role.aiCapabilities.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <Brain className="h-3 w-3 text-purple-400 shrink-0" />
                    {role.aiCapabilities.slice(0, 5).map((cap, i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{cap}</span>
                    ))}
                    {role.aiCapabilities.length > 5 && (
                      <span className="text-[9px] text-muted-foreground">+{role.aiCapabilities.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>

              <div className="hidden md:flex items-center gap-6 shrink-0 pr-2" data-testid="stats-summary">
                <RadialProgress value={roleProfiles.length} max={Math.max(roleProfiles.length, 20)} color={role.color} label="Metrics" />
                <RadialProgress value={criticalCount} max={Math.max(roleProfiles.length, 1)} color="#ef4444" label="Essential" />
                <RadialProgress value={agentAssets.length} max={Math.max(agentAssets.length, 10)} color="#06b6d4" label="Devices" />
                <RadialProgress value={totalInsights} max={Math.max(totalInsights, 15)} color="#a855f7" label="Insights" />
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden px-6 py-4">
          <div className="grid grid-cols-4 gap-3" data-testid="stats-summary-mobile">
            {[
              { label: "Metrics", value: roleProfiles.length, color: role.color },
              { label: "Essential", value: criticalCount, color: "#ef4444" },
              { label: "Devices", value: agentAssets.length, color: "#06b6d4" },
              { label: "Insights", value: totalInsights, color: "#a855f7" },
            ].map(s => (
              <Card key={s.label} className="border-border/30">
                <CardContent className="p-3 text-center">
                  <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 space-y-6">

          <div data-testid="metrics-by-collection-mode">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
              </div>
              <h2 className="text-sm font-semibold">Monitored Metrics</h2>
              <span className="text-[10px] text-muted-foreground ml-1">by collection mode</span>
              <div className="flex-1" />
              <div className="flex items-center gap-3">
                {["continuous", "scheduled", "on_demand"].map(mode => {
                  const mc = modeConfig[mode];
                  const count = roleProfiles.filter(p => p.metric?.collectionMode === mode).length;
                  return (
                    <div key={mode} className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: mc.color }} />
                      <span className="text-[9px] text-muted-foreground">{mc.label} ({count})</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {roleProfiles.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {["continuous", "scheduled", "on_demand"].map(mode => {
                  const mc = modeConfig[mode];
                  const ModeIcon = mc.icon;
                  const modeProfiles = roleProfiles.filter(p => p.metric?.collectionMode === mode);

                  return (
                    <Card key={mode} className={`overflow-hidden border ${mc.borderColor} ${modeProfiles.length === 0 ? "opacity-40" : ""}`} data-testid={`metrics-mode-${mode}`}>
                      <div className={`px-4 py-3 bg-gradient-to-r ${mc.bgGradient} border-b ${mc.borderColor}`}>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-background/60 backdrop-blur">
                            <ModeIcon className={`h-4 w-4 ${mc.textColor}`} />
                          </div>
                          <div>
                            <h3 className="text-xs font-semibold">{mc.label}</h3>
                            <p className="text-[9px] text-muted-foreground">{modeProfiles.length} metric{modeProfiles.length !== 1 ? "s" : ""}</p>
                          </div>
                          <div className="flex-1" />
                          <span className={`text-lg font-bold ${mc.textColor}`}>{modeProfiles.length}</span>
                        </div>
                      </div>
                      <CardContent className="p-3">
                        {modeProfiles.length > 0 ? (
                          <div className="space-y-1.5">
                            {modeProfiles.map(p => p.metric && <MetricRow key={p.id} profile={p} metric={p.metric} />)}
                          </div>
                        ) : (
                          <div className="py-6 text-center">
                            <ModeIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground/20" />
                            <p className="text-[10px] text-muted-foreground/50">No {mc.label.toLowerCase()} metrics</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-border/40">
                <CardContent className="py-12 text-center">
                  <div className="h-16 w-16 rounded-2xl mx-auto mb-4 bg-primary/5 flex items-center justify-center">
                    <Brain className="h-8 w-8 text-primary/30" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">No metric profile generated yet</p>
                  <p className="text-[11px] text-muted-foreground/60">Generate one from the Agent Profiles tab to see metrics here</p>
                </CardContent>
              </Card>
            )}
          </div>

          {(predictiveMeasures.length > 0 || preventiveMeasures.length > 0 || prescriptiveMeasures.length > 0) && (
            <div data-testid="operational-intelligence">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Brain className="h-3.5 w-3.5 text-purple-400" />
                </div>
                <h2 className="text-sm font-semibold">Operational Intelligence</h2>
                <span className="text-[10px] text-muted-foreground ml-1">AI-powered analysis</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <InsightPanel
                  title="Predictive Measures"
                  icon={TrendingUp}
                  iconColor="text-blue-400"
                  bgColor="bg-gradient-to-r from-blue-500/10 to-blue-500/5"
                  borderColor="border-blue-500/20"
                  glowClass="shadow-lg shadow-blue-500/5"
                  items={predictiveMeasures}
                />
                <InsightPanel
                  title="Preventive Measures"
                  icon={ShieldAlert}
                  iconColor="text-emerald-400"
                  bgColor="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5"
                  borderColor="border-emerald-500/20"
                  glowClass="shadow-lg shadow-emerald-500/5"
                  items={preventiveMeasures}
                />
                <InsightPanel
                  title="Prescriptive Measures"
                  icon={Lightbulb}
                  iconColor="text-amber-400"
                  bgColor="bg-gradient-to-r from-amber-500/10 to-amber-500/5"
                  borderColor="border-amber-500/20"
                  glowClass="shadow-lg shadow-amber-500/5"
                  items={prescriptiveMeasures}
                />
              </div>
            </div>
          )}

          {(maintenanceActivities.length > 0 || bestPractices.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {maintenanceActivities.length > 0 && (
                <div data-testid="maintenance-activities">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-7 w-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                      <Wrench className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <h2 className="text-sm font-semibold">Maintenance Schedule</h2>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-cyan-400 border-cyan-500/30">{maintenanceActivities.length}</Badge>
                  </div>
                  <Card className="border-cyan-500/15 overflow-hidden">
                    <div className="h-[2px] bg-gradient-to-r from-cyan-500/60 via-cyan-400/40 to-transparent" />
                    <CardContent className="p-3 space-y-2">
                      {maintenanceActivities.map((item, idx) => {
                        const ItemIcon = iconMap[item.icon || ""] || CalendarClock;
                        return (
                          <div key={idx} className="group flex items-start gap-3 px-3 py-3 rounded-lg bg-muted/5 border border-border/15 hover:border-cyan-500/20 hover:bg-cyan-500/5 transition-all" data-testid={`maintenance-item-${idx}`}>
                            <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <ItemIcon className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-semibold">{item.title}</span>
                                {item.frequency && (
                                  <span className="text-[8px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">{item.frequency}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              )}

              {bestPractices.length > 0 && (
                <div data-testid="best-practices">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Target className="h-3.5 w-3.5 text-green-400" />
                    </div>
                    <h2 className="text-sm font-semibold">Best Practices</h2>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-green-400 border-green-500/30">{bestPractices.length}</Badge>
                  </div>
                  <Card className="border-green-500/15 overflow-hidden">
                    <div className="h-[2px] bg-gradient-to-r from-green-500/60 via-green-400/40 to-transparent" />
                    <CardContent className="p-3 space-y-2">
                      {bestPractices.map((item, idx) => {
                        const ItemIcon = iconMap[item.icon || ""] || CheckCircle2;
                        return (
                          <div key={idx} className="group flex items-start gap-3 px-3 py-3 rounded-lg bg-muted/5 border border-border/15 hover:border-green-500/20 hover:bg-green-500/5 transition-all" data-testid={`best-practice-${idx}`}>
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <ItemIcon className="h-4 w-4 text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-semibold block">{item.title}</span>
                              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {agentAssets.length > 0 && (
            <div data-testid="assigned-devices">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Server className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                <h2 className="text-sm font-semibold">Assigned Devices</h2>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{agentAssets.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agentAssets.map(asset => {
                  const meta = (asset.metadata || {}) as Record<string, any>;
                  const sUtil = meta.systemUtilization as { cpu?: number; memory?: number; disk?: number } | undefined;
                  const isOnline = asset.status === "online";
                  return (
                    <Card key={asset.id} className={`overflow-hidden border ${isOnline ? "border-emerald-500/20" : "border-border/30"} agent-card-hover`} data-testid={`device-${asset.id}`}>
                      <div className={`h-[2px] ${isOnline ? "bg-gradient-to-r from-emerald-500/60 via-emerald-400/40 to-transparent" : "bg-muted/30"}`} />
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isOnline ? "bg-emerald-500/10" : "bg-muted/20"}`}>
                            <Server className={`h-4 w-4 ${isOnline ? "text-emerald-400" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-semibold block truncate">{asset.name}</span>
                            <span className="text-[9px] text-muted-foreground">{asset.ipAddress}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/40"}`} />
                            <span className={`text-[9px] font-medium ${isOnline ? "text-emerald-400" : "text-muted-foreground"}`}>{asset.status}</span>
                          </div>
                        </div>
                        {sUtil && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                            {[
                              { label: "CPU", value: sUtil.cpu, warn: 70, crit: 90 },
                              { label: "MEM", value: sUtil.memory, warn: 80, crit: 95 },
                              { label: "DISK", value: sUtil.disk, warn: 80, crit: 90 },
                            ].map(g => {
                              const v = g.value ?? 0;
                              const color = v >= (g.crit || 90) ? "bg-red-500" : v >= (g.warn || 70) ? "bg-amber-500" : "bg-emerald-500";
                              const textColor = v >= (g.crit || 90) ? "text-red-400" : v >= (g.warn || 70) ? "text-amber-400" : "text-emerald-400";
                              return (
                                <div key={g.label} className="text-center">
                                  <div className="text-[8px] text-muted-foreground uppercase tracking-wider">{g.label}</div>
                                  <div className={`text-[11px] font-bold ${textColor}`}>{Math.round(v)}%</div>
                                  <div className="h-1 rounded-full bg-muted/20 mt-1 overflow-hidden">
                                    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(100, v)}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {insightsError ? (
            <Card className="border-amber-500/20" data-testid="insights-error">
              <CardContent className="py-12 text-center">
                <div className="h-14 w-14 rounded-2xl mx-auto mb-4 bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-7 w-7 text-amber-400/60" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Failed to load operational insights</p>
                <p className="text-[11px] text-muted-foreground/60">There was an error fetching insights. Please try again later.</p>
              </CardContent>
            </Card>
          ) : predictiveMeasures.length === 0 && preventiveMeasures.length === 0 && prescriptiveMeasures.length === 0 && maintenanceActivities.length === 0 && bestPractices.length === 0 && (
            <Card className="border-dashed border-border/40" data-testid="no-insights-placeholder">
              <CardContent className="py-12 text-center">
                <div className="h-16 w-16 rounded-2xl mx-auto mb-4 bg-purple-500/5 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-purple-400/30" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">No operational insights generated yet</p>
                <p className="text-[11px] text-muted-foreground/60">Insights will be auto-generated when an agent profile is created</p>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </ScrollArea>
  );
}
