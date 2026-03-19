import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Brain, Sparkles, Loader2, RefreshCw, Zap,
  TrendingDown, TrendingUp, Minus, ShieldAlert, FileText, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const RISKS = [
  { id: "SR-001", title: "Ransomware attack on core production systems",        category: "Cybersecurity", likelihood: 4, impact: 5, treatment: "Mitigate", status: "Active",    owner: "CISO",       controls: "EDR, Air-gap backups, IR plan",               trend: "up",   due: "2026-03-31" },
  { id: "SR-002", title: "DORA non-compliance resulting in regulatory fine",     category: "Regulatory",    likelihood: 3, impact: 5, treatment: "Mitigate", status: "Active",    owner: "GRC",        controls: "Compliance programme, legal counsel",         trend: "same", due: "2026-06-30" },
  { id: "SR-003", title: "Supply chain compromise via third-party software",     category: "Third-Party",   likelihood: 3, impact: 4, treatment: "Mitigate", status: "Active",    owner: "Procurement",controls: "Vendor assessment, SCA scanning",             trend: "up",   due: "2026-04-30" },
  { id: "SR-004", title: "Insider threat – data theft by privileged user",       category: "Insider",       likelihood: 2, impact: 5, treatment: "Mitigate", status: "Active",    owner: "HR/CISO",    controls: "UBA, DLP, PAM, exit procedures",             trend: "same", due: "2026-05-31" },
  { id: "SR-005", title: "Cloud misconfiguration exposing sensitive customer data",category: "Cloud",        likelihood: 4, impact: 4, treatment: "Mitigate", status: "Active",    owner: "Cloud Sec",  controls: "CSPM, CIS benchmarks, drift alerting",       trend: "down", due: "2026-03-31" },
  { id: "SR-006", title: "DDoS attack causing service outage (SLA breach)",      category: "Availability",  likelihood: 3, impact: 4, treatment: "Transfer", status: "Active",    owner: "NetOps",     controls: "DDoS scrubbing, CDN, cyber insurance",       trend: "same", due: "2026-06-30" },
  { id: "SR-007", title: "Credential stuffing against customer portal",          category: "Cybersecurity", likelihood: 5, impact: 3, treatment: "Mitigate", status: "Active",    owner: "AppSec",     controls: "WAF, reCAPTCHA, MFA enforcement",            trend: "down", due: "2026-03-31" },
  { id: "SR-008", title: "Loss of encryption keys (key management failure)",     category: "Cryptographic", likelihood: 1, impact: 5, treatment: "Avoid",    status: "Active",    owner: "IT Sec",     controls: "HSM, dual-control, key escrow",              trend: "same", due: "2026-06-30" },
  { id: "SR-009", title: "Zero-day exploit in public-facing web application",    category: "Vulnerability", likelihood: 2, impact: 5, treatment: "Mitigate", status: "Active",    owner: "AppSec",     controls: "WAF, bug bounty, rapid patching SLA",        trend: "same", due: "2026-04-30" },
  { id: "SR-010", title: "Phishing campaign targeting finance team (BEC/fraud)", category: "Social Eng.",   likelihood: 4, impact: 3, treatment: "Mitigate", status: "Monitored", owner: "Security",   controls: "Email gateway, security awareness, MFA",     trend: "down", due: "2026-05-31" },
];

const RISK_MATRIX_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"];
const IMPACT_LABELS     = ["Negligible", "Minor", "Moderate", "Major", "Catastrophic"];

function riskScore(l: number, i: number) { return l * i; }
function riskColor(score: number) {
  if (score >= 16) return "bg-red-500 text-white";
  if (score >= 10) return "bg-orange-500 text-white";
  if (score >= 6)  return "bg-yellow-500 text-black";
  return "bg-green-500 text-white";
}
function riskLabel(score: number) {
  if (score >= 16) return "Critical";
  if (score >= 10) return "High";
  if (score >= 6)  return "Medium";
  return "Low";
}

