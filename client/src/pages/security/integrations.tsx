import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronDown, ChevronRight, CheckCircle2, XCircle, HelpCircle,
  Plug, Save, Loader2, TestTube2, Trash2, AlertTriangle, RefreshCw,
  Shield, Cloud, HardDrive, MonitorCheck, KeyRound, Ticket, FileKey,
  GraduationCap, Crosshair, Lock, PlusCircle, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SuggestedAgentsPanel } from "@/components/security/suggested-agents";

type TestStatus = "untested" | "connected" | "failed";

interface CredField {
  key: string; label: string;
  type?: "text" | "password" | "select" | "textarea";
  options?: string[]; placeholder?: string; required?: boolean;
}

interface IntegrationDef {
  platform: string; displayName: string; vendor: string; category: string;
  description: string; icon: React.ElementType;
  color: string; bg: string; border: string;
  fields: CredField[];
}

const CATALOG: IntegrationDef[] = [
  {
    platform: "crowdstrike", displayName: "CrowdStrike Falcon", vendor: "CrowdStrike", category: "edr",
    description: "AI-native endpoint protection — EDR/XDR, threat intelligence, identity protection.",
    icon: HardDrive, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25",
    fields: [
      { key: "clientId",     label: "Client ID",     type: "text",     placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "cloud",        label: "Cloud Region",  type: "select",   options: ["us-1","us-2","eu-1","us-gov-1"], required: true },
    ],
  },
  {
    platform: "sentinelone", displayName: "SentinelOne", vendor: "SentinelOne", category: "edr",
    description: "Autonomous AI-powered endpoint security with real-time threat detection and response.",
    icon: HardDrive, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/25",
    fields: [
      { key: "apiToken",      label: "API Token",              type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "managementUrl", label: "Management Console URL", type: "text",     placeholder: "https://your-tenant.sentinelone.net", required: true },
    ],
  },
  {
    platform: "defender-endpoint", displayName: "Microsoft Defender for Endpoint", vendor: "Microsoft", category: "edr",
    description: "Enterprise endpoint security platform with threat & vulnerability management.",
    icon: HardDrive, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25",
    fields: [
      { key: "tenantId",     label: "Tenant ID",     type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId",     label: "Client ID",     type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••••••••••••••••••",       required: true },
    ],
  },
  {
    platform: "splunk", displayName: "Splunk Enterprise / Cloud", vendor: "Splunk", category: "siem",
    description: "SIEM and SOAR platform — log aggregation, correlation rules, and automated response.",
    icon: MonitorCheck, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25",
    fields: [
      { key: "host",     label: "Splunk Host",            type: "text",     placeholder: "splunk.corp.com", required: true },
      { key: "port",     label: "Management Port",        type: "text",     placeholder: "8089",            required: true },
      { key: "apiToken", label: "API Token (HEC or REST)",type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "index",    label: "Default Index",          type: "text",     placeholder: "main" },
    ],
  },
  {
    platform: "sentinel", displayName: "Microsoft Sentinel", vendor: "Microsoft", category: "siem",
    description: "Cloud-native SIEM with AI analytics, threat intelligence, and SOAR capabilities.",
    icon: MonitorCheck, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/25",
    fields: [
      { key: "workspaceId",  label: "Workspace ID",  type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "tenantId",     label: "Tenant ID",     type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId",     label: "Client ID",     type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••••••••••••••••••",       required: true },
    ],
  },
  {
    platform: "qradar", displayName: "IBM QRadar", vendor: "IBM", category: "siem",
    description: "Enterprise SIEM with real-time network visibility and security intelligence.",
    icon: MonitorCheck, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/25",
    fields: [
      { key: "consoleHost", label: "Console Host", type: "text",     placeholder: "qradar.corp.com", required: true },
      { key: "secToken",    label: "SEC Token",    type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "port",        label: "Port",         type: "text",     placeholder: "443" },
    ],
  },
  {
    platform: "aws-security-hub", displayName: "AWS Security Hub", vendor: "Amazon Web Services", category: "cloud",
    description: "Centralized security findings from AWS services — GuardDuty, Inspector, Config, Macie.",
    icon: Cloud, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25",
    fields: [
      { key: "accessKeyId",     label: "Access Key ID",     type: "text",     placeholder: "AKIAIOSFODNN7EXAMPLE", required: true },
      { key: "secretAccessKey", label: "Secret Access Key", type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "region",          label: "Primary Region",    type: "text",     placeholder: "eu-west-1", required: true },
    ],
  },
  {
    platform: "azure-defender", displayName: "Azure Defender / CSPM", vendor: "Microsoft", category: "cloud",
    description: "Microsoft Defender for Cloud — CSPM, workload protection, regulatory compliance.",
    icon: Cloud, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25",
    fields: [
      { key: "tenantId",       label: "Tenant ID",       type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId",       label: "Client ID",       type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientSecret",   label: "Client Secret",   type: "password", placeholder: "••••••••••••••••••••••••••••••••",       required: true },
      { key: "subscriptionId", label: "Subscription ID", type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
    ],
  },
  {
    platform: "gcp-scc", displayName: "Google Cloud Security Command Center", vendor: "Google", category: "cloud",
    description: "GCP's CSPM — vulnerability reports, threat detection, compliance posture.",
    icon: Cloud, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/25",
    fields: [
      { key: "projectId",          label: "Project ID",           type: "text",     placeholder: "my-gcp-project", required: true },
      { key: "serviceAccountJson", label: "Service Account JSON", type: "textarea", placeholder: '{"type":"service_account",...}', required: true },
    ],
  },
  {
    platform: "okta", displayName: "Okta", vendor: "Okta", category: "iam",
    description: "Identity and access management — SSO, MFA, lifecycle management, access reviews.",
    icon: KeyRound, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/25",
    fields: [
      { key: "domain",   label: "Okta Domain", type: "text",     placeholder: "your-org.okta.com",               required: true },
      { key: "apiToken", label: "API Token",   type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
    ],
  },
  {
    platform: "entra-id", displayName: "Microsoft Entra ID (Azure AD)", vendor: "Microsoft", category: "iam",
    description: "Cloud identity platform — conditional access, RBAC, privileged identity management.",
    icon: KeyRound, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25",
    fields: [
      { key: "tenantId",     label: "Tenant ID",     type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId",     label: "Client ID",     type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••••••••••••••••••",       required: true },
    ],
  },
  {
    platform: "cyberark", displayName: "CyberArk PAM", vendor: "CyberArk", category: "iam",
    description: "Privileged access management — vault credentials, session recording, JIT access.",
    icon: Lock, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/25",
    fields: [
      { key: "baseUrl",  label: "Base URL",  type: "text",     placeholder: "https://cyberark.corp.com",         required: true },
      { key: "username", label: "Username",  type: "text",     placeholder: "apiuser@cyberark",                  required: true },
      { key: "password", label: "Password",  type: "password", placeholder: "••••••••••••••••••••••••••••••••",   required: true },
      { key: "appId",    label: "App ID",    type: "text",     placeholder: "HolocronAI",                        required: true },
    ],
  },
  {
    platform: "servicenow", displayName: "ServiceNow ITSM / GRC", vendor: "ServiceNow", category: "itsm",
    description: "ITSM platform — incidents, change management, problem, GRC, and CMDB integration.",
    icon: Ticket, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/25",
    fields: [
      { key: "instanceUrl", label: "Instance URL", type: "text",     placeholder: "https://your-org.service-now.com", required: true },
      { key: "username",    label: "Username",     type: "text",     placeholder: "svc-holocron",                    required: true },
      { key: "password",    label: "Password",     type: "password", placeholder: "••••••••••••••••••••••••••••••••",   required: true },
    ],
  },
  {
    platform: "jira", displayName: "Jira Service Management", vendor: "Atlassian", category: "itsm",
    description: "ITSM and project tracking — create incidents, change requests, and link findings.",
    icon: Ticket, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25",
    fields: [
      { key: "baseUrl",    label: "Base URL",    type: "text",     placeholder: "https://your-org.atlassian.net", required: true },
      { key: "email",      label: "Email",       type: "text",     placeholder: "svc@corp.com",                   required: true },
      { key: "apiToken",   label: "API Token",   type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "projectKey", label: "Project Key", type: "text",     placeholder: "SECOPS" },
    ],
  },
  {
    platform: "purview", displayName: "Microsoft Purview (DLP)", vendor: "Microsoft", category: "dlp",
    description: "Data loss prevention, information protection, and compliance management for M365.",
    icon: FileKey, color: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/25",
    fields: [
      { key: "tenantId",     label: "Tenant ID",     type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientId",     label: "Client ID",     type: "text",     placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "••••••••••••••••••••••••••••••••",       required: true },
    ],
  },
  {
    platform: "zscaler", displayName: "Zscaler DLP", vendor: "Zscaler", category: "dlp",
    description: "Cloud DLP — policy enforcement across web, email, and cloud apps with inline inspection.",
    icon: FileKey, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25",
    fields: [
      { key: "apiKey",    label: "API Key",    type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "cloudName", label: "Cloud Name", type: "text",     placeholder: "zscalertwo.net",                  required: true },
      { key: "username",  label: "Username",   type: "text",     placeholder: "admin@corp.com",                  required: true },
      { key: "password",  label: "Password",   type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
    ],
  },
  {
    platform: "knowbe4", displayName: "KnowBe4", vendor: "KnowBe4", category: "awareness",
    description: "Security awareness training and simulated phishing platform.",
    icon: GraduationCap, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/25",
    fields: [
      { key: "apiToken", label: "API Token", type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "region",   label: "Region",    type: "select",   options: ["US","EU"], required: true },
    ],
  },
  {
    platform: "proofpoint-sat", displayName: "Proofpoint Security Awareness", vendor: "Proofpoint", category: "awareness",
    description: "Adaptive security awareness training with intelligent phishing simulations.",
    icon: GraduationCap, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25",
    fields: [
      { key: "apiKey",  label: "API Key",  type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
      { key: "baseUrl", label: "Base URL", type: "text",     placeholder: "https://api.wombatsecurity.com", required: true },
    ],
  },
  {
    platform: "misp", displayName: "MISP Threat Intelligence", vendor: "MISP Project", category: "threat-intel",
    description: "Open-source threat intelligence platform — IOCs, threat actor profiles, event sharing.",
    icon: Crosshair, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25",
    fields: [
      { key: "url",    label: "MISP URL", type: "text",     placeholder: "https://misp.corp.com", required: true },
      { key: "apiKey", label: "API Key",  type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
    ],
  },
  {
    platform: "virustotal", displayName: "VirusTotal", vendor: "Google", category: "threat-intel",
    description: "Cloud-based malware and IOC analysis — files, URLs, IP addresses, domains.",
    icon: Crosshair, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
    ],
  },
  {
    platform: "shodan", displayName: "Shodan", vendor: "Shodan", category: "threat-intel",
    description: "Internet-connected device intelligence — external attack surface discovery.",
    icon: Crosshair, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "••••••••••••••••••••••••••••••••", required: true },
    ],
  },
];

const CATALOG_MAP = Object.fromEntries(CATALOG.map(d => [d.platform, d]));

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType }> = {
  all:          { label: "All",         icon: Plug },
  edr:          { label: "Endpoint",    icon: HardDrive },
  siem:         { label: "SIEM",        icon: MonitorCheck },
  cloud:        { label: "Cloud/CSPM",  icon: Cloud },
  iam:          { label: "IAM/PAM",     icon: KeyRound },
  itsm:         { label: "ITSM",        icon: Ticket },
  dlp:          { label: "DLP",         icon: FileKey },
  awareness:    { label: "Awareness",   icon: GraduationCap },
  "threat-intel":{ label: "Threat Intel",icon: Crosshair },
};

const STATUS_CONFIG: Record<TestStatus, { label: string; icon: React.ElementType; cls: string }> = {
  untested:  { label: "Untested",  icon: HelpCircle,   cls: "bg-muted/20 text-muted-foreground border-border/40" },
  connected: { label: "Connected", icon: CheckCircle2, cls: "bg-green-500/15 text-green-400 border-green-500/25" },
  failed:    { label: "Failed",    icon: XCircle,      cls: "bg-red-500/15 text-red-400 border-red-500/25" },
};

function IntegrationCard({
  def, saved, defaultExpanded = false, onSaveSuccess,
}: {
  def: IntegrationDef; saved?: any; defaultExpanded?: boolean; onSaveSuccess?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [enabled, setEnabled] = useState(saved?.enabled ?? false);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    def.fields.forEach(f => { init[f.key] = saved?.credentials?.[f.key] ?? ""; });
    return init;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PUT", `/api/security/integrations/${def.platform}`, {
        category: def.category, displayName: def.displayName, enabled, credentials: fields,
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/integrations"] });
      toast({ title: "Credentials saved", description: `${def.displayName} configuration saved securely` });
      onSaveSuccess?.();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", `/api/security/integrations/${def.platform}/test`, {});
      return r.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/integrations"] });
      if (data.testStatus === "connected") {
        toast({ title: "Connection successful", description: `${def.displayName} is reachable and authenticated` });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("DELETE", `/api/security/integrations/${def.platform}`, undefined);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/integrations"] });
      toast({ title: "Integration removed", description: `${def.displayName} credentials deleted` });
    },
  });

  const status: TestStatus = saved?.testStatus ?? "untested";
  const StatusIcon = STATUS_CONFIG[status].icon;
  const isSaved = !!saved;
  const hasFields = def.fields.some(f => fields[f.key]?.trim());

  return (
    <Card className={cn("border transition-all duration-200", def.border, expanded ? def.bg : "bg-card/60")}>
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border", def.bg, def.border)}>
            <def.icon className={cn("h-4 w-4", def.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-foreground">{def.displayName}</span>
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border flex items-center gap-1", STATUS_CONFIG[status].cls)}>
                <StatusIcon className="h-2.5 w-2.5" />{STATUS_CONFIG[status].label}
              </Badge>
              {isSaved && enabled && (
                <Badge className="text-[9px] px-1.5 py-0 bg-primary/15 text-primary border-primary/20 border">Active</Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{def.vendor} · {def.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSaved && (
              <Switch
                checked={enabled}
                onCheckedChange={(v) => {
                  setEnabled(v);
                  apiRequest("PUT", `/api/security/integrations/${def.platform}`, {
                    category: def.category, displayName: def.displayName, enabled: v, credentials: fields,
                  }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/security/integrations"] }));
                }}
                data-testid={`switch-${def.platform}`}
              />
            )}
            <Button
              size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(e => !e)}
              data-testid={`button-expand-${def.platform}`}
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {expanded && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="border-t border-border/30 pt-3 mt-1 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {def.fields.map(f => (
                <div key={f.key} className={cn("space-y-1", f.type === "textarea" ? "sm:col-span-2" : "")}>
                  <Label className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wide">
                    {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                  </Label>
                  {f.type === "select" ? (
                    <select
                      className="w-full h-8 text-xs bg-background border border-border/40 rounded-md px-2 text-foreground"
                      value={fields[f.key] || ""}
                      onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      data-testid={`select-${def.platform}-${f.key}`}
                    >
                      <option value="">Select…</option>
                      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      className="w-full text-xs bg-background border border-border/40 rounded-md px-3 py-2 text-foreground min-h-[80px] resize-y font-mono"
                      placeholder={f.placeholder}
                      value={fields[f.key] || ""}
                      onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      data-testid={`textarea-${def.platform}-${f.key}`}
                    />
                  ) : (
                    <Input
                      type={f.type === "password" ? "password" : "text"}
                      className="h-8 text-xs bg-background border-border/40"
                      placeholder={f.placeholder}
                      value={fields[f.key] || ""}
                      onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      data-testid={`input-${def.platform}-${f.key}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <Button
                size="sm" className="h-7 text-xs gap-1.5"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hasFields}
                data-testid={`button-save-${def.platform}`}
              >
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save Credentials
              </Button>
              {isSaved && (
                <Button
                  size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                  data-testid={`button-test-${def.platform}`}
                >
                  {testMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <TestTube2 className="h-3 w-3" />}
                  Test Connection
                </Button>
              )}
              {isSaved && (
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs gap-1.5 text-red-400 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${def.platform}`}
                >
                  {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Remove
                </Button>
              )}
              {isSaved && saved?.lastTestedAt && (
                <span className="text-[10px] text-muted-foreground/40 ml-auto">
                  Last tested: {new Date(saved.lastTestedAt).toLocaleString()}
                </span>
              )}
            </div>

            <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-300/80">
                Credentials are stored encrypted server-side and never returned in plaintext. Use a dedicated service account with least-privilege scopes.
              </p>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function AddIntegrationDialog({
  open, onOpenChange, configuredPlatforms, onSelect,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  configuredPlatforms: Set<string>; onSelect: (platform: string) => void;
}) {
  const [search, setSearch] = useState("");
  const available = CATALOG.filter(d =>
    !configuredPlatforms.has(d.platform) &&
    (d.displayName.toLowerCase().includes(search.toLowerCase()) ||
     d.vendor.toLowerCase().includes(search.toLowerCase()) ||
     d.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-primary" /> Add Integration
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select a platform to configure. Only platforms not yet added are shown.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground/50" />
          <Input
            className="pl-8 h-8 text-xs bg-background"
            placeholder="Search platforms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-search-catalog"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
          {available.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground/50">
              {configuredPlatforms.size === CATALOG.length
                ? "All available platforms are already configured."
                : "No platforms match your search."}
            </div>
          ) : (
            available.map(d => {
              const catMeta = CATEGORY_META[d.category];
              return (
                <button
                  key={d.platform}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/40 transition-colors text-left border border-transparent hover:border-border/30"
                  onClick={() => { onSelect(d.platform); onOpenChange(false); }}
                  data-testid={`catalog-item-${d.platform}`}
                >
                  <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0 border", d.bg, d.border)}>
                    <d.icon className={cn("h-3.5 w-3.5", d.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.displayName}</p>
                    <p className="text-[10px] text-muted-foreground/50 truncate">{d.vendor}</p>
                  </div>
                  {catMeta && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0 border-border/40 text-muted-foreground">
                      {catMeta.label}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SecurityIntegrations() {
  const [activeTab, setActiveTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);

  const { data: savedList = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/security/integrations"],
  });

  const savedMap = Object.fromEntries(savedList.map(s => [s.platform, s]));
  const configuredPlatforms = new Set(savedList.map(s => s.platform));

  const connectedCount = savedList.filter(s => s.testStatus === "connected").length;
  const failedCount = savedList.filter(s => s.testStatus === "failed").length;

  const activeSavedCategories = new Set(savedList.map(s => s.category));
  const tabs = ["all", ...Array.from(activeSavedCategories)].filter((v, i, a) => a.indexOf(v) === i);

  const displayedSaved = activeTab === "all"
    ? savedList
    : savedList.filter(s => s.category === activeTab);

  const hasPending = pendingPlatform && !configuredPlatforms.has(pendingPlatform);
  const pendingDef = pendingPlatform ? CATALOG_MAP[pendingPlatform] : null;
  const pendingMatchesTab = pendingDef
    ? (activeTab === "all" || pendingDef.category === activeTab)
    : false;

  return (
    <div className="flex flex-col gap-5 p-5 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-3 flex-1 min-w-0">
          <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary">Centralized Security Integration Hub</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Configure real API credentials for each security platform. Once connected, action buttons across all security dashboards call live APIs — quarantine endpoints, raise RFCs, revoke access, block DLP violations, and more.
            </p>
          </div>
        </div>
        <Button
          className="gap-2 shrink-0"
          onClick={() => setDialogOpen(true)}
          data-testid="button-add-integration"
        >
          <PlusCircle className="h-4 w-4" /> Add Integration
        </Button>
      </div>

      {/* KPI cards — only from API data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Configured",      value: savedList.length,  color: "text-primary",   icon: Plug },
          { label: "Connected",        value: connectedCount,    color: "text-green-400", icon: CheckCircle2 },
          { label: "Untested",         value: savedList.filter(s => s.testStatus === "untested").length, color: "text-muted-foreground", icon: HelpCircle },
          { label: "Failed / Broken",  value: failedCount,       color: "text-red-400",   icon: XCircle },
        ].map(k => (
          <Card key={k.label} className="bg-card/60 border-border/40">
            <CardContent className="p-3 flex items-center gap-3">
              <k.icon className={cn("h-5 w-5 shrink-0", k.color)} />
              <div>
                <p className={cn("text-xl font-black", k.color)}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground/60">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading configured integrations…</span>
        </div>
      ) : savedList.length === 0 && !hasPending ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Plug className="h-8 w-8 text-primary/60" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No integrations configured</p>
            <p className="text-sm text-muted-foreground/60 mt-1 max-w-sm">
              Add your first integration to start connecting real security platforms. Credentials are stored securely server-side.
            </p>
          </div>
          <Button className="gap-2 mt-2" onClick={() => setDialogOpen(true)} data-testid="button-add-first-integration">
            <PlusCircle className="h-4 w-4" /> Add First Integration
          </Button>
        </div>
      ) : (
        <>
          <SuggestedAgentsPanel module="integrations" />

          {/* Category tabs — only show tabs for categories that have saved integrations */}
          {tabs.length > 1 && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-auto flex-wrap gap-1 bg-card/60 border border-border/40 p-1">
                {tabs.map(catId => {
                  const meta = CATEGORY_META[catId] ?? { label: catId, icon: Plug };
                  const count = catId === "all" ? savedList.length : savedList.filter(s => s.category === catId).length;
                  const catConnected = (catId === "all" ? savedList : savedList.filter(s => s.category === catId))
                    .filter(s => s.testStatus === "connected").length;
                  return (
                    <TabsTrigger
                      key={catId} value={catId}
                      className="h-7 text-[10px] gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      data-testid={`tab-${catId}`}
                    >
                      <meta.icon className="h-3 w-3" />
                      {meta.label}
                      <span className="text-[9px] opacity-60">({count})</span>
                      {catConnected > 0 && <span className="h-1.5 w-1.5 rounded-full bg-green-400" />}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          )}

          {/* Integration cards — only from API data */}
          <div className="grid grid-cols-1 gap-3">
            {/* Pending (newly added, not yet saved) card */}
            {hasPending && pendingDef && pendingMatchesTab && (
              <IntegrationCard
                key={`pending-${pendingPlatform}`}
                def={pendingDef}
                defaultExpanded
                onSaveSuccess={() => setPendingPlatform(null)}
              />
            )}

            {displayedSaved.map(saved => {
              const def = CATALOG_MAP[saved.platform];
              if (!def) return null;
              return (
                <IntegrationCard
                  key={saved.platform}
                  def={def}
                  saved={saved}
                />
              );
            })}

            {displayedSaved.length === 0 && !(hasPending && pendingMatchesTab) && (
              <div className="text-center py-10 text-xs text-muted-foreground/50">
                No integrations configured in this category.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="rounded-xl border border-border/30 bg-card/40 p-4">
            <p className="text-xs text-muted-foreground/50 font-medium mb-2 flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> How integrations work
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] text-muted-foreground/50">
              <div><span className="text-foreground/70 font-medium">1. Configure</span> — Add a platform and enter credentials. Each field is validated and stored server-side only.</div>
              <div><span className="text-foreground/70 font-medium">2. Test</span> — Click "Test Connection" to verify authentication. Status updates to Connected or Failed.</div>
              <div><span className="text-foreground/70 font-medium">3. Activate</span> — Enable the toggle. Action buttons across all security dashboards will call real APIs instead of simulated responses.</div>
            </div>
          </div>
        </>
      )}

      <AddIntegrationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        configuredPlatforms={configuredPlatforms}
        onSelect={(platform) => {
          setPendingPlatform(platform);
          const def = CATALOG_MAP[platform];
          if (def && activeTab !== "all" && activeTab !== def.category) {
            setActiveTab("all");
          }
        }}
      />
    </div>
  );
}
