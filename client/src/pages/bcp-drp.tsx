import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertBcpPlanSchema, insertDrpPlanSchema } from "@shared/schema";
import type { BcpPlan, DrpPlan } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield, AlertTriangle, Clock, CheckCircle2, XCircle, Server, Database,
  Zap, FileText, Plus, Search, Eye, Activity, RefreshCw, ShieldCheck,
  CloudOff, HardDrive, ChevronLeft, ChevronRight, Inbox,
  BarChart3, Target, ClipboardCheck, BookOpen
} from "lucide-react";
import { useState } from "react";
import { BiaTabContent, RiskTabContent, DrillsTabContent, ReviewsTabContent } from "./bcp-lifecycle-tabs";

const PAGE_SIZE = 10;

const BCP_STATUSES = ["draft", "under_review", "approved", "active", "expired"];
const DRP_STATUSES = ["draft", "under_review", "approved", "active", "testing"];
const BCP_CATEGORIES = ["operational", "financial", "technology", "personnel", "facilities"];
const IMPACT_LEVELS = ["critical", "high", "medium", "low"];
const DISASTER_TYPES = ["natural_disaster", "cyber_attack", "hardware_failure", "power_outage", "data_breach", "network_failure", "pandemic", "other"];
const SEVERITIES = ["critical", "high", "medium", "low"];
const TEST_RESULTS = ["passed", "failed", "partial", "not_tested"];

interface BcpStats {
  total: number;
  active: number;
  underReview: number;
  approved: number;
  expired: number;
  avgRtoHours: number;
  byStatus: Record<string, number>;
  byImpact: Record<string, number>;
}

interface DrpStats {
  total: number;
  active: number;
  inTesting: number;
  testsPassed: number;
  untested: number;
  avgRtoHours: number;
  byStatus: Record<string, number>;
  byDisasterType: Record<string, number>;
}

