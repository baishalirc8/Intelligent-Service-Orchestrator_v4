import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  CalendarDays, ChevronLeft, ChevronRight, CheckCircle2,
  TrendingUp, ShieldAlert, Lightbulb, Wrench, Bot,
  Clock, Play, SkipForward, Loader2, RefreshCw,
  Activity, Shield, Cpu, HardDrive, Lock, ShieldCheck,
  Server, Gauge, AlertTriangle, Zap, Radio, Eye, Layers,
  Timer, Database, Globe, Settings, Brain, Target,
  CalendarClock, Sparkles, BarChart3,
} from "lucide-react";
import type { AgentScheduledActivity, OrgRole } from "@shared/schema";

const iconMap: Record<string, typeof Activity> = {
  Activity, Shield, Cpu, HardDrive, Lock, ShieldCheck, Server, Gauge,
  AlertTriangle, Zap, Radio, Eye, Layers, Timer, Database, Globe,
  Settings, Brain, Target, CalendarClock, Sparkles, BarChart3,
  TrendingUp, ShieldAlert, Lightbulb, Wrench, CheckCircle2, Bot,
};

const typeConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof Activity }> = {
  predictive: { label: "Predictive", color: "text-blue-400", bgColor: "bg-blue-500/15", borderColor: "border-blue-500/20", icon: TrendingUp },
  preventive: { label: "Preventive", color: "text-emerald-400", bgColor: "bg-emerald-500/15", borderColor: "border-emerald-500/20", icon: ShieldAlert },
  prescriptive: { label: "Prescriptive", color: "text-amber-400", bgColor: "bg-amber-500/15", borderColor: "border-amber-500/20", icon: Lightbulb },
  maintenance: { label: "Maintenance", color: "text-cyan-400", bgColor: "bg-cyan-500/15", borderColor: "border-cyan-500/20", icon: Wrench },
};

