import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgentNotification, OrgRole, DiscoveredAsset } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Shield, CheckCircle2, Clock, Bell, Bot,
  ThumbsUp, ThumbsDown, MessageSquare, Scan, ChevronDown,
  ChevronUp, AlertCircle, Activity, Zap, Send, X,
  Server, ArrowUpRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const severityConfig: Record<string, { color: string; icon: typeof AlertTriangle; label: string }> = {
  critical: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: AlertCircle, label: "Critical" },
  high: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle, label: "High" },
  medium: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: AlertTriangle, label: "Medium" },
  low: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Shield, label: "Low" },
  info: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle2, label: "Info" },
};

const typeConfig: Record<string, { color: string; label: string }> = {
  issue_detected: { color: "bg-red-500/15 text-red-400 border-red-500/25", label: "Issue Detected" },
  action_proposed: { color: "bg-purple-500/15 text-purple-400 border-purple-500/25", label: "Action Proposed" },
  action_taken: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", label: "Action Taken" },
  status_update: { color: "bg-blue-500/15 text-blue-400 border-blue-500/25", label: "Status Update" },
  escalation: { color: "bg-orange-500/15 text-orange-400 border-orange-500/25", label: "Escalation" },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/15 text-amber-400", label: "Pending Review" },
  approved: { color: "bg-emerald-500/15 text-emerald-400", label: "Approved" },
  rejected: { color: "bg-red-500/15 text-red-400", label: "Rejected" },
  auto_executed: { color: "bg-blue-500/15 text-blue-400", label: "Auto-Executed" },
  completed: { color: "bg-emerald-500/15 text-emerald-400", label: "Completed" },
};

function getAgentColor(department: string): string {
  const colors: Record<string, string> = {
    "Network Operations": "from-blue-500/20 to-cyan-500/10 border-blue-500/20",
    "Security Operations": "from-red-500/20 to-orange-500/10 border-red-500/20",
    "Infrastructure": "from-purple-500/20 to-violet-500/10 border-purple-500/20",
    "Database Operations": "from-emerald-500/20 to-green-500/10 border-emerald-500/20",
    "Communications": "from-pink-500/20 to-rose-500/10 border-pink-500/20",
    "Compliance": "from-amber-500/20 to-yellow-500/10 border-amber-500/20",
  };
  return colors[department] || "from-muted/20 to-muted/10 border-border";
}

