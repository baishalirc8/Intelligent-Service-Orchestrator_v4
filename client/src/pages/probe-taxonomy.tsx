import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Server, Wifi, Brain, CircuitBoard, Plus, Trash2, Edit,
  Loader2, X, Radar, HardDrive, Container, Cloud, Cpu,
  Network, Monitor, Globe, Key, Shield, Satellite,
  Activity, ChevronDown, ChevronRight, ChevronLeft, Zap, ArrowRight,
  Signal, Radio, Terminal, Building, Lock, Search, Smartphone, Tablet,
} from "lucide-react";
import { useState, useCallback } from "react";
import type { ProbeType, DiscoveryProbe, OrgRole, RoleSubscription } from "@shared/schema";

interface ProtocolConfig {
  type: string;
  priority: number;
  enabled: boolean;
  config: Record<string, any>;
}

const commProtocolDefs = [
  { type: "https", label: "HTTPS", icon: Globe, color: "text-green-400", description: "Standard REST API over TLS" },
  { type: "mqtt", label: "MQTT", icon: Radio, color: "text-cyan-400", description: "Lightweight pub/sub messaging protocol" },
  { type: "websocket", label: "WebSocket", icon: Zap, color: "text-blue-400", description: "Persistent bidirectional connection" },
  { type: "coap", label: "CoAP", icon: Signal, color: "text-amber-400", description: "Constrained Application Protocol over UDP" },
  { type: "tcp", label: "Raw TCP", icon: Network, color: "text-purple-400", description: "Direct TCP socket with JSON framing" },
  { type: "udp", label: "Raw UDP", icon: Activity, color: "text-orange-400", description: "Connectionless UDP datagrams" },
  { type: "serial", label: "Serial (RS-232/485)", icon: Terminal, color: "text-yellow-400", description: "Hardware serial port for industrial/OT" },
  { type: "lora", label: "LoRa Radio", icon: Satellite, color: "text-pink-400", description: "Long-range low-power radio via RN2483/RNode" },
  { type: "reticulum", label: "Reticulum (RNS)", icon: Shield, color: "text-emerald-400", description: "Encrypted mesh networking via Reticulum Network Stack" },
];

const iconMap: Record<string, typeof Server> = {
  Server, Wifi, Brain, Radar, HardDrive, Container, Cloud, Cpu,
  Network, Monitor, Globe, Key, Shield, Satellite, Activity,
  Zap, Signal, Radio, Terminal, Building, Lock, CircuitBoard,
  Smartphone, Tablet,
};

const couplingModes = [
  {
    value: "coupled",
    label: "Coupled",
    icon: Server,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    glowColor: "shadow-blue-500/5",
    description: "Requires constant server connectivity. Real-time telemetry and direct command dispatch.",
    traits: ["Always connected", "Real-time data", "Server-driven", "No local storage"],
  },
  {
    value: "semi-autonomous",
    label: "Semi-Autonomous",
    icon: Wifi,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    glowColor: "shadow-amber-500/5",
    description: "Full local AI reasoning on edge devices (Raspberry Pi, drones). Operates independently and eventually reconnects to sync collected data and decisions.",
    traits: ["Local AI reasoning", "Edge deployment", "Eventually reconnects", "Store & forward sync"],
  },
  {
    value: "autonomous",
    label: "Fully Autonomous",
    icon: Brain,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    glowColor: "shadow-purple-500/5",
    description: "Full local AI reasoning with permanent independence. Operates indefinitely without server contact — self-healing, self-deciding, fully self-sufficient.",
    traits: ["Local AI reasoning", "Permanent independence", "Self-healing", "No reconnection required"],
  },
];

const protocolOptions = [
  { value: "snmp_v2c", label: "SNMP v2c" },
  { value: "snmp_v3", label: "SNMP v3" },
  { value: "ssh", label: "SSH" },
  { value: "wmi", label: "WMI" },
  { value: "http", label: "HTTP/REST" },
  { value: "api", label: "API" },
  { value: "mdm", label: "MDM (Android / iOS)" },
  { value: "modbus", label: "Modbus" },
  { value: "bacnet", label: "BACnet" },
  { value: "mqtt", label: "MQTT" },
  { value: "lorawan", label: "LoRaWAN" },
];

const deploymentOptions = [
  { value: "bare-metal", label: "Bare-Metal", icon: HardDrive },
  { value: "container", label: "Container", icon: Container },
  { value: "embedded", label: "Embedded", icon: Cpu },
  { value: "cloud", label: "Cloud", icon: Cloud },
  { value: "mobile", label: "Mobile (Android/iOS)", icon: Smartphone },
];

const syncOptions = [
  { value: "opportunistic", label: "Opportunistic — sync when connection available" },
  { value: "periodic", label: "Periodic — sync on schedule" },
  { value: "manual", label: "Manual — sync on demand only" },
];

