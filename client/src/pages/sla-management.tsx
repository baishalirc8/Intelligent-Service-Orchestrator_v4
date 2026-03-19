import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { SlaDefinition } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import {
  Clock, AlertTriangle, CheckCircle2, Timer, TrendingUp,
  Plus, Edit2, Trash2, Shield, Globe, Building2, Info,
  Layers, Users, ChevronDown, ChevronRight,
} from "lucide-react";

const PRIORITY_ORDER = ["critical", "high", "medium", "low"];

const PRIORITY_CONFIG: Record<string, { color: string; bgColor: string }> = {
  critical: { color: "bg-red-500/10 text-red-500 border-red-500/20", bgColor: "border-red-500/30 dark:border-red-800/40" },
  high:     { color: "bg-orange-500/10 text-orange-500 border-orange-500/20", bgColor: "border-orange-500/30 dark:border-orange-800/40" },
  medium:   { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", bgColor: "border-yellow-500/20 dark:border-yellow-800/30" },
  low:      { color: "bg-green-500/10 text-green-500 border-green-500/20", bgColor: "border-green-500/20 dark:border-green-800/30" },
};

const AGREEMENT_CONFIG = {
  sla: {
    label: "SLA", fullLabel: "Service Level Agreement",
    description: "External agreement with clients or customers defining service commitments.",
    icon: Globe, color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    tagColor: "text-blue-600 dark:text-blue-400", bgAccent: "bg-blue-500/5 border-blue-500/15",
    counterpartyLabel: "Client / Customer",
    counterpartyPlaceholder: "e.g. Acme Corp, Enterprise Clients",
  },
  ola: {
    label: "OLA", fullLabel: "Operational Level Agreement",
    description: "Internal agreement between teams or departments supporting service delivery.",
    icon: Building2, color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    tagColor: "text-purple-600 dark:text-purple-400", bgAccent: "bg-purple-500/5 border-purple-500/15",
    counterpartyLabel: "Internal Team / Department",
    counterpartyPlaceholder: "e.g. Infrastructure Team, DBA Team",
  },
};

const COMMON_SERVICES = [
  "Email Service", "CRM Application", "ERP System", "VPN Access",
  "Active Directory", "Network Infrastructure", "Database Services",
  "File Storage", "Print Services", "Help Desk Portal",
  "Web Application", "API Gateway", "Backup & Recovery",
  "Security Operations", "Monitoring Platform", "Cloud Services",
];

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${(mins / 60) % 1 === 0 ? mins / 60 : (mins / 60).toFixed(1)} hrs`;
  return `${(mins / 1440) % 1 === 0 ? mins / 1440 : (mins / 1440).toFixed(1)} days`;
}

function parseTimeToMinutes(value: string, unit: string): number {
  const num = parseFloat(value);
  if (unit === "minutes") return Math.round(num);
  if (unit === "hours") return Math.round(num * 60);
  if (unit === "days") return Math.round(num * 1440);
  return Math.round(num);
}

function minutesToField(mins: number): { value: number; unit: "minutes" | "hours" | "days" } {
  if (mins < 60) return { value: mins, unit: "minutes" };
  if (mins < 1440) return { value: mins / 60, unit: "hours" };
  return { value: mins / 1440, unit: "days" };
}

const formSchema = z.object({
  name: z.string().min(2, "Name required"),
  description: z.string().min(3, "Description required"),
  priority: z.enum(["critical", "high", "medium", "low"]),
  agreementType: z.enum(["sla", "ola"]),
  serviceScope: z.string().optional(),
  counterparty: z.string().optional(),
  responseValue: z.coerce.number().min(1, "Must be at least 1"),
  responseUnit: z.enum(["minutes", "hours", "days"]),
  resolutionValue: z.coerce.number().min(1, "Must be at least 1"),
  resolutionUnit: z.enum(["minutes", "hours", "days"]),
  escalationPolicy: z.string().optional(),
  active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

function SlaForm({ defaultValues, onSubmit, submitting, availableServices }: {
  defaultValues?: Partial<FormValues>;
  onSubmit: (v: FormValues) => void;
  submitting: boolean;
  availableServices: string[];
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", description: "", priority: "medium",
      agreementType: "sla", serviceScope: "", counterparty: "",
      responseValue: 4, responseUnit: "hours",
      resolutionValue: 8, resolutionUnit: "hours",
      escalationPolicy: "", active: true,
      ...defaultValues,
    },
  });

  const watchedType = form.watch("agreementType");
  const agCfg = AGREEMENT_CONFIG[watchedType];
  const allServices = Array.from(new Set([...COMMON_SERVICES, ...availableServices])).sort();

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField control={form.control} name="agreementType" render={({ field }) => (
            <FormItem>
              <FormLabel>Agreement Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-agreement-type"><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="sla">
                    <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-blue-500" /><span>SLA — External</span></div>
                  </SelectItem>
                  <SelectItem value="ola">
                    <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-purple-500" /><span>OLA — Internal</span></div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="priority" render={({ field }) => (
            <FormItem>
              <FormLabel>Priority Level</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-sla-priority"><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRIORITY_ORDER.map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${agCfg.bgAccent}`}>
          <Info className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${agCfg.tagColor}`} />
          <span className="text-muted-foreground"><strong className={agCfg.tagColor}>{agCfg.fullLabel}:</strong> {agCfg.description}</span>
        </div>

        <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-primary" />Service Mapping
          </p>

          <FormField control={form.control} name="serviceScope" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">
                Service / Application
                <span className="text-muted-foreground font-normal ml-1">(which service does this agreement cover?)</span>
              </FormLabel>
              <FormControl>
                <>
                  <Input
                    {...field}
                    list="service-suggestions"
                    placeholder="e.g. Email Service, CRM Application, VPN Access"
                    data-testid="input-service-scope"
                  />
                  <datalist id="service-suggestions">
                    {allServices.map(s => <option key={s} value={s} />)}
                  </datalist>
                </>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="counterparty" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">
                <Users className="inline h-3 w-3 mr-1" />
                {agCfg.counterpartyLabel}
                <span className="text-muted-foreground font-normal ml-1">(who is this agreement with?)</span>
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={agCfg.counterpartyPlaceholder} data-testid="input-counterparty" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Agreement Name</FormLabel>
            <FormControl>
              <Input {...field}
                placeholder={watchedType === "sla"
                  ? "e.g. Email Service SLA — Enterprise Clients"
                  : "e.g. Email Service OLA — Infrastructure Team"
                }
                data-testid="input-sla-name"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea {...field} rows={2}
                placeholder="Describe the scope and conditions of this agreement"
                data-testid="input-sla-description"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg border border-border bg-blue-500/5">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
              <Timer className="h-3.5 w-3.5" />Response Time Target
            </p>
            <div className="flex gap-2">
              <FormField control={form.control} name="responseValue" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl><Input {...field} type="number" min={1} step={0.5} data-testid="input-response-value" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="responseUnit" render={({ field }) => (
                <FormItem className="w-28">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-response-unit"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="minutes">minutes</SelectItem>
                      <SelectItem value="hours">hours</SelectItem>
                      <SelectItem value="days">days</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
          </div>

          <div className="p-3 rounded-lg border border-border bg-green-500/5">
            <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />Resolution Time Target
            </p>
            <div className="flex gap-2">
              <FormField control={form.control} name="resolutionValue" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl><Input {...field} type="number" min={1} step={0.5} data-testid="input-resolution-value" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="resolutionUnit" render={({ field }) => (
                <FormItem className="w-28">
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-resolution-unit"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="minutes">minutes</SelectItem>
                      <SelectItem value="hours">hours</SelectItem>
                      <SelectItem value="days">days</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>
          </div>
        </div>

        <FormField control={form.control} name="escalationPolicy" render={({ field }) => (
          <FormItem>
            <FormLabel>Escalation Policy <span className="text-muted-foreground text-xs font-normal">(optional)</span></FormLabel>
            <FormControl>
              <Textarea {...field} rows={2}
                placeholder={watchedType === "sla"
                  ? "e.g. Notify Account Manager after 50% of response window has elapsed"
                  : "e.g. Escalate to Department Head after 50% elapsed"
                }
                data-testid="input-escalation-policy"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="active" render={({ field }) => (
          <FormItem className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-sla-active" /></FormControl>
            <div>
              <FormLabel className="mb-0 cursor-pointer">Active</FormLabel>
              <p className="text-xs text-muted-foreground">Only active targets are used for breach detection</p>
            </div>
          </FormItem>
        )} />

        <Button type="submit" disabled={submitting} className="w-full" data-testid="button-sla-submit">
          {submitting ? "Saving…" : "Save Agreement"}
        </Button>
      </form>
    </Form>
  );
}

function AgreementCard({ sla, onEdit, onDelete, onToggle }: {
  sla: SlaDefinition;
  onEdit: (s: SlaDefinition) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const pCfg = PRIORITY_CONFIG[sla.priority] || PRIORITY_CONFIG.medium;
  const aCfg = AGREEMENT_CONFIG[(sla.agreementType as "sla" | "ola") ?? "sla"];
  const AIcon = aCfg.icon;

  return (
    <Card className={`border transition-opacity ${sla.active ? pCfg.bgColor : "border-border opacity-60"}`} data-testid={`card-sla-${sla.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-start gap-3">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${aCfg.color}`}>
              <AIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 capitalize ${pCfg.color}`}>{sla.priority}</Badge>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${aCfg.color}`}>{aCfg.label}</Badge>
                {!sla.active && <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">Inactive</Badge>}
              </div>
              <h3 className="font-semibold text-sm leading-tight" data-testid={`text-sla-name-${sla.id}`}>{sla.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{sla.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(sla)} data-testid={`button-edit-sla-${sla.id}`}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(sla.id)} data-testid={`button-delete-sla-${sla.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {(sla.serviceScope || sla.counterparty) && (
          <div className={`mb-3 p-2.5 rounded-lg border ${aCfg.bgAccent} flex flex-col gap-1`}>
            {sla.serviceScope && (
              <div className="flex items-center gap-2">
                <Layers className={`h-3 w-3 shrink-0 ${aCfg.tagColor}`} />
                <span className="text-xs">
                  <span className="text-muted-foreground">Service: </span>
                  <strong className={aCfg.tagColor}>{sla.serviceScope}</strong>
                </span>
              </div>
            )}
            {sla.counterparty && (
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="text-xs">
                  <span className="text-muted-foreground">{sla.agreementType === "ola" ? "Team: " : "Client: "}</span>
                  <strong>{sla.counterparty}</strong>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 min-w-0">
          <div className="bg-blue-500/5 rounded-lg p-3 border border-blue-500/10 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <Timer className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Response</span>
            </div>
            <p className="text-lg font-bold" data-testid={`text-response-time-${sla.id}`}>{formatMinutes(sla.responseTimeMinutes)}</p>
          </div>
          <div className="bg-green-500/5 rounded-lg p-3 border border-green-500/10">
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-medium text-muted-foreground">Resolution</span>
            </div>
            <p className="text-lg font-bold" data-testid={`text-resolution-time-${sla.id}`}>{formatMinutes(sla.resolutionTimeMinutes)}</p>
          </div>
        </div>

        {sla.escalationPolicy && (
          <div className="mt-3 p-2.5 bg-yellow-500/5 rounded border border-yellow-500/10">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-yellow-600 dark:text-yellow-400">Escalation: </span>{sla.escalationPolicy}
            </p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {sla.serviceScope
              ? <span>Covers <strong className={aCfg.tagColor}>{sla.serviceScope}</strong> at <strong>{sla.priority}</strong> priority</span>
              : <span>Global — all <strong>{sla.priority}</strong> priority tickets</span>
            }
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{sla.active ? "Active" : "Inactive"}</span>
            <Switch checked={sla.active} onCheckedChange={(v) => onToggle(sla.id, v)} data-testid={`switch-sla-active-${sla.id}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceGroup({ service, items, onEdit, onDelete, onToggle }: {
  service: string | null;
  items: SlaDefinition[];
  onEdit: (s: SlaDefinition) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const label = service ?? "Global — All Services";
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2 w-full"
        data-testid={`service-group-${service ?? "global"}`}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <Layers className="h-3.5 w-3.5 text-primary/60" />
        <span>{label}</span>
        <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4">{items.length}</Badge>
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-5 border-l-2 border-primary/10 ml-1.5">
          {items.map(sla => (
            <AgreementCard key={sla.id} sla={sla} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgreementPanel({ items, type, onCreate, onEdit, onDelete, onToggle, isLoading, availableServices }: {
  items: SlaDefinition[];
  type: "sla" | "ola";
  onCreate: () => void;
  onEdit: (s: SlaDefinition) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  isLoading: boolean;
  availableServices: string[];
}) {
  const cfg = AGREEMENT_CONFIG[type];
  const AIcon = cfg.icon;
  const filtered = items.filter(s => (s.agreementType ?? "sla") === type);
  const activeFiltered = filtered.filter(s => s.active);
  const missing = PRIORITY_ORDER.filter(p => !activeFiltered.some(s => s.priority === p));

  // Group by serviceScope
  const serviceGroups: Record<string, SlaDefinition[]> = {};
  for (const sla of [...filtered].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))) {
    const key = sla.serviceScope || "__global__";
    if (!serviceGroups[key]) serviceGroups[key] = [];
    serviceGroups[key].push(sla);
  }
  const serviceKeys = Object.keys(serviceGroups).sort((a, b) => a === "__global__" ? 1 : b === "__global__" ? -1 : a.localeCompare(b));

  return (
    <div className="space-y-5 pt-2">
      <div className={`p-4 rounded-lg border ${cfg.bgAccent} flex items-start gap-3`}>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
          <AIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${cfg.tagColor}`}>{cfg.fullLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Each agreement is scoped to a <strong>specific service</strong> (e.g. "Email Service") and a <strong>{type === "sla" ? "client/customer" : "team/department"}</strong>, with response and resolution time targets per priority level.
          </p>
        </div>
        <Button size="sm" onClick={onCreate} data-testid={`button-create-${type}`}>
          <Plus className="h-3.5 w-3.5 mr-1" />New {cfg.label}
        </Button>
      </div>

      {missing.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">
            <strong className="text-amber-600 dark:text-amber-400">Tip:</strong>{" "}
            No active {cfg.label} covers <strong>{missing.join(", ")}</strong> priority. Consider adding targets for complete coverage.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border border-dashed border-border">
          <CardContent className="p-10 text-center">
            <AIcon className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium mb-1">No {cfg.label} agreements defined yet</p>
            <p className="text-xs text-muted-foreground">
              {type === "sla"
                ? "Create one for each service you provide to external clients — e.g. 'Email Service SLA — Acme Corp'"
                : "Create one for each service backed by an internal team — e.g. 'Database OLA — DBA Team'"
              }
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={onCreate}>
              <Plus className="h-3.5 w-3.5 mr-1" />Create First {cfg.label}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {serviceKeys.map(key => (
            <ServiceGroup
              key={key}
              service={key === "__global__" ? null : key}
              items={serviceGroups[key]}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SlaManagement() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultType, setCreateDefaultType] = useState<"sla" | "ola">("sla");
  const [editItem, setEditItem] = useState<SlaDefinition | null>(null);

  const { data: slas = [], isLoading } = useQuery<SlaDefinition[]>({ queryKey: ["/api/sla-definitions"] });
  const { data: monitoredApps = [] } = useQuery<{ name: string }[]>({ queryKey: ["/api/monitored-applications"] });

  const availableServices = Array.from(new Set([
    ...COMMON_SERVICES,
    ...(monitoredApps as any[]).map((a: any) => a.name || "").filter(Boolean),
    ...slas.map(s => s.serviceScope || "").filter(Boolean),
  ])).sort();

  function openCreate(type: "sla" | "ola") {
    setCreateDefaultType(type);
    setCreateOpen(true);
  }

  function buildPayload(v: FormValues) {
    return {
      name: v.name, description: v.description,
      priority: v.priority, agreementType: v.agreementType,
      serviceScope: v.serviceScope || null,
      counterparty: v.counterparty || null,
      responseTimeMinutes: parseTimeToMinutes(String(v.responseValue), v.responseUnit),
      resolutionTimeMinutes: parseTimeToMinutes(String(v.resolutionValue), v.resolutionUnit),
      escalationPolicy: v.escalationPolicy || null,
      active: v.active,
    };
  }

  const createMut = useMutation({
    mutationFn: (v: FormValues) => apiRequest("POST", "/api/sla-definitions", buildPayload(v)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sla-definitions"] }); setCreateOpen(false); toast({ title: "Agreement created" }); },
    onError: () => toast({ title: "Failed to create", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, v }: { id: string; v: FormValues }) => apiRequest("PATCH", `/api/sla-definitions/${id}`, buildPayload(v)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sla-definitions"] }); setEditItem(null); toast({ title: "Agreement updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => apiRequest("PATCH", `/api/sla-definitions/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sla-definitions"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sla-definitions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sla-definitions"] }); toast({ title: "Agreement deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const slaItems = slas.filter(s => (s.agreementType ?? "sla") === "sla");
  const olaItems = slas.filter(s => s.agreementType === "ola");
  const mappedServices = Array.from(new Set(slas.map(s => s.serviceScope).filter(Boolean)));

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Shield className="h-6 w-6 text-primary" />SLA / OLA Management
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Service-scoped agreements — each SLA or OLA is tied to a specific service and counterparty, with priority-based response and resolution targets
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "SLA Agreements", value: slaItems.length, sub: "external", icon: Globe, color: "text-blue-500", bg: "bg-blue-500/10" },
          { label: "OLA Agreements", value: olaItems.length, sub: "internal", icon: Building2, color: "text-purple-500", bg: "bg-purple-500/10" },
          { label: "Services Mapped", value: mappedServices.length, sub: "distinct services", icon: Layers, color: "text-primary", bg: "bg-primary/10" },
          { label: "Active Total", value: slas.filter(s => s.active).length, sub: "used for monitoring", icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
        ].map(s => (
          <Card key={s.label} className="border border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground/60">{s.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="sla">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="sla" className="flex items-center gap-2" data-testid="tab-sla">
            <Globe className="h-3.5 w-3.5 text-blue-500" />SLA — External
            <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5">{slaItems.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="ola" className="flex items-center gap-2" data-testid="tab-ola">
            <Building2 className="h-3.5 w-3.5 text-purple-500" />OLA — Internal
            <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1.5">{olaItems.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sla">
          <AgreementPanel items={slas} type="sla" onCreate={() => openCreate("sla")}
            onEdit={setEditItem} onDelete={(id) => deleteMut.mutate(id)}
            onToggle={(id, active) => toggleMut.mutate({ id, active })}
            isLoading={isLoading} availableServices={availableServices} />
        </TabsContent>
        <TabsContent value="ola">
          <AgreementPanel items={slas} type="ola" onCreate={() => openCreate("ola")}
            onEdit={setEditItem} onDelete={(id) => deleteMut.mutate(id)}
            onToggle={(id, active) => toggleMut.mutate({ id, active })}
            isLoading={isLoading} availableServices={availableServices} />
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New {createDefaultType === "sla" ? "SLA" : "OLA"} Agreement</DialogTitle>
          </DialogHeader>
          <SlaForm
            defaultValues={{ agreementType: createDefaultType }}
            onSubmit={(v) => createMut.mutate(v)}
            submitting={createMut.isPending}
            availableServices={availableServices}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Agreement — {editItem?.name}</DialogTitle>
          </DialogHeader>
          {editItem && (() => {
            const resp = minutesToField(editItem.responseTimeMinutes);
            const resol = minutesToField(editItem.resolutionTimeMinutes);
            return (
              <SlaForm
                defaultValues={{
                  name: editItem.name, description: editItem.description,
                  priority: editItem.priority as any,
                  agreementType: (editItem.agreementType ?? "sla") as any,
                  serviceScope: editItem.serviceScope || "",
                  counterparty: editItem.counterparty || "",
                  responseValue: resp.value, responseUnit: resp.unit,
                  resolutionValue: resol.value, resolutionUnit: resol.unit,
                  escalationPolicy: editItem.escalationPolicy || "",
                  active: editItem.active,
                }}
                onSubmit={(v) => updateMut.mutate({ id: editItem.id, v })}
                submitting={updateMut.isPending}
                availableServices={availableServices}
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
