import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Plus, Search, Clock, ChevronLeft, ChevronRight,
  BarChart3, CheckCircle2, Timer, TrendingUp, Inbox, ArrowRight,
  Filter, MoreHorizontal, Eye, ShieldAlert, Headphones, ExternalLink
} from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertIncidentSchema } from "@shared/schema";
import type { Incident } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { z } from "zod";

const createIncidentSchema = insertIncidentSchema.extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  source: z.string().min(1, "Source is required"),
});

interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  critical: number;
  mttrHours: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  last7d: number;
  last30d: number;
}

const ITIL_STATUSES = [
  { value: "open", label: "New", icon: Inbox, color: "text-blue-400", bg: "bg-blue-500/15" },
  { value: "investigating", label: "Investigating", icon: Eye, color: "text-amber-400", bg: "bg-amber-500/15" },
  { value: "in_progress", label: "In Progress", icon: ArrowRight, color: "text-cyan-400", bg: "bg-cyan-500/15" },
  { value: "resolved", label: "Resolved", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
];

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/20",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[severity] || variants.medium}`} data-testid={`badge-severity-${severity}`}>
      {severity}
    </span>
  );
}

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

function SeverityBar({ bySeverity, onSegmentClick, activeSegment }: { bySeverity: Record<string, number>; onSegmentClick?: (key: string) => void; activeSegment?: string }) {
  const total = Object.values(bySeverity).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments = [
    { key: "critical", label: "Critical", color: "bg-red-500", count: bySeverity.critical || 0 },
    { key: "high", label: "High", color: "bg-orange-500", count: bySeverity.high || 0 },
    { key: "medium", label: "Medium", color: "bg-yellow-500", count: bySeverity.medium || 0 },
    { key: "low", label: "Low", color: "bg-green-500", count: bySeverity.low || 0 },
  ];
  return (
    <div data-testid="severity-distribution">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {segments.map(seg => seg.count > 0 && (
          <div key={seg.key} className={`${seg.color} ${onSegmentClick ? "cursor-pointer hover:opacity-80" : ""} ${activeSegment === seg.key ? "ring-2 ring-primary ring-offset-1" : ""}`} style={{ width: `${(seg.count / total) * 100}%` }} title={`${seg.label}: ${seg.count}`} onClick={() => onSegmentClick?.(seg.key)} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {segments.map(seg => (
          <div key={seg.key} className={`flex items-center gap-1.5 text-[10px] transition-all ${onSegmentClick ? "cursor-pointer hover:text-foreground" : ""} ${activeSegment === seg.key ? "text-foreground font-semibold ring-1 ring-primary rounded px-1.5 py-0.5" : "text-muted-foreground"}`} onClick={() => onSegmentClick?.(seg.key)} data-testid={`severity-segment-${seg.key}`}>
            <span className={`h-2 w-2 rounded-full ${seg.color}`} />
            {seg.label}: {seg.count}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPipeline({ byStatus, activeStatus, onStatusClick }: { byStatus: Record<string, number>; activeStatus: string; onStatusClick: (status: string) => void }) {
  const stages = ITIL_STATUSES.filter(s => (byStatus[s.value] || 0) > 0 || ["open", "investigating", "in_progress", "resolved"].includes(s.value));
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
      { label: "Investigate", status: "investigating", variant: "secondary" },
      { label: "Resolve", status: "resolved", variant: "default" },
    ];
    case "investigating": return [
      { label: "In Progress", status: "in_progress", variant: "secondary" },
      { label: "Resolve", status: "resolved", variant: "default" },
    ];
    case "in_progress": return [
      { label: "Resolve", status: "resolved", variant: "default" },
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

export default function Incidents() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const { data: incidents, isLoading } = useQuery<Incident[]>({
    queryKey: ["/api/incidents"],
  });

  const { data: stats } = useQuery<IncidentStats>({
    queryKey: ["/api/incidents/stats"],
  });

  const form = useForm({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: {
      title: "",
      description: "",
      severity: "medium",
      status: "open",
      category: "",
      source: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createIncidentSchema>) => {
      await apiRequest("POST", "/api/incidents", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Incident created", description: "The incident has been logged and assigned to an agent." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/incidents/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Incident updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const uniqueCategories = Array.from(new Set(incidents?.map(inc => inc.category) ?? [])).sort();

  const filtered = (incidents ?? []).filter(inc => {
    const matchSearch = !search || inc.title.toLowerCase().includes(search.toLowerCase()) || inc.category.toLowerCase().includes(search.toLowerCase()) || inc.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inc.status === statusFilter;
    const matchSeverity = severityFilter === "all" || inc.severity === severityFilter;
    const matchCategory = categoryFilter === "all" || inc.category === categoryFilter;
    return matchSearch && matchStatus && matchSeverity && matchCategory;
  }).sort((a, b) => {
    const statusOrder: Record<string, number> = { open: 0, investigating: 1, in_progress: 2, resolved: 3 };
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const sDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (sDiff !== 0) return sDiff;
    const pDiff = (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showingStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const showingEnd = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  const selectedIncident = detailId ? incidents?.find(r => r.id === detailId) : null;

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-incidents-title">Incident Management</h1>
          <p className="text-sm text-muted-foreground mt-1">ITIL-aligned incident tracking, investigation, and resolution</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-incident">
              <Plus className="h-4 w-4 mr-2" />
              New Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Report New Incident</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} data-testid="input-incident-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[80px]" data-testid="input-incident-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="severity" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Severity</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-severity"><SelectValue /></SelectTrigger></FormControl>
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
                      <FormControl><Input {...field} placeholder="e.g. Malware" data-testid="input-incident-category" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="source" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Firewall IDS" data-testid="input-incident-source" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-incident">
                  {createMutation.isPending ? "Creating..." : "Create Incident"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="kpi-grid">
            <KpiCard title="Total Incidents" value={stats.total} subtitle={`${stats.last7d} this week`} icon={BarChart3} color="bg-blue-500/15 text-blue-400" trend={`${stats.last30d} in last 30 days`} onClick={() => { setStatusFilter("all"); setSeverityFilter("all"); setCategoryFilter("all"); setPage(0); }} active={statusFilter === "all" && severityFilter === "all" && categoryFilter === "all"} />
            <KpiCard title="Open" value={stats.open} subtitle="Awaiting action" icon={Inbox} color="bg-indigo-500/15 text-indigo-400" onClick={() => { setStatusFilter(statusFilter === "open" ? "all" : "open"); setPage(0); }} active={statusFilter === "open"} />
            <KpiCard title="Investigating" value={stats.investigating} subtitle="Under analysis" icon={Eye} color="bg-amber-500/15 text-amber-400" onClick={() => { setStatusFilter(statusFilter === "investigating" ? "all" : "investigating"); setPage(0); }} active={statusFilter === "investigating"} />
            <KpiCard title="Resolved" value={stats.resolved} subtitle="Completed" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" onClick={() => { setStatusFilter(statusFilter === "resolved" ? "all" : "resolved"); setPage(0); }} active={statusFilter === "resolved"} />
            <KpiCard title="Critical" value={stats.critical} subtitle="Highest severity" icon={ShieldAlert} color={stats.critical > 0 ? "bg-red-500/15 text-red-400" : "bg-muted/30 text-muted-foreground"} onClick={() => { setSeverityFilter(severityFilter === "critical" ? "all" : "critical"); setPage(0); }} active={severityFilter === "critical"} />
            <KpiCard title="MTTR" value={stats.mttrHours > 0 ? `${stats.mttrHours}h` : "N/A"} subtitle="Mean time to resolve" icon={Timer} color="bg-purple-500/15 text-purple-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">ITIL Incident Lifecycle</p>
                <StatusPipeline byStatus={stats.byStatus} activeStatus={statusFilter} onStatusClick={(s) => { setStatusFilter(s); setPage(0); }} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Severity Distribution</p>
                <SeverityBar bySeverity={stats.bySeverity} onSegmentClick={(k) => { setSeverityFilter(severityFilter === k ? "all" : k); setPage(0); }} activeSegment={severityFilter !== "all" ? severityFilter : undefined} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Incident Queue</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{filtered.length} incidents</Badge>
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
                placeholder="Search incidents by title, description, or category..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
                data-testid="input-search-incidents"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
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
              <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-severity">
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
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
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(severityFilter !== "all" || categoryFilter !== "all") && (
                <Button size="sm" variant="ghost" onClick={() => { setSeverityFilter("all"); setCategoryFilter("all"); setPage(0); }} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No incidents match your filters</p>
            </div>
          ) : (
            <div className="border border-border/40 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_100px_80px_110px_100px_130px] gap-2 px-4 py-2 bg-muted/20 border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Incident</span>
                <span>Severity</span>
                <span>Category</span>
                <span>Source</span>
                <span>Status</span>
                <span>Created</span>
                <span className="text-right">Actions</span>
              </div>
              {paged.map(inc => (
                <div
                  key={inc.id}
                  className="grid grid-cols-[1fr_90px_100px_80px_110px_100px_130px] gap-2 px-4 py-3 border-b border-border/20 hover:bg-muted/10 transition-colors items-center cursor-pointer"
                  onClick={() => setDetailId(inc.id)}
                  data-testid={`row-incident-${inc.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inc.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{inc.description}</p>
                  </div>
                  <div><SeverityBadge severity={inc.severity} /></div>
                  <div><Badge variant="outline" className="text-[10px]">{inc.category}</Badge></div>
                  <div className="text-[11px] text-muted-foreground truncate">{inc.source}</div>
                  <div><StatusBadge status={inc.status} /></div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeSince(inc.createdAt)}
                  </div>
                  <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {getNextActions(inc.status).slice(0, 2).map(action => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant={action.variant}
                        className="text-[10px] h-7 px-2"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: inc.id, status: action.status })}
                        data-testid={`button-action-${action.status}-${inc.id}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {getNextActions(inc.status).length > 2 && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDetailId(inc.id)} data-testid={`button-more-${inc.id}`}>
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 flex-wrap pt-2" data-testid="pagination-incidents">
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

      <Dialog open={!!selectedIncident} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedIncident && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <span>{selectedIncident.title}</span>
                  <SeverityBadge severity={selectedIncident.severity} />
                  <StatusBadge status={selectedIncident.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                  <p className="text-sm leading-relaxed">{selectedIncident.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Category</p>
                    <Badge variant="outline">{selectedIncident.category}</Badge>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Source</p>
                    <p className="text-sm">{selectedIncident.source}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                    <p className="text-sm">{formatTimestamp(selectedIncident.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Last Updated</p>
                    <p className="text-sm">{formatTimestamp(selectedIncident.updatedAt)}</p>
                  </div>
                  {selectedIncident.resolvedAt && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Resolved At</p>
                      <p className="text-sm">{formatTimestamp(selectedIncident.resolvedAt)}</p>
                    </div>
                  )}
                </div>

                {(selectedIncident as any).sourceServiceRequestId && (
                  <Card className="border-amber-500/20 bg-amber-500/5">
                    <CardContent className="p-3 flex items-center gap-3">
                      <Headphones className="h-4 w-4 text-amber-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Source</p>
                        <p className="text-sm">This incident was auto-created from a Service Request.</p>
                      </div>
                      <Link href="/service-requests" data-testid="link-view-source-sr">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5" />
                          View Request
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}

                {selectedIncident.resolvedAt && selectedIncident.createdAt && (
                  <Card className="border-border/50 bg-muted/10">
                    <CardContent className="p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Resolution Time</p>
                      <p className="text-lg font-bold" data-testid="text-resolution-time">
                        {(() => {
                          const ms = new Date(selectedIncident.resolvedAt).getTime() - new Date(selectedIncident.createdAt).getTime();
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
                    {getNextActions(selectedIncident.status).map(action => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        disabled={updateMutation.isPending}
                        onClick={() => { updateMutation.mutate({ id: selectedIncident.id, status: action.status }); setDetailId(null); }}
                        data-testid={`button-detail-${action.status}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {getNextActions(selectedIncident.status).length === 0 && (
                      <p className="text-sm text-muted-foreground">This incident is in a terminal state. No further actions available.</p>
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