function ProbeTypeForm({ probeType, defaultMode, onClose }: { probeType?: ProbeType; defaultMode?: string; onClose: () => void }) {
  const { toast } = useToast();
  const isEdit = !!probeType;

  const [name, setName] = useState(probeType?.name || "");
  const [description, setDescription] = useState(probeType?.description || "");
  const [couplingMode, setCouplingMode] = useState(probeType?.couplingMode || defaultMode || "coupled");
  const [protocol, setProtocol] = useState(probeType?.protocol || "wmi");
  const [deploymentModel, setDeploymentModel] = useState(probeType?.deploymentModel || (couplingMode === "autonomous" ? "container" : "bare-metal"));
  const [requiresEnrollment, setRequiresEnrollment] = useState(probeType?.requiresEnrollment ?? true);
  const [containerImage, setContainerImage] = useState(probeType?.containerImage || "");
  const [hasLocalReasoning, setHasLocalReasoning] = useState(probeType?.hasLocalReasoning || false);
  const [bufferCapacity, setBufferCapacity] = useState(probeType?.bufferCapacity || (couplingMode === "semi-autonomous" ? 10000 : couplingMode === "autonomous" ? 50000 : 0));
  const [syncStrategy, setSyncStrategy] = useState(probeType?.syncStrategy || (couplingMode === "semi-autonomous" ? "opportunistic" : couplingMode === "autonomous" ? "periodic" : ""));
  const [cpuRes, setCpuRes] = useState((probeType?.containerResources as any)?.cpu || "2 cores");
  const [memRes, setMemRes] = useState((probeType?.containerResources as any)?.memory || "4 GB");
  const [storageRes, setStorageRes] = useState((probeType?.containerResources as any)?.storage || "20 GB");
  const [charInput, setCharInput] = useState("");
  const [characteristics, setCharacteristics] = useState<string[]>(probeType?.characteristics || []);
  const [assignedAgentRoleId, setAssignedAgentRoleId] = useState(probeType?.assignedAgentRoleId || "");
  const [commProtocols, setCommProtocols] = useState<ProtocolConfig[]>(() => {
    const existing = (probeType?.communicationProtocols as ProtocolConfig[] | null) || [];
    if (existing.length > 0) return existing;
    return [{ type: "https", priority: 1, enabled: true, config: {} }];
  });

  const { data: orgRoles = [] } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });

  const modeConfig = couplingModes.find(m => m.value === couplingMode);
  const ModeIcon = modeConfig?.icon || Server;

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit) return apiRequest("PATCH", `/api/probe-types/${probeType.id}`, data);
      return apiRequest("POST", "/api/probe-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/probe-types"] });
      toast({ title: isEdit ? "Probe type updated" : "Probe type created" });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save probe type", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim() || !description.trim()) return;
    const isEdge = couplingMode !== "coupled";
    const containerResources = isEdge ? { cpu: cpuRes, memory: memRes, storage: storageRes } : null;
    saveMutation.mutate({
      name, description,
      icon: modeConfig?.value === "coupled" ? "Server" : modeConfig?.value === "semi-autonomous" ? "Wifi" : "Brain",
      color: modeConfig?.color || "text-blue-400",
      protocol: protocol || null,
      deploymentModel: deploymentModel || null,
      couplingMode,
      characteristics,
      requiresEnrollment,
      containerImage: isEdge ? containerImage || null : null,
      containerResources,
      hasLocalReasoning: isEdge ? hasLocalReasoning : false,
      bufferCapacity: isEdge ? bufferCapacity : 0,
      syncStrategy: isEdge ? syncStrategy || null : null,
      communicationProtocols: commProtocols.filter(p => p.enabled),
      assignedAgentRoleId: assignedAgentRoleId || null,
    });
  };

  const addChar = () => {
    if (charInput.trim() && !characteristics.includes(charInput.trim())) {
      setCharacteristics([...characteristics, charInput.trim()]);
      setCharInput("");
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="flex gap-2 p-1 bg-muted/20 rounded-lg">
        {couplingModes.map(mode => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.value}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${
                couplingMode === mode.value
                  ? `${mode.bgColor} ${mode.color} ${mode.borderColor} border`
                  : "text-muted-foreground hover:bg-muted/30"
              }`}
              onClick={() => {
                setCouplingMode(mode.value);
                if (mode.value === "autonomous") { setDeploymentModel("container"); setHasLocalReasoning(true); setBufferCapacity(50000); setSyncStrategy("periodic"); }
                else if (mode.value === "semi-autonomous") { setDeploymentModel("embedded"); setHasLocalReasoning(true); setBufferCapacity(10000); setSyncStrategy("opportunistic"); }
                else if (mode.value === "coupled") { setDeploymentModel("bare-metal"); setHasLocalReasoning(false); setBufferCapacity(0); setSyncStrategy(""); }
              }}
              data-testid={`mode-select-${mode.value}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {mode.label}
            </button>
          );
        })}
      </div>

      <div className={`rounded-md border px-3 py-2 text-[10px] ${modeConfig?.bgColor} ${modeConfig?.borderColor} ${modeConfig?.color}`}>
        <ModeIcon className="h-3 w-3 inline mr-1.5" />
        {modeConfig?.description}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-[11px]">Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Windows Telemetry Agent" className="h-8 text-xs mt-1" data-testid="input-probe-type-name" />
        </div>
        <div className="col-span-2">
          <Label className="text-[11px]">Description</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this probe does..." className="h-8 text-xs mt-1" data-testid="input-probe-type-description" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px]">Protocol</Label>
          <Select value={protocol} onValueChange={setProtocol}>
            <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-protocol">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {protocolOptions.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[11px]">Deployment</Label>
          <Select value={deploymentModel || ""} onValueChange={setDeploymentModel}>
            <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-deployment">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {deploymentOptions.map(d => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-[11px]">Assigned AI Agent <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Select value={assignedAgentRoleId || "none"} onValueChange={v => setAssignedAgentRoleId(v === "none" ? "" : v)}>
          <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-assigned-agent">
            <SelectValue placeholder="No agent assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— No agent assigned —</SelectItem>
            {orgRoles.map(role => (
              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {couplingMode !== "coupled" && (
        <div className="space-y-3 p-3 rounded-lg border border-border/30 bg-muted/5">
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            <Brain className={`h-3.5 w-3.5 ${couplingMode === "autonomous" ? "text-purple-400" : "text-amber-400"}`} />
            Edge Deployment & AI Configuration
          </div>

          <div>
            <Label className="text-[11px]">Container Image</Label>
            <Input value={containerImage} onChange={e => setContainerImage(e.target.value)} placeholder={couplingMode === "autonomous" ? "holocron/probe-autonomous:latest" : "holocron/probe-edge:latest"} className="h-8 text-xs mt-1 font-mono" data-testid="input-container-image" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px]">CPU</Label>
              <Input value={cpuRes} onChange={e => setCpuRes(e.target.value)} placeholder={couplingMode === "autonomous" ? "2 cores" : "1 core"} className="h-7 text-[10px] mt-1" data-testid="input-cpu" />
            </div>
            <div>
              <Label className="text-[10px]">Memory</Label>
              <Input value={memRes} onChange={e => setMemRes(e.target.value)} placeholder={couplingMode === "autonomous" ? "4 GB" : "1 GB"} className="h-7 text-[10px] mt-1" data-testid="input-memory" />
            </div>
            <div>
              <Label className="text-[10px]">Storage</Label>
              <Input value={storageRes} onChange={e => setStorageRes(e.target.value)} placeholder={couplingMode === "autonomous" ? "20 GB" : "8 GB"} className="h-7 text-[10px] mt-1" data-testid="input-storage" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px]">Buffer Capacity (entries)</Label>
              <Input type="number" value={bufferCapacity} onChange={e => setBufferCapacity(parseInt(e.target.value) || 0)} className="h-8 text-xs mt-1 font-mono" data-testid="input-buffer-capacity" />
            </div>
            <div>
              <Label className="text-[11px]">Sync Strategy</Label>
              <Select value={syncStrategy} onValueChange={setSyncStrategy}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="select-sync-strategy">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {syncOptions.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasLocalReasoning} onChange={e => setHasLocalReasoning(e.target.checked)} className="rounded" data-testid="checkbox-local-reasoning" />
            <span className="text-[11px]">Enable local AI reasoning (on-device inference)</span>
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={requiresEnrollment} onChange={e => setRequiresEnrollment(e.target.checked)} className="rounded" data-testid="checkbox-enrollment" />
        <span className="text-[11px]">Requires enrollment before operation</span>
      </label>

      <div>
        <Label className="text-[11px]">Capabilities</Label>
        <div className="flex gap-1.5 mt-1">
          <Input
            value={charInput}
            onChange={e => setCharInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addChar())}
            placeholder="Add capability..."
            className="h-8 text-xs flex-1"
            data-testid="input-capability"
          />
          <Button size="sm" variant="outline" onClick={addChar} className="h-8 text-xs" data-testid="button-add-capability">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {characteristics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {characteristics.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[9px] gap-1 pr-1">
                {c}
                <button onClick={() => setCharacteristics(characteristics.filter((_, j) => j !== i))} className="hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-primary" />
          <Label className="text-[11px] font-semibold">Communication Protocols</Label>
          <Badge variant="outline" className="text-[8px] ml-auto">
            {commProtocols.filter(p => p.enabled).length} active
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-1">
          Configure transport chain with priority fallback. Probes try each enabled protocol in order.
        </p>
        <div className="space-y-2">
          {commProtocolDefs
            .map(pd => {
              const PIcon = pd.icon;
              const existing = commProtocols.find(p => p.type === pd.type);
              const isEnabled = existing?.enabled ?? false;
              const priority = existing?.priority ?? 99;
              const config = existing?.config ?? {};

              const toggleProtocol = () => {
                if (isEnabled) {
                  setCommProtocols(prev => prev.filter(p => p.type !== pd.type));
                } else {
                  const maxPri = Math.max(0, ...commProtocols.filter(p => p.enabled).map(p => p.priority));
                  setCommProtocols(prev => [...prev, { type: pd.type, priority: maxPri + 1, enabled: true, config: {} }]);
                }
              };

              const updateConfig = (key: string, value: any) => {
                setCommProtocols(prev => prev.map(p =>
                  p.type === pd.type ? { ...p, config: { ...p.config, [key]: value } } : p
                ));
              };

              const movePriority = (dir: -1 | 1) => {
                setCommProtocols(prev => {
                  const sorted = [...prev].filter(p => p.enabled).sort((a, b) => a.priority - b.priority);
                  const idx = sorted.findIndex(p => p.type === pd.type);
                  if (idx < 0) return prev;
                  const swapIdx = idx + dir;
                  if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
                  const tempPri = sorted[idx].priority;
                  sorted[idx].priority = sorted[swapIdx].priority;
                  sorted[swapIdx].priority = tempPri;
                  return prev.map(p => {
                    const updated = sorted.find(s => s.type === p.type);
                    return updated ? { ...p, priority: updated.priority } : p;
                  });
                });
              };

              return (
                <div key={pd.type} className={`rounded-lg border p-2.5 transition-all ${isEnabled ? "border-primary/30 bg-primary/5" : "border-border/30 opacity-60"}`} data-testid={`protocol-${pd.type}`}>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input type="checkbox" checked={isEnabled} onChange={toggleProtocol} className="rounded" data-testid={`toggle-protocol-${pd.type}`} />
                      <PIcon className={`h-3.5 w-3.5 ${pd.color}`} />
                      <span className="text-[11px] font-medium">{pd.label}</span>
                      <span className="text-[9px] text-muted-foreground ml-1">{pd.description}</span>
                    </label>
                    {isEnabled && (
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[8px] font-mono">P{priority}</Badge>
                        <button onClick={() => movePriority(-1)} className="text-muted-foreground hover:text-foreground p-0.5" data-testid={`priority-up-${pd.type}`}>
                          <ChevronRight className="h-3 w-3 -rotate-90" />
                        </button>
                        <button onClick={() => movePriority(1)} className="text-muted-foreground hover:text-foreground p-0.5" data-testid={`priority-down-${pd.type}`}>
                          <ChevronRight className="h-3 w-3 rotate-90" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isEnabled && (
                    <div className="mt-2 pl-6 grid grid-cols-2 gap-2">
                      {pd.type === "mqtt" && (
                        <>
                          <div>
                            <Label className="text-[9px]">Broker URL</Label>
                            <Input value={config.brokerUrl || ""} onChange={e => updateConfig("brokerUrl", e.target.value)} placeholder="mqtt://broker:1883" className="h-6 text-[10px] mt-0.5" data-testid="input-mqtt-broker" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Topic Prefix</Label>
                            <Input value={config.topicPrefix || ""} onChange={e => updateConfig("topicPrefix", e.target.value)} placeholder="holocron/" className="h-6 text-[10px] mt-0.5" data-testid="input-mqtt-topic" />
                          </div>
                          <div>
                            <Label className="text-[9px]">QoS</Label>
                            <Select value={String(config.qos ?? "1")} onValueChange={v => updateConfig("qos", parseInt(v))}>
                              <SelectTrigger className="h-6 text-[10px] mt-0.5" data-testid="select-mqtt-qos"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0">QoS 0 (At most once)</SelectItem>
                                <SelectItem value="1">QoS 1 (At least once)</SelectItem>
                                <SelectItem value="2">QoS 2 (Exactly once)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <label className="flex items-center gap-1.5 text-[9px] mt-3">
                            <input type="checkbox" checked={config.tls ?? false} onChange={e => updateConfig("tls", e.target.checked)} className="rounded" />
                            TLS Encryption
                          </label>
                        </>
                      )}
                      {pd.type === "websocket" && (
                        <>
                          <div>
                            <Label className="text-[9px]">WebSocket URL</Label>
                            <Input value={config.url || ""} onChange={e => updateConfig("url", e.target.value)} placeholder="wss://server/ws" className="h-6 text-[10px] mt-0.5" data-testid="input-ws-url" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Reconnect Interval (ms)</Label>
                            <Input type="number" value={config.reconnectInterval || 5000} onChange={e => updateConfig("reconnectInterval", parseInt(e.target.value))} className="h-6 text-[10px] mt-0.5" data-testid="input-ws-reconnect" />
                          </div>
                        </>
                      )}
                      {pd.type === "coap" && (
                        <>
                          <div>
                            <Label className="text-[9px]">Server Host</Label>
                            <Input value={config.host || ""} onChange={e => updateConfig("host", e.target.value)} placeholder="coap-server" className="h-6 text-[10px] mt-0.5" data-testid="input-coap-host" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Port</Label>
                            <Input type="number" value={config.port || 5683} onChange={e => updateConfig("port", parseInt(e.target.value))} className="h-6 text-[10px] mt-0.5" data-testid="input-coap-port" />
                          </div>
                          <label className="flex items-center gap-1.5 text-[9px] mt-1 col-span-2">
                            <input type="checkbox" checked={config.dtls ?? false} onChange={e => updateConfig("dtls", e.target.checked)} className="rounded" />
                            DTLS Encryption
                          </label>
                        </>
                      )}
                      {pd.type === "tcp" && (
                        <>
                          <div>
                            <Label className="text-[9px]">Host</Label>
                            <Input value={config.host || ""} onChange={e => updateConfig("host", e.target.value)} placeholder="server-host" className="h-6 text-[10px] mt-0.5" data-testid="input-tcp-host" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Port</Label>
                            <Input type="number" value={config.port || 9000} onChange={e => updateConfig("port", parseInt(e.target.value))} className="h-6 text-[10px] mt-0.5" data-testid="input-tcp-port" />
                          </div>
                          <label className="flex items-center gap-1.5 text-[9px] mt-1 col-span-2">
                            <input type="checkbox" checked={config.tls ?? false} onChange={e => updateConfig("tls", e.target.checked)} className="rounded" />
                            TLS Encryption
                          </label>
                        </>
                      )}
                      {pd.type === "udp" && (
                        <>
                          <div>
                            <Label className="text-[9px]">Host</Label>
                            <Input value={config.host || ""} onChange={e => updateConfig("host", e.target.value)} placeholder="server-host" className="h-6 text-[10px] mt-0.5" data-testid="input-udp-host" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Port</Label>
                            <Input type="number" value={config.port || 9001} onChange={e => updateConfig("port", parseInt(e.target.value))} className="h-6 text-[10px] mt-0.5" data-testid="input-udp-port" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Max Packet Size</Label>
                            <Input type="number" value={config.maxPacketSize || 1400} onChange={e => updateConfig("maxPacketSize", parseInt(e.target.value))} className="h-6 text-[10px] mt-0.5" data-testid="input-udp-maxpacket" />
                          </div>
                        </>
                      )}
                      {pd.type === "serial" && (
                        <>
                          <div>
                            <Label className="text-[9px]">Port Path</Label>
                            <Input value={config.path || ""} onChange={e => updateConfig("path", e.target.value)} placeholder="/dev/ttyUSB0" className="h-6 text-[10px] mt-0.5 font-mono" data-testid="input-serial-path" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Baud Rate</Label>
                            <Select value={String(config.baudRate || "9600")} onValueChange={v => updateConfig("baudRate", parseInt(v))}>
                              <SelectTrigger className="h-6 text-[10px] mt-0.5" data-testid="select-serial-baud"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[9600, 19200, 38400, 57600, 115200].map(b => (
                                  <SelectItem key={b} value={String(b)}>{b}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[9px]">Data Bits</Label>
                            <Select value={String(config.dataBits || "8")} onValueChange={v => updateConfig("dataBits", parseInt(v))}>
                              <SelectTrigger className="h-6 text-[10px] mt-0.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[7, 8].map(b => <SelectItem key={b} value={String(b)}>{b}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[9px]">Parity</Label>
                            <Select value={config.parity || "none"} onValueChange={v => updateConfig("parity", v)}>
                              <SelectTrigger className="h-6 text-[10px] mt-0.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["none", "even", "odd"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      {pd.type === "lora" && (
                        <>
                          <div>
                            <Label className="text-[9px]">Serial Port</Label>
                            <Input value={config.serialPort || ""} onChange={e => updateConfig("serialPort", e.target.value)} placeholder="/dev/ttyUSB1" className="h-6 text-[10px] mt-0.5 font-mono" data-testid="input-lora-port" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Frequency</Label>
                            <Select value={String(config.frequency || "868")} onValueChange={v => updateConfig("frequency", parseInt(v))}>
                              <SelectTrigger className="h-6 text-[10px] mt-0.5" data-testid="select-lora-freq"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="868">868 MHz (EU)</SelectItem>
                                <SelectItem value="915">915 MHz (US/AU)</SelectItem>
                                <SelectItem value="433">433 MHz</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[9px]">Spreading Factor</Label>
                            <Select value={String(config.spreadingFactor || "7")} onValueChange={v => updateConfig("spreadingFactor", parseInt(v))}>
                              <SelectTrigger className="h-6 text-[10px] mt-0.5"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[7, 8, 9, 10, 11, 12].map(sf => (
                                  <SelectItem key={sf} value={String(sf)}>SF{sf}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[9px]">TX Power (dBm)</Label>
                            <Input type="number" value={config.txPower || 14} onChange={e => updateConfig("txPower", parseInt(e.target.value))} className="h-6 text-[10px] mt-0.5" data-testid="input-lora-power" />
                          </div>
                        </>
                      )}
                      {pd.type === "reticulum" && (
                        <>
                          <div className="col-span-2">
                            <Label className="text-[9px]">RNS Config Path</Label>
                            <Input value={config.configPath || ""} onChange={e => updateConfig("configPath", e.target.value)} placeholder="~/.reticulum" className="h-6 text-[10px] mt-0.5 font-mono" data-testid="input-rns-config" />
                          </div>
                          <div>
                            <Label className="text-[9px]">Interface Type</Label>
                            <Select value={config.interfaceType || "AutoInterface"} onValueChange={v => updateConfig("interfaceType", v)}>
                              <SelectTrigger className="h-6 text-[10px] mt-0.5" data-testid="select-rns-interface"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AutoInterface">AutoInterface</SelectItem>
                                <SelectItem value="TCPClientInterface">TCPClient</SelectItem>
                                <SelectItem value="SerialInterface">Serial</SelectItem>
                                <SelectItem value="RNodeInterface">RNode</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[9px]">Destination Name</Label>
                            <Input value={config.destinationName || ""} onChange={e => updateConfig("destinationName", e.target.value)} placeholder="holocron.probe" className="h-6 text-[10px] mt-0.5 font-mono" data-testid="input-rns-dest" />
                          </div>
                        </>
                      )}
                      {pd.type === "https" && (
                        <div className="col-span-2 text-[9px] text-muted-foreground italic">
                          Uses HOLOCRON_API environment variable. No additional configuration needed.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
        {commProtocols.filter(p => p.enabled).length > 1 && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[9px] text-muted-foreground">Fallback chain:</span>
            {commProtocols
              .filter(p => p.enabled)
              .sort((a, b) => a.priority - b.priority)
              .map((p, i, arr) => {
                const def = commProtocolDefs.find(d => d.type === p.type);
                return (
                  <span key={p.type} className="flex items-center gap-1">
                    <Badge variant="outline" className={`text-[8px] ${def?.color}`}>{def?.label || p.type}</Badge>
                    {i < arr.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50" />}
                  </span>
                );
              })}
          </div>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={!name.trim() || !description.trim() || saveMutation.isPending} className="w-full h-8 text-xs" data-testid="button-save-probe-type">
        {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
        {isEdit ? "Update Probe Type" : "Create Probe Type"}
      </Button>
    </div>
  );
}

const PAGE_SIZE = 10;

export default function ProbeTaxonomy() {
  const { toast } = useToast();
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultMode, setCreateDefaultMode] = useState<string | undefined>(undefined);
  const [editingType, setEditingType] = useState<ProbeType | null>(null);
  const [taxSearch, setTaxSearch] = useState("");
  const [taxModeFilter, setTaxModeFilter] = useState<string>("all");
  const [taxPage, setTaxPage] = useState(0);

  const { data: probeTypesData, isLoading } = useQuery<ProbeType[]>({
    queryKey: ["/api/probe-types"],
  });

  const { data: probes } = useQuery<DiscoveryProbe[]>({
    queryKey: ["/api/discovery-probes"],
  });

  const { data: orgRolesData = [] } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/probe-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/probe-types"] });
      toast({ title: "Probe type deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete probe type", variant: "destructive" });
    },
  });

  const allTypes = probeTypesData || [];
  const allProbes = probes || [];

  const filteredTypes = allTypes.filter(t => {
    const q = taxSearch.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || (t.description?.toLowerCase().includes(q) ?? false) || (t.protocol?.toLowerCase().includes(q) ?? false);
    const matchMode = taxModeFilter === "all" || t.couplingMode === taxModeFilter;
    return matchSearch && matchMode;
  });

  const taxTotalPages = Math.max(1, Math.ceil(filteredTypes.length / PAGE_SIZE));
  const safeTaxPage = Math.min(taxPage, taxTotalPages - 1);
  const paginatedTypes = filteredTypes.slice(safeTaxPage * PAGE_SIZE, (safeTaxPage + 1) * PAGE_SIZE);

  const getMatchingProbes = (pt: ProbeType): DiscoveryProbe[] => {
    return allProbes.filter(p => p.probeTypeId === pt.id);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6" data-testid="probe-taxonomy-page">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2" data-testid="text-taxonomy-title">
              <CircuitBoard className="h-4 w-4 text-primary" />
              Probe Types
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Define how probes operate relative to the server — from fully coupled real-time agents to fully autonomous edge deployments with local AI reasoning.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLoading ? (
              <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Loading...
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1 text-primary">
                {allTypes.length} Type{allTypes.length !== 1 ? "s" : ""}
              </Badge>
            )}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-7 text-[11px] gap-1" data-testid="button-create-probe-type" onClick={() => setCreateDefaultMode(undefined)}>
                  <Plus className="h-3 w-3" />
                  New Type
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="text-sm">Create Probe Type</DialogTitle>
                </DialogHeader>
                <ProbeTypeForm defaultMode={createDefaultMode} onClose={() => setCreateOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {couplingModes.map(mode => {
            const ModeIcon = mode.icon;
            const modeTypes = allTypes.filter(t => t.couplingMode === mode.value);
            return (
              <Card key={mode.value} className={`border ${mode.borderColor} ${mode.bgColor}/30`} data-testid={`mode-section-${mode.value}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${mode.bgColor} ${mode.color}`}>
                      <ModeIcon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${mode.color}`}>{mode.label}</div>
                      <div className="text-[10px] text-muted-foreground">{modeTypes.length} type{modeTypes.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">{mode.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {mode.traits.map(t => (
                      <Badge key={t} variant="outline" className={`text-[8px] ${mode.color} ${mode.bgColor} ${mode.borderColor}`}>
                        {t}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border/30" />
          <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">Defined Probe Types</span>
          <div className="h-px flex-1 bg-border/30" />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search probe types by name, description, protocol..."
              value={taxSearch}
              onChange={e => { setTaxSearch(e.target.value); setTaxPage(0); }}
              className="h-8 text-xs pl-8"
              data-testid="input-search-taxonomy"
            />
          </div>
          <Select value={taxModeFilter} onValueChange={v => { setTaxModeFilter(v); setTaxPage(0); }}>
            <SelectTrigger className="h-8 w-[160px] text-xs" data-testid="select-taxonomy-filter">
              <SelectValue placeholder="All Modes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modes</SelectItem>
              <SelectItem value="coupled">Coupled</SelectItem>
              <SelectItem value="semi-autonomous">Semi-Autonomous</SelectItem>
              <SelectItem value="autonomous">Fully Autonomous</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && allTypes.length === 0 && (
          <Card className="border border-dashed border-border/40">
            <CardContent className="p-8 text-center">
              <CircuitBoard className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">No probe types defined yet</p>
              <p className="text-xs text-muted-foreground/60 mb-4">Create your first probe type to define how probes should operate.</p>
              <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => { setCreateDefaultMode(undefined); setCreateOpen(true); }} data-testid="button-create-first-type">
                <Plus className="h-3 w-3" />
                Create First Type
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && allTypes.length > 0 && filteredTypes.length === 0 && (
          <div className="text-center py-6 text-xs text-muted-foreground">
            No probe types match your search or filter.
          </div>
        )}

        {couplingModes.map(mode => {
          const modeTypes = paginatedTypes.filter(t => t.couplingMode === mode.value);
          if (modeTypes.length === 0) return null;
          const ModeIcon = mode.icon;
          const totalForMode = filteredTypes.filter(t => t.couplingMode === mode.value).length;

          return (
            <div key={mode.value} data-testid={`type-group-${mode.value}`}>
              <div className="flex items-center gap-2 mb-3">
                <ModeIcon className={`h-4 w-4 ${mode.color}`} />
                <h3 className="text-xs font-bold">{mode.label}</h3>
                <Badge variant="outline" className={`text-[8px] ${mode.color} ${mode.bgColor} ${mode.borderColor}`}>
                  {totalForMode}
                </Badge>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] gap-1 text-muted-foreground"
                  onClick={() => { setCreateDefaultMode(mode.value); setCreateOpen(true); }}
                  data-testid={`button-add-${mode.value}-type`}
                >
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {modeTypes.map(pt => {
                  const TypeIcon = iconMap[pt.icon] || Radar;
                  const matchingProbes = getMatchingProbes(pt);
                  const isExpanded = expandedType === pt.id;

                  return (
                    <Card
                      key={pt.id}
                      className={`border overflow-hidden transition-all ${mode.borderColor} hover:border-opacity-60`}
                      data-testid={`probe-type-card-${pt.id}`}
                    >
                      <CardContent className="p-0">
                        <button
                          className="w-full p-3.5 text-left cursor-pointer hover:bg-muted/10 transition-colors"
                          onClick={() => setExpandedType(isExpanded ? null : pt.id)}
                          data-testid={`probe-type-toggle-${pt.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${mode.bgColor} shrink-0 ${mode.color}`}>
                              <TypeIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[12px] font-bold">{pt.name}</span>
                                {matchingProbes.length > 0 && (
                                  <Badge variant="outline" className="text-[8px] h-4 shrink-0 bg-primary/5 text-primary border-primary/20">
                                    {matchingProbes.length} deployed
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{pt.description}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {pt.protocol && (
                                <Badge variant="outline" className="text-[8px] h-4">
                                  {protocolOptions.find(p => p.value === pt.protocol)?.label || pt.protocol}
                                </Badge>
                              )}
                              {pt.deploymentModel && (
                                <Badge variant="outline" className="text-[8px] h-4">
                                  {deploymentOptions.find(d => d.value === pt.deploymentModel)?.label || pt.deploymentModel}
                                </Badge>
                              )}
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border/20 px-3.5 pb-3.5 pt-3 space-y-3">
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{pt.description}</p>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                              <div>
                                <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Coupling</span>
                                <div className={`text-[11px] font-medium ${mode.color}`}>{mode.label}</div>
                              </div>
                              {pt.deploymentModel && (
                                <div>
                                  <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Deployment</span>
                                  <div className="text-[11px] font-medium">{deploymentOptions.find(d => d.value === pt.deploymentModel)?.label}</div>
                                </div>
                              )}
                              <div>
                                <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Enrollment</span>
                                <div className="text-[11px] font-medium">{pt.requiresEnrollment ? "Required" : "Optional"}</div>
                              </div>
                              {pt.couplingMode !== "coupled" && (
                                <>
                                  <div>
                                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Buffer</span>
                                    <div className="text-[11px] font-medium font-mono">{(pt.bufferCapacity || 0).toLocaleString()} entries</div>
                                  </div>
                                  {pt.syncStrategy && (
                                    <div>
                                      <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Sync</span>
                                      <div className="text-[11px] font-medium capitalize">{pt.syncStrategy}</div>
                                    </div>
                                  )}
                                </>
                              )}
                              {pt.couplingMode === "autonomous" && (
                                <>
                                  <div>
                                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">AI Reasoning</span>
                                    <div className={`text-[11px] font-medium ${pt.hasLocalReasoning ? "text-purple-400" : "text-muted-foreground"}`}>
                                      {pt.hasLocalReasoning ? "Enabled" : "Disabled"}
                                    </div>
                                  </div>
                                </>
                              )}
                              {pt.assignedAgentRoleId && (
                                <div>
                                  <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Assigned Agent</span>
                                  <div className="text-[11px] font-medium text-primary">
                                    {orgRolesData.find(r => r.id === pt.assignedAgentRoleId)?.name || "Unknown Agent"}
                                  </div>
                                </div>
                              )}
                            </div>

                            {pt.couplingMode !== "coupled" && pt.containerImage && (
                              <div className="p-2.5 rounded-md bg-muted/10 border border-border/10">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <Container className="h-3 w-3 text-purple-400" />
                                  <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">Container Configuration</span>
                                </div>
                                <div className="text-[11px] font-mono text-purple-400 mb-1.5">{pt.containerImage}</div>
                                {pt.containerResources != null && typeof pt.containerResources === "object" && (
                                  <div className="flex gap-2">
                                    {Object.entries(pt.containerResources as Record<string, string>).map(([k, v]) => (
                                      <Badge key={k} variant="outline" className="text-[8px] gap-1">
                                        <span className="text-muted-foreground capitalize">{k}:</span> {v}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {pt.characteristics && pt.characteristics.length > 0 && (
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Capabilities</span>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {pt.characteristics.map(char => (
                                    <Badge key={char} variant="outline" className={`text-[8px] ${mode.color} ${mode.bgColor} ${mode.borderColor}`}>
                                      {char}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {pt.communicationProtocols && (pt.communicationProtocols as any[]).length > 0 && (
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Transport Chain</span>
                                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                                  {(pt.communicationProtocols as any[])
                                    .filter((p: any) => p.enabled)
                                    .sort((a: any, b: any) => a.priority - b.priority)
                                    .map((p: any, i: number, arr: any[]) => {
                                      const def = commProtocolDefs.find(d => d.type === p.type);
                                      const PIcon = def?.icon || Globe;
                                      return (
                                        <span key={p.type} className="flex items-center gap-1">
                                          <Badge variant="outline" className={`text-[8px] gap-1 ${def?.color || ""}`}>
                                            <PIcon className="h-2.5 w-2.5" />
                                            {def?.label || p.type}
                                          </Badge>
                                          {i < arr.length - 1 && <ArrowRight className="h-2 w-2 text-muted-foreground/40" />}
                                        </span>
                                      );
                                    })}
                                </div>
                              </div>
                            )}

                            {matchingProbes.length > 0 && (
                              <div>
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 font-semibold">Deployed Probes</span>
                                <div className="space-y-1.5 mt-1.5">
                                  {matchingProbes.map(probe => (
                                    <div key={probe.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/10 border border-border/10" data-testid={`type-probe-match-${probe.id}`}>
                                      <div className={`h-1.5 w-1.5 rounded-full ${probe.enrolled ? "bg-green-400" : "bg-muted-foreground/30"}`} />
                                      <span className="text-[10px] font-medium truncate flex-1">{probe.name}</span>
                                      <Badge variant="outline" className="text-[8px] h-4 shrink-0">
                                        {protocolOptions.find(p => p.value === probe.protocol)?.label || probe.protocol}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <Dialog open={editingType?.id === pt.id} onOpenChange={open => setEditingType(open ? pt : null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 flex-1" data-testid={`button-edit-type-${pt.id}`}>
                                    <Edit className="h-3 w-3" />
                                    Edit
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg">
                                  <DialogHeader>
                                    <DialogTitle className="text-sm">Edit Probe Type</DialogTitle>
                                  </DialogHeader>
                                  <ProbeTypeForm probeType={pt} onClose={() => setEditingType(null)} />
                                </DialogContent>
                              </Dialog>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive"
                                onClick={() => deleteMutation.mutate(pt.id)}
                                disabled={deleteMutation.isPending}
                                data-testid={`button-delete-type-${pt.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredTypes.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-muted-foreground">
              Showing {safeTaxPage * PAGE_SIZE + 1}–{Math.min((safeTaxPage + 1) * PAGE_SIZE, filteredTypes.length)} of {filteredTypes.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={safeTaxPage === 0} onClick={() => setTaxPage(safeTaxPage - 1)} data-testid="button-taxonomy-prev">
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="text-[10px] text-muted-foreground px-2">
                {safeTaxPage + 1} / {taxTotalPages}
              </span>
              <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={safeTaxPage >= taxTotalPages - 1} onClick={() => setTaxPage(safeTaxPage + 1)} data-testid="button-taxonomy-next">
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
