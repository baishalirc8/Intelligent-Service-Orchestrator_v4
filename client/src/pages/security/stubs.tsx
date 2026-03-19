import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Cloud, HardDrive, MonitorCheck, Siren, KeyRound, ClipboardCheck,
  AlertTriangle, FileKey, GraduationCap, CheckCircle2, Clock, Zap,
  Brain, Sparkles, Loader2, RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CapabilityGroup {
  group: string;
  items: string[];
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground/80">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="text-sm font-bold text-foreground mt-3">{line.slice(3)}</p>;
        if (line.startsWith("### ")) return <p key={i} className="text-xs font-bold text-foreground/90 mt-2">{line.slice(4)}</p>;
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1");
          return <p key={i} className="pl-3 border-l border-violet-500/30 text-muted-foreground/70">{content}</p>;
        }
        const rendered = line.replace(/\*\*(.*?)\*\*/g, "$1");
        if (!rendered.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{rendered}</p>;
      })}
    </div>
  );
}

function SecurityModulePage({
  icon: Icon,
  title,
  tagline,
  description,
  color,
  bgColor,
  borderColor,
  capabilities,
  itilPractice,
  status = "In Development",
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  capabilities: CapabilityGroup[];
  itilPractice: string;
  status?: string;
}) {
  const allCapItems = capabilities.flatMap(g => g.items);

  const insightMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/security/ai/module-insights", {
        module: title,
        capabilities: allCapItems,
      });
      return r.json();
    },
  });

  const insights = (insightMutation.data as any)?.insights as string | undefined;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1000px] mx-auto">
      {/* Hero */}
      <div className={cn("rounded-2xl border p-6", bgColor, borderColor)}>
        <div className="flex items-start gap-4">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border shrink-0", bgColor, borderColor)}>
            <Icon className={cn("h-6 w-6", color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black text-foreground">{title}</h2>
              <Badge className={cn("text-[10px] px-2 py-0.5 border-0", bgColor, color)}>{tagline}</Badge>
              <Badge className="text-[10px] px-2 py-0.5 bg-amber-500/15 text-amber-400 border-0 ml-auto">
                <Clock className="h-2.5 w-2.5 mr-1" />{status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground/70 mt-2 leading-relaxed">{description}</p>
            <div className="flex items-center gap-2 mt-3">
              <Badge className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                ITIL Practice: {itilPractice}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* AI Live Insights Preview */}
      <Card className="bg-gradient-to-br from-violet-950/40 to-card/60 border-violet-500/25">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-400" />
              AI Live Insights Preview
              <Badge className="text-[10px] bg-violet-500/15 text-violet-400 border-violet-500/20">
                <Sparkles className="h-2.5 w-2.5 mr-1" />Generative AI
              </Badge>
            </CardTitle>
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5 bg-violet-700 hover:bg-violet-800 text-white"
              onClick={() => insightMutation.mutate()}
              disabled={insightMutation.isPending}
              data-testid={`button-ai-preview-${title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {insightMutation.isPending
                ? <><Loader2 className="h-3 w-3 animate-spin" />Generating...</>
                : insights
                  ? <><RefreshCw className="h-3 w-3" />Regenerate</>
                  : <><Zap className="h-3 w-3" />Preview AI Capabilities</>
              }
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {insightMutation.isPending && (
            <div className="flex items-center gap-3 py-5 justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
              <p className="text-xs text-muted-foreground/60">HOLOCRON AI is generating a live operational insight preview for {title}…</p>
            </div>
          )}
          {insightMutation.isError && (
            <p className="text-xs text-red-400 py-4 text-center">Preview failed. Check your AI provider configuration.</p>
          )}
          {!insightMutation.isPending && !insights && !insightMutation.isError && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Brain className="h-7 w-7 text-violet-400/30" />
              <p className="text-xs text-muted-foreground/50">
                Click "Preview AI Capabilities" to see a realistic simulation of what HOLOCRON AI would autonomously detect, analyze, and act on once this module is live.
              </p>
            </div>
          )}
          {insights && <MarkdownText text={insights} />}
        </CardContent>
      </Card>

      {/* Capabilities grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {capabilities.map(group => (
          <Card key={group.group} className="bg-card/60 border-border/40">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">
                {group.group}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {group.items.map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground/70">
                    <CheckCircle2 className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", color)} />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Coming soon banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <Zap className="h-4 w-4 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-300/80">
          This module is being built out. The schema, AI agents, and live data integration are in progress.
          Core capabilities listed above will be available in the next release.
        </p>
      </div>
    </div>
  );
}

export function CloudSecurityPosture() {
  return (
    <SecurityModulePage
      icon={Cloud}
      title="Cloud Security Posture (CSPM)"
      tagline="Multi-Cloud Compliance"
      description="Continuously assess and enforce security configurations across AWS, Azure, and GCP — detecting misconfigurations, scoring against CIS Benchmarks, and alerting on compliance drift before attackers exploit it."
      color="text-sky-400"
      bgColor="bg-sky-500/10"
      borderColor="border-sky-500/20"
      itilPractice="Information Security Management"
      capabilities={[
        {
          group: "Cloud Coverage",
          items: [
            "AWS: EC2, S3, IAM, RDS, VPC, Lambda, EKS, CloudTrail",
            "Azure: Active Directory, Key Vault, NSGs, AKS, Storage Accounts",
            "GCP: GKE, IAM, Firestore, Cloud SQL, VPC Flow Logs",
            "Multi-cloud unified dashboard with cross-account visibility",
          ],
        },
        {
          group: "Compliance Frameworks",
          items: [
            "CIS Benchmarks (AWS, Azure, GCP Level 1 & 2)",
            "NIST SP 800-53 cloud control mappings",
            "SOC 2 Type II cloud control evidence",
            "PCI-DSS cloud workload requirements",
          ],
        },
        {
          group: "Detection & Alerting",
          items: [
            "Real-time misconfiguration detection on resource change events",
            "Drift alerts when a resource moves out of compliant state",
            "CVSS-scored finding prioritization with blast radius analysis",
            "AI-generated remediation scripts (Terraform/CloudFormation)",
          ],
        },
        {
          group: "ITIL Integration",
          items: [
            "Auto-raise ITIL RFC for infrastructure configuration changes",
            "Link findings to Configuration Items in the CMDB",
            "Trigger ITIL incidents for critical misconfigurations",
            "Evidence collection for Change Advisory Board (CAB) reviews",
          ],
        },
      ]}
    />
  );
}

export function EndpointSecurity() {
  return (
    <SecurityModulePage
      icon={HardDrive}
      title="Endpoint Security (EDR)"
      tagline="Detection & Response"
      description="Unified EDR posture view across all managed endpoints — correlate telemetry, triage alerts, quarantine compromised assets, and orchestrate AI-driven response playbooks within the ITIL incident lifecycle."
      color="text-orange-400"
      bgColor="bg-orange-500/10"
      borderColor="border-orange-500/20"
      itilPractice="Information Security Management"
      capabilities={[
        {
          group: "Endpoint Visibility",
          items: [
            "Real-time telemetry from CrowdStrike, SentinelOne, Microsoft Defender",
            "Process tree analysis and parent-child relationship mapping",
            "File integrity monitoring and registry change tracking",
            "Network connections per process with threat intel enrichment",
          ],
        },
        {
          group: "Threat Detection",
          items: [
            "MITRE ATT&CK technique mapping for each alert",
            "Behavioral analytics — baseline deviation detection",
            "Fileless malware and LOLBin attack detection",
            "Lateral movement and privilege escalation pattern recognition",
          ],
        },
        {
          group: "Response Actions",
          items: [
            "One-click asset isolation / quarantine via Holocron probe",
            "Remote process termination and file deletion",
            "Memory dump collection for forensic analysis",
            "AI-generated containment playbooks per attack pattern",
          ],
        },
        {
          group: "ITIL Integration",
          items: [
            "Auto-create P1/P2 security incidents from critical EDR alerts",
            "Quarantine creates ITIL change request with rollback plan",
            "Link affected assets to Configuration Items for impact analysis",
            "Post-incident lessons-learned integration with KEDB",
          ],
        },
      ]}
    />
  );
}

export function SOCOperations() {
  return (
    <SecurityModulePage
      icon={MonitorCheck}
      title="SOC Operations"
      tagline="Analyst Workbench"
      description="AI-augmented Security Operations Centre — prioritised alert queue, threat hunting workbench, playbook execution engine, and live MTTR/MTTD dashboards built on the ITIL incident management process."
      color="text-emerald-400"
      bgColor="bg-emerald-500/10"
      borderColor="border-emerald-500/20"
      itilPractice="Incident Management"
      capabilities={[
        {
          group: "Alert Management",
          items: [
            "Unified alert queue across SIEM, EDR, CSPM, and IDS sources",
            "AI-powered alert correlation and noise reduction (95%+ dedup)",
            "Automated triage: severity scoring, asset criticality weighting",
            "Analyst assignment routing based on skill set and availability",
          ],
        },
        {
          group: "Threat Hunting",
          items: [
            "MITRE ATT&CK-aligned hunting hypotheses library",
            "Natural language hunt queries via Holocron AI Agent Chat",
            "Saved hunt templates with scheduled execution support",
            "Cross-source pivoting: IP → host → user → timeline",
          ],
        },
        {
          group: "Playbook Engine",
          items: [
            "No-code playbook builder with conditional branching",
            "Auto-execution for Tier 1 alert categories",
            "Human approval gates for destructive actions (quarantine, block)",
            "Full audit trail — every action logged for ITIL compliance",
          ],
        },
        {
          group: "Metrics & Reporting",
          items: [
            "Live MTTD (Mean Time to Detect) and MTTR dashboards",
            "SLA breach alerting for incident response timeframes",
            "Analyst performance metrics and shift handover reports",
            "Weekly SOC health report auto-generated by AI agent",
          ],
        },
      ]}
    />
  );
}

export function SecurityIncidents() {
  return (
    <SecurityModulePage
      icon={Siren}
      title="Security Incidents"
      tagline="ITIL IR Process"
      description="ITIL-aligned security incident response lifecycle — from initial detection through containment, eradication, and recovery to post-incident review. Separate from operational incidents with security-specific workflows and classification."
      color="text-red-400"
      bgColor="bg-red-500/10"
      borderColor="border-red-500/20"
      itilPractice="Incident Management (Security)"
      capabilities={[
        {
          group: "Incident Lifecycle",
          items: [
            "Detection → Triage → Containment → Eradication → Recovery → PIR",
            "Security-specific incident classification (BIA, data breach, ransomware)",
            "Parallel workstream tracking — containment while investigating",
            "Regulatory notification timeline management (GDPR 72h, NIS2)",
          ],
        },
        {
          group: "Containment & Eradication",
          items: [
            "Asset isolation workflows integrated with EDR and network controls",
            "Evidence preservation procedures with chain-of-custody tracking",
            "Malware removal checklists per family (ransomware, RAT, wiper)",
            "Credential reset workflows tied to IAM Governance module",
          ],
        },
        {
          group: "Communication",
          items: [
            "Stakeholder notification templates (Exec, Legal, Regulator, Customer)",
            "War room collaboration with timestamped action log",
            "Automated status updates to incident bridge participants",
            "Media/PR holding statement generation via AI agent",
          ],
        },
        {
          group: "Post-Incident Review",
          items: [
            "Structured lessons-learned questionnaire (5 Whys + ITIL format)",
            "Automatic KEDB entry creation for newly identified attack patterns",
            "CSI Register integration — improvement actions tracked to completion",
            "Threat intel feedback loop — new IOCs extracted and submitted to feeds",
          ],
        },
      ]}
    />
  );
}

export function IAMGovernance() {
  return (
    <SecurityModulePage
      icon={KeyRound}
      title="IAM Governance"
      tagline="Identity & Access"
      description="Continuous access governance — periodic access reviews, privilege audit, Privileged Access Management (PAM) policy enforcement, service account lifecycle, and orphaned account detection across all directories."
      color="text-yellow-400"
      bgColor="bg-yellow-500/10"
      borderColor="border-yellow-500/20"
      itilPractice="Access Management"
      capabilities={[
        {
          group: "Access Reviews",
          items: [
            "Quarterly access certification campaigns with manager sign-off",
            "Role mining and Segregation of Duties (SoD) conflict detection",
            "Just-in-time (JIT) elevated access with auto-expiry enforcement",
            "Birthright entitlement model — automated provisioning on role change",
          ],
        },
        {
          group: "Privileged Access",
          items: [
            "PAM policy enforcement — vault integration (CyberArk, HashiCorp)",
            "Privileged session recording with keystroke logging for audit",
            "Break-glass emergency access workflow with ITIL change request",
            "Least-privilege recommendations generated by AI across all roles",
          ],
        },
        {
          group: "Service Accounts & Secrets",
          items: [
            "Service account lifecycle — creation, rotation, decommission",
            "Secret scanning across code repos, CI pipelines, and cloud configs",
            "API key and token rotation policy enforcement with SLA tracking",
            "Non-human identity (NHI) inventory and risk scoring",
          ],
        },
        {
          group: "Orphan Detection",
          items: [
            "Accounts with no activity > threshold flagged for review",
            "Terminated user residual access detection across all systems",
            "Ghost admin detection in AD, Azure AD, and cloud consoles",
            "Automated disable workflow with ITIL service request raised",
          ],
        },
      ]}
    />
  );
}

export function ComplianceFrameworks() {
  return (
    <SecurityModulePage
      icon={ClipboardCheck}
      title="Compliance Frameworks"
      tagline="Control Assurance"
      description="Unified control framework mapped to NIST CSF, ISO 27001:2022, CIS Controls v8, SOC 2 Type II, DORA, and PCI-DSS — automated evidence collection, gap analysis, and audit readiness scoring."
      color="text-violet-400"
      bgColor="bg-violet-500/10"
      borderColor="border-violet-500/20"
      itilPractice="Information Security Management"
      capabilities={[
        {
          group: "Supported Frameworks",
          items: [
            "NIST CSF 2.0 — Govern, Identify, Protect, Detect, Respond, Recover",
            "ISO 27001:2022 — 93 controls across 4 themes",
            "CIS Controls v8 — 18 control groups, IG1/IG2/IG3 mapping",
            "DORA (Digital Operational Resilience Act) — ICT risk requirements",
          ],
        },
        {
          group: "Control Mapping",
          items: [
            "Unified control library — map once, satisfy many frameworks",
            "Cross-framework gap analysis with prioritised remediation roadmap",
            "Control inheritance from platform features (automated evidence)",
            "Third-party vendor control mapping and risk assessment",
          ],
        },
        {
          group: "Evidence Collection",
          items: [
            "Automated evidence gathering from integrated security tools",
            "AI-generated control narratives from telemetry data",
            "Evidence versioning with auditor-ready export packages",
            "Continuous monitoring — control health status in real-time",
          ],
        },
        {
          group: "Audit Readiness",
          items: [
            "Compliance score dashboard per framework and control domain",
            "Auditor portal — read-only evidence access with sampling support",
            "Finding tracker — map audit observations to remediation tasks",
            "Historical trend — compliance posture over time for board reporting",
          ],
        },
      ]}
    />
  );
}

export function SecurityRiskRegister() {
  return (
    <SecurityModulePage
      icon={AlertTriangle}
      title="Security Risk Register"
      tagline="ITIL Risk Management"
      description="ITIL-aligned security risk lifecycle — identify, assess (likelihood × impact), assign treatment plans, track residual risk, and report to risk committees. Directly linked to threat intelligence and vulnerability findings."
      color="text-red-400"
      bgColor="bg-red-500/10"
      borderColor="border-red-500/20"
      itilPractice="Risk Management"
      capabilities={[
        {
          group: "Risk Identification",
          items: [
            "Threat-model driven risk identification per asset and service",
            "Risk import from vulnerability findings, audit observations, and CSPM",
            "Business impact analysis integration — criticality weighting",
            "Emerging risk feed — AI-suggested risks from threat intelligence",
          ],
        },
        {
          group: "Risk Assessment",
          items: [
            "5×5 likelihood × impact matrix with heat map visualisation",
            "Quantitative risk scoring (FAIR model support)",
            "Inherent vs residual risk tracking after control application",
            "Scenario-based risk analysis with Monte Carlo simulation",
          ],
        },
        {
          group: "Treatment Plans",
          items: [
            "Four treatment options: Mitigate, Accept, Transfer, Avoid",
            "Treatment action linked to ITSM tasks with SLA enforcement",
            "Control recommendation mapped from compliance frameworks",
            "Risk acceptance workflow with management approval and expiry",
          ],
        },
        {
          group: "Reporting",
          items: [
            "Risk committee dashboard — top 10 risks with trend arrows",
            "Board-level risk summary report (auto-generated monthly)",
            "Risk appetite indicator — RAG status vs defined thresholds",
            "Regulatory submission export (DORA ICT risk reporting)",
          ],
        },
      ]}
    />
  );
}

export function DataProtection() {
  return (
    <SecurityModulePage
      icon={FileKey}
      title="Data Protection & DLP"
      tagline="Data Governance"
      description="Data classification posture, encryption coverage across all environments, Data Loss Prevention (DLP) policy management, and breach impact assessment — enforcing GDPR, HIPAA, and PCI-DSS data obligations."
      color="text-teal-400"
      bgColor="bg-teal-500/10"
      borderColor="border-teal-500/20"
      itilPractice="Information Security Management"
      capabilities={[
        {
          group: "Data Classification",
          items: [
            "Automated sensitive data discovery across cloud storage, DBs, and endpoints",
            "Classification labels: Public, Internal, Confidential, Restricted",
            "PII, PCI, PHI pattern detection using ML classifiers",
            "Data map — where sensitive data lives, moves, and who accesses it",
          ],
        },
        {
          group: "Encryption Coverage",
          items: [
            "Encryption-at-rest status across cloud buckets, databases, volumes",
            "TLS version audit — deprecated TLS 1.0/1.1 detection",
            "Certificate inventory with expiry alerting and auto-renewal integration",
            "Key management compliance — HSM usage, rotation schedules",
          ],
        },
        {
          group: "DLP Policy",
          items: [
            "Outbound DLP rules: email, web upload, USB, cloud sync",
            "Shadow IT data transfer detection and blocking",
            "DLP incident queue with user behaviour analytics context",
            "Policy exception workflow with manager approval and audit trail",
          ],
        },
        {
          group: "Breach Readiness",
          items: [
            "Breach impact assessment — scope estimation for notification obligations",
            "GDPR Article 33/34 notification timeline management",
            "Data subjects affected estimation from classification maps",
            "Regulatory notification draft generation via AI agent",
          ],
        },
      ]}
    />
  );
}

export function SecurityAwareness() {
  return (
    <SecurityModulePage
      icon={GraduationCap}
      title="Security Awareness"
      tagline="Human Risk Reduction"
      description="Crew security posture management — training completion tracking, phishing simulation campaigns, behavioural analytics, and AI-personalised learning paths to reduce the human risk factor across all departments."
      color="text-pink-400"
      bgColor="bg-pink-500/10"
      borderColor="border-pink-500/20"
      itilPractice="Information Security Management"
      capabilities={[
        {
          group: "Training Management",
          items: [
            "Role-based training curriculum — crew-specific content paths",
            "Training completion tracking with SLA enforcement per department",
            "Assessment scoring and knowledge retention measurement",
            "AI-personalised remedial content for failing crew members",
          ],
        },
        {
          group: "Phishing Simulations",
          items: [
            "Scheduled campaign management — frequency, template, targeting",
            "60+ phishing templates (spear phish, vishing, QR code, MFA bypass)",
            "Click/report rate analytics per department and individual",
            "Immediate teachable moment training upon phishing link click",
          ],
        },
        {
          group: "Behavioural Analytics",
          items: [
            "Human Risk Score per crew member (aggregate of all signals)",
            "High-risk behaviour patterns: repeat phish clickers, policy violators",
            "Correlated alerts — HR score spike + EDR alert = elevated risk",
            "Peer benchmarking — department vs company vs industry baseline",
          ],
        },
        {
          group: "Reporting",
          items: [
            "Security culture maturity score — board-ready quarterly report",
            "Regulatory compliance evidence — GDPR staff training obligations",
            "Department leaderboard — gamified crew security posture ranking",
            "Trend analysis — risk score improvement over time by department",
          ],
        },
      ]}
    />
  );
}
