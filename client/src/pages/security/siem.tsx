import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Activity, Brain, Loader2, RefreshCw, AlertTriangle,
  CheckCircle2, Info, ShieldAlert, Database, Server,
  Lock, FileText, ArrowRight, Zap, ExternalLink,
  Search, X, Clock, Eye, CheckCheck, ToggleLeft, ToggleRight,
  BarChart3, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";
import { useLocation } from "wouter";

/* ── ITIL classification ──────────────────────────────────────────── */
const ITIL_TYPES = {
  Informational: { color: "bg-sky-500/15 text-sky-300 border-sky-500/25",     icon: Info },
  Warning:       { color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/25", icon: AlertTriangle },
  Exception:     { color: "bg-red-500/15 text-red-300 border-red-500/25",     icon: ShieldAlert },
} as const;

const RULE_STATUS_COLORS: Record<string, string> = {
  Active:   "bg-green-500/15 text-green-400 border-green-500/25",
  Disabled: "bg-muted/20 text-muted-foreground/50 border-muted/30",
  Tuning:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
};

const MITRE_MAP: Record<string, string> = {
  anomaly_detection:    "T1078",
  vulnerability_scan:   "T1595",
  policy_violation:     "T1530",
  malware_detected:     "T1204",
  config_change:        "T1578",
  phishing:             "T1566",
  intrusion:            "T1190",
  ddos:                 "T1499",
  lateral_movement:     "T1550.002",
  data_exfil:           "T1567.002",
  privilege_escalation: "T1548",
};

const MITRE_DESC: Record<string, string> = {
  T1078: "Valid Accounts — adversary uses legitimate credentials to gain access",
  T1595: "Active Scanning — reconnaissance via port/service scans",
  T1530: "Data from Cloud Storage — accessing data from misconfigured buckets",
  T1204: "User Execution — malicious file executed by user action",
  T1578: "Modify Cloud Compute Infrastructure — config tampering",
  T1566: "Phishing — deceptive emails or links to capture credentials",
  T1190: "Exploit Public-Facing Application — web/API exploitation",
  T1499: "Endpoint Denial of Service — resource exhaustion attack",
  "T1550.002": "Pass the Hash — lateral movement using captured NTLM hash",
  "T1567.002": "Exfiltration to Cloud Storage — data theft via cloud",
  T1548: "Abuse Elevation Control Mechanism — privilege escalation",
};

function toItilType(severity: string, eventType: string): "Exception" | "Warning" | "Informational" {
  if (severity === "critical" || eventType === "malware_detected" || eventType === "intrusion") return "Exception";
  if (severity === "high") return "Exception";
  if (severity === "medium" || eventType === "anomaly_detection" || eventType === "policy_violation") return "Warning";
  return "Informational";
}

const TIME_RANGES: Record<string, number> = { "1h": 3_600_000, "4h": 14_400_000, "24h": 86_400_000, "7d": 604_800_000 };

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))  return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* "))
          return <p key={i} className="pl-3 border-l border-teal-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

