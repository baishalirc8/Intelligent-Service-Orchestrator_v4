import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ScrollText, Plus, Trash2, RefreshCw, Search, Activity, Server,
  Globe, Bot, Database, ExternalLink, ChevronDown, ChevronRight,
  Wifi, WifiOff, AlertTriangle, CheckCircle, Sparkles, Shield,
  Clock, FileText, Filter, Zap, Upload, ChevronLeft, Monitor,
  Box, Layers, Cloud, Network, Lock, Eye, EyeOff
} from "lucide-react";
import { SiNginx, SiApache, SiDocker, SiKubernetes, SiPostgresql, SiSplunk, SiElasticsearch, SiDatadog, SiGrafana, SiAmazon, SiCisco, SiLinux } from "react-icons/si";
import type { LogSource, LogEntry, LogRetentionPolicy } from "@shared/schema";

const LEVEL_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  debug:    { label: "DEBUG",    color: "text-gray-400",       bg: "bg-gray-400/10",    border: "border-gray-400/20" },
  info:     { label: "INFO",     color: "text-blue-400",       bg: "bg-blue-400/10",    border: "border-blue-400/20" },
  warn:     { label: "WARN",     color: "text-amber-400",      bg: "bg-amber-400/10",   border: "border-amber-400/20" },
  error:    { label: "ERROR",    color: "text-red-400",        bg: "bg-red-400/10",     border: "border-red-400/20" },
  critical: { label: "CRITICAL", color: "text-red-300 font-bold", bg: "bg-red-500/15", border: "border-red-400/30" },
};

const SOURCE_TYPE_META: Record<string, { label: string; icon: any; mode: "standalone" | "external" }> = {
  api:           { label: "REST API",       icon: Globe,        mode: "standalone" },
  agent:         { label: "Probe Agent",    icon: Bot,          mode: "standalone" },
  syslog:        { label: "Syslog",         icon: Server,       mode: "standalone" },
  splunk:        { label: "Splunk",         icon: Activity,     mode: "external" },
  elasticsearch: { label: "Elasticsearch", icon: Database,     mode: "external" },
  datadog:       { label: "Datadog",        icon: Activity,     mode: "external" },
  loki:          { label: "Grafana Loki",   icon: FileText,     mode: "external" },
};

const TIME_RANGES = [
  { label: "Last 1 hour",   value: "1h",  ms: 3600000 },
  { label: "Last 6 hours",  value: "6h",  ms: 21600000 },
  { label: "Last 24 hours", value: "24h", ms: 86400000 },
  { label: "Last 7 days",   value: "7d",  ms: 604800000 },
  { label: "Last 30 days",  value: "30d", ms: 2592000000 },
  { label: "All time",      value: "all", ms: 0 },
];