const freqConfig: Record<string, { label: string; color: string }> = {
  weekly: { label: "Weekly", color: "text-purple-400" },
  monthly: { label: "Monthly", color: "text-indigo-400" },
  quarterly: { label: "Quarterly", color: "text-teal-400" },
};

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: "Scheduled", color: "text-blue-400", bgColor: "bg-blue-500/15" },
  pending_approval: { label: "Pending Approval", color: "text-amber-400", bgColor: "bg-amber-500/15" },
  approved: { label: "Approved", color: "text-emerald-400", bgColor: "bg-emerald-500/15" },
  executing: { label: "Executing", color: "text-purple-400", bgColor: "bg-purple-500/15" },
  completed: { label: "Completed", color: "text-green-400", bgColor: "bg-green-500/15" },
  skipped: { label: "Skipped", color: "text-muted-foreground", bgColor: "bg-muted/15" },
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, inMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), inMonth: true });
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: new Date(year, month + 1, d), inMonth: false });
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function ActivityCard({ activity, roles, onApprove, onSkip, onComplete, isApproving }: {
  activity: AgentScheduledActivity;
  roles: OrgRole[];
  onApprove: (id: string) => void;
  onSkip: (id: string) => void;
  onComplete: (id: string) => void;
  isApproving: boolean;
}) {
  const tc = typeConfig[activity.activityType] || typeConfig.maintenance;
  const sc = statusConfig[activity.status] || statusConfig.scheduled;
  const fc = freqConfig[activity.frequency] || freqConfig.monthly;
  const TypeIcon = tc.icon;
  const ItemIcon = iconMap[activity.icon] || tc.icon;
  const role = roles.find(r => r.id === activity.roleId);

  return (
    <div className={`group px-4 py-3.5 rounded-xl border ${tc.borderColor} bg-background/50 hover:bg-primary/5 hover:border-primary/20 transition-all`} data-testid={`activity-card-${activity.id}`}>
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tc.bgColor}`}>
          <ItemIcon className={`h-4.5 w-4.5 ${tc.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[12px] font-semibold">{activity.title}</span>
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${tc.bgColor} ${tc.color}`}>{tc.label}</span>
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${sc.bgColor} ${sc.color}`}>{sc.label}</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{activity.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {role && (
              <div className="flex items-center gap-1">
                <Bot className="h-3 w-3" style={{ color: role.color }} />
                <span className="text-[9px] font-medium" style={{ color: role.color }}>{role.title}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground" />
              <span className="text-[9px] text-muted-foreground">{formatDate(activity.scheduledDate)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={`text-[9px] font-medium ${fc.color}`}>{fc.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {(activity.status === "scheduled" || activity.status === "pending_approval") && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    onClick={() => onApprove(activity.id)}
                    disabled={isApproving}
                    data-testid={`approve-${activity.id}`}
                  >
                    {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Approve for execution</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => onSkip(activity.id)}
                    data-testid={`skip-${activity.id}`}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Skip this cycle</TooltipContent>
              </Tooltip>
            </>
          )}
          {activity.status === "approved" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                  onClick={() => onComplete(activity.id)}
                  data-testid={`complete-${activity.id}`}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark as completed</TooltipContent>
            </Tooltip>
          )}
          {activity.status === "completed" && (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentCalendar() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");

  const { data: activities = [], isLoading } = useQuery<AgentScheduledActivity[]>({ queryKey: ["/api/agent-scheduled-activities"] });
  const { data: roles = [] } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });

  const populateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agent-scheduled-activities/populate"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-scheduled-activities"] });
      toast({ title: "Calendar Populated", description: "Activities have been scheduled from AI insights." });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/agent-scheduled-activities/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-scheduled-activities"] });
      toast({ title: "Activity Approved", description: "This activity is now approved for autonomous execution." });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => apiRequest("PATCH", `/api/agent-scheduled-activities/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent-scheduled-activities"] });
    },
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const days = getMonthDays(year, month);
  const today = new Date();

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      if (typeFilter !== "all" && a.activityType !== typeFilter) return false;
      if (roleFilter !== "all" && a.roleId !== roleFilter) return false;
      return true;
    });
  }, [activities, typeFilter, roleFilter]);

  const activityDateMap = useMemo(() => {
    const map = new Map<string, AgentScheduledActivity[]>();
    for (const a of filteredActivities) {
      const d = new Date(a.scheduledDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [filteredActivities]);

  const selectedDayActivities = useMemo(() => {
    if (!selectedDate) return filteredActivities.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    return filteredActivities.filter(a => isSameDay(new Date(a.scheduledDate), selectedDate));
  }, [filteredActivities, selectedDate]);

  const activeRoles = useMemo(() => {
    const roleIds = new Set(activities.map(a => a.roleId));
    return roles.filter(r => roleIds.has(r.id));
  }, [activities, roles]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { predictive: 0, preventive: 0, prescriptive: 0, maintenance: 0 };
    for (const a of filteredActivities) counts[a.activityType] = (counts[a.activityType] || 0) + 1;
    return counts;
  }, [filteredActivities]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-[1500px] mx-auto" data-testid="calendar-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-[1500px] mx-auto">

        <div className="relative overflow-hidden" data-testid="calendar-header">
          <div className="absolute inset-0 opacity-[0.03]" style={{ background: "radial-gradient(ellipse at 30% 50%, #8b5cf6, transparent 60%), radial-gradient(ellipse at 70% 50%, #06b6d4, transparent 60%)" }} />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />

          <div className="px-6 pt-5 pb-5">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold gradient-text" data-testid="text-calendar-title">Agent Activity Calendar</h1>
                    <p className="text-[10px] text-muted-foreground">Autonomous AI agent task scheduling · Approval-gated execution</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => populateMutation.mutate()}
                  disabled={populateMutation.isPending}
                  className="text-xs"
                  data-testid="button-populate-calendar"
                >
                  {populateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Populate from Insights
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <div className="flex items-center gap-2">
                {Object.entries(typeConfig).map(([key, tc]) => {
                  const Icon = tc.icon;
                  return (
                    <div key={key} className="flex items-center gap-1">
                      <div className={`h-2.5 w-2.5 rounded-full ${tc.bgColor}`} style={{ backgroundColor: tc.color.replace("text-", "").includes("blue") ? "#3b82f6" : tc.color.includes("emerald") ? "#10b981" : tc.color.includes("amber") ? "#f59e0b" : "#06b6d4" }} />
                      <span className="text-[9px] text-muted-foreground">{tc.label} ({typeCounts[key] || 0})</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex-1" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-7 w-[130px] text-[10px]" data-testid="filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="predictive">Predictive</SelectItem>
                  <SelectItem value="preventive">Preventive</SelectItem>
                  <SelectItem value="prescriptive">Prescriptive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-7 w-[160px] text-[10px]" data-testid="filter-role">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {activeRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="lg:col-span-2">
              <Card className="overflow-hidden border-purple-500/15" data-testid="calendar-grid">
                <div className="h-[2px] bg-gradient-to-r from-purple-500/60 via-blue-400/40 to-transparent" />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} data-testid="button-prev-month">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-sm font-semibold" data-testid="text-month-name">{monthName}</h2>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} data-testid="button-next-month">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-7 gap-px bg-border/20 rounded-lg overflow-hidden">
                    {WEEKDAYS.map(d => (
                      <div key={d} className="bg-muted/10 px-2 py-1.5 text-center">
                        <span className="text-[9px] text-muted-foreground uppercase font-medium">{d}</span>
                      </div>
                    ))}

                    {days.map((day, idx) => {
                      const key = `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`;
                      const dayActivities = activityDateMap.get(key) || [];
                      const isToday = isSameDay(day.date, today);
                      const isSelected = selectedDate && isSameDay(day.date, selectedDate);

                      const typeDots = new Set(dayActivities.map(a => a.activityType));

                      return (
                        <div
                          key={idx}
                          className={`relative bg-background/80 min-h-[72px] p-1.5 cursor-pointer transition-all hover:bg-primary/5 ${
                            !day.inMonth ? "opacity-30" : ""
                          } ${isSelected ? "ring-1 ring-primary bg-primary/10" : ""} ${isToday ? "bg-primary/5" : ""}`}
                          onClick={() => setSelectedDate(isSameDay(day.date, selectedDate || new Date(0)) ? null : day.date)}
                          data-testid={`calendar-day-${day.date.getDate()}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[11px] font-medium ${isToday ? "text-primary font-bold" : day.inMonth ? "" : "text-muted-foreground/50"}`}>
                              {day.date.getDate()}
                            </span>
                            {dayActivities.length > 0 && (
                              <span className="text-[8px] text-muted-foreground bg-muted/20 rounded-full px-1">{dayActivities.length}</span>
                            )}
                          </div>
                          {dayActivities.length > 0 && (
                            <div className="flex flex-wrap gap-0.5">
                              {dayActivities.slice(0, 3).map((a, i) => {
                                const tc = typeConfig[a.activityType] || typeConfig.maintenance;
                                return (
                                  <Tooltip key={i}>
                                    <TooltipTrigger>
                                      <div className={`h-1.5 flex-1 min-w-[8px] rounded-full ${tc.bgColor}`} style={{
                                        backgroundColor: a.activityType === "predictive" ? "#3b82f680" : a.activityType === "preventive" ? "#10b98180" : a.activityType === "prescriptive" ? "#f59e0b80" : "#06b6d480",
                                      }} />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs max-w-[200px]">
                                      <p className="font-medium">{a.title}</p>
                                      <p className="text-muted-foreground">{tc.label} · {a.frequency}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                              {dayActivities.length > 3 && (
                                <span className="text-[7px] text-muted-foreground">+{dayActivities.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">
                  {selectedDate ? formatDate(selectedDate) : "All Activities"}
                </h3>
                {selectedDate && (
                  <Button variant="ghost" size="sm" className="text-[10px] h-5 px-2" onClick={() => setSelectedDate(null)} data-testid="button-clear-date">
                    Clear
                  </Button>
                )}
                <div className="flex-1" />
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{selectedDayActivities.length}</Badge>
              </div>

              {selectedDayActivities.length > 0 ? (
                <div className="space-y-2" data-testid="activity-list">
                  {selectedDayActivities.map(activity => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      roles={roles}
                      onApprove={(id) => approveMutation.mutate(id)}
                      onSkip={(id) => statusMutation.mutate({ id, status: "skipped" })}
                      onComplete={(id) => statusMutation.mutate({ id, status: "completed" })}
                      isApproving={approveMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-border/40">
                  <CardContent className="py-12 text-center">
                    <div className="h-14 w-14 rounded-2xl mx-auto mb-4 bg-purple-500/5 flex items-center justify-center">
                      <CalendarDays className="h-7 w-7 text-purple-400/30" />
                    </div>
                    {activities.length === 0 ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">No activities scheduled yet</p>
                        <p className="text-[11px] text-muted-foreground/60 mb-4">Generate operational insights for your AI agents first, then populate the calendar</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => populateMutation.mutate()}
                          disabled={populateMutation.isPending}
                          className="text-xs"
                          data-testid="button-populate-empty"
                        >
                          {populateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                          Populate Calendar
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No activities on this day</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {filteredActivities.length > 0 && (
            <div className="mt-6" data-testid="upcoming-timeline">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <h2 className="text-sm font-semibold">Upcoming Timeline</h2>
                <span className="text-[10px] text-muted-foreground ml-1">next 30 days</span>
              </div>
              <Card className="overflow-hidden border-indigo-500/15">
                <div className="h-[2px] bg-gradient-to-r from-indigo-500/60 via-purple-400/40 to-transparent" />
                <CardContent className="p-4">
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border/30" />
                    <div className="space-y-3">
                      {filteredActivities
                        .filter(a => {
                          const d = new Date(a.scheduledDate);
                          const daysDiff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
                          return daysDiff >= -1 && daysDiff <= 30 && a.status !== "completed" && a.status !== "skipped";
                        })
                        .slice(0, 12)
                        .map(activity => {
                          const tc = typeConfig[activity.activityType] || typeConfig.maintenance;
                          const sc = statusConfig[activity.status] || statusConfig.scheduled;
                          const ItemIcon = iconMap[activity.icon] || tc.icon;
                          const role = roles.find(r => r.id === activity.roleId);
                          const scheduledDate = new Date(activity.scheduledDate);
                          const isPast = scheduledDate < today;

                          return (
                            <div key={activity.id} className="flex items-start gap-3 pl-1" data-testid={`timeline-${activity.id}`}>
                              <div className={`relative z-10 h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 border-background ${tc.bgColor}`}>
                                <ItemIcon className={`h-3.5 w-3.5 ${tc.color}`} />
                              </div>
                              <div className={`flex-1 px-3 py-2.5 rounded-lg border ${tc.borderColor} bg-background/50 hover:bg-primary/5 transition-all ${isPast ? "opacity-60" : ""}`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-semibold">{activity.title}</span>
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${tc.bgColor} ${tc.color}`}>{tc.label}</span>
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${sc.bgColor} ${sc.color}`}>{sc.label}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  {role && <span className="text-[9px]" style={{ color: role.color }}>{role.title}</span>}
                                  <span className="text-[9px] text-muted-foreground">{formatDate(scheduledDate)}</span>
                                  <span className={`text-[9px] ${freqConfig[activity.frequency]?.color || "text-muted-foreground"}`}>{activity.frequency}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
