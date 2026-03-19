import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  HardDrive, AlertTriangle, CheckCircle2, ShieldAlert, Brain, Sparkles,
  Loader2, RefreshCw, Zap, Activity, Lock, XCircle, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const ALERTS = [
  { id: "EDR-001", endpoint: "WKSTN-0142 (Windows 11)", user: "j.smith",      technique: "T1055 – Process Injection",           severity: "Critical", status: "Active",     triage: "Confirmed", platform: "CrowdStrike", time: "08:14" },
  { id: "EDR-002", endpoint: "SRV-PROD-DB01 (Linux)",   user: "svc-postgres",  technique: "T1548 – Privilege Escalation",        severity: "Critical", status: "Quarantined",triage: "Confirmed", platform: "SentinelOne", time: "07:52" },
  { id: "EDR-003", endpoint: "WKSTN-0089 (Windows 10)", user: "m.jones",       technique: "T1566.001 – Spearphishing Attachment", severity: "High",     status: "Active",     triage: "In Review", platform: "CrowdStrike", time: "07:31" },
  { id: "EDR-004", endpoint: "WKSTN-0204 (macOS 14)",   user: "c.patel",       technique: "T1059.002 – AppleScript Execution",  severity: "High",     status: "Active",     triage: "In Review", platform: "Defender",    time: "07:18" },
  { id: "EDR-005", endpoint: "SRV-CI-GH01 (Linux)",     user: "ci-runner",     technique: "T1190 – Exploit Public-Facing App",  severity: "High",     status: "Quarantined",triage: "Confirmed", platform: "SentinelOne", time: "06:55" },
  { id: "EDR-006", endpoint: "WKSTN-0311 (Windows 11)", user: "a.lee",         technique: "T1082 – System Info Discovery",      severity: "Medium",   status: "Resolved",   triage: "FP",        platform: "CrowdStrike", time: "06:22" },
  { id: "EDR-007", endpoint: "SRV-AD-DC01 (Windows)",   user: "SYSTEM",        technique: "T1078 – Valid Accounts (Domain)",    severity: "Critical", status: "Active",     triage: "Confirmed", platform: "Defender",    time: "05:41" },
  { id: "EDR-008", endpoint: "WKSTN-0099 (Windows 10)", user: "b.kumar",       technique: "T1003.001 – LSASS Memory Dump",      severity: "Critical", status: "Quarantined",triage: "Confirmed", platform: "CrowdStrike", time: "05:12" },
  { id: "EDR-009", endpoint: "WKSTN-0187 (Windows 11)", user: "d.nguyen",      technique: "T1219 – Remote Access Software",     severity: "Medium",   status: "Resolved",   triage: "FP",        platform: "CrowdStrike", time: "04:30" },
  { id: "EDR-010", endpoint: "SRV-WEB-01 (Linux)",      user: "www-data",      technique: "T1505.003 – Web Shell",             severity: "Critical", status: "Active",     triage: "Confirmed", platform: "SentinelOne", time: "03:18" },
];

const ENDPOINTS = [
  { name: "WKSTN-*",       count: 312, healthy: 298, at_risk: 14, platform: "Windows", sensor: "CrowdStrike" },
  { name: "SRV-PROD-*",    count: 48,  healthy: 44,  at_risk: 4,  platform: "Linux",   sensor: "SentinelOne" },
  { name: "SRV-AD-*",      count: 6,   healthy: 4,   at_risk: 2,  platform: "Windows", sensor: "Defender" },
  { name: "MACBOOK-*",     count: 87,  healthy: 86,  at_risk: 1,  platform: "macOS",   sensor: "CrowdStrike" },
  { name: "CI-RUNNER-*",   count: 24,  healthy: 22,  at_risk: 2,  platform: "Linux",   sensor: "SentinelOne" },
];

