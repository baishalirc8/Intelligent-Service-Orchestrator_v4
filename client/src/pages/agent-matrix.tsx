import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bot, Target, AlertTriangle, Activity, Clock,
  ArrowUpRight, CheckCircle2, Layers, Brain,
  ShieldAlert, TrendingDown, ArrowLeft, Server,
  Gauge, Eye, Zap, BarChart3, CircleDot,
  Shield, Cpu, Network,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { AgentPerformanceMetric, OrgRole, RoleSubscription, DiscoveredAsset } from "@shared/schema";

function getRiskColor(value: number, inverted = false) {
  if (inverted) {
    if (value < 5) return "text-green-400";
    if (value <= 10) return "text-amber-400";
    return "text-red-400";
  }
  if (value >= 90) return "text-green-400";
  if (value >= 75) return "text-amber-400";
  return "text-red-400";
}

function getRiskBg(value: number, inverted = false) {
  if (inverted) {
    if (value < 5) return "bg-green-500";
    if (value <= 10) return "bg-amber-500";
    return "bg-red-500";
  }
  if (value >= 90) return "bg-green-500";
  if (value >= 75) return "bg-amber-500";
  return "bg-red-500";
}

function getRiskBadgeVariant(value: number, inverted = false): string {
  if (inverted) {
    if (value < 5) return "bg-green-500/10 text-green-400 border-green-500/30";
    if (value <= 10) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-red-500/10 text-red-400 border-red-500/30";
  }
  if (value >= 90) return "bg-green-500/10 text-green-400 border-green-500/30";
  if (value >= 75) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  return "bg-red-500/10 text-red-400 border-red-500/30";
}

function getStatusLabel(value: number, inverted = false): string {
  if (inverted) {
    if (value < 5) return "Healthy";
    if (value <= 10) return "Warning";
    return "Critical";
  }
  if (value >= 90) return "Excellent";
  if (value >= 75) return "Acceptable";
  return "Needs Attention";
}

