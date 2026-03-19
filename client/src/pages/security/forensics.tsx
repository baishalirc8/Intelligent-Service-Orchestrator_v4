import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Brain, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Info,
  Search, X, Lock, FileText, Activity, Clock, Eye, BarChart3,
  Camera, Users, DollarSign, Scale, Laptop, Shield, Fingerprint,
  ChevronRight, Download, Plus, ArrowRight, Circle,
  Hash, Archive, Gavel, Flag, CheckCheck, Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

/* ── Domain config ──────────────────────────────────────────────── */
const DOMAIN_META: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  digital:    { label: "Digital / IT",           icon: Laptop,     color: "text-teal-400",   badge: "bg-teal-500/15 text-teal-300 border-teal-500/25" },
  physical:   { label: "Physical Security",       icon: Camera,     color: "text-blue-400",   badge: "bg-blue-500/15 text-blue-300 border-blue-500/25" },
  hr_insider: { label: "HR & Insider Threat",     icon: Users,      color: "text-purple-400", badge: "bg-purple-500/15 text-purple-300 border-purple-500/25" },
  financial:  { label: "Financial & Fraud",       icon: DollarSign, color: "text-yellow-400", badge: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25" },
  legal:      { label: "Legal & eDiscovery",      icon: Scale,      color: "text-orange-400", badge: "bg-orange-500/15 text-orange-300 border-orange-500/25" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  open:        { label: "Open",        color: "bg-sky-500/15 text-sky-300 border-sky-500/25" },
  active:      { label: "Active",      color: "bg-green-500/15 text-green-300 border-green-500/25" },
  escalated:   { label: "Escalated",   color: "bg-red-500/15 text-red-300 border-red-500/25" },
  legal_hold:  { label: "Legal Hold",  color: "bg-orange-500/15 text-orange-300 border-orange-500/25" },
  closed:      { label: "Closed",      color: "bg-muted/20 text-muted-foreground/50 border-muted/30" },
};

const PRIORITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-yellow-400",
  low:      "text-muted-foreground/50",
};

const EVIDENCE_TYPE_ICON: Record<string, any> = {
  memory_dump:  Archive, log_file: FileText, screenshot: Camera, cctv_clip: Camera,
  badge_record: Lock, transaction: DollarSign, email: FileText, document: FileText,
  testimony: Users, hash_verify: Hash,
};

const INDICATOR_STATUS_META: Record<string, { color: string; label: string }> = {
  monitoring:  { color: "bg-sky-500/15 text-sky-300 border-sky-500/25",      label: "Monitoring" },
  triggered:   { color: "bg-red-500/15 text-red-300 border-red-500/25",      label: "Triggered" },
  case_opened: { color: "bg-orange-500/15 text-orange-300 border-orange-500/25", label: "Case Opened" },
  suppressed:  { color: "bg-muted/20 text-muted-foreground/50 border-muted/30",  label: "Suppressed" },
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))  return <p key={i} className="text-sm font-bold text-foreground mt-3 first:mt-0">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <p key={i} className="pl-3 border-l border-teal-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

