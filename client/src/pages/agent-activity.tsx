import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import type { AgentActivity, AiAgent } from "@shared/schema";

export default function AgentActivityPage() {
  const { data: activities, isLoading } = useQuery<AgentActivity[]>({
    queryKey: ["/api/agent-activities"],
  });

  const { data: agents } = useQuery<AiAgent[]>({
    queryKey: ["/api/agents"],
  });

  const agentMap = new Map(agents?.map(a => [a.id, a]) ?? []);

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-activity-title">Agent Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time log of all AI agent actions and decisions</p>
      </div>

      <Card data-testid="card-activity-feed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Activity Feed
            </CardTitle>
            <Badge variant="outline" className="text-[10px] gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-status-online animate-pulse" />
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : !activities?.length ? (
            <div className="p-8 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No activity recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activities.map((act, index) => {
                const agent = agentMap.get(act.agentId);
                return (
                  <div key={act.id} className="px-5 py-4 flex gap-4" data-testid={`activity-item-${act.id}`}>
                    <div className="flex flex-col items-center">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold"
                        style={{
                          backgroundColor: agent?.color ? `${agent.color}20` : undefined,
                          color: agent?.color ?? undefined,
                        }}
                      >
                        {agent?.name?.substring(0, 2).toUpperCase() ?? "??"}
                      </div>
                      {index < activities.length - 1 && (
                        <div className="w-px flex-1 bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{agent?.name ?? "Unknown"}</span>
                        <Badge variant="outline" className="text-[10px]">{agent?.type?.replace(/_/g, " ")}</Badge>
                      </div>
                      <p className="text-sm font-medium mt-1">{act.action}</p>
                      <p className="text-xs text-muted-foreground mt-1">{act.details}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        {act.relatedEntityType && (
                          <Badge variant="secondary" className="text-[10px]">{act.relatedEntityType}</Badge>
                        )}
                        {act.createdAt && (
                          <span>{new Date(act.createdAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