const SEV_COLORS: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/30",
  High:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  Active:      "bg-red-500/15 text-red-400 border-red-500/25",
  Quarantined: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Resolved:    "bg-green-500/15 text-green-400 border-green-500/25",
};
const TRIAGE_COLORS: Record<string, string> = {
  Confirmed: "text-red-400",
  "In Review": "text-yellow-400",
  FP:        "text-muted-foreground/50",
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-orange-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function EndpointSecurity() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { toast } = useToast();

  const totalEndpoints = ENDPOINTS.reduce((s, e) => s + e.count, 0);
  const atRisk = ENDPOINTS.reduce((s, e) => s + e.at_risk, 0);
  const quarantined = ALERTS.filter(a => a.status === "Quarantined").length;
  const confirmedAlerts = ALERTS.filter(a => a.triage === "Confirmed" && a.status !== "Resolved").length;

  const filtered = ALERTS.filter(a => {
    const matchSev = severityFilter === "all" || a.severity.toLowerCase() === severityFilter;
    const matchStatus = statusFilter === "all" || a.status.toLowerCase() === statusFilter;
    return matchSev && matchStatus;
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "Endpoint Security (EDR)",
        capabilities: ["Real-time telemetry from CrowdStrike/SentinelOne/Defender", "MITRE ATT&CK alert mapping", "Behavioural analytics", "Automated quarantine", "Lateral movement detection", "Fileless malware detection"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="edr" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Endpoints Protected", value: totalEndpoints.toString(), color: "text-blue-400",   sub: "3 sensors active" },
          { label: "At-Risk Endpoints",   value: atRisk.toString(),          color: "text-red-400",   sub: "alerts unresolved" },
          { label: "Quarantined Today",   value: quarantined.toString(),     color: "text-orange-400", sub: "auto-isolated by AI" },
          { label: "Confirmed Threats",   value: confirmedAlerts.toString(), color: "text-red-400",   sub: "require analyst action" },
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
        {/* Endpoint Groups */}
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-blue-400" />
              Endpoint Fleet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ENDPOINTS.map(e => {
              const healthPct = Math.round((e.healthy / e.count) * 100);
              return (
                <div key={e.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-xs font-medium">{e.name}</p>
                      <p className="text-[9px] text-muted-foreground/40">{e.platform} · {e.sensor}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-foreground/80">{e.count}</span>
                      {e.at_risk > 0 && <p className="text-[9px] text-red-400">{e.at_risk} at risk</p>}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                    <div className={cn("h-full rounded-full", healthPct === 100 ? "bg-green-500" : healthPct >= 90 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${healthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Alert Queue */}
        <Card className="bg-card/60 border-border/40 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                Alert Queue ({filtered.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-7 text-xs w-24 bg-muted/20" data-testid="select-edr-severity"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severity</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-7 text-xs w-28 bg-muted/20" data-testid="select-edr-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="quarantined">Quarantined</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
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
                    {["Time","Endpoint","User","MITRE Technique","Severity","Triage","Status","Sensor","Actions"].map(h => (
                      <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map(a => (
                    <tr key={a.id} className={cn("hover:bg-muted/10 transition-colors", a.severity === "Critical" && a.status === "Active" ? "bg-red-500/5" : "")}>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground/50">{a.time}</td>
                      <td className="px-3 py-2.5 text-[10px] max-w-[130px] truncate text-foreground/80">{a.endpoint}</td>
                      <td className="px-3 py-2.5 text-muted-foreground/60 font-mono text-[10px]">{a.user}</td>
                      <td className="px-3 py-2.5 max-w-[180px]"><p className="truncate text-foreground/70 text-[10px]">{a.technique}</p></td>
                      <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", SEV_COLORS[a.severity])}>{a.severity}</Badge></td>
                      <td className={cn("px-3 py-2.5 text-[10px] font-medium", TRIAGE_COLORS[a.triage])}>{a.triage}</td>
                      <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", STATUS_COLORS[a.status])}>{a.status}</Badge></td>
                      <td className="px-3 py-2.5 text-[9px] text-muted-foreground/40">{a.platform}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {a.status === "Active" && (<>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid={`button-quarantine-${a.id}`} onClick={() => toast({ title: "Host quarantined", description: `${a.endpoint} isolated from network via ${a.platform}` })}>Quarantine</Button>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-orange-400 border-orange-500/30 hover:bg-orange-500/10" data-testid={`button-investigate-${a.id}`} onClick={() => toast({ title: "Investigation opened", description: `Forensic timeline opened for ${a.id} — ${a.technique}` })}>Investigate</Button>
                          </>)}
                          {a.status === "Quarantined" && (<>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-green-400 border-green-500/30 hover:bg-green-500/10" data-testid={`button-resolve-${a.id}`} onClick={() => toast({ title: "Alert resolved", description: `${a.id} marked resolved and host re-admitted` })}>Resolve</Button>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-orange-400 border-orange-500/30 hover:bg-orange-500/10" data-testid={`button-investigate-q-${a.id}`} onClick={() => toast({ title: "Forensic investigation opened", description: `Deep-dive forensic analysis started for ${a.id}` })}>Investigate</Button>
                          </>)}
                          {a.status === "Resolved" && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-muted-foreground border-border/30 hover:bg-muted/10" data-testid={`button-reopen-${a.id}`} onClick={() => toast({ title: "Alert reopened", description: `${a.id} returned to active queue for re-triage` })}>Re-Open</Button>
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
      <Card className="bg-gradient-to-br from-orange-950/40 to-card/60 border-orange-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-orange-400" />
              AI Endpoint Threat Analysis
              <Badge className="text-[10px] bg-orange-500/15 text-orange-400 border-orange-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-orange-700 hover:bg-orange-800 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-edr-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-orange-400" /><p className="text-xs text-muted-foreground/60">AI correlating {ALERTS.length} alerts across {totalEndpoints} endpoints…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-orange-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis for lateral movement detection, attack chain reconstruction, and automated quarantine recommendations.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
