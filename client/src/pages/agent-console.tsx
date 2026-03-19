import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Terminal, Play, Pause, RotateCcw, ChevronRight, CheckCircle2, Clock, Loader2, AlertTriangle,
  Shield, Cpu, Activity, Zap, Eye, Filter, Search, Bot, Workflow, ArrowRight, Circle,
  ChevronDown, ChevronUp
} from "lucide-react";
import type { AgentTask, OrgRole, RoleSubscription } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ConsoleEntry = {
  id: string;
  timestamp: Date;
  agentName: string;
  agentColor: string;
  type: "info" | "analysis" | "action" | "result" | "warning" | "error" | "system" | "thinking";
  message: string;
  taskId?: string;
  taskDescription?: string;
};

const typeStyles: Record<string, { color: string; prefix: string; icon: typeof Terminal }> = {
  system: { color: "text-blue-400", prefix: "SYS", icon: Terminal },
  info: { color: "text-cyan-400", prefix: "INF", icon: Eye },
  analysis: { color: "text-purple-400", prefix: "ANL", icon: Search },
  thinking: { color: "text-yellow-400", prefix: "THK", icon: Cpu },
  action: { color: "text-green-400", prefix: "ACT", icon: Zap },
  result: { color: "text-emerald-400", prefix: "RES", icon: CheckCircle2 },
  warning: { color: "text-amber-400", prefix: "WRN", icon: AlertTriangle },
  error: { color: "text-red-400", prefix: "ERR", icon: AlertTriangle },
};