function KpiCard({ title, value, subtitle, icon: Icon, color, onClick, active }: { title: string; value: string | number; subtitle: string; icon: any; color: string; onClick?: () => void; active?: boolean }) {
  return (
    <Card className={`border-border/50 transition-all ${onClick ? "cursor-pointer hover:border-primary/40" : ""} ${active ? "ring-2 ring-primary" : ""}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
          <div>
            <p className="text-2xl font-bold" data-testid={`text-kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xs text-muted-foreground/60">{subtitle}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPipeline({ stages, counts, onStatusClick, activeStatus }: { stages: string[]; counts: Record<string, number>; onStatusClick?: (status: string) => void; activeStatus?: string }) {
  return (
    <div className="flex items-center gap-1 w-full flex-wrap" data-testid="status-pipeline">
      {stages.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-1 min-w-[100px]">
          <div
            className={`flex-1 bg-muted/20 rounded px-3 py-2 text-center border transition-all ${onStatusClick ? "cursor-pointer hover:border-primary/40" : ""} ${activeStatus === s ? "ring-2 ring-primary border-primary/40" : "border-border/50"}`}
            onClick={() => onStatusClick?.(s)}
            data-testid={`pipeline-stage-${s}`}
          >
            <p className="text-xs text-muted-foreground">{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
            <p className="text-lg font-bold">{counts[s] || 0}</p>
          </div>
          {i < stages.length - 1 && <span className="text-muted-foreground/40">→</span>}
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    draft: "bg-gray-500/15 text-gray-400",
    under_review: "bg-amber-500/15 text-amber-400",
    approved: "bg-blue-500/15 text-blue-400",
    active: "bg-emerald-500/15 text-emerald-400",
    expired: "bg-red-500/15 text-red-400",
    testing: "bg-purple-500/15 text-purple-400",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[status] || variants.draft}`} data-testid={`badge-status-${status}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function ImpactBadge({ level }: { level: string }) {
  const variants: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/20",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/15 text-green-400 border-green-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[level] || variants.medium}`} data-testid={`badge-impact-${level}`}>
      {level}
    </span>
  );
}

function TestResultBadge({ result }: { result: string }) {
  const variants: Record<string, string> = {
    passed: "bg-green-500/15 text-green-400",
    failed: "bg-red-500/15 text-red-400",
    partial: "bg-yellow-500/15 text-yellow-400",
    not_tested: "bg-gray-500/15 text-gray-400",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${variants[result] || variants.not_tested}`} data-testid={`badge-test-result-${result}`}>
      {result.replace(/_/g, ' ')}
    </span>
  );
}

function DistributionBar({ segments, onSegmentClick, activeSegment }: { segments: { key: string; label: string; color: string; count: number }[]; onSegmentClick?: (key: string) => void; activeSegment?: string }) {
  const total = segments.reduce((s, v) => s + v.count, 0);
  if (total === 0) return null;
  return (
    <div data-testid="distribution-bar">
      <div className="flex h-2 rounded-full overflow-hidden bg-muted/30">
        {segments.map(seg => seg.count > 0 && (
          <div
            key={seg.key}
            className={`${seg.color} ${onSegmentClick ? "cursor-pointer hover:opacity-80" : ""} ${activeSegment === seg.key ? "ring-2 ring-primary ring-offset-1" : ""}`}
            style={{ width: `${(seg.count / total) * 100}%` }}
            title={`${seg.label}: ${seg.count}`}
            onClick={() => onSegmentClick?.(seg.key)}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {segments.map(seg => (
          <div
            key={seg.key}
            className={`flex items-center gap-1.5 text-[10px] transition-all ${onSegmentClick ? "cursor-pointer hover:text-foreground" : ""} ${activeSegment === seg.key ? "text-foreground font-semibold ring-1 ring-primary rounded px-1.5 py-0.5" : "text-muted-foreground"}`}
            onClick={() => onSegmentClick?.(seg.key)}
            data-testid={`distribution-segment-${seg.key}`}
          >
            <span className={`h-2 w-2 rounded-full ${seg.color}`} />
            {seg.label}: {seg.count}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(ts: string | Date | null) {
  if (!ts) return "Never";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getBcpNextActions(status: string): { label: string; status: string; variant: "default" | "secondary" | "outline" }[] {
  switch (status) {
    case "draft": return [{ label: "Submit for Review", status: "under_review", variant: "secondary" }];
    case "under_review": return [{ label: "Approve", status: "approved", variant: "default" }, { label: "Return to Draft", status: "draft", variant: "outline" }];
    case "approved": return [{ label: "Activate", status: "active", variant: "default" }];
    case "active": return [{ label: "Mark Expired", status: "expired", variant: "outline" }];
    case "expired": return [{ label: "Return to Draft", status: "draft", variant: "outline" }];
    default: return [];
  }
}

function getDrpNextActions(status: string): { label: string; status: string; variant: "default" | "secondary" | "outline" }[] {
  switch (status) {
    case "draft": return [{ label: "Submit for Review", status: "under_review", variant: "secondary" }];
    case "under_review": return [{ label: "Approve", status: "approved", variant: "default" }, { label: "Return to Draft", status: "draft", variant: "outline" }];
    case "approved": return [{ label: "Activate", status: "active", variant: "default" }];
    case "active": return [{ label: "Start Testing", status: "testing", variant: "secondary" }];
    case "testing": return [{ label: "Return to Active", status: "active", variant: "outline" }];
    default: return [];
  }
}

const createBcpSchema = insertBcpPlanSchema.extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  businessImpactLevel: z.string().min(1, "Impact level is required"),
  rtoHours: z.coerce.number().min(0),
  rpoHours: z.coerce.number().min(0),
  recoveryStrategy: z.string().min(1, "Recovery strategy is required"),
  owner: z.string().min(1, "Owner is required"),
  priority: z.string().default("medium"),
  criticalProcesses: z.string().optional(),
  stakeholders: z.string().optional(),
});

const createDrpSchema = insertDrpPlanSchema.extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  disasterType: z.string().min(1, "Disaster type is required"),
  severity: z.string().min(1, "Severity is required"),
  rtoHours: z.coerce.number().min(0),
  rpoHours: z.coerce.number().min(0),
  recoveryProcedures: z.string().min(1, "Recovery procedures are required"),
  failoverType: z.string().min(1, "Failover type is required"),
  owner: z.string().min(1, "Owner is required"),
  affectedSystems: z.string().optional(),
});

const TAB_LABELS: Record<string, string> = {
  bcp: "New BCP Plan",
  drp: "New DRP Plan",
  bia: "New BIA Entry",
  risks: "New Risk Assessment",
  drills: "Schedule Drill",
  reviews: "New Review",
};

export default function BcpDrpPage() {
  const [activeTab, setActiveTab] = useState("bcp");
  const [bcpCreateOpen, setBcpCreateOpen] = useState(false);
  const [drpCreateOpen, setDrpCreateOpen] = useState(false);
  const [biaCreateOpen, setBiaCreateOpen] = useState(false);
  const [riskCreateOpen, setRiskCreateOpen] = useState(false);
  const [drillCreateOpen, setDrillCreateOpen] = useState(false);
  const [reviewCreateOpen, setReviewCreateOpen] = useState(false);

  const openCreateDialog = () => {
    const map: Record<string, () => void> = {
      bcp: () => setBcpCreateOpen(true),
      drp: () => setDrpCreateOpen(true),
      bia: () => setBiaCreateOpen(true),
      risks: () => setRiskCreateOpen(true),
      drills: () => setDrillCreateOpen(true),
      reviews: () => setReviewCreateOpen(true),
    };
    map[activeTab]?.();
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-bcp-drp-title">Business Continuity & Disaster Recovery</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage BCP and DRP plans for organizational resilience</p>
        </div>
        <Button onClick={openCreateDialog} data-testid="button-create-plan">
          <Plus className="h-4 w-4 mr-2" />
          {TAB_LABELS[activeTab] || "New"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1" data-testid="tabs-bcp-drp">
          <TabsTrigger value="bcp" data-testid="tab-bcp">
            <Shield className="h-4 w-4 mr-2" />
            BCP Plans
          </TabsTrigger>
          <TabsTrigger value="drp" data-testid="tab-drp">
            <CloudOff className="h-4 w-4 mr-2" />
            DRP Plans
          </TabsTrigger>
          <TabsTrigger value="bia" data-testid="tab-bia">
            <BarChart3 className="h-4 w-4 mr-2" />
            Impact Analysis
          </TabsTrigger>
          <TabsTrigger value="risks" data-testid="tab-risks">
            <Target className="h-4 w-4 mr-2" />
            Risk Register
          </TabsTrigger>
          <TabsTrigger value="drills" data-testid="tab-drills">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Drills & Exercises
          </TabsTrigger>
          <TabsTrigger value="reviews" data-testid="tab-reviews">
            <BookOpen className="h-4 w-4 mr-2" />
            Reviews
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bcp">
          <BcpTabContent open={bcpCreateOpen} setOpen={setBcpCreateOpen} />
        </TabsContent>
        <TabsContent value="drp">
          <DrpTabContent open={drpCreateOpen} setOpen={setDrpCreateOpen} />
        </TabsContent>
        <TabsContent value="bia">
          <BiaTabContent open={biaCreateOpen} setOpen={setBiaCreateOpen} />
        </TabsContent>
        <TabsContent value="risks">
          <RiskTabContent open={riskCreateOpen} setOpen={setRiskCreateOpen} />
        </TabsContent>
        <TabsContent value="drills">
          <DrillsTabContent open={drillCreateOpen} setOpen={setDrillCreateOpen} />
        </TabsContent>
        <TabsContent value="reviews">
          <ReviewsTabContent open={reviewCreateOpen} setOpen={setReviewCreateOpen} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BcpTabContent({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [impactFilter, setImpactFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [detailPlan, setDetailPlan] = useState<BcpPlan | null>(null);

  const { data: plans, isLoading } = useQuery<BcpPlan[]>({ queryKey: ["/api/bcp-plans"] });
  const { data: stats } = useQuery<BcpStats>({ queryKey: ["/api/bcp-plans/stats"] });

  const form = useForm({
    resolver: zodResolver(createBcpSchema),
    defaultValues: {
      title: "", description: "", category: "operational", businessImpactLevel: "medium",
      rtoHours: 4, rpoHours: 1, criticalProcesses: "", recoveryStrategy: "",
      stakeholders: "", owner: "", priority: "medium", userId: "system", status: "draft",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        criticalProcesses: typeof data.criticalProcesses === "string"
          ? data.criticalProcesses.split(",").map((s: string) => s.trim()).filter(Boolean)
          : data.criticalProcesses || [],
        stakeholders: typeof data.stakeholders === "string"
          ? data.stakeholders.split(",").map((s: string) => s.trim()).filter(Boolean)
          : data.stakeholders || [],
      };
      await apiRequest("POST", "/api/bcp-plans", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bcp-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bcp-plans/stats"] });
      setOpen(false);
      form.reset();
      toast({ title: "BCP Plan created", description: "The business continuity plan has been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/bcp-plans/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bcp-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bcp-plans/stats"] });
      toast({ title: "BCP Plan updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filtered = (plans ?? []).filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchCategory = categoryFilter === "all" || p.category === categoryFilter;
    const matchImpact = impactFilter === "all" || p.businessImpactLevel === impactFilter;
    return matchSearch && matchStatus && matchCategory && matchImpact;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const impactSegments = [
    { key: "critical", label: "Critical", color: "bg-red-500", count: stats?.byImpact?.critical || 0 },
    { key: "high", label: "High", color: "bg-orange-500", count: stats?.byImpact?.high || 0 },
    { key: "medium", label: "Medium", color: "bg-yellow-500", count: stats?.byImpact?.medium || 0 },
    { key: "low", label: "Low", color: "bg-green-500", count: stats?.byImpact?.low || 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4" data-testid="bcp-description">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Business Continuity Plans (BCP)</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Documents how your organization will continue operating during and after a disruption. Each plan defines critical processes, recovery strategies, RTO/RPO targets, stakeholders, and the plan owner. Plans progress through a lifecycle: Draft, Under Review, Approved, Active, and Expired. Link plans to Impact Analysis entries, Risk Assessments, and Drills for full lifecycle coverage.</p>
          </div>
        </div>
      </div>
      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="bcp-kpi-grid">
            <KpiCard title="Total Plans" value={stats.total} subtitle="All BCP plans" icon={FileText} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter("all"); setImpactFilter("all"); setCategoryFilter("all"); setPage(0); }} active={statusFilter === "all" && impactFilter === "all" && categoryFilter === "all"} />
            <KpiCard title="Active" value={stats.active} subtitle="Currently active" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" onClick={() => { setStatusFilter(statusFilter === "active" ? "all" : "active"); setPage(0); }} active={statusFilter === "active"} />
            <KpiCard title="Under Review" value={stats.underReview} subtitle="Pending review" icon={Eye} color="bg-amber-500/15 text-amber-400" onClick={() => { setStatusFilter(statusFilter === "under_review" ? "all" : "under_review"); setPage(0); }} active={statusFilter === "under_review"} />
            <KpiCard title="Approved" value={stats.approved} subtitle="Ready to activate" icon={ShieldCheck} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter(statusFilter === "approved" ? "all" : "approved"); setPage(0); }} active={statusFilter === "approved"} />
            <KpiCard title="Expired" value={stats.expired} subtitle="Need renewal" icon={XCircle} color="bg-red-500/15 text-red-400" onClick={() => { setStatusFilter(statusFilter === "expired" ? "all" : "expired"); setPage(0); }} active={statusFilter === "expired"} />
            <KpiCard title="Avg RTO" value={stats.avgRtoHours > 0 ? `${stats.avgRtoHours}h` : "N/A"} subtitle="Recovery time" icon={Clock} color="bg-purple-500/15 text-purple-400" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">BCP Lifecycle</p>
                <StatusPipeline stages={BCP_STATUSES} counts={stats.byStatus || {}} onStatusClick={(s) => { setStatusFilter(statusFilter === s ? "all" : s); setPage(0); }} activeStatus={statusFilter !== "all" ? statusFilter : undefined} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Impact Level Distribution</p>
                <DistributionBar segments={impactSegments} onSegmentClick={(k) => { setImpactFilter(impactFilter === k ? "all" : k); setPage(0); }} activeSegment={impactFilter !== "all" ? impactFilter : undefined} />
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
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search BCP plans..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-search-bcp" />
              </div>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-bcp-status-filter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {BCP_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-bcp-category-filter"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {BCP_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={impactFilter} onValueChange={v => { setImpactFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-bcp-impact-filter"><SelectValue placeholder="All Impact" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Impact</SelectItem>
                  {IMPACT_LEVELS.map(l => <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="text-[10px]">{filtered.length} plans</Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
          ) : paged.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No BCP plans match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="bcp-table">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Title</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Category</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Impact</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">RTO</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">RPO</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Owner</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Last Tested</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(plan => (
                    <tr key={plan.id} className="border-b border-border/30 hover-elevate" data-testid={`row-bcp-${plan.id}`}>
                      <td className="py-2 font-medium max-w-[200px] truncate" data-testid={`text-bcp-title-${plan.id}`}>{plan.title}</td>
                      <td className="py-2"><StatusBadge status={plan.status} /></td>
                      <td className="py-2 text-muted-foreground capitalize">{plan.category}</td>
                      <td className="py-2"><ImpactBadge level={plan.businessImpactLevel} /></td>
                      <td className="py-2 text-muted-foreground">{plan.rtoHours}h</td>
                      <td className="py-2 text-muted-foreground">{plan.rpoHours}h</td>
                      <td className="py-2 text-muted-foreground">{plan.owner}</td>
                      <td className="py-2 text-muted-foreground text-xs">{formatDate(plan.lastTestedAt)}</td>
                      <td className="py-2">
                        <Button size="icon" variant="ghost" onClick={() => setDetailPlan(plan)} data-testid={`button-view-bcp-${plan.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-3" data-testid="bcp-pagination">
              <span className="text-xs text-muted-foreground">
                Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" disabled={safePage === 0} onClick={() => setPage(p => p - 1)} data-testid="button-bcp-prev-page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-3">{safePage + 1}/{totalPages}</span>
                <Button size="icon" variant="outline" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-bcp-next-page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Create BCP Plan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} data-testid="input-bcp-title" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="resize-none min-h-[80px]" data-testid="input-bcp-description" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-bcp-category"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{BCP_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="businessImpactLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Impact Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-bcp-impact"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{IMPACT_LEVELS.map(l => <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="rtoHours" render={({ field }) => (
                  <FormItem><FormLabel>RTO (hours)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-bcp-rto" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rpoHours" render={({ field }) => (
                  <FormItem><FormLabel>RPO (hours)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-bcp-rpo" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="criticalProcesses" render={({ field }) => (
                <FormItem><FormLabel>Critical Processes (comma-separated)</FormLabel><FormControl><Input {...field} placeholder="e.g. Payroll, Email, ERP" data-testid="input-bcp-processes" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="recoveryStrategy" render={({ field }) => (
                <FormItem><FormLabel>Recovery Strategy</FormLabel><FormControl><Textarea {...field} className="resize-none min-h-[80px]" data-testid="input-bcp-recovery" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="stakeholders" render={({ field }) => (
                <FormItem><FormLabel>Stakeholders (comma-separated)</FormLabel><FormControl><Input {...field} placeholder="e.g. IT Director, CFO" data-testid="input-bcp-stakeholders" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="owner" render={({ field }) => (
                  <FormItem><FormLabel>Owner</FormLabel><FormControl><Input {...field} data-testid="input-bcp-owner" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-bcp-priority"><SelectValue /></SelectTrigger></FormControl>
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
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-bcp">
                {createMutation.isPending ? "Creating..." : "Create BCP Plan"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailPlan} onOpenChange={(o) => { if (!o) setDetailPlan(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          {detailPlan && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {detailPlan.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={detailPlan.status} />
                  <ImpactBadge level={detailPlan.businessImpactLevel} />
                  <Badge variant="secondary" className="text-xs capitalize">{detailPlan.category}</Badge>
                  <Badge variant="outline" className="text-xs">{detailPlan.priority} priority</Badge>
                </div>
                <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-bcp-detail-description">
                  {detailPlan.description}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">RTO:</span> <span className="font-medium">{detailPlan.rtoHours} hours</span></div>
                  <div><span className="text-muted-foreground">RPO:</span> <span className="font-medium">{detailPlan.rpoHours} hours</span></div>
                  <div><span className="text-muted-foreground">Owner:</span> <span className="font-medium">{detailPlan.owner}</span></div>
                  <div><span className="text-muted-foreground">Last Tested:</span> <span className="font-medium">{formatDate(detailPlan.lastTestedAt)}</span></div>
                </div>
                {detailPlan.criticalProcesses && detailPlan.criticalProcesses.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Critical Processes</p>
                    <div className="flex flex-wrap gap-1">{detailPlan.criticalProcesses.map((p, i) => <Badge key={i} variant="outline" className="text-xs">{p}</Badge>)}</div>
                  </div>
                )}
                {detailPlan.recoveryStrategy && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Recovery Strategy</p>
                    <p className="text-sm bg-muted/20 rounded p-3">{detailPlan.recoveryStrategy}</p>
                  </div>
                )}
                {detailPlan.stakeholders && detailPlan.stakeholders.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Stakeholders</p>
                    <div className="flex flex-wrap gap-1">{detailPlan.stakeholders.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>)}</div>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/50">
                  {getBcpNextActions(detailPlan.status).map(action => (
                    <Button
                      key={action.status}
                      variant={action.variant}
                      size="sm"
                      disabled={updateMutation.isPending}
                      onClick={() => { updateMutation.mutate({ id: detailPlan.id, status: action.status }); setDetailPlan(null); }}
                      data-testid={`button-bcp-action-${action.status}`}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DrpTabContent({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [disasterTypeFilter, setDisasterTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [testResultFilter, setTestResultFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [detailPlan, setDetailPlan] = useState<DrpPlan | null>(null);

  const { data: plans, isLoading } = useQuery<DrpPlan[]>({ queryKey: ["/api/drp-plans"] });
  const { data: stats } = useQuery<DrpStats>({ queryKey: ["/api/drp-plans/stats"] });
  const { data: bcpPlans } = useQuery<BcpPlan[]>({ queryKey: ["/api/bcp-plans"] });

  const form = useForm({
    resolver: zodResolver(createDrpSchema),
    defaultValues: {
      title: "", description: "", disasterType: "cyber_attack", severity: "medium",
      rtoHours: 4, rpoHours: 1, affectedSystems: "", recoveryProcedures: "",
      failoverType: "manual", failoverTarget: "", backupLocation: "",
      bcpPlanId: "", owner: "", userId: "system", status: "draft", testResult: "not_tested",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = {
        ...data,
        affectedSystems: typeof data.affectedSystems === "string"
          ? data.affectedSystems.split(",").map((s: string) => s.trim()).filter(Boolean)
          : data.affectedSystems || [],
        bcpPlanId: data.bcpPlanId && data.bcpPlanId !== "none" ? data.bcpPlanId : null,
      };
      await apiRequest("POST", "/api/drp-plans", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drp-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drp-plans/stats"] });
      setOpen(false);
      form.reset();
      toast({ title: "DRP Plan created", description: "The disaster recovery plan has been created." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/drp-plans/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drp-plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drp-plans/stats"] });
      toast({ title: "DRP Plan updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const filtered = (plans ?? []).filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchType = disasterTypeFilter === "all" || p.disasterType === disasterTypeFilter;
    const matchSeverity = severityFilter === "all" || p.severity === severityFilter;
    const matchResult = testResultFilter === "all" || p.testResult === testResultFilter;
    return matchSearch && matchStatus && matchType && matchSeverity && matchResult;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const disasterSegments = DISASTER_TYPES.map(t => ({
    key: t,
    label: t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    color: { natural_disaster: "bg-blue-500", cyber_attack: "bg-red-500", hardware_failure: "bg-orange-500", power_outage: "bg-yellow-500", data_breach: "bg-purple-500", network_failure: "bg-cyan-500", pandemic: "bg-pink-500", other: "bg-gray-500" }[t] || "bg-gray-500",
    count: stats?.byDisasterType?.[t] || 0,
  }));

  const linkedBcpPlan = (id: string | null) => {
    if (!id || !bcpPlans) return null;
    return bcpPlans.find(p => p.id === id);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4" data-testid="drp-description">
        <div className="flex items-start gap-3">
          <CloudOff className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Disaster Recovery Plans (DRP)</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Defines technical recovery procedures for IT systems and infrastructure after a disaster. Each plan specifies the disaster type (cyber attack, natural disaster, power outage, etc.), severity, affected systems, failover type (manual/automatic/hybrid), backup locations, and detailed recovery procedures. Plans link to parent BCP plans and flow through: Draft, Under Review, Approved, Active, and Testing.</p>
          </div>
        </div>
      </div>
      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="drp-kpi-grid">
            <KpiCard title="Total Plans" value={stats.total} subtitle="All DRP plans" icon={Database} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter("all"); setDisasterTypeFilter("all"); setSeverityFilter("all"); setTestResultFilter("all"); setPage(0); }} active={statusFilter === "all" && disasterTypeFilter === "all" && severityFilter === "all" && testResultFilter === "all"} />
            <KpiCard title="Active" value={stats.active} subtitle="Currently active" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" onClick={() => { setStatusFilter(statusFilter === "active" ? "all" : "active"); setPage(0); }} active={statusFilter === "active"} />
            <KpiCard title="In Testing" value={stats.inTesting} subtitle="Being tested" icon={Activity} color="bg-purple-500/15 text-purple-400" onClick={() => { setStatusFilter(statusFilter === "testing" ? "all" : "testing"); setPage(0); }} active={statusFilter === "testing"} />
            <KpiCard title="Tests Passed" value={stats.testsPassed} subtitle="Verified plans" icon={ShieldCheck} color="bg-green-500/15 text-green-400" onClick={() => { setTestResultFilter(testResultFilter === "passed" ? "all" : "passed"); setPage(0); }} active={testResultFilter === "passed"} />
            <KpiCard title="Untested" value={stats.untested} subtitle="Need testing" icon={AlertTriangle} color="bg-amber-500/15 text-amber-400" onClick={() => { setTestResultFilter(testResultFilter === "not_tested" ? "all" : "not_tested"); setPage(0); }} active={testResultFilter === "not_tested"} />
            <KpiCard title="Avg RTO" value={stats.avgRtoHours > 0 ? `${stats.avgRtoHours}h` : "N/A"} subtitle="Recovery time" icon={Clock} color="bg-purple-500/15 text-purple-400" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">DRP Lifecycle</p>
                <StatusPipeline stages={DRP_STATUSES} counts={stats.byStatus || {}} onStatusClick={(s) => { setStatusFilter(statusFilter === s ? "all" : s); setPage(0); }} activeStatus={statusFilter !== "all" ? statusFilter : undefined} />
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Disaster Type Distribution</p>
                <DistributionBar segments={disasterSegments} onSegmentClick={(k) => { setDisasterTypeFilter(disasterTypeFilter === k ? "all" : k); setPage(0); }} activeSegment={disasterTypeFilter !== "all" ? disasterTypeFilter : undefined} />
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
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search DRP plans..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-search-drp" />
              </div>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-drp-status-filter"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {DRP_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={disasterTypeFilter} onValueChange={v => { setDisasterTypeFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[180px]" data-testid="select-drp-disaster-filter"><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {DISASTER_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={v => { setSeverityFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]" data-testid="select-drp-severity-filter"><SelectValue placeholder="All Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  {SEVERITIES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={testResultFilter} onValueChange={v => { setTestResultFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[150px]" data-testid="select-drp-result-filter"><SelectValue placeholder="All Results" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  {TEST_RESULTS.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="text-[10px]">{filtered.length} plans</Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
          ) : paged.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No DRP plans match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="drp-table">
                <thead>
                  <tr className="border-b border-border/50 text-left">
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Title</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Disaster Type</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Severity</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">RTO</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">RPO</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Failover</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Test Result</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Owner</th>
                    <th className="pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(plan => (
                    <tr key={plan.id} className="border-b border-border/30 hover-elevate" data-testid={`row-drp-${plan.id}`}>
                      <td className="py-2 font-medium max-w-[180px] truncate" data-testid={`text-drp-title-${plan.id}`}>{plan.title}</td>
                      <td className="py-2"><StatusBadge status={plan.status} /></td>
                      <td className="py-2 text-muted-foreground text-xs capitalize">{plan.disasterType.replace(/_/g, ' ')}</td>
                      <td className="py-2"><ImpactBadge level={plan.severity} /></td>
                      <td className="py-2 text-muted-foreground">{plan.rtoHours}h</td>
                      <td className="py-2 text-muted-foreground">{plan.rpoHours}h</td>
                      <td className="py-2 text-muted-foreground text-xs capitalize">{plan.failoverType}</td>
                      <td className="py-2"><TestResultBadge result={plan.testResult} /></td>
                      <td className="py-2 text-muted-foreground">{plan.owner}</td>
                      <td className="py-2">
                        <Button size="icon" variant="ghost" onClick={() => setDetailPlan(plan)} data-testid={`button-view-drp-${plan.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 border-t border-border/50 pt-3" data-testid="drp-pagination">
              <span className="text-xs text-muted-foreground">
                Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" disabled={safePage === 0} onClick={() => setPage(p => p - 1)} data-testid="button-drp-prev-page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-3">{safePage + 1}/{totalPages}</span>
                <Button size="icon" variant="outline" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-drp-next-page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Create DRP Plan</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} data-testid="input-drp-title" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} className="resize-none min-h-[80px]" data-testid="input-drp-description" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="disasterType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disaster Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-drp-disaster-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{DISASTER_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="severity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-drp-severity"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{SEVERITIES.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="rtoHours" render={({ field }) => (
                  <FormItem><FormLabel>RTO (hours)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-drp-rto" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rpoHours" render={({ field }) => (
                  <FormItem><FormLabel>RPO (hours)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-drp-rpo" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="affectedSystems" render={({ field }) => (
                <FormItem><FormLabel>Affected Systems (comma-separated)</FormLabel><FormControl><Input {...field} placeholder="e.g. Web Server, Database, DNS" data-testid="input-drp-systems" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="recoveryProcedures" render={({ field }) => (
                <FormItem><FormLabel>Recovery Procedures</FormLabel><FormControl><Textarea {...field} className="resize-none min-h-[80px]" data-testid="input-drp-procedures" /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="failoverType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Failover Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-drp-failover-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="automatic">Automatic</SelectItem>
                        <SelectItem value="semi-automatic">Semi-Automatic</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="failoverTarget" render={({ field }) => (
                  <FormItem><FormLabel>Failover Target</FormLabel><FormControl><Input {...field} placeholder="e.g. DR Site B" data-testid="input-drp-failover-target" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="backupLocation" render={({ field }) => (
                <FormItem><FormLabel>Backup Location</FormLabel><FormControl><Input {...field} placeholder="e.g. AWS S3, Azure Blob" data-testid="input-drp-backup-location" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bcpPlanId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked BCP Plan (optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger data-testid="select-drp-bcp-link"><SelectValue placeholder="Select BCP plan" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {(bcpPlans ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="owner" render={({ field }) => (
                <FormItem><FormLabel>Owner</FormLabel><FormControl><Input {...field} data-testid="input-drp-owner" /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-drp">
                {createMutation.isPending ? "Creating..." : "Create DRP Plan"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailPlan} onOpenChange={(o) => { if (!o) setDetailPlan(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
          {detailPlan && (() => {
            const linked = linkedBcpPlan(detailPlan.bcpPlanId);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CloudOff className="h-5 w-5" />
                    {detailPlan.title}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={detailPlan.status} />
                    <ImpactBadge level={detailPlan.severity} />
                    <TestResultBadge result={detailPlan.testResult} />
                    <Badge variant="secondary" className="text-xs capitalize">{detailPlan.disasterType.replace(/_/g, ' ')}</Badge>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-drp-detail-description">
                    {detailPlan.description}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">RTO:</span> <span className="font-medium">{detailPlan.rtoHours} hours</span></div>
                    <div><span className="text-muted-foreground">RPO:</span> <span className="font-medium">{detailPlan.rpoHours} hours</span></div>
                    <div><span className="text-muted-foreground">Owner:</span> <span className="font-medium">{detailPlan.owner}</span></div>
                    <div><span className="text-muted-foreground">Failover Type:</span> <span className="font-medium capitalize">{detailPlan.failoverType}</span></div>
                    {detailPlan.failoverTarget && <div><span className="text-muted-foreground">Failover Target:</span> <span className="font-medium">{detailPlan.failoverTarget}</span></div>}
                    {detailPlan.backupLocation && <div><span className="text-muted-foreground">Backup Location:</span> <span className="font-medium">{detailPlan.backupLocation}</span></div>}
                    <div><span className="text-muted-foreground">Last Tested:</span> <span className="font-medium">{formatDate(detailPlan.lastTestedAt)}</span></div>
                  </div>
                  {detailPlan.affectedSystems && detailPlan.affectedSystems.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Affected Systems</p>
                      <div className="flex flex-wrap gap-1">{detailPlan.affectedSystems.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>)}</div>
                    </div>
                  )}
                  {detailPlan.recoveryProcedures && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Recovery Procedures</p>
                      <p className="text-sm bg-muted/20 rounded p-3">{detailPlan.recoveryProcedures}</p>
                    </div>
                  )}
                  {linked && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                      <p className="text-xs text-blue-400 mb-1 flex items-center gap-1"><Shield className="h-3 w-3" /> Linked BCP Plan</p>
                      <p className="text-sm font-medium">{linked.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{linked.category} · {linked.businessImpactLevel} impact</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/50">
                    {getDrpNextActions(detailPlan.status).map(action => (
                      <Button
                        key={action.status}
                        variant={action.variant}
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => { updateMutation.mutate({ id: detailPlan.id, status: action.status }); setDetailPlan(null); }}
                        data-testid={`button-drp-action-${action.status}`}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}