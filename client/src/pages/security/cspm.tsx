import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Cloud, AlertTriangle, CheckCircle2, Shield, RefreshCw, Zap,
  Brain, Sparkles, Loader2, TrendingUp, Server, Lock, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

const CLOUD_PROVIDERS = [
  { name: "AWS",   icon: Cloud, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", score: 74, total: 412, passed: 305, failed: 107, critical: 9,  accounts: 14 },
  { name: "Azure", icon: Cloud, color: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20",    score: 81, total: 288, passed: 233, failed: 55,  critical: 4,  accounts: 6  },
  { name: "GCP",   icon: Cloud, color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  score: 68, total: 193, passed: 131, failed: 62,  critical: 7,  accounts: 4  },
];

const FINDINGS = [
  { id: "CSPM-001", provider: "AWS",   resource: "S3/prod-backups-eu",           rule: "S3 bucket is publicly readable",                  severity: "Critical", framework: "CIS AWS 2.1.5", status: "Open",       region: "eu-west-1" },
  { id: "CSPM-002", provider: "AWS",   resource: "IAM/role-lambda-executor",     rule: "IAM role has wildcard * permissions",              severity: "Critical", framework: "CIS AWS 1.16", status: "Open",       region: "us-east-1" },
  { id: "CSPM-003", provider: "GCP",   resource: "GKE/prod-cluster-gke01",       rule: "Kubernetes API server publicly accessible",        severity: "Critical", framework: "CIS GKE 5.6",  status: "Open",       region: "us-central1" },
  { id: "CSPM-004", provider: "AWS",   resource: "EC2/sg-0xAB12 (web-tier)",     rule: "Security group allows 0.0.0.0/0 on port 22",      severity: "High",     framework: "CIS AWS 5.2",  status: "In Review",  region: "us-east-1" },
  { id: "CSPM-005", provider: "Azure", resource: "AzureAD/admin@corp.com",       rule: "Global Admin without MFA enforced",                severity: "Critical", framework: "CIS Azure 1.1.1",status: "Open",     region: "Global" },
  { id: "CSPM-006", provider: "GCP",   resource: "IAM/svc-data-pipeline",        rule: "Service account has project owner role",           severity: "High",     framework: "CIS GCP 1.5",  status: "Open",       region: "us-central1" },
  { id: "CSPM-007", provider: "AWS",   resource: "RDS/prod-postgres-01",         rule: "RDS instance is publicly accessible",              severity: "Critical", framework: "CIS AWS 2.3.2", status: "Remediated", region: "eu-west-1" },
  { id: "CSPM-008", provider: "AWS",   resource: "CloudTrail/all-regions",       rule: "CloudTrail logging not enabled in all regions",    severity: "High",     framework: "CIS AWS 3.1",  status: "Open",       region: "Multi" },
  { id: "CSPM-009", provider: "Azure", resource: "Storage/stprodlogs001",        rule: "Storage account allows public blob access",        severity: "High",     framework: "CIS Azure 3.5", status: "In Review",  region: "westeurope" },
  { id: "CSPM-010", provider: "GCP",   resource: "Firestore/prod-db",            rule: "Firestore security rules allow open read/write",   severity: "Critical", framework: "NIST AC-3",    status: "Open",       region: "us-central1" },
  { id: "CSPM-011", provider: "AWS",   resource: "Lambda/invoice-processor",     rule: "Lambda function without resource policy restrictions",severity: "Medium", framework: "CIS AWS 1.22", status: "Open",       region: "us-east-1" },
  { id: "CSPM-012", provider: "Azure", resource: "KeyVault/kv-prod-secrets",     rule: "Key Vault soft delete not enabled",                severity: "Medium",   framework: "CIS Azure 8.4", status: "Remediated", region: "eastus" },
];

const FRAMEWORKS = [
  { name: "CIS AWS Benchmark L1",  score: 74, controls: 58, passed: 43, color: "bg-orange-500" },
  { name: "CIS Azure Benchmark L1",score: 81, controls: 44, passed: 36, color: "bg-sky-500" },
  { name: "CIS GCP Benchmark L1",  score: 68, controls: 37, passed: 25, color: "bg-green-500" },
  { name: "NIST SP 800-53",        score: 71, controls: 90, passed: 64, color: "bg-violet-500" },
  { name: "SOC 2 Cloud Controls",  score: 83, controls: 32, passed: 27, color: "bg-blue-500" },
];

const SEV_COLORS: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/30",
  High:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  Medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Low:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
};
const STATUS_COLORS: Record<string, string> = {
  Open:       "bg-red-500/15 text-red-400 border-red-500/25",
  "In Review":"bg-blue-500/15 text-blue-400 border-blue-500/25",
  Remediated: "bg-green-500/15 text-green-400 border-green-500/25",
};
const PROVIDER_COLORS: Record<string, string> = {
  AWS:   "bg-orange-500/10 text-orange-400",
  Azure: "bg-sky-500/10 text-sky-400",
  GCP:   "bg-green-500/10 text-green-400",
};

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="pl-3 border-l border-sky-500/30 text-muted-foreground/70">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        return rendered.trim() ? <p key={i}>{rendered}</p> : <div key={i} className="h-1" />;
      })}
    </div>
  );
}