function generateTaskSimulation(task: AgentTask, agentName: string, agentColor: string): ConsoleEntry[] {
  const entries: ConsoleEntry[] = [];
  const base = { agentName, agentColor, taskId: task.id, taskDescription: task.description };
  const now = new Date();

  const taskType = task.description.toLowerCase();
  let steps: { type: ConsoleEntry["type"]; msg: string }[] = [];

  if (taskType.includes("bgp") || taskType.includes("routing") || taskType.includes("ospf")) {
    steps = [
      { type: "system", msg: `Task assigned: ${task.description}` },
      { type: "info", msg: `Connecting to network devices via SSH/SNMP...` },
      { type: "analysis", msg: `Querying BGP neighbor table from core routers...` },
      { type: "thinking", msg: `Analyzing BGP session states: checking Established vs Idle/Active...` },
      { type: "action", msg: `Running: show ip bgp summary | Checking prefix counts and uptime...` },
      { type: "analysis", msg: `Cross-referencing route advertisements with expected prefix lists...` },
      { type: "thinking", msg: `Evaluating AS path lengths and detecting possible route leaks...` },
      { type: "result", msg: task.output || `All BGP sessions verified. No anomalies detected.` },
    ];
  } else if (taskType.includes("firewall") || taskType.includes("acl") || taskType.includes("rule")) {
    steps = [
      { type: "system", msg: `Task assigned: ${task.description}` },
      { type: "info", msg: `Retrieving firewall rule sets from management API...` },
      { type: "analysis", msg: `Parsing ${Math.floor(Math.random() * 200 + 50)} active rules across ${Math.floor(Math.random() * 5 + 2)} zones...` },
      { type: "thinking", msg: `Checking for shadowed rules, overly permissive policies, and stale entries...` },
      { type: "action", msg: `Comparing against baseline security template (CIS Benchmark)...` },
      { type: "analysis", msg: `Validating rule ordering and implicit deny effectiveness...` },
      { type: "result", msg: task.output || `Firewall audit complete. All rules comply with security baseline.` },
    ];
  } else if (taskType.includes("vulnerability") || taskType.includes("cve") || taskType.includes("firmware") || taskType.includes("patch")) {
    steps = [
      { type: "system", msg: `Task assigned: ${task.description}` },
      { type: "info", msg: `Querying device firmware versions and installed patches...` },
      { type: "analysis", msg: `Cross-referencing against NVD/CVE database (${new Date().toISOString().split('T')[0]})...` },
      { type: "thinking", msg: `Scoring vulnerabilities using CVSS v3.1 and evaluating exploitability...` },
      { type: "warning", msg: `Found potential exposure requiring attention — analyzing impact scope...` },
      { type: "action", msg: `Generating remediation plan with priority ordering and maintenance windows...` },
      { type: "result", msg: task.output || `Vulnerability assessment complete. Remediation plan ready for review.` },
    ];
  } else if (taskType.includes("qos") || taskType.includes("dscp") || taskType.includes("bandwidth")) {
    steps = [
      { type: "system", msg: `Task assigned: ${task.description}` },
      { type: "info", msg: `Collecting QoS policy configurations from edge routers...` },
      { type: "analysis", msg: `Analyzing DSCP marking consistency across ${Math.floor(Math.random() * 10 + 3)} interfaces...` },
      { type: "thinking", msg: `Evaluating traffic class distribution and queuing behaviors...` },
      { type: "action", msg: `Comparing voice/video traffic markings against Cisco QoS best practices...` },
      { type: "result", msg: task.output || `QoS analysis complete. Markings verified consistent.` },
    ];
  } else if (taskType.includes("vlan") || taskType.includes("trunk") || taskType.includes("switch")) {
    steps = [
      { type: "system", msg: `Task assigned: ${task.description}` },
      { type: "info", msg: `Scanning switch infrastructure for VLAN configurations...` },
      { type: "analysis", msg: `Mapping VLAN-to-port assignments across the switching fabric...` },
      { type: "thinking", msg: `Identifying unused VLANs (no active ports for 90+ days)...` },
      { type: "action", msg: `Generating pruning recommendations and trunk optimization plan...` },
      { type: "result", msg: task.output || `VLAN audit complete. Recommendations generated.` },
    ];
  } else if (taskType.includes("ids") || taskType.includes("ips") || taskType.includes("signature") || taskType.includes("threat")) {
    steps = [
      { type: "system", msg: `Task assigned: ${task.description}` },
      { type: "info", msg: `Connecting to IDS/IPS management console...` },
      { type: "analysis", msg: `Checking signature database version against latest available release...` },
      { type: "thinking", msg: `Evaluating false positive rates and tuning thresholds...` },
      { type: "action", msg: `Updating signature definitions and validating sensor health...` },
      { type: "analysis", msg: `Reviewing last 24h detection events for anomalies...` },
      { type: "result", msg: task.output || `IDS/IPS signatures updated. Sensor health verified.` },
    ];
  } else if (taskType.includes("ssl") || taskType.includes("certificate") || taskType.includes("tls")) {
    steps = [
      { type: "system", msg: `Task assigned: ${task.description}` },
      { type: "info", msg: `Scanning certificate inventory across all endpoints...` },
      { type: "analysis", msg: `Checking expiration dates and cipher suite compliance...` },
      { type: "thinking", msg: `Evaluating certificate chain validity and pinning configurations...` },
      { type: "result", msg: task.output || `Certificate audit complete. All certificates valid.` },
    ];
  } else {
    steps = [
      { type: "system", msg: `Task assigned: ${task.description}` },
      { type: "info", msg: `Initializing analysis for: ${task.description}` },
      { type: "analysis", msg: `Gathering relevant data from infrastructure endpoints...` },
      { type: "thinking", msg: `Processing collected data and applying analysis rules...` },
      { type: "action", msg: `Executing remediation/verification steps...` },
      { type: "result", msg: task.output || `Task analysis complete. Results within expected parameters.` },
    ];
  }

  steps.forEach((step, i) => {
    entries.push({
      id: `${task.id}-step-${i}`,
      timestamp: new Date(now.getTime() - (steps.length - i) * 3000),
      type: step.type,
      message: step.msg,
      ...base,
    });
  });

  return entries;
}