function MetricBar({ label, value, max = 100, inverted = false, testId }: {
  label: string;
  value: number;
  max?: number;
  inverted?: boolean;
  testId: string;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const color = getRiskColor(value, inverted);
  const bgColor = getRiskBg(value, inverted);

  return (
    <div data-testid={testId}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className={`text-[10px] font-bold ${color}`}>{value.toFixed(1)}%</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${bgColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function DetailGauge({ label, value, icon: Icon, inverted = false, suffix = "%", testId }: {
  label: string;
  value: number;
  icon: any;
  inverted?: boolean;
  suffix?: string;
  testId: string;
}) {
  const color = getRiskColor(value, inverted);
  const badgeStyle = getRiskBadgeVariant(value, inverted);
  const status = getStatusLabel(value, inverted);
  const percentage = Math.min(value, 100);
  const bgColor = getRiskBg(value, inverted);

  return (
    <Card className="glass-panel-strong" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className={`text-3xl font-bold ${color}`}>{value.toFixed(1)}{suffix}</span>
          <Badge className={`text-[9px] mb-1 ${badgeStyle}`} data-testid={`${testId}-status`}>
            {status}
          </Badge>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full transition-all ${bgColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AssetTypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("server") || t.includes("srv")) return <Server className="h-3.5 w-3.5" />;
  if (t.includes("switch") || t.includes("router") || t.includes("ap") || t.includes("wifi")) return <Network className="h-3.5 w-3.5" />;
  if (t.includes("firewall") || t.includes("vpn") || t.includes("waf") || t.includes("ids") || t.includes("nac")) return <Shield className="h-3.5 w-3.5" />;
  if (t.includes("sensor") || t.includes("iot") || t.includes("camera") || t.includes("plc") || t.includes("hvac")) return <Cpu className="h-3.5 w-3.5" />;
  return <CircleDot className="h-3.5 w-3.5" />;
}

function AgentDetailView({ role, metric, agentAssets, onBack }: {
  role: OrgRole;
  metric: AgentPerformanceMetric;
  agentAssets: DiscoveredAsset[];
  onBack: () => void;
}) {
  const tasksSuccessRate = metric.tasksCompleted > 0
    ? ((metric.tasksCompleted - metric.tasksEscalated) / metric.tasksCompleted * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5"
          data-testid="button-back-to-matrix"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Matrix
        </Button>
      </div>

      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
          <Bot className="h-7 w-7 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="detail-agent-name">
            {role.name}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" data-testid="detail-agent-dept">{role.department}</Badge>
            {role.division && (
              <Badge variant="secondary" className="text-[10px]" data-testid="detail-agent-division">
                {role.division}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Period: {metric.metricPeriod}
            </span>
            {metric.lastEvaluatedAt && (
              <span className="text-xs text-muted-foreground" data-testid="detail-last-evaluated">
                Last evaluated: {new Date(metric.lastEvaluatedAt).toLocaleString()}
              </span>
            )}
          </div>
          {role.description && (
            <p className="text-sm text-muted-foreground mt-2" data-testid="detail-agent-description">
              {role.description}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="stat-card-gradient" data-testid="detail-stat-tasks">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tasks Completed</span>
            </div>
            <p className="text-2xl font-bold" data-testid="detail-stat-tasks-value">
              {metric.tasksCompleted.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient" data-testid="detail-stat-escalated">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpRight className="h-4 w-4 text-amber-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tasks Escalated</span>
            </div>
            <p className="text-2xl font-bold" data-testid="detail-stat-escalated-value">
              {metric.tasksEscalated.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient" data-testid="detail-stat-success">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-blue-400" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Success Rate</span>
            </div>
            <p className="text-2xl font-bold" data-testid="detail-stat-success-value">
              {tasksSuccessRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient" data-testid="detail-stat-assets">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Server className="h-4 w-4 text-primary" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Managed Assets</span>
            </div>
            <p className="text-2xl font-bold" data-testid="detail-stat-assets-value">
              {agentAssets.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Performance Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <DetailGauge
            label="Accuracy Score"
            value={metric.accuracyScore}
            icon={Target}
            testId="detail-gauge-accuracy"
          />
          <DetailGauge
            label="Task Completion Rate"
            value={metric.taskCompletionRate}
            icon={CheckCircle2}
            testId="detail-gauge-completion"
          />
          <DetailGauge
            label="Confidence Score"
            value={metric.confidenceScore}
            icon={Eye}
            testId="detail-gauge-confidence"
          />
          <DetailGauge
            label="Hallucination Risk"
            value={metric.hallucinationRisk}
            icon={ShieldAlert}
            inverted
            testId="detail-gauge-hallucination"
          />
          <DetailGauge
            label="Drift Score"
            value={metric.driftScore}
            icon={TrendingDown}
            inverted
            testId="detail-gauge-drift"
          />
          <DetailGauge
            label="Escalation Rate"
            value={metric.escalationRate}
            icon={ArrowUpRight}
            inverted
            testId="detail-gauge-escalation"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="glass-panel-strong" data-testid="detail-response-time-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-muted-foreground font-medium">Average Response Time</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{metric.avgResponseTime.toFixed(1)}</span>
              <span className="text-lg text-muted-foreground mb-0.5">seconds</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {metric.avgResponseTime < 3 ? "Within optimal range" : metric.avgResponseTime < 5 ? "Acceptable latency" : "Above target — may need optimization"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel-strong" data-testid="detail-task-breakdown-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-muted-foreground font-medium">Task Breakdown</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Completed autonomously</span>
                <span className="text-sm font-bold text-green-400">{(metric.tasksCompleted - metric.tasksEscalated).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Escalated to human</span>
                <span className="text-sm font-bold text-amber-400">{metric.tasksEscalated.toLocaleString()}</span>
              </div>
              <Separator className="my-1 opacity-30" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Total processed</span>
                <span className="text-sm font-bold">{metric.tasksCompleted.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(Array.isArray(role.responsibilities) && role.responsibilities.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            Responsibilities & Capabilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="glass-panel-strong" data-testid="detail-responsibilities-card">
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Responsibilities</h3>
                <div className="space-y-1.5">
                  {(role.responsibilities as string[]).map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CircleDot className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <span className="text-xs">{r}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {Array.isArray(role.aiCapabilities) && role.aiCapabilities.length > 0 && (
              <Card className="glass-panel-strong" data-testid="detail-capabilities-card">
                <CardContent className="p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">AI Capabilities</h3>
                  <div className="space-y-1.5">
                    {(role.aiCapabilities as string[]).map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Brain className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" />
                        <span className="text-xs">{c}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {agentAssets.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Managed Assets ({agentAssets.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {agentAssets.map(asset => (
              <Card key={asset.id} className="glass-panel-strong" data-testid={`detail-asset-${asset.id}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <AssetTypeIcon type={asset.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" data-testid={`detail-asset-name-${asset.id}`}>
                        {asset.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[8px]">{asset.type}</Badge>
                        <span className="text-[10px] text-muted-foreground">{asset.ipAddress}</span>
                      </div>
                    </div>
                    <Badge
                      className={`text-[8px] shrink-0 ${asset.status === "online"
                        ? "bg-green-500/10 text-green-400 border-green-500/30"
                        : "bg-red-500/10 text-red-400 border-red-500/30"
                      }`}
                      data-testid={`detail-asset-status-${asset.id}`}
                    >
                      {asset.status}
                    </Badge>
                  </div>
                  {(asset.vendor || asset.model) && (
                    <p className="text-[10px] text-muted-foreground mt-2 pl-11">
                      {[asset.vendor, asset.model].filter(Boolean).join(" ")}
                      {asset.protocol && ` · ${asset.protocol}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {agentAssets.length === 0 && (
        <Card className="glass-panel-strong">
          <CardContent className="p-8 text-center">
            <Server className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-sm font-semibold mb-1">No Directly Managed Assets</h3>
            <p className="text-xs text-muted-foreground">
              This agent operates in a cross-cutting capacity across all infrastructure assets.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AgentMatrix() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: metrics, isLoading: metricsLoading } = useQuery<AgentPerformanceMetric[]>({
    queryKey: ["/api/agent-performance"],
  });
  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });
  const { data: assets } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });

  const aiRoles = useMemo(() => {
    if (!roles || !subscriptions) return [];
    const aiSubs = subscriptions.filter(s => s.hasAiShadow);
    return roles.filter(r => aiSubs.some(s => s.roleId === r.id));
  }, [roles, subscriptions]);

  const assetCountByRole = useMemo(() => {
    if (!assets) return new Map<string, number>();
    const counts = new Map<string, number>();
    for (const asset of assets) {
      if (asset.assignedAgentRoleId) {
        counts.set(asset.assignedAgentRoleId, (counts.get(asset.assignedAgentRoleId) || 0) + 1);
      }
    }
    return counts;
  }, [assets]);

  const assetsByRole = useMemo(() => {
    if (!assets) return new Map<string, DiscoveredAsset[]>();
    const map = new Map<string, DiscoveredAsset[]>();
    for (const asset of assets) {
      if (asset.assignedAgentRoleId) {
        const existing = map.get(asset.assignedAgentRoleId) || [];
        existing.push(asset);
        map.set(asset.assignedAgentRoleId, existing);
      }
    }
    return map;
  }, [assets]);

  const metricsByRole = useMemo(() => {
    if (!metrics) return new Map<string, AgentPerformanceMetric>();
    const map = new Map<string, AgentPerformanceMetric>();
    for (const m of metrics) {
      map.set(m.agentRoleId, m);
    }
    return map;
  }, [metrics]);

  const summaryStats = useMemo(() => {
    if (!metrics || metrics.length === 0) return { avgAccuracy: 0, avgHallucination: 0, agentCount: 0, totalTasks: 0 };
    const avgAccuracy = metrics.reduce((s, m) => s + m.accuracyScore, 0) / metrics.length;
    const avgHallucination = metrics.reduce((s, m) => s + m.hallucinationRisk, 0) / metrics.length;
    const totalTasks = metrics.reduce((s, m) => s + m.tasksCompleted, 0);
    return { avgAccuracy, avgHallucination, agentCount: metrics.length, totalTasks };
  }, [metrics]);

  const selectedRole = selectedAgentId ? aiRoles.find(r => r.id === selectedAgentId) : null;
  const selectedMetric = selectedAgentId ? metricsByRole.get(selectedAgentId) : null;
  const selectedAssets = selectedAgentId ? (assetsByRole.get(selectedAgentId) || []) : [];

  if (metricsLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          <div className="space-y-2">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64" />)}
          </div>
        </div>
      </ScrollArea>
    );
  }

  if (selectedRole && selectedMetric) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 max-w-7xl mx-auto">
          <AgentDetailView
            role={selectedRole}
            metric={selectedMetric}
            agentAssets={selectedAssets}
            onBack={() => setSelectedAgentId(null)}
          />
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div data-testid="page-header">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            AI Agent Observability Matrix
          </h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">
            Monitor AI agent KPIs to prevent hallucinations, drift, and performance degradation
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="stat-card-gradient" data-testid="stat-overall-accuracy">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-green-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Overall Accuracy</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-overall-accuracy-value">
                {summaryStats.avgAccuracy.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">average across all agents</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient" data-testid="stat-hallucination-risk">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Hallucination Risk</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-hallucination-risk-value">
                {summaryStats.avgHallucination.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">average risk score</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient" data-testid="stat-agents-monitored">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Agents Monitored</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-agents-monitored-value">
                {summaryStats.agentCount}
              </p>
              <p className="text-[10px] text-muted-foreground">active AI agents</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient" data-testid="stat-total-tasks">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Tasks</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-total-tasks-value">
                {summaryStats.totalTasks.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">tasks completed</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="agent-matrix-grid">
          {aiRoles.map(role => {
            const metric = metricsByRole.get(role.id);
            const assetCount = assetCountByRole.get(role.id) || 0;

            if (!metric) return null;

            return (
              <Card
                key={role.id}
                className="glass-panel-strong cursor-pointer transition-all hover:ring-1 hover:ring-primary/40 hover:shadow-lg hover:shadow-primary/5"
                data-testid={`agent-card-${role.id}`}
                onClick={() => setSelectedAgentId(role.id)}
              >
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Bot className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold truncate" data-testid={`agent-name-${role.id}`}>
                          {role.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-[8px]" data-testid={`agent-dept-${role.id}`}>
                            {role.department}
                          </Badge>
                          {assetCount > 0 && (
                            <span className="text-[10px] text-muted-foreground" data-testid={`agent-assets-${role.id}`}>
                              {assetCount} assets
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1" />
                  </div>

                  <div className="space-y-2.5">
                    <MetricBar
                      label="Accuracy Score"
                      value={metric.accuracyScore}
                      testId={`metric-accuracy-${role.id}`}
                    />
                    <MetricBar
                      label="Task Completion"
                      value={metric.taskCompletionRate}
                      testId={`metric-completion-${role.id}`}
                    />
                    <MetricBar
                      label="Confidence Score"
                      value={metric.confidenceScore}
                      testId={`metric-confidence-${role.id}`}
                    />
                    <MetricBar
                      label="Hallucination Risk"
                      value={metric.hallucinationRisk}
                      inverted
                      testId={`metric-hallucination-${role.id}`}
                    />
                    <MetricBar
                      label="Drift Score"
                      value={metric.driftScore}
                      inverted
                      testId={`metric-drift-${role.id}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/20">
                    <div data-testid={`metric-response-time-${role.id}`}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Response Time</span>
                      </div>
                      <span className="text-sm font-bold">{metric.avgResponseTime.toFixed(1)}s</span>
                    </div>
                    <div data-testid={`metric-escalation-${role.id}`}>
                      <div className="flex items-center gap-1 mb-0.5">
                        <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Escalation Rate</span>
                      </div>
                      <span className={`text-sm font-bold ${getRiskColor(metric.escalationRate, true)}`}>
                        {metric.escalationRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/20">
                    <div className="flex items-center gap-1.5" data-testid={`metric-tasks-count-${role.id}`}>
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                      <span className="text-[10px] text-muted-foreground">
                        {metric.tasksCompleted.toLocaleString()} tasks completed
                      </span>
                    </div>
                    {metric.lastEvaluatedAt && (
                      <span className="text-[9px] text-muted-foreground" data-testid={`metric-last-eval-${role.id}`}>
                        {new Date(metric.lastEvaluatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {metrics && metrics.length === 0 && (
          <Card className="glass-panel-strong">
            <CardContent className="p-12 text-center">
              <Brain className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-metrics">No Performance Data</h3>
              <p className="text-sm text-muted-foreground">
                Performance metrics will appear here once AI agents begin processing tasks.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