export default function CloudSecurityPosture() {
  const [providerFilter, setProviderFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  const totalFindings = FINDINGS.length;
  const openCritical = FINDINGS.filter(f => f.severity === "Critical" && f.status === "Open").length;
  const totalResources = CLOUD_PROVIDERS.reduce((s, p) => s + p.total, 0);
  const avgScore = Math.round(CLOUD_PROVIDERS.reduce((s, p) => s + p.score, 0) / CLOUD_PROVIDERS.length);

  const { toast } = useToast();

  const filtered = FINDINGS.filter(f => {
    const matchProv = providerFilter === "all" || f.provider.toLowerCase() === providerFilter;
    const matchSev = severityFilter === "all" || f.severity.toLowerCase() === severityFilter;
    return matchProv && matchSev;
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: "Cloud Security Posture Management (CSPM)",
        capabilities: ["Multi-cloud misconfiguration detection", "CIS Benchmark compliance scoring", "Drift alerting", "Auto-remediation scripts", "ITIL RFC auto-raise", "Cloud asset inventory"],
      });
      return r.json();
    },
  });
  const insights = (aiMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <SuggestedAgentsPanel module="cspm" />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Avg. Posture Score", value: `${avgScore}%`, color: avgScore >= 80 ? "text-green-400" : avgScore >= 60 ? "text-yellow-400" : "text-red-400", sub: "across 3 clouds" },
          { label: "Resources Scanned",  value: totalResources.toLocaleString(), color: "text-sky-400",    sub: "24 accounts / tenants" },
          { label: "Open Critical",      value: openCritical.toString(),          color: "text-red-400",   sub: "require immediate action" },
          { label: "Total Findings",     value: totalFindings.toString(),         color: "text-orange-400", sub: `${FINDINGS.filter(f => f.status === "Remediated").length} remediated` },
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

      {/* Cloud Provider Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {CLOUD_PROVIDERS.map(p => (
          <Card key={p.name} className={cn("border", p.bg, p.border)}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <p.icon className={cn("h-5 w-5", p.color)} />
                  <span className="font-bold text-sm">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground/50">{p.accounts} accounts</span>
                </div>
                <span className={cn("text-2xl font-black", p.color)}>{p.score}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/30 overflow-hidden mb-3">
                <div className={cn("h-full rounded-full", p.score >= 80 ? "bg-green-500" : p.score >= 60 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${p.score}%` }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                <div><p className="text-xs font-bold text-green-400">{p.passed}</p><p className="text-[9px] text-muted-foreground/40">Passed</p></div>
                <div><p className="text-xs font-bold text-red-400">{p.failed}</p><p className="text-[9px] text-muted-foreground/40">Failed</p></div>
                <div><p className="text-xs font-bold text-red-400">{p.critical}</p><p className="text-[9px] text-muted-foreground/40">Critical</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Framework Compliance */}
        <Card className="bg-card/60 border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-400" />
              Framework Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FRAMEWORKS.map(f => (
              <div key={f.name}>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground/70 font-medium">{f.name}</span>
                  <span className={cn("font-bold", f.score >= 80 ? "text-green-400" : f.score >= 60 ? "text-yellow-400" : "text-red-400")}>{f.score}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className={cn("h-full rounded-full", f.color)} style={{ width: `${f.score}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground/30 mt-0.5">{f.passed}/{f.controls} controls passing</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Findings Table */}
        <Card className="bg-card/60 border-border/40 lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
                Misconfigurations ({filtered.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className="h-7 text-xs w-24 bg-muted/20" data-testid="select-cspm-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clouds</SelectItem>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                    <SelectItem value="gcp">GCP</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-7 text-xs w-24 bg-muted/20" data-testid="select-cspm-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All severity</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
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
                    {["Cloud","Resource","Rule Violated","Severity","Framework","Region","Status","Actions"].map(h => (
                      <th key={h} className="text-left text-[10px] text-muted-foreground/50 font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {filtered.map(f => (
                    <tr key={f.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-3 py-2.5">
                        <Badge className={cn("text-[9px] px-1.5 py-0 border-0", PROVIDER_COLORS[f.provider])}>{f.provider}</Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground/70 max-w-[130px] truncate">{f.resource}</td>
                      <td className="px-3 py-2.5 max-w-[200px]"><p className="truncate text-foreground/80">{f.rule}</p></td>
                      <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", SEV_COLORS[f.severity])}>{f.severity}</Badge></td>
                      <td className="px-3 py-2.5 text-muted-foreground/50 text-[10px] whitespace-nowrap">{f.framework}</td>
                      <td className="px-3 py-2.5 text-muted-foreground/40 text-[10px]">{f.region}</td>
                      <td className="px-3 py-2.5"><Badge className={cn("text-[9px] px-1.5 py-0 border", STATUS_COLORS[f.status])}>{f.status}</Badge></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {f.status === "Open" && (<>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-green-400 border-green-500/30 hover:bg-green-500/10" data-testid={`button-remediate-${f.id}`} onClick={() => toast({ title: "Remediation queued", description: `RFC raised for ${f.resource} — ${f.rule}` })}>Remediate</Button>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-amber-400 border-amber-500/30 hover:bg-amber-500/10" data-testid={`button-accept-${f.id}`} onClick={() => toast({ title: "Risk accepted", description: `${f.resource} finding suppressed with business justification` })}>Accept Risk</Button>
                          </>)}
                          {f.status === "In Review" && (<>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-blue-400 border-blue-500/30 hover:bg-blue-500/10" data-testid={`button-approve-${f.id}`} onClick={() => toast({ title: "Review approved", description: `${f.resource} remediation approved — ticket closed` })}>Approve</Button>
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-red-400 border-red-500/30 hover:bg-red-500/10" data-testid={`button-reject-${f.id}`} onClick={() => toast({ title: "Review rejected", description: `${f.resource} returned to Open — additional work required` })}>Reject</Button>
                          </>)}
                          {f.status === "Remediated" && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-muted-foreground border-border/30 hover:bg-muted/10" data-testid={`button-reopen-${f.id}`} onClick={() => toast({ title: "Finding reopened", description: `${f.resource} — remediation verification failed, finding reopened` })}>Re-Open</Button>
                          )}
                          {f.status === "Suppressed" && (
                            <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 text-muted-foreground border-border/30 hover:bg-muted/10" data-testid={`button-unsuppress-${f.id}`} onClick={() => toast({ title: "Suppression lifted", description: `${f.resource} finding restored to Open queue` })}>Un-Suppress</Button>
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

      {/* AI Insights */}
      <Card className="bg-gradient-to-br from-sky-950/40 to-card/60 border-sky-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-sky-400" />
              AI Cloud Posture Analysis
              <Badge className="text-[10px] bg-sky-500/15 text-sky-400 border-sky-500/20"><Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI</Badge>
            </CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-sky-700 hover:bg-sky-800 text-white" onClick={() => aiMutation.mutate()} disabled={aiMutation.isPending} data-testid="button-cspm-ai">
              {aiMutation.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />Analyzing...</> : insights ? <><RefreshCw className="h-3 w-3" />Re-Analyze</> : <><Zap className="h-3 w-3" />Run AI Analysis</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {aiMutation.isPending && <div className="flex items-center gap-3 py-6 justify-center"><Loader2 className="h-5 w-5 animate-spin text-sky-400" /><p className="text-xs text-muted-foreground/60">Analyzing cloud posture across {CLOUD_PROVIDERS.length} providers and {totalFindings} findings…</p></div>}
          {!aiMutation.isPending && !insights && <div className="flex flex-col items-center gap-2 py-6 text-center"><Brain className="h-8 w-8 text-sky-400/30" /><p className="text-xs text-muted-foreground/40">Run AI analysis to get autonomous posture recommendations, prioritized remediation, and proactive drift detection insights.</p></div>}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>
    </div>
  );
}
