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
import type { KnownError } from "@shared/schema";
import { BookMarked, Plus, Search, ChevronDown, ChevronUp, Trash2, Edit2, CheckCircle2, Clock, AlertTriangle, XCircle, Lightbulb, Wrench } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: "Open", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", icon: Clock },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  obsolete: { label: "Obsolete", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: XCircle },
};

const formSchema = z.object({
  title: z.string().min(3, "Title required"),
  description: z.string().min(5, "Description required"),
  rootCause: z.string().optional(),
  workaround: z.string().min(5, "Workaround required"),
  resolution: z.string().optional(),
  status: z.enum(["open", "resolved", "obsolete"]),
  affectedServices: z.string().optional(),
  incidentCount: z.coerce.number().min(0).default(0),
});

type FormValues = z.infer<typeof formSchema>;

function KnownErrorCard({ ke, onEdit, onDelete }: { ke: KnownError; onEdit: (ke: KnownError) => void; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[ke.status] || STATUS_CONFIG.open;
  const Icon = cfg.icon;

  return (
    <Card className="border border-border" data-testid={`card-ke-${ke.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <BookMarked className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground" data-testid={`text-ke-id-${ke.id}`}>{ke.kedbId}</span>
                <Badge variant="outline" className={cfg.color}><Icon className="h-3 w-3 mr-1" />{cfg.label}</Badge>
                {ke.incidentCount > 0 && (
                  <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />{ke.incidentCount} incidents
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(ke)} data-testid={`button-edit-ke-${ke.id}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(ke.id)} data-testid={`button-delete-ke-${ke.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setExpanded(!expanded)} data-testid={`button-expand-ke-${ke.id}`}>
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
            <h3 className="font-semibold text-sm mt-1" data-testid={`text-ke-title-${ke.id}`}>{ke.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ke.description}</p>

            {ke.affectedServices && ke.affectedServices.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ke.affectedServices.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                ))}
              </div>
            )}

            {expanded && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                {ke.rootCause && (
                  <div className="p-2.5 rounded-md bg-red-500/5 border border-red-500/10">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Root Cause</p>
                    <p className="text-xs text-muted-foreground">{ke.rootCause}</p>
                  </div>
                )}
                <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/10">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1"><Lightbulb className="h-3 w-3" />Workaround</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{ke.workaround}</p>
                </div>
                {ke.resolution && (
                  <div className="p-2.5 rounded-md bg-green-500/5 border border-green-500/10">
                    <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1 flex items-center gap-1"><Wrench className="h-3 w-3" />Permanent Fix</p>
                    <p className="text-xs text-muted-foreground">{ke.resolution}</p>
                  </div>
                )}
                {ke.reviewDate && (
                  <p className="text-xs text-muted-foreground">Review scheduled: {new Date(ke.reviewDate).toLocaleDateString()}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KeForm({ defaultValues, onSubmit, submitting }: { defaultValues?: Partial<FormValues>; onSubmit: (v: FormValues) => void; submitting: boolean }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "", description: "", rootCause: "", workaround: "", resolution: "",
      status: "open", affectedServices: "", incidentCount: 0,
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} placeholder="Brief title of the known error" data-testid="input-ke-title" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="What is the known error?" data-testid="input-ke-description" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="rootCause" render={({ field }) => (
          <FormItem><FormLabel>Root Cause <span className="text-muted-foreground text-xs">(optional)</span></FormLabel><FormControl><Textarea {...field} rows={2} placeholder="Identified root cause" data-testid="input-ke-rootcause" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="workaround" render={({ field }) => (
          <FormItem><FormLabel>Workaround <span className="text-red-500">*</span></FormLabel><FormControl><Textarea {...field} rows={3} placeholder="Steps to work around the issue" data-testid="input-ke-workaround" /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="resolution" render={({ field }) => (
          <FormItem><FormLabel>Permanent Resolution <span className="text-muted-foreground text-xs">(optional)</span></FormLabel><FormControl><Textarea {...field} rows={2} placeholder="Permanent fix if known" data-testid="input-ke-resolution" /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger data-testid="select-ke-status"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="obsolete">Obsolete</SelectItem>
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="incidentCount" render={({ field }) => (
            <FormItem><FormLabel>Related Incidents</FormLabel><FormControl><Input {...field} type="number" min={0} data-testid="input-ke-incidents" /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="affectedServices" render={({ field }) => (
          <FormItem><FormLabel>Affected Services <span className="text-muted-foreground text-xs">(comma-separated)</span></FormLabel>
            <FormControl><Input {...field} placeholder="e.g. Email, VPN, ERP" data-testid="input-ke-services" /></FormControl><FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={submitting} className="w-full" data-testid="button-ke-submit">{submitting ? "Saving…" : "Save Known Error"}</Button>
      </form>
    </Form>
  );
}

export default function KnownErrorsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<KnownError | null>(null);

  const { data: items = [], isLoading } = useQuery<KnownError[]>({ queryKey: ["/api/known-errors"] });

  const createMut = useMutation({
    mutationFn: (v: FormValues) => apiRequest("POST", "/api/known-errors", {
      ...v,
      affectedServices: v.affectedServices ? v.affectedServices.split(",").map(s => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/known-errors"] }); setCreateOpen(false); toast({ title: "Known error created" }); },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, v }: { id: number; v: FormValues }) => apiRequest("PATCH", `/api/known-errors/${id}`, {
      ...v,
      affectedServices: v.affectedServices ? v.affectedServices.split(",").map(s => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/known-errors"] }); setEditItem(null); toast({ title: "Known error updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/known-errors/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/known-errors"] }); toast({ title: "Deleted" }); },
  });

  const filtered = items.filter(ke => {
    if (statusFilter !== "all" && ke.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return ke.title.toLowerCase().includes(q) || ke.kedbId.toLowerCase().includes(q) || ke.description.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: items.length,
    open: items.filter(k => k.status === "open").length,
    resolved: items.filter(k => k.status === "resolved").length,
    totalIncidents: items.reduce((a, k) => a + (k.incidentCount || 0), 0),
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookMarked className="h-6 w-6 text-amber-500" />Known Error Database</h1>
          <p className="text-sm text-muted-foreground mt-0.5">ITIL KEDB — documented errors with workarounds and fixes</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-ke"><Plus className="h-4 w-4 mr-1" />New Known Error</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Register Known Error</DialogTitle></DialogHeader>
            <KeForm onSubmit={(v) => createMut.mutate(v)} submitting={createMut.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Records", value: stats.total, color: "text-primary" },
          { label: "Open", value: stats.open, color: "text-yellow-500" },
          { label: "Resolved", value: stats.resolved, color: "text-green-500" },
          { label: "Related Incidents", value: stats.totalIncidents, color: "text-red-500" },
        ].map(s => (
          <Card key={s.label} className="border border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`} data-testid={`stat-ke-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search known errors…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-ke" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="select-filter-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="obsolete">Obsolete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed border-border">
          <CardContent className="p-10 text-center">
            <BookMarked className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No known errors found. Create the first entry to build your KEDB.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(ke => (
            <KnownErrorCard key={ke.id} ke={ke} onEdit={setEditItem} onDelete={(id) => deleteMut.mutate(id)} />
          ))}
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Known Error — {editItem?.kedbId}</DialogTitle></DialogHeader>
          {editItem && (
            <KeForm
              defaultValues={{
                title: editItem.title,
                description: editItem.description,
                rootCause: editItem.rootCause || "",
                workaround: editItem.workaround,
                resolution: editItem.resolution || "",
                status: editItem.status as any,
                affectedServices: (editItem.affectedServices || []).join(", "),
                incidentCount: editItem.incidentCount,
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
