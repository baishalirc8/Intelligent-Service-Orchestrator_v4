import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Router, Shield, Server, Wifi, Radio, Cpu, Camera, Thermometer,
  Gauge, MonitorSmartphone, Bot, Network, Globe,
  CheckCircle2, XCircle, HelpCircle, Radar, Loader2,
  HardDrive, Layers, Lock, Bug, Search, ShieldCheck,
  Activity, ArrowLeft, Zap, FileText, Box, ScanSearch, AlertTriangle,
  Clock, Brain, Workflow, Play, ThumbsUp, ThumbsDown, Eye, Wrench, Code,
  ChevronDown, ChevronUp, Trash2, Timer, Database, WifiOff,
  ChevronLeft, ChevronRight, X, RefreshCw, RotateCcw,
  ClipboardList, Building2, TrendingUp, DollarSign, Handshake,
  AlertCircle, CheckCircle, GitCommit, Ticket, FileWarning,
} from "lucide-react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { DiscoveredAsset, DiscoveryProbe, OrgRole, RoleSubscription, RemediationTask } from "@shared/schema";

const typeConfig: Record<string, { label: string; icon: typeof Router; color: string }> = {
  router: { label: "Router", icon: Router, color: "text-blue-400 bg-blue-500/10" },
  switch: { label: "Switch", icon: Network, color: "text-cyan-400 bg-cyan-500/10" },
  firewall: { label: "Firewall", icon: Shield, color: "text-red-400 bg-red-500/10" },
  server: { label: "Server", icon: Server, color: "text-purple-400 bg-purple-500/10" },
  access_point: { label: "Access Point", icon: Wifi, color: "text-green-400 bg-green-500/10" },
  gateway: { label: "Gateway", icon: Globe, color: "text-indigo-400 bg-indigo-500/10" },
  iot_sensor: { label: "IoT Sensor", icon: Radio, color: "text-amber-400 bg-amber-500/10" },
  plc: { label: "PLC", icon: Cpu, color: "text-orange-400 bg-orange-500/10" },
  hvac: { label: "HVAC", icon: Thermometer, color: "text-teal-400 bg-teal-500/10" },
  camera: { label: "Camera", icon: Camera, color: "text-pink-400 bg-pink-500/10" },
  meter: { label: "Meter", icon: Gauge, color: "text-lime-400 bg-lime-500/10" },
};

const protocolLabels: Record<string, string> = {
  snmp_v2c: "SNMP v2c", snmp_v3: "SNMP v3", ssh: "SSH", wmi: "WMI",
  api: "API", lorawan: "LoRaWAN", bacnet: "BACnet", modbus: "Modbus",
  mqtt: "MQTT", http: "HTTP",
};

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2; label: string }> = {
  online: { color: "text-green-400", icon: CheckCircle2, label: "Online" },
  offline: { color: "text-red-400", icon: XCircle, label: "Offline" },
  unknown: { color: "text-muted-foreground", icon: HelpCircle, label: "Unknown" },
};

function DetailField({ label, value }: { label: string; value: string | number | boolean | undefined | null }) {
  if (value === undefined || value === null) return null;
  return (
    <div data-testid={`detail-${label.toLowerCase().replace(/[\s/]+/g, "-")}`}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className="text-xs font-medium mt-0.5">{typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}</p>
    </div>
  );
}

function InstalledAppsCard({ installedApps, scannedAt, assetId, isScanRunning }: { installedApps: any[]; scannedAt?: string; assetId?: string; isScanRunning?: boolean }) {
  const [appSearch, setAppSearch] = useState("");
  const [appSort, setAppSort] = useState<"name" | "publisher" | "size">("name");
  const { toast } = useToast();
  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/discovered-assets/${assetId}/request-software-scan`);
      return res.json();
    },
    onSuccess: () => toast({ title: "Scan requested", description: "The probe will collect software inventory on its next heartbeat (within 2 min)" }),
    onError: () => toast({ title: "Request failed", variant: "destructive" }),
  });
  const filtered = installedApps
    .filter((a: any) => !appSearch || a.name?.toLowerCase().includes(appSearch.toLowerCase()) || a.publisher?.toLowerCase().includes(appSearch.toLowerCase()))
    .sort((a: any, b: any) => {
      if (appSort === "name") return (a.name || "").localeCompare(b.name || "");
      if (appSort === "publisher") return (a.publisher || "").localeCompare(b.publisher || "");
      return (b.sizeMB || 0) - (a.sizeMB || 0);
    });
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <SectionTitle icon={Box} title="Installed Software" count={installedApps.length} />
          <div className="flex items-center gap-2">
            {installedApps.length > 0 && (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search apps..."
                    value={appSearch}
                    onChange={(e) => setAppSearch(e.target.value)}
                    className="pl-7 pr-2 py-1 text-[10px] rounded bg-muted/30 border border-border/30 w-40 focus:outline-none focus:border-primary/50"
                    data-testid="app-search"
                  />
                </div>
                <select
                  value={appSort}
                  onChange={(e) => setAppSort(e.target.value as "name" | "publisher" | "size")}
                  className="text-[10px] px-2 py-1 rounded bg-muted/30 border border-border/30 focus:outline-none"
                  data-testid="app-sort"
                >
                  <option value="name">Sort: Name</option>
                  <option value="publisher">Sort: Publisher</option>
                  <option value="size">Sort: Size</option>
                </select>
              </>
            )}
            {assetId && (
              <button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending || isScanRunning}
                className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors disabled:opacity-50"
                data-testid="btn-request-software-scan"
              >
                <RefreshCw className={`h-2.5 w-2.5 ${(scanMutation.isPending || isScanRunning) ? "animate-spin" : ""}`} />
                {isScanRunning ? "Collecting..." : "Scan Now"}
              </button>
            )}
          </div>
        </div>
        {installedApps.length === 0 ? (
          <div className="text-center py-6">
            <Box className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            {isScanRunning ? (
              <>
                <p className="text-xs text-blue-400 animate-pulse">Collecting software inventory...</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">The probe is running the inventory script — results will appear shortly</p>
              </>
            ) : scannedAt ? (
              <>
                <p className="text-xs text-muted-foreground">No installed applications detected</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Scan completed — no .app bundles or Homebrew packages found</p>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">Software inventory pending</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Click Scan Now to collect installed applications from the probe</p>
              </>
            )}
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-1 pr-1">
            {filtered.map((app: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-2.5 py-2 rounded-lg bg-muted/10 border border-border/10 hover:bg-muted/20 transition-colors" data-testid={`installed-app-${i}`}>
                <Box className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium block truncate">{app.name}</span>
                  {app.publisher && <span className="text-[9px] text-muted-foreground block truncate">{app.publisher}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {app.version && <span className="text-[9px] text-muted-foreground/70">{app.version}</span>}
                  {app.sizeMB > 0 && <span className="text-[8px] text-muted-foreground/50">{app.sizeMB} MB</span>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && appSearch && (
              <div className="text-center py-4">
                <p className="text-[10px] text-muted-foreground">No apps matching "{appSearch}"</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ icon: Icon, title, count }: { icon: typeof HardDrive; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-1">
      <Icon className="h-4 w-4 text-primary" />
      <h4 className="text-xs font-bold uppercase tracking-wider">{title}</h4>
      {count !== undefined && <Badge variant="outline" className="text-[8px] ml-1">{count}</Badge>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    Critical: "bg-red-500/20 text-red-400 border-red-500/30",
    High: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    Medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    Low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return <Badge variant="outline" className={`text-[8px] ${colors[severity] || colors.Medium}`}>{severity}</Badge>;
}

function ComplianceBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s.includes("compliant") && !s.includes("non") && !s.includes("partial") && !s.includes("risk")) {
    return <Badge variant="outline" className="text-[8px] bg-green-500/15 text-green-400 border-green-500/30">{status}</Badge>;
  }
  if (s.includes("risk") || s.includes("non-compliant")) {
    return <Badge variant="outline" className="text-[8px] bg-red-500/15 text-red-400 border-red-500/30">{status}</Badge>;
  }
  return <Badge variant="outline" className="text-[8px] bg-amber-500/15 text-amber-400 border-amber-500/30">{status}</Badge>;
}

function PenTestCard({ type, data }: { type: string; data: { lastTest: string; result: string; findings: number; criticalFindings: number } }) {
  const resultColor = data.result.toLowerCase().includes("fail") ? "text-red-400" : data.result.toLowerCase().includes("observation") ? "text-amber-400" : "text-green-400";
  return (
    <div className="p-2.5 rounded-lg bg-muted/20 border border-border/20" data-testid={`pentest-${type.toLowerCase()}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider">{type}</span>
        <span className={`text-[10px] font-medium ${resultColor}`}>{data.result}</span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>Last: {data.lastTest}</span>
        <span>Findings: {data.findings}</span>
        {data.criticalFindings > 0 && <span className="text-red-400">Critical: {data.criticalFindings}</span>}
      </div>
    </div>
  );
}

