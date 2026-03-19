import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plane, Users, FileText, FolderOpen, Video, DollarSign,
  Plus, RefreshCw, Award, CheckCircle, Clock, XCircle, Eye,
  Trash2, Pencil, Star, MapPin, Phone, Mail, Building2, 
  ShieldCheck, Gauge, Camera, Weight, Battery,
  AlertCircle, CircleDollarSign, Package, Link2, Unlink2, Cpu, Globe,
  Wifi, WifiOff, Copy, ExternalLink, Terminal, Info, Zap, Navigation,
  Brain, Sparkles, Wand2, Users2, X, Search
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import type {
  FlyguysOperator, FlyguysFleet, FlyguysRequest,
  FlyguaysBid, FlyguysProject, FlyguysDeliverable, FlyguysTransaction,
  DiscoveryProbe
} from "@shared/schema";

// ── Status badge helpers ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    bidding: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    awarded:        "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    "under-review": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    published:      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    claimed:        "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    "in-progress": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    active: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    suspended: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    available: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    "in-mission": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    maintenance: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replace(/-/g, " ")}
    </span>
  );
}

function fmt(cents?: number | null) {
  if (!cents && cents !== 0) return "—";
  return `$${(cents).toLocaleString()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD TAB
// ─────────────────────────────────────────────────────────────────────────────
function DashboardTab({
  requests, projects, operators, fleet, transactions
}: {
  requests: FlyguysRequest[];
  projects: FlyguysProject[];
  operators: FlyguysOperator[];
  fleet: FlyguysFleet[];
  transactions: FlyguysTransaction[];
}) {
  const totalRevenue = transactions.filter(t => t.type === "customer-payment" && t.status === "completed").reduce((s, t) => s + (t.amountUsd ?? 0), 0);
  const activeProjects = projects.filter(p => ["active", "in-progress"].includes(p.status)).length;
  const openRequests = requests.filter(r => r.status === "open").length;
  const underReviewRequests = requests.filter(r => r.status === "under-review").length;
  const publishedRequests = requests.filter(r => r.status === "published").length;
  const approvedOps = operators.filter(o => o.status === "approved").length;

  const kpis = [
    { label: "New Requests", value: openRequests, icon: FileText, color: "text-blue-500" },
    { label: "Under Review", value: underReviewRequests, icon: Clock, color: "text-amber-500" },
    { label: "Published Missions", value: publishedRequests, icon: Zap, color: "text-indigo-500" },
    { label: "Active Projects", value: activeProjects, icon: FolderOpen, color: "text-orange-500" },
    { label: "Approved Operators", value: approvedOps, icon: Users, color: "text-purple-500" },
    { label: "Revenue Collected", value: fmt(totalRevenue), icon: CircleDollarSign, color: "text-green-500" },
  ];

  const recentRequests = requests.slice(0, 5);
  const recentProjects = projects.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => (
          <Card key={k.label} data-testid={`kpi-${k.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-4 flex flex-col gap-1">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              <p className="text-2xl font-bold">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* World Mission Map */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500" /> Customer Requests — World Map
            <span className="ml-auto text-[10px] font-normal text-muted-foreground flex items-center gap-2 flex-wrap">
              {[["open","#3b82f6"],["under-review","#f59e0b"],["published","#6366f1"],["in-progress","#f97316"],["delivered","#10b981"]].map(([s,c]) => (
                <span key={s} className="flex items-center gap-1">
                  <span style={{ background: c }} className="inline-block w-2.5 h-2.5 rounded-full" />
                  <span className="capitalize">{s}</span>
                </span>
              ))}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg overflow-hidden" style={{ height: 380 }}>
            {requests.filter(r => (r as any).locationLat && (r as any).locationLng).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <MapPin className="w-8 h-8 opacity-30" />
                <p className="text-sm">No requests with location pins yet.</p>
                <p className="text-xs">Ask customers to provide lat/long when raising a request.</p>
              </div>
            ) : (
              <MapContainer
                center={[39.5, -98.35]}
                zoom={4}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <MapResizer />
                <FitBounds coords={requests.filter(r => (r as any).locationLat && (r as any).locationLng).map(r => [(r as any).locationLat as number, (r as any).locationLng as number])} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
                {requests.filter(r => (r as any).locationLat && (r as any).locationLng).map(r => (
                  <Marker
                    key={r.id}
                    position={[(r as any).locationLat as number, (r as any).locationLng as number]}
                    icon={createStatusIcon(r.status)}
                  >
                    <Popup>
                      <div className="text-xs space-y-1 min-w-[160px]">
                        <p className="font-semibold text-sm">{r.title}</p>
                        <p className="text-muted-foreground">{r.customerName}</p>
                        <p className="capitalize">{r.serviceType} · <StatusBadge status={r.status} /></p>
                        {r.budgetUsd && <p>Budget: ${r.budgetUsd.toLocaleString()}</p>}
                        <p className="text-muted-foreground">{r.location}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" /> Recent Customer Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 pb-4">No requests yet</p>
            ) : (
              <div className="divide-y">
                {recentRequests.map(r => (
                  <div key={r.id} className="px-4 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.customerName} · {r.serviceType}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-orange-500" /> Active Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground px-4 pb-4">No projects yet</p>
            ) : (
              <div className="divide-y">
                {recentProjects.map(p => (
                  <div key={p.id} className="px-4 py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.customerName} · {fmt(p.projectValueUsd)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER REQUESTS TAB
// ─────────────────────────────────────────────────────────────────────────────
const requestSchema = z.object({
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  customerCompany: z.string().optional(),
  title: z.string().min(5),
  serviceType: z.string().min(1),
  location: z.string().min(2),
  locationLat: z.coerce.number().optional(),
  locationLng: z.coerce.number().optional(),
  description: z.string().optional(),
  budgetUsd: z.coerce.number().optional(),
  preferredDate: z.string().optional(),
});

// Fix default Leaflet icon paths (webpack/vite asset issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Status-based marker colors for the dashboard map
function createStatusIcon(status: string) {
  const colors: Record<string, string> = {
    open: "#3b82f6", "under-review": "#f59e0b", published: "#6366f1",
    claimed: "#14b8a6", "in-progress": "#f97316", delivered: "#10b981", cancelled: "#ef4444",
  };
  const color = colors[status] ?? "#6b7280";
  return L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -8],
  });
}

// Map size fixer — needed when Leaflet renders inside a hidden container (e.g. Dialog)
function MapResizer() {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 80); }, [map]);
  return null;
}

// Auto-fit map bounds to a set of coordinates
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 9);
    } else {
      const L = (map as any)._leaflet_id !== undefined ? (window as any).L : null;
      try {
        const bounds = coords.reduce<[[number, number], [number, number]]>(
          ([sw, ne], [lat, lng]) => [
            [Math.min(sw[0], lat), Math.min(sw[1], lng)],
            [Math.max(ne[0], lat), Math.max(ne[1], lng)],
          ],
          [coords[0], coords[0]]
        );
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
      } catch { /* ignore */ }
    }
  }, [map, JSON.stringify(coords)]);
  return null;
}

// Click handler for the location picker map
function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Mini location picker embedded in the New Request dialog
function LocationPicker({ lat, lng, onPick }: { lat?: number; lng?: number; onPick: (lat: number, lng: number) => void }) {
  const center: [number, number] = lat && lng ? [lat, lng] : [20, 0];
  return (
    <div className="rounded-md overflow-hidden border" style={{ height: 200 }}>
      <MapContainer center={center} zoom={lat && lng ? 9 : 2} style={{ height: "100%", width: "100%" }}>
        <MapResizer />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        <MapClickHandler onPick={onPick} />
        {lat && lng && <Marker position={[lat, lng]} />}
      </MapContainer>
    </div>
  );
}

// AI Drone Recommendation badge for request rows
interface AiRecommendation {
  recommendedDroneType: string;
  reasoning: string;
  confidence: number;
  shortlistedOperatorIds: string[];
  operatorReasons: Record<string, string>;
}
function parseAiRec(json?: string | null): AiRecommendation | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

const reviewSchema = z.object({
  flyguysNotes: z.string().optional(),
  adjustedAmountUsd: z.coerce.number().optional(),
  splitType: z.enum(["single", "multi"]).default("single"),
  assignedOperatorIds: z.array(z.string()).default([]),
});
const publishSchema = z.object({
  adjustedAmountUsd: z.coerce.number().min(1, "Required"),
  requiredDroneType: z.string().min(1, "Required"),
  flyguysNotes: z.string().optional(),
});

function RequestsTab({ requests, operators }: { requests: FlyguysRequest[]; operators: FlyguysOperator[] }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [actionReq, setActionReq] = useState<FlyguysRequest | null>(null);

  const form = useForm({ resolver: zodResolver(requestSchema), defaultValues: {
    customerName: user?.displayName ?? "", customerEmail: user?.email ?? "", customerPhone: "", customerCompany: user?.companyName ?? "",
    title: "", serviceType: "", location: "", locationLat: undefined as number | undefined, locationLng: undefined as number | undefined, description: "", budgetUsd: undefined, preferredDate: "",
  }});
  const watchedLat = form.watch("locationLat");
  const watchedLng = form.watch("locationLng");

  // Re-populate contact fields from profile each time the dialog opens
  useEffect(() => {
    if (open && user) {
      form.setValue("customerName", form.getValues("customerName") || user.displayName);
      form.setValue("customerEmail", form.getValues("customerEmail") || (user.email ?? ""));
      form.setValue("customerCompany", form.getValues("customerCompany") || (user.companyName ?? ""));
    }
  }, [open, user]);

  const reviewForm = useForm({ resolver: zodResolver(reviewSchema), defaultValues: { flyguysNotes: "", adjustedAmountUsd: undefined, splitType: "single" as "single" | "multi", assignedOperatorIds: [] as string[] } });
  const watchedSplitType = reviewForm.watch("splitType");
  const watchedAssignedIds = reviewForm.watch("assignedOperatorIds");
  const watchedReviewAmount = reviewForm.watch("adjustedAmountUsd");
  const publishForm = useForm({ resolver: zodResolver(publishSchema), defaultValues: { adjustedAmountUsd: undefined, requiredDroneType: "", flyguysNotes: "" } });

  const createMut = useMutation({
    mutationFn: async (data: z.infer<typeof requestSchema>) => {
      const r = await apiRequest("POST", "/api/flyguys/requests", data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/requests"] });
      setOpen(false);
      form.reset({
        customerName: user?.displayName ?? "", customerEmail: user?.email ?? "", customerPhone: "", customerCompany: user?.companyName ?? "",
        title: "", serviceType: "", location: "", locationLat: undefined, locationLng: undefined, description: "", budgetUsd: undefined, preferredDate: "",
      });
      toast({ title: "Request created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reviewMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof reviewSchema> }) => {
      const r = await apiRequest("POST", `/api/flyguys/requests/${id}/review`, data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/requests"] });
      setReviewOpen(false); reviewForm.reset();
      toast({ title: "Request moved to Under Review", description: "Customer will be contacted for negotiation." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const publishMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof publishSchema> }) => {
      const r = await apiRequest("POST", `/api/flyguys/requests/${id}/publish`, data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/requests"] });
      setPublishOpen(false); publishForm.reset();
      toast({ title: "Mission published!", description: "Operators can now claim this mission." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/flyguys/requests/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/flyguys/requests"] }); toast({ title: "Deleted" }); },
  });

  const aiRecommendMut = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("POST", `/api/flyguys/requests/${id}/ai-recommend`); return r.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/requests"] });
      toast({ title: "AI Analysis Complete", description: "Drone type and operator shortlist updated." });
    },
    onError: (e: any) => toast({ title: "AI Analysis Failed", description: e.message, variant: "destructive" }),
  });

  const droneTypes = ["Fixed-Wing", "Multi-Rotor", "Hybrid VTOL", "Delivery UAV", "Racing Drone", "Single-Rotor"];
  const serviceTypes = ["mapping", "inspection", "photography", "delivery", "surveillance", "other"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{requests.length} total requests</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-request"><Plus className="w-4 h-4 mr-1" /> New Request</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Customer Request</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMut.mutate(d))} className="space-y-3">
                {user && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    Contact details auto-filled from your profile. Edit if submitting on behalf of another customer.
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input data-testid="input-customer-name" placeholder="e.g. Jane Smith" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="customerEmail" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input data-testid="input-customer-email" type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="customerPhone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input data-testid="input-customer-phone" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="customerCompany" render={({ field }) => (
                    <FormItem><FormLabel>Company <span className="text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input data-testid="input-customer-company" placeholder="e.g. NRG Energy Inc." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem><FormLabel>Request Title</FormLabel><FormControl><Input data-testid="input-request-title" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="serviceType" render={({ field }) => (
                    <FormItem><FormLabel>Service Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger data-testid="select-service-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>{serviceTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="budgetUsd" render={({ field }) => (
                    <FormItem><FormLabel>Budget ($)</FormLabel><FormControl><Input data-testid="input-budget" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem><FormLabel>Location Description</FormLabel><FormControl><Input data-testid="input-location" placeholder="e.g. Downtown Austin, TX" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div>
                  <p className="text-sm font-medium mb-1.5">Pin on Map <span className="text-muted-foreground font-normal text-xs">(click to set coordinates)</span></p>
                  <LocationPicker
                    lat={watchedLat}
                    lng={watchedLng}
                    onPick={(lat, lng) => {
                      form.setValue("locationLat", parseFloat(lat.toFixed(6)));
                      form.setValue("locationLng", parseFloat(lng.toFixed(6)));
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <FormField control={form.control} name="locationLat" render={({ field }) => (
                      <FormItem>
                        <FormControl><Input data-testid="input-location-lat" type="number" step="any" placeholder="Latitude" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="locationLng" render={({ field }) => (
                      <FormItem>
                        <FormControl><Input data-testid="input-location-lng" type="number" step="any" placeholder="Longitude" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
                <FormField control={form.control} name="preferredDate" render={({ field }) => (
                  <FormItem><FormLabel>Preferred Date</FormLabel><FormControl><Input data-testid="input-preferred-date" type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea data-testid="textarea-description" rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" disabled={createMut.isPending} className="w-full" data-testid="button-submit-request">
                  {createMut.isPending ? "Creating..." : "Create Request"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Mobile card list (< md) ─────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {requests.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm border rounded-lg">No customer requests yet</div>
        ) : requests.map(req => {
          const aiRec = parseAiRec((req as any).aiDroneRecommendation);
          return (
            <div key={req.id} data-testid={`row-request-${req.id}`} className="rounded-lg border p-3 space-y-2 bg-background">
              {/* header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm truncate">{req.title}</span>
                    {(req as any).splitType === "multi" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 text-[10px] font-medium flex-shrink-0">
                        <Users2 className="w-2.5 h-2.5" /> Split ×{(req as any).maxOperators}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{req.location}</div>
                </div>
                <StatusBadge status={req.status} />
              </div>
              {/* customer row */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="font-medium">{req.customerName}</span>
                {req.origin === "portal" && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] font-medium">
                    <Globe className="w-2.5 h-2.5" /> Portal
                  </span>
                )}
                <span className="text-muted-foreground">{req.customerEmail}</span>
              </div>
              {/* stats row */}
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <div className="bg-muted/50 rounded p-1.5">
                  <p className="text-muted-foreground text-[10px]">Service</p>
                  <p className="font-medium capitalize truncate">{req.serviceType}</p>
                </div>
                <div className="bg-muted/50 rounded p-1.5">
                  <p className="text-muted-foreground text-[10px]">Budget</p>
                  <p className="font-medium">{fmt(req.budgetUsd)}</p>
                </div>
                <div className="bg-muted/50 rounded p-1.5">
                  <p className="text-muted-foreground text-[10px]">Adjusted</p>
                  <p className="font-semibold text-indigo-600">{req.adjustedAmountUsd ? fmt(req.adjustedAmountUsd) : "—"}</p>
                </div>
              </div>
              {/* split progress */}
              {(req as any).splitType === "multi" && (req as any).maxOperators > 1 && (
                <div className="text-[10px] text-violet-600 dark:text-violet-400">
                  {(req as any).claimedCount ?? 0}/{(req as any).maxOperators} operators assigned
                  {req.adjustedAmountUsd ? ` · ${fmt(Math.round(req.adjustedAmountUsd / (req as any).maxOperators))}/op` : ""}
                </div>
              )}
              {/* AI rec */}
              {aiRec && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="capitalize text-[10px] border-violet-200 text-violet-700 dark:text-violet-300 flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" /> {aiRec.recommendedDroneType} · {Math.round(aiRec.confidence * 100)}%
                  </Badge>
                  {aiRec.shortlistedOperatorIds.length > 0 && (
                    <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                      <Users2 className="w-2.5 h-2.5" /> {aiRec.shortlistedOperatorIds.length} shortlisted
                    </span>
                  )}
                </div>
              )}
              {/* actions */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {req.status === "open" && (
                  <Button size="sm" variant="outline" className="text-xs h-7 text-amber-600 border-amber-200 hover:bg-amber-50"
                    data-testid={`button-review-request-${req.id}`}
                    onClick={() => { setActionReq(req); reviewForm.reset({ flyguysNotes: req.flyguysNotes ?? "", adjustedAmountUsd: req.adjustedAmountUsd ?? undefined, splitType: (req as any).splitType === "multi" ? "multi" : "single", assignedOperatorIds: (req as any).assignedOperatorIds ?? [] }); setReviewOpen(true); }}>
                    <Clock className="w-3 h-3 mr-1" /> Review
                  </Button>
                )}
                {req.status === "under-review" && (
                  <Button size="sm" variant="outline" className="text-xs h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    data-testid={`button-publish-request-${req.id}`}
                    onClick={() => { setActionReq(req); publishForm.reset({ adjustedAmountUsd: req.adjustedAmountUsd ?? undefined, requiredDroneType: req.requiredDroneType ?? "", flyguysNotes: req.flyguysNotes ?? "" }); setPublishOpen(true); }}>
                    <Zap className="w-3 h-3 mr-1" /> Publish
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-violet-600"
                  data-testid={`button-ai-recommend-${req.id}`}
                  disabled={aiRecommendMut.isPending}
                  onClick={() => aiRecommendMut.mutate(req.id)}>
                  <Brain className="w-3 h-3 mr-1" /> AI
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto"
                  data-testid={`button-delete-request-${req.id}`}
                  onClick={() => deleteMut.mutate(req.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table (≥ md) ────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Mission</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Adjusted</TableHead>
              <TableHead className="flex items-center gap-1"><Brain className="w-3 h-3 text-violet-500" /> AI Drone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No customer requests yet</TableCell></TableRow>
            ) : requests.map(req => {
              const aiRec = parseAiRec((req as any).aiDroneRecommendation);
              return (
              <TableRow key={req.id} data-testid={`row-request-${req.id}`}>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium text-sm">{req.customerName}</span>
                    {req.origin === "portal" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] font-medium">
                        <Globe className="w-2.5 h-2.5" /> Portal
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{req.customerEmail}</div>
                  {req.documentUrls && req.documentUrls.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {req.documentUrls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-sky-600 hover:underline">
                          <ExternalLink className="w-2.5 h-2.5" /> Doc {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="max-w-[220px]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="truncate text-sm font-medium">{req.title}</span>
                    {(req as any).splitType === "multi" && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 text-[10px] font-medium flex-shrink-0">
                        <Users2 className="w-2.5 h-2.5" /> Split ×{(req as any).maxOperators}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{req.location}</div>
                  {(req as any).splitType === "multi" && (req as any).maxOperators > 1 && (
                    <div className="text-[10px] mt-0.5 text-violet-600 dark:text-violet-400">
                      {(req as any).claimedCount ?? 0}/{(req as any).maxOperators} operators assigned
                      {req.adjustedAmountUsd ? ` · ${fmt(Math.round(req.adjustedAmountUsd / (req as any).maxOperators))}/op` : ""}
                    </div>
                  )}
                  {(req as any).locationLat && (req as any).locationLng && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {Number((req as any).locationLat).toFixed(4)}, {Number((req as any).locationLng).toFixed(4)}
                    </div>
                  )}
                </TableCell>
                <TableCell><span className="capitalize text-sm">{req.serviceType}</span></TableCell>
                <TableCell className="text-sm font-medium">{fmt(req.budgetUsd)}</TableCell>
                <TableCell className="text-sm font-semibold text-indigo-600">
                  {req.adjustedAmountUsd ? fmt(req.adjustedAmountUsd) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {aiRec ? (
                    <div className="space-y-1">
                      <Badge variant="outline" className="capitalize text-[10px] border-violet-200 text-violet-700 dark:text-violet-300 flex items-center gap-0.5 w-fit">
                        <Sparkles className="w-2.5 h-2.5" /> {aiRec.recommendedDroneType}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground">{Math.round(aiRec.confidence * 100)}% confidence</div>
                      {aiRec.shortlistedOperatorIds.length > 0 && (
                        <div className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                          <Users2 className="w-2.5 h-2.5" /> {aiRec.shortlistedOperatorIds.length} shortlisted
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">—</span>
                  )}
                </TableCell>
                <TableCell><StatusBadge status={req.status} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 flex-wrap">
                    {req.status === "open" && (
                      <Button size="sm" variant="outline" className="text-xs h-7 text-amber-600 border-amber-200 hover:bg-amber-50"
                        data-testid={`button-review-request-${req.id}`}
                        onClick={() => { setActionReq(req); reviewForm.reset({ flyguysNotes: req.flyguysNotes ?? "", adjustedAmountUsd: req.adjustedAmountUsd ?? undefined, splitType: (req as any).splitType === "multi" ? "multi" : "single", assignedOperatorIds: (req as any).assignedOperatorIds ?? [] }); setReviewOpen(true); }}>
                        <Clock className="w-3 h-3 mr-1" /> Review
                      </Button>
                    )}
                    {req.status === "under-review" && (
                      <Button size="sm" variant="outline" className="text-xs h-7 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        data-testid={`button-publish-request-${req.id}`}
                        onClick={() => { setActionReq(req); publishForm.reset({ adjustedAmountUsd: req.adjustedAmountUsd ?? undefined, requiredDroneType: req.requiredDroneType ?? "", flyguysNotes: req.flyguysNotes ?? "" }); setPublishOpen(true); }}>
                        <Zap className="w-3 h-3 mr-1" /> Publish
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] text-violet-600 hover:bg-violet-50 hover:text-violet-700"
                      data-testid={`button-ai-recommend-${req.id}`}
                      disabled={aiRecommendMut.isPending}
                      title="Run AI drone type & operator analysis"
                      onClick={() => aiRecommendMut.mutate(req.id)}>
                      <Brain className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                      data-testid={`button-delete-request-${req.id}`}
                      onClick={() => deleteMut.mutate(req.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );})}  
          </TableBody>
        </Table>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Mark Under Review</DialogTitle>
            <DialogDescription>Start the review & negotiation process with the customer for: <strong>{actionReq?.title}</strong></DialogDescription>
          </DialogHeader>
          <Form {...reviewForm}>
            <form onSubmit={reviewForm.handleSubmit(d => actionReq && reviewMut.mutate({ id: actionReq.id, data: d }))} className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground text-xs mb-1">Customer Budget</p>
                <p className="font-semibold">{fmt(actionReq?.budgetUsd)}</p>
              </div>
              <FormField control={reviewForm.control} name="adjustedAmountUsd" render={({ field }) => (
                <FormItem><FormLabel>Proposed Adjusted Amount ($) <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input data-testid="input-review-amount" type="number" placeholder="Initial negotiation amount" {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />

              {/* ── Award Type ─────────────────────────────────────────────── */}
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5"><Users2 className="w-3.5 h-3.5 text-violet-500" /> Award Type</p>
                <FormField control={reviewForm.control} name="splitType" render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button"
                        data-testid="button-split-single"
                        onClick={() => field.onChange("single")}
                        className={`rounded-md border p-2.5 text-left text-xs transition-colors ${field.value === "single" ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "border-border hover:bg-muted/50"}`}>
                        <div className="font-semibold mb-0.5">1-to-1</div>
                        <div className="text-muted-foreground">Single operator handles the full mission</div>
                      </button>
                      <button type="button"
                        data-testid="button-split-multi"
                        onClick={() => field.onChange("multi")}
                        className={`rounded-md border p-2.5 text-left text-xs transition-colors ${field.value === "multi" ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" : "border-border hover:bg-muted/50"}`}>
                        <div className="font-semibold mb-0.5">1-to-Many</div>
                        <div className="text-muted-foreground">Budget split across multiple operators</div>
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                {watchedSplitType === "multi" && (
                  <div className="space-y-2 pt-1">
                    <FormField control={reviewForm.control} name="assignedOperatorIds" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Select Operators <span className="text-muted-foreground font-normal">(pick ≥ 2)</span></FormLabel>
                        <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                          {operators.filter(op => op.status === "approved").length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No approved operators yet.</p>
                          ) : operators.filter(op => op.status === "approved").map(op => {
                            const checked = (field.value ?? []).includes(op.id);
                            return (
                              <button
                                key={op.id}
                                type="button"
                                data-testid={`button-assign-operator-${op.id}`}
                                onClick={() => {
                                  const current: string[] = field.value ?? [];
                                  field.onChange(checked ? current.filter(id => id !== op.id) : [...current, op.id]);
                                }}
                                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md border text-left text-xs transition-colors ${checked ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30" : "border-border hover:bg-muted/50"}`}
                              >
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${checked ? "bg-violet-600 border-violet-600" : "border-muted-foreground/40"}`}>
                                  {checked && <span className="text-white text-[8px] font-bold">✓</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium truncate block">{op.name}</span>
                                  {op.companyName && <span className="text-muted-foreground truncate block">{op.companyName}</span>}
                                </div>
                                {op.rating > 0 && (
                                  <span className="text-amber-500 text-[10px] flex-shrink-0">★ {(op.rating / 10).toFixed(1)}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {watchedReviewAmount && watchedAssignedIds.length >= 2 && (
                      <div className="bg-violet-50 dark:bg-violet-900/20 rounded p-2 text-xs space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total budget</span>
                          <span className="font-medium">{fmt(watchedReviewAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Operators selected</span>
                          <span className="font-medium">×{watchedAssignedIds.length}</span>
                        </div>
                        <div className="flex justify-between border-t pt-0.5 mt-0.5">
                          <span className="font-semibold text-violet-700 dark:text-violet-300">Per-operator payout</span>
                          <span className="font-bold text-violet-700 dark:text-violet-300">{fmt(Math.round(watchedReviewAmount / watchedAssignedIds.length))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <FormField control={reviewForm.control} name="flyguysNotes" render={({ field }) => (
                <FormItem><FormLabel>Internal Review Notes</FormLabel>
                  <FormControl><Textarea data-testid="textarea-review-notes" rows={3} placeholder="Notes on feasibility, negotiation points, constraints..." {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={reviewMut.isPending} className="w-full" data-testid="button-confirm-review">
                {reviewMut.isPending ? "Updating..." : "Move to Under Review"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="w-4 h-4 text-indigo-500" /> Publish Mission to Operators</DialogTitle>
            <DialogDescription>Set the final amount and required drone type. Customer identity will NOT be shared with operators.</DialogDescription>
          </DialogHeader>
          <Form {...publishForm}>
            <form onSubmit={publishForm.handleSubmit(d => actionReq && publishMut.mutate({ id: actionReq.id, data: d }))} className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">Original Budget</span><span className="font-medium">{fmt(actionReq?.budgetUsd)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-xs">Mission</span><span className="font-medium truncate max-w-[180px]">{actionReq?.title}</span></div>
              </div>
              <FormField control={publishForm.control} name="adjustedAmountUsd" render={({ field }) => (
                <FormItem><FormLabel>Final Operator Amount ($)</FormLabel>
                  <FormControl><Input data-testid="input-publish-amount" type="number" placeholder="Amount operators will see" {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={publishForm.control} name="requiredDroneType" render={({ field }) => (
                <FormItem><FormLabel>Required Drone Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-required-drone-type"><SelectValue placeholder="Select drone type" /></SelectTrigger></FormControl>
                    <SelectContent>{droneTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={publishForm.control} name="flyguysNotes" render={({ field }) => (
                <FormItem><FormLabel>Final Notes <span className="text-muted-foreground font-normal">(visible internally)</span></FormLabel>
                  <FormControl><Textarea data-testid="textarea-publish-notes" rows={2} {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={publishMut.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="button-confirm-publish">
                {publishMut.isPending ? "Publishing..." : "Publish Mission"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISHED MISSIONS TAB (Operator Claims — first-come-first-served)
// ─────────────────────────────────────────────────────────────────────────────
type PublishedMission = {
  id: string; title: string; serviceType: string; location: string;
  adjustedAmountUsd?: number | null; requiredDroneType?: string | null;
  preferredDate?: string | null; description?: string | null;
  status: string; createdAt?: string | null;
};

function BiddingTab({ requests, operators, bids, fleet }: { requests: FlyguysRequest[]; operators: FlyguysOperator[]; bids: FlyguaysBid[]; fleet: FlyguysFleet[] }) {
  const { toast } = useToast();
  const [claimOpen, setClaimOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<PublishedMission | null>(null);

  const { data: publishedMissions = [], isLoading: missionsLoading } = useQuery<PublishedMission[]>({
    queryKey: ["/api/flyguys/published-missions"],
  });

  const claimForm = useForm({
    defaultValues: { operatorId: "", droneId: "" },
  });

  const claimMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { operatorId: string; droneId: string } }) => {
      const r = await apiRequest("POST", `/api/flyguys/requests/${id}/claim`, data);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/published-missions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/bids"] });
      setClaimOpen(false); claimForm.reset();
      toast({ title: "Mission claimed!", description: "Project created and operator assigned." });
    },
    onError: (e: any) => toast({ title: "Claim failed", description: e.message, variant: "destructive" }),
  });

  const approvedOperators = operators.filter(o => o.status === "approved");
  const selectedOpId = claimForm.watch("operatorId");
  const opDrones = fleet.filter(f => f.operatorId === selectedOpId && f.status === "available");
  const acceptedClaims = bids.filter(b => b.status === "accepted");
  const getRequestTitle = (id: string) => requests.find(r => r.id === id)?.title ?? id.substring(0, 8);
  const getOperatorName = (id: string) => operators.find(o => o.id === id)?.name ?? id.substring(0, 8);

  return (
    <div className="space-y-6">
      {/* Published Missions — Available to Claim */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" /> Available Published Missions
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">First operator with a matching drone to claim gets the job</p>
          </div>
          <span className="text-xs text-muted-foreground">{publishedMissions.length} available</span>
        </div>
        {missionsLoading ? (
          <div className="flex justify-center py-10"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : publishedMissions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No missions published yet</p>
            <p className="text-xs text-muted-foreground mt-1">Publish reviewed requests from the Customer Requests tab to make them available here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {publishedMissions.map(mission => (
              <Card key={mission.id} className="border-indigo-200 dark:border-indigo-800" data-testid={`card-mission-${mission.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-tight">{mission.title}</CardTitle>
                    <StatusBadge status={mission.status} />
                  </div>
                  <CardDescription className="text-xs capitalize">{mission.serviceType} · {mission.location}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/50 rounded-md p-2">
                      <p className="text-muted-foreground">Payout</p>
                      <p className="font-semibold text-green-600 text-sm">{fmt(mission.adjustedAmountUsd)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-md p-2">
                      <p className="text-muted-foreground">Required Drone</p>
                      <p className="font-medium">{mission.requiredDroneType ?? "Any"}</p>
                    </div>
                  </div>
                  {mission.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{mission.description}</p>
                  )}
                  {mission.preferredDate && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Preferred: {mission.preferredDate}
                    </p>
                  )}
                  <Button className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                    data-testid={`button-claim-mission-${mission.id}`}
                    onClick={() => { setSelectedMission(mission); claimForm.reset({ operatorId: "", droneId: "" }); setClaimOpen(true); }}>
                    <Award className="w-3.5 h-3.5 mr-1.5" /> Claim This Mission
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Claim History */}
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <CheckCircle className="w-4 h-4 text-teal-500" /> Claim History
        </h3>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {acceptedClaims.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm border rounded-lg">No claims yet.</div>
          ) : acceptedClaims.map(claim => (
            <div key={claim.id} data-testid={`row-claim-${claim.id}`} className="rounded-lg border p-3 space-y-1 bg-background">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{getRequestTitle(claim.requestId)}</p>
                  <p className="text-xs text-muted-foreground">{getOperatorName(claim.operatorId)}</p>
                </div>
                <StatusBadge status={claim.status} />
              </div>
              <p className="text-sm font-semibold text-green-600">{fmt(claim.amountUsd)}</p>
              {claim.notes && <p className="text-xs text-muted-foreground line-clamp-2">{claim.notes}</p>}
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mission</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Payout</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acceptedClaims.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No claims yet. Operators will claim published missions above.</TableCell></TableRow>
              ) : acceptedClaims.map(claim => (
                <TableRow key={claim.id} data-testid={`row-claim-${claim.id}`}>
                  <TableCell className="text-sm max-w-[150px]"><div className="truncate">{getRequestTitle(claim.requestId)}</div></TableCell>
                  <TableCell className="text-sm font-medium">{getOperatorName(claim.operatorId)}</TableCell>
                  <TableCell className="text-sm font-semibold text-green-600">{fmt(claim.amountUsd)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px]"><div className="truncate">{claim.notes ?? "—"}</div></TableCell>
                  <TableCell><StatusBadge status={claim.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Claim Dialog */}
      <Dialog open={claimOpen} onOpenChange={setClaimOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Award className="w-4 h-4 text-indigo-500" /> Claim Mission</DialogTitle>
            <DialogDescription>Assign an operator to claim: <strong>{selectedMission?.title}</strong></DialogDescription>
          </DialogHeader>
          {selectedMission && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1 mb-2">
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Payout</span><span className="font-semibold text-green-600">{fmt(selectedMission.adjustedAmountUsd)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Required Drone Type</span><span className="font-medium">{selectedMission.requiredDroneType ?? "Any"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground text-xs">Location</span><span className="font-medium">{selectedMission.location}</span></div>
            </div>
          )}
          <form onSubmit={claimForm.handleSubmit(d => selectedMission && claimMut.mutate({ id: selectedMission.id, data: d }))} className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Operator</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                data-testid="select-claim-operator"
                {...claimForm.register("operatorId", { required: true })}
                onChange={e => { claimForm.setValue("operatorId", e.target.value); claimForm.setValue("droneId", ""); }}>
                <option value="">Select operator</option>
                {approvedOperators.map(o => <option key={o.id} value={o.id}>{o.name}{o.companyName ? ` (${o.companyName})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Drone <span className="text-muted-foreground font-normal text-xs">(must match required type)</span></label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                data-testid="select-claim-drone"
                {...claimForm.register("droneId", { required: true })}>
                <option value="">Select drone</option>
                {opDrones.length === 0 && selectedOpId && <option disabled>No available drones for this operator</option>}
                {opDrones.map(d => <option key={d.id} value={d.id}>{d.make} {d.model} — {d.droneType}{d.registrationNumber ? ` (${d.registrationNumber})` : ""}</option>)}
              </select>
              {selectedMission?.requiredDroneType && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Required type: <strong>{selectedMission.requiredDroneType}</strong>. Mismatched drone types will be rejected.
                </p>
              )}
            </div>
            <Button type="submit" disabled={claimMut.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="button-confirm-claim">
              {claimMut.isPending ? "Claiming..." : "Confirm Claim"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATORS TAB
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS TAB
// ─────────────────────────────────────────────────────────────────────────────
function ProjectsTab({ projects, operators }: { projects: FlyguysProject[]; operators: FlyguysOperator[] }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedProject, setSelectedProject] = useState<FlyguysProject | null>(null);
  const [deliverableOpen, setDeliverableOpen] = useState(false);
  const [noteText, setNoteText] = useState("");

  const getOperatorName = (id?: string | null) => operators.find(o => o.id === id)?.name ?? "—";

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<FlyguysProject> }) => {
      const r = await apiRequest("PATCH", `/api/flyguys/projects/${id}`, data);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/flyguys/projects"] }); toast({ title: "Project updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: deliverables = [] } = useQuery<FlyguysDeliverable[]>({
    queryKey: ["/api/flyguys/deliverables", selectedProject?.id],
    enabled: !!selectedProject,
    queryFn: async () => {
      if (!selectedProject) return [];
      const r = await fetch(`/api/flyguys/deliverables/${selectedProject.id}`, { credentials: "include" });
      return r.json();
    },
  });

  const deliverSchema = z.object({
    fileName: z.string().min(1),
    fileType: z.string().min(1),
    fileSizeMb: z.coerce.number().optional(),
    description: z.string().optional(),
  });
  const deliverForm = useForm({ resolver: zodResolver(deliverSchema), defaultValues: { fileName: "", fileType: "video", fileSizeMb: undefined, description: "" } });

  const addDeliverable = useMutation({
    mutationFn: async (data: z.infer<typeof deliverSchema>) => {
      const r = await apiRequest("POST", "/api/flyguys/deliverables", { ...data, projectId: selectedProject!.id });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/deliverables", selectedProject?.id] });
      setDeliverableOpen(false);
      deliverForm.reset();
      toast({ title: "Deliverable added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/flyguys/deliverables/${id}`); return r.json(); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/flyguys/deliverables", selectedProject?.id] }),
  });

  const statusFlow = ["active", "in-progress", "delivered", "completed"];
  const fileTypes = ["video", "image", "report", "raw-data"];

  return (
    <div className="space-y-4">
      {selectedProject ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)} data-testid="button-back-projects">← Back to Projects</Button>
          </div>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{selectedProject.title}</CardTitle>
                  <CardDescription>{selectedProject.customerName} · {selectedProject.location}</CardDescription>
                </div>
                <StatusBadge status={selectedProject.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><p className="text-muted-foreground text-xs">Operator</p><p className="font-medium">{getOperatorName(selectedProject.operatorId)}</p></div>
                <div><p className="text-muted-foreground text-xs">Project Value</p><p className="font-medium text-green-600">{fmt(selectedProject.projectValueUsd)}</p></div>
                <div><p className="text-muted-foreground text-xs">Service Type</p><p className="font-medium capitalize">{selectedProject.serviceType ?? "—"}</p></div>
                <div><p className="text-muted-foreground text-xs">Due Date</p><p className="font-medium">{selectedProject.dueDate ?? "—"}</p></div>
              </div>

              <div className="flex flex-wrap gap-2">
                {statusFlow.map(s => (
                  <Button key={s} size="sm" variant={selectedProject.status === s ? "default" : "outline"} className="h-7 text-xs capitalize"
                    data-testid={`button-status-${s}`}
                    onClick={() => updateMut.mutate({ id: selectedProject.id, data: { status: s } })}
                    disabled={updateMut.isPending}>
                    {s}
                  </Button>
                ))}
              </div>

              {/* Delivery Notes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Delivery Notes</p>
                <Textarea
                  rows={2}
                  data-testid="textarea-delivery-notes"
                  value={selectedProject.deliveryNotes ?? ""}
                  onChange={e => setSelectedProject({ ...selectedProject, deliveryNotes: e.target.value })}
                  placeholder="Add delivery notes..."
                />
                <Button size="sm" className="mt-2 h-7 text-xs" data-testid="button-save-notes"
                  onClick={() => updateMut.mutate({ id: selectedProject.id, data: { deliveryNotes: selectedProject.deliveryNotes ?? "" } })}>
                  Save Notes
                </Button>
              </div>

              {/* Deliverables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold flex items-center gap-1"><Video className="w-4 h-4" /> Deliverables / Artifacts</p>
                  <Dialog open={deliverableOpen} onOpenChange={setDeliverableOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs" data-testid="button-add-deliverable"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm">
                      <DialogHeader><DialogTitle>Add Deliverable</DialogTitle></DialogHeader>
                      <Form {...deliverForm}>
                        <form onSubmit={deliverForm.handleSubmit(d => addDeliverable.mutate(d))} className="space-y-3">
                          <FormField control={deliverForm.control} name="fileName" render={({ field }) => (
                            <FormItem><FormLabel>File Name</FormLabel><FormControl><Input data-testid="input-file-name" placeholder="e.g. site_survey_video.mp4" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={deliverForm.control} name="fileType" render={({ field }) => (
                            <FormItem><FormLabel>File Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger data-testid="select-file-type"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{fileTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                              </Select><FormMessage /></FormItem>
                          )} />
                          <FormField control={deliverForm.control} name="fileSizeMb" render={({ field }) => (
                            <FormItem><FormLabel>File Size (MB)</FormLabel><FormControl><Input data-testid="input-file-size" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={deliverForm.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea data-testid="textarea-deliverable-desc" rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <Button type="submit" disabled={addDeliverable.isPending} className="w-full" data-testid="button-submit-deliverable">Add Deliverable</Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
                {deliverables.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">No deliverables yet. Add videos, images, or reports from drone operations.</div>
                ) : (
                  <div className="space-y-2">
                    {deliverables.map(d => (
                      <div key={d.id} data-testid={`card-deliverable-${d.id}`} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center gap-2">
                          {d.fileType === "video" ? <Video className="w-4 h-4 text-orange-500" /> : <Package className="w-4 h-4 text-blue-500" />}
                          <div>
                            <p className="text-sm font-medium">{d.fileName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{d.fileType}{d.fileSizeMb ? ` · ${d.fileSizeMb} MB` : ""}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          data-testid={`button-delete-deliverable-${d.id}`}
                          onClick={() => deleteDeliverable.mutate(d.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{projects.length} total projects</p>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {projects.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm border rounded-lg">No projects yet. Claim a mission to create a project.</div>
            ) : projects.map(p => (
              <div key={p.id} data-testid={`row-project-${p.id}`} className="rounded-lg border p-3 space-y-2 bg-background">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.customerName ?? "—"} · {getOperatorName(p.operatorId)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-sm font-semibold text-green-600">{fmt(p.projectValueUsd)}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`button-view-project-${p.id}`} onClick={() => setSelectedProject(p)}>
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                  {(p.status === "in_progress" || p.status === "active" || p.status === "accepted" || p.status === "published") && (
                    <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50" data-testid={`button-track-mission-${p.id}`} onClick={() => navigate(`/flyguys-mission/${p.id}`)}>
                      <Navigation className="w-3 h-3 mr-1" /> Track
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No projects yet. Claim a mission to create a project.</TableCell></TableRow>
                ) : projects.map(p => (
                  <TableRow key={p.id} data-testid={`row-project-${p.id}`}>
                    <TableCell className="max-w-[180px]"><div className="truncate text-sm font-medium">{p.title}</div></TableCell>
                    <TableCell className="text-sm">{p.customerName ?? "—"}</TableCell>
                    <TableCell className="text-sm">{getOperatorName(p.operatorId)}</TableCell>
                    <TableCell className="text-sm font-semibold text-green-600">{fmt(p.projectValueUsd)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          data-testid={`button-view-project-${p.id}`}
                          onClick={() => setSelectedProject(p)}>
                          <Eye className="w-3 h-3 mr-1" /> View
                        </Button>
                        {(p.status === "in_progress" || p.status === "active" || p.status === "accepted" || p.status === "published") && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                            data-testid={`button-track-mission-${p.id}`}
                            onClick={() => navigate(`/flyguys-mission/${p.id}`)}>
                            <Navigation className="w-3 h-3 mr-1" /> Track
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}


const operatorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  coveredRegions: z.string().optional(),
  notes: z.string().optional(),
});

function OperatorsTab({ operators, fleet }: { operators: FlyguysOperator[]; fleet: FlyguysFleet[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [droneOpen, setDroneOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<FlyguysOperator | null>(null);

  const form = useForm({ resolver: zodResolver(operatorSchema), defaultValues: {
    name: "", email: "", phone: "", companyName: "", coveredRegions: "", notes: "",
  }});

  const createMut = useMutation({
    mutationFn: async (data: z.infer<typeof operatorSchema>) => {
      const payload = { ...data, coveredRegions: data.coveredRegions?.split(",").map(s => s.trim()).filter(Boolean) ?? [] };
      const r = await apiRequest("POST", "/api/flyguys/operators", payload);
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/flyguys/operators"] }); setOpen(false); form.reset(); toast({ title: "Operator onboarded" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await apiRequest("PATCH", `/api/flyguys/operators/${id}`, { status });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/flyguys/operators"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/flyguys/operators/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/flyguys/operators"] }); toast({ title: "Operator removed" }); },
  });

  // Drone form
  const droneSchema = z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    droneType: z.string().min(1),
    registrationNumber: z.string().optional(),
    maxFlightTimeMin: z.coerce.number().optional(),
    maxRangeKm: z.coerce.number().optional(),
    cameraResolution: z.string().optional(),
  });
  const droneForm = useForm({ resolver: zodResolver(droneSchema), defaultValues: { make: "", model: "", droneType: "", registrationNumber: "", maxFlightTimeMin: undefined, maxRangeKm: undefined, cameraResolution: "" } });

  const addDroneMut = useMutation({
    mutationFn: async (data: z.infer<typeof droneSchema>) => {
      const r = await apiRequest("POST", "/api/flyguys/fleet", { ...data, operatorId: selectedOp!.id });
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/flyguys/fleet"] }); setDroneOpen(false); droneForm.reset(); toast({ title: "Drone added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const droneTypes = ["mapping", "inspection", "photography", "delivery", "surveillance", "multi-purpose"];

  const getOperatorFleet = (opId: string) => fleet.filter(f => f.operatorId === opId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{operators.length} operators · {operators.filter(o => o.status === "approved").length} approved</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-onboard-operator"><Plus className="w-4 h-4 mr-1" /> Onboard Operator</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Onboard Drone Operator</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => createMut.mutate(d))} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input data-testid="input-operator-name" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input data-testid="input-operator-email" type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField control={form.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input data-testid="input-operator-phone" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem><FormLabel>Company</FormLabel><FormControl><Input data-testid="input-operator-company" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="coveredRegions" render={({ field }) => (
                  <FormItem><FormLabel>Covered Regions (comma-separated)</FormLabel><FormControl><Input data-testid="input-regions" placeholder="e.g. Texas, Florida, California" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Onboarding Notes</FormLabel><FormControl><Textarea data-testid="textarea-operator-notes" rows={2} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" disabled={createMut.isPending} className="w-full" data-testid="button-submit-operator">
                  {createMut.isPending ? "Onboarding..." : "Onboard Operator"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {operators.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-muted-foreground text-sm border rounded-lg">No operators onboarded yet</div>
        ) : operators.map(op => {
          const opFleet = getOperatorFleet(op.id);
          return (
            <Card key={op.id} data-testid={`card-operator-${op.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{op.name}</CardTitle>
                    {op.companyName && <CardDescription className="text-xs">{op.companyName}</CardDescription>}
                  </div>
                  <StatusBadge status={op.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {op.email}</div>
                  {op.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {op.phone}</div>}
                  {op.coveredRegions && op.coveredRegions.length > 0 && (
                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {op.coveredRegions.join(", ")}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Plane className="w-3 h-3 text-sky-500" />
                  <span className="font-medium">{opFleet.length}</span> drone{opFleet.length !== 1 ? "s" : ""} registered
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {op.status === "pending" && (
                    <Button size="sm" variant="outline" className="h-6 text-xs text-green-600 border-green-200"
                      data-testid={`button-approve-${op.id}`}
                      onClick={() => updateStatusMut.mutate({ id: op.id, status: "approved" })}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Approve
                    </Button>
                  )}
                  {op.status === "approved" && (
                    <Button size="sm" variant="outline" className="h-6 text-xs text-orange-600 border-orange-200"
                      data-testid={`button-suspend-${op.id}`}
                      onClick={() => updateStatusMut.mutate({ id: op.id, status: "suspended" })}>
                      Suspend
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-6 text-xs"
                    data-testid={`button-add-drone-${op.id}`}
                    onClick={() => { setSelectedOp(op); setDroneOpen(true); }}>
                    <Plane className="w-3 h-3 mr-1" /> Add Drone
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                    data-testid={`button-delete-operator-${op.id}`}
                    onClick={() => deleteMut.mutate(op.id)}>
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Drone Dialog */}
      <Dialog open={droneOpen} onOpenChange={setDroneOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Drone — {selectedOp?.name}</DialogTitle></DialogHeader>
          <Form {...droneForm}>
            <form onSubmit={droneForm.handleSubmit(d => addDroneMut.mutate(d))} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={droneForm.control} name="make" render={({ field }) => (
                  <FormItem><FormLabel>Make</FormLabel><FormControl><Input data-testid="input-drone-make" placeholder="DJI" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={droneForm.control} name="model" render={({ field }) => (
                  <FormItem><FormLabel>Model</FormLabel><FormControl><Input data-testid="input-drone-model" placeholder="Mavic 3" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={droneForm.control} name="droneType" render={({ field }) => (
                <FormItem><FormLabel>Drone Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger data-testid="select-drone-type"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>{droneTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={droneForm.control} name="registrationNumber" render={({ field }) => (
                  <FormItem><FormLabel>Registration #</FormLabel><FormControl><Input data-testid="input-drone-reg" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={droneForm.control} name="cameraResolution" render={({ field }) => (
                  <FormItem><FormLabel>Camera</FormLabel><FormControl><Input data-testid="input-drone-camera" placeholder="4K" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField control={droneForm.control} name="maxFlightTimeMin" render={({ field }) => (
                  <FormItem><FormLabel>Max Flight (min)</FormLabel><FormControl><Input data-testid="input-flight-time" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={droneForm.control} name="maxRangeKm" render={({ field }) => (
                  <FormItem><FormLabel>Max Range (km)</FormLabel><FormControl><Input data-testid="input-range" type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <Button type="submit" disabled={addDroneMut.isPending} className="w-full" data-testid="button-submit-drone">
                {addDroneMut.isPending ? "Adding..." : "Add Drone"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLEET TAB
// ─────────────────────────────────────────────────────────────────────────────
const FLEET_TYPE_COLORS: Record<string, string> = {
  mapping:         "bg-blue-500/10 text-blue-400",
  inspection:      "bg-yellow-500/10 text-yellow-400",
  photography:     "bg-purple-500/10 text-purple-400",
  delivery:        "bg-green-500/10 text-green-400",
  surveillance:    "bg-red-500/10 text-red-400",
  "multi-purpose": "bg-gray-500/10 text-gray-400",
};
const FLEET_STATUS_COLORS: Record<string, string> = {
  "available":   "bg-green-500/10 text-green-400",
  "in-mission":  "bg-amber-500/10 text-amber-400",
  "maintenance": "bg-red-500/10 text-red-400",
};
const FLEET_STATUS_DOT: Record<string, string> = {
  "available":   "bg-green-400",
  "in-mission":  "bg-amber-400",
  "maintenance": "bg-red-400",
};
const FLEET_PAGE_SIZE = 25;

function FleetTab({ fleet, operators }: { fleet: FlyguysFleet[]; operators: FlyguysOperator[] }) {
  const { toast } = useToast();
  const [probeLinkDrone, setProbeLinkDrone] = useState<FlyguysFleet | null>(null);
  const [selectedProbeId, setSelectedProbeId] = useState("");
  const [probeSearch, setProbeSearch] = useState("");

  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType]   = useState("all");
  const [filterOp, setFilterOp]       = useState("all");
  const [sortKey, setSortKey]         = useState<string>("make");
  const [sortAsc, setSortAsc]         = useState(true);
  const [page, setPage]               = useState(0);

  const { data: availableProbes = [], isLoading: probesLoading } = useQuery<DiscoveryProbe[]>({
    queryKey: ["/api/discovery-probes"],
    enabled: !!probeLinkDrone,
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await apiRequest("PATCH", `/api/flyguys/fleet/${id}`, { status });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/flyguys/fleet"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => { const r = await apiRequest("DELETE", `/api/flyguys/fleet/${id}`); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/flyguys/fleet"] }); toast({ title: "Drone removed" }); },
  });

  const linkProbeMut = useMutation({
    mutationFn: async ({ droneId, probeId }: { droneId: string; probeId: string }) => {
      const r = await apiRequest("POST", `/api/flyguys/fleet/${droneId}/link-probe`, { probeId });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/fleet"] });
      setProbeLinkDrone(null);
      setSelectedProbeId("");
      setProbeSearch("");
      toast({ title: "Probe linked", description: "Drone registered in CMDB automatically." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unlinkProbeMut = useMutation({
    mutationFn: async (droneId: string) => {
      const r = await apiRequest("DELETE", `/api/flyguys/fleet/${droneId}/link-probe`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flyguys/fleet"] });
      toast({ title: "Probe unlinked" });
    },
  });

  const getOperatorName = (id: string) => operators.find(o => o.id === id)?.name ?? "—";
  const statusOptions = ["available", "in-mission", "maintenance"];
  const allTypes = [...new Set(fleet.map(f => f.droneType))].sort();

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortAsc(v => !v);
    else { setSortKey(key); setSortAsc(true); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: string }) =>
    sortKey === col
      ? <span className="ml-0.5 text-[10px]">{sortAsc ? "▲" : "▼"}</span>
      : <span className="ml-0.5 text-[10px] opacity-25">▲</span>;

  const resetPage = () => setPage(0);

  const filtered = fleet
    .filter(d => {
      const q = search.toLowerCase();
      if (q && ![d.make, d.model, d.registrationNumber ?? "", getOperatorName(d.operatorId)].join(" ").toLowerCase().includes(q)) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (filterType !== "all" && d.droneType !== filterType) return false;
      if (filterOp !== "all" && d.operatorId !== filterOp) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "make")   cmp = `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
      if (sortKey === "type")   cmp = a.droneType.localeCompare(b.droneType);
      if (sortKey === "status") cmp = (a.status ?? "").localeCompare(b.status ?? "");
      if (sortKey === "op")     cmp = getOperatorName(a.operatorId).localeCompare(getOperatorName(b.operatorId));
      if (sortKey === "reg")    cmp = (a.registrationNumber ?? "").localeCompare(b.registrationNumber ?? "");
      return sortAsc ? cmp : -cmp;
    });

  const totalPages = Math.ceil(filtered.length / FLEET_PAGE_SIZE);
  const paginated  = filtered.slice(page * FLEET_PAGE_SIZE, (page + 1) * FLEET_PAGE_SIZE);

  // KPI bar
  const kpis = [
    { label: "Total",       value: fleet.length,                                           color: "text-foreground" },
    { label: "Available",   value: fleet.filter(f => f.status === "available").length,     color: "text-green-400" },
    { label: "In Mission",  value: fleet.filter(f => f.status === "in-mission").length,    color: "text-amber-400" },
    { label: "Maintenance", value: fleet.filter(f => f.status === "maintenance").length,   color: "text-red-400" },
    { label: "HOLOCRON",    value: fleet.filter(f => !!(f as any).probeId).length,         color: "text-sky-400" },
  ];

  return (
    <div className="space-y-3">
      {/* KPI bar */}
      <div className="grid grid-cols-5 gap-2">
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg border border-border bg-card px-3 py-2 text-center">
            <p className={`text-xl font-bold leading-tight ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search make, model, reg, operator…"
            value={search}
            onChange={e => { setSearch(e.target.value); resetPage(); }}
            className="pl-8 h-8 text-xs"
            data-testid="input-fleet-search"
          />
          {search && (
            <button className="absolute right-2 top-2" onClick={() => { setSearch(""); resetPage(); }}>
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); resetPage(); }}>
          <SelectTrigger className="h-8 w-32 text-xs" data-testid="select-filter-status"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All status</SelectItem>
            {statusOptions.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={v => { setFilterType(v); resetPage(); }}>
          <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-filter-type"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All types</SelectItem>
            {allTypes.map(t => <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterOp} onValueChange={v => { setFilterOp(v); resetPage(); }}>
          <SelectTrigger className="h-8 w-36 text-xs" data-testid="select-filter-operator"><SelectValue placeholder="Operator" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All operators</SelectItem>
            {operators.map(o => <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {filtered.length} of {fleet.length} drones
        </span>
      </div>

      {/* Table */}
      {fleet.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm border rounded-lg border-dashed">
          No drones registered. Add drones from the Operators tab.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm border rounded-lg border-dashed">
          No drones match your filters.{" "}
          <button className="underline" onClick={() => { setSearch(""); setFilterStatus("all"); setFilterType("all"); setFilterOp("all"); }}>Clear filters</button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs py-2 cursor-pointer select-none" onClick={() => toggleSort("make")}>
                    Make / Model <SortIcon col="make" />
                  </TableHead>
                  <TableHead className="text-xs py-2 cursor-pointer select-none w-[110px]" onClick={() => toggleSort("type")}>
                    Type <SortIcon col="type" />
                  </TableHead>
                  <TableHead className="text-xs py-2 cursor-pointer select-none" onClick={() => toggleSort("op")}>
                    Operator <SortIcon col="op" />
                  </TableHead>
                  <TableHead className="text-xs py-2 cursor-pointer select-none w-[120px]" onClick={() => toggleSort("reg")}>
                    Reg # <SortIcon col="reg" />
                  </TableHead>
                  <TableHead className="text-xs py-2 cursor-pointer select-none w-[130px]" onClick={() => toggleSort("status")}>
                    Status <SortIcon col="status" />
                  </TableHead>
                  <TableHead className="text-xs py-2 text-center w-[80px]">Probe</TableHead>
                  <TableHead className="text-xs py-2 text-right w-[72px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((drone, i) => {
                  const hasProbe    = !!(drone as any).probeId;
                  const typeColor   = FLEET_TYPE_COLORS[drone.droneType]  ?? FLEET_TYPE_COLORS["multi-purpose"];
                  const statusColor = FLEET_STATUS_COLORS[drone.status ?? "available"] ?? FLEET_STATUS_COLORS["available"];
                  const statusDot   = FLEET_STATUS_DOT[drone.status ?? "available"]   ?? FLEET_STATUS_DOT["available"];

                  // compact specs string for subtitle
                  const specParts: string[] = [];
                  if (drone.maxFlightTimeMin) specParts.push(`${drone.maxFlightTimeMin} min`);
                  if (drone.maxRangeKm)       specParts.push(`${drone.maxRangeKm} km`);
                  if (drone.cameraResolution) specParts.push(drone.cameraResolution);
                  if (drone.payloadCapacityKg) specParts.push(`${drone.payloadCapacityKg} kg`);

                  return (
                    <TableRow
                      key={drone.id}
                      data-testid={`row-drone-${drone.id}`}
                      className={`text-xs ${i % 2 !== 0 ? "bg-muted/10" : ""} ${hasProbe ? "border-l-2 border-l-sky-500/40" : ""}`}
                    >
                      {/* Make / Model + specs subtitle */}
                      <TableCell className="py-2">
                        <p className="font-semibold text-xs leading-tight">{drone.make} {drone.model}</p>
                        {specParts.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{specParts.join(" · ")}</p>
                        )}
                      </TableCell>

                      {/* Type */}
                      <TableCell className="py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize whitespace-nowrap ${typeColor}`}>
                          {drone.droneType}
                        </span>
                      </TableCell>

                      {/* Operator */}
                      <TableCell className="py-2 text-xs text-muted-foreground max-w-[160px]">
                        <span className="truncate block">{getOperatorName(drone.operatorId)}</span>
                      </TableCell>

                      {/* Reg # */}
                      <TableCell className="py-2 font-mono text-[11px] text-muted-foreground">
                        {drone.registrationNumber ?? <span className="opacity-30">—</span>}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-2">
                        <Select defaultValue={drone.status ?? "available"} onValueChange={v => updateStatusMut.mutate({ id: drone.id, status: v })}>
                          <SelectTrigger
                            className={`h-6 text-[10px] w-[120px] gap-1 border-0 rounded px-1.5 font-semibold ${statusColor}`}
                            data-testid={`select-drone-status-${drone.id}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Probe */}
                      <TableCell className="py-2 text-center">
                        {hasProbe ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-sky-400 font-medium bg-sky-500/10 rounded px-1.5 py-0.5 whitespace-nowrap">
                            <Wifi className="w-2.5 h-2.5" /> linked
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-2">
                        <div className="flex items-center gap-0.5 justify-end">
                          {hasProbe ? (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-orange-400 hover:text-orange-300"
                              title="Unlink probe"
                              data-testid={`button-unlink-probe-${drone.id}`}
                              onClick={() => unlinkProbeMut.mutate(drone.id)}>
                              <Unlink2 className="w-3 h-3" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-sky-500 hover:text-sky-400"
                              title="Link HOLOCRON probe"
                              data-testid={`button-link-probe-${drone.id}`}
                              onClick={() => { setProbeLinkDrone(drone); setSelectedProbeId(""); }}>
                              <Link2 className="w-3 h-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                            title="Delete drone"
                            data-testid={`button-delete-drone-${drone.id}`}
                            onClick={() => deleteMut.mutate(drone.id)}>
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} · rows {page * FLEET_PAGE_SIZE + 1}–{Math.min((page + 1) * FLEET_PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={page === 0} onClick={() => setPage(0)}>First</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>Last</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Link Probe Dialog */}
      <Dialog open={!!probeLinkDrone} onOpenChange={v => { if (!v) { setProbeLinkDrone(null); setSelectedProbeId(""); setProbeSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wifi className="w-4 h-4 text-sky-500" /> Link HOLOCRON Probe</DialogTitle>
          </DialogHeader>
          {probeLinkDrone && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm">
                <p className="font-medium">{probeLinkDrone.make} {probeLinkDrone.model}</p>
                <p className="text-xs text-muted-foreground">{probeLinkDrone.droneType} · {probeLinkDrone.registrationNumber}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Infrastructure Probe</label>
                {probesLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading probes...
                  </div>
                ) : availableProbes.length === 0 ? (
                  <div className="border rounded-lg p-4 text-center space-y-2">
                    <WifiOff className="w-8 h-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No probes found</p>
                    <p className="text-xs text-muted-foreground">Add probes in <strong>Infrastructure → IT Discovery &amp; Probes</strong> first.</p>
                  </div>
                ) : (
                  <>
                    <Input
                      data-testid="input-probe-search"
                      placeholder="Search by name, hostname or IP…"
                      value={probeSearch}
                      onChange={e => setProbeSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="border rounded-lg divide-y max-h-52 overflow-y-auto" data-testid="probe-selector-list">
                      {availableProbes
                        .filter(p => {
                          const q = probeSearch.toLowerCase();
                          return !q || p.name.toLowerCase().includes(q) || (p.hostname ?? "").toLowerCase().includes(q) || (p.ipAddress ?? "").toLowerCase().includes(q);
                        })
                        .map(p => {
                          const isSelected = selectedProbeId === p.id;
                          const healthColor = p.healthStatus === "healthy" ? "text-green-500" : p.healthStatus === "degraded" ? "text-yellow-500" : "text-red-500";
                          return (
                            <button
                              key={p.id}
                              type="button"
                              data-testid={`probe-option-${p.id}`}
                              className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors ${isSelected ? "bg-sky-50 dark:bg-sky-900/20" : ""}`}
                              onClick={() => setSelectedProbeId(p.id)}
                            >
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? "bg-sky-500" : "bg-muted-foreground/20"}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{p.name}</span>
                                  <span className={`text-[10px] font-semibold uppercase flex-shrink-0 ${healthColor}`}>{p.healthStatus ?? "unknown"}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  {p.hostname && <span className="truncate">{p.hostname}</span>}
                                  {p.ipAddress && <span className="flex-shrink-0">{p.ipAddress}</span>}
                                  {p.protocol && <span className="flex-shrink-0 uppercase">{p.protocol}</span>}
                                </div>
                              </div>
                              {isSelected && <CheckCircle className="w-4 h-4 text-sky-500 flex-shrink-0" />}
                            </button>
                          );
                        })}
                    </div>
                    {selectedProbeId && (
                      <p className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {availableProbes.find(p => p.id === selectedProbeId)?.name} selected — drone will be registered in the CMDB automatically
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setProbeLinkDrone(null); setSelectedProbeId(""); setProbeSearch(""); }}>Cancel</Button>
                <Button
                  className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
                  disabled={!selectedProbeId || linkProbeMut.isPending}
                  data-testid="button-confirm-link-probe"
                  onClick={() => linkProbeMut.mutate({ droneId: probeLinkDrone.id, probeId: selectedProbeId })}
                >
                  {linkProbeMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Link2 className="w-4 h-4 mr-1" /> Link & Register</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS TAB
// ─────────────────────────────────────────────────────────────────────────────
function TransactionsTab({ transactions, projects }: { transactions: FlyguysTransaction[]; projects: FlyguysProject[] }) {
  const { toast } = useToast();

  const updateMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const r = await apiRequest("PATCH", `/api/flyguys/transactions/${id}`, { status });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/flyguys/transactions"] }),
  });

  const getProjectTitle = (id?: string | null) => projects.find(p => p.id === id)?.title ?? "—";

  const totalCollected = transactions.filter(t => t.status === "completed").reduce((s, t) => s + (t.amountUsd ?? 0), 0);
  const totalPending = transactions.filter(t => t.status === "pending").reduce((s, t) => s + (t.amountUsd ?? 0), 0);
  const customerPayments = transactions.filter(t => t.type === "customer-payment" && t.status === "completed").reduce((s, t) => s + (t.amountUsd ?? 0), 0);
  const operatorPayouts = transactions.filter(t => t.type === "operator-payout").reduce((s, t) => s + (t.amountUsd ?? 0), 0);

  const typeIcon: Record<string, typeof DollarSign> = {
    "customer-payment": CircleDollarSign,
    "operator-payout": DollarSign,
    "refund": AlertCircle,
  };

  const typeColor: Record<string, string> = {
    "customer-payment": "text-blue-500",
    "operator-payout": "text-orange-500",
    "refund": "text-red-500",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Collected</p>
            <p className="text-2xl font-bold text-green-600">{fmt(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{fmt(totalPending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Operator Payouts</p>
            <p className="text-2xl font-bold text-orange-600">{fmt(operatorPayouts)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {transactions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm border rounded-lg">No transactions yet.</div>
        ) : transactions.map(tx => {
          const Icon = typeIcon[tx.type] ?? DollarSign;
          return (
            <div key={tx.id} data-testid={`row-transaction-${tx.id}`} className="rounded-lg border p-3 space-y-2 bg-background">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${typeColor[tx.type] ?? "text-gray-500"}`} />
                  <span className="text-xs capitalize font-medium">{tx.type.replace(/-/g, " ")}</span>
                </div>
                <StatusBadge status={tx.status} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">{getProjectTitle(tx.projectId)}</p>
                <p className="text-sm font-semibold">{fmt(tx.amountUsd)}</p>
              </div>
              {tx.description && <p className="text-xs text-muted-foreground line-clamp-2">{tx.description}</p>}
              {tx.status === "pending" && (
                <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200 w-full" data-testid={`button-complete-tx-${tx.id}`} onClick={() => updateMut.mutate({ id: tx.id, status: "completed" })}>
                  Mark Paid
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transactions yet. Transactions are created when missions are claimed and completed.</TableCell></TableRow>
            ) : transactions.map(tx => {
              const Icon = typeIcon[tx.type] ?? DollarSign;
              return (
                <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-4 h-4 ${typeColor[tx.type] ?? "text-gray-500"}`} />
                      <span className="text-xs capitalize">{tx.type.replace(/-/g, " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm max-w-[160px]"><div className="truncate">{getProjectTitle(tx.projectId)}</div></TableCell>
                  <TableCell className="text-sm font-semibold">{fmt(tx.amountUsd)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px]"><div className="truncate">{tx.description ?? "—"}</div></TableCell>
                  <TableCell><StatusBadge status={tx.status} /></TableCell>
                  <TableCell>
                    {tx.status === "pending" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200"
                        data-testid={`button-complete-tx-${tx.id}`}
                        onClick={() => updateMut.mutate({ id: tx.id, status: "completed" })}>
                        Mark Paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER PORTAL TAB
// ─────────────────────────────────────────────────────────────────────────────
function CustomerPortalTab({ requests }: { requests: FlyguysRequest[] }) {
  const portalUrl = `${window.location.origin}/flyguys-portal`;
  const [copied, setCopied] = useState(false);

  const portalRequests = requests.filter(r => (r as any).origin === "portal");
  const staffRequests = requests.filter(r => (r as any).origin !== "portal");

  function copyUrl() {
    navigator.clipboard.writeText(portalUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  return (
    <div className="space-y-6">
      {/* Portal URL */}
      <Card className="border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-sky-800 dark:text-sky-300 mb-1 flex items-center gap-1.5">
                <Globe className="w-4 h-4" /> Customer Self-Service Portal
              </p>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-lg border px-3 py-2">
                <span className="font-mono text-sm text-sky-600 dark:text-sky-400 truncate">{portalUrl}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={copyUrl} data-testid="button-copy-portal-url">
                {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? " Copied!" : " Copy URL"}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={portalUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-portal">
                  <ExternalLink className="w-4 h-4 mr-1" /> Open Portal
                </a>
              </Button>
            </div>
          </div>
          <p className="text-xs text-sky-700 dark:text-sky-400 mt-2">
            Share this link with customers. They can submit service requests without an account. All submissions appear here tagged with a "Portal" badge.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Requests", value: requests.length, color: "text-slate-700 dark:text-slate-300" },
          { label: "Via Portal", value: portalRequests.length, color: "text-sky-600 dark:text-sky-400" },
          { label: "Via Staff", value: staffRequests.length, color: "text-purple-600 dark:text-purple-400" },
          { label: "Open / Unassigned", value: requests.filter(r => r.status === "open").length, color: "text-orange-600 dark:text-orange-400" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Portal Submissions Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Portal-Submitted Requests</CardTitle>
          <CardDescription className="text-xs">Customer submissions from the self-service portal</CardDescription>
        </CardHeader>
        <CardContent>
          {portalRequests.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm space-y-2">
              <Globe className="w-8 h-8 mx-auto opacity-30" />
              <p>No portal submissions yet. Share the portal URL with your customers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portalRequests.map(req => (
                    <TableRow key={req.id} data-testid={`row-portal-request-${req.id}`}>
                      <TableCell>
                        <div className="font-medium text-sm">{req.customerName}</div>
                        <div className="text-xs text-muted-foreground">{req.customerEmail}</div>
                        {req.customerPhone && <div className="text-xs text-muted-foreground">{req.customerPhone}</div>}
                      </TableCell>
                      <TableCell className="max-w-[180px]"><div className="truncate text-sm">{req.title}</div></TableCell>
                      <TableCell><span className="capitalize text-sm">{req.serviceType}</span></TableCell>
                      <TableCell className="text-sm">{req.location}</TableCell>
                      <TableCell className="text-sm">{req.budgetUsd ? `$${req.budgetUsd.toLocaleString()}` : "—"}</TableCell>
                      <TableCell><StatusBadge status={req.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROBE INTEGRATION TAB
// ─────────────────────────────────────────────────────────────────────────────
function ProbeIntegrationTab({ fleet }: { fleet: FlyguysFleet[] }) {
  const linkedDrones = fleet.filter(f => (f as any).probeId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">HOLOCRON Probe Integration</h3>
          <p className="text-sm text-muted-foreground">Link drone assets to HOLOCRON discovery probes for real-time monitoring and CMDB auto-registration.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-xs font-medium">
            <Wifi className="w-3 h-3" /> {linkedDrones.length} linked
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 text-xs font-medium">
            <WifiOff className="w-3 h-3" /> {fleet.length - linkedDrones.length} unlinked
          </span>
        </div>
      </div>

      {/* Architecture diagram */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Cpu className="w-4 h-4 text-sky-500" /> Integration Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-4 py-4">
            {/* Drone */}
            <div className="flex flex-col items-center gap-2 p-4 bg-sky-50 dark:bg-sky-950/30 rounded-xl border border-sky-200 dark:border-sky-800 min-w-[120px] text-center">
              <Plane className="w-8 h-8 text-sky-500" />
              <p className="text-xs font-semibold">Drone Asset</p>
              <p className="text-[10px] text-muted-foreground">In-mission drone</p>
            </div>
            {/* Arrow */}
            <div className="flex flex-col sm:flex-row items-center gap-1 my-2 sm:my-0">
              <div className="w-px h-6 sm:h-px sm:w-10 bg-sky-300 dark:bg-sky-700" />
              <Wifi className="w-4 h-4 text-sky-400" />
              <div className="w-px h-6 sm:h-px sm:w-10 bg-sky-300 dark:bg-sky-700" />
            </div>
            {/* Probe */}
            <div className="flex flex-col items-center gap-2 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800 min-w-[120px] text-center">
              <Cpu className="w-8 h-8 text-purple-500" />
              <p className="text-xs font-semibold">HOLOCRON Probe</p>
              <p className="text-[10px] text-muted-foreground">Site relay device</p>
            </div>
            {/* Arrow */}
            <div className="flex flex-col sm:flex-row items-center gap-1 my-2 sm:my-0">
              <div className="w-px h-6 sm:h-px sm:w-10 bg-purple-300 dark:bg-purple-700" />
              <Zap className="w-4 h-4 text-purple-400" />
              <div className="w-px h-6 sm:h-px sm:w-10 bg-purple-300 dark:bg-purple-700" />
            </div>
            {/* HOLOCRON */}
            <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border min-w-[120px] text-center">
              <div className="w-8 h-8 bg-slate-700 dark:bg-slate-600 rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs font-semibold">HOLOCRON AI</p>
              <p className="text-[10px] text-muted-foreground">Central platform</p>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Drones send telemetry and media via a nearby HOLOCRON probe. The probe relays data securely to the HOLOCRON platform over HTTPS.
          </p>
        </CardContent>
      </Card>

      {/* Capabilities */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Video,
            color: "text-sky-500 bg-sky-50 dark:bg-sky-950/30",
            title: "Media Relay",
            desc: "Drones stream video and images through the probe back to HOLOCRON. Deliverables are auto-uploaded to the project.",
            feasible: true,
          },
          {
            icon: Package,
            color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30",
            title: "CMDB Auto-Registration",
            desc: "When a drone is probe-linked, it's automatically registered as a CMDB asset with full hardware metadata.",
            feasible: true,
          },
          {
            icon: Terminal,
            color: "text-orange-500 bg-orange-50 dark:bg-orange-950/30",
            title: "Real-Time Telemetry",
            desc: "Battery %, GPS position, altitude, and mission status streamed live to HOLOCRON dashboards.",
            feasible: false,
            note: "Requires custom firmware",
          },
        ].map(c => (
          <Card key={c.title}>
            <CardContent className="pt-4 space-y-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{c.title}</p>
                {c.feasible ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 font-medium">Ready</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 font-medium">Planned</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
              {c.note && <p className="text-[10px] text-yellow-600 dark:text-yellow-400 italic">{c.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Probe Upload API reference */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Terminal className="w-4 h-4 text-slate-500" /> Probe Upload API</CardTitle>
          <CardDescription className="text-xs">Probes use this endpoint to push deliverables to a Flyguys project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs overflow-x-auto">
            <p className="text-slate-400 mb-1">{"# POST /api/flyguys/probe-upload"}</p>
            <p className="text-green-400">{"curl -X POST https://your-domain/api/flyguys/probe-upload \\"}</p>
            <p className="text-green-400">{"  -H 'Content-Type: application/json' \\"}</p>
            <p className="text-green-400">{"  -d '{"}</p>
            <p className="text-yellow-300">{"    \"siteToken\": \"YOUR_PROBE_TOKEN\","}</p>
            <p className="text-yellow-300">{"    \"projectId\": \"proj-uuid-here\","}</p>
            <p className="text-yellow-300">{"    \"fileName\": \"mission_video.mp4\","}</p>
            <p className="text-yellow-300">{"    \"fileType\": \"video\","}</p>
            <p className="text-yellow-300">{"    \"fileSizeMb\": 128,"}</p>
            <p className="text-yellow-300">{"    \"description\": \"Aerial survey footage\""}</p>
            <p className="text-green-400">{"  }'"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-2.5">
              <p className="font-semibold mb-1 text-green-700 dark:text-green-400">Auth</p>
              <p className="text-muted-foreground">Uses probe's <code className="bg-white dark:bg-slate-700 px-1 rounded">siteToken</code> for auth. No user session required.</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-2.5">
              <p className="font-semibold mb-1 text-blue-700 dark:text-blue-400">Response</p>
              <p className="text-muted-foreground">Returns <code className="bg-white dark:bg-slate-700 px-1 rounded">deliverableId</code>. Deliverable appears in project immediately.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linked Drones table */}
      {linkedDrones.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Probe-Linked Drones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drone</TableHead>
                    <TableHead>Probe ID</TableHead>
                    <TableHead>CMDB Item</TableHead>
                    <TableHead>Linked At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedDrones.map(d => (
                    <TableRow key={d.id} data-testid={`row-linked-drone-${d.id}`}>
                      <TableCell>
                        <div className="font-medium text-sm">{d.make} {d.model}</div>
                        <div className="text-xs text-muted-foreground capitalize">{d.droneType}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-400">{(d as any).probeId}</TableCell>
                      <TableCell className="font-mono text-xs text-purple-600 dark:text-purple-400">{(d as any).cmdbItemId ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(d as any).probeLinkedAt ? new Date((d as any).probeLinkedAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function FlyguysPage() {
  const { data: operators = [], isLoading: loadOps } = useQuery<FlyguysOperator[]>({ queryKey: ["/api/flyguys/operators"] });
  const { data: fleet = [], isLoading: loadFleet } = useQuery<FlyguysFleet[]>({ queryKey: ["/api/flyguys/fleet"] });
  const { data: requests = [], isLoading: loadReqs } = useQuery<FlyguysRequest[]>({ queryKey: ["/api/flyguys/requests"] });
  const { data: bids = [], isLoading: loadBids } = useQuery<FlyguaysBid[]>({ queryKey: ["/api/flyguys/bids"] });
  const { data: projects = [], isLoading: loadProjects } = useQuery<FlyguysProject[]>({ queryKey: ["/api/flyguys/projects"] });
  const { data: transactions = [], isLoading: loadTx } = useQuery<FlyguysTransaction[]>({ queryKey: ["/api/flyguys/transactions"] });

  const isLoading = loadOps || loadFleet || loadReqs || loadBids || loadProjects || loadTx;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="w-6 h-6 text-sky-500" /> Flyguys Platform
            </h1>
            <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-xs">Use-Cases Factory</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Marketplace connecting customers with drone operators — review, publish missions, and first-to-claim project assignment
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-lg px-3 py-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
          <span>First-come-first-served · Drone type matching</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="dashboard">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard" className="text-xs">Dashboard</TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests" className="text-xs">
              Customer Requests
              {requests.filter(r => r.status === "open").length > 0 && (
                <span className="ml-1.5 bg-blue-500 text-white rounded-full px-1.5 text-[10px]">{requests.filter(r => r.status === "open").length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="bidding" data-testid="tab-bidding" className="text-xs">
              Published Missions
            </TabsTrigger>
            <TabsTrigger value="projects" data-testid="tab-projects" className="text-xs">Projects</TabsTrigger>
            <TabsTrigger value="operators" data-testid="tab-operators" className="text-xs">Operators</TabsTrigger>
            <TabsTrigger value="fleet" data-testid="tab-fleet" className="text-xs">Drone Fleet</TabsTrigger>
            <TabsTrigger value="transactions" data-testid="tab-transactions" className="text-xs">Transactions</TabsTrigger>
            <TabsTrigger value="portal" data-testid="tab-portal" className="text-xs">
              Customer Portal
              {requests.filter(r => (r as any).origin === "portal" && r.status === "open").length > 0 && (
                <span className="ml-1.5 bg-sky-500 text-white rounded-full px-1.5 text-[10px]">{requests.filter(r => (r as any).origin === "portal" && r.status === "open").length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="probe" data-testid="tab-probe" className="text-xs">Probe Integration</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <DashboardTab requests={requests} projects={projects} operators={operators} fleet={fleet} transactions={transactions} />
          </TabsContent>
          <TabsContent value="requests" className="mt-4">
            <RequestsTab requests={requests} operators={operators} />
          </TabsContent>
          <TabsContent value="bidding" className="mt-4">
            <BiddingTab requests={requests} operators={operators} bids={bids} fleet={fleet} />
          </TabsContent>
          <TabsContent value="projects" className="mt-4">
            <ProjectsTab projects={projects} operators={operators} />
          </TabsContent>
          <TabsContent value="operators" className="mt-4">
            <OperatorsTab operators={operators} fleet={fleet} />
          </TabsContent>
          <TabsContent value="fleet" className="mt-4">
            <FleetTab fleet={fleet} operators={operators} />
          </TabsContent>
          <TabsContent value="transactions" className="mt-4">
            <TransactionsTab transactions={transactions} projects={projects} />
          </TabsContent>
          <TabsContent value="portal" className="mt-4">
            <CustomerPortalTab requests={requests} />
          </TabsContent>
          <TabsContent value="probe" className="mt-4">
            <ProbeIntegrationTab fleet={fleet} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
