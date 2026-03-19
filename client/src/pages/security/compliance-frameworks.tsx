import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardCheck, Brain, Sparkles, Loader2, RefreshCw, Zap,
  CheckCircle2, XCircle, AlertTriangle, ShieldCheck, TrendingUp, FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const FRAMEWORKS = [
  {
    name: "NIST CSF 2.0",        score: 74, total: 108, passed: 80, failed: 28, color: "bg-blue-500",   border: "border-blue-500/25",   bg: "bg-blue-500/8",
    domains: [
      { name: "Govern",   pct: 82 }, { name: "Identify", pct: 78 }, { name: "Protect",  pct: 75 },
      { name: "Detect",   pct: 71 }, { name: "Respond",  pct: 68 }, { name: "Recover",  pct: 65 },
    ],
  },
  {
    name: "ISO/IEC 27001:2022",  score: 81, total: 93,  passed: 75, failed: 18, color: "bg-violet-500", border: "border-violet-500/25", bg: "bg-violet-500/8",
    domains: [
      { name: "A.5 Org. Controls", pct: 88 }, { name: "A.6 People",        pct: 84 },
      { name: "A.7 Physical",      pct: 91 }, { name: "A.8 Tech Controls",  pct: 72 },
    ],
  },
  {
    name: "CIS Controls v8",    score: 68, total: 153, passed: 104, failed: 49, color: "bg-orange-500", border: "border-orange-500/25", bg: "bg-orange-500/8",
    domains: [
      { name: "IG1 Basic",     pct: 88 }, { name: "IG2 Foundational", pct: 70 }, { name: "IG3 Advanced", pct: 48 },
    ],
  },
  {
    name: "SOC 2 Type II",      score: 83, total: 61,  passed: 51, failed: 10, color: "bg-green-500",  border: "border-green-500/25",  bg: "bg-green-500/8",
    domains: [
      { name: "CC1 Control Env", pct: 92 }, { name: "CC6 Logical Access", pct: 80 },
      { name: "CC7 Ops",         pct: 85 }, { name: "CC9 Risk Mgmt",      pct: 76 },
    ],
  },
  {
    name: "DORA (EU 2022/2554)", score: 61, total: 82,  passed: 50, failed: 32, color: "bg-red-500",    border: "border-red-500/25",    bg: "bg-red-500/8",
    domains: [
      { name: "ICT Risk Mgmt", pct: 70 }, { name: "Incident Reporting", pct: 55 },
      { name: "Resilience Testing", pct: 52 }, { name: "Third-party Risk", pct: 60 },
    ],
  },
];

const CONTROL_FAILURES = [
  { control: "NIST CSF PR.AC-4",  desc: "Manage access permissions per least-privilege",  framework: "NIST CSF 2.0",       severity: "High",   owner: "IAM Team" },
  { control: "NIST CSF DE.CM-7",  desc: "Monitor for unauthorized personnel/connections", framework: "NIST CSF 2.0",       severity: "High",   owner: "SOC Team" },
  { control: "ISO A.8.5",         desc: "Secure authentication for all services",         framework: "ISO 27001:2022",      severity: "High",   owner: "IT Ops" },
  { control: "CIS 16.1",          desc: "Application security training for dev teams",    framework: "CIS Controls v8",     severity: "Medium", owner: "Security" },
  { control: "DORA Art.11",       desc: "ICT Business Continuity policy defined & tested",framework: "DORA",                severity: "Critical",owner: "GRC" },
  { control: "DORA Art.26",       desc: "Third-party ICT providers register maintained",  framework: "DORA",                severity: "High",   owner: "Procurement" },
  { control: "CIS 18.2",          desc: "Penetration testing at least annually",          framework: "CIS Controls v8",     severity: "Medium", owner: "Security" },
  { control: "NIST CSF RS.CO-3",  desc: "IR communications align with response plans",   framework: "NIST CSF 2.0",       severity: "Medium", owner: "SOC Team" },
];

