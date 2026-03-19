import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileKey, Brain, Sparkles, Loader2, RefreshCw, Zap,
  AlertTriangle, Lock, Eye, Database, ShieldCheck, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const DLP_VIOLATIONS = [
  { id: "DLP-0231", user: "finance-svc",  type: "Exfiltration",        channel: "Email → External",           data: "PII – 1,400 customer records (CSV)",          severity: "Critical", status: "Blocked",    time: "08:02" },
  { id: "DLP-0230", user: "b.kumar",      type: "Unauthorized Copy",   channel: "USB Device",                 data: "Confidential – HR salary review doc",          severity: "High",     status: "Blocked",    time: "07:44" },
  { id: "DLP-0229", user: "m.jones",      type: "Policy Violation",    channel: "Cloud Upload → Personal GDrive",data: "Internal – Q1 roadmap presentation",       severity: "High",     status: "Alerted",    time: "07:31" },
  { id: "DLP-0228", user: "r.taylor",     type: "Data Over-Sharing",   channel: "SharePoint → External Link", data: "Restricted – Database schema (prod)",          severity: "High",     status: "Remediated", time: "06:55" },
  { id: "DLP-0227", user: "a.lee",        type: "Sensitive Print",     channel: "Network Printer",            data: "Confidential – Personnel disciplinary record",  severity: "Medium",   status: "Logged",     time: "06:22" },
  { id: "DLP-0226", user: "c.patel",      type: "Exfiltration",        channel: "Slack → DM to ex-employee",  data: "Internal – IT config and IP ranges",           severity: "Medium",   status: "Alerted",    time: "05:47" },
  { id: "DLP-0225", user: "d.nguyen",     type: "Policy Violation",    channel: "Email CC: Personal Gmail",   data: "Internal – Monthly P&L summary",              severity: "Low",      status: "Logged",     time: "05:10" },
];

const DATA_STORES = [
  { name: "PostgreSQL – prod-postgres-01", classification: "Confidential", encrypted: true,  atRest: "AES-256 TDE",        inTransit: "TLS 1.3", location: "AWS RDS eu-west-1",  records: "4.2M",  dlpPolicy: true  },
  { name: "S3 – prod-backups-eu",          classification: "Restricted",   encrypted: true,  atRest: "SSE-S3",             inTransit: "HTTPS",   location: "AWS S3 eu-west-1",   records: "N/A",   dlpPolicy: true  },
  { name: "SharePoint – corp-intranet",    classification: "Internal",     encrypted: true,  atRest: "Microsoft Managed",  inTransit: "TLS 1.2", location: "Microsoft 365",      records: "850K",  dlpPolicy: true  },
  { name: "Salesforce CRM",               classification: "Confidential", encrypted: true,  atRest: "Salesforce Shield",  inTransit: "TLS 1.3", location: "Salesforce Cloud",   records: "280K",  dlpPolicy: true  },
  { name: "FileServer – \\\\SRV-FILE-01", classification: "Mixed",        encrypted: false, atRest: "None (legacy)",      inTransit: "SMBv3",   location: "On-prem DC",         records: "N/A",   dlpPolicy: false },
  { name: "MongoDB – dev-cluster-01",     classification: "Internal",     encrypted: false, atRest: "None",               inTransit: "TLS 1.2", location: "GCP us-central1",    records: "1.1M",  dlpPolicy: false },
];

