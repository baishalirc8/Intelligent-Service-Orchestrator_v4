import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MonitorCheck, Brain, Sparkles, Loader2, RefreshCw, Zap,
  AlertTriangle, CheckCircle2, Clock, Activity, Search, PlayCircle, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const SIEM_ALERTS = [
  { id: "SIEM-8812", source: "Splunk SIEM",    type: "Brute Force",           asset: "VPN-GW-01",          user: "admin",       severity: "High",     status: "Triaged",    analyst: "Tier-2", time: "08:22" },
  { id: "SIEM-8811", source: "Microsoft Sentinel",type:"Impossible Travel",   asset: "AzureAD",            user: "ceo@corp.com",severity: "Critical", status: "Escalated",  analyst: "IR Lead", time: "08:10" },
  { id: "SIEM-8810", source: "Splunk SIEM",    type: "Data Exfiltration",     asset: "SRV-FILE-01",        user: "svc-backup",  severity: "Critical", status: "Escalated",  analyst: "IR Lead", time: "07:55" },
  { id: "SIEM-8809", source: "CrowdStrike",    type: "Malware Detection",     asset: "WKSTN-0311",         user: "a.lee",       severity: "High",     status: "Contained",  analyst: "Tier-2", time: "07:44" },
  { id: "SIEM-8808", source: "QRadar",         type: "Port Scan",             asset: "DMZ-FW-01",          user: "unknown",     severity: "Medium",   status: "Open",       analyst: "Tier-1", time: "07:30" },
  { id: "SIEM-8807", source: "Microsoft Sentinel",type:"Anomalous API Call",  asset: "AWS/prod-account",   user: "lambda-exec", severity: "High",     status: "Triaged",    analyst: "Tier-2", time: "07:18" },
  { id: "SIEM-8806", source: "Splunk SIEM",    type: "Lateral Movement",      asset: "WKSTN-0089 → DC01",  user: "m.jones",     severity: "Critical", status: "Escalated",  analyst: "IR Lead", time: "06:55" },
  { id: "SIEM-8805", source: "QRadar",         type: "SQL Injection Attempt", asset: "api.corp.com",       user: "anonymous",   severity: "High",     status: "Closed",     analyst: "Tier-1", time: "06:33" },
  { id: "SIEM-8804", source: "CrowdStrike",    type: "Persistence Mechanism", asset: "SRV-AD-DC01",        user: "SYSTEM",      severity: "Critical", status: "Open",       analyst: "Tier-2", time: "05:44" },
  { id: "SIEM-8803", source: "Splunk SIEM",    type: "Phishing Email Click",  asset: "Exchange/Mailbox",   user: "b.kumar",     severity: "High",     status: "Closed",     analyst: "Tier-1", time: "05:11" },
];

const PLAYBOOKS = [
  { name: "Ransomware Response",         status: "Triggered", executions: 2,  lastRun: "08:11", avgMins: 45, success: 94 },
  { name: "Phishing Investigation",      status: "Running",   executions: 8,  lastRun: "07:44", avgMins: 18, success: 97 },
  { name: "Brute Force Lockout",         status: "Running",   executions: 14, lastRun: "08:22", avgMins: 4,  success: 99 },
  { name: "Data Loss Prevention",        status: "Triggered", executions: 1,  lastRun: "07:55", avgMins: 60, success: 88 },
  { name: "Impossible Travel Block",     status: "Running",   executions: 3,  lastRun: "08:10", avgMins: 8,  success: 96 },
  { name: "Malware Quarantine",          status: "Completed", executions: 5,  lastRun: "07:44", avgMins: 12, success: 98 },
];

const HUNT_QUERIES = [
  { name: "LSASS Access from non-system processes",   status: "Running", hits: 3,  risk: "Critical", analyst: "TH-Lead",  started: "06:00" },
  { name: "Beacon intervals in DNS queries",           status: "Complete",hits: 0,  risk: "None",     analyst: "TH-L2",    started: "05:30" },
  { name: "Service accounts with interactive logons",  status: "Running", hits: 7,  risk: "High",     analyst: "TH-Lead",  started: "07:00" },
  { name: "Kerberoastable accounts enumeration",       status: "Complete",hits: 2,  risk: "High",     analyst: "TH-L2",    started: "04:00" },
];

