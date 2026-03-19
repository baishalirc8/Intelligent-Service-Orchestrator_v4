import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronDown,
  ChevronRight,
  Bot,
  UserPlus,
  Check,
  Crown,
  Search,
  X,
  List,
  Building2,
  DollarSign,
  Network,
  ArrowUpDown,
  Table,
  Layers,
  ChevronUp,
  Upload,
  FileSpreadsheet,
  Trash2,
  Plus,
  AlertCircle,
  Sparkles,
  Zap,
  Shield,
  CheckCircle2,
  Brain,
  ToggleLeft,
  ToggleRight,
  Globe,
  Target,
  BookOpen,
  Wrench,
  ListChecks,
  Users,
  TrendingDown,
  Activity,
  Gauge,
  Radar,
  MessageSquare,
  Lightbulb,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import type { OrgRole, RoleSubscription } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const WELCOME_DISMISSED_KEY = "holocron-welcome-dismissed";

const quickActions = [
  {
    id: "cockpit",
    title: "Open Cockpit",
    description: "Monitor infrastructure health and performance at a glance",
    icon: Gauge,
    href: "/infrastructure/cockpit",
    color: "#3b82f6",
  },
  {
    id: "probe",
    title: "Deploy a Probe",
    description: "Configure and deploy monitoring probes to your infrastructure",
    icon: Radar,
    href: "/infrastructure/configure",
    color: "#8b5cf6",
  },
  {
    id: "recommendations",
    title: "Review AI Recommendations",
    description: "Get AI-powered insights to optimize your operations",
    icon: Lightbulb,
    href: "/recommendations",
    color: "#f59e0b",
  },
  {
    id: "chat",
    title: "Chat with AI",
    description: "Ask questions and get instant answers from AI agents",
    icon: MessageSquare,
    href: "/agent-chat",
    color: "#10b981",
  },
  {
    id: "matrix",
    title: "View Agent Matrix",
    description: "See all AI agents and their capabilities in one view",
    icon: Network,
    href: "/agent-matrix",
    color: "#ec4899",
  },
];

