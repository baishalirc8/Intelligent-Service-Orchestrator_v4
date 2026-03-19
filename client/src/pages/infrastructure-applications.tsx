import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AppWindow, RefreshCw, Loader2, Server, Activity,
  CheckCircle2, AlertTriangle, XCircle, Clock, Cpu, HardDrive,
  Zap, Database, Globe, Shield, Mail, Network, Monitor,
  ChevronDown, ChevronUp, ArrowRight, Brain, Eye,
  Layers, GitBranch, ShieldAlert, Target, Workflow,
} from "lucide-react";
import type { MonitoredApplication, DiscoveredAsset, ApplicationTopology, AgentAlert, AgentNotification } from "@shared/schema";

const criticalityConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  mission_critical: { label: "Mission Critical", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
  business: { label: "Business", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  supporting: { label: "Supporting", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  utility: { label: "Utility", color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  running: { label: "Running", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  degraded: { label: "Degraded", color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle },
  stopped: { label: "Stopped", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  unknown: { label: "Unknown", color: "text-gray-400", bg: "bg-gray-500/10", icon: Eye },
};

const topoStatusConfig: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: "Healthy", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  at_risk: { label: "At Risk", color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle },
  degraded: { label: "Degraded", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
};

const categoryIcons: Record<string, typeof Database> = {
  database: Database, web_server: Globe, email: Mail, directory_service: Shield,
  monitoring: Activity, security: Shield, networking: Network, middleware: Server,
  backup: HardDrive, messaging: Mail, iot_service: Cpu, building_automation: Monitor,
  storage: HardDrive, virtualization: Server, other: AppWindow,
};

const topoCategoryIcons: Record<string, typeof Database> = {
  erp: Layers, crm: Target, email: Mail, directory: Shield, web_application: Globe,
  database_platform: Database, security_stack: ShieldAlert, network_fabric: Network,
  monitoring_platform: Activity, collaboration: Workflow, banking: Database,
  iot_platform: Cpu, building_management: Monitor, other: AppWindow,
};

function HealthScoreBar({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 80 ? "bg-emerald-500" : s >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${s}%` }} />
      </div>
      <span className={`text-[10px] font-semibold ${s >= 80 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400"}`}>{s}%</span>
    </div>
  );
}

function ApplicationCard({ app, assetName, expanded, onToggle }: {
  app: MonitoredApplication;
  assetName: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const crit = criticalityConfig[app.criticality] || criticalityConfig.utility;
  const stat = statusConfig[app.status] || statusConfig.unknown;
  const StatusIcon = stat.icon;
  const CatIcon = categoryIcons[app.category] || AppWindow;
  const meta = app.metadata as Record<string, any> | null;

  return (
    <div className="border-b border-border/10 last:border-b-0" data-testid={`app-card-${app.id}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/10 transition-colors"
        onClick={onToggle}
        data-testid={`app-row-${app.id}`}
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${stat.bg} border ${stat.color.replace("text-", "border-").replace("400", "500/20")}`}>
          <CatIcon className={`h-4 w-4 ${stat.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold truncate">{app.name}</span>
            {app.version && <span className="text-[9px] text-muted-foreground/40">{app.version}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 gap-0.5">
              <Server className="h-2 w-2" /> {assetName}
            </Badge>
            <Badge className={`text-[7px] h-3.5 ${crit.bg} ${crit.color} border ${crit.border}`}>
              {crit.label}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-20 hidden sm:block">
            <HealthScoreBar score={app.healthScore} />
          </div>
          <div className="flex items-center gap-1">
            <StatusIcon className={`h-3.5 w-3.5 ${stat.color}`} />
            <span className={`text-[10px] font-medium ${stat.color}`}>{stat.label}</span>
          </div>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2" data-testid={`app-detail-${app.id}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded-lg bg-muted/5 border border-border/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Cpu className="h-3 w-3 text-blue-400" />
                <span className="text-[9px] text-muted-foreground/50">CPU Usage</span>
              </div>
              <p className="text-sm font-bold" data-testid={`app-cpu-${app.id}`}>{app.cpuUsage != null ? `${app.cpuUsage.toFixed(1)}%` : "N/A"}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/5 border border-border/10">
              <div className="flex items-center gap-1.5 mb-1">
                <HardDrive className="h-3 w-3 text-purple-400" />
                <span className="text-[9px] text-muted-foreground/50">Memory</span>
              </div>
              <p className="text-sm font-bold" data-testid={`app-memory-${app.id}`}>{app.memoryUsage != null ? `${app.memoryUsage.toFixed(1)}%` : "N/A"}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/5 border border-border/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3 w-3 text-amber-400" />
                <span className="text-[9px] text-muted-foreground/50">Response Time</span>
              </div>
              <p className="text-sm font-bold" data-testid={`app-response-${app.id}`}>{app.responseTime != null ? `${app.responseTime.toFixed(0)}ms` : "N/A"}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/5 border border-border/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-emerald-400" />
                <span className="text-[9px] text-muted-foreground/50">Uptime</span>
              </div>
              <p className="text-sm font-bold" data-testid={`app-uptime-${app.id}`}>
                {app.uptime != null ? (app.uptime > 24 ? `${(app.uptime / 24).toFixed(1)}d` : `${app.uptime.toFixed(1)}h`) : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap text-[10px]">
            {app.port && (
              <Badge variant="outline" className="text-[8px] h-4 border-border/20 gap-0.5">
                Port: {app.port}
              </Badge>
            )}
            {app.protocol && (
              <Badge variant="outline" className="text-[8px] h-4 border-border/20 gap-0.5">
                {app.protocol.toUpperCase()}
              </Badge>
            )}
            {app.processName && (
              <Badge variant="outline" className="text-[8px] h-4 border-border/20 gap-0.5">
                Process: {app.processName}
              </Badge>
            )}
            {app.category && (
              <Badge variant="outline" className="text-[8px] h-4 border-border/20 gap-0.5">
                {app.category.replace(/_/g, " ")}
              </Badge>
            )}
          </div>

          {app.dependencies && app.dependencies.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] text-muted-foreground/40 shrink-0">Dependencies:</span>
              {app.dependencies.map(dep => (
                <Badge key={dep} variant="outline" className="text-[7px] h-3.5 border-border/15 gap-0.5">
                  <ArrowRight className="h-2 w-2" /> {dep}
                </Badge>
              ))}
            </div>
          )}

          {meta?.description && (
            <p className="text-[10px] text-muted-foreground/50 leading-snug">{meta.description}</p>
          )}

          {app.lastChecked && (
            <p className="text-[9px] text-muted-foreground/30">
              Last checked: {new Date(app.lastChecked).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TopologyDiagram({ topo, assetMap, apps }: {
  topo: ApplicationTopology;
  assetMap: Map<string, DiscoveredAsset>;
  apps: MonitoredApplication[];
}) {
  const topology = topo.topology as { tiers?: any[]; dependencies?: any[] } | null;
  const tiers = topology?.tiers || [];
  const deps = topology?.dependencies || [];
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  if (tiers.length === 0) return null;

  const NODE_W = 160;
  const NODE_H = 56;
  const TIER_GAP = 70;
  const NODE_GAP = 20;
  const PAD_X = 30;
  const PAD_Y = 24;

  const tierData = tiers.map((tier: any) => {
    const tierAssets = (tier.assetIds || []).map((id: string) => assetMap.get(id)).filter(Boolean) as DiscoveredAsset[];
    const tierServices = (tier.serviceIds || []).map((sid: string) => apps.find(a => a.id === sid)).filter(Boolean) as MonitoredApplication[];
    const allNodes: { id: string; label: string; sublabel: string; health: number; type: "asset" | "service"; services: MonitoredApplication[] }[] = [];
    tierAssets.forEach(a => {
      const assetSvcs = apps.filter(ap => ap.assetId === a.id);
      const avgH = assetSvcs.length > 0 ? Math.round(assetSvcs.reduce((s, sv) => s + (sv.healthScore ?? 100), 0) / assetSvcs.length) : 100;
      allNodes.push({ id: a.id, label: a.name, sublabel: a.ipAddress || a.type, health: avgH, type: "asset", services: assetSvcs });
    });
    tierServices.forEach(sv => {
      if (!tierAssets.find(a => a.id === sv.assetId)) {
        allNodes.push({ id: sv.id, label: sv.name, sublabel: sv.status, health: sv.healthScore ?? 100, type: "service", services: [sv] });
      }
    });
    const tierHealth = allNodes.length > 0 ? Math.round(allNodes.reduce((s, n) => s + n.health, 0) / allNodes.length) : 100;
    return { ...tier, nodes: allNodes, health: tierHealth };
  });

  const maxNodesInTier = Math.max(...tierData.map((t: any) => t.nodes.length), 1);
  const svgW = Math.max(PAD_X * 2 + maxNodesInTier * NODE_W + (maxNodesInTier - 1) * NODE_GAP, 500);
  const TOOLTIP_H = 80;
  const svgH = PAD_Y * 2 + tiers.length * NODE_H + (tiers.length - 1) * TIER_GAP + TOOLTIP_H;

  const nodePositions = new Map<string, { x: number; y: number; tierIdx: number }>();
  tierData.forEach((tier: any, tIdx: number) => {
    const count = tier.nodes.length;
    const totalW = count * NODE_W + (count - 1) * NODE_GAP;
    const startX = (svgW - totalW) / 2;
    const y = PAD_Y + tIdx * (NODE_H + TIER_GAP);
    tier.nodes.forEach((node: any, nIdx: number) => {
      nodePositions.set(node.id, { x: startX + nIdx * (NODE_W + NODE_GAP), y, tierIdx: tIdx });
    });
  });

  const healthColor = (h: number) => h >= 80 ? "#34d399" : h >= 50 ? "#fbbf24" : "#f87171";
  const healthBg = (h: number) => h >= 80 ? "rgba(52,211,153,0.08)" : h >= 50 ? "rgba(251,191,36,0.08)" : "rgba(248,113,113,0.08)";
  const healthBorder = (h: number) => h >= 80 ? "rgba(52,211,153,0.25)" : h >= 50 ? "rgba(251,191,36,0.25)" : "rgba(248,113,113,0.25)";

  const connections: { x1: number; y1: number; x2: number; y2: number; label: string; fromTier: string; toTier: string }[] = [];
  deps.forEach((dep: any) => {
    const fromTierIdx = tierData.findIndex((t: any) => t.name === dep.from);
    const toTierIdx = tierData.findIndex((t: any) => t.name === dep.to);
    if (fromTierIdx < 0 || toTierIdx < 0) return;
    const fromTier = tierData[fromTierIdx];
    const toTier = tierData[toTierIdx];
    fromTier.nodes.forEach((fn: any) => {
      const fromPos = nodePositions.get(fn.id);
      if (!fromPos) return;
      toTier.nodes.forEach((tn: any) => {
        const toPos = nodePositions.get(tn.id);
        if (!toPos) return;
        const upper = fromPos.y < toPos.y ? fromPos : toPos;
        const lower = fromPos.y < toPos.y ? toPos : fromPos;
        connections.push({
          x1: upper.x + NODE_W / 2, y1: upper.y + NODE_H,
          x2: lower.x + NODE_W / 2, y2: lower.y,
          label: dep.type?.replace(/_/g, " ") || "",
          fromTier: dep.from, toTier: dep.to,
        });
      });
    });
  });

  if (connections.length === 0 && tierData.length > 1) {
    for (let tIdx = 0; tIdx < tierData.length - 1; tIdx++) {
      const currentTier = tierData[tIdx];
      const nextTier = tierData[tIdx + 1];
      currentTier.nodes.forEach((cn: any) => {
        const fromPos = nodePositions.get(cn.id);
        if (!fromPos) return;
        nextTier.nodes.forEach((nn: any) => {
          const toPos = nodePositions.get(nn.id);
          if (!toPos) return;
          connections.push({
            x1: fromPos.x + NODE_W / 2, y1: fromPos.y + NODE_H,
            x2: toPos.x + NODE_W / 2, y2: toPos.y,
            label: "", fromTier: currentTier.name, toTier: nextTier.name,
          });
        });
      });
    }
  }

  const hoveredNodeData = hoveredNode ? tierData.flatMap((t: any) => t.nodes).find((n: any) => n.id === hoveredNode) : null;
  const hoveredPos = hoveredNode ? nodePositions.get(hoveredNode) : null;

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto rounded-lg border border-border/10 bg-[#0a0a0f]" data-testid={`topology-diagram-${topo.id}`}>
        <svg width={svgW} height={svgH} className="min-w-[500px]">
          <defs>
            <marker id={`arrow-${topo.id}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6" fill="none" stroke="rgba(99,102,241,0.4)" strokeWidth="1" />
            </marker>
            <filter id={`glow-${topo.id}`}>
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {tierData.map((tier: any, tIdx: number) => {
            const y = PAD_Y + tIdx * (NODE_H + TIER_GAP);
            return (
              <g key={`tier-bg-${tIdx}`}>
                <rect x={10} y={y - 8} width={svgW - 20} height={NODE_H + 16} rx={8}
                  fill="rgba(99,102,241,0.03)" stroke="rgba(99,102,241,0.08)" strokeWidth={1} strokeDasharray="4 4" />
                <text x={18} y={y + 3} fill="rgba(99,102,241,0.35)" fontSize="9" fontWeight="600" fontFamily="system-ui">
                  {tier.name}
                </text>
                {tier.role && (
                  <text x={18} y={y + 14} fill="rgba(99,102,241,0.2)" fontSize="7" fontFamily="system-ui">
                    {tier.role.length > 60 ? tier.role.slice(0, 58) + "…" : tier.role}
                  </text>
                )}
                <text x={svgW - 18} y={y + 3} fill={healthColor(tier.health)} fontSize="9" fontWeight="700" fontFamily="system-ui" textAnchor="end">
                  {tier.health}%
                </text>
              </g>
            );
          })}

          {connections.map((conn, idx) => {
            const midY = (conn.y1 + conn.y2) / 2;
            return (
              <g key={`conn-${idx}`}>
                <path
                  d={`M${conn.x1},${conn.y1} C${conn.x1},${midY} ${conn.x2},${midY} ${conn.x2},${conn.y2}`}
                  fill="none"
                  stroke="rgba(99,102,241,0.2)"
                  strokeWidth={1.5}
                  markerEnd={`url(#arrow-${topo.id})`}
                />
                {conn.label && (
                  <>
                    <rect x={(conn.x1 + conn.x2) / 2 - 24} y={midY - 7} width={48} height={14} rx={4}
                      fill="rgba(15,15,25,0.9)" stroke="rgba(99,102,241,0.15)" strokeWidth={0.5} />
                    <text x={(conn.x1 + conn.x2) / 2} y={midY} fill="rgba(99,102,241,0.5)" fontSize="7" fontFamily="system-ui" textAnchor="middle" dominantBaseline="middle">
                      {conn.label}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {tierData.map((tier: any) =>
            tier.nodes.map((node: any) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;
              const c = healthColor(node.health);
              const bg = healthBg(node.health);
              const border = healthBorder(node.health);
              const isHovered = hoveredNode === node.id;
              return (
                <g key={node.id} data-testid={`topology-node-${node.id}`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: "pointer" }}
                >
                  <rect x={pos.x} y={pos.y + 8} width={NODE_W} height={NODE_H - 8} rx={8}
                    fill={bg} stroke={isHovered ? healthColor(node.health) : border}
                    strokeWidth={isHovered ? 2 : 1.2}
                    style={{ transition: "stroke-width 0.15s, stroke 0.15s" }} />
                  <circle cx={pos.x + 12} cy={pos.y + NODE_H / 2 + 4} r={4} fill={c} opacity={0.8} filter={`url(#glow-${topo.id})`} />
                  <text x={pos.x + 22} y={pos.y + NODE_H / 2 + 1} fill="#e2e8f0" fontSize="10" fontWeight="600" fontFamily="system-ui" dominantBaseline="middle">
                    {node.label.length > 18 ? node.label.slice(0, 17) + "…" : node.label}
                  </text>
                  <text x={pos.x + 22} y={pos.y + NODE_H / 2 + 13} fill="rgba(148,163,184,0.5)" fontSize="8" fontFamily="system-ui" dominantBaseline="middle">
                    {node.sublabel}
                  </text>
                  <text x={pos.x + NODE_W - 10} y={pos.y + NODE_H / 2 + 4} fill={c} fontSize="10" fontWeight="700" fontFamily="system-ui" textAnchor="end" dominantBaseline="middle">
                    {node.health}%
                  </text>
                  {node.type === "asset" && (
                    <>
                      <rect x={pos.x + NODE_W - 38} y={pos.y + 12} width={28} height={12} rx={3}
                        fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.2)" strokeWidth={0.5} />
                      <text x={pos.x + NODE_W - 24} y={pos.y + 20} fill="rgba(99,102,241,0.5)" fontSize="6" fontFamily="system-ui" textAnchor="middle" dominantBaseline="middle">
                        ASSET
                      </text>
                    </>
                  )}
                </g>
              );
            })
          )}

          {hoveredNodeData && hoveredPos && (
            <g>
              <rect x={Math.max(5, Math.min(hoveredPos.x - 20, svgW - 195))} y={hoveredPos.y + NODE_H + 4}
                width={190} height={TOOLTIP_H - 10} rx={6}
                fill="rgba(10,10,20,0.95)" stroke="rgba(99,102,241,0.2)" strokeWidth={1} />
              <text x={Math.max(15, Math.min(hoveredPos.x - 10, svgW - 185))} y={hoveredPos.y + NODE_H + 18}
                fill="#e2e8f0" fontSize="9" fontWeight="600" fontFamily="system-ui">
                {hoveredNodeData.label}
              </text>
              <text x={Math.max(15, Math.min(hoveredPos.x - 10, svgW - 185))} y={hoveredPos.y + NODE_H + 30}
                fill="rgba(148,163,184,0.6)" fontSize="8" fontFamily="system-ui">
                {hoveredNodeData.type === "asset" ? "Infrastructure Asset" : "Service"} • Health: {hoveredNodeData.health}%
              </text>
              {hoveredNodeData.services.slice(0, 3).map((svc: MonitoredApplication, si: number) => (
                <text key={si} x={Math.max(15, Math.min(hoveredPos.x - 10, svgW - 185))} y={hoveredPos.y + NODE_H + 42 + si * 11}
                  fill="rgba(148,163,184,0.45)" fontSize="7" fontFamily="system-ui">
                  → {svc.name} ({svc.status}) {svc.healthScore ?? 100}%
                </text>
              ))}
              {hoveredNodeData.services.length > 3 && (
                <text x={Math.max(15, Math.min(hoveredPos.x - 10, svgW - 185))} y={hoveredPos.y + NODE_H + 42 + 33}
                  fill="rgba(148,163,184,0.3)" fontSize="7" fontFamily="system-ui">
                  +{hoveredNodeData.services.length - 3} more services
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      {deps.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-semibold">Dependency Flow</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {deps.map((dep: any, idx: number) => (
              <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/5 border border-border/10">
                <span className="text-[9px] font-medium">{dep.from}</span>
                <ArrowRight className="h-2.5 w-2.5 text-cyan-400/50" />
                <span className="text-[9px] font-medium">{dep.to}</span>
                {dep.type && (
                  <Badge variant="outline" className="text-[6px] h-3 border-border/15 ml-1">
                    {dep.type.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopologyCard({ topo, assetMap, apps, alerts, notifications, expanded, onToggle }: {
  topo: ApplicationTopology;
  assetMap: Map<string, DiscoveredAsset>;
  apps: MonitoredApplication[];
  alerts: AgentAlert[];
  notifications: AgentNotification[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const crit = criticalityConfig[topo.criticality] || criticalityConfig.business;
  const stat = topoStatusConfig[topo.status] || topoStatusConfig.healthy;
  const StatusIcon = stat.icon;
  const CatIcon = topoCategoryIcons[topo.category] || AppWindow;
  const topology = topo.topology as { tiers?: any[]; dependencies?: any[] } | null;
  const impact = topo.impactAnalysis as { singlePointsOfFailure?: any[]; cascadeScenarios?: any[]; overallRisk?: string; redundancyScore?: number } | null;
  const topoAssets = (topo.assetIds || []).map(id => assetMap.get(id)).filter(Boolean) as DiscoveredAsset[];
  const topoServices = (topo.serviceIds || []).map(sid => apps.find(a => a.id === sid)).filter(Boolean) as MonitoredApplication[];
  const assetIdSet = new Set(topo.assetIds || []);
  const relatedAlerts = alerts.filter(a => a.deviceId && assetIdSet.has(a.deviceId));
  const relatedNotifications = notifications.filter(n => n.assetId && assetIdSet.has(n.assetId));
  const activeAlerts = relatedAlerts.filter(a => !a.resolvedAt && !a.falsePositive);
  const allRelatedEvents = [
    ...activeAlerts.map(a => ({ id: a.id, type: "alert" as const, severity: a.severity, title: a.message, detail: a.details || "", deviceId: a.deviceId, timestamp: a.createdAt, acknowledged: a.acknowledged })),
    ...relatedNotifications.filter(n => !n.resolvedAt).map(n => ({ id: n.id, type: "notification" as const, severity: n.severity, title: n.title, detail: n.description, deviceId: n.assetId, timestamp: n.createdAt, acknowledged: n.actionStatus !== "pending" })),
  ].sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, high: 1, warning: 2, medium: 3, low: 4, info: 5 };
    return (sevOrder[a.severity] ?? 5) - (sevOrder[b.severity] ?? 5);
  });

  const componentHealth = topoAssets.map(asset => {
    const assetServices = apps.filter(ap => ap.assetId === asset.id);
    const avgHealth = assetServices.length > 0 ? Math.round(assetServices.reduce((s, sv) => s + (sv.healthScore ?? 100), 0) / assetServices.length) : 100;
    const assetAlertCount = activeAlerts.filter(a => a.deviceId === asset.id).length;
    return { asset, services: assetServices, health: avgHealth, alertCount: assetAlertCount };
  });

  return (
    <Card className="overflow-hidden" data-testid={`topology-card-${topo.id}`}>
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/10 transition-colors"
        onClick={onToggle}
        data-testid={`topology-row-${topo.id}`}
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.bg} border ${stat.color.replace("text-", "border-").replace("400", "500/20")}`}>
          <CatIcon className={`h-5 w-5 ${stat.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate" data-testid={`topology-name-${topo.id}`}>{topo.name}</span>
            <Badge className={`text-[7px] h-3.5 ${crit.bg} ${crit.color} border ${crit.border}`}>
              {crit.label}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">{topo.description}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 gap-0.5">
              <Server className="h-2 w-2" /> {topoAssets.length} asset{topoAssets.length !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 gap-0.5">
              <AppWindow className="h-2 w-2" /> {componentHealth.reduce((s, c) => s + c.services.length, 0)} service{componentHealth.reduce((s, c) => s + c.services.length, 0) !== 1 ? "s" : ""}
            </Badge>
            {topology?.tiers && (
              <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 gap-0.5">
                <Layers className="h-2 w-2" /> {topology.tiers.length} tier{topology.tiers.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {allRelatedEvents.length > 0 && (
              <Badge className={`text-[7px] h-3.5 gap-0.5 ${
                allRelatedEvents.some(e => e.severity === "critical") ? "bg-red-500/10 text-red-400 border-red-500/15" :
                allRelatedEvents.some(e => e.severity === "high" || e.severity === "warning") ? "bg-amber-500/10 text-amber-400 border-amber-500/15" :
                "bg-yellow-500/10 text-yellow-400 border-yellow-500/15"
              }`}>
                <AlertTriangle className="h-2 w-2" /> {allRelatedEvents.length} event{allRelatedEvents.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {impact?.overallRisk && (
              <Badge className={`text-[7px] h-3.5 ${
                impact.overallRisk === "critical" ? "bg-red-500/10 text-red-400 border-red-500/15" :
                impact.overallRisk === "high" ? "bg-amber-500/10 text-amber-400 border-amber-500/15" :
                impact.overallRisk === "medium" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/15" :
                "bg-emerald-500/10 text-emerald-400 border-emerald-500/15"
              }`}>
                Risk: {impact.overallRisk}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-24 hidden sm:block">
            <HealthScoreBar score={topo.healthScore} />
          </div>
          <div className="flex items-center gap-1">
            <StatusIcon className={`h-3.5 w-3.5 ${stat.color}`} />
            <span className={`text-[10px] font-medium ${stat.color}`}>{stat.label}</span>
          </div>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/10 p-3 space-y-4" data-testid={`topology-detail-${topo.id}`}>
          <TopologyDiagram topo={topo} assetMap={assetMap} apps={apps} />

          {componentHealth.length > 0 && (
            <div className="space-y-2" data-testid={`topology-components-${topo.id}`}>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-semibold">Component Health & Service Metrics</span>
                <span className="text-[9px] text-muted-foreground/40 ml-auto">{componentHealth.reduce((s, c) => s + c.services.length, 0)} services across {componentHealth.length} assets</span>
              </div>
              <div className="space-y-2">
                {componentHealth.map(({ asset, services, health, alertCount }) => (
                  <div key={asset.id} className="rounded-lg border border-border/15 bg-muted/5 overflow-hidden" data-testid={`topology-asset-detail-${topo.id}-${asset.id}`}>
                    <div className="flex items-center gap-2 p-2 bg-muted/5">
                      <Server className="h-3.5 w-3.5 text-muted-foreground/50" />
                      <span className="text-[11px] font-semibold flex-1">{asset.name}</span>
                      {asset.ipAddress && <span className="text-[9px] text-muted-foreground/30">{asset.ipAddress}</span>}
                      {alertCount > 0 && (
                        <Badge className="text-[7px] h-3.5 bg-red-500/10 text-red-400 border-red-500/15 gap-0.5">
                          <AlertTriangle className="h-2 w-2" /> {alertCount}
                        </Badge>
                      )}
                      <span className={`text-[10px] font-bold ${health >= 80 ? "text-emerald-400" : health >= 50 ? "text-amber-400" : "text-red-400"}`}>{health}%</span>
                      <div className="w-16">
                        <HealthScoreBar score={health} />
                      </div>
                    </div>
                    {services.length > 0 && (
                      <div className="border-t border-border/10">
                        <table className="w-full text-[9px]">
                          <thead>
                            <tr className="text-muted-foreground/40 border-b border-border/5">
                              <th className="text-left py-1 px-2 font-medium">Service</th>
                              <th className="text-center py-1 px-1 font-medium">Status</th>
                              <th className="text-right py-1 px-1 font-medium">CPU</th>
                              <th className="text-right py-1 px-1 font-medium">Memory</th>
                              <th className="text-right py-1 px-1 font-medium">Response</th>
                              <th className="text-right py-1 px-1 font-medium">Uptime</th>
                              <th className="text-right py-1 px-2 font-medium">Health</th>
                            </tr>
                          </thead>
                          <tbody>
                            {services.map(svc => {
                              const svcStat = statusConfig[svc.status] || statusConfig.unknown;
                              const SvcIcon = svcStat.icon;
                              return (
                                <tr key={svc.id} className="border-b border-border/5 last:border-0 hover:bg-muted/5" data-testid={`topology-service-row-${svc.id}`}>
                                  <td className="py-1.5 px-2">
                                    <div className="flex items-center gap-1">
                                      <AppWindow className="h-2.5 w-2.5 text-muted-foreground/40" />
                                      <span className="font-medium">{svc.name}</span>
                                      {svc.port && <span className="text-muted-foreground/30">:{svc.port}</span>}
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-1 text-center">
                                    <div className="flex items-center justify-center gap-0.5">
                                      <SvcIcon className={`h-2.5 w-2.5 ${svcStat.color}`} />
                                      <span className={`${svcStat.color} font-medium`}>{svcStat.label}</span>
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-1 text-right">
                                    {svc.cpuUsage != null ? (
                                      <span className={`font-mono ${(svc.cpuUsage ?? 0) > 80 ? "text-red-400" : (svc.cpuUsage ?? 0) > 60 ? "text-amber-400" : "text-muted-foreground/60"}`}>
                                        {svc.cpuUsage.toFixed(1)}%
                                      </span>
                                    ) : <span className="text-muted-foreground/20">—</span>}
                                  </td>
                                  <td className="py-1.5 px-1 text-right">
                                    {svc.memoryUsage != null ? (
                                      <span className={`font-mono ${(svc.memoryUsage ?? 0) > 80 ? "text-red-400" : (svc.memoryUsage ?? 0) > 60 ? "text-amber-400" : "text-muted-foreground/60"}`}>
                                        {svc.memoryUsage.toFixed(1)}%
                                      </span>
                                    ) : <span className="text-muted-foreground/20">—</span>}
                                  </td>
                                  <td className="py-1.5 px-1 text-right">
                                    {svc.responseTime != null ? (
                                      <span className={`font-mono ${(svc.responseTime ?? 0) > 500 ? "text-red-400" : (svc.responseTime ?? 0) > 200 ? "text-amber-400" : "text-muted-foreground/60"}`}>
                                        {svc.responseTime.toFixed(0)}ms
                                      </span>
                                    ) : <span className="text-muted-foreground/20">—</span>}
                                  </td>
                                  <td className="py-1.5 px-1 text-right">
                                    {svc.uptime != null ? (
                                      <span className="font-mono text-muted-foreground/60">
                                        {svc.uptime >= 99.9 ? "99.9%" : `${svc.uptime.toFixed(1)}%`}
                                      </span>
                                    ) : <span className="text-muted-foreground/20">—</span>}
                                  </td>
                                  <td className="py-1.5 px-2 text-right">
                                    <span className={`font-bold ${(svc.healthScore ?? 100) >= 80 ? "text-emerald-400" : (svc.healthScore ?? 100) >= 50 ? "text-amber-400" : "text-red-400"}`}>
                                      {svc.healthScore ?? 100}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {services.length === 0 && (
                      <div className="px-2 py-1.5 text-[9px] text-muted-foreground/30 border-t border-border/10">No monitored services on this asset</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {allRelatedEvents.length > 0 && (
            <div className="space-y-1.5" data-testid={`topology-events-${topo.id}`}>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold">Active Events & Alerts</span>
                <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 ml-1">{allRelatedEvents.length}</Badge>
              </div>
              <div className="space-y-1">
                {allRelatedEvents.slice(0, 8).map(evt => {
                  const sevColors: Record<string, string> = {
                    critical: "bg-red-500/5 border-red-500/10 text-red-400",
                    high: "bg-amber-500/5 border-amber-500/10 text-amber-400",
                    warning: "bg-yellow-500/5 border-yellow-500/10 text-yellow-400",
                    medium: "bg-yellow-500/5 border-yellow-500/10 text-yellow-400",
                    low: "bg-blue-500/5 border-blue-500/10 text-blue-400",
                    info: "bg-gray-500/5 border-gray-500/10 text-gray-400",
                  };
                  const colors = sevColors[evt.severity] || sevColors.medium;
                  const deviceName = evt.deviceId ? assetMap.get(evt.deviceId)?.name || evt.deviceId : "Unknown";
                  return (
                    <div key={evt.id} className={`flex items-start gap-2 p-2 rounded-lg border ${colors.split(" ").slice(0, 2).join(" ")}`} data-testid={`topology-event-${evt.id}`}>
                      {evt.type === "alert" ? (
                        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${colors.split(" ")[2]}`} />
                      ) : (
                        <Zap className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${colors.split(" ")[2]}`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-semibold truncate">{evt.title}</span>
                          <Badge className={`text-[6px] h-3 ${colors}`}>{evt.severity}</Badge>
                          <Badge variant="outline" className="text-[6px] h-3 border-border/15">{evt.type}</Badge>
                          {evt.acknowledged && <Badge variant="outline" className="text-[6px] h-3 border-emerald-500/20 text-emerald-400">ACK</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[8px] text-muted-foreground/40 flex items-center gap-0.5">
                            <Server className="h-2 w-2" /> {deviceName}
                          </span>
                          {evt.timestamp && (
                            <span className="text-[8px] text-muted-foreground/30">
                              {new Date(evt.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        {evt.detail && <p className="text-[8px] text-muted-foreground/40 mt-0.5 line-clamp-2">{evt.detail}</p>}
                      </div>
                    </div>
                  );
                })}
                {allRelatedEvents.length > 8 && (
                  <div className="text-center text-[9px] text-muted-foreground/30 py-1">
                    +{allRelatedEvents.length - 8} more events
                  </div>
                )}
              </div>
            </div>
          )}

          {impact?.singlePointsOfFailure && impact.singlePointsOfFailure.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs font-semibold">Single Points of Failure</span>
              </div>
              <div className="space-y-1">
                {impact.singlePointsOfFailure.map((spof: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10" data-testid={`topology-spof-${topo.id}-${idx}`}>
                    <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                      spof.severity === "critical" ? "text-red-400" : spof.severity === "high" ? "text-amber-400" : "text-yellow-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold">{spof.assetName}</span>
                        <Badge className={`text-[6px] h-3 ${
                          spof.severity === "critical" ? "bg-red-500/10 text-red-400 border-red-500/15" :
                          spof.severity === "high" ? "bg-amber-500/10 text-amber-400 border-amber-500/15" :
                          "bg-yellow-500/10 text-yellow-400 border-yellow-500/15"
                        }`}>{spof.severity}</Badge>
                      </div>
                      <p className="text-[9px] text-muted-foreground/50 mt-0.5">{spof.impact}</p>
                      {spof.affectedTiers && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[8px] text-muted-foreground/30">Affects:</span>
                          {spof.affectedTiers.map((t: string) => (
                            <Badge key={t} variant="outline" className="text-[6px] h-3 border-border/15">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {impact?.cascadeScenarios && impact.cascadeScenarios.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-semibold">Cascade Failure Scenarios</span>
              </div>
              <div className="space-y-1">
                {impact.cascadeScenarios.map((cs: any, idx: number) => (
                  <div key={idx} className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10" data-testid={`topology-cascade-${topo.id}-${idx}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold text-amber-400">Trigger: {cs.trigger}</span>
                      {cs.estimatedDowntime && (
                        <Badge variant="outline" className="text-[6px] h-3 border-border/15 gap-0.5">
                          <Clock className="h-2 w-2" /> {cs.estimatedDowntime}
                        </Badge>
                      )}
                    </div>
                    {cs.chain && (
                      <div className="flex items-center gap-1 flex-wrap mb-1">
                        {cs.chain.map((step: string, si: number) => (
                          <div key={si} className="flex items-center gap-1">
                            {si > 0 && <ArrowRight className="h-2.5 w-2.5 text-amber-400/30" />}
                            <span className="text-[8px] text-muted-foreground/50 px-1.5 py-0.5 rounded bg-muted/10">{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[9px] text-muted-foreground/50">{cs.businessImpact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {impact?.redundancyScore != null && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/5 border border-border/10">
              <span className="text-[9px] text-muted-foreground/40">Redundancy Score</span>
              <div className="flex-1">
                <HealthScoreBar score={impact.redundancyScore} />
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function InfrastructureApplications() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"services" | "topology">("services");
  const [criticalityFilter, setCriticalityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [expandedTopo, setExpandedTopo] = useState<string | null>(null);

  const { data: apps, isLoading: appsLoading } = useQuery<MonitoredApplication[]>({
    queryKey: ["/api/monitored-applications"],
  });

  const { data: assets } = useQuery<DiscoveredAsset[]>({
    queryKey: ["/api/discovered-assets"],
  });

  const { data: topologies, isLoading: topoLoading } = useQuery<ApplicationTopology[]>({
    queryKey: ["/api/application-topologies"],
  });

  const { data: alerts } = useQuery<AgentAlert[]>({
    queryKey: ["/api/agent-alerts"],
  });

  const { data: notifications } = useQuery<AgentNotification[]>({
    queryKey: ["/api/agent-notifications"],
  });

  const assetMap = useMemo(() => {
    if (!assets) return new Map<string, DiscoveredAsset>();
    return new Map(assets.map(a => [a.id, a]));
  }, [assets]);

  const discoverMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/monitored-applications/discover");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitored-applications"] });
      toast({ title: "Application Discovery Complete", description: `Discovered ${data.discovered} applications across your infrastructure` });
    },
    onError: (err: any) => {
      toast({ title: "Discovery Failed", description: err.message, variant: "destructive" });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/monitored-applications/refresh-health");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monitored-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/application-topologies"] });
      toast({ title: "Health Metrics Updated", description: `Refreshed ${data.refreshed} application health scores` });
    },
    onError: (err: any) => {
      toast({ title: "Refresh Failed", description: err.message, variant: "destructive" });
    },
  });

  const topoDiscoverMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/application-topologies/discover");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/application-topologies"] });
      toast({ title: "Topology Mapping Complete", description: `Mapped ${data.discovered} business application topologies` });
    },
    onError: (err: any) => {
      toast({ title: "Topology Discovery Failed", description: err.message, variant: "destructive" });
    },
  });

  const filteredApps = useMemo(() => {
    if (!apps) return [];
    let list = apps;
    if (criticalityFilter !== "all") list = list.filter(a => a.criticality === criticalityFilter);
    if (statusFilter !== "all") list = list.filter(a => a.status === statusFilter);
    if (assetFilter !== "all") list = list.filter(a => a.assetId === assetFilter);
    return list;
  }, [apps, criticalityFilter, statusFilter, assetFilter]);

  const stats = useMemo(() => {
    if (!apps) return { total: 0, missionCritical: 0, running: 0, degraded: 0, stopped: 0, avgHealth: 0, assets: 0 };
    const uniqueAssets = new Set(apps.map(a => a.assetId));
    const healthScores = apps.filter(a => a.healthScore != null).map(a => a.healthScore!);
    return {
      total: apps.length,
      missionCritical: apps.filter(a => a.criticality === "mission_critical").length,
      running: apps.filter(a => a.status === "running").length,
      degraded: apps.filter(a => a.status === "degraded").length,
      stopped: apps.filter(a => a.status === "stopped").length,
      avgHealth: healthScores.length > 0 ? Math.round(healthScores.reduce((s, v) => s + v, 0) / healthScores.length) : 0,
      assets: uniqueAssets.size,
    };
  }, [apps]);

  const assetOptions = useMemo(() => {
    if (!apps || !assets) return [];
    const assetIds = new Set(apps.map(a => a.assetId));
    return assets.filter(a => assetIds.has(a.id)).map(a => ({ id: a.id, name: a.name }));
  }, [apps, assets]);

  const groupedApps = useMemo(() => {
    const groups = new Map<string, MonitoredApplication[]>();
    for (const app of filteredApps) {
      const list = groups.get(app.assetId) || [];
      list.push(app);
      groups.set(app.assetId, list);
    }
    return Array.from(groups.entries()).map(([assetId, appList]) => ({
      assetId,
      asset: assetMap.get(assetId),
      apps: appList.sort((a, b) => {
        const critOrder = { mission_critical: 0, business: 1, supporting: 2, utility: 3 };
        return (critOrder[a.criticality as keyof typeof critOrder] ?? 4) - (critOrder[b.criticality as keyof typeof critOrder] ?? 4);
      }),
    }));
  }, [filteredApps, assetMap]);

  if (appsLoading || topoLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  const topoList = topologies || [];

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-4" data-testid="app-monitor-view">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <AppWindow className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold">Application Monitor</span>
            <Badge variant="outline" className="text-[9px] h-5 border-border/30">{stats.total} services</Badge>
            {topoList.length > 0 && (
              <Badge variant="outline" className="text-[9px] h-5 border-indigo-500/20 text-indigo-400">{topoList.length} topologies</Badge>
            )}
            {stats.degraded > 0 && (
              <Badge className="text-[9px] h-5 bg-amber-500/10 text-amber-400 border-amber-500/15 gap-1">
                <AlertTriangle className="h-3 w-3" /> {stats.degraded} degraded
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[10px]"
              onClick={() => discoverMutation.mutate()}
              disabled={discoverMutation.isPending}
              data-testid="button-discover-apps"
            >
              {discoverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
              {discoverMutation.isPending ? "AI Discovering..." : "Discover Services"}
            </Button>
            {stats.total > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[10px]"
                  onClick={() => topoDiscoverMutation.mutate()}
                  disabled={topoDiscoverMutation.isPending}
                  data-testid="button-discover-topologies"
                >
                  {topoDiscoverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                  {topoDiscoverMutation.isPending ? "Mapping..." : "Map Topologies"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-[10px]"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending}
                  data-testid="button-refresh-health"
                >
                  {refreshMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {refreshMutation.isPending ? "Refreshing..." : "Refresh Health"}
                </Button>
              </>
            )}
          </div>
        </div>

        {stats.total > 0 && (
          <>
            <div className="flex items-center gap-1 border-b border-border/10 pb-2">
              {[
                { key: "topology" as const, label: "Business Applications", icon: Layers, count: topoList.length },
                { key: "services" as const, label: "Infrastructure Services", icon: AppWindow, count: stats.total },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveView(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                    activeView === tab.key
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/10"
                  }`}
                  data-testid={`tab-${tab.key}`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                  <Badge variant="outline" className="text-[7px] h-3.5 border-border/20 ml-0.5">{tab.count}</Badge>
                </button>
              ))}
            </div>

            {activeView === "services" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  <div className="p-2.5 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-center">
                    <p className="text-lg font-bold text-indigo-400" data-testid="stat-total">{stats.total}</p>
                    <p className="text-[9px] text-muted-foreground/50">Total Services</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10 text-center">
                    <p className="text-lg font-bold text-red-400" data-testid="stat-mission-critical">{stats.missionCritical}</p>
                    <p className="text-[9px] text-muted-foreground/50">Mission Critical</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <p className="text-lg font-bold text-emerald-400" data-testid="stat-running">{stats.running}</p>
                    <p className="text-[9px] text-muted-foreground/50">Running</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center">
                    <p className="text-lg font-bold text-amber-400" data-testid="stat-degraded">{stats.degraded}</p>
                    <p className="text-[9px] text-muted-foreground/50">Degraded</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/10 text-center">
                    <p className="text-lg font-bold text-red-400" data-testid="stat-stopped">{stats.stopped}</p>
                    <p className="text-[9px] text-muted-foreground/50">Stopped</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-center">
                    <p className="text-lg font-bold text-cyan-400" data-testid="stat-avg-health">{stats.avgHealth}%</p>
                    <p className="text-[9px] text-muted-foreground/50">Avg Health</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10 text-center">
                    <p className="text-lg font-bold text-purple-400" data-testid="stat-assets">{stats.assets}</p>
                    <p className="text-[9px] text-muted-foreground/50">Assets</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
                    <SelectTrigger className="h-7 text-[10px] w-[140px]" data-testid="select-criticality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Criticality</SelectItem>
                      <SelectItem value="mission_critical">Mission Critical</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="supporting">Supporting</SelectItem>
                      <SelectItem value="utility">Utility</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-7 text-[10px] w-[110px]" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="degraded">Degraded</SelectItem>
                      <SelectItem value="stopped">Stopped</SelectItem>
                    </SelectContent>
                  </Select>
                  {assetOptions.length > 1 && (
                    <Select value={assetFilter} onValueChange={setAssetFilter}>
                      <SelectTrigger className="h-7 text-[10px] w-[160px]" data-testid="select-asset">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Assets</SelectItem>
                        {assetOptions.map(a => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <span className="text-[10px] text-muted-foreground/40 ml-auto">
                    Showing {filteredApps.length} of {stats.total} services
                  </span>
                </div>

                <div className="space-y-3">
                  {groupedApps.map(({ assetId, asset, apps: assetApps }) => {
                    const assetName = asset?.name || "Unknown Asset";
                    const missionCriticalCount = assetApps.filter(a => a.criticality === "mission_critical").length;
                    const degradedCount = assetApps.filter(a => a.status === "degraded" || a.status === "stopped").length;

                    return (
                      <Card key={assetId} className="overflow-hidden" data-testid={`asset-group-${assetId}`}>
                        <div className="px-3 py-2 border-b border-border/20 bg-muted/5">
                          <div className="flex items-center gap-2">
                            <Server className="h-3.5 w-3.5 text-muted-foreground/50" />
                            <span className="text-xs font-semibold">{assetName}</span>
                            {asset?.type && (
                              <Badge variant="outline" className="text-[7px] h-3.5 border-border/20">{asset.type}</Badge>
                            )}
                            {asset?.ipAddress && (
                              <span className="text-[9px] text-muted-foreground/30">{asset.ipAddress}</span>
                            )}
                            <span className="text-[9px] text-muted-foreground/30 ml-auto">{assetApps.length} service{assetApps.length !== 1 ? "s" : ""}</span>
                            {missionCriticalCount > 0 && (
                              <Badge className="text-[7px] h-3.5 bg-red-500/10 text-red-400 border-red-500/15">{missionCriticalCount} critical</Badge>
                            )}
                            {degradedCount > 0 && (
                              <Badge className="text-[7px] h-3.5 bg-amber-500/10 text-amber-400 border-amber-500/15">{degradedCount} issue{degradedCount !== 1 ? "s" : ""}</Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          {assetApps.map(app => (
                            <ApplicationCard
                              key={app.id}
                              app={app}
                              assetName={assetName}
                              expanded={expandedApp === app.id}
                              onToggle={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                            />
                          ))}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            {activeView === "topology" && (
              <>
                {topoList.length === 0 ? (
                  <Card className="overflow-hidden">
                    <CardContent className="p-10 text-center">
                      <Layers className="h-12 w-12 mx-auto text-indigo-400/20 mb-4" />
                      <p className="text-sm font-semibold mb-1">No Application Topologies Mapped</p>
                      <p className="text-xs text-muted-foreground/50 max-w-md mx-auto mb-4">
                        The AI will analyze your discovered services and assets to identify business-level applications (ERP, CRM, Email, etc.) that span multiple devices. It maps which assets compose each application, identifies single points of failure, and predicts cascade failure scenarios.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => topoDiscoverMutation.mutate()}
                        disabled={topoDiscoverMutation.isPending}
                        data-testid="button-discover-topologies-empty"
                      >
                        {topoDiscoverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
                        {topoDiscoverMutation.isPending ? "AI Mapping Topologies..." : "Map Business Application Topologies"}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {topoList.map(topo => (
                      <TopologyCard
                        key={topo.id}
                        topo={topo}
                        assetMap={assetMap}
                        apps={apps || []}
                        alerts={alerts || []}
                        notifications={notifications || []}
                        expanded={expandedTopo === topo.id}
                        onToggle={() => setExpandedTopo(expandedTopo === topo.id ? null : topo.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {stats.total === 0 && (
          <Card className="overflow-hidden">
            <CardContent className="p-10 text-center">
              <Brain className="h-12 w-12 mx-auto text-indigo-400/20 mb-4" />
              <p className="text-sm font-semibold mb-1">No Applications Discovered</p>
              <p className="text-xs text-muted-foreground/50 max-w-md mx-auto mb-4">
                The AI agents will analyze all your discovered assets and intelligently identify every application, service, and process running across your infrastructure — classifying each by business criticality (CRM, ERP, Core Banking, HRIS, etc.) and monitoring health in real-time.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => discoverMutation.mutate()}
                disabled={discoverMutation.isPending}
                data-testid="button-discover-apps-empty"
              >
                {discoverMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                {discoverMutation.isPending ? "AI Analyzing Assets..." : "Discover Applications"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
