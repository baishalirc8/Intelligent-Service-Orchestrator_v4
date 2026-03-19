import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GraduationCap, Brain, Sparkles, Loader2, RefreshCw, Zap,
  Fish, Users, Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const DEPARTMENTS = [
  { name: "Finance",        staff: 42,  trained: 41, pct: 98, riskScore: 12, phishClick: 4,  phishReport: 88 },
  { name: "Engineering",    staff: 118, trained: 114,pct: 97, riskScore: 14, phishClick: 6,  phishReport: 72 },
  { name: "IT Operations",  staff: 31,  trained: 31, pct: 100,riskScore: 8,  phishClick: 2,  phishReport: 95 },
  { name: "HR",             staff: 18,  trained: 17, pct: 94, riskScore: 28, phishClick: 22, phishReport: 45 },
  { name: "Executive",      staff: 12,  trained: 10, pct: 83, riskScore: 35, phishClick: 31, phishReport: 52 },
  { name: "Sales",          staff: 67,  trained: 54, pct: 81, riskScore: 42, phishClick: 38, phishReport: 34 },
  { name: "Legal",          staff: 8,   trained: 8,  pct: 100,riskScore: 10, phishClick: 3,  phishReport: 90 },
  { name: "Customer Support",staff: 44, trained: 32, pct: 73, riskScore: 55, phishClick: 52, phishReport: 28 },
];

const PHISHING_CAMPAIGNS = [
  { name: "Q1 2026 – CEO Fraud BEC",         launched: "2026-03-01", targets: 340, sent: 340, clicked: 87, reported: 148, status: "Active"    },
  { name: "Q4 2025 – IT Password Reset",      launched: "2025-12-15", targets: 340, sent: 340, clicked: 124,reported: 98,  status: "Completed" },
  { name: "Q3 2025 – Invoice Phishing",        launched: "2025-09-10", targets: 290, sent: 290, clicked: 143,reported: 72,  status: "Completed" },
  { name: "Q2 2025 – Dropbox File Share",      launched: "2025-06-05", targets: 310, sent: 310, clicked: 168,reported: 61,  status: "Completed" },
];

