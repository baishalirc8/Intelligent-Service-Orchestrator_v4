import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { insertAgentWorkflowSchema, insertCommitteeSchema } from "@shared/schema";
import type { AgentWorkflow, WorkflowStage, Committee, RoleSubscription } from "@shared/schema";
import { z } from "zod";
import { useState } from "react";
import {
  GitBranch, Plus, CheckCircle2, Clock, AlertTriangle, XCircle,
  BarChart3, Play, Pause, Eye, Shield, Users, Vote,
  ArrowRight, ChevronRight, Zap, Bell, Lock,
  UsersRound, FileCheck, RotateCcw, TrendingUp, UserPlus, UserMinus, Crown, Search
} from "lucide-react";

type WorkflowWithStages = AgentWorkflow & { stages: WorkflowStage[] };

interface WorkflowStats {
  totalWorkflows: number;
  active: number;
  draft: number;
  completed: number;
  paused: number;
  totalStages: number;
  pendingApproval: number;
  approvedStages: number;
  rejectedStages: number;
  totalCommittees: number;
  activeCommittees: number;
  byProcessType: { sequential: number; parallel: number; conditional: number };
  byStatus: Record<string, number>;
}

const PAGE_SIZE = 10;

const WORKFLOW_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", icon: Clock },
  active: { label: "Active", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Play },
  paused: { label: "Paused", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: Pause },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: XCircle },
};

const STAGE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  task: { label: "Task", icon: FileCheck, color: "text-blue-500" },
  approval_gate: { label: "Approval Gate", icon: Vote, color: "text-purple-500" },
  automated: { label: "Automated", icon: Zap, color: "text-orange-500" },
  notification: { label: "Notification", icon: Bell, color: "text-cyan-500" },
};

const STAGE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-200 dark:bg-gray-700" },
  in_progress: { label: "In Progress", color: "bg-blue-500" },
  approved: { label: "Approved", color: "bg-green-500" },
  rejected: { label: "Rejected", color: "bg-red-500" },
  completed: { label: "Completed", color: "bg-green-500" },
  skipped: { label: "Skipped", color: "bg-gray-400" },
};

const COMMITTEE_TYPES: Record<string, { label: string; icon: typeof Shield }> = {
  cab: { label: "Change Advisory Board", icon: UsersRound },
  security_review: { label: "Security Review Board", icon: Shield },
  emergency_change: { label: "Emergency Change Committee", icon: AlertTriangle },
  problem_review: { label: "Problem Review Board", icon: RotateCcw },
  custom: { label: "Custom Committee", icon: Users },
};