function WelcomeBanner({ displayName }: { displayName: string }) {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(WELCOME_DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    } catch {}
  };

  return (
    <div className="space-y-4" data-testid="welcome-banner">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-welcome-greeting">
            Welcome back, {displayName}
          </h2>
          <p className="text-sm text-muted-foreground/70">
            Quick actions to get you started
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          data-testid="button-dismiss-welcome"
        >
          I know my way around
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.id}
              className="cursor-pointer agent-card-hover group relative overflow-hidden"
              onClick={() => setLocation(action.href)}
              data-testid={`quick-action-${action.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${action.color}18`, color: action.color, border: `1px solid ${action.color}25` }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors" data-testid={`text-action-title-${action.id}`}>
                    {action.title}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground/70 leading-relaxed line-clamp-2">
                  {action.description}
                </p>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${action.color}, ${action.color}40)` }} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function useIsLargeScreen() {
  const [isLg, setIsLg] = useState(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
  useEffect(() => {
    const handler = () => setIsLg(window.innerWidth >= 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isLg;
}

const levelLabels: Record<string, string> = {
  cxo: "C-Suite",
  vp: "Vice President",
  director: "Director",
  manager: "Manager",
  lead: "Team Lead",
  senior: "Senior",
  mid: "Mid-Level",
  junior: "Entry-Level",
};

const levelColors: Record<string, string> = {
  cxo: "bg-slate-900 text-white dark:bg-white dark:text-slate-900",
  vp: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  director: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  manager: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  lead: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  senior: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  mid: "bg-green-500/15 text-green-700 dark:text-green-300",
  junior: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
};

const levelOrder: Record<string, number> = { cxo: 0, vp: 1, director: 2, manager: 3, lead: 4, senior: 5, mid: 6, junior: 7 };


function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

function DepartmentGridView({
  roles,
  subscriptionMap,
  onDepartmentClick,
}: {
  roles: OrgRole[];
  subscriptionMap: Map<string, RoleSubscription>;
  onDepartmentClick: (dept: string) => void;
}) {
  const departments = useMemo(() => {
    const deptMap = new Map<string, { total: number; subscribable: number; assigned: number; totalPrice: number; levels: Record<string, number>; color: string }>();
    roles.forEach(r => {
      if (r.department === "Executive") return;
      if (!deptMap.has(r.department)) deptMap.set(r.department, { total: 0, subscribable: 0, assigned: 0, totalPrice: 0, levels: {}, color: r.color });
      const d = deptMap.get(r.department)!;
      d.total++;
      if (r.isSubscribable) d.subscribable++;
      const sub = subscriptionMap.get(r.id);
      if (sub && sub.status === "active") d.assigned++;
      d.totalPrice += r.monthlyPrice;
      d.levels[r.level] = (d.levels[r.level] || 0) + 1;
    });
    return Array.from(deptMap.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [roles, subscriptionMap]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 pt-2">
      {departments.map(([dept, info]) => {
        const color = info.color || "#6b7280";
        const coverage = info.subscribable > 0 ? Math.round((info.assigned / info.subscribable) * 100) : 0;
        const isFullCoverage = coverage === 100 && info.subscribable > 0;
        return (
          <Card
            key={dept}
            className={`cursor-pointer agent-card-hover group crew-card-gradient relative overflow-hidden ${isFullCoverage ? "agent-glow-success" : ""}`}
            onClick={() => onDepartmentClick(dept)}
            style={{ "--crew-color": color } as React.CSSProperties}
            data-testid={`dept-card-${dept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl shadow-sm"
                    style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}25` }}
                  >
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60 font-semibold">Crew</p>
                    <h3 className="text-sm font-bold leading-tight group-hover:text-primary transition-colors">{dept}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isFullCoverage && (
                    <div className="status-dot status-dot-online" title="Fully staffed" />
                  )}
                  <Badge variant="outline" className="text-[9px] px-1.5 h-5 text-muted-foreground/70">{info.total} agents</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground/70">Coverage</span>
                  <span className="font-semibold">{info.assigned}/{info.subscribable}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${coverage}%`,
                      background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-lg font-bold">{info.subscribable}</p>
                    <p className="text-[10px] text-muted-foreground/60">Available</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{info.assigned}</p>
                    <p className="text-[10px] text-muted-foreground/60">Assigned</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {Object.entries(info.levels)
                    .sort((a, b) => (levelOrder[a[0]] ?? 99) - (levelOrder[b[0]] ?? 99))
                    .map(([level, count]) => (
                      <Badge key={level} variant="outline" className={`text-[9px] ${levelColors[level] || ""}`}>
                        {count} {levelLabels[level] || level}
                      </Badge>
                    ))}
                </div>
              </div>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${color}, ${color}40)` }} />
          </Card>
        );
      })}
    </div>
  );
}

function CatalogTableView({
  roles,
  subscriptionMap,
  onAssignHuman,
  onRemove,
  onSelect,
  selectedId,
  departmentFilter,
}: {
  roles: OrgRole[];
  subscriptionMap: Map<string, RoleSubscription>;
  onAssignHuman: (role: OrgRole) => void;
  onRemove: (sub: RoleSubscription) => void;
  onSelect: (role: OrgRole) => void;
  selectedId: string | null;
  departmentFilter: string | null;
}) {
  const [sortBy, setSortBy] = useState<"name" | "department" | "level" | "price">("department");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [levelFilter, setLevelFilter] = useState<string | null>(null);

  const subscribableRoles = useMemo(() => {
    let filtered = roles.filter(r => r.isSubscribable);
    if (departmentFilter) filtered = filtered.filter(r => r.department === departmentFilter);
    if (levelFilter) filtered = filtered.filter(r => r.level === levelFilter);

    return filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "department": cmp = a.department.localeCompare(b.department) || a.sortOrder - b.sortOrder; break;
        case "level": cmp = (levelOrder[a.level] ?? 99) - (levelOrder[b.level] ?? 99); break;
        case "price": cmp = a.monthlyPrice - b.monthlyPrice; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [roles, departmentFilter, levelFilter, sortBy, sortDir]);

  const toggleSort = (field: typeof sortBy) => {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortBy }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const levels = useMemo(() => {
    const set = new Set(roles.filter(r => r.isSubscribable).map(r => r.level));
    return Array.from(set).sort((a, b) => (levelOrder[a] ?? 99) - (levelOrder[b] ?? 99));
  }, [roles]);

  return (
    <div className="p-6 pt-2 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={levelFilter ?? "all"} onValueChange={(v) => setLevelFilter(v === "all" ? null : v)}>
          <SelectTrigger className="w-[160px]" data-testid="select-level-filter">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {levels.map(l => (
              <SelectItem key={l} value={l}>{levelLabels[l] || l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{subscribableRoles.length} roles</span>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium">
                  <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground text-muted-foreground" data-testid="sort-name">
                    Role <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left p-3 font-medium hidden md:table-cell">
                  <button onClick={() => toggleSort("department")} className="flex items-center gap-1 hover:text-foreground text-muted-foreground" data-testid="sort-department">
                    Department <SortIcon field="department" />
                  </button>
                </th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">
                  <button onClick={() => toggleSort("level")} className="flex items-center gap-1 hover:text-foreground text-muted-foreground" data-testid="sort-level">
                    Level <SortIcon field="level" />
                  </button>
                </th>
                <th className="text-right p-3 font-medium">
                  <button onClick={() => toggleSort("price")} className="flex items-center gap-1 hover:text-foreground text-muted-foreground ml-auto" data-testid="sort-price">
                    Price <SortIcon field="price" />
                  </button>
                </th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {subscribableRoles.map((role) => {
                const sub = subscriptionMap.get(role.id);
                const isAssigned = !!sub && sub.status === "active";
                const isSelected = selectedId === role.id;
                return (
                  <tr
                    key={role.id}
                    className={`border-b last:border-0 cursor-pointer agent-card-hover ${
                      isSelected ? "bg-primary/5" : isAssigned ? "bg-green-500/5" : ""
                    }`}
                    onClick={() => onSelect(role)}
                    data-testid={`table-row-${role.id}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                          style={{ backgroundColor: `${role.color}20`, color: role.color }}
                        >
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate text-sm">{role.name}</p>
                          {role.division && <p className="text-[11px] text-muted-foreground truncate">{role.division}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{role.department}</span>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <Badge variant="outline" className={`text-[10px] ${levelColors[role.level] || ""}`}>
                        {levelLabels[role.level] || role.level}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium whitespace-nowrap text-purple-600 dark:text-purple-400">{formatPrice(role.monthlyPrice)}<span className="text-muted-foreground text-xs">/mo</span></span>
                        {role.humanCostMonthly && role.humanCostMonthly > 0 && (
                          <span className="text-[10px] text-muted-foreground line-through whitespace-nowrap">{formatPrice(role.humanCostMonthly)}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {isAssigned ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Badge className="text-[10px] bg-green-500/15 text-green-700 dark:text-green-300 gap-0.5">
                            <UserPlus className="h-2.5 w-2.5" /> {sub?.assignedHumanName}
                          </Badge>
                          {sub?.hasAiShadow && (
                            <Badge className="text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 gap-0.5">
                              <Brain className="h-2.5 w-2.5" /> AI Agent
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unfilled</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {isAssigned && sub ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); onRemove(sub); }}
                          data-testid={`unsubscribe-${role.id}`}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); onAssignHuman(role); }}
                          data-testid={`subscribe-${role.id}`}
                        >
                          <UserPlus className="h-3 w-3" /> Assign
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DiagramCard({
  role,
  subscriptionMap,
  onSelect,
  isSelected,
}: {
  role: OrgRole;
  subscriptionMap: Map<string, RoleSubscription>;
  onSelect: (role: OrgRole) => void;
  isSelected: boolean;
}) {
  const sub = subscriptionMap.get(role.id);
  const isAssigned = !!sub && sub.status === "active";

  return (
    <div
      className={`relative rounded-lg border-2 p-3 min-w-[180px] max-w-[220px] cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? "border-primary shadow-lg ring-2 ring-primary/20"
          : isAssigned
            ? "border-green-500/50 bg-green-500/5"
            : "border-border bg-card hover:border-muted-foreground/40"
      }`}
      onClick={() => onSelect(role)}
      data-testid={`diagram-card-${role.id}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs"
          style={{ backgroundColor: `${role.color}20`, color: role.color }}
        >
          {role.level === "cxo" ? <Crown className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </div>
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${levelColors[role.level] || ""}`}>
          {levelLabels[role.level] || role.level}
        </Badge>
      </div>
      <p className="text-xs font-semibold leading-tight line-clamp-2">{role.name}</p>
      {role.division && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{role.division}</p>
      )}
      <div className="flex items-center justify-between mt-2 gap-1">
        {role.monthlyPrice > 0 ? (
          <span className="text-[10px] font-medium text-muted-foreground">{formatPrice(role.monthlyPrice)}/mo</span>
        ) : (
          <span />
        )}
        {isAssigned && (
          <div className="flex gap-1">
            <Badge className="text-[9px] px-1.5 py-0 bg-green-500/15 text-green-700 dark:text-green-300 gap-0.5">
              <UserPlus className="h-2.5 w-2.5" /> Filled
            </Badge>
            {sub?.hasAiShadow && (
              <Badge className="text-[9px] px-1.5 py-0 bg-purple-500/15 text-purple-700 dark:text-purple-300 gap-0.5">
                <Brain className="h-2.5 w-2.5" /> AI Agent
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DiagramBranch({
  role,
  roles,
  subscriptionMap,
  onSelect,
  selectedId,
  expandedIds,
  toggleExpand,
}: {
  role: OrgRole;
  roles: OrgRole[];
  subscriptionMap: Map<string, RoleSubscription>;
  onSelect: (role: OrgRole) => void;
  selectedId: string | null;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const children = roles.filter((r) => r.parentRoleId === role.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(role.id);

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <DiagramCard
          role={role}
          subscriptionMap={subscriptionMap}
          onSelect={onSelect}
          isSelected={selectedId === role.id}
        />
        {hasChildren && (
          <button
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={(e) => { e.stopPropagation(); toggleExpand(role.id); }}
            data-testid={`expand-${role.id}`}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <>
          <div className="w-px h-6 bg-border" />
          <div className="relative flex gap-4">
            {children.length > 1 && (
              <div className="absolute top-0 h-px bg-border" style={{
                left: `calc(${100 / (children.length * 2)}%)`,
                right: `calc(${100 / (children.length * 2)}%)`,
              }} />
            )}
            {children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-border" />
                <DiagramBranch
                  role={child}
                  roles={roles}
                  subscriptionMap={subscriptionMap}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ListNode({
  role,
  roles,
  subscriptionMap,
  depth,
  onAssignHuman,
  onRemove,
  onToggleShadow,
  onSelect,
  selectedId,
  searchMatch,
}: {
  role: OrgRole;
  roles: OrgRole[];
  subscriptionMap: Map<string, RoleSubscription>;
  depth: number;
  onAssignHuman: (role: OrgRole) => void;
  onRemove: (sub: RoleSubscription) => void;
  onToggleShadow: (sub: RoleSubscription) => void;
  onSelect: (role: OrgRole) => void;
  selectedId: string | null;
  searchMatch?: Set<string>;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const children = roles.filter((r) => r.parentRoleId === role.id);
  const hasChildren = children.length > 0;
  const sub = subscriptionMap.get(role.id);
  const isAssigned = !!sub && sub.status === "active";
  const isSelected = selectedId === role.id;

  const assignedChildren = children.filter(c => {
    const s = subscriptionMap.get(c.id);
    return s && s.status === "active";
  }).length;

  const visibleChildren = searchMatch
    ? children.filter(c => searchMatch.has(c.id) || hasDescendantMatch(c.id, roles, searchMatch))
    : children;

  if (searchMatch && !searchMatch.has(role.id) && visibleChildren.length === 0) return null;

  return (
    <div className="relative" data-testid={`role-node-${role.id}`}>
      <div
        className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
          isSelected
            ? "border-primary bg-primary/5 ring-1 ring-primary/20"
            : isAssigned
              ? "border-green-500/30 bg-green-500/5"
              : "border-border hover:border-muted-foreground/30"
        }`}
        onClick={() => onSelect(role)}
      >
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
            data-testid={`toggle-${role.id}`}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
        {!hasChildren && <div className="w-4 shrink-0" />}

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold"
          style={{ backgroundColor: `${role.color}20`, color: role.color }}
        >
          {role.level === "cxo" ? <Crown className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{role.name}</span>
            <Badge variant="outline" className={`text-[10px] ${levelColors[role.level] || ""}`}>
              {levelLabels[role.level] || role.level}
            </Badge>
            {role.division && (
              <span className="text-[10px] text-muted-foreground">{role.division}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{role.description}</p>

          {isAssigned && sub && (
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] gap-1">
                <UserPlus className="h-3 w-3" /> {sub.assignedHumanName}
              </Badge>
              {sub.hasAiShadow ? (
                <Badge className="text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 gap-1">
                  <Brain className="h-3 w-3" /> AI Agent
                </Badge>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleShadow(sub); }}
                  className="text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium flex items-center gap-1"
                  data-testid={`enable-shadow-${role.id}`}
                >
                  <Sparkles className="h-3 w-3" /> Subscribe AI Agent
                </button>
              )}
            </div>
          )}

          {hasChildren && assignedChildren > 0 && (
            <span className="text-[10px] text-muted-foreground mt-1 inline-block">
              {assignedChildren}/{children.length} sub-roles assigned
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {role.monthlyPrice > 0 && (
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {formatPrice(role.monthlyPrice)}/mo
            </span>
          )}
          {role.isSubscribable && (
            isAssigned && sub ? (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onRemove(sub); }}
                data-testid={`unsubscribe-${role.id}`}
              >
                <Check className="h-3 w-3" /> Assigned
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={(e) => { e.stopPropagation(); onAssignHuman(role); }}
                data-testid={`subscribe-${role.id}`}
              >
                <UserPlus className="h-3 w-3" /> Assign Human
              </Button>
            )
          )}
        </div>
      </div>

      {hasChildren && (expanded || (searchMatch && visibleChildren.length > 0)) && (
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-border/50 pl-4">
          {visibleChildren.map((child) => (
            <ListNode
              key={child.id}
              role={child}
              roles={roles}
              subscriptionMap={subscriptionMap}
              depth={depth + 1}
              onAssignHuman={onAssignHuman}
              onRemove={onRemove}
              onToggleShadow={onToggleShadow}
              onSelect={onSelect}
              selectedId={selectedId}
              searchMatch={searchMatch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function hasDescendantMatch(parentId: string, roles: OrgRole[], matchSet: Set<string>): boolean {
  const children = roles.filter(r => r.parentRoleId === parentId);
  return children.some(c => matchSet.has(c.id) || hasDescendantMatch(c.id, roles, matchSet));
}

function SearchResults({
  results,
  roles,
  subscriptionMap,
  onAssignHuman,
  onRemove,
  onSelect,
  selectedId,
}: {
  results: OrgRole[];
  roles: OrgRole[];
  subscriptionMap: Map<string, RoleSubscription>;
  onAssignHuman: (role: OrgRole) => void;
  onRemove: (sub: RoleSubscription) => void;
  onSelect: (role: OrgRole) => void;
  selectedId: string | null;
}) {
  function getBreadcrumb(role: OrgRole): string {
    const parts: string[] = [];
    let current: OrgRole | undefined = role;
    while (current?.parentRoleId) {
      current = roles.find(r => r.id === current!.parentRoleId);
      if (current) parts.unshift(current.name);
    }
    return parts.join(" > ");
  }

  return (
    <div className="space-y-1">
      {results.map((role) => {
        const sub = subscriptionMap.get(role.id);
        const isAssigned = !!sub && sub.status === "active";
        const isSelected = selectedId === role.id;
        const breadcrumb = getBreadcrumb(role);
        return (
          <div
            key={role.id}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : isAssigned
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-border hover:border-muted-foreground/30"
            }`}
            onClick={() => onSelect(role)}
            data-testid={`search-result-${role.id}`}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${role.color}20`, color: role.color }}
            >
              {role.level === "cxo" ? <Crown className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{role.name}</span>
                <Badge variant="outline" className={`text-[10px] ${levelColors[role.level] || ""}`}>
                  {levelLabels[role.level] || role.level}
                </Badge>
              </div>
              {breadcrumb && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{breadcrumb}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{role.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {role.monthlyPrice > 0 && (
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {formatPrice(role.monthlyPrice)}/mo
                </span>
              )}
              {role.isSubscribable && (
                isAssigned && sub ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => { e.stopPropagation(); onRemove(sub); }}
                    data-testid={`unsubscribe-${role.id}`}
                  >
                    <Check className="h-3 w-3" /> Assigned
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onAssignHuman(role); }}
                    data-testid={`subscribe-${role.id}`}
                  >
                    <UserPlus className="h-3 w-3" /> Assign Human
                  </Button>
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoleDetailPanel({
  role,
  roles,
  subscriptionMap,
  onAssignHuman,
  onRemove,
  onToggleShadow,
  onClose,
}: {
  role: OrgRole;
  roles: OrgRole[];
  subscriptionMap: Map<string, RoleSubscription>;
  onAssignHuman: (role: OrgRole) => void;
  onRemove: (sub: RoleSubscription) => void;
  onToggleShadow: (sub: RoleSubscription) => void;
  onClose: () => void;
}) {
  const sub = subscriptionMap.get(role.id);
  const isAssigned = !!sub && sub.status === "active";
  const parent = roles.find(r => r.id === role.parentRoleId);
  const children = roles.filter(r => r.parentRoleId === role.id);

  const statusClass = isAssigned
    ? (sub?.hasAiShadow ? "status-dot-processing" : "status-dot-online")
    : "status-dot-idle";

  return (
    <Card className="sticky top-0 z-10 overflow-hidden" data-testid="role-detail-panel">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${role.color}, ${role.color}60)` }} />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm"
                style={{ backgroundColor: `${role.color}18`, color: role.color, border: `1px solid ${role.color}25` }}
              >
                {role.level === "cxo" ? <Crown className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
              </div>
              <div className={`status-dot ${statusClass} absolute -bottom-0.5 -right-0.5 border-2 border-card`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Badge variant="outline" className={`text-[10px] ${levelColors[role.level] || ""}`}>
                  {levelLabels[role.level] || role.level}
                </Badge>
                <span className="text-[10px] text-muted-foreground/60">{role.department}</span>
              </div>
              <h3 className="text-sm font-bold leading-tight">{role.title}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/50" data-testid="button-close-detail">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Target className="h-3 w-3 text-primary" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Role</span>
            </div>
            <p className="text-xs text-foreground leading-relaxed pl-[18px]">{role.name}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400">Goal</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pl-[18px]">{role.description}</p>
          </div>

          {role.jobDescription && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3 w-3 text-purple-500" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-600 dark:text-purple-400">Backstory</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-[18px]" data-testid="text-job-description">{role.jobDescription}</p>
            </div>
          )}
        </div>

        {role.aiCapabilities && role.aiCapabilities.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Wrench className="h-3 w-3 text-blue-500" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">Tools & Capabilities</span>
            </div>
            <div className="grid grid-cols-2 gap-1 pl-[18px]">
              {role.aiCapabilities.map((cap, i) => (
                <Badge key={i} variant="outline" className="text-[10px] gap-1 justify-start">
                  <Bot className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{cap}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {role.keyTasks && role.keyTasks.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3 w-3 text-green-500" />
              <span className="text-[10px] uppercase tracking-wider font-semibold text-green-600 dark:text-green-400">Key Tasks</span>
            </div>
            <div className="space-y-1 pl-[18px]" data-testid="list-key-tasks">
              {role.keyTasks.map((task, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {role.monthlyPrice > 0 && (
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/5 to-transparent border border-purple-500/10 space-y-1.5" data-testid="pricing-section">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
                  <DollarSign className="h-3.5 w-3.5 text-purple-500" />
                </div>
                <div>
                  <span className="text-lg font-bold text-purple-600 dark:text-purple-400" data-testid="text-ai-price">{formatPrice(role.monthlyPrice)}</span>
                  <span className="text-xs text-muted-foreground/60">/month</span>
                </div>
              </div>
              <Badge className="bg-green-500/10 text-green-700 dark:text-green-300 text-[10px] border border-green-500/20" data-testid="badge-savings">70% savings</Badge>
            </div>
            {role.humanCostMonthly && role.humanCostMonthly > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60 pl-9">
                <span>vs. human rate</span>
                <span className="line-through" data-testid="text-human-price">{formatPrice(role.humanCostMonthly)}/mo</span>
              </div>
            )}
          </div>
        )}

        {role.isSubscribable && (
          <div className="space-y-2">
            {isAssigned && sub ? (
              <>
                <div className="p-3 rounded-lg border bg-green-500/5 border-green-500/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="text-sm font-medium">{sub.assignedHumanName}</p>
                      {sub.assignedHumanEmail && (
                        <p className="text-[11px] text-muted-foreground">{sub.assignedHumanEmail}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className={`rounded-lg border-2 overflow-hidden transition-all ${sub.hasAiShadow ? "border-purple-500/40 bg-purple-500/5" : "border-dashed border-muted-foreground/25 hover:border-purple-500/30"}`} data-testid={`ai-agent-card-${role.id}`}>
                  <div className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${sub.hasAiShadow ? "bg-purple-500 text-white" : "bg-purple-500/10 text-purple-600 dark:text-purple-400"}`}>
                          <Brain className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">AI Agent</p>
                          <p className="text-[10px] text-muted-foreground">
                            {sub.hasAiShadow ? "Subscribed — actively assisting" : "Available for this role"}
                          </p>
                        </div>
                      </div>
                      {sub.hasAiShadow ? (
                        <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] gap-1">
                          <Sparkles className="h-2.5 w-2.5" /> Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                      )}
                    </div>

                    {!sub.hasAiShadow && (
                      <div className="p-2.5 rounded-md bg-muted/50 space-y-1.5">
                        <p className="text-[11px] font-medium flex items-center gap-1.5">
                          <Zap className="h-3 w-3 text-amber-500" />
                          Tasks this AI Agent can handle:
                        </p>
                        <div className="space-y-1">
                          {role.aiCapabilities?.slice(0, 4).map((cap, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                              <span>{cap}</span>
                            </div>
                          ))}
                          {(role.aiCapabilities?.length || 0) > 4 && (
                            <p className="text-[10px] text-purple-600 dark:text-purple-400 pl-4.5">
                              +{(role.aiCapabilities?.length || 0) - 4} more capabilities
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {sub.hasAiShadow && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium flex items-center gap-1.5">
                          <Shield className="h-3 w-3 text-purple-500" />
                          AI Agent is handling:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {role.aiCapabilities?.map((cap, i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-300">
                              <Bot className="h-2.5 w-2.5" /> {cap}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Reducing workload for {sub.assignedHumanName} by autonomously executing tasks within guardrails.
                        </p>
                      </div>
                    )}

                    <Button
                      size="sm"
                      className={`w-full ${sub.hasAiShadow
                        ? "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        : "bg-purple-600 hover:bg-purple-700 text-white"}`}
                      variant={sub.hasAiShadow ? "outline" : "default"}
                      onClick={() => onToggleShadow(sub)}
                      data-testid={`detail-toggle-shadow-${role.id}`}
                    >
                      {sub.hasAiShadow ? (
                        <>
                          <ToggleRight className="h-4 w-4 mr-1" /> Unsubscribe AI Agent
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1" /> Subscribe AI Agent
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(sub)}
                  data-testid={`detail-unsubscribe-${role.id}`}
                >
                  Remove Assignment
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={() => onAssignHuman(role)}
                data-testid={`detail-subscribe-${role.id}`}
              >
                <UserPlus className="h-4 w-4" /> Assign Human to This Role
              </Button>
            )}
          </div>
        )}

        {role.requiredSkills && role.requiredSkills.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required Skills</h4>
            <div className="grid grid-cols-1 gap-1" data-testid="list-required-skills">
              {role.requiredSkills.map((skill, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                  <span>{skill}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsibilities</h4>
          <div className="flex flex-wrap gap-1">
            {role.responsibilities?.map((r, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>
            ))}
          </div>
        </div>

        {parent && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reports To</h4>
            <div className="text-xs text-foreground flex items-center gap-1.5">
              <div
                className="flex h-5 w-5 items-center justify-center rounded"
                style={{ backgroundColor: `${parent.color}20`, color: parent.color }}
              >
                <Bot className="h-3 w-3" />
              </div>
              {parent.name}
            </div>
          </div>
        )}

        {children.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Direct Reports ({children.length})
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {children.map(c => {
                const cSub = subscriptionMap.get(c.id);
                return (
                  <div key={c.id} className="text-xs flex items-center gap-1.5">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded"
                      style={{ backgroundColor: `${c.color}20`, color: c.color }}
                    >
                      <Bot className="h-3 w-3" />
                    </div>
                    <span className="flex-1 truncate">{c.name}</span>
                    {cSub && cSub.status === "active" && (
                      <Check className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ParsedPerson {
  name: string;
  email: string;
  roleIds: string[];
}

function BulkUploadDialog({
  open,
  onOpenChange,
  roles,
  subscriptionMap,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: OrgRole[];
  subscriptionMap: Map<string, RoleSubscription>;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"upload" | "assign">("upload");
  const [people, setPeople] = useState<ParsedPerson[]>([]);
  const [csvText, setCsvText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subscribableRoles = useMemo(() =>
    roles.filter(r => r.isSubscribable).sort((a, b) => {
      if (a.department !== b.department) return a.department.localeCompare(b.department);
      return a.sortOrder - b.sortOrder;
    }),
    [roles]
  );

  const departments = useMemo(() =>
    [...new Set(subscribableRoles.map(r => r.department))].sort(),
    [subscribableRoles]
  );

  function parseCSV(text: string): ParsedPerson[] {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length === 0) return [];

    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes("name") || firstLine.includes("email");
    const dataLines = hasHeader ? lines.slice(1) : lines;

    return dataLines.map(line => {
      const parts = line.split(/[,\t]/).map(p => p.trim().replace(/^["']|["']$/g, ""));
      const name = parts[0] || "";
      const email = parts[1] || "";
      return { name, email, roleIds: [] };
    }).filter(p => p.name.trim().length > 0);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        toast({ title: "No people found", description: "The file didn't contain any valid rows.", variant: "destructive" });
        return;
      }
      setPeople(parsed);
      setStep("assign");
    };
    reader.readAsText(file);
  }

  function handlePasteSubmit() {
    const parsed = parseCSV(csvText);
    if (parsed.length === 0) {
      toast({ title: "No people found", description: "No valid rows found. Use format: Name, Email (one per line).", variant: "destructive" });
      return;
    }
    setPeople(parsed);
    setStep("assign");
  }

  function addRoleToPerson(personIndex: number, roleId: string) {
    setPeople(prev => prev.map((p, i) =>
      i === personIndex && !p.roleIds.includes(roleId)
        ? { ...p, roleIds: [...p.roleIds, roleId] }
        : p
    ));
  }

  function removeRoleFromPerson(personIndex: number, roleId: string) {
    setPeople(prev => prev.map((p, i) =>
      i === personIndex ? { ...p, roleIds: p.roleIds.filter(r => r !== roleId) } : p
    ));
  }

  function removePerson(index: number) {
    setPeople(prev => prev.filter((_, i) => i !== index));
  }

  const totalAssignments = people.reduce((acc, p) => acc + p.roleIds.length, 0);
  const unassignedCount = people.filter(p => p.roleIds.length === 0).length;

  const bulkMutation = useMutation({
    mutationFn: async (assignments: { roleId: string; assignedHumanName: string; assignedHumanEmail: string }[]) => {
      const res = await apiRequest("POST", "/api/role-subscriptions/bulk", { assignments });
      return res.json() as Promise<{ success: number; skipped: number; errors: string[] }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-stats"] });
      toast({
        title: "Bulk assignment complete",
        description: `${data.success} assigned, ${data.skipped} skipped (already assigned)${data.errors?.length ? `, ${data.errors.length} errors` : ""}`,
      });
      onOpenChange(false);
      setStep("upload");
      setPeople([]);
      setCsvText("");
    },
    onError: () => {
      toast({ title: "Bulk assignment failed", variant: "destructive" });
    },
  });

  function handleBulkAssign() {
    const assignments = people.flatMap(p =>
      p.roleIds.map(roleId => ({
        roleId,
        assignedHumanName: p.name,
        assignedHumanEmail: p.email,
      }))
    );
    if (assignments.length === 0) {
      toast({ title: "No assignments", description: "Assign at least one role to a person before submitting.", variant: "destructive" });
      return;
    }
    bulkMutation.mutate(assignments);
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setStep("upload");
      setPeople([]);
      setCsvText("");
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className={step === "assign" ? "max-w-3xl max-h-[85vh] flex flex-col" : ""}>
        <DialogHeader>
          <DialogTitle>
            {step === "upload" ? "Bulk Upload Team Members" : "Assign Roles to Team Members"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload a CSV file or paste a list of team members (Name, Email — one per line)."
              : `${people.length} people loaded. Assign each person to one or more roles.`}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="space-y-4 pt-2">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="bulk-upload-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleFileUpload}
                data-testid="bulk-upload-file-input"
              />
              <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to upload CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Supports .csv, .tsv, .txt files</p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or paste directly</span>
              </div>
            </div>

            <Textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"John Smith, john@company.com\nJane Doe, jane@company.com\nBob Wilson, bob@company.com"}
              rows={5}
              data-testid="bulk-upload-textarea"
            />

            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Format: Name, Email (one per line). Email is optional. Headers are auto-detected.
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel-bulk">
                Cancel
              </Button>
              <Button onClick={handlePasteSubmit} disabled={!csvText.trim()} data-testid="button-parse-csv">
                <Upload className="h-4 w-4" /> Parse & Continue
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="space-y-3 pr-4">
                {people.map((person, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2" data-testid={`bulk-person-${idx}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium" data-testid={`bulk-person-name-${idx}`}>{person.name}</p>
                          {person.email && <p className="text-[11px] text-muted-foreground">{person.email}</p>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removePerson(idx)} data-testid={`bulk-remove-person-${idx}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {person.roleIds.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {person.roleIds.map(roleId => {
                          const role = roles.find(r => r.id === roleId);
                          return role ? (
                            <Badge key={roleId} variant="secondary" className="text-[10px] gap-1 pr-1">
                              {role.name}
                              <button onClick={() => removeRoleFromPerson(idx, roleId)} className="hover:text-destructive">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}

                    <Select
                      value=""
                      onValueChange={(roleId) => addRoleToPerson(idx, roleId)}
                    >
                      <SelectTrigger className="h-8 text-xs" data-testid={`bulk-role-select-${idx}`}>
                        <SelectValue placeholder="+ Add role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <div key={dept}>
                            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {dept}
                            </div>
                            {subscribableRoles
                              .filter(r => r.department === dept)
                              .filter(r => !person.roleIds.includes(r.id))
                              .filter(r => !subscriptionMap.has(r.id))
                              .map(r => (
                                <SelectItem key={r.id} value={r.id} className="text-xs">
                                  {r.name}
                                </SelectItem>
                              ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="shrink-0 space-y-3 border-t pt-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{people.length} people</span>
                <span>{totalAssignments} role assignment{totalAssignments !== 1 ? "s" : ""}</span>
                {unassignedCount > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {unassignedCount} without roles
                  </span>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back-to-upload">
                  Back
                </Button>
                <Button
                  onClick={handleBulkAssign}
                  disabled={totalAssignments === 0 || bulkMutation.isPending}
                  data-testid="button-bulk-assign"
                >
                  {bulkMutation.isPending ? "Assigning..." : `Assign ${totalAssignments} Role${totalAssignments !== 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type ViewMode = "departments" | "list" | "diagram" | "catalog";

export default function OrgChart() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [assignDialog, setAssignDialog] = useState<{ role: OrgRole } | null>(null);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [humanName, setHumanName] = useState("");
  const [humanEmail, setHumanEmail] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("departments");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [expandedDiagramIds, setExpandedDiagramIds] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isLargeScreen = useIsLargeScreen();

  const { data: countries } = useQuery<{ code: string; name: string; region: string }[]>({
    queryKey: ["/api/countries"],
    staleTime: Infinity,
  });

  const changeCountryMutation = useMutation({
    mutationFn: async (country: string) => {
      const res = await apiRequest("PATCH", "/api/auth/country", { country });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-roles"] });
      toast({ title: "Country updated", description: "Pricing has been adjusted for your country's salary market." });
    },
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<OrgRole[]>({
    queryKey: ["/api/org-roles"],
  });

  const { data: subscriptions } = useQuery<RoleSubscription[]>({
    queryKey: ["/api/role-subscriptions"],
  });

  const assignHumanMutation = useMutation({
    mutationFn: ({ roleId, name, email }: { roleId: string; name: string; email: string }) =>
      apiRequest("POST", "/api/role-subscriptions", { roleId, status: "active", assignedHumanName: name, assignedHumanEmail: email, hasAiShadow: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-stats"] });
      setAssignDialog(null);
      setHumanName("");
      setHumanEmail("");
      toast({ title: "Human assigned", description: "Your team member has been assigned to this role." });
    },
  });

  const toggleAiShadowMutation = useMutation({
    mutationFn: ({ subId, hasAiShadow }: { subId: string; hasAiShadow: boolean }) =>
      apiRequest("PATCH", `/api/role-subscriptions/${subId}`, { hasAiShadow }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-stats"] });
      toast({
        title: variables.hasAiShadow ? "AI Agent Subscribed" : "AI Agent Unsubscribed",
        description: variables.hasAiShadow
          ? "An AI agent is now actively assisting this role — handling tasks autonomously within guardrails."
          : "AI agent has been removed. The human will handle all tasks for this role.",
      });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (subId: string) => apiRequest("DELETE", `/api/role-subscriptions/${subId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org-stats"] });
      toast({ title: "Assignment removed" });
    },
  });

  const subscriptionMap = useMemo(() => {
    const map = new Map<string, RoleSubscription>();
    subscriptions?.forEach((s) => map.set(s.roleId, s));
    return map;
  }, [subscriptions]);

  const departments = useMemo(() =>
    roles ? [...new Set(roles.map((r) => r.department))].filter(d => d !== "Executive") : [],
    [roles]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !roles) return null;
    const q = searchQuery.toLowerCase();
    return roles.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      (r.division && r.division.toLowerCase().includes(q)) ||
      r.responsibilities?.some(resp => resp.toLowerCase().includes(q)) ||
      r.aiCapabilities?.some(cap => cap.toLowerCase().includes(q))
    );
  }, [searchQuery, roles]);

  const rootRoles = useMemo(() => roles?.filter((r) => !r.parentRoleId) ?? [], [roles]);

  const filteredRoots = useMemo(() => {
    if (!departmentFilter || !roles) return rootRoles;
    const deptRoles = roles.filter(r => r.department === departmentFilter);
    const deptRoleIds = new Set(deptRoles.map(r => r.id));
    const topLevel = deptRoles.filter(r => !r.parentRoleId || !deptRoleIds.has(r.parentRoleId));
    return topLevel;
  }, [departmentFilter, rootRoles, roles]);

  const selectedRole = useMemo(() =>
    selectedRoleId ? roles?.find(r => r.id === selectedRoleId) : null,
    [selectedRoleId, roles]
  );

  const toggleDiagramExpand = useCallback((id: string) => {
    setExpandedDiagramIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (roles && expandedDiagramIds.size === 0) {
      const initial = new Set<string>();
      roles.forEach(r => {
        if (r.level === "cxo" || r.level === "vp") initial.add(r.id);
      });
      setExpandedDiagramIds(initial);
    }
  }, [roles]);

  const handleDeptClick = useCallback((dept: string) => {
    setDepartmentFilter(dept);
    setViewMode("list");
    setSelectedRoleId(null);
    setSearchQuery("");
  }, []);

  const totalAgents = roles?.filter(r => r.isSubscribable).length ?? 0;
  const activeCrews = useMemo(() => {
    if (!roles || !subscriptions) return 0;
    const deptsWithAssigned = new Set<string>();
    subscriptions.filter(s => s.status === "active").forEach(s => {
      const role = roles.find(r => r.id === s.roleId);
      if (role) deptsWithAssigned.add(role.department);
    });
    return deptsWithAssigned.size;
  }, [roles, subscriptions]);
  const tasksAutomated = subscriptions?.filter(s => s.status === "active" && s.hasAiShadow).length ?? 0;
  const monthlySavings = useMemo(() => {
    if (!roles || !subscriptions) return 0;
    return subscriptions
      .filter(s => s.status === "active" && s.hasAiShadow)
      .reduce((sum, s) => {
        const role = roles.find(r => r.id === s.roleId);
        if (role && role.humanCostMonthly && role.humanCostMonthly > 0) {
          return sum + (role.humanCostMonthly - role.monthlyPrice);
        }
        return sum;
      }, 0);
  }, [roles, subscriptions]);

  if (rolesLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const isSearching = searchQuery.trim().length > 0;
  const activeCount = subscriptions?.filter(s => s.status === "active").length ?? 0;
  const showDeptFilters = !isSearching && viewMode !== "departments";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 p-6 pb-0 space-y-4">
        {user && <WelcomeBanner displayName={user.displayName} />}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-org-chart-title">
              <span className="gradient-text">Crews & Agents</span>
            </h1>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Manage your multi-agent workforce — assign humans and deploy AI agents
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => setBulkUploadOpen(true)} className="gap-1.5" data-testid="button-bulk-upload">
              <Upload className="h-3.5 w-3.5" /> Bulk Upload
            </Button>
            <Tabs value={viewMode} onValueChange={(v) => { setViewMode(v as ViewMode); setSelectedRoleId(null); setSearchQuery(""); }}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="departments" data-testid="view-departments">
                  <Layers className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Crews</span>
                </TabsTrigger>
                <TabsTrigger value="list" data-testid="view-list">
                  <List className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Hierarchy</span>
                </TabsTrigger>
                <TabsTrigger value="catalog" data-testid="view-catalog">
                  <Table className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Catalog</span>
                </TabsTrigger>
                <TabsTrigger value="diagram" data-testid="view-diagram">
                  <Network className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Org Tree</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-total-agents">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none">
              <Bot className="w-full h-full" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Total Agents</p>
            <p className="text-2xl font-bold mt-1">{totalAgents}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{activeCount} assigned</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-primary/40" />
          </div>
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-active-crews">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none">
              <Users className="w-full h-full" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Active Crews</p>
            <p className="text-2xl font-bold mt-1">{activeCrews}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{departments.length} total</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-blue-500/40" />
          </div>
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-ai-active">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none">
              <Sparkles className="w-full h-full" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">AI Active</p>
            <p className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">{tasksAutomated}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">agents automated</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 to-purple-500/40" />
          </div>
          <div className="relative overflow-hidden rounded-xl border bg-card p-4 agent-card-hover" data-testid="stat-savings">
            <div className="absolute top-0 right-0 w-16 h-16 opacity-[0.04] pointer-events-none">
              <TrendingDown className="w-full h-full" />
            </div>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-[0.1em]">Monthly Savings</p>
            <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">{monthlySavings > 0 ? formatPrice(monthlySavings) : "$0"}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">vs human cost</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-green-500 to-green-500/40" />
          </div>
        </div>

        {!user?.country && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5" data-testid="country-banner">
            <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300 flex-1">
              Select your country to see pricing adjusted to your local salary market.
            </p>
            <Select onValueChange={(v) => changeCountryMutation.mutate(v)}>
              <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="banner-select-country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {countries && (() => {
                  const grouped = new Map<string, typeof countries>();
                  countries.forEach(c => {
                    if (!grouped.has(c.region)) grouped.set(c.region, []);
                    grouped.get(c.region)!.push(c);
                  });
                  return Array.from(grouped.entries()).map(([region, items]) => (
                    <div key={region}>
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{region}</div>
                      {items.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </div>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>
        )}

        {user?.country && (
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Pricing for: <span className="font-medium text-foreground">{countries?.find(c => c.code === user.country)?.name || user.country}</span>
            </span>
            <Select value={user.country} onValueChange={(v) => changeCountryMutation.mutate(v)}>
              <SelectTrigger className="w-[140px] h-7 text-[11px]" data-testid="header-select-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[280px]">
                {countries && (() => {
                  const grouped = new Map<string, typeof countries>();
                  countries.forEach(c => {
                    if (!grouped.has(c.region)) grouped.set(c.region, []);
                    grouped.get(c.region)!.push(c);
                  });
                  return Array.from(grouped.entries()).map(([region, items]) => (
                    <div key={region}>
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{region}</div>
                      {items.map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </div>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search roles by name, department, skills, capabilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-search-roles"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {showDeptFilters && (
          <div className="flex gap-2 flex-wrap pb-2">
            <Button
              size="sm"
              variant={departmentFilter === null ? "default" : "outline"}
              onClick={() => setDepartmentFilter(null)}
              data-testid="filter-all"
            >
              All Departments
            </Button>
            {departments.map((dept) => (
              <Button
                key={dept}
                size="sm"
                variant={departmentFilter === dept ? "default" : "outline"}
                onClick={() => setDepartmentFilter(departmentFilter === dept ? null : dept)}
                data-testid={`filter-${dept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              >
                {dept}
              </Button>
            ))}
          </div>
        )}

        {isSearching && searchResults && (
          <div className="text-xs text-muted-foreground pb-1">
            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {viewMode === "departments" && !isSearching ? (
          <DepartmentGridView
            roles={roles ?? []}
            subscriptionMap={subscriptionMap}
            onDepartmentClick={handleDeptClick}
          />
        ) : (
          <div className={`flex gap-4 ${viewMode === "catalog" ? "" : "p-6 pt-2"}`}>
            <div className={`${selectedRole && viewMode !== "catalog" ? "flex-1 min-w-0" : "w-full"}`}>
              {isSearching && searchResults ? (
                <SearchResults
                  results={searchResults}
                  roles={roles ?? []}
                  subscriptionMap={subscriptionMap}
                  onAssignHuman={(role) => setAssignDialog({ role })}
                  onRemove={(sub) => removeAssignmentMutation.mutate(sub.id)}
                  onSelect={(role) => setSelectedRoleId(role.id === selectedRoleId ? null : role.id)}
                  selectedId={selectedRoleId}
                />
              ) : viewMode === "catalog" ? (
                <CatalogTableView
                  roles={roles ?? []}
                  subscriptionMap={subscriptionMap}
                  onAssignHuman={(role) => setAssignDialog({ role })}
                  onRemove={(sub) => removeAssignmentMutation.mutate(sub.id)}
                  onSelect={(role) => setSelectedRoleId(role.id === selectedRoleId ? null : role.id)}
                  selectedId={selectedRoleId}
                  departmentFilter={departmentFilter}
                />
              ) : viewMode === "diagram" ? (
                <div className="overflow-x-auto pb-8">
                  <div className="inline-flex justify-center min-w-full py-4">
                    {departmentFilter === null ? (
                      rootRoles.map((root) => (
                        <DiagramBranch
                          key={root.id}
                          role={root}
                          roles={roles ?? []}
                          subscriptionMap={subscriptionMap}
                          onSelect={(role) => setSelectedRoleId(role.id === selectedRoleId ? null : role.id)}
                          selectedId={selectedRoleId}
                          expandedIds={expandedDiagramIds}
                          toggleExpand={toggleDiagramExpand}
                        />
                      ))
                    ) : (
                      filteredRoots.map((role) => (
                        <DiagramBranch
                          key={role.id}
                          role={role}
                          roles={roles ?? []}
                          subscriptionMap={subscriptionMap}
                          onSelect={(r) => setSelectedRoleId(r.id === selectedRoleId ? null : r.id)}
                          selectedId={selectedRoleId}
                          expandedIds={expandedDiagramIds}
                          toggleExpand={toggleDiagramExpand}
                        />
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {(departmentFilter === null ? rootRoles : filteredRoots).map((role) => (
                    <ListNode
                      key={role.id}
                      role={role}
                      roles={roles ?? []}
                      subscriptionMap={subscriptionMap}
                      depth={0}
                      onAssignHuman={(r) => setAssignDialog({ role: r })}
                      onRemove={(sub) => removeAssignmentMutation.mutate(sub.id)}
                      onToggleShadow={(sub) => toggleAiShadowMutation.mutate({ subId: sub.id, hasAiShadow: !sub.hasAiShadow })}
                      onSelect={(r) => setSelectedRoleId(r.id === selectedRoleId ? null : r.id)}
                      selectedId={selectedRoleId}
                    />
                  ))}
                </div>
              )}
            </div>

            {selectedRole && isLargeScreen && viewMode !== "catalog" && (
              <div className="w-80 shrink-0">
                <RoleDetailPanel
                  role={selectedRole}
                  roles={roles ?? []}
                  subscriptionMap={subscriptionMap}
                  onAssignHuman={(role) => setAssignDialog({ role })}
                  onRemove={(sub) => removeAssignmentMutation.mutate(sub.id)}
                  onToggleShadow={(sub) => toggleAiShadowMutation.mutate({ subId: sub.id, hasAiShadow: !sub.hasAiShadow })}
                  onClose={() => setSelectedRoleId(null)}
                />
              </div>
            )}

            {selectedRole && (!isLargeScreen || viewMode === "catalog") && (
              <Dialog open={true} onOpenChange={() => setSelectedRoleId(null)}>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                  <DialogHeader className="sr-only">
                    <DialogTitle>{selectedRole.title}</DialogTitle>
                  </DialogHeader>
                  <RoleDetailPanel
                    role={selectedRole}
                    roles={roles ?? []}
                    subscriptionMap={subscriptionMap}
                    onAssignHuman={(role) => setAssignDialog({ role })}
                    onRemove={(sub) => removeAssignmentMutation.mutate(sub.id)}
                    onToggleShadow={(sub) => toggleAiShadowMutation.mutate({ subId: sub.id, hasAiShadow: !sub.hasAiShadow })}
                    onClose={() => setSelectedRoleId(null)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!assignDialog} onOpenChange={(open) => !open && setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Team Member</DialogTitle>
            <DialogDescription>
              Assign a human from your team to fulfill the "{assignDialog?.role.name}" role. Once assigned, you can subscribe an AI Agent to handle tasks autonomously.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="human-name">Full Name *</Label>
              <Input
                id="human-name"
                value={humanName}
                onChange={(e) => setHumanName(e.target.value)}
                placeholder="e.g. John Smith"
                data-testid="input-human-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="human-email">Email</Label>
              <Input
                id="human-email"
                value={humanEmail}
                onChange={(e) => setHumanEmail(e.target.value)}
                placeholder="e.g. john@company.com"
                data-testid="input-human-email"
              />
            </div>
            {assignDialog?.role.monthlyPrice && assignDialog.role.monthlyPrice > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
                <DollarSign className="h-3.5 w-3.5" />
                AI Agent available at {formatPrice(assignDialog.role.monthlyPrice)}/month after assignment
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAssignDialog(null)} data-testid="button-cancel-human">
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (assignDialog && humanName.trim()) {
                    assignHumanMutation.mutate({ roleId: assignDialog.role.id, name: humanName.trim(), email: humanEmail.trim() });
                  }
                }}
                disabled={!humanName.trim() || assignHumanMutation.isPending}
                data-testid="button-confirm-human"
              >
                {assignHumanMutation.isPending ? "Assigning..." : "Assign to Role"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        roles={roles ?? []}
        subscriptionMap={subscriptionMap}
      />
    </div>
  );
}
