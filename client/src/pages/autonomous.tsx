import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  Zap,
  Shield,
  Network,
  Cpu,
  Download,
  FileCheck,
  Wrench,
  Activity,
  Brain,
} from "lucide-react";
import type { AgentActivity, AiAgent } from "@shared/schema";

const agentIcons: Record<string, React.ElementType> = {
  network_monitor: Network,
  iot_controller: Cpu,
  automation_engine: Zap,
  compliance_auditor: FileCheck,
  patch_manager: Download,
  security_monitor: Shield,
  incident_manager: Wrench,
  master: Brain,
};

export default function Autonomous() {
  const { data: activities, isLoading } = useQuery<AgentActivity[]>({ queryKey: ["/api/agent-activities/autonomous"] });
  const { data: agents } = useQuery<AiAgent[]>({ queryKey: ["/api/agents"] });
  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

  const agentMap = new Map(agents?.map(a => [a.id, a]) ?? []);

  const agentActionCounts = new Map<string, number>();
  activities?.forEach(a => {
    agentActionCounts.set(a.agentId, (agentActionCounts.get(a.agentId) || 0) + 1);
  });

  const topAgents = [...agentActionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, count]) => ({ agent: agentMap.get(id), count }));

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Autonomous Operations Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time feed of actions taken by AI agents without human intervention
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Bot className="h-3 w-3" />
          {activities?.length ?? 0} autonomous actions
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {topAgents.map(({ agent, count }) => {
          if (!agent) return null;
          const Icon = agentIcons[agent.type] || Bot;
          return (
            <Card key={agent.id} className="hover-elevate" data-testid={`card-agent-summary-${agent.id}`}>
              <CardContent className="p-3 text-center">
                <div className="flex h-8 w-8 mx-auto items-center justify-center rounded-md mb-2" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-[10px] text-muted-foreground truncate">{agent.name}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card data-testid="card-autonomous-feed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Autonomous Action Feed
            </CardTitle>
            <Badge variant="outline" className="text-[10px] gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {activities?.map(act => {
              const agent = agentMap.get(act.agentId);
              const Icon = agent ? (agentIcons[agent.type] || Bot) : Bot;
              return (
                <div key={act.id} className="px-5 py-4 flex items-start gap-4" data-testid={`autonomous-action-${act.id}`}>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: agent?.color ? `${agent.color}20` : undefined, color: agent?.color ?? undefined }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="w-0.5 flex-1 bg-border" />
                  </div>
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: agent?.color }}>{agent?.name ?? "Unknown"}</span>
                      <Badge variant="outline" className="text-[10px] bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />
                        autonomous
                      </Badge>
                      {act.relatedEntityType && (
                        <Badge variant="outline" className="text-[10px]">{act.relatedEntityType}</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1">{act.action}</p>
                    <p className="text-xs text-muted-foreground mt-1">{act.details}</p>
                    {act.createdAt && (
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {new Date(act.createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
