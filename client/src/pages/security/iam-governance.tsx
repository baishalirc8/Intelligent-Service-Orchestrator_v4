import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  KeyRound, Brain, Sparkles, Loader2, RefreshCw, Zap,
  UserCheck, UserX, AlertTriangle, ShieldCheck, Lock, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const ACCESS_REVIEWS = [
  { user: "j.smith",       role: "Domain Admin",                  dept: "IT Operations",    risk: "Critical", lastReview: "91 days ago", status: "Overdue",  justification: "Break-glass account" },
  { user: "finance-svc",   role: "Azure Subscription Owner",       dept: "Finance",          risk: "Critical", lastReview: "Never",       status: "Overdue",  justification: "Legacy service account" },
  { user: "m.jones",       role: "AWS Power User",                 dept: "Engineering",      risk: "High",     lastReview: "47 days ago", status: "Due",      justification: "Terraform automation" },
  { user: "r.taylor",      role: "Database Admin (prod-postgres)", dept: "Data Engineering", risk: "High",     lastReview: "30 days ago", status: "Reviewed", justification: "DBA team membership" },
  { user: "c.patel",       role: "Global IT Admin (M365)",         dept: "IT",               risk: "Critical", lastReview: "62 days ago", status: "Overdue",  justification: "Helpdesk escalation" },
  { user: "a.lee",         role: "HR System Admin",                dept: "HR",               risk: "High",     lastReview: "28 days ago", status: "Reviewed", justification: "HR platform owner" },
  { user: "b.kumar",       role: "Security Analyst (SOC Read)",    dept: "Security",         risk: "Medium",   lastReview: "14 days ago", status: "Reviewed", justification: "SOC Tier-1 analyst" },
  { user: "d.nguyen",      role: "Finance Read-Only (SAP)",        dept: "Finance",          risk: "Low",      lastReview: "10 days ago", status: "Reviewed", justification: "Monthly reporting" },
];

const PRIVILEGED_ACCOUNTS = [
  { account: "Administrator", type: "Local Admin", systems: 47, mfa: true,  pam: "CyberArk", lastRotated: "12 days ago", vaulted: true  },
  { account: "root",          type: "Linux Root",  systems: 31, mfa: false, pam: "CyberArk", lastRotated: "8 days ago",  vaulted: true  },
  { account: "svc-deploy",    type: "Service Acct",systems: 12, mfa: false, pam: "Manual",   lastRotated: "180 days ago",vaulted: false },
  { account: "svc-backup",    type: "Service Acct",systems: 8,  mfa: false, pam: "Manual",   lastRotated: "210 days ago",vaulted: false },
  { account: "krbtgt",        type: "AD Kerberos", systems: 1,  mfa: false, pam: "CyberArk", lastRotated: "30 days ago", vaulted: true  },
];

const STALE_ACCESS = [
  { user: "ex-employee-2312",  resource: "AWS IAM User",     inactive: "145 days", risk: "Critical" },
  { user: "svc-legacy-monitor",resource: "SQL Server SA",    inactive: "90 days",  risk: "High" },
  { user: "test-account-99",   resource: "M365 License",     inactive: "61 days",  risk: "Medium" },
  { user: "contractor-jd",     resource: "VPN Access",       inactive: "45 days",  risk: "Medium" },
];