const SEV_COLORS: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/30",
  High:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  Open:       "bg-red-500/15 text-red-400 border-red-500/25",
  Escalated:  "bg-red-500/15 text-red-400 border-red-500/25",
  Triaged:    "bg-blue-500/15 text-blue-400 border-blue-500/25",
  Contained:  "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Closed:     "bg-green-500/15 text-green-400 border-green-500/25",
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-violet-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function SOCOperations() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { toast } = useToast();

  const open = SIEM_ALERTS.filter(a => ["Open","Escalated","Triaged"].includes(a.status)).length;
  const critical = SIEM_ALERTS.filter(a => a.severity === "Critical").length;
  const escalated = SIEM_ALERTS.filter(a => a.status === "Escalated").length;
  const runningPlaybooks = PLAYBOOKS.filter(p => p.status === "Running" || p.status === "Triggered").length;

  const filtered = SIEM_ALERTS.filter(a => {
    const matchSev = severityFilter === "all" || a.severity.toLowerCase() === severityFilter;
    const matchStatus = statusFilter === "all" || a.status.toLowerCase() === statusFilter;
    return matchSev && matchStatus;
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "SOC Operations",
        capabilities: ["SIEM alert triage and correlation", "Threat hunting", "Automated playbook execution", "MTTR tracking", "Analyst workload management", "Multi-SIEM aggregation"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="soc" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Open Alerts",          value: open.toString(),            color: "text-red-400",    sub: `${escalated} escalated` },
          { label: "Critical Alerts",      value: critical.toString(),        color: "text-red-400",    sub: "require IR response" },
          { label: "Active Playbooks",     value: runningPlaybooks.toString(), color: "text-blue-400",  sub: "automating response" },
          { label: "MTTR (today)",         value: "22 min",                   color: "text-green-400",  sub: "↓ 18% vs last week" },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Playbooks + Threat Hunting */}
        <div className="space-y-4">
          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <PlayCircle className="h-4 w-4 text-blue-400" />
                Active Playbooks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {PLAYBOOKS.map(p => (
                <div key={p.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/10 border border-border/20">
                  <div className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                    p.status === "Running" ? "bg-blue-400 animate-pulse" :
                    p.status === "Triggered" ? "bg-red-400 animate-pulse" : "bg-green-400"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium truncate">{p.name}</p>
                    <p className="text-[9px] text-muted-foreground/40">{p.executions}x run · {p.avgMins}min avg · {p.success}% success</p>
                  </div>
                  <Badge className={cn("text-[9px] px-1.5 py-0 border-0 shrink-0",
                    p.status === "Running" ? "bg-blue-500/15 text-blue-400" :
                    p.status === "Triggered" ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"
                  )}>{p.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-400" />
                Threat Hunting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {HUNT_QUERIES.map(q => (
                <div key={q.name} className="p-2.5 rounded-lg bg-muted/10 border border-border/20">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] font-medium truncate flex-1">{q.name}</p>
                    <Badge className={cn("text-[9px] px-1.5 py-0 border-0 shrink-0",
                      q.status === "Running" ? "bg-blue-500/15 text-blue-400" : "bg-green-500/15 text-green-400"
                    )}>{q.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground/40">{q.analyst}</span>
                    {q.hits > 0 && <span className={cn("text-[9px] font-bold", q.risk === "Critical" ? "text-red-400" : "text-orange-400")}>{q.hits} hits</span>}
                    {q.hits === 0 && <span className="text-[9px] text-green-400">No hits</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* SIEM Alert Queue */}
        <Card className="bg-card/60 border-border/40 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                SIEM Alert Queue ({filtered.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-7 text-xs w-24 bg-muted/20" data-testid="select-soc-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severity</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-7 text-xs w-28 bg-muted/20" data-testid="select-soc-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                    <SelectItem value="triaged">Triaged</SelectItem>
                    <SelectItem value="contained">Contained</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Time","ID","Source","Type","Asset","User","Severity","Status","Analyst","Actions"].map(h => (
                      <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map(a => (
                    <tr key={a.id} className={cn("hover:bg-muted/10 transition-colors", a.status === "Escalated" ? "bg-red-500/5" : "")}>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground/40">{a.time}</td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-primary">{a.id}</td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50 whitespace-nowrap">{a.source}</td>
                      <td className="px-3 py-2.5 max-w-[130px]"><p className="truncate text-foreground/80">{a.type}</p></td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground/60 max-w-[120px] truncate">{a.asset}</td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50">{a.user}</td>
                      <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", SEV_COLORS[a.severity])}>{a.severity}</Badge></td>
                      <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", STATUS_COLORS[a.status])}>{a.status}</Badge></td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50">{a.analyst}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {a.status === "Open" && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-blue-400 border-blue-500/30 hover:bg-blue-500/10" data-testid={`button-assign-${a.id}`} onClick={() => toast({ title: "Alert assigned", description: `${a.id} assigned to Tier-2 analyst for triage` })}>Assign</Button>
                          )}
                          {["Open","Triaged"].includes(a.status) && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid={`button-escalate-${a.id}`} onClick={() => toast({ title: "Alert escalated", description: `${a.id} escalated to IR Lead — war room opened` })}>Escalate</Button>
                          )}
                          {a.status !== "Closed" && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-green-400 border-green-500/30 hover:bg-green-500/10" data-testid={`button-close-${a.id}`} onClick={() => toast({ title: "Alert closed", description: `${a.id} closed — false positive / resolved` })}>Close</Button>
                          )}
                          {a.status === "Closed" && (
                            <span className="text-[9px] text-muted-foreground/30 italic">Closed</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI */}
      <Card className="bg-gradient-to-br from-violet-950/40 to-card/60 border-violet-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-400" />
              AI SOC Operations Intelligence
              <Badge className="text-[10px] bg-violet-500/15 text-violet-400 border-violet-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-violet-700 hover:bg-violet-800 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-soc-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-violet-400" /><p className="text-xs text-muted-foreground/60">AI correlating {SIEM_ALERTS.length} SIEM alerts across 3 platforms…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-violet-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis for alert correlation, attack narrative construction, and autonomous playbook recommendations.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
