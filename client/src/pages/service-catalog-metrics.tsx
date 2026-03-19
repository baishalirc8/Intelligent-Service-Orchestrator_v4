import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, Shield, Cpu, HardDrive, Clock, Lock, ShieldCheck,
  CheckCircle2, Bug, Box, ScanSearch, Wrench, Server, Gauge,
  Plus, Search, ChevronDown, ChevronUp, Trash2, Edit2,
  AlertTriangle, Zap, Radio, Eye, Layers, MonitorSmartphone,
  Timer, Database, XCircle, Settings, ArrowRight, Globe,
  Brain, Sparkles, Loader2, LayoutDashboard, DollarSign,
  Calculator, TrendingUp, Info, RefreshCw, BarChart3,
  Plug, TestTube, Star, Power, EyeOff, Check,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useState, useMemo, useEffect, useCallback } from "react";
import type { ServiceMetric, ServiceMetricAssignment, MissionCriticalGroup, DiscoveredAsset, AgentMetricProfile, AiTemplateCache } from "@shared/schema";

type OrgRole = {
  id: string; name: string; title: string; department: string; division: string | null;
  level: string; description: string; responsibilities: string[]; aiCapabilities: string[];
  icon: string; color: string;
};
type RoleSubscription = {
  id: string; userId: string; roleId: string; status: string;
  assignedHumanName: string | null; hasAiShadow: boolean;
};
type EnrichedProfile = AgentMetricProfile & { metric: ServiceMetric | null };

const iconMap: Record<string, typeof Activity> = {
  Activity, Shield, Cpu, HardDrive, Clock, Lock, ShieldCheck,
  CheckCircle2, Bug, Box, ScanSearch, Wrench, Server, Gauge,
  AlertTriangle, Zap, Radio, Eye, Layers, MonitorSmartphone,
  Timer, Database, Globe, Settings,
};

