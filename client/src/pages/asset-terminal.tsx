import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { DiscoveredAsset } from "@shared/schema";
import {
  Terminal, Server, Loader2, Trash2, Copy, Play,
  XCircle, Maximize2, Minimize2, AlertTriangle, Wifi, WifiOff, Plus,
  Circle, RefreshCw
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface TerminalEntry {
  id: string;
  type: "input" | "output" | "error" | "system" | "warn";
  content: string;
  timestamp: Date;
}

interface AssetTab {
  assetId: string;
  label: string;
  ipAddress: string;
  hostname: string;
  os: string;
  probeId: string | null;
  status: string;
  scriptType: string;
  entries: TerminalEntry[];
  wsState: "connecting" | "ready" | "error" | "closed" | "noprobe";
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function detectScriptType(os: string): string {
  const o = (os || "").toLowerCase();
  if (o.includes("windows") || o.includes("win")) return "powershell";
  if (o.includes("android") || o.includes("termux")) return "sh";
  return "bash";
}
function osLabel(os: string): string {
  const o = (os || "").toLowerCase();
  if (o.includes("windows")) return "PowerShell";
  if (o.includes("android") || o.includes("termux")) return "Termux";
  if (o.includes("mac")) return "zsh";
  return "bash";
}
function makePrompt(label: string, scriptType: string): string {
  if (scriptType === "powershell") return `PS ${label}> `;
  if (scriptType === "sh") return `$ `;
  return `${label}:~$ `;
}
function uid() { return Math.random().toString(36).slice(2); }

// ── WebSocket terminal hook ────────────────────────────────────────────────────
function useTerminalWS(params: {
  assetId: string;
  probeId: string | null;
  scriptType: string;
  onStateChange: (state: AssetTab["wsState"]) => void;
  onEntry: (entry: Omit<TerminalEntry, "id">) => void;
}) {
  const { assetId, probeId, scriptType, onStateChange, onEntry } = params;
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const stop = useCallback(() => {
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!probeId) {
      onStateChange("noprobe");
      return;
    }
    stop();
    onStateChange("connecting");

    // Fetch a short-lived token
    let token: string;
    try {
      const r = await apiRequest("POST", "/api/terminal-token", {});
      const data = await r.json();
      if (!data.token) throw new Error("No token");
      token = data.token;
    } catch {
      if (mountedRef.current) {
        onEntry({ type: "error", content: "Failed to obtain terminal auth token", timestamp: new Date() });
        onStateChange("error");
      }
      return;
    }

    if (!mountedRef.current) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/terminal?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "init", assetId, probeId, scriptType }));
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 20000);
    };

    ws.onmessage = (ev) => {
      if (!mountedRef.current) return;
      let msg: any;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === "ready") { onStateChange("ready"); return; }
      if (msg.type === "pong") return;
      if (msg.type === "data") {
        onEntry({ type: "output", content: (msg.data || "").replace(/\r\n/g, "\n").trimEnd(), timestamp: new Date() });
      } else if (msg.type === "error") {
        onEntry({ type: "error", content: (msg.data || "error").replace(/\r\n/g, "\n").trimEnd(), timestamp: new Date() });
      } else if (msg.type === "system-note") {
        onEntry({ type: "system", content: (msg.data || "").replace(/\r\n/g, "\n").trimEnd(), timestamp: new Date() });
      }
    };

    ws.onerror = () => {
      if (mountedRef.current) {
        onEntry({ type: "error", content: "WebSocket connection error", timestamp: new Date() });
        onStateChange("error");
      }
    };

    ws.onclose = (ev) => {
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      if (mountedRef.current && ev.code !== 1000) {
        onEntry({ type: "warn", content: `Connection closed (${ev.code})`, timestamp: new Date() });
        onStateChange("closed");
      }
    };
  }, [assetId, probeId, scriptType, onStateChange, onEntry, stop]);

  const sendCommand = useCallback((cmd: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    wsRef.current.send(JSON.stringify({ type: "command", data: cmd }));
    return true;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      stop();
    };
  }, []); // only on mount

  return { connect, sendCommand, stop };
}