const DOMAIN_COLORS: Record<string, { bg: string; text: string; border: string; label: string; icon: typeof Network }> = {
  network: { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30", label: "NET", icon: Network },
  security: { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30", label: "SEC", icon: Shield },
  compliance: { bg: "bg-purple-500/15", text: "text-purple-400", border: "border-purple-500/30", label: "GRC", icon: ShieldCheck },
  systems: { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30", label: "SYS", icon: Server },
};

interface ScanEvent {
  type: string;
  timestamp: number;
  [key: string]: any;
}

interface DomainNode {
  domain: string;
  agentName: string;
  agentDepartment: string;
  agentRoleId: string;
  isOrchestrator?: boolean;
  status: "idle" | "scanning" | "completed" | "failed";
  durationMs?: number;
  error?: string;
}

function OrchestrationPanel({ assetId, onComplete }: { assetId: string; onComplete: () => void }) {
  const [phase, setPhase] = useState<"connecting" | "initializing" | "assigning" | "scanning" | "synthesis" | "completed" | "failed">("connecting");
  const [orchestrator, setOrchestrator] = useState<{ name: string; department: string } | null>(null);
  const [domainNodes, setDomainNodes] = useState<DomainNode[]>([]);
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [scanResult, setScanResult] = useState<{ riskScore?: number; scanSummary?: string; coverage?: number } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addEvent = useCallback((evt: ScanEvent) => {
    setEvents(prev => [...prev, evt]);
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/discovered-assets/${assetId}/scan-progress`, { withCredentials: true });
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as ScanEvent;
        if (data.type === "connected") {
          setPhase("initializing");
          return;
        }
        addEvent(data);

        switch (data.type) {
          case "scan_started":
            setPhase("initializing");
            setOrchestrator(data.orchestrator);
            break;
          case "agents_assigned":
            setPhase("scanning");
            setDomainNodes(data.domains.map((d: any) => ({ ...d, status: "idle" as const })));
            break;
          case "domain_started":
            setDomainNodes(prev => prev.map(n => n.domain === data.domain ? { ...n, status: "scanning" as const } : n));
            break;
          case "domain_completed":
            setDomainNodes(prev => prev.map(n => n.domain === data.domain ? { ...n, status: "completed" as const, durationMs: data.durationMs } : n));
            break;
          case "domain_failed":
            setDomainNodes(prev => prev.map(n => n.domain === data.domain ? { ...n, status: "failed" as const, durationMs: data.durationMs, error: data.error } : n));
            break;
          case "synthesis_started":
            setPhase("synthesis");
            break;
          case "scan_completed":
            setPhase("completed");
            setScanResult({ riskScore: data.riskScore, scanSummary: data.scanSummary, coverage: data.coverage });
            setTimeout(() => { es.close(); onComplete(); }, 3000);
            break;
        }
      } catch {}
    };

    es.onerror = () => {
      setTimeout(() => { es.close(); }, 5000);
    };

    return () => { es.close(); };
  }, [assetId, addEvent, onComplete]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const phaseLabels: Record<string, string> = {
    connecting: "Connecting to orchestrator...",
    initializing: "Initializing multi-agent scan...",
    assigning: "Assigning specialist agents...",
    scanning: "Domain agents scanning...",
    synthesis: "Orchestrator synthesizing findings...",
    completed: "Scan complete",
    failed: "Scan failed",
  };

  const completedCount = domainNodes.filter(n => n.status === "completed" || n.status === "failed").length;
  const totalCount = domainNodes.length || 4;
  const progressPct = phase === "completed" ? 100 : phase === "synthesis" ? 85 + (15 * (completedCount / totalCount)) : (completedCount / totalCount) * 80;

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const getEventMessage = (evt: ScanEvent): string => {
    switch (evt.type) {
      case "scan_started": return `Orchestrator "${evt.orchestrator?.name}" initiated multi-agent scan on ${evt.assetName}`;
      case "agents_assigned": return `${evt.domains?.length || 0} specialist agents assigned to scan domains`;
      case "domain_started": return `${evt.agentName} started scanning ${evt.domain} domain`;
      case "domain_completed": return `${evt.agentName} completed ${evt.domain} scan in ${((evt.durationMs || 0) / 1000).toFixed(1)}s`;
      case "domain_failed": return `${evt.agentName} failed on ${evt.domain}: ${evt.error || "Unknown error"}`;
      case "synthesis_started": return `${evt.orchestrator} synthesizing findings from ${evt.successCount}/${evt.totalDomains} domains`;
      case "scan_completed": return `Scan complete — Risk Score: ${evt.riskScore}/100, Coverage: ${evt.coverage}%`;
      default: return evt.type;
    }
  };

  const getEventColor = (evt: ScanEvent): string => {
    if (evt.type === "domain_failed") return "text-red-400";
    if (evt.type === "scan_completed") return "text-green-400";
    if (evt.type === "synthesis_started") return "text-amber-400";
    if (evt.domain) return DOMAIN_COLORS[evt.domain]?.text || "text-muted-foreground";
    return "text-muted-foreground";
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5 overflow-hidden" data-testid="orchestration-panel">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Brain className="h-5 w-5 text-primary" />
              {phase !== "completed" && phase !== "failed" && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold">AI Agent Orchestration</h3>
              <p className="text-[10px] text-muted-foreground">{phaseLabels[phase]}</p>
            </div>
          </div>
          {orchestrator && (
            <Badge variant="outline" className="text-[9px] gap-1" data-testid="orchestrator-badge">
              <Workflow className="h-2.5 w-2.5" />
              {orchestrator.name}
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="grid grid-cols-4 gap-2" data-testid="domain-nodes">
          {(domainNodes.length > 0 ? domainNodes : ["network", "security", "compliance", "systems"].map(d => ({ domain: d, agentName: "Waiting...", agentDepartment: "", agentRoleId: "", status: "idle" as const }))).map((node) => {
            const dc = DOMAIN_COLORS[node.domain] || DOMAIN_COLORS.network;
            const DomainIcon = dc.icon;
            const isActive = node.status === "scanning";
            const isDone = node.status === "completed";
            const isFailed = node.status === "failed";

            return (
              <div
                key={node.domain}
                className={`relative rounded-lg border p-3 transition-all duration-500 ${
                  isActive ? `${dc.border} ${dc.bg} ring-1 ring-primary/30 shadow-lg` :
                  isDone ? `border-green-500/30 bg-green-500/5` :
                  isFailed ? `border-red-500/30 bg-red-500/5` :
                  `border-border/30 bg-muted/5`
                }`}
                data-testid={`domain-node-${node.domain}`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-lg overflow-hidden">
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-primary/5 to-transparent" />
                  </div>
                )}
                <div className="relative flex flex-col items-center text-center gap-1.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 ${
                    isActive ? `${dc.bg} ${dc.text}` :
                    isDone ? "bg-green-500/15 text-green-400" :
                    isFailed ? "bg-red-500/15 text-red-400" :
                    "bg-muted/20 text-muted-foreground"
                  }`}>
                    {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> :
                     isDone ? <CheckCircle2 className="h-4 w-4" /> :
                     isFailed ? <XCircle className="h-4 w-4" /> :
                     <DomainIcon className="h-4 w-4" />}
                  </div>
                  <Badge variant="outline" className={`text-[8px] px-1.5 ${dc.text} ${dc.border}`}>{dc.label}</Badge>
                  <p className="text-[9px] text-muted-foreground truncate w-full" title={node.agentName}>{node.agentName}</p>
                  {node.durationMs && (
                    <p className="text-[8px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2 w-2" />
                      {(node.durationMs / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {phase === "synthesis" && (
          <div className="flex items-center gap-2 p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 animate-pulse" data-testid="synthesis-indicator">
            <Brain className="h-4 w-4 text-amber-400" />
            <span className="text-[10px] text-amber-400 font-medium">Orchestrator synthesizing all agent findings...</span>
          </div>
        )}

        {scanResult && phase === "completed" && (
          <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/5 space-y-2" data-testid="scan-result-summary">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-xs font-semibold text-green-400">Scan Complete</span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-muted-foreground">Risk: <span className={`font-bold ${(scanResult.riskScore || 0) > 60 ? "text-red-400" : (scanResult.riskScore || 0) > 30 ? "text-amber-400" : "text-green-400"}`}>{scanResult.riskScore}/100</span></span>
                <span className="text-muted-foreground">Coverage: <span className="font-bold text-primary">{scanResult.coverage}%</span></span>
              </div>
            </div>
            {scanResult.scanSummary && (
              <p className="text-[10px] text-muted-foreground">{scanResult.scanSummary}</p>
            )}
          </div>
        )}

        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Activity className="h-3 w-3" /> Activity Log
          </p>
          <div ref={logRef} className="h-32 overflow-y-auto rounded-lg border border-border/20 bg-black/30 p-2 font-mono text-[9px] space-y-0.5" data-testid="scan-activity-log">
            {events.length === 0 && (
              <div className="flex items-center gap-1 text-muted-foreground animate-pulse">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <span>Waiting for orchestrator events...</span>
              </div>
            )}
            {events.map((evt, i) => (
              <div key={i} className={`flex gap-2 ${getEventColor(evt)}`} data-testid={`log-entry-${i}`}>
                <span className="text-muted-foreground/60 shrink-0">{formatTime(evt.timestamp)}</span>
                <span>{getEventMessage(evt)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UtilizationGauge({ label, value, icon: Icon, thresholds }: { label: string; value: number | null | undefined; icon: typeof Cpu; thresholds?: { warn: number; crit: number } }) {
  const t = thresholds || { warn: 70, crit: 90 };
  const v = value ?? 0;
  const hasData = value !== null && value !== undefined;
  const color = !hasData ? "text-muted-foreground" : v >= t.crit ? "text-red-400" : v >= t.warn ? "text-amber-400" : "text-green-400";
  const bgColor = !hasData ? "bg-muted/20" : v >= t.crit ? "bg-red-500/10" : v >= t.warn ? "bg-amber-500/10" : "bg-green-500/10";
  const barColor = !hasData ? "bg-muted/30" : v >= t.crit ? "bg-red-500" : v >= t.warn ? "bg-amber-500" : "bg-green-500";
  return (
    <div className={`p-3 rounded-lg border border-border/20 ${bgColor}`} data-testid={`gauge-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        </div>
        <span className={`text-sm font-bold ${color}`}>{hasData ? `${Math.round(v)}%` : "N/A"}</span>
      </div>
      <div className="h-1.5 rounded-full bg-black/20 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${hasData ? v : 0}%` }} />
      </div>
      {hasData && (
        <div className="flex justify-between mt-1">
          <span className={`text-[8px] ${color}`}>{v >= t.crit ? "Critical" : v >= t.warn ? "Warning" : "Normal"}</span>
          <span className="text-[8px] text-muted-foreground">{v.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function RollbackStatus({ task }: { task: RemediationTask }) {
  const rollbackStatus = (task as any).rollbackStatus as string | null;
  const rollbackResult = (task as any).rollbackResult as string | null;
  const rollbackError = (task as any).rollbackError as string | null;
  const rollbackedAt = (task as any).rollbackedAt as string | null;

  const statusConfig: Record<string, { color: string; label: string; icon: typeof RotateCcw }> = {
    pending:   { color: "text-amber-400 border-amber-500/30 bg-amber-500/5",   label: "Rollback Queued",     icon: Clock },
    dispatched:{ color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/5",      label: "Rollback Dispatched", icon: Radio },
    executing: { color: "text-purple-400 border-purple-500/30 bg-purple-500/5",label: "Rolling Back...",      icon: Loader2 },
    completed: { color: "text-green-400 border-green-500/30 bg-green-500/5",   label: "Rollback Completed",  icon: CheckCircle2 },
    failed:    { color: "text-red-400 border-red-500/30 bg-red-500/5",         label: "Rollback Failed",     icon: XCircle },
  };

  if (!rollbackStatus) return null;
  const cfg = statusConfig[rollbackStatus] || { color: "text-muted-foreground", label: rollbackStatus, icon: RotateCcw };
  const Icon = cfg.icon;

  return (
    <div className={`mt-2 p-2 rounded border ${cfg.color}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {rollbackStatus === "executing" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Icon className="h-3 w-3" />
        )}
        <p className="text-[9px] font-semibold">{cfg.label}</p>
        {rollbackedAt && (
          <span className="text-[8px] opacity-60 ml-auto">{new Date(rollbackedAt).toLocaleString()}</span>
        )}
      </div>
      {rollbackResult && (
        <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap font-mono max-h-20 overflow-y-auto">{rollbackResult}</pre>
      )}
      {rollbackError && (
        <pre className="text-[9px] text-red-300 whitespace-pre-wrap font-mono max-h-20 overflow-y-auto">{rollbackError}</pre>
      )}
    </div>
  );
}

function AssetDetailPanel({ asset, probeMap, aiAgentMap, probes, onClose }: {
  asset: DiscoveredAsset;
  probeMap: Map<string, string>;
  aiAgentMap: Map<string, string>;
  probes: DiscoveryProbe[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const tc = typeConfig[asset.type] || typeConfig.server;
  const TypeIcon = tc.icon;
  const sc = statusConfig[asset.status] || statusConfig.unknown;
  const StatusIcon = sc.icon;
  const meta = (asset.metadata || {}) as Record<string, any>;
  const hw = meta.hardware || {};
  const sw = meta.software || {};
  const net = meta.network || {};
  const sec = meta.security || {};
  const vulns = Array.isArray(meta.vulnerabilities) ? meta.vulnerabilities : [];
  const pen = meta.penTesting || {};
  const apps = Array.isArray(meta.applications) ? meta.applications : [];
  const comp = Array.isArray(meta.compliance) ? meta.compliance : [];
  const interfaces = Array.isArray(net.interfaces) ? net.interfaces : [];
  const kpis = sec.kpis || {};
  const scanStatus = meta.agentScanStatus as string | undefined;
  const scanError = meta.agentScanError as string | undefined;
  const lastScan = meta.lastAgentScan as string | undefined;
  const scanSummary = meta.scanSummary as string | undefined;
  const riskScore = meta.riskScore as number | undefined;
  const recommendedActions = Array.isArray(meta.recommendedActions) ? meta.recommendedActions : [];
  const scanAgent = meta.scanAgent as { roleName?: string; department?: string } | undefined;
  const orchestrationMode = meta.orchestrationMode as string | undefined;
  const agentContributions = Array.isArray(meta.agentContributions) ? meta.agentContributions : [];
  const scanCoverage = meta.scanCoverage as number | undefined;

  const [showOrchestration, setShowOrchestration] = useState(false);
  const [dismissedFailBanner, setDismissedFailBanner] = useState(false);

  const contextQuery = useQuery<{
    asset: { id: string; name: string; vendor: string | null; type: string; ipAddress: string | null };
    itsm: {
      incidents: Array<{ id: string; title: string; severity: string; status: string; category: string; createdAt: string | null }>;
      problems:  Array<{ id: string; title: string; priority: string; status: string; category: string; createdAt: string | null }>;
      changes:   Array<{ id: string; title: string; type: string; status: string; riskLevel: string; createdAt: string | null }>;
      serviceRequests: Array<{ id: string; title: string; type: string; priority: string; status: string; createdAt: string | null }>;
    };
    vendor: {
      suppliers: Array<{ id: string; name: string; category: string; riskTier: string; status: string; contactEmail: string | null }>;
      contracts: Array<{ id: string; name: string; status: string; contractValue: number; currency: string; endDate: string; slaUptimeTarget: number | null; actualUptime: number | null }>;
    };
    sla: {
      definitions: Array<{ id: string; name: string; priority: string; agreementType: string; responseTimeMinutes: number; resolutionTimeMinutes: number; serviceScope: string | null; counterparty: string | null }>;
      breaches:    Array<{ id: number; entityRef: string | null; breachType: string; breachMinutes: number; priority: string; occurredAt: string | null }>;
    };
    financial: {
      services: Array<{ id: string; serviceName: string; costCenter: string; annualBudget: number; ytdSpend: number; currency: string; costModel: string }>;
    };
  }>({
    queryKey: ["/api/asset-context", asset.id],
    queryFn: async () => {
      const res = await fetch(`/api/asset-context/${asset.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch asset context");
      return res.json();
    },
  });

  const agentScan = useMutation({
    mutationFn: async () => {
      setShowOrchestration(true);
      const res = await apiRequest("POST", `/api/discovered-assets/${asset.id}/agent-scan`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "AI Agent scan complete", description: "All tabs have been populated with AI analysis." });
      queryClient.invalidateQueries({ queryKey: ["/api/discovered-assets"] });
    },
    onError: (err: any) => {
      toast({ title: "Agent scan failed", description: err.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/discovered-assets"] });
      setShowOrchestration(false);
    },
  });

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const remediationTasksQuery = useQuery<RemediationTask[]>({
    queryKey: ["/api/remediation-tasks", asset.id],
    queryFn: async () => {
      const res = await fetch(`/api/remediation-tasks?assetId=${asset.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch remediation tasks");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const generateRemediation = useMutation({
    mutationFn: async (recommendation: string) => {
      const res = await apiRequest("POST", `/api/discovered-assets/${asset.id}/generate-remediation`, { recommendation });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Remediation script generated", description: "Review and approve the script in the Remediation tab." });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to generate fix", description: err.message, variant: "destructive" });
    },
  });

  const approveTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${taskId}/approve`);
      return res.json();
    },
    onSuccess: (data: any) => {
      const completed = data?.status === "completed";
      toast({
        title: completed ? "Remediation applied" : "Remediation approved",
        description: completed
          ? "Fix applied and asset data updated. Refresh to see changes."
          : "The fix will be sent to the probe on the next heartbeat.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/discovered-assets"] });
    },
    onError: (err: any) => {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
    },
  });

  const retryTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${taskId}/retry`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task reset", description: "The task is ready to approve and deploy again." });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
    },
    onError: (err: any) => {
      toast({ title: "Retry failed", description: err.message, variant: "destructive" });
    },
  });

  const rejectTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${taskId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Remediation rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
    },
    onError: (err: any) => {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    },
  });

  const clearCompleted = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/remediation-tasks/completed?assetId=${asset.id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Cleared ${data.cleared} completed task(s)` });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
    },
    onError: (err: any) => {
      toast({ title: "Clear failed", description: err.message, variant: "destructive" });
    },
  });

  const [showHistory, setShowHistory] = useState(false);

  const cancelTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${taskId}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Remediation cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
    },
    onError: (err: any) => {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    },
  });

  const forceComplete = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${taskId}/force-complete`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Remediation marked as completed", description: "Asset data has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/discovered-assets"] });
    },
    onError: (err: any) => {
      toast({ title: "Force complete failed", description: err.message, variant: "destructive" });
    },
  });

  const resetTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${taskId}/reset`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Task reset to queue", description: "The task will be re-dispatched on the probe's next heartbeat." });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
    },
    onError: (err: any) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  const rollbackTask = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await apiRequest("POST", `/api/remediation-tasks/${taskId}/rollback`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Rollback failed");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rollback initiated", description: "The rollback script has been queued and will execute on the next probe heartbeat." });
      queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
    },
    onError: (err: any) => {
      toast({ title: "Rollback failed", description: err.message, variant: "destructive" });
    },
  });

  const hasActiveTasks = remediationTasksQuery.data?.some((t: RemediationTask) =>
    ["queued", "dispatched", "executing"].includes(t.status) && !t.title.startsWith("[SW_SCAN]")
  );

  useEffect(() => {
    if (hasActiveTasks) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [hasActiveTasks, asset.id]);

  // Poll while a SW_SCAN task is running so Apps tab refreshes when the probe reports back
  const hasScanTask = remediationTasksQuery.data?.some((t: RemediationTask) => t.title.startsWith("[SW_SCAN]") && ["queued", "dispatched", "executing"].includes(t.status));
  useEffect(() => {
    if (hasScanTask) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/remediation-tasks", asset.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/discovered-assets"] });
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [hasScanTask, asset.id]);

  useEffect(() => {
    if (scanStatus === "scanning") {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/discovered-assets"] });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [scanStatus]);

  return (
    <div className="space-y-4" data-testid="asset-detail-panel">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-back-to-list">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tc.color}`}>
          <TypeIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold" data-testid="detail-asset-name">{asset.name}</h2>
            <StatusIcon className={`h-4 w-4 ${sc.color}`} />
            <Badge variant="outline" className="text-[9px]" data-testid="detail-asset-status">{sc.label}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
            {asset.vendor && <span data-testid="detail-asset-vendor">{asset.vendor} {asset.model || ""}</span>}
            {asset.ipAddress && <><span>·</span><span data-testid="detail-asset-ip">{asset.ipAddress}</span></>}
            {asset.macAddress && <><span>·</span><span data-testid="detail-asset-mac">{asset.macAddress}</span></>}
          </div>
        </div>
        {asset.assignedAgentRoleId && (
          <Button
            size="sm"
            variant={scanStatus === "scanning" || agentScan.isPending ? "outline" : "default"}
            className="gap-1.5 text-xs"
            onClick={() => agentScan.mutate()}
            disabled={agentScan.isPending || scanStatus === "scanning"}
            data-testid="button-agent-scan"
          >
            {(agentScan.isPending || scanStatus === "scanning") ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning...</>
            ) : (
              <><ScanSearch className="h-3.5 w-3.5" /> AI Agent Scan</>
            )}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[9px]">{tc.label}</Badge>
        {asset.protocol && <Badge variant="outline" className="text-[9px]" data-testid="detail-badge-protocol">{protocolLabels[asset.protocol] || asset.protocol}</Badge>}
        {asset.firmware && <Badge variant="outline" className="text-[9px]" data-testid="detail-badge-firmware">FW: {asset.firmware}</Badge>}
        {asset.probeId && probeMap.get(asset.probeId) && (
          <Badge variant="outline" className="text-[8px] gap-1" data-testid="detail-badge-probe"><Radar className="h-2 w-2" /> {probeMap.get(asset.probeId)}</Badge>
        )}
        {asset.assignedAgentRoleId && aiAgentMap.get(asset.assignedAgentRoleId) && (
          <Badge variant="outline" className="text-[8px] gap-1 bg-primary/10 text-primary border-primary/20" data-testid="detail-badge-agent"><Bot className="h-2 w-2" /> {aiAgentMap.get(asset.assignedAgentRoleId)}</Badge>
        )}
      </div>

      {(() => {
        const probe = asset.probeId && probes ? probes.find(p => p.id === asset.probeId) : null;
        const sysUtil = meta.systemUtilization as { cpu?: number; memory?: number; disk?: number; lastUpdated?: string } | undefined;
        const cpuVal = probe?.cpuUsage ?? sysUtil?.cpu ?? null;
        const memVal = probe?.memoryUsage ?? sysUtil?.memory ?? null;
        const diskVal = probe?.diskUsage ?? sysUtil?.disk ?? null;
        if (cpuVal === null && memVal === null && diskVal === null) return null;
        const metrics = [
          { label: "CPU", val: cpuVal, warn: 70, crit: 90 },
          { label: "MEM", val: memVal, warn: 75, crit: 90 },
          { label: "DISK", val: diskVal, warn: 80, crit: 95 },
        ].filter(m => m.val !== null && m.val !== undefined);
        if (metrics.length === 0) return null;
        return (
          <div className="flex items-center gap-4 p-2.5 rounded-lg bg-muted/20 border border-border/20" data-testid="header-utilization">
            <div className="flex items-center gap-1.5">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Live Utilization</span>
            </div>
            {metrics.map(m => {
              const v = m.val as number;
              const color = v >= m.crit ? "text-red-400" : v >= m.warn ? "text-amber-400" : "text-green-400";
              const barColor = v >= m.crit ? "bg-red-500" : v >= m.warn ? "bg-amber-500" : "bg-green-500";
              return (
                <div key={m.label} className="flex items-center gap-2 min-w-[120px]" data-testid={`header-util-${m.label.toLowerCase()}`}>
                  <span className="text-[9px] text-muted-foreground w-8">{m.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-black/20 overflow-hidden min-w-[60px]">
                    <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(v, 100)}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold w-10 text-right ${color}`}>{Math.round(v)}%</span>
                </div>
              );
            })}
            {(probe?.lastHeartbeat || sysUtil?.lastUpdated) && (
              <span className="text-[8px] text-muted-foreground/50 ml-auto">{new Date((probe?.lastHeartbeat || sysUtil?.lastUpdated) as string).toLocaleTimeString()}</span>
            )}
          </div>
        );
      })()}

      {showOrchestration && (
        <OrchestrationPanel
          assetId={asset.id}
          onComplete={() => {
            setShowOrchestration(false);
            queryClient.invalidateQueries({ queryKey: ["/api/discovered-assets"] });
          }}
        />
      )}

      {scanStatus && scanStatus !== "scanning" && !showOrchestration && !(scanStatus === "failed" && dismissedFailBanner) && (
        <div className={`p-3 rounded-lg border ${
          scanStatus === "completed" ? "bg-green-500/5 border-green-500/20" :
          scanStatus === "partial" ? "bg-amber-500/5 border-amber-500/20" :
          scanStatus === "failed" ? "bg-red-500/5 border-red-500/20" :
          "bg-muted/20 border-border/30"
        }`} data-testid="scan-status-banner">
          <div className="flex items-center gap-2 flex-wrap">
            {scanStatus === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
            ) : scanStatus === "partial" ? (
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            ) : scanStatus === "failed" ? (
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            ) : null}
            <span className="text-xs font-medium">
              {scanStatus === "completed" ? "Multi-Agent Scan Complete" : scanStatus === "partial" ? "Multi-Agent Scan Partial" : "Multi-Agent Scan Failed"}
            </span>
            {orchestrationMode === "multi-agent" && scanCoverage !== undefined && (
              <Badge variant="outline" className={`text-[8px] gap-1 ${scanCoverage === 100 ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                {scanCoverage}% Coverage
              </Badge>
            )}
            {scanAgent?.roleName && (
              <Badge variant="outline" className="text-[8px] gap-1 bg-primary/10 text-primary border-primary/20" data-testid="badge-orchestrator">
                <Bot className="h-2 w-2" /> {scanAgent.roleName} (Orchestrator)
              </Badge>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              {lastScan && (
                <span className="text-[10px] text-muted-foreground">{new Date(lastScan).toLocaleString()}</span>
              )}
              {scanStatus === "failed" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary"
                    onClick={() => { setDismissedFailBanner(false); agentScan.mutate(); }}
                    disabled={agentScan.isPending}
                    data-testid="button-retry-scan"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground"
                    onClick={() => setDismissedFailBanner(true)}
                    data-testid="button-dismiss-scan-banner"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {scanStatus === "failed" && scanError && (
            <p className="text-[10px] text-red-400/80 mt-1.5 pl-6">{scanError}</p>
          )}

          {agentContributions.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap" data-testid="agent-contributions">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider mr-1">Agents:</span>
              {agentContributions.map((contrib: any, i: number) => {
                const domainColors: Record<string, string> = {
                  network: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                  security: "bg-red-500/10 text-red-400 border-red-500/20",
                  compliance: "bg-purple-500/10 text-purple-400 border-purple-500/20",
                  systems: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                };
                const domainIcons: Record<string, string> = { network: "NET", security: "SEC", compliance: "GRC", systems: "SYS" };
                return (
                  <Badge
                    key={i}
                    variant="outline"
                    className={`text-[7px] gap-1 ${contrib.success ? (domainColors[contrib.domain] || "bg-muted/20 text-muted-foreground") : "bg-red-500/10 text-red-400 border-red-500/30 line-through"}`}
                    data-testid={`badge-agent-${contrib.domain}`}
                  >
                    <span className="font-bold">{domainIcons[contrib.domain] || contrib.domain.toUpperCase()}</span>
                    {contrib.agent}
                    <span className="opacity-60">{Math.round(contrib.durationMs / 1000)}s</span>
                  </Badge>
                );
              })}
            </div>
          )}

          {scanSummary && <p className="text-[11px] text-muted-foreground mt-1.5">{scanSummary}</p>}
          {riskScore !== undefined && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-muted-foreground">Risk Score:</span>
              <Progress value={riskScore} className="h-1.5 w-20" />
              <span className={`text-xs font-bold ${riskScore > 60 ? "text-red-400" : riskScore > 30 ? "text-amber-400" : "text-green-400"}`}>{riskScore}/100</span>
              <span className={`text-[9px] ${riskScore > 60 ? "text-red-400" : riskScore > 30 ? "text-amber-400" : "text-green-400"}`}>
                {riskScore > 80 ? "Critical" : riskScore > 60 ? "High" : riskScore > 30 ? "Medium" : "Low"}
              </span>
            </div>
          )}
          {recommendedActions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/20">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Recommended Actions</span>
              <ul className="mt-1 space-y-1">
                {recommendedActions.map((action: string, i: number) => {
                  const actionLower = action.toLowerCase();
                  const tasks = remediationTasksQuery.data || [];
                  const matchingTask = tasks.find((t: any) => {
                    const tLower = (t.title || "").toLowerCase();
                    if (tLower === actionLower) return true;
                    const words = tLower.split(/\s+/).filter((w: string) => w.length > 3);
                    const matchCount = words.filter((w: string) => actionLower.includes(w)).length;
                    return words.length > 0 && matchCount / words.length >= 0.5;
                  });
                  const isCompleted = matchingTask?.status === "completed";
                  const isInProgress = matchingTask && !["completed", "failed", "rejected"].includes(matchingTask.status);
                  return (
                    <li key={i} className={`text-[10px] flex items-start gap-1.5 ${isCompleted ? "text-green-400/70 line-through" : "text-muted-foreground"}`}>
                      <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                      <span className="flex-1">{action}</span>
                      {isCompleted ? (
                        <span className="text-[8px] text-green-400 flex items-center gap-0.5 shrink-0" data-testid={`action-done-${i}`}>
                          <CheckCircle2 className="h-2.5 w-2.5" /> Done
                        </span>
                      ) : isInProgress ? (
                        <span className="text-[8px] text-amber-400 flex items-center gap-0.5 shrink-0" data-testid={`action-progress-${i}`}>
                          <Loader2 className="h-2.5 w-2.5 animate-spin" /> In Progress
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1.5 text-[8px] gap-1 text-primary hover:text-primary hover:bg-primary/10 shrink-0"
                          onClick={() => generateRemediation.mutate(action)}
                          disabled={generateRemediation.isPending}
                          data-testid={`btn-generate-fix-${i}`}
                        >
                          <Wrench className="h-2.5 w-2.5" />
                          Fix
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="hardware" className="w-full">
        <TabsList className="w-full justify-start bg-muted/30 overflow-x-auto scrollbar-hide flex-nowrap">
          <TabsTrigger value="hardware" className="text-[10px] gap-1" data-testid="detail-tab-hardware"><HardDrive className="h-3 w-3" /> Hardware</TabsTrigger>
          <TabsTrigger value="software" className="text-[10px] gap-1" data-testid="detail-tab-software"><Layers className="h-3 w-3" /> Software</TabsTrigger>
          <TabsTrigger value="network" className="text-[10px] gap-1" data-testid="detail-tab-network"><Activity className="h-3 w-3" /> Network</TabsTrigger>
          <TabsTrigger value="security" className="text-[10px] gap-1" data-testid="detail-tab-security"><Lock className="h-3 w-3" /> Security</TabsTrigger>
          <TabsTrigger value="vulnerabilities" className="text-[10px] gap-1" data-testid="detail-tab-vulns"><Bug className="h-3 w-3" /> Vulns</TabsTrigger>
          <TabsTrigger value="pentesting" className="text-[10px] gap-1" data-testid="detail-tab-pentest"><Search className="h-3 w-3" /> Pen Test</TabsTrigger>
          <TabsTrigger value="applications" className="text-[10px] gap-1" data-testid="detail-tab-apps"><Box className="h-3 w-3" /> Apps</TabsTrigger>
          <TabsTrigger value="compliance" className="text-[10px] gap-1" data-testid="detail-tab-compliance"><ShieldCheck className="h-3 w-3" /> Compliance</TabsTrigger>
          <TabsTrigger value="remediation" className="text-[10px] gap-1" data-testid="detail-tab-remediation">
            <Wrench className="h-3 w-3" /> Remediation
            {(remediationTasksQuery.data?.filter((t: RemediationTask) => ["pending_approval", "queued", "dispatched", "executing"].includes(t.status) && !t.title.startsWith("[SW_SCAN]")).length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[8px]">{remediationTasksQuery.data?.filter((t: RemediationTask) => ["pending_approval", "queued", "dispatched", "executing"].includes(t.status) && !t.title.startsWith("[SW_SCAN]")).length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="itsm" className="text-[10px] gap-1" data-testid="detail-tab-itsm">
            <ClipboardList className="h-3 w-3" /> ITSM
            {contextQuery.data && (() => {
              const open = (contextQuery.data.itsm.incidents.filter(i => i.status !== "resolved" && i.status !== "closed").length);
              return open > 0 ? <Badge variant="destructive" className="ml-1 h-4 px-1 text-[8px]">{open}</Badge> : null;
            })()}
          </TabsTrigger>
          <TabsTrigger value="vendor-contract" className="text-[10px] gap-1" data-testid="detail-tab-vendor">
            <Handshake className="h-3 w-3" /> Vendor
          </TabsTrigger>
          <TabsTrigger value="sla-finance" className="text-[10px] gap-1" data-testid="detail-tab-sla-finance">
            <TrendingUp className="h-3 w-3" /> SLA &amp; Finance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hardware" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <SectionTitle icon={HardDrive} title="Hardware Specifications" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <DetailField label="CPU" value={hw.cpu} />
                <DetailField label="RAM" value={hw.ram} />
                <DetailField label="Storage" value={hw.storage || hw.flash || hw.ssd} />
                <DetailField label="RAID" value={hw.raid} />
                <DetailField label="ASIC" value={hw.asic} />
                <DetailField label="NIC" value={hw.nic} />
                <DetailField label="Throughput" value={hw.throughput} />
                <DetailField label="Max Sessions" value={hw.maxSessions} />
                <DetailField label="Fans" value={hw.fans} />
                <DetailField label="PSU" value={hw.psu} />
                <DetailField label="Power Draw" value={hw.powerDraw} />
                <DetailField label="Form Factor" value={hw.formFactor} />
                <DetailField label="Weight" value={hw.weight} />
                <DetailField label="Serial Number" value={hw.serialNumber} />
                <DetailField label="Sensor" value={hw.sensor} />
                <DetailField label="Lens" value={hw.lens} />
                <DetailField label="IR Range" value={hw.irRange} />
                <DetailField label="Battery" value={hw.battery} />
                <DetailField label="Radios" value={hw.radios} />
                <DetailField label="Antennas" value={hw.antennas} />
                <DetailField label="I/O" value={hw.io} />
                <DetailField label="Communication" value={hw.communication} />
                <DetailField label="Hypervisor" value={hw.hypervisor} />
                <DetailField label="TX Power" value={hw.txPower} />
                <DetailField label="DIN" value={hw.din} />
                <DetailField label="Connectivity" value={hw.connectivity} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="software" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <SectionTitle icon={Layers} title="Software Details" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <DetailField label="OS" value={sw.os} />
                <DetailField label="Version" value={sw.version} />
                <DetailField label="Kernel" value={sw.kernel} />
                <DetailField label="Build" value={sw.build} />
                <DetailField label="Bootloader" value={sw.bootloader} />
                <DetailField label="License Level" value={sw.licenseLevel} />
                <DetailField label="DNA License" value={sw.dnaLicense} />
                <DetailField label="Uptime" value={sw.uptime} />
                <DetailField label="Last Patched" value={sw.lastPatched} />
                <DetailField label="Config Backup" value={sw.configBackup} />
                <DetailField label="Web Server" value={sw.webServer} />
                <DetailField label="Runtime" value={sw.runtime} />
                <DetailField label="Container Runtime" value={sw.containerRuntime} />
                <DetailField label="Orchestration" value={sw.orchestration} />
                <DetailField label="Containers" value={sw.containers} />
                <DetailField label="DB Engine" value={sw.dbEngine} />
                <DetailField label="DB Extensions" value={sw.dbExtensions} />
                <DetailField label="Replication" value={sw.replication} />
                <DetailField label="Backup" value={sw.backup} />
                <DetailField label="Monitoring" value={sw.monitoring} />
                <DetailField label="Packages" value={sw.packages} />
                <DetailField label="Auto Updates" value={sw.autoUpdates || sw.autoUpdate} />
                <DetailField label="Threat Content" value={sw.threatContent} />
                <DetailField label="App-ID" value={sw.appId} />
                <DetailField label="URL DB" value={sw.urlDb} />
                <DetailField label="WildFire" value={sw.wildfire} />
                <DetailField label="AV DB" value={sw.avDb} />
                <DetailField label="IPS DB" value={sw.ipsDb} />
                <DetailField label="ASM Signatures" value={sw.asmSignatures} />
                <DetailField label="Controller" value={sw.controller} />
                <DetailField label="Video Codec" value={sw.videoCodec} />
                <DetailField label="Analytics" value={sw.analytics} />
                <DetailField label="VMS" value={sw.vms} />
                <DetailField label="ONVIF Profile" value={sw.onvifProfile} />
                <DetailField label="AD Functional Level" value={sw.adFunctionalLevel} />
                <DetailField label="Exchange Version" value={sw.exchangeVersion} />
                <DetailField label="Log Platform" value={sw.logPlatform} />
                <DetailField label="Retention" value={sw.retention} />
                <DetailField label="Ingest Rate" value={sw.ingestRate} />
                <DetailField label="BACnet Device ID" value={sw.bacnetDeviceId} />
                <DetailField label="BACnet Objects" value={sw.bacnetObjects} />
                <DetailField label="PLC Program" value={sw.plcProgram} />
                <DetailField label="Programming Env" value={sw.programmingEnv} />
                <DetailField label="Cycle Time" value={sw.cycleTime} />
                <DetailField label="LoRaWAN Class" value={sw.lorawanClass} />
                <DetailField label="Spreading Factor" value={sw.spreadingFactor} />
                <DetailField label="Report Interval" value={sw.reportInterval} />
              </div>
              {Array.isArray(sw.fsmoRoles) && sw.fsmoRoles.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/20">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">FSMO Roles</span>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {sw.fsmoRoles.map((r: string) => <Badge key={r} variant="outline" className="text-[8px]">{r}</Badge>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="mt-3">
          {(() => {
            const probe = asset.probeId && probes ? probes.find(p => p.id === asset.probeId) : null;
            const sysUtil = meta.systemUtilization as { cpu?: number; memory?: number; disk?: number; lastUpdated?: string } | undefined;
            const cpuVal = probe?.cpuUsage ?? sysUtil?.cpu;
            const memVal = probe?.memoryUsage ?? sysUtil?.memory;
            const diskVal = probe?.diskUsage ?? sysUtil?.disk;
            const lastUpdated = probe?.lastHeartbeat || sysUtil?.lastUpdated;
            const metrics = [
              { label: "CPU", val: cpuVal, icon: Cpu, warn: 70, crit: 90 },
              { label: "Memory", val: memVal, icon: HardDrive, warn: 75, crit: 90 },
              { label: "Disk", val: diskVal, icon: Server, warn: 80, crit: 95 },
            ].filter(m => m.val !== null && m.val !== undefined);
            if (metrics.length === 0) return null;
            return (
              <Card className="mb-3">
                <CardContent className="p-4">
                  <SectionTitle icon={Gauge} title="System Utilization (Live from Probe)" />
                  <div className="grid grid-cols-3 gap-4 mt-2" data-testid="network-tab-utilization">
                    {metrics.map(m => {
                      const v = m.val as number;
                      const MIcon = m.icon;
                      const color = v >= m.crit ? "text-red-400" : v >= m.warn ? "text-amber-400" : "text-green-400";
                      const barColor = v >= m.crit ? "bg-red-500" : v >= m.warn ? "bg-amber-500" : "bg-green-500";
                      return (
                        <div key={m.label} className="text-center" data-testid={`sys-util-${m.label.toLowerCase()}`}>
                          <MIcon className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <div className="text-[9px] text-muted-foreground uppercase mb-1">{m.label}</div>
                          <div className={`text-lg font-bold ${color}`}>{Math.round(v)}%</div>
                          <div className="h-2 rounded-full bg-black/20 overflow-hidden mt-1.5 mx-auto max-w-[80px]">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(v, 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {lastUpdated && (
                    <p className="text-[8px] text-muted-foreground text-right mt-2">Last heartbeat: {new Date(lastUpdated).toLocaleString()}</p>
                  )}
                </CardContent>
              </Card>
            );
          })()}
          {(() => {
            const probe = asset.probeId && probes ? probes.find(p => p.id === asset.probeId) : null;
            if (!probe) return null;
            const schedule = (probe as any).collectionSchedule as { scheduled?: { task: string; interval: number; description?: string }[]; onDemand?: { task: string; description?: string }[]; bufferConfig?: { maxEntries?: number; flushBatchSize?: number; retentionHours?: number } } | null;
            const bufStatus = (probe as any).bufferStatus as { entries?: number; maxEntries?: number; oldestEntry?: string; lastFlush?: string; connected?: boolean } | null;
            if (!schedule && !bufStatus) return null;
            const scheduled = schedule?.scheduled || [];
            const onDemand = schedule?.onDemand || [];
            const formatInterval = (s: number) => s >= 3600 ? `${Math.round(s / 3600)}h` : s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`;
            return (
              <Card className="mb-3">
                <CardContent className="p-4">
                  <SectionTitle icon={Timer} title="Probe Collection Schedule" />
                  {bufStatus && (
                    <div className="flex items-center gap-3 mb-3 p-2 rounded-md bg-muted/30 border border-border/30" data-testid="probe-buffer-status">
                      <div className="flex items-center gap-1.5">
                        {bufStatus.connected !== false ? (
                          <><CheckCircle2 className="h-3.5 w-3.5 text-green-400" /><span className="text-[10px] font-medium text-green-400">Connected</span></>
                        ) : (
                          <><WifiOff className="h-3.5 w-3.5 text-amber-400" /><span className="text-[10px] font-medium text-amber-400">Offline (Buffering)</span></>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <Database className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Buffer: {bufStatus.entries ?? 0}/{bufStatus.maxEntries ?? 10000}</span>
                      </div>
                      {bufStatus.lastFlush && (
                        <span className="text-[9px] text-muted-foreground">Flushed: {new Date(bufStatus.lastFlush).toLocaleTimeString()}</span>
                      )}
                    </div>
                  )}
                  {scheduled.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">Scheduled Tasks</p>
                      <div className="grid grid-cols-1 gap-1" data-testid="probe-scheduled-tasks">
                        {scheduled.map((t) => (
                          <div key={t.task} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/20 border border-border/20">
                            <Clock className="h-3 w-3 text-cyan-400 shrink-0" />
                            <span className="text-[10px] font-medium flex-1">{t.task}</span>
                            {t.description && <span className="text-[9px] text-muted-foreground hidden sm:inline flex-1">{t.description}</span>}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{formatInterval(t.interval)}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {onDemand.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">On-Demand Tasks</p>
                      <div className="grid grid-cols-1 gap-1" data-testid="probe-ondemand-tasks">
                        {onDemand.map((t) => (
                          <div key={t.task} className="flex items-center gap-2 px-2 py-1.5 rounded bg-muted/20 border border-border/20">
                            <Zap className="h-3 w-3 text-amber-400 shrink-0" />
                            <span className="text-[10px] font-medium flex-1">{t.task}</span>
                            {t.description && <span className="text-[9px] text-muted-foreground">{t.description}</span>}
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">Manual</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
          <Card>
            <CardContent className="p-4">
              <SectionTitle icon={Activity} title="Network Interfaces & Bandwidth" count={interfaces.length} />
              {interfaces.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Interface</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Type</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Bandwidth</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Throughput</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">Utilization</th>
                        <th className="text-left py-2 px-2 text-muted-foreground font-medium">VLAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {interfaces.map((iface: any, i: number) => {
                        const rxBps = iface.rxBytesPerSec || 0;
                        const txBps = iface.txBytesPerSec || 0;
                        const bwStr = iface.bandwidth || "";
                        const bwMatch = bwStr.match(/([\d.]+)\s*(Gbps|Mbps|Kbps)/i);
                        let linkSpeedBytes = 0;
                        if (bwMatch) {
                          const num = parseFloat(bwMatch[1]);
                          const unit = bwMatch[2].toLowerCase();
                          if (unit === "gbps") linkSpeedBytes = num * 1e9 / 8;
                          else if (unit === "mbps") linkSpeedBytes = num * 1e6 / 8;
                          else if (unit === "kbps") linkSpeedBytes = num * 1e3 / 8;
                        }
                        const totalBps = rxBps + txBps;
                        const computedUtil = linkSpeedBytes > 0 ? Math.min((totalBps / linkSpeedBytes) * 100, 100) : 0;
                        const storedUtilRaw = iface.utilization || "0%";
                        const storedUtil = parseFloat(storedUtilRaw) || 0;
                        const util = computedUtil > 0 ? computedUtil : storedUtil;
                        const hasRealData = totalBps > 0 || storedUtil > 0;
                        const utilDisplay = !hasRealData ? "—" : util < 0.1 && totalBps > 0 ? "<0.1%" : `${util.toFixed(1)}%`;
                        const utilColor = !hasRealData ? "text-muted-foreground/50" : util > 80 ? "text-red-400" : util > 60 ? "text-amber-400" : "text-green-400";
                        const fmtRate = (bytes: number) => {
                          if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB/s`;
                          if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB/s`;
                          if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB/s`;
                          return `${bytes} B/s`;
                        };
                        const hasThroughput = rxBps > 0 || txBps > 0;
                        return (
                          <tr key={i} className="border-b border-border/10 hover:bg-muted/10" data-testid={`interface-row-${i}`}>
                            <td className="py-2 px-2 font-medium">{iface.name}</td>
                            <td className="py-2 px-2 text-muted-foreground">{iface.type}</td>
                            <td className="py-2 px-2">
                              <span className={`flex items-center gap-1 ${iface.status === "active" ? "text-green-400" : iface.status === "standby" ? "text-amber-400" : "text-red-400"}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${iface.status === "active" ? "bg-green-400" : iface.status === "standby" ? "bg-amber-400" : "bg-red-400"}`} />
                                {iface.status}
                              </span>
                            </td>
                            <td className="py-2 px-2">{iface.bandwidth}</td>
                            <td className="py-2 px-2">
                              {hasThroughput ? (
                                <div className="flex items-center gap-2 text-[10px]">
                                  <span className="text-blue-400" title="Download">↓{fmtRate(rxBps)}</span>
                                  <span className="text-emerald-400" title="Upload">↑{fmtRate(txBps)}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                            <td className="py-2 px-2">
                              {hasRealData ? (
                                <div className="flex items-center gap-2">
                                  <Progress value={Math.max(util, totalBps > 0 ? 1 : 0)} className="h-1.5 w-16" />
                                  <span className={utilColor}>{utilDisplay}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40 text-[9px] italic">Awaiting data</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground">{iface.vlan}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {net.streams && (
                <div className="mt-4 pt-3 border-t border-border/20">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Video Streams</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {net.streams.map((s: any, i: number) => (
                      <div key={i} className="p-2 rounded bg-muted/20 border border-border/20 text-[10px]">
                        <span className="font-medium">{s.name}</span>
                        <div className="text-muted-foreground mt-0.5">{s.resolution} @ {s.fps}fps · {s.bitrate}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border/20">
                <DetailField label="VLANs" value={net.vlans} />
                <DetailField label="Port Count" value={net.portCount} />
                <DetailField label="MAC Table Size" value={net.macTableSize} />
                <DetailField label="STP Mode" value={net.stpMode} />
                <DetailField label="Routing Protocol" value={net.routingProtocol} />
                <DetailField label="ECMP" value={net.ecmp} />
                <DetailField label="Active Sessions" value={net.activeSessions} />
                <DetailField label="SSIDs" value={net.ssidCount} />
                <DetailField label="Connected Clients" value={net.connectedClients} />
                <DetailField label="Channel Width" value={net.channelWidth} />
                <DetailField label="VPN Tunnels" value={net.vpnTunnels} />
                <DetailField label="SSL VPN Users" value={net.sslVpnUsers} />
                <DetailField label="IPSec Tunnels" value={net.ipsecTunnels} />
                <DetailField label="Gateway" value={net.gateway} />
                <DetailField label="Default GW" value={net.defaultGateway} />
                <DetailField label="DNS" value={Array.isArray(net.dns) ? net.dns.join(", ") : net.dns} />
                <DetailField label="PoE Capable" value={net.poeCapable} />
                <DetailField label="Layer 3" value={net.layer3Capable} />
                <DetailField label="Endpoints" value={net.endpoints} />
                <DetailField label="AD Users" value={net.adUsers} />
                <DetailField label="Mailboxes" value={net.mailboxes} />
                <DetailField label="Shares" value={net.shares} />
                <DetailField label="Storage Used" value={net.storageUsed} />
                <DetailField label="Recording" value={net.recording} />
                <DetailField label="Retention" value={net.retentionDays ? `${net.retentionDays} days` : undefined} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <SectionTitle icon={Lock} title="Security KPIs" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {kpis.patchCompliance !== undefined && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/20" data-testid="kpi-patch-compliance">
                    <span className="text-[10px] text-muted-foreground">Patch Compliance</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={kpis.patchCompliance} className="h-2 flex-1" />
                      <span className={`text-sm font-bold ${kpis.patchCompliance >= 90 ? "text-green-400" : kpis.patchCompliance >= 70 ? "text-amber-400" : "text-red-400"}`}>{kpis.patchCompliance}%</span>
                    </div>
                  </div>
                )}
                {kpis.configCompliance !== undefined && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/20" data-testid="kpi-config-compliance">
                    <span className="text-[10px] text-muted-foreground">Config Compliance</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={kpis.configCompliance} className="h-2 flex-1" />
                      <span className={`text-sm font-bold ${kpis.configCompliance >= 90 ? "text-green-400" : kpis.configCompliance >= 70 ? "text-amber-400" : "text-red-400"}`}>{kpis.configCompliance}%</span>
                    </div>
                  </div>
                )}
                {kpis.uptimeSla !== undefined && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/20" data-testid="kpi-uptime-sla">
                    <span className="text-[10px] text-muted-foreground">Uptime SLA</span>
                    <p className={`text-sm font-bold mt-1 ${kpis.uptimeSla >= 99.9 ? "text-green-400" : kpis.uptimeSla >= 99 ? "text-amber-400" : "text-red-400"}`}>{kpis.uptimeSla}%</p>
                  </div>
                )}
                {kpis.mttr !== undefined && kpis.mttr !== null && (
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/20" data-testid="kpi-mttr">
                    <span className="text-[10px] text-muted-foreground">MTTR</span>
                    <p className="text-sm font-bold mt-1">{kpis.mttr}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <DetailField label="Last Audit" value={kpis.lastAudit} />
                <DetailField label="Threats Blocked (24h)" value={kpis.threatsBlocked24h || kpis.attacksBlocked24h} />
                <DetailField label="False Positive Rate" value={kpis.falsePositiveRate} />
                <DetailField label="Mean Detection Time" value={kpis.meanDetectionTime} />
                <DetailField label="Open Ports" value={kpis.openPorts} />
                <DetailField label="Firewall Rules" value={kpis.firewallRules} />
                <DetailField label="OWASP Top 10" value={kpis.owaspTop10Coverage} />
                <DetailField label="Bot Traffic Blocked" value={kpis.botTrafficBlocked} />
                <DetailField label="Users Connected" value={kpis.usersConnected} />
                <DetailField label="Apps Protected" value={kpis.appsProtected} />
                <DetailField label="Endpoints Profiled" value={kpis.endpointsProfiled} />
                <DetailField label="Compliance Rate" value={kpis.complianceRate} />
                <DetailField label="Locked Accounts" value={kpis.lockedAccounts} />
                <DetailField label="Failed Logins (24h)" value={kpis.failedLogins24h} />
                <DetailField label="Privileged Accounts" value={kpis.privilegedAccounts} />
                <DetailField label="Spam Blocked (24h)" value={kpis.spamBlocked24h} />
                <DetailField label="Phishing Detected (24h)" value={kpis.phishingDetected24h} />
                <DetailField label="DLP Policies" value={kpis.dlpPolicies} />
                <DetailField label="Image Vulns" value={kpis.imageVulns} />
                <DetailField label="Storage Used" value={kpis.storageUsed} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/20">
                <DetailField label="Access Control" value={sec.accessControl} />
                <DetailField label="Hardening" value={sec.hardening} />
                <DetailField label="Encryption" value={sec.encryption} />
                <DetailField label="Port Security" value={sec.portSecurity} />
                <DetailField label="DHCP Snooping" value={sec.dhcpSnooping} />
                <DetailField label="ARP Inspection" value={sec.arpInspection} />
                <DetailField label="Storm Control" value={sec.stormControl} />
                <DetailField label="MACsec" value={sec.macsec} />
                <DetailField label="SELinux/AppArmor" value={sec.selinux} />
                <DetailField label="Antivirus" value={sec.antivirus} />
                <DetailField label="SSH Config" value={sec.sshConfig} />
                <DetailField label="TLS Version" value={sec.tlsVersion} />
                <DetailField label="Audit Log" value={sec.auditLog} />
                <DetailField label="Credential Guard" value={sec.credentialGuard} />
                <DetailField label="LAPS" value={sec.laps} />
                <DetailField label="Rogue AP Detection" value={sec.rogueApDetection} />
                <DetailField label="WIDS" value={sec.wids} />
                <DetailField label="Firmware Signed" value={sec.firmwareSigned} />
                <DetailField label="Secure Boot" value={sec.secureBootEnabled} />
                <DetailField label="Network Segmentation" value={sec.networkSegmentation} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vulnerabilities" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <SectionTitle icon={Bug} title="Threats & Vulnerabilities" count={vulns.length} />
              {vulns.length === 0 ? (
                <div className="text-center py-6">
                  <ShieldCheck className="h-8 w-8 mx-auto text-green-400/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No known vulnerabilities</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {vulns.map((v: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/20" data-testid={`vuln-${i}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge severity={v.severity} />
                        <span className="text-xs font-mono font-medium">{v.cve}</span>
                        <Badge variant="outline" className={`text-[8px] ml-auto ${
                          v.status === "Patched" ? "bg-green-500/15 text-green-400 border-green-500/30" :
                          v.status === "Open" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                          "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        }`}>{v.status}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">{v.description}</p>
                      {v.patchedDate && <p className="text-[10px] text-green-400/70 mt-1">Patched: {v.patchedDate}</p>}
                      {v.mitigation && <p className="text-[10px] text-amber-400/70 mt-1">Mitigation: {v.mitigation}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pentesting" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <SectionTitle icon={Search} title="Penetration Testing" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {pen.whitebox && <PenTestCard type="White Box" data={pen.whitebox} />}
                {pen.graybox && <PenTestCard type="Gray Box" data={pen.graybox} />}
                {pen.blackbox && <PenTestCard type="Black Box" data={pen.blackbox} />}
              </div>
              {!pen.whitebox && !pen.graybox && !pen.blackbox && (
                <div className="text-center py-6">
                  <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No penetration testing data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications" className="mt-3">
          {apps.length > 0 && (
            <Card className="mb-3">
              <CardContent className="p-4">
                <SectionTitle icon={Zap} title="Mission Critical Applications" count={apps.length} />
                <div className="space-y-2">
                  {apps.map((app: any, i: number) => {
                    const critColor = app.criticality === "Critical" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                      app.criticality === "High" ? "bg-orange-500/15 text-orange-400 border-orange-500/30" :
                      app.criticality === "Medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                      "bg-blue-500/15 text-blue-400 border-blue-500/30";
                    return (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/20" data-testid={`app-${i}`}>
                        <Zap className={`h-3.5 w-3.5 shrink-0 ${
                          app.criticality === "Critical" ? "text-red-400" :
                          app.criticality === "High" ? "text-orange-400" :
                          "text-amber-400"
                        }`} />
                        <span className="text-xs font-medium flex-1">{app.name}</span>
                        <Badge variant="outline" className={`text-[8px] ${critColor}`}>{app.criticality}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
          <InstalledAppsCard
            assetId={asset.id}
            scannedAt={meta.softwareInventoryScannedAt as string | undefined}
            isScanRunning={remediationTasksQuery.data?.some((t: RemediationTask) => t.title.startsWith("[SW_SCAN]") && ["queued", "dispatched", "executing"].includes(t.status))}
            installedApps={(() => {
              const direct = Array.isArray(meta.installedApps) ? meta.installedApps : [];
              const nested = Array.isArray(sw.installedApps) ? sw.installedApps : [];
              const merged = [...direct, ...nested.filter((n: any) => !direct.some((d: any) => d.name === n.name))];
              return merged;
            })()}
          />
        </TabsContent>

        <TabsContent value="compliance" className="mt-3">
          <Card>
            <CardContent className="p-4">
              <SectionTitle icon={ShieldCheck} title="Compliance Frameworks" count={comp.length} />
              {comp.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No compliance data available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {comp.map((c: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/20 border border-border/20" data-testid={`compliance-${i}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold">{c.framework}</span>
                        <ComplianceBadge status={c.status} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Controls: {c.controls}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remediation" className="mt-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <SectionTitle icon={Wrench} title="Remediation Tasks" count={remediationTasksQuery.data?.filter((t: RemediationTask) => ["pending_approval", "queued", "dispatched", "executing"].includes(t.status) && !t.title.startsWith("[SW_SCAN]")).length || 0} />
              {generateRemediation.isPending && (
                <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/20 bg-primary/5 animate-pulse" data-testid="generating-script">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs text-primary">AI is generating a remediation script...</span>
                </div>
              )}
              {(!remediationTasksQuery.data || remediationTasksQuery.data.filter((t: RemediationTask) => !t.title.startsWith("[SW_SCAN]")).length === 0) && !generateRemediation.isPending ? (
                <div className="text-center py-6">
                  <Wrench className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No remediation tasks yet</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Click "Fix" next to a recommended action to generate a script</p>
                </div>
              ) : (() => {
                const allTasks = (remediationTasksQuery.data || []).filter((t: RemediationTask) => !t.title.startsWith("[SW_SCAN]"));
                const activeTasks = allTasks.filter((t: RemediationTask) => ["pending_approval", "queued", "dispatched", "executing"].includes(t.status));
                const historyTasks = allTasks.filter((t: RemediationTask) => ["completed", "failed", "rejected"].includes(t.status));
                const renderTask = (task: RemediationTask) => {
                    const isExpanded = expandedTaskId === task.id;
                    const statusColors: Record<string, string> = {
                      pending_approval: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                      queued: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                      dispatched: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
                      executing: "bg-purple-500/15 text-purple-400 border-purple-500/30",
                      completed: "bg-green-500/15 text-green-400 border-green-500/30",
                      failed: "bg-red-500/15 text-red-400 border-red-500/30",
                      rejected: "bg-muted/30 text-muted-foreground border-border/30",
                    };
                    const statusLabels: Record<string, string> = {
                      pending_approval: "Pending Approval",
                      queued: "Queued",
                      dispatched: "Dispatched to Probe",
                      executing: "Executing",
                      completed: "Completed",
                      failed: "Failed",
                      rejected: "Rejected",
                    };

                    return (
                      <div key={task.id} className="rounded-lg border border-border/20 overflow-hidden" data-testid={`remediation-task-${task.id}`}>
                        <div className="p-3 bg-muted/10">
                          <div className="flex items-start gap-2">
                            <Code className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium truncate">{task.title}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className={`text-[8px] ${statusColors[task.status] || ""}`} data-testid={`task-status-${task.id}`}>
                                  {task.status === "executing" && <Loader2 className="h-2 w-2 animate-spin mr-0.5" />}
                                  {statusLabels[task.status] || task.status}
                                </Badge>
                                <Badge variant="outline" className="text-[8px]">{task.scriptType}</Badge>
                                {task.createdAt && <span className="text-[8px] text-muted-foreground">{new Date(task.createdAt).toLocaleString()}</span>}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0"
                              onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                              data-testid={`btn-expand-task-${task.id}`}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>

                          {task.status === "pending_approval" && (
                            <div className="flex gap-2 mt-2" data-testid={`task-actions-${task.id}`}>
                              <Button
                                size="sm"
                                className="h-7 text-[10px] gap-1 bg-green-600 hover:bg-green-700"
                                onClick={() => approveTask.mutate(task.id)}
                                disabled={approveTask.isPending}
                                data-testid={`btn-approve-${task.id}`}
                              >
                                <ThumbsUp className="h-3 w-3" />
                                Approve & Deploy
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                                onClick={() => rejectTask.mutate(task.id)}
                                disabled={rejectTask.isPending}
                                data-testid={`btn-reject-${task.id}`}
                              >
                                <ThumbsDown className="h-3 w-3" />
                                Reject
                              </Button>
                            </div>
                          )}

                          {["queued", "dispatched", "executing"].includes(task.status) && (
                            <>
                              <div className="mt-3 mb-2" data-testid={`task-pipeline-${task.id}`}>
                                <div className="flex items-center gap-0">
                                  {[
                                    { key: "queued", label: "Queued", icon: Clock },
                                    { key: "dispatched", label: "Sent to Probe", icon: Radio },
                                    { key: "executing", label: "Executing", icon: Zap },
                                    { key: "completed", label: "Applied", icon: CheckCircle2 },
                                  ].map((step, i) => {
                                    const stageOrder = ["queued", "dispatched", "executing", "completed"];
                                    const currentIdx = stageOrder.indexOf(task.status);
                                    const stepIdx = stageOrder.indexOf(step.key);
                                    const isComplete = stepIdx < currentIdx;
                                    const isCurrent = stepIdx === currentIdx;
                                    const StepIcon = step.icon;
                                    return (
                                      <div key={step.key} className="flex items-center flex-1">
                                        <div className="flex flex-col items-center gap-0.5 flex-1">
                                          <div className={`h-5 w-5 rounded-full flex items-center justify-center border ${
                                            isComplete ? "bg-green-600 border-green-500" :
                                            isCurrent ? "bg-primary border-primary animate-pulse" :
                                            "bg-muted/20 border-border/30"
                                          }`}>
                                            {isCurrent && step.key === "executing" ? (
                                              <Loader2 className="h-2.5 w-2.5 text-white animate-spin" />
                                            ) : (
                                              <StepIcon className={`h-2.5 w-2.5 ${isComplete || isCurrent ? "text-white" : "text-muted-foreground/50"}`} />
                                            )}
                                          </div>
                                          <span className={`text-[7px] ${isComplete ? "text-green-400" : isCurrent ? "text-primary font-semibold" : "text-muted-foreground/50"}`}>
                                            {step.label}
                                          </span>
                                        </div>
                                        {i < 3 && (
                                          <div className={`h-[2px] flex-1 -mt-3 ${isComplete ? "bg-green-600" : "bg-border/20"}`} />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {task.status === "dispatched" && task.dispatchedAt && (() => {
                                  const secsAgo = Math.round((Date.now() - new Date(task.dispatchedAt).getTime()) / 1000);
                                  const isStale = secsAgo > 120;
                                  return isStale ? (
                                    <div className="mt-1.5">
                                      <p className="text-[8px] text-red-400 flex items-center gap-1">
                                        <AlertTriangle className="h-2 w-2" />
                                        No response after {Math.round(secsAgo / 60)}m — probe may be offline or script failed silently
                                      </p>
                                      <p className="text-[7px] text-muted-foreground mt-0.5">Reset to re-dispatch when probe reconnects, or mark completed if done manually</p>
                                    </div>
                                  ) : (
                                    <p className="text-[8px] text-amber-400 mt-1.5 flex items-center gap-1">
                                      <Loader2 className="h-2 w-2 animate-spin" />
                                      Waiting for probe to pick up... (sent {new Date(task.dispatchedAt).toLocaleTimeString()})
                                    </p>
                                  );
                                })()}
                                {task.status === "executing" && (
                                  <p className="text-[8px] text-blue-400 mt-1.5 flex items-center gap-1">
                                    <Loader2 className="h-2 w-2 animate-spin" />
                                    Script is running on the probe...
                                  </p>
                                )}
                                {task.status === "queued" && (
                                  <p className="text-[8px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                    <Clock className="h-2 w-2" />
                                    Will be sent to probe on next heartbeat
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2 mt-1 flex-wrap" data-testid={`task-stuck-actions-${task.id}`}>
                                {["dispatched", "executing"].includes(task.status) && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-[10px] gap-1 bg-blue-600 hover:bg-blue-700"
                                    onClick={() => resetTask.mutate(task.id)}
                                    disabled={resetTask.isPending}
                                    data-testid={`btn-reset-task-${task.id}`}
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Reset to Queue
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  className="h-7 text-[10px] gap-1 bg-amber-600 hover:bg-amber-700"
                                  onClick={() => forceComplete.mutate(task.id)}
                                  disabled={forceComplete.isPending}
                                  data-testid={`btn-force-complete-${task.id}`}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Mark as Completed
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px] gap-1 text-red-400 border-red-500/30 hover:bg-red-500/10"
                                  onClick={() => cancelTask.mutate(task.id)}
                                  disabled={cancelTask.isPending}
                                  data-testid={`btn-cancel-stuck-${task.id}`}
                                >
                                  <XCircle className="h-3 w-3" />
                                  Cancel
                                </Button>
                              </div>
                            </>
                          )}

                          {task.status === "completed" && (
                            <div className="mt-2 p-2 rounded bg-green-500/5 border border-green-500/20">
                              <div className="flex items-center gap-1.5 mb-1">
                                <CheckCircle2 className="h-3 w-3 text-green-400" />
                                <p className="text-[9px] font-semibold text-green-400">Remediation Applied</p>
                                {task.completedAt && (
                                  <span className="text-[8px] text-green-400/60 ml-auto">{new Date(task.completedAt).toLocaleString()}</span>
                                )}
                              </div>
                              {task.result && (
                                <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap font-mono max-h-24 overflow-y-auto" data-testid={`task-result-${task.id}`}>{task.result}</pre>
                              )}
                              {task.rollbackScript && !task.rollbackStatus && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2 h-7 text-[10px] gap-1 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 w-full"
                                  onClick={() => rollbackTask.mutate(task.id)}
                                  disabled={rollbackTask.isPending}
                                  data-testid={`btn-rollback-${task.id}`}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  Rollback Changes
                                </Button>
                              )}
                              {task.rollbackStatus && <RollbackStatus task={task} />}
                            </div>
                          )}

                          {task.status === "failed" && (
                            <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/20">
                              <div className="flex items-center gap-1.5 mb-1">
                                <XCircle className="h-3 w-3 text-red-400" />
                                <p className="text-[9px] font-semibold text-red-400">Execution Failed</p>
                                {task.completedAt && (
                                  <span className="text-[8px] text-red-400/60 ml-auto">{new Date(task.completedAt).toLocaleString()}</span>
                                )}
                              </div>
                              {task.error && (
                                <pre className="text-[9px] text-red-300 whitespace-pre-wrap font-mono max-h-24 overflow-y-auto" data-testid={`task-error-${task.id}`}>{task.error}</pre>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  className="h-7 text-[10px] gap-1 bg-primary hover:bg-primary/90 flex-1"
                                  onClick={() => retryTask.mutate(task.id)}
                                  disabled={retryTask.isPending}
                                  data-testid={`btn-retry-${task.id}`}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Retry
                                </Button>
                                {task.rollbackScript && !task.rollbackStatus && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-[10px] gap-1 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 flex-1"
                                    onClick={() => rollbackTask.mutate(task.id)}
                                    disabled={rollbackTask.isPending}
                                    data-testid={`btn-rollback-failed-${task.id}`}
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Rollback
                                  </Button>
                                )}
                              </div>
                              {task.rollbackStatus && <RollbackStatus task={task} />}
                            </div>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="border-t border-border/20 p-3 bg-black/20 space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Remediation Script</p>
                                <Badge variant="outline" className="text-[8px]">{task.scriptType}</Badge>
                              </div>
                              <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap font-mono p-3 rounded bg-black/40 border border-border/10 max-h-64 overflow-y-auto" data-testid={`task-script-${task.id}`}>
                                {task.remediationScript}
                              </pre>
                            </div>
                            {(task as any).rollbackScript && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-1">
                                    <RotateCcw className="h-3 w-3 text-amber-400" />
                                    <p className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider">Rollback Script</p>
                                  </div>
                                  <Badge variant="outline" className="text-[8px] text-amber-400 border-amber-500/30">{task.scriptType}</Badge>
                                </div>
                                <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap font-mono p-3 rounded bg-amber-500/5 border border-amber-500/10 max-h-48 overflow-y-auto" data-testid={`task-rollback-script-${task.id}`}>
                                  {(task as any).rollbackScript}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };
                  return (
                    <div className="space-y-3">
                      {activeTasks.length > 0 && (
                        <div className="space-y-2">
                          {activeTasks.map(renderTask)}
                        </div>
                      )}
                      {activeTasks.length === 0 && historyTasks.length > 0 && (
                        <div className="text-center py-3">
                          <CheckCircle2 className="h-6 w-6 mx-auto text-green-500/40 mb-1" />
                          <p className="text-[10px] text-muted-foreground">All remediation tasks completed</p>
                        </div>
                      )}
                      {historyTasks.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/20">
                          <div className="flex items-center justify-between">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[9px] gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => setShowHistory(!showHistory)}
                              data-testid="btn-toggle-history"
                            >
                              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              History ({historyTasks.length})
                            </Button>
                            {showHistory && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[9px] gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={() => clearCompleted.mutate()}
                                disabled={clearCompleted.isPending}
                                data-testid="btn-clear-history"
                              >
                                <Trash2 className="h-3 w-3" />
                                Clear History
                              </Button>
                            )}
                          </div>
                          {showHistory && (
                            <div className="space-y-2 mt-2">
                              {historyTasks.map(renderTask)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ITSM 360° ──────────────────────────────────────────────── */}
        <TabsContent value="itsm" className="mt-3 space-y-4">
          {contextQuery.isLoading ? (
            <Card><CardContent className="p-6 text-center text-xs text-muted-foreground">Loading ITSM records…</CardContent></Card>
          ) : (() => {
            const ctx = contextQuery.data?.itsm;
            const sevColor: Record<string, string> = { critical: "text-red-600", high: "text-orange-500", medium: "text-yellow-500", low: "text-green-500" };
            const priColor: Record<string, string> = { critical: "text-red-600", high: "text-orange-500", medium: "text-yellow-500", low: "text-green-500" };
            const statusBadge = (s: string) => {
              const m: Record<string, string> = { open: "bg-red-100 text-red-700 dark:bg-red-900/30", in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30", resolved: "bg-green-100 text-green-700 dark:bg-green-900/30", closed: "bg-gray-100 text-gray-500 dark:bg-gray-800", draft: "bg-slate-100 text-slate-600 dark:bg-slate-800", approved: "bg-green-100 text-green-700 dark:bg-green-900/30", implementing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30", completed: "bg-green-100 text-green-700 dark:bg-green-900/30", pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30" };
              return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${m[s] ?? "bg-muted text-muted-foreground"}`}>{s.replace("_", " ")}</span>;
            };
            return (
              <>
                {/* Incidents */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="text-xs font-semibold">Related Incidents</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{ctx?.incidents.length ?? 0}</Badge>
                    </div>
                    {!ctx?.incidents.length ? (
                      <p className="text-[11px] text-muted-foreground italic">No related incidents found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[500px]">
                          <thead><tr className="border-b text-muted-foreground">{["Severity","Status","Category","Title","Opened"].map(h => <th key={h} className="text-left p-1.5 font-medium text-[10px]">{h}</th>)}</tr></thead>
                          <tbody>
                            {ctx.incidents.map(i => (
                              <tr key={i.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-itsm-incident-${i.id}`}>
                                <td className="p-1.5 whitespace-nowrap"><span className={`font-medium ${sevColor[i.severity] ?? ""}`}>{i.severity}</span></td>
                                <td className="p-1.5 whitespace-nowrap">{statusBadge(i.status)}</td>
                                <td className="p-1.5 whitespace-nowrap text-muted-foreground">{i.category}</td>
                                <td className="p-1.5 max-w-[200px] truncate" title={i.title}>{i.title}</td>
                                <td className="p-1.5 whitespace-nowrap text-muted-foreground">{i.createdAt ? new Date(i.createdAt).toLocaleDateString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Problems */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileWarning className="h-4 w-4 text-orange-500 shrink-0" />
                      <span className="text-xs font-semibold">Related Problems</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{ctx?.problems.length ?? 0}</Badge>
                    </div>
                    {!ctx?.problems.length ? (
                      <p className="text-[11px] text-muted-foreground italic">No related problems found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[500px]">
                          <thead><tr className="border-b text-muted-foreground">{["Priority","Status","Category","Title","Created"].map(h => <th key={h} className="text-left p-1.5 font-medium text-[10px]">{h}</th>)}</tr></thead>
                          <tbody>
                            {ctx.problems.map(p => (
                              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-itsm-problem-${p.id}`}>
                                <td className="p-1.5 whitespace-nowrap"><span className={`font-medium ${priColor[p.priority] ?? ""}`}>{p.priority}</span></td>
                                <td className="p-1.5 whitespace-nowrap">{statusBadge(p.status)}</td>
                                <td className="p-1.5 whitespace-nowrap text-muted-foreground">{p.category}</td>
                                <td className="p-1.5 max-w-[200px] truncate" title={p.title}>{p.title}</td>
                                <td className="p-1.5 whitespace-nowrap text-muted-foreground">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Change Requests */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <GitCommit className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-xs font-semibold">Related Change Requests</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{ctx?.changes.length ?? 0}</Badge>
                    </div>
                    {!ctx?.changes.length ? (
                      <p className="text-[11px] text-muted-foreground italic">No related change requests found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[500px]">
                          <thead><tr className="border-b text-muted-foreground">{["Type","Risk","Status","Title","Scheduled"].map(h => <th key={h} className="text-left p-1.5 font-medium text-[10px]">{h}</th>)}</tr></thead>
                          <tbody>
                            {ctx.changes.map(c => (
                              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-itsm-change-${c.id}`}>
                                <td className="p-1.5 whitespace-nowrap capitalize">{c.type}</td>
                                <td className="p-1.5 whitespace-nowrap"><span className={`font-medium ${priColor[c.riskLevel] ?? ""}`}>{c.riskLevel}</span></td>
                                <td className="p-1.5 whitespace-nowrap">{statusBadge(c.status)}</td>
                                <td className="p-1.5 max-w-[200px] truncate" title={c.title}>{c.title}</td>
                                <td className="p-1.5 whitespace-nowrap text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Service Requests */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Ticket className="h-4 w-4 text-purple-500 shrink-0" />
                      <span className="text-xs font-semibold">Related Service Requests</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{ctx?.serviceRequests.length ?? 0}</Badge>
                    </div>
                    {!ctx?.serviceRequests.length ? (
                      <p className="text-[11px] text-muted-foreground italic">No related service requests found</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[500px]">
                          <thead><tr className="border-b text-muted-foreground">{["Type","Priority","Status","Title","Raised"].map(h => <th key={h} className="text-left p-1.5 font-medium text-[10px]">{h}</th>)}</tr></thead>
                          <tbody>
                            {ctx.serviceRequests.map(sr => (
                              <tr key={sr.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-itsm-sr-${sr.id}`}>
                                <td className="p-1.5 whitespace-nowrap capitalize">{sr.type}</td>
                                <td className="p-1.5 whitespace-nowrap"><span className={`font-medium ${priColor[sr.priority] ?? ""}`}>{sr.priority}</span></td>
                                <td className="p-1.5 whitespace-nowrap">{statusBadge(sr.status)}</td>
                                <td className="p-1.5 max-w-[200px] truncate" title={sr.title}>{sr.title}</td>
                                <td className="p-1.5 whitespace-nowrap text-muted-foreground">{sr.createdAt ? new Date(sr.createdAt).toLocaleDateString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        {/* ── Vendor & Contract ───────────────────────────────────────── */}
        <TabsContent value="vendor-contract" className="mt-3 space-y-4">
          {contextQuery.isLoading ? (
            <Card><CardContent className="p-6 text-center text-xs text-muted-foreground">Loading vendor data…</CardContent></Card>
          ) : (() => {
            const ctx = contextQuery.data?.vendor;
            const riskColor: Record<string, string> = { critical: "text-red-600", high: "text-orange-500", medium: "text-yellow-600", low: "text-green-600" };
            return (
              <>
                {/* Suppliers */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold">Matched Suppliers</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{ctx?.suppliers.length ?? 0}</Badge>
                    </div>
                    {!ctx?.suppliers.length ? (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground italic">No supplier record matched vendor "{asset.vendor ?? "unknown"}"</p>
                        <p className="text-[10px] text-muted-foreground">Add a supplier with this vendor name in Supplier Management to link them automatically.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {ctx.suppliers.map(s => (
                          <div key={s.id} className="border rounded-lg p-3 space-y-2" data-testid={`card-supplier-${s.id}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold">{s.name}</p>
                                <p className="text-[10px] text-muted-foreground">{s.category}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <Badge variant="outline" className="text-[9px]">{s.status}</Badge>
                                <span className={`text-[9px] font-medium ${riskColor[s.riskTier] ?? ""}`}>Risk: {s.riskTier}</span>
                              </div>
                            </div>
                            {s.contactEmail && <p className="text-[10px] text-muted-foreground">Contact: {s.contactEmail}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Contracts */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold">Active Contracts</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{ctx?.contracts.length ?? 0}</Badge>
                    </div>
                    {!ctx?.contracts.length ? (
                      <p className="text-[11px] text-muted-foreground italic">No contracts linked to this vendor</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[560px]">
                          <thead><tr className="border-b text-muted-foreground">{["Contract","Status","Value","Expiry","SLA Uptime","Actual"].map(h => <th key={h} className="text-left p-1.5 font-medium text-[10px]">{h}</th>)}</tr></thead>
                          <tbody>
                            {ctx.contracts.map(c => {
                              const slaOk = c.actualUptime !== null && c.slaUptimeTarget !== null && c.actualUptime >= c.slaUptimeTarget;
                              return (
                                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-contract-${c.id}`}>
                                  <td className="p-1.5 max-w-[160px] truncate font-medium" title={c.name}>{c.name}</td>
                                  <td className="p-1.5 whitespace-nowrap"><Badge variant="outline" className="text-[9px]">{c.status}</Badge></td>
                                  <td className="p-1.5 whitespace-nowrap">{c.currency} {c.contractValue.toLocaleString()}</td>
                                  <td className="p-1.5 whitespace-nowrap text-muted-foreground">{new Date(c.endDate).toLocaleDateString()}</td>
                                  <td className="p-1.5 whitespace-nowrap">{c.slaUptimeTarget !== null ? `${c.slaUptimeTarget}%` : "—"}</td>
                                  <td className="p-1.5 whitespace-nowrap">
                                    {c.actualUptime !== null ? (
                                      <span className={slaOk ? "text-green-600" : "text-red-500"}>{c.actualUptime}%</span>
                                    ) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

        {/* ── SLA & Finance ───────────────────────────────────────────── */}
        <TabsContent value="sla-finance" className="mt-3 space-y-4">
          {contextQuery.isLoading ? (
            <Card><CardContent className="p-6 text-center text-xs text-muted-foreground">Loading SLA & financial data…</CardContent></Card>
          ) : (() => {
            const sla = contextQuery.data?.sla;
            const fin = contextQuery.data?.financial;
            const priColor: Record<string, string> = { critical: "text-red-600", high: "text-orange-500", medium: "text-yellow-500", low: "text-green-500" };
            return (
              <>
                {/* SLA Definitions */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-xs font-semibold">Applicable SLAs / OLAs</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{sla?.definitions.length ?? 0}</Badge>
                    </div>
                    {!sla?.definitions.length ? (
                      <p className="text-[11px] text-muted-foreground italic">No SLA definitions matched this asset type</p>
                    ) : (
                      <div className="space-y-2">
                        {sla.definitions.map(d => (
                          <div key={d.id} className="border rounded-lg p-3" data-testid={`card-sla-${d.id}`}>
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div>
                                <p className="text-xs font-semibold">{d.name}</p>
                                {d.serviceScope && <p className="text-[10px] text-muted-foreground">{d.serviceScope}</p>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Badge variant="outline" className="text-[9px] uppercase">{d.agreementType}</Badge>
                                <span className={`text-[9px] font-medium ${priColor[d.priority] ?? ""}`}>{d.priority}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <div className="bg-muted/30 rounded p-2">
                                <p className="text-[9px] text-muted-foreground">Response Time</p>
                                <p className="text-xs font-semibold">{d.responseTimeMinutes < 60 ? `${d.responseTimeMinutes}m` : `${Math.round(d.responseTimeMinutes / 60)}h`}</p>
                              </div>
                              <div className="bg-muted/30 rounded p-2">
                                <p className="text-[9px] text-muted-foreground">Resolution Time</p>
                                <p className="text-xs font-semibold">{d.resolutionTimeMinutes < 60 ? `${d.resolutionTimeMinutes}m` : `${Math.round(d.resolutionTimeMinutes / 60)}h`}</p>
                              </div>
                              {d.counterparty && (
                                <div className="bg-muted/30 rounded p-2">
                                  <p className="text-[9px] text-muted-foreground">Counterparty</p>
                                  <p className="text-xs font-semibold truncate">{d.counterparty}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* SLA Breaches */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="text-xs font-semibold">Recent SLA Breaches</span>
                      <Badge variant={sla?.breaches.length ? "destructive" : "secondary"} className="text-[9px] ml-auto">{sla?.breaches.length ?? 0}</Badge>
                    </div>
                    {!sla?.breaches.length ? (
                      <p className="text-[11px] text-muted-foreground italic">No SLA breaches recorded for this asset</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[480px]">
                          <thead><tr className="border-b text-muted-foreground">{["Priority","Type","Overshoot","Reference","When"].map(h => <th key={h} className="text-left p-1.5 font-medium text-[10px]">{h}</th>)}</tr></thead>
                          <tbody>
                            {sla.breaches.map(b => (
                              <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-sla-breach-${b.id}`}>
                                <td className="p-1.5 whitespace-nowrap"><span className={`font-medium ${priColor[b.priority] ?? ""}`}>{b.priority}</span></td>
                                <td className="p-1.5 whitespace-nowrap capitalize">{b.breachType.replace("_", " ")}</td>
                                <td className="p-1.5 whitespace-nowrap text-red-500">+{b.breachMinutes < 60 ? `${b.breachMinutes}m` : `${Math.round(b.breachMinutes / 60)}h`}</td>
                                <td className="p-1.5 max-w-[160px] truncate text-muted-foreground" title={b.entityRef ?? ""}>{b.entityRef ?? "—"}</td>
                                <td className="p-1.5 whitespace-nowrap text-muted-foreground">{b.occurredAt ? new Date(b.occurredAt).toLocaleDateString() : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Financial */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-xs font-semibold">Service Cost Allocation</span>
                      <Badge variant="secondary" className="text-[9px] ml-auto">{fin?.services.length ?? 0}</Badge>
                    </div>
                    {!fin?.services.length ? (
                      <p className="text-[11px] text-muted-foreground italic">No financial records linked to this asset type</p>
                    ) : (
                      <div className="space-y-2">
                        {fin.services.map(f => {
                          const pct = f.annualBudget > 0 ? Math.min(100, Math.round((f.ytdSpend / f.annualBudget) * 100)) : 0;
                          const over = pct >= 100;
                          return (
                            <div key={f.id} className="border rounded-lg p-3 space-y-2" data-testid={`card-financial-${f.id}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold">{f.serviceName}</p>
                                  <p className="text-[10px] text-muted-foreground">{f.costCenter} · {f.costModel}</p>
                                </div>
                                <span className={`text-[10px] font-bold shrink-0 ${over ? "text-red-500" : "text-green-600"}`}>{pct}% used</span>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all ${over ? "bg-red-500" : "bg-green-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
                                <div><p className="text-muted-foreground">Budget</p><p className="font-semibold">{f.currency} {f.annualBudget.toLocaleString()}</p></div>
                                <div><p className="text-muted-foreground">YTD Spend</p><p className="font-semibold">{f.currency} {f.ytdSpend.toLocaleString()}</p></div>
                                <div><p className="text-muted-foreground">Run Rate/mo</p><p className="font-semibold">{f.currency} {Math.round(f.ytdSpend / 12).toLocaleString()}</p></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>

      </Tabs>
    </div>
  );
}

export default function NetworkOpsAssets() {
  const PAGE_SIZE = 10;
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [protocolFilter, setProtocolFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [probeFilter, setProbeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  const { data: assets } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const { data: probes } = useQuery<DiscoveryProbe[]>({ queryKey: ["/api/discovery-probes"] });
  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });

  const aiAgentMap = useMemo(() => {
    const map = new Map<string, string>();
    if (roles && subscriptions) {
      subscriptions.filter(s => s.hasAiShadow).forEach(s => {
        const role = roles.find(r => r.id === s.roleId);
        if (role) map.set(role.id, role.name);
      });
    }
    return map;
  }, [roles, subscriptions]);

  const probeMap = useMemo(() => {
    const map = new Map<string, string>();
    probes?.forEach(p => map.set(p.id, p.name));
    return map;
  }, [probes]);

  const filtered = useMemo(() => {
    if (!assets) return [];
    return assets.filter(a => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (protocolFilter !== "all" && a.protocol !== protocolFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (probeFilter !== "all" && a.probeId !== probeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = a.name?.toLowerCase().includes(q);
        const ipMatch = a.ipAddress?.toLowerCase().includes(q);
        const vendorMatch = a.vendor?.toLowerCase().includes(q);
        const modelMatch = a.model?.toLowerCase().includes(q);
        if (!nameMatch && !ipMatch && !vendorMatch && !modelMatch) return false;
      }
      return true;
    });
  }, [assets, typeFilter, protocolFilter, statusFilter, probeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedAssets = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const startItem = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const endItem = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  useEffect(() => {
    setPage(0);
  }, [typeFilter, protocolFilter, statusFilter, probeFilter, searchQuery]);

  const types = useMemo(() => [...new Set(assets?.map(a => a.type) || [])].sort(), [assets]);
  const protocols = useMemo(() => [...new Set(assets?.map(a => a.protocol).filter(Boolean) || [])].sort(), [assets]);
  const onlineCount = assets?.filter(a => a.status === "online").length ?? 0;
  const offlineCount = assets?.filter(a => a.status === "offline").length ?? 0;
  const selected = selectedAsset ? assets?.find(a => a.id === selectedAsset) : null;

  if (selected) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 max-w-6xl mx-auto">
          <AssetDetailPanel
            asset={selected}
            probeMap={probeMap}
            aiAgentMap={aiAgentMap}
            probes={probes || []}
            onClose={() => setSelectedAsset(null)}
          />
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MonitorSmartphone className="h-4 w-4 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Assets</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-total-assets">{assets?.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Online</span>
              </div>
              <p className="text-2xl font-bold text-green-400" data-testid="stat-online-assets">{onlineCount}</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Offline</span>
              </div>
              <p className="text-2xl font-bold text-red-400" data-testid="stat-offline-assets">{offlineCount}</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Network className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Protocols</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-asset-protocols">{protocols.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2 flex-wrap" data-testid="asset-filters">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 h-8 text-xs rounded-md bg-muted/30 border border-border/50 w-[200px] focus:outline-none focus:border-primary/50"
              data-testid="input-search-assets"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="filter-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {types.map(t => (
                <SelectItem key={t} value={t}>{typeConfig[t]?.label || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={protocolFilter} onValueChange={setProtocolFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="filter-protocol">
              <SelectValue placeholder="Protocol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Protocols</SelectItem>
              {protocols.map(p => (
                <SelectItem key={p!} value={p!}>{protocolLabels[p!] || p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
          <Select value={probeFilter} onValueChange={setProbeFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="filter-probe">
              <SelectValue placeholder="Probe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Probes</SelectItem>
              {probes?.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-[10px] ml-auto" data-testid="text-filtered-count">
            {filtered.length} of {assets?.length ?? 0} assets
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginatedAssets.map(asset => {
            const tc = typeConfig[asset.type] || typeConfig.server;
            const TypeIcon = tc.icon;
            const sc = statusConfig[asset.status] || statusConfig.unknown;
            const StatusIcon = sc.icon;
            const agentName = asset.assignedAgentRoleId ? aiAgentMap.get(asset.assignedAgentRoleId) : null;
            const probeName = asset.probeId ? probeMap.get(asset.probeId) : null;
            const meta = (asset.metadata || {}) as Record<string, any>;
            const vulnCount = (meta.vulnerabilities || []).length;
            const compCount = (meta.compliance || []).length;
            const assetProbe = asset.probeId && probes ? probes.find(p => p.id === asset.probeId) : null;
            const sUtil = meta.systemUtilization as { cpu?: number; memory?: number; disk?: number } | undefined;
            const cardCpu = assetProbe?.cpuUsage ?? sUtil?.cpu;
            const cardMem = assetProbe?.memoryUsage ?? sUtil?.memory;
            const cardDisk = assetProbe?.diskUsage ?? sUtil?.disk;
            const probMetrics = [cardCpu, cardMem, cardDisk].filter(v => v !== null && v !== undefined);
            const hasProbUtil = probMetrics.length > 0;

            return (
              <Card
                key={asset.id}
                className="cursor-pointer transition-all hover:border-primary/20"
                onClick={() => setSelectedAsset(asset.id)}
                data-testid={`asset-${asset.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${tc.color}`}>
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold truncate" data-testid={`asset-name-${asset.id}`}>{asset.name}</h4>
                        <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${sc.color}`} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">{tc.label}</Badge>
                        {asset.protocol && <Badge variant="outline" className="text-[9px]">{protocolLabels[asset.protocol] || asset.protocol}</Badge>}
                        {vulnCount > 0 && <Badge variant="outline" className="text-[8px] bg-amber-500/10 text-amber-400 border-amber-500/20">{vulnCount} vulns</Badge>}
                        {compCount > 0 && <Badge variant="outline" className="text-[8px] bg-green-500/10 text-green-400 border-green-500/20">{compCount} frameworks</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                        {asset.vendor && <span>{asset.vendor} {asset.model}</span>}
                        {asset.ipAddress && <span>{asset.ipAddress}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {agentName && (
                          <Badge variant="outline" className="text-[8px] gap-1 bg-primary/10 text-primary border-primary/20">
                            <Bot className="h-2 w-2" /> {agentName}
                          </Badge>
                        )}
                        {probeName && (
                          <Badge variant="outline" className="text-[8px] gap-1">
                            <Radar className="h-2 w-2" /> {probeName}
                          </Badge>
                        )}
                      </div>
                      {hasProbUtil && (
                        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/10" data-testid={`util-mini-${asset.id}`}>
                          {[
                            { label: "CPU", val: cardCpu },
                            { label: "MEM", val: cardMem },
                            { label: "DISK", val: cardDisk },
                          ].filter(m => m.val !== null && m.val !== undefined).map(m => {
                            const v = m.val as number;
                            const c = v >= 90 ? "bg-red-500" : v >= 70 ? "bg-amber-500" : "bg-green-500";
                            const tc2 = v >= 90 ? "text-red-400" : v >= 70 ? "text-amber-400" : "text-green-400";
                            return (
                              <div key={m.label} className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[8px] text-muted-foreground">{m.label}</span>
                                  <span className={`text-[8px] font-medium ${tc2}`}>{Math.round(v)}%</span>
                                </div>
                                <div className="h-1 rounded-full bg-black/20 overflow-hidden">
                                  <div className={`h-full rounded-full ${c}`} style={{ width: `${v}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-4 pt-2" data-testid="pagination-footer">
            <span className="text-xs text-muted-foreground" data-testid="text-showing-range">
              Showing {startItem}–{endItem} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={safePage === 0}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i}
                  variant={i === safePage ? "default" : "outline"}
                  size="icon"
                  onClick={() => setPage(i)}
                  data-testid={`button-page-${i}`}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