const modeConfig: Record<string, { label: string; color: string; bg: string }> = {
  continuous: { label: "Continuous", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
  scheduled: { label: "Scheduled", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
  on_demand: { label: "On-Demand", color: "text-amber-400", bg: "bg-amber-500/20 border-amber-500/30" },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  health: { label: "Health", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  security: { label: "Security", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  performance: { label: "Performance", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  compliance: { label: "Compliance", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  availability: { label: "Availability", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
};

function formatInterval(s: number | null) {
  if (!s) return "—";
  if (s >= 3600) return `${Math.round(s / 3600)}h`;
  if (s >= 60) return `${Math.round(s / 60)}m`;
  return `${s}s`;
}

const GPT4O_INPUT_PER_1K = 0.0025;
const GPT4O_OUTPUT_PER_1K = 0.01;

const AI_CALL_CATALOG = [
  {
    id: "agent-profile",
    name: "Agent Profile Generation",
    description: "Generates metric assignments and operational profiles for AI agents",
    trigger: "Per agent role, on-demand",
    inputTokens: 2000,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "setup",
  },
  {
    id: "metric-assignment",
    name: "Service Metric Assignment",
    description: "AI determines which service metrics should be assigned to each device",
    trigger: "Per asset, on-demand scan",
    inputTokens: 1500,
    outputTokens: 1500,
    maxTokens: 1500,
    category: "setup",
  },
  {
    id: "operational-insights",
    name: "Operational Insights",
    description: "Cross-agent operational analysis and insight generation",
    trigger: "Per agent role, on-demand",
    inputTokens: 2500,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "analysis",
  },
  {
    id: "variation-calibration",
    name: "Variation Calibration",
    description: "Analyzes metric thresholds and recommends optimal calibration to reduce false positives",
    trigger: "Per calibration request",
    inputTokens: 1500,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "analysis",
  },
  {
    id: "root-cause-analysis",
    name: "Root Cause Analysis",
    description: "Correlates events across assets and determines probable root cause using ITIL methodology",
    trigger: "Per event cluster",
    inputTokens: 2000,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "operations",
  },
  {
    id: "app-discovery",
    name: "Application Discovery",
    description: "Discovers applications, services, and processes running on each asset",
    trigger: "Per discovery scan (all assets)",
    inputTokens: 2000,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "operations",
  },
  {
    id: "app-health-refresh",
    name: "Application Health Refresh",
    description: "Simulates and updates health metrics for monitored applications",
    trigger: "Per health refresh (all apps)",
    inputTokens: 1500,
    outputTokens: 2000,
    maxTokens: 3000,
    category: "operations",
  },
  {
    id: "topology-mapping",
    name: "Topology Mapping",
    description: "Maps business applications across infrastructure assets and identifies dependencies",
    trigger: "Per topology scan",
    inputTokens: 2000,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "operations",
  },
  {
    id: "remediation-propose",
    name: "AI Remediation (Propose)",
    description: "Analyzes alerts and proposes remediation plan for human approval",
    trigger: "Per critical/high alert",
    inputTokens: 1500,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "remediation",
  },
  {
    id: "remediation-auto",
    name: "AI Remediation (Auto-execute)",
    description: "Analyzes alerts and takes immediate remediation action",
    trigger: "Per critical alert (auto-mode)",
    inputTokens: 1500,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "remediation",
  },
  {
    id: "remediation-script",
    name: "Remediation Script Generation",
    description: "Generates production-ready bash/powershell remediation scripts",
    trigger: "Per recommendation approval",
    inputTokens: 800,
    outputTokens: 2000,
    maxTokens: 2000,
    category: "remediation",
  },
  {
    id: "proactive-notifications",
    name: "Proactive Agent Notifications",
    description: "Generates infrastructure notifications and proposed actions for AI agents",
    trigger: "Per notification generation cycle",
    inputTokens: 2000,
    outputTokens: 3000,
    maxTokens: 3000,
    category: "operations",
  },
  {
    id: "nlp-chat",
    name: "NLP Agent Chat",
    description: "Interactive chat with AI agents — streaming responses with full context",
    trigger: "Per user message",
    inputTokens: 3000,
    outputTokens: 4000,
    maxTokens: 8192,
    category: "chat",
  },
  {
    id: "multi-agent-scan",
    name: "Multi-Agent Asset Scan",
    description: "Each specialist agent scans an asset across its domain (security, compliance, etc.)",
    trigger: "Per asset x domain (6-8 domains per scan)",
    inputTokens: 1500,
    outputTokens: 2000,
    maxTokens: 3000,
    category: "operations",
  },
  {
    id: "scan-orchestrator",
    name: "Scan Orchestrator Summary",
    description: "Synthesizes findings from all specialist agents into unified risk assessment",
    trigger: "Per asset scan (after all domains)",
    inputTokens: 2000,
    outputTokens: 2000,
    maxTokens: 3000,
    category: "operations",
  },
  {
    id: "probe-semi-reasoning",
    name: "Semi-Auto Probe AI Reasoning",
    description: "On-device AI reasoning for semi-autonomous probes (per heartbeat cycle)",
    trigger: "Per probe x heartbeat (every 120s)",
    inputTokens: 200,
    outputTokens: 200,
    maxTokens: 200,
    category: "probes",
  },
  {
    id: "probe-auto-reasoning",
    name: "Autonomous Probe AI Reasoning",
    description: "On-device AI reasoning for fully autonomous probes (per heartbeat cycle)",
    trigger: "Per probe x heartbeat (every 300s)",
    inputTokens: 200,
    outputTokens: 300,
    maxTokens: 300,
    category: "probes",
  },
];

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  setup: { label: "Setup", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  analysis: { label: "Analysis", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  operations: { label: "Operations", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  remediation: { label: "Remediation", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  chat: { label: "Chat", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  probes: { label: "Edge Probes", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
};

type CacheStats = {
  total: number; totalHits: number; totalTokensSaved: number;
  byCategory: Record<string, { count: number; hits: number; tokensSaved: number }>;
  estimatedDollarsSaved: number;
};

const CACHE_CATEGORY_LABELS: Record<string, { label: string; icon: typeof Database; color: string }> = {
  metric_assignment: { label: "Metric Assignment", icon: Gauge, color: "text-cyan-400" },
  agent_profile: { label: "Agent Profile", icon: Brain, color: "text-blue-400" },
  operational_insights: { label: "Operational Insights", icon: Sparkles, color: "text-purple-400" },
};

type AiProvider = {
  id: string; userId: string; name: string; providerType: string;
  apiKey: string; baseUrl: string | null; model: string; isDefault: boolean; enabled: boolean; createdAt: string;
};

type WaterfallEntry = {
  type: string; label: string; envKeys: string[]; detectedKey: string | null;
  available: boolean; baseURL: string; defaultModel: string; apiKeyRequired: boolean; isFree: boolean;
};

type WaterfallStatus = {
  waterfall: WaterfallEntry[];
  activeIndex: number;
  dbProviderActive: boolean;
  dbProvider: { name: string; type: string; model: string } | null;
  resolvedProvider: { label: string; type: string; model: string; source: string };
};

const PROVIDER_TYPE_CONFIG: Record<string, { label: string; color: string; tagColor: string; free: boolean; needsUrl: boolean; keyPlaceholder: string; urlPlaceholder?: string }> = {
  ollama:      { label: "Ollama",         color: "text-emerald-400", tagColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", free: true,  needsUrl: true,  keyPlaceholder: "ollama (no key needed)",   urlPlaceholder: "http://localhost:11434/v1" },
  gemini:      { label: "Google Gemini",  color: "text-blue-400",    tagColor: "bg-blue-500/15 text-blue-400 border-blue-500/30",         free: true,  needsUrl: false, keyPlaceholder: "AIza..." },
  grok:        { label: "xAI Grok",       color: "text-cyan-400",    tagColor: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",         free: true,  needsUrl: false, keyPlaceholder: "xai-..." },
  groq:        { label: "Groq",           color: "text-violet-400",  tagColor: "bg-violet-500/15 text-violet-400 border-violet-500/30",   free: true,  needsUrl: false, keyPlaceholder: "gsk_..." },
  mistral:     { label: "Mistral AI",     color: "text-orange-400",  tagColor: "bg-orange-500/15 text-orange-400 border-orange-500/30",   free: true,  needsUrl: false, keyPlaceholder: "Your Mistral API key" },
  openrouter:  { label: "OpenRouter",     color: "text-pink-400",    tagColor: "bg-pink-500/15 text-pink-400 border-pink-500/30",         free: true,  needsUrl: false, keyPlaceholder: "sk-or-..." },
  together:    { label: "Together AI",    color: "text-yellow-400",  tagColor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",   free: true,  needsUrl: false, keyPlaceholder: "Your Together API key" },
  huggingface: { label: "Hugging Face",   color: "text-amber-400",   tagColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",     free: true,  needsUrl: false, keyPlaceholder: "hf_..." },
  anthropic:   { label: "Anthropic",      color: "text-amber-500",   tagColor: "bg-amber-500/15 text-amber-500 border-amber-500/30",     free: false, needsUrl: false, keyPlaceholder: "sk-ant-..." },
  openai:      { label: "OpenAI",         color: "text-green-400",   tagColor: "bg-green-500/15 text-green-400 border-green-500/30",     free: false, needsUrl: false, keyPlaceholder: "sk-..." },
  custom:      { label: "Custom",         color: "text-purple-400",  tagColor: "bg-purple-500/15 text-purple-400 border-purple-500/30",  free: false, needsUrl: true,  keyPlaceholder: "Your API key",            urlPlaceholder: "https://your-endpoint.com/v1" },
};

const PROVIDER_GROUPS = [
  { label: "🆓 Free & Open-weight (Highest Priority)", types: ["ollama","gemini","grok","groq","mistral","openrouter","together","huggingface"] },
  { label: "💳 Paid (Last Resort)", types: ["anthropic","openai","custom"] },
];

function AiProviderManager({ orgRoles }: { orgRoles?: OrgRole[] }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "", providerType: "ollama", apiKey: "ollama", baseUrl: "", model: "llama3.2:3b", isDefault: false,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [roleProviderMap, setRoleProviderMap] = useState<Record<string, string>>({});

  const { data: providers, isLoading } = useQuery<AiProvider[]>({ queryKey: ["/api/ai-providers"] });
  const { data: modelOptions } = useQuery<Record<string, string[]>>({ queryKey: ["/api/ai-providers/models"] });
  const { data: waterfallStatus, refetch: refetchWaterfall } = useQuery<WaterfallStatus>({
    queryKey: ["/api/ai-providers/waterfall"],
    queryFn: async () => { const r = await apiRequest("GET", "/api/ai-providers/waterfall"); return r.json(); },
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => { const r = await apiRequest("POST", "/api/ai-providers", data); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] }); refetchWaterfall(); toast({ title: "Provider created" }); resetForm(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => { const r = await apiRequest("PATCH", `/api/ai-providers/${id}`, data); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] }); refetchWaterfall(); toast({ title: "Provider updated" }); resetForm(); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ai-providers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] }); refetchWaterfall(); toast({ title: "Provider deleted" }); },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("POST", `/api/ai-providers/${id}/set-default`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/ai-providers"] }); refetchWaterfall(); toast({ title: "Default provider set" }); },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingId(id);
      const res = await apiRequest("POST", `/api/ai-providers/${id}/test`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setTestingId(null);
      if (data.success) toast({ title: "Connection successful", description: `Model responded: "${data.reply}"` });
      else toast({ title: "Connection failed", description: data.error, variant: "destructive" });
    },
    onError: (err: any) => { setTestingId(null); toast({ title: "Test failed", description: err.message, variant: "destructive" }); },
  });

  const roleProviderMutation = useMutation({
    mutationFn: async ({ roleId, aiProviderId }: { roleId: string; aiProviderId: string | null }) =>
      apiRequest("PATCH", `/api/org-roles/${roleId}/ai-provider`, { aiProviderId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/org-roles"] }); toast({ title: "Agent provider updated" }); },
  });

  function resetForm() {
    setShowForm(false); setEditingId(null); setShowApiKey(false);
    setFormData({ name: "", providerType: "ollama", apiKey: "ollama", baseUrl: "", model: "llama3.2:3b", isDefault: false });
  }

  function startEdit(p: AiProvider) {
    setEditingId(p.id); setShowForm(true);
    setFormData({ name: p.name, providerType: p.providerType, apiKey: p.apiKey, baseUrl: p.baseUrl || "", model: p.model, isDefault: p.isDefault });
  }

  function handleProviderTypeChange(v: string) {
    const cfg = PROVIDER_TYPE_CONFIG[v];
    const models = modelOptions?.[v] || [];
    setFormData(p => ({
      ...p, providerType: v,
      model: models[0] || "",
      apiKey: v === "ollama" ? "ollama" : "",
      baseUrl: cfg?.needsUrl && v !== "custom" ? (PROVIDER_TYPE_CONFIG[v]?.urlPlaceholder || "") : "",
    }));
  }

  function handleSubmit() {
    if (!formData.name || !formData.model) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      const isOllama = formData.providerType === "ollama";
      if (!isOllama && (!formData.apiKey || formData.apiKey.includes("****"))) {
        toast({ title: "API key required", variant: "destructive" }); return;
      }
      createMutation.mutate(formData);
    }
  }

  const currentModels = modelOptions?.[formData.providerType] || [];
  const cfg = PROVIDER_TYPE_CONFIG[formData.providerType] || PROVIDER_TYPE_CONFIG.custom;
  const resolved = waterfallStatus?.resolvedProvider;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-providers-title">AI Provider Priority Chain</h3>
          <p className="text-sm text-muted-foreground">Free &amp; open-weight models are tried first. OpenAI is the last resort.</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} data-testid="button-add-provider">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Provider
        </Button>
      </div>

      {/* Active provider banner */}
      {resolved && (
        <Card className={`border-2 ${resolved.source === "unconfigured" ? "border-red-500/30 bg-red-500/5" : "border-primary/30 bg-primary/5"}`} data-testid="card-active-provider">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${resolved.source === "unconfigured" ? "bg-red-500/10" : "bg-primary/10"}`}>
              <Brain className={`h-5 w-5 ${resolved.source === "unconfigured" ? "text-red-400" : "text-primary"}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {resolved.source === "unconfigured" ? "⚠ No provider available" : `✓ Active: ${resolved.label}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {resolved.source === "unconfigured"
                  ? "Configure a free provider (Ollama, Gemini, Grok, Groq) or add an API key below."
                  : `Model: ${resolved.model} · Source: ${resolved.source === "db-configured" ? "Manually configured" : "Auto-detected from environment"}`}
              </p>
            </div>
            {waterfallStatus?.dbProviderActive && (
              <Badge className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Star className="h-2.5 w-2.5 mr-1" />DB Override
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Priority Waterfall */}
      {waterfallStatus && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Provider Priority Chain
              <span className="text-xs font-normal text-muted-foreground ml-1">(auto-selects first available in order)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 pb-4">
            {waterfallStatus.waterfall.map((entry, idx) => {
              const tcfg = PROVIDER_TYPE_CONFIG[entry.type] || PROVIDER_TYPE_CONFIG.custom;
              const isActive = !waterfallStatus.dbProviderActive && idx === waterfallStatus.activeIndex;
              return (
                <div
                  key={entry.type}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${isActive ? "border-primary/40 bg-primary/8" : "border-border/50 bg-muted/10"}`}
                  data-testid={`row-waterfall-${entry.type}`}
                >
                  <span className="text-xs text-muted-foreground w-5 text-center font-mono">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${tcfg.color}`}>{entry.label}</span>
                      {entry.isFree && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 px-1 py-0">FREE</Badge>}
                      {isActive && <Badge className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-1 py-0">ACTIVE</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {entry.apiKeyRequired
                        ? (entry.detectedKey ? `✓ Key detected: ${entry.detectedKey}` : `✗ Set env: ${entry.envKeys[0]}`)
                        : `✓ No key needed · ${entry.baseURL}`}
                    </p>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground hidden sm:block truncate max-w-[140px]">{entry.defaultModel}</div>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.available ? "bg-green-400" : "bg-muted-foreground/30"}`} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">{editingId ? "Edit Provider" : "Add Provider"}</h4>
              <Button variant="ghost" size="sm" onClick={resetForm} data-testid="button-cancel-provider"><XCircle className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Display Name</Label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Local Ollama" className="mt-1 h-9 text-sm" data-testid="input-provider-name" />
              </div>
              <div>
                <Label className="text-xs">Provider Type</Label>
                <Select value={formData.providerType} onValueChange={handleProviderTypeChange}>
                  <SelectTrigger className="mt-1 h-9 text-sm" data-testid="select-provider-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDER_GROUPS.map(group => (
                      <div key={group.label}>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{group.label}</div>
                        {group.types.map(t => {
                          const c = PROVIDER_TYPE_CONFIG[t];
                          return <SelectItem key={t} value={t}><span className={c.color}>{c.label}</span></SelectItem>;
                        })}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ollama hint */}
            {formData.providerType === "ollama" && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
                Ollama runs locally — no API key needed. Make sure Ollama is running at the base URL below.
                Install models with: <code className="font-mono bg-black/30 px-1 rounded">ollama pull llama3.2:3b</code>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">API Key {formData.providerType === "ollama" && <span className="text-muted-foreground">(not required)</span>}</Label>
                <div className="relative mt-1">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={formData.apiKey}
                    onChange={e => setFormData(p => ({ ...p, apiKey: e.target.value }))}
                    placeholder={cfg.keyPlaceholder}
                    className="h-9 text-sm pr-8"
                    data-testid="input-provider-apikey"
                    disabled={formData.providerType === "ollama"}
                  />
                  <button onClick={() => setShowApiKey(!showApiKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-toggle-apikey">
                    {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-xs">Model</Label>
                {currentModels.length > 0 ? (
                  <Select value={formData.model} onValueChange={v => setFormData(p => ({ ...p, model: v }))}>
                    <SelectTrigger className="mt-1 h-9 text-sm" data-testid="select-provider-model"><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>{currentModels.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={formData.model} onChange={e => setFormData(p => ({ ...p, model: e.target.value }))} placeholder="Model name" className="mt-1 h-9 text-sm" data-testid="input-provider-model" />
                )}
              </div>
            </div>

            {(cfg.needsUrl || formData.providerType === "ollama") && (
              <div>
                <Label className="text-xs">Base URL <span className="text-muted-foreground">{formData.providerType === "ollama" ? "(change if running remotely)" : "(required)"}</span></Label>
                <Input value={formData.baseUrl} onChange={e => setFormData(p => ({ ...p, baseUrl: e.target.value }))}
                  placeholder={cfg.urlPlaceholder || "https://your-endpoint.com/v1"} className="mt-1 h-9 text-sm" data-testid="input-provider-baseurl" />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={formData.isDefault} onCheckedChange={v => setFormData(p => ({ ...p, isDefault: v }))} data-testid="switch-provider-default" />
                <Label className="text-xs">Set as default (overrides waterfall)</Label>
              </div>
              <div className="flex-1 hidden sm:block" />
              <div className="flex items-center gap-2 ml-auto sm:ml-0">
                <Button variant="outline" size="sm" onClick={resetForm} data-testid="button-form-cancel">Cancel</Button>
                <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-form-save">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  {editingId ? "Update" : "Create"} Provider
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configured providers */}
      {(providers?.length || 0) > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Manually Configured Providers</p>
          <div className="grid gap-2">
            {providers!.map(p => {
              const pcfg = PROVIDER_TYPE_CONFIG[p.providerType] || PROVIDER_TYPE_CONFIG.custom;
              return (
                <Card key={p.id} className={`transition-all ${!p.enabled ? "opacity-50" : ""}`} data-testid={`card-provider-${p.id}`}>
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm" data-testid={`text-provider-name-${p.id}`}>{p.name}</span>
                        <Badge variant="outline" className={`text-[10px] border ${pcfg.tagColor}`} data-testid={`badge-provider-type-${p.id}`}>{pcfg.label}</Badge>
                        {pcfg.free && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">FREE</Badge>}
                        {p.isDefault && <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30" data-testid={`badge-provider-default-${p.id}`}><Star className="h-2.5 w-2.5 mr-0.5" />Default</Badge>}
                        {!p.enabled && <Badge variant="outline" className="text-[10px] text-muted-foreground">Disabled</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground">Model: <span className="text-foreground/80">{p.model}</span></span>
                        <span className="text-xs text-muted-foreground font-mono">{p.apiKey}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => testMutation.mutate(p.id)} disabled={testingId === p.id} data-testid={`button-test-provider-${p.id}`}>
                        {testingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                      </Button>
                      {!p.isDefault && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Set as default" onClick={() => setDefaultMutation.mutate(p.id)} data-testid={`button-default-provider-${p.id}`}>
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(p)} data-testid={`button-edit-provider-${p.id}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-provider-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-agent assignment */}
      {orgRoles && orgRoles.length > 0 && (providers?.length || 0) > 0 && (
        <div>
          <h4 className="font-medium text-sm mb-1">Per-Agent Provider Assignment</h4>
          <p className="text-xs text-muted-foreground mb-3">Override the waterfall for specific agent roles. Unassigned agents follow the priority chain.</p>
          <div className="grid gap-2">
            {orgRoles.slice(0, 20).map(role => (
              <div key={role.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2 px-3 rounded-lg border bg-card" data-testid={`row-role-provider-${role.id}`}>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{role.name}</span>
                  <span className="text-[10px] text-muted-foreground">{role.department}</span>
                </div>
                <Select
                  value={roleProviderMap[role.id] || (role as any).aiProviderId || "_default"}
                  onValueChange={v => {
                    setRoleProviderMap(prev => ({ ...prev, [role.id]: v }));
                    roleProviderMutation.mutate({ roleId: role.id, aiProviderId: v === "_default" ? null : v });
                  }}
                >
                  <SelectTrigger className="w-full sm:w-48 h-8 text-xs" data-testid={`select-role-provider-${role.id}`}><SelectValue placeholder="Follow waterfall" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_default">Follow priority chain</SelectItem>
                    {providers?.filter(p => p.enabled).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.model})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CacheIntelligence() {
  const { toast } = useToast();
  const { data: cacheEntries, isLoading: entriesLoading } = useQuery<AiTemplateCache[]>({ queryKey: ["/api/ai-cache"] });
  const { data: cacheStats, isLoading: statsLoading } = useQuery<CacheStats>({ queryKey: ["/api/ai-cache/stats"] });

  const invalidateMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/ai-cache/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-cache"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-cache/stats"] });
      toast({ title: "Cache entry invalidated" });
    },
  });

  const clearCategoryMutation = useMutation({
    mutationFn: async (category: string) => apiRequest("DELETE", `/api/ai-cache/category/${category}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-cache"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-cache/stats"] });
      toast({ title: "Category cache cleared" });
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/ai-cache/cleanup"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-cache"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-cache/stats"] });
      toast({ title: "Expired cache entries cleaned up" });
    },
  });

  if (entriesLoading || statsLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const stats = cacheStats || { total: 0, totalHits: 0, totalTokensSaved: 0, byCategory: {}, estimatedDollarsSaved: 0 };
  const entries = cacheEntries || [];
  const hitRate = stats.total > 0 ? Math.round((stats.totalHits / Math.max(stats.totalHits + stats.total, 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary shrink-0" />
            AI Template Cache
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Asset Type Template Cache reduces AI API costs by reusing responses for identical asset types and agent roles.
            Templates auto-expire after 30 days and are regenerated on next request.
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 self-start" onClick={() => cleanupMutation.mutate()} disabled={cleanupMutation.isPending} data-testid="button-cleanup-cache">
          <RefreshCw className={`h-3 w-3 mr-1 ${cleanupMutation.isPending ? "animate-spin" : ""}`} />
          Cleanup Expired
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Templates</div>
          <div className="text-2xl font-bold" data-testid="text-cache-total">{stats.total}</div>
          <div className="text-[10px] text-muted-foreground">cached responses</div>
        </Card>
        <Card className="p-3 border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Cache Hits</div>
          <div className="text-2xl font-bold text-emerald-500" data-testid="text-cache-hits">{stats.totalHits}</div>
          <div className="text-[10px] text-muted-foreground">{hitRate}% hit rate</div>
        </Card>
        <Card className="p-3 border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tokens Saved</div>
          <div className="text-2xl font-bold text-blue-500" data-testid="text-tokens-saved">{stats.totalTokensSaved > 1000 ? `${(stats.totalTokensSaved / 1000).toFixed(1)}K` : stats.totalTokensSaved}</div>
          <div className="text-[10px] text-muted-foreground">input tokens avoided</div>
        </Card>
        <Card className="p-3 border">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">$ Saved</div>
          <div className="text-2xl font-bold text-emerald-600" data-testid="text-dollars-saved">${stats.estimatedDollarsSaved.toFixed(2)}</div>
          <div className="text-[10px] text-muted-foreground">estimated savings</div>
        </Card>
      </div>

      {Object.keys(stats.byCategory).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            By Category
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.entries(stats.byCategory).map(([cat, data]) => {
              const config = CACHE_CATEGORY_LABELS[cat] || { label: cat, icon: Database, color: "text-muted-foreground" };
              const Icon = config.icon;
              return (
                <Card key={cat} className="p-3 border flex items-center justify-between" data-testid={`card-cache-category-${cat}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <div>
                      <div className="text-xs font-semibold">{config.label}</div>
                      <div className="text-[10px] text-muted-foreground">{data.count} templates, {data.hits} hits</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => clearCategoryMutation.mutate(cat)} data-testid={`button-clear-${cat}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold mb-2">Cached Templates ({entries.length})</h4>
        {entries.length === 0 ? (
          <Card className="p-6 border">
            <div className="text-center text-muted-foreground text-sm">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>No cached templates yet.</p>
              <p className="text-[10px] mt-1">Templates are automatically created when AI analysis runs on new asset types or agent roles.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => {
              const config = CACHE_CATEGORY_LABELS[entry.cacheCategory] || { label: entry.cacheCategory, icon: Database, color: "text-muted-foreground" };
              const Icon = config.icon;
              const isExpired = new Date(entry.expiresAt) < new Date();
              const daysLeft = Math.ceil((new Date(entry.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <Card key={entry.id} className={`px-3 py-2 border flex items-center justify-between ${isExpired ? "opacity-50" : ""}`} data-testid={`card-cache-entry-${entry.id}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${config.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">{entry.assetType}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {config.label} · {entry.hitCount} hits · {entry.tokensSaved.toLocaleString()} tokens saved
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={isExpired ? "destructive" : "outline"} className="text-[9px] h-4 px-1.5">
                      {isExpired ? "Expired" : `${daysLeft}d left`}
                    </Badge>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => invalidateMutation.mutate(entry.id)} data-testid={`button-invalidate-${entry.id}`}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card className="p-4 border border-blue-500/20 bg-blue-500/5">
        <h4 className="text-xs font-semibold flex items-center gap-1 mb-2">
          <Info className="h-3 w-3 text-blue-400" />
          How Template Caching Works
        </h4>
        <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Metric Assignment:</strong> Assets of the same type (e.g., all "Linux Server" devices) share the same AI-generated metric recommendations. First device of each type triggers AI; subsequent devices reuse the cached response.</li>
          <li><strong>Agent Profile:</strong> Agent roles with the same title share profile templates. The AI decides best-practice metrics once per role title per month.</li>
          <li><strong>Operational Insights:</strong> Predictive/preventive/prescriptive measures are cached per role. Regenerated automatically after 30 days.</li>
          <li><strong>Manual Invalidation:</strong> Force-refresh any template by clicking the delete button. The next AI call for that type/role will generate a fresh response.</li>
          <li><strong>Cost Impact:</strong> With 500 assets across ~20 types, template caching reduces metric assignment API calls from 500 to 20 — a 96% reduction.</li>
        </ul>
      </Card>
    </div>
  );
}

function AiCostEstimator({ assetCount, metricCount, assignmentCount, agentCount }: {
  assetCount: number; metricCount: number; assignmentCount: number; agentCount: number;
}) {
  const [assets, setAssets] = useState(Math.max(assetCount, 10));
  const [agents, setAgents] = useState(Math.max(agentCount, 5));
  const [chatMsgsPerDay, setChatMsgsPerDay] = useState(20);
  const [alertsPerDay, setAlertsPerDay] = useState(5);
  const [scanFreqPerWeek, setScanFreqPerWeek] = useState(2);
  const [semiProbes, setSemiProbes] = useState(0);
  const [autoProbes, setAutoProbes] = useState(0);
  const [probeAiEnabled, setProbeAiEnabled] = useState(false);

  const costBreakdown = useMemo(() => {
    const calcCost = (inputTk: number, outputTk: number, calls: number) => {
      const inputCost = (inputTk / 1000) * GPT4O_INPUT_PER_1K * calls;
      const outputCost = (outputTk / 1000) * GPT4O_OUTPUT_PER_1K * calls;
      return { inputCost, outputCost, totalCost: inputCost + outputCost, calls };
    };

    const daysPerMonth = 30;
    const weeksPerMonth = 4.3;

    const items: { id: string; name: string; category: string; callsPerMonth: number; inputCost: number; outputCost: number; totalCost: number; note: string }[] = [];

    const agentProfileCalls = agents;
    const ap = AI_CALL_CATALOG.find(c => c.id === "agent-profile")!;
    const apCost = calcCost(ap.inputTokens, ap.outputTokens, agentProfileCalls);
    items.push({ id: ap.id, name: ap.name, category: ap.category, callsPerMonth: agentProfileCalls, ...apCost, note: `${agents} agents x 1 gen/month` });

    const metricAssignCalls = assets * scanFreqPerWeek * weeksPerMonth;
    const ma = AI_CALL_CATALOG.find(c => c.id === "metric-assignment")!;
    const maCost = calcCost(ma.inputTokens, ma.outputTokens, metricAssignCalls);
    items.push({ id: ma.id, name: ma.name, category: ma.category, callsPerMonth: Math.round(metricAssignCalls), ...maCost, note: `${assets} assets x ${scanFreqPerWeek}/wk` });

    const oi = AI_CALL_CATALOG.find(c => c.id === "operational-insights")!;
    const oiCalls = agents;
    const oiCost = calcCost(oi.inputTokens, oi.outputTokens, oiCalls);
    items.push({ id: oi.id, name: oi.name, category: oi.category, callsPerMonth: oiCalls, ...oiCost, note: `${agents} agents x 1/month` });

    const vc = AI_CALL_CATALOG.find(c => c.id === "variation-calibration")!;
    const vcCalls = Math.ceil(assets * 0.1) * weeksPerMonth;
    const vcCost = calcCost(vc.inputTokens, vc.outputTokens, vcCalls);
    items.push({ id: vc.id, name: vc.name, category: vc.category, callsPerMonth: Math.round(vcCalls), ...vcCost, note: `~10% of assets/wk` });

    const rca = AI_CALL_CATALOG.find(c => c.id === "root-cause-analysis")!;
    const rcaCalls = Math.ceil(alertsPerDay * 0.3) * daysPerMonth;
    const rcaCost = calcCost(rca.inputTokens, rca.outputTokens, rcaCalls);
    items.push({ id: rca.id, name: rca.name, category: rca.category, callsPerMonth: Math.round(rcaCalls), ...rcaCost, note: `~30% of ${alertsPerDay} alerts/day cluster` });

    const ad = AI_CALL_CATALOG.find(c => c.id === "app-discovery")!;
    const adCalls = scanFreqPerWeek * weeksPerMonth;
    const adCost = calcCost(ad.inputTokens, ad.outputTokens, adCalls);
    items.push({ id: ad.id, name: ad.name, category: ad.category, callsPerMonth: Math.round(adCalls), ...adCost, note: `${scanFreqPerWeek} scans/wk` });

    const ah = AI_CALL_CATALOG.find(c => c.id === "app-health-refresh")!;
    const ahCalls = daysPerMonth;
    const ahCost = calcCost(ah.inputTokens, ah.outputTokens, ahCalls);
    items.push({ id: ah.id, name: ah.name, category: ah.category, callsPerMonth: ahCalls, ...ahCost, note: `1 refresh/day` });

    const tm = AI_CALL_CATALOG.find(c => c.id === "topology-mapping")!;
    const tmCalls = scanFreqPerWeek * weeksPerMonth;
    const tmCost = calcCost(tm.inputTokens, tm.outputTokens, tmCalls);
    items.push({ id: tm.id, name: tm.name, category: tm.category, callsPerMonth: Math.round(tmCalls), ...tmCost, note: `${scanFreqPerWeek}/wk` });

    const rp = AI_CALL_CATALOG.find(c => c.id === "remediation-propose")!;
    const rpCalls = Math.ceil(alertsPerDay * 0.5) * daysPerMonth;
    const rpCost = calcCost(rp.inputTokens, rp.outputTokens, rpCalls);
    items.push({ id: rp.id, name: rp.name, category: rp.category, callsPerMonth: Math.round(rpCalls), ...rpCost, note: `~50% of ${alertsPerDay} alerts/day` });

    const ra = AI_CALL_CATALOG.find(c => c.id === "remediation-auto")!;
    const raCalls = Math.ceil(alertsPerDay * 0.2) * daysPerMonth;
    const raCostCalc = calcCost(ra.inputTokens, ra.outputTokens, raCalls);
    items.push({ id: ra.id, name: ra.name, category: ra.category, callsPerMonth: Math.round(raCalls), ...raCostCalc, note: `~20% critical auto` });

    const rs = AI_CALL_CATALOG.find(c => c.id === "remediation-script")!;
    const rsCalls = Math.ceil(alertsPerDay * 0.3) * daysPerMonth;
    const rsCost = calcCost(rs.inputTokens, rs.outputTokens, rsCalls);
    items.push({ id: rs.id, name: rs.name, category: rs.category, callsPerMonth: Math.round(rsCalls), ...rsCost, note: `~30% approved` });

    const pn = AI_CALL_CATALOG.find(c => c.id === "proactive-notifications")!;
    const pnCalls = daysPerMonth;
    const pnCost = calcCost(pn.inputTokens, pn.outputTokens, pnCalls);
    items.push({ id: pn.id, name: pn.name, category: pn.category, callsPerMonth: pnCalls, ...pnCost, note: `1 cycle/day` });

    const nc = AI_CALL_CATALOG.find(c => c.id === "nlp-chat")!;
    const ncCalls = chatMsgsPerDay * daysPerMonth;
    const ncCost = calcCost(nc.inputTokens, nc.outputTokens, ncCalls);
    items.push({ id: nc.id, name: nc.name, category: nc.category, callsPerMonth: ncCalls, ...ncCost, note: `${chatMsgsPerDay} msgs/day` });

    const mas = AI_CALL_CATALOG.find(c => c.id === "multi-agent-scan")!;
    const masCalls = assets * 7 * scanFreqPerWeek * weeksPerMonth;
    const masCost = calcCost(mas.inputTokens, mas.outputTokens, masCalls);
    items.push({ id: mas.id, name: mas.name, category: mas.category, callsPerMonth: Math.round(masCalls), ...masCost, note: `${assets} assets x 7 domains x ${scanFreqPerWeek}/wk` });

    const so = AI_CALL_CATALOG.find(c => c.id === "scan-orchestrator")!;
    const soCalls = assets * scanFreqPerWeek * weeksPerMonth;
    const soCost = calcCost(so.inputTokens, so.outputTokens, soCalls);
    items.push({ id: so.id, name: so.name, category: so.category, callsPerMonth: Math.round(soCalls), ...soCost, note: `${assets} assets x ${scanFreqPerWeek}/wk` });

    if (probeAiEnabled && semiProbes > 0) {
      const sp = AI_CALL_CATALOG.find(c => c.id === "probe-semi-reasoning")!;
      const spCalls = semiProbes * (3600 / 120) * 24 * daysPerMonth;
      const spCost = calcCost(sp.inputTokens, sp.outputTokens, spCalls);
      items.push({ id: sp.id, name: sp.name, category: sp.category, callsPerMonth: Math.round(spCalls), ...spCost, note: `${semiProbes} probes x 720/day (every 120s)` });
    }

    if (probeAiEnabled && autoProbes > 0) {
      const aup = AI_CALL_CATALOG.find(c => c.id === "probe-auto-reasoning")!;
      const aupCalls = autoProbes * (3600 / 300) * 24 * daysPerMonth;
      const aupCost = calcCost(aup.inputTokens, aup.outputTokens, aupCalls);
      items.push({ id: aup.id, name: aup.name, category: aup.category, callsPerMonth: Math.round(aupCalls), ...aupCost, note: `${autoProbes} probes x 288/day (every 300s)` });
    }

    return items;
  }, [assets, agents, chatMsgsPerDay, alertsPerDay, scanFreqPerWeek, semiProbes, autoProbes, probeAiEnabled]);

  const totalMonthly = costBreakdown.reduce((s, i) => s + i.totalCost, 0);
  const totalCalls = costBreakdown.reduce((s, i) => s + i.callsPerMonth, 0);

  const cacheableIds = new Set(["metric-assignment", "agent-profile", "operational-insights", "multi-agent-scan", "scan-orchestrator"]);
  const uniqueAssetTypes = Math.max(Math.ceil(assets * 0.04), 3);
  const cachedMonthly = useMemo(() => {
    return costBreakdown.reduce((s, item) => {
      if (!cacheableIds.has(item.id)) return s + item.totalCost;
      if (item.id === "agent-profile" || item.id === "operational-insights") {
        return s + item.totalCost / (item.callsPerMonth || 1);
      }
      const ratio = Math.min(uniqueAssetTypes / assets, 1);
      return s + item.totalCost * ratio;
    }, 0);
  }, [costBreakdown, assets, uniqueAssetTypes]);
  const cacheSavings = totalMonthly - cachedMonthly;
  const cacheSavingsPercent = totalMonthly > 0 ? (cacheSavings / totalMonthly) * 100 : 0;

  const byCategory = useMemo(() => {
    const cats: Record<string, { cost: number; calls: number }> = {};
    for (const item of costBreakdown) {
      if (!cats[item.category]) cats[item.category] = { cost: 0, calls: 0 };
      cats[item.category].cost += item.totalCost;
      cats[item.category].calls += item.callsPerMonth;
    }
    return cats;
  }, [costBreakdown]);

  const tiers = [
    { label: "Starter", assets: 25, agents: 5, alerts: 3, chats: 10, scans: 1, semiP: 0, autoP: 0 },
    { label: "Growth", assets: 100, agents: 10, alerts: 10, chats: 30, scans: 3, semiP: 5, autoP: 2 },
    { label: "Enterprise", assets: 500, agents: 25, alerts: 25, chats: 50, scans: 5, semiP: 20, autoP: 10 },
    { label: "Scale", assets: 1000, agents: 50, alerts: 50, chats: 100, scans: 7, semiP: 50, autoP: 25 },
  ];

  const fmt = (n: number) => n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`;
  const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n.toString();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary flex-shrink-0" />
            OpenAI API Cost Estimator
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Estimates based on GPT-4o pricing: ${GPT4O_INPUT_PER_1K}/1K input tokens, ${GPT4O_OUTPUT_PER_1K}/1K output tokens.
            All {AI_CALL_CATALOG.length} AI call types are cataloged from the actual codebase.
          </p>
        </div>
        <div className="text-left sm:text-right flex-shrink-0">
          <div className="text-2xl font-bold text-primary" data-testid="text-total-monthly-cost">{fmt(totalMonthly)}</div>
          <div className="text-[10px] text-muted-foreground">estimated /month (no cache)</div>
          <div className="text-xs text-muted-foreground mt-0.5">{fmtK(totalCalls)} API calls/month</div>
          {cacheSavingsPercent > 5 && (
            <div className="mt-1 flex items-center gap-1 justify-end" data-testid="text-cache-savings">
              <Database className="h-3 w-3 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                With Cache: {fmt(cachedMonthly)} ({Math.round(cacheSavingsPercent)}% saved)
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs font-semibold">Assets</Label>
          </div>
          <Slider value={[assets]} onValueChange={v => setAssets(v[0])} min={1} max={2000} step={5} data-testid="slider-assets" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">1</span>
            <span className="text-xs font-mono font-bold text-primary" data-testid="text-asset-count">{assets}</span>
            <span className="text-[10px] text-muted-foreground">2,000</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs font-semibold">AI Agents</Label>
          </div>
          <Slider value={[agents]} onValueChange={v => setAgents(v[0])} min={1} max={100} step={1} data-testid="slider-agents" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">1</span>
            <span className="text-xs font-mono font-bold text-primary" data-testid="text-agent-count">{agents}</span>
            <span className="text-[10px] text-muted-foreground">100</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs font-semibold">Alerts / Day</Label>
          </div>
          <Slider value={[alertsPerDay]} onValueChange={v => setAlertsPerDay(v[0])} min={0} max={100} step={1} data-testid="slider-alerts" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-xs font-mono font-bold text-primary" data-testid="text-alerts-count">{alertsPerDay}</span>
            <span className="text-[10px] text-muted-foreground">100</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs font-semibold">Chat Msgs / Day</Label>
          </div>
          <Slider value={[chatMsgsPerDay]} onValueChange={v => setChatMsgsPerDay(v[0])} min={0} max={200} step={5} data-testid="slider-chat" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-xs font-mono font-bold text-primary" data-testid="text-chat-count">{chatMsgsPerDay}</span>
            <span className="text-[10px] text-muted-foreground">200</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <ScanSearch className="h-4 w-4 text-muted-foreground" />
            <Label className="text-xs font-semibold">Scans / Week</Label>
          </div>
          <Slider value={[scanFreqPerWeek]} onValueChange={v => setScanFreqPerWeek(v[0])} min={0} max={14} step={1} data-testid="slider-scans" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-xs font-mono font-bold text-primary">{scanFreqPerWeek}</span>
            <span className="text-[10px] text-muted-foreground">14</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="h-4 w-4 text-amber-400" />
            <Label className="text-xs font-semibold">Semi-Auto Probes</Label>
          </div>
          <Slider value={[semiProbes]} onValueChange={v => setSemiProbes(v[0])} min={0} max={200} step={1} data-testid="slider-semi-probes" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-xs font-mono font-bold text-amber-400">{semiProbes}</span>
            <span className="text-[10px] text-muted-foreground">200</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-purple-400" />
            <Label className="text-xs font-semibold">Autonomous Probes</Label>
          </div>
          <Slider value={[autoProbes]} onValueChange={v => setAutoProbes(v[0])} min={0} max={200} step={1} data-testid="slider-auto-probes" />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">0</span>
            <span className="text-xs font-mono font-bold text-purple-400">{autoProbes}</span>
            <span className="text-[10px] text-muted-foreground">200</span>
          </div>
        </Card>
      </div>

      {(semiProbes > 0 || autoProbes > 0) && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <input
            type="checkbox"
            checked={probeAiEnabled}
            onChange={e => setProbeAiEnabled(e.target.checked)}
            className="rounded"
            data-testid="checkbox-probe-ai"
          />
          <div>
            <span className="text-xs font-semibold text-amber-400">Enable OpenAI on edge probes</span>
            <p className="text-[9px] text-muted-foreground">
              Without this, probes use the free built-in rule engine (no API cost). Enable only if you configure OPENAI_API_KEY on the probe.
            </p>
          </div>
          {probeAiEnabled && (semiProbes > 0 || autoProbes > 0) && (
            <div className="ml-auto text-right">
              <span className="text-xs font-bold text-amber-400">
                {fmt(
                  (semiProbes > 0 ? costBreakdown.find(c => c.id === "probe-semi-reasoning")?.totalCost || 0 : 0) +
                  (autoProbes > 0 ? costBreakdown.find(c => c.id === "probe-auto-reasoning")?.totalCost || 0 : 0)
                )}
              </span>
              <p className="text-[9px] text-muted-foreground">probe AI /month</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Object.entries(byCategory).map(([cat, data]) => {
          const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.operations;
          const pct = totalMonthly > 0 ? (data.cost / totalMonthly * 100) : 0;
          return (
            <Card key={cat} className={`p-2.5 border ${config.bg}`}>
              <p className={`text-[9px] font-semibold ${config.color}`}>{config.label}</p>
              <p className="text-sm font-bold mt-0.5">{fmt(data.cost)}</p>
              <p className="text-[9px] text-muted-foreground">{fmtK(data.calls)} calls · {pct.toFixed(0)}%</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">AI Call Type</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Category</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Input Tk</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Output Tk</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Calls/Mo</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground">Cost/Mo</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Frequency</th>
              </tr>
            </thead>
            <tbody>
              {costBreakdown.sort((a, b) => b.totalCost - a.totalCost).map(item => {
                const cat = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.operations;
                return (
                  <tr key={item.id} className="border-b border-border/10 hover:bg-muted/10" data-testid={`row-cost-${item.id}`}>
                    <td className="px-3 py-2">
                      <span className="font-medium">{item.name}</span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${cat.bg} ${cat.color}`}>{cat.label}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtK(AI_CALL_CATALOG.find(c => c.id === item.id)?.inputTokens || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{fmtK(AI_CALL_CATALOG.find(c => c.id === item.id)?.outputTokens || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium">{fmtK(item.callsPerMonth)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary">{fmt(item.totalCost)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{item.note}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-primary/30 bg-primary/5">
                <td className="px-3 py-2 font-bold" colSpan={4}>Total Estimated Monthly Cost</td>
                <td className="px-3 py-2 text-right font-mono font-bold">{fmtK(totalCalls)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-primary text-sm">{fmt(totalMonthly)}</td>
                <td className="px-3 py-2 text-muted-foreground text-[10px]">{fmt(totalMonthly * 12)} /year</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          Scaling Forecast
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiers.map(tier => {
            const tierCost = (() => {
              let total = 0;
              const d = 30;
              const w = 4.3;
              const calc = (inp: number, out: number, calls: number) =>
                (inp / 1000) * GPT4O_INPUT_PER_1K * calls + (out / 1000) * GPT4O_OUTPUT_PER_1K * calls;

              for (const c of AI_CALL_CATALOG) {
                let calls = 0;
                switch (c.id) {
                  case "agent-profile": calls = tier.agents; break;
                  case "metric-assignment": calls = tier.assets * tier.scans * w; break;
                  case "operational-insights": calls = tier.agents; break;
                  case "variation-calibration": calls = Math.ceil(tier.assets * 0.1) * w; break;
                  case "root-cause-analysis": calls = Math.ceil(tier.alerts * 0.3) * d; break;
                  case "app-discovery": calls = tier.scans * w; break;
                  case "app-health-refresh": calls = d; break;
                  case "topology-mapping": calls = tier.scans * w; break;
                  case "remediation-propose": calls = Math.ceil(tier.alerts * 0.5) * d; break;
                  case "remediation-auto": calls = Math.ceil(tier.alerts * 0.2) * d; break;
                  case "remediation-script": calls = Math.ceil(tier.alerts * 0.3) * d; break;
                  case "proactive-notifications": calls = d; break;
                  case "nlp-chat": calls = tier.chats * d; break;
                  case "multi-agent-scan": calls = tier.assets * 7 * tier.scans * w; break;
                  case "scan-orchestrator": calls = tier.assets * tier.scans * w; break;
                  case "probe-semi-reasoning": calls = 0; break;
                  case "probe-auto-reasoning": calls = 0; break;
                }
                total += calc(c.inputTokens, c.outputTokens, calls);
              }
              return total;
            })();

            return (
              <Card key={tier.label} className="p-3 hover:border-primary/30 transition-all cursor-pointer" onClick={() => {
                setAssets(tier.assets);
                setAgents(tier.agents);
                setAlertsPerDay(tier.alerts);
                setChatMsgsPerDay(tier.chats);
                setScanFreqPerWeek(tier.scans);
                setSemiProbes(tier.semiP);
                setAutoProbes(tier.autoP);
              }} data-testid={`card-tier-${tier.label.toLowerCase()}`}>
                <p className="text-xs font-bold mb-1">{tier.label}</p>
                <p className="text-lg font-bold text-primary">{fmt(tierCost)}<span className="text-[10px] font-normal text-muted-foreground">/mo</span></p>
                <p className="text-[10px] text-muted-foreground mt-1">{fmt(tierCost * 12)}/year</p>
                <div className="mt-2 space-y-0.5 text-[9px] text-muted-foreground">
                  <p>{tier.assets} assets · {tier.agents} agents</p>
                  <p>{tier.alerts} alerts/day · {tier.chats} chats/day</p>
                  <p>{tier.scans} scans/wk</p>
                  {(tier.semiP > 0 || tier.autoP > 0) && (
                    <p>{tier.semiP} semi + {tier.autoP} auto probes</p>
                  )}
                </div>
                <p className="text-[8px] text-muted-foreground/60 mt-1">Click to load values</p>
              </Card>
            );
          })}
        </div>
      </div>

      <Card className="p-4 border-blue-500/20 bg-blue-500/5">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-muted-foreground space-y-1.5">
            <p className="text-xs font-semibold text-blue-400">Cost Estimation Notes</p>
            <p>All estimates use GPT-4o pricing ($2.50/1M input, $10.00/1M output tokens). Actual costs may vary based on prompt complexity and response length.</p>
            <p><strong>Server-side costs</strong> include: agent profiles, metric assignments, operational insights, variation calibration, root cause analysis, app discovery, health refresh, topology mapping, remediation (propose + auto + scripts), proactive notifications, chat interface, multi-agent scans, and orchestrator summaries.</p>
            <p><strong>Edge probe costs</strong> (semi-auto & autonomous) only apply if you configure an <code className="text-blue-400">OPENAI_API_KEY</code> on the probe itself. Without it, probes use the free built-in rule engine — zero API cost.</p>
            <p><strong>Multi-agent scan</strong> is typically the largest cost driver at scale, as each asset is scanned across 6-8 specialist domains per scan cycle.</p>
            <p><strong>To reduce costs</strong>: Lower scan frequency, reduce chat volume, or switch edge probes to rule-engine mode (free).</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ metric, expanded, onToggle, assignments, assets }: {
  metric: ServiceMetric;
  expanded: boolean;
  onToggle: () => void;
  assignments: ServiceMetricAssignment[];
  assets: DiscoveredAsset[];
}) {
  const Icon = iconMap[metric.icon] || Activity;
  const mode = modeConfig[metric.collectionMode] || modeConfig.continuous;
  const cat = categoryConfig[metric.category] || categoryConfig.health;
  const metricAssignments = assignments.filter(a => a.metricId === metric.id);
  const assetMap = new Map(assets.map(a => [a.id, a]));

  return (
    <Card className={`transition-all ${expanded ? "ring-1 ring-primary/30" : ""}`}>
      <CardContent className="p-0">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={onToggle}
          data-testid={`metric-card-${metric.id}`}
        >
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{metric.name}</span>
              {!metric.enabled && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">Disabled</Badge>}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{metric.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${cat.color}`}>{cat.label}</Badge>
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${mode.bg} ${mode.color}`}>{mode.label}</Badge>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{metric.protocol}</Badge>
            {metric.defaultInterval && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{formatInterval(metric.defaultInterval)}</Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{metricAssignments.length} asset{metricAssignments.length !== 1 ? "s" : ""}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </div>
        {expanded && metricAssignments.length > 0 && (
          <div className="px-4 pb-4 border-t border-border/30">
            <div className="grid grid-cols-1 gap-1.5 mt-3" data-testid="metric-assigned-assets">
              {metricAssignments.map(a => {
                const asset = assetMap.get(a.assetId);
                if (!asset) return null;
                const statusColor = a.status === "critical" ? "text-red-400" : a.status === "warning" ? "text-amber-400" : a.status === "normal" ? "text-green-400" : "text-muted-foreground";
                return (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/10 border border-border/20" data-testid={`assignment-${a.id}`}>
                    <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-medium flex-1 truncate">{asset.name}</span>
                    <span className="text-[10px] text-muted-foreground">{asset.ipAddress}</span>
                    {a.lastValue !== null && a.lastValue !== undefined && (
                      <span className={`text-[11px] font-mono font-medium ${statusColor}`}>{a.lastValue}{metric.unit === "%" ? "%" : ""}</span>
                    )}
                    <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${modeConfig[a.collectionMode]?.bg || ""} ${modeConfig[a.collectionMode]?.color || ""}`}>
                      {modeConfig[a.collectionMode]?.label || a.collectionMode}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {expanded && metricAssignments.length === 0 && (
          <div className="px-4 pb-4 border-t border-border/30">
            <p className="text-[11px] text-muted-foreground mt-3 text-center">No assets assigned to this metric</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceMetricsCard({ asset, expanded, onToggle, assignments, metrics }: {
  asset: DiscoveredAsset;
  expanded: boolean;
  onToggle: () => void;
  assignments: ServiceMetricAssignment[];
  metrics: ServiceMetric[];
}) {
  const { toast } = useToast();
  const assetAssignments = assignments.filter(a => a.assetId === asset.id);
  const metricMap = new Map(metrics.map(m => [m.id, m]));
  const meta = (asset.metadata || {}) as Record<string, any>;
  const sUtil = meta.systemUtilization as { cpu?: number; memory?: number; disk?: number } | undefined;

  const aiAnalyzeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/service-metrics/ai-analyze/${asset.id}`),
    onSuccess: () => {
      toast({ title: "AI Agent Analyzing", description: `Metrics Intelligence Agent is analyzing ${asset.name}...` });
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/service-metric-assignments"] });
      }, 3000);
      setTimeout(() => clearInterval(poll), 30000);
    },
    onError: () => {
      toast({ title: "Analysis Failed", description: "Could not start AI analysis", variant: "destructive" });
    },
  });

  return (
    <Card className={`transition-all ${expanded ? "ring-1 ring-primary/30" : ""}`}>
      <CardContent className="p-0">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={onToggle}
          data-testid={`device-card-${asset.id}`}
        >
          <div className="h-9 w-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
            <Server className="h-4.5 w-4.5 text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{asset.name}</span>
              <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${asset.status === "online" ? "text-green-400 border-green-500/30" : "text-muted-foreground"}`}>
                {asset.status}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">{asset.ipAddress} {asset.type && `· ${asset.type}`}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {sUtil?.cpu !== undefined && (
              <div className="text-center">
                <div className="text-[8px] text-muted-foreground uppercase">CPU</div>
                <div className={`text-[11px] font-mono font-medium ${(sUtil.cpu || 0) > 90 ? "text-red-400" : (sUtil.cpu || 0) > 70 ? "text-amber-400" : "text-green-400"}`}>{Math.round(sUtil.cpu)}%</div>
              </div>
            )}
            {sUtil?.memory !== undefined && (
              <div className="text-center">
                <div className="text-[8px] text-muted-foreground uppercase">MEM</div>
                <div className={`text-[11px] font-mono font-medium ${(sUtil.memory || 0) > 90 ? "text-red-400" : (sUtil.memory || 0) > 75 ? "text-amber-400" : "text-green-400"}`}>{Math.round(sUtil.memory)}%</div>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">{assetAssignments.length} metric{assetAssignments.length !== 1 ? "s" : ""}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-4 border-t border-border/30">
            {assetAssignments.length > 0 ? (
              <div className="grid grid-cols-1 gap-1.5 mt-3" data-testid="device-assigned-metrics">
                {assetAssignments.map(a => {
                  const m = metricMap.get(a.metricId);
                  if (!m) return null;
                  const Icon = iconMap[m.icon] || Activity;
                  const statusColor = a.status === "critical" ? "text-red-400" : a.status === "warning" ? "text-amber-400" : a.status === "normal" ? "text-green-400" : "text-muted-foreground";
                  return (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/10 border border-border/20" data-testid={`device-metric-${a.id}`}>
                      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-[11px] font-medium flex-1">{m.name}</span>
                      {a.lastValue !== null && a.lastValue !== undefined && (
                        <span className={`text-[11px] font-mono font-medium ${statusColor}`}>{a.lastValue}{m.unit === "%" ? "%" : ""}</span>
                      )}
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${modeConfig[a.collectionMode]?.bg || ""} ${modeConfig[a.collectionMode]?.color || ""}`}>
                        {modeConfig[a.collectionMode]?.label || a.collectionMode}
                      </Badge>
                      <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${categoryConfig[m.category]?.color || ""}`}>
                        {categoryConfig[m.category]?.label || m.category}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-3 text-center">No metrics assigned to this device</p>
            )}
            {assetAssignments.length < metrics.length && (
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/20">
                <span className="text-[10px] text-muted-foreground">
                  {metrics.length - assetAssignments.length} unassigned metric{metrics.length - assetAssignments.length !== 1 ? "s" : ""} in catalog
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={(e) => { e.stopPropagation(); aiAnalyzeMutation.mutate(); }}
                  disabled={aiAnalyzeMutation.isPending}
                  data-testid={`button-ai-analyze-${asset.id}`}
                >
                  {aiAnalyzeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                  AI Auto-Assign
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MissionCriticalCard({ group, expanded, onToggle, assets, metrics, assignments, onDelete }: {
  group: MissionCriticalGroup;
  expanded: boolean;
  onToggle: () => void;
  assets: DiscoveredAsset[];
  metrics: ServiceMetric[];
  assignments: ServiceMetricAssignment[];
  onDelete: () => void;
}) {
  const groupAssets = assets.filter(a => group.assetIds?.includes(a.id));
  const groupMetrics = metrics.filter(m => group.metricIds?.includes(m.id));
  const critColor = group.criticality === "critical" ? "text-red-400 border-red-500/30" : group.criticality === "high" ? "text-amber-400 border-amber-500/30" : group.criticality === "medium" ? "text-yellow-400 border-yellow-500/30" : "text-blue-400 border-blue-500/30";
  const statusColor = group.status === "critical" ? "text-red-400" : group.status === "degraded" ? "text-amber-400" : "text-green-400";
  const Icon = iconMap[group.icon] || Box;

  const groupAssignments = assignments.filter(a =>
    group.assetIds?.includes(a.assetId) && group.metricIds?.includes(a.metricId)
  );

  return (
    <Card className={`transition-all ${expanded ? "ring-1 ring-primary/30" : ""}`}>
      <CardContent className="p-0">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={onToggle}
          data-testid={`mcg-card-${group.id}`}
        >
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${group.color}20` }}>
            <Icon className="h-5 w-5" style={{ color: group.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{group.name}</span>
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${critColor}`}>{group.criticality}</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{group.description}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-center">
              <div className="text-[8px] text-muted-foreground uppercase">Health</div>
              <div className={`text-lg font-bold ${statusColor}`}>{group.healthScore}%</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] text-muted-foreground uppercase">Devices</div>
              <div className="text-sm font-medium">{groupAssets.length}</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] text-muted-foreground uppercase">Metrics</div>
              <div className="text-sm font-medium">{groupMetrics.length}</div>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-4 border-t border-border/30 space-y-4">
            {groupAssets.length > 0 && (
              <div className="mt-3">
                <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider mb-2">Devices</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5" data-testid="mcg-devices">
                  {groupAssets.map(asset => {
                    const meta = (asset.metadata || {}) as Record<string, any>;
                    const sUtil = meta.systemUtilization as { cpu?: number; memory?: number } | undefined;
                    return (
                      <div key={asset.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/10 border border-border/20">
                        <Server className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span className="text-[11px] font-medium flex-1 truncate">{asset.name}</span>
                        <span className="text-[10px] text-muted-foreground">{asset.ipAddress}</span>
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${asset.status === "online" ? "text-green-400 border-green-500/30" : "text-muted-foreground"}`}>
                          {asset.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {groupMetrics.length > 0 && (
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider mb-2">Monitored Metrics</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5" data-testid="mcg-metrics">
                  {groupMetrics.map(m => {
                    const Icon = iconMap[m.icon] || Activity;
                    const mode = modeConfig[m.collectionMode] || modeConfig.continuous;
                    const relAssignments = groupAssignments.filter(a => a.metricId === m.id);
                    const worstStatus = relAssignments.reduce((worst, a) => {
                      if (a.status === "critical") return "critical";
                      if (a.status === "warning" && worst !== "critical") return "warning";
                      if (a.status === "normal" && worst === "unknown") return "normal";
                      return worst;
                    }, "unknown");
                    const sColor = worstStatus === "critical" ? "text-red-400" : worstStatus === "warning" ? "text-amber-400" : worstStatus === "normal" ? "text-green-400" : "text-muted-foreground";
                    return (
                      <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/10 border border-border/20">
                        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-[11px] font-medium flex-1 truncate">{m.name}</span>
                        <span className={`text-[10px] font-medium ${sColor}`}>{worstStatus}</span>
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${mode.bg} ${mode.color}`}>{mode.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 h-7 text-[10px]" onClick={(e) => { e.stopPropagation(); onDelete(); }} data-testid={`mcg-delete-${group.id}`}>
                <Trash2 className="h-3 w-3 mr-1" /> Remove Group
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateGroupModal({ assets, metrics, onClose, onCreated }: {
  assets: DiscoveredAsset[];
  metrics: ServiceMetric[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [criticality, setCriticality] = useState("high");
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mission-critical-groups", {
        name, description, criticality,
        assetIds: selectedAssets,
        metricIds: selectedMetrics,
        icon: "Box", color: "#3b82f6", status: "healthy", healthScore: 100,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Group created", description: `${name} has been created.` });
      queryClient.invalidateQueries({ queryKey: ["/api/mission-critical-groups"] });
      onCreated();
    },
    onError: (err: any) => toast({ title: "Failed to create group", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()} data-testid="create-group-modal">
        <h3 className="text-lg font-semibold mb-4">Create Mission Critical Group</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-[11px]">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., ERP System" className="mt-1 h-9 text-sm" data-testid="input-group-name" />
          </div>
          <div>
            <Label className="text-[11px]">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Business impact description..." className="mt-1 text-sm min-h-[60px]" data-testid="input-group-description" />
          </div>
          <div>
            <Label className="text-[11px]">Criticality</Label>
            <Select value={criticality} onValueChange={setCriticality}>
              <SelectTrigger className="mt-1 h-9 text-sm" data-testid="select-criticality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px]">Devices ({selectedAssets.length} selected)</Label>
            <ScrollArea className="mt-1 h-32 border border-border/30 rounded-md p-2">
              {assets.map(a => (
                <label key={a.id} className="flex items-center gap-2 py-1 px-1 hover:bg-muted/20 rounded cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={selectedAssets.includes(a.id)}
                    onChange={e => setSelectedAssets(prev => e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id))}
                    className="rounded"
                  />
                  <Server className="h-3 w-3 text-cyan-400" />
                  <span className="flex-1 truncate">{a.name}</span>
                  <span className="text-muted-foreground">{a.ipAddress}</span>
                </label>
              ))}
            </ScrollArea>
          </div>
          <div>
            <Label className="text-[11px]">Service Metrics ({selectedMetrics.length} selected)</Label>
            <ScrollArea className="mt-1 h-32 border border-border/30 rounded-md p-2">
              {metrics.map(m => {
                const Icon = iconMap[m.icon] || Activity;
                return (
                  <label key={m.id} className="flex items-center gap-2 py-1 px-1 hover:bg-muted/20 rounded cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(m.id)}
                      onChange={e => setSelectedMetrics(prev => e.target.checked ? [...prev, m.id] : prev.filter(x => x !== m.id))}
                      className="rounded"
                    />
                    <Icon className="h-3 w-3 text-primary" />
                    <span className="flex-1 truncate">{m.name}</span>
                    <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${modeConfig[m.collectionMode]?.bg || ""} ${modeConfig[m.collectionMode]?.color || ""}`}>
                      {modeConfig[m.collectionMode]?.label}
                    </Badge>
                  </label>
                );
              })}
            </ScrollArea>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={onClose} className="h-8 text-sm" data-testid="button-cancel-group">Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || !description || createMutation.isPending}
              className="h-8 text-sm"
              data-testid="button-create-group"
            >
              {createMutation.isPending ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Essential", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
  recommended: { label: "Suggested", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
  optional: { label: "Optional", color: "text-muted-foreground", bg: "bg-muted/20 border-border/30" },
};

function AgentProfileCard({ role, profiles, metrics, assets, onGenerate, onProvision, onViewDashboard, isGenerating }: {
  role: OrgRole;
  profiles: EnrichedProfile[];
  metrics: ServiceMetric[];
  assets: DiscoveredAsset[];
  onGenerate: () => void;
  onProvision: () => void;
  onViewDashboard: () => void;
  isGenerating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const RoleIcon = iconMap[role.icon] || Activity;
  const agentAssets = assets.filter(a => a.assignedAgentRoleId === role.id);
  const criticalCount = profiles.filter(p => p.priority === "critical").length;
  const recommendedCount = profiles.filter(p => p.priority === "recommended").length;

  return (
    <Card className={`transition-all ${expanded ? "ring-1 ring-primary/30" : ""}`}>
      <CardContent className="p-0">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => setExpanded(!expanded)}
          data-testid={`agent-profile-card-${role.id}`}
        >
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${role.color}20` }}>
            <RoleIcon className="h-4.5 w-4.5" style={{ color: role.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{role.title}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">{role.level}</Badge>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{role.department}</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{role.division || role.description}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {profiles.length > 0 ? (
              <>
                <div className="text-center">
                  <div className="text-[8px] text-muted-foreground uppercase">Metrics</div>
                  <div className="text-[11px] font-mono font-medium text-primary">{profiles.length}</div>
                </div>
                {criticalCount > 0 && (
                  <div className="text-center">
                    <div className="text-[8px] text-muted-foreground uppercase">Essential</div>
                    <div className="text-[11px] font-mono font-medium text-red-400">{criticalCount}</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="text-[8px] text-muted-foreground uppercase">Devices</div>
                  <div className="text-[11px] font-mono font-medium">{agentAssets.length}</div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-[11px] gap-1.5"
                  onClick={(e) => { e.stopPropagation(); onViewDashboard(); }}
                  data-testid={`button-view-dashboard-${role.id}`}
                >
                  <LayoutDashboard className="h-3 w-3" />
                  Dashboard
                </Button>
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">No profile</span>
            )}
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </div>
        {expanded && (
          <div className="px-4 pb-4 border-t border-border/30">
            {profiles.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-1.5 mt-3" data-testid={`agent-profile-metrics-${role.id}`}>
                  {profiles.map(p => {
                    const m = p.metric;
                    if (!m) return null;
                    const Icon = iconMap[m.icon] || Activity;
                    const pri = priorityConfig[p.priority] || priorityConfig.recommended;
                    return (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/10 border border-border/20" data-testid={`profile-metric-${p.id}`}>
                        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-[11px] font-medium flex-1">{m.name}</span>
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${pri.bg} ${pri.color}`}>{pri.label}</Badge>
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 ${categoryConfig[m.category]?.color || ""}`}>
                          {categoryConfig[m.category]?.label || m.category}
                        </Badge>
                        {p.reasoning && (
                          <span className="text-[9px] text-muted-foreground max-w-[200px] truncate" title={p.reasoning}>{p.reasoning}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {agentAssets.length} device{agentAssets.length !== 1 ? "s" : ""} assigned
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] gap-1 px-2 text-muted-foreground hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                      disabled={isGenerating}
                      data-testid={`button-regenerate-profile-${role.id}`}
                    >
                      {isGenerating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
                      Regenerate
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {agentAssets.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); onProvision(); }}
                        data-testid={`button-provision-${role.id}`}
                      >
                        <Zap className="h-3 w-3" />
                        Provision to Devices
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-[11px] gap-1.5"
                      onClick={(e) => { e.stopPropagation(); onViewDashboard(); }}
                      data-testid={`button-view-dashboard-${role.id}`}
                    >
                      <LayoutDashboard className="h-3 w-3" />
                      View Dashboard
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3 text-center py-4">
                <Brain className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-[11px] text-muted-foreground mb-3">No best-practice metric profile generated yet</p>
                <Button
                  size="sm"
                  className="h-7 text-[11px] gap-1.5"
                  onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                  disabled={isGenerating}
                  data-testid={`button-generate-profile-${role.id}`}
                >
                  {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Generate Best Practice Profile
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ServiceCatalogMetrics() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("metrics");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const { data: metrics, isLoading: metricsLoading } = useQuery<ServiceMetric[]>({ queryKey: ["/api/service-metrics"] });
  const { data: assignments } = useQuery<ServiceMetricAssignment[]>({ queryKey: ["/api/service-metric-assignments"] });
  const { data: assets } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const { data: groups } = useQuery<MissionCriticalGroup[]>({ queryKey: ["/api/mission-critical-groups"] });
  const { data: orgRoles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });
  const { data: allProfiles } = useQuery<AgentMetricProfile[]>({ queryKey: ["/api/agent-metric-profiles"] });
  const [generatingRoles, setGeneratingRoles] = useState<Set<string>>(new Set());

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/service-metrics/seed");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.seeded) {
        toast({ title: "Catalog seeded", description: `${data.count} service metrics created.` });
      } else {
        toast({ title: "Catalog exists", description: `${data.count} metrics already in catalog.` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/service-metrics"] });
    },
    onError: (err: any) => toast({ title: "Seed failed", description: err.message, variant: "destructive" }),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/mission-critical-groups/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Group deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/mission-critical-groups"] });
    },
  });

  const generateProfileMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await apiRequest("POST", `/api/agent-metric-profiles/generate/${roleId}`);
      return res.json();
    },
    onMutate: (roleId: string) => {
      setGeneratingRoles(prev => new Set(prev).add(roleId));
    },
    onSuccess: (data: any, roleId: string) => {
      toast({ title: "Profile Generation Started", description: data.message });
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agent-metric-profiles"] });
      }, 3000);
      setTimeout(() => {
        clearInterval(poll);
        setGeneratingRoles(prev => { const n = new Set(prev); n.delete(roleId); return n; });
      }, 15000);
    },
    onError: (err: any, roleId: string) => {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
      setGeneratingRoles(prev => { const n = new Set(prev); n.delete(roleId); return n; });
    },
  });

  const provisionMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await apiRequest("POST", `/api/agent-metric-profiles/provision/${roleId}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Metrics Provisioned", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/service-metric-assignments"] });
    },
    onError: (err: any) => toast({ title: "Provisioning Failed", description: err.message, variant: "destructive" }),
  });

  const generateAllProfilesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/agent-metric-profiles/generate-all");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Bulk Profile Generation", description: data.message });
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/agent-metric-profiles"] });
      }, 4000);
      setTimeout(() => clearInterval(poll), 60000);
    },
    onError: (err: any) => toast({ title: "Generation Failed", description: err.message, variant: "destructive" }),
  });

  const aiAnalyzeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/service-metrics/ai-analyze-all");
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "AI Metrics Agent Dispatched",
        description: data.message || `Analyzing ${data.queued} devices for intelligent metric assignment`,
      });
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/service-metric-assignments"] });
      }, 4000);
      setTimeout(() => clearInterval(poll), 60000);
    },
    onError: (err: any) => toast({ title: "AI Analysis Failed", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (metrics && metrics.length === 0 && !metricsLoading) {
      seedMutation.mutate();
    }
  }, [metrics, metricsLoading]);

  const filteredMetrics = useMemo(() => {
    if (!metrics) return [];
    return metrics.filter(m => {
      if (searchTerm && !m.name.toLowerCase().includes(searchTerm.toLowerCase()) && !m.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
      if (modeFilter !== "all" && m.collectionMode !== modeFilter) return false;
      return true;
    });
  }, [metrics, searchTerm, categoryFilter, modeFilter]);

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    if (!searchTerm) return assets;
    return assets.filter(a =>
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.ipAddress && a.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [assets, searchTerm]);

  const stats = useMemo(() => {
    if (!metrics) return { total: 0, continuous: 0, scheduled: 0, onDemand: 0 };
    return {
      total: metrics.length,
      continuous: metrics.filter(m => m.collectionMode === "continuous").length,
      scheduled: metrics.filter(m => m.collectionMode === "scheduled").length,
      onDemand: metrics.filter(m => m.collectionMode === "on_demand").length,
    };
  }, [metrics]);

  const aiAgentRoles = useMemo(() => {
    if (!orgRoles || !subscriptions) return [];
    const activeAiSubs = subscriptions.filter(s => s.status === "active" && s.hasAiShadow);
    const roleMap = new Map(orgRoles.map(r => [r.id, r]));
    return activeAiSubs
      .map(s => roleMap.get(s.roleId))
      .filter((r): r is OrgRole => !!r)
      .filter(r => {
        if (!searchTerm) return true;
        return r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.department.toLowerCase().includes(searchTerm.toLowerCase());
      });
  }, [orgRoles, subscriptions, searchTerm]);

  const profilesByRole = useMemo(() => {
    const map = new Map<string, EnrichedProfile[]>();
    if (!allProfiles || !metrics) return map;
    const metricMap = new Map(metrics.map(m => [m.id, m]));
    for (const p of allProfiles) {
      const enriched: EnrichedProfile = { ...p, metric: metricMap.get(p.metricId) || null };
      const list = map.get(p.roleId) || [];
      list.push(enriched);
      map.set(p.roleId, list);
    }
    return map;
  }, [allProfiles, metrics]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" data-testid="page-title">Service Metrics Catalog</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor, assign, and manage service metrics across your infrastructure</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Gauge className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-xl font-bold" data-testid="stat-total">{stats.total}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Total Metrics</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Activity className="h-5 w-5 mx-auto text-green-400 mb-1" />
            <div className="text-xl font-bold text-green-400" data-testid="stat-continuous">{stats.continuous}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Continuous</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Timer className="h-5 w-5 mx-auto text-blue-400 mb-1" />
            <div className="text-xl font-bold text-blue-400" data-testid="stat-scheduled">{stats.scheduled}</div>
            <div className="text-[9px] text-muted-foreground uppercase">Scheduled</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Zap className="h-5 w-5 mx-auto text-amber-400 mb-1" />
            <div className="text-xl font-bold text-amber-400" data-testid="stat-ondemand">{stats.onDemand}</div>
            <div className="text-[9px] text-muted-foreground uppercase">On-Demand</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="h-auto flex-wrap" data-testid="view-tabs">
            <TabsTrigger value="metrics" data-testid="tab-metrics">
              <Gauge className="h-3.5 w-3.5 mr-1.5" /> Service Metrics
            </TabsTrigger>
            <TabsTrigger value="devices" data-testid="tab-devices">
              <Server className="h-3.5 w-3.5 mr-1.5" /> Device View
            </TabsTrigger>
            <TabsTrigger value="mission-critical" data-testid="tab-mission-critical">
              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Mission Critical
            </TabsTrigger>
            <TabsTrigger value="agent-profiles" data-testid="tab-agent-profiles">
              <Brain className="h-3.5 w-3.5 mr-1.5" /> Agent Profiles
            </TabsTrigger>
            <TabsTrigger value="ai-cost" data-testid="tab-ai-cost">
              <DollarSign className="h-3.5 w-3.5 mr-1.5" /> AI Cost Estimator
            </TabsTrigger>
            <TabsTrigger value="cache" data-testid="tab-cache">
              <Database className="h-3.5 w-3.5 mr-1.5" /> Cache Intelligence
            </TabsTrigger>
            <TabsTrigger value="ai-providers" data-testid="tab-ai-providers">
              <Plug className="h-3.5 w-3.5 mr-1.5" /> AI Providers
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="pl-8 h-8 w-48 text-sm"
                data-testid="input-search"
              />
            </div>
            {activeTab === "metrics" && (
              <>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 w-32 text-sm" data-testid="filter-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="availability">Availability</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={modeFilter} onValueChange={setModeFilter}>
                  <SelectTrigger className="h-8 w-32 text-sm" data-testid="filter-mode">
                    <SelectValue placeholder="Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Modes</SelectItem>
                    <SelectItem value="continuous">Continuous</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="on_demand">On-Demand</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            {activeTab === "devices" && (
              <Button
                size="sm"
                className="h-8 text-sm gap-1.5"
                onClick={() => aiAnalyzeAllMutation.mutate()}
                disabled={aiAnalyzeAllMutation.isPending}
                data-testid="button-ai-analyze-all"
              >
                {aiAnalyzeAllMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                AI Auto-Assign All
              </Button>
            )}
            {activeTab === "agent-profiles" && (
              <Button
                size="sm"
                className="h-8 text-sm gap-1.5"
                onClick={() => generateAllProfilesMutation.mutate()}
                disabled={generateAllProfilesMutation.isPending}
                data-testid="button-generate-all-profiles"
              >
                {generateAllProfilesMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate All Profiles
              </Button>
            )}
            {activeTab === "mission-critical" && (
              <Button size="sm" className="h-8 text-sm" onClick={() => setShowCreateGroup(true)} data-testid="button-create-group">
                <Plus className="h-3.5 w-3.5 mr-1" /> Create Group
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="metrics" className="mt-4">
          {metricsLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading service metrics...</div>
          ) : filteredMetrics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gauge className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No service metrics found</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="metrics-list">
              {filteredMetrics.map(m => (
                <MetricCard
                  key={m.id}
                  metric={m}
                  expanded={expandedMetric === m.id}
                  onToggle={() => setExpandedMetric(prev => prev === m.id ? null : m.id)}
                  assignments={assignments || []}
                  assets={assets || []}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="devices" className="mt-4">
          {!assets ? (
            <div className="text-center py-12 text-muted-foreground">Loading devices...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No devices found</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="devices-list">
              {filteredAssets.map(a => (
                <DeviceMetricsCard
                  key={a.id}
                  asset={a}
                  expanded={expandedDevice === a.id}
                  onToggle={() => setExpandedDevice(prev => prev === a.id ? null : a.id)}
                  assignments={assignments || []}
                  metrics={metrics || []}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mission-critical" className="mt-4">
          {!groups ? (
            <div className="text-center py-12 text-muted-foreground">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="mb-2">No mission critical groups defined</p>
              <p className="text-[11px]">Create groups to monitor business-critical application stacks</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="mcg-list">
              {groups.map(g => (
                <MissionCriticalCard
                  key={g.id}
                  group={g}
                  expanded={expandedGroup === g.id}
                  onToggle={() => setExpandedGroup(prev => prev === g.id ? null : g.id)}
                  assets={assets || []}
                  metrics={metrics || []}
                  assignments={assignments || []}
                  onDelete={() => deleteGroupMutation.mutate(g.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="agent-profiles" className="mt-4">
          {!orgRoles || !subscriptions ? (
            <div className="text-center py-12 text-muted-foreground">Loading agent profiles...</div>
          ) : aiAgentRoles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="mb-2">No active AI agents with shadows enabled</p>
              <p className="text-[11px]">Enable AI Shadow on agent subscriptions to generate best-practice metric profiles</p>
            </div>
          ) : (
            <div className="space-y-2" data-testid="agent-profiles-list">
              {aiAgentRoles.map(role => (
                <AgentProfileCard
                  key={role.id}
                  role={role}
                  profiles={profilesByRole.get(role.id) || []}
                  metrics={metrics || []}
                  assets={assets || []}
                  onGenerate={() => generateProfileMutation.mutate(role.id)}
                  onProvision={() => provisionMutation.mutate(role.id)}
                  onViewDashboard={() => setLocation(`/infrastructure/agent-dashboard/${role.id}`)}
                  isGenerating={generatingRoles.has(role.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ai-cost" className="mt-4">
          <AiCostEstimator
            assetCount={assets?.length || 0}
            metricCount={metrics?.length || 0}
            assignmentCount={assignments?.length || 0}
            agentCount={orgRoles?.length || 0}
          />
        </TabsContent>

        <TabsContent value="cache" className="mt-4">
          <CacheIntelligence />
        </TabsContent>

        <TabsContent value="ai-providers" className="mt-4">
          <AiProviderManager orgRoles={orgRoles} />
        </TabsContent>
      </Tabs>

      {showCreateGroup && (
        <CreateGroupModal
          assets={assets || []}
          metrics={metrics || []}
          onClose={() => setShowCreateGroup(false)}
          onCreated={() => setShowCreateGroup(false)}
        />
      )}
    </div>
  );
}