function LevelBadge({ level }: { level: string }) {
  const meta = LEVEL_META[level] ?? LEVEL_META.info;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider border ${meta.color} ${meta.bg} ${meta.border}`}>
      {meta.label}
    </span>
  );
}

function fmtTs(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

// ── Source Catalog ────────────────────────────────────────────────────────────
type SourceTemplate = {
  id: string; label: string; description: string; type: string; mode: "standalone" | "external";
  icon: React.ReactNode; defaultName: string;
};

const SOURCE_CATALOG: SourceTemplate[] = [
  // ── Standalone ──
  { id: "nginx",      label: "nginx",             description: "Web server access & error logs",       type: "syslog",        mode: "standalone", icon: <SiNginx className="h-5 w-5 text-green-400" />,      defaultName: "nginx Logs" },
  { id: "apache",     label: "Apache HTTP",        description: "Apache access & error logs",           type: "syslog",        mode: "standalone", icon: <SiApache className="h-5 w-5 text-orange-400" />,     defaultName: "Apache Logs" },
  { id: "linux",      label: "Linux Syslog",       description: "Linux syslog / journald output",       type: "syslog",        mode: "standalone", icon: <SiLinux className="h-5 w-5 text-yellow-300" />,      defaultName: "Linux Syslog" },
  { id: "windows",    label: "Windows Event",      description: "Windows Event Log via probe agent",    type: "agent",         mode: "standalone", icon: <Monitor className="h-5 w-5 text-blue-400" />,        defaultName: "Windows Event Log" },
  { id: "docker",     label: "Docker",             description: "Container logs via probe agent",       type: "agent",         mode: "standalone", icon: <SiDocker className="h-5 w-5 text-sky-400" />,        defaultName: "Docker Container Logs" },
  { id: "kubernetes", label: "Kubernetes",         description: "Pod & cluster logs via webhook",       type: "api",           mode: "standalone", icon: <SiKubernetes className="h-5 w-5 text-blue-500" />,   defaultName: "Kubernetes Pod Logs" },
  { id: "postgres",   label: "PostgreSQL",         description: "Database logs via probe agent",        type: "agent",         mode: "standalone", icon: <SiPostgresql className="h-5 w-5 text-blue-300" />,   defaultName: "PostgreSQL Logs" },
  { id: "aws",        label: "AWS CloudTrail",     description: "AWS audit trail via webhook",          type: "api",           mode: "standalone", icon: <SiAmazon className="h-5 w-5 text-amber-400" />,      defaultName: "AWS CloudTrail" },
  { id: "cisco",      label: "Cisco IOS/NX-OS",    description: "Network device syslog",                type: "syslog",        mode: "standalone", icon: <SiCisco className="h-5 w-5 text-blue-400" />,        defaultName: "Cisco Network Logs" },
  { id: "custom-api", label: "Custom API / App",   description: "Any HTTP-based log source",            type: "api",           mode: "standalone", icon: <Globe className="h-5 w-5 text-muted-foreground" />,  defaultName: "Custom API Source" },
  // ── External ──
  { id: "splunk",     label: "Splunk",             description: "Pull logs from Splunk instance",       type: "splunk",        mode: "external",   icon: <SiSplunk className="h-5 w-5 text-orange-400" />,     defaultName: "Splunk" },
  { id: "elastic",    label: "Elasticsearch",      description: "Pull logs from ELK / OpenSearch",     type: "elasticsearch", mode: "external",   icon: <SiElasticsearch className="h-5 w-5 text-yellow-400" />, defaultName: "Elasticsearch" },
  { id: "datadog",    label: "Datadog",            description: "Pull logs from Datadog platform",      type: "datadog",       mode: "external",   icon: <SiDatadog className="h-5 w-5 text-purple-400" />,    defaultName: "Datadog Logs" },
  { id: "loki",       label: "Grafana Loki",       description: "Pull logs from Grafana Loki",          type: "loki",          mode: "external",   icon: <SiGrafana className="h-5 w-5 text-orange-400" />,    defaultName: "Grafana Loki" },
];

// ── Config field components ───────────────────────────────────────────────────
function PasswordField({ label, value, onChange, placeholder, testId }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; testId?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="relative mt-1">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-9 text-xs"
          data-testid={testId}
        />
        <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShow(!show)}>
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, testId, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; testId?: string; hint?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="mt-1 text-xs" data-testid={testId} />
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Type-specific config forms ────────────────────────────────────────────────
function ConfigFields({ type, config, onChange }: { type: string; config: Record<string, string>; onChange: (k: string, v: string) => void }) {
  const set = (k: string) => (v: string) => onChange(k, v);

  const { data: probes = [] } = useQuery<{ id: string; name: string; status: string; enrolled: boolean }[]>({
    queryKey: ["/api/discovery-probes"],
    enabled: type === "api",
  });
  const activeProbes = probes.filter(p => p.enrolled || p.status === "completed" || p.status === "active");

  if (type === "api") {
    const mode = config.apiMode ?? "push";
    const authType = config.authType ?? "none";
    return (
      <div className="space-y-3">
        {/* Push / Pull toggle */}
        <div>
          <Label className="text-xs">Integration Mode</Label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {[
              { value: "push", label: "Push (receive)", desc: "Your app sends logs directly to HOLOCRON" },
              { value: "pull", label: "Pull (via Probe)", desc: "A deployed probe fetches logs from your API" },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange("apiMode", opt.value)}
                className={`text-left rounded-lg border p-2.5 text-xs transition-all ${mode === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-border"}`}
                data-testid={`btn-api-mode-${opt.value}`}
              >
                <p className="font-semibold">{opt.label}</p>
                <p className="text-[10px] mt-0.5 leading-tight opacity-75">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {mode === "push" && (
          <>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-300">
              <p className="font-semibold mb-1 flex items-center gap-1.5"><Zap className="h-3 w-3" /> Ingest Endpoint</p>
              <code className="font-mono">POST /api/logs/ingest</code>
              <p className="mt-1 text-blue-300/70">Your app POSTs logs here. After saving you'll receive a sourceId to include in each payload for routing.</p>
            </div>
            <PasswordField label="Ingest Key (optional shared secret to validate incoming requests)" value={config.ingestKey ?? ""} onChange={set("ingestKey")} placeholder="Leave blank to accept all authenticated requests" testId="input-ingest-key" />
            <div>
              <Label className="text-xs">Expected Log Format</Label>
              <Select value={config.format ?? "json"} onValueChange={set("format")}>
                <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-log-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON (structured)</SelectItem>
                  <SelectItem value="text">Plain text</SelectItem>
                  <SelectItem value="cef">CEF (Common Event Format)</SelectItem>
                  <SelectItem value="clf">CLF (Common Log Format)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {mode === "pull" && (
          <>
            <div>
              <Label className="text-xs">Assigned Probe</Label>
              <Select value={config.probeId ?? ""} onValueChange={set("probeId")}>
                <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-probe-id">
                  <SelectValue placeholder={activeProbes.length === 0 ? "No active probes available" : "Select a probe…"} />
                </SelectTrigger>
                <SelectContent>
                  {activeProbes.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No enrolled probes found. Deploy a probe via Network Ops → Discovery first.
                    </div>
                  ) : (
                    activeProbes.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-0.5">This probe will poll the endpoint and forward logs to HOLOCRON.</p>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/90">
              <p className="font-semibold flex items-center gap-1.5 mb-1"><Bot className="h-3 w-3" /> Probe-based collection</p>
              <p className="text-amber-300/70">The assigned probe will poll this endpoint on the configured interval and forward collected logs to HOLOCRON. The probe must be enrolled and reachable.</p>
            </div>
            <TextField label="API Endpoint URL" value={config.url ?? ""} onChange={set("url")} placeholder="https://api.yourapp.com/logs" testId="input-api-url" hint="The probe will poll this URL and ship the response to HOLOCRON" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">HTTP Method</Label>
                <Select value={config.method ?? "GET"} onValueChange={set("method")}>
                  <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-api-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Poll Interval</Label>
                <Select value={config.pollInterval ?? "60"} onValueChange={set("pollInterval")}>
                  <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-poll-interval"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">Every 15 seconds</SelectItem>
                    <SelectItem value="30">Every 30 seconds</SelectItem>
                    <SelectItem value="60">Every minute</SelectItem>
                    <SelectItem value="300">Every 5 minutes</SelectItem>
                    <SelectItem value="600">Every 10 minutes</SelectItem>
                    <SelectItem value="3600">Every hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Authentication</Label>
              <Select value={authType} onValueChange={set("authType")}>
                <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-api-auth"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="apiKey">API Key (header)</SelectItem>
                  <SelectItem value="basic">Basic (username/password)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {authType === "bearer" && (
              <PasswordField label="Bearer Token" value={config.token ?? ""} onChange={set("token")} placeholder="Your API bearer token" testId="input-api-bearer" />
            )}
            {authType === "apiKey" && (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Header Name" value={config.apiKeyHeader ?? ""} onChange={set("apiKeyHeader")} placeholder="X-API-Key" testId="input-api-key-header" />
                <PasswordField label="API Key Value" value={config.apiKeyValue ?? ""} onChange={set("apiKeyValue")} testId="input-api-key-value" />
              </div>
            )}
            {authType === "basic" && (
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Username" value={config.username ?? ""} onChange={set("username")} testId="input-api-username" />
                <PasswordField label="Password" value={config.password ?? ""} onChange={set("password")} testId="input-api-password" />
              </div>
            )}

            <TextField label="JSON Path to log entries (optional)" value={config.jsonPath ?? ""} onChange={set("jsonPath")} placeholder="data.logs  or  items  or  events" hint='Leave blank if the response itself is an array of log objects' testId="input-api-jsonpath" />

            <div>
              <Label className="text-xs">Response Log Format</Label>
              <Select value={config.format ?? "json"} onValueChange={set("format")}>
                <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-pull-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON (structured)</SelectItem>
                  <SelectItem value="text">Plain text (one log per line)</SelectItem>
                  <SelectItem value="cef">CEF (Common Event Format)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    );
  }

  if (type === "agent") return (
    <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-purple-300 space-y-1">
      <p className="font-semibold flex items-center gap-1.5"><Bot className="h-3 w-3" /> Probe Agent Forwarding</p>
      <p className="text-purple-300/70">After saving, copy the sourceId and configure your deployed probe to forward logs using it. The probe will POST to the ingest endpoint automatically.</p>
      <TextField label="Log Path (optional — for agent to monitor)" value={config.logPath ?? ""} onChange={set("logPath")} placeholder="/var/log/app/*.log" testId="input-log-path" />
    </div>
  );

  if (type === "syslog") return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Protocol</Label>
          <Select value={config.protocol ?? "UDP"} onValueChange={set("protocol")}>
            <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-syslog-protocol"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UDP">UDP</SelectItem>
              <SelectItem value="TCP">TCP</SelectItem>
              <SelectItem value="TLS">TLS (TCP)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <TextField label="Port" value={config.port ?? "514"} onChange={set("port")} placeholder="514" testId="input-syslog-port" />
      </div>
      <div>
        <Label className="text-xs">Syslog Format</Label>
        <Select value={config.format ?? "auto"} onValueChange={set("format")}>
          <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-syslog-format"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto-detect</SelectItem>
            <SelectItem value="RFC3164">RFC 3164 (BSD syslog)</SelectItem>
            <SelectItem value="RFC5424">RFC 5424 (modern)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-amber-300/80">
        Configure your device to forward syslog to this host on the specified port.
      </div>
    </div>
  );

  if (type === "splunk") return (
    <div className="space-y-3">
      <TextField label="Splunk URL" value={config.url ?? ""} onChange={set("url")} placeholder="https://your-splunk.example.com:8089" testId="input-splunk-url" />
      <PasswordField label="HEC / API Token" value={config.token ?? ""} onChange={set("token")} placeholder="Splunk authentication token" testId="input-splunk-token" />
      <TextField label="Index" value={config.index ?? ""} onChange={set("index")} placeholder="main  or  *" hint="Leave blank to search all indexes" testId="input-splunk-index" />
      <TextField label="Source Type Filter (optional)" value={config.sourceType ?? ""} onChange={set("sourceType")} placeholder="e.g. access_combined" testId="input-splunk-sourcetype" />
    </div>
  );

  if (type === "elasticsearch") return (
    <div className="space-y-3">
      <TextField label="Elasticsearch URL" value={config.url ?? ""} onChange={set("url")} placeholder="https://your-cluster:9200" testId="input-es-url" />
      <div>
        <Label className="text-xs">Authentication Method</Label>
        <Select value={config.authType ?? "apiKey"} onValueChange={set("authType")}>
          <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-es-auth"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="apiKey">API Key</SelectItem>
            <SelectItem value="basic">Username / Password</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(config.authType ?? "apiKey") === "apiKey" ? (
        <PasswordField label="API Key" value={config.apiKey ?? ""} onChange={set("apiKey")} placeholder="base64-encoded API key" testId="input-es-apikey" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Username" value={config.username ?? ""} onChange={set("username")} placeholder="elastic" testId="input-es-user" />
          <PasswordField label="Password" value={config.password ?? ""} onChange={set("password")} testId="input-es-pass" />
        </div>
      )}
      <TextField label="Index Pattern" value={config.indexPattern ?? ""} onChange={set("indexPattern")} placeholder="logs-*" hint="Supports wildcards" testId="input-es-index" />
      <TextField label="Timestamp Field" value={config.timeField ?? ""} onChange={set("timeField")} placeholder="@timestamp" testId="input-es-timefield" />
    </div>
  );

  if (type === "datadog") return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Datadog Site</Label>
        <Select value={config.site ?? "datadoghq.com"} onValueChange={set("site")}>
          <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-dd-site"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="datadoghq.com">US1 (datadoghq.com)</SelectItem>
            <SelectItem value="us3.datadoghq.com">US3 (us3.datadoghq.com)</SelectItem>
            <SelectItem value="us5.datadoghq.com">US5 (us5.datadoghq.com)</SelectItem>
            <SelectItem value="datadoghq.eu">EU (datadoghq.eu)</SelectItem>
            <SelectItem value="ap1.datadoghq.com">AP1 (ap1.datadoghq.com)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PasswordField label="API Key" value={config.apiKey ?? ""} onChange={set("apiKey")} placeholder="dd API key" testId="input-dd-apikey" />
      <PasswordField label="Application Key" value={config.appKey ?? ""} onChange={set("appKey")} placeholder="dd App key" testId="input-dd-appkey" />
      <TextField label="Log Query Filter (optional)" value={config.query ?? ""} onChange={set("query")} placeholder='e.g. service:api status:error' hint="Datadog log query syntax" testId="input-dd-query" />
    </div>
  );

  if (type === "loki") return (
    <div className="space-y-3">
      <TextField label="Loki URL" value={config.url ?? ""} onChange={set("url")} placeholder="http://loki.example.com:3100" testId="input-loki-url" />
      <div>
        <Label className="text-xs">Authentication</Label>
        <Select value={config.authType ?? "none"} onValueChange={set("authType")}>
          <SelectTrigger className="mt-1 text-xs h-8" data-testid="select-loki-auth"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="basic">Basic (username/password)</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {config.authType === "basic" && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Username" value={config.username ?? ""} onChange={set("username")} testId="input-loki-user" />
          <PasswordField label="Password" value={config.password ?? ""} onChange={set("password")} testId="input-loki-pass" />
        </div>
      )}
      {config.authType === "bearer" && (
        <PasswordField label="Bearer Token" value={config.token ?? ""} onChange={set("token")} testId="input-loki-token" />
      )}
      <TextField label="Labels Filter (optional)" value={config.labelsFilter ?? ""} onChange={set("labelsFilter")} placeholder='{job="app", env="prod"}' hint="LogQL label selector" testId="input-loki-labels" />
    </div>
  );

  return null;
}

