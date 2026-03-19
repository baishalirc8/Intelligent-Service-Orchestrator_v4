import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Shield,
  AlertTriangle,
  Headphones,
  GitBranch,
  Server,
  Brain,
  Bot,
  Zap,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { AiAgent } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

const iconMap: Record<string, React.ElementType> = {
  Shield,
  AlertTriangle,
  Headphones,
  GitBranch,
  Server,
  Brain,
};

export default function Agents() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  const { data: agents, isLoading } = useQuery<AiAgent[]>({
    queryKey: ["/api/agents"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/agents/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Agent status updated" });
    },
  });

  const filtered = (agents ?? []).filter(agent => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return agent.name.toLowerCase().includes(q) || agent.description.toLowerCase().includes(q) || agent.type.toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-agents-title">AI Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your specialized AI agent workforce</p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Bot className="h-3 w-3" />
          {agents?.filter(a => a.status === "active").length ?? 0} / {agents?.length ?? 0} Active
        </Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          className="pl-9"
          data-testid="input-search-agents"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-md" />)
        ) : (
          paged.map(agent => {
            const Icon = iconMap[agent.icon] || Bot;
            const isMaster = agent.type === "master";

            return (
              <Card key={agent.id} className="hover-elevate relative" data-testid={`card-agent-${agent.id}`}>
                {isMaster && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="default" className="gap-1 text-[10px]">
                      <Zap className="h-2.5 w-2.5" />
                      Master
                    </Badge>
                  </div>
                )}
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: `${agent.color}20`,
                        color: agent.color,
                      }}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold" data-testid={`text-agent-name-${agent.id}`}>{agent.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{agent.type}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{agent.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map(cap => (
                      <Badge key={cap} variant="outline" className="text-[10px]">{cap}</Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${agent.status === "active" ? "bg-status-online" : "bg-status-offline"}`} />
                      <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{agent.tasksHandled} tasks</span>
                      <Switch
                        checked={agent.status === "active"}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: agent.id, status: checked ? "active" : "inactive" })
                        }
                        data-testid={`switch-agent-${agent.id}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-3 py-2 border rounded-md border-border/30 bg-muted/10">
          <span className="text-[10px] text-muted-foreground" data-testid="text-agents-showing">
            Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              data-testid="agents-page-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i}
                size="icon"
                variant={i === safePage ? "default" : "ghost"}
                className="h-6 w-6 text-[10px]"
                onClick={() => setPage(i)}
                data-testid={`agents-page-${i}`}
              >
                {i + 1}
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
              data-testid="agents-page-next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
