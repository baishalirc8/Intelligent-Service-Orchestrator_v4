import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import type { Release, ReleaseItem } from "@shared/schema";
import { Package, Plus, Search, CheckCircle2, Clock, Rocket, ChevronDown, ChevronUp, Trash2, Edit2, Shield, XCircle, Wrench, RefreshCw, PlayCircle, AlertTriangle } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  planned: { label: "Planned", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", icon: Clock },
  building: { label: "Building", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", icon: Wrench },
  testing: { label: "Testing", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: Shield },
  ready: { label: "Ready for Go-Live", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300", icon: CheckCircle2 },
  deploying: { label: "Deploying", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", icon: Rocket },
  deployed: { label: "Deployed", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  rolled_back: { label: "Rolled Back", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", icon: RefreshCw },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: XCircle },
};

const TYPE_COLORS: Record<string, string> = {
  major: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  minor: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  patch: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  emergency: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  pending: "text-gray-500",
  deployed: "text-green-500",
  failed: "text-red-500",
  rolled_back: "text-orange-500",
};

const formSchema = z.object({
  title: z.string().min(3, "Title required"),
  description: z.string().min(5, "Description required"),
  type: z.enum(["major", "minor", "patch", "emergency"]),
  version: z.string().min(1, "Version required"),
  status: z.enum(["planned", "building", "testing", "ready", "deploying", "deployed", "rolled_back", "cancelled"]),
  environment: z.enum(["development", "staging", "production"]),
  plannedStart: z.string().optional(),
  plannedEnd: z.string().optional(),
  releaseManager: z.string().optional(),
  rollbackPlan: z.string().optional(),
  affectedServices: z.string().optional(),
  deploymentNotes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function ReleaseCard({ release, onEdit, onDelete }: { release: Release; onEdit: (r: Release) => void; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const { data: items = [] } = useQuery<ReleaseItem[]>({
    queryKey: ["/api/releases", release.id, "items"],
    queryFn: () => fetch(`/api/releases/${release.id}/items`, { credentials: "include" }).then(r => r.json()),
    enabled: expanded,
  });
  const { toast } = useToast();

  const approveMut = useMutation({
    mutationFn: () => apiRequest("POST", `/api/releases/${release.id}/approve`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/releases"] }); toast({ title: "Go-live approved" }); },
  });

  const updateStatusMut = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/releases/${release.id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/releases"] }),
  });

  const cfg = STATUS_CONFIG[release.status] || STATUS_CONFIG.planned;
  const Icon = cfg.icon;
  const isReadyForApproval = release.status === "ready" && !release.goLiveApproval;

  const LIFECYCLE = ["planned", "building", "testing", "ready", "deploying", "deployed"];
  const currentIdx = LIFECYCLE.indexOf(release.status);

  return (
    <Card className={`border ${release.status === "deployed" ? "border-green-500/30" : isReadyForApproval ? "border-cyan-500/30 dark:border-cyan-800/50" : "border-border"}`} data-testid={`card-release-${release.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground" data-testid={`text-rel-id-${release.id}`}>{release.releaseId}</span>
                <Badge variant="outline" className={cfg.color}><Icon className="h-3 w-3 mr-1" />{cfg.label}</Badge>
                <Badge variant="outline" className={`text-xs ${TYPE_COLORS[release.type]}`}>{release.type}</Badge>
                <Badge variant="secondary" className="text-xs font-mono">v{release.version}</Badge>
                <Badge variant="outline" className="text-xs capitalize">{release.environment}</Badge>
              </div>
              <div className="flex items-center gap-1">
                {isReadyForApproval && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => approveMut.mutate()} disabled={approveMut.isPending} data-testid={`button-approve-release-${release.id}`}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />Go-Live Approve
                  </Button>
                )}
                {release.goLiveApproval && ["ready", "deploying"].includes(release.status) && (
                  <Button size="sm" className="bg-primary h-7 text-xs" onClick={() => updateStatusMut.mutate("deployed")} data-testid={`button-deploy-release-${release.id}`}>
                    <Rocket className="h-3 w-3 mr-1" />Mark Deployed
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(release)} data-testid={`button-edit-release-${release.id}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(release.id)} data-testid={`button-delete-release-${release.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(!expanded)} data-testid={`button-expand-release-${release.id}`}>
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            <h3 className="font-semibold text-sm mt-1" data-testid={`text-rel-title-${release.id}`}>{release.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{release.description}</p>

            {LIFECYCLE.includes(release.status) && (
              <div className="flex items-center gap-1 mt-2">
                {LIFECYCLE.map((s, i) => {
                  const isCurrent = i === currentIdx;
                  const isPast = i < currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <div className={`h-2 w-2 rounded-full ${isCurrent ? "bg-primary ring-2 ring-primary/30" : isPast ? "bg-green-500" : "bg-muted-foreground/20"}`} title={STATUS_CONFIG[s]?.label} />
                      {i < LIFECYCLE.length - 1 && <div className={`h-px w-4 ${isPast ? "bg-green-500" : "bg-muted-foreground/20"}`} />}
                    </div>
                  );
                })}
                <span className="text-xs text-muted-foreground ml-2">{cfg.label}</span>
              </div>
            )}

            {release.goLiveApproval && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                <CheckCircle2 className="inline h-3 w-3 mr-0.5" />Go-live approved by {release.goLiveApprovedBy}
              </p>
            )}

            {expanded && (
              <div className="mt-3 border-t border-border pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {release.releaseManager && <p>Release Manager: <span className="text-foreground">{release.releaseManager}</span></p>}
                  {release.plannedStart && <p>Planned Start: {new Date(release.plannedStart).toLocaleDateString()}</p>}
                  {release.plannedEnd && <p>Planned End: {new Date(release.plannedEnd).toLocaleDateString()}</p>}
                  {release.affectedServices && release.affectedServices.length > 0 && (
                    <p className="col-span-2">Services: {release.affectedServices.join(", ")}</p>
                  )}
                </div>
                {release.rollbackPlan && (
                  <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/10">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1"><RefreshCw className="h-3 w-3" />Rollback Plan</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{release.rollbackPlan}</p>
                  </div>
                )}
                {release.deploymentNotes && (
                  <div className="p-2.5 rounded bg-muted/30 border border-border">
                    <p className="text-xs font-semibold mb-1">Deployment Notes</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{release.deploymentNotes}</p>
                  </div>
                )}
                {items.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Release Items ({items.length})</p>
                    <div className="space-y-1">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/20 border border-border" data-testid={`row-relitem-${item.id}`}>
                          <div className="flex items-center gap-2">
                            <span className={ITEM_STATUS_COLORS[item.status]}>●</span>
                            <span>{item.title}</span>
                            <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                          </div>
                          <span className="capitalize text-muted-foreground">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {["planned", "building", "testing", "ready", "deploying"].map(s => (
                    s !== release.status && LIFECYCLE.indexOf(s) > LIFECYCLE.indexOf(release.status) - 1 && (
                      <Button key={s} size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatusMut.mutate(s)} data-testid={`button-advance-${s}-${release.id}`}>
                        <PlayCircle className="h-3 w-3 mr-1" />Move to {STATUS_CONFIG[s]?.label}
                      </Button>
                    )
                  ))}
                  {!["cancelled", "rolled_back", "deployed"].includes(release.status) && (
                    <>
                      <Button size="sm" variant="outline" className="text-xs h-7 text-red-500 border-red-300" onClick={() => updateStatusMut.mutate("rolled_back")} data-testid={`button-rollback-${release.id}`}>
                        <RefreshCw className="h-3 w-3 mr-1" />Roll Back
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 text-gray-500" onClick={() => updateStatusMut.mutate("cancelled")} data-testid={`button-cancel-${release.id}`}>
                        <XCircle className="h-3 w-3 mr-1" />Cancel
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReleaseForm({ defaultValues, onSubmit, submitting }: { defaultValues?: Partial<FormValues>; onSubmit: (v: FormValues) => void; submitting: boolean }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", type: "minor", version: "", status: "planned", environment: "production", plannedStart: "", plannedEnd: "", releaseManager: "", rollbackPlan: "", affectedServices: "", deploymentNotes: "", ...defaultValues },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="Release title" data-testid="input-release-title" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} data-testid="input-release-description" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField control={form.control} name="type" render={({ field }) => (
            <FormItem><FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger data-testid="select-release-type"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {["major", "minor", "patch", "emergency"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="version" render={({ field }) => (
            <FormItem><FormLabel>Version</FormLabel><FormControl><Input {...field} placeholder="e.g. 2.4.1" data-testid="input-release-version" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="environment" render={({ field }) => (
            <FormItem><FormLabel>Environment</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger data-testid="select-release-env"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger data-testid="select-release-status"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="releaseManager" render={({ field }) => (
            <FormItem><FormLabel>Release Manager</FormLabel><FormControl><Input {...field} data-testid="input-release-manager" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="plannedStart" render={({ field }) => (
            <FormItem><FormLabel>Planned Start</FormLabel><FormControl><Input {...field} type="date" data-testid="input-release-start" /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="plannedEnd" render={({ field }) => (
            <FormItem><FormLabel>Planned End</FormLabel><FormControl><Input {...field} type="date" data-testid="input-release-end" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="affectedServices" render={({ field }) => (
          <FormItem><FormLabel>Affected Services <span className="text-muted-foreground text-xs">(comma-separated)</span></FormLabel><FormControl><Input {...field} placeholder="e.g. API Gateway, User Service" data-testid="input-release-services" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="rollbackPlan" render={({ field }) => (
          <FormItem><FormLabel>Rollback Plan</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="Steps to rollback this release if needed" data-testid="input-release-rollback" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="deploymentNotes" render={({ field }) => (
          <FormItem><FormLabel>Deployment Notes</FormLabel><FormControl><Textarea {...field} rows={2} data-testid="input-release-notes" /></FormControl><FormMessage /></FormItem>
        )} />
        <Button type="submit" disabled={submitting} className="w-full" data-testid="button-release-submit">{submitting ? "Saving…" : "Save Release"}</Button>
      </form>
    </Form>
  );
}

export default function ReleaseManagementPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [envFilter, setEnvFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<Release | null>(null);

  const { data: releases = [], isLoading } = useQuery<Release[]>({ queryKey: ["/api/releases"] });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => apiRequest("POST", "/api/releases", {
      ...v,
      plannedStart: v.plannedStart ? new Date(v.plannedStart) : null,
      plannedEnd: v.plannedEnd ? new Date(v.plannedEnd) : null,
      affectedServices: v.affectedServices ? v.affectedServices.split(",").map(s => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/releases"] }); setCreateOpen(false); toast({ title: "Release created" }); },
    onError: () => toast({ title: "Failed to create release", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, v }: { id: number; v: FormValues }) => apiRequest("PATCH", `/api/releases/${id}`, {
      ...v,
      plannedStart: v.plannedStart ? new Date(v.plannedStart) : null,
      plannedEnd: v.plannedEnd ? new Date(v.plannedEnd) : null,
      affectedServices: v.affectedServices ? v.affectedServices.split(",").map(s => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/releases"] }); setEditItem(null); toast({ title: "Release updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/releases/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/releases"] }); toast({ title: "Release deleted" }); },
  });

  const filtered = releases.filter(r => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (envFilter !== "all" && r.environment !== envFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.releaseId.toLowerCase().includes(q) || r.version.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: releases.length,
    active: releases.filter(r => !["deployed", "cancelled", "rolled_back"].includes(r.status)).length,
    deployed: releases.filter(r => r.status === "deployed").length,
    awaitingApproval: releases.filter(r => r.status === "ready" && !r.goLiveApproval).length,
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6 text-primary" />Release Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ITIL Release Management — pipeline from planning to go-live with approval gates</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-release"><Plus className="h-4 w-4 mr-1" />New Release</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Release</DialogTitle></DialogHeader>
            <ReleaseForm onSubmit={(v) => createMut.mutate(v)} submitting={createMut.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Releases", value: stats.total, color: "text-primary" },
          { label: "Active", value: stats.active, color: "text-blue-500" },
          { label: "Deployed", value: stats.deployed, color: "text-green-500" },
          { label: "Awaiting Approval", value: stats.awaitingApproval, color: "text-cyan-500" },
        ].map(s => (
          <Card key={s.label} className="border border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`} data-testid={`stat-release-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search releases…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-releases" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44" data-testid="select-release-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={envFilter} onValueChange={setEnvFilter}>
          <SelectTrigger className="w-36" data-testid="select-release-filter-env"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Environments</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed border-border">
          <CardContent className="p-10 text-center">
            <Package className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No releases found. Plan your first release to begin the pipeline.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <ReleaseCard key={r.id} release={r} onEdit={setEditItem} onDelete={(id) => deleteMut.mutate(id)} />
          ))}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Release — {editItem?.releaseId}</DialogTitle></DialogHeader>
          {editItem && (
            <ReleaseForm
              defaultValues={{
                title: editItem.title, description: editItem.description,
                type: editItem.type as any, version: editItem.version,
                status: editItem.status as any, environment: editItem.environment as any,
                plannedStart: editItem.plannedStart ? new Date(editItem.plannedStart).toISOString().split("T")[0] : "",
                plannedEnd: editItem.plannedEnd ? new Date(editItem.plannedEnd).toISOString().split("T")[0] : "",
                releaseManager: editItem.releaseManager || "",
                rollbackPlan: editItem.rollbackPlan || "",
                affectedServices: (editItem.affectedServices || []).join(", "),
                deploymentNotes: editItem.deploymentNotes || "",
              }}
              onSubmit={(v) => updateMut.mutate({ id: editItem.id, v })}
              submitting={updateMut.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