// ── Terminal Session UI ────────────────────────────────────────────────────────
function TerminalSession({
  tab, isActive,
  onUpdate, onSetWsState, onAddEntry,
}: {
  tab: AssetTab;
  isActive: boolean;
  onUpdate: (id: string, u: Partial<AssetTab>) => void;
  onSetWsState: (id: string, s: AssetTab["wsState"]) => void;
  onAddEntry: (id: string, e: Omit<TerminalEntry, "id">) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [histIdx, setHistIdx] = useState(-1);
  const [waiting, setWaiting] = useState(false);
  const commandHistory = useMemo(
    () => tab.entries.filter(e => e.type === "input").map(e => e.content).reverse(),
    [tab.entries]
  );

  const stableOnSetWsState = useCallback((s: AssetTab["wsState"]) => onSetWsState(tab.assetId, s), [tab.assetId, onSetWsState]);
  const stableOnAddEntry = useCallback((e: Omit<TerminalEntry, "id">) => {
    onAddEntry(tab.assetId, e);
    setWaiting(false);
  }, [tab.assetId, onAddEntry]);

  const { connect, sendCommand } = useTerminalWS({
    assetId: tab.assetId,
    probeId: tab.probeId,
    scriptType: tab.scriptType,
    onStateChange: stableOnSetWsState,
    onEntry: stableOnAddEntry,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [tab.entries]);

  useEffect(() => {
    if (isActive && inputRef.current) inputRef.current.focus();
  }, [isActive]);

  const execute = useCallback((cmd: string) => {
    if (!cmd.trim()) return;

    // Built-ins
    if (cmd.trim() === "clear") {
      onUpdate(tab.assetId, { entries: [{ id: uid(), type: "system", content: "Terminal cleared.", timestamp: new Date() }] });
      return;
    }
    if (cmd.trim() === "help") {
      onAddEntry(tab.assetId, { type: "system", content: "Built-ins: clear, help\nAll other commands are dispatched to the remote asset via its enrolled probe.", timestamp: new Date() });
      return;
    }

    onAddEntry(tab.assetId, { type: "input", content: cmd, timestamp: new Date() });

    if (tab.wsState === "noprobe") {
      onAddEntry(tab.assetId, { type: "error", content: `Cannot dispatch: no probe enrolled for ${tab.label}.\nEnroll a HOLOCRON probe to enable remote command execution.`, timestamp: new Date() });
      return;
    }
    if (tab.wsState !== "ready") {
      onAddEntry(tab.assetId, { type: "warn", content: `Terminal ${tab.wsState} — try reconnecting.`, timestamp: new Date() });
      return;
    }

    const sent = sendCommand(cmd);
    if (sent) {
      setWaiting(true);
    } else {
      onAddEntry(tab.assetId, { type: "error", content: "WebSocket not connected — click Reconnect.", timestamp: new Date() });
    }
  }, [tab, sendCommand, onUpdate, onAddEntry]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const cmd = inputValue;
      setInputValue("");
      setHistIdx(-1);
      execute(cmd);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIdx = Math.min(histIdx + 1, commandHistory.length - 1);
      setHistIdx(newIdx);
      if (commandHistory[newIdx]) setInputValue(commandHistory[newIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIdx = Math.max(histIdx - 1, -1);
      setHistIdx(newIdx);
      setInputValue(newIdx === -1 ? "" : commandHistory[newIdx] || "");
    }
  };

  const prompt = makePrompt(tab.hostname || tab.ipAddress || tab.label, tab.scriptType);
  const hasProbe = !!tab.probeId;
  const isReady = tab.wsState === "ready";

  return (
    <div
      className="flex flex-col h-full font-mono text-xs"
      style={{ background: "#0d1117" }}
      onClick={() => inputRef.current?.focus()}
      data-testid={`terminal-session-${tab.assetId}`}
    >
      {/* Status banners */}
      {!hasProbe && (
        <div className="flex items-center gap-2 px-3 py-1.5 shrink-0"
          style={{ background: "rgba(234,179,8,0.08)", borderBottom: "1px solid rgba(234,179,8,0.2)" }}>
          <AlertTriangle className="h-3 w-3 text-yellow-400 shrink-0" />
          <span className="text-[10px] text-yellow-400/80">No probe enrolled — commands cannot be dispatched</span>
        </div>
      )}
      {hasProbe && tab.wsState === "connecting" && (
        <div className="flex items-center gap-2 px-3 py-1 shrink-0"
          style={{ background: "rgba(99,102,241,0.08)", borderBottom: "1px solid rgba(99,102,241,0.2)" }}>
          <Loader2 className="h-3 w-3 text-indigo-400 animate-spin" />
          <span className="text-[10px] text-indigo-400/80">Establishing WebSocket connection...</span>
        </div>
      )}
      {hasProbe && (tab.wsState === "error" || tab.wsState === "closed") && (
        <div className="flex items-center gap-2 px-3 py-1 shrink-0"
          style={{ background: "rgba(248,81,73,0.08)", borderBottom: "1px solid rgba(248,81,73,0.2)" }}>
          <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
          <span className="text-[10px] text-red-400/80">Connection lost</span>
          <button className="ml-1 text-[10px] text-red-400 underline" onClick={() => connect()}>Reconnect</button>
        </div>
      )}

      {/* Output area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {tab.entries.map(entry => (
          <div key={entry.id} className="leading-relaxed">
            {entry.type === "input" && (
              <div className="flex items-start gap-0">
                <span style={{ color: isReady ? "#39d353" : "#6b7280" }}>{prompt}</span>
                <span style={{ color: "#e6edf3" }}>{entry.content}</span>
              </div>
            )}
            {entry.type === "output" && (
              <pre className="whitespace-pre-wrap break-all" style={{ color: "#e6edf3", fontFamily: "inherit" }}>{entry.content}</pre>
            )}
            {entry.type === "error" && (
              <pre className="whitespace-pre-wrap break-all" style={{ color: "#f85149", fontFamily: "inherit" }}>{entry.content}</pre>
            )}
            {entry.type === "warn" && (
              <pre className="whitespace-pre-wrap break-all" style={{ color: "#e3b341", fontFamily: "inherit" }}>{entry.content}</pre>
            )}
            {entry.type === "system" && (
              <div style={{ color: "#8b949e" }} className="italic">{entry.content}</div>
            )}
          </div>
        ))}
        {/* Waiting indicator */}
        {waiting && (
          <div className="flex items-center gap-1.5 py-0.5" style={{ color: "#8b949e" }}>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Waiting for probe response...</span>
          </div>
        )}
      </div>

      {/* Input line */}
      <div className="flex items-center px-3 py-2 border-t shrink-0"
        style={{ borderColor: "#21262d", background: "#0d1117" }}>
        <span style={{ color: isReady ? "#39d353" : hasProbe ? "#e3b341" : "#4b5563" }}>{prompt}</span>
        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={waiting}
          className="flex-1 bg-transparent outline-none border-none disabled:opacity-40"
          style={{ color: "#e6edf3", caretColor: "#e6edf3", fontFamily: "inherit", fontSize: "inherit" }}
          placeholder={!hasProbe ? "no probe enrolled" : tab.wsState !== "ready" ? tab.wsState + "..." : ""}
          spellCheck={false}
          autoComplete="off"
          data-testid={`terminal-input-${tab.assetId}`}
        />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AssetTerminal() {
  const { toast } = useToast();
  const [tabs, setTabs] = useState<AssetTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [manualIp, setManualIp] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const { data: assets = [], isLoading } = useQuery<DiscoveredAsset[]>({
    queryKey: ["/api/discovered-assets"],
  });

  const probeAssets = assets.filter(a => a.probeId);
  const noProbeAssets = assets.filter(a => !a.probeId);

  const makeTab = (opts: {
    assetId: string; label: string; ipAddress: string; hostname: string;
    os: string; probeId: string | null; status: string;
  }): AssetTab => ({
    ...opts,
    scriptType: detectScriptType(opts.os),
    wsState: opts.probeId ? "connecting" : "noprobe",
    entries: [{
      id: uid(),
      type: opts.probeId ? "system" : "warn",
      content: opts.probeId
        ? `Remote terminal — ${opts.hostname || opts.ipAddress} · ${osLabel(opts.os)}\nProbe: ${opts.probeId.slice(0, 8)} · WebSocket connecting...\nType 'help' for built-ins. Use ↑↓ for history.`
        : `Session opened for ${opts.hostname || opts.ipAddress || opts.assetId}\nNo probe enrolled — remote commands cannot be dispatched.\nInstall a HOLOCRON probe on this host to enable execution.`,
      timestamp: new Date(),
    }],
  });

  const openTabFromAsset = (asset: DiscoveredAsset) => {
    const existing = tabs.find(t => t.assetId === asset.id);
    if (existing) { setActiveTabId(asset.id); setSelectedAssetId(""); return; }
    const tab = makeTab({ assetId: asset.id, label: asset.hostname || asset.ipAddress || asset.id, ipAddress: asset.ipAddress || "", hostname: asset.hostname || "", os: asset.operatingSystem || "", probeId: asset.probeId || null, status: asset.status || "unknown" });
    setTabs(prev => [...prev, tab]);
    setActiveTabId(asset.id);
    setSelectedAssetId("");
  };

  const openTabFromIp = (ip: string) => {
    const ip_clean = ip.trim();
    if (!ip_clean) return;
    const match = assets.find(a => a.ipAddress === ip_clean || a.hostname === ip_clean);
    if (match) { openTabFromAsset(match); setManualIp(""); return; }
    const fakeId = `manual:${ip_clean}`;
    const existing = tabs.find(t => t.assetId === fakeId);
    if (existing) { setActiveTabId(fakeId); setManualIp(""); return; }
    const tab = makeTab({ assetId: fakeId, label: ip_clean, ipAddress: ip_clean, hostname: ip_clean, os: "", probeId: null, status: "unknown" });
    setTabs(prev => [...prev, tab]);
    setActiveTabId(fakeId);
    setManualIp("");
    setShowManual(false);
  };

  const closeTab = (assetId: string) => {
    setTabs(prev => prev.filter(t => t.assetId !== assetId));
    if (activeTabId === assetId) {
      const remaining = tabs.filter(t => t.assetId !== assetId);
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].assetId : null);
    }
  };

  const updateTab = useCallback((assetId: string, updates: Partial<AssetTab>) => {
    setTabs(prev => prev.map(t => t.assetId === assetId ? { ...t, ...updates } : t));
  }, []);

  const setWsState = useCallback((assetId: string, wsState: AssetTab["wsState"]) => {
    setTabs(prev => prev.map(t => t.assetId === assetId ? { ...t, wsState } : t));
  }, []);

  const addEntry = useCallback((assetId: string, entry: Omit<TerminalEntry, "id">) => {
    setTabs(prev => prev.map(t => t.assetId === assetId
      ? { ...t, entries: [...t.entries, { ...entry, id: uid() }] }
      : t
    ));
  }, []);

  const clearTab = (assetId: string) => {
    updateTab(assetId, { entries: [{ id: uid(), type: "system", content: "Terminal cleared.", timestamp: new Date() }] });
  };

  const copyOutput = (assetId: string) => {
    const tab = tabs.find(t => t.assetId === assetId);
    if (!tab) return;
    const text = tab.entries.map(e =>
      e.type === "input" ? `${makePrompt(tab.hostname || tab.ipAddress || tab.label, tab.scriptType)}${e.content}` : e.content
    ).join("\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Terminal output copied to clipboard" });
  };

  const activeTab = tabs.find(t => t.assetId === activeTabId);

  // WS state → dot color
  const wsDot = (s: AssetTab["wsState"]) => {
    if (s === "ready") return "bg-green-400 animate-pulse";
    if (s === "connecting") return "bg-yellow-400 animate-pulse";
    if (s === "noprobe") return "bg-muted-foreground/30";
    return "bg-red-400";
  };

  return (
    <div className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-background" : "h-full"}`}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 bg-background/80 shrink-0 flex-wrap gap-y-1.5">
        <div className="flex items-center gap-2 shrink-0">
          <Terminal className="h-4 w-4 text-green-400" />
          <span className="text-sm font-semibold">Asset Terminal</span>
          <Badge className="text-[10px] bg-muted border-border">{tabs.length} session{tabs.length !== 1 ? "s" : ""}</Badge>
          <Badge className="text-[10px] bg-green-500/10 border-green-500/20 text-green-400 gap-1">
            <Circle className="h-1.5 w-1.5 fill-current" /> WebSocket
          </Badge>
        </div>

        <div className="flex-1" />

        {showManual ? (
          <div className="flex items-center gap-1">
            <Input className="h-7 text-xs w-48 font-mono" placeholder="IP or hostname..." value={manualIp}
              onChange={e => setManualIp(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") openTabFromIp(manualIp); if (e.key === "Escape") setShowManual(false); }}
              autoFocus data-testid="input-manual-ip" />
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => openTabFromIp(manualIp)} disabled={!manualIp.trim()} data-testid="button-manual-connect">
              <Play className="h-3 w-3" />Open
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowManual(false)}>Cancel</Button>
          </div>
        ) : (
          <>
            <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
              <SelectTrigger className="h-7 text-xs w-56" data-testid="select-terminal-asset">
                <SelectValue placeholder="Select asset..." />
              </SelectTrigger>
              <SelectContent>
                {isLoading && <SelectItem value="loading" disabled>Loading...</SelectItem>}
                {probeAssets.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[10px] flex items-center gap-1.5">
                      <Wifi className="h-3 w-3 text-green-400" /> Probe enrolled ({probeAssets.length})
                    </SelectLabel>
                    {probeAssets.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${a.status === "online" ? "bg-green-400" : "bg-yellow-400"}`} />
                          <span className="font-mono font-medium">{a.hostname || a.ipAddress}</span>
                          {a.ipAddress && a.hostname && <span className="text-muted-foreground text-[10px] font-mono">{a.ipAddress}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {noProbeAssets.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[10px] flex items-center gap-1.5">
                      <WifiOff className="h-3 w-3 text-muted-foreground" /> No probe ({noProbeAssets.length})
                    </SelectLabel>
                    {noProbeAssets.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/40" />
                          <span className="font-mono text-muted-foreground">{a.hostname || a.ipAddress}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {assets.length === 0 && !isLoading && <SelectItem value="none" disabled>No assets</SelectItem>}
              </SelectContent>
            </Select>

            <Button size="sm" className="h-7 text-xs gap-1.5" disabled={!selectedAssetId}
              onClick={() => { const a = assets.find(x => x.id === selectedAssetId); if (a) openTabFromAsset(a); }}
              data-testid="button-terminal-connect">
              <Play className="h-3 w-3" />Connect
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowManual(true)} data-testid="button-manual-ip-open">
                  <Plus className="h-3 w-3" />IP
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Open terminal by IP / hostname</TooltipContent>
            </Tooltip>
          </>
        )}

        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsFullscreen(f => !f)} data-testid="button-terminal-fullscreen">
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-0.5 px-2 pt-1.5 border-b border-border/50 bg-background/60 shrink-0 overflow-x-auto">
          {tabs.map(tab => {
            const isActive = tab.assetId === activeTabId;
            return (
              <div key={tab.assetId}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-t-md text-xs cursor-pointer select-none transition-colors shrink-0 ${
                  isActive ? "bg-[#0d1117] text-white border-t border-l border-r border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
                onClick={() => setActiveTabId(tab.assetId)}
                data-testid={`tab-terminal-${tab.assetId}`}>
                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${wsDot(tab.wsState)}`} />
                <Server className="h-3 w-3" />
                <span className="max-w-[130px] truncate font-mono">{tab.hostname || tab.ipAddress || tab.label}</span>
                {tab.ipAddress && tab.hostname && tab.ipAddress !== tab.hostname && (
                  <span className="text-[10px] opacity-50 font-mono">{tab.ipAddress}</span>
                )}
                <button className="ml-0.5 opacity-40 hover:opacity-100 hover:text-red-400 transition-opacity"
                  onClick={e => { e.stopPropagation(); closeTab(tab.assetId); }}
                  data-testid={`button-close-tab-${tab.assetId}`}>
                  <XCircle className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Terminal area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {tabs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5" style={{ background: "#0d1117" }}>
            <div className="text-center space-y-2">
              <Terminal className="h-12 w-12 mx-auto text-green-400/30" />
              <h3 className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>No Active Sessions</h3>
              <p className="text-xs max-w-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                Select an asset or enter an IP to open a real-time WebSocket terminal session.
              </p>
            </div>
            {probeAssets.length > 0 && (
              <div className="space-y-2 w-full max-w-md px-4">
                <p className="text-[10px] font-mono text-center" style={{ color: "rgba(255,255,255,0.2)" }}>PROBE-ENROLLED — click to connect</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {probeAssets.slice(0, 8).map(a => (
                    <Button key={a.id} size="sm" variant="outline"
                      className="h-7 text-xs gap-1.5 border-border/30 bg-transparent font-mono"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                      onClick={() => openTabFromAsset(a)} data-testid={`button-quick-connect-${a.id}`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${a.status === "online" ? "bg-green-400" : "bg-yellow-400"}`} />
                      {a.hostname || a.ipAddress}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {noProbeAssets.length > 0 && (
              <div className="space-y-2 w-full max-w-md px-4">
                <p className="text-[10px] font-mono text-center" style={{ color: "rgba(255,255,255,0.15)" }}>INVENTORY — no probe enrolled</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {noProbeAssets.slice(0, 6).map(a => (
                    <Button key={a.id} size="sm" variant="outline"
                      className="h-7 text-xs gap-1.5 border-border/20 bg-transparent font-mono"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                      onClick={() => openTabFromAsset(a)} data-testid={`button-quick-connect-noprobe-${a.id}`}>
                      <AlertTriangle className="h-2.5 w-2.5 text-yellow-500/50" />
                      {a.hostname || a.ipAddress}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input className="h-7 text-xs w-52 font-mono bg-transparent border-border/30"
                style={{ color: "rgba(255,255,255,0.5)" }}
                placeholder="Connect by IP / hostname..."
                value={manualIp} onChange={e => setManualIp(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") openTabFromIp(manualIp); }}
                data-testid="input-manual-ip-empty-state" />
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-border/30 bg-transparent"
                style={{ color: "rgba(255,255,255,0.4)" }} disabled={!manualIp.trim()}
                onClick={() => openTabFromIp(manualIp)} data-testid="button-manual-connect-empty-state">
                <Play className="h-3 w-3" />Open
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Active tab toolbar */}
            {activeTab && (
              <div className="flex items-center gap-2 px-3 py-1.5 border-b shrink-0"
                style={{ background: "#161b22", borderColor: "#21262d" }}>
                <div className="flex items-center gap-2 text-xs flex-1 min-w-0">
                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${wsDot(activeTab.wsState)}`} />
                  <span className="text-white/70 font-medium font-mono truncate">{activeTab.hostname || activeTab.ipAddress || activeTab.label}</span>
                  {activeTab.ipAddress && activeTab.hostname && activeTab.ipAddress !== activeTab.hostname && (
                    <span className="text-white/40 font-mono text-[10px] shrink-0">{activeTab.ipAddress}</span>
                  )}
                  {activeTab.os && <Badge className="text-[10px] bg-white/5 border-white/10 text-white/50 shrink-0">{activeTab.os}</Badge>}
                  <Badge className={`text-[10px] shrink-0 ${
                    activeTab.wsState === "ready" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                    activeTab.wsState === "connecting" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" :
                    activeTab.wsState === "noprobe" ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-400/80" :
                    "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}>
                    {activeTab.wsState === "ready" ? "● connected" :
                     activeTab.wsState === "connecting" ? "○ connecting" :
                     activeTab.wsState === "noprobe" ? "⚠ no probe" : "✕ disconnected"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Select value={activeTab.scriptType} onValueChange={v => updateTab(activeTab.assetId, { scriptType: v })}>
                    <SelectTrigger className="h-6 text-[10px] w-28 bg-transparent border-white/10 text-white/60" data-testid="select-terminal-script-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bash">bash</SelectItem>
                      <SelectItem value="powershell">powershell</SelectItem>
                      <SelectItem value="sh">sh</SelectItem>
                      <SelectItem value="python">python</SelectItem>
                    </SelectContent>
                  </Select>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-white/40 hover:text-white"
                        onClick={() => copyOutput(activeTab.assetId)} data-testid="button-terminal-copy">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Copy output</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-white/40 hover:text-red-400"
                        onClick={() => clearTab(activeTab.assetId)} data-testid="button-terminal-clear">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Clear terminal</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            {/* Terminal sessions */}
            <div className="flex-1 overflow-hidden relative">
              {tabs.map(tab => (
                <div key={tab.assetId} className={`absolute inset-0 ${tab.assetId === activeTabId ? "block" : "hidden"}`}>
                  <TerminalSession
                    tab={tab}
                    isActive={tab.assetId === activeTabId}
                    onUpdate={updateTab}
                    onSetWsState={setWsState}
                    onAddEntry={addEntry}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
