import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ChangeRequest } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertChangeRequestSchema } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
import {
  GitBranch, Shield, CheckCircle2, Clock, XCircle, ChevronLeft, ChevronRight,
  Search, AlertTriangle, BarChart3, TrendingUp, Calendar, FileText,
  ArrowRight, Filter, MoreHorizontal, Send, Eye, CalendarCheck, Play,
  Lock, Ban, Plus
} from "lucide-react";

const createChangeSchema = insertChangeRequestSchema.pick({
  title: true, description: true, type: true, priority: true, riskLevel: true,
  impactAssessment: true, rollbackPlan: true,
}).extend({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  type: z.string().min(1, "Type is required"),
  impactAssessment: z.string().optional(),
  rollbackPlan: z.string().optional(),
});

interface ChangeStats {
  total: number;
  pendingReview: number;
  approved: number;
  scheduled: number;
  implemented: number;
  rejected: number;
  failed: number;
  highRisk: number;
  byRiskLevel: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  last7d: number;
  last30d: number;
  successRate: number;
}

const ITIL_STATUSES = [
  { value: "draft", label: "Draft", icon: FileText, color: "text-gray-400", bg: "bg-gray-500/15" },
  { value: "submitted", label: "Submitted", icon: Send, color: "text-blue-400", bg: "bg-blue-500/15" },
  { value: "under_review", label: "Under Review", icon: Eye, color: "text-yellow-400", bg: "bg-yellow-500/15" },
  { value: "approved", label: "Approved", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/15" },
  { value: "scheduled", label: "Scheduled", icon: CalendarCheck, color: "text-purple-400", bg: "bg-purple-500/15" },
  { value: "implemented", label: "Implemented", icon: Play, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  { value: "closed", label: "Closed", icon: Lock, color: "text-neutral-400", bg: "bg-neutral-500/15" },
  { value: "rejected", label: "Rejected", icon: XCircle, color: "text-red-400", bg: "bg-red-500/15" },
  { value: "failed", label: "Failed", icon: Ban, color: "text-red-400", bg: "bg-red-500/15" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, color: "text-neutral-400", bg: "bg-neutral-500/15" },
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

function RiskBadge({ risk }: { risk: string }) {
  const variants: Record<string, string> = {
    high: "bg-red-500/15 text-red-400 border-red-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[risk] || variants.medium}`}>
      {risk}
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

function RiskBar({ byRiskLevel, onSegmentClick, activeSegment }: { byRiskLevel: Record<string, number>; onSegmentClick?: (key: string) => void; activeSegment?: string }) {
  const total = Object.values(byRiskLevel).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments = [
    { key: "high", label: "High", color: "bg-red-500", count: byRiskLevel.high || 0 },
    { key: "medium", label: "Medium", color: "bg-yellow-500", count: byRiskLevel.medium || 0 },
    { key: "low", label: "Low", color: "bg-green-500", count: byRiskLevel.low || 0 },
  ];
  return (
    <div data-testid="risk-distribution">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {segments.map(seg => seg.count > 0 && (
          <div key={seg.key} className={`${seg.color} ${onSegmentClick ? "cursor-pointer hover:opacity-80" : ""} ${activeSegment === seg.key ? "ring-2 ring-primary ring-offset-1" : ""}`} style={{ width: `${(seg.count / total) * 100}%` }} title={`${seg.label}: ${seg.count}`} onClick={() => onSegmentClick?.(seg.key)} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {segments.map(seg => (
          <div key={seg.key} className={`flex items-center gap-1.5 text-[10px] transition-all ${onSegmentClick ? "cursor-pointer hover:text-foreground" : ""} ${activeSegment === seg.key ? "text-foreground font-semibold ring-1 ring-primary rounded px-1.5 py-0.5" : "text-muted-foreground"}`} onClick={() => onSegmentClick?.(seg.key)} data-testid={`risk-segment-${seg.key}`}>
            <span className={`h-2 w-2 rounded-full ${seg.color}`} />
            {seg.label}: {seg.count}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangePipeline({ byStatus, activeStatus, onStatusClick }: { byStatus: Record<string, number>; activeStatus: string; onStatusClick: (status: string) => void }) {
  const stages = ITIL_STATUSES.filter(s =>
    (byStatus[s.value] || 0) > 0 ||
    ["draft", "submitted", "under_review", "approved", "scheduled", "implemented", "closed"].includes(s.value)
  );
  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="change-pipeline">
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
    case "draft": return [
      { label: "Submit", status: "submitted", variant: "default" },
      { label: "Cancel", status: "cancelled", variant: "outline" },
    ];
    case "submitted": return [
      { label: "Review", status: "under_review", variant: "default" },
      { label: "Return to Draft", status: "draft", variant: "outline" },
    ];
    case "under_review": return [
      { label: "Approve", status: "approved", variant: "default" },
      { label: "Reject", status: "rejected", variant: "destructive" },
    ];
    case "approved": return [
      { label: "Schedule", status: "scheduled", variant: "default" },
      { label: "Cancel", status: "cancelled", variant: "outline" },
    ];
    case "scheduled": return [
      { label: "Implement", status: "implemented", variant: "default" },
      { label: "Cancel", status: "cancelled", variant: "outline" },
    ];
    case "implemented": return [
      { label: "Close", status: "closed", variant: "default" },
      { label: "Mark Failed", status: "failed", variant: "destructive" },
    ];
    case "failed": return [
      { label: "Reopen as Draft", status: "draft", variant: "secondary" },
    ];
    case "rejected": return [
      { label: "Reopen as Draft", status: "draft", variant: "secondary" },
    ];
    case "cancelled": return [
      { label: "Reopen as Draft", status: "draft", variant: "secondary" },
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

function formatSchedule(start: string | Date | null, end: string | Date | null) {
  if (!start) return null;
  const s = new Date(start);
  const dateStr = s.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timeStr = s.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  if (end) {
    const e = new Date(end);
    const endTime = e.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    return `${dateStr} ${timeStr} - ${endTime}`;
  }
  return `${dateStr} ${timeStr}`;
}

const PAGE_SIZE = 10;

const STATUS_ORDER: Record<string, number> = {
  draft: 0, submitted: 1, under_review: 2, approved: 3, scheduled: 4,
  implemented: 5, closed: 6, rejected: 7, failed: 8, cancelled: 9,
};

const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const TYPE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "standard", label: "Standard" },
  { value: "emergency", label: "Emergency" },
];

export default function Changes() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const { data: changes, isLoading } = useQuery<ChangeRequest[]>({
    queryKey: ["/api/change-requests"],
  });

  const { data: stats } = useQuery<ChangeStats>({
    queryKey: ["/api/change-requests/stats"],
  });

  const form = useForm({
    resolver: zodResolver(createChangeSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "normal",
      priority: "medium",
      riskLevel: "low",
      impactAssessment: "",
      rollbackPlan: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createChangeSchema>) => {
      await apiRequest("POST", "/api/change-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/change-requests/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Change request created", description: "The change request has been drafted for review." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/change-requests/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/change-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/change-requests/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Change request updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filtered = (changes ?? []).filter(cr => {
    const matchSearch = !search || cr.title.toLowerCase().includes(search.toLowerCase()) || (cr.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const STATUS_GROUPS: Record<string, string[]> = {
      "group:pending": ["draft", "submitted", "under_review"],
      "group:completed": ["implemented", "closed"],
      "group:unsuccessful": ["rejected", "failed"],
    };
    const matchStatus = statusFilter === "all" || (STATUS_GROUPS[statusFilter] ? STATUS_GROUPS[statusFilter].includes(cr.status) : cr.status === statusFilter);
    const matchRisk = riskFilter === "all" || cr.riskLevel === riskFilter;
    const matchType = typeFilter === "all" || cr.type === typeFilter;
    return matchSearch && matchStatus && matchRisk && matchType;
  }).sort((a, b) => {
    const sDiff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (sDiff !== 0) return sDiff;
    const rDiff = (RISK_ORDER[a.riskLevel] ?? 9) - (RISK_ORDER[b.riskLevel] ?? 9);
    if (rDiff !== 0) return rDiff;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showingStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const showingEnd = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  const selectedChange = detailId ? changes?.find(c => c.id === detailId) : null;

  const typeLabel = (t: string) => TYPE_OPTIONS.find(o => o.value === t)?.label || t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Change Management</h1>
          <p className="text-sm text-muted-foreground mt-1">ITIL-aligned change requests, approvals, impact assessment, and implementation tracking</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-change">
              <Plus className="h-4 w-4 mr-2" />
              New Change Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit Change Request</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input {...field} placeholder="Brief change summary" data-testid="input-change-title" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[80px]" placeholder="What is being changed and why" data-testid="input-change-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-change-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="emergency">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="priority" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-change-priority"><SelectValue /></SelectTrigger></FormControl>
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
                  <FormField control={form.control} name="riskLevel" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risk Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-change-risk"><SelectValue /></SelectTrigger></FormControl>
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
                </div>
                <FormField control={form.control} name="impactAssessment" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Impact Assessment <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[60px]" placeholder="Potential impact on services and users" data-testid="input-change-impact" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="rollbackPlan" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rollback Plan <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[60px]" placeholder="Steps to revert if the change fails" data-testid="input-change-rollback" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-change">
                  {createMutation.isPending ? "Creating..." : "Submit Change Request"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3" data-testid="kpi-grid">
            <KpiCard title="Total Changes" value={stats.total} subtitle={`${stats.last7d} this week`} icon={BarChart3} color="bg-blue-500/15 text-blue-400" trend={`${stats.last30d} in last 30 days`} onClick={() => { setStatusFilter("all"); setRiskFilter("all"); setTypeFilter("all"); setPage(0); }} active={statusFilter === "all" && riskFilter === "all" && typeFilter === "all"} />
            <KpiCard title="Pending Review" value={stats.pendingReview} subtitle="Draft + Submitted + Review" icon={Eye} color="bg-yellow-500/15 text-yellow-400" onClick={() => { setStatusFilter(statusFilter === "group:pending" ? "all" : "group:pending"); setPage(0); }} active={statusFilter === "group:pending"} />
            <KpiCard title="Approved" value={stats.approved} subtitle="Ready to schedule" icon={CheckCircle2} color="bg-green-500/15 text-green-400" onClick={() => { setStatusFilter(statusFilter === "approved" ? "all" : "approved"); setPage(0); }} active={statusFilter === "approved"} />
            <KpiCard title="Scheduled" value={stats.scheduled} subtitle="Awaiting implementation" icon={CalendarCheck} color="bg-purple-500/15 text-purple-400" onClick={() => { setStatusFilter(statusFilter === "scheduled" ? "all" : "scheduled"); setPage(0); }} active={statusFilter === "scheduled"} />
            <KpiCard title="Completed" value={stats.implemented} subtitle="Implemented + Closed" icon={Play} color="bg-emerald-500/15 text-emerald-400" onClick={() => { setStatusFilter(statusFilter === "group:completed" ? "all" : "group:completed"); setPage(0); }} active={statusFilter === "group:completed"} />
            <KpiCard title="Rejected/Failed" value={stats.rejected + stats.failed} subtitle="Unsuccessful" icon={XCircle} color={(stats.rejected + stats.failed) > 0 ? "bg-red-500/15 text-red-400" : "bg-muted/30 text-muted-foreground"} onClick={() => { setStatusFilter(statusFilter === "group:unsuccessful" ? "all" : "group:unsuccessful"); setPage(0); }} active={statusFilter === "group:unsuccessful"} />
            <KpiCard title="High Risk" value={stats.highRisk} subtitle="Requires attention" icon={AlertTriangle} color={stats.highRisk > 0 ? "bg-red-500/15 text-red-400" : "bg-muted/30 text-muted-foreground"} onClick={() => { setRiskFilter(riskFilter === "high" ? "all" : "high"); setPage(0); }} active={riskFilter === "high"} />
            <KpiCard title="Success Rate" value={`${stats.successRate}%`} subtitle="Completed successfully" icon={Shield} color={stats.successRate >= 90 ? "bg-emerald-500/15 text-emerald-400" : stats.successRate >= 70 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">ITIL Change Pipeline</p>
                <ChangePipeline byStatus={stats.byStatus} activeStatus={statusFilter} onStatusClick={(s) => { setStatusFilter(s); setPage(0); }} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Risk Level Distribution</p>
                <RiskBar byRiskLevel={stats.byRiskLevel} onSegmentClick={(k) => { setRiskFilter(riskFilter === k ? "all" : k); setPage(0); }} activeSegment={riskFilter !== "all" ? riskFilter : undefined} />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      )}

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Change Request Queue</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{filtered.length} changes</Badge>
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
                placeholder="Search change requests by title or description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
                data-testid="input-search-changes"
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
              <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-risk">
                  <SelectValue placeholder="All Risk Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TYPE_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(riskFilter !== "all" || typeFilter !== "all") && (
                <Button size="sm" variant="ghost" onClick={() => { setRiskFilter("all"); setTypeFilter("all"); setPage(0); }} data-testid="button-clear-filters">
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <GitBranch className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No change requests match your filters</p>
            </div>
          ) : (
            <div className="border border-border/40 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_90px_120px_150px_130px] gap-2 px-4 py-2 bg-muted/20 border-b border-border/30 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Change Request</span>
                <span>Risk Level</span>
                <span>Type</span>
                <span>Status</span>
                <span>Schedule</span>
                <span className="text-right">Actions</span>
              </div>
              {paged.map(cr => (
                <div
                  key={cr.id}
                  className="grid grid-cols-[1fr_90px_90px_120px_150px_130px] gap-2 px-4 py-3 border-b border-border/20 hover:bg-muted/10 transition-colors items-center cursor-pointer"
                  onClick={() => setDetailId(cr.id)}
                  data-testid={`row-change-${cr.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-change-title-${cr.id}`}>{cr.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{cr.description}</p>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      {timeSince(cr.createdAt)}
                    </span>
                  </div>
                  <div><RiskBadge risk={cr.riskLevel} /></div>
                  <div><Badge variant="outline" className="text-[10px]">{typeLabel(cr.type)}</Badge></div>
                  <div><StatusBadge status={cr.status} /></div>
                  <div>
                    {cr.scheduledStart ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatSchedule(cr.scheduledStart, cr.scheduledEnd)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Not scheduled</span>
                    )}
                  </div>
                  <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                    {getNextActions(cr.status).slice(0, 2).map(action => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant={action.variant}
                        className="text-[10px] h-7 px-2"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: cr.id, status: action.status })}
                        data-testid={`button-action-${action.status}-${cr.id}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {getNextActions(cr.status).length > 2 && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDetailId(cr.id)} data-testid={`button-more-${cr.id}`}>
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 flex-wrap pt-2" data-testid="pagination-changes">
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

      <Dialog open={!!selectedChange} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedChange && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <span>{selectedChange.title}</span>
                  <RiskBadge risk={selectedChange.riskLevel} />
                  <StatusBadge status={selectedChange.status} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-2">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Description</p>
                  <p className="text-sm leading-relaxed">{selectedChange.description}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Type</p>
                    <Badge variant="outline">{typeLabel(selectedChange.type)}</Badge>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Priority</p>
                    <Badge variant="outline">{selectedChange.priority}</Badge>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                    <p className="text-sm">{formatTimestamp(selectedChange.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Last Updated</p>
                    <p className="text-sm">{formatTimestamp(selectedChange.updatedAt)}</p>
                  </div>
                  {selectedChange.approvedBy && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Approved By</p>
                      <p className="text-sm">{selectedChange.approvedBy}</p>
                    </div>
                  )}
                  {selectedChange.implementedBy && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Implemented By</p>
                      <p className="text-sm">{selectedChange.implementedBy}</p>
                    </div>
                  )}
                </div>

                {(selectedChange.scheduledStart || selectedChange.scheduledEnd) && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Schedule</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {selectedChange.scheduledStart && <span>Start: {formatTimestamp(selectedChange.scheduledStart)}</span>}
                      {selectedChange.scheduledEnd && <span>End: {formatTimestamp(selectedChange.scheduledEnd)}</span>}
                    </div>
                  </div>
                )}

                {selectedChange.impactAssessment && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Impact Assessment
                    </p>
                    <p className="text-sm bg-muted/30 p-3 rounded-md">{selectedChange.impactAssessment}</p>
                  </div>
                )}

                {selectedChange.rollbackPlan && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Rollback Plan
                    </p>
                    <p className="text-sm bg-blue-500/5 p-3 rounded-md border border-blue-500/10">{selectedChange.rollbackPlan}</p>
                  </div>
                )}

                {selectedChange.affectedCIs && selectedChange.affectedCIs.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Affected Configuration Items</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedChange.affectedCIs.map(ci => <Badge key={ci} variant="secondary" className="text-xs font-mono">{ci}</Badge>)}
                    </div>
                  </div>
                )}

                {selectedChange.completedAt && selectedChange.createdAt && (
                  <Card className="border-border/50 bg-muted/10">
                    <CardContent className="p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Time to Completion</p>
                      <p className="text-lg font-bold">
                        {(() => {
                          const ms = new Date(selectedChange.completedAt).getTime() - new Date(selectedChange.createdAt).getTime();
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
                    {getNextActions(selectedChange.status).map(action => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        disabled={updateMutation.isPending}
                        onClick={() => { updateMutation.mutate({ id: selectedChange.id, status: action.status }); setDetailId(null); }}
                        data-testid={`button-detail-${action.status}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                    {getNextActions(selectedChange.status).length === 0 && (
                      <p className="text-sm text-muted-foreground">This change request is in a terminal state. No further actions available.</p>
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