const TREATMENT_COLORS: Record<string, string> = {
  Mitigate: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  Transfer: "bg-violet-500/15 text-violet-400 border-violet-500/25",
  Accept:   "bg-green-500/15 text-green-400 border-green-500/25",
  Avoid:    "bg-orange-500/15 text-orange-400 border-orange-500/25",
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-amber-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function SecurityRiskRegister() {
  const [catFilter, setCatFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  const { toast } = useToast();

  const categories = [...new Set(RISKS.map(r => r.category))];
  const critical = RISKS.filter(r => riskScore(r.likelihood, r.impact) >= 16).length;
  const high = RISKS.filter(r => { const s = riskScore(r.likelihood, r.impact); return s >= 10 && s < 16; }).length;
  const avgScore = Math.round(RISKS.reduce((s, r) => s + riskScore(r.likelihood, r.impact), 0) / RISKS.length);

  const filtered = RISKS.filter(r => {
    const score = riskScore(r.likelihood, r.impact);
    const matchCat = catFilter === "all" || r.category.toLowerCase().includes(catFilter.toLowerCase());
    const matchRisk = riskFilter === "all" ||
      (riskFilter === "critical" && score >= 16) ||
      (riskFilter === "high" && score >= 10 && score < 16) ||
      (riskFilter === "medium" && score >= 6 && score < 10);
    return matchCat && matchRisk;
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "Security Risk Register",
        capabilities: ["ISO 31000 risk assessment", "5×5 likelihood/impact matrix", "Risk treatment planning", "Residual risk tracking", "Risk trend analysis", "Board-level risk reporting"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="risk-register" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Risks",       value: RISKS.length.toString(), color: "text-blue-400",    sub: "in active register" },
          { label: "Critical Risks",    value: critical.toString(),     color: "text-red-400",    sub: "score ≥ 16 (L×I)" },
          { label: "High Risks",        value: high.toString(),         color: "text-orange-400", sub: "score ≥ 10" },
          { label: "Avg. Risk Score",   value: avgScore.toString(),     color: avgScore >= 10 ? "text-red-400" : "text-yellow-400", sub: "out of 25" },
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Heat Map */}
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-400" />
              Risk Heat Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {[5,4,3,2,1].map(impact => (
                <div key={impact} className="flex gap-1 items-center">
                  <span className="text-[8px] text-muted-foreground/30 w-16 text-right shrink-0">{IMPACT_LABELS[impact-1].slice(0,8)}</span>
                  {[1,2,3,4,5].map(likelihood => {
                    const score = likelihood * impact;
                    const risksHere = RISKS.filter(r => r.likelihood === likelihood && r.impact === impact).length;
                    return (
                      <div key={likelihood} className={cn("h-8 flex-1 rounded flex items-center justify-center text-[10px] font-bold", riskColor(score), "opacity-80")}>
                        {risksHere > 0 ? risksHere : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="flex gap-1 items-center mt-1">
                <span className="w-16" />
                {RISK_MATRIX_LABELS.map(l => (
                  <p key={l} className="flex-1 text-center text-[7px] text-muted-foreground/30">{l.slice(0,4)}</p>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {[["Critical","bg-red-500"],["High","bg-orange-500"],["Medium","bg-yellow-500"],["Low","bg-green-500"]].map(([l,c]) => (
                <div key={l} className="flex items-center gap-1">
                  <div className={cn("h-2.5 w-2.5 rounded-sm", c)} />
                  <span className="text-[9px] text-muted-foreground/50">{l}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Register Table */}
        <Card className="bg-card/60 border-border/40 lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Risk Register ({filtered.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="h-7 text-xs w-28 bg-muted/20" data-testid="select-risk-level"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ratings</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={catFilter} onValueChange={setCatFilter}>
                  <SelectTrigger className="h-7 text-xs w-32 bg-muted/20" data-testid="select-risk-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}
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
                    {["ID","Risk","Category","L","I","Score","Rating","Treatment","Owner","Due","Trend","Actions"].map(h => (
                      <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-2 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map(r => {
                    const score = riskScore(r.likelihood, r.impact);
                    return (
                      <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-2 py-2.5 font-mono text-[10px] text-primary">{r.id}</td>
                        <td className="px-2 py-2.5 max-w-[160px]"><p className="truncate text-[10px] text-foreground/80">{r.title}</p></td>
                        <td className="px-2 py-2.5 text-[9px] text-muted-foreground/50 whitespace-nowrap">{r.category}</td>
                        <td className="px-2 py-2.5 text-[10px] text-center font-bold">{r.likelihood}</td>
                        <td className="px-2 py-2.5 text-[10px] text-center font-bold">{r.impact}</td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded", riskColor(score))}>{score}</span>
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge className={cn("text-[9px] px-1.5 py-0 border-0",
                            score >= 16 ? "bg-red-500/20 text-red-300" :
                            score >= 10 ? "bg-orange-500/20 text-orange-300" :
                            score >= 6  ? "bg-yellow-500/20 text-yellow-300" : "bg-green-500/20 text-green-300"
                          )}>{riskLabel(score)}</Badge>
                        </td>
                        <td className="px-2 py-2.5">
                          <Badge className={cn("text-[9px] px-1.5 py-0 border", TREATMENT_COLORS[r.treatment])}>{r.treatment}</Badge>
                        </td>
                        <td className="px-2 py-2.5 text-[9px] text-muted-foreground/50">{r.owner}</td>
                        <td className="px-2 py-2.5 text-[9px] text-muted-foreground/40 whitespace-nowrap">{r.due}</td>
                        <td className="px-2 py-2.5">
                          {r.trend === "up"   && <TrendingUp   className="h-3.5 w-3.5 text-red-400" />}
                          {r.trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-green-400" />}
                          {r.trend === "same" && <Minus        className="h-3.5 w-3.5 text-muted-foreground/30" />}
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-blue-400 border-blue-500/30 hover:bg-blue-500/10" data-testid={`button-update-${r.id}`} onClick={() => toast({ title: "Risk updated", description: `${r.id} treatment plan updated — review scheduled` })}>Update</Button>
                            {score >= 12 && (
                              <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid={`button-escalate-${r.id}`} onClick={() => toast({ title: "Risk escalated", description: `${r.id} escalated to Board Risk Committee for review` })}>Escalate</Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI */}
      <Card className="bg-gradient-to-br from-amber-950/40 to-card/60 border-amber-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-amber-400" />
              AI Risk Intelligence
              <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-amber-700 hover:bg-amber-800 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-risk-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-amber-400" /><p className="text-xs text-muted-foreground/60">AI assessing {RISKS.length} risks across the threat landscape…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-amber-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis for board-level risk narrative, emerging threat correlation, and control effectiveness recommendations.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
