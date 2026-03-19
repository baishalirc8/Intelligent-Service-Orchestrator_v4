import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  Zap,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Shield,
  Wrench,
  Scale,
  Download,
  FileCheck,
  Target,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Playbook, PlaybookExecution, AiAgent } from "@shared/schema";

const categoryIcons: Record<string, React.ElementType> = {
  remediation: Wrench,
  security: Shield,
  maintenance: Clock,
  compliance: FileCheck,
  scaling: Scale,
  patching: Download,
};

const categoryColors: Record<string, string> = {
  remediation: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  security: "bg-red-500/15 text-red-600 dark:text-red-400",
  maintenance: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  compliance: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  scaling: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  patching: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

const severityColors: Record<string, string> = {
  critical: "bg-red-500/15 text-red-600 dark:text-red-400",
  high: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  medium: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  low: "bg-green-500/15 text-green-600 dark:text-green-400",
};

const execStatusIcons: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  running: Loader2,
  failed: XCircle,
};

const execStatusColors: Record<string, string> = {
  completed: "text-green-500",
  running: "text-blue-500 animate-spin",
  failed: "text-red-500",
};

function PlaybookCard({ playbook, agents }: { playbook: Playbook; agents: AiAgent[] }) {
  const [expanded, setExpanded] = useState(false);
  const CatIcon = categoryIcons[playbook.category] || Zap;
  const agent = agents.find(a => a.id === playbook.agentId);
  const actions = playbook.actions as Array<{ step: number; action: string; timeout?: number }>;

  return (
    <Card className="hover-elevate" data-testid={`card-playbook-${playbook.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${categoryColors[playbook.category] || "bg-gray-500/15"}`}>
              <CatIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{playbook.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{playbook.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant="outline" className={`text-[10px] ${severityColors[playbook.severity]}`}>
              {playbook.severity}
            </Badge>
            <Badge variant={playbook.enabled ? "default" : "secondary"} className="text-[10px]">
              {playbook.enabled ? "enabled" : "disabled"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Trigger</span>
            <p className="text-xs font-medium mt-1">{playbook.triggerType}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Executions</span>
            <p className="text-lg font-bold">{playbook.executionCount}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Category</span>
            <p className="text-xs font-medium mt-1 capitalize">{playbook.category}</p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground mt-3 pt-3 border-t">
          <span className="font-medium text-foreground">Trigger condition:</span> {playbook.triggerCondition}
        </div>

        {agent && (
          <div className="flex items-center gap-2 mt-2">
            <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
              {agent.name.charAt(0)}
            </div>
            <span className="text-xs text-muted-foreground">Executed by <span className="font-medium text-foreground">{agent.name}</span></span>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground mt-3 w-full"
          data-testid={`button-expand-playbook-${playbook.id}`}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Hide" : "Show"} action steps ({actions?.length || 0})
        </button>

        {expanded && actions && (
          <div className="mt-3 pt-3 border-t space-y-2">
            {actions.map((a) => (
              <div key={a.step} className="flex items-start gap-2 text-xs">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{a.step}</span>
                <span className="text-foreground">{a.action}</span>
                {a.timeout && <span className="text-muted-foreground ml-auto shrink-0">{a.timeout}s</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExecutionRow({ exec, playbooks, agents }: { exec: PlaybookExecution; playbooks: Playbook[]; agents: AiAgent[] }) {
  const [expanded, setExpanded] = useState(false);
  const playbook = playbooks.find(p => p.id === exec.playbookId);
  const agent = agents.find(a => a.id === exec.agentId);
  const StatusIcon = execStatusIcons[exec.status] || Clock;
  const actions = exec.actionsTaken as Array<{ step: number; result: string }> | null;

  return (
    <div className="border rounded-md p-4" data-testid={`exec-row-${exec.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <StatusIcon className={`h-5 w-5 shrink-0 mt-0.5 ${execStatusColors[exec.status]}`} />
          <div>
            <h4 className="text-sm font-medium">{playbook?.name || "Unknown Playbook"}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{exec.triggerReason}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {exec.targetAsset && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Target className="h-3 w-3" />
              {exec.targetAsset}
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] ${exec.status === "completed" ? "bg-green-500/15 text-green-600 dark:text-green-400" : exec.status === "running" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
            {exec.status}
          </Badge>
        </div>
      </div>

      {exec.result && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
          <span className="font-medium">Result:</span> {exec.result}
        </div>
      )}

      {agent && (
        <div className="flex items-center gap-2 mt-2">
          <div className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
            {agent.name.charAt(0)}
          </div>
          <span className="text-[10px] text-muted-foreground">{agent.name}</span>
        </div>
      )}

      {actions && actions.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground mt-2"
            data-testid={`button-expand-exec-${exec.id}`}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Hide" : "Show"} execution steps
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5">
              {actions.map(a => (
                <div key={a.step} className="flex items-start gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500 mt-0.5" />
                  <span className="text-muted-foreground">Step {a.step}:</span>
                  <span>{a.result}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Automation() {
  const { data: playbooks, isLoading: pbLoading } = useQuery<Playbook[]>({ queryKey: ["/api/playbooks"] });
  const { data: executions, isLoading: execLoading } = useQuery<PlaybookExecution[]>({ queryKey: ["/api/playbook-executions"] });
  const { data: agents } = useQuery<AiAgent[]>({ queryKey: ["/api/agents"] });
  const [tab, setTab] = useState<"playbooks" | "executions">("playbooks");
  const [catFilter, setCatFilter] = useState("all");
  const [playbookPage, setPlaybookPage] = useState(0);
  const [execPage, setExecPage] = useState(0);
  const PAGE_SIZE = 10;

  const categories = [...new Set(playbooks?.map(p => p.category) ?? [])];
  const filteredPlaybooks = catFilter === "all" ? playbooks : playbooks?.filter(p => p.category === catFilter);
  const totalPlaybooks = filteredPlaybooks?.length ?? 0;
  const totalPlaybookPages = Math.max(1, Math.ceil(totalPlaybooks / PAGE_SIZE));
  const safePlaybookPage = Math.min(playbookPage, totalPlaybookPages - 1);
  const paginatedPlaybooks = filteredPlaybooks?.slice(safePlaybookPage * PAGE_SIZE, (safePlaybookPage + 1) * PAGE_SIZE);

  const totalExecutions = executions?.length ?? 0;
  const totalExecPages = Math.max(1, Math.ceil(totalExecutions / PAGE_SIZE));
  const safeExecPage = Math.min(execPage, totalExecPages - 1);
  const paginatedExecutions = executions?.slice(safeExecPage * PAGE_SIZE, (safeExecPage + 1) * PAGE_SIZE);
  const totalExecs = playbooks?.reduce((s, p) => s + (p.executionCount || 0), 0) ?? 0;
  const runningExecs = executions?.filter(e => e.status === "running").length ?? 0;

  if (pbLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Autonomous Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-driven playbooks that autonomously manage, remediate, and optimize your infrastructure
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1.5">
            <Zap className="h-3 w-3" />
            {totalExecs} total executions
          </Badge>
          {runningExecs > 0 && (
            <Badge className="gap-1.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">
              <Loader2 className="h-3 w-3 animate-spin" />
              {runningExecs} running
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab("playbooks")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "playbooks" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          data-testid="tab-playbooks"
        >
          Playbooks ({playbooks?.length ?? 0})
        </button>
        <button
          onClick={() => setTab("executions")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "executions" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          data-testid="tab-executions"
        >
          Execution History ({executions?.length ?? 0})
        </button>
      </div>

      {tab === "playbooks" && (
        <>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setCatFilter("all"); setPlaybookPage(0); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${catFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setCatFilter(cat); setPlaybookPage(0); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${catFilter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                data-testid={`filter-${cat}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {paginatedPlaybooks?.map(p => (
              <PlaybookCard key={p.id} playbook={p} agents={agents ?? []} />
            ))}
          </div>
          {totalPlaybooks > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground" data-testid="text-playbooks-showing">
                Showing {safePlaybookPage * PAGE_SIZE + 1}–{Math.min((safePlaybookPage + 1) * PAGE_SIZE, totalPlaybooks)} of {totalPlaybooks}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPlaybookPage(p => Math.max(0, p - 1))}
                  disabled={safePlaybookPage === 0}
                  data-testid="button-playbooks-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPlaybookPages }).map((_, i) => (
                  <Button
                    key={i}
                    variant={safePlaybookPage === i ? "default" : "outline"}
                    size="icon"
                    onClick={() => setPlaybookPage(i)}
                    data-testid={`button-playbooks-page-${i}`}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPlaybookPage(p => Math.min(totalPlaybookPages - 1, p + 1))}
                  disabled={safePlaybookPage >= totalPlaybookPages - 1}
                  data-testid="button-playbooks-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "executions" && (
        <div className="space-y-3">
          {execLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            paginatedExecutions?.map(e => (
              <ExecutionRow key={e.id} exec={e} playbooks={playbooks ?? []} agents={agents ?? []} />
            ))
          )}
          {totalExecutions > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground" data-testid="text-executions-showing">
                Showing {safeExecPage * PAGE_SIZE + 1}–{Math.min((safeExecPage + 1) * PAGE_SIZE, totalExecutions)} of {totalExecutions}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setExecPage(p => Math.max(0, p - 1))}
                  disabled={safeExecPage === 0}
                  data-testid="button-executions-prev"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalExecPages }).map((_, i) => (
                  <Button
                    key={i}
                    variant={safeExecPage === i ? "default" : "outline"}
                    size="icon"
                    onClick={() => setExecPage(i)}
                    data-testid={`button-executions-page-${i}`}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setExecPage(p => Math.min(totalExecPages - 1, p + 1))}
                  disabled={safeExecPage >= totalExecPages - 1}
                  data-testid="button-executions-next"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
