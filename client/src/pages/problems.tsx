import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Problem } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProblemSchema } from "@shared/schema";
import { z } from "zod";
import {
  Search, Bug, CheckCircle2, Eye, Lightbulb, ChevronLeft, ChevronRight,
  BarChart3, TrendingUp, Clock, Filter, MoreHorizontal, AlertTriangle,
  Timer, Inbox, ArrowRight, Plus
} from "lucide-react";
import { useState } from "react";

const PROBLEM_CATEGORIES = [
  "application_error", "database_issue", "network_failure", "hardware_failure",
  "security_vulnerability", "performance_degradation", "configuration_drift",
  "capacity_issue", "integration_failure", "recurring_incident",
];

const createProblemSchema = insertProblemSchema.pick({
  title: true, description: true, priority: true, category: true,
}).extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
});

interface ProblemStats {
  total: number;
  open: number;
  investigating: number;
  rootCauseIdentified: number;
  resolved: number;
  knownErrors: number;
  avgResolutionHours: number;
  byPriority: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  last7d: number;
  last30d: number;
}

const ITIL_STATUSES = [
  { value: "open", label: "Open", icon: Inbox, color: "text-red-400", bg: "bg-red-500/15" },
  { value: "investigating", label: "Investigating", icon: Eye, color: "text-yellow-400", bg: "bg-yellow-500/15" },
  { value: "root_cause_identified", label: "Root Cause ID", icon: Lightbulb, color: "text-blue-400", bg: "bg-blue-500/15" },
  { value: "resolved", label: "Resolved", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = ITIL_STATUSES.find(s => s.value === status) || ITIL_STATUSES[0];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color}`} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/20",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[priority] || variants.medium}`}>
      {priority}
    </span>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, color, trend, onClick, active }: {
  title: string; value: string | number; subtitle?: string;
  icon: any; color: string; trend?: string; onClick?: () => void; active?: boolean;
}) {
  return (
    <Card className={`border-border/50 ${onClick ? "cursor-pointer hover:bg-muted/20 transition-colors" : ""} ${active ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityBar({ byPriority, onSegmentClick, activeSegment }: { byPriority: Record<string, number>; onSegmentClick?: (key: string) => void; activeSegment?: string }) {
  const total = Object.values(byPriority).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments = [
    { key: "critical", label: "Critical", color: "bg-red-500", count: byPriority.critical || 0 },
    { key: "high", label: "High", color: "bg-orange-500", count: byPriority.high || 0 },
    { key: "medium", label: "Medium", color: "bg-yellow-500", count: byPriority.medium || 0 },
    { key: "low", label: "Low", color: "bg-green-500", count: byPriority.low || 0 },
  ];
  return (
    <div data-testid="priority-distribution">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {segments.map(seg => seg.count > 0 && (
          <div key={seg.key} className={`${seg.color} ${onSegmentClick ? "cursor-pointer hover:opacity-80" : ""} ${activeSegment === seg.key ? "ring-2 ring-primary ring-offset-1" : ""}`} style={{ width: `${(seg.count / total) * 100}%` }} title={`${seg.label}: ${seg.count}`} onClick={() => onSegmentClick?.(seg.key)} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {segments.map(seg => (
          <div key={seg.key} className={`flex items-center gap-1.5 text-[10px] transition-all ${onSegmentClick ? "cursor-pointer hover:text-foreground" : ""} ${activeSegment === seg.key ? "text-foreground font-semibold ring-1 ring-primary rounded px-1.5 py-0.5" : "text-muted-foreground"}`} onClick={() => onSegmentClick?.(seg.key)} data-testid={`priority-segment-${seg.key}`}>
            <span className={`h-2 w-2 rounded-full ${seg.color}`} />
            {seg.label}: {seg.count}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPipeline({ byStatus, activeStatus, onStatusClick }: { byStatus: Record<string, number>; activeStatus: string; onStatusClick: (status: string) => void }) {
  const stages = ITIL_STATUSES;
  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="status-pipeline">
      {stages.map((stage, i) => {
        const count = byStatus[stage.value] || 0;
        const Icon = stage.icon;
        const isActive = activeStatus === stage.value;
        return (
          <div key={stage.value} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md ${stage.bg} ${stage.color} text-[11px] font-medium cursor-pointer transition-all hover:scale-105 ${isActive ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
              onClick={() => onStatusClick(isActive ? "all" : stage.value)}
              data-testid={`pipeline-stage-${stage.value}`}
            >
              <Icon className="h-3 w-3" />
              <span>{stage.label}</span>
              <span className="font-bold ml-0.5">{count}</span>
            </div>
            {i < stages.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

function getNextActions(status: string): { label: string; status: string; variant: "default" | "secondary" | "outline" | "destructive" }[] {
  switch (status) {
    case "open": return [
      { label: "Investigate", status: "investigating", variant: "default" },
    ];
    case "investigating": return [
      { label: "Root Cause ID", status: "root_cause_identified", variant: "default" },
      { label: "Back to Open", status: "open", variant: "outline" },
    ];
    case "root_cause_identified": return [
      { label: "Resolve", status: "resolved", variant: "default" },
      { label: "Back to Investigating", status: "investigating", variant: "outline" },
    ];
    case "resolved": return [
      { label: "Reopen", status: "open", variant: "outline" },
    ];
    default: return [];
  }
}

function formatTimestamp(ts: string | Date | null) {
  if (!ts) return "N/A";
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function timeSince(ts: string | Date | null) {
  if (!ts) return "";
  const ms = Date.now() - new Date(ts).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return `${Math.max(1, Math.floor(ms / (1000 * 60)))}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PAGE_SIZE = 10;

export default function Problems() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [knownErrorOnly, setKnownErrorOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const { data: problems, isLoading } = useQuery<Problem[]>({
    queryKey: ["/api/problems"],
  });

  const { data: stats } = useQuery<ProblemStats>({
    queryKey: ["/api/problems/stats"],
  });

  const form = useForm({
    resolver: zodResolver(createProblemSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      category: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createProblemSchema>) => {
      await apiRequest("POST", "/api/problems", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/problems"] });
      queryClient.invalidateQueries({ queryKey: ["/api/problems/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Problem created", description: "The problem record has been logged for investigation." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/problems/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/problems"] });
      queryClient.invalidateQueries({ queryKey: ["/api/problems/stats"] });
      toast({ title: "Problem updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusOrder: Record<string, number> = { open: 0, investigating: 1, root_cause_identified: 2, resolved: 3 };
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const filtered = (problems ?? []).filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchPriority = priorityFilter === "all" || p.priority === priorityFilter;
    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchKnownError = !knownErrorOnly || p.knownError;
    return matchSearch && matchStatus && matchPriority && matchCategory && matchKnownError;
  }).sort((a, b) => {
    const sDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (sDiff !== 0) return sDiff;
    const pDiff = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showingStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const showingEnd = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  const selectedProblem = detailId ? problems?.find(p => p.id === detailId) : null;

  const uniqueCategories = Array.from(new Set(problems?.map(p => p.category) ?? [])).sort();

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Problem Management</h1>
          <p className="text-sm text-muted-foreground mt-1">ITIL-aligned root cause analysis, known errors, and workarounds</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-problem">
              <Plus className="h-4 w-4 mr-2" />
              New Problem
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log New Problem</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} placeholder="Brief problem summary" data-testid="input-problem-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[80px]" placeholder="Detailed problem description, symptoms, and impact" data-testid="input-problem-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-problem-priority"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-problem-category"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {PROBLEM_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>
                              {cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-problem">
                  {createMutation.isPending ? "Creating..." : "Create Problem"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3" data-testid="kpi-grid">
            <KpiCard title="Total Problems" value={stats.total} subtitle={`${stats.last7d} this week`} icon={BarChart3} color="bg-blue-500/15 text-blue-400" trend={`${stats.last30d} in last 30 days`} onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setCategoryFilter("all"); setKnownErrorOnly(false); setPage(0); }} active={statusFilter === "all" && priorityFilter === "all" && categoryFilter === "all" && !knownErrorOnly} />
            <KpiCard title="Open" value={stats.open} subtitle="New problems" icon={Inbox} color="bg-red-500/15 text-red-400" onClick={() => { setStatusFilter(statusFilter === "open" ? "all" : "open"); setPage(0); }} active={statusFilter === "open"} />
            <KpiCard title="Investigating" value={stats.investigating} subtitle="Under analysis" icon={Eye} color="bg-yellow-500/15 text-yellow-400" onClick={() => { setStatusFilter(statusFilter === "investigating" ? "all" : "investigating"); setPage(0); }} active={statusFilter === "investigating"} />
            <KpiCard title="Root Cause ID" value={stats.rootCauseIdentified} subtitle="Cause found" icon={Lightbulb} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter(statusFilter === "root_cause_identified" ? "all" : "root_cause_identified"); setPage(0); }} active={statusFilter === "root_cause_identified"} />
            <KpiCard title="Known Errors" value={stats.knownErrors} subtitle="Documented errors" icon={AlertTriangle} color={stats.knownErrors > 0 ? "bg-amber-500/15 text-amber-400" : "bg-muted/30 text-muted-foreground"} onClick={() => { setKnownErrorOnly(!knownErrorOnly); setPage(0); }} active={knownErrorOnly} />
            <KpiCard title="Resolved" value={stats.resolved} subtitle="Closed" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" onClick={() => { setStatusFilter(statusFilter === "resolved" ? "all" : "resolved"); setPage(0); }} active={statusFilter === "resolved"} />
            <KpiCard title="Avg Resolution" value={stats.avgResolutionHours > 0 ? `${stats.avgResolutionHours}h` : "N/A"} subtitle="Mean time to resolve" icon={Timer} color="bg-purple-500/15 text-purple-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">ITIL Problem Lifecycle Pipeline</p>
                <StatusPipeline byStatus={stats.byStatus} activeStatus={statusFilter} onStatusClick={(s) => { setStatusFilter(s); setPage(0); }} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Priority Distribution</p>
                <PriorityBar byPriority={stats.byPriority} onSegmentClick={(k) => { setPriorityFilter(priorityFilter === k ? "all" : k); setPage(0); }} activeSegment={priorityFilter !== "all" ? priorityFilter : undefined} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Problem Queue</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{filtered.length} problems</Badge>
              <Button
                size="sm"
                variant={showFilters ? "secondary" : "outline"}
                onClick={() => setShowFilters(f => !f)}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-3.5 w-3.5 mr-1.5" />
                Filters
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search problems by title or description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
                data-testid="input-search-problems"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {ITIL_STATUSES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showFilters && (
            <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-muted/20 border border-border/30" data-testid="advanced-filters">
              <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-priority">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-filter-category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(c => (
                    <SelectItem key={c} value={c}>{c.replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch
                  checked={knownErrorOnly}
                  onCheckedChange={(v) => { setKnownErrorOnly(v); setPage(0); }}
                  data-testid="switch-known-error"
                />
                <span className="text-xs text-muted-foreground">Known Errors Only</span>
              </div>
              {(priorityFilter !== "all" || categoryFilter !== "all" || knownErrorOnly) && (
                <Button size="sm" variant="ghost" onClick={() => { setPriorityFilter("all"); setCategoryFilter("all"); setKnownErrorOnly(false); setPage(0); }} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Bug className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No problems match your filters</p>
            </div>
          ) : (
            <div className="border border-border/40 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_100px_120px_80px_90px_80px_120px] gap-2 px-4 py-2 bg-muted/20 border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Problem</span>
                <span>Priority</span>
                <span>Category</span>
                <span>Status</span>
                <span>Known Err</span>
                <span>Incidents</span>
                <span>Created</span>
                <span className="text-right">Actions</span>
              </div>
              {paged.map(problem => (
                <div
                  key={problem.id}
                  className="grid grid-cols-[1fr_90px_100px_120px_80px_90px_80px_120px] gap-2 px-4 py-3 border-b border-border/20 hover:bg-muted/10 transition-colors items-center cursor-pointer"
                  onClick={() => setDetailId(problem.id)}
                  data-testid={`row-problem-${problem.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-problem-title-${problem.id}`}>{problem.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{problem.description}</p>
                  </div>
                  <div><PriorityBadge priority={problem.priority} /></div>
                  <div><Badge variant="outline" className="text-[10px]">{problem.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Badge></div>
                  <div><StatusBadge status={problem.status} /></div>
                  <div>
                    {problem.knownError ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Yes
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">No</span>
                    )}
                  </div>
                  <div><span className="text-sm text-muted-foreground">{problem.relatedIncidentCount}</span></div>
                  <div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeSince(problem.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {getNextActions(problem.status).slice(0, 2).map(action => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant={action.variant}
                        className="text-[10px] h-7 px-2"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: problem.id, status: action.status })}
                        data-testid={`button-action-${action.status}-${problem.id}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDetailId(problem.id)} data-testid={`button-detail-${problem.id}`}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 flex-wrap pt-2" data-testid="pagination-problems">
              <span className="text-sm text-muted-foreground" data-testid="text-pagination-info">
                Showing {showingStart}-{showingEnd} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" disabled={safePage === 0} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button key={i} size="sm" variant={i === safePage ? "default" : "outline"} onClick={() => setPage(i)} data-testid={`button-page-${i}`}>
                    {i + 1}
                  </Button>
                ))}
                <Button size="icon" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedProblem} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedProblem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <span>{selectedProblem.title}</span>
                  <PriorityBadge priority={selectedProblem.priority} />
                  <StatusBadge status={selectedProblem.status} />
                  {selectedProblem.knownError && (
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400">
                      <AlertTriangle className="h-3 w-3" />
                      Known Error
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                  <p className="text-sm leading-relaxed">{selectedProblem.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Category</p>
                    <Badge variant="outline">{selectedProblem.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</Badge>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Related Incidents</p>
                    <p className="text-sm font-medium">{selectedProblem.relatedIncidentCount}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                    <p className="text-sm">{formatTimestamp(selectedProblem.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Last Updated</p>
                    <p className="text-sm">{formatTimestamp(selectedProblem.updatedAt)}</p>
                  </div>
                  {selectedProblem.resolvedAt && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Resolved At</p>
                      <p className="text-sm">{formatTimestamp(selectedProblem.resolvedAt)}</p>
                    </div>
                  )}
                </div>

                {selectedProblem.rootCause && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Root Cause</p>
                    <p className="text-sm bg-muted/30 p-3 rounded-md" data-testid={`text-root-cause-${selectedProblem.id}`}>{selectedProblem.rootCause}</p>
                  </div>
                )}

                {selectedProblem.workaround && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Workaround</p>
                    <p className="text-sm bg-blue-500/5 p-3 rounded-md border border-blue-500/10" data-testid={`text-workaround-${selectedProblem.id}`}>{selectedProblem.workaround}</p>
                  </div>
                )}

                {selectedProblem.affectedServices && selectedProblem.affectedServices.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Affected Services</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedProblem.affectedServices.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                  </div>
                )}

                {selectedProblem.resolvedAt && selectedProblem.createdAt && (
                  <Card className="border-border/50 bg-muted/10">
                    <CardContent className="p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Resolution Time</p>
                      <p className="text-lg font-bold">
                        {(() => {
                          const ms = new Date(selectedProblem.resolvedAt).getTime() - new Date(selectedProblem.createdAt).getTime();
                          const hours = Math.floor(ms / (1000 * 60 * 60));
                          const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                          return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                        })()}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">ITIL Workflow Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {getNextActions(selectedProblem.status).map(action => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        disabled={updateMutation.isPending}
                        onClick={() => { updateMutation.mutate({ id: selectedProblem.id, status: action.status }); setDetailId(null); }}
                        data-testid={`button-detail-action-${action.status}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {getNextActions(selectedProblem.status).length === 0 && (
                      <p className="text-sm text-muted-foreground">This problem is in a terminal state. No further actions available.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
