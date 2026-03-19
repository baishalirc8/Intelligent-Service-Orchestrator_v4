import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Key, Network, Monitor, Plug, Radio, Building, Cpu, Wifi,
  Globe, Plus, Trash2, Edit, Play, Loader2, CheckCircle2,
  AlertTriangle, XCircle, Search, Shield, Bot, Radar, Clock,
  Rocket, Copy, Check, Terminal, Container, HardDrive, Cloud,
  Signal, ArrowDownToLine, Activity, Server, ArrowLeft, Eye,
  Gauge, BarChart3, Timer, Layers, Zap, Info, Brain, Crosshair,
  Workflow, Lock, Satellite, Users, Target, CircuitBoard,
  ChevronLeft, ChevronRight, ArrowRight, ScrollText, Laptop, Heart,
  Smartphone, Upload, ImageIcon, Video, Mic, FileText, Sparkles,
  RefreshCw, WifiOff, Package, Square,
} from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import type { DiscoveryCredential, DiscoveryProbe, OrgRole, RoleSubscription, ProbeType, ProbeClusterNode, ProbeMediaFile } from "@shared/schema";
import { HARDWARE_TIERS } from "@shared/schema";

const PAGE_SIZE = 10;

const protocolConfig: Record<string, { label: string; icon: typeof Key; color: string }> = {
  snmp_v2c: { label: "SNMP v2c", icon: Network, color: "text-blue-400 bg-blue-500/10" },
  snmp_v3: { label: "SNMP v3", icon: Network, color: "text-blue-400 bg-blue-500/10" },
  ssh: { label: "SSH", icon: Key, color: "text-green-400 bg-green-500/10" },
  wmi: { label: "WMI", icon: Monitor, color: "text-purple-400 bg-purple-500/10" },
  api: { label: "API", icon: Plug, color: "text-cyan-400 bg-cyan-500/10" },
  mdm: { label: "MDM (Android / iOS)", icon: Smartphone, color: "text-emerald-400 bg-emerald-500/10" },
  lorawan: { label: "LoRaWAN", icon: Radio, color: "text-amber-400 bg-amber-500/10" },
  bacnet: { label: "BACnet", icon: Building, color: "text-orange-400 bg-orange-500/10" },
  modbus: { label: "Modbus", icon: Cpu, color: "text-red-400 bg-red-500/10" },
  mqtt: { label: "MQTT", icon: Wifi, color: "text-teal-400 bg-teal-500/10" },
  http: { label: "HTTP/HTTPS", icon: Globe, color: "text-indigo-400 bg-indigo-500/10" },
};

const authTypes = [
  { value: "username_password", label: "Username/Password" },
  { value: "community_string", label: "Community String" },
  { value: "certificate", label: "Certificate" },
  { value: "api_key", label: "API Key" },
  { value: "token", label: "Token" },
  { value: "bearer_token", label: "Bearer Token" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "psk", label: "Pre-Shared Key" },
];

const apiAuthTypes = [
  { value: "api_key", label: "API Key" },
  { value: "bearer_token", label: "Bearer Token" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "username_password", label: "Basic Auth" },
  { value: "certificate", label: "Client Certificate" },
];

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const apiContentTypes = [
  { value: "application/json", label: "JSON" },
  { value: "application/xml", label: "XML" },
  { value: "application/x-www-form-urlencoded", label: "Form URL-Encoded" },
  { value: "text/plain", label: "Plain Text" },
];