const TRAINING_MODULES = [
  { name: "Security Awareness Foundations",      completion: 96, mandatory: true,  category: "Baseline",    dueDate: "2026-03-31" },
  { name: "Phishing & Social Engineering",       completion: 91, mandatory: true,  category: "Phishing",    dueDate: "2026-03-31" },
  { name: "Password & MFA Best Practices",       completion: 94, mandatory: true,  category: "Auth",        dueDate: "2026-03-31" },
  { name: "GDPR & Data Protection for All",      completion: 88, mandatory: true,  category: "Compliance",  dueDate: "2026-03-31" },
  { name: "Ransomware – Spot & Stop",            completion: 82, mandatory: false, category: "Threat",      dueDate: "2026-04-30" },
  { name: "Secure Remote Working",               completion: 79, mandatory: false, category: "Behaviour",   dueDate: "2026-04-30" },
  { name: "AI-Powered Phishing Awareness",       completion: 61, mandatory: false, category: "Emerging",    dueDate: "2026-05-31" },
];

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-pink-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function SecurityAwareness() {
  const [deptFilter, setDeptFilter] = useState("all");

  const { toast } = useToast();

  const totalStaff = DEPARTMENTS.reduce((s, d) => s + d.staff, 0);
  const totalTrained = DEPARTMENTS.reduce((s, d) => s + d.trained, 0);
  const overallPct = Math.round((totalTrained / totalStaff) * 100);
  const avgRisk = Math.round(DEPARTMENTS.reduce((s, d) => s + d.riskScore, 0) / DEPARTMENTS.length);
  const highRisk = DEPARTMENTS.filter(d => d.riskScore >= 40).length;
  const activeCampaign = PHISHING_CAMPAIGNS.find(c => c.status === "Active");
  const activeClickRate = activeCampaign ? Math.round((activeCampaign.clicked / activeCampaign.sent) * 100) : 0;

  const filteredDepts = DEPARTMENTS.filter(d =>
    deptFilter === "all" ||
    (deptFilter === "high-risk" && d.riskScore >= 40) ||
    (deptFilter === "incomplete" && d.pct < 90)
  );

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "Security Awareness & Human Risk",
        capabilities: ["Phishing simulation campaigns", "Human risk scoring by department", "Adaptive training assignment", "Spear-phishing simulation", "Compliance training tracking", "Behavioural analytics"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="awareness" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Overall Completion",  value: `${overallPct}%`, color: overallPct >= 95 ? "text-green-400" : overallPct >= 80 ? "text-yellow-400" : "text-red-400", sub: `${totalTrained}/${totalStaff} staff` },
          { label: "Avg. Human Risk",     value: avgRisk.toString(), color: avgRisk <= 20 ? "text-green-400" : avgRisk <= 40 ? "text-yellow-400" : "text-red-400",      sub: "across all departments" },
          { label: "High-Risk Depts",     value: highRisk.toString(), color: "text-red-400",  sub: "risk score ≥ 40" },
          { label: "Phishing Click Rate", value: `${activeClickRate}%`, color: activeClickRate <= 10 ? "text-green-400" : activeClickRate <= 25 ? "text-yellow-400" : "text-red-400", sub: "active Q1 campaign" },
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
        {/* Training Modules */}
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-pink-400" />
              Training Modules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {TRAINING_MODULES.map(m => (
              <div key={m.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] font-medium truncate">{m.name}</p>
                      {m.mandatory && <Badge className="text-[8px] px-1 py-0 bg-red-500/15 text-red-400 border-0 shrink-0">Required</Badge>}
                    </div>
                    <p className="text-[9px] text-muted-foreground/40">{m.category} · Due {m.dueDate}</p>
                  </div>
                  <span className={cn("text-xs font-bold ml-2 shrink-0",
                    m.completion >= 90 ? "text-green-400" : m.completion >= 75 ? "text-yellow-400" : "text-red-400"
                  )}>{m.completion}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className={cn("h-full rounded-full", m.completion >= 90 ? "bg-green-500" : m.completion >= 75 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${m.completion}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Department Risk + Phishing */}
        <Card className="bg-card/60 border-border/40 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                Department Risk Breakdown ({filteredDepts.length})
              </CardTitle>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-7 text-xs w-32 bg-muted/20" data-testid="select-awareness-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All depts</SelectItem>
                  <SelectItem value="high-risk">High risk only</SelectItem>
                  <SelectItem value="incomplete">Training incomplete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Department","Training %","Human Risk","Phish Click %","Phish Report %","Staff","Actions"].map(h => (
                      <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filteredDepts.sort((a, b) => b.riskScore - a.riskScore).map(d => (
                    <tr key={d.name} className={cn("hover:bg-muted/10 transition-colors", d.riskScore >= 40 ? "bg-red-500/5" : "")}>
                      <td className="px-3 py-2.5 text-xs font-medium">{d.name}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                            <div className={cn("h-full rounded-full", d.pct >= 95 ? "bg-green-500" : d.pct >= 80 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${d.pct}%` }} />
                          </div>
                          <span className={cn("text-[10px] font-bold", d.pct >= 95 ? "text-green-400" : d.pct >= 80 ? "text-yellow-400" : "text-red-400")}>{d.pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className={cn("text-[10px] font-bold",
                            d.riskScore < 20 ? "text-green-400" : d.riskScore < 40 ? "text-yellow-400" : "text-red-400"
                          )}>{d.riskScore}</span>
                          {d.riskScore >= 40 ? <TrendingUp className="h-3 w-3 text-red-400" /> : d.riskScore < 20 ? <TrendingDown className="h-3 w-3 text-green-400" /> : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[10px] font-bold", d.phishClick <= 10 ? "text-green-400" : d.phishClick <= 25 ? "text-yellow-400" : "text-red-400")}>{d.phishClick}%</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[10px] font-bold", d.phishReport >= 70 ? "text-green-400" : d.phishReport >= 40 ? "text-yellow-400" : "text-red-400")}>{d.phishReport}%</span>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50">{d.trained}/{d.staff}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-pink-400 border-pink-500/30 hover:bg-pink-500/10" data-testid={`button-remind-${d.name}`} onClick={() => toast({ title: "Training reminder sent", description: `Mandatory security awareness reminder sent to ${d.staff - d.trained} untrained members in ${d.name}` })}>Send Reminder</Button>
                          {d.riskScore >= 30 && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-orange-400 border-orange-500/30 hover:bg-orange-500/10" data-testid={`button-simulate-${d.name}`} onClick={() => toast({ title: "Phishing simulation launched", description: `Targeted phishing simulation queued for ${d.name} crew` })}>Simulate</Button>
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

      {/* Phishing Campaign History */}
      <Card className="bg-card/60 border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Fish className="h-4 w-4 text-pink-400" />
            Phishing Simulation Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/30">
                  {["Campaign","Launched","Targets","Clicked","Click Rate","Reported","Report Rate","Status"].map(h => (
                    <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {PHISHING_CAMPAIGNS.map(c => {
                  const clickRate = Math.round((c.clicked / c.sent) * 100);
                  const reportRate = Math.round((c.reported / c.sent) * 100);
                  return (
                    <tr key={c.name} className="hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2.5 max-w-[200px]"><p className="truncate text-foreground/80">{c.name}</p></td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50">{c.launched}</td>
                      <td className="px-3 py-2.5 text-[10px] font-medium">{c.targets}</td>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-red-400">{c.clicked}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[10px] font-bold", clickRate <= 15 ? "text-green-400" : clickRate <= 30 ? "text-yellow-400" : "text-red-400")}>{clickRate}%</span>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-green-400">{c.reported}</td>
                      <td className="px-3 py-2.5">
                        <span className={cn("text-[10px] font-bold", reportRate >= 60 ? "text-green-400" : reportRate >= 30 ? "text-yellow-400" : "text-red-400")}>{reportRate}%</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge className={cn("text-[9px] px-1.5 py-0 border-0",
                          c.status === "Active" ? "bg-blue-500/15 text-blue-400" : "bg-green-500/15 text-green-400"
                        )}>{c.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI */}
      <Card className="bg-gradient-to-br from-pink-950/40 to-card/60 border-pink-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-pink-400" />
              AI Human Risk Intelligence
              <Badge className="text-[10px] bg-pink-500/15 text-pink-400 border-pink-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-pink-800 hover:bg-pink-900 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-awareness-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-pink-400" /><p className="text-xs text-muted-foreground/60">AI calculating human risk scores and adaptive training paths…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-pink-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis for per-department human risk scoring, personalised training recommendations, and phishing susceptibility predictions.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