const SEV_COLORS: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/30",
  High:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-green-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function ComplianceFrameworks() {
  const [frameworkFilter, setFrameworkFilter] = useState("all");

  const { toast } = useToast();

  const avgScore = Math.round(FRAMEWORKS.reduce((s, f) => s + f.score, 0) / FRAMEWORKS.length);
  const totalControls = FRAMEWORKS.reduce((s, f) => s + f.total, 0);
  const totalFailed = FRAMEWORKS.reduce((s, f) => s + f.failed, 0);
  const critical = CONTROL_FAILURES.filter(c => c.severity === "Critical").length;

  const filteredFailures = CONTROL_FAILURES.filter(c =>
    frameworkFilter === "all" || c.framework.toLowerCase().includes(frameworkFilter.toLowerCase())
  );

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "Compliance Frameworks",
        capabilities: ["NIST CSF 2.0 mapping", "ISO 27001:2022 controls", "CIS Controls v8 scoring", "SOC 2 Type II audit readiness", "DORA gap analysis", "Continuous control monitoring"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="compliance" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Average Score",      value: `${avgScore}%`,           color: avgScore >= 80 ? "text-green-400" : avgScore >= 60 ? "text-yellow-400" : "text-red-400", sub: "across 5 frameworks" },
          { label: "Total Controls",     value: totalControls.toString(), color: "text-blue-400",   sub: "mapped and tracked" },
          { label: "Failing Controls",   value: totalFailed.toString(),   color: "text-red-400",   sub: "require remediation" },
          { label: "Critical Gaps",      value: critical.toString(),      color: "text-red-400",   sub: "immediate action needed" },
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

      {/* Framework Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FRAMEWORKS.map(f => (
          <Card key={f.name} className={cn("border", f.bg, f.border)}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold">{f.name}</p>
                <span className={cn("text-2xl font-black", f.score >= 80 ? "text-green-400" : f.score >= 60 ? "text-yellow-400" : "text-red-400")}>{f.score}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden mb-3">
                <div className={cn("h-full rounded-full", f.color)} style={{ width: `${f.score}%` }} />
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 mb-3">
                <span className="text-green-400 font-medium">{f.passed} passing</span>
                <span className="text-red-400 font-medium">{f.failed} failing</span>
                <span>{f.total} total</span>
              </div>
              <div className="space-y-1.5">
                {f.domains.map(d => (
                  <div key={d.name}>
                    <div className="flex items-center justify-between text-[9px] mb-0.5">
                      <span className="text-muted-foreground/60">{d.name}</span>
                      <span className={d.pct >= 80 ? "text-green-400" : d.pct >= 60 ? "text-yellow-400" : "text-red-400"}>{d.pct}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/20 overflow-hidden">
                      <div className={cn("h-full rounded-full", f.color, "opacity-70")} style={{ width: `${d.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Control Failures */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-400" />
              Failing Controls ({filteredFailures.length})
            </CardTitle>
            <Select value={frameworkFilter} onValueChange={setFrameworkFilter}>
              <SelectTrigger className="h-7 text-xs w-40 bg-muted/20" data-testid="select-compliance-framework"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All frameworks</SelectItem>
                <SelectItem value="nist">NIST CSF</SelectItem>
                <SelectItem value="iso">ISO 27001</SelectItem>
                <SelectItem value="cis">CIS Controls</SelectItem>
                <SelectItem value="soc">SOC 2</SelectItem>
                <SelectItem value="dora">DORA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  {["Control","Description","Framework","Severity","Owner","Actions"].map(h => (
                    <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredFailures.map(c => (
                  <tr key={c.control} className="hover:bg-muted/10 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-[10px] text-primary">{c.control}</td>
                    <td className="px-3 py-2.5 max-w-[220px]"><p className="text-foreground/80">{c.desc}</p></td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50 whitespace-nowrap">{c.framework}</td>
                    <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", SEV_COLORS[c.severity])}>{c.severity}</Badge></td>
                    <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50">{c.owner}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-blue-400 border-blue-500/30 hover:bg-blue-500/10" data-testid={`button-assign-${c.control}`} onClick={() => toast({ title: "Remediation assigned", description: `${c.control} remediation plan assigned to ${c.owner}` })}>Assign</Button>
                        <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10" data-testid={`button-exception-${c.control}`} onClick={() => toast({ title: "Exception raised", description: `Risk acceptance exception raised for ${c.control} — pending GRC sign-off` })}>Exception</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI */}
      <Card className="bg-gradient-to-br from-green-950/40 to-card/60 border-green-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-green-400" />
              AI Compliance Intelligence
              <Badge className="text-[10px] bg-green-500/15 text-green-400 border-green-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-green-800 hover:bg-green-900 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-compliance-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-green-400" /><p className="text-xs text-muted-foreground/60">AI mapping control gaps across {FRAMEWORKS.length} frameworks…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-green-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis for cross-framework control mapping, audit readiness reports, and prioritised gap remediation roadmaps.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