/* ── Case Detail Sheet ───────────────────────────────────────────── */
function CaseDetailSheet({ caseId, onClose }: { caseId: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview" | "timeline" | "evidence" | "report">("overview");
  const [report, setReport] = useState<string | null>(null);

  const { data: fc } = useQuery<any>({
    queryKey: ["/api/forensics/cases", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/forensics/cases/${caseId}`);
      return r.json();
    },
  });

  const { data: evidence = [] } = useQuery<any[]>({
    queryKey: ["/api/forensics/cases", caseId, "evidence"],
    enabled: !!caseId,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/forensics/cases/${caseId}/evidence`);
      return r.json();
    },
  });

  const { data: timeline = [] } = useQuery<any[]>({
    queryKey: ["/api/forensics/cases", caseId, "timeline"],
    enabled: !!caseId,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/forensics/cases/${caseId}/timeline`);
      return r.json();
    },
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/forensics/cases/${caseId}/export`, {});
      return r.json();
    },
    onSuccess: (data) => setReport(data.report),
    onError: (e: any) => toast({ title: "Export failed", description: e.message, variant: "destructive" }),
  });

  const escalateMutation = useMutation({
    mutationFn: async (escalateTo: string) => {
      const r = await apiRequest("PATCH", `/api/forensics/cases/${caseId}`, { status: "escalated", escalatedTo: escalateTo });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forensics/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forensics/cases", caseId] });
      toast({ title: "Case escalated" });
    },
  });

  const legalHoldMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", `/api/forensics/cases/${caseId}`, { legalHold: true, status: "legal_hold" });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forensics/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forensics/cases", caseId] });
      toast({ title: "Legal hold placed", description: "All linked evidence is preserved for legal proceedings." });
    },
  });

  if (!fc) return null;
  const domainMeta = DOMAIN_META[fc.domain] ?? DOMAIN_META.digital;
  const DomainIcon = domainMeta.icon;
  const statusMeta = STATUS_META[fc.status] ?? STATUS_META.open;

  return (
    <Sheet open={!!caseId} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[620px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border/30">
          <SheetTitle className="text-sm font-bold flex flex-wrap items-center gap-2">
            <Fingerprint className="h-4 w-4 text-teal-400 shrink-0" />
            {fc.caseNumber}
            <Badge className={cn("text-[9px] px-1.5 py-0 border", domainMeta.badge)}>
              <DomainIcon className="h-2.5 w-2.5 mr-1 inline" />{domainMeta.label}
            </Badge>
            <Badge className={cn("text-[9px] px-1.5 py-0 border", statusMeta.color)}>{statusMeta.label}</Badge>
            {fc.legalHold && (
              <Badge className="text-[9px] px-1.5 py-0 border bg-orange-500/20 text-orange-300 border-orange-500/30">
                <Gavel className="h-2.5 w-2.5 mr-1 inline" />Legal Hold
              </Badge>
            )}
          </SheetTitle>
          <p className="text-sm font-medium text-foreground/90 mt-1">{fc.title}</p>
        </SheetHeader>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4 border-b border-border/30 pb-0">
          {(["overview","timeline","evidence","report"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 text-[11px] font-medium rounded-t-md transition-colors capitalize",
                tab === t ? "bg-teal-600 text-white" : "text-muted-foreground/50 hover:text-foreground/70"
              )}
              data-testid={`tab-case-${t}`}
            >{t === "report" ? "AI Report" : t}</button>
          ))}
        </div>

        <div className="pt-4 space-y-4">
          {/* ── Overview ── */}
          {tab === "overview" && (
            <>
              <div>
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide mb-1">Summary</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{fc.summary ?? "No summary provided."}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Priority",     value: fc.priority,                 className: PRIORITY_COLOR[fc.priority] ?? "" },
                  { label: "Assigned To",  value: fc.assignedTo ?? "Unassigned" },
                  { label: "Escalated To", value: fc.escalatedTo ?? "—" },
                  { label: "Evidence",     value: `${evidence.length} items` },
                  { label: "Timeline",     value: `${timeline.length} events` },
                  { label: "Opened",       value: new Date(fc.createdAt).toLocaleDateString() },
                ].map(({ label, value, className }) => (
                  <div key={label} className="bg-muted/20 rounded-lg p-2.5">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">{label}</p>
                    <p className={cn("text-xs font-semibold mt-0.5 capitalize", className || "text-foreground/80")}>{value}</p>
                  </div>
                ))}
              </div>
              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
                {!fc.legalHold && (
                  <Button size="sm" variant="outline"
                    className="w-full gap-2 border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    onClick={() => legalHoldMutation.mutate()}
                    disabled={legalHoldMutation.isPending}
                    data-testid="button-place-legal-hold"
                  >
                    <Gavel className="h-3.5 w-3.5" /> Place Legal Hold
                  </Button>
                )}
                {fc.status !== "escalated" && (
                  <div className="flex gap-2">
                    {["legal","hr","law_enforcement","management"].map(dest => (
                      <Button key={dest} size="sm" variant="outline"
                        className="flex-1 gap-1 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                        onClick={() => escalateMutation.mutate(dest)}
                        disabled={escalateMutation.isPending}
                        data-testid={`button-escalate-${dest}`}
                      >
                        <Flag className="h-3 w-3" />{dest.replace("_"," ")}
                      </Button>
                    ))}
                  </div>
                )}
                {fc.status === "escalated" && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                    <Flag className="h-3.5 w-3.5 text-red-400 shrink-0" />
                    <p className="text-[10px] text-red-300">Escalated to <span className="font-bold capitalize">{fc.escalatedTo?.replace("_"," ")}</span></p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Timeline ── */}
          {tab === "timeline" && (
            <div className="space-y-2">
              {timeline.length === 0 ? (
                <p className="text-xs text-muted-foreground/40 text-center py-6">No timeline events recorded yet</p>
              ) : timeline.map((evt: any, i: number) => (
                <div key={evt.id} className="flex gap-3" data-testid={`timeline-event-${i}`}>
                  <div className="flex flex-col items-center">
                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      evt.isMilestone ? "border-red-500 bg-red-500/20" : "border-border/40 bg-muted/20"
                    )}>
                      {evt.isMilestone ? <Circle className="h-2 w-2 text-red-400 fill-current" /> : <Circle className="h-1.5 w-1.5 text-muted-foreground/30 fill-current" />}
                    </div>
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-border/20 mt-0.5 mb-0.5" />}
                  </div>
                  <div className={cn("flex-1 pb-3 min-w-0", i < timeline.length - 1 ? "border-b border-border/10" : "")}>
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-[9px] font-mono text-muted-foreground/40 whitespace-nowrap mt-0.5">
                        {new Date(evt.eventTime).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                      <Badge className={cn("text-[8px] px-1 py-0 border shrink-0", DOMAIN_META[evt.domain]?.badge ?? "")}>
                        {DOMAIN_META[evt.domain]?.label ?? evt.domain}
                      </Badge>
                      {evt.mitre && <span className="text-[9px] font-mono text-teal-400/70">{evt.mitre}</span>}
                    </div>
                    <p className="text-[11px] font-medium text-foreground/90 mt-0.5 leading-snug">{evt.action}</p>
                    {evt.actor && <p className="text-[9px] text-muted-foreground/50 mt-0.5">Actor: {evt.actor}</p>}
                    {evt.target && <p className="text-[9px] text-muted-foreground/40">Target: {evt.target}</p>}
                    {evt.outcome && (
                      <span className={cn("text-[8px] font-semibold",
                        evt.outcome === "success" ? "text-red-400" : evt.outcome === "blocked" ? "text-green-400" : "text-muted-foreground/40"
                      )}>● {evt.outcome.toUpperCase()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Evidence ── */}
          {tab === "evidence" && (
            <div className="space-y-2">
              {evidence.length === 0 ? (
                <p className="text-xs text-muted-foreground/40 text-center py-6">No evidence collected yet</p>
              ) : evidence.map((ev: any, i: number) => {
                const EvidIcon = EVIDENCE_TYPE_ICON[ev.evidenceType] ?? FileText;
                const domMeta = DOMAIN_META[ev.domain] ?? DOMAIN_META.digital;
                return (
                  <div key={ev.id} className="border border-border/30 rounded-lg p-3 space-y-1.5" data-testid={`evidence-item-${i}`}>
                    <div className="flex items-start gap-2">
                      <EvidIcon className={cn("h-4 w-4 mt-0.5 shrink-0", domMeta.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/90 leading-tight">{ev.title}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge className={cn("text-[8px] px-1 py-0 border", domMeta.badge)}>{domMeta.label}</Badge>
                          <Badge className="text-[8px] px-1 py-0 border bg-muted/15 text-muted-foreground/50 border-muted/30">
                            {ev.evidenceType.replace(/_/g," ")}
                          </Badge>
                          {ev.admissible
                            ? <Badge className="text-[8px] px-1 py-0 border bg-green-500/10 text-green-400 border-green-500/20"><CheckCheck className="h-2 w-2 mr-0.5 inline" />Admissible</Badge>
                            : <Badge className="text-[8px] px-1 py-0 border bg-red-500/10 text-red-400 border-red-500/20">Not Admissible</Badge>
                          }
                        </div>
                      </div>
                    </div>
                    {ev.fileHash && (
                      <div className="bg-muted/20 rounded p-2">
                        <p className="text-[9px] text-muted-foreground/40 flex items-center gap-1"><Hash className="h-2.5 w-2.5" />SHA-256 Chain of Custody</p>
                        <p className="font-mono text-[8px] text-teal-400/70 break-all mt-0.5">{ev.fileHash}</p>
                      </div>
                    )}
                    <div className="flex gap-3 text-[9px] text-muted-foreground/40">
                      {ev.custodian && <span>Custodian: <span className="text-foreground/60">{ev.custodian}</span></span>}
                      {ev.fileSize && <span>Size: <span className="text-foreground/60">{ev.fileSize}</span></span>}
                      {ev.collectedBy && <span>By: <span className="text-foreground/60">{ev.collectedBy}</span></span>}
                    </div>
                    {ev.notes && <p className="text-[9px] text-muted-foreground/50 italic leading-snug">{ev.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── AI Report ── */}
          {tab === "report" && (
            <div className="space-y-3">
              <Button
                size="sm" className="w-full gap-2 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => reportMutation.mutate()}
                disabled={reportMutation.isPending}
                data-testid="button-generate-report"
              >
                {reportMutation.isPending
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating Report…</>
                  : <><FileText className="h-3.5 w-3.5" /> Generate AI Forensic Report</>}
              </Button>
              {report ? (
                <div className="border border-teal-500/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wide">Forensic Investigation Report</p>
                    <Badge className="text-[8px] px-1.5 py-0 bg-teal-500/10 text-teal-400 border border-teal-500/20">AI Generated</Badge>
                  </div>
                  <MarkdownText text={report} />
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/40 text-center py-4">
                  Click above to generate a court-admissible AI forensic report for this case, covering the full evidence catalogue, timeline, chain of custody, and investigative findings.
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── New Case Form ───────────────────────────────────────────────── */
const newCaseSchema = z.object({
  title:      z.string().min(5, "Title required"),
  summary:    z.string().optional(),
  domain:     z.string(),
  priority:   z.string(),
  assignedTo: z.string().optional(),
});

function NewCaseDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof newCaseSchema>>({
    resolver: zodResolver(newCaseSchema),
    defaultValues: { title: "", summary: "", domain: "digital", priority: "medium", assignedTo: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof newCaseSchema>) => {
      // Generate a case number
      const num = "FOR-" + new Date().getFullYear() + "-" + String(Date.now()).slice(-4);
      const r = await apiRequest("POST", "/api/forensics/cases", {
        ...data,
        caseNumber: num,
        status: "open",
        legalHold: false,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forensics/cases"] });
      toast({ title: "Case opened", description: "Forensic investigation case created." });
      form.reset();
      onClose();
    },
    onError: (e: any) => toast({ title: "Failed to open case", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Fingerprint className="h-4 w-4 text-teal-400" /> Open New Forensic Case
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Case Title</FormLabel>
                <FormControl><Input {...field} placeholder="Brief description of the investigation" className="text-sm" data-testid="input-case-title" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="domain" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Domain</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="text-xs h-8" data-testid="select-case-domain">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(DOMAIN_META).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="text-xs h-8" data-testid="select-case-priority">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {["critical","high","medium","low"].map(p => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="assignedTo" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Assigned To</FormLabel>
                <FormControl><Input {...field} placeholder="Investigator name or team" className="text-sm" data-testid="input-case-assigned" /></FormControl>
              </FormItem>
            )} />
            <FormField control={form.control} name="summary" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Summary</FormLabel>
                <FormControl><Textarea {...field} placeholder="Describe the initial facts, trigger event, and scope of the investigation…" className="text-xs resize-none" rows={3} data-testid="textarea-case-summary" /></FormControl>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button type="submit" size="sm" className="gap-2 bg-teal-600 hover:bg-teal-700 text-white" disabled={mutation.isPending} data-testid="button-submit-case">
                {mutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" /> Opening…</> : <><Plus className="h-3 w-3" /> Open Case</>}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function ForensicsInvestigation() {
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery]   = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showNewCase, setShowNewCase]   = useState(false);
  const [activeView, setActiveView]     = useState<"cases" | "indicators">("cases");
  const hasAnalysed = useRef(false);
  const { toast } = useToast();

  const { data: cases = [], isLoading: casesLoading } = useQuery<any[]>({
    queryKey: ["/api/forensics/cases"],
  });

  const { data: indicators = [], isLoading: indicatorsLoading } = useQuery<any[]>({
    queryKey: ["/api/forensics/indicators"],
  });

  /* ── AI analysis ── */
  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/forensics/ai-analysis", {
        cases: cases.map((c: any) => ({
          caseNumber: c.caseNumber, title: c.title, status: c.status,
          priority: c.priority, domain: c.domain, legalHold: c.legalHold, escalatedTo: c.escalatedTo,
        })),
        indicators: indicators.map((i: any) => ({
          domain: i.domain, name: i.name, severity: i.severity, status: i.status, signal: i.signal,
        })),
        recentEvidence: [],
      });
      return r.json();
    },
    onError: (e: any) => toast({ title: "Analysis failed", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!casesLoading && cases.length > 0 && !hasAnalysed.current) {
      hasAnalysed.current = true;
      aiMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casesLoading, cases.length]);

  /* ── Filters ── */
  const filteredCases = cases.filter((c: any) => {
    if (domainFilter !== "all" && c.domain !== domainFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.caseNumber.toLowerCase().includes(q) && !(c.summary ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  /* ── KPIs ── */
  const criticalCases = cases.filter((c: any) => c.priority === "critical" && c.status !== "closed").length;
  const legalHolds    = cases.filter((c: any) => c.legalHold).length;
  const escalated     = cases.filter((c: any) => c.status === "escalated").length;
  const triggeredInds = indicators.filter((i: any) => ["triggered","case_opened"].includes(i.status)).length;

  const insights = (aiMutation.data as any)?.analysis as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto overflow-x-hidden">

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Active Cases",         value: cases.filter((c:any) => c.status !== "closed").length, color: "text-teal-400",   sub: `${cases.length} total` },
          { label: "Critical Priority",     value: criticalCases,                                         color: "text-red-400",    sub: "Immediate action" },
          { label: "Legal Holds Active",    value: legalHolds,                                            color: "text-orange-400", sub: "Evidence preserved" },
          { label: "Escalated",             value: escalated,                                             color: "text-purple-400", sub: "Awaiting action" },
          { label: "Triggered Indicators",  value: indicatorsLoading ? "…" : triggeredInds,              color: "text-yellow-400", sub: `${indicators.length} monitored` },
        ].map(k => (
          <Card key={k.label} className="bg-card/60 border-border/40">
            <CardContent className="p-3 sm:p-4">
              <p className={cn("text-xl font-bold font-mono", k.color)}>{k.value}</p>
              <p className="text-[10px] font-medium text-foreground/80 mt-0.5">{k.label}</p>
              <p className="text-[9px] text-muted-foreground/40 mt-0.5">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Domain distribution ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Object.entries(DOMAIN_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const count = cases.filter((c: any) => c.domain === key && c.status !== "closed").length;
          return (
            <button key={key} onClick={() => setDomainFilter(domainFilter === key ? "all" : key)}
              data-testid={`button-domain-${key}`}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center",
                domainFilter === key
                  ? "border-teal-500/40 bg-teal-500/10"
                  : "border-border/30 bg-card/60 hover:border-border/50"
              )}
            >
              <Icon className={cn("h-5 w-5", meta.color)} />
              <span className="text-[9px] text-muted-foreground/60 leading-tight">{meta.label}</span>
              <span className={cn("text-lg font-bold font-mono", meta.color)}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── View toggle + toolbar ───────────────────────────────────── */}
      <Card className="bg-card/60 border-border/40">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 border border-border/40 rounded-md p-0.5">
              {(["cases","indicators"] as const).map(v => (
                <button key={v} onClick={() => setActiveView(v)}
                  data-testid={`button-view-${v}`}
                  className={cn("px-3 py-1 rounded text-[10px] font-medium transition-colors capitalize",
                    activeView === v ? "bg-teal-600 text-white" : "text-muted-foreground/60 hover:text-foreground/80"
                  )}
                >{v === "cases" ? "Cases" : "Indicators"}</button>
              ))}
            </div>

            {activeView === "cases" && (
              <>
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
                  <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search cases…" className="pl-7 h-8 text-xs bg-muted/20 border-border/30"
                    data-testid="input-case-search"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="h-3 w-3 text-muted-foreground/40" />
                    </button>
                  )}
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-[130px] text-[11px]" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(STATUS_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}

            <Button size="sm" className="ml-auto gap-2 bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs"
              onClick={() => setShowNewCase(true)}
              data-testid="button-new-case"
            >
              <Plus className="h-3.5 w-3.5" /> Open Case
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Cases List ─────────────────────────────────────────────── */}
      {activeView === "cases" && (
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-teal-400" /> Investigation Cases
              <Badge className="text-[9px] px-1.5 py-0 bg-teal-500/15 text-teal-300 border border-teal-500/20">
                {filteredCases.length} shown
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {casesLoading ? (
              <div className="flex items-center gap-3 py-10 justify-center text-muted-foreground/50">
                <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                <span className="text-xs">Loading cases from DB…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      {["Case","Domain","Priority","Status","Assigned","Legal","Actions"].map(h => (
                        <th key={h} className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-muted-foreground/40 text-xs">No cases match current filters</td></tr>
                    ) : filteredCases.map((c: any) => {
                      const domMeta  = DOMAIN_META[c.domain] ?? DOMAIN_META.digital;
                      const statMeta = STATUS_META[c.status] ?? STATUS_META.open;
                      const DomIcon  = domMeta.icon;
                      return (
                        <tr key={c.id}
                          className="border-b border-border/20 hover:bg-muted/5 transition-colors cursor-pointer"
                          onClick={() => setSelectedCaseId(c.id)}
                          data-testid={`case-row-${c.caseNumber}`}
                        >
                          <td className="p-3 max-w-[220px]">
                            <p className="font-mono text-[10px] text-teal-400/70">{c.caseNumber}</p>
                            <p className="font-medium text-foreground/90 leading-tight truncate text-[11px] mt-0.5" title={c.title}>{c.title}</p>
                            {c.escalatedTo && (
                              <p className="text-[8px] text-red-400/70 mt-0.5 flex items-center gap-0.5">
                                <Flag className="h-2 w-2" /> Escalated → {c.escalatedTo.replace("_"," ")}
                              </p>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <Badge className={cn("text-[9px] px-1.5 py-0 border gap-1 inline-flex items-center", domMeta.badge)}>
                              <DomIcon className="h-2.5 w-2.5" />{domMeta.label}
                            </Badge>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={cn("font-semibold capitalize text-[11px]", PRIORITY_COLOR[c.priority])}>{c.priority}</span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <Badge className={cn("text-[9px] px-1.5 py-0 border", statMeta.color)}>{statMeta.label}</Badge>
                          </td>
                          <td className="p-3 text-muted-foreground/60 text-[10px] whitespace-nowrap max-w-[120px] truncate">{c.assignedTo ?? "—"}</td>
                          <td className="p-3 whitespace-nowrap">
                            {c.legalHold
                              ? <Badge className="text-[8px] px-1 py-0 border bg-orange-500/10 text-orange-400 border-orange-500/20"><Gavel className="h-2 w-2 mr-0.5 inline" />Hold</Badge>
                              : <span className="text-muted-foreground/30 text-[10px]">—</span>
                            }
                          </td>
                          <td className="p-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost"
                              className="h-6 text-[10px] px-2 gap-1 text-teal-400 hover:bg-teal-500/10"
                              onClick={() => setSelectedCaseId(c.id)}
                              data-testid={`button-open-case-${c.caseNumber}`}
                            >
                              <Eye className="h-2.5 w-2.5" /> Open
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Indicators view ─────────────────────────────────────────── */}
      {activeView === "indicators" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(DOMAIN_META).map(([domainKey, meta]) => {
            const Icon = meta.icon;
            const domainInds = indicators.filter((i: any) => i.domain === domainKey);
            if (domainInds.length === 0) return null;
            return (
              <Card key={domainKey} className="bg-card/60 border-border/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold flex items-center gap-2">
                    <Icon className={cn("h-3.5 w-3.5", meta.color)} />
                    {meta.label}
                    <span className="text-[9px] text-muted-foreground/40 ml-auto">{domainInds.length} indicators</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-3">
                  {domainInds.map((ind: any, i: number) => {
                    const indMeta = INDICATOR_STATUS_META[ind.status] ?? INDICATOR_STATUS_META.monitoring;
                    return (
                      <div key={ind.id} className="border border-border/25 rounded-lg p-2.5 space-y-1" data-testid={`indicator-${domainKey}-${i}`}>
                        <div className="flex items-start gap-2">
                          <Crosshair className={cn("h-3 w-3 mt-0.5 shrink-0",
                            ind.severity === "critical" ? "text-red-400" :
                            ind.severity === "high"     ? "text-orange-400" : "text-yellow-400"
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium text-foreground/90 leading-tight">{ind.name}</p>
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">{ind.description}</p>
                          </div>
                          <Badge className={cn("text-[8px] px-1.5 py-0 border shrink-0", indMeta.color)}>{indMeta.label}</Badge>
                        </div>
                        <div className="bg-muted/20 rounded px-2 py-1">
                          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wide">Signal</p>
                          <p className="font-mono text-[8px] text-teal-400/70 leading-snug mt-0.5">{ind.signal}</p>
                        </div>
                        {ind.threshold && (
                          <p className="text-[9px] text-muted-foreground/40">Threshold: <span className="text-foreground/60">{ind.threshold}</span></p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── AI Analysis ────────────────────────────────────────────── */}
      <Card className="bg-card/60 border-teal-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-teal-400" />
              AI Cross-Domain Forensic Analysis
              <Badge className="text-[9px] px-1.5 py-0 bg-teal-500/15 text-teal-300 border border-teal-500/20">
                Auto-running · Generative AI
              </Badge>
            </CardTitle>
            <Button size="sm"
              className="h-7 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => aiMutation.mutate()}
              disabled={aiMutation.isPending}
              data-testid="button-refresh-analysis"
            >
              {aiMutation.isPending
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Analysing…</>
                : <><RefreshCw className="h-3 w-3" /> Re-analyse</>}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-1">
            AI cross-correlates digital, physical, HR, financial and legal signals to surface hidden investigation patterns, cross-domain insider threat indicators, and prioritised action recommendations.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {aiMutation.isPending ? (
            <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground/40">
              <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
              <span className="text-xs">AI is analysing {cases.length} cases and {indicators.length} indicators across 5 domains…</span>
            </div>
          ) : insights ? (
            <MarkdownText text={insights} />
          ) : (
            <p className="text-xs text-muted-foreground/40 py-4 text-center">Analysis will appear automatically once cases are loaded.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Case Detail Sheet ── */}
      <CaseDetailSheet caseId={selectedCaseId} onClose={() => setSelectedCaseId(null)} />

      {/* ── New Case Dialog ── */}
      <NewCaseDialog open={showNewCase} onClose={() => setShowNewCase(false)} />
    </div>
  );
}