/* ── Event detail slide-over ─────────────────────────────────────── */
function EventDetailSheet({
  event, onClose, onMarkProcessed, onRaiseIncident, raisingId,
}: {
  event: any;
  onClose: () => void;
  onMarkProcessed: (id: string) => void;
  onRaiseIncident: (id: string) => void;
  raisingId: string | null;
}) {
  if (!event) return null;
  const itilMeta = ITIL_TYPES[event.itil as keyof typeof ITIL_TYPES] ?? ITIL_TYPES.Informational;
  const ItilIcon = itilMeta.icon;
  const mitreCode = event.mitre ?? "T1078";
  const mitreDesc = MITRE_DESC[mitreCode] ?? "ATT&CK technique associated with this event pattern";

  return (
    <Sheet open={!!event} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-border/30">
          <SheetTitle className="text-sm font-bold flex items-center gap-2">
            <ItilIcon className="h-4 w-4 shrink-0" />
            Event Detail
            <Badge className={cn("text-[9px] px-1.5 py-0 border ml-auto", itilMeta.color)}>{event.itil}</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {/* Message */}
          <div>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide mb-1">Event Message</p>
            <p className="text-sm font-medium text-foreground/90 leading-relaxed">{event.message}</p>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Event Type",  value: event.pattern },
              { label: "Severity",    value: event.severity },
              { label: "Source",      value: event.source },
              { label: "Time",        value: event.time },
              { label: "Status",      value: event.processed ? "Processed" : "Unprocessed" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/20 rounded-lg p-2.5">
                <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">{label}</p>
                <p className={cn("text-xs font-semibold mt-0.5",
                  label === "Severity" && event.severity === "Critical" ? "text-red-400" :
                  label === "Severity" && event.severity === "High" ? "text-orange-400" :
                  label === "Status" && !event.processed ? "text-yellow-400" : "text-foreground/80"
                )}>{value ?? "—"}</p>
              </div>
            ))}
          </div>

          {/* MITRE */}
          <div className="border border-teal-500/20 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wide">MITRE ATT&CK</p>
              <span className="ml-auto font-mono text-[10px] text-teal-300">{mitreCode}</span>
            </div>
            <p className="text-xs text-muted-foreground/70">{mitreDesc}</p>
          </div>

          {/* Raw data */}
          {event.rawData && (
            <div>
              <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wide mb-1.5">Raw Event Payload</p>
              <pre className="bg-muted/20 rounded-lg p-3 text-[9px] text-muted-foreground/60 overflow-x-auto max-h-[140px] overflow-y-auto">
                {typeof event.rawData === "string" ? event.rawData : JSON.stringify(event.rawData, null, 2)}
              </pre>
            </div>
          )}

          {/* Linked incident */}
          {event.incidentId && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
              <div>
                <p className="text-[10px] font-medium text-green-400">Incident Linked</p>
                <p className="text-[9px] text-muted-foreground/60 font-mono">{event.incidentId}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
            {!event.processed && (
              <Button
                size="sm" variant="outline"
                className="w-full gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                onClick={() => onMarkProcessed(event.id)}
                data-testid={`button-mark-processed-${event.id}`}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark as Processed
              </Button>
            )}
            {event.itil === "Exception" && !event.incidentId && (
              <Button
                size="sm" variant="destructive"
                className="w-full gap-2"
                onClick={() => onRaiseIncident(event.id)}
                disabled={raisingId === event.id}
                data-testid={`button-raise-incident-sheet-${event.id}`}
              >
                {raisingId === event.id
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating Incident…</>
                  : <><ArrowRight className="h-3.5 w-3.5" /> Raise Incident</>}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Event Volume Timeline ────────────────────────────────────────── */
function EventVolumeChart({ events }: { events: any[] }) {
  const buckets = useMemo(() => {
    const now = Date.now();
    const HOURS = 24;
    const slots: Array<{ label: string; exception: number; warning: number; info: number }> = [];
    for (let h = HOURS - 1; h >= 0; h--) {
      const from = now - (h + 1) * 3_600_000;
      const to   = now - h * 3_600_000;
      const slice = events.filter(e => {
        const t = new Date(e.createdAt ?? Date.now()).getTime();
        return t >= from && t < to;
      });
      const d = new Date(from);
      slots.push({
        label: d.getHours().toString().padStart(2, "0") + ":00",
        exception: slice.filter(e => e.itil === "Exception").length,
        warning:   slice.filter(e => e.itil === "Warning").length,
        info:      slice.filter(e => e.itil === "Informational").length,
      });
    }
    return slots;
  }, [events]);

  const maxVal = Math.max(1, ...buckets.map(b => b.exception + b.warning + b.info));

  return (
    <Card className="bg-card/60 border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-teal-400" /> Event Volume — Last 24 h
          <Badge className="text-[9px] px-1.5 py-0 bg-teal-500/10 text-teal-400 border border-teal-500/20 ml-auto">
            {events.length} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <div className="flex items-end gap-[2px] h-[52px] overflow-x-auto scrollbar-hide">
          {buckets.map((b, i) => {
            const total = b.exception + b.warning + b.info;
            const pct = total / maxVal;
            return (
              <div key={i} className="flex flex-col items-center gap-[1px] group flex-1 min-w-[8px]" title={`${b.label}: ${total} events`}>
                <div className="w-full flex flex-col justify-end" style={{ height: 44 }}>
                  {total > 0 && (
                    <div className="w-full rounded-sm overflow-hidden flex flex-col" style={{ height: `${Math.max(4, Math.round(pct * 44))}px` }}>
                      {b.exception > 0 && <div className="bg-red-500/70 w-full" style={{ flex: b.exception }} />}
                      {b.warning > 0   && <div className="bg-yellow-500/70 w-full" style={{ flex: b.warning }} />}
                      {b.info > 0      && <div className="bg-sky-500/50 w-full" style={{ flex: b.info }} />}
                    </div>
                  )}
                </div>
                {(i === 0 || i === 11 || i === 23) && (
                  <span className="text-[7px] text-muted-foreground/30 whitespace-nowrap">{b.label}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2">
          {[
            { color: "bg-red-500/70",    label: "Exception" },
            { color: "bg-yellow-500/70", label: "Warning" },
            { color: "bg-sky-500/50",    label: "Informational" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-sm shrink-0 ${l.color}`} />
              <span className="text-[9px] text-muted-foreground/50">{l.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function SIEMOperations() {
  const [timeRange, setTimeRange]         = useState("24h");
  const [itilFilter, setItilFilter]       = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [sourceFilter, setSourceFilter]   = useState("all");
  const [searchQuery, setSearchQuery]     = useState("");
  const [showRules, setShowRules]         = useState(false);
  const [showUnprocessed, setShowUnprocessed] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [raisingId, setRaisingId]         = useState<string | null>(null);
  const hasAnalysed = useRef(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  /* ── Data queries ─────────────────────────────────────────────── */
  const { data: rawEvents = [], isLoading: eventsLoading } = useQuery<any[]>({
    queryKey: ["/api/security-events"],
  });

  const { data: dbRules = [], isLoading: rulesLoading } = useQuery<any[]>({
    queryKey: ["/api/siem/correlation-rules"],
  });

  const { data: registeredSources = [] } = useQuery<any[]>({
    queryKey: ["/api/log-sources"],
  });

  const { data: integrations = [] } = useQuery<any[]>({ queryKey: ["/api/security/integrations"] });
  const siemIntegrations = (integrations as any[]).filter((i: any) => i.category === "siem");

  /* ── Transform raw events ─────────────────────────────────────── */
  const allEvents = useMemo(() => rawEvents.map(e => ({
    id:        e.id,
    itil:      toItilType(e.severity, e.eventType),
    severity:  e.severity.charAt(0).toUpperCase() + e.severity.slice(1),
    pattern:   e.eventType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    mitre:     MITRE_MAP[e.eventType] ?? "T1078",
    source:    e.source,
    time:      new Date(e.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    message:   e.message,
    processed: e.processed,
    incidentId: e.incidentId,
    rawData:   e.rawData,
    createdAt: e.createdAt,
  })), [rawEvents]);

  /* ── Time-range filter ────────────────────────────────────────── */
  const timeFilteredEvents = useMemo(() => {
    if (timeRange === "all") return allEvents;
    const cutoff = Date.now() - TIME_RANGES[timeRange];
    return allEvents.filter(e => new Date(e.createdAt ?? 0).getTime() >= cutoff);
  }, [allEvents, timeRange]);

  /* ── Display filters (search, ITIL, severity, source, unprocessed) */
  const uniqueSources = useMemo(() =>
    Array.from(new Set(allEvents.map(e => e.source))).sort(), [allEvents]);

  const filteredEvents = useMemo(() => timeFilteredEvents.filter(e => {
    if (itilFilter !== "all" && e.itil.toLowerCase() !== itilFilter) return false;
    if (severityFilter !== "all" && e.severity.toLowerCase() !== severityFilter) return false;
    if (sourceFilter !== "all" && e.source !== sourceFilter) return false;
    if (showUnprocessed && e.processed) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!e.message.toLowerCase().includes(q) && !e.source.toLowerCase().includes(q) && !e.pattern.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [timeFilteredEvents, itilFilter, severityFilter, sourceFilter, showUnprocessed, searchQuery]);

  /* ── KPIs ─────────────────────────────────────────────────────── */
  const exceptionCount = timeFilteredEvents.filter(e => e.itil === "Exception").length;
  const warningCount   = timeFilteredEvents.filter(e => e.itil === "Warning").length;
  const infoCount      = timeFilteredEvents.filter(e => e.itil === "Informational").length;
  const unprocessed    = timeFilteredEvents.filter(e => !e.processed).length;
  const activeRules    = dbRules.filter((r: any) => r.status === "Active").length;
  const totalHits      = dbRules.reduce((s: number, r: any) => s + (r.hitCount ?? 0), 0);

  /* ── Derived + registered log sources ────────────────────────── */
  const derivedSourceMap = useMemo(() => {
    const m = new Map<string, { count: number; severities: string[] }>();
    for (const e of allEvents) {
      const existing = m.get(e.source) ?? { count: 0, severities: [] };
      existing.count++; existing.severities.push(e.severity);
      m.set(e.source, existing);
    }
    return m;
  }, [allEvents]);

  /* ── AI analysis mutation ─────────────────────────────────────── */
  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/siem-analysis", {
        eventCounts: { exception: exceptionCount, warning: warningCount, informational: infoCount },
        totalEvents24h: timeFilteredEvents.length,
        topExceptions: timeFilteredEvents.filter(e => e.itil === "Exception").slice(0, 5).map(e => ({
          pattern: e.pattern, mitre: e.mitre, severity: e.severity, count: 1, message: e.message,
        })),
        activeRules, totalHits,
        logSources: Array.from(derivedSourceMap.entries()).map(([name, d]) => ({ name, count: d.count })),
        connectedPlatforms: siemIntegrations.map((i: any) => i.displayName),
      });
      return r.json();
    },
    onError: (e: any) => toast({ title: "Analysis failed", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!eventsLoading && rawEvents.length > 0 && !hasAnalysed.current) {
      hasAnalysed.current = true;
      aiMutation.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsLoading, rawEvents.length]);

  /* ── Mark processed mutation ──────────────────────────────────── */
  const markProcessedMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest("PATCH", `/api/security-events/${id}/processed`, {});
      return r.json();
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/security-events"] });
      toast({ title: "Event processed", description: "Event marked as acknowledged." });
      if (selectedEvent?.id === id) setSelectedEvent((e: any) => e ? { ...e, processed: true } : null);
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  /* ── Raise incident mutation ──────────────────────────────────── */
  const raiseIncidentMutation = useMutation({
    mutationFn: async (id: string) => {
      setRaisingId(id);
      const r = await apiRequest("POST", `/api/security-events/${id}/raise-incident`, {});
      return r.json();
    },
    onSuccess: (incident) => {
      setRaisingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/security-events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      toast({ title: "Incident raised", description: `INC created: ${incident.title}` });
      setSelectedEvent(null);
    },
    onError: (e: any) => { setRaisingId(null); toast({ title: "Failed to raise incident", description: e.message, variant: "destructive" }); },
  });

  /* ── Toggle correlation rule ──────────────────────────────────── */
  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await apiRequest("PATCH", `/api/siem/correlation-rules/${id}`, { status });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/siem/correlation-rules"] }),
    onError: (e: any) => toast({ title: "Failed to update rule", description: e.message, variant: "destructive" }),
  });

  const insights = (aiMutation.data as any)?.analysis as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1400px] mx-auto overflow-x-hidden">
      <SuggestedAgentsPanel module="siem" />

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Events in Window", value: timeFilteredEvents.length.toString(), color: "text-teal-400",   sub: `${unprocessed} unprocessed` },
          { label: "Exception Events",  value: exceptionCount.toString(),           color: "text-red-400",    sub: "ITIL — require incident" },
          { label: "Warning Events",    value: warningCount.toString(),             color: "text-yellow-400", sub: "ITIL — threshold breaches" },
          { label: "Active Rules",      value: rulesLoading ? "…" : activeRules.toString(), color: "text-teal-400", sub: `${totalHits} hits total` },
          { label: "Observed Sources",  value: derivedSourceMap.size.toString(),   color: "text-sky-400",    sub: `${registeredSources.length} in registry` },
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

      {/* ── Event Volume Timeline ──────────────────────────────────── */}
      <EventVolumeChart events={allEvents} />

      {/* ── Filters bar ───────────────────────────────────────────── */}
      <Card className="bg-card/60 border-border/40">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Time range */}
            <div className="flex items-center gap-1 border border-border/40 rounded-md p-0.5">
              {["1h","4h","24h","7d","all"].map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  data-testid={`button-timerange-${r}`}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    timeRange === r ? "bg-teal-600 text-white" : "text-muted-foreground/60 hover:text-foreground/80"
                  )}
                >{r}</button>
              ))}
            </div>
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search events…"
                className="pl-7 h-8 text-xs bg-muted/20 border-border/30"
                data-testid="input-siem-search"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-muted-foreground/40" />
                </button>
              )}
            </div>
            {/* ITIL filter */}
            <Select value={itilFilter} onValueChange={setItilFilter}>
              <SelectTrigger className="h-8 w-[130px] text-[11px]" data-testid="select-itil-filter">
                <SelectValue placeholder="ITIL Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ITIL Types</SelectItem>
                <SelectItem value="exception">Exception</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="informational">Informational</SelectItem>
              </SelectContent>
            </Select>
            {/* Severity filter */}
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-8 w-[110px] text-[11px]" data-testid="select-severity-filter">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            {/* Source filter */}
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-8 w-[140px] text-[11px]" data-testid="select-source-filter">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {uniqueSources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Unprocessed toggle */}
            <button
              onClick={() => setShowUnprocessed(v => !v)}
              data-testid="button-toggle-unprocessed"
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-medium transition-colors",
                showUnprocessed
                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                  : "border-border/40 text-muted-foreground/50 hover:text-foreground/70"
              )}
            >
              <Clock className="h-3 w-3" />
              Unprocessed only
              {unprocessed > 0 && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[8px] px-1 py-0">{unprocessed}</Badge>}
            </button>
            <span className="ml-auto text-[10px] text-muted-foreground/40">{filteredEvents.length} events shown</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Main content row ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Events table (2/3 wide) */}
        <Card className="lg:col-span-2 bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-400" /> ITIL Correlated Events
              <Badge className="text-[9px] px-1.5 py-0 bg-teal-500/15 text-teal-300 border border-teal-500/20">Live from DB</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {eventsLoading ? (
              <div className="flex items-center gap-3 py-10 justify-center text-muted-foreground/50">
                <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                <span className="text-xs">Loading live security events…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[580px]">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      {["ITIL","Event","MITRE","Source","Sev","Action"].map(h => (
                        <th key={h} className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground/40 text-xs">No events match current filters</td></tr>
                    ) : filteredEvents.map(e => {
                      const itilMeta = ITIL_TYPES[e.itil as keyof typeof ITIL_TYPES];
                      const ItilIcon = itilMeta?.icon ?? Info;
                      return (
                        <tr
                          key={e.id}
                          className={cn(
                            "border-b border-border/20 hover:bg-muted/5 transition-colors cursor-pointer",
                            e.processed ? "opacity-50" : ""
                          )}
                          onClick={() => setSelectedEvent(e)}
                          data-testid={`event-row-${e.id}`}
                        >
                          <td className="p-3">
                            <Badge className={cn("text-[9px] px-1.5 py-0 border gap-1 items-center inline-flex", itilMeta?.color)}>
                              <ItilIcon className="h-2.5 w-2.5" />{e.itil}
                            </Badge>
                          </td>
                          <td className="p-3 max-w-[190px]">
                            <p className="font-medium text-foreground/90 leading-tight truncate" title={e.message}>{e.message}</p>
                            <p className="text-[9px] text-muted-foreground/40 mt-0.5 flex items-center gap-1">
                              {e.pattern} · {e.time}
                              {e.processed && <CheckCheck className="h-2.5 w-2.5 text-green-500" />}
                            </p>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-mono text-[10px] text-teal-400/80">{e.mitre}</span>
                          </td>
                          <td className="p-3 text-muted-foreground/60 max-w-[90px] truncate whitespace-nowrap" title={e.source}>{e.source}</td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={cn("font-semibold text-[10px]",
                              e.severity === "Critical" ? "text-red-400" : e.severity === "High" ? "text-orange-400" :
                              e.severity === "Medium" ? "text-yellow-400" : "text-muted-foreground/50"
                            )}>{e.severity}</span>
                          </td>
                          <td className="p-3 whitespace-nowrap" onClick={ev => ev.stopPropagation()}>
                            {e.itil === "Exception" && !e.incidentId ? (
                              <Button
                                size="sm" variant="destructive" className="h-6 text-[10px] px-2 gap-1"
                                onClick={() => raiseIncidentMutation.mutate(e.id)}
                                disabled={raisingId === e.id}
                                data-testid={`button-raise-incident-${e.id}`}
                              >
                                {raisingId === e.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ArrowRight className="h-2.5 w-2.5" />}
                                {raisingId === e.id ? "…" : "Raise"}
                              </Button>
                            ) : e.itil === "Warning" && !e.processed ? (
                              <Button
                                size="sm" variant="outline"
                                className="h-6 text-[10px] px-2 gap-1 border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                                onClick={() => { markProcessedMutation.mutate(e.id); }}
                                data-testid={`button-acknowledge-${e.id}`}
                              >
                                <Zap className="h-2.5 w-2.5" /> Ack
                              </Button>
                            ) : (
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground/40"
                                onClick={() => setSelectedEvent(e)}
                                data-testid={`button-view-${e.id}`}
                              >
                                <Eye className="h-2.5 w-2.5" /> View
                              </Button>
                            )}
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

        {/* Right sidebar: ITIL distribution + Log Source Registry */}
        <div className="space-y-5">

          {/* ITIL Distribution */}
          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-teal-400" /> ITIL Distribution
                <span className="text-[9px] text-muted-foreground/40 ml-auto">{timeRange === "all" ? "All time" : `Last ${timeRange}`}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Exception", count: exceptionCount, total: Math.max(timeFilteredEvents.length, 1), color: "bg-red-500",    desc: "Incident-triggering events" },
                { label: "Warning",   count: warningCount,   total: Math.max(timeFilteredEvents.length, 1), color: "bg-yellow-500", desc: "Threshold / anomaly alerts" },
                { label: "Informational", count: infoCount,  total: Math.max(timeFilteredEvents.length, 1), color: "bg-sky-500",    desc: "Normal operational noise" },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="font-medium text-foreground/80">{row.label}</span>
                    <span className="font-mono text-muted-foreground/60">{row.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.round((row.count / row.total) * 100)}%` }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground/35 mt-0.5">{row.desc}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Log Source Registry */}
          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-teal-400" /> Log Source Registry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 p-3">
              {/* Registered sources from DB */}
              {registeredSources.length > 0 && (
                <>
                  <p className="text-[9px] text-teal-400/60 font-medium mb-1.5">Registered Sources</p>
                  {(registeredSources as any[]).map((src: any) => {
                    const derived = derivedSourceMap.get(src.name);
                    return (
                      <div key={src.id} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0" data-testid={`log-source-${src.name.replace(/\s+/g,"-").toLowerCase()}`}>
                        <Server className="h-3 w-3 text-teal-400/50 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-foreground/80 truncate">{src.name}</p>
                          <p className="text-[9px] text-muted-foreground/40">{src.type} · {derived?.count ?? 0} events ingested</p>
                        </div>
                        <Badge className={cn("text-[8px] px-1 py-0 border shrink-0",
                          src.status === "error"    ? "bg-red-500/15 text-red-400 border-red-500/25" :
                          src.status === "inactive" ? "bg-muted/20 text-muted-foreground/50 border-muted/30" :
                          derived?.hasCritical ? "bg-orange-500/15 text-orange-400 border-orange-500/25" :
                          "bg-green-500/15 text-green-400 border-green-500/25"
                        )}>
                          {src.status === "error" ? "Error" : src.status === "inactive" ? "Inactive" : derived?.count ? "Active" : "Idle"}
                        </Badge>
                      </div>
                    );
                  })}
                  <div className="border-t border-border/20 mt-2 pt-2" />
                </>
              )}
              {/* Unregistered observed sources */}
              {Array.from(derivedSourceMap.entries())
                .filter(([name]) => !(registeredSources as any[]).some((s: any) => s.name === name))
                .map(([name, data]) => (
                  <div key={name} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0" data-testid={`log-source-observed-${name.replace(/\s+/g,"-").toLowerCase()}`}>
                    <Circle className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-foreground/70 truncate">{name}</p>
                      <p className="text-[9px] text-muted-foreground/40">{data.count} events · unregistered</p>
                    </div>
                    <Badge className={cn("text-[8px] px-1 py-0 border shrink-0",
                      data.severities.some(s => s === "critical" || s === "high")
                        ? "bg-red-500/15 text-red-400 border-red-500/25"
                        : "bg-muted/15 text-muted-foreground/50 border-muted/30"
                    )}>
                      {data.severities.some(s => s === "critical" || s === "high") ? "High Sev" : "Observed"}
                    </Badge>
                  </div>
                ))}
              {/* Connected SIEM integrations */}
              {siemIntegrations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/20">
                  <p className="text-[9px] text-teal-400/60 font-medium mb-1">External SIEM Platforms</p>
                  {siemIntegrations.map((s: any) => (
                    <div key={s.platform} className="flex items-center gap-1.5 py-0.5">
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-400 shrink-0" />
                      <span className="text-[9px] text-muted-foreground/60">{s.displayName}</span>
                      <Badge className="ml-auto text-[8px] px-1 py-0 border bg-green-500/10 text-green-400 border-green-500/20">{s.testStatus}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {derivedSourceMap.size === 0 && registeredSources.length === 0 && (
                <p className="text-[9px] text-muted-foreground/40 text-center py-3">No log sources detected yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── AI Generative Analysis ─────────────────────────────────── */}
      <Card className="bg-card/60 border-teal-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-teal-400" />
              AI ITIL Event Analysis
              <Badge className="text-[9px] px-1.5 py-0 bg-teal-500/15 text-teal-300 border border-teal-500/20">Auto-running · Generative AI</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline"
                className="h-7 text-[11px] gap-1.5 border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                onClick={() => navigate("/infrastructure/events")}
                data-testid="button-unified-hub"
              >
                <ExternalLink className="h-3 w-3" /> Unified Event Hub
              </Button>
              <Button size="sm"
                className="h-7 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={() => aiMutation.mutate()}
                disabled={aiMutation.isPending}
                data-testid="button-generate-siem-analysis"
              >
                {aiMutation.isPending
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing…</>
                  : <><RefreshCw className="h-3 w-3" /> Re-analyse</>}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground/50 mt-1">
            AI analyses real security events, ITIL classifications, observed log sources, and DB-backed correlation rules to produce a prioritised event management narrative and new rule recommendations.
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {aiMutation.isPending ? (
            <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground/40">
              <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
              <span className="text-xs">Generating AI event analysis…</span>
            </div>
          ) : insights ? (
            <MarkdownText text={insights} />
          ) : (
            <p className="text-xs text-muted-foreground/40 py-4 text-center">Analysis will appear here automatically once events are loaded.</p>
          )}
        </CardContent>
      </Card>

      {/* ── Correlation Rules Library (DB-backed) ──────────────────── */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-teal-400" /> Correlation Rules Library
              <Badge className="text-[9px] px-1.5 py-0 bg-teal-500/10 text-teal-400 border border-teal-500/20">DB-backed · Live</Badge>
              {!rulesLoading && (
                <span className="text-[9px] text-muted-foreground/40">{activeRules}/{dbRules.length} active</span>
              )}
            </CardTitle>
            <Button
              size="sm" variant="outline"
              className="h-7 text-[11px] gap-1 border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
              onClick={() => setShowRules(!showRules)}
              data-testid="button-toggle-rules"
            >
              {showRules ? "Hide" : "Show"} Rules ({dbRules.length})
            </Button>
          </div>
        </CardHeader>
        {showRules && (
          <CardContent className="p-0">
            {rulesLoading ? (
              <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground/40">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="text-xs">Loading rules…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      {["Rule","MITRE","ITIL","Hits","Status","Last Tuned","Toggle"].map(h => (
                        <th key={h} className="text-left p-3 text-[10px] text-muted-foreground/50 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(dbRules as any[]).map(r => {
                      const itilMeta = ITIL_TYPES[r.itilType as keyof typeof ITIL_TYPES];
                      const isActive = r.status === "Active";
                      return (
                        <tr key={r.id} className="border-b border-border/20 hover:bg-muted/5 transition-colors" data-testid={`rule-row-${r.ruleId}`}>
                          <td className="p-3">
                            <p className="font-medium text-foreground/90">{r.name}</p>
                            <p className="text-[9px] text-muted-foreground/40 mt-0.5">{r.ruleId}</p>
                            {r.description && <p className="text-[9px] text-muted-foreground/30 mt-0.5 max-w-[260px] truncate" title={r.description}>{r.description}</p>}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-mono text-[10px] text-teal-400/80">{r.mitre}</span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <Badge className={cn("text-[9px] px-1.5 py-0 border", itilMeta?.color)}>{r.itilType}</Badge>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={cn("font-mono font-bold text-[10px]",
                              r.hitCount > 10 ? "text-red-400" : r.hitCount > 3 ? "text-orange-400" : "text-muted-foreground/70"
                            )}>{r.hitCount}×</span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <Badge className={cn("text-[9px] px-1.5 py-0 border", RULE_STATUS_COLORS[r.status] ?? RULE_STATUS_COLORS.Disabled)}>
                              {r.status}
                            </Badge>
                          </td>
                          <td className="p-3 whitespace-nowrap text-muted-foreground/50 text-[10px]">{r.lastTuned ?? "—"}</td>
                          <td className="p-3 whitespace-nowrap">
                            {r.status !== "Tuning" && (
                              <button
                                onClick={() => toggleRuleMutation.mutate({ id: r.id, status: isActive ? "Disabled" : "Active" })}
                                disabled={toggleRuleMutation.isPending}
                                data-testid={`button-toggle-rule-${r.ruleId}`}
                                className="text-muted-foreground/40 hover:text-foreground/70 transition-colors"
                                title={isActive ? "Disable rule" : "Enable rule"}
                              >
                                {isActive
                                  ? <ToggleRight className="h-4 w-4 text-green-400" />
                                  : <ToggleLeft className="h-4 w-4" />}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Event Detail Sheet ─────────────────────────────────────── */}
      <EventDetailSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onMarkProcessed={(id) => markProcessedMutation.mutate(id)}
        onRaiseIncident={(id) => raiseIncidentMutation.mutate(id)}
        raisingId={raisingId}
      />
    </div>
  );
}