const statusBadge: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  verified: { color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  configured: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock },
  failed: { color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

const probeStatusBadge: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  idle: { color: "bg-muted/30 text-muted-foreground border-border/40", icon: Clock },
  scanning: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Loader2 },
  completed: { color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  error: { color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

function AddCredentialDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState("snmp_v2c");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [authType, setAuthType] = useState("username_password");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [apiMethod, setApiMethod] = useState("GET");
  const [apiContentType, setApiContentType] = useState("application/json");
  const [apiHeaders, setApiHeaders] = useState("");
  const [apiRateLimit, setApiRateLimit] = useState("");
  const [apiTimeout, setApiTimeout] = useState("30");
  const [apiSslVerify, setApiSslVerify] = useState(true);
  const [apiPaginationType, setApiPaginationType] = useState("none");
  const [apiResponsePath, setApiResponsePath] = useState("");

  const isApiProtocol = protocol === "api" || protocol === "http";

  const resetForm = () => {
    setName(""); setHost(""); setPort(""); setAuthType("username_password");
    setApiEndpoint(""); setApiMethod("GET"); setApiContentType("application/json");
    setApiHeaders(""); setApiRateLimit(""); setApiTimeout("30");
    setApiSslVerify(true); setApiPaginationType("none"); setApiResponsePath("");
  };

  const handleProtocolChange = (val: string) => {
    setProtocol(val);
    if (val === "api" || val === "http") {
      setAuthType("api_key");
      setPort(val === "http" ? "443" : "443");
    } else {
      setAuthType("username_password");
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const metadata = isApiProtocol ? {
        endpoint: apiEndpoint || undefined,
        method: apiMethod,
        contentType: apiContentType,
        headers: apiHeaders ? apiHeaders.split("\n").reduce((acc: Record<string, string>, line) => {
          const [k, ...v] = line.split(":");
          if (k?.trim()) acc[k.trim()] = v.join(":").trim();
          return acc;
        }, {}) : undefined,
        rateLimit: apiRateLimit ? parseInt(apiRateLimit) : undefined,
        timeout: apiTimeout ? parseInt(apiTimeout) : 30,
        sslVerify: apiSslVerify,
        pagination: apiPaginationType !== "none" ? apiPaginationType : undefined,
        responsePath: apiResponsePath || undefined,
      } : undefined;
      const res = await apiRequest("POST", "/api/discovery-credentials", {
        name, protocol, host, port: port ? parseInt(port) : undefined, authType, status: "configured",
        metadata,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-credentials"] });
      toast({ title: "Credential created" });
      setOpen(false);
      resetForm();
      onCreated();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5" data-testid="button-add-credential">
          <Plus className="h-3.5 w-3.5" /> Add Credential
        </Button>
      </DialogTrigger>
      <DialogContent className={isApiProtocol ? "max-w-2xl" : ""}>
        <DialogHeader>
          <DialogTitle>{isApiProtocol ? "Add API Connector" : "Add Discovery Credential"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className={isApiProtocol ? "max-h-[70vh]" : ""}>
          <div className="space-y-4 mt-2 pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className={isApiProtocol ? "" : "col-span-2"}>
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder={isApiProtocol ? "e.g., ServiceNow API" : "e.g., Core Router SNMP"} data-testid="input-cred-name" />
              </div>
              <div className={isApiProtocol ? "" : "col-span-2"}>
                <Label>Protocol</Label>
                <Select value={protocol} onValueChange={handleProtocolChange}>
                  <SelectTrigger data-testid="select-cred-protocol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(protocolConfig).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={isApiProtocol ? "grid grid-cols-2 gap-4" : "space-y-4"}>
              <div>
                <Label>{isApiProtocol ? "Base URL" : "Host / Subnet"}</Label>
                <Input value={host} onChange={e => setHost(e.target.value)} placeholder={isApiProtocol ? "e.g., https://api.servicenow.com" : "e.g., 10.0.1.0/24"} data-testid="input-cred-host" />
              </div>
              <div>
                <Label>Port</Label>
                <Input value={port} onChange={e => setPort(e.target.value)} placeholder={isApiProtocol ? "443" : "e.g., 161"} type="number" data-testid="input-cred-port" />
              </div>
            </div>

            {isApiProtocol && (
              <>
                <div className="border border-border/40 rounded-lg p-4 space-y-4 bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API Configuration</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Endpoint Path</Label>
                      <Input value={apiEndpoint} onChange={e => setApiEndpoint(e.target.value)} placeholder="e.g., /api/now/table/cmdb_ci" data-testid="input-api-endpoint" />
                    </div>
                    <div>
                      <Label>HTTP Method</Label>
                      <Select value={apiMethod} onValueChange={setApiMethod}>
                        <SelectTrigger data-testid="select-api-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {httpMethods.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Content Type</Label>
                      <Select value={apiContentType} onValueChange={setApiContentType}>
                        <SelectTrigger data-testid="select-api-content-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {apiContentTypes.map(ct => (
                            <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Response Data Path</Label>
                      <Input value={apiResponsePath} onChange={e => setApiResponsePath(e.target.value)} placeholder="e.g., result.items" data-testid="input-api-response-path" />
                    </div>
                  </div>

                  <div>
                    <Label>Custom Headers <span className="text-muted-foreground text-[10px]">(one per line, Key: Value)</span></Label>
                    <textarea
                      value={apiHeaders}
                      onChange={e => setApiHeaders(e.target.value)}
                      placeholder={"X-Custom-Header: value\nAccept: application/json"}
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="input-api-headers"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>Timeout (sec)</Label>
                      <Input value={apiTimeout} onChange={e => setApiTimeout(e.target.value)} placeholder="30" type="number" data-testid="input-api-timeout" />
                    </div>
                    <div>
                      <Label>Rate Limit (req/min)</Label>
                      <Input value={apiRateLimit} onChange={e => setApiRateLimit(e.target.value)} placeholder="e.g., 60" type="number" data-testid="input-api-rate-limit" />
                    </div>
                    <div>
                      <Label>Pagination</Label>
                      <Select value={apiPaginationType} onValueChange={setApiPaginationType}>
                        <SelectTrigger data-testid="select-api-pagination">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="offset">Offset-based</SelectItem>
                          <SelectItem value="cursor">Cursor-based</SelectItem>
                          <SelectItem value="link">Link Header</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={apiSslVerify}
                      onChange={e => setApiSslVerify(e.target.checked)}
                      id="ssl-verify"
                      className="rounded"
                      data-testid="input-api-ssl-verify"
                    />
                    <Label htmlFor="ssl-verify" className="text-sm cursor-pointer">Verify SSL/TLS Certificate</Label>
                  </div>
                </div>
              </>
            )}

            <div>
              <Label>Authentication Type</Label>
              <Select value={authType} onValueChange={setAuthType}>
                <SelectTrigger data-testid="select-cred-auth-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(isApiProtocol ? apiAuthTypes : authTypes).map(at => (
                    <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => mutation.mutate()} disabled={!name || !host || mutation.isPending} className="w-full" data-testid="button-save-credential">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isApiProtocol ? "Save API Connector" : "Save Credential"}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function EditCredentialDialog({ credential, onUpdated }: { credential: DiscoveryCredential; onUpdated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(credential.name);
  const [protocol, setProtocol] = useState(credential.protocol);
  const [host, setHost] = useState(credential.host);
  const [port, setPort] = useState(credential.port ? String(credential.port) : "");
  const [authType, setAuthType] = useState(credential.authType);
  const [status, setStatus] = useState(credential.status);
  const meta = (credential as any).metadata || {};
  const [apiEndpoint, setApiEndpoint] = useState(meta.endpoint || "");
  const [apiMethod, setApiMethod] = useState(meta.method || "GET");
  const [apiContentType, setApiContentType] = useState(meta.contentType || "application/json");
  const [apiHeaders, setApiHeaders] = useState(
    meta.headers ? Object.entries(meta.headers).map(([k, v]) => `${k}: ${v}`).join("\n") : ""
  );
  const [apiRateLimit, setApiRateLimit] = useState(meta.rateLimit ? String(meta.rateLimit) : "");
  const [apiTimeout, setApiTimeout] = useState(meta.timeout ? String(meta.timeout) : "30");
  const [apiSslVerify, setApiSslVerify] = useState(meta.sslVerify !== false);
  const [apiPaginationType, setApiPaginationType] = useState(meta.pagination || "none");
  const [apiResponsePath, setApiResponsePath] = useState(meta.responsePath || "");

  const isApiProtocol = protocol === "api" || protocol === "http";

  const handleProtocolChange = (val: string) => {
    setProtocol(val);
    if (val === "api" || val === "http") {
      setAuthType("api_key");
    } else {
      setAuthType("username_password");
    }
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setName(credential.name);
      setProtocol(credential.protocol);
      setHost(credential.host);
      setPort(credential.port ? String(credential.port) : "");
      setAuthType(credential.authType);
      setStatus(credential.status);
      const m = (credential as any).metadata || {};
      setApiEndpoint(m.endpoint || "");
      setApiMethod(m.method || "GET");
      setApiContentType(m.contentType || "application/json");
      setApiHeaders(m.headers ? Object.entries(m.headers).map(([k, v]) => `${k}: ${v}`).join("\n") : "");
      setApiRateLimit(m.rateLimit ? String(m.rateLimit) : "");
      setApiTimeout(m.timeout ? String(m.timeout) : "30");
      setApiSslVerify(m.sslVerify !== false);
      setApiPaginationType(m.pagination || "none");
      setApiResponsePath(m.responsePath || "");
    }
    setOpen(isOpen);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const metadata = isApiProtocol ? {
        endpoint: apiEndpoint || undefined,
        method: apiMethod,
        contentType: apiContentType,
        headers: apiHeaders ? apiHeaders.split("\n").reduce((acc: Record<string, string>, line) => {
          const [k, ...v] = line.split(":");
          if (k?.trim()) acc[k.trim()] = v.join(":").trim();
          return acc;
        }, {}) : undefined,
        rateLimit: apiRateLimit ? parseInt(apiRateLimit) : undefined,
        timeout: apiTimeout ? parseInt(apiTimeout) : 30,
        sslVerify: apiSslVerify,
        pagination: apiPaginationType !== "none" ? apiPaginationType : undefined,
        responsePath: apiResponsePath || undefined,
      } : undefined;
      const res = await apiRequest("PATCH", `/api/discovery-credentials/${credential.id}`, {
        name, protocol, host, port: port ? parseInt(port) : undefined, authType, status,
        metadata,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-credentials"] });
      toast({ title: "Credential updated" });
      setOpen(false);
      onUpdated();
    },
  });

  const statusOptions = [
    { value: "configured", label: "Configured" },
    { value: "verified", label: "Verified" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" data-testid={`edit-cred-${credential.id}`}>
          <Edit className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className={isApiProtocol ? "max-w-2xl" : ""}>
        <DialogHeader>
          <DialogTitle>{isApiProtocol ? "Edit API Connector" : "Edit Discovery Credential"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className={isApiProtocol ? "max-h-[70vh]" : ""}>
          <div className="space-y-4 mt-2 pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className={isApiProtocol ? "" : "col-span-2"}>
                <Label>Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-edit-cred-name" />
              </div>
              <div className={isApiProtocol ? "" : "col-span-2"}>
                <Label>Protocol</Label>
                <Select value={protocol} onValueChange={handleProtocolChange}>
                  <SelectTrigger data-testid="select-edit-cred-protocol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(protocolConfig).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={isApiProtocol ? "grid grid-cols-2 gap-4" : "space-y-4"}>
              <div>
                <Label>{isApiProtocol ? "Base URL" : "Host / Subnet"}</Label>
                <Input value={host} onChange={e => setHost(e.target.value)} data-testid="input-edit-cred-host" />
              </div>
              <div>
                <Label>Port</Label>
                <Input value={port} onChange={e => setPort(e.target.value)} type="number" data-testid="input-edit-cred-port" />
              </div>
            </div>

            {isApiProtocol && (
              <div className="border border-border/40 rounded-lg p-4 space-y-4 bg-muted/10">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API Configuration</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Endpoint Path</Label>
                    <Input value={apiEndpoint} onChange={e => setApiEndpoint(e.target.value)} data-testid="input-edit-api-endpoint" />
                  </div>
                  <div>
                    <Label>HTTP Method</Label>
                    <Select value={apiMethod} onValueChange={setApiMethod}>
                      <SelectTrigger data-testid="select-edit-api-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {httpMethods.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Content Type</Label>
                    <Select value={apiContentType} onValueChange={setApiContentType}>
                      <SelectTrigger data-testid="select-edit-api-content-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {apiContentTypes.map(ct => (
                          <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Response Data Path</Label>
                    <Input value={apiResponsePath} onChange={e => setApiResponsePath(e.target.value)} data-testid="input-edit-api-response-path" />
                  </div>
                </div>
                <div>
                  <Label>Custom Headers <span className="text-muted-foreground text-[10px]">(one per line, Key: Value)</span></Label>
                  <textarea
                    value={apiHeaders}
                    onChange={e => setApiHeaders(e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="input-edit-api-headers"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label>Timeout (sec)</Label>
                    <Input value={apiTimeout} onChange={e => setApiTimeout(e.target.value)} type="number" data-testid="input-edit-api-timeout" />
                  </div>
                  <div>
                    <Label>Rate Limit (req/min)</Label>
                    <Input value={apiRateLimit} onChange={e => setApiRateLimit(e.target.value)} type="number" data-testid="input-edit-api-rate-limit" />
                  </div>
                  <div>
                    <Label>Pagination</Label>
                    <Select value={apiPaginationType} onValueChange={setApiPaginationType}>
                      <SelectTrigger data-testid="select-edit-api-pagination">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="offset">Offset-based</SelectItem>
                        <SelectItem value="cursor">Cursor-based</SelectItem>
                        <SelectItem value="link">Link Header</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={apiSslVerify}
                    onChange={e => setApiSslVerify(e.target.checked)}
                    id="edit-ssl-verify"
                    className="rounded"
                    data-testid="input-edit-api-ssl-verify"
                  />
                  <Label htmlFor="edit-ssl-verify" className="text-sm cursor-pointer">Verify SSL/TLS Certificate</Label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Authentication Type</Label>
                <Select value={authType} onValueChange={setAuthType}>
                  <SelectTrigger data-testid="select-edit-cred-auth-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(isApiProtocol ? apiAuthTypes : authTypes).map(at => (
                      <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger data-testid="select-edit-cred-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={() => mutation.mutate()} disabled={!name || !host || mutation.isPending} className="w-full" data-testid="button-update-credential">
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isApiProtocol ? "Update API Connector" : "Update Credential"}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function getHeartbeatStatus(probe: DiscoveryProbe): { label: string; color: string; dotColor: string } {
  if (!probe.enrolled) return { label: "Not Enrolled", color: "text-muted-foreground", dotColor: "bg-muted-foreground" };
  if (!probe.lastHeartbeat) return { label: "No Heartbeat", color: "text-red-400", dotColor: "bg-red-400" };
  const now = Date.now();
  const last = new Date(probe.lastHeartbeat).getTime();
  const diff = (now - last) / 1000;
  const interval = probe.heartbeatInterval || 60;
  if (diff < interval * 3) return { label: "Online", color: "text-green-400", dotColor: "bg-green-400" };
  if (diff < interval * 10) return { label: "Stale", color: "text-yellow-400", dotColor: "bg-yellow-400" };
  return { label: "Offline", color: "text-red-400", dotColor: "bg-red-400" };
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Never";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function DeployProbeDialog({ probe }: { probe: DiscoveryProbe }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenGenerated, setTokenGenerated] = useState(!!probe.siteToken);
  const [currentToken, setCurrentToken] = useState(probe.siteToken || "");
  const [currentHmacSecret, setCurrentHmacSecret] = useState((probe as any).hmacSecret || "");
  const [tokenExpiresAt, setTokenExpiresAt] = useState("");
  const [deploySelectedPlatform, setDeploySelectedPlatform] = useState(() => {
    const os = (probe.osInfo || "").toLowerCase();
    if (os.includes("darwin") || os.includes("mac")) return "macos";
    if (os.includes("windows")) return probe.deploymentType === "workstation" ? "windows-workstation" : "windows-server";
    if (os.includes("linux")) return "linux-server";
    return "kernel";
  });

  const { data: probeTypes } = useQuery<ProbeType[]>({ queryKey: ["/api/probe-types"] });
  const linkedType = probeTypes?.find(t => t.id === (probe as any).probeTypeId);
  const [couplingMode, setCouplingMode] = useState(linkedType?.couplingMode || "coupled");

  const couplingOptions = [
    {
      value: "coupled",
      label: "Coupled",
      subtitle: "Always-connected",
      desc: "Streams telemetry in real time. Requires persistent network connectivity to HOLOCRON.",
      color: "text-blue-400", border: "border-blue-500/40", bg: "bg-blue-500/8", activeBg: "bg-blue-500/20",
      icon: Server,
    },
    {
      value: "semi-autonomous",
      label: "Semi-Autonomous",
      subtitle: "Edge-buffered",
      desc: "Buffers up to 10,000 events locally and syncs opportunistically when connectivity is available.",
      color: "text-amber-400", border: "border-amber-500/40", bg: "bg-amber-500/8", activeBg: "bg-amber-500/20",
      icon: Wifi,
    },
    {
      value: "autonomous",
      label: "Fully Autonomous",
      subtitle: "Air-gap capable",
      desc: "On-device AI reasoning. Fully independent — no persistent connection required. Periodic sync only.",
      color: "text-purple-400", border: "border-purple-500/40", bg: "bg-purple-500/8", activeBg: "bg-purple-500/20",
      icon: Brain,
    },
  ];

  const generateToken = useMutation({
    mutationFn: async (opts?: { useHmac?: boolean }) => {
      const res = await apiRequest("POST", `/api/discovery-probes/${probe.id}/generate-token`, { useHmac: opts?.useHmac ?? true });
      return res.json();
    },
    onSuccess: (data: any) => {
      setCurrentToken(data.siteToken);
      setCurrentHmacSecret(data.hmacSecret || "");
      setTokenExpiresAt(data.expiresAt || "");
      setTokenGenerated(true);
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes"] });
      toast({ title: data.hmacSecret ? "Token & HMAC secret generated" : "Token generated (no HMAC)" });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const dockerCmd = couplingMode === "autonomous"
    ? `docker run -d \\
  --name holocron-probe-auto \\
  --restart unless-stopped \\
  -e HOLOCRON_TOKEN="${currentToken}" \\
  -e HOLOCRON_API="${window.location.origin}" \\
  -e HOLOCRON_REMEDIATION=true \\
  -v holocron-data:/var/lib/holocron/autonomous \\
  --network host \\
  holocron/probe-autonomous:latest`
    : couplingMode === "semi-autonomous"
    ? `docker run -d \\
  --name holocron-probe-semi \\
  --restart unless-stopped \\
  -e HOLOCRON_TOKEN="${currentToken}" \\
  -e HOLOCRON_HMAC_SECRET="${currentHmacSecret}" \\
  -e HOLOCRON_API="${window.location.origin}" \\
  -e HOLOCRON_SYNC=opportunistic \\
  -v holocron-buffer:/var/lib/holocron/buffer \\
  --network host \\
  holocron/probe-edge:latest`
    : `docker run -d \\
  --name holocron-probe \\
  --restart unless-stopped \\
  -e HOLOCRON_TOKEN="${currentToken}" \\
  -e HOLOCRON_HMAC_SECRET="${currentHmacSecret}" \\
  -e HOLOCRON_API="${window.location.origin}" \\
  --network host \\
  holocron/probe:latest`;

  const vmCmd = couplingMode === "autonomous"
    ? `curl -sSL ${window.location.origin}/api/probe-download/autonomous -o holocron-probe-auto.sh && \\
chmod +x holocron-probe-auto.sh && \\
HOLOCRON_TOKEN="${currentToken}" \\
HOLOCRON_API="${window.location.origin}" \\
./holocron-probe-auto.sh start`
    : couplingMode === "semi-autonomous"
    ? `curl -sSL ${window.location.origin}/api/probe-download/semi-autonomous -o holocron-probe-semi.sh && \\
chmod +x holocron-probe-semi.sh && \\
HOLOCRON_TOKEN="${currentToken}" \\
HOLOCRON_HMAC_SECRET="${currentHmacSecret}" \\
HOLOCRON_API="${window.location.origin}" \\
./holocron-probe-semi.sh start`
    : `curl -sSL ${window.location.origin}/api/probe-download/linux -o holocron-probe.sh && \\
chmod +x holocron-probe.sh && \\
HOLOCRON_TOKEN="${currentToken}" \\
HOLOCRON_HMAC_SECRET="${currentHmacSecret}" \\
HOLOCRON_API="${window.location.origin}" \\
./holocron-probe.sh start`;

  const bareMetalRpm = `sudo rpm -i holocron-probe-1.0.0.rpm
sudo cat > /opt/holocron/.env << 'EOF'
HOLOCRON_TOKEN=${currentToken}
HOLOCRON_HMAC_SECRET=${currentHmacSecret}
HOLOCRON_API=${window.location.origin}
EOF
sudo chmod 600 /opt/holocron/.env
sudo systemctl enable --now holocron-probe`;

  const bareMetalDeb = `sudo dpkg -i holocron-probe_1.0.0_amd64.deb
sudo cat > /opt/holocron/.env << 'EOF'
HOLOCRON_TOKEN=${currentToken}
HOLOCRON_HMAC_SECRET=${currentHmacSecret}
HOLOCRON_API=${window.location.origin}
EOF
sudo chmod 600 /opt/holocron/.env
sudo systemctl enable --now holocron-probe`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" data-testid={`deploy-probe-${probe.id}`}>
          <Rocket className="h-3 w-3" />
          Deploy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Deploy Probe: {probe.name}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[80vh]">
          <div className="space-y-5 pr-2">

            {/* ── PROBE TYPE SELECTOR ── */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Probe Type</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {couplingOptions.map(opt => {
                  const Icon = opt.icon;
                  const isActive = couplingMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCouplingMode(opt.value)}
                      data-testid={`probe-type-${opt.value}`}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isActive
                          ? `${opt.border} ${opt.activeBg} ring-1 ring-inset ${opt.border}`
                          : `border-border/40 bg-muted/10 hover:border-border hover:bg-muted/20`
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg border ${isActive ? opt.border : "border-border/30"} ${isActive ? opt.bg : "bg-muted/10"} flex items-center justify-center mb-2`}>
                        <Icon className={`h-4 w-4 ${isActive ? opt.color : "text-muted-foreground"}`} />
                      </div>
                      <p className={`text-xs font-bold ${isActive ? opt.color : "text-foreground"}`}>{opt.label}</p>
                      <p className={`text-[10px] ${isActive ? opt.color + "/70" : "text-muted-foreground"} mt-0.5`}>{opt.subtitle}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1 leading-tight">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Enrollment Status</p>
                <div className="flex items-center gap-2">
                  {probe.enrolled ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      <span className="text-sm font-medium text-green-400">Enrolled</span>
                      {probe.enrolledAt && <span className="text-[10px] text-muted-foreground">({timeAgo(probe.enrolledAt)})</span>}
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm font-medium text-yellow-400">Awaiting Enrollment</span>
                    </>
                  )}
                </div>
              </div>
              {probe.enrolled && probe.lastHeartbeat && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Last Heartbeat</p>
                  <p className="text-sm font-medium">{timeAgo(probe.lastHeartbeat)}</p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 1: Generate Security Credentials</p>
              {tokenGenerated && currentToken ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Site Token</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-md bg-muted/30 border border-border/50 text-xs font-mono truncate" data-testid="text-site-token">{currentToken}</code>
                      <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={() => copyToClipboard(currentToken)} data-testid="button-copy-token">
                        {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  {currentHmacSecret && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">HMAC Signing Secret</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 rounded-md bg-yellow-500/5 border border-yellow-500/30 text-xs font-mono truncate text-yellow-400" data-testid="text-hmac-secret">{currentHmacSecret}</code>
                        <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" onClick={() => copyToClipboard(currentHmacSecret)} data-testid="button-copy-hmac">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-yellow-400/70 mt-1 flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Save this secret now — it won't be shown again. Used for HMAC-SHA256 request signing.
                      </p>
                    </div>
                  )}
                  {tokenExpiresAt && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Token expires: {new Date(tokenExpiresAt).toLocaleDateString()} ({Math.ceil((new Date(tokenExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days)
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => generateToken.mutate({ useHmac: true })} disabled={generateToken.isPending} data-testid="button-regenerate-token">
                      {generateToken.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                      Regenerate with HMAC
                    </Button>
                    <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => generateToken.mutate({ useHmac: false })} disabled={generateToken.isPending} data-testid="button-regenerate-token-only">
                      {generateToken.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                      Token Only (Easy Setup)
                    </Button>
                  </div>
                  {!currentHmacSecret && !tokenGenerated && (
                    <p className="text-[10px] text-amber-400/80 flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" />
                      HMAC secret is only shown once after generation. Click "Regenerate with HMAC" above or use "Token Only" for simpler setup.
                    </p>
                  )}
                </div>
              ) : (
                <Button size="sm" onClick={() => generateToken.mutate()} disabled={generateToken.isPending} data-testid="button-generate-token">
                  {generateToken.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Key className="h-3.5 w-3.5 mr-1.5" />}
                  Generate Security Credentials
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">Generates a site token + HMAC signing secret for secure probe communication. All requests are signed with HMAC-SHA256, bound to the probe's IP, and protected against replay attacks. Tokens expire after 30 days.</p>
            </div>

            {tokenGenerated && currentToken && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 2: Deploy to Client Site</p>
                <Tabs defaultValue="download" className="w-full">
                  <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
                    <TabsTrigger value="download" className="text-[10px] gap-1 flex-1 min-w-[60px]" data-testid="tab-deploy-download">
                      <ArrowDownToLine className="h-3 w-3" /> Download
                    </TabsTrigger>
                    <TabsTrigger value="docker" className="text-[10px] gap-1 flex-1 min-w-[60px]" data-testid="tab-deploy-docker">
                      <Container className="h-3 w-3" /> Docker
                    </TabsTrigger>
                    <TabsTrigger value="vm" className="text-[10px] gap-1 flex-1 min-w-[60px]" data-testid="tab-deploy-vm">
                      <Server className="h-3 w-3" /> Script
                    </TabsTrigger>
                    <TabsTrigger value="rpm" className="text-[10px] gap-1 flex-1 min-w-[60px]" data-testid="tab-deploy-rpm">
                      <HardDrive className="h-3 w-3" /> RPM
                    </TabsTrigger>
                    <TabsTrigger value="cloud" className="text-[10px] gap-1 flex-1 min-w-[60px]" data-testid="tab-deploy-cloud">
                      <Cloud className="h-3 w-3" /> Cloud
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="download" className="mt-3">
                    {(() => {
                      const selectedPlatform = deploySelectedPlatform;
                      const setSelectedPlatform = setDeploySelectedPlatform;
                      const modeKey = couplingMode === "semi-autonomous" ? "semi" : couplingMode === "autonomous" ? "auto" : "coupled";
                      const probeFile = modeKey === "coupled" ? "probe-coupled.ts" : modeKey === "semi" ? "probe-semi.ts" : "probe-auto.ts";
                      const platforms = [
                        { id: "kernel", label: "Kernel-Direct", sub: "No OS · /proc /sys · ~30MB", icon: CircuitBoard, color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/10", recommended: true,
                          downloads: { coupled: "node-coupled", semi: "node-semi", auto: "node-auto" },
                          dockerfile: { coupled: "dockerfile-coupled", semi: "dockerfile-semi", auto: "dockerfile-auto" } },
                        { id: "linux-server", label: "Linux Server", sub: "x86_64 · Full package", icon: Server, color: "text-blue-400", border: "border-blue-500/20", bg: "bg-blue-500/10",
                          downloads: { coupled: "node-coupled", semi: "node-semi", auto: "node-auto" },
                          shellDownloads: { coupled: "linux", semi: "semi-autonomous", auto: "autonomous" } },
                        { id: "linux-arm", label: "Linux ARM", sub: "RPi · Edge · IoT", icon: Cpu, color: "text-amber-400", border: "border-amber-500/20", bg: "bg-amber-500/10",
                          downloads: { coupled: "node-coupled", semi: "node-semi", auto: "node-auto" } },
                        { id: "windows-server", label: "Windows Server", sub: "PowerShell · WMI", icon: Monitor, color: "text-cyan-400", border: "border-cyan-500/20", bg: "bg-cyan-500/10",
                          shellDownloads: { coupled: "windows", semi: "windows", auto: "windows" } },
                        { id: "windows-workstation", label: "Windows Endpoint", sub: "Win 10/11", icon: Monitor, color: "text-sky-400", border: "border-sky-500/20", bg: "bg-sky-500/10",
                          shellDownloads: { coupled: "windows", semi: "windows", auto: "windows" } },
                        { id: "macos", label: "macOS", sub: "Ventura · Sonoma · Sequoia", icon: Laptop, color: "text-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/10",
                          shellDownloads: { coupled: "macos", semi: "macos", auto: "macos" } },
                        { id: "docker", label: "Docker Container", sub: "Multi-arch · Distroless", icon: Container, color: "text-purple-400", border: "border-purple-500/20", bg: "bg-purple-500/10",
                          downloads: { coupled: "node-coupled", semi: "node-semi", auto: "node-auto" },
                          dockerfile: { coupled: "dockerfile-coupled", semi: "dockerfile-semi", auto: "dockerfile-auto" } },
                        { id: "ot-industrial", label: "OT / Industrial", sub: "Serial · Modbus · BACnet", icon: Zap, color: "text-orange-400", border: "border-orange-500/20", bg: "bg-orange-500/10",
                          downloads: { coupled: "node-coupled", semi: "node-semi", auto: "node-auto" } },
                        { id: "android", label: "Android", sub: "Termux · Android 10+ · MDM", icon: Smartphone, color: "text-green-400", border: "border-green-500/20", bg: "bg-green-500/10",
                          shellDownloads: { coupled: "android", semi: "android", auto: "android" } },
                        { id: "ios", label: "iOS / iPadOS", sub: "a-Shell · Shortcuts · iOS 16+", icon: Smartphone, color: "text-blue-400", border: "border-blue-400/20", bg: "bg-blue-400/10",
                          shellDownloads: { coupled: "ios", semi: "ios", auto: "ios" } },
                      ];
                      const activePlatform = platforms.find(p => p.id === selectedPlatform) || platforms[0];
                      const APIcon = activePlatform.icon;
                      const nodeDownload = (activePlatform.downloads as any)?.[modeKey];
                      const shellDownload = (activePlatform.shellDownloads as any)?.[modeKey];
                      const dockerfileDownload = (activePlatform.dockerfile as any)?.[modeKey];
                      const shellFilename = shellDownload === "windows" ? "holocron-probe.ps1" : shellDownload === "macos" ? "holocron-probe-macos.sh" : shellDownload === "linux" ? "holocron-probe.sh" : shellDownload === "semi-autonomous" ? "holocron-probe-semi.sh" : shellDownload === "autonomous" ? "holocron-probe-auto.sh" : shellDownload === "android" ? "holocron-probe-android.sh" : shellDownload === "ios" ? "holocron-probe-ios.sh" : null;

                      const installGuides: Record<string, { steps: string[]; policies: string[]; firewall: string[]; verify: string }> = {
                        "kernel": {
                          steps: [
                            `# Step 1: Install Node.js 18+ (if not already installed)\ncurl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -\nsudo apt-get install -y nodejs`,
                            `# Step 2: Create probe directory and download files\nsudo mkdir -p /opt/holocron && cd /opt/holocron\ncurl -sSL ${window.location.origin}/api/probe-download/${nodeDownload} -o ${probeFile}\ncurl -sSL ${window.location.origin}/api/probe-download/node-transports -o transports.ts\nsudo npm install -g tsx`,
                            `# Step 3: Test the probe\nHOLOCRON_TOKEN=${currentToken || "<your-token>"} HOLOCRON_API=${window.location.origin}${currentHmacSecret ? ` HOLOCRON_HMAC_SECRET=${currentHmacSecret}` : ""} npx tsx ${probeFile}\n# You should see "Probe enrolled" or "Heartbeat sent". Press Ctrl+C to stop.`,
                            `# Step 4: Run as systemd service\nsudo cat > /etc/systemd/system/holocron-probe.service << 'EOF'\n[Unit]\nDescription=HOLOCRON AI Probe (Kernel-Direct)\nAfter=network.target\n\n[Service]\nType=simple\nUser=root\nWorkingDirectory=/opt/holocron\nEnvironment=HOLOCRON_TOKEN=${currentToken || "<your-token>"}\nEnvironment=HOLOCRON_API=${window.location.origin}${currentHmacSecret ? `\nEnvironment=HOLOCRON_HMAC_SECRET=${currentHmacSecret}` : ""}\nExecStart=/usr/bin/npx tsx /opt/holocron/${probeFile}\nRestart=always\nRestartSec=10\nStartLimitIntervalSec=300\nStartLimitBurst=5\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsudo systemctl daemon-reload\nsudo systemctl enable --now holocron-probe`,
                          ],
                          policies: [
                            "Requires root access to read /proc/[pid]/stat, /proc/meminfo, /sys/class/thermal",
                            "If running as non-root: grant read access to /proc and /sys (mount --bind or capabilities)",
                            "SELinux: Create a custom policy module: audit2allow -a -M holocron-probe && sudo semodule -i holocron-probe.pp",
                            "AppArmor: Add /proc/** r, and /sys/** r, to the probe's AppArmor profile",
                            "If autonomous mode with remediation: requires write to /proc/sys/vm/drop_caches (root only)",
                            "CGroups: If containerized without --privileged, mount /proc and /sys as read-only volumes",
                          ],
                          firewall: [
                            `Outbound HTTPS (443) to ${window.location.host} — required for server communication`,
                            "If using MQTT transport: outbound TCP 8883 (TLS) or 1883 (non-TLS)",
                            "If using WebSocket transport: outbound TCP 443 (WSS) or custom port",
                            "If using CoAP transport: outbound UDP 5684 (DTLS) or 5683",
                            "No inbound ports required — probe initiates all connections",
                          ],
                          verify: `# Verify probe is running\nsudo systemctl status holocron-probe\n\n# Check logs\nsudo journalctl -u holocron-probe -f --no-pager\n\n# Verify /proc access\ncat /proc/meminfo | head -5\nls /proc/1/stat`,
                        },
                        "linux-server": {
                          steps: [
                            `# Step 1: Install Node.js 18+ via package manager\n# Ubuntu/Debian:\ncurl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -\nsudo apt-get install -y nodejs\n\n# RHEL/CentOS:\ncurl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -\nsudo yum install -y nodejs`,
                            `# Step 2: Create probe directory and download files\nsudo mkdir -p /opt/holocron && cd /opt/holocron\ncurl -sSL ${window.location.origin}/api/probe-download/${nodeDownload} -o ${probeFile}\ncurl -sSL ${window.location.origin}/api/probe-download/node-transports -o transports.ts${shellDownload ? `\ncurl -sSL ${window.location.origin}/api/probe-download/${shellDownload} -o holocron-probe.sh\nchmod +x holocron-probe*.sh` : ""}\nsudo npm install -g tsx`,
                            `# Step 3: Test the probe\nHOLOCRON_TOKEN=${currentToken || "<your-token>"} HOLOCRON_API=${window.location.origin}${currentHmacSecret ? ` HOLOCRON_HMAC_SECRET=${currentHmacSecret}` : ""} npx tsx ${probeFile}\n# You should see "Probe enrolled" or "Heartbeat sent". Press Ctrl+C to stop.`,
                            `# Step 4: Install as systemd service\nsudo cat > /etc/systemd/system/holocron-probe.service << 'EOF'\n[Unit]\nDescription=HOLOCRON AI Probe (Linux Server)\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nType=simple\nUser=root\nWorkingDirectory=/opt/holocron\nEnvironment=HOLOCRON_TOKEN=${currentToken || "<your-token>"}\nEnvironment=HOLOCRON_API=${window.location.origin}${currentHmacSecret ? `\nEnvironment=HOLOCRON_HMAC_SECRET=${currentHmacSecret}` : ""}\nExecStart=/usr/bin/npx tsx /opt/holocron/${probeFile}\nRestart=always\nRestartSec=10\nStartLimitIntervalSec=300\nStartLimitBurst=5\nStandardOutput=journal\nStandardError=journal\nSyslogIdentifier=holocron-probe\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsudo systemctl daemon-reload\nsudo systemctl enable --now holocron-probe`,
                          ],
                          policies: [
                            "Requires root for full /proc /sys access — or use capabilities: setcap cap_sys_ptrace+ep $(which node)",
                            "SELinux (RHEL/CentOS): Run 'sudo semanage permissive -a unconfined_t' or create a policy module:\n  audit2allow -a -M holocron && sudo semodule -i holocron.pp",
                            "AppArmor (Ubuntu): If enforcing, add profile at /etc/apparmor.d/opt.holocron.probe",
                            "sudo access: If company policy restricts root, use a dedicated service account with CAP_SYS_PTRACE",
                            "File integrity monitoring (AIDE/OSSEC): Whitelist /opt/holocron/ to avoid false alerts",
                            "Antivirus/EDR: Exclude /opt/holocron/ and node process from real-time scanning to avoid performance impact",
                          ],
                          firewall: [
                            `Outbound HTTPS (TCP 443) to ${window.location.host}`,
                            "iptables: sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT",
                            "firewalld: sudo firewall-cmd --permanent --add-port=443/tcp --zone=public && sudo firewall-cmd --reload",
                            "ufw: sudo ufw allow out 443/tcp",
                            "If using MQTT: outbound TCP 8883; CoAP: outbound UDP 5684",
                            "Corporate proxy: set HTTPS_PROXY=http://proxy:port in the .env file",
                            "No inbound ports required",
                          ],
                          verify: `# Check service status\nsudo systemctl status holocron-probe\n\n# Watch live logs\nsudo journalctl -u holocron-probe -f\n\n# Verify connectivity\ncurl -s -o /dev/null -w "%{http_code}" ${window.location.origin}/api/health\n\n# Check firewall rules\nsudo iptables -L OUTPUT -n | grep 443`,
                        },
                        "linux-arm": {
                          steps: [
                            `# Step 1: Install Node.js 18+ for ARM\n# Raspberry Pi OS / Debian-based:\ncurl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -\nsudo apt-get install -y nodejs\n\n# Or use nvm for version management:\ncurl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash\nnvm install 18`,
                            `# Step 2: Create probe directory and download files\nsudo mkdir -p /opt/holocron && cd /opt/holocron\ncurl -sSL ${window.location.origin}/api/probe-download/${nodeDownload} -o ${probeFile}\ncurl -sSL ${window.location.origin}/api/probe-download/node-transports -o transports.ts\nsudo npm install -g tsx`,
                            `# Step 3: Test the probe\nHOLOCRON_TOKEN=${currentToken || "<your-token>"} HOLOCRON_API=${window.location.origin}${currentHmacSecret ? ` HOLOCRON_HMAC_SECRET=${currentHmacSecret}` : ""} npx tsx ${probeFile}\n# You should see "Probe enrolled" or "Heartbeat sent". Press Ctrl+C to stop.`,
                            `# Step 4: Install as systemd service\nsudo cat > /etc/systemd/system/holocron-probe.service << 'EOF'\n[Unit]\nDescription=HOLOCRON AI Probe (ARM Edge)\nAfter=network-online.target\n\n[Service]\nType=simple\nUser=root\nWorkingDirectory=/opt/holocron\nEnvironment=HOLOCRON_TOKEN=${currentToken || "<your-token>"}\nEnvironment=HOLOCRON_API=${window.location.origin}${currentHmacSecret ? `\nEnvironment=HOLOCRON_HMAC_SECRET=${currentHmacSecret}` : ""}\nExecStart=/usr/bin/npx tsx /opt/holocron/${probeFile}\nRestart=always\nRestartSec=30\nMemoryMax=256M\nCPUQuota=50%\nStartLimitIntervalSec=300\nStartLimitBurst=5\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsudo systemctl daemon-reload\nsudo systemctl enable --now holocron-probe`,
                          ],
                          policies: [
                            "Memory: Probe uses ~50-80MB RAM. On devices with <512MB, set MemoryMax=256M in systemd unit",
                            "CPU: Set CPUQuota=50% in systemd to prevent probe from starving other processes",
                            "SD Card wear: If /var/log is on SD card, set HOLOCRON_BUFFER_DIR to a tmpfs mount:\n  mount -t tmpfs -o size=64M tmpfs /opt/holocron/buffer",
                            "GPIO/I2C access: If using Serial transport, add user to 'dialout' group: sudo usermod -aG dialout $USER",
                            "Raspberry Pi thermal: Probe reads /sys/class/thermal — no special permission needed on RPi OS",
                            "If device runs read-only filesystem: mount /opt/holocron as rw overlay or use tmpfs for buffer",
                            "Watchdog: Enable hardware watchdog to auto-restart device if probe hangs: sudo modprobe bcm2835_wdt",
                          ],
                          firewall: [
                            `Outbound HTTPS (TCP 443) to ${window.location.host}`,
                            "If behind IoT gateway: configure gateway to forward traffic to HOLOCRON server",
                            "If using LoRa transport: no IP firewall rules needed (RF link)",
                            "If using Serial/RS-485: no IP firewall rules needed (physical link)",
                            "Low bandwidth mode: set HEARTBEAT_INTERVAL=300 to reduce traffic on cellular/satellite links",
                            "If using cellular modem: ensure APN allows outbound HTTPS",
                          ],
                          verify: `# Check ARM architecture\nuname -m\n\n# Monitor resource usage\ntop -p $(pidof node) -bn1\n\n# Check temperature (RPi)\nvcgencmd measure_temp\n\n# Verify probe status\nsudo systemctl status holocron-probe\nsudo journalctl -u holocron-probe --since "10 min ago"`,
                        },
                        "windows-server": {
                          steps: [
                            `# Step 1: Open PowerShell as Administrator\n# Right-click PowerShell → "Run as Administrator"\n# Or: Start-Process powershell -Verb RunAs`,
                            `# Step 2: Set Execution Policy and create probe directory\nSet-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine\nNew-Item -ItemType Directory -Force -Path "C:\\Program Files\\HOLOCRON"\ncd "C:\\Program Files\\HOLOCRON"`,
                            `# Step 3: Download and unblock the probe script\nInvoke-WebRequest -Uri "${window.location.origin}/api/probe-download/windows" -OutFile ".\\holocron-probe.ps1"\nUnblock-File -Path ".\\holocron-probe.ps1"`,
                            `# Step 4: Test connectivity\n$env:HOLOCRON_TOKEN = "${currentToken || "<your-token>"}"\n$env:HOLOCRON_API = "${window.location.origin}"${currentHmacSecret ? `\n$env:HOLOCRON_HMAC_SECRET = "${currentHmacSecret}"` : ""}\n.\\holocron-probe.ps1 -Command Test`,
                            `# Step 5: Install as a persistent scheduled task (runs at startup as SYSTEM)\n.\\holocron-probe.ps1 -Token "${currentToken || "<your-token>"}" -ApiUrl "${window.location.origin}"${currentHmacSecret ? ` -HmacSecret "${currentHmacSecret}"` : ""} -Command Install\n\n# Verify installation\nGet-ScheduledTask -TaskName "HolocronProbe"\nGet-ScheduledTaskInfo -TaskName "HolocronProbe"`,
                          ],
                          policies: [
                            "Execution Policy: Group Policy may override local settings. Check with:\n  Get-ExecutionPolicy -List\n  If 'MachinePolicy' or 'UserPolicy' is Restricted, contact your domain admin to create a GPO exception",
                            "Windows Defender / Antivirus: Add exclusion for C:\\Program Files\\HOLOCRON\\\n  Add-MpPreference -ExclusionPath 'C:\\Program Files\\HOLOCRON'",
                            "SmartScreen: Will block unsigned scripts. Use Unblock-File or right-click → Properties → Unblock",
                            "WMI Access: Script uses WMI for metrics. If WMI is locked down, grant WMI namespace permissions:\n  wmimgmt.msc → WMI Control → Security → Root\\CIMV2 → Add service account",
                            "Service account: For production, create a dedicated 'HolocronSvc' service account with:\n  - Log on as a service right (secpol.msc → Local Policies → User Rights Assignment)\n  - Local admin or WMI read permissions\n  - Access to Program Files\\HOLOCRON directory",
                            "Domain Controller: If installing on DC, additional ADDS permissions may be needed for WMI queries",
                            "Windows Event Log: Script writes to Application log. Ensure the source is registered:\n  New-EventLog -LogName Application -Source 'HOLOCRON Probe'",
                            "UAC: If UAC is enforced, use elevated prompt or configure service to run as SYSTEM",
                          ],
                          firewall: [
                            `Outbound HTTPS (TCP 443) to ${window.location.host}`,
                            `Windows Firewall: New-NetFirewallRule -DisplayName "HOLOCRON Probe" -Direction Outbound -RemoteAddress ${window.location.host.split(":")[0]} -RemotePort 443 -Protocol TCP -Action Allow`,
                            "If behind corporate proxy: set HOLOCRON_PROXY environment variable\n  [System.Environment]::SetEnvironmentVariable('HTTPS_PROXY', 'http://proxy:8080', 'Machine')",
                            "TLS 1.2 minimum: Ensure TLS 1.2 is enabled (default on Server 2016+):\n  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
                            "If using MQTT transport: outbound TCP 8883",
                            "No inbound firewall rules required",
                          ],
                          verify: `# Check scheduled task status\nGet-ScheduledTask -TaskName "HolocronProbe"\nGet-ScheduledTaskInfo -TaskName "HolocronProbe"\n\n# Run task manually\nStart-ScheduledTask -TaskName "HolocronProbe"\n\n# Test connectivity\nTest-NetConnection -ComputerName "${window.location.host.split(":")[0]}" -Port 443\n\n# Check execution policy\nGet-ExecutionPolicy -List\n\n# Check installation status\n.\\holocron-probe.ps1 -Command Status`,
                        },
                        "windows-workstation": {
                          steps: [
                            `# Step 1: Open PowerShell\n# Press Win+X → Windows PowerShell\n# Or search "PowerShell" → right-click → Run as Administrator`,
                            `# Step 2: Set Execution Policy and create probe directory\nSet-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser\nNew-Item -ItemType Directory -Force -Path "$env:LOCALAPPDATA\\HOLOCRON"\ncd "$env:LOCALAPPDATA\\HOLOCRON"`,
                            `# Step 3: Download and unblock the probe script\nInvoke-WebRequest -Uri "${window.location.origin}/api/probe-download/windows" -OutFile ".\\holocron-probe.ps1"\nUnblock-File -Path ".\\holocron-probe.ps1"`,
                            `# Step 4: Test the probe\n$env:HOLOCRON_TOKEN = "${currentToken || "<your-token>"}"\n$env:HOLOCRON_API = "${window.location.origin}"${currentHmacSecret ? `\n$env:HOLOCRON_HMAC_SECRET = "${currentHmacSecret}"` : ""}\n.\\holocron-probe.ps1 -Command Test`,
                            `# Step 5: Install as a persistent scheduled task (runs at startup)\n.\\holocron-probe.ps1 -Token "${currentToken || "<your-token>"}" -ApiUrl "${window.location.origin}"${currentHmacSecret ? ` -HmacSecret "${currentHmacSecret}"` : ""} -Command Install\n\n# Verify installation\nGet-ScheduledTask -TaskName "HolocronProbe"\nGet-ScheduledTaskInfo -TaskName "HolocronProbe"`,
                          ],
                          policies: [
                            "No admin required: Installs to %LOCALAPPDATA% and uses User-scope environment variables",
                            "Execution Policy: If IT enforces 'AllSignedOnly' via Group Policy:\n  Contact IT to whitelist the probe, or use: powershell -ExecutionPolicy Bypass -File ...",
                            "Endpoint Detection (CrowdStrike/Carbon Black/SentinelOne): May flag PowerShell scripts.\n  Request IT to whitelist the probe hash or path: $env:LOCALAPPDATA\\HOLOCRON\\",
                            "DLP/Data Loss Prevention: Probe sends system metrics (CPU/RAM/disk), not user data.\n  If DLP blocks outbound traffic, request a policy exception for the HOLOCRON API endpoint",
                            "Windows Defender: Add exclusion if probe triggers alerts:\n  Add-MpPreference -ExclusionPath \"$env:LOCALAPPDATA\\HOLOCRON\"",
                            "Corporate VPN: If VPN split-tunneling is configured, ensure HOLOCRON API endpoint is routed through the tunnel",
                            "Battery: Scheduled task configured with -AllowStartIfOnBatteries for laptops",
                          ],
                          firewall: [
                            `Outbound HTTPS (TCP 443) to ${window.location.host}`,
                            "Windows Firewall typically allows outbound HTTPS by default — no changes needed",
                            "If corporate firewall blocks unknown destinations, request IT to whitelist the HOLOCRON API URL",
                            "Proxy: If behind corporate proxy with PAC file:\n  [System.Net.WebRequest]::DefaultWebProxy = [System.Net.WebRequest]::GetSystemWebProxy()",
                            "SSL Inspection: If corporate proxy performs SSL inspection, install the corporate root CA certificate:\n  Import-Certificate -FilePath corp-ca.cer -CertStoreLocation Cert:\\LocalMachine\\Root",
                          ],
                          verify: `# Check scheduled task status\nGet-ScheduledTask -TaskName "HolocronProbe"\nGet-ScheduledTaskInfo -TaskName "HolocronProbe"\n\n# Run task manually\nStart-ScheduledTask -TaskName "HolocronProbe"\n\n# Test network connectivity\nTest-NetConnection -ComputerName "${window.location.host.split(":")[0]}" -Port 443\n\n# Check if probe process is running\nGet-Process powershell | Where-Object { $_.CommandLine -like "*holocron*" }\n\n# Check installation status\n.\\holocron-probe.ps1 -Command Status`,
                        },
                        "macos": {
                          steps: [
                            `# Step 1: Open Terminal\n# Press ⌘ + Space, type "Terminal", press Enter\n# Ensure you have internet access and at least macOS Ventura (13.0+)`,
                            `# Step 2: Download the probe script\ncurl -fsSL ${window.location.origin}/api/probe-download/macos -o holocron-probe-macos.sh\nchmod +x holocron-probe-macos.sh\n\n# Verify download\nhead -3 holocron-probe-macos.sh`,
                            `# Step 3: Test connectivity\nHOLOCRON_TOKEN="${currentToken || "<your-token>"}" HOLOCRON_API="${window.location.origin}"${currentHmacSecret ? ` HOLOCRON_HMAC_SECRET="${currentHmacSecret}"` : ""} bash holocron-probe-macos.sh test`,
                            `# Step 4: Run in foreground (test mode — press Ctrl+C to stop)\nbash holocron-probe-macos.sh start \\\n  --token "${currentToken || "<your-token>"}" \\\n  --api "${window.location.origin}"${currentHmacSecret ? ` \\\n  --hmac "${currentHmacSecret}"` : ""}`,
                            `# Step 5: Install as a persistent LaunchDaemon (auto-starts at boot, requires sudo)\nsudo bash holocron-probe-macos.sh install \\\n  --token "${currentToken || "<your-token>"}" \\\n  --api "${window.location.origin}"${currentHmacSecret ? ` \\\n  --hmac "${currentHmacSecret}"` : ""}\n\n# Verify installation\nlaunchctl list | grep holocron`,
                          ],
                          policies: [
                            "sudo required only for LaunchDaemon install — the probe itself runs as root via launchctl",
                            "Gatekeeper / Notarization: Shell scripts are not subject to Gatekeeper. No code-signing needed",
                            "SIP (System Integrity Protection): Probe installs to /usr/local/bin and /Library/LaunchDaemons — both SIP-permitted locations",
                            "FileVault: Probe starts after disk is unlocked. LaunchDaemon RunAtLoad=true handles this correctly",
                            "MDM / Jamf / Mosyle: Deploy via script policy — run 'sudo bash holocron-probe-macos.sh install ...' as root",
                            "macOS Firewall (ALF): Probe uses outbound HTTPS only. Inbound connections are never opened. No ALF rule needed",
                            "Privacy & TCC: Probe reads /Applications and brew packages — no TCC permissions required",
                            "Homebrew (optional): If installed, the probe also inventories brew formulae and casks automatically",
                            "Full Disk Access: Not required — probe reads /Applications plist metadata only, not user data",
                          ],
                          firewall: [
                            `Outbound HTTPS (TCP 443) to ${window.location.host} — required`,
                            "macOS Application Layer Firewall: No inbound rules needed — probe only initiates outbound connections",
                            "If behind corporate proxy: export HTTPS_PROXY=http://proxy:8080 before running",
                            "If using SSL inspection: add corporate root CA to macOS Keychain:\n  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain corp-ca.pem",
                            "pfctl: No custom pf rules required. System default allows outbound HTTPS",
                          ],
                          verify: `# Check LaunchDaemon status\nlaunchctl list | grep holocron\n\n# View live logs\ntail -f "/Library/Application Support/HolocronProbe/probe.log"\n\n# Check probe is phoning home\nlog show --predicate 'process == "bash"' --last 5m | grep -i holocron\n\n# Test connectivity manually\ncurl -s -o /dev/null -w "%{http_code}" ${window.location.origin}/api/health\n\n# Stop the LaunchDaemon\nsudo launchctl unload /Library/LaunchDaemons/com.holocron.probe.plist\n\n# Uninstall completely\nsudo bash /usr/local/bin/holocron-probe-macos uninstall`,
                        },
                        "docker": {
                          steps: [
                            `# Step 1: Verify Docker is installed\ndocker --version   # Requires Docker 20.10+`,
                            `# Step 2: Create working directory and download files\nmkdir -p /opt/holocron-docker && cd /opt/holocron-docker\ncurl -sSL ${window.location.origin}/api/probe-download/${nodeDownload} -o ${probeFile}\ncurl -sSL ${window.location.origin}/api/probe-download/node-transports -o transports.ts${dockerfileDownload ? `\ncurl -sSL ${window.location.origin}/api/probe-download/${dockerfileDownload} -o Dockerfile` : ""}`,
                            `# Step 3: Build and run the container\ndocker build -t holocron/probe:${modeKey} .\ndocker run -d \\\n  --name holocron-probe \\\n  --restart=always \\\n  --read-only \\\n  --tmpfs /tmp:rw,noexec,nosuid \\\n  --memory=256m \\\n  --cpus=0.5 \\\n  -e HOLOCRON_TOKEN="${currentToken || "<token>"}" \\\n  -e HOLOCRON_API="${window.location.origin}" \\${currentHmacSecret ? `\n  -e HOLOCRON_HMAC_SECRET="${currentHmacSecret}" \\` : ""}\n  --security-opt=no-new-privileges \\\n  holocron/probe:${modeKey}`,
                            `# Step 4 (optional): Kubernetes deployment\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: holocron-probe\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: holocron-probe\n  template:\n    spec:\n      containers:\n      - name: probe\n        image: holocron/probe:${modeKey}\n        resources:\n          limits:\n            memory: "256Mi"\n            cpu: "500m"\n        env:\n        - name: HOLOCRON_TOKEN\n          value: "${currentToken || "<token>"}"\n        - name: HOLOCRON_API\n          value: "${window.location.origin}"`,
                          ],
                          policies: [
                            "Rootless Docker: Probe runs as non-root inside container. Compatible with rootless Docker mode",
                            "--read-only: Container filesystem is read-only for security. Uses tmpfs for /tmp",
                            "--security-opt=no-new-privileges: Prevents privilege escalation inside container",
                            "If /proc access needed (kernel-direct mode): add --privileged or specific capabilities:\n  --cap-add=SYS_PTRACE --cap-add=DAC_READ_SEARCH",
                            "Container registry: If pushing to private registry, authenticate first:\n  docker login registry.company.com",
                            "Kubernetes Pod Security Standards: Probe is compatible with 'restricted' PSS level",
                            "Image scanning: Image passes Trivy/Snyk scans — distroless base has minimal CVEs",
                            "Network policy (K8s): Allow egress to HOLOCRON API on port 443:\n  kubectl apply -f - <<< '{...networkpolicy...}'",
                          ],
                          firewall: [
                            `Outbound HTTPS (TCP 443) to ${window.location.host}`,
                            "Docker bridge network: Outbound traffic allowed by default (iptables MASQUERADE)",
                            "If Docker network is restricted: docker network create --driver bridge holocron-net",
                            "Kubernetes: Create a NetworkPolicy allowing egress to HOLOCRON API",
                            "If using host networking: docker run --network=host (bypasses Docker NAT)",
                            "Corporate proxy: pass proxy as env var: -e HTTPS_PROXY=http://proxy:8080",
                          ],
                          verify: `# Check container status\ndocker ps -f name=holocron-probe\n\n# View container logs\ndocker logs -f holocron-probe --tail 50\n\n# Check resource usage\ndocker stats holocron-probe --no-stream\n\n# Inspect container state\ndocker inspect --format='{{.State.Status}} (pid {{.State.Pid}})' holocron-probe\n\n# Note: Distroless images have no shell.\n# Use debug variant for troubleshooting:\n# docker run --entrypoint=sh holocron/probe:${modeKey}-debug`,
                        },
                        "ot-industrial": {
                          steps: [
                            `# Step 1: Install Node.js on the OT gateway/HMI\n# For air-gapped systems, copy Node.js binary via USB:\n# Download from https://nodejs.org/dist/v18.x/ (choose linux-arm64 or linux-x64)\ntar -xzf node-v18.x.x-linux-*.tar.gz\nsudo cp -r node-v18.x.x-linux-*/bin/* /usr/local/bin/\nsudo cp -r node-v18.x.x-linux-*/lib/* /usr/local/lib/`,
                            `# Step 2: Download probe files\nsudo mkdir -p /opt/holocron && cd /opt/holocron\n# On a connected machine, download:\ncurl -sSL ${window.location.origin}/api/probe-download/${nodeDownload} -o ${probeFile}\ncurl -sSL ${window.location.origin}/api/probe-download/node-transports -o transports.ts\nsudo npm install -g tsx\n# For air-gapped systems, copy files via USB or SCP:\n#   scp ${probeFile} transports.ts user@ot-gateway:/opt/holocron/`,
                            `# Step 3: Configure serial port access (if using RS-232/RS-485)\nnpm install serialport\nsudo usermod -aG dialout $USER\nls -la /dev/ttyS* /dev/ttyUSB* /dev/ttyACM* 2>/dev/null\n# Common ports: /dev/ttyUSB0 (USB adapter), /dev/ttyS0 (onboard)`,
                            `# Step 4: Test the probe\nHOLOCRON_TOKEN=${currentToken || "<your-token>"} HOLOCRON_API=${window.location.origin}${currentHmacSecret ? ` HOLOCRON_HMAC_SECRET=${currentHmacSecret}` : ""} npx tsx ${probeFile}\n# You should see "Probe enrolled" or "Heartbeat sent". Press Ctrl+C to stop.`,
                            `# Step 5: Install as service\nsudo cat > /etc/systemd/system/holocron-probe.service << 'EOF'\n[Unit]\nDescription=HOLOCRON AI Probe (OT/Industrial)\nAfter=network.target dev-ttyUSB0.device\n\n[Service]\nType=simple\nUser=root\nWorkingDirectory=/opt/holocron\nEnvironment=HOLOCRON_TOKEN=${currentToken || "<your-token>"}\nEnvironment=HOLOCRON_API=${window.location.origin}${currentHmacSecret ? `\nEnvironment=HOLOCRON_HMAC_SECRET=${currentHmacSecret}` : ""}\nExecStart=/usr/local/bin/npx tsx /opt/holocron/${probeFile}\nRestart=always\nRestartSec=30\nStartLimitIntervalSec=300\nStartLimitBurst=5\n\n[Install]\nWantedBy=multi-user.target\nEOF\nsudo systemctl daemon-reload\nsudo systemctl enable --now holocron-probe`,
                          ],
                          policies: [
                            "ICS/SCADA safety: Probe is READ-ONLY on serial bus. It does NOT send commands to PLCs/RTUs unless explicitly configured",
                            "Air-gap compliance: Use autonomous or semi-autonomous mode with local buffering. No internet required",
                            "ISA/IEC 62443 zones: Deploy probe in the same security zone as monitored devices. Do NOT bridge zones",
                            "Serial port isolation: Use a dedicated RS-485 port. Do not share with SCADA master station",
                            "Change management: Register the probe as an authorized device in your OT asset inventory (IEC 62443-2-1)",
                            "Firmware updates: Disable Node.js auto-updates in air-gapped environments. Pin to tested version",
                            "Network segmentation: If probe needs IP connectivity, use a dedicated OT DMZ VLAN",
                            "Physical security: Secure the gateway/HMI running the probe. Log physical access per your facility security plan",
                            "Modbus rate limiting: Set HEARTBEAT_INTERVAL=60 or higher to avoid flooding the serial bus",
                          ],
                          firewall: [
                            "Air-gapped: No IP firewall rules needed if using Serial/LoRa transport only",
                            "If connecting to HOLOCRON server from OT network: use a data diode or unidirectional gateway",
                            "OT DMZ: Allow outbound HTTPS (TCP 443) from DMZ to corporate network only",
                            "Block ALL inbound traffic to the OT gateway running the probe",
                            "If using LoRa transport: no IP firewall rules needed (RF link, 868/915 MHz)",
                            "VLAN isolation: Probe should be on its own management VLAN, separated from process control VLAN",
                          ],
                          verify: `# Verify serial port access\nls -la /dev/ttyUSB*\ngroups   # Should include 'dialout'\n\n# Test serial communication\nstty -F /dev/ttyUSB0 9600 cs8\necho "AT" > /dev/ttyUSB0\n\n# Check probe status\nsudo systemctl status holocron-probe\nsudo journalctl -u holocron-probe -f\n\n# Monitor serial bus activity\ncat /dev/ttyUSB0 | xxd | head`,
                        },
                        "android": {
                          steps: [
                            `# Step 1: Install Termux from F-Droid (NOT Google Play — outdated version)\n# https://f-droid.org/packages/com.termux/\n# Then install required packages:\npkg update && pkg upgrade -y\npkg install -y curl jq termux-api ca-certificates\n# Also install "Termux:API" companion app from F-Droid`,
                            `# Step 2: Download the HOLOCRON Android probe\ncurl -fsSL ${window.location.origin}/api/probe-download/android -o holocron-probe-android.sh\nchmod +x holocron-probe-android.sh\n\n# Verify download\nhead -5 holocron-probe-android.sh`,
                            `# Step 3: Run the probe (Termux terminal)\nbash holocron-probe-android.sh \\\n  -ServerUrl="${window.location.origin}" \\\n  -ProbeId="<your-probe-id>" \\\n  -Token="${currentToken || "<your-token>"}"${currentHmacSecret ? ` \\\n  -HmacSecret="${currentHmacSecret}"` : ""}\n# You should see "HOLOCRON AI — Android Mobile Probe starting"`,
                            `# Step 4: Enable background operation\n# Install termux-services for background daemon:\npkg install -y termux-services\n\n# Create boot script so probe starts on Termux launch:\nmkdir -p ~/.termux/boot\ncat > ~/.termux/boot/holocron-probe.sh << 'EOF'\n#!/data/data/com.termux/files/usr/bin/bash\nbash ~/holocron-probe-android.sh \\\n  -ServerUrl="${window.location.origin}" \\\n  -ProbeId="<your-probe-id>" \\\n  -Token="${currentToken || "<your-token>"}" \\\n  -Interval=60\nEOF\nchmod +x ~/.termux/boot/holocron-probe.sh\n\n# Acquire wake lock to prevent Android from killing the process:\ntermux-wake-lock`,
                          ],
                          policies: [
                            "Termux must be installed from F-Droid — the Google Play version is outdated and may not support all packages",
                            "Termux:API companion app must be installed from F-Droid for battery, location, and notification features",
                            "Android 12+: Background processes may be killed by Doze mode — acquire wake lock with 'termux-wake-lock'",
                            "MDM wipe/lock commands require Device Admin privileges — grant via: Settings → Device Admin → HOLOCRON Probe",
                            "Location permissions: Grant 'Allow all the time' in App Settings → Termux → Location for GPS tracking",
                            "Battery optimization: Disable battery optimization for Termux in Settings → Battery → App Battery Usage",
                            "Storage permissions: Termux requires storage access to write log files — run 'termux-setup-storage'",
                            "Corporate MDM: If device is already enrolled in corporate MDM (Intune, Jamf, etc.), confirm policy allows Termux installation",
                          ],
                          firewall: [
                            `Outbound HTTPS (TCP 443) to ${window.location.host} — required for server communication`,
                            "Android firewall: typically unrestricted for user-installed apps on corporate Wi-Fi",
                            "If on a proxied corporate Wi-Fi: set proxy in Termux: export HTTPS_PROXY=http://proxy.corp:port",
                            "No inbound ports required — probe initiates all connections to the HOLOCRON server",
                            "MQTT transport (optional): outbound TCP 8883 (TLS MQTT)",
                          ],
                          verify: `# Check probe log\ncat ~/holocron-probe.log | tail -20\n\n# Verify Termux:API is working\ntermux-battery-status\ntermux-wifi-connectioninfo\n\n# Test connectivity to HOLOCRON server\ncurl -s -o /dev/null -w "%{http_code}" ${window.location.origin}/api/health\n\n# Check wake lock status\ntermux-wake-lock\n\n# List running background processes\nps aux | grep holocron`,
                        },
                        "ios": {
                          steps: [
                            `# Step 1: Install a-Shell from the App Store (free)\n# https://apps.apple.com/app/a-shell/id1473805438\n# a-Shell provides a full bash/Python/curl environment on iOS — no jailbreak needed\n\n# Alternatively use iSH (Alpine Linux emulation) or SSH to a jailbroken device`,
                            `# Step 2: Download the HOLOCRON iOS probe (inside a-Shell)\ncurl -fsSL "${window.location.origin}/api/probe-download/ios" -o holocron-probe-ios.sh\nchmod +x holocron-probe-ios.sh\n\n# Verify download\nhead -5 holocron-probe-ios.sh`,
                            `# Step 3: Run in one-shot mode (for use with iOS Shortcuts)\nbash holocron-probe-ios.sh \\\n  -ServerUrl="${window.location.origin}" \\\n  -ProbeId="<your-probe-id>" \\\n  -Token="${currentToken || "<your-token>"}"${currentHmacSecret ? ` \\\n  -HmacSecret="${currentHmacSecret}"` : ""} \\\n  -OneShot\n\n# One-shot completes one check-in and exits — ideal for Shortcuts automation`,
                            `# Step 4: Set up iOS Shortcuts for automatic periodic check-ins\n# 1. Open the Shortcuts app\n# 2. Create a new Shortcut named "HOLOCRON Check-in"\n# 3. Add action: "Run Script in a-Shell"\n#    Script: bash ~/holocron-probe-ios.sh -ServerUrl="${window.location.origin}" -ProbeId="<your-probe-id>" -Token="${currentToken || "<your-token>"}" -OneShot\n# 4. Create Automation: Personal Automation → Time of Day → Every 30 Minutes\n#    Run "HOLOCRON Check-in" shortcut\n# 5. Disable "Ask Before Running" to automate silently\n\n# For always-on monitoring (a-Shell stays open in foreground):\nbash ~/holocron-probe-ios.sh \\\n  -ServerUrl="${window.location.origin}" \\\n  -ProbeId="<your-probe-id>" \\\n  -Token="${currentToken || "<your-token>"}" \\\n  -Interval=60`,
                          ],
                          policies: [
                            "iOS sandbox limits: a-Shell runs in a sandboxed environment — no root access, limited to app's Documents directory",
                            "Background execution: iOS kills background apps after ~30s. Use -OneShot mode with Shortcuts automation for periodic check-ins",
                            "iOS Shortcuts automation requires 'Allow Notifications' and 'Ask Before Running' = Off for silent automation",
                            "Location services: Enable in Settings → Privacy → Location Services → a-Shell → While Using App",
                            "Corporate MDM: If device is managed by Intune/Jamf/WorkspaceONE, confirm a-Shell installation is allowed by policy",
                            "Apple Developer Enterprise: For mass deployment without App Store, consider signing the probe script via MDM profile",
                            "Privacy: The probe reports device hardware, network, and storage. Review with your DPO before corporate deployment",
                            "Jailbreak option: SSH-based deployment provides full telemetry but voids warranty and violates corporate policy at most orgs",
                          ],
                          firewall: [
                            `Outbound HTTPS (TCP 443) to ${window.location.host} — required`,
                            "iOS handles outbound connections natively — no special firewall config needed for cellular or Wi-Fi",
                            "Corporate Wi-Fi proxy: configure proxy in Settings → Wi-Fi → [Network] → Configure Proxy",
                            "SSL inspection: If corporate proxy performs SSL inspection, add its CA cert to iOS Settings → General → VPN & Device Management",
                            "No inbound ports required",
                          ],
                          verify: `# Test connectivity inside a-Shell\ncurl -s -o /dev/null -w "%{http_code}" ${window.location.origin}/api/health\n\n# Check log file\ncat ~/holocron-probe-ios.log | tail -20\n\n# Verify sysctl works (hardware info)\nsysctl -n hw.machine\nsysctl -n hw.ncpu\nsysctl -n hw.memsize\n\n# Verify one-shot mode\nbash ~/holocron-probe-ios.sh -ServerUrl="${window.location.origin}" -ProbeId="test" -Token="test" -OneShot 2>&1 | head -10`,
                        },
                      };

                      const guide = installGuides[selectedPlatform || "kernel"];

                      return (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Select the target platform for your <span className="font-semibold text-foreground">{couplingMode}</span> probe, then follow the installation guide below.
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {platforms.map(p => {
                              const PIc = p.icon;
                              const isActive = (selectedPlatform || "kernel") === p.id;
                              return (
                                <button key={p.id} onClick={() => setSelectedPlatform(p.id)}
                                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-center ${isActive ? `${p.border} ${p.bg} border-2` : "border-border/30 hover:border-border/60"}`}
                                  data-testid={`platform-${p.id}`}>
                                  <div className={`flex h-6 w-6 items-center justify-center rounded ${p.bg} ${p.color}`}>
                                    <PIc className="h-3 w-3" />
                                  </div>
                                  <span className="text-[8px] font-semibold leading-tight">{p.label}</span>
                                  {p.recommended && <span className="text-[6px] font-bold text-green-400">REC</span>}
                                </button>
                              );
                            })}
                          </div>

                          {selectedPlatform === "android" ? (
                            <div className="space-y-2" data-testid="guide-android">

                              {/* Header */}
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                                <Smartphone className="h-4 w-4 text-green-400 shrink-0" />
                                <div className="flex-1">
                                  <p className="text-[11px] font-semibold text-green-400">Android MDM Probe — 4 steps, ~5 minutes</p>
                                  <p className="text-[10px] text-muted-foreground">Android 8+ · No root required · All steps happen on the phone</p>
                                </div>
                              </div>

                              {/* Step 1 */}
                              <div className="flex gap-3 p-3 rounded-lg border border-border/30 bg-muted/5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold shrink-0">1</div>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold mb-0.5">On your phone — install F-Droid</p>
                                  <p className="text-[10px] text-muted-foreground mb-2">
                                    F-Droid is a free, open-source app store (like Google Play, but for open-source apps). You need it to install Termux safely.
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    <a href="https://f-droid.org/" target="_blank" rel="noopener noreferrer">
                                      <Button size="sm" variant="outline" className="gap-1.5 text-[10px] h-7 border-green-500/30 text-green-400" data-testid="link-fdroid">
                                        <ArrowDownToLine className="h-3 w-3" /> f-droid.org (open on phone)
                                      </Button>
                                    </a>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground/70 mt-1.5">Tap the big blue "Download F-Droid" button, open the downloaded file and install it. You may need to allow installs from your browser in Settings.</p>
                                </div>
                              </div>

                              {/* Step 2 */}
                              <div className="flex gap-3 p-3 rounded-lg border border-border/30 bg-muted/5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold shrink-0">2</div>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold mb-1.5">In F-Droid — search "termux" and install these two apps</p>
                                  <div className="space-y-1.5 mb-2">
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                                      <div>
                                        <p className="text-[10px] font-semibold text-green-400">Termux</p>
                                        <p className="text-[9px] text-muted-foreground">The terminal app itself. Just called "Termux" — by Fredrik Fornwall.</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                                      <div>
                                        <p className="text-[10px] font-semibold text-green-400">Termux:API</p>
                                        <p className="text-[9px] text-muted-foreground">The companion app. Lets Termux read battery, network, and device info.</p>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground/70">Ignore Termux:Boot, Termux:Float, Termux:Styling, etc. — those are optional add-ons you don't need.</p>
                                  <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[9px] text-yellow-400/90 mt-1.5">
                                    ⚠️ Do <strong>not</strong> install Termux from Google Play — that version is old and broken. Use F-Droid only.
                                  </div>
                                </div>
                              </div>

                              {/* Step 3 */}
                              <div className="flex gap-3 p-3 rounded-lg border border-border/30 bg-muted/5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold shrink-0">3</div>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold mb-0.5">Get this command onto your phone</p>
                                  <p className="text-[10px] text-muted-foreground mb-2">
                                    The easiest way is to open HOLOCRON on your phone's browser and copy it there. Or email/message the command to yourself, then copy it from your phone.
                                  </p>
                                  {!currentToken ? (
                                    <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-[10px] text-yellow-400">
                                      ⚠️ Generate a Site Token first (button above) — the command won't work without it
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <pre className="p-2 rounded-lg bg-black/60 border border-green-500/20 text-[8px] font-mono text-green-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed select-all">{`pkg install -y curl jq termux-api ca-certificates && curl -fsSL ${window.location.origin}/api/probe-download/android?t=${currentToken} -o ~/hcn.sh && bash ~/hcn.sh`}</pre>
                                      <Button size="sm" className="w-full gap-1.5 text-xs h-7 bg-green-600 hover:bg-green-700 text-white border-0"
                                        onClick={() => {
                                          navigator.clipboard.writeText(`pkg install -y curl jq termux-api ca-certificates && curl -fsSL ${window.location.origin}/api/probe-download/android?t=${currentToken} -o ~/hcn.sh && bash ~/hcn.sh`);
                                          toast({ title: "Copied!", description: "Send it to your phone, then paste it into Termux" });
                                        }}
                                        data-testid="copy-android-command">
                                        <Copy className="h-3 w-3" /> Copy Command
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Step 4 */}
                              <div className="flex gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold shrink-0">4</div>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold mb-2">Open Termux — update packages, then paste the probe command</p>

                                  {/* 4a: pkg update */}
                                  <div className="p-2 rounded-lg bg-black/60 border border-green-500/20 mb-2">
                                    <p className="text-[9px] text-muted-foreground mb-1">4a · First update (required on fresh install):</p>
                                    <div className="flex items-center gap-2">
                                      <code className="text-[10px] font-mono text-green-400 flex-1">pkg update && pkg upgrade -y</code>
                                      <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100"
                                        onClick={() => { navigator.clipboard.writeText("pkg update && pkg upgrade -y"); toast({ title: "Copied update command" }); }}
                                        data-testid="copy-update-cmd">
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground/70 mt-1">Press Enter for any prompts during upgrade. Takes ~1–2 min.</p>
                                  </div>

                                  {/* 4b: Termux:Boot */}
                                  <div className="p-2 rounded-lg bg-black/60 border border-green-500/20 mb-2">
                                    <p className="text-[9px] text-muted-foreground mb-1">4b · Install <span className="text-green-400 font-semibold">Termux:Boot</span> from F-Droid for auto-start at device boot:</p>
                                    <ol className="text-[9px] text-muted-foreground/80 space-y-0.5 list-decimal list-inside">
                                      <li>In F-Droid, search <strong className="text-foreground/70">Termux:Boot</strong> and install it (same publisher as Termux)</li>
                                      <li>Launch Termux:Boot once to register it with Android</li>
                                      <li>In Termux, run the commands below to create the boot script:</li>
                                    </ol>
                                    <div className="mt-1.5 flex items-start gap-2">
                                      <code className="text-[9px] font-mono text-green-400 flex-1 whitespace-pre-wrap">{`mkdir -p ~/.termux/boot
cat > ~/.termux/boot/holocron.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
bash ~/holocron-probe-android.sh &
EOF
chmod +x ~/.termux/boot/holocron.sh`}</code>
                                      <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 opacity-60 hover:opacity-100 mt-0.5"
                                        onClick={() => { navigator.clipboard.writeText("mkdir -p ~/.termux/boot\ncat > ~/.termux/boot/holocron.sh << 'EOF'\n#!/data/data/com.termux/files/usr/bin/bash\ntermux-wake-lock\nbash ~/holocron-probe-android.sh &\nEOF\nchmod +x ~/.termux/boot/holocron.sh"); toast({ title: "Copied boot script" }); }}
                                        data-testid="copy-boot-script">
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground/70 mt-1.5"><span className="text-amber-400 font-semibold">Note:</span> <code className="text-green-400">termux-wake-lock</code> prevents Android Doze from killing the probe. It must be the first command in the boot script.</p>
                                  </div>

                                  {/* 4c: Samsung battery exemption */}
                                  <div className="p-2 rounded-lg bg-black/60 border border-amber-500/20 mb-2">
                                    <p className="text-[9px] text-amber-400 font-semibold mb-1">4c · Samsung devices only — battery exemption required:</p>
                                    <ol className="text-[9px] text-muted-foreground/80 space-y-0.5 list-decimal list-inside">
                                      <li>Open <strong className="text-foreground/70">Settings → Battery and device care → Battery</strong></li>
                                      <li>Tap <strong className="text-foreground/70">Background usage limits → Never sleeping apps</strong></li>
                                      <li>Tap <strong className="text-foreground/70">+</strong> and add both <strong className="text-green-400">Termux</strong> and <strong className="text-green-400">Termux:Boot</strong></li>
                                    </ol>
                                    <p className="text-[9px] text-muted-foreground/70 mt-1">Without this, Samsung's aggressive battery optimisation will suspend Termux within minutes of the screen turning off.</p>
                                  </div>

                                  {/* 4d: Run probe */}
                                  <p className="text-[10px] text-muted-foreground">Then long-press inside Termux to paste the HOLOCRON command above and press Enter. The probe connects automatically and will survive reboots.</p>
                                </div>
                              </div>

                              {/* Done */}
                              <div className="flex gap-3 p-3 rounded-lg border border-border/20 opacity-70">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0">✓</div>
                                <div>
                                  <p className="text-xs font-semibold">Done! The probe is live.</p>
                                  <p className="text-[10px] text-muted-foreground">HOLOCRON will show this device as online in the probe list. Battery, network, and device telemetry start flowing immediately.</p>
                                </div>
                              </div>

                            </div>
                          ) : (
                          <Card className={`p-3 ${activePlatform.border}`} data-testid={`guide-${activePlatform.id}`}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${activePlatform.bg} ${activePlatform.color}`}>
                                <APIcon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold">{activePlatform.label}</h4>
                                <p className="text-[9px] text-muted-foreground">{activePlatform.sub}</p>
                              </div>
                            </div>

                            {(nodeDownload || shellDownload || dockerfileDownload) && (
                              <div className="mb-3 p-2.5 rounded-lg border border-primary/20 bg-primary/5" data-testid="download-section">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <ArrowDownToLine className="h-3.5 w-3.5 text-primary" />
                                  <p className="text-[10px] font-semibold text-primary">Download Probe Files</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {nodeDownload && (
                                    <>
                                      <a href={`/api/probe-download/${nodeDownload}`} download>
                                        <Button size="sm" className={`gap-1.5 text-xs h-8 ${activePlatform.color}`} variant="outline" data-testid={`download-${activePlatform.id}-node`}>
                                          <ArrowDownToLine className="h-3 w-3" /> {probeFile}
                                        </Button>
                                      </a>
                                      <a href="/api/probe-download/node-transports" download>
                                        <Button size="sm" className="gap-1.5 text-xs h-8" variant="outline" data-testid={`download-${activePlatform.id}-transports`}>
                                          <ArrowDownToLine className="h-3 w-3" /> transports.ts
                                        </Button>
                                      </a>
                                    </>
                                  )}
                                  {shellDownload && (
                                    <a href={`/api/probe-download/${shellDownload}`} download>
                                      <Button size="sm" className="gap-1.5 text-xs h-8" variant="outline" data-testid={`download-${activePlatform.id}-shell`}>
                                        <ArrowDownToLine className="h-3 w-3" /> {shellFilename}
                                      </Button>
                                    </a>
                                  )}
                                  {dockerfileDownload && (
                                    <a href={`/api/probe-download/${dockerfileDownload}`} download>
                                      <Button size="sm" className="gap-1.5 text-xs h-8" variant="outline" data-testid={`download-${activePlatform.id}-dockerfile`}>
                                        <Container className="h-3 w-3" /> Dockerfile
                                      </Button>
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="p-2.5 rounded-lg border border-primary/20 bg-primary/5">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Rocket className="h-3.5 w-3.5 text-primary" />
                                  <p className="text-[10px] font-semibold text-primary">Installation Steps</p>
                                </div>
                                <div className="space-y-1.5">
                                  {guide.steps.map((step, i) => (
                                    <div key={i} className="relative">
                                      <pre className="p-1.5 rounded bg-black/50 border border-border/20 text-[8px] font-mono text-green-400 overflow-x-auto whitespace-pre">{step}</pre>
                                      <Button size="icon" variant="ghost" className="absolute top-0.5 right-0.5 h-5 w-5 opacity-60 hover:opacity-100"
                                        onClick={() => { navigator.clipboard.writeText(step.replace(/^#.*\n?/gm, "").trim()); toast({ title: "Copied" }); }}
                                        data-testid={`copy-step-${i}`}>
                                        <Copy className="h-2.5 w-2.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="p-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Shield className="h-3.5 w-3.5 text-yellow-400" />
                                  <p className="text-[10px] font-semibold text-yellow-400">Security Policies & Permissions</p>
                                </div>
                                <div className="space-y-1">
                                  {guide.policies.map((policy, i) => (
                                    <div key={i} className="flex gap-1.5 text-[8px] text-muted-foreground">
                                      <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-500/60 mt-0.5" />
                                      <span className="whitespace-pre-wrap">{policy}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="p-2.5 rounded-lg border border-red-500/20 bg-red-500/5">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Lock className="h-3.5 w-3.5 text-red-400" />
                                  <p className="text-[10px] font-semibold text-red-400">Firewall & Network Requirements</p>
                                </div>
                                <div className="space-y-1">
                                  {guide.firewall.map((rule, i) => (
                                    <div key={i} className="flex gap-1.5 text-[8px] text-muted-foreground">
                                      <Globe className="h-3 w-3 shrink-0 text-red-500/60 mt-0.5" />
                                      <span className="whitespace-pre-wrap">{rule}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="p-2.5 rounded-lg border border-green-500/20 bg-green-500/5">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                                  <p className="text-[10px] font-semibold text-green-400">Verify Installation</p>
                                </div>
                                <div className="relative">
                                  <pre className="p-1.5 rounded bg-black/50 border border-green-500/20 text-[8px] font-mono text-green-400 overflow-x-auto whitespace-pre">{guide.verify}</pre>
                                  <Button size="icon" variant="ghost" className="absolute top-0.5 right-0.5 h-5 w-5 opacity-60 hover:opacity-100"
                                    onClick={() => { navigator.clipboard.writeText(guide.verify); toast({ title: "Copied" }); }}
                                    data-testid="copy-verify">
                                    <Copy className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                          )}
                        </div>
                      );
                    })()}
                  </TabsContent>
                  <TabsContent value="docker" className="mt-3">
                    <div className="relative">
                      <pre className="p-3 rounded-lg bg-black/40 border border-border/30 text-[11px] font-mono text-green-400 overflow-x-auto whitespace-pre">{dockerCmd}</pre>
                      <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6" onClick={() => copyToClipboard(dockerCmd)} data-testid="button-copy-docker">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">Requires Docker 20.10+. Uses host networking for protocol scanning access.</p>
                  </TabsContent>
                  <TabsContent value="vm" className="mt-3">
                    <div className="relative">
                      <pre className="p-3 rounded-lg bg-black/40 border border-border/30 text-[11px] font-mono text-green-400 overflow-x-auto whitespace-pre">{vmCmd}</pre>
                      <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6" onClick={() => copyToClipboard(vmCmd)} data-testid="button-copy-vm">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">One-line installer for Ubuntu 20.04+, CentOS 8+, RHEL 8+. Auto-detects OS and installs dependencies.</p>
                  </TabsContent>
                  <TabsContent value="rpm" className="mt-3">
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground">DEB (Ubuntu/Debian):</p>
                      <div className="relative">
                        <pre className="p-3 rounded-lg bg-black/40 border border-border/30 text-[11px] font-mono text-green-400 overflow-x-auto whitespace-pre">{bareMetalDeb}</pre>
                        <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6" onClick={() => copyToClipboard(bareMetalDeb)} data-testid="button-copy-deb">
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-[10px] font-semibold text-muted-foreground mt-3">RPM (RHEL/CentOS):</p>
                      <div className="relative">
                        <pre className="p-3 rounded-lg bg-black/40 border border-border/30 text-[11px] font-mono text-green-400 overflow-x-auto whitespace-pre">{bareMetalRpm}</pre>
                        <Button size="icon" variant="ghost" className="absolute top-2 right-2 h-6 w-6" onClick={() => copyToClipboard(bareMetalRpm)} data-testid="button-copy-rpm">
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="cloud" className="mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="p-3">
                        <h4 className="text-xs font-semibold mb-1">AWS</h4>
                        <p className="text-[10px] text-muted-foreground">Launch from AWS Marketplace AMI: <code className="text-primary">holocron-probe-v1.0</code></p>
                        <p className="text-[10px] text-muted-foreground mt-1">Set <code className="text-primary">HOLOCRON_TOKEN</code> in user-data or SSM Parameter Store.</p>
                      </Card>
                      <Card className="p-3">
                        <h4 className="text-xs font-semibold mb-1">Azure</h4>
                        <p className="text-[10px] text-muted-foreground">Deploy from Azure Marketplace VM image or use ARM template.</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Store token in Key Vault, reference in deployment.</p>
                      </Card>
                      <Card className="p-3">
                        <h4 className="text-xs font-semibold mb-1">GCP</h4>
                        <p className="text-[10px] text-muted-foreground">Use GCE image from <code className="text-primary">holocron-images</code> project.</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Set token as instance metadata.</p>
                      </Card>
                      <Card className="p-3">
                        <h4 className="text-xs font-semibold mb-1">VMware</h4>
                        <p className="text-[10px] text-muted-foreground">Import OVA template <code className="text-primary">holocron-probe.ova</code> into vSphere.</p>
                        <p className="text-[10px] text-muted-foreground mt-1">Configure token via vApp properties.</p>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {tokenGenerated && currentToken && linkedType?.communicationProtocols && (linkedType.communicationProtocols as any[]).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Communication Protocol Chain</p>
                <div className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(linkedType.communicationProtocols as any[])
                      .filter((p: any) => p.enabled)
                      .sort((a: any, b: any) => a.priority - b.priority)
                      .map((p: any, i: number, arr: any[]) => (
                        <span key={p.type} className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[9px] font-mono gap-1">
                            <span className="text-primary font-bold">P{p.priority}</span>
                            {p.type.toUpperCase()}
                          </Badge>
                          {i < arr.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50" />}
                        </span>
                      ))}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground">Required Environment Variables</p>
                    <div className="p-2 rounded bg-black/40 border border-border/30 font-mono text-[9px] space-y-0.5">
                      <div className="text-green-400">HOLOCRON_TOKEN="{currentToken}"</div>
                      {currentHmacSecret && <div className="text-yellow-400">HOLOCRON_HMAC_SECRET="{currentHmacSecret}"</div>}
                      <div className="text-blue-400">HOLOCRON_API="{window.location.origin}"</div>
                      {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "mqtt") && (
                        <div className="text-cyan-400">HOLOCRON_MQTT_BROKER="{(linkedType.communicationProtocols as any[]).find((p: any) => p.type === "mqtt")?.config?.brokerUrl || "mqtt://broker:1883"}"</div>
                      )}
                      {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "websocket") && (
                        <div className="text-blue-300">HOLOCRON_WS_URL="{(linkedType.communicationProtocols as any[]).find((p: any) => p.type === "websocket")?.config?.url || "wss://server/ws"}"</div>
                      )}
                      {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "coap") && (
                        <div className="text-amber-400">HOLOCRON_COAP_HOST="{(linkedType.communicationProtocols as any[]).find((p: any) => p.type === "coap")?.config?.host || "coap-server"}"</div>
                      )}
                      {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && (p.type === "tcp" || p.type === "udp")) && (
                        <div className="text-purple-400">HOLOCRON_{(linkedType.communicationProtocols as any[]).find((p: any) => p.enabled && (p.type === "tcp" || p.type === "udp"))?.type.toUpperCase()}_HOST="{(linkedType.communicationProtocols as any[]).find((p: any) => p.enabled && (p.type === "tcp" || p.type === "udp"))?.config?.host || "server"}"</div>
                      )}
                      {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "serial") && (
                        <div className="text-yellow-400">HOLOCRON_SERIAL_PORT="{(linkedType.communicationProtocols as any[]).find((p: any) => p.type === "serial")?.config?.path || "/dev/ttyUSB0"}"</div>
                      )}
                      {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "lora") && (
                        <div className="text-pink-400">HOLOCRON_LORA_PORT="{(linkedType.communicationProtocols as any[]).find((p: any) => p.type === "lora")?.config?.serialPort || "/dev/ttyUSB1"}"</div>
                      )}
                      {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "reticulum") && (
                        <div className="text-emerald-400">HOLOCRON_RNS_CONFIG="{(linkedType.communicationProtocols as any[]).find((p: any) => p.type === "reticulum")?.config?.configPath || "~/.reticulum"}"</div>
                      )}
                      <div className="text-muted-foreground mt-1">
                        {"HOLOCRON_TRANSPORTS='" + JSON.stringify((linkedType.communicationProtocols as any[]).filter((p: any) => p.enabled).sort((a: any, b: any) => a.priority - b.priority)) + "'"}
                      </div>
                    </div>
                  </div>
                  {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && ["serial", "lora", "reticulum"].includes(p.type)) && (
                    <div className="p-2 rounded border border-amber-500/20 bg-amber-500/5">
                      <p className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Hardware Requirements
                      </p>
                      <ul className="text-[9px] text-amber-400/80 mt-1 space-y-0.5 pl-4 list-disc">
                        {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "serial") && (
                          <li>RS-232/RS-485 serial adapter connected to host</li>
                        )}
                        {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "lora") && (
                          <li>LoRa radio module (Microchip RN2483 or RNode) attached via serial</li>
                        )}
                        {(linkedType.communicationProtocols as any[]).some((p: any) => p.enabled && p.type === "reticulum") && (
                          <li>Reticulum Network Stack (RNS) installed: <code>pip install rns</code></li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(couplingMode === "semi-autonomous" || couplingMode === "autonomous") && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold" style={{background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.35)",color:"#a78bfa"}}>LOCAL AI</span>
                  Local Management UI
                </p>
                <div className="rounded-xl border p-4 space-y-3" style={{background:"rgba(124,58,237,0.06)",borderColor:"rgba(124,58,237,0.25)"}}>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Once the probe is running it starts a local web interface on <span className="font-mono text-xs font-semibold text-foreground">http://localhost:7788</span>. Open it from a browser on the probe device (or local network) to configure on-device AI reasoning, manage the event buffer, and control autonomous action scope — all without connecting back to HOLOCRON.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg p-2.5 border border-border/40 bg-muted/10">
                      <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Features</p>
                      <ul className="space-y-1 text-[11px] text-muted-foreground">
                        <li>• Enable / disable on-device AI model</li>
                        <li>• Model selection (Phi-3 · Llama 3 · Mistral)</li>
                        <li>• Buffer fill level &amp; force-sync</li>
                        <li>• Autonomous action scope toggles</li>
                        <li>• Live event log &amp; probe control</li>
                      </ul>
                    </div>
                    <div className="rounded-lg p-2.5 border border-border/40 bg-muted/10">
                      <p className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Access</p>
                      <ul className="space-y-1 text-[11px] text-muted-foreground">
                        <li>• Any browser on the probe device</li>
                        <li>• Mobile: save as home-screen shortcut</li>
                        <li>• Android (Termux): works natively</li>
                        <li>• iOS (a-Shell): built-in web server</li>
                        <li>• Works fully offline / air-gapped</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`/api/probe-download/probe-ui-view?mode=${couplingMode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{background:"rgba(124,58,237,0.18)",border:"1px solid rgba(124,58,237,0.35)",color:"#c4b5fd"}}
                      data-testid="link-probe-ui-preview"
                    >
                      <span>⚡</span> Preview Local UI
                    </a>
                    <a
                      href="/api/probe-download/probe-ui"
                      download="holocron-probe-ui.html"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{background:"rgba(6,182,212,0.1)",border:"1px solid rgba(6,182,212,0.25)",color:"#67e8f9"}}
                      data-testid="link-probe-ui-download"
                    >
                      <span>⬇</span> Download UI File
                    </a>
                  </div>
                  <p className="text-[10px] text-muted-foreground opacity-70">
                    The UI is a single self-contained HTML file bundled with the probe installation. It is also available at <span className="font-mono">http://localhost:7788</span> as soon as the probe agent starts.
                  </p>
                </div>
              </div>
            )}

            {tokenGenerated && currentToken && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Step 3: Verify Enrollment</p>
                <div className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-2">
                  <p className="text-xs text-muted-foreground">Once the probe starts, it will:</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">1</div>
                      <span>Connect to HOLOCRON AI using the site token</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">2</div>
                      <span>Self-register with hostname, IP, and OS information</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">3</div>
                      <span>Begin sending heartbeats every {probe.heartbeatInterval || 60} seconds</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">4</div>
                      <span>Pull scan configuration and start discovering assets</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {probe.enrolled && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Probe Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <p className="text-[10px] text-muted-foreground">Hostname</p>
                    <p className="text-sm font-medium" data-testid="text-probe-hostname">{probe.hostname || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <p className="text-[10px] text-muted-foreground">IP Address</p>
                    <p className="text-sm font-medium" data-testid="text-probe-ip">{probe.ipAddress || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <p className="text-[10px] text-muted-foreground">Version</p>
                    <p className="text-sm font-medium">{probe.probeVersion || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <p className="text-[10px] text-muted-foreground">OS</p>
                    <p className="text-sm font-medium">{probe.osInfo || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <p className="text-[10px] text-muted-foreground">Deployment Type</p>
                    <p className="text-sm font-medium capitalize">{probe.deploymentType || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-border/40 bg-muted/10">
                    <p className="text-[10px] text-muted-foreground">Heartbeat Interval</p>
                    <p className="text-sm font-medium">{probe.heartbeatInterval || 60}s</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ProbeFleetHealth({ probes, onSelectProbe }: { probes: DiscoveryProbe[]; onSelectProbe?: (id: string) => void }) {
  const [fleetSearch, setFleetSearch] = useState("");
  const [fleetHealthFilter, setFleetHealthFilter] = useState<string>("all");
  const [fleetPage, setFleetPage] = useState(0);

  const enrolled = probes.filter(p => p.enrolled);
  const online = probes.filter(p => getHeartbeatStatus(p).label === "Online");
  const stale = probes.filter(p => getHeartbeatStatus(p).label === "Stale");
  const offline = probes.filter(p => p.enrolled && getHeartbeatStatus(p).label === "Offline");

  const filteredProbes = useMemo(() => {
    return probes.filter(probe => {
      const q = fleetSearch.toLowerCase();
      const matchSearch = !q || probe.name.toLowerCase().includes(q) || (probe.ipAddress?.toLowerCase().includes(q) ?? false) || probe.protocol.toLowerCase().includes(q) || (probe.hostname?.toLowerCase().includes(q) ?? false);
      const hbStatus = getHeartbeatStatus(probe).label.toLowerCase();
      const pHealth = ((probe as any).healthStatus as string | undefined) || "healthy";
      const matchFilter = fleetHealthFilter === "all" || hbStatus === fleetHealthFilter.toLowerCase() || pHealth === fleetHealthFilter.toLowerCase();
      return matchSearch && matchFilter;
    });
  }, [probes, fleetSearch, fleetHealthFilter]);

  const fleetTotalPages = Math.max(1, Math.ceil(filteredProbes.length / PAGE_SIZE));
  const safeFleetPage = Math.min(fleetPage, fleetTotalPages - 1);
  const paginatedProbes = filteredProbes.slice(safeFleetPage * PAGE_SIZE, (safeFleetPage + 1) * PAGE_SIZE);

  const deploymentTypes = useMemo(() => {
    const map = new Map<string, number>();
    probes.forEach(p => {
      const t = p.deploymentType || "not deployed";
      map.set(t, (map.get(t) || 0) + 1);
    });
    return map;
  }, [probes]);

  const deploymentIcons: Record<string, typeof Container> = {
    docker: Container,
    vm: Server,
    "bare-metal": HardDrive,
    cloud: Cloud,
    "not deployed": XCircle,
  };

  if (probes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        Probe Fleet Health
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <Radar className="h-3.5 w-3.5 text-primary" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Total</span>
            </div>
            <p className="text-xl font-bold" data-testid="stat-probes-fleet-total">{probes.length}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Enrolled</span>
            </div>
            <p className="text-xl font-bold" data-testid="stat-probes-enrolled">{enrolled.length}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <Signal className="h-3.5 w-3.5 text-green-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Online</span>
            </div>
            <p className="text-xl font-bold text-green-400" data-testid="stat-probes-online">{online.length}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Stale</span>
            </div>
            <p className="text-xl font-bold text-yellow-400" data-testid="stat-probes-stale">{stale.length}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-0.5">
              <XCircle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Offline</span>
            </div>
            <p className="text-xl font-bold text-red-400" data-testid="stat-probes-offline">{offline.length}</p>
          </CardContent>
        </Card>
      </div>

      {probes.some(p => (p as any).healthStatus === "degraded" || (p as any).healthStatus === "overloaded") && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5" data-testid="probe-health-alert">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-[11px] text-amber-300">
            {probes.filter(p => (p as any).healthStatus === "overloaded").length > 0
              ? `${probes.filter(p => (p as any).healthStatus === "overloaded").length} probe(s) overloaded — consider reducing scan frequency or distributing workload`
              : `${probes.filter(p => (p as any).healthStatus === "degraded").length} probe(s) under heavy load — monitor closely`
            }
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search probes by name, IP, protocol..."
            value={fleetSearch}
            onChange={e => { setFleetSearch(e.target.value); setFleetPage(0); }}
            className="h-8 text-xs pl-8"
            data-testid="input-search-fleet"
          />
        </div>
        <Select value={fleetHealthFilter} onValueChange={v => { setFleetHealthFilter(v); setFleetPage(0); }}>
          <SelectTrigger className="h-8 w-[130px] text-xs" data-testid="select-fleet-filter">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="stale">Stale</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="degraded">Degraded</SelectItem>
            <SelectItem value="overloaded">Overloaded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {paginatedProbes.map(probe => {
          const hb = getHeartbeatStatus(probe);
          const proto = protocolConfig[probe.protocol] || protocolConfig.http;
          const pHealth = (probe as any).healthStatus as string | undefined;
          const pCpu = (probe as any).cpuUsage as number | undefined;
          const pMem = (probe as any).memoryUsage as number | undefined;
          const pDisk = (probe as any).diskUsage as number | undefined;
          const pQueue = (probe as any).taskQueueDepth as number | undefined;
          const pScanDur = (probe as any).avgScanDuration as number | undefined;
          const hasMetrics = pCpu !== undefined && pCpu !== null;
          const healthGradient = pHealth === "overloaded" ? "#ef4444" : pHealth === "degraded" ? "#f59e0b" : "#22c55e";

          return (
            <Card
              key={probe.id}
              className={`overflow-hidden agent-card-hover ${onSelectProbe ? "cursor-pointer" : ""} group`}
              data-testid={`probe-health-${probe.id}`}
              onClick={() => onSelectProbe?.(probe.id)}
            >
              <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${healthGradient}60, transparent)` }} />
              <CardContent className="p-2.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative">
                    <div className={`h-1.5 w-1.5 rounded-full ${hb.dotColor} absolute -top-0.5 -right-0.5 z-10`} />
                    <div className={`h-6 w-6 rounded-md flex items-center justify-center ${proto.color}`}>
                      <Radar className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-semibold block truncate">{probe.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[7px] font-medium capitalize ${hb.color}`}>{hb.label}</span>
                      {probe.enrolled ? (
                        <span className="text-[6px] px-1 py-0 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Enrolled</span>
                      ) : (
                        <span className="text-[6px] px-1 py-0 rounded-full bg-muted/30 text-muted-foreground font-medium">Not Enrolled</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Heart className={`h-2 w-2 ${hb.color}`} />
                      <span className={`text-[7px] font-medium ${hb.color}`} data-testid={`probe-last-heartbeat-${probe.id}`}>
                        {probe.lastHeartbeat ? timeAgo(probe.lastHeartbeat) : "No heartbeat"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <Badge variant="outline" className={`text-[6px] h-3.5 px-1 ${pHealth === "healthy" ? "bg-green-500/10 text-green-400 border-green-500/20" : pHealth === "degraded" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : pHealth === "overloaded" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-muted/10 text-muted-foreground border-border/20"}`} data-testid={`probe-health-badge-${probe.id}`}>
                      {(pHealth || "unknown").toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {hasMetrics && (
                  <div className="space-y-1 mb-1.5">
                    {[
                      { label: "CPU", value: pCpu },
                      { label: "MEM", value: pMem },
                      { label: "DISK", value: pDisk },
                    ].filter(m => m.value !== null && m.value !== undefined).map(m => {
                      const v = m.value as number;
                      const barColor = v >= 90 ? "bg-red-500" : v >= 70 ? "bg-amber-500" : "bg-emerald-500";
                      const textColor = v >= 90 ? "text-red-400" : v >= 70 ? "text-amber-400" : "text-emerald-400";
                      return (
                        <div key={m.label} className="flex items-center gap-1.5" data-testid={`probe-metric-${m.label.toLowerCase()}-${probe.id}`}>
                          <span className="text-[7px] text-muted-foreground uppercase w-5">{m.label}</span>
                          <div className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(v, 100)}%` }} />
                          </div>
                          <span className={`text-[9px] font-bold w-7 text-right ${textColor}`}>{Math.round(v)}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {hasMetrics && (pQueue !== undefined || pScanDur !== undefined) && (
                  <div className="flex items-center gap-3 mb-1.5 text-[7px] text-muted-foreground">
                    {pQueue !== undefined && pQueue !== null && (
                      <span data-testid={`probe-queue-${probe.id}`}>
                        Queue: <span className={`font-bold ${(pQueue || 0) > 10 ? "text-amber-400" : "text-foreground"}`}>{pQueue}</span>
                      </span>
                    )}
                    {pScanDur !== undefined && pScanDur !== null && (
                      <span data-testid={`probe-scandur-${probe.id}`}>
                        Avg Scan: <span className="font-bold text-foreground">{pScanDur > 1000 ? `${(pScanDur / 1000).toFixed(1)}s` : `${Math.round(pScanDur)}ms`}</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[7px] text-muted-foreground pt-1 border-t border-border/10">
                  <div className="flex items-center gap-1">
                    <Activity className="h-2.5 w-2.5" />
                    <span>{probe.discoveredCount || 0} discovered</span>
                  </div>
                  {probe.probeVersion && (
                    <span className="flex items-center gap-0.5">
                      <span className="text-muted-foreground/50">v{probe.probeVersion}</span>
                    </span>
                  )}
                  {probe.protocol && (
                    <span className="px-1 py-0 rounded bg-muted/20 font-medium uppercase">{probe.protocol}</span>
                  )}
                </div>

                {probe.deploymentType && (
                  <div className="mt-1 pt-1 border-t border-border/10 flex justify-end">
                    <Badge variant="outline" className="text-[7px] h-3.5 capitalize">{probe.deploymentType}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredProbes.length === 0 && (fleetSearch || fleetHealthFilter !== "all") && (
        <div className="text-center py-6 text-xs text-muted-foreground">
          No probes match your search or filter.
        </div>
      )}

      {filteredProbes.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            Showing {safeFleetPage * PAGE_SIZE + 1}–{Math.min((safeFleetPage + 1) * PAGE_SIZE, filteredProbes.length)} of {filteredProbes.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={safeFleetPage === 0} onClick={() => setFleetPage(safeFleetPage - 1)} data-testid="button-fleet-prev">
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-[10px] text-muted-foreground px-2">
              {safeFleetPage + 1} / {fleetTotalPages}
            </span>
            <Button variant="outline" size="sm" className="h-6 w-6 p-0" disabled={safeFleetPage >= fleetTotalPages - 1} onClick={() => setFleetPage(safeFleetPage + 1)} data-testid="button-fleet-next">
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {deploymentTypes.size > 1 && (
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider">Deployment Mix:</span>
          {[...deploymentTypes.entries()].map(([type, count]) => {
            const Icon = deploymentIcons[type] || Server;
            return (
              <span key={type} className="flex items-center gap-1 capitalize">
                <Icon className="h-3 w-3" /> {type}: {count}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddProbeDialog({ credentials, agents, onCreated }: { credentials: DiscoveryCredential[]; agents: { id: string; name: string }[]; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [protocol, setProtocol] = useState("snmp_v2c");
  const [credentialId, setCredentialId] = useState("");
  const [scanSubnet, setScanSubnet] = useState("");
  const [scanSchedule, setScanSchedule] = useState("0 */4 * * *");
  const [agentRoleId, setAgentRoleId] = useState("");
  const [couplingMode, setCouplingMode] = useState("coupled");

  const { data: probeTypes } = useQuery<ProbeType[]>({ queryKey: ["/api/probe-types"] });

  const couplingOptions: { value: string; label: string; desc: string; color: string }[] = [
    { value: "coupled", label: "Coupled", desc: "Always-connected probe — streams telemetry directly to HOLOCRON in real time.", color: "text-blue-400" },
    { value: "semi-autonomous", label: "Semi-Autonomous", desc: "Edge-buffered probe — stores up to 10,000 events locally and syncs opportunistically.", color: "text-amber-400" },
    { value: "autonomous", label: "Fully Autonomous", desc: "Fully independent probe — on-device AI reasoning, periodic sync, no persistent connection required.", color: "text-purple-400" },
  ];

  const mutation = useMutation({
    mutationFn: async () => {
      const matchedTypeId = probeTypes?.find(t => t.couplingMode === couplingMode)?.id;
      const res = await apiRequest("POST", "/api/discovery-probes", {
        name, description, protocol, credentialId: credentialId || undefined, scanSubnet, scanSchedule,
        assignedAgentRoleId: agentRoleId || undefined, probeTypeId: matchedTypeId || undefined, status: "idle", discoveredCount: 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes"] });
      toast({ title: "Probe created" });
      setOpen(false);
      setName(""); setDescription(""); setScanSubnet(""); setCouplingMode("coupled");
      onCreated();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5" data-testid="button-add-probe">
          <Plus className="h-3.5 w-3.5" /> Add Probe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Discovery Probe</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Probe Type</Label>
            <Select value={couplingMode} onValueChange={setCouplingMode}>
              <SelectTrigger data-testid="select-probe-type">
                <SelectValue placeholder="Select probe type..." />
              </SelectTrigger>
              <SelectContent>
                {couplingOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className={`font-medium ${opt.color}`}>{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {couplingMode && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {couplingOptions.find(o => o.value === couplingMode)?.desc}
              </p>
            )}
          </div>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Network Infrastructure Scanner" data-testid="input-probe-name" />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What this probe discovers" data-testid="input-probe-description" />
          </div>
          <div>
            <Label>Protocol</Label>
            <Select value={protocol} onValueChange={setProtocol}>
              <SelectTrigger data-testid="select-probe-protocol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(protocolConfig).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Credential</Label>
            <Select value={credentialId} onValueChange={setCredentialId}>
              <SelectTrigger data-testid="select-probe-credential">
                <SelectValue placeholder="Select credential" />
              </SelectTrigger>
              <SelectContent>
                {credentials.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{protocol === "mdm" ? "Device IP Address" : "Scan Subnet"}</Label>
            <Input
              value={scanSubnet}
              onChange={e => setScanSubnet(e.target.value)}
              placeholder={protocol === "mdm" ? "e.g., 192.168.1.45  (Android Wi-Fi IP)" : "e.g., 10.0.1.0/24"}
              data-testid="input-probe-subnet"
            />
            {protocol === "mdm" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                On the Android device: Settings → About Phone → Status → IP Address
              </p>
            )}
          </div>
          <div>
            <Label>{protocol === "mdm" ? "Heartbeat Interval (cron)" : "Schedule (cron)"}</Label>
            <Input
              value={scanSchedule}
              onChange={e => setScanSchedule(e.target.value)}
              placeholder={protocol === "mdm" ? "*/5 * * * *  (every 5 min)" : "*/30 * * * *"}
              data-testid="input-probe-schedule"
            />
            {protocol === "mdm" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                How often the Android probe checks in. The device self-registers on first run — no scan needed.
              </p>
            )}
          </div>
          <div>
            <Label>Assigned AI Agent</Label>
            <Select value={agentRoleId} onValueChange={setAgentRoleId}>
              <SelectTrigger data-testid="select-probe-agent">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!name || !description || mutation.isPending} className="w-full" data-testid="button-save-probe">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Probe
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type CapabilityLevel = "active" | "available" | "planned" | "na";
type CapabilityItem = { label: string; level: CapabilityLevel; description: string };
type CapabilityGroup = {
  title: string;
  icon: typeof Layers;
  color: string;
  items: CapabilityItem[];
};

function deriveProbeCapabilities(probe: DiscoveryProbe): {
  couplingLevel: { label: string; level: string; description: string; color: string };
  autonomyScore: number;
  purposeTypes: { type: string; active: boolean; icon: typeof Layers; color: string }[];
  capabilities: CapabilityGroup[];
} {
  const p = probe as any;
  const hasHeartbeat = !!probe.lastHeartbeat;
  const hasMetrics = p.cpuUsage !== undefined && p.cpuUsage !== null;
  const hasBuffer = !!p.bufferStatus;
  const hasCollectionSchedule = !!p.collectionSchedule;
  const isEnrolled = !!probe.enrolled;
  const hasAgent = !!probe.assignedAgentRoleId;
  const protocol = probe.protocol;

  const hasSchedule = hasCollectionSchedule || !!probe.scanSchedule;
  const isIoT = ["lorawan", "bacnet", "modbus", "mqtt"].includes(protocol);
  const isCyber = ["ssh", "wmi", "snmp_v2c", "snmp_v3"].includes(protocol);
  const isComms = ["lorawan", "mqtt"].includes(protocol);
  const isApi = ["api", "http"].includes(protocol);

  let couplingLabel = "Coupled";
  let couplingDesc = "Polls server continuously for instructions";
  let couplingColor = "text-blue-400";
  let couplingLevel = "v9";
  let autonomyScore = 25;

  if (hasBuffer && hasSchedule) {
    couplingLabel = "Loosely-Coupled";
    couplingDesc = "Operates independently during communication gaps, syncs when available";
    couplingColor = "text-amber-400";
    couplingLevel = "transitional";
    autonomyScore = 55;
  }
  if (hasBuffer && hasSchedule && hasAgent) {
    couplingLabel = "Semi-Autonomous";
    couplingDesc = "AI-supervised with local decision-making and buffered operations";
    couplingColor = "text-purple-400";
    couplingLevel = "v10";
    autonomyScore = 75;
  }

  if (hasMetrics) autonomyScore += 5;
  if (isEnrolled) autonomyScore += 5;
  if (hasAgent) autonomyScore += 10;
  autonomyScore = Math.min(autonomyScore, 100);

  const purposeTypes = [
    { type: "Telemetry", active: hasMetrics || hasHeartbeat, icon: Activity, color: "text-green-400 bg-green-500/10" },
    { type: "Sensor", active: isIoT, icon: Satellite, color: "text-cyan-400 bg-cyan-500/10" },
    { type: "Cyber/Digital", active: isCyber, icon: Shield, color: "text-red-400 bg-red-500/10" },
    { type: "Communications", active: isComms || isApi, icon: Signal, color: "text-blue-400 bg-blue-500/10" },
  ];

  const capabilities: CapabilityGroup[] = [
    {
      title: "Situational Awareness",
      icon: Eye,
      color: "text-cyan-400",
      items: [
        { label: "System Health Monitoring", level: hasMetrics ? "active" : hasHeartbeat ? "available" : "planned", description: "CPU, memory, disk, and task queue monitoring" },
        { label: "Threshold Monitoring", level: hasMetrics ? "active" : "available", description: "Continuous assessment against defined operational parameters" },
        { label: "Predictive Failure Detection", level: hasAgent ? "active" : "planned", description: "AI-driven analysis to identify potential failures" },
        { label: "Health Scoring", level: p.healthStatus ? "active" : "planned", description: "Quantitative assessment of operational status" },
        { label: "Network Interface Awareness", level: hasSchedule ? "active" : "available", description: "Real-time network interface stats and utilization" },
        { label: "Environmental Context", level: isIoT ? "active" : "na", description: "CBRN, temperature, humidity, and atmospheric monitoring" },
      ],
    },
    {
      title: "Collection & Discovery",
      icon: Radar,
      color: "text-blue-400",
      items: [
        { label: "Metric Collection", level: hasSchedule ? "active" : "available", description: "Scheduled collection of system and performance metrics" },
        { label: "Software Inventory", level: hasSchedule ? "active" : "available", description: "Installed applications, OS info, and patch levels" },
        { label: "Security Audit", level: hasSchedule ? "active" : "available", description: "Firewall, AV, patches, UAC, and encryption status" },
        { label: "Storage Analysis", level: hasSchedule ? "active" : "available", description: "Disk volumes, capacity, and utilization trends" },
        { label: "Network Discovery", level: probe.scanSubnet ? "active" : "available", description: "Subnet scanning and asset enumeration" },
        { label: "Full System Scan", level: hasSchedule ? "available" : "planned", description: "On-demand comprehensive system analysis" },
      ],
    },
    {
      title: "Autonomous Operations",
      icon: Brain,
      color: "text-purple-400",
      items: [
        { label: "Buffered Telemetry", level: hasBuffer ? "active" : "available", description: "Store and forward data during connectivity gaps" },
        { label: "Local Filtering & Aggregation", level: hasSchedule ? "active" : "planned", description: "Edge-side data processing before transmission" },
        { label: "Adaptive Heartbeat Interval", level: hasHeartbeat ? "active" : "planned", description: "Dynamic adjustment based on health status" },
        { label: "Pre-authorised Workflows", level: hasAgent ? "available" : "planned", description: "Execute mission playbooks without server connectivity" },
        { label: "Local Decision-Making", level: hasAgent ? "available" : "planned", description: "Rules-based logic combined with AI inference" },
        { label: "Opportunistic Sync", level: hasBuffer ? "active" : "planned", description: "State and learning sync when connectivity permits" },
      ],
    },
    {
      title: "Execution & Actuation",
      icon: Zap,
      color: "text-amber-400",
      items: [
        { label: "Remediation Execution", level: isEnrolled ? "active" : "available", description: "Execute remediation scripts dispatched by AI agents" },
        { label: "System Isolation", level: isCyber ? "available" : "na", description: "Quarantine compromised systems or network segments" },
        { label: "Configuration Enforcement", level: isCyber ? "available" : "na", description: "Apply and enforce configuration baselines" },
        { label: "Patch Deployment", level: isEnrolled ? "available" : "planned", description: "Automated patch deployment and verification" },
        { label: "Service Restart", level: isEnrolled ? "available" : "planned", description: "Restart services and processes on managed systems" },
        { label: "Network Reconfiguration", level: isIoT || isCyber ? "available" : "na", description: "Dynamic routing and topology adjustments" },
      ],
    },
    {
      title: "Governance & Compliance",
      icon: Lock,
      color: "text-emerald-400",
      items: [
        { label: "HMAC Authentication", level: p.hmacSecret ? "active" : "available", description: "Cryptographic request signing and verification" },
        { label: "Token-based Access Control", level: probe.siteToken ? "active" : "available", description: "Secure enrollment with expiring tokens" },
        { label: "IP Binding", level: p.enrolledIp ? "active" : "available", description: "Restrict probe access to enrolled IP address" },
        { label: "Audit Trail", level: isEnrolled ? "active" : "available", description: "Complete logging of all actions and decisions" },
        { label: "Policy Enforcement", level: hasAgent ? "available" : "planned", description: "Enforce governance locally when disconnected" },
        { label: "Compliance Reporting", level: hasSchedule ? "available" : "planned", description: "Automated compliance status and gap analysis" },
      ],
    },
  ];

  return { couplingLevel: { label: couplingLabel, level: couplingLevel, description: couplingDesc, color: couplingColor }, autonomyScore, purposeTypes, capabilities };
}

const capLevelConfig: Record<CapabilityLevel, { label: string; color: string; bg: string; dotColor: string }> = {
  active: { label: "Active", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", dotColor: "bg-green-400" },
  available: { label: "Available", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", dotColor: "bg-blue-400" },
  planned: { label: "Planned", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", dotColor: "bg-amber-400" },
  na: { label: "N/A", color: "text-muted-foreground/40", bg: "bg-muted/10 border-border/10", dotColor: "bg-muted-foreground/30" },
};

function ProbeCapabilitiesTab({ probe }: { probe: DiscoveryProbe }) {
  const profile = deriveProbeCapabilities(probe);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const totalCaps = profile.capabilities.flatMap(g => g.items).filter(i => i.level !== "na");
  const activeCaps = totalCaps.filter(i => i.level === "active");
  const availableCaps = totalCaps.filter(i => i.level === "available");

  return (
    <div className="space-y-4" data-testid="probe-capabilities-content">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border border-border/30 bg-muted/5 col-span-1 sm:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CircuitBoard className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Probe Classification</span>
              <Badge variant="outline" className={`text-[8px] ml-auto ${profile.couplingLevel.color}`}>
                {profile.couplingLevel.level.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className={`text-lg font-bold ${profile.couplingLevel.color}`}>
                {profile.couplingLevel.label}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mb-3">{profile.couplingLevel.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.purposeTypes.map(pt => (
                <Badge
                  key={pt.type}
                  variant="outline"
                  className={`text-[9px] gap-1 ${pt.active ? pt.color : "text-muted-foreground/40 bg-muted/5 border-border/20"}`}
                  data-testid={`probe-purpose-${pt.type.toLowerCase().replace(/[/\s]+/g, "-")}`}
                >
                  <pt.icon className="h-2.5 w-2.5" />
                  {pt.type}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/30 bg-muted/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold">Autonomy Score</span>
            </div>
            <div className="flex items-center justify-center mb-2">
              <div className="relative h-20 w-20">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--border))"
                    strokeWidth="2.5"
                    strokeOpacity="0.3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={profile.autonomyScore >= 70 ? "#a78bfa" : profile.autonomyScore >= 45 ? "#fbbf24" : "#60a5fa"}
                    strokeWidth="2.5"
                    strokeDasharray={`${profile.autonomyScore}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-lg font-bold ${profile.autonomyScore >= 70 ? "text-purple-400" : profile.autonomyScore >= 45 ? "text-amber-400" : "text-blue-400"}`} data-testid="probe-autonomy-score">
                    {profile.autonomyScore}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-center text-[10px] text-muted-foreground">
              {activeCaps.length} active · {availableCaps.length} available
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {profile.capabilities.map(group => {
          const GroupIcon = group.icon;
          const activeCount = group.items.filter(i => i.level === "active").length;
          const totalCount = group.items.filter(i => i.level !== "na").length;
          const isExpanded = expandedGroup === group.title;

          return (
            <Card key={group.title} className="border border-border/30 bg-muted/5 overflow-hidden">
              <button
                className="w-full p-3 flex items-center gap-3 hover:bg-muted/10 transition-colors cursor-pointer"
                onClick={() => setExpandedGroup(isExpanded ? null : group.title)}
                data-testid={`probe-cap-group-${group.title.toLowerCase().replace(/[&\s]+/g, "-")}`}
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-md bg-muted/30 ${group.color}`}>
                  <GroupIcon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-semibold flex-1 text-left">{group.title}</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {group.items.map((item, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-1.5 rounded-full ${capLevelConfig[item.level].dotColor}`}
                        title={`${item.label}: ${capLevelConfig[item.level].label}`}
                      />
                    ))}
                  </div>
                  <span className="text-[9px] text-muted-foreground">{activeCount}/{totalCount}</span>
                  <svg className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 12 12">
                    <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1 border-t border-border/20 pt-2">
                  {group.items.map(item => {
                    const cfg = capLevelConfig[item.level];
                    return (
                      <div
                        key={item.label}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md ${item.level === "na" ? "opacity-40" : ""}`}
                        data-testid={`probe-cap-${item.label.toLowerCase().replace(/[\s/&]+/g, "-")}`}
                      >
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-medium">{item.label}</div>
                          <div className="text-[9px] text-muted-foreground">{item.description}</div>
                        </div>
                        <Badge variant="outline" className={`text-[8px] shrink-0 ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="border border-border/20 bg-muted/5">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground">Capability Legend</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {(["active", "available", "planned", "na"] as CapabilityLevel[]).map(level => {
              const cfg = capLevelConfig[level];
              return (
                <div key={level} className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                  <span className={`text-[9px] ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-1.5">
            Capabilities are derived from probe configuration, enrollment status, and assigned AI agent. Enable more features by enrolling the probe, assigning an AI agent, and configuring collection schedules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type ProbeCredentialsData = {
  primaryCredentialId: string | null;
  primaryCredential: DiscoveryCredential | null;
  linkedCredentials: (DiscoveryCredential & { linkId: string; addedAt: string })[];
  availableCredentials: DiscoveryCredential[];
};

function ProbeCredentialsTab({ probeId }: { probeId: string }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCredId, setSelectedCredId] = useState("");

  const { data, isLoading } = useQuery<ProbeCredentialsData>({ queryKey: ["/api/discovery-probes", probeId, "credentials"] });

  const addMutation = useMutation({
    mutationFn: async (credentialId: string) => apiRequest("POST", `/api/discovery-probes/${probeId}/credentials`, { credentialId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes", probeId, "credentials"] });
      toast({ title: "Credential linked to probe" });
      setShowAdd(false);
      setSelectedCredId("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: async (credentialId: string) => apiRequest("DELETE", `/api/discovery-probes/${probeId}/credentials/${credentialId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes", probeId, "credentials"] });
      toast({ title: "Credential unlinked" });
    },
  });

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const linkedIds = new Set([data?.primaryCredentialId, ...(data?.linkedCredentials?.map(c => c.id) || [])].filter(Boolean));
  const unlinked = data?.availableCredentials?.filter(c => !linkedIds.has(c.id)) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Linked Credentials</span>
        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setShowAdd(true)} data-testid="button-link-credential">
          <Plus className="h-3 w-3 mr-1" /> Link Credential
        </Button>
      </div>

      {data?.primaryCredential && (
        <Card className="border-primary/30 bg-primary/5" data-testid="card-primary-credential">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded border ${(protocolConfig[data.primaryCredential.protocol] || protocolConfig.http).color}`}>
                {(() => { const P = (protocolConfig[data.primaryCredential.protocol] || protocolConfig.http).icon; return <P className="h-4 w-4" />; })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" data-testid="text-primary-cred-name">{data.primaryCredential.name}</span>
                  <Badge className="text-[9px] bg-primary/20 text-primary border-primary/30">Primary</Badge>
                  <Badge variant="outline" className="text-[9px]">{(protocolConfig[data.primaryCredential.protocol] || { label: data.primaryCredential.protocol }).label}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span><Globe className="h-3 w-3 inline mr-0.5" />{data.primaryCredential.host}</span>
                  {data.primaryCredential.port && <span>Port {data.primaryCredential.port}</span>}
                  <span className="capitalize"><Shield className="h-3 w-3 inline mr-0.5" />{data.primaryCredential.authType?.replace(/_/g, " ")}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {(data?.linkedCredentials?.length || 0) > 0 && (
        <div className="space-y-2">
          {data!.linkedCredentials.map(cred => {
            const proto = protocolConfig[cred.protocol] || protocolConfig.http;
            const ProtoIcon = proto.icon;
            return (
              <Card key={cred.id} className="border-border/30" data-testid={`card-linked-credential-${cred.id}`}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded border ${proto.color}`}>
                      <ProtoIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" data-testid={`text-linked-cred-name-${cred.id}`}>{cred.name}</span>
                        <Badge variant="outline" className="text-[9px]">{proto.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span><Globe className="h-3 w-3 inline mr-0.5" />{cred.host}</span>
                        {cred.port && <span>Port {cred.port}</span>}
                        <span className="capitalize"><Shield className="h-3 w-3 inline mr-0.5" />{cred.authType?.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeMutation.mutate(cred.id)} data-testid={`button-unlink-credential-${cred.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!data?.primaryCredential && (data?.linkedCredentials?.length || 0) === 0 && !showAdd && (
        <div className="text-center py-6 text-muted-foreground">
          <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">No credentials linked to this probe.</p>
          <p className="text-[10px] mt-1 opacity-60">Link credentials to enable discovery of devices with different authentication.</p>
        </div>
      )}

      {showAdd && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Link a Credential</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAdd(false)} data-testid="button-cancel-link-cred"><XCircle className="h-3.5 w-3.5" /></Button>
            </div>
            {unlinked.length > 0 ? (
              <>
                <Select value={selectedCredId} onValueChange={setSelectedCredId}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-link-credential"><SelectValue placeholder="Select a credential..." /></SelectTrigger>
                  <SelectContent>
                    {unlinked.map(c => {
                      const p = protocolConfig[c.protocol] || protocolConfig.http;
                      return <SelectItem key={c.id} value={c.id}>{c.name} ({p.label}) — {c.host}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setShowAdd(false)} data-testid="button-cancel-link">Cancel</Button>
                  <Button size="sm" className="h-7 text-[10px]" disabled={!selectedCredId || addMutation.isPending} onClick={() => addMutation.mutate(selectedCredId)} data-testid="button-confirm-link-credential">
                    {addMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Link Credential
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">All available credentials are already linked to this probe.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/20 bg-muted/10">
        <CardContent className="py-3">
          <div className="text-[10px] text-muted-foreground">
            <Info className="h-3 w-3 inline mr-1" />
            Link multiple credentials to this probe so it can discover devices using different authentication methods (SSH keys, SNMP communities, API tokens, etc.). When scanning, the probe will use its linked credentials to authenticate with target devices.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type ClusterData = {
  clusterEnabled: boolean;
  clusterMode: string;
  nodes: ProbeClusterNode[];
  capacity: { totalMaxMetrics: number; totalCurrentMetrics: number; nodeCount: number; onlineNodes: number; utilizationPct: number };
};

const TIER_COLORS: Record<string, string> = {
  entry: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  standard: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  performance: "text-green-400 bg-green-500/10 border-green-500/20",
  enterprise: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  custom: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

function ProbeClusterTab({ probeId }: { probeId: string }) {
  const { toast } = useToast();
  const [showAddNode, setShowAddNode] = useState(false);
  const [nodeForm, setNodeForm] = useState({ nodeAlias: "", hardwareTier: "performance", ipAddress: "", hostname: "", cpuCores: 4, ramGb: 64, maxMetrics: 5000 });

  const { data: cluster, isLoading } = useQuery<ClusterData>({ queryKey: ["/api/discovery-probes", probeId, "cluster"] });

  const enableMutation = useMutation({
    mutationFn: async (enabled: boolean) => apiRequest("POST", `/api/discovery-probes/${probeId}/cluster/enable`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes", probeId, "cluster"] });
      toast({ title: cluster?.clusterEnabled ? "Clustering disabled" : "Clustering enabled" });
    },
  });

  const addNodeMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", `/api/discovery-probes/${probeId}/cluster/nodes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes", probeId, "cluster"] });
      toast({ title: "Node added to cluster" });
      setShowAddNode(false);
      setNodeForm({ nodeAlias: "", hardwareTier: "performance", ipAddress: "", hostname: "", cpuCores: 4, ramGb: 64, maxMetrics: 5000 });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const removeNodeMutation = useMutation({
    mutationFn: async (nodeId: string) => apiRequest("DELETE", `/api/discovery-probes/${probeId}/cluster/nodes/${nodeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes", probeId, "cluster"] });
      toast({ title: "Node removed" });
    },
  });

  function handleTierChange(tier: string) {
    const cfg = HARDWARE_TIERS[tier];
    if (tier === "custom") {
      setNodeForm(f => ({ ...f, hardwareTier: tier }));
    } else {
      setNodeForm(f => ({ ...f, hardwareTier: tier, cpuCores: cfg.cpuCores, ramGb: cfg.ramGb, maxMetrics: cfg.maxMetrics }));
    }
  }

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const cap = cluster?.capacity || { totalMaxMetrics: 0, totalCurrentMetrics: 0, nodeCount: 0, onlineNodes: 0, utilizationPct: 0 };
  const isEnabled = cluster?.clusterEnabled || false;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={isEnabled} onCheckedChange={v => enableMutation.mutate(v)} data-testid="switch-cluster-enable" />
            <Label className="text-xs font-medium">Enable Clustering</Label>
          </div>
          {isEnabled && (
            <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30" data-testid="badge-cluster-enabled">
              <Server className="h-2.5 w-2.5 mr-0.5" /> Coordinator
            </Badge>
          )}
        </div>
        {isEnabled && (
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setShowAddNode(true)} data-testid="button-add-cluster-node">
            <Plus className="h-3 w-3 mr-1" /> Add Node
          </Button>
        )}
      </div>

      {isEnabled && (
        <>
          <Card className="border-border/40">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Cluster Capacity</span>
                <span className="text-xs text-muted-foreground">{cap.totalCurrentMetrics.toLocaleString()} / {cap.totalMaxMetrics.toLocaleString()} metrics</span>
              </div>
              <Progress value={cap.utilizationPct} className="h-2" data-testid="progress-cluster-capacity" />
              <div className="flex items-center gap-4 mt-2">
                <span className="text-[10px] text-muted-foreground"><Server className="h-3 w-3 inline mr-0.5" /> {cap.nodeCount} node{cap.nodeCount !== 1 ? "s" : ""}</span>
                <span className="text-[10px] text-green-400"><CheckCircle2 className="h-3 w-3 inline mr-0.5" /> {cap.onlineNodes} online</span>
                <span className="text-[10px] text-muted-foreground"><Gauge className="h-3 w-3 inline mr-0.5" /> {cap.utilizationPct}% utilized</span>
                {cap.totalMaxMetrics > 0 && (
                  <span className="text-[10px] text-blue-400"><Zap className="h-3 w-3 inline mr-0.5" /> {(cap.totalMaxMetrics - cap.totalCurrentMetrics).toLocaleString()} available</span>
                )}
              </div>
            </CardContent>
          </Card>

          {showAddNode && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Add Cluster Node</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddNode(false)} data-testid="button-cancel-add-node"><XCircle className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px]">Node Alias</Label>
                    <Input value={nodeForm.nodeAlias} onChange={e => setNodeForm(f => ({ ...f, nodeAlias: e.target.value }))} placeholder="e.g., Node-02" className="mt-1 h-8 text-xs" data-testid="input-node-alias" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Hardware Tier</Label>
                    <Select value={nodeForm.hardwareTier} onValueChange={handleTierChange}>
                      <SelectTrigger className="mt-1 h-8 text-xs" data-testid="select-node-tier"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(HARDWARE_TIERS).map(([key, tier]) => (
                          <SelectItem key={key} value={key}>{tier.label} — {tier.maxMetrics > 0 ? `${tier.maxMetrics.toLocaleString()} metrics` : "Custom"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {nodeForm.hardwareTier === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[10px]">CPU Cores</Label>
                      <Input type="number" value={nodeForm.cpuCores} onChange={e => setNodeForm(f => ({ ...f, cpuCores: parseInt(e.target.value) || 0 }))} className="mt-1 h-8 text-xs" data-testid="input-node-cpu" />
                    </div>
                    <div>
                      <Label className="text-[10px]">RAM (GB)</Label>
                      <Input type="number" value={nodeForm.ramGb} onChange={e => setNodeForm(f => ({ ...f, ramGb: parseInt(e.target.value) || 0 }))} className="mt-1 h-8 text-xs" data-testid="input-node-ram" />
                    </div>
                    <div>
                      <Label className="text-[10px]">Max Metrics</Label>
                      <Input type="number" value={nodeForm.maxMetrics} onChange={e => setNodeForm(f => ({ ...f, maxMetrics: parseInt(e.target.value) || 0 }))} className="mt-1 h-8 text-xs" data-testid="input-node-max-metrics" />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[10px]">IP Address</Label>
                    <Input value={nodeForm.ipAddress} onChange={e => setNodeForm(f => ({ ...f, ipAddress: e.target.value }))} placeholder="10.0.1.50" className="mt-1 h-8 text-xs" data-testid="input-node-ip" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Hostname</Label>
                    <Input value={nodeForm.hostname} onChange={e => setNodeForm(f => ({ ...f, hostname: e.target.value }))} placeholder="probe-node-02" className="mt-1 h-8 text-xs" data-testid="input-node-hostname" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[10px] text-muted-foreground">
                    {HARDWARE_TIERS[nodeForm.hardwareTier] && nodeForm.hardwareTier !== "custom" && (
                      <span>{HARDWARE_TIERS[nodeForm.hardwareTier].cpuCores} CPU / {HARDWARE_TIERS[nodeForm.hardwareTier].ramGb} GB RAM → <span className="text-foreground font-medium">{HARDWARE_TIERS[nodeForm.hardwareTier].maxMetrics.toLocaleString()} metrics</span></span>
                    )}
                    {nodeForm.hardwareTier === "custom" && (
                      <span>{nodeForm.cpuCores} CPU / {nodeForm.ramGb} GB RAM → <span className="text-foreground font-medium">{nodeForm.maxMetrics.toLocaleString()} metrics</span></span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setShowAddNode(false)} data-testid="button-cancel-node">Cancel</Button>
                    <Button size="sm" className="h-7 text-[10px]" onClick={() => addNodeMutation.mutate(nodeForm)} disabled={!nodeForm.nodeAlias || addNodeMutation.isPending} data-testid="button-save-node">
                      {addNodeMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      Add Node
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(cluster?.nodes?.length || 0) > 0 && (
            <div className="space-y-2">
              {cluster!.nodes.map(node => {
                const tierCfg = HARDWARE_TIERS[node.hardwareTier] || HARDWARE_TIERS.custom;
                const tierColor = TIER_COLORS[node.hardwareTier] || TIER_COLORS.custom;
                const utilizationPct = node.maxMetrics > 0 ? Math.round((node.currentMetrics / node.maxMetrics) * 100) : 0;
                const statusColor = node.status === "online" ? "text-green-400" : node.status === "degraded" ? "text-amber-400" : "text-red-400";
                const statusBg = node.status === "online" ? "bg-green-500/20 border-green-500/30" : node.status === "degraded" ? "bg-amber-500/20 border-amber-500/30" : "bg-red-500/20 border-red-500/30";
                return (
                  <Card key={node.id} className="border-border/30" data-testid={`card-cluster-node-${node.id}`}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded border ${tierColor}`}>
                          <Server className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" data-testid={`text-node-alias-${node.id}`}>{node.nodeAlias}</span>
                            <Badge variant="outline" className={`text-[9px] ${tierColor}`}>{tierCfg.label}</Badge>
                            <Badge className={`text-[9px] ${statusBg} ${statusColor}`}>{node.status}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span><Cpu className="h-3 w-3 inline mr-0.5" />{node.cpuCores} CPU</span>
                            <span><Layers className="h-3 w-3 inline mr-0.5" />{node.ramGb} GB</span>
                            <span><Gauge className="h-3 w-3 inline mr-0.5" />{node.currentMetrics.toLocaleString()} / {node.maxMetrics.toLocaleString()} metrics</span>
                            {node.ipAddress && <span><Globe className="h-3 w-3 inline mr-0.5" />{node.ipAddress}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <Progress value={utilizationPct} className="h-1.5" />
                            <span className="text-[9px] text-muted-foreground">{utilizationPct}%</span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => removeNodeMutation.mutate(node.id)} data-testid={`button-remove-node-${node.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {(cluster?.nodes?.length || 0) === 0 && !showAddNode && (
            <div className="text-center py-6 text-muted-foreground">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No cluster nodes yet. Add nodes to scale metric collection capacity.</p>
              <p className="text-[10px] mt-1 opacity-60">Each node adds ~5,000 metrics (Performance tier, 4 CPU / 64 GB).</p>
            </div>
          )}

          <Card className="border-border/20 bg-muted/10">
            <CardContent className="py-3">
              <div className="text-[10px] font-medium mb-2">Hardware Tier Reference</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(HARDWARE_TIERS).filter(([k]) => k !== "custom").map(([key, tier]) => (
                  <div key={key} className={`px-2 py-1.5 rounded border text-center ${TIER_COLORS[key]}`}>
                    <div className="text-[10px] font-medium">{tier.label}</div>
                    <div className="text-[15px] font-bold">{tier.maxMetrics.toLocaleString()}</div>
                    <div className="text-[9px] opacity-70">{tier.cpuCores} CPU / {tier.ramGb} GB</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!isEnabled && (
        <div className="text-center py-8 text-muted-foreground">
          <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Probe Clustering</p>
          <p className="text-xs mt-1 max-w-md mx-auto">Scale this probe by adding cluster nodes. Each node contributes additional metric collection capacity. A Performance node (4 CPU / 64 GB) handles ~5,000 concurrent service metrics.</p>
          <p className="text-[10px] mt-2 opacity-60">Enable clustering above to get started.</p>
        </div>
      )}
    </div>
  );
}

function ProbeActivityLogTab({ probeId }: { probeId: string }) {
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/discovery-probes", probeId, "activity-logs"],
    queryFn: async () => {
      const r = await fetch(`/api/discovery-probes/${probeId}/activity-logs?limit=200`, { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 15000,
  });

  const [filter, setFilter] = useState("all");
  const filteredLogs = filter === "all" ? logs : logs.filter((l: any) => l.eventType === filter);

  const eventTypeConfig: Record<string, { label: string; color: string; icon: typeof Activity }> = {
    enrollment: { label: "Enrollment", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Rocket },
    heartbeat: { label: "Heartbeat", color: "text-green-400 bg-green-500/10 border-green-500/20", icon: Activity },
    config_fetch: { label: "Config Fetch", color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: ArrowDownToLine },
    buffered_data: { label: "Buffered Data", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Layers },
    error: { label: "Error", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: AlertTriangle },
  };

  if (isLoading) {
    return (
      <Card className="border border-border/30 bg-muted/5">
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading activity logs...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="probe-activity-log">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Probe Activity Log</span>
          <Badge variant="outline" className="text-[9px]">{filteredLogs.length} entries</Badge>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-7 w-[140px] text-[10px]" data-testid="activity-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="enrollment">Enrollments</SelectItem>
            <SelectItem value="heartbeat">Heartbeats</SelectItem>
            <SelectItem value="config_fetch">Config Fetches</SelectItem>
            <SelectItem value="buffered_data">Buffered Data</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredLogs.length === 0 ? (
        <Card className="border border-border/30 bg-muted/5">
          <CardContent className="p-6 text-center">
            <ScrollText className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-muted-foreground">No Activity Logs Yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Activity will appear here once the probe starts sending heartbeats.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border/30 bg-muted/5">
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
                  <tr className="border-b border-border/20">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Time</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Event</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Details</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log: any) => {
                    const config = eventTypeConfig[log.eventType] || eventTypeConfig.heartbeat;
                    const EventIcon = config.icon;
                    const ts = log.createdAt ? new Date(log.createdAt) : null;
                    return (
                      <tr key={log.id} className="border-b border-border/10 hover:bg-muted/20" data-testid={`activity-row-${log.id}`}>
                        <td className="py-1.5 px-3 text-muted-foreground whitespace-nowrap">
                          {ts ? (
                            <span title={ts.toLocaleString()}>
                              {ts.toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                              {ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-1.5 px-3">
                          <Badge variant="outline" className={`text-[8px] gap-1 ${config.color}`}>
                            <EventIcon className="h-2.5 w-2.5" />
                            {config.label}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 text-foreground max-w-[300px] truncate" title={log.message}>
                          {log.message}
                        </td>
                        <td className="py-1.5 px-3 text-right text-muted-foreground font-mono">
                          {log.ipAddress || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProbeDetailPanel({ probe, agentName, onClose }: {
  probe: DiscoveryProbe;
  agentName?: string;
  onClose: () => void;
}) {
  const proto = protocolConfig[probe.protocol] || protocolConfig.http;
  const ProtoIcon = proto.icon;
  const hb = getHeartbeatStatus(probe);
  const p = probe as any;
  const safeNum = (v: any): number | undefined => {
    if (v === null || v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const cpuUsage = safeNum(p.cpuUsage);
  const memoryUsage = safeNum(p.memoryUsage);
  const diskUsage = safeNum(p.diskUsage);
  const taskQueueDepth = safeNum(p.taskQueueDepth);
  const avgScanDuration = safeNum(p.avgScanDuration);
  const healthStatus = p.healthStatus as string | undefined;
  const healthMetrics = Array.isArray(p.healthMetrics) ? p.healthMetrics : [];
  const hasMetrics = cpuUsage !== undefined || memoryUsage !== undefined || diskUsage !== undefined;

  const healthColor = healthStatus === "overloaded" ? "text-red-400" : healthStatus === "degraded" ? "text-amber-400" : healthStatus === "healthy" ? "text-green-400" : "text-muted-foreground";
  const healthLabel = healthStatus === "overloaded" ? "OVERLOADED" : healthStatus === "degraded" ? "DEGRADED" : healthStatus === "healthy" ? "HEALTHY" : "UNKNOWN";
  const healthBg = healthStatus === "overloaded" ? "bg-red-500/10 border-red-500/20" : healthStatus === "degraded" ? "bg-amber-500/10 border-amber-500/20" : healthStatus === "healthy" ? "bg-green-500/10 border-green-500/20" : "bg-muted/20 border-border/30";

  const gaugeMetrics = [
    { label: "CPU Usage", value: cpuUsage, icon: Cpu, warn: 85, crit: 95, unit: "%" },
    { label: "Memory Usage", value: memoryUsage, icon: Layers, warn: 90, crit: 95, unit: "%" },
    { label: "Disk Usage", value: diskUsage, icon: HardDrive, warn: 85, crit: 95, unit: "%" },
  ];

  const recentMetrics = healthMetrics.slice(-30);
  const cpuHistory = recentMetrics.map((m: any) => safeNum(m.cpuUsage)).filter((v): v is number => v !== undefined);
  const memHistory = recentMetrics.map((m: any) => safeNum(m.memoryUsage)).filter((v): v is number => v !== undefined);
  const diskHistory = recentMetrics.map((m: any) => safeNum(m.diskUsage)).filter((v): v is number => v !== undefined);

  const avgCpu = cpuHistory.length > 0 ? cpuHistory.reduce((a: number, b: number) => a + b, 0) / cpuHistory.length : null;
  const avgMem = memHistory.length > 0 ? memHistory.reduce((a: number, b: number) => a + b, 0) / memHistory.length : null;
  const avgDisk = diskHistory.length > 0 ? diskHistory.reduce((a: number, b: number) => a + b, 0) / diskHistory.length : null;
  const maxCpu = cpuHistory.length > 0 ? Math.max(...cpuHistory) : null;
  const maxMem = memHistory.length > 0 ? Math.max(...memHistory) : null;
  const maxDisk = diskHistory.length > 0 ? Math.max(...diskHistory) : null;

  function MiniSparkline({ data, color }: { data: number[]; color: string }) {
    if (data.length < 2) return null;
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const w = 120;
    const h = 24;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
    return (
      <svg width={w} height={h} className="opacity-80">
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
      </svg>
    );
  }

  return (
    <div className="space-y-4" data-testid="probe-detail-panel">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-back-to-probes">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${proto.color}`}>
          <ProtoIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold" data-testid="probe-detail-name">{probe.name}</h2>
            <Badge variant="outline" className={`text-[8px] gap-1 ${hb.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${hb.dotColor} inline-block`} />
              {hb.label}
            </Badge>
            {healthStatus && (
              <Badge variant="outline" className={`text-[7px] ${healthBg} ${healthColor}`} data-testid="probe-detail-health">
                {healthLabel}
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{probe.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Globe className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">IP Address</span>
            </div>
            <p className="text-xs font-semibold" data-testid="probe-detail-ip">{probe.ipAddress || "—"}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Server className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Hostname</span>
            </div>
            <p className="text-xs font-semibold truncate" data-testid="probe-detail-hostname">{probe.hostname || "—"}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Zap className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Version</span>
            </div>
            <p className="text-xs font-semibold" data-testid="probe-detail-version">{probe.probeVersion || "—"}</p>
          </CardContent>
        </Card>
        <Card className="stat-card-gradient">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Activity className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Last Heartbeat</span>
            </div>
            <p className="text-xs font-semibold" data-testid="probe-detail-heartbeat">{probe.lastHeartbeat ? timeAgo(probe.lastHeartbeat) : "Never"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[9px]">{proto.label}</Badge>
        {probe.scanSubnet && <Badge variant="outline" className="text-[9px] gap-1"><Network className="h-2.5 w-2.5" /> {probe.scanSubnet}</Badge>}
        {probe.enrolled && <Badge variant="outline" className="text-[9px] gap-1 bg-blue-500/10 text-blue-400 border-blue-500/20"><CheckCircle2 className="h-2.5 w-2.5" /> Enrolled</Badge>}
        {probe.enrolledAt && <Badge variant="outline" className="text-[8px]">Since {new Date(probe.enrolledAt).toLocaleDateString()}</Badge>}
        {probe.deploymentType && <Badge variant="outline" className="text-[9px] capitalize gap-1"><Container className="h-2.5 w-2.5" /> {probe.deploymentType}</Badge>}
        {probe.osInfo && <Badge variant="outline" className="text-[8px] gap-1"><Monitor className="h-2.5 w-2.5" /> {probe.osInfo}</Badge>}
        {agentName && <Badge variant="outline" className="text-[8px] gap-1 bg-primary/10 text-primary border-primary/20"><Bot className="h-2.5 w-2.5" /> {agentName}</Badge>}
        {probe.discoveredCount > 0 && <Badge variant="outline" className="text-[9px] gap-1 bg-green-500/10 text-green-400 border-green-500/20"><Search className="h-2.5 w-2.5" /> {probe.discoveredCount} assets found</Badge>}
      </div>

      <Tabs defaultValue="health" className="w-full">
        <TabsList className="h-auto w-full justify-start gap-0 bg-muted/30 p-0.5 flex-wrap">
          <TabsTrigger value="health" className="text-[10px] h-7 px-3 data-[state=active]:bg-background" data-testid="probe-tab-health">
            <Gauge className="h-3 w-3 mr-1" /> Health
          </TabsTrigger>
          <TabsTrigger value="trends" className="text-[10px] h-7 px-3 data-[state=active]:bg-background" data-testid="probe-tab-trends">
            <BarChart3 className="h-3 w-3 mr-1" /> Trends
          </TabsTrigger>
          <TabsTrigger value="system" className="text-[10px] h-7 px-3 data-[state=active]:bg-background" data-testid="probe-tab-system">
            <Info className="h-3 w-3 mr-1" /> System
          </TabsTrigger>
          <TabsTrigger value="credentials" className="text-[10px] h-7 px-3 data-[state=active]:bg-background" data-testid="probe-tab-credentials">
            <Key className="h-3 w-3 mr-1" /> Credentials
          </TabsTrigger>
          <TabsTrigger value="cluster" className="text-[10px] h-7 px-3 data-[state=active]:bg-background" data-testid="probe-tab-cluster">
            <Server className="h-3 w-3 mr-1" /> Cluster
          </TabsTrigger>
          <TabsTrigger value="capabilities" className="text-[10px] h-7 px-3 data-[state=active]:bg-background" data-testid="probe-tab-capabilities">
            <CircuitBoard className="h-3 w-3 mr-1" /> Capabilities
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-[10px] h-7 px-3 data-[state=active]:bg-background" data-testid="probe-tab-activity">
            <ScrollText className="h-3 w-3 mr-1" /> Activity Log
          </TabsTrigger>
          <TabsTrigger value="media" className="text-[10px] h-7 px-3 data-[state=active]:bg-background" data-testid="probe-tab-media">
            <Radio className="h-3 w-3 mr-1" /> Media Add-on
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="mt-3 space-y-3" data-testid="probe-health-content">
          {hasMetrics ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {gaugeMetrics.map(metric => {
                  const val = metric.value ?? 0;
                  const color = val > metric.crit ? "text-red-400" : val > metric.warn ? "text-amber-400" : "text-green-400";
                  const barColor = val > metric.crit ? "bg-red-400" : val > metric.warn ? "bg-amber-400" : "bg-green-400";
                  const bgColor = val > metric.crit ? "border-red-500/20 bg-red-500/5" : val > metric.warn ? "border-amber-500/20 bg-amber-500/5" : "border-border/30 bg-muted/5";
                  const MetricIcon = metric.icon;
                  return (
                    <Card key={metric.label} className={`border ${bgColor}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <MetricIcon className={`h-4 w-4 ${color}`} />
                            <span className="text-xs font-medium">{metric.label}</span>
                          </div>
                          <span className={`text-lg font-bold ${color}`} data-testid={`probe-detail-${metric.label.split(" ")[0].toLowerCase()}`}>{Math.round(val)}{metric.unit}</span>
                        </div>
                        <Progress value={val} className="h-2" />
                        <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
                          <span>0{metric.unit}</span>
                          <span className={val > metric.warn ? "text-amber-400 font-medium" : ""}>Warn: {metric.warn}{metric.unit}</span>
                          <span className={val > metric.crit ? "text-red-400 font-medium" : ""}>Crit: {metric.crit}{metric.unit}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="border border-border/30 bg-muted/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-medium">Task Queue</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-bold ${(taskQueueDepth || 0) > 20 ? "text-red-400" : (taskQueueDepth || 0) > 10 ? "text-amber-400" : "text-foreground"}`} data-testid="probe-detail-queue">
                        {taskQueueDepth ?? 0}
                      </span>
                      <span className="text-xs text-muted-foreground">tasks queued</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>Warn: &gt;10</span>
                      <span>Critical: &gt;20</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-border/30 bg-muted/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-4 w-4 text-purple-400" />
                      <span className="text-xs font-medium">Avg Scan Duration</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold" data-testid="probe-detail-scanduration">
                        {avgScanDuration !== undefined && avgScanDuration !== null
                          ? avgScanDuration > 1000 ? `${(avgScanDuration / 1000).toFixed(1)}s` : `${Math.round(avgScanDuration)}ms`
                          : "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">per scan</span>
                    </div>
                    <div className="mt-2 text-[10px] text-muted-foreground">
                      Heartbeat interval: {probe.heartbeatInterval || 60}s
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="border border-border/30 bg-muted/5">
              <CardContent className="p-6 text-center">
                <Gauge className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">No Health Metrics Yet</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Deploy the latest probe script to start collecting CPU, memory, and disk metrics via heartbeat.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends" className="mt-3 space-y-3" data-testid="probe-trends-content">
          {recentMetrics.length > 1 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "CPU", data: cpuHistory, avg: avgCpu, max: maxCpu, color: "#4ade80", warnColor: "#fbbf24", critColor: "#f87171" },
                  { label: "Memory", data: memHistory, avg: avgMem, max: maxMem, color: "#60a5fa", warnColor: "#fbbf24", critColor: "#f87171" },
                  { label: "Disk", data: diskHistory, avg: avgDisk, max: maxDisk, color: "#a78bfa", warnColor: "#fbbf24", critColor: "#f87171" },
                ].map(metric => {
                  const currentColor = (metric.max || 0) > 95 ? metric.critColor : (metric.max || 0) > 85 ? metric.warnColor : metric.color;
                  return (
                    <Card key={metric.label} className="border border-border/30 bg-muted/5">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">{metric.label}</span>
                          <span className="text-[9px] text-muted-foreground">{metric.data.length} samples</span>
                        </div>
                        <div className="flex justify-center mb-2">
                          <MiniSparkline data={metric.data} color={currentColor} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-muted-foreground">Avg: </span>
                            <span className="font-semibold">{metric.avg !== null ? `${Math.round(metric.avg)}%` : "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Peak: </span>
                            <span className={`font-semibold ${(metric.max || 0) > 90 ? "text-red-400" : ""}`}>{metric.max !== null ? `${Math.round(metric.max)}%` : "—"}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="border border-border/30 bg-muted/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Recent Health History</span>
                    <span className="text-[9px] text-muted-foreground ml-auto">{recentMetrics.length} entries</span>
                  </div>
                  <div className="max-h-[200px] overflow-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-border/20">
                          <th className="text-left py-1 text-muted-foreground font-medium">Time</th>
                          <th className="text-right py-1 text-muted-foreground font-medium">CPU</th>
                          <th className="text-right py-1 text-muted-foreground font-medium">MEM</th>
                          <th className="text-right py-1 text-muted-foreground font-medium">Disk</th>
                          <th className="text-right py-1 text-muted-foreground font-medium">Queue</th>
                          <th className="text-right py-1 text-muted-foreground font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...recentMetrics].reverse().slice(0, 20).map((m: any, i: number) => {
                          const statusColor = m.healthStatus === "overloaded" ? "text-red-400" : m.healthStatus === "degraded" ? "text-amber-400" : "text-green-400";
                          return (
                            <tr key={i} className="border-b border-border/10">
                              <td className="py-1 text-muted-foreground">{m.timestamp ? new Date(m.timestamp).toLocaleTimeString() : "—"}</td>
                              <td className={`py-1 text-right font-mono ${safeNum(m.cpuUsage) !== undefined && safeNum(m.cpuUsage)! > 85 ? "text-amber-400" : ""}`}>{safeNum(m.cpuUsage) !== undefined ? `${Math.round(safeNum(m.cpuUsage)!)}%` : "—"}</td>
                              <td className={`py-1 text-right font-mono ${safeNum(m.memoryUsage) !== undefined && safeNum(m.memoryUsage)! > 90 ? "text-amber-400" : ""}`}>{safeNum(m.memoryUsage) !== undefined ? `${Math.round(safeNum(m.memoryUsage)!)}%` : "—"}</td>
                              <td className={`py-1 text-right font-mono ${safeNum(m.diskUsage) !== undefined && safeNum(m.diskUsage)! > 85 ? "text-amber-400" : ""}`}>{safeNum(m.diskUsage) !== undefined ? `${Math.round(safeNum(m.diskUsage)!)}%` : "—"}</td>
                              <td className={`py-1 text-right font-mono ${safeNum(m.taskQueueDepth) !== undefined && safeNum(m.taskQueueDepth)! > 10 ? "text-amber-400" : ""}`}>{safeNum(m.taskQueueDepth) !== undefined ? safeNum(m.taskQueueDepth) : "—"}</td>
                              <td className={`py-1 text-right capitalize ${statusColor}`}>{m.healthStatus || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border border-border/30 bg-muted/5">
              <CardContent className="p-6 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">Insufficient Data for Trends</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Trend data will appear after the probe sends multiple heartbeats with health metrics.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="system" className="mt-3 space-y-3" data-testid="probe-system-content">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="border border-border/30 bg-muted/5">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-xs font-semibold flex items-center gap-2"><Server className="h-3.5 w-3.5 text-muted-foreground" /> System Information</h3>
                {[
                  { label: "Hostname", value: probe.hostname },
                  { label: "IP Address", value: probe.ipAddress },
                  { label: "Operating System", value: probe.osInfo },
                  { label: "Probe Version", value: probe.probeVersion ? `v${probe.probeVersion}` : null },
                  { label: "Deployment Type", value: probe.deploymentType },
                  { label: "Enrolled IP", value: (probe as any).enrolledIp },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-right truncate max-w-[180px]" data-testid={`probe-sys-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>{item.value || "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-border/30 bg-muted/5">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-xs font-semibold flex items-center gap-2"><Radar className="h-3.5 w-3.5 text-muted-foreground" /> Probe Configuration</h3>
                {[
                  { label: "Protocol", value: proto.label },
                  { label: "Scan Subnet", value: probe.scanSubnet },
                  { label: "Heartbeat Interval", value: `${probe.heartbeatInterval || 60}s` },
                  { label: "Scan Schedule", value: probe.scanSchedule },
                  { label: "Status", value: probe.status },
                  { label: "Discovered Assets", value: String(probe.discoveredCount) },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-right truncate max-w-[180px]">{item.value || "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-border/30 bg-muted/5">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-xs font-semibold flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground" /> Timestamps</h3>
                {[
                  { label: "Enrolled At", value: probe.enrolledAt ? new Date(probe.enrolledAt).toLocaleString() : null },
                  { label: "Last Heartbeat", value: probe.lastHeartbeat ? new Date(probe.lastHeartbeat).toLocaleString() : null },
                  { label: "Last Scan", value: probe.lastScanAt ? new Date(probe.lastScanAt).toLocaleString() : null },
                  { label: "Token Expires", value: (probe as any).tokenExpiresAt ? new Date((probe as any).tokenExpiresAt).toLocaleString() : null },
                  { label: "Created", value: probe.createdAt ? new Date(probe.createdAt).toLocaleString() : null },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-right truncate max-w-[180px]">{item.value || "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-border/30 bg-muted/5">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-xs font-semibold flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-muted-foreground" /> Security</h3>
                {[
                  { label: "HMAC Signing", value: (probe as any).hmacSecret ? "Configured" : "Not Set" },
                  { label: "Token Status", value: (probe as any).tokenExpiresAt ? (new Date((probe as any).tokenExpiresAt) > new Date() ? "Valid" : "Expired") : "No Token" },
                  { label: "IP Binding", value: (probe as any).enrolledIp || "Not Bound" },
                  { label: "Enrollment", value: probe.enrolled ? "Enrolled" : "Pending" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`font-medium ${item.value === "Configured" || item.value === "Valid" || item.value === "Enrolled" ? "text-green-400" : item.value === "Expired" ? "text-red-400" : ""}`}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="credentials" className="mt-3" data-testid="probe-credentials-tab">
          <ProbeCredentialsTab probeId={probe.id} />
        </TabsContent>

        <TabsContent value="cluster" className="mt-3" data-testid="probe-cluster-tab">
          <ProbeClusterTab probeId={probe.id} />
        </TabsContent>

        <TabsContent value="capabilities" className="mt-3" data-testid="probe-capabilities-tab">
          <ProbeCapabilitiesTab probe={probe} />
        </TabsContent>

        <TabsContent value="activity" className="mt-3" data-testid="probe-activity-tab">
          <ProbeActivityLogTab probeId={probe.id} />
        </TabsContent>

        <TabsContent value="media" className="mt-3" data-testid="probe-media-tab">
          <ProbeMediaAddonTab probe={probe} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProbeLiveFeedPanel({ probe }: { probe: DiscoveryProbe }) {
  const { toast } = useToast();
  const p = probe as any;
  const [wsStatus, setWsStatus] = useState<"offline" | "connecting" | "live">("offline");
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const wsProto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss" : "ws";
  const ingestUrl = p.siteToken
    ? `${wsProto}://${typeof window !== "undefined" ? window.location.host : ""}` +
      `/ws/probe-stream?type=ingest&siteToken=${p.siteToken}`
    : "(enroll probe first to get site token)";

  const connect = useCallback(async () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setWsStatus("connecting");
    try {
      const r = await apiRequest("POST", "/api/stream-viewer-token", { probeId: probe.id });
      const { token } = await r.json();
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        `${proto}://${window.location.host}/ws/probe-stream?type=view&token=${token}&probeId=${probe.id}`
      );
      wsRef.current = ws;

      ws.binaryType = "arraybuffer";

      ws.onmessage = (evt) => {
        if (typeof evt.data === "string") {
          const msg = JSON.parse(evt.data);
          if (msg.type === "stream_start") setWsStatus("live");
          if (msg.type === "stream_end") setWsStatus("offline");
        } else {
          setLastFrameAt(Date.now());
          if (wsStatus !== "live") setWsStatus("live");
          const blob = new Blob([evt.data], { type: "image/jpeg" });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) { URL.revokeObjectURL(url); return; }
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d")?.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }
      };
      ws.onclose = () => { setWsStatus("offline"); wsRef.current = null; };
      ws.onerror = () => { setWsStatus("offline"); };
    } catch (err: any) {
      setWsStatus("offline");
      toast({ title: "Could not open stream viewer", description: err.message, variant: "destructive" });
    }
  }, [probe.id, toast]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setWsStatus("offline");
  }, []);

  const copyUrl = () => {
    navigator.clipboard.writeText(ingestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-background">
      {/* Status bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            wsStatus === "live" ? "bg-emerald-500 animate-pulse" :
            wsStatus === "connecting" ? "bg-amber-400 animate-pulse" :
            "bg-muted-foreground/40"
          }`} />
          <p className="text-xs font-semibold">
            {wsStatus === "live" ? "LIVE" : wsStatus === "connecting" ? "Connecting…" : "No Active Stream"}
          </p>
          {lastFrameAt && wsStatus === "live" && (
            <span className="text-[10px] text-muted-foreground">
              Last frame {new Date(lastFrameAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {wsStatus === "offline" ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" data-testid="button-watch-live" onClick={connect}>
              <Play className="w-3 h-3 mr-1" /> Watch Live
            </Button>
          ) : wsStatus === "connecting" ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Waiting for probe…
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" data-testid="button-stop-stream" onClick={disconnect}>
              <Square className="w-3 h-3 mr-1" /> Stop
            </Button>
          )}
        </div>
      </div>

      {/* Canvas frame viewer */}
      <div className="relative bg-black rounded-md overflow-hidden" style={{ aspectRatio: "16/9" }}>
        <canvas ref={canvasRef} className="w-full h-full object-contain" data-testid="canvas-live-stream" />
        {wsStatus !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/50 select-none">
            <Video className="w-8 h-8" />
            <p className="text-xs">
              {wsStatus === "connecting" ? "Waiting for probe to start streaming…" : "No active stream — click Watch Live"}
            </p>
          </div>
        )}
      </div>

      {/* Probe ingest URL */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Probe Ingest WebSocket URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-[10px] bg-muted/50 rounded px-2 py-1.5 break-all font-mono leading-relaxed">
            {ingestUrl}
          </code>
          {p.siteToken && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0" data-testid="button-copy-ingest-url" onClick={copyUrl}>
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Point the probe's camera software to this WebSocket URL. The probe authenticates with its site token and sends binary MJPEG frames.
          The relay server forwards each frame to all connected dashboard viewers in real time.
        </p>
      </div>
    </div>
  );
}

function ProbeMediaAddonTab({ probe }: { probe: DiscoveryProbe }) {
  const { toast } = useToast();
  const p = probe as any;
  const isEnabled: boolean = p.mediaAddonEnabled ?? false;
  const config: any = p.mediaAddonConfig ?? {};
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [streamingMode, setStreamingMode] = useState<"live" | "batch">(config.streamingMode ?? "batch");
  const [autoParse, setAutoParse] = useState<boolean>(config.autoParse ?? true);
  const [maxResolution, setMaxResolution] = useState<string>(config.maxResolution ?? "original");

  const { data: mediaFiles = [], isLoading, refetch } = useQuery<ProbeMediaFile[]>({
    queryKey: ["/api/discovery-probes", probe.id, "media"],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/discovery-probes/${probe.id}/media`);
      return r.json();
    },
    enabled: isEnabled,
    refetchInterval: 5000,
  });

  const toggleMut = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await apiRequest("PATCH", `/api/discovery-probes/${probe.id}/media-addon`, {
        mediaAddonEnabled: enabled,
        mediaAddonConfig: { streamingMode, autoParse, maxResolution },
      });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes"] }),
    onError: () => toast({ title: "Failed to toggle add-on", variant: "destructive" }),
  });

  const saveCfgMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("PATCH", `/api/discovery-probes/${probe.id}/media-addon`, {
        mediaAddonConfig: { streamingMode, autoParse, maxResolution },
      });
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes"] }); toast({ title: "Configuration saved" }); },
    onError: () => toast({ title: "Failed to save config", variant: "destructive" }),
  });

  const parseMut = useMutation({
    mutationFn: async (fileId: string) => {
      const r = await apiRequest("POST", `/api/discovery-probes/${probe.id}/media/${fileId}/parse`);
      return r.json();
    },
    onSuccess: () => { refetch(); toast({ title: "AI analysis started" }); },
    onError: () => toast({ title: "Failed to start analysis", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (fileId: string) => {
      const r = await apiRequest("DELETE", `/api/discovery-probes/${probe.id}/media/${fileId}`);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes", probe.id, "media"] }); toast({ title: "File deleted" }); },
    onError: () => toast({ title: "Failed to delete file", variant: "destructive" }),
  });

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("streamingMode", streamingMode);
        const r = await fetch(`/api/discovery-probes/${probe.id}/media/upload`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!r.ok) throw new Error(await r.text());
      }
      await refetch();
      toast({ title: `${files.length} file${files.length > 1 ? "s" : ""} uploaded` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [probe.id, streamingMode, refetch, toast]);

  const fileTypeIcon: Record<string, React.ElementType> = {
    image: ImageIcon, video: Video, audio: Mic, text: FileText,
  };
  const fileTypeColor: Record<string, string> = {
    image: "text-violet-500", video: "text-blue-500", audio: "text-amber-500", text: "text-green-500",
  };
  const parseStatusColor: Record<string, string> = {
    pending: "text-muted-foreground", processing: "text-amber-500", complete: "text-emerald-500", failed: "text-red-500",
  };

  const fmtSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Add-on toggle header */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-500" />
          <div>
            <p className="text-sm font-semibold">Media Streaming Add-on</p>
            <p className="text-[10px] text-muted-foreground">Audio · Image · Video · Text ingestion + AI analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium ${isEnabled ? "text-emerald-500" : "text-muted-foreground"}`}>
            {isEnabled ? "ENABLED" : "DISABLED"}
          </span>
          <Switch
            checked={isEnabled}
            data-testid="toggle-media-addon"
            disabled={toggleMut.isPending}
            onCheckedChange={(v) => toggleMut.mutate(v)}
          />
        </div>
      </div>

      {!isEnabled ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
          <Package className="w-8 h-8 mx-auto text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Enable the add-on to start streaming and analysing media from this probe.</p>
          <p className="text-xs text-muted-foreground/60">Works over 5G (live mode) or station Wi-Fi/LAN (batch mode).</p>
        </div>
      ) : (
        <>
          {/* Configuration panel */}
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Configuration</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Streaming Mode</Label>
                <Select value={streamingMode} onValueChange={(v: any) => setStreamingMode(v)}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-streaming-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">
                      <div className="flex items-center gap-1.5"><Wifi className="w-3 h-3 text-emerald-500" /> Live (5G / low-latency)</div>
                    </SelectItem>
                    <SelectItem value="batch">
                      <div className="flex items-center gap-1.5"><WifiOff className="w-3 h-3 text-blue-500" /> Batch (station sync)</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Resolution</Label>
                <Select value={maxResolution} onValueChange={setMaxResolution}>
                  <SelectTrigger className="h-8 text-xs" data-testid="select-max-resolution">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["original", "4K", "1080p", "720p", "480p"].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Auto-parse on Upload</Label>
                <div className="flex items-center gap-2 h-8">
                  <Switch checked={autoParse} data-testid="toggle-auto-parse" onCheckedChange={setAutoParse} />
                  <span className="text-xs text-muted-foreground">{autoParse ? "On" : "Off"}</span>
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" className="text-xs h-7" data-testid="button-save-media-config" onClick={() => saveCfgMut.mutate()} disabled={saveCfgMut.isPending}>
              {saveCfgMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Save Config
            </Button>
          </div>

          {/* Live feed viewer — only shown in live mode */}
          {streamingMode === "live" && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Feed</p>
              <ProbeLiveFeedPanel probe={probe} />
            </div>
          )}

          {/* Upload zone */}
          <div
            className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${dragging ? "border-violet-400 bg-violet-50 dark:bg-violet-950/20" : "border-border hover:border-violet-300"}`}
            data-testid="upload-zone"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleUpload(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" multiple className="hidden" data-testid="input-media-file"
              accept="image/*,video/*,audio/*,text/*,.pdf,.log,.txt,.csv"
              onChange={(e) => handleUpload(e.target.files)} />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Drop files here or click to upload</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">Images · Video · Audio · Text/Log files · Up to 500 MB per file</p>
              </>
            )}
          </div>

          {/* Media file list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {mediaFiles.length} file{mediaFiles.length !== 1 ? "s" : ""} ingested
              </p>
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => refetch()}>
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading files…
              </div>
            ) : mediaFiles.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
                No media files yet. Upload files above or configure the probe to stream automatically.
              </div>
            ) : (
              <div className="space-y-2">
                {mediaFiles.map((file) => {
                  const Icon = fileTypeIcon[file.fileType] ?? FileText;
                  const iconColor = fileTypeColor[file.fileType] ?? "text-muted-foreground";
                  const parseResult = file.aiParseResult as any;
                  return (
                    <div key={file.id} data-testid={`row-media-${file.id}`} className="rounded-lg border p-3 space-y-2 bg-background">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.originalFilename}</p>
                            <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mt-0.5">
                              <span className="capitalize">{file.fileType}</span>
                              {file.fileSizeBytes && <span>{fmtSize(file.fileSizeBytes)}</span>}
                              <span className={`capitalize ${file.streamingMode === "live" ? "text-emerald-500" : "text-blue-500"}`}>
                                {file.streamingMode === "live" ? "● Live" : "⏳ Batch"}
                              </span>
                              <span className={`capitalize font-medium ${parseStatusColor[file.aiParseStatus ?? "pending"]}`}>
                                AI: {file.aiParseStatus}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {(file.aiParseStatus === "pending" || file.aiParseStatus === "failed") && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-violet-500"
                              data-testid={`button-parse-${file.id}`}
                              disabled={parseMut.isPending}
                              title="Run AI analysis"
                              onClick={() => parseMut.mutate(file.id)}>
                              <Sparkles className="w-3 h-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400"
                            data-testid={`button-delete-media-${file.id}`}
                            onClick={() => deleteMut.mutate(file.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* AI parse result */}
                      {file.aiParseStatus === "complete" && parseResult && (
                        <div className="rounded-md bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 p-2 space-y-1.5">
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                            <Sparkles className="w-3 h-3" /> AI Analysis
                          </div>
                          {parseResult.summary && (
                            <p className="text-xs text-foreground">{parseResult.summary}</p>
                          )}
                          {parseResult.detectedObjects?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground">Detected objects</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {parseResult.detectedObjects.map((obj: string, i: number) => (
                                  <span key={i} className="inline-flex px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px]">{obj}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {parseResult.keyFindings?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground">Key findings</p>
                              <ul className="text-xs space-y-0.5 mt-0.5">
                                {parseResult.keyFindings.map((f: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1"><Check className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />{f}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {parseResult.anomalies?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-amber-600">Anomalies</p>
                              <ul className="text-xs space-y-0.5 mt-0.5">
                                {parseResult.anomalies.map((a: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1 text-amber-700 dark:text-amber-400"><AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {parseResult.recommendations?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground">Recommendations</p>
                              <ul className="text-xs space-y-0.5 mt-0.5">
                                {parseResult.recommendations.map((r: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1 text-blue-600 dark:text-blue-400"><ArrowRight className="w-3 h-3 flex-shrink-0 mt-0.5" />{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {parseResult.confidence !== undefined && (
                            <p className="text-[10px] text-muted-foreground">Confidence: {Math.round(parseResult.confidence * 100)}%</p>
                          )}
                        </div>
                      )}

                      {file.aiParseStatus === "processing" && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-500">
                          <Loader2 className="w-3 h-3 animate-spin" /> AI analysis in progress…
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CredentialsSection({ credentials, deleteCred }: { credentials: DiscoveryCredential[]; deleteCred: ReturnType<typeof useMutation<void, Error, string>> }) {
  const [search, setSearch] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("all");
  const [page, setPage] = useState(0);

  const filtered = credentials.filter(c => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.host || "").toLowerCase().includes(search.toLowerCase());
    const matchesProto = protocolFilter === "all" || c.protocol === protocolFilter;
    return matchesSearch && matchesProto;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const usedProtocols = [...new Set(credentials.map(c => c.protocol))];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          Discovery Credentials
          <Badge variant="outline" className="text-[9px] ml-1">{credentials.length}</Badge>
        </h2>
        <AddCredentialDialog onCreated={() => {}} />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <Input
            placeholder="Search credentials..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-8 text-xs pl-7"
            data-testid="input-search-credentials"
          />
        </div>
        <Select value={protocolFilter} onValueChange={(v) => { setProtocolFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="filter-cred-protocol">
            <SelectValue placeholder="All Protocols" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Protocols</SelectItem>
            {usedProtocols.map(p => {
              const cfg = protocolConfig[p] || protocolConfig.http;
              return <SelectItem key={p} value={p}>{cfg.label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {filtered.length} of {credentials.length}
        </span>
      </div>

      <Card className="overflow-hidden border-border/40">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Protocol</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Host</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Auth</th>
                <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-8 text-xs">
                    {search || protocolFilter !== "all" ? "No credentials match your filter" : "No credentials configured yet"}
                  </td>
                </tr>
              )}
              {paged.map(cred => {
                const proto = protocolConfig[cred.protocol] || protocolConfig.http;
                const ProtoIcon = proto.icon;
                const st = statusBadge[cred.status] || statusBadge.configured;
                const StatusIcon = st.icon;
                return (
                  <tr key={cred.id} className="hover:bg-muted/20 transition-colors" data-testid={`credential-${cred.id}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded shrink-0 ${proto.color}`}>
                          <ProtoIcon className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-medium truncate max-w-[180px]" data-testid={`cred-name-${cred.id}`}>{cred.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[9px]">{proto.label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[9px] gap-1 ${st.color}`}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {cred.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground truncate max-w-[160px] inline-block">
                        {cred.host}{cred.port ? `:${cred.port}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground text-[10px]">
                        {[...authTypes, ...apiAuthTypes].find(a => a.value === cred.authType)?.label || cred.authType}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <EditCredentialDialog credential={cred} onUpdated={() => {}} />
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteCred.mutate(cred.id)} data-testid={`delete-cred-${cred.id}`}>
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/10">
            <span className="text-[10px] text-muted-foreground">
              Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                data-testid="cred-page-prev"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i}
                  size="icon"
                  variant={i === safePage ? "default" : "ghost"}
                  className="h-6 w-6 text-[10px]"
                  onClick={() => setPage(i)}
                  data-testid={`cred-page-${i}`}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
                data-testid="cred-page-next"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function ProbesSection({
  probes, credentials, aiAgents, scanProbe, deleteProbe, onSelectProbe,
}: {
  probes: DiscoveryProbe[];
  credentials: DiscoveryCredential[];
  aiAgents: { id: string; name: string }[];
  scanProbe: ReturnType<typeof useMutation<void, Error, string>>;
  deleteProbe: ReturnType<typeof useMutation<void, Error, string>>;
  onSelectProbe: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  const filtered = probes.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.scanSubnet || "").toLowerCase().includes(search.toLowerCase()) ||
      p.protocol.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const usedStatuses = [...new Set(probes.map(p => p.status))];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Radar className="h-4 w-4 text-muted-foreground" />
          Discovery Probes
          <Badge variant="outline" className="text-[9px] ml-1">{probes.length}</Badge>
        </h2>
        <AddProbeDialog credentials={credentials} agents={aiAgents} onCreated={() => {}} />
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <Input
            placeholder="Search probes..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="h-8 text-xs pl-7"
            data-testid="input-search-probes"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="filter-probe-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {usedStatuses.map(s => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {filtered.length} of {probes.length}
        </span>
      </div>

      <Card className="overflow-hidden border-border/40">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Protocol</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Subnet</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Credential</th>
                <th className="text-left px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Found</th>
                <th className="text-right px-3 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider w-[160px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-8 text-xs">
                    {search || statusFilter !== "all" ? "No probes match your filter" : "No probes configured yet"}
                  </td>
                </tr>
              )}
              {paged.map(probe => {
                const proto = protocolConfig[probe.protocol] || protocolConfig.http;
                const ProtoIcon = proto.icon;
                const st = probeStatusBadge[probe.status] || probeStatusBadge.idle;
                const StatusIcon = st.icon;
                const cred = credentials.find(c => c.id === probe.credentialId);
                const isScanning = probe.status === "scanning" || scanProbe.isPending;
                return (
                  <tr key={probe.id} className="hover:bg-muted/20 transition-colors" data-testid={`probe-${probe.id}`}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-7 w-7 items-center justify-center rounded shrink-0 ${proto.color}`}>
                          <ProtoIcon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium truncate block max-w-[160px]" data-testid={`probe-name-${probe.id}`}>{probe.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {probe.enrolled && (
                              <Badge variant="outline" className="text-[8px] gap-0.5 bg-blue-500/10 text-blue-400 border-blue-500/20 px-1 py-0">
                                <CheckCircle2 className="h-2 w-2" />
                                enrolled
                              </Badge>
                            )}
                            {probe.enrolled && (() => {
                              const hb = getHeartbeatStatus(probe);
                              return (
                                <Badge variant="outline" className={`text-[8px] gap-0.5 px-1 py-0 ${hb.color}`}>
                                  <span className={`h-1 w-1 rounded-full ${hb.dotColor} inline-block`} />
                                  {hb.label}
                                </Badge>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[9px]">{proto.label}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[9px] gap-1 ${st.color}`}>
                        <StatusIcon className={`h-2.5 w-2.5 ${probe.status === "scanning" ? "animate-spin" : ""}`} />
                        {probe.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground text-[10px]">{probe.scanSubnet || "—"}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-muted-foreground text-[10px] truncate max-w-[120px] inline-block">{cred?.name || "—"}</span>
                    </td>
                    <td className="px-3 py-2">
                      {probe.discoveredCount > 0 ? (
                        <Badge variant="outline" className="text-[9px] gap-1 bg-green-500/10 text-green-400 border-green-500/20">
                          {probe.discoveredCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => onSelectProbe(probe.id)}
                          data-testid={`view-probe-${probe.id}`}
                          title="Details"
                        >
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <DeployProbeDialog probe={probe} />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => scanProbe.mutate(probe.id)}
                          disabled={isScanning}
                          data-testid={`scan-probe-${probe.id}`}
                          title="Scan"
                        >
                          {isScanning ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <Play className="h-3 w-3 text-muted-foreground" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteProbe.mutate(probe.id)} data-testid={`delete-probe-${probe.id}`} title="Delete">
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/10">
            <span className="text-[10px] text-muted-foreground">
              Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                data-testid="probe-page-prev"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => (
                <Button
                  key={i}
                  size="icon"
                  variant={i === safePage ? "default" : "ghost"}
                  className="h-6 w-6 text-[10px]"
                  onClick={() => setPage(i)}
                  data-testid={`probe-page-${i}`}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage(safePage + 1)}
                data-testid="probe-page-next"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DiscoverDevicesDialog({ probes, credentials }: { probes: DiscoveryProbe[]; credentials: DiscoveryCredential[] }) {
  const [open, setOpen] = useState(false);
  const [selectedProbeIds, setSelectedProbeIds] = useState<string[]>([]);
  const [selectedCredentialIds, setSelectedCredentialIds] = useState<string[]>([]);
  const [targetInput, setTargetInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [probeSearch, setProbeSearch] = useState("");
  const [credSearch, setCredSearch] = useState("");
  const { toast } = useToast();

  const availableProbes = probes.filter(p => p.status !== "scanning");
  const filteredProbes = availableProbes.filter(p =>
    p.name.toLowerCase().includes(probeSearch.toLowerCase()) ||
    p.protocol.toLowerCase().includes(probeSearch.toLowerCase()) ||
    (p.scanSubnet || "").toLowerCase().includes(probeSearch.toLowerCase())
  );
  const filteredCreds = credentials.filter(c =>
    c.name.toLowerCase().includes(credSearch.toLowerCase()) ||
    c.protocol.toLowerCase().includes(credSearch.toLowerCase()) ||
    (c.host || "").toLowerCase().includes(credSearch.toLowerCase())
  );

  const toggleProbe = (id: string) => {
    setSelectedProbeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleCredential = (id: string) => {
    setSelectedCredentialIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAllProbes = () => {
    const ids = filteredProbes.map(p => p.id);
    const allSelected = ids.every(id => selectedProbeIds.includes(id));
    if (allSelected) {
      setSelectedProbeIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedProbeIds(prev => [...new Set([...prev, ...ids])]);
    }
  };
  const selectAllCredentials = () => {
    const ids = filteredCreds.map(c => c.id);
    const allSelected = ids.every(id => selectedCredentialIds.includes(id));
    if (allSelected) {
      setSelectedCredentialIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedCredentialIds(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const totalScans = selectedProbeIds.length * selectedCredentialIds.length;

  const handleStartDiscovery = async () => {
    setIsRunning(true);
    let started = 0;
    let failed = 0;
    for (const probeId of selectedProbeIds) {
      for (const credentialId of selectedCredentialIds) {
        try {
          await apiRequest("POST", `/api/discovery-probes/${probeId}/scan`, { credentialId, target: targetInput || undefined });
          started++;
        } catch {
          failed++;
        }
      }
    }
    setIsRunning(false);
    if (started > 0) {
      toast({
        title: `Discovery started`,
        description: `${started} scan${started > 1 ? "s" : ""} initiated${failed > 0 ? `, ${failed} skipped (already scanning)` : ""}`,
      });
    } else {
      toast({ title: "No scans started", description: "All selected probes may already be scanning.", variant: "destructive" });
    }
    setOpen(false);
    setSelectedProbeIds([]);
    setSelectedCredentialIds([]);
    setTargetInput("");
    setProbeSearch("");
    setCredSearch("");
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes"] });
    }, 4000);
  };

  const probeAllSelected = filteredProbes.length > 0 && filteredProbes.every(p => selectedProbeIds.includes(p.id));
  const credAllSelected = filteredCreds.length > 0 && filteredCreds.every(c => selectedCredentialIds.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-discover-devices">
          <Crosshair className="h-4 w-4" />
          Discover Devices
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0" aria-describedby="discover-devices-desc">
        <div className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crosshair className="h-5 w-5 text-primary" />
              Discover Devices
            </DialogTitle>
          </DialogHeader>
          <p id="discover-devices-desc" className="text-xs text-muted-foreground mt-1">
            Select probes and credentials, then start scanning for network devices.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Radar className="h-3.5 w-3.5 text-muted-foreground" />
                  Probes
                  <Badge variant="outline" className="text-[9px] ml-1 px-1.5 py-0">{selectedProbeIds.length}/{availableProbes.length}</Badge>
                </Label>
                <button
                  type="button"
                  className="text-[10px] text-primary hover:underline"
                  onClick={selectAllProbes}
                  data-testid="button-select-all-probes"
                >
                  {probeAllSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <Input
                  placeholder="Filter probes..."
                  value={probeSearch}
                  onChange={(e) => setProbeSearch(e.target.value)}
                  className="h-7 text-[11px] pl-7"
                  data-testid="input-filter-probes"
                />
              </div>
              <div className="h-[220px] overflow-y-auto rounded-md border border-border/50 divide-y divide-border/20 bg-muted/5">
                {filteredProbes.length === 0 && (
                  <p className="text-[10px] text-muted-foreground p-4 text-center">
                    {probeSearch ? "No probes match your filter" : "No probes available"}
                  </p>
                )}
                {filteredProbes.map(p => {
                  const proto = protocolConfig[p.protocol] || protocolConfig.http;
                  const ProtoIcon = proto.icon;
                  const selected = selectedProbeIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/40 ${selected ? "bg-primary/5" : ""}`}
                      onClick={() => toggleProbe(p.id)}
                      data-testid={`toggle-probe-${p.id}`}
                    >
                      <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-primary border-primary" : "border-border/60"}`}>
                        {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <div className={`flex h-5 w-5 items-center justify-center rounded shrink-0 ${proto.color}`}>
                        <ProtoIcon className="h-2.5 w-2.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate leading-tight">{p.name}</p>
                        <p className="text-[9px] text-muted-foreground truncate leading-tight">{proto.label} · {p.scanSubnet || "No subnet"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-muted-foreground" />
                  Credentials
                  <Badge variant="outline" className="text-[9px] ml-1 px-1.5 py-0">{selectedCredentialIds.length}/{credentials.length}</Badge>
                </Label>
                <button
                  type="button"
                  className="text-[10px] text-primary hover:underline"
                  onClick={selectAllCredentials}
                  data-testid="button-select-all-credentials"
                >
                  {credAllSelected ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
                <Input
                  placeholder="Filter credentials..."
                  value={credSearch}
                  onChange={(e) => setCredSearch(e.target.value)}
                  className="h-7 text-[11px] pl-7"
                  data-testid="input-filter-credentials"
                />
              </div>
              <div className="h-[220px] overflow-y-auto rounded-md border border-border/50 divide-y divide-border/20 bg-muted/5">
                {filteredCreds.length === 0 && (
                  <p className="text-[10px] text-muted-foreground p-4 text-center">
                    {credSearch ? "No credentials match your filter" : "No credentials available"}
                  </p>
                )}
                {filteredCreds.map(c => {
                  const proto = protocolConfig[c.protocol] || protocolConfig.http;
                  const ProtoIcon = proto.icon;
                  const selected = selectedCredentialIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/40 ${selected ? "bg-primary/5" : ""}`}
                      onClick={() => toggleCredential(c.id)}
                      data-testid={`toggle-cred-${c.id}`}
                    >
                      <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${selected ? "bg-primary border-primary" : "border-border/60"}`}>
                        {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <div className={`flex h-5 w-5 items-center justify-center rounded shrink-0 ${proto.color}`}>
                        <ProtoIcon className="h-2.5 w-2.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium truncate leading-tight">{c.name}</p>
                        <p className="text-[9px] text-muted-foreground truncate leading-tight">{proto.label} · {c.host || "No host"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border/40 shrink-0 space-y-3 bg-muted/5">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Target IP / Subnet</Label>
              <Input
                placeholder="e.g. 192.168.1.1 or 10.0.0.0/24"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                className="h-8 text-xs"
                data-testid="input-discover-target"
              />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0 pb-1">
              {totalScans > 0 ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] gap-1">
                    <Radar className="h-2.5 w-2.5" />
                    {selectedProbeIds.length}
                  </Badge>
                  <span>x</span>
                  <Badge variant="outline" className="text-[9px] gap-1">
                    <Key className="h-2.5 w-2.5" />
                    {selectedCredentialIds.length}
                  </Badge>
                  <span>=</span>
                  <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                    {totalScans} scan{totalScans !== 1 ? "s" : ""}
                  </Badge>
                </div>
              ) : (
                <span>Select probes and credentials above</span>
              )}
            </div>
          </div>
          <Button
            className="w-full gap-2"
            disabled={totalScans === 0 || isRunning}
            onClick={handleStartDiscovery}
            data-testid="button-start-discovery"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {isRunning ? "Starting Scans..." : `Start Discovery${totalScans > 0 ? ` (${totalScans} scan${totalScans !== 1 ? "s" : ""})` : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function NetworkOpsDiscovery() {
  const { toast } = useToast();
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);

  const { data: credentials, isLoading: credsLoading } = useQuery<DiscoveryCredential[]>({
    queryKey: ["/api/discovery-credentials"],
  });

  const { data: probes, isLoading: probesLoading } = useQuery<DiscoveryProbe[]>({
    queryKey: ["/api/discovery-probes"],
    refetchInterval: 15000,
  });

  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });

  const aiAgents = useMemo(() => {
    if (!roles || !subscriptions) return [];
    return subscriptions
      .filter(s => s.hasAiShadow)
      .map(s => {
        const role = roles.find(r => r.id === s.roleId);
        return role ? { id: role.id, name: role.name } : null;
      })
      .filter(Boolean) as { id: string; name: string }[];
  }, [roles, subscriptions]);

  const deleteCred = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/discovery-credentials/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-credentials"] });
      toast({ title: "Credential deleted" });
    },
  });

  const deleteProbe = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/discovery-probes/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes"] });
      toast({ title: "Probe deleted" });
    },
  });

  const scanProbe = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/discovery-probes/${id}/scan`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Scan initiated", description: "Discovery scan is running..." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/discovery-probes"] });
      }, 4000);
    },
  });

  const credsByProtocol = useMemo(() => {
    const map = new Map<string, number>();
    credentials?.forEach(c => map.set(c.protocol, (map.get(c.protocol) || 0) + 1));
    return map;
  }, [credentials]);

  const verifiedCount = credentials?.filter(c => c.status === "verified").length ?? 0;

  const selectedProbe = selectedProbeId ? probes?.find(p => p.id === selectedProbeId) : null;
  const selectedProbeAgent = selectedProbe?.assignedAgentRoleId ? aiAgents.find(a => a.id === selectedProbe.assignedAgentRoleId) : null;

  if (selectedProbe) {
    return (
      <ScrollArea className="h-full">
        <div className="p-6 max-w-6xl mx-auto">
          <ProbeDetailPanel
            probe={selectedProbe}
            agentName={selectedProbeAgent?.name}
            onClose={() => setSelectedProbeId(null)}
          />
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <div />
          <DiscoverDevicesDialog probes={probes || []} credentials={credentials || []} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Key className="h-4 w-4 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Credentials</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-credentials-total">{credentials?.length ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{verifiedCount} verified</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Radar className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Probes</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-probes-total">{probes?.length ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{probes?.filter(p => p.status === "completed").length ?? 0} completed</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Network className="h-4 w-4 text-green-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Protocols</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-protocols-used">{credsByProtocol.size}</p>
              <p className="text-[10px] text-muted-foreground">{Object.keys(protocolConfig).length} supported</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Search className="h-4 w-4 text-amber-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Discovered</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-discovered-total">{probes?.reduce((s, p) => s + p.discoveredCount, 0) ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">total assets found</p>
            </CardContent>
          </Card>
        </div>

        <CredentialsSection credentials={credentials || []} deleteCred={deleteCred} />

        {probes && probes.length > 0 && <ProbeFleetHealth probes={probes} onSelectProbe={setSelectedProbeId} />}

        <ProbesSection
          probes={probes || []}
          credentials={credentials || []}
          aiAgents={aiAgents}
          scanProbe={scanProbe}
          deleteProbe={deleteProbe}
          onSelectProbe={setSelectedProbeId}
        />
      </div>
    </ScrollArea>
  );
}
