import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAgentTaskSchema } from "@shared/schema";
import type { AgentTask } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
import {
  ListTodo, Plus, CheckCircle2, Clock, AlertTriangle, Play,
  Search, Filter, ChevronLeft, ChevronRight, Eye, BarChart3,
  Inbox, FileText, Bot, Loader2, Zap, RotateCcw, Sparkles, BookOpen
} from "lucide-react";

const PAGE_SIZE = 10;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
  scheduled: { label: "Scheduled", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300", icon: Clock },
  in_progress: { label: "Executing...", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Loader2 },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: AlertTriangle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  low: { label: "Low", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
};

const createTaskSchema = insertAgentTaskSchema.pick({
  description: true, expectedOutput: true, priority: true, context: true,
}).extend({
  description: z.string().min(5, "Description must be at least 5 characters"),
  expectedOutput: z.string().min(5, "Expected output must be at least 5 characters"),
  context: z.string().optional(),
});

export default function Tasks() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const { data: tasks, isLoading } = useQuery<AgentTask[]>({
    queryKey: ["/api/agent-tasks"],
  });

  const form = useForm({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      description: "",
      expectedOutput: "",
      priority: "medium",
      context: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createTaskSchema>) => {
      await apiRequest("POST", "/api/agent-tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-tasks"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Task created", description: "New task has been queued for AI execution." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      setExecutingIds(prev => new Set(prev).add(id));
      await apiRequest("POST", `/api/agent-tasks/${id}/execute`);
    },
    onSuccess: (_data, id) => {
      setExecutingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-tasks"] });
      toast({ title: "Task completed", description: "AI agent has finished executing this task." });
    },
    onError: (error: Error, id) => {
      setExecutingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-tasks"] });
      toast({ title: "Execution failed", description: "AI agent could not complete this task. You can retry.", variant: "destructive" });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/agent-tasks/${id}`, { status: "pending", output: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-tasks"] });
      toast({ title: "Task reset", description: "Task is ready for re-execution." });
    },
  });

  const saveToKbMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("POST", `/api/knowledge/from-task/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({ title: "Saved to Knowledge Base", description: "Task output has been published as a knowledge article." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const statusOrder: Record<string, number> = { in_progress: 0, pending: 1, scheduled: 2, completed: 3, failed: 4 };
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const filtered = (tasks ?? []).filter(t => {
    const matchSearch = !search || t.description.toLowerCase().includes(search.toLowerCase()) || (t.expectedOutput?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  }).sort((a, b) => {
    const sDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
    if (sDiff !== 0) return sDiff;
    const pDiff = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9);
    if (pDiff !== 0) return pDiff;
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const detail = detailId ? tasks?.find(t => t.id === detailId) : null;

  const stats = {
    total: tasks?.length ?? 0,
    pending: tasks?.filter(t => t.status === "pending" || t.status === "scheduled").length ?? 0,
    inProgress: tasks?.filter(t => t.status === "in_progress").length ?? 0,
    completed: tasks?.filter(t => t.status === "completed").length ?? 0,
    failed: tasks?.filter(t => t.status === "failed").length ?? 0,
    critical: tasks?.filter(t => t.priority === "critical" && t.status !== "completed").length ?? 0,
  };

  const canExecute = (task: AgentTask) => task.status === "pending" || task.status === "scheduled";
  const canRetry = (task: AgentTask) => task.status === "failed";
  const isExecuting = (id: string) => executingIds.has(id);

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">AI Agent Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">Autonomous task execution by AI agents — monitor progress and review outputs</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-task">
              <Plus className="h-4 w-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Assign Task to AI Agent</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Description</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[80px]" placeholder="What should the AI agent do?" data-testid="input-task-description" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="expectedOutput" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Deliverable</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[60px]" placeholder="What output should the agent produce?" data-testid="input-task-expected-output" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="context" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Context (optional)</FormLabel>
                    <FormControl><Textarea {...field} className="resize-none min-h-[50px]" placeholder="Background info, constraints, references..." data-testid="input-task-context" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-task">
                  {createMutation.isPending ? "Creating..." : "Create & Queue Task"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center"><ListTodo className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-total">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Clock className="h-5 w-5 text-gray-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-pending">{stats.pending}</p><p className="text-xs text-muted-foreground">Queued</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center"><Bot className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-in-progress">{stats.inProgress}</p><p className="text-xs text-muted-foreground">Executing</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-completed">{stats.completed}</p><p className="text-xs text-muted-foreground">Completed</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-failed">{stats.failed}</p><p className="text-xs text-muted-foreground">Failed</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-orange-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-critical">{stats.critical}</p><p className="text-xs text-muted-foreground">Critical</p></div>
          </CardContent></Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-search-tasks" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} data-testid="button-toggle-filters">
          <Filter className="h-4 w-4 mr-1" /> Filters
        </Button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="in_progress">Executing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={v => { setPriorityFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[140px]" data-testid="select-filter-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          {(statusFilter !== "all" || priorityFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setPage(0); }}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
        </div>
      ) : paged.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg">No tasks found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {filtered.length === 0 && (tasks?.length ?? 0) > 0 ? "Try adjusting your filters" : "Create a new task to assign it to an AI agent"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {paged.map(task => {
            const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
            const StatusIcon = statusCfg.icon;
            const executing = isExecuting(task.id);
            return (
              <Card key={task.id} className={`transition-shadow ${executing ? "ring-2 ring-blue-400/50 shadow-blue-100 dark:shadow-blue-900/30" : "hover:shadow-sm"}`} data-testid={`card-task-${task.id}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    executing ? "bg-blue-100 dark:bg-blue-900" :
                    task.status === "completed" ? "bg-green-100 dark:bg-green-900" :
                    task.status === "in_progress" ? "bg-blue-100 dark:bg-blue-900" :
                    task.status === "failed" ? "bg-red-100 dark:bg-red-900" :
                    "bg-gray-100 dark:bg-gray-800"
                  }`}>
                    {executing ? (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    ) : (
                      <StatusIcon className={`h-4 w-4 ${
                        task.status === "completed" ? "text-green-600" :
                        task.status === "in_progress" ? "text-blue-600" :
                        task.status === "failed" ? "text-red-600" :
                        "text-gray-500"
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.description}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {executing ? (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">AI agent is working on this task...</span>
                      ) : (
                        task.expectedOutput
                      )}
                    </p>
                  </div>
                  <Badge className={`${priorityCfg.color} text-xs shrink-0`}>{priorityCfg.label}</Badge>
                  <Badge className={`${executing ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : statusCfg.color} text-xs shrink-0`}>
                    {executing ? "Executing..." : statusCfg.label}
                  </Badge>
                  <div className="flex items-center gap-1 shrink-0">
                    {canExecute(task) && !executing && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1"
                        onClick={() => executeMutation.mutate(task.id)}
                        disabled={executing}
                        data-testid={`button-execute-${task.id}`}
                      >
                        <Zap className="h-3 w-3" />
                        Run Agent
                      </Button>
                    )}
                    {canRetry(task) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => retryMutation.mutate(task.id)}
                        data-testid={`button-retry-${task.id}`}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Retry
                      </Button>
                    )}
                    {task.status === "completed" && task.output && (
                      <Badge variant="outline" className="h-7 text-xs gap-1 border-green-300 text-green-700 dark:text-green-400 cursor-pointer" onClick={() => setDetailId(task.id)}>
                        <Sparkles className="h-3 w-3" />
                        View Output
                      </Badge>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDetailId(task.id)} data-testid={`button-view-${task.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs px-3">{page + 1}/{totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        {detail && (
          <DialogContent className="max-w-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Agent Task
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`${(STATUS_CONFIG[detail.status] || STATUS_CONFIG.pending).color}`}>
                  {(STATUS_CONFIG[detail.status] || STATUS_CONFIG.pending).label}
                </Badge>
                <Badge className={`${(PRIORITY_CONFIG[detail.priority] || PRIORITY_CONFIG.medium).color}`}>
                  {(PRIORITY_CONFIG[detail.priority] || PRIORITY_CONFIG.medium).label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Created {new Date(detail.createdAt!).toLocaleDateString()}
                </span>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Task Description</h4>
                <p className="text-sm">{detail.description}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Expected Deliverable</h4>
                <p className="text-sm">{detail.expectedOutput}</p>
              </div>
              {detail.context && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Context</h4>
                  <p className="text-sm text-muted-foreground">{detail.context}</p>
                </div>
              )}
              {detail.output && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI Agent Output
                  </h4>
                  <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto">{detail.output}</div>
                </div>
              )}
              {detail.completedAt && (
                <p className="text-xs text-muted-foreground">
                  Completed {new Date(detail.completedAt).toLocaleString()}
                </p>
              )}
              <div className="flex items-center gap-2 pt-2">
                {canExecute(detail) && !isExecuting(detail.id) && (
                  <Button size="sm" className="gap-1" onClick={() => { executeMutation.mutate(detail.id); setDetailId(null); }} data-testid="button-execute-detail">
                    <Zap className="h-3 w-3" /> Run Agent
                  </Button>
                )}
                {canRetry(detail) && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => { retryMutation.mutate(detail.id); setDetailId(null); }} data-testid="button-retry-detail">
                    <RotateCcw className="h-3 w-3" /> Retry
                  </Button>
                )}
                {detail.status === "completed" && detail.output && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => saveToKbMutation.mutate(detail.id)} disabled={saveToKbMutation.isPending} data-testid="button-save-kb-detail">
                    <BookOpen className="h-3 w-3" /> {saveToKbMutation.isPending ? "Saving..." : "Save to Knowledge Base"}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
