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
  Headphones, Plus, Search, Clock, ChevronLeft, ChevronRight,
  BarChart3, AlertTriangle, CheckCircle2, Timer, ShieldCheck,
  TrendingUp, Inbox, ArrowRight, CalendarClock, Pause, XCircle,
  ClipboardCheck, MoreHorizontal, Filter, ShieldAlert, ExternalLink, Sparkles,
  User, Users2, Bot
} from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertServiceRequestSchema } from "@shared/schema";
import type { ServiceRequest } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { z } from "zod";

const createSRSchema = insertServiceRequestSchema.extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  type: z.string().min(1, "Type is required"),
});

interface SRStats {
  total: number;
  open: number;
  inProgress: number;
  fulfilled: number;
  cancelled: number;
  overdue: number;
  avgResolutionHours: number;
  slaComplianceRate: number;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byHandler: Record<string, number>;
  last30d: number;
  last7d: number;
}

const ITIL_STATUSES = [
  { value: "pending", label: "New", icon: Inbox, color: "text-blue-400", bg: "bg-blue-500/15" },
  { value: "assigned", label: "Assigned", icon: ClipboardCheck, color: "text-indigo-400", bg: "bg-indigo-500/15" },
  { value: "in_progress", label: "In Progress", icon: ArrowRight, color: "text-cyan-400", bg: "bg-cyan-500/15" },
  { value: "on_hold", label: "On Hold", icon: Pause, color: "text-amber-400", bg: "bg-amber-500/15" },
  { value: "pending_approval", label: "Pending Approval", icon: CalendarClock, color: "text-purple-400", bg: "bg-purple-500/15" },
  { value: "fulfilled", label: "Fulfilled", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  { value: "resolved", label: "Closed", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/15" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, color: "text-neutral-400", bg: "bg-neutral-500/15" },
];

const TYPE_OPTIONS = [
  { value: "general", label: "General Request" },
  { value: "access_request", label: "Access Request" },
  { value: "password_reset", label: "Password Reset" },
  { value: "onboarding", label: "Onboarding" },
  { value: "offboarding", label: "Offboarding" },
  { value: "procurement", label: "Procurement" },
  { value: "hardware", label: "Hardware" },
  { value: "software", label: "Software" },
  { value: "network", label: "Network" },
  { value: "change_request", label: "Change Request" },
  { value: "incident", label: "Incident Report" },
  { value: "information", label: "Information" },
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

function HandlerBadge({ handlerType }: { handlerType?: string }) {
  const type = handlerType || "ai";
  const configs: Record<string, { icon: typeof Bot; label: string; className: string }> = {
    ai: { icon: Bot, label: "AI Agent", className: "bg-violet-500/15 text-violet-400 border-violet-500/20" },
    human: { icon: User, label: "Human", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
    collaborative: { icon: Users2, label: "AI + Human", className: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  };
  const cfg = configs[type] || configs.ai;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.className}`} data-testid={`badge-handler-${type}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function SlaIndicator({ deadline, status }: { deadline: string | null; status: string }) {
  if (!deadline || ["fulfilled", "resolved", "cancelled"].includes(status)) return null;
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    const overHours = Math.abs(diffHours);
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400" data-testid="sla-breached">
        <AlertTriangle className="h-3 w-3" />
        SLA Breached ({overHours}h over)
      </span>
    );
  }
  if (diffHours <= 4) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400" data-testid="sla-at-risk">
        <Timer className="h-3 w-3" />
        SLA At Risk ({diffHours}h left)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400" data-testid="sla-on-track">
      <ShieldCheck className="h-3 w-3" />
      On Track ({diffHours}h left)
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

function HandlerBar({ byHandler, onSegmentClick, activeSegment }: { byHandler?: Record<string, number>; onSegmentClick?: (key: string) => void; activeSegment?: string }) {
  if (!byHandler) return null;
  const total = Object.values(byHandler).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments = [
    { key: "ai", label: "AI Agent", color: "bg-violet-500", icon: Bot, count: byHandler.ai || 0 },
    { key: "human", label: "Human", color: "bg-emerald-500", icon: User, count: byHandler.human || 0 },
    { key: "collaborative", label: "AI + Human", color: "bg-blue-500", icon: Users2, count: byHandler.collaborative || 0 },
  ];
  return (
    <div data-testid="handler-distribution">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {segments.map(seg => seg.count > 0 && (
          <div key={seg.key} className={`${seg.color} ${onSegmentClick ? "cursor-pointer hover:opacity-80" : ""} ${activeSegment === seg.key ? "ring-2 ring-primary ring-offset-1" : ""}`} style={{ width: `${(seg.count / total) * 100}%` }} title={`${seg.label}: ${seg.count}`} onClick={() => onSegmentClick?.(seg.key)} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {segments.map(seg => {
          const Icon = seg.icon;
          return (
            <div key={seg.key} className={`flex items-center gap-1.5 text-[10px] transition-all ${onSegmentClick ? "cursor-pointer hover:text-foreground" : ""} ${activeSegment === seg.key ? "text-foreground font-semibold ring-1 ring-primary rounded px-1.5 py-0.5" : "text-muted-foreground"}`} onClick={() => onSegmentClick?.(seg.key)} data-testid={`handler-segment-${seg.key}`}>
              <Icon className="h-3 w-3" />
              {seg.label}: {seg.count}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPipeline({ byStatus, activeStatus, onStatusClick }: { byStatus: Record<string, number>; activeStatus: string; onStatusClick: (status: string) => void }) {
  const stages = ITIL_STATUSES.filter(s => (byStatus[s.value] || 0) > 0 || ["pending", "in_progress", "fulfilled", "resolved"].includes(s.value));
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
    case "pending": return [
      { label: "Assign", status: "assigned", variant: "secondary" },
      { label: "Start Work", status: "in_progress", variant: "default" },
      { label: "Cancel", status: "cancelled", variant: "outline" },
    ];
    case "assigned": return [
      { label: "Start Work", status: "in_progress", variant: "default" },
      { label: "Cancel", status: "cancelled", variant: "outline" },
    ];
    case "in_progress": return [
      { label: "Put On Hold", status: "on_hold", variant: "secondary" },
      { label: "Request Approval", status: "pending_approval", variant: "secondary" },
      { label: "Fulfill", status: "fulfilled", variant: "default" },
    ];
    case "on_hold": return [
      { label: "Resume", status: "in_progress", variant: "default" },
      { label: "Cancel", status: "cancelled", variant: "outline" },
    ];
    case "pending_approval": return [
      { label: "Approve & Fulfill", status: "fulfilled", variant: "default" },
      { label: "Back to Work", status: "in_progress", variant: "secondary" },
    ];
    case "fulfilled": return [
      { label: "Close", status: "resolved", variant: "default" },
      { label: "Reopen", status: "in_progress", variant: "outline" },
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

export default function ServiceRequests() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [handlerFilter, setHandlerFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const { data: requests, isLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests"],
  });

  const { data: stats } = useQuery<SRStats>({
    queryKey: ["/api/service-requests/stats"],
  });

  const { data: aiAgents } = useQuery<{ id: string; name: string; type: string }[]>({
    queryKey: ["/api/agents"],
  });
  const agentName = (id?: string | null) => {
    if (!id || !aiAgents) return null;
    return aiAgents.find(a => a.id === id)?.name || null;
  };

  const form = useForm({
    resolver: zodResolver(createSRSchema),
    defaultValues: { title: "", description: "", type: "general", priority: "medium", status: "pending" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createSRSchema>) => {
      await apiRequest("POST", "/api/service-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Request submitted", description: "Your service request has been created and auto-assigned to the relevant AI agent." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/service-requests/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Request updated" });
    },
  });

  const filtered = (requests ?? []).filter(sr => {
    const matchSearch = !search || sr.title.toLowerCase().includes(search.toLowerCase()) || sr.type.toLowerCase().includes(search.toLowerCase()) || sr.description.toLowerCase().includes(search.toLowerCase());
    const STATUS_GROUPS: Record<string, string[]> = { "group:open": ["pending", "assigned"] };
    const isOverdue = sr.slaDeadline && new Date(sr.slaDeadline) < new Date() && !["fulfilled", "resolved", "cancelled"].includes(sr.status);
    const matchStatus = statusFilter === "all" || (statusFilter === "group:overdue" ? isOverdue : STATUS_GROUPS[statusFilter] ? STATUS_GROUPS[statusFilter].includes(sr.status) : sr.status === statusFilter);
    const matchPriority = priorityFilter === "all" || sr.priority === priorityFilter;
    const matchType = typeFilter === "all" || sr.type === typeFilter;
    const matchHandler = handlerFilter === "all" || sr.handlerType === handlerFilter;
    return matchSearch && matchStatus && matchPriority && matchType && matchHandler;
  }).sort((a, b) => {
    const pOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const statusOrder: Record<string, number> = { pending: 0, assigned: 1, in_progress: 2, on_hold: 3, pending_approval: 4, fulfilled: 5, resolved: 6, cancelled: 7 };
    const sDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (sDiff !== 0) return sDiff;
    const pDiff = (pOrder[a.priority] ?? 9) - (pOrder[b.priority] ?? 9);
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showingStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const showingEnd = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  const selectedRequest = detailId ? requests?.find(r => r.id === detailId) : null;

  const typeLabel = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.label || t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const uniqueTypes = Array.from(new Set(requests?.map(r => r.type) ?? [])).sort();

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-sr-title">Service Request Management</h1>
          <p className="text-sm text-muted-foreground mt-1">ITIL-aligned service request fulfillment and tracking</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-sr">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit Service Request</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} placeholder="Brief description of what you need" data-testid="input-sr-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[80px]" placeholder="Provide detailed information about your request..." data-testid="input-sr-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-sr-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {TYPE_OPTIONS.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-sr-priority"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="critical">P1 - Critical</SelectItem>
                          <SelectItem value="high">P2 - High</SelectItem>
                          <SelectItem value="medium">P3 - Medium</SelectItem>
                          <SelectItem value="low">P4 - Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-sr">
                  {createMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3" data-testid="kpi-grid">
            <KpiCard title="Total Requests" value={stats.total} subtitle={`${stats.last7d} this week`} icon={BarChart3} color="bg-blue-500/15 text-blue-400" trend={`${stats.last30d} in last 30 days`} onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setTypeFilter("all"); setHandlerFilter("all"); setPage(0); }} active={statusFilter === "all" && priorityFilter === "all" && typeFilter === "all" && handlerFilter === "all"} />
            <KpiCard title="Open" value={stats.open} subtitle="Pending + Assigned" icon={Inbox} color="bg-indigo-500/15 text-indigo-400" onClick={() => { setStatusFilter(statusFilter === "group:open" ? "all" : "group:open"); setPage(0); }} active={statusFilter === "group:open"} />
            <KpiCard title="In Progress" value={stats.inProgress} subtitle="Active work" icon={ArrowRight} color="bg-cyan-500/15 text-cyan-400" onClick={() => { setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress"); setPage(0); }} active={statusFilter === "in_progress"} />
            <KpiCard title="Fulfilled" value={stats.fulfilled} subtitle="Completed" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" onClick={() => { setStatusFilter(statusFilter === "fulfilled" ? "all" : "fulfilled"); setPage(0); }} active={statusFilter === "fulfilled"} />
            <KpiCard title="Overdue" value={stats.overdue} subtitle="Past SLA deadline" icon={AlertTriangle} color={stats.overdue > 0 ? "bg-red-500/15 text-red-400" : "bg-muted/30 text-muted-foreground"} onClick={() => { setStatusFilter(statusFilter === "group:overdue" ? "all" : "group:overdue"); setPage(0); }} active={statusFilter === "group:overdue"} />
            <KpiCard title="SLA Compliance" value={`${stats.slaComplianceRate}%`} subtitle="Met target" icon={ShieldCheck} color={stats.slaComplianceRate >= 90 ? "bg-emerald-500/15 text-emerald-400" : stats.slaComplianceRate >= 70 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"} />
            <KpiCard title="Avg Resolution" value={stats.avgResolutionHours > 0 ? `${stats.avgResolutionHours}h` : "N/A"} subtitle="Mean time to fulfill" icon={Timer} color="bg-purple-500/15 text-purple-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card className="border-border/50 lg:col-span-2">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">ITIL Fulfillment Pipeline</p>
                <StatusPipeline byStatus={stats.byStatus} activeStatus={statusFilter} onStatusClick={(s) => { setStatusFilter(s); setPage(0); }} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Handler Distribution</p>
                <HandlerBar byHandler={stats.byHandler} onSegmentClick={(k) => { setHandlerFilter(handlerFilter === k ? "all" : k); setPage(0); }} activeSegment={handlerFilter !== "all" ? handlerFilter : undefined} />
              </CardContent>
            </Card>
          </div>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Priority Distribution</p>
              <PriorityBar byPriority={stats.byPriority} onSegmentClick={(k) => { setPriorityFilter(priorityFilter === k ? "all" : k); setPage(0); }} activeSegment={priorityFilter !== "all" ? priorityFilter : undefined} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Request Queue</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{filtered.length} requests</Badge>
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
                placeholder="Search requests by title, description, or type..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
                data-testid="input-search-sr"
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
                  <SelectItem value="critical">P1 - Critical</SelectItem>
                  <SelectItem value="high">P2 - High</SelectItem>
                  <SelectItem value="medium">P3 - Medium</SelectItem>
                  <SelectItem value="low">P4 - Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueTypes.map(t => (
                    <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(priorityFilter !== "all" || typeFilter !== "all" || handlerFilter !== "all") && (
                <Button size="sm" variant="ghost" onClick={() => { setPriorityFilter("all"); setTypeFilter("all"); setHandlerFilter("all"); setPage(0); }} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Headphones className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No service requests match your filters</p>
            </div>
          ) : (
            <div className="border border-border/40 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_100px_90px_150px_110px_120px_130px] gap-2 px-4 py-2 bg-muted/20 border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Request</span>
                <span>Priority</span>
                <span>Category</span>
                <span>Handler</span>
                <span>Assignee</span>
                <span>Status</span>
                <span>SLA</span>
                <span className="text-right">Actions</span>
              </div>
              {paged.map(sr => (
                <div
                  key={sr.id}
                  className="grid grid-cols-[1fr_90px_100px_90px_150px_110px_120px_130px] gap-2 px-4 py-3 border-b border-border/20 hover:bg-muted/10 transition-colors items-center cursor-pointer"
                  onClick={() => setDetailId(sr.id)}
                  data-testid={`row-sr-${sr.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{sr.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{sr.description}</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {timeSince(sr.createdAt)}
                    </span>
                  </div>
                  <div><PriorityBadge priority={sr.priority} /></div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{typeLabel(sr.type)}</Badge>
                    {sr.linkedIncidentId && (
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5" data-testid={`badge-linked-incident-${sr.id}`}>
                        <ShieldAlert className="h-2.5 w-2.5" />
                        INC
                      </Badge>
                    )}
                  </div>
                  <div><HandlerBadge handlerType={sr.handlerType} /></div>
                  <div className="min-w-0">
                    {sr.handlerType === "human" && sr.assignedHumanName ? (
                      <Badge variant="secondary" className="text-[10px] gap-1 truncate max-w-full" data-testid={`badge-human-${sr.id}`}>
                        <User className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{sr.assignedHumanName}</span>
                      </Badge>
                    ) : sr.handlerType === "collaborative" ? (
                      <div className="flex flex-col gap-0.5">
                        {agentName(sr.assignedAgentId) && (
                          <Badge variant="secondary" className="text-[10px] gap-1 truncate max-w-full" data-testid={`badge-agent-${sr.id}`}>
                            <Bot className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{agentName(sr.assignedAgentId)}</span>
                          </Badge>
                        )}
                        {sr.assignedHumanName && (
                          <Badge variant="outline" className="text-[10px] gap-1 truncate max-w-full border-emerald-500/30 text-emerald-400" data-testid={`badge-human-${sr.id}`}>
                            <User className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{sr.assignedHumanName}</span>
                          </Badge>
                        )}
                      </div>
                    ) : agentName(sr.assignedAgentId) ? (
                      <Badge variant="secondary" className="text-[10px] gap-1 truncate max-w-full" data-testid={`badge-agent-${sr.id}`}>
                        <Bot className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{agentName(sr.assignedAgentId)}</span>
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                  <div><StatusBadge status={sr.status} /></div>
                  <div><SlaIndicator deadline={sr.slaDeadline as string | null} status={sr.status} /></div>
                  <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {getNextActions(sr.status).slice(0, 2).map(action => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant={action.variant}
                        className="text-[10px] h-7 px-2"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: sr.id, status: action.status })}
                        data-testid={`button-action-${action.status}-${sr.id}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {getNextActions(sr.status).length > 2 && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDetailId(sr.id)} data-testid={`button-more-${sr.id}`}>
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 flex-wrap pt-2" data-testid="pagination-sr">
              <span className="text-sm text-muted-foreground" data-testid="text-sr-showing">
                Showing {showingStart}-{showingEnd} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" disabled={safePage === 0} onClick={() => setPage(p => p - 1)} data-testid="button-sr-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button key={i} size="sm" variant={i === safePage ? "default" : "outline"} onClick={() => setPage(i)} data-testid={`button-sr-page-${i}`}>
                    {i + 1}
                  </Button>
                ))}
                <Button size="icon" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-sr-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <span>{selectedRequest.title}</span>
                  <PriorityBadge priority={selectedRequest.priority} />
                  <StatusBadge status={selectedRequest.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                  <p className="text-sm leading-relaxed">{selectedRequest.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Category</p>
                    <Badge variant="outline">{typeLabel(selectedRequest.type)}</Badge>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Handler</p>
                    <HandlerBadge handlerType={selectedRequest.handlerType} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">AI Agent</p>
                    {agentName(selectedRequest.assignedAgentId) ? (
                      <Badge variant="secondary" className="gap-1" data-testid="badge-detail-agent">
                        <Bot className="h-3 w-3" />
                        {agentName(selectedRequest.assignedAgentId)}
                      </Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground">N/A</p>
                    )}
                  </div>
                  {(selectedRequest.handlerType === "human" || selectedRequest.handlerType === "collaborative") && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Human Assignee</p>
                      {selectedRequest.assignedHumanName ? (
                        <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-400" data-testid="badge-detail-human">
                          <User className="h-3 w-3" />
                          {selectedRequest.assignedHumanName}
                        </Badge>
                      ) : (
                        <p className="text-sm text-muted-foreground">Pending assignment</p>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                    <p className="text-sm">{formatTimestamp(selectedRequest.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Last Updated</p>
                    <p className="text-sm">{formatTimestamp(selectedRequest.updatedAt)}</p>
                  </div>
                  {selectedRequest.slaDeadline && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">SLA Deadline</p>
                      <p className="text-sm">{formatTimestamp(selectedRequest.slaDeadline)}</p>
                      <SlaIndicator deadline={selectedRequest.slaDeadline as string} status={selectedRequest.status} />
                    </div>
                  )}
                  {selectedRequest.resolvedAt && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Resolved At</p>
                      <p className="text-sm">{formatTimestamp(selectedRequest.resolvedAt)}</p>
                    </div>
                  )}
                </div>

                {selectedRequest.linkedIncidentId && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-3 flex items-center gap-3">
                      <ShieldAlert className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Linked Incident</p>
                        <p className="text-sm">An incident was automatically created from this report.</p>
                      </div>
                      <Link href="/incidents" data-testid="link-view-linked-incident">
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5" />
                          View Incident
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                )}

                {selectedRequest.resolvedAt && selectedRequest.createdAt && (
                  <Card className="border-border/50 bg-muted/10">
                    <CardContent className="p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Resolution Time</p>
                      <p className="text-lg font-bold">
                        {(() => {
                          const ms = new Date(selectedRequest.resolvedAt).getTime() - new Date(selectedRequest.createdAt).getTime();
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
                    {getNextActions(selectedRequest.status).map(action => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        disabled={updateMutation.isPending}
                        onClick={() => { updateMutation.mutate({ id: selectedRequest.id, status: action.status }); setDetailId(null); }}
                        data-testid={`button-detail-${action.status}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {getNextActions(selectedRequest.status).length === 0 && (
                      <p className="text-sm text-muted-foreground">This request is in a terminal state. No further actions available.</p>
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
