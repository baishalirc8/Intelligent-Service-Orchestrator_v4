import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Users, User, Phone, Mail, Clock, Shield, Search,
  CheckCircle2, AlertCircle, Coffee, Moon, PhoneCall,
  Activity, Briefcase, Bot, Settings2, Filter
} from "lucide-react";

interface RosterEntry {
  subscriptionId: string;
  userId: string;
  roleId: string;
  humanName: string;
  humanEmail: string | null;
  contactPhone: string | null;
  roleName: string;
  roleTitle: string;
  department: string;
  level: string;
  icon: string;
  color: string;
  availabilityStatus: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  currentWorkload: number;
  maxWorkload: number;
  hasAiShadow: boolean;
  lastStatusChange: string | null;
}

interface RosterData {
  roster: RosterEntry[];
  summary: {
    total: number;
    totalAvailable: number;
    byStatus: Record<string, number>;
    byDepartment: Record<string, number>;
    totalCapacity: number;
    totalLoad: number;
    utilizationPercent: number;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof CheckCircle2; dot: string }> = {
  available: { label: "Available", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle2, dot: "bg-emerald-500" },
  on_call: { label: "On Call", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", icon: PhoneCall, dot: "bg-blue-500" },
  busy: { label: "Busy", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: AlertCircle, dot: "bg-amber-500" },
  on_break: { label: "On Break", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: Coffee, dot: "bg-orange-500" },
  off_duty: { label: "Off Duty", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30", icon: Moon, dot: "bg-slate-500" },
};

function StatusDot({ status, pulse }: { status: string; pulse?: boolean }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.off_duty;
  return (
    <span className="relative flex h-2.5 w-2.5">
      {pulse && (status === "available" || status === "on_call") && (
        <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", cfg.dot)} />
      )}
      <span className={cn("relative inline-flex rounded-full h-2.5 w-2.5", cfg.dot)} />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.off_duty;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 text-[10px] px-2 py-0.5", cfg.border, cfg.color)} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

function WorkloadBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const color = pct >= 80 ? "bg-red-500" : pct >= 50 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div data-testid="workload-bar">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] text-muted-foreground">Workload</span>
        <span className="text-[10px] font-medium">{current}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AvailabilityDistribution({ byStatus }: { byStatus: Record<string, number> }) {
  const total = Object.values(byStatus).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    key,
    label: cfg.label,
    color: cfg.dot,
    count: byStatus[key] || 0,
  }));
  return (
    <div data-testid="availability-distribution">
      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted/30">
        {segments.map(seg => seg.count > 0 && (
          <div key={seg.key} className={seg.color} style={{ width: `${(seg.count / total) * 100}%` }} title={`${seg.label}: ${seg.count}`} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-full", seg.color)} />
            {seg.label}: {seg.count}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditAvailabilityDialog({ entry, onSave }: { entry: RosterEntry; onSave: (id: string, data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(entry.availabilityStatus);
  const [maxWL, setMaxWL] = useState(String(entry.maxWorkload));
  const [phone, setPhone] = useState(entry.contactPhone || "");
  const [shiftHours, setShiftHours] = useState("8");

  function handleSave() {
    const now = new Date();
    const shiftEnd = new Date(now.getTime() + parseInt(shiftHours) * 60 * 60 * 1000);
    onSave(entry.subscriptionId, {
      availabilityStatus: status,
      maxWorkload: parseInt(maxWL) || 5,
      contactPhone: phone || null,
      shiftStart: status !== "off_duty" ? now.toISOString() : null,
      shiftEnd: status !== "off_duty" ? shiftEnd.toISOString() : null,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-edit-${entry.subscriptionId}`}>
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{entry.humanName} — Availability</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status !== "off_duty" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Shift Duration (hours)</label>
              <Input type="number" min="1" max="24" value={shiftHours} onChange={e => setShiftHours(e.target.value)} data-testid="input-shift-hours" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Workload</label>
            <Input type="number" min="1" max="20" value={maxWL} onChange={e => setMaxWL(e.target.value)} data-testid="input-max-workload" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Contact Phone</label>
            <Input placeholder="+1 555-0123" value={phone} onChange={e => setPhone(e.target.value)} data-testid="input-phone" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel">Cancel</Button>
          <Button onClick={handleSave} data-testid="button-save-availability">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatShiftTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "";
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function OnCallRoster() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");

  const { data, isLoading } = useQuery<RosterData>({
    queryKey: ["/api/roster"],
    refetchInterval: 15000,
  });

  const updateAvailability = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/roster/${id}/availability`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roster"] });
      toast({ title: "Availability updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    },
  });

  function handleSave(id: string, updates: any) {
    updateAvailability.mutate({ id, updates });
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const roster = data?.roster || [];
  const summary = data?.summary;
  const departments = [...new Set(roster.map(r => r.department))].sort();

  const filtered = roster.filter(r => {
    if (filterStatus !== "all" && r.availabilityStatus !== filterStatus) return false;
    if (filterDept !== "all" && r.department !== filterDept) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.humanName.toLowerCase().includes(q) ||
        r.roleName.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto" data-testid="page-on-call-roster">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card data-testid="card-total-personnel">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{summary?.total || 0}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total Personnel</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-available-now">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{summary?.totalAvailable || 0}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Available Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-on-call">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500/10">
                <PhoneCall className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{summary?.byStatus?.on_call || 0}</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">On Call</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-utilization">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
                <Activity className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{summary?.utilizationPercent || 0}%</p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Utilization</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-workload">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10">
                <Briefcase className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-black">{summary?.totalLoad || 0}<span className="text-sm font-normal text-muted-foreground">/{summary?.totalCapacity || 0}</span></p>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Active Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <AvailabilityDistribution byStatus={summary?.byStatus || {}} />
        </CardContent>
      </Card>

      <Card data-testid="card-roster-list">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2 text-base flex-1">
              <Shield className="h-5 w-5 text-blue-400" />
              On-Call Roster
              <Badge variant="secondary" className="text-xs ml-1">{filtered.length} of {roster.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, role, dept..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs w-[200px]"
                  data-testid="input-search-roster"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs w-[130px]" data-testid="select-filter-status">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger className="h-8 text-xs w-[180px]" data-testid="select-filter-dept">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Users className="h-12 w-12 mb-4 text-muted-foreground/30" />
              <p className="text-lg font-medium">No personnel found</p>
              <p className="text-sm mt-1">
                {roster.length === 0
                  ? "Assign human names to role subscriptions in Crews & Agents to populate the roster"
                  : "Try adjusting your search or filters"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(entry => (
                <div key={entry.subscriptionId} className="flex items-center gap-4 py-3 px-3 rounded-lg hover:bg-muted/20 transition-colors" data-testid={`row-roster-${entry.subscriptionId}`}>
                  <div className="relative">
                    <div className="flex items-center justify-center w-11 h-11 rounded-xl border" style={{ borderColor: entry.color, backgroundColor: `${entry.color}10` }}>
                      <User className="h-5 w-5" style={{ color: entry.color }} />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5">
                      <StatusDot status={entry.availabilityStatus} pulse />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm truncate" data-testid={`text-name-${entry.subscriptionId}`}>{entry.humanName}</h4>
                      <StatusBadge status={entry.availabilityStatus} />
                      {entry.hasAiShadow && (
                        <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 border-violet-500/30 text-violet-400">
                          <Bot className="h-3 w-3" /> AI Shadow
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">{entry.roleName}</span>
                      <span className="text-[10px] text-muted-foreground/50">•</span>
                      <span className="text-[10px] text-muted-foreground">{entry.department}</span>
                    </div>
                    {entry.lastStatusChange && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Status changed {timeAgo(entry.lastStatusChange)}
                      </p>
                    )}
                  </div>

                  <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground">
                    {entry.shiftStart && entry.availabilityStatus !== "off_duty" && (
                      <div className="flex items-center gap-1" data-testid={`text-shift-${entry.subscriptionId}`}>
                        <Clock className="h-3 w-3" />
                        {formatShiftTime(entry.shiftStart)} – {formatShiftTime(entry.shiftEnd)}
                      </div>
                    )}
                    {entry.humanEmail && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[140px]">{entry.humanEmail}</span>
                      </div>
                    )}
                    {entry.contactPhone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {entry.contactPhone}
                      </div>
                    )}
                  </div>

                  <div className="w-24 hidden sm:block">
                    <WorkloadBar current={entry.currentWorkload} max={entry.maxWorkload} />
                  </div>

                  <EditAvailabilityDialog entry={entry} onSave={handleSave} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