const CLASSIFICATION_LABELS: Record<string, string> = {
  Restricted:    "bg-red-500/20 text-red-300 border-red-500/30",
  Confidential:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Internal:      "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Public:        "bg-green-500/20 text-green-300 border-green-500/30",
  Mixed:         "bg-violet-500/20 text-violet-300 border-violet-500/30",
};
const SEV_COLORS: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/30",
  High:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Low:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  Blocked:    "bg-red-500/15 text-red-400 border-red-500/25",
  Alerted:    "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Logged:     "bg-blue-500/15 text-blue-400 border-blue-500/25",
  Remediated: "bg-green-500/15 text-green-400 border-green-500/25",
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-teal-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function DataProtection() {
  const [sevFilter, setSevFilter] = useState("all");

  const { toast } = useToast();

  const critical = DLP_VIOLATIONS.filter(v => v.severity === "Critical").length;
  const blocked = DLP_VIOLATIONS.filter(v => v.status === "Blocked").length;
  const unencrypted = DATA_STORES.filter(s => !s.encrypted).length;
  const noDLP = DATA_STORES.filter(s => !s.dlpPolicy).length;

  const filtered = DLP_VIOLATIONS.filter(v => sevFilter === "all" || v.severity.toLowerCase() === sevFilter);

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "Data Protection & DLP",
        capabilities: ["Data classification engine", "DLP policy enforcement (email, cloud, USB)", "Encryption posture assessment", "GDPR/DORA data breach notification", "Data at rest and in transit monitoring", "Insider threat correlation"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="data-protection" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "DLP Violations (24h)", value: DLP_VIOLATIONS.length.toString(), color: "text-red-400",    sub: `${blocked} blocked automatically` },
          { label: "Critical Violations",  value: critical.toString(),              color: "text-red-400",   sub: "potential breach risk" },
          { label: "Unencrypted Stores",   value: unencrypted.toString(),           color: "text-orange-400", sub: "at-rest encryption gap" },
          { label: "DLP Policy Gaps",      value: noDLP.toString(),                 color: "text-orange-400", sub: "data stores uncovered" },
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

      {/* DLP Violations Table */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              DLP Policy Violations ({filtered.length})
            </CardTitle>
            <Select value={sevFilter} onValueChange={setSevFilter}>
              <SelectTrigger className="h-7 text-xs w-28 bg-muted/20" data-testid="select-dlp-severity"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  {["Time","ID","User","Type","Channel","Data Classification","Severity","Status","Actions"].map(h => (
                    <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.map(v => (
                  <tr key={v.id} className={cn("hover:bg-muted/10 transition-colors", v.severity === "Critical" ? "bg-red-500/5" : "")}>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground/40">{v.time}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-primary">{v.id}</td>
                    <td className="px-3 py-2.5 font-mono text-[10px]">{v.user}</td>
                    <td className="px-3 py-2.5 text-[10px] text-foreground/70 whitespace-nowrap">{v.type}</td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50 max-w-[140px]"><p className="truncate">{v.channel}</p></td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground/60 max-w-[180px]"><p className="truncate">{v.data}</p></td>
                    <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", SEV_COLORS[v.severity])}>{v.severity}</Badge></td>
                    <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", STATUS_COLORS[v.status])}>{v.status}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-orange-400 border-orange-500/30 hover:bg-orange-500/10" data-testid={`button-investigate-dlp-${v.id}`} onClick={() => toast({ title: "DLP investigation opened", description: `Forensic case opened for ${v.id} — ${v.user} activity under review` })}>Investigate</Button>
                        {v.status !== "Blocked" && (
                          <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid={`button-block-${v.id}`} onClick={() => toast({ title: "User blocked", description: `${v.user} account suspended pending investigation` })}>Block User</Button>
                        )}
                        {["Low","Medium"].includes(v.severity) && (
                          <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-muted-foreground border-border/30 hover:bg-muted/10" data-testid={`button-dismiss-${v.id}`} onClick={() => toast({ title: "Violation dismissed", description: `${v.id} marked as false positive` })}>Dismiss</Button>
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

      {/* Data Store Inventory */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Database className="h-4 w-4 text-teal-400" />
            Data Store Inventory & Encryption Posture
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  {["Data Store","Classification","At-Rest Encryption","In-Transit","Location","Records","DLP Policy"].map(h => (
                    <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {DATA_STORES.map(s => (
                  <tr key={s.name} className={cn("hover:bg-muted/10 transition-colors", !s.encrypted ? "bg-orange-500/5" : "")}>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-foreground/80 max-w-[180px]"><p className="truncate">{s.name}</p></td>
                    <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", CLASSIFICATION_LABELS[s.classification])}>{s.classification}</Badge></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[10px] font-bold", s.encrypted ? "text-green-400" : "text-red-400")}>{s.encrypted ? "✓" : "✗"}</span>
                        <span className="text-[9px] text-muted-foreground/50">{s.atRest}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[9px] text-muted-foreground/50">{s.inTransit}</td>
                    <td className="px-3 py-2.5 text-[9px] text-muted-foreground/40">{s.location}</td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground/60">{s.records}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-[10px] font-bold", s.dlpPolicy ? "text-green-400" : "text-red-400")}>{s.dlpPolicy ? "Active" : "Missing"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI */}
      <Card className="bg-gradient-to-br from-teal-950/40 to-card/60 border-teal-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-teal-400" />
              AI Data Protection Intelligence
              <Badge className="text-[10px] bg-teal-500/15 text-teal-400 border-teal-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-teal-700 hover:bg-teal-800 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-dlp-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-teal-400" /><p className="text-xs text-muted-foreground/60">AI analysing data flows, encryption posture and DLP violations…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-teal-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis for data flow mapping, breach probability scoring, and GDPR/DORA notification decision support.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