const RISK_COLORS: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/30",
  High:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Low:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  Overdue:  "bg-red-500/15 text-red-400 border-red-500/25",
  Due:      "bg-orange-500/15 text-orange-400 border-orange-500/25",
  Reviewed: "bg-green-500/15 text-green-400 border-green-500/25",
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-indigo-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function IAMGovernance() {
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { toast } = useToast();

  const overdue = ACCESS_REVIEWS.filter(r => r.status === "Overdue").length;
  const criticalPriv = PRIVILEGED_ACCOUNTS.filter(a => !a.vaulted || !a.mfa).length;
  const staleCount = STALE_ACCESS.length;
  const totalAccounts = ACCESS_REVIEWS.length;

  const filtered = ACCESS_REVIEWS.filter(r => {
    const matchRisk = riskFilter === "all" || r.risk.toLowerCase() === riskFilter;
    const matchStatus = statusFilter === "all" || r.status.toLowerCase() === statusFilter;
    return matchRisk && matchStatus;
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "IAM Governance",
        capabilities: ["Access review campaigns", "Privileged access management (PAM)", "Stale account detection", "Role mining and least-privilege enforcement", "Segregation of duties (SoD) analysis", "Joiner-Mover-Leaver lifecycle"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="iam" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Accounts Under Review", value: totalAccounts.toString(), color: "text-blue-400",   sub: "quarterly campaign active" },
          { label: "Overdue Reviews",        value: overdue.toString(),       color: "text-red-400",   sub: "past SLA deadline" },
          { label: "PAM Gaps",               value: criticalPriv.toString(),  color: "text-orange-400", sub: "unvaulted or no MFA" },
          { label: "Stale Accesses",         value: staleCount.toString(),   color: "text-red-400",   sub: "45+ days inactive" },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Access Review Queue */}
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-blue-400" />
                Access Review Queue ({filtered.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="h-7 text-xs w-24 bg-muted/20" data-testid="select-iam-risk"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All risk</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-7 text-xs w-28 bg-muted/20" data-testid="select-iam-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
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
                    {["User","Privileged Role","Dept","Risk","Last Review","Status","Actions"].map(h => (
                      <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map(r => (
                    <tr key={r.user} className={cn("hover:bg-muted/10 transition-colors", r.status === "Overdue" ? "bg-red-500/5" : "")}>
                      <td className="px-3 py-2.5 font-mono text-[10px]">{r.user}</td>
                      <td className="px-3 py-2.5 max-w-[150px]"><p className="truncate text-foreground/80 text-[10px]">{r.role}</p></td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50">{r.dept}</td>
                      <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", RISK_COLORS[r.risk])}>{r.risk}</Badge></td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50 whitespace-nowrap">{r.lastReview}</td>
                      <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", STATUS_COLORS[r.status])}>{r.status}</Badge></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-green-400 border-green-500/30 hover:bg-green-500/10" data-testid={`button-approve-${r.user}`} onClick={() => toast({ title: "Access approved", description: `${r.role} for ${r.user} certified for another 90 days` })}>Approve</Button>
                          <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid={`button-revoke-${r.user}`} onClick={() => toast({ title: "Access revoked", description: `${r.role} revoked for ${r.user} — deprovisioning queued` })}>Revoke</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Privileged Accounts */}
          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-orange-400" />
                Privileged Accounts (PAM)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    {["Account","Type","Systems","MFA","PAM","Rotated","Vaulted"].map(h => (
                      <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {PRIVILEGED_ACCOUNTS.map(a => (
                    <tr key={a.account} className={cn("hover:bg-muted/10 transition-colors", (!a.vaulted || !a.mfa) ? "bg-orange-500/5" : "")}>
                      <td className="px-3 py-2.5 font-mono text-[10px]">{a.account}</td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/60">{a.type}</td>
                      <td className="px-3 py-2.5 text-[10px] font-medium">{a.systems}</td>
                      <td className="px-3 py-2.5"><span className={cn("text-[10px] font-bold", a.mfa ? "text-green-400" : "text-red-400")}>{a.mfa ? "Yes" : "No"}</span></td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/50">{a.pam}</td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground/40 whitespace-nowrap">{a.lastRotated}</td>
                      <td className="px-3 py-2.5"><span className={cn("text-[10px] font-bold", a.vaulted ? "text-green-400" : "text-red-400")}>{a.vaulted ? "✓" : "✗"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Stale Access */}
          <Card className="bg-card/60 border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-400" />
                Stale / Orphaned Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {STALE_ACCESS.map(s => (
                <div key={s.user} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                  <div>
                    <p className="font-mono text-[10px]">{s.user}</p>
                    <p className="text-[9px] text-muted-foreground/50">{s.resource} · inactive {s.inactive}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={cn("text-[9px] px-1.5 py-0 border", RISK_COLORS[s.risk])}>{s.risk}</Badge>
                    <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid={`button-revoke-stale-${s.user}`} onClick={() => toast({ title: "Stale access removed", description: `${s.resource} access for ${s.user} revoked and orphan cleaned up` })}>Revoke</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI */}
      <Card className="bg-gradient-to-br from-indigo-950/40 to-card/60 border-indigo-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-indigo-400" />
              AI IAM Governance Analysis
              <Badge className="text-[10px] bg-indigo-500/15 text-indigo-400 border-indigo-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-iam-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /><p className="text-xs text-muted-foreground/60">AI performing role mining and least-privilege analysis…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-indigo-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis for automated role mining, SoD conflict detection, and AI-guided access certification recommendations.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