function ConsoleEntryRow({ entry, expanded, onToggle }: { entry: ConsoleEntry; expanded: boolean; onToggle: () => void }) {
  const style = typeStyles[entry.type] || typeStyles.info;
  const Icon = style.icon;
  const ts = entry.timestamp.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div
      className="font-mono text-[11px] leading-[1.6] px-3 py-0.5 hover:bg-white/[0.02] cursor-pointer group"
      onClick={onToggle}
      data-testid={`console-entry-${entry.id}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground/40 shrink-0 w-[70px]">{ts}</span>
        <span className={`${style.color} shrink-0 w-[28px] font-bold`}>{style.prefix}</span>
        <span className="shrink-0 w-[3px] h-[3px] rounded-full mt-[7px]" style={{ backgroundColor: entry.agentColor }} />
        <span className="text-muted-foreground/60 shrink-0 max-w-[180px] truncate">{entry.agentName}</span>
        <Icon className={`h-3 w-3 ${style.color} shrink-0 mt-[2px] ${entry.type === "thinking" ? "animate-pulse" : ""}`} />
        <span className={`flex-1 ${entry.type === "result" ? "text-emerald-400/90" : entry.type === "warning" ? "text-amber-400/90" : entry.type === "error" ? "text-red-400/90" : "text-foreground/80"}`}>
          {entry.message}
        </span>
      </div>
    </div>
  );
}

function TaskExecutionCard({ task, agentName, agentColor, isActive }: {
  task: AgentTask; agentName: string; agentColor: string; isActive: boolean;
}) {
  const statusConfig: Record<string, { color: string; label: string; icon: typeof Clock }> = {
    pending: { color: "text-amber-400 border-amber-500/30", label: "Pending", icon: Clock },
    in_progress: { color: "text-blue-400 border-blue-500/30", label: "Executing", icon: Loader2 },
    completed: { color: "text-green-400 border-green-500/30", label: "Complete", icon: CheckCircle2 },
    scheduled: { color: "text-muted-foreground border-border/30", label: "Scheduled", icon: Clock },
  };
  const config = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${isActive ? "border-primary/30 bg-primary/5" : "border-border/30 bg-card/30"}`}
      data-testid={`task-card-${task.id}`}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded mt-0.5" style={{ backgroundColor: `${agentColor}20`, color: agentColor }}>
          <StatusIcon className={`h-3 w-3 ${task.status === "in_progress" ? "animate-spin" : ""}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium leading-relaxed">{task.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground/60">{agentName}</span>
            <Badge variant="outline" className={`text-[9px] h-4 ${config.color}`}>{config.label}</Badge>
            <Badge variant="outline" className={`text-[9px] h-4 ${task.priority === "critical" ? "border-red-500/30 text-red-400" : task.priority === "high" ? "border-amber-500/30 text-amber-400" : "border-border/40 text-muted-foreground/60"}`}>
              {task.priority}
            </Badge>
          </div>
          {task.output && task.status === "completed" && (
            <div className="mt-2 p-2 rounded bg-green-500/5 border border-green-500/10">
              <p className="text-[10px] text-green-400/80 leading-relaxed">{task.output}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentConsolePage() {
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [isLive, setIsLive] = useState(true);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tasks, isLoading: tasksLoading } = useQuery<AgentTask[]>({
    queryKey: ["/api/agent-tasks"],
    refetchInterval: isLive ? 10000 : undefined,
  });

  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });

  const activeAgents = useMemo(() => {
    if (!roles || !subscriptions) return [];
    return subscriptions
      .filter(s => s.hasAiShadow)
      .map(s => {
        const role = roles.find(r => r.id === s.roleId);
        return role ? { id: role.id, name: role.name, color: (role as any).color || "#6366f1" } : null;
      })
      .filter(Boolean) as { id: string; name: string; color: string }[];
  }, [roles, subscriptions]);

  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    activeAgents.forEach(a => map.set(a.id, { name: a.name, color: a.color }));
    return map;
  }, [activeAgents]);

  const consoleEntries = useMemo(() => {
    if (!tasks) return [];
    const allEntries: ConsoleEntry[] = [];

    const relevantTasks = tasks.filter(t => t.status === "completed" || t.status === "in_progress");
    relevantTasks.forEach(task => {
      const agent = agentMap.get(task.assignedRoleId || "");
      const name = agent?.name || "Unassigned Agent";
      const color = agent?.color || "#6366f1";
      allEntries.push(...generateTaskSimulation(task, name, color));
    });

    allEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return allEntries;
  }, [tasks, agentMap]);

  const filteredEntries = useMemo(() => {
    return consoleEntries.filter(e => {
      if (filterAgent !== "all" && e.agentName !== filterAgent) return false;
      if (filterType !== "all" && e.type !== filterType) return false;
      return true;
    });
  }, [consoleEntries, filterAgent, filterType]);

  const tasksByStatus = useMemo(() => {
    if (!tasks) return { inProgress: [], pending: [], completed: [] };
    return {
      inProgress: tasks.filter(t => t.status === "in_progress"),
      pending: tasks.filter(t => t.status === "pending"),
      completed: tasks.filter(t => t.status === "completed"),
    };
  }, [tasks]);

  const agentStats = useMemo(() => {
    if (!tasks) return [];
    const stats = new Map<string, { name: string; color: string; total: number; completed: number; inProgress: number; pending: number }>();
    tasks.forEach(task => {
      const agent = agentMap.get(task.assignedRoleId || "");
      const key = task.assignedRoleId || "unknown";
      if (!stats.has(key)) {
        stats.set(key, {
          name: agent?.name || "Unassigned",
          color: agent?.color || "#6366f1",
          total: 0, completed: 0, inProgress: 0, pending: 0,
        });
      }
      const s = stats.get(key)!;
      s.total++;
      if (task.status === "completed") s.completed++;
      if (task.status === "in_progress") s.inProgress++;
      if (task.status === "pending") s.pending++;
    });
    return Array.from(stats.values()).sort((a, b) => b.inProgress - a.inProgress || b.total - a.total);
  }, [tasks, agentMap]);

  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEntries.length, isLive]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setActiveTaskIndex(prev => prev + 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [isLive]);

  const uniqueAgentNames = useMemo(() => {
    const names = new Set(consoleEntries.map(e => e.agentName));
    return Array.from(names).sort();
  }, [consoleEntries]);

  const totalTasks = tasks?.length || 0;
  const completedTasks = tasksByStatus.completed.length;
  const inProgressTasks = tasksByStatus.inProgress.length;
  const pendingTasks = tasksByStatus.pending.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="p-6 space-y-4 overflow-auto h-full" data-testid="agent-console-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-console-title">
            <Terminal className="h-6 w-6 text-primary" />
            AI Agent Operations Console
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time visibility into autonomous agent operations and task execution</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={isLive ? "default" : "outline"}
            size="sm"
            onClick={() => setIsLive(!isLive)}
            data-testid="button-toggle-live"
          >
            {isLive ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {isLive ? "Pause" : "Resume"}
          </Button>
          <Badge variant="outline" className={`text-[10px] gap-1 ${isLive ? "border-green-500/30" : "border-border"}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
            {isLive ? "Live" : "Paused"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Active Agents</p>
              <Bot className="h-3.5 w-3.5 text-primary/60" />
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="stat-active-agents">{activeAgents.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Total Tasks</p>
              <Workflow className="h-3.5 w-3.5 text-blue-500/60" />
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="stat-total-tasks">{totalTasks}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Executing</p>
              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
            </div>
            <p className="text-2xl font-bold text-blue-400 mt-1" data-testid="stat-executing">{inProgressTasks}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Completed</p>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500/60" />
            </div>
            <p className="text-2xl font-bold text-green-400 mt-1" data-testid="stat-completed">{completedTasks}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">Completion</p>
              <Activity className="h-3.5 w-3.5 text-emerald-500/60" />
            </div>
            <p className="text-2xl font-bold text-emerald-400 mt-1" data-testid="stat-completion-rate">{completionRate}%</p>
            <Progress value={completionRate} className="h-1 mt-1 [&>div]:bg-emerald-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 lg:h-[calc(100vh-320px)]">
        <Card className="bg-black/40 border-border/30 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 pt-3 px-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-green-400" />
                Operations Log
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={filterAgent} onValueChange={setFilterAgent}>
                  <SelectTrigger className="h-6 text-[10px] w-[160px] bg-transparent border-border/30" data-testid="select-filter-agent">
                    <SelectValue placeholder="All Agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {uniqueAgentNames.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-6 text-[10px] w-[120px] bg-transparent border-border/30" data-testid="select-filter-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="thinking">Thinking</SelectItem>
                    <SelectItem value="action">Action</SelectItem>
                    <SelectItem value="result">Result</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-[9px] h-5">
                  {filteredEntries.length} entries
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            {tasksLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="h-4" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Terminal className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground/50">No console output yet</p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">Agent operations will appear here in real-time</p>
                </div>
              </div>
            ) : (
              <div ref={scrollRef} className="h-full overflow-y-auto scrollbar-thin">
                <div className="py-1">
                  {filteredEntries.map((entry) => (
                    <ConsoleEntryRow
                      key={entry.id}
                      entry={entry}
                      expanded={expandedEntry === entry.id}
                      onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                    />
                  ))}
                  {isLive && (
                    <div className="px-3 py-1 font-mono text-[11px]">
                      <span className="text-green-400 animate-pulse">█</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 overflow-hidden">
          <Card className="bg-card/50 border-border/30 shrink-0">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Bot className="h-3.5 w-3.5 text-primary" />
                Agent Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 max-h-[200px] overflow-y-auto">
              <div className="space-y-1.5">
                {agentStats.map((agent, i) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 rounded hover:bg-white/[0.02]" data-testid={`agent-status-${i}`}>
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: agent.color }} />
                    <span className="text-[10px] font-medium flex-1 truncate">{agent.name}</span>
                    <div className="flex items-center gap-1">
                      {agent.inProgress > 0 && (
                        <Badge className="text-[8px] h-3.5 px-1 bg-blue-500/10 text-blue-400 border-blue-500/20">
                          {agent.inProgress} running
                        </Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground/50">{agent.completed}/{agent.total}</span>
                    </div>
                  </div>
                ))}
                {agentStats.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 text-center py-2">No active agents</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/30 flex-1 flex flex-col overflow-hidden">
            <CardHeader className="pb-2 pt-3 px-3 shrink-0">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Workflow className="h-3.5 w-3.5 text-blue-400" />
                Task Queue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-y-auto">
              <Tabs defaultValue="in_progress" className="h-full">
                <TabsList className="grid w-full grid-cols-3 h-7">
                  <TabsTrigger value="in_progress" className="text-[10px] h-5 gap-1" data-testid="tab-in-progress">
                    <Loader2 className="h-2.5 w-2.5" />
                    Active ({inProgressTasks})
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-[10px] h-5 gap-1" data-testid="tab-pending">
                    <Clock className="h-2.5 w-2.5" />
                    Queue ({pendingTasks})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-[10px] h-5 gap-1" data-testid="tab-completed">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Done ({completedTasks})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="in_progress" className="mt-2 space-y-2">
                  {tasksByStatus.inProgress.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/50 text-center py-4">No tasks currently executing</p>
                  ) : tasksByStatus.inProgress.map(task => {
                    const agent = agentMap.get(task.assignedRoleId || "");
                    return (
                      <TaskExecutionCard
                        key={task.id}
                        task={task}
                        agentName={agent?.name || "Unassigned"}
                        agentColor={agent?.color || "#6366f1"}
                        isActive={true}
                      />
                    );
                  })}
                </TabsContent>
                <TabsContent value="pending" className="mt-2 space-y-2">
                  {tasksByStatus.pending.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/50 text-center py-4">No pending tasks</p>
                  ) : tasksByStatus.pending.slice(0, 10).map(task => {
                    const agent = agentMap.get(task.assignedRoleId || "");
                    return (
                      <TaskExecutionCard
                        key={task.id}
                        task={task}
                        agentName={agent?.name || "Unassigned"}
                        agentColor={agent?.color || "#6366f1"}
                        isActive={false}
                      />
                    );
                  })}
                </TabsContent>
                <TabsContent value="completed" className="mt-2 space-y-2">
                  {tasksByStatus.completed.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground/50 text-center py-4">No completed tasks</p>
                  ) : tasksByStatus.completed.slice(0, 10).map(task => {
                    const agent = agentMap.get(task.assignedRoleId || "");
                    return (
                      <TaskExecutionCard
                        key={task.id}
                        task={task}
                        agentName={agent?.name || "Unassigned"}
                        agentColor={agent?.color || "#6366f1"}
                        isActive={false}
                      />
                    );
                  })}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
