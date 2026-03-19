import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Shield,
  Headphones,
  Bot,
  Activity,
  AlertCircle,
  Bug,
  GitBranch,
  BookOpen,
  Server,
  Network,
  Zap,
  Gauge,
  Radio,
} from "lucide-react";
import type { Incident, SecurityEvent, AgentActivity, AiAgent } from "@shared/schema";

interface DashboardStats {
  totalIncidents: number;
  openIncidents: number;
  criticalIncidents: number;
  totalServiceRequests: number;
  pendingServiceRequests: number;
  totalSecurityEvents: number;
  activeAgents: number;
  totalProblems: number;
  openProblems: number;
  totalChangeRequests: number;
  pendingChanges: number;
  totalCmdbItems: number;
  knowledgeArticles: number;
  totalConnectors: number;
  activeConnectors: number;
  totalPlaybooks: number;
  playbookExecutions: number;
  autonomousActions: number;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass,
  testId,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: React.ElementType;
  accentClass: string;
  testId: string;
}) {
  return (
    <Card className="hover-elevate" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </span>
            <span className="text-2xl font-bold tracking-tight" data-testid={`${testId}-value`}>
              {value}
            </span>
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          </div>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, string> = {
    critical: "bg-red-500/15 text-red-600 dark:text-red-400",
    high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    medium: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    low: "bg-green-500/15 text-green-600 dark:text-green-400",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[severity] || variants.medium}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    open: "bg-red-500/15 text-red-600 dark:text-red-400",
    investigating: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    in_progress: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    pending: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    resolved: "bg-green-500/15 text-green-600 dark:text-green-400",
  };
  const labels: Record<string, string> = {
    open: "Open",
    investigating: "Investigating",
    in_progress: "In Progress",
    pending: "Pending",
    resolved: "Resolved",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[status] || variants.pending}`}>
      {labels[status] || status}
    </span>
  );
}

export { SeverityBadge, StatusBadge };

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: incidents, isLoading: incidentsLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<SecurityEvent[]>({
    queryKey: ["/api/security-events"],
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery<AgentActivity[]>({
    queryKey: ["/api/agent-activities"],
  });

  const { data: agents } = useQuery<AiAgent[]>({
    queryKey: ["/api/agents"],
  });

  const agentMap = new Map(agents?.map(a => [a.id, a]) ?? []);
  const autonomousActivities = activities?.filter(a => a.autonomous) ?? [];

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-md" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 rounded-md" />
          <Skeleton className="h-80 rounded-md" />
        </div>
      </div>
    );
  }

  const recentIncidents = incidents?.slice(0, 5) ?? [];
  const recentEvents = events?.slice(0, 6) ?? [];
  const recentAutonomous = autonomousActivities.slice(0, 6);

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-title">
            Autonomous Operations Center
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-managed infrastructure — SIEM, ITSM & autonomous remediation
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-status-online animate-pulse" />
          {stats?.activeAgents ?? 0} AI Agents Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Connectors"
          value={stats?.activeConnectors ?? 0}
          subtitle={`${stats?.totalConnectors ?? 0} total protocols`}
          icon={Network}
          accentClass="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
          testId="stat-connectors"
        />
        <StatCard
          title="Managed Assets"
          value={stats?.totalCmdbItems ?? 0}
          subtitle="Hardware, Software & IoT"
          icon={Server}
          accentClass="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          testId="stat-cmdb-items"
        />
        <StatCard
          title="Playbooks"
          value={stats?.totalPlaybooks ?? 0}
          subtitle={`${stats?.playbookExecutions ?? 0} executions`}
          icon={Zap}
          accentClass="bg-orange-500/15 text-orange-600 dark:text-orange-400"
          testId="stat-playbooks"
        />
        <StatCard
          title="Autonomous Actions"
          value={stats?.autonomousActions ?? 0}
          subtitle="Zero human intervention"
          icon={Radio}
          accentClass="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
          testId="stat-autonomous"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Open Incidents"
          value={stats?.openIncidents ?? 0}
          subtitle={`${stats?.criticalIncidents ?? 0} critical`}
          icon={AlertTriangle}
          accentClass="bg-red-500/15 text-red-600 dark:text-red-400"
          testId="stat-open-incidents"
        />
        <StatCard
          title="Security Events"
          value={stats?.totalSecurityEvents ?? 0}
          subtitle="Detected today"
          icon={Shield}
          accentClass="bg-blue-500/15 text-blue-600 dark:text-blue-400"
          testId="stat-security-events"
        />
        <StatCard
          title="Open Problems"
          value={stats?.openProblems ?? 0}
          subtitle={`${stats?.totalProblems ?? 0} total tracked`}
          icon={Bug}
          accentClass="bg-rose-500/15 text-rose-600 dark:text-rose-400"
          testId="stat-open-problems"
        />
        <StatCard
          title="Pending Changes"
          value={stats?.pendingChanges ?? 0}
          subtitle={`${stats?.totalChangeRequests ?? 0} total requests`}
          icon={GitBranch}
          accentClass="bg-violet-500/15 text-violet-600 dark:text-violet-400"
          testId="stat-pending-changes"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-recent-incidents">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Recent Incidents
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">{incidents?.length ?? 0} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {incidentsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentIncidents.map(inc => (
                  <div key={inc.id} className="px-5 py-3 flex items-center justify-between gap-3" data-testid={`incident-row-${inc.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{inc.category} &middot; {inc.source}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SeverityBadge severity={inc.severity} />
                      <StatusBadge status={inc.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-autonomous-feed">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                Autonomous Agent Actions
              </CardTitle>
              <Badge variant="outline" className="text-[10px] gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activitiesLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentAutonomous.map(act => {
                  const agent = agentMap.get(act.agentId);
                  return (
                    <div key={act.id} className="px-5 py-3 flex items-start gap-3" data-testid={`autonomous-row-${act.id}`}>
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md mt-0.5 text-xs font-bold"
                        style={{
                          backgroundColor: agent?.color ? `${agent.color}20` : undefined,
                          color: agent?.color ?? undefined,
                        }}
                      >
                        {agent?.name?.charAt(0) ?? "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{agent?.name ?? "Unknown Agent"}</span>
                          <Badge variant="outline" className="text-[10px] bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                            autonomous
                          </Badge>
                        </div>
                        <p className="text-xs font-medium mt-0.5">{act.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{act.details}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-security-events">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Security Event Feed
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">{events?.length ?? 0} events</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {eventsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentEvents.map(ev => (
                <div key={ev.id} className="px-5 py-3" data-testid={`event-row-${ev.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-mono text-muted-foreground uppercase">{ev.eventType.replace(/_/g, " ")}</span>
                    <SeverityBadge severity={ev.severity} />
                  </div>
                  <p className="text-sm mt-1 text-foreground/90 line-clamp-1">{ev.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ev.source} &middot; {ev.processed ? "Processed" : "Pending review"}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
