import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import type { CsiRegisterItem } from "@shared/schema";
import {
  TrendingUp, Plus, Search, Edit2, Trash2, ChevronDown, ChevronUp, Target,
  BarChart3, CheckCircle2, Clock, AlertTriangle, XCircle, PlayCircle,
  Brain, Sparkles, Zap, ArrowRight, Lightbulb, ListChecks, RotateCcw,
  CheckCheck, ChevronRight, RefreshCw
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  identified:  { label: "Identified",  color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",     icon: AlertTriangle },
  approved:    { label: "Approved",    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: PlayCircle },
  measuring:   { label: "Measuring",   color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: BarChart3 },
  completed:   { label: "Completed",   color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",   icon: CheckCircle2 },
  cancelled:   { label: "Cancelled",   color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",      icon: XCircle },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  low:      "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const CATEGORY_LABELS: Record<string, string> = {
  process: "Process", technology: "Technology", people: "People", service: "Service",
};

const formSchema = z.object({
  title: z.string().min(3, "Title required"),
  description: z.string().min(5, "Description required"),
  category: z.enum(["process", "technology", "people", "service"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["identified", "approved", "in_progress", "measuring", "completed", "cancelled"]),
  baseline: z.string().optional(),
  target: z.string().optional(),
  currentMeasure: z.string().optional(),
  owner: z.string().optional(),
  sponsor: z.string().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

interface AiSuggestion {
  title: string;
  description: string;
  category: string;
  priority: string;
  baseline: string;
  target: string;
  rationale: string;
  linkedPatterns: string[];
}

interface ActionPlanPhase {
  objective?: string;
  steps: string[];
  successCriteria?: string;
  resources?: string[];
  risks?: string[];
  kpis?: string[];
  measurementMethod?: string;
  reviewCadence?: string;
  estimatedDuration?: string;
}

interface ActionPlan {
  executiveSummary?: string;
  planPhase?: ActionPlanPhase;
  doPhase?: ActionPlanPhase;
  checkPhase?: ActionPlanPhase;
  actPhase?: { scenarioIfSuccess?: string; scenarioIfFail?: string; sustainmentSteps?: string[] };
  recommendedNextStatus?: string;
  overallTimeline?: string;
}

interface AdvanceResult {
  readyToAdvance: boolean;
  recommendedStatus: string;
  progressAssessment: string;
  gapsBeforeAdvancing: string[];
  suggestedCurrentMeasure: string;
  nextActions: string[];
  confidence: number;
  applied: boolean;
  updatedItem?: CsiRegisterItem;
}

function PhaseBlock({ title, color, phase }: { title: string; color: string; phase?: ActionPlanPhase }) {
  if (!phase) return null;
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <p className="font-semibold text-xs uppercase tracking-wide mb-2 opacity-70">{title}</p>
      {phase.objective && <p className="text-xs mb-2 font-medium">{phase.objective}</p>}
      {phase.steps?.length > 0 && (
        <ul className="space-y-1 mb-2">
          {phase.steps.map((s, i) => (
            <li key={i} className="text-xs flex gap-2">
              <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 opacity-60" />{s}
            </li>
          ))}
        </ul>
      )}
      {phase.kpis?.length && (
        <div className="mt-1">
          <p className="text-[10px] font-semibold uppercase opacity-60 mb-1">KPIs</p>
          {phase.kpis.map((k, i) => <p key={i} className="text-xs">• {k}</p>)}
        </div>
      )}
      {phase.resources?.length && (
        <div className="mt-1">
          <p className="text-[10px] font-semibold uppercase opacity-60 mb-1">Resources</p>
          {phase.resources.map((r, i) => <p key={i} className="text-xs">• {r}</p>)}
        </div>
      )}
      {phase.risks?.length && (
        <div className="mt-1">
          <p className="text-[10px] font-semibold uppercase opacity-60 mb-1">Risks</p>
          {phase.risks.map((r, i) => <p key={i} className="text-xs">⚠ {r}</p>)}
        </div>
      )}
      {phase.estimatedDuration && (
        <p className="text-[10px] mt-2 opacity-60">Duration: {phase.estimatedDuration}</p>
      )}
    </div>
  );
}

function CsiCard({
  item, onEdit, onDelete,
}: {
  item: CsiRegisterItem;
  onEdit: (i: CsiRegisterItem) => void;
  onDelete: (id: number) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [actionPlan, setActionPlan] = useState<ActionPlan | null>(null);
  const [advanceResult, setAdvanceResult] = useState<AdvanceResult | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);

  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.identified;
  const Icon = cfg.icon;
  const hasProgress = item.baseline && item.target;

  const planMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/csi-register/${item.id}/ai/action-plan`);
      return r.json();
    },
    onSuccess: (data) => { setActionPlan(data); setShowPlan(true); },
    onError: (err: any) => toast({ title: "AI Action Plan failed", description: err?.message || "AI provider temporarily unavailable — please try again in a moment.", variant: "destructive" }),
  });

  const advanceMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/csi-register/${item.id}/ai/advance`);
      return r.json();
    },
    onSuccess: (data: AdvanceResult) => {
      setAdvanceResult(data);
      setShowAdvance(true);
      if (data.applied) {
        queryClient.invalidateQueries({ queryKey: ["/api/csi-register"] });
        toast({ title: `Status advanced to "${data.recommendedStatus}"`, description: "AI updated the item automatically." });
      }
    },
    onError: (err: any) => toast({ title: "AI Advance failed", description: err?.message || "AI provider temporarily unavailable — please try again in a moment.", variant: "destructive" }),
  });

  return (
    <Card className="border border-border" data-testid={`card-csi-${item.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground" data-testid={`text-csi-id-${item.id}`}>{item.csiId}</span>
                <Badge variant="outline" className={cfg.color}><Icon className="h-3 w-3 mr-1" />{cfg.label}</Badge>
                <Badge variant="outline" className={`text-xs ${PRIORITY_COLORS[item.priority]}`}>{item.priority}</Badge>
                <Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[item.category] || item.category}</Badge>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-950/30 gap-1"
                  onClick={() => planMut.mutate()}
                  disabled={planMut.isPending}
                  data-testid={`button-ai-plan-${item.id}`}
                >
                  {planMut.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ListChecks className="h-3 w-3" />}
                  Action Plan
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-950/30 gap-1"
                  onClick={() => advanceMut.mutate()}
                  disabled={advanceMut.isPending || ["completed", "cancelled"].includes(item.status)}
                  data-testid={`button-ai-advance-${item.id}`}
                >
                  {advanceMut.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  AI Advance
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(item)} data-testid={`button-edit-csi-${item.id}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)} data-testid={`button-delete-csi-${item.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(!expanded)} data-testid={`button-expand-csi-${item.id}`}>
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <h3 className="font-semibold text-sm mt-1" data-testid={`text-csi-title-${item.id}`}>{item.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>

            {hasProgress && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                {[
                  { label: "Baseline", value: item.baseline, color: "text-muted-foreground" },
                  { label: "Current", value: item.currentMeasure || "—", color: "text-primary font-semibold" },
                  { label: "Target", value: item.target, color: "text-green-600 dark:text-green-400 font-semibold" },
                ].map(m => (
                  <div key={m.label} className="text-center p-1.5 rounded bg-muted/30 border border-border">
                    <p className={`text-xs ${m.color}`} data-testid={`text-csi-${m.label.toLowerCase()}-${item.id}`}>{m.value}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            )}

            {expanded && (
              <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                {item.owner && <p>Owner: <span className="text-foreground">{item.owner}</span></p>}
                {item.sponsor && <p>Sponsor: <span className="text-foreground">{item.sponsor}</span></p>}
                {item.startDate && <p>Start: {new Date(item.startDate).toLocaleDateString()}</p>}
                {item.targetDate && (
                  <p>Target date: <span className={new Date(item.targetDate) < new Date() && item.status !== "completed" ? "text-red-500" : "text-foreground"}>{new Date(item.targetDate).toLocaleDateString()}</span></p>
                )}
                {item.notes && <p className="italic mt-1">{item.notes}</p>}
              </div>
            )}

            {/* AI Action Plan Result */}
            {showPlan && actionPlan && (
              <div className="mt-3 border-t border-violet-500/20 pt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-violet-400 flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" />AI PDCA Action Plan
                    {actionPlan.overallTimeline && <Badge variant="outline" className="text-[10px] ml-1">{actionPlan.overallTimeline}</Badge>}
                  </p>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setShowPlan(false)}>
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                {actionPlan.executiveSummary && (
                  <p className="text-xs text-muted-foreground italic">{actionPlan.executiveSummary}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <PhaseBlock title="Plan" color="border-blue-500/20 bg-blue-950/10" phase={actionPlan.planPhase} />
                  <PhaseBlock title="Do" color="border-yellow-500/20 bg-yellow-950/10" phase={actionPlan.doPhase} />
                  <PhaseBlock title="Check" color="border-orange-500/20 bg-orange-950/10" phase={actionPlan.checkPhase} />
                  {actionPlan.actPhase && (
                    <div className="rounded-lg border border-green-500/20 bg-green-950/10 p-3">
                      <p className="font-semibold text-xs uppercase tracking-wide mb-2 opacity-70">Act</p>
                      {actionPlan.actPhase.scenarioIfSuccess && (
                        <p className="text-xs mb-1"><span className="text-green-400 font-medium">✓ Success: </span>{actionPlan.actPhase.scenarioIfSuccess}</p>
                      )}
                      {actionPlan.actPhase.scenarioIfFail && (
                        <p className="text-xs mb-1"><span className="text-red-400 font-medium">✗ Fail: </span>{actionPlan.actPhase.scenarioIfFail}</p>
                      )}
                      {actionPlan.actPhase.sustainmentSteps?.map((s, i) => (
                        <p key={i} className="text-xs">• {s}</p>
                      ))}
                    </div>
                  )}
                </div>
                {actionPlan.recommendedNextStatus && actionPlan.recommendedNextStatus !== item.status && (
                  <p className="text-xs text-violet-400">
                    <Sparkles className="h-3 w-3 inline mr-1" />
                    Recommended next status: <span className="font-semibold capitalize">{actionPlan.recommendedNextStatus.replace("_", " ")}</span>
                  </p>
                )}
              </div>
            )}

            {/* AI Advance Result */}
            {showAdvance && advanceResult && (
              <div className="mt-3 border-t border-blue-500/20 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />AI Progress Evaluation
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {advanceResult.confidence}% confidence
                    </Badge>
                    {advanceResult.applied && (
                      <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-500/30 border">Applied</Badge>
                    )}
                  </p>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setShowAdvance(false)}>
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{advanceResult.progressAssessment}</p>
                {advanceResult.readyToAdvance ? (
                  <p className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCheck className="h-3.5 w-3.5" />
                    Ready to advance → <span className="font-semibold capitalize">{advanceResult.recommendedStatus.replace("_", " ")}</span>
                    {!advanceResult.applied && <span className="text-muted-foreground ml-1">(confidence below threshold — review manually)</span>}
                  </p>
                ) : (
                  <p className="text-xs text-orange-400 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />Not yet ready to advance
                  </p>
                )}
                {advanceResult.gapsBeforeAdvancing?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">Gaps to address first:</p>
                    {advanceResult.gapsBeforeAdvancing.map((g, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {g}</p>
                    ))}
                  </div>
                )}
                {advanceResult.nextActions?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground mb-1">Immediate next actions:</p>
                    {advanceResult.nextActions.map((a, i) => (
                      <p key={i} className="text-xs text-blue-400">→ {a}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CsiForm({ defaultValues, onSubmit, submitting }: {
  defaultValues?: Partial<FormValues>;
  onSubmit: (v: FormValues) => void;
  submitting: boolean;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "", description: "", category: "process", priority: "medium", status: "identified",
      baseline: "", target: "", currentMeasure: "", owner: "", sponsor: "",
      startDate: "", targetDate: "", notes: "", ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="Improvement initiative title" data-testid="input-csi-title" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} data-testid="input-csi-description" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="category" render={({ field }) => (
            <FormItem><FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger data-testid="select-csi-category"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="priority" render={({ field }) => (
            <FormItem><FormLabel>Priority</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger data-testid="select-csi-priority"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{["critical", "high", "medium", "low"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem><FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger data-testid="select-csi-status"><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField control={form.control} name="baseline" render={({ field }) => (
            <FormItem><FormLabel>Baseline</FormLabel><FormControl><Input {...field} placeholder="Current state" data-testid="input-csi-baseline" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="currentMeasure" render={({ field }) => (
            <FormItem><FormLabel>Current</FormLabel><FormControl><Input {...field} placeholder="Latest measure" data-testid="input-csi-current" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="target" render={({ field }) => (
            <FormItem><FormLabel>Target</FormLabel><FormControl><Input {...field} placeholder="Goal" data-testid="input-csi-target" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="owner" render={({ field }) => (
            <FormItem><FormLabel>Owner</FormLabel><FormControl><Input {...field} data-testid="input-csi-owner" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="sponsor" render={({ field }) => (
            <FormItem><FormLabel>Sponsor</FormLabel><FormControl><Input {...field} data-testid="input-csi-sponsor" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input {...field} type="date" data-testid="input-csi-startdate" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="targetDate" render={({ field }) => (
            <FormItem><FormLabel>Target Date</FormLabel><FormControl><Input {...field} type="date" data-testid="input-csi-targetdate" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} rows={2} data-testid="input-csi-notes" /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={submitting} className="w-full" data-testid="button-csi-submit">
          {submitting ? "Saving…" : "Save Improvement"}
        </Button>
      </form>
    </Form>
  );
}

export default function CsiRegisterPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CsiRegisterItem | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[] | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState("");
  const [topRiskArea, setTopRiskArea] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [raisingIdx, setRaisingIdx] = useState<number | null>(null);

  const { data: items = [], isLoading } = useQuery<CsiRegisterItem[]>({
    queryKey: ["/api/csi-register"],
  });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => apiRequest("POST", "/api/csi-register", {
      ...v,
      startDate: v.startDate ? new Date(v.startDate) : null,
      targetDate: v.targetDate ? new Date(v.targetDate) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/csi-register"] });
      setCreateOpen(false);
      toast({ title: "CSI item created" });
    },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, v }: { id: number; v: FormValues }) => apiRequest("PATCH", `/api/csi-register/${id}`, {
      ...v,
      startDate: v.startDate ? new Date(v.startDate) : null,
      targetDate: v.targetDate ? new Date(v.targetDate) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/csi-register"] });
      setEditItem(null);
      toast({ title: "CSI item updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/csi-register/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/csi-register"] });
      toast({ title: "Deleted" });
    },
  });

  const analyseMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/csi-register/ai/analyse");
      return r.json();
    },
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions || []);
      setAnalysisSummary(data.analysisSummary || "");
      setTopRiskArea(data.topRiskArea || "");
      setShowSuggestions(true);
    },
    onError: (err: any) => toast({ title: "AI analysis failed", description: err?.message || "AI provider temporarily unavailable — please try again in a moment.", variant: "destructive" }),
  });

  const raiseSuggestion = async (suggestion: AiSuggestion, idx: number) => {
    setRaisingIdx(idx);
    try {
      await apiRequest("POST", "/api/csi-register", {
        title: suggestion.title,
        description: `${suggestion.description}\n\nRationale: ${suggestion.rationale}`,
        category: suggestion.category,
        priority: suggestion.priority,
        baseline: suggestion.baseline,
        target: suggestion.target,
        status: "identified",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/csi-register"] });
      toast({ title: "Improvement raised", description: `"${suggestion.title}" added to the register.` });
      setAiSuggestions(prev => prev?.filter((_, i) => i !== idx) ?? null);
    } catch {
      toast({ title: "Failed to raise improvement", variant: "destructive" });
    } finally {
      setRaisingIdx(null);
    }
  };

  const filtered = items.filter(item => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.csiId.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: items.length,
    inProgress: items.filter(i => i.status === "in_progress").length,
    completed: items.filter(i => i.status === "completed").length,
    overdue: items.filter(i => i.targetDate && new Date(i.targetDate) < new Date() && !["completed", "cancelled"].includes(i.status)).length,
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />CSI Register
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Continual Service Improvement — PDCA improvement pipeline with measured outcomes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="border-violet-500/40 text-violet-400 hover:bg-violet-950/30"
            onClick={() => analyseMut.mutate()}
            disabled={analyseMut.isPending}
            data-testid="button-ai-analyse-csi"
          >
            {analyseMut.isPending
              ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Analysing…</>
              : <><Brain className="h-4 w-4 mr-2" />AI Suggest Improvements</>}
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-csi">
                <Plus className="h-4 w-4 mr-1" />New Improvement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Register Improvement Initiative</DialogTitle></DialogHeader>
              <CsiForm onSubmit={(v) => createMut.mutate(v)} submitting={createMut.isPending} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total",       value: stats.total,      color: "text-primary" },
          { label: "In Progress", value: stats.inProgress, color: "text-yellow-500" },
          { label: "Completed",   value: stats.completed,  color: "text-green-500" },
          { label: "Overdue",     value: stats.overdue,    color: "text-red-500" },
        ].map(s => (
          <Card key={s.label} className="border border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`} data-testid={`stat-csi-${s.label.toLowerCase()}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Suggestions Panel */}
      {showSuggestions && aiSuggestions && (
        <Card className="border-violet-500/30 bg-violet-950/10">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2 text-violet-300">
                  <Sparkles className="h-4 w-4" />AI Improvement Analysis
                </h3>
                {analysisSummary && <p className="text-xs text-muted-foreground mt-1">{analysisSummary}</p>}
                {topRiskArea && (
                  <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />Top risk area: <span className="font-semibold">{topRiskArea}</span>
                  </p>
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setShowSuggestions(false)}>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            {aiSuggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">All suggestions have been raised ✓</p>
            ) : (
              <div className="grid gap-3">
                {aiSuggestions.map((s, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-background/50 p-3 space-y-2" data-testid={`card-ai-suggestion-${idx}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{s.title}</span>
                          <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[s.priority]}`}>{s.priority}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABELS[s.category] || s.category}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                        {s.rationale && (
                          <p className="text-xs text-violet-400 mt-1 flex items-start gap-1">
                            <Lightbulb className="h-3 w-3 shrink-0 mt-0.5" />{s.rationale}
                          </p>
                        )}
                        {(s.baseline || s.target) && (
                          <div className="flex gap-4 mt-2 text-xs">
                            {s.baseline && <span className="text-muted-foreground">Baseline: <span className="text-foreground">{s.baseline}</span></span>}
                            {s.target && <span className="text-muted-foreground">Target: <span className="text-green-400">{s.target}</span></span>}
                          </div>
                        )}
                        {s.linkedPatterns?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {s.linkedPatterns.map((p, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] text-muted-foreground">{p}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white text-xs"
                        onClick={() => raiseSuggestion(s, idx)}
                        disabled={raisingIdx === idx}
                        data-testid={`button-raise-suggestion-${idx}`}
                      >
                        {raisingIdx === idx
                          ? <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                          : <ArrowRight className="h-3 w-3 mr-1" />}
                        Raise
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button
                size="sm" variant="outline"
                className="border-violet-500/30 text-violet-400 text-xs"
                onClick={() => analyseMut.mutate()}
                disabled={analyseMut.isPending}
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />Re-analyse
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search improvements…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-csi" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-csi-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36" data-testid="select-csi-filter-category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Items list */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed border-border">
          <CardContent className="p-10 text-center">
            <Target className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-3">No improvements registered. Start your CSI pipeline.</p>
            <div className="flex items-center justify-center gap-3">
              <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />Add Manually
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                onClick={() => analyseMut.mutate()}
                disabled={analyseMut.isPending}
              >
                <Brain className="h-3.5 w-3.5 mr-1" />Let AI Suggest
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <CsiCard key={item.id} item={item} onEdit={setEditItem} onDelete={(id) => deleteMut.mutate(id)} />
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit — {editItem?.csiId}</DialogTitle></DialogHeader>
          {editItem && (
            <CsiForm
              defaultValues={{
                title: editItem.title, description: editItem.description,
                category: editItem.category as any, priority: editItem.priority as any, status: editItem.status as any,
                baseline: editItem.baseline || "", target: editItem.target || "", currentMeasure: editItem.currentMeasure || "",
                owner: editItem.owner || "", sponsor: editItem.sponsor || "",
                startDate: editItem.startDate ? new Date(editItem.startDate).toISOString().split("T")[0] : "",
                targetDate: editItem.targetDate ? new Date(editItem.targetDate).toISOString().split("T")[0] : "",
                notes: editItem.notes || "",
              }}
              onSubmit={(v) => updateMut.mutate({ id: editItem.id, v })}
              submitting={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