// ── Add Source Dialog (two-step wizard) ───────────────────────────────────────
function AddSourceDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"catalog" | "config">("catalog");
  const [template, setTemplate] = useState<SourceTemplate | null>(null);
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => { setStep("catalog"); setTemplate(null); setName(""); setConfig({}); }, 300);
  };

  const handleSelectTemplate = (t: SourceTemplate) => {
    setTemplate(t);
    setName(t.defaultName);
    setConfig({});
    setStep("config");
  };

  const setConfigField = (k: string, v: string) => setConfig(prev => ({ ...prev, [k]: v }));

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/log-sources", {
        name: name.trim(),
        type: template!.type,
        mode: template!.mode,
        config: Object.keys(config).length > 0 ? config : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Source added", description: `${name} is now configured` });
      handleClose();
      onCreated();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const standaloneTemplates = SOURCE_CATALOG.filter(t => t.mode === "standalone");
  const externalTemplates   = SOURCE_CATALOG.filter(t => t.mode === "external");

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" data-testid="button-add-source">
          <Plus className="h-4 w-4" /> Add Source
        </Button>
      </DialogTrigger>

      <DialogContent className={step === "catalog" ? "max-w-2xl" : "max-w-lg"}>
        {/* ── Step 1: Catalog ── */}
        {step === "catalog" && (
          <>
            <DialogHeader>
              <DialogTitle>Choose Log Source</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Select from known integrations — details are pre-populated automatically.</p>
            </DialogHeader>

            <div className="mt-3 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Standalone Sources <span className="normal-case font-normal text-muted-foreground/60">— logs pushed to or collected by HOLOCRON directly</span></p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {standaloneTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className="text-left rounded-lg border border-border/60 bg-card hover:bg-accent/60 hover:border-primary/30 p-3 transition-all duration-150 group"
                      data-testid={`catalog-${t.id}`}
                    >
                      <div className="mb-2">{t.icon}</div>
                      <p className="text-xs font-semibold group-hover:text-primary transition-colors">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">External Integrations <span className="normal-case font-normal text-muted-foreground/60">— logs pulled from existing platforms</span></p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {externalTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTemplate(t)}
                      className="text-left rounded-lg border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-400/40 p-3 transition-all duration-150 group"
                      data-testid={`catalog-${t.id}`}
                    >
                      <div className="mb-2">{t.icon}</div>
                      <p className="text-xs font-semibold group-hover:text-purple-300 transition-colors">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Config ── */}
        {step === "config" && template && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button onClick={() => setStep("catalog")} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-back-catalog">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2">
                  {template.icon}
                  <DialogTitle>{template.label}</DialogTitle>
                </div>
              </div>
              <Badge variant={template.mode === "standalone" ? "outline" : "secondary"} className="w-fit text-[10px] mt-1">
                {template.mode === "standalone" ? "Standalone" : "External Integration"}
              </Badge>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs">Source Name</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={template.defaultName}
                  className="mt-1 text-xs"
                  data-testid="input-source-name"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Give it a name that reflects the environment, e.g. "Production nginx"</p>
              </div>

              <div className="border-t border-border/40 pt-3">
                <ConfigFields type={template.type} config={config} onChange={setConfigField} />
              </div>

              {template.mode === "external" && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-400" />
                  <span>Connection credentials are stored securely and never exposed in the UI.</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
                <Button size="sm" onClick={() => createMutation.mutate()} disabled={!name.trim() || createMutation.isPending} data-testid="button-create-source">
                  {createMutation.isPending ? "Adding..." : "Add Source"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Add Retention Policy Dialog ───────────────────────────────────────────────
function AddRetentionDialog({ sources, onCreated }: { sources: LogSource[]; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState("90");
  const [sourceId, setSourceId] = useState("all");
  const [level, setLevel] = useState("all");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/log-retention-policies", {
        name,
        retentionDays: Number(days),
        sourceId: sourceId === "all" ? null : sourceId,
        level: level === "all" ? null : level,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Policy created" });
      setOpen(false);
      setName(""); setDays("90"); setSourceId("all"); setLevel("all");
      onCreated();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2" data-testid="button-add-policy">
          <Plus className="h-4 w-4" /> Add Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create Retention Policy</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Policy Name</Label>
            <Input placeholder="e.g. 90-day default" value={name} onChange={e => setName(e.target.value)} className="mt-1" data-testid="input-policy-name" />
          </div>
          <div>
            <Label>Retention (days)</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="mt-1" data-testid="select-retention-days"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["7","14","30","60","90","180","365"].map(d => (
                  <SelectItem key={d} value={d}>{d} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Apply to Source</Label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="mt-1" data-testid="select-policy-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Level Filter (optional)</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="mt-1" data-testid="select-policy-level"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {["debug","info","warn","error","critical"].map(l => (
                  <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending} data-testid="button-create-policy">
              {createMutation.isPending ? "Creating..." : "Create Policy"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Log Entry Row ─────────────────────────────────────────────────────────────
function LogRow({ entry, expanded, onToggle }: { entry: LogEntry; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className={`border-b border-border/40 cursor-pointer transition-colors hover:bg-accent/30 ${expanded ? "bg-accent/20" : ""}`}
        onClick={onToggle}
        data-testid={`row-log-${entry.id}`}
      >
        <td className="px-3 py-2 whitespace-nowrap">
          <span className="font-mono text-[11px] text-muted-foreground">{fmtTs(entry.logTimestamp)}</span>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <LevelBadge level={entry.level} />
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <span className="text-xs text-muted-foreground font-mono">{entry.host || "—"}</span>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          <span className="text-xs text-blue-400/80 font-mono">{entry.service || "—"}</span>
        </td>
        <td className="px-3 py-2">
          <span className="text-xs text-foreground/80 line-clamp-1">{entry.message}</span>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-accent/10 border-b border-border/40">
          <td colSpan={6} className="px-4 py-3">
            <div className="space-y-2 text-xs">
              <div className="font-mono text-foreground/90 whitespace-pre-wrap break-all bg-muted/30 rounded p-2 border border-border/40">
                {entry.message}
              </div>
              <div className="flex flex-wrap gap-4 text-muted-foreground">
                {entry.host && <span><span className="text-foreground/50">host:</span> {entry.host}</span>}
                {entry.service && <span><span className="text-foreground/50">service:</span> {entry.service}</span>}
                {entry.sourceId && <span><span className="text-foreground/50">sourceId:</span> {entry.sourceId}</span>}
                {entry.deviceId && <span><span className="text-foreground/50">deviceId:</span> {entry.deviceId}</span>}
                <span><span className="text-foreground/50">ingested:</span> {fmtTs(entry.ingestedAt!)}</span>
              </div>
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                  ))}
                </div>
              )}
              {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                <div className="bg-muted/20 rounded p-2 border border-border/30 font-mono text-[10px] text-muted-foreground">
                  {JSON.stringify(entry.metadata, null, 2)}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LogAggregationPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Filters
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");
  const [sourceId, setSourceId] = useState("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const timeRangeMeta = TIME_RANGES.find(t => t.value === timeRange)!;
  const fromDate = timeRangeMeta.ms > 0 ? new Date(Date.now() - timeRangeMeta.ms) : undefined;

  // Sources
  const { data: sources = [], refetch: refetchSources } = useQuery<LogSource[]>({
    queryKey: ["/api/log-sources"],
  });

  // Logs
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  if (level !== "all") params.set("level", level);
  if (sourceId !== "all") params.set("sourceId", sourceId);
  if (fromDate) params.set("from", fromDate.toISOString());

  const { data: logData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<{
    entries: LogEntry[]; total: number; page: number; pages: number;
  }>({
    queryKey: ["/api/logs", q, level, sourceId, timeRange, page],
    queryFn: async () => {
      const res = await fetch(`/api/logs?${params}`);
      return res.json();
    },
  });

  // Retention policies
  const { data: policies = [], refetch: refetchPolicies } = useQuery<LogRetentionPolicy[]>({
    queryKey: ["/api/log-retention-policies"],
  });

  // Delete source
  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/log-sources/${id}`); return r.json(); },
    onSuccess: () => { toast({ title: "Source removed" }); refetchSources(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Delete policy
  const deletePolicyMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/log-retention-policies/${id}`); return r.json(); },
    onSuccess: () => { toast({ title: "Policy deleted" }); refetchPolicies(); },
  });

  // Purge logs
  const purgeMutation = useMutation({
    mutationFn: async () => { const r = await apiRequest("POST", "/api/logs/purge"); return r.json(); },
    onSuccess: (d: any) => { toast({ title: "Purge complete", description: `${d.purged ?? 0} entries removed` }); refetchLogs(); },
  });

  // Generate sample logs (standalone demo)
  const seedMutation = useMutation({
    mutationFn: async () => {
      const levels = ["debug","info","info","info","warn","warn","error","critical"];
      const services = ["api-gateway","auth-service","db-primary","cache-cluster","monitoring","scheduler"];
      const hosts = ["prod-web-01","prod-web-02","prod-db-01","prod-cache-01","prod-worker-01"];
      const msgs = [
        "Request processed successfully in 142ms",
        "Cache miss on key user:session:abc123 — fetching from DB",
        "Connection pool at 78% capacity",
        "SSL certificate expires in 14 days",
        "Disk usage warning: /var/log at 82%",
        "High memory usage detected: 91% of 16GB",
        "Database query timeout after 30000ms",
        "Failed to connect to upstream: connection refused",
        "CRITICAL: Service health check failed 3 consecutive times",
        "Authentication failure for user admin@corp.com from 203.0.113.45",
      ];
      const batch = Array.from({ length: 50 }, (_, i) => ({
        level: levels[Math.floor(Math.random() * levels.length)],
        message: msgs[Math.floor(Math.random() * msgs.length)],
        host: hosts[Math.floor(Math.random() * hosts.length)],
        service: services[Math.floor(Math.random() * services.length)],
        tags: ["sample","demo"],
        timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      }));
      const r = await apiRequest("POST", "/api/logs/ingest", batch);
      return r.json();
    },
    onSuccess: (d: any) => {
      toast({ title: "Sample logs generated", description: `${d.ingested} entries ingested` });
      refetchLogs();
    },
  });

  // AI analysis
  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await apiRequest("POST", "/api/logs/analyze");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data);
      if (data.fromKnowledgeBase) toast({ title: "Served from Knowledge Base", description: "AI analysis loaded from cache" });
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const standaloneSources = sources.filter(s => s.mode === "standalone");
  const externalSources = sources.filter(s => s.mode === "external");

  const healthScore = analysis?.healthScore ?? null;
  const healthColor = healthScore === null ? "text-muted-foreground" : healthScore >= 80 ? "text-green-400" : healthScore >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/60 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <ScrollText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Log Aggregation</h1>
            <p className="text-xs text-muted-foreground">Standalone ingestion · External integration · AI pattern analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs" data-testid="badge-total-logs">
            <FileText className="h-3 w-3" />
            {logData?.total?.toLocaleString() ?? "—"} entries
          </Badge>
          <Badge variant="outline" className="gap-1.5 text-xs" data-testid="badge-sources-count">
            <Wifi className="h-3 w-3" />
            {sources.length} source{sources.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stream" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-6 pt-3 shrink-0 border-b border-border/40">
          <TabsList className="h-8">
            <TabsTrigger value="stream" className="text-xs gap-1.5 data-[state=active]:bg-background" data-testid="tab-stream">
              <Activity className="h-3 w-3" /> Log Stream
            </TabsTrigger>
            <TabsTrigger value="sources" className="text-xs gap-1.5 data-[state=active]:bg-background" data-testid="tab-sources">
              <Wifi className="h-3 w-3" /> Sources
            </TabsTrigger>
            <TabsTrigger value="retention" className="text-xs gap-1.5 data-[state=active]:bg-background" data-testid="tab-retention">
              <Shield className="h-3 w-3" /> Retention
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs gap-1.5 data-[state=active]:bg-background" data-testid="tab-ai">
              <Sparkles className="h-3 w-3" /> AI Analysis
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Log Stream ─────────────────────────────────────────────────────── */}
        <TabsContent value="stream" className="flex-1 flex flex-col overflow-hidden m-0">
          {/* Filter bar */}
          <div className="px-6 py-3 border-b border-border/30 flex flex-wrap items-center gap-2 shrink-0">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={q}
                onChange={e => { setQ(e.target.value); setPage(1); }}
                className="pl-8 h-8 text-xs"
                data-testid="input-log-search"
              />
            </div>
            <Select value={level} onValueChange={v => { setLevel(v); setPage(1); }}>
              <SelectTrigger className="w-32 h-8 text-xs" data-testid="select-log-level"><SelectValue placeholder="All levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {["debug","info","warn","error","critical"].map(l => (
                  <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceId} onValueChange={v => { setSourceId(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-log-source"><SelectValue placeholder="All sources" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={v => { setTimeRange(v); setPage(1); }}>
              <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-time-range"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => refetchLogs()} data-testid="button-refresh-logs">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-logs">
              <Upload className="h-3 w-3" />
              {seedMutation.isPending ? "Generating..." : "Sample Logs"}
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {logsLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading logs...</div>
            ) : !logData?.entries?.length ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                <ScrollText className="h-8 w-8 opacity-30" />
                <p className="text-sm">No log entries found</p>
                <p className="text-xs opacity-60">Add a source and start ingesting, or click "Sample Logs" to generate demo data</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/40">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-40">Timestamp</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-20">Level</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-32">Host</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-32">Service</th>
                    <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Message</th>
                    <th className="px-3 py-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {logData.entries.map(entry => (
                    <LogRow
                      key={entry.id}
                      entry={entry}
                      expanded={expandedId === entry.id}
                      onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {logData && logData.pages > 1 && (
            <div className="border-t border-border/40 px-6 py-2 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                Page {logData.page} of {logData.pages} — {logData.total.toLocaleString()} total entries
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page">Prev</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPage(p => Math.min(logData.pages, p + 1))} disabled={page === logData.pages} data-testid="button-next-page">Next</Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Sources ────────────────────────────────────────────────────────── */}
        <TabsContent value="sources" className="flex-1 overflow-auto m-0 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Log Sources</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage standalone ingestion endpoints and external integration connectors</p>
              </div>
              <AddSourceDialog onCreated={() => { refetchSources(); qc.invalidateQueries({ queryKey: ["/api/log-sources"] }); }} />
            </div>

            {/* Standalone */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-4 w-4 text-primary/70" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Standalone Sources</h3>
                <Badge variant="secondary" className="text-[10px]">{standaloneSources.length}</Badge>
              </div>
              {standaloneSources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground text-sm">
                  <Server className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No standalone sources yet</p>
                  <p className="text-xs mt-1 opacity-60">Add an API, Probe Agent, or Syslog source to start ingesting logs directly</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {standaloneSources.map(src => {
                    const meta = SOURCE_TYPE_META[src.type];
                    const Icon = meta?.icon ?? Globe;
                    return (
                      <div key={src.id} className="rounded-lg border border-border/60 bg-card p-4 flex items-center gap-4" data-testid={`card-source-${src.id}`}>
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{src.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{meta?.label ?? src.type}</Badge>
                            <span className={`inline-flex items-center gap-1 text-[10px] ${src.status === "active" ? "text-green-400" : "text-red-400"}`}>
                              {src.status === "active" ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
                              {src.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span>{(src.logCount ?? 0).toLocaleString()} entries</span>
                            {src.lastSeen && <span>Last seen: {fmtTs(src.lastSeen)}</span>}
                            <code className="font-mono text-blue-400/70 text-[10px]">sourceId: {src.id.slice(0, 8)}…</code>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => deleteSourceMutation.mutate(src.id)} data-testid={`button-delete-source-${src.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* External */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="h-4 w-4 text-purple-400/70" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">External Integrations</h3>
                <Badge variant="secondary" className="text-[10px]">{externalSources.length}</Badge>
              </div>
              {externalSources.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground text-sm">
                  <ExternalLink className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>No external integrations connected</p>
                  <p className="text-xs mt-1 opacity-60">Connect Splunk, Elasticsearch, Datadog, or Loki to pull logs alongside native entries</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {externalSources.map(src => {
                    const meta = SOURCE_TYPE_META[src.type];
                    const Icon = meta?.icon ?? Globe;
                    return (
                      <div key={src.id} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-4 flex items-center gap-4" data-testid={`card-source-${src.id}`}>
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <Icon className="h-4 w-4 text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{src.name}</span>
                            <Badge className="text-[10px] px-1.5 py-0 bg-purple-500/20 text-purple-300 border-purple-500/30">{meta?.label ?? src.type}</Badge>
                            <span className={`inline-flex items-center gap-1 text-[10px] ${src.status === "active" ? "text-green-400" : "text-red-400"}`}>
                              {src.status === "active" ? <CheckCircle className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
                              {src.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span>{(src.logCount ?? 0).toLocaleString()} entries pulled</span>
                            {src.lastSeen && <span>Last sync: {fmtTs(src.lastSeen)}</span>}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => deleteSourceMutation.mutate(src.id)} data-testid={`button-delete-ext-source-${src.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ingest API reference card */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" /> Direct Ingest API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground">
                <p>Send logs directly to HOLOCRON without any agents or connectors:</p>
                <pre className="bg-muted/40 rounded p-3 font-mono text-[11px] overflow-x-auto border border-border/40 text-foreground/80">{`POST /api/logs/ingest
Content-Type: application/json
Authorization: Bearer <session-token>

// Single entry:
{ "level": "error", "message": "...", "host": "prod-01", "service": "api" }

// Batch array:
[
  { "level": "info",  "message": "...", "host": "prod-01" },
  { "level": "error", "message": "...", "host": "prod-02", "sourceId": "<your-source-id>" }
]`}</pre>
                <p>Supported levels: <code className="font-mono">debug · info · warn · error · critical</code></p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Retention ──────────────────────────────────────────────────────── */}
        <TabsContent value="retention" className="flex-1 overflow-auto m-0 p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Retention Policies</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Define how long log entries are kept before automatic purging. ITIL recommends 90-day minimum for audit compliance.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => purgeMutation.mutate()} disabled={purgeMutation.isPending} data-testid="button-purge-now">
                  <Trash2 className="h-3 w-3" />
                  {purgeMutation.isPending ? "Purging..." : "Purge Now"}
                </Button>
                <AddRetentionDialog sources={sources} onCreated={() => qc.invalidateQueries({ queryKey: ["/api/log-retention-policies"] })} />
              </div>
            </div>

            {/* Default policy notice */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
              <Shield className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold text-blue-300">Default Retention: 90 days</p>
                <p className="text-blue-300/70 mt-0.5">When no policies are defined, all logs are retained for 90 days before purging. Custom policies override this default per source or level.</p>
              </div>
            </div>

            {policies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No custom policies defined</p>
                <p className="text-xs mt-1 opacity-60">The 90-day default applies. Add policies to customise per source or log level.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {policies.map(p => {
                  const src = sources.find(s => s.id === p.sourceId);
                  return (
                    <div key={p.id} className="rounded-lg border border-border/60 bg-card p-4 flex items-center gap-4" data-testid={`card-policy-${p.id}`}>
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                        <Clock className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.name}</span>
                          <Badge variant="outline" className="text-[10px]">{p.retentionDays}d</Badge>
                          {p.level && <Badge variant="secondary" className="text-[10px]">{p.level.toUpperCase()}</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {src ? `Source: ${src.name}` : "All Sources"} · Created {new Date(p.createdAt!).toLocaleDateString()}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => deletePolicyMutation.mutate(p.id)} data-testid={`button-delete-policy-${p.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── AI Analysis ────────────────────────────────────────────────────── */}
        <TabsContent value="ai" className="flex-1 overflow-auto m-0 p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">AI Log Intelligence</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Detect anomalies, recurring patterns, and operational risks using AI analysis of your recent log data.</p>
              </div>
              <Button onClick={runAnalysis} disabled={analyzing} className="gap-2" data-testid="button-run-analysis">
                <Sparkles className="h-4 w-4" />
                {analyzing ? "Analyzing..." : "Run Analysis"}
              </Button>
            </div>

            {!analysis && !analyzing && (
              <div className="rounded-lg border border-dashed border-border/60 p-12 text-center text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No analysis yet</p>
                <p className="text-xs mt-1 opacity-60">Click "Run Analysis" to scan your recent logs for anomalies and patterns</p>
              </div>
            )}

            {analyzing && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-8 text-center">
                <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary animate-pulse" />
                <p className="text-sm text-primary">Scanning log patterns...</p>
              </div>
            )}

            {analysis && (
              <div className="space-y-4">
                {/* KB cache notice */}
                {analysis.fromKnowledgeBase && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-center gap-2 text-xs text-amber-300">
                    <Sparkles className="h-3 w-3" /> Served from Knowledge Base cache — no AI tokens consumed
                  </div>
                )}

                {/* Health score */}
                <div className="rounded-lg border border-border/60 bg-card p-4 flex items-center gap-4">
                  <div className={`text-4xl font-bold font-mono ${healthColor}`} data-testid="text-health-score">
                    {analysis.healthScore ?? "—"}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Log Health Score</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{analysis.summary}</p>
                  </div>
                </div>

                {/* Top Issues */}
                {analysis.topIssues?.length > 0 && (
                  <Card className="border-border/60">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Top Issues</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {analysis.topIssues.map((issue: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-foreground/80" data-testid={`text-issue-${i}`}>
                          <span className="text-amber-400 font-mono mt-0.5">{i + 1}.</span>
                          <span>{issue}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Anomalies */}
                {analysis.anomalies?.length > 0 && (
                  <Card className="border-border/60">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-400" /> Anomalies Detected</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {analysis.anomalies.map((a: any, i: number) => (
                        <div key={i} className="rounded-lg border border-border/40 bg-muted/20 p-3" data-testid={`card-anomaly-${i}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-[10px] px-1.5 py-0 ${
                              a.severity === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                              a.severity === "high" ? "bg-orange-500/20 text-orange-300 border-orange-500/30" :
                              a.severity === "medium" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                              "bg-blue-500/20 text-blue-300 border-blue-500/30"
                            }`}>{a.severity?.toUpperCase()}</Badge>
                            <span className="text-xs font-medium">{a.type}</span>
                          </div>
                          <p className="text-xs text-foreground/80">{a.description}</p>
                          {a.recommendation && <p className="text-xs text-primary/80 mt-1.5">→ {a.recommendation}</p>}
                          {a.affectedHosts?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {a.affectedHosts.map((h: string, j: number) => <Badge key={j} variant="secondary" className="text-[10px]">{h}</Badge>)}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Patterns */}
                {analysis.patterns?.length > 0 && (
                  <Card className="border-border/60">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Filter className="h-4 w-4 text-blue-400" /> Log Patterns</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {analysis.patterns.map((p: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0" data-testid={`row-pattern-${i}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{p.pattern}</span>
                              <Badge variant="secondary" className="text-[10px]">{p.occurrences}x</Badge>
                              <Badge className={`text-[10px] px-1.5 py-0 ${
                                p.risk === "high" ? "bg-red-500/20 text-red-300 border-red-500/30" :
                                p.risk === "medium" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                                "bg-green-500/20 text-green-300 border-green-500/30"
                              }`}>{p.risk} risk</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Recommendations */}
                {analysis.recommendations?.length > 0 && (
                  <Card className="border-border/60">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-400" /> Recommendations</CardTitle></CardHeader>
                    <CardContent className="space-y-1.5">
                      {analysis.recommendations.map((r: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-foreground/80" data-testid={`text-rec-${i}`}>
                          <span className="text-green-400 mt-0.5">✓</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