function timeAgo(date: Date | string | null): string {
  if (!date) return "Unknown";
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentNotifications() {
  const { toast } = useToast();
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const { data: notifications = [], isLoading } = useQuery<AgentNotification[]>({
    queryKey: ["/api/agent-notifications"],
  });

  const { data: roles = [] } = useQuery<OrgRole[]>({
    queryKey: ["/api/org-roles"],
  });

  const { data: assets = [] } = useQuery<DiscoveredAsset[]>({
    queryKey: ["/api/discovered-assets"],
  });

  const roleMap = new Map(roles.map(r => [r.id, r]));
  const assetMap = new Map(assets.map(a => [a.id, a]));

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/agent-notifications/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notifications"] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/agent-notifications/generate");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-notifications"] });
      toast({ title: "Scan Complete", description: `Generated ${data.generated} new notifications from asset analysis.` });
    },
    onError: () => {
      toast({ title: "Scan Failed", description: "Failed to generate notifications. Please try again.", variant: "destructive" });
    },
  });

  const filtered = notifications.filter(n => {
    if (filterAgent !== "all" && n.agentRoleId !== filterAgent) return false;
    if (filterSeverity !== "all" && n.severity !== filterSeverity) return false;
    if (filterStatus !== "all" && n.actionStatus !== filterStatus) return false;
    if (filterType !== "all" && n.type !== filterType) return false;
    return true;
  });

  const criticalCount = notifications.filter(n => n.severity === "critical" && !n.resolvedAt).length;
  const pendingCount = notifications.filter(n => n.actionStatus === "pending").length;
  const autoResolvedCount = notifications.filter(n => n.actionStatus === "auto_executed" || n.actionStatus === "completed").length;
  const activeAgents = new Set(notifications.filter(n => !n.resolvedAt).map(n => n.agentRoleId)).size;

  const handleApprove = (id: string) => {
    updateMutation.mutate({ id, updates: { actionStatus: "approved" } });
    toast({ title: "Action Approved", description: "The agent will proceed with the proposed action." });
  };

  const handleReject = (id: string) => {
    updateMutation.mutate({ id, updates: { actionStatus: "rejected" } });
    toast({ title: "Action Rejected", description: "The proposed action has been rejected." });
  };

  const handleRespond = (id: string) => {
    if (!responseText.trim()) return;
    updateMutation.mutate({ id, updates: { humanResponse: responseText.trim() } });
    setResponseText("");
    setRespondingId(null);
    toast({ title: "Response Sent", description: "Your instructions have been recorded for the agent." });
  };

  const handleResolve = (id: string) => {
    updateMutation.mutate({ id, updates: { actionStatus: "completed", resolvedAt: new Date().toISOString() } });
    toast({ title: "Notification Resolved", description: "This notification has been marked as resolved." });
  };

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6 space-y-6" data-testid="page-agent-notifications">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight gradient-text-bright" data-testid="text-page-title">
            Agent Communications
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Proactive monitoring alerts and action proposals from your AI agents
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="gap-2 bg-primary/90 hover:bg-primary"
          data-testid="button-generate-scan"
        >
          <Scan className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
          {generateMutation.isPending ? "Scanning..." : "Run Agent Scan"}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-panel-strong border-red-500/20" data-testid="stat-critical">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical Issues</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel-strong border-amber-500/20" data-testid="stat-pending">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending Actions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel-strong border-emerald-500/20" data-testid="stat-resolved">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{autoResolvedCount}</p>
              <p className="text-xs text-muted-foreground">Auto-Resolved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-panel-strong border-primary/20" data-testid="stat-active-agents">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{activeAgents}</p>
              <p className="text-xs text-muted-foreground">Agents Reporting</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterAgent} onValueChange={setFilterAgent}>
          <SelectTrigger className="w-[200px] glass-panel-strong" data-testid="filter-agent">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {[...new Set(notifications.map(n => n.agentRoleId))].map(id => {
              const role = roleMap.get(id);
              return role ? (
                <SelectItem key={id} value={id}>{role.name}</SelectItem>
              ) : null;
            })}
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[160px] glass-panel-strong" data-testid="filter-severity">
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] glass-panel-strong" data-testid="filter-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="auto_executed">Auto-Executed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px] glass-panel-strong" data-testid="filter-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="issue_detected">Issue Detected</SelectItem>
            <SelectItem value="action_proposed">Action Proposed</SelectItem>
            <SelectItem value="action_taken">Action Taken</SelectItem>
            <SelectItem value="status_update">Status Update</SelectItem>
            <SelectItem value="escalation">Escalation</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {notifications.length} notifications
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Activity className="h-5 w-5 animate-pulse" />
            <span>Loading agent communications...</span>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bell className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No Notifications</p>
          <p className="text-sm mt-1">Run an agent scan to generate proactive monitoring alerts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(notification => {
            const role = roleMap.get(notification.agentRoleId);
            const asset = notification.assetId ? assetMap.get(notification.assetId) : null;
            const sev = severityConfig[notification.severity] || severityConfig.medium;
            const typeConf = typeConfig[notification.type] || typeConfig.status_update;
            const statusConf = statusConfig[notification.actionStatus] || statusConfig.pending;
            const isExpanded = expandedId === notification.id;
            const isResponding = respondingId === notification.id;
            const SevIcon = sev.icon;

            return (
              <Card
                key={notification.id}
                className={`glass-panel-strong transition-all duration-200 hover:border-primary/30 ${
                  notification.severity === "critical" ? "border-red-500/30 shadow-[0_0_12px_-3px_rgba(239,68,68,0.15)]" : ""
                } ${notification.resolvedAt ? "opacity-60" : ""}`}
                data-testid={`notification-${notification.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${role ? getAgentColor(role.department) : ""} shrink-0 mt-0.5`}>
                      <Bot className="h-5 w-5 text-foreground/80" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-sm font-semibold text-foreground/90" data-testid={`notification-agent-${notification.id}`}>
                          {role?.name || "Unknown Agent"}
                        </span>
                        {role && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 opacity-60">
                            {role.department}
                          </Badge>
                        )}
                        <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${sev.color}`}>
                          <SevIcon className="h-2.5 w-2.5 mr-0.5" />
                          {sev.label}
                        </Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 h-4 border ${typeConf.color}`}>
                          {typeConf.label}
                        </Badge>
                        <Badge className={`text-[10px] px-1.5 py-0 h-4 ${statusConf.color}`}>
                          {statusConf.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/60 ml-auto">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-foreground mb-1" data-testid={`notification-title-${notification.id}`}>
                        {notification.title}
                      </h3>

                      <p className={`text-xs text-muted-foreground leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                        {notification.description}
                      </p>

                      {asset && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Server className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-[11px] text-muted-foreground/80">
                            {asset.name} ({asset.type}) — {asset.ipAddress}
                          </span>
                        </div>
                      )}

                      {isExpanded && notification.proposedAction && (
                        <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Zap className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary">Proposed Action</span>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed">
                            {notification.proposedAction}
                          </p>
                        </div>
                      )}

                      {isExpanded && notification.humanResponse && (
                        <div className="mt-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                            <span className="text-xs font-semibold text-emerald-400">Manager Response</span>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed">
                            {notification.humanResponse}
                          </p>
                        </div>
                      )}

                      {isExpanded && isResponding && (
                        <div className="mt-3 flex gap-2">
                          <Textarea
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            placeholder="Type your instructions or response to the agent..."
                            className="text-xs min-h-[60px] glass-panel-strong"
                            data-testid={`textarea-response-${notification.id}`}
                          />
                          <div className="flex flex-col gap-1">
                            <Button
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleRespond(notification.id)}
                              disabled={!responseText.trim()}
                              data-testid={`button-send-response-${notification.id}`}
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => { setRespondingId(null); setResponseText(""); }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {isExpanded && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                          {notification.actionStatus === "pending" && notification.proposedAction && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                                onClick={() => handleApprove(notification.id)}
                                disabled={updateMutation.isPending}
                                data-testid={`button-approve-${notification.id}`}
                              >
                                <ThumbsUp className="h-3 w-3" />
                                Approve Action
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1.5 text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                                onClick={() => handleReject(notification.id)}
                                disabled={updateMutation.isPending}
                                data-testid={`button-reject-${notification.id}`}
                              >
                                <ThumbsDown className="h-3 w-3" />
                                Reject
                              </Button>
                            </>
                          )}
                          {!isResponding && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => setRespondingId(notification.id)}
                              data-testid={`button-respond-${notification.id}`}
                            >
                              <MessageSquare className="h-3 w-3" />
                              Respond
                            </Button>
                          )}
                          {!notification.resolvedAt && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs ml-auto"
                              onClick={() => handleResolve(notification.id)}
                              disabled={updateMutation.isPending}
                              data-testid={`button-resolve-${notification.id}`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setExpandedId(isExpanded ? null : notification.id)}
                      data-testid={`button-expand-${notification.id}`}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