const createWorkflowSchema = insertAgentWorkflowSchema.pick({
  name: true, description: true, processType: true,
}).extend({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

const createCommitteeSchema = insertCommitteeSchema.pick({
  name: true, type: true, description: true, quorumRequired: true,
}).extend({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  quorumRequired: z.coerce.number().min(1).max(20),
});

function StageTimeline({ stages, committees }: { stages: WorkflowStage[]; committees: Committee[] }) {
  const sorted = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);
  return (
    <div className="space-y-2" data-testid="workflow-stage-timeline">
      {sorted.map((stage, i) => {
        const typeConfig = STAGE_TYPE_CONFIG[stage.stageType] || STAGE_TYPE_CONFIG.task;
        const statusConfig = STAGE_STATUS_CONFIG[stage.status] || STAGE_STATUS_CONFIG.pending;
        const TypeIcon = typeConfig.icon;
        const committee = stage.committeeId ? committees.find(c => c.id === stage.committeeId) : null;
        const isComplete = stage.status === "completed" || stage.status === "approved";
        const isActive = stage.status === "in_progress" || (stage.stageType === "approval_gate" && stage.status === "pending" && stage.currentApprovals > 0);

        return (
          <div key={stage.id} className="flex items-start gap-3" data-testid={`stage-item-${stage.id}`}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                isComplete ? "border-green-500 bg-green-50 dark:bg-green-950" :
                isActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950 animate-pulse" :
                "border-muted bg-background"
              }`}>
                <TypeIcon className={`h-4 w-4 ${isComplete ? "text-green-500" : isActive ? "text-blue-500" : typeConfig.color}`} />
              </div>
              {i < sorted.length - 1 && (
                <div className={`w-0.5 h-6 ${isComplete ? "bg-green-500" : "bg-muted"}`} />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{stage.name}</span>
                <Badge variant="outline" className="text-xs">
                  {typeConfig.label}
                </Badge>
                <div className={`w-2 h-2 rounded-full ${statusConfig.color}`} title={statusConfig.label} />
                <span className="text-xs text-muted-foreground">{statusConfig.label}</span>
              </div>
              {committee && (
                <div className="flex items-center gap-1 mt-1">
                  <UsersRound className="h-3 w-3 text-purple-500" />
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">{committee.name}</span>
                  {stage.stageType === "approval_gate" && (
                    <span className="text-xs text-muted-foreground ml-1">
                      ({stage.currentApprovals}/{stage.requiredApprovals} approvals)
                    </span>
                  )}
                </div>
              )}
              {stage.notes && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{stage.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkflowCard({ workflow, committees, onClick }: { workflow: WorkflowWithStages; committees: Committee[]; onClick: () => void }) {
  const statusConfig = WORKFLOW_STATUS_CONFIG[workflow.status] || WORKFLOW_STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const completedStages = workflow.stages.filter(s => s.status === "completed" || s.status === "approved").length;
  const totalStages = workflow.stages.length;
  const progress = totalStages > 0 ? (completedStages / totalStages) * 100 : 0;
  const pendingGates = workflow.stages.filter(s => s.stageType === "approval_gate" && s.status === "pending").length;
  const activeGates = workflow.stages.filter(s => s.stageType === "approval_gate" && (s.status === "pending" && s.currentApprovals > 0)).length;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick} data-testid={`card-workflow-${workflow.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{workflow.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{workflow.description}</p>
          </div>
          <Badge className={`${statusConfig.color} shrink-0 text-xs`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {workflow.processType.charAt(0).toUpperCase() + workflow.processType.slice(1)}
          </span>
          <span>{completedStages}/{totalStages} stages</span>
          {pendingGates > 0 && (
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
              <Vote className="h-3 w-3" />
              {pendingGates} gate{pendingGates > 1 ? "s" : ""} pending
            </span>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface OrgRoleBasic { id: string; name: string; title: string; department: string; }

export default function Workflows() {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const [committeeDialogOpen, setCommitteeDialogOpen] = useState(false);
  const [committeeDetailId, setCommitteeDetailId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("workflows");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "completed" | "paused" | "pending_approval">("all");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedChair, setSelectedChair] = useState<string>("");
  const { toast } = useToast();

  const { data: workflows, isLoading: wfLoading } = useQuery<WorkflowWithStages[]>({
    queryKey: ["/api/workflows"],
  });

  const { data: stats } = useQuery<WorkflowStats>({
    queryKey: ["/api/workflows/stats"],
  });

  const { data: committees = [], isLoading: cmLoading } = useQuery<Committee[]>({
    queryKey: ["/api/committees"],
  });

  const { data: roleSubscriptions = [] } = useQuery<RoleSubscription[]>({
    queryKey: ["/api/role-subscriptions"],
  });

  const { data: orgRoles = [] } = useQuery<OrgRoleBasic[]>({
    queryKey: ["/api/org-roles"],
  });

  const getRoleName = (roleId: string) => {
    const sub = roleSubscriptions.find(s => s.roleId === roleId || s.id === roleId);
    const role = orgRoles.find(r => r.id === (sub?.roleId ?? roleId));
    const humanName = sub?.assignedHumanName;
    return humanName && role ? `${humanName} (${role.title})` : role?.title || roleId;
  };

  const assignedRoles = roleSubscriptions.filter(s => s.status === "active").map(sub => {
    const role = orgRoles.find(r => r.id === sub.roleId);
    return { subId: sub.id, roleId: sub.roleId, humanName: sub.assignedHumanName || "Unassigned", title: role?.title || "Unknown Role", department: role?.department || "" };
  });

  const filteredRoles = assignedRoles.filter(r =>
    !memberSearch || r.humanName.toLowerCase().includes(memberSearch.toLowerCase()) || r.title.toLowerCase().includes(memberSearch.toLowerCase()) || r.department.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const workflowForm = useForm({
    resolver: zodResolver(createWorkflowSchema),
    defaultValues: { name: "", description: "", processType: "sequential" },
  });

  const committeeForm = useForm({
    resolver: zodResolver(createCommitteeSchema),
    defaultValues: { name: "", type: "cab", description: "", quorumRequired: 2 },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createWorkflowSchema>) => {
      await apiRequest("POST", "/api/workflows", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows/stats"] });
      setWorkflowDialogOpen(false);
      workflowForm.reset();
      toast({ title: "Workflow created", description: "New orchestration workflow has been drafted." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createCommitteeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createCommitteeSchema>) => {
      await apiRequest("POST", "/api/committees", { ...data, memberRoleIds: selectedMembers, chairRoleId: selectedChair || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows/stats"] });
      setCommitteeDialogOpen(false);
      committeeForm.reset();
      setSelectedMembers([]);
      setSelectedChair("");
      setMemberSearch("");
      toast({ title: "Committee created", description: "New approval committee has been established." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCommitteeMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; memberRoleIds?: string[]; chairRoleId?: string | null; status?: string }) => {
      await apiRequest("PATCH", `/api/committees/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/committees"] });
      toast({ title: "Committee updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const detailCommittee = committeeDetailId ? committees.find(c => c.id === committeeDetailId) : null;

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; currentApprovals?: number; currentRejections?: number; notes?: string }) => {
      await apiRequest("PATCH", `/api/workflow-stages/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows/stats"] });
      toast({ title: "Stage updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const detailWorkflow = detailId ? workflows?.find(w => w.id === detailId) : null;

  const filteredWorkflows = (() => {
    if (!workflows) return [];
    if (statusFilter === "all") return workflows;
    if (statusFilter === "pending_approval") return workflows.filter(w => w.stages.some(s => s.stageType === "approval_gate" && s.status === "pending"));
    if (statusFilter === "paused") return workflows.filter(w => w.status === "paused" || w.status === "failed");
    return workflows.filter(w => w.status === statusFilter);
  })();

  const statusGroups = {
    active: filteredWorkflows.filter(w => w.status === "active"),
    draft: filteredWorkflows.filter(w => w.status === "draft"),
    completed: filteredWorkflows.filter(w => w.status === "completed"),
    paused: filteredWorkflows.filter(w => w.status === "paused" || w.status === "failed"),
  };

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Workflow Orchestration</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage pipelines, approval gates, and committee-driven workflows</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={committeeDialogOpen} onOpenChange={setCommitteeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-create-committee">
                <UsersRound className="h-4 w-4 mr-2" />
                New Committee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Committee</DialogTitle>
              </DialogHeader>
              <Form {...committeeForm}>
                <form onSubmit={committeeForm.handleSubmit(d => createCommitteeMutation.mutate(d))} className="space-y-4">
                  <FormField control={committeeForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. Change Advisory Board" data-testid="input-committee-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={committeeForm.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-committee-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.entries(COMMITTEE_TYPES).map(([val, cfg]) => (
                            <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={committeeForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} className="resize-none min-h-[60px]" placeholder="Committee purpose and scope" data-testid="input-committee-description" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={committeeForm.control} name="quorumRequired" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quorum Required</FormLabel>
                      <FormControl><Input {...field} type="number" min={1} max={20} data-testid="input-committee-quorum" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="space-y-2">
                    <FormLabel>Members</FormLabel>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search personnel..."
                        value={memberSearch}
                        onChange={e => setMemberSearch(e.target.value)}
                        className="pl-8"
                        data-testid="input-member-search"
                      />
                    </div>
                    <ScrollArea className="h-[160px] border rounded-md p-2">
                      {filteredRoles.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          {assignedRoles.length === 0 ? "No personnel assigned yet. Assign people to roles first." : "No matching personnel found."}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {filteredRoles.map(r => (
                            <label key={r.roleId} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer" data-testid={`member-option-${r.roleId}`}>
                              <Checkbox
                                checked={selectedMembers.includes(r.roleId)}
                                onCheckedChange={(checked) => {
                                  setSelectedMembers(prev =>
                                    checked ? [...prev, r.roleId] : prev.filter(id => id !== r.roleId)
                                  );
                                  if (!checked && selectedChair === r.roleId) setSelectedChair("");
                                }}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{r.humanName}</p>
                                <p className="text-xs text-muted-foreground truncate">{r.title} · {r.department}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    {selectedMembers.length > 0 && (
                      <p className="text-xs text-muted-foreground">{selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""} selected</p>
                    )}
                  </div>
                  {selectedMembers.length > 0 && (
                    <div className="space-y-2">
                      <FormLabel>Chair</FormLabel>
                      <Select value={selectedChair} onValueChange={setSelectedChair}>
                        <SelectTrigger data-testid="select-committee-chair">
                          <SelectValue placeholder="Select committee chair..." />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedMembers.map(roleId => {
                            const r = assignedRoles.find(ar => ar.roleId === roleId);
                            return r ? (
                              <SelectItem key={roleId} value={roleId}>{r.humanName} — {r.title}</SelectItem>
                            ) : null;
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={createCommitteeMutation.isPending} data-testid="button-submit-committee">
                    {createCommitteeMutation.isPending ? "Creating..." : "Create Committee"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-workflow">
                <Plus className="h-4 w-4 mr-2" />
                New Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Workflow</DialogTitle>
              </DialogHeader>
              <Form {...workflowForm}>
                <form onSubmit={workflowForm.handleSubmit(d => createWorkflowMutation.mutate(d))} className="space-y-4">
                  <FormField control={workflowForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input {...field} placeholder="Workflow name" data-testid="input-workflow-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={workflowForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} className="resize-none min-h-[80px]" placeholder="Workflow purpose and scope" data-testid="input-workflow-description" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={workflowForm.control} name="processType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-workflow-process-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="sequential">Sequential</SelectItem>
                          <SelectItem value="parallel">Parallel</SelectItem>
                          <SelectItem value="conditional">Conditional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={createWorkflowMutation.isPending} data-testid="button-submit-workflow">
                    {createWorkflowMutation.isPending ? "Creating..." : "Create Workflow"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "all" ? "ring-2 ring-blue-500" : ""}`} onClick={() => { setStatusFilter("all"); setActiveTab("workflows"); }} data-testid="kpi-total-workflows"><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center"><GitBranch className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-total">{stats.totalWorkflows}</p><p className="text-xs text-muted-foreground">Total Workflows</p></div>
          </CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "active" ? "ring-2 ring-green-500" : ""}`} onClick={() => { setStatusFilter(statusFilter === "active" ? "all" : "active"); setActiveTab("workflows"); }} data-testid="kpi-active-workflows"><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center"><Play className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-active">{stats.active}</p><p className="text-xs text-muted-foreground">Active</p></div>
          </CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "pending_approval" ? "ring-2 ring-purple-500" : ""}`} onClick={() => { setStatusFilter(statusFilter === "pending_approval" ? "all" : "pending_approval"); setActiveTab("workflows"); }} data-testid="kpi-pending-approval"><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center"><Vote className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-pending-approval">{stats.pendingApproval}</p><p className="text-xs text-muted-foreground">Pending Approval</p></div>
          </CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === "completed" ? "ring-2 ring-emerald-500" : ""}`} onClick={() => { setStatusFilter(statusFilter === "completed" ? "all" : "completed"); setActiveTab("workflows"); }} data-testid="kpi-completed-workflows"><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-completed">{stats.completed}</p><p className="text-xs text-muted-foreground">Completed</p></div>
          </CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:shadow-md ${activeTab === "committees" ? "ring-2 ring-amber-500" : ""}`} onClick={() => { setActiveTab(activeTab === "committees" ? "workflows" : "committees"); setStatusFilter("all"); }} data-testid="kpi-committees"><CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center"><UsersRound className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-2xl font-bold" data-testid="text-stat-committees">{stats.totalCommittees}</p><p className="text-xs text-muted-foreground">Committees</p></div>
          </CardContent></Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-workflow-view">
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="committees">Committees ({committees.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-5 mt-4">
          {wfLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-[180px] rounded-xl" />)}
            </div>
          ) : (
            <>
              {Object.entries(statusGroups).map(([groupKey, groupWorkflows]) => {
                if (groupWorkflows.length === 0) return null;
                const groupConfig = WORKFLOW_STATUS_CONFIG[groupKey] || WORKFLOW_STATUS_CONFIG.draft;
                return (
                  <div key={groupKey} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{groupConfig.label}</h2>
                      <Badge variant="secondary" className="text-xs">{groupWorkflows.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupWorkflows.map(w => (
                        <WorkflowCard key={w.id} workflow={w} committees={committees} onClick={() => setDetailId(w.id)} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredWorkflows.length === 0 && (
                <Card className="py-12">
                  <CardContent className="flex flex-col items-center justify-center text-center">
                    <GitBranch className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg">{statusFilter !== "all" ? "No matching workflows" : "No workflows yet"}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{statusFilter !== "all" ? "Try a different filter or reset by clicking Total" : "Create your first orchestration workflow to get started"}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="committees" className="mt-4">
          {cmLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[140px] rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {committees.map(c => {
                const typeConfig = COMMITTEE_TYPES[c.type] || COMMITTEE_TYPES.custom;
                const TypeIcon = typeConfig.icon;
                const chairRole = c.chairRoleId ? assignedRoles.find(r => r.roleId === c.chairRoleId) : null;
                return (
                  <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setCommitteeDetailId(c.id)} data-testid={`card-committee-${c.id}`}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                          <TypeIcon className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm">{c.name}</h3>
                            <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-xs">
                              {c.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                        </div>
                      </div>
                      {chairRole && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Crown className="h-3 w-3 text-amber-500" />
                          <span className="text-muted-foreground">Chair:</span>
                          <span className="font-medium">{chairRole.humanName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <UsersRound className="h-3 w-3" />
                          {typeConfig.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <Vote className="h-3 w-3" />
                          Quorum: {c.quorumRequired}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {c.memberRoleIds.length} member{c.memberRoleIds.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {c.memberRoleIds.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.memberRoleIds.slice(0, 4).map(roleId => (
                            <Badge key={roleId} variant="outline" className="text-xs">
                              {getRoleName(roleId)}
                            </Badge>
                          ))}
                          {c.memberRoleIds.length > 4 && (
                            <Badge variant="outline" className="text-xs">+{c.memberRoleIds.length - 4} more</Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {committees.length === 0 && (
                <Card className="col-span-full py-12">
                  <CardContent className="flex flex-col items-center justify-center text-center">
                    <UsersRound className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-semibold text-lg">No committees yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">Create an approval committee to add governance gates to workflows</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!detailWorkflow} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        {detailWorkflow && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                {detailWorkflow.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`${(WORKFLOW_STATUS_CONFIG[detailWorkflow.status] || WORKFLOW_STATUS_CONFIG.draft).color}`}>
                  {(WORKFLOW_STATUS_CONFIG[detailWorkflow.status] || WORKFLOW_STATUS_CONFIG.draft).label}
                </Badge>
                <Badge variant="outline">
                  <GitBranch className="h-3 w-3 mr-1" />
                  {detailWorkflow.processType}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Created {new Date(detailWorkflow.createdAt!).toLocaleDateString()}
                </span>
              </div>

              <p className="text-sm text-muted-foreground">{detailWorkflow.description}</p>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Stage Progress</span>
                  <span className="text-muted-foreground">
                    {detailWorkflow.stages.filter(s => s.status === "completed" || s.status === "approved").length}/{detailWorkflow.stages.length} complete
                  </span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${detailWorkflow.stages.length > 0 ? (detailWorkflow.stages.filter(s => s.status === "completed" || s.status === "approved").length / detailWorkflow.stages.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-3">Pipeline Stages</h3>
                {detailWorkflow.stages.length > 0 ? (
                  <StageTimeline stages={detailWorkflow.stages} committees={committees} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">No stages defined for this workflow yet.</p>
                )}
              </div>

              {detailWorkflow.stages.some(s => s.stageType === "approval_gate") && (
                <div>
                  <h3 className="font-semibold text-sm mb-3">Committee Gates</h3>
                  <div className="space-y-2">
                    {detailWorkflow.stages.filter(s => s.stageType === "approval_gate").map(gate => {
                      const committee = gate.committeeId ? committees.find(c => c.id === gate.committeeId) : null;
                      const isActionable = gate.status === "pending" && gate.currentApprovals < gate.requiredApprovals;
                      return (
                        <Card key={gate.id} data-testid={`card-gate-${gate.id}`}>
                          <CardContent className="p-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Vote className="h-5 w-5 text-purple-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{gate.name}</p>
                                {committee && <p className="text-xs text-muted-foreground">{committee.name}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-medium">
                                {gate.currentApprovals}/{gate.requiredApprovals}
                              </span>
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${gate.status === "approved" ? "bg-green-500" : gate.status === "rejected" ? "bg-red-500" : "bg-purple-500"}`}
                                  style={{ width: `${gate.requiredApprovals > 0 ? (gate.currentApprovals / gate.requiredApprovals) * 100 : 0}%` }}
                                />
                              </div>
                              {isActionable && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-green-600"
                                    onClick={() => updateStageMutation.mutate({
                                      id: gate.id,
                                      currentApprovals: gate.currentApprovals + 1,
                                      status: gate.currentApprovals + 1 >= gate.requiredApprovals ? "approved" : "pending",
                                    })}
                                    data-testid={`button-approve-${gate.id}`}
                                  >
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-red-600"
                                    onClick={() => updateStageMutation.mutate({
                                      id: gate.id,
                                      currentRejections: gate.currentRejections + 1,
                                      status: "rejected",
                                    })}
                                    data-testid={`button-reject-${gate.id}`}
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                              {gate.status === "approved" && (
                                <Badge className="bg-green-100 text-green-700 text-xs">Approved</Badge>
                              )}
                              {gate.status === "rejected" && (
                                <Badge className="bg-red-100 text-red-700 text-xs">Rejected</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={!!detailCommittee} onOpenChange={(open) => { if (!open) setCommitteeDetailId(null); }}>
        {detailCommittee && (() => {
          const typeConfig = COMMITTEE_TYPES[detailCommittee.type] || COMMITTEE_TYPES.custom;
          const TypeIcon = typeConfig.icon;
          const chairRole = detailCommittee.chairRoleId ? assignedRoles.find(r => r.roleId === detailCommittee.chairRoleId) : null;
          const nonMembers = assignedRoles.filter(r => !detailCommittee.memberRoleIds.includes(r.roleId));
          return (
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TypeIcon className="h-5 w-5 text-purple-600" />
                  {detailCommittee.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={detailCommittee.status === "active" ? "default" : "secondary"}>
                    {detailCommittee.status}
                  </Badge>
                  <Badge variant="outline">{typeConfig.label}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Vote className="h-3 w-3" /> Quorum: {detailCommittee.quorumRequired}
                  </span>
                </div>

                {detailCommittee.description && (
                  <p className="text-sm text-muted-foreground">{detailCommittee.description}</p>
                )}

                {chairRole && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                    <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Committee Chair</p>
                      <p className="text-sm font-medium">{chairRole.humanName}</p>
                      <p className="text-xs text-muted-foreground">{chairRole.title} · {chairRole.department}</p>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-1.5">
                      <Users className="h-4 w-4" />
                      Members ({detailCommittee.memberRoleIds.length})
                    </h3>
                  </div>
                  {detailCommittee.memberRoleIds.length > 0 ? (
                    <div className="space-y-2">
                      {detailCommittee.memberRoleIds.map(roleId => {
                        const role = assignedRoles.find(r => r.roleId === roleId);
                        const isChair = detailCommittee.chairRoleId === roleId;
                        return (
                          <div key={roleId} className="flex items-center justify-between p-2.5 rounded-lg border" data-testid={`member-row-${roleId}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center shrink-0">
                                <Users className="h-4 w-4 text-purple-600" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium truncate">{role?.humanName || "Unknown"}</p>
                                  {isChair && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                                </div>
                                <p className="text-xs text-muted-foreground truncate">{role?.title || roleId} {role ? `· ${role.department}` : ""}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!isChair && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-amber-500 hover:text-amber-600"
                                  title="Make chair"
                                  onClick={() => updateCommitteeMutation.mutate({ id: detailCommittee.id, chairRoleId: roleId })}
                                  data-testid={`button-make-chair-${roleId}`}
                                >
                                  <Crown className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                                title="Remove member"
                                onClick={() => {
                                  const newMembers = detailCommittee.memberRoleIds.filter(id => id !== roleId);
                                  const updates: { id: string; memberRoleIds: string[]; chairRoleId?: string | null } = { id: detailCommittee.id, memberRoleIds: newMembers };
                                  if (isChair) updates.chairRoleId = null;
                                  updateCommitteeMutation.mutate(updates);
                                }}
                                data-testid={`button-remove-member-${roleId}`}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-4">No members assigned yet</p>
                  )}
                </div>

                {nonMembers.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <UserPlus className="h-4 w-4" />
                      Add Members
                    </h3>
                    <ScrollArea className="h-[180px] border rounded-md p-2">
                      <div className="space-y-1">
                        {nonMembers.map(r => (
                          <div key={r.roleId} className="flex items-center justify-between p-1.5 rounded hover:bg-muted" data-testid={`add-member-${r.roleId}`}>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{r.humanName}</p>
                              <p className="text-xs text-muted-foreground truncate">{r.title} · {r.department}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs shrink-0"
                              onClick={() => updateCommitteeMutation.mutate({
                                id: detailCommittee.id,
                                memberRoleIds: [...detailCommittee.memberRoleIds, r.roleId],
                              })}
                              data-testid={`button-add-member-${r.roleId}`}
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1" />
                              Add
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}
