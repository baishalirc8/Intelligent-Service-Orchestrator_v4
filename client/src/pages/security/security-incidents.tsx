import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Siren, Brain, Sparkles, Loader2, RefreshCw, Zap,
  AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const PHASES = ["Detection", "Containment", "Eradication", "Recovery", "PIR"];

const INCIDENTS = [
  {
    id: "SEC-INC-0041", title: "Ransomware detonation on WKSTN-0089",
    severity: "P1 – Critical", status: "Containment", phase: 1,
    assignee: "IR Lead",   opened: "2025-03-15 07:52", sla: "08:52",
    vector: "Phishing email attachment (LockBit loader)",
    affected: "WKSTN-0089, shared drive \\\\SRV-FILE-01\\dept",
    actions: ["Endpoint isolated from network", "Malicious process terminated", "Disk image captured for forensics"],
    pir: false,
  },
  {
    id: "SEC-INC-0040", title: "Credential theft via LSASS dump on DC01",
    severity: "P1 – Critical", status: "Eradication", phase: 2,
    assignee: "IR Lead",   opened: "2025-03-15 05:41", sla: "06:41",
    vector: "Cobalt Strike beacon via T1003.001 – LSASS Memory",
    affected: "SRV-AD-DC01, 14 user accounts (passwords rotated)",
    actions: ["Account passwords reset", "Cobalt Strike C2 blocked at firewall", "Golden ticket invalidation in progress"],
    pir: false,
  },
  {
    id: "SEC-INC-0039", title: "Data exfiltration via compromised svc-backup account",
    severity: "P2 – High", status: "Recovery", phase: 3,
    assignee: "Tier-2",    opened: "2025-03-15 07:55", sla: "11:55",
    vector: "Compromised service account with broad S3 access",
    affected: "S3/prod-backups-eu (143 GB accessed externally)",
    actions: ["Service account disabled", "S3 access audit complete", "CISO and DPA notified", "AWS CloudTrail evidence preserved"],
    pir: false,
  },
  {
    id: "SEC-INC-0038", title: "Impossible travel: CEO account accessed from 2 countries",
    severity: "P2 – High", status: "PIR", phase: 4,
    assignee: "Tier-2",    opened: "2025-03-14 22:10", sla: "02:10",
    vector: "Azure AD sign-in anomaly — London & São Paulo within 40 min",
    affected: "Azure AD / Microsoft 365 (CEO account)",
    actions: ["Session revoked", "MFA re-enrolled", "Conditional Access policy tightened", "No data access confirmed"],
    pir: true,
  },
  {
    id: "SEC-INC-0037", title: "Web shell deployed on SRV-WEB-01 via log4j",
    severity: "P1 – Critical", status: "Closed", phase: 4,
    assignee: "IR Lead",   opened: "2025-03-13 03:18", sla: "04:18",
    vector: "CVE-2021-44228 (Log4Shell) exploit chain",
    affected: "SRV-WEB-01 (api.corp.com) — fully compromised",
    actions: ["Server rebuilt from baseline", "Log4j patched across all services", "WAF rules deployed", "PIR completed"],
    pir: true,
  },
];

const PHASE_COLORS: Record<number, string> = {
  0: "bg-blue-500",
  1: "bg-orange-500",
  2: "bg-yellow-500",
  3: "bg-violet-500",
  4: "bg-green-500",
};

