import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertBiaEntrySchema, insertRiskAssessmentSchema, insertDrillSchema, insertReviewSchema } from "@shared/schema";
import type { BiaEntry, RiskAssessment, Drill, Review, BcpPlan, DrpPlan } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BarChart3, Target, AlertTriangle, Shield, Clock, CheckCircle2, Eye, Activity,
  FileText, Plus, Search, Zap, Users, Calendar, ClipboardCheck, RefreshCw,
  ChevronLeft, ChevronRight, Inbox, TrendingUp, ShieldAlert, Flame, Bug,
  ArrowRight, Pencil, Save, X, BookOpen
} from "lucide-react";
import { useState, useEffect } from "react";

const PAGE_SIZE = 10;

function KpiCard({ title, value, subtitle, icon: Icon, color, onClick, active }: { title: string; value: string | number; subtitle: string; icon: any; color: string; onClick?: () => void; active?: boolean }) {
  return (
    <Card
      className={`transition-all ${onClick ? "cursor-pointer hover:shadow-md" : ""} ${active ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
      data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-none">{value}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{title}</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 truncate">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function DistributionBar({ segments, onSegmentClick, activeSegment }: { segments: { key: string; label: string; color: string; count: number }[]; onSegmentClick?: (key: string) => void; activeSegment?: string }) {
  const total = segments.reduce((s, seg) => s + seg.count, 0);
  if (total === 0) return <div className="h-3 bg-muted rounded-full" />;
  return (
    <div className="space-y-1.5">
      <div className="h-3 rounded-full overflow-hidden flex">
        {segments.filter(s => s.count > 0).map(seg => (
          <div
            key={seg.key}
            className={`${seg.color} transition-all ${onSegmentClick ? "cursor-pointer hover:opacity-80" : ""} ${activeSegment === seg.key ? "ring-2 ring-primary ring-inset" : ""}`}
            style={{ width: `${(seg.count / total) * 100}%` }}
            onClick={() => onSegmentClick?.(seg.key)}
            title={`${seg.label}: ${seg.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {segments.filter(s => s.count > 0).map(seg => (
          <span
            key={seg.key}
            className={`text-[10px] text-muted-foreground flex items-center gap-1 ${onSegmentClick ? "cursor-pointer hover:text-foreground" : ""} ${activeSegment === seg.key ? "text-foreground font-medium" : ""}`}
            onClick={() => onSegmentClick?.(seg.key)}
          >
            <span className={`w-2 h-2 rounded-full ${seg.color}`} />
            {seg.label} ({seg.count})
          </span>
        ))}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} data-testid="button-prev-page"><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)} data-testid="button-next-page"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

const CRITICALITY_COLORS: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-blue-500" };
const RISK_COLORS: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-green-500" };
const STATUS_BADGE: Record<string, string> = { identified: "bg-blue-500/15 text-blue-400", mitigated: "bg-green-500/15 text-green-400", accepted: "bg-amber-500/15 text-amber-400", transferred: "bg-purple-500/15 text-purple-400" };
const DRILL_STATUS_BADGE: Record<string, string> = { scheduled: "bg-blue-500/15 text-blue-400", in_progress: "bg-amber-500/15 text-amber-400", completed: "bg-green-500/15 text-green-400", cancelled: "bg-red-500/15 text-red-400" };
const RESULT_BADGE: Record<string, string> = { passed: "bg-green-500/15 text-green-400", failed: "bg-red-500/15 text-red-400", partial: "bg-amber-500/15 text-amber-400", pending: "bg-gray-500/15 text-gray-400" };
const REVIEW_STATUS_BADGE: Record<string, string> = { pending: "bg-blue-500/15 text-blue-400", in_progress: "bg-amber-500/15 text-amber-400", completed: "bg-green-500/15 text-green-400" };

interface BiaStats { total: number; critical: number; highMtdRisk: number; avgRto: number; workaroundAvailablePct: number; byCriticality: Record<string, number>; byDepartment: Record<string, number>; }
interface RiskStats { total: number; critical: number; high: number; mitigated: number; accepted: number; identified: number; byCategory: Record<string, number>; byResidualRisk: Record<string, number>; byStatus: Record<string, number>; }
interface DrillStats { total: number; completed: number; scheduled: number; overdue: number; passRate: number; byType: Record<string, number>; byResult: Record<string, number>; byStatus: Record<string, number>; }
interface ReviewStats { total: number; pending: number; inProgress: number; completed: number; changesRequiredPct: number; byType: Record<string, number>; byStatus: Record<string, number>; }

export function BiaTabContent({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  const { data: entries = [], isLoading } = useQuery<BiaEntry[]>({ queryKey: ["/api/bcp-bia"] });
  const { data: stats } = useQuery<BiaStats>({ queryKey: ["/api/bcp-bia/stats"] });
  const { data: bcpPlans = [] } = useQuery<BcpPlan[]>({ queryKey: ["/api/bcp-plans"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/bcp-bia", data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bcp-bia"] }); queryClient.invalidateQueries({ queryKey: ["/api/bcp-bia/stats"] }); setOpen(false); toast({ title: "BIA entry created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/bcp-bia/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bcp-bia"] }); queryClient.invalidateQueries({ queryKey: ["/api/bcp-bia/stats"] }); setEditing(false); toast({ title: "BIA entry updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const form = useForm({
    resolver: zodResolver(insertBiaEntrySchema.omit({ userId: true }).extend({
      businessFunction: z.string().min(1),
      department: z.string().min(1),
      mtdHours: z.coerce.number().min(0),
      rtoHours: z.coerce.number().min(0),
      rpoHours: z.coerce.number().min(0),
      financialImpactPerHour: z.coerce.number().min(0),
    })),
    defaultValues: { businessFunction: "", department: "", criticality: "medium", mtdHours: 24, rtoHours: 24, rpoHours: 12, financialImpactPerHour: 0, dependencies: [], workaroundAvailable: false, workaroundDescription: "", linkedBcpPlanId: "" },
  });

  const filtered = entries.filter(e => {
    if (criticalityFilter !== "all" && e.criticality !== criticalityFilter) return false;
    if (search && !e.businessFunction.toLowerCase().includes(search.toLowerCase()) && !e.department.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const detail = detailId ? entries.find(e => e.id === detailId) : null;

  const startEdit = (entry: BiaEntry) => {
    setEditData({ criticality: entry.criticality, mtdHours: entry.mtdHours, rtoHours: entry.rtoHours, rpoHours: entry.rpoHours, financialImpactPerHour: entry.financialImpactPerHour, workaroundAvailable: entry.workaroundAvailable, workaroundDescription: entry.workaroundDescription || "", department: entry.department });
    setEditing(true);
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4" data-testid="bia-description">
        <div className="flex items-start gap-3">
          <BarChart3 className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Business Impact Analysis (BIA)</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Identifies and measures the impact of disruptions to critical business functions. Each entry tracks the function's criticality level, Maximum Tolerable Downtime (MTD), Recovery Time Objective (RTO), Recovery Point Objective (RPO), financial exposure per hour, system dependencies, and workaround availability. Use this to prioritize recovery efforts and allocate resources based on business impact.</p>
          </div>
        </div>
      </div>
      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="bia-kpi-grid">
            <KpiCard title="Total Functions" value={stats.total} subtitle="Business functions analyzed" icon={BarChart3} color="bg-blue-500/15 text-blue-400" onClick={() => { setCriticalityFilter("all"); setPage(0); }} active={criticalityFilter === "all"} />
            <KpiCard title="Critical" value={stats.critical} subtitle="Highest impact" icon={ShieldAlert} color="bg-red-500/15 text-red-400" onClick={() => { setCriticalityFilter(criticalityFilter === "critical" ? "all" : "critical"); setPage(0); }} active={criticalityFilter === "critical"} />
            <KpiCard title="High MTD Risk" value={stats.highMtdRisk} subtitle="MTD ≤ 4 hours" icon={Clock} color="bg-orange-500/15 text-orange-400" />
            <KpiCard title="Avg RTO" value={stats.avgRto > 0 ? `${stats.avgRto}h` : "N/A"} subtitle="Recovery time objective" icon={RefreshCw} color="bg-purple-500/15 text-purple-400" />
            <KpiCard title="Workaround %" value={`${stats.workaroundAvailablePct}%`} subtitle="Have workarounds" icon={Activity} color="bg-emerald-500/15 text-emerald-400" />
          </div>
          <Card><CardContent className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Criticality Distribution</p>
            <DistributionBar
              segments={[
                { key: "critical", label: "Critical", color: "bg-red-500", count: stats.byCriticality?.critical || 0 },
                { key: "high", label: "High", color: "bg-orange-500", count: stats.byCriticality?.high || 0 },
                { key: "medium", label: "Medium", color: "bg-yellow-500", count: stats.byCriticality?.medium || 0 },
                { key: "low", label: "Low", color: "bg-blue-500", count: stats.byCriticality?.low || 0 },
              ]}
              onSegmentClick={(k) => { setCriticalityFilter(criticalityFilter === k ? "all" : k); setPage(0); }}
              activeSegment={criticalityFilter !== "all" ? criticalityFilter : undefined}
            />
          </CardContent></Card>
        </div>
      ) : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[80px] rounded-xl" />)}</div>}

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search business functions..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-bia-search" /></div>

      {isLoading ? <Skeleton className="h-[300px] rounded-xl" /> : (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Business Function</th>
                <th className="text-left p-3 font-medium">Department</th>
                <th className="text-left p-3 font-medium">Criticality</th>
                <th className="text-left p-3 font-medium">MTD</th>
                <th className="text-left p-3 font-medium">RTO</th>
                <th className="text-left p-3 font-medium">RPO</th>
                <th className="text-left p-3 font-medium">Impact/hr</th>
                <th className="text-left p-3 font-medium">Workaround</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {paged.map(e => (
                  <tr key={e.id} className="border-b hover:bg-muted/30" data-testid={`row-bia-${e.id}`}>
                    <td className="p-3 font-medium">{e.businessFunction}</td>
                    <td className="p-3 text-muted-foreground">{e.department}</td>
                    <td className="p-3"><Badge className={`${CRITICALITY_COLORS[e.criticality]} text-white text-xs`}>{e.criticality}</Badge></td>
                    <td className="p-3">{e.mtdHours}h</td>
                    <td className="p-3">{e.rtoHours}h</td>
                    <td className="p-3">{e.rpoHours}h</td>
                    <td className="p-3">${e.financialImpactPerHour.toLocaleString()}</td>
                    <td className="p-3">{e.workaroundAvailable ? <Badge className="bg-green-500/15 text-green-400 text-xs">Yes</Badge> : <Badge className="bg-red-500/15 text-red-400 text-xs">No</Badge>}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setDetailId(e.id); setEditing(false); }} data-testid={`button-view-bia-${e.id}`}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setDetailId(e.id); startEdit(e); }} data-testid={`button-edit-bia-${e.id}`}><Pencil className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No BIA entries found</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="p-3"><Pagination page={page} totalPages={totalPages} setPage={setPage} /></div>
        </CardContent></Card>
      )}

      <Dialog open={!!detail} onOpenChange={() => { setDetailId(null); setEditing(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{detail?.businessFunction}</DialogTitle>
              {detail && !editing && <Button variant="ghost" size="sm" onClick={() => startEdit(detail)} data-testid="button-edit-bia-detail"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>}
            </div>
          </DialogHeader>
          {detail && !editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Department</p><p className="font-medium">{detail.department}</p></div>
                <div><p className="text-muted-foreground text-xs">Criticality</p><Badge className={`${CRITICALITY_COLORS[detail.criticality]} text-white text-xs`}>{detail.criticality}</Badge></div>
                <div><p className="text-muted-foreground text-xs">MTD</p><p className="font-medium">{detail.mtdHours} hours</p></div>
                <div><p className="text-muted-foreground text-xs">RTO</p><p className="font-medium">{detail.rtoHours} hours</p></div>
                <div><p className="text-muted-foreground text-xs">RPO</p><p className="font-medium">{detail.rpoHours} hours</p></div>
                <div><p className="text-muted-foreground text-xs">Financial Impact</p><p className="font-medium">${detail.financialImpactPerHour.toLocaleString()}/hr</p></div>
              </div>
              {detail.dependencies.length > 0 && (
                <div><p className="text-muted-foreground text-xs mb-1">Dependencies</p><div className="flex flex-wrap gap-1">{detail.dependencies.map((d, i) => <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>)}</div></div>
              )}
              <div><p className="text-muted-foreground text-xs">Workaround Available</p><p className="font-medium">{detail.workaroundAvailable ? "Yes" : "No"}</p></div>
              {detail.workaroundDescription && <div><p className="text-muted-foreground text-xs">Workaround Description</p><p>{detail.workaroundDescription}</p></div>}
              {detail.linkedBcpPlanId && <div><p className="text-muted-foreground text-xs">Linked BCP Plan</p><p className="font-medium">{bcpPlans.find(p => p.id === detail.linkedBcpPlanId)?.title || detail.linkedBcpPlanId}</p></div>}
            </div>
          )}
          {detail && editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Criticality</p>
                  <Select value={editData.criticality || detail.criticality} onValueChange={v => setEditData(d => ({ ...d, criticality: v }))}>
                    <SelectTrigger data-testid="edit-bia-criticality"><SelectValue /></SelectTrigger>
                    <SelectContent>{["critical","high","medium","low"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Department</p>
                  <Input value={editData.department ?? detail.department} onChange={e => setEditData(d => ({ ...d, department: e.target.value }))} data-testid="edit-bia-department" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><p className="text-muted-foreground text-xs mb-1">MTD (hrs)</p><Input type="number" value={editData.mtdHours ?? detail.mtdHours} onChange={e => setEditData(d => ({ ...d, mtdHours: Number(e.target.value) }))} data-testid="edit-bia-mtd" /></div>
                <div><p className="text-muted-foreground text-xs mb-1">RTO (hrs)</p><Input type="number" value={editData.rtoHours ?? detail.rtoHours} onChange={e => setEditData(d => ({ ...d, rtoHours: Number(e.target.value) }))} data-testid="edit-bia-rto" /></div>
                <div><p className="text-muted-foreground text-xs mb-1">RPO (hrs)</p><Input type="number" value={editData.rpoHours ?? detail.rpoHours} onChange={e => setEditData(d => ({ ...d, rpoHours: Number(e.target.value) }))} data-testid="edit-bia-rpo" /></div>
              </div>
              <div><p className="text-muted-foreground text-xs mb-1">Financial Impact ($/hr)</p><Input type="number" value={editData.financialImpactPerHour ?? detail.financialImpactPerHour} onChange={e => setEditData(d => ({ ...d, financialImpactPerHour: Number(e.target.value) }))} data-testid="edit-bia-impact" /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editData.workaroundAvailable ?? detail.workaroundAvailable} onCheckedChange={v => setEditData(d => ({ ...d, workaroundAvailable: v }))} data-testid="edit-bia-workaround" />
                <p className="text-sm">Workaround Available</p>
              </div>
              <div><p className="text-muted-foreground text-xs mb-1">Workaround Description</p><Textarea value={editData.workaroundDescription ?? detail.workaroundDescription ?? ""} onChange={e => setEditData(d => ({ ...d, workaroundDescription: e.target.value }))} data-testid="edit-bia-workaround-desc" /></div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => updateMutation.mutate({ id: detail.id, data: editData })} disabled={updateMutation.isPending} data-testid="button-save-bia"><Save className="h-4 w-4 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-bia-edit"><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New BIA Entry</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
              <FormField control={form.control} name="businessFunction" render={({ field }) => (<FormItem><FormLabel>Business Function</FormLabel><FormControl><Input {...field} data-testid="input-bia-function" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department</FormLabel><FormControl><Input {...field} data-testid="input-bia-department" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="criticality" render={({ field }) => (<FormItem><FormLabel>Criticality</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-bia-criticality"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["critical","high","medium","low"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="financialImpactPerHour" render={({ field }) => (<FormItem><FormLabel>Impact $/hr</FormLabel><FormControl><Input type="number" {...field} data-testid="input-bia-impact" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <FormField control={form.control} name="mtdHours" render={({ field }) => (<FormItem><FormLabel>MTD (hrs)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-bia-mtd" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="rtoHours" render={({ field }) => (<FormItem><FormLabel>RTO (hrs)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-bia-rto" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="rpoHours" render={({ field }) => (<FormItem><FormLabel>RPO (hrs)</FormLabel><FormControl><Input type="number" {...field} data-testid="input-bia-rpo" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="workaroundAvailable" render={({ field }) => (<FormItem className="flex items-center gap-2"><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-bia-workaround" /></FormControl><FormLabel className="!mt-0">Workaround Available</FormLabel></FormItem>)} />
              <FormField control={form.control} name="workaroundDescription" render={({ field }) => (<FormItem><FormLabel>Workaround Description</FormLabel><FormControl><Textarea {...field} value={field.value || ""} data-testid="input-bia-workaround-desc" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="linkedBcpPlanId" render={({ field }) => (<FormItem><FormLabel>Link to BCP Plan</FormLabel><Select value={field.value || ""} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-bia-bcp-link"><SelectValue placeholder="Optional" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{bcpPlans.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-bia">{createMutation.isPending ? "Creating..." : "Create BIA Entry"}</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function RiskTabContent({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [residualFilter, setResidualFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  const { data: risks = [], isLoading } = useQuery<RiskAssessment[]>({ queryKey: ["/api/bcp-risks"] });
  const { data: stats } = useQuery<RiskStats>({ queryKey: ["/api/bcp-risks/stats"] });
  const { data: bcpPlans = [] } = useQuery<BcpPlan[]>({ queryKey: ["/api/bcp-plans"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/bcp-risks", { ...data, riskScore: data.likelihood * data.impact }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bcp-risks"] }); queryClient.invalidateQueries({ queryKey: ["/api/bcp-risks/stats"] }); setOpen(false); toast({ title: "Risk assessment created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/bcp-risks/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bcp-risks"] }); queryClient.invalidateQueries({ queryKey: ["/api/bcp-risks/stats"] }); setEditing(false); toast({ title: "Risk assessment updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const form = useForm({
    resolver: zodResolver(insertRiskAssessmentSchema.omit({ userId: true }).extend({
      threatName: z.string().min(1),
      currentControls: z.string().min(1),
      mitigationStrategy: z.string().min(1),
      riskOwner: z.string().min(1),
      likelihood: z.coerce.number().min(1).max(5),
      impact: z.coerce.number().min(1).max(5),
    })),
    defaultValues: { threatName: "", threatCategory: "technical", likelihood: 3, impact: 3, riskScore: 9, currentControls: "", residualRisk: "medium", mitigationStrategy: "", riskOwner: "", status: "identified", linkedBcpPlanId: "" },
  });

  const filtered = risks.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (residualFilter !== "all" && r.residualRisk !== residualFilter) return false;
    if (search && !r.threatName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const detail = detailId ? risks.find(r => r.id === detailId) : null;

  const riskColor = (score: number) => score >= 20 ? "bg-red-500" : score >= 12 ? "bg-orange-500" : score >= 6 ? "bg-yellow-500" : "bg-green-500";

  const startEdit = (risk: RiskAssessment) => {
    setEditData({ status: risk.status, residualRisk: risk.residualRisk, likelihood: risk.likelihood, impact: risk.impact, riskScore: risk.riskScore, currentControls: risk.currentControls, mitigationStrategy: risk.mitigationStrategy, riskOwner: risk.riskOwner });
    setEditing(true);
  };

  const RISK_STATUS_TRANSITIONS: Record<string, { label: string; next: string; color: string }[]> = {
    identified: [{ label: "Mark Mitigated", next: "mitigated", color: "bg-green-600 hover:bg-green-700" }, { label: "Accept Risk", next: "accepted", color: "bg-amber-600 hover:bg-amber-700" }, { label: "Transfer Risk", next: "transferred", color: "bg-purple-600 hover:bg-purple-700" }],
    mitigated: [{ label: "Re-identify", next: "identified", color: "bg-blue-600 hover:bg-blue-700" }],
    accepted: [{ label: "Re-identify", next: "identified", color: "bg-blue-600 hover:bg-blue-700" }],
    transferred: [{ label: "Re-identify", next: "identified", color: "bg-blue-600 hover:bg-blue-700" }],
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4" data-testid="risk-description">
        <div className="flex items-start gap-3">
          <Target className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Risk Register</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">A comprehensive threat assessment catalog for your organization. Each risk entry includes threat categorization (natural, technical, human, environmental), a likelihood x impact risk score (1-5 each, max 25), current controls in place, residual risk level, mitigation strategy, and an assigned risk owner. Risks flow through statuses: Identified, Mitigated, Accepted, or Transferred.</p>
          </div>
        </div>
      </div>
      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="risk-kpi-grid">
            <KpiCard title="Total Risks" value={stats.total} subtitle="Risk register entries" icon={BarChart3} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter("all"); setResidualFilter("all"); setPage(0); }} active={statusFilter === "all" && residualFilter === "all"} />
            <KpiCard title="Critical" value={stats.critical} subtitle="Score ≥ 20" icon={Flame} color="bg-red-500/15 text-red-400" />
            <KpiCard title="High" value={stats.high} subtitle="Score 12-19" icon={AlertTriangle} color="bg-orange-500/15 text-orange-400" />
            <KpiCard title="Identified" value={stats.identified} subtitle="Needs action" icon={Eye} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter(statusFilter === "identified" ? "all" : "identified"); setPage(0); }} active={statusFilter === "identified"} />
            <KpiCard title="Mitigated" value={stats.mitigated} subtitle="Controls applied" icon={Shield} color="bg-green-500/15 text-green-400" onClick={() => { setStatusFilter(statusFilter === "mitigated" ? "all" : "mitigated"); setPage(0); }} active={statusFilter === "mitigated"} />
            <KpiCard title="Accepted" value={stats.accepted} subtitle="Risk accepted" icon={CheckCircle2} color="bg-amber-500/15 text-amber-400" onClick={() => { setStatusFilter(statusFilter === "accepted" ? "all" : "accepted"); setPage(0); }} active={statusFilter === "accepted"} />
          </div>
          <Card><CardContent className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Residual Risk Distribution</p>
            <DistributionBar
              segments={[
                { key: "critical", label: "Critical", color: "bg-red-500", count: stats.byResidualRisk?.critical || 0 },
                { key: "high", label: "High", color: "bg-orange-500", count: stats.byResidualRisk?.high || 0 },
                { key: "medium", label: "Medium", color: "bg-yellow-500", count: stats.byResidualRisk?.medium || 0 },
                { key: "low", label: "Low", color: "bg-green-500", count: stats.byResidualRisk?.low || 0 },
              ]}
              onSegmentClick={(k) => { setResidualFilter(residualFilter === k ? "all" : k); setPage(0); }}
              activeSegment={residualFilter !== "all" ? residualFilter : undefined}
            />
          </CardContent></Card>
        </div>
      ) : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[80px] rounded-xl" />)}</div>}

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search threats..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-risk-search" /></div>

      {isLoading ? <Skeleton className="h-[300px] rounded-xl" /> : (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Threat</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-left p-3 font-medium">L×I</th>
                <th className="text-left p-3 font-medium">Score</th>
                <th className="text-left p-3 font-medium">Residual</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Owner</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30" data-testid={`row-risk-${r.id}`}>
                    <td className="p-3 font-medium max-w-[200px] truncate">{r.threatName}</td>
                    <td className="p-3 text-muted-foreground capitalize">{r.threatCategory}</td>
                    <td className="p-3">{r.likelihood}×{r.impact}</td>
                    <td className="p-3"><Badge className={`${riskColor(r.riskScore)} text-white text-xs`}>{r.riskScore}</Badge></td>
                    <td className="p-3"><Badge className={`${RISK_COLORS[r.residualRisk]} text-white text-xs`}>{r.residualRisk}</Badge></td>
                    <td className="p-3"><Badge className={`${STATUS_BADGE[r.status] || ""} text-xs`}>{r.status.replace("_", " ")}</Badge></td>
                    <td className="p-3 text-muted-foreground">{r.riskOwner}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setDetailId(r.id); setEditing(false); }} data-testid={`button-view-risk-${r.id}`}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setDetailId(r.id); startEdit(r); }} data-testid={`button-edit-risk-${r.id}`}><Pencil className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No risk assessments found</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="p-3"><Pagination page={page} totalPages={totalPages} setPage={setPage} /></div>
        </CardContent></Card>
      )}

      <Dialog open={!!detail} onOpenChange={() => { setDetailId(null); setEditing(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{detail?.threatName}</DialogTitle>
              {detail && !editing && <Button variant="ghost" size="sm" onClick={() => startEdit(detail)} data-testid="button-edit-risk-detail"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>}
            </div>
          </DialogHeader>
          {detail && !editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Category</p><p className="font-medium capitalize">{detail.threatCategory}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><Badge className={`${STATUS_BADGE[detail.status]} text-xs`}>{detail.status}</Badge></div>
                <div><p className="text-muted-foreground text-xs">Likelihood</p><p className="font-medium">{detail.likelihood}/5</p></div>
                <div><p className="text-muted-foreground text-xs">Impact</p><p className="font-medium">{detail.impact}/5</p></div>
                <div><p className="text-muted-foreground text-xs">Risk Score</p><Badge className={`${riskColor(detail.riskScore)} text-white text-xs`}>{detail.riskScore}</Badge></div>
                <div><p className="text-muted-foreground text-xs">Residual Risk</p><Badge className={`${RISK_COLORS[detail.residualRisk]} text-white text-xs`}>{detail.residualRisk}</Badge></div>
              </div>
              <div><p className="text-muted-foreground text-xs">Current Controls</p><p>{detail.currentControls}</p></div>
              <div><p className="text-muted-foreground text-xs">Mitigation Strategy</p><p>{detail.mitigationStrategy}</p></div>
              <div><p className="text-muted-foreground text-xs">Risk Owner</p><p className="font-medium">{detail.riskOwner}</p></div>
              {detail.linkedBcpPlanId && <div><p className="text-muted-foreground text-xs">Linked BCP Plan</p><p className="font-medium">{bcpPlans.find(p => p.id === detail.linkedBcpPlanId)?.title || detail.linkedBcpPlanId}</p></div>}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {(RISK_STATUS_TRANSITIONS[detail.status] || []).map(t => (
                  <Button key={t.next} size="sm" className={`${t.color} text-white`} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: detail.id, data: { status: t.next } })} data-testid={`button-risk-${t.next}`}>{t.label}</Button>
                ))}
              </div>
            </div>
          )}
          {detail && editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs mb-1">Status</p>
                  <Select value={(editData.status as string) || detail.status} onValueChange={v => setEditData(d => ({ ...d, status: v as any }))}>
                    <SelectTrigger data-testid="edit-risk-status"><SelectValue /></SelectTrigger>
                    <SelectContent>{["identified","mitigated","accepted","transferred"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><p className="text-muted-foreground text-xs mb-1">Residual Risk</p>
                  <Select value={(editData.residualRisk as string) || detail.residualRisk} onValueChange={v => setEditData(d => ({ ...d, residualRisk: v as any }))}>
                    <SelectTrigger data-testid="edit-risk-residual"><SelectValue /></SelectTrigger>
                    <SelectContent>{["critical","high","medium","low"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs mb-1">Likelihood (1-5)</p><Input type="number" min={1} max={5} value={editData.likelihood ?? detail.likelihood} onChange={e => { const l = Number(e.target.value); setEditData(d => ({ ...d, likelihood: l, riskScore: l * (d.impact ?? detail.impact) })); }} data-testid="edit-risk-likelihood" /></div>
                <div><p className="text-muted-foreground text-xs mb-1">Impact (1-5)</p><Input type="number" min={1} max={5} value={editData.impact ?? detail.impact} onChange={e => { const i = Number(e.target.value); setEditData(d => ({ ...d, impact: i, riskScore: (d.likelihood ?? detail.likelihood) * i })); }} data-testid="edit-risk-impact" /></div>
              </div>
              <div><p className="text-muted-foreground text-xs mb-1">Current Controls</p><Textarea value={(editData.currentControls as string) ?? detail.currentControls} onChange={e => setEditData(d => ({ ...d, currentControls: e.target.value }))} data-testid="edit-risk-controls" /></div>
              <div><p className="text-muted-foreground text-xs mb-1">Mitigation Strategy</p><Textarea value={(editData.mitigationStrategy as string) ?? detail.mitigationStrategy} onChange={e => setEditData(d => ({ ...d, mitigationStrategy: e.target.value }))} data-testid="edit-risk-mitigation" /></div>
              <div><p className="text-muted-foreground text-xs mb-1">Risk Owner</p><Input value={(editData.riskOwner as string) ?? detail.riskOwner} onChange={e => setEditData(d => ({ ...d, riskOwner: e.target.value }))} data-testid="edit-risk-owner" /></div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => updateMutation.mutate({ id: detail.id, data: editData })} disabled={updateMutation.isPending} data-testid="button-save-risk"><Save className="h-4 w-4 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-risk-edit"><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Risk Assessment</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
              <FormField control={form.control} name="threatName" render={({ field }) => (<FormItem><FormLabel>Threat Name</FormLabel><FormControl><Input {...field} data-testid="input-risk-name" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="threatCategory" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-risk-category"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["natural","technical","human","environmental"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="residualRisk" render={({ field }) => (<FormItem><FormLabel>Residual Risk</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-risk-residual"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["critical","high","medium","low"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="likelihood" render={({ field }) => (<FormItem><FormLabel>Likelihood (1-5)</FormLabel><FormControl><Input type="number" min={1} max={5} {...field} data-testid="input-risk-likelihood" /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="impact" render={({ field }) => (<FormItem><FormLabel>Impact (1-5)</FormLabel><FormControl><Input type="number" min={1} max={5} {...field} data-testid="input-risk-impact" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="currentControls" render={({ field }) => (<FormItem><FormLabel>Current Controls</FormLabel><FormControl><Textarea {...field} data-testid="input-risk-controls" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="mitigationStrategy" render={({ field }) => (<FormItem><FormLabel>Mitigation Strategy</FormLabel><FormControl><Textarea {...field} data-testid="input-risk-mitigation" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="riskOwner" render={({ field }) => (<FormItem><FormLabel>Risk Owner</FormLabel><FormControl><Input {...field} data-testid="input-risk-owner" /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="linkedBcpPlanId" render={({ field }) => (<FormItem><FormLabel>Link to BCP Plan</FormLabel><Select value={field.value || ""} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-risk-bcp-link"><SelectValue placeholder="Optional" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{bcpPlans.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-risk">{createMutation.isPending ? "Creating..." : "Create Risk Assessment"}</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function DrillsTabContent({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  const { data: drills = [], isLoading } = useQuery<Drill[]>({ queryKey: ["/api/bcp-drills"] });
  const { data: stats } = useQuery<DrillStats>({ queryKey: ["/api/bcp-drills/stats"] });
  const { data: bcpPlans = [] } = useQuery<BcpPlan[]>({ queryKey: ["/api/bcp-plans"] });
  const { data: drpPlans = [] } = useQuery<DrpPlan[]>({ queryKey: ["/api/drp-plans"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/bcp-drills", data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bcp-drills"] }); queryClient.invalidateQueries({ queryKey: ["/api/bcp-drills/stats"] }); setOpen(false); toast({ title: "Drill scheduled" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/bcp-drills/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bcp-drills"] }); queryClient.invalidateQueries({ queryKey: ["/api/bcp-drills/stats"] }); setEditing(false); toast({ title: "Drill updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const form = useForm({
    resolver: zodResolver(insertDrillSchema.omit({ userId: true }).extend({
      title: z.string().min(1),
      scenario: z.string().min(1),
      scheduledDate: z.string().min(1),
    })),
    defaultValues: { title: "", drillType: "tabletop", linkedPlanId: "", linkedPlanType: "bcp", scheduledDate: "", status: "scheduled", participants: [], scenario: "", findings: "", lessonsLearned: "", result: "pending", nextDrillDate: "" },
  });

  const filtered = drills.filter(d => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (typeFilter !== "all" && d.drillType !== typeFilter) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const detail = detailId ? drills.find(d => d.id === detailId) : null;
  const allPlans = [...bcpPlans.map(p => ({ ...p, type: "bcp" })), ...drpPlans.map(p => ({ ...p, type: "drp" }))];
  const getPlanTitle = (id: string | null) => { if (!id) return "N/A"; return allPlans.find(p => p.id === id)?.title || id; };
  const formatDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString() : "N/A";
  const toDateInput = (d: string | Date | null) => d ? new Date(d).toISOString().split("T")[0] : "";

  const startEdit = (drill: Drill) => {
    setEditData({ status: drill.status, result: drill.result, findings: drill.findings || "", lessonsLearned: drill.lessonsLearned || "", executedDate: drill.executedDate, nextDrillDate: drill.nextDrillDate });
    setEditing(true);
  };

  const DRILL_TRANSITIONS: Record<string, { label: string; next: string; color: string; extra?: Record<string, any> }[]> = {
    scheduled: [{ label: "Start Exercise", next: "in_progress", color: "bg-amber-600 hover:bg-amber-700" }, { label: "Cancel", next: "cancelled", color: "bg-red-600 hover:bg-red-700" }],
    in_progress: [{ label: "Complete — Passed", next: "completed", color: "bg-green-600 hover:bg-green-700", extra: { result: "passed", executedDate: new Date().toISOString() } }, { label: "Complete — Failed", next: "completed", color: "bg-red-600 hover:bg-red-700", extra: { result: "failed", executedDate: new Date().toISOString() } }, { label: "Complete — Partial", next: "completed", color: "bg-amber-600 hover:bg-amber-700", extra: { result: "partial", executedDate: new Date().toISOString() } }],
    cancelled: [{ label: "Reschedule", next: "scheduled", color: "bg-blue-600 hover:bg-blue-700" }],
    completed: [],
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4" data-testid="drill-description">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Drills & Exercises</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Tracks all business continuity testing activities. Supports four exercise types: Tabletop (discussion-based), Walkthrough (step-by-step review), Simulation (realistic scenario), and Full Test (live failover). Each drill links to a BCP or DRP plan, records participants and a scenario, and captures findings, lessons learned, and pass/fail results upon completion. Exercises flow through: Scheduled, In Progress, Completed, or Cancelled.</p>
          </div>
        </div>
      </div>
      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="drill-kpi-grid">
            <KpiCard title="Total Drills" value={stats.total} subtitle="All exercises" icon={BarChart3} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setPage(0); }} active={statusFilter === "all" && typeFilter === "all"} />
            <KpiCard title="Completed" value={stats.completed} subtitle="Finished exercises" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" onClick={() => { setStatusFilter(statusFilter === "completed" ? "all" : "completed"); setPage(0); }} active={statusFilter === "completed"} />
            <KpiCard title="Scheduled" value={stats.scheduled} subtitle="Upcoming drills" icon={Calendar} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter(statusFilter === "scheduled" ? "all" : "scheduled"); setPage(0); }} active={statusFilter === "scheduled"} />
            <KpiCard title="Pass Rate" value={`${stats.passRate}%`} subtitle="Completed drills" icon={TrendingUp} color="bg-green-500/15 text-green-400" />
            <KpiCard title="Overdue" value={stats.overdue} subtitle="Past scheduled date" icon={AlertTriangle} color={stats.overdue > 0 ? "bg-red-500/15 text-red-400" : "bg-muted/30 text-muted-foreground"} />
          </div>
          <Card><CardContent className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Exercise Type Distribution</p>
            <DistributionBar
              segments={[
                { key: "tabletop", label: "Tabletop", color: "bg-blue-500", count: stats.byType?.tabletop || 0 },
                { key: "walkthrough", label: "Walkthrough", color: "bg-cyan-500", count: stats.byType?.walkthrough || 0 },
                { key: "simulation", label: "Simulation", color: "bg-purple-500", count: stats.byType?.simulation || 0 },
                { key: "full_test", label: "Full Test", color: "bg-orange-500", count: stats.byType?.full_test || 0 },
              ]}
              onSegmentClick={(k) => { setTypeFilter(typeFilter === k ? "all" : k); setPage(0); }}
              activeSegment={typeFilter !== "all" ? typeFilter : undefined}
            />
          </CardContent></Card>
        </div>
      ) : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[80px] rounded-xl" />)}</div>}

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search drills..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-drill-search" /></div>

      {isLoading ? <Skeleton className="h-[300px] rounded-xl" /> : (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Title</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Linked Plan</th>
                <th className="text-left p-3 font-medium">Scheduled</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Result</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {paged.map(d => (
                  <tr key={d.id} className="border-b hover:bg-muted/30" data-testid={`row-drill-${d.id}`}>
                    <td className="p-3 font-medium max-w-[200px] truncate">{d.title}</td>
                    <td className="p-3 capitalize text-muted-foreground">{d.drillType.replace("_", " ")}</td>
                    <td className="p-3 text-muted-foreground max-w-[150px] truncate">{getPlanTitle(d.linkedPlanId)}</td>
                    <td className="p-3">{formatDate(d.scheduledDate)}</td>
                    <td className="p-3"><Badge className={`${DRILL_STATUS_BADGE[d.status] || ""} text-xs`}>{d.status.replace("_", " ")}</Badge></td>
                    <td className="p-3"><Badge className={`${RESULT_BADGE[d.result] || ""} text-xs`}>{d.result}</Badge></td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setDetailId(d.id); setEditing(false); }} data-testid={`button-view-drill-${d.id}`}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setDetailId(d.id); startEdit(d); }} data-testid={`button-edit-drill-${d.id}`}><Pencil className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No drills found</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="p-3"><Pagination page={page} totalPages={totalPages} setPage={setPage} /></div>
        </CardContent></Card>
      )}

      <Dialog open={!!detail} onOpenChange={() => { setDetailId(null); setEditing(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{detail?.title}</DialogTitle>
              {detail && !editing && <Button variant="ghost" size="sm" onClick={() => startEdit(detail)} data-testid="button-edit-drill-detail"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>}
            </div>
          </DialogHeader>
          {detail && !editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Type</p><p className="font-medium capitalize">{detail.drillType.replace("_", " ")}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><Badge className={`${DRILL_STATUS_BADGE[detail.status]} text-xs`}>{detail.status.replace("_"," ")}</Badge></div>
                <div><p className="text-muted-foreground text-xs">Scheduled</p><p className="font-medium">{formatDate(detail.scheduledDate)}</p></div>
                <div><p className="text-muted-foreground text-xs">Executed</p><p className="font-medium">{formatDate(detail.executedDate)}</p></div>
                <div><p className="text-muted-foreground text-xs">Result</p><Badge className={`${RESULT_BADGE[detail.result]} text-xs`}>{detail.result}</Badge></div>
                <div><p className="text-muted-foreground text-xs">Linked Plan</p><p className="font-medium">{getPlanTitle(detail.linkedPlanId)}</p></div>
              </div>
              <div><p className="text-muted-foreground text-xs mb-1">Scenario</p><p>{detail.scenario}</p></div>
              {detail.participants.length > 0 && (
                <div><p className="text-muted-foreground text-xs mb-1">Participants</p><div className="flex flex-wrap gap-1">{detail.participants.map((p, i) => <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>)}</div></div>
              )}
              {detail.findings && <div><p className="text-muted-foreground text-xs">Findings</p><p>{detail.findings}</p></div>}
              {detail.lessonsLearned && <div><p className="text-muted-foreground text-xs">Lessons Learned</p><p>{detail.lessonsLearned}</p></div>}
              {detail.nextDrillDate && <div><p className="text-muted-foreground text-xs">Next Drill</p><p className="font-medium">{formatDate(detail.nextDrillDate)}</p></div>}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {(DRILL_TRANSITIONS[detail.status] || []).map(t => (
                  <Button key={t.label} size="sm" className={`${t.color} text-white`} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: detail.id, data: { status: t.next, ...(t.extra || {}) } })} data-testid={`button-drill-${t.next}`}>{t.label}</Button>
                ))}
              </div>
            </div>
          )}
          {detail && editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs mb-1">Status</p>
                  <Select value={(editData.status as string) || detail.status} onValueChange={v => setEditData(d => ({ ...d, status: v as any }))}>
                    <SelectTrigger data-testid="edit-drill-status"><SelectValue /></SelectTrigger>
                    <SelectContent>{["scheduled","in_progress","completed","cancelled"].map(v => <SelectItem key={v} value={v}>{v.replace("_"," ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><p className="text-muted-foreground text-xs mb-1">Result</p>
                  <Select value={(editData.result as string) || detail.result} onValueChange={v => setEditData(d => ({ ...d, result: v as any }))}>
                    <SelectTrigger data-testid="edit-drill-result"><SelectValue /></SelectTrigger>
                    <SelectContent>{["pending","passed","failed","partial"].map(v => <SelectItem key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><p className="text-muted-foreground text-xs mb-1">Executed Date</p><Input type="date" value={toDateInput(editData.executedDate ?? detail.executedDate)} onChange={e => setEditData(d => ({ ...d, executedDate: e.target.value || null }))} data-testid="edit-drill-executed" /></div>
              <div><p className="text-muted-foreground text-xs mb-1">Findings</p><Textarea value={(editData.findings as string) ?? detail.findings ?? ""} onChange={e => setEditData(d => ({ ...d, findings: e.target.value }))} data-testid="edit-drill-findings" /></div>
              <div><p className="text-muted-foreground text-xs mb-1">Lessons Learned</p><Textarea value={(editData.lessonsLearned as string) ?? detail.lessonsLearned ?? ""} onChange={e => setEditData(d => ({ ...d, lessonsLearned: e.target.value }))} data-testid="edit-drill-lessons" /></div>
              <div><p className="text-muted-foreground text-xs mb-1">Next Drill Date</p><Input type="date" value={toDateInput(editData.nextDrillDate ?? detail.nextDrillDate)} onChange={e => setEditData(d => ({ ...d, nextDrillDate: e.target.value || null }))} data-testid="edit-drill-next" /></div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => updateMutation.mutate({ id: detail.id, data: editData })} disabled={updateMutation.isPending} data-testid="button-save-drill"><Save className="h-4 w-4 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-drill-edit"><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Schedule New Drill</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
              <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} data-testid="input-drill-title" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="drillType" render={({ field }) => (<FormItem><FormLabel>Exercise Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-drill-type"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["tabletop","walkthrough","simulation","full_test"].map(v => <SelectItem key={v} value={v}>{v.replace("_"," ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="scheduledDate" render={({ field }) => (<FormItem><FormLabel>Scheduled Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-drill-date" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="linkedPlanType" render={({ field }) => (<FormItem><FormLabel>Plan Type</FormLabel><Select value={field.value || "bcp"} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-drill-plan-type"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="bcp">BCP</SelectItem><SelectItem value="drp">DRP</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="linkedPlanId" render={({ field }) => (<FormItem><FormLabel>Linked Plan</FormLabel><Select value={field.value || ""} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-drill-plan"><SelectValue placeholder="Optional" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{allPlans.map(p => <SelectItem key={p.id} value={p.id}>{p.title} ({p.type.toUpperCase()})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="scenario" render={({ field }) => (<FormItem><FormLabel>Scenario</FormLabel><FormControl><Textarea {...field} data-testid="input-drill-scenario" /></FormControl><FormMessage /></FormItem>)} />
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-drill">{createMutation.isPending ? "Scheduling..." : "Schedule Drill"}</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ReviewsTabContent({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});

  const { data: reviews = [], isLoading } = useQuery<Review[]>({ queryKey: ["/api/bcp-reviews"] });
  const { data: stats } = useQuery<ReviewStats>({ queryKey: ["/api/bcp-reviews/stats"] });
  const { data: bcpPlans = [] } = useQuery<BcpPlan[]>({ queryKey: ["/api/bcp-plans"] });
  const { data: drpPlans = [] } = useQuery<DrpPlan[]>({ queryKey: ["/api/drp-plans"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { await apiRequest("POST", "/api/bcp-reviews", data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bcp-reviews"] }); queryClient.invalidateQueries({ queryKey: ["/api/bcp-reviews/stats"] }); setOpen(false); toast({ title: "Review created" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { await apiRequest("PATCH", `/api/bcp-reviews/${id}`, data); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bcp-reviews"] }); queryClient.invalidateQueries({ queryKey: ["/api/bcp-reviews/stats"] }); setEditing(false); toast({ title: "Review updated" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const form = useForm({
    resolver: zodResolver(insertReviewSchema.omit({ userId: true }).extend({
      reviewer: z.string().min(1),
      reviewDate: z.string().min(1),
    })),
    defaultValues: { linkedPlanId: "", linkedPlanType: "bcp", reviewType: "scheduled", reviewDate: "", reviewer: "", status: "pending", findings: "", recommendations: "", changesRequired: false, changesDescription: "", nextReviewDate: "" },
  });

  const filtered = reviews.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.reviewType !== typeFilter) return false;
    if (search && !r.reviewer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const detail = detailId ? reviews.find(r => r.id === detailId) : null;
  const allPlans = [...bcpPlans.map(p => ({ ...p, type: "bcp" })), ...drpPlans.map(p => ({ ...p, type: "drp" }))];
  const getPlanTitle = (id: string | null) => { if (!id) return "N/A"; return allPlans.find(p => p.id === id)?.title || id; };
  const formatDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString() : "N/A";
  const toDateInput = (d: string | Date | null) => d ? new Date(d).toISOString().split("T")[0] : "";

  const startEdit = (review: Review) => {
    setEditData({ status: review.status, findings: review.findings || "", recommendations: review.recommendations || "", changesRequired: review.changesRequired, changesDescription: review.changesDescription || "", nextReviewDate: review.nextReviewDate });
    setEditing(true);
  };

  const REVIEW_TRANSITIONS: Record<string, { label: string; next: string; color: string }[]> = {
    pending: [{ label: "Start Review", next: "in_progress", color: "bg-amber-600 hover:bg-amber-700" }],
    in_progress: [{ label: "Complete Review", next: "completed", color: "bg-green-600 hover:bg-green-700" }],
    completed: [],
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4" data-testid="review-description">
        <div className="flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Plan Reviews & Audits</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Manages the plan review lifecycle to ensure continuity plans remain current and effective. Supports four review types: Scheduled (routine), Post-Incident (after an event), Annual (yearly compliance), and Regulatory (external audit). Each review links to a BCP or DRP plan and records the reviewer, findings, recommendations, whether plan changes are required, and the next scheduled review date. Reviews flow through: Pending, In Progress, and Completed.</p>
          </div>
        </div>
      </div>
      {stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="review-kpi-grid">
            <KpiCard title="Total Reviews" value={stats.total} subtitle="All review cycles" icon={BarChart3} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setPage(0); }} active={statusFilter === "all" && typeFilter === "all"} />
            <KpiCard title="Pending" value={stats.pending} subtitle="Awaiting review" icon={Clock} color="bg-blue-500/15 text-blue-400" onClick={() => { setStatusFilter(statusFilter === "pending" ? "all" : "pending"); setPage(0); }} active={statusFilter === "pending"} />
            <KpiCard title="In Progress" value={stats.inProgress} subtitle="Under review" icon={ArrowRight} color="bg-amber-500/15 text-amber-400" onClick={() => { setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress"); setPage(0); }} active={statusFilter === "in_progress"} />
            <KpiCard title="Completed" value={stats.completed} subtitle="Finished" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" onClick={() => { setStatusFilter(statusFilter === "completed" ? "all" : "completed"); setPage(0); }} active={statusFilter === "completed"} />
            <KpiCard title="Changes Required" value={`${stats.changesRequiredPct}%`} subtitle="Required plan updates" icon={RefreshCw} color="bg-orange-500/15 text-orange-400" />
          </div>
          <Card><CardContent className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Review Type Distribution</p>
            <DistributionBar
              segments={[
                { key: "scheduled", label: "Scheduled", color: "bg-blue-500", count: stats.byType?.scheduled || 0 },
                { key: "post_incident", label: "Post-Incident", color: "bg-red-500", count: stats.byType?.post_incident || 0 },
                { key: "annual", label: "Annual", color: "bg-purple-500", count: stats.byType?.annual || 0 },
                { key: "regulatory", label: "Regulatory", color: "bg-amber-500", count: stats.byType?.regulatory || 0 },
              ]}
              onSegmentClick={(k) => { setTypeFilter(typeFilter === k ? "all" : k); setPage(0); }}
              activeSegment={typeFilter !== "all" ? typeFilter : undefined}
            />
          </CardContent></Card>
        </div>
      ) : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[80px] rounded-xl" />)}</div>}

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by reviewer..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-review-search" /></div>

      {isLoading ? <Skeleton className="h-[300px] rounded-xl" /> : (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Plan</th>
                <th className="text-left p-3 font-medium">Review Type</th>
                <th className="text-left p-3 font-medium">Reviewer</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Changes</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr></thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30" data-testid={`row-review-${r.id}`}>
                    <td className="p-3 font-medium max-w-[180px] truncate">{getPlanTitle(r.linkedPlanId)}</td>
                    <td className="p-3 capitalize text-muted-foreground">{r.reviewType.replace("_", " ")}</td>
                    <td className="p-3">{r.reviewer}</td>
                    <td className="p-3">{formatDate(r.reviewDate)}</td>
                    <td className="p-3"><Badge className={`${REVIEW_STATUS_BADGE[r.status] || ""} text-xs`}>{r.status.replace("_", " ")}</Badge></td>
                    <td className="p-3">{r.changesRequired ? <Badge className="bg-orange-500/15 text-orange-400 text-xs">Yes</Badge> : <Badge className="bg-muted/50 text-muted-foreground text-xs">No</Badge>}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setDetailId(r.id); setEditing(false); }} data-testid={`button-view-review-${r.id}`}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setDetailId(r.id); startEdit(r); }} data-testid={`button-edit-review-${r.id}`}><Pencil className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paged.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No reviews found</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="p-3"><Pagination page={page} totalPages={totalPages} setPage={setPage} /></div>
        </CardContent></Card>
      )}

      <Dialog open={!!detail} onOpenChange={() => { setDetailId(null); setEditing(false); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Review: {getPlanTitle(detail?.linkedPlanId ?? null)}</DialogTitle>
              {detail && !editing && <Button variant="ghost" size="sm" onClick={() => startEdit(detail)} data-testid="button-edit-review-detail"><Pencil className="h-4 w-4 mr-1" /> Edit</Button>}
            </div>
          </DialogHeader>
          {detail && !editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs">Review Type</p><p className="font-medium capitalize">{detail.reviewType.replace("_", " ")}</p></div>
                <div><p className="text-muted-foreground text-xs">Status</p><Badge className={`${REVIEW_STATUS_BADGE[detail.status]} text-xs`}>{detail.status.replace("_"," ")}</Badge></div>
                <div><p className="text-muted-foreground text-xs">Reviewer</p><p className="font-medium">{detail.reviewer}</p></div>
                <div><p className="text-muted-foreground text-xs">Review Date</p><p className="font-medium">{formatDate(detail.reviewDate)}</p></div>
                <div><p className="text-muted-foreground text-xs">Changes Required</p><p className="font-medium">{detail.changesRequired ? "Yes" : "No"}</p></div>
                <div><p className="text-muted-foreground text-xs">Next Review</p><p className="font-medium">{formatDate(detail.nextReviewDate)}</p></div>
              </div>
              {detail.findings && <div><p className="text-muted-foreground text-xs">Findings</p><p>{detail.findings}</p></div>}
              {detail.recommendations && <div><p className="text-muted-foreground text-xs">Recommendations</p><p>{detail.recommendations}</p></div>}
              {detail.changesDescription && <div><p className="text-muted-foreground text-xs">Changes Made</p><p>{detail.changesDescription}</p></div>}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {(REVIEW_TRANSITIONS[detail.status] || []).map(t => (
                  <Button key={t.next} size="sm" className={`${t.color} text-white`} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: detail.id, data: { status: t.next } })} data-testid={`button-review-${t.next}`}>{t.label}</Button>
                ))}
              </div>
            </div>
          )}
          {detail && editing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-muted-foreground text-xs mb-1">Status</p>
                  <Select value={(editData.status as string) || detail.status} onValueChange={v => setEditData(d => ({ ...d, status: v as any }))}>
                    <SelectTrigger data-testid="edit-review-status"><SelectValue /></SelectTrigger>
                    <SelectContent>{["pending","in_progress","completed"].map(v => <SelectItem key={v} value={v}>{v.replace("_"," ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <p className="text-muted-foreground text-xs mb-1">Changes Required</p>
                    <div className="flex items-center gap-2 h-10">
                      <Switch checked={editData.changesRequired ?? detail.changesRequired} onCheckedChange={v => setEditData(d => ({ ...d, changesRequired: v }))} data-testid="edit-review-changes" />
                      <span className="text-sm">{editData.changesRequired ?? detail.changesRequired ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div><p className="text-muted-foreground text-xs mb-1">Findings</p><Textarea value={(editData.findings as string) ?? detail.findings ?? ""} onChange={e => setEditData(d => ({ ...d, findings: e.target.value }))} data-testid="edit-review-findings" /></div>
              <div><p className="text-muted-foreground text-xs mb-1">Recommendations</p><Textarea value={(editData.recommendations as string) ?? detail.recommendations ?? ""} onChange={e => setEditData(d => ({ ...d, recommendations: e.target.value }))} data-testid="edit-review-recommendations" /></div>
              <div><p className="text-muted-foreground text-xs mb-1">Changes Description</p><Textarea value={(editData.changesDescription as string) ?? detail.changesDescription ?? ""} onChange={e => setEditData(d => ({ ...d, changesDescription: e.target.value }))} data-testid="edit-review-changes-desc" /></div>
              <div><p className="text-muted-foreground text-xs mb-1">Next Review Date</p><Input type="date" value={toDateInput(editData.nextReviewDate ?? detail.nextReviewDate)} onChange={e => setEditData(d => ({ ...d, nextReviewDate: e.target.value || null }))} data-testid="edit-review-next" /></div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => updateMutation.mutate({ id: detail.id, data: editData })} disabled={updateMutation.isPending} data-testid="button-save-review"><Save className="h-4 w-4 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}</Button>
                <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-review-edit"><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Schedule New Review</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="reviewType" render={({ field }) => (<FormItem><FormLabel>Review Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-review-type"><SelectValue /></SelectTrigger></FormControl><SelectContent>{["scheduled","post_incident","annual","regulatory"].map(v => <SelectItem key={v} value={v}>{v.replace("_"," ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="reviewDate" render={({ field }) => (<FormItem><FormLabel>Review Date</FormLabel><FormControl><Input type="date" {...field} data-testid="input-review-date" /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="reviewer" render={({ field }) => (<FormItem><FormLabel>Reviewer</FormLabel><FormControl><Input {...field} data-testid="input-review-reviewer" /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="linkedPlanType" render={({ field }) => (<FormItem><FormLabel>Plan Type</FormLabel><Select value={field.value || "bcp"} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-review-plan-type"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="bcp">BCP</SelectItem><SelectItem value="drp">DRP</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="linkedPlanId" render={({ field }) => (<FormItem><FormLabel>Linked Plan</FormLabel><Select value={field.value || ""} onValueChange={field.onChange}><FormControl><SelectTrigger data-testid="select-review-plan"><SelectValue placeholder="Optional" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">None</SelectItem>{allPlans.map(p => <SelectItem key={p.id} value={p.id}>{p.title} ({p.type.toUpperCase()})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="findings" render={({ field }) => (<FormItem><FormLabel>Initial Findings</FormLabel><FormControl><Textarea {...field} value={field.value || ""} data-testid="input-review-findings" /></FormControl><FormMessage /></FormItem>)} />
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-review">{createMutation.isPending ? "Creating..." : "Create Review"}</Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
