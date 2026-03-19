import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  UserPlus,
  DollarSign,
  Users,
  Pause,
  Trash2,
  Play,
  Brain,
  Sparkles,
  Zap,
  Target,
  TrendingDown,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 10;
import type { OrgRole, RoleSubscription } from "@shared/schema";

interface OrgStats {
  totalRoles: number;
  subscribableRoles: number;
  activeSubscriptions: number;
  totalDepartments: number;
  monthlyInvestment: number;
  humanAssigned: number;
  aiOnly: number;
  withAiShadow: number;
  humanOnly: number;
  coveragePercent: number;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

export default function Subscriptions() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions, isLoading } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });
  const { data: stats } = useQuery<OrgStats>({ queryKey: ["/api/org-stats"] });

  const roleMap = new Map(roles?.map(r => [r.id, r]) ?? []);

  const pauseMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/role-subscriptions/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/role-subscriptions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-stats"] });
      toast({ title: "Subscription removed" });
    },
  });

  const activeSubscriptions = (subscriptions?.filter(s => s.status === "active") ?? []).filter(sub => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const role = roleMap.get(sub.roleId);
    return (
      (role?.name.toLowerCase().includes(q) ?? false) ||
      (role?.department.toLowerCase().includes(q) ?? false) ||
      (sub.assignedHumanName?.toLowerCase().includes(q) ?? false)
    );
  });
  const pausedSubscriptions = subscriptions?.filter(s => s.status === "paused") ?? [];

  const totalSavings = activeSubscriptions.reduce((sum, sub) => {
    const role = roleMap.get(sub.roleId);
    if (role && sub.hasAiShadow && role.humanCostMonthly && role.monthlyPrice) {
      return sum + (role.humanCostMonthly - role.monthlyPrice);
    }
    return sum;
  }, 0);

  const totalPages = Math.max(1, Math.ceil(activeSubscriptions.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedSubscriptions = activeSubscriptions.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const departmentGroups = new Map<string, { role: OrgRole; sub: RoleSubscription }[]>();
  pagedSubscriptions.forEach(sub => {
    const role = roleMap.get(sub.roleId);
    if (role) {
      const existing = departmentGroups.get(role.department) ?? [];
      existing.push({ role, sub });
      departmentGroups.set(role.department, existing);
    }
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-subscriptions-title">
            <span className="gradient-text">Active Agents</span>
          </h1>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Your deployed AI agents and team assignments
          </p>
        </div>
        {totalSavings > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/8 border border-green-500/15" data-testid="savings-banner">
            <TrendingDown className="h-4 w-4 text-green-500" />
            <div>
              <span className="text-xs text-green-600 dark:text-green-400 font-semibold" data-testid="text-savings-amount">
                Saving {formatPrice(totalSavings)}/mo
              </span>
              <span className="text-[10px] text-muted-foreground/60 ml-1.5">vs human cost</span>
            </div>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by role, department, or assignee..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          className="pl-9"
          data-testid="input-search-subscriptions"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-active-roles">
          <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none">
            <Brain className="w-full h-full" />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Active Agents</p>
          <p className="text-2xl font-bold mt-1" data-testid="stat-active-roles-value">{stats?.withAiShadow ?? 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">of {stats?.activeSubscriptions ?? 0} assigned roles</p>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-primary/40" />
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-coverage">
          <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none">
            <Target className="w-full h-full" />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Coverage</p>
          <p className="text-2xl font-bold mt-1" data-testid="stat-coverage-value">{stats?.coveragePercent ?? 0}%</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{stats?.activeSubscriptions ?? 0} of {stats?.subscribableRoles ?? 0} roles</p>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-blue-500/40" />
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-monthly">
          <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none">
            <DollarSign className="w-full h-full" />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Monthly Investment</p>
          <p className="text-2xl font-bold mt-1" data-testid="stat-monthly-value">{stats ? formatPrice(stats.monthlyInvestment) : "$0"}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{stats?.withAiShadow ?? 0} AI agents active</p>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 to-amber-500/40" />
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-departments">
          <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none">
            <Users className="w-full h-full" />
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Crews Active</p>
          <p className="text-2xl font-bold mt-1" data-testid="stat-departments-value">{departmentGroups.size}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">of {stats?.totalDepartments ?? 0} departments</p>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-purple-500/40" />
        </div>
      </div>

      {activeSubscriptions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Active Agents</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Visit Crews & Agents to assign team members and subscribe AI agents to your organization roles
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(departmentGroups.entries()).map(([dept, items]) => {
            const aiCount = items.filter(i => i.sub.hasAiShadow).length;
            return (
              <Card key={dept} className="overflow-hidden" data-testid={`dept-group-${dept.toLowerCase().replace(/\s+/g, "-")}`}>
                <CardHeader className="pb-3 bg-accent/15 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                        <Users className="h-3.5 w-3.5 text-primary" />
                      </div>
                      Crew: {dept}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {aiCount > 0 && (
                        <Badge className="text-[10px] bg-primary/10 text-primary border-primary/15 gap-1">
                          <Zap className="h-2.5 w-2.5" /> {aiCount} AI
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] text-muted-foreground/60">{items.length} agents</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/50">
                    {items.map(({ role, sub }) => (
                      <div
                        key={sub.id}
                        className="px-5 py-3.5 flex items-center justify-between gap-3 agent-card-hover"
                        data-testid={`sub-row-${sub.id}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="relative">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                              style={{ backgroundColor: `${role.color}12`, color: role.color, border: `1px solid ${role.color}20` }}
                            >
                              <Bot className="h-4 w-4" />
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 status-dot ${sub.hasAiShadow ? "status-dot-online" : "status-dot-idle"}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{role.name}</span>
                              {role.division && (
                                <span className="text-[10px] text-muted-foreground/50">{role.division}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {sub.assignedHumanName && (
                                <Badge variant="outline" className="text-[10px] gap-1 h-5 border-border/40">
                                  <UserPlus className="h-2.5 w-2.5" /> {sub.assignedHumanName}
                                </Badge>
                              )}
                              {sub.hasAiShadow ? (
                                <Badge className="text-[10px] bg-primary/8 text-primary border border-primary/15 gap-1 h-5" data-testid={`ai-status-active-${sub.id}`}>
                                  <Sparkles className="h-2.5 w-2.5" /> AI Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground/50 gap-1 h-5 border-border/30" data-testid={`ai-status-inactive-${sub.id}`}>
                                  <Bot className="h-2.5 w-2.5" /> Human Only
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-semibold text-primary whitespace-nowrap">
                              {role.monthlyPrice ? formatPrice(role.monthlyPrice) : "—"}/mo
                            </span>
                            {role.humanCostMonthly && role.humanCostMonthly > 0 && (
                              <span className="text-[10px] text-muted-foreground/40 line-through whitespace-nowrap">
                                {formatPrice(role.humanCostMonthly)}
                              </span>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="opacity-30 hover:opacity-100 hover:text-destructive"
                            onClick={() => deleteMutation.mutate(sub.id)}
                            data-testid={`remove-sub-${sub.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeSubscriptions.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-3 py-2 border rounded-md border-border/30 bg-muted/10">
          <span className="text-[10px] text-muted-foreground" data-testid="text-subscriptions-showing">
            Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, activeSubscriptions.length)} of {activeSubscriptions.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              data-testid="subscriptions-page-prev"
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
                data-testid={`subscriptions-page-${i}`}
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
              data-testid="subscriptions-page-next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {pausedSubscriptions.length > 0 && (
        <Card className="opacity-60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Pause className="h-4 w-4 text-muted-foreground" />
              Paused Agents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {pausedSubscriptions.map(sub => {
                const role = roleMap.get(sub.roleId);
                if (!role) return null;
                return (
                  <div key={sub.id} className="px-5 py-3 flex items-center justify-between gap-3" data-testid={`paused-sub-${sub.id}`}>
                    <span className="text-sm">{role.name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => pauseMutation.mutate({ id: sub.id, status: "active" })}
                        data-testid={`resume-sub-${sub.id}`}
                      >
                        <Play className="h-3 w-3" /> Resume
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(sub.id)}
                        data-testid={`delete-paused-sub-${sub.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
