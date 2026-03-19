import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { QRCodeSVG } from "qrcode.react";
import {
  Smartphone, Shield, ShieldCheck, ShieldAlert,
  Lock, Trash2, MapPin, Plus, Search, QrCode, Copy,
  CheckCircle2, Clock, Battery, HardDrive, Package,
  AlertTriangle, Send, Ban, Undo2, Archive, Settings2,
  BellRing, Loader2, Building2, User, Calendar, Hash,
  MonitorSmartphone, ArrowLeft, Wifi, X, ChevronRight,
} from "lucide-react";
import type { MdmDevice, MdmPolicy, MdmEnrollmentToken, MdmAction } from "@shared/schema";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(d: string | Date | null | undefined) {
  if (!d) return "Never";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60000) return "Just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

function pc(p: string) {
  return p === "ios"
    ? { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" }
    : { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30" };
}

function sc(s: string) {
  return ({
    enrolled: { label: "Enrolled", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
    pending:  { label: "Pending",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30",      dot: "bg-amber-400" },
    blocked:  { label: "Blocked",  cls: "bg-red-500/15 text-red-400 border-red-500/30",            dot: "bg-red-400" },
    retired:  { label: "Retired",  cls: "bg-muted/60 text-muted-foreground border-border/40",       dot: "bg-muted-foreground" },
  } as any)[s] ?? { label: s, cls: "bg-muted/60 text-muted-foreground border-border/40", dot: "bg-muted-foreground" };
}

function cc(s: string) {
  if (s === "compliant")     return { label: "Compliant",     icon: ShieldCheck, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (s === "non_compliant") return { label: "Non-Compliant", icon: ShieldAlert, cls: "bg-red-500/15 text-red-400 border-red-500/30" };
  return { label: "Unknown", icon: Shield, cls: "bg-muted/60 text-muted-foreground border-border/40" };
}

const PAGE_SIZE = 12;

// ─── Section title helper ────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, color = "text-muted-foreground" }: { icon: any; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{title}</span>
    </div>
  );
}

// ─── Device full-page detail ──────────────────────────────────────────────────

function DeviceDetail({ device, onBack }: { device: MdmDevice; onBack: () => void }) {
  const { toast } = useToast();
  const meta = (device.metadata as any) ?? {};
  const [msgText, setMsgText] = useState("");
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  const platC = pc(device.platform);
  const statC = sc(device.status);
  const compC = cc(device.complianceStatus);
  const CompIcon = compC.icon;
  const isRetired = device.status === "retired";

  const { data: actions, isLoading: actionsLoading } = useQuery<MdmAction[]>({
    queryKey: ["/api/mdm/devices", device.id, "actions"],
    queryFn: async () => { const r = await apiRequest("GET", `/api/mdm/devices/${device.id}/actions`); return r.json(); },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, payload }: { action: string; payload?: any }) => {
      const res = await apiRequest("POST", `/api/mdm/devices/${device.id}/actions`, { action, payload });
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mdm/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mdm/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mdm/devices", device.id, "actions"] });
      toast({ title: "Command sent", description: `'${vars.action}' queued for ${device.name}` });
      if (vars.action === "message") setMsgText("");
    },
    onError: (e: any) => toast({ title: "Action failed", description: e.message, variant: "destructive" }),
  });

  const isPending = actionMutation.isPending;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* ── Back + hero ── */}
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground mb-4 -ml-1" data-testid="button-back-to-devices">
            <ArrowLeft className="h-3.5 w-3.5" /> All Devices
          </Button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 flex-shrink-0 ${platC.bg} ${platC.border}`}>
                <Smartphone className={`h-8 w-8 ${platC.text}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold">{device.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {device.manufacturer ? `${device.manufacturer} · ` : ""}{device.model ?? "Unknown model"}{device.osVersion ? ` · ${device.osVersion}` : ""}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-bold border ${platC.bg} ${platC.text} ${platC.border}`}>
                    {device.platform === "ios" ? "iOS" : "Android"}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 h-5 px-2 rounded-full text-[10px] font-semibold border ${statC.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statC.dot}`} />{statC.label}
                  </span>
                  <span className={`inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-semibold border ${compC.cls}`}>
                    <CompIcon className="h-2.5 w-2.5" />{compC.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Last seen {timeAgo(device.lastCheckIn)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Remote action tiles ── */}
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={Settings2} title="Remote Actions" color="text-primary" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-3">
              {[
                { action: "lock",   Icon: Lock,    label: "Lock Device",   style: "border-border/40 text-muted-foreground hover:bg-muted/30 hover:text-foreground", condition: true },
                { action: "locate", Icon: MapPin,  label: "Locate",        style: "border-border/40 text-muted-foreground hover:bg-muted/30 hover:text-foreground", condition: true },
              ].map(({ action, Icon, label, style }) => (
                <button
                  key={action}
                  className={`flex flex-col items-center gap-2 py-4 rounded-xl border bg-card transition-all disabled:opacity-40 disabled:cursor-not-allowed ${style}`}
                  disabled={isRetired || isPending}
                  onClick={() => actionMutation.mutate({ action })}
                  data-testid={`button-action-${action}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[11px] font-semibold">{label}</span>
                </button>
              ))}

              {device.status === "blocked" ? (
                <button
                  className="flex flex-col items-center gap-2 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isPending}
                  onClick={() => actionMutation.mutate({ action: "unblock" })}
                  data-testid="button-action-unblock"
                >
                  <Undo2 className="h-5 w-5" />
                  <span className="text-[11px] font-semibold">Unblock</span>
                </button>
              ) : (
                <button
                  className="flex flex-col items-center gap-2 py-4 rounded-xl border border-amber-500/30 bg-amber-500/8 text-amber-400 hover:bg-amber-500/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isRetired || isPending}
                  onClick={() => actionMutation.mutate({ action: "block" })}
                  data-testid="button-action-block"
                >
                  <Ban className="h-5 w-5" />
                  <span className="text-[11px] font-semibold">Block</span>
                </button>
              )}

              {isRetired && !(meta as any)?.wiped ? (
                <button
                  className="flex flex-col items-center gap-2 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isPending}
                  onClick={() => actionMutation.mutate({ action: "reactivate" })}
                  data-testid="button-action-reactivate"
                >
                  <Undo2 className="h-5 w-5" />
                  <span className="text-[11px] font-semibold">Reactivate</span>
                </button>
              ) : (
                <button
                  className="flex flex-col items-center gap-2 py-4 rounded-xl border border-border/40 bg-card text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={isRetired || isPending}
                  onClick={() => actionMutation.mutate({ action: "retire" })}
                  data-testid="button-action-retire"
                >
                  <Archive className="h-5 w-5" />
                  <span className="text-[11px] font-semibold">Retire</span>
                </button>
              )}

              <button
                className="flex flex-col items-center gap-2 py-4 rounded-xl border border-red-500/30 bg-red-500/8 text-red-400 hover:bg-red-500/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={isRetired || isPending}
                onClick={() => setShowWipeConfirm(true)}
                data-testid="button-action-wipe"
              >
                <Trash2 className="h-5 w-5" />
                <span className="text-[11px] font-semibold">Remote Wipe</span>
              </button>
            </div>

            {/* Message input */}
            <div className="mt-4 pt-4 border-t border-border/30">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Send Message to Device</p>
              <div className="flex gap-2">
                <Input
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="Push a notification or message to this device…"
                  className="flex-1 h-9 text-xs"
                  data-testid="input-device-message"
                  onKeyDown={e => { if (e.key === "Enter" && msgText.trim() && !isPending && !isRetired) actionMutation.mutate({ action: "message", payload: { text: msgText } }); }}
                />
                <Button size="sm" className="h-9 px-4 gap-1.5" disabled={!msgText.trim() || isPending || isRetired} onClick={() => actionMutation.mutate({ action: "message", payload: { text: msgText } })} data-testid="button-send-message">
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Tabbed detail ── */}
        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto mb-1">
            {["overview", "hardware", "apps", "history"].map(t => (
              <TabsTrigger
                key={t}
                value={t}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4 pb-2 text-xs font-semibold capitalize"
                data-testid={`tab-device-${t}`}
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Device info */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <SectionTitle icon={Smartphone} title="Device Info" />
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {[
                      { icon: Hash,      label: "Serial",      value: device.serialNumber ?? "—" },
                      { icon: Hash,      label: "IMEI",        value: device.imei ?? "—" },
                      { icon: User,      label: "Ownership",   value: device.ownership === "byod" ? "BYOD" : "Corporate" },
                      { icon: Building2, label: "Department",  value: device.department ?? "—" },
                      { icon: User,      label: "Enrolled by", value: device.enrolledBy ?? "—" },
                      { icon: Calendar,  label: "Enrolled",    value: device.enrollmentDate ? new Date(device.enrollmentDate).toLocaleDateString() : "—" },
                      { icon: Wifi,      label: "Last seen",   value: timeAgo(device.lastCheckIn) },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon className="h-3 w-3 text-muted-foreground/60" />
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                        </div>
                        <p className="text-xs font-semibold truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Compliance */}
              <Card className={meta.complianceIssues?.length > 0 ? "border-red-500/25" : ""}>
                <CardContent className="p-4 space-y-3">
                  <SectionTitle
                    icon={device.complianceStatus === "compliant" ? ShieldCheck : ShieldAlert}
                    title="Compliance"
                    color={device.complianceStatus === "compliant" ? "text-emerald-400" : device.complianceStatus === "non_compliant" ? "text-red-400" : "text-muted-foreground"}
                  />
                  {meta.complianceIssues?.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[10px] text-red-400 font-medium">{meta.complianceIssues.length} issue{meta.complianceIssues.length !== 1 ? "s" : ""} found</p>
                      {meta.complianceIssues.map((issue: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/8 border border-red-500/20">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                          <span className="text-[11px] text-red-300">{issue}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-emerald-400">
                      <ShieldCheck className="h-10 w-10 mb-2 opacity-40" />
                      <p className="text-sm font-semibold">All checks passed</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Device meets compliance policy</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Hardware */}
          <TabsContent value="hardware" className="mt-4">
            {(meta.batteryLevel != null || meta.storageTotal != null) ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meta.batteryLevel != null && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <SectionTitle icon={Battery} title="Battery" />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Charge Level</span>
                          <span className={`text-2xl font-bold ${meta.batteryLevel > 50 ? "text-emerald-400" : meta.batteryLevel > 20 ? "text-amber-400" : "text-red-400"}`}>{meta.batteryLevel}%</span>
                        </div>
                        <Progress value={meta.batteryLevel} className="h-3" />
                        <p className="text-[10px] text-muted-foreground">{meta.batteryLevel > 50 ? "Healthy charge level" : meta.batteryLevel > 20 ? "Moderate — consider charging" : "Low battery — please charge"}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {meta.storageTotal != null && (
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <SectionTitle icon={HardDrive} title="Storage" />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Used Space</span>
                          <span className="text-2xl font-bold">{meta.storageUsed ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {meta.storageTotal} GB</span></span>
                        </div>
                        <Progress value={Math.min(((meta.storageUsed ?? 0) / meta.storageTotal) * 100, 100)} className="h-3" />
                        <p className="text-[10px] text-muted-foreground">{meta.storageTotal - (meta.storageUsed ?? 0)} GB available</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="p-10 flex flex-col items-center text-muted-foreground">
                  <HardDrive className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">No hardware data</p>
                  <p className="text-[11px] mt-1">Hardware metrics are reported at next device check-in</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Apps */}
          <TabsContent value="apps" className="mt-4">
            {meta.installedApps?.length > 0 ? (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <SectionTitle icon={Package} title={`Installed Apps`} />
                    <span className="text-[10px] text-muted-foreground">{meta.installedApps.length} apps</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {meta.installedApps.map((app: any, i: number) => (
                      <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/30 bg-muted/10">
                        <div className="w-8 h-8 rounded-lg bg-muted/40 border border-border/30 flex items-center justify-center flex-shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{typeof app === "string" ? app : app.name}</p>
                          {app.version && <p className="text-[10px] text-muted-foreground">{app.version}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-10 flex flex-col items-center text-muted-foreground">
                  <Package className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">No app inventory</p>
                  <p className="text-[11px] mt-1">App data is reported at next device check-in</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="mt-4">
            {actionsLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
            ) : !actions?.length ? (
              <Card>
                <CardContent className="p-10 flex flex-col items-center text-muted-foreground">
                  <BellRing className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">No action history</p>
                  <p className="text-[11px] mt-1">Commands sent to this device appear here</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border/30">
                    {actions.map(a => {
                      const isOk   = a.status === "completed";
                      const isFail = a.status === "failed";
                      return (
                        <div key={a.id} className="flex items-center gap-4 px-4 py-3">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOk ? "bg-emerald-400" : isFail ? "bg-red-400" : "bg-amber-400"}`} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold capitalize">{a.action.replace(/_/g, " ")}</p>
                            <p className="text-[11px] text-muted-foreground">{timeAgo(a.createdAt)}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${isOk ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : isFail ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                            {a.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Wipe confirm */}
      <Dialog open={showWipeConfirm} onOpenChange={setShowWipeConfirm}>
        <DialogContent className="max-w-sm" data-testid="dialog-wipe-confirm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400"><Trash2 className="h-4 w-4" />Remote Wipe — Are you sure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">This will erase all data on <strong className="text-foreground">{device.name}</strong> and mark it as retired. This action <strong className="text-red-400">cannot be undone</strong>.</p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowWipeConfirm(false)} data-testid="button-wipe-cancel">Cancel</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1.5" data-testid="button-wipe-confirm" onClick={() => { actionMutation.mutate({ action: "wipe" }); setShowWipeConfirm(false); }}>
              <Trash2 className="h-3.5 w-3.5" />Wipe Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}

// ─── Device grid card ─────────────────────────────────────────────────────────

function DeviceCard({ device, onClick }: { device: MdmDevice; onClick: () => void }) {
  const meta = (device.metadata as any) ?? {};
  const platC = pc(device.platform);
  const statC = sc(device.status);
  const compC = cc(device.complianceStatus);
  const CompIcon = compC.icon;
  return (
    <Card
      className="cursor-pointer hover:border-primary/30 transition-all"
      onClick={onClick}
      data-testid={`card-device-${device.id}`}
    >
      <CardContent className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${platC.bg} ${platC.border}`}>
            <Smartphone className={`h-5 w-5 ${platC.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{device.name}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{device.model ?? "Unknown"}{device.osVersion ? ` · ${device.osVersion}` : ""}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 mt-1" />
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[9px] font-bold border ${platC.bg} ${platC.text} ${platC.border}`}>
            {device.platform === "ios" ? "iOS" : "Android"}
          </span>
          <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[9px] font-semibold border ${statC.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statC.dot}`} />{statC.label}
          </span>
          <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded text-[9px] font-semibold border ${compC.cls}`}>
            <CompIcon className="h-2.5 w-2.5" />{compC.label}
          </span>
          {device.ownership === "byod" && (
            <span className="inline-flex items-center h-5 px-1.5 rounded text-[9px] font-semibold border bg-violet-500/10 text-violet-400 border-violet-500/25">BYOD</span>
          )}
        </div>

        {/* Hardware mini-bars */}
        {(meta.batteryLevel != null || meta.storageTotal != null) && (
          <div className="space-y-1.5 mb-3">
            {meta.batteryLevel != null && (
              <div className="flex items-center gap-2">
                <Battery className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className={`h-full rounded-full ${meta.batteryLevel > 50 ? "bg-emerald-500" : meta.batteryLevel > 20 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${meta.batteryLevel}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-7 text-right">{meta.batteryLevel}%</span>
              </div>
            )}
            {meta.storageTotal != null && (
              <div className="flex items-center gap-2">
                <HardDrive className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(((meta.storageUsed ?? 0) / meta.storageTotal) * 100, 100)}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-7 text-right">{Math.round(((meta.storageUsed ?? 0) / meta.storageTotal) * 100)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2.5 border-t border-border/30">
          <span>{device.department ?? "No department"}</span>
          <span>{timeAgo(device.lastCheckIn)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Enrollment Tab ───────────────────────────────────────────────────────────

function EnrollmentTab() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const [label, setLabel] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("48");
  const [generatedToken, setGeneratedToken] = useState<MdmEnrollmentToken | null>(null);

  const { data: tokens = [], isLoading } = useQuery<MdmEnrollmentToken[]>({ queryKey: ["/api/mdm/tokens"] });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/mdm/tokens", { platform, label: label || undefined, expiresInHours: parseInt(expiresInHours) });
      return res.json();
    },
    onSuccess: (data: MdmEnrollmentToken) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mdm/tokens"] });
      setGeneratedToken(data);
      setLabel("");
    },
    onError: (e: any) => toast({ title: "Failed to generate token", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/mdm/tokens/${id}`); return res.json(); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/mdm/tokens"] }),
    onError: (e: any) => toast({ title: "Failed to delete token", description: e.message, variant: "destructive" }),
  });

  const enrollUrl = generatedToken ? `${window.location.origin}/enroll/${generatedToken.token}` : "";
  const copyUrl = () => { navigator.clipboard.writeText(enrollUrl); toast({ title: "Copied!", description: "Enrollment URL copied" }); };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Generator */}
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-sm">Generate Enrollment Link</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Create a QR code or shareable URL to enroll a device</p>
            </div>
            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Platform</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["ios", "android"] as const).map(p => {
                      const platC = pc(p);
                      return (
                        <button key={p} onClick={() => setPlatform(p)}
                          className={`py-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-2 ${platform === p ? `${platC.bg} ${platC.border} ${platC.text}` : "border-border/40 text-muted-foreground hover:border-border"}`}
                          data-testid={`button-platform-${p}`}
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                          {p === "ios" ? "iOS (iPhone / iPad)" : "Android"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-bold">Label (optional)</Label>
                  <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Sales team iPhones" className="h-9 text-xs" data-testid="input-enrollment-label" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-bold">Expires After</Label>
                  <Select value={expiresInHours} onValueChange={setExpiresInHours}>
                    <SelectTrigger className="h-9 text-xs" data-testid="select-enrollment-expires"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full gap-2" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-generate-enrollment">
                  {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />}
                  Generate Enrollment QR
                </Button>
              </CardContent>
            </Card>

            {generatedToken && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-5 space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                      <QRCodeSVG value={enrollUrl} size={160} data-testid="qr-enrollment" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Enrollment URL</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] flex-1 bg-muted/40 rounded-lg px-3 py-2 truncate font-mono border border-border/30">{enrollUrl}</code>
                      <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={copyUrl} data-testid="button-copy-enrollment-url"><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                    <span>Platform: <strong className="text-foreground capitalize">{generatedToken.platform}</strong></span>
                    <span>Expires: <strong className="text-foreground">{new Date(generatedToken.expiresAt).toLocaleDateString()}</strong></span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Active tokens */}
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-sm">Active Enrollment Tokens</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Previously generated enrollment links</p>
            </div>
            {isLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
            ) : tokens.length === 0 ? (
              <Card>
                <CardContent className="p-10 flex flex-col items-center text-muted-foreground">
                  <QrCode className="h-12 w-12 mb-3 opacity-20" />
                  <p className="font-medium">No tokens yet</p>
                  <p className="text-[11px] mt-1">Generate a token to start enrolling devices</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {tokens.map(t => {
                  const expired = new Date() > new Date(t.expiresAt);
                  const platC = pc(t.platform);
                  return (
                    <Card key={t.id} className={t.usedAt ? "opacity-60" : expired ? "border-red-500/20" : ""} data-testid={`card-token-${t.id}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border ${platC.bg} ${platC.border}`}>
                          <Smartphone className={`h-4 w-4 ${platC.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{t.label ?? `${t.platform} token`}</p>
                          <p className="text-[10px] text-muted-foreground">{t.usedAt ? `Used ${timeAgo(t.usedAt)}` : expired ? "Expired" : `Expires ${timeAgo(t.expiresAt)}`}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${t.usedAt ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : expired ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                          {t.usedAt ? "Used" : expired ? "Expired" : "Active"}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400" onClick={() => deleteMutation.mutate(t.id)} disabled={deleteMutation.isPending} data-testid={`button-delete-token-${t.id}`}>
                          <X className="h-3 w-3" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── Policies Tab ─────────────────────────────────────────────────────────────

type PolicyRule = { key: string; label: string; description: string; type: "boolean" | "number" };
const POLICY_RULES: PolicyRule[] = [
  { key: "requirePasscode",   label: "Require Passcode",        description: "Device must have a screen lock passcode",         type: "boolean" },
  { key: "requireEncryption", label: "Require Encryption",      description: "Device storage must be encrypted",                type: "boolean" },
  { key: "blockJailbroken",   label: "Block Jailbroken/Rooted", description: "Prevent jailbroken or rooted devices",            type: "boolean" },
  { key: "requireOsVersion",  label: "Minimum OS Version",      description: "Minimum acceptable OS version",                   type: "number"  },
  { key: "maxOfflineDays",    label: "Max Offline Days",        description: "Days before device is marked non-compliant",      type: "number"  },
  { key: "allowCamera",       label: "Allow Camera",            description: "Allow device camera usage",                       type: "boolean" },
  { key: "allowScreenshot",   label: "Allow Screenshots",       description: "Allow device screenshots",                        type: "boolean" },
  { key: "allowBluetooth",    label: "Allow Bluetooth",         description: "Allow Bluetooth connectivity",                    type: "boolean" },
  { key: "allowPersonalApps", label: "Allow Personal Apps",     description: "Allow installation of personal apps (BYOD)",      type: "boolean" },
];

function PolicyDialog({ open, onClose, existing }: { open: boolean; onClose: () => void; existing?: MdmPolicy }) {
  const { toast } = useToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [platform, setPlatform] = useState(existing?.platform ?? "all");
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);
  const [ruleValues, setRuleValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    (existing?.rules as any[] ?? []).forEach((r: any) => { init[r.key] = r.value; });
    return init;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rules = POLICY_RULES.map(r => ({ key: r.key, label: r.label, value: ruleValues[r.key] ?? (r.type === "boolean" ? false : null) })).filter(r => r.value !== null && r.value !== false || r.value === false);
      const payload = { name, description: description || null, platform, isDefault, rules };
      if (existing) { const res = await apiRequest("PATCH", `/api/mdm/policies/${existing.id}`, payload); return res.json(); }
      const res = await apiRequest("POST", "/api/mdm/policies", payload);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mdm/policies"] }); toast({ title: existing ? "Policy updated" : "Policy created" }); onClose(); },
    onError: (e: any) => toast({ title: "Failed to save policy", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-policy">
        <DialogHeader><DialogTitle>{existing ? "Edit Policy" : "Create MDM Policy"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Policy Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Corporate Baseline" className="h-8 text-xs" data-testid="input-policy-name" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description…" className="text-xs min-h-[60px]" data-testid="input-policy-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-policy-platform"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="ios">iOS Only</SelectItem>
                  <SelectItem value="android">Android Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} id="policy-default" data-testid="switch-policy-default" />
              <Label htmlFor="policy-default" className="text-xs cursor-pointer">Default Policy</Label>
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-2 border-b border-border/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Policy Rules</p>
              </div>
              <div className="divide-y divide-border/20">
                {POLICY_RULES.map(rule => (
                  <div key={rule.key} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold">{rule.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{rule.description}</p>
                    </div>
                    {rule.type === "boolean" && <Switch checked={!!ruleValues[rule.key]} onCheckedChange={v => setRuleValues(prev => ({ ...prev, [rule.key]: v }))} data-testid={`switch-rule-${rule.key}`} />}
                    {rule.type === "number" && <Input type="number" value={ruleValues[rule.key] ?? ""} onChange={e => setRuleValues(prev => ({ ...prev, [rule.key]: e.target.value ? Number(e.target.value) : null }))} className="h-7 text-xs w-20" placeholder="—" data-testid={`input-rule-${rule.key}`} />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-policy-cancel">Cancel</Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending} data-testid="button-policy-save">
            {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Create Policy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoliciesTab() {
  const { toast } = useToast();
  const { data: policies = [], isLoading } = useQuery<MdmPolicy[]>({ queryKey: ["/api/mdm/policies"] });
  const [showDialog, setShowDialog] = useState(false);
  const [editPolicy, setEditPolicy] = useState<MdmPolicy | undefined>();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const res = await apiRequest("DELETE", `/api/mdm/policies/${id}`); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mdm/policies"] }); toast({ title: "Policy deleted" }); },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" }),
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">MDM Policies</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Define compliance rules applied to enrolled devices</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditPolicy(undefined); setShowDialog(true); }} data-testid="button-create-policy">
            <Plus className="h-3.5 w-3.5" />New Policy
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
        ) : policies.length === 0 ? (
          <Card>
            <CardContent className="p-12 flex flex-col items-center text-muted-foreground">
              <Shield className="h-14 w-14 mb-4 opacity-15" />
              <p className="font-semibold">No policies yet</p>
              <p className="text-[11px] mt-1">Create a policy to enforce compliance rules on enrolled devices</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowDialog(true)} data-testid="button-create-first-policy">
                <Plus className="h-3.5 w-3.5" />Create First Policy
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {policies.map(p => {
              const rules = (p.rules as any[]) ?? [];
              const active = rules.filter(r => r.value !== false && r.value !== null).length;
              return (
                <Card key={p.id} data-testid={`card-policy-${p.id}`}>
                  <CardContent className="p-0">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Settings2 className="h-4 w-4 text-primary flex-shrink-0" />
                            <span className="font-bold">{p.name}</span>
                            {p.isDefault && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">Default</span>}
                          </div>
                          {p.description && <p className="text-[11px] text-muted-foreground mt-1.5">{p.description}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditPolicy(p); setShowDialog(true); }} data-testid={`button-edit-policy-${p.id}`}><Settings2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-policy-${p.id}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/10 border-t border-border/30 text-[11px] text-muted-foreground">
                      <span className="capitalize">{p.platform === "all" ? "All Platforms" : p.platform}</span>
                      <span>·</span>
                      <span><strong className="text-foreground">{active}</strong> rule{active !== 1 ? "s" : ""} active</span>
                      <span className="ml-auto">{new Date(p.createdAt!).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <PolicyDialog open={showDialog} onClose={() => { setShowDialog(false); setEditPolicy(undefined); }} existing={editPolicy} />
      </div>
    </ScrollArea>
  );
}

// ─── Add Device Dialog ────────────────────────────────────────────────────────

function AddDeviceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", platform: "ios", model: "", manufacturer: "", osVersion: "", serialNumber: "", imei: "", ownership: "corporate", department: "" });

  const createMutation = useMutation({
    mutationFn: async () => { const res = await apiRequest("POST", "/api/mdm/devices", form); return res.json(); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mdm/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mdm/stats"] });
      toast({ title: "Device registered", description: `${form.name} added as pending enrollment` });
      onClose();
      setForm({ name: "", platform: "ios", model: "", manufacturer: "", osVersion: "", serialNumber: "", imei: "", ownership: "corporate", department: "" });
    },
    onError: (e: any) => toast({ title: "Failed to add device", description: e.message, variant: "destructive" }),
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" data-testid="dialog-add-device">
        <DialogHeader><DialogTitle>Add Mobile Device</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Device Name *</Label>
            <Input value={form.name} onChange={f("name")} placeholder="e.g. John's iPhone" className="h-8 text-xs" data-testid="input-device-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(p => ({ ...p, platform: v }))}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-device-platform"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ios">iOS</SelectItem><SelectItem value="android">Android</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Ownership</Label>
              <Select value={form.ownership} onValueChange={v => setForm(p => ({ ...p, ownership: v }))}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-device-ownership"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="corporate">Corporate</SelectItem><SelectItem value="byod">BYOD</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Model</Label><Input value={form.model} onChange={f("model")} placeholder="iPhone 16 Pro" className="h-8 text-xs" data-testid="input-device-model" /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Manufacturer</Label><Input value={form.manufacturer} onChange={f("manufacturer")} placeholder="Apple / Samsung" className="h-8 text-xs" data-testid="input-device-manufacturer" /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">OS Version</Label><Input value={form.osVersion} onChange={f("osVersion")} placeholder="iOS 18.2" className="h-8 text-xs" data-testid="input-device-os" /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Department</Label><Input value={form.department} onChange={f("department")} placeholder="Sales, IT…" className="h-8 text-xs" data-testid="input-device-department" /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">Serial Number</Label><Input value={form.serialNumber} onChange={f("serialNumber")} placeholder="Optional" className="h-8 text-xs" data-testid="input-device-serial" /></div>
            <div><Label className="text-xs text-muted-foreground mb-1.5 block">IMEI</Label><Input value={form.imei} onChange={f("imei")} placeholder="Optional" className="h-8 text-xs" data-testid="input-device-imei" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-add-device-cancel">Cancel</Button>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.name.trim() || createMutation.isPending} data-testid="button-add-device-save">
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Add Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NetworkOpsMobile() {
  const [mainTab, setMainTab] = useState<"devices" | "enrollment" | "policies">("devices");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<MdmDevice | null>(null);
  const [page, setPage] = useState(0);
  const [showAddDevice, setShowAddDevice] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<{
    total: number; enrolled: number; pending: number; blocked: number; retired: number;
    compliant: number; nonCompliant: number; ios: number; android: number;
  }>({ queryKey: ["/api/mdm/stats"] });

  const { data: devices = [], isLoading: devicesLoading } = useQuery<MdmDevice[]>({
    queryKey: ["/api/mdm/devices", platformFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest("GET", `/api/mdm/devices?${params.toString()}`);
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return devices;
    const q = search.toLowerCase();
    return devices.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.model?.toLowerCase().includes(q) ||
      d.manufacturer?.toLowerCase().includes(q) ||
      d.department?.toLowerCase().includes(q)
    );
  }, [devices, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginated = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // ── Full-page device detail (assets page pattern) ──
  if (selectedDevice) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Sticky mini header */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border/40 flex-shrink-0 bg-card/50">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <MonitorSmartphone className="h-3.5 w-3.5" />
            MDM
            <span className="text-border">/</span>
            <span className="text-foreground truncate max-w-[200px]">{selectedDevice.name}</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <DeviceDetail device={selectedDevice} onBack={() => setSelectedDevice(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <MonitorSmartphone className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">Mobile Device Management</h2>
            <p className="text-[11px] text-muted-foreground">Android &amp; iOS · ITIL Asset &amp; Config Management</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowAddDevice(true)} data-testid="button-add-mobile-device">
          <Plus className="h-3.5 w-3.5" />Add Device
        </Button>
      </div>

      {/* ── Main tabs ── */}
      <div className="flex border-b border-border/40 flex-shrink-0 px-6">
        {([
          { key: "devices",    label: "Devices",    count: stats?.total },
          { key: "enrollment", label: "Enrollment" },
          { key: "policies",   label: "Policies" },
        ] as const).map(({ key, label, count }: any) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            data-testid={`tab-main-${key}`}
            className={`py-3 pr-6 text-[12px] font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              mainTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {count !== undefined && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${mainTab === key ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Devices list view ── */}
      {mainTab === "devices" && (
        <ScrollArea className="flex-1">
          <div className="p-6 max-w-6xl mx-auto space-y-6">

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Devices", value: stats?.total,      icon: MonitorSmartphone, color: "text-primary",      bg: "bg-primary/10" },
                { label: "Enrolled",      value: stats?.enrolled,   icon: CheckCircle2,      color: "text-emerald-400", bg: "bg-emerald-500/10" },
                { label: "Compliant",     value: stats?.compliant,  icon: ShieldCheck,       color: "text-emerald-400", bg: "bg-emerald-500/10" },
                { label: "Issues",        value: stats?.nonCompliant, icon: ShieldAlert,     color: "text-red-400",     bg: "bg-red-500/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label} className="stat-card-gradient">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`p-1 rounded-md ${bg}`}><Icon className={`h-3.5 w-3.5 ${color}`} /></div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                    </div>
                    {statsLoading ? <Skeleton className="h-7 w-10 mt-1" /> : <p className={`text-2xl font-bold ${color}`}>{value ?? 0}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search devices…" className="h-8 pl-8 text-xs w-[200px]" data-testid="input-device-search" />
              </div>
              <Select value={platformFilter} onValueChange={v => { setPlatformFilter(v); setPage(0); }}>
                <SelectTrigger className="h-8 text-xs w-[130px]" data-testid="select-platform-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="h-8 text-xs w-[130px]" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="enrolled">Enrolled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[10px] ml-auto">{filtered.length} device{filtered.length !== 1 ? "s" : ""}</Badge>
            </div>

            {/* Grid */}
            {devicesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
              </div>
            ) : paginated.length === 0 ? (
              <Card>
                <CardContent className="p-12 flex flex-col items-center text-muted-foreground">
                  <Smartphone className="h-14 w-14 mb-4 opacity-15" />
                  <p className="font-semibold">{devices.length === 0 ? "No devices enrolled" : "No matches"}</p>
                  <p className="text-[11px] mt-1">{devices.length === 0 ? "Add a device or generate an enrollment link to get started" : "Try adjusting the search or filters"}</p>
                  {devices.length === 0 && (
                    <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowAddDevice(true)} data-testid="button-add-first-device">
                      <Plus className="h-3.5 w-3.5" />Add First Device
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginated.map(d => (
                    <DeviceCard key={d.id} device={d} onClick={() => setSelectedDevice(d)} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                    <span>{filtered.length} device{filtered.length !== 1 ? "s" : ""} · page {safePage + 1} of {totalPages}</span>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={safePage === 0} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">← Prev</Button>
                      <Button variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">Next →</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      )}

      {mainTab === "enrollment" && <EnrollmentTab />}
      {mainTab === "policies" && <PoliciesTab />}

      <AddDeviceDialog open={showAddDevice} onClose={() => setShowAddDevice(false)} />
    </div>
  );
}