const STATUS_COLORS: Record<string, string> = {
  Detection:    "bg-red-500/15 text-red-400 border-red-500/25",
  Containment:  "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Eradication:  "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  Recovery:     "bg-violet-500/15 text-violet-400 border-violet-500/25",
  PIR:          "bg-blue-500/15 text-blue-400 border-blue-500/25",
  Closed:       "bg-green-500/15 text-green-400 border-green-500/25",
};
const SEV_COLORS: Record<string, string> = {
  "P1 – Critical": "bg-red-500/20 text-red-300 border-red-500/30",
  "P2 – High":     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "P3 – Medium":   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-red-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function SecurityIncidents() {
  const [expanded, setExpanded] = useState<string | null>("SEC-INC-0041");
  const [statusFilter, setStatusFilter] = useState("all");

  const { toast } = useToast();

  const active = INCIDENTS.filter(i => !["Closed"].includes(i.status)).length;
  const p1 = INCIDENTS.filter(i => i.severity.startsWith("P1")).length;
  const pirDue = INCIDENTS.filter(i => i.pir && i.status !== "Closed").length;
  const closed = INCIDENTS.filter(i => i.status === "Closed").length;

  const filtered = INCIDENTS.filter(i => statusFilter === "all" || i.status.toLowerCase() === statusFilter.toLowerCase());

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "Security Incident Management",
        capabilities: ["ITIL-aligned IR lifecycle", "P1/P2 triage", "Containment orchestration", "Eradication verification", "Post-Incident Review (PIR)", "Evidence chain of custody", "Regulatory breach notification"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="incidents" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Incidents",  value: active.toString(),   color: "text-red-400",    sub: "in IR lifecycle" },
          { label: "P1 Critical",       value: p1.toString(),       color: "text-red-400",    sub: "1hr SLA" },
          { label: "PIR Pending",       value: pirDue.toString(),   color: "text-amber-400",  sub: "post-incident reviews" },
          { label: "Closed (30 days)",  value: closed.toString(),   color: "text-green-400",  sub: "fully resolved" },
        ].map(s => (
          <Card key={s.label} className="bg-card/60 border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground/60">{s.label}</p>
              <p className={cn("text-3xl font-black mt-1", s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground/40 mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* IR Lifecycle Pipeline */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Siren className="h-4 w-4 text-red-400" />
            ITIL IR Lifecycle Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0">
            {PHASES.map((phase, i) => {
              const count = INCIDENTS.filter(inc => inc.phase === i && inc.status !== "Closed").length;
              return (
                <div key={phase} className="flex items-center flex-1">
                  <div className="flex-1 text-center">
                    <div className={cn("h-8 rounded-lg flex items-center justify-center gap-1.5", PHASE_COLORS[i], "bg-opacity-20 border border-opacity-30",
                      i === 0 ? "border-blue-500/30 bg-blue-500/15" :
                      i === 1 ? "border-orange-500/30 bg-orange-500/15" :
                      i === 2 ? "border-yellow-500/30 bg-yellow-500/15" :
                      i === 3 ? "border-violet-500/30 bg-violet-500/15" :
                      "border-green-500/30 bg-green-500/15"
                    )}>
                      <span className="text-[10px] font-bold">{phase}</span>
                      {count > 0 && <span className={cn("text-[9px] font-black",
                        i === 0 ? "text-blue-400" : i === 1 ? "text-orange-400" : i === 2 ? "text-yellow-400" : i === 3 ? "text-violet-400" : "text-green-400"
                      )}>{count}</span>}
                    </div>
                  </div>
                  {i < PHASES.length - 1 && <div className="w-4 h-0.5 bg-border/40 shrink-0" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Incident List */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Security Incidents
            </CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 text-xs w-32 bg-muted/20" data-testid="select-incidents-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All phases</SelectItem>
                {PHASES.map(p => <SelectItem key={p} value={p.toLowerCase()}>{p}</SelectItem>)}
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/30">
            {filtered.map(inc => {
              const isExpanded = expanded === inc.id;
              return (
                <div key={inc.id}>
                  <button
                    className="w-full flex items-start gap-4 px-5 py-4 hover:bg-muted/10 transition-colors text-left"
                    onClick={() => setExpanded(isExpanded ? null : inc.id)}
                    data-testid={`button-incident-${inc.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-primary">{inc.id}</span>
                        <Badge className={cn("text-[9px] px-1.5 py-0 border", SEV_COLORS[inc.severity])}>{inc.severity}</Badge>
                        <Badge className={cn("text-[9px] px-1.5 py-0 border", STATUS_COLORS[inc.status])}>{inc.status}</Badge>
                        {inc.pir && <Badge className="text-[9px] px-1.5 py-0 border-0 bg-blue-500/10 text-blue-400">PIR Done</Badge>}
                      </div>
                      <p className="text-xs font-semibold mt-1">{inc.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/40">
                        <span>Opened: {inc.opened}</span>
                        <span>SLA: {inc.sla}</span>
                        <span>Assignee: {inc.assignee}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="bg-muted/5 border-t border-border/20 px-5 py-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div><p className="text-muted-foreground/40 text-[10px] mb-0.5">Attack Vector</p><p className="text-foreground/80">{inc.vector}</p></div>
                        <div><p className="text-muted-foreground/40 text-[10px] mb-0.5">Affected Systems</p><p className="text-foreground/80">{inc.affected}</p></div>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground/50 font-semibold mb-2">Actions Taken</p>
                        <div className="space-y-1.5">
                          {inc.actions.map((a, j) => (
                            <div key={j} className="flex items-start gap-2 text-xs text-muted-foreground/70">
                              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-400 shrink-0" />
                              {a}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-border/40" data-testid={`button-ir-report-${inc.id}`} onClick={() => toast({ title: "IR Report generated", description: `Incident report for ${inc.id} exported to GRC portal` })}><FileText className="h-3 w-3" />IR Report</Button>
                        {!inc.pir && <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-border/40" data-testid={`button-pir-${inc.id}`} onClick={() => toast({ title: "PIR scheduled", description: `Post-Incident Review for ${inc.id} scheduled with stakeholders` })}><Clock className="h-3 w-3" />Schedule PIR</Button>}
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10" data-testid={`button-assign-inc-${inc.id}`} onClick={() => toast({ title: "Incident assigned", description: `${inc.id} assigned to on-call IR team lead` })}>Assign Lead</Button>
                        {inc.status !== "Recovery" && inc.status !== "PIR" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-orange-400 border-orange-500/30 hover:bg-orange-500/10" data-testid={`button-advance-${inc.id}`} onClick={() => toast({ title: "Phase advanced", description: `${inc.id} moved to next ITIL phase — team notified` })}>Advance Phase</Button>
                        )}
                        {inc.severity.startsWith("P1") && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid={`button-escalate-inc-${inc.id}`} onClick={() => toast({ title: "Incident escalated", description: `${inc.id} escalated to CISO and executive war room activated` })}>Escalate to CISO</Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI */}
      <Card className="bg-gradient-to-br from-red-950/40 to-card/60 border-red-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-red-400" />
              AI Incident Response Intelligence
              <Badge className="text-[10px] bg-red-500/15 text-red-400 border-red-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-red-800 hover:bg-red-900 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-incidents-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-red-400" /><p className="text-xs text-muted-foreground/60">AI analysing {INCIDENTS.length} active incidents across IR lifecycle…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-red-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis to accelerate containment decisions, auto-generate PIR summaries, and proactively identify repeat-incident patterns.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
