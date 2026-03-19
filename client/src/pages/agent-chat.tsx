import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Brain, Send, Plus, MessageSquare, Bot, User, Clock,
  TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2,
  XCircle, Activity, Server, Shield, Package, Loader2,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import type { AgentConversation, AgentMessage, OrgRole, RoleSubscription, DiscoveredAsset } from "@shared/schema";

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

const agentColors: Record<string, string> = {
  "Network Operations": "bg-blue-500/15 text-blue-400",
  "Security Operations": "bg-red-500/15 text-red-400",
  "Infrastructure": "bg-purple-500/15 text-purple-400",
  "Database Operations": "bg-emerald-500/15 text-emerald-400",
  "Messaging": "bg-cyan-500/15 text-cyan-400",
  "Compliance": "bg-orange-500/15 text-orange-400",
};

function getAgentColor(department: string): string {
  return agentColors[department] || "bg-muted text-muted-foreground";
}

interface DashboardWidget {
  type: string;
  [key: string]: any;
}

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  green: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
};

const statusColors: Record<string, { dot: string; bg: string; text: string }> = {
  healthy: { dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  running: { dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  warning: { dot: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-400" },
  degraded: { dot: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-400" },
  critical: { dot: "bg-red-400", bg: "bg-red-500/10", text: "text-red-400" },
  offline: { dot: "bg-gray-400", bg: "bg-gray-500/10", text: "text-gray-400" },
  unknown: { dot: "bg-gray-400", bg: "bg-gray-500/10", text: "text-gray-400" },
};

const sevColors: Record<string, { bg: string; text: string; icon: typeof AlertTriangle }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", icon: XCircle },
  high: { bg: "bg-amber-500/10", text: "text-amber-400", icon: AlertTriangle },
  warning: { bg: "bg-yellow-500/10", text: "text-yellow-400", icon: AlertTriangle },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-400", icon: AlertTriangle },
  low: { bg: "bg-blue-500/10", text: "text-blue-400", icon: Activity },
};

function StatWidget({ widget }: { widget: DashboardWidget }) {
  const c = colorMap[widget.color] || colorMap.blue;
  const TrendIcon = widget.trend === "up" ? TrendingUp : widget.trend === "down" ? TrendingDown : Minus;
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-3 flex flex-col gap-1`} data-testid="dashboard-stat">
      <span className="text-[10px] text-muted-foreground/60 font-medium">{widget.label}</span>
      <div className="flex items-end gap-2">
        <span className={`text-xl font-bold ${c.text}`}>{widget.value}</span>
        {widget.change && (
          <span className={`text-[10px] font-medium flex items-center gap-0.5 ${
            widget.trend === "up" ? "text-emerald-400" : widget.trend === "down" ? "text-red-400" : "text-muted-foreground/50"
          }`}>
            <TrendIcon className="h-2.5 w-2.5" />
            {widget.change}
          </span>
        )}
      </div>
    </div>
  );
}

function HealthListWidget({ widget }: { widget: DashboardWidget }) {
  return (
    <div className="rounded-lg border border-border/15 bg-muted/5 overflow-hidden" data-testid="dashboard-health-list">
      <div className="flex items-center gap-1.5 p-2 border-b border-border/10">
        <Activity className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-semibold">{widget.title}</span>
      </div>
      <div className="divide-y divide-border/5">
        {(widget.items || []).map((item: any, idx: number) => {
          const sc = statusColors[item.status] || statusColors.unknown;
          const healthPct = typeof item.value === "number" ? item.value : 0;
          return (
            <div key={idx} className="flex items-center gap-2 px-3 py-2">
              <div className={`h-2 w-2 rounded-full ${sc.dot}`} />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-medium">{item.name}</span>
                {item.subtitle && <span className="text-[9px] text-muted-foreground/40 ml-1.5">{item.subtitle}</span>}
              </div>
              <div className="w-20 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div className={`h-full rounded-full ${healthPct >= 80 ? "bg-emerald-400" : healthPct >= 50 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${healthPct}%` }} />
              </div>
              <span className={`text-[10px] font-bold w-8 text-right ${healthPct >= 80 ? "text-emerald-400" : healthPct >= 50 ? "text-amber-400" : "text-red-400"}`}>{healthPct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertSummaryWidget({ widget }: { widget: DashboardWidget }) {
  return (
    <div className="rounded-lg border border-border/15 bg-muted/5 overflow-hidden" data-testid="dashboard-alert-summary">
      <div className="flex items-center gap-1.5 p-2 border-b border-border/10">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-semibold">{widget.title}</span>
        <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 ml-auto">{(widget.items || []).length}</Badge>
      </div>
      <div className="divide-y divide-border/5">
        {(widget.items || []).map((item: any, idx: number) => {
          const sc = sevColors[item.severity] || sevColors.medium;
          const SevIcon = sc.icon;
          return (
            <div key={idx} className="flex items-start gap-2 px-3 py-2">
              <SevIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${sc.text}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium">{item.message}</span>
                  <Badge className={`text-[6px] h-3 ${sc.bg} ${sc.text}`}>{item.severity}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[8px] text-muted-foreground/40 flex items-center gap-0.5"><Server className="h-2 w-2" />{item.device}</span>
                  {item.time && <span className="text-[8px] text-muted-foreground/30">{item.time}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TableWidget({ widget }: { widget: DashboardWidget }) {
  return (
    <div className="rounded-lg border border-border/15 bg-muted/5 overflow-hidden" data-testid="dashboard-table">
      {widget.title && (
        <div className="flex items-center gap-1.5 p-2 border-b border-border/10">
          <span className="text-xs font-semibold">{widget.title}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-muted-foreground/40 border-b border-border/5">
              {(widget.columns || []).map((col: string, ci: number) => (
                <th key={ci} className={`py-1.5 px-2 font-medium ${ci === 0 ? "text-left" : "text-right"}`}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(widget.rows || []).map((row: string[], ri: number) => (
              <tr key={ri} className="border-b border-border/5 last:border-0">
                {row.map((cell: string, ci: number) => (
                  <td key={ci} className={`py-1.5 px-2 ${ci === 0 ? "text-left font-medium" : "text-right text-muted-foreground/60"}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusGridWidget({ widget }: { widget: DashboardWidget }) {
  return (
    <div className="rounded-lg border border-border/15 bg-muted/5 overflow-hidden" data-testid="dashboard-status-grid">
      {widget.title && (
        <div className="flex items-center gap-1.5 p-2 border-b border-border/10">
          <Shield className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold">{widget.title}</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-1 p-2">
        {(widget.items || []).map((item: any, idx: number) => {
          const sc = statusColors[item.status] || statusColors.unknown;
          return (
            <div key={idx} className={`flex items-center gap-1.5 px-2 py-1.5 rounded ${sc.bg}`}>
              <div className={`h-2 w-2 rounded-full ${sc.dot}`} />
              <span className="text-[9px] font-medium truncate">{item.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressWidget({ widget }: { widget: DashboardWidget }) {
  return (
    <div className="rounded-lg border border-border/15 bg-muted/5 overflow-hidden" data-testid="dashboard-progress">
      {widget.title && (
        <div className="flex items-center gap-1.5 p-2 border-b border-border/10">
          <span className="text-xs font-semibold">{widget.title}</span>
        </div>
      )}
      <div className="p-2 space-y-2">
        {(widget.items || []).map((item: any, idx: number) => {
          const pct = item.max > 0 ? Math.round((item.value / item.max) * 100) : 0;
          const c = colorMap[item.color] || colorMap.blue;
          return (
            <div key={idx} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium">{item.label}</span>
                <span className={`text-[10px] font-bold ${c.text}`}>{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  pct >= 80 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400"
                }`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardBlock({ widgets }: { widgets: DashboardWidget[] }) {
  const stats = widgets.filter(w => w.type === "stat");
  const others = widgets.filter(w => w.type !== "stat");

  return (
    <div className="space-y-2 my-2" data-testid="dashboard-block">
      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {stats.map((w, i) => <StatWidget key={i} widget={w} />)}
        </div>
      )}
      {others.map((w, i) => {
        switch (w.type) {
          case "health_list": return <HealthListWidget key={i} widget={w} />;
          case "alert_summary": return <AlertSummaryWidget key={i} widget={w} />;
          case "table": return <TableWidget key={i} widget={w} />;
          case "status_grid": return <StatusGridWidget key={i} widget={w} />;
          case "progress": return <ProgressWidget key={i} widget={w} />;
          default: return null;
        }
      })}
    </div>
  );
}

interface PatchActionResult {
  patchId: string;
  patchTitle: string;
  severity: string;
  status: string;
  assetCount: number;
  jobs: Array<{ jobId: string; assetName: string }>;
}

function PatchActionCard({ result }: { result: PatchActionResult }) {
  const sevColors: Record<string, string> = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-blue-400",
  };
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 my-2" data-testid="patch-action-card">
      <div className="flex items-center gap-2 mb-2">
        <Package className="h-4 w-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-emerald-400">Patch Deployment Initiated</span>
        <Loader2 className="h-3 w-3 text-emerald-400 animate-spin ml-auto" />
      </div>
      <div className="text-sm font-medium text-foreground mb-1">{result.patchTitle}</div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className={`font-medium ${sevColors[result.severity] || "text-muted-foreground"}`}>
          {result.severity.toUpperCase()}
        </span>
        <span>Deploying to {result.assetCount} asset{result.assetCount !== 1 ? "s" : ""}</span>
        <span className="text-emerald-400/70">Status: {result.status}</span>
      </div>
      {result.jobs.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {result.jobs.map((j, i) => (
            <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-2.5 w-2.5 text-emerald-400/60 animate-spin" />
              <span>{j.assetName}</span>
              <span className="text-muted-foreground/50 ml-auto font-mono">{j.jobId.slice(0, 8)}…</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "dashboard"; widgets: DashboardWidget[] }
  | { type: "patch_action_embed"; data: Record<string, unknown> };

function parseRichContent(content: string): ContentPart[] {
  const parts: ContentPart[] = [];
  const regex = /:::(dashboard|patch_action)\s*\n([\s\S]*?)\n:::/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) parts.push({ type: "text", text: textBefore });
    }
    const blockType = match[1];
    const blockContent = match[2];
    try {
      const parsed = JSON.parse(blockContent);
      if (blockType === "dashboard" && Array.isArray(parsed)) {
        parts.push({ type: "dashboard", widgets: parsed });
      } else if (blockType === "patch_action" && parsed.action) {
        parts.push({ type: "patch_action_embed", data: parsed });
      } else {
        parts.push({ type: "text", text: blockContent });
      }
    } catch {
      parts.push({ type: "text", text: blockContent });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim();
    if (remaining) parts.push({ type: "text", text: remaining });
  }
  return parts;
}

function RichMessageContent({ content }: { content: string }) {
  const parts = parseRichContent(content);
  if (parts.length === 1 && parts[0].type === "text") {
    return <p className="whitespace-pre-wrap break-words">{parts[0].text}</p>;
  }
  return (
    <div className="space-y-2">
      {parts.map((part, idx) => {
        if (part.type === "dashboard") {
          return <DashboardBlock key={idx} widgets={part.widgets} />;
        }
        if (part.type === "patch_action_embed") {
          const d = part.data as any;
          return (
            <div key={idx} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 my-2">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-semibold text-emerald-400">Patch Deployment Queued</span>
              </div>
              <div className="text-sm font-medium text-foreground">{d.patchTitle || "Unnamed Patch"}</div>
              {d.assetNames && Array.isArray(d.assetNames) && (
                <div className="text-xs text-muted-foreground mt-1">{d.assetNames.length} target asset{d.assetNames.length !== 1 ? "s" : ""}</div>
              )}
            </div>
          );
        }
        return <p key={idx} className="whitespace-pre-wrap break-words">{part.text}</p>;
      })}
    </div>
  );
}

export default function AgentChat() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingRouting, setStreamingRouting] = useState<{ agentName: string; agentRoleId: string | null; reason: string } | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [streamingPatchActions, setStreamingPatchActions] = useState<PatchActionResult[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: conversations, isLoading: convsLoading } = useQuery<AgentConversation[]>({
    queryKey: ["/api/agent-chat/conversations"],
  });

  const { data: messages, isLoading: msgsLoading } = useQuery<AgentMessage[]>({
    queryKey: ["/api/agent-chat/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
  });

  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });
  const { data: assets } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });

  const aiAgentRoles = (roles || []).filter(r => {
    const sub = subscriptions?.find(s => s.roleId === r.id);
    return sub?.hasAiShadow;
  });

  const roleMap = new Map((roles || []).map(r => [r.id, r]));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (pendingMessage && activeConversationId && !isStreaming) {
      const msg = pendingMessage;
      setPendingMessage(null);
      setInput("");
      setIsStreaming(true);
      setStreamingContent("");
      setStreamingRouting(null);

      (async () => {
        try {
          const response = await fetch(`/api/agent-chat/conversations/${activeConversationId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: msg }),
            credentials: "include",
          });
          if (!response.ok) throw new Error("Failed to send");
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          if (!reader) throw new Error("No reader");
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "routing") {
                  setStreamingRouting({ agentName: event.agentName, agentRoleId: event.agentRoleId, reason: event.reason });
                } else if (event.type === "content") {
                  setStreamingContent(prev => prev + event.text);
                } else if (event.type === "patch_action") {
                  setStreamingPatchActions(prev => [...prev, event.result as PatchActionResult]);
                } else if (event.type === "done") {
                  break;
                }
              } catch {}
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          setIsStreaming(false);
          queryClient.invalidateQueries({ queryKey: ["/api/agent-chat/conversations", activeConversationId, "messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/agent-chat/conversations"] });
          setStreamingContent("");
          setStreamingRouting(null);
          setStreamingPatchActions([]);
        }
      })();
    }
  }, [pendingMessage, activeConversationId, isStreaming]);

  const createConversation = useCallback(async () => {
    const res = await apiRequest("POST", "/api/agent-chat/conversations", { title: "New Conversation" });
    const conv = await res.json();
    queryClient.invalidateQueries({ queryKey: ["/api/agent-chat/conversations"] });
    setActiveConversationId(conv.id);
    setStreamingContent("");
    setStreamingRouting(null);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !activeConversationId || isStreaming) return;
    const content = input.trim();
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setStreamingRouting(null);

    queryClient.invalidateQueries({ queryKey: ["/api/agent-chat/conversations", activeConversationId, "messages"] });

    try {
      const response = await fetch(`/api/agent-chat/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "routing") {
              setStreamingRouting({
                agentName: event.agentName,
                agentRoleId: event.agentRoleId,
                reason: event.reason,
              });
            } else if (event.type === "content") {
              setStreamingContent(prev => prev + event.text);
            } else if (event.type === "patch_action") {
              setStreamingPatchActions(prev => [...prev, event.result as PatchActionResult]);
            } else if (event.type === "done") {
              break;
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
    } finally {
      setIsStreaming(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agent-chat/conversations", activeConversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-chat/conversations"] });
      setStreamingContent("");
      setStreamingRouting(null);
      setStreamingPatchActions([]);
    }
  }, [input, activeConversationId, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sortedConversations = [...(conversations || [])].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
  );

  return (
    <div className="flex h-full">
      <div className="w-[280px] border-r border-border flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <Button
            onClick={createConversation}
            className="w-full gap-2"
            size="sm"
            data-testid="button-new-conversation"
          >
            <Plus className="h-3.5 w-3.5" />
            New Conversation
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {convsLoading && (
              <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
            )}
            {sortedConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConversationId(conv.id);
                  setStreamingContent("");
                  setStreamingRouting(null);
                }}
                className={`w-full text-left p-3 rounded-md transition-colors ${
                  activeConversationId === conv.id
                    ? "bg-primary/10 border border-primary/20"
                    : "hover-elevate"
                }`}
                data-testid={`conversation-item-${conv.id}`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate" data-testid={`conversation-title-${conv.id}`}>
                    {conv.title}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 ml-5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(conv.updatedAt || conv.createdAt)}
                  </span>
                </div>
              </button>
            ))}
            {!convsLoading && sortedConversations.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No conversations yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {activeConversationId ? (
          <>
            <div className="border-b border-border p-3">
              <div className="flex items-center gap-2 flex-wrap">
                {aiAgentRoles.map(role => {
                  const assetCount = assets?.filter(a => a.assignedAgentRoleId === role.id).length || 0;
                  return (
                    <Tooltip key={role.id}>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${getAgentColor(role.department)}`}
                          data-testid={`agent-badge-${role.id}`}
                        >
                          <div className="relative">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px] bg-transparent">
                                <Bot className="h-3 w-3" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 border border-background" />
                          </div>
                          <span className="font-medium truncate max-w-[80px]">{role.name}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[240px]">
                        <p className="font-medium text-xs">{role.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{role.department}</p>
                        <p className="text-[10px] mt-1">{role.description}</p>
                        {assetCount > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1">{assetCount} managed assets</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {msgsLoading && (
                  <div className="text-center text-xs text-muted-foreground py-8">Loading messages...</div>
                )}
                {(messages || []).map(msg => {
                  const isUser = msg.role === "user";
                  const agentRole = msg.agentRoleId ? roleMap.get(msg.agentRoleId) : null;

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
                        {!isUser && agentRole && (
                          <Badge
                            variant="outline"
                            className={`text-[9px] mb-1 gap-1 ${getAgentColor(agentRole.department)}`}
                          >
                            <Bot className="h-2.5 w-2.5" />
                            {agentRole.name} &middot; {agentRole.department}
                          </Badge>
                        )}
                        <div
                          className={`rounded-lg px-3 py-2 text-sm ${
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          } ${!isUser && (msg.content.includes(":::dashboard") || msg.content.includes(":::patch_action")) ? "max-w-full w-full" : ""}`}
                          data-testid={`message-content-${msg.id}`}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          ) : (
                            <RichMessageContent content={msg.content} />
                          )}
                        </div>
                        {!isUser && msg.routingReason && (
                          <p className="text-[10px] text-muted-foreground mt-1 px-1" data-testid={`routing-reason-${msg.id}`}>
                            {msg.routingReason}
                          </p>
                        )}
                        <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {isStreaming && (
                  <div className="flex justify-start" data-testid="streaming-message">
                    <div className="max-w-[75%] flex flex-col items-start">
                      {streamingRouting && (
                        <Badge
                          variant="outline"
                          className={`text-[9px] mb-1 gap-1 ${
                            streamingRouting.agentRoleId
                              ? getAgentColor(roleMap.get(streamingRouting.agentRoleId)?.department || "")
                              : ""
                          }`}
                          data-testid="streaming-agent-badge"
                        >
                          <Bot className="h-2.5 w-2.5" />
                          {streamingRouting.agentName}
                        </Badge>
                      )}
                      <div className="rounded-lg px-3 py-2 text-sm bg-muted">
                        {streamingContent ? (
                          <p className="whitespace-pre-wrap break-words" data-testid="streaming-content">
                            {streamingContent}
                            <span className="inline-block w-1.5 h-4 bg-foreground/60 ml-0.5 animate-pulse" />
                          </p>
                        ) : (
                          <div className="flex items-center gap-1.5" data-testid="typing-indicator">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "150ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "300ms" }} />
                          </div>
                        )}
                      </div>
                      {streamingRouting?.reason && (
                        <p className="text-[10px] text-muted-foreground mt-1 px-1" data-testid="streaming-routing-reason">
                          {streamingRouting.reason}
                        </p>
                      )}
                      {streamingPatchActions.length > 0 && (
                        <div className="w-full mt-1 space-y-1" data-testid="streaming-patch-actions">
                          {streamingPatchActions.map((r, i) => (
                            <PatchActionCard key={i} result={r} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask any agent a question..."
                  disabled={isStreaming}
                  className="flex-1"
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  size="icon"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold" data-testid="text-chat-placeholder">Agent Chat</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Start a conversation with your AI agents. Messages are automatically routed to the most relevant specialist based on subject matter.
                </p>
              </div>
            </div>
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2 max-w-3xl mx-auto">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                      e.preventDefault();
                      const res = await apiRequest("POST", "/api/agent-chat/conversations", { title: "New Conversation" });
                      const conv = await res.json();
                      queryClient.invalidateQueries({ queryKey: ["/api/agent-chat/conversations"] });
                      setActiveConversationId(conv.id);
                      setStreamingContent("");
                      setStreamingRouting(null);
                      setPendingMessage(input.trim());
                    }
                  }}
                  placeholder="Type a message to start a new conversation..."
                  className="flex-1"
                  data-testid="input-chat-message-placeholder"
                />
                <Button
                  disabled={!input.trim()}
                  size="icon"
                  onClick={async () => {
                    if (!input.trim()) return;
                    const res = await apiRequest("POST", "/api/agent-chat/conversations", { title: "New Conversation" });
                    const conv = await res.json();
                    queryClient.invalidateQueries({ queryKey: ["/api/agent-chat/conversations"] });
                    setActiveConversationId(conv.id);
                    setStreamingContent("");
                    setStreamingRouting(null);
                    setPendingMessage(input.trim());
                  }}
                  data-testid="button-send-message-placeholder"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}