import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot, Shield, Router, Server, Wifi, Radio, Cpu, Camera,
  Thermometer, Gauge, Network, Globe, Building, Key, Radar,
  CheckCircle2, XCircle, HelpCircle, MonitorSmartphone,
  ChevronDown, ChevronRight, Users,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { DiscoveredAsset, DiscoveryProbe, DiscoveryCredential, OrgRole, RoleSubscription, Crew } from "@shared/schema";

const typeConfig: Record<string, { label: string; icon: typeof Router; color: string }> = {
  router: { label: "Router", icon: Router, color: "text-blue-400 bg-blue-500/10" },
  switch: { label: "Switch", icon: Network, color: "text-cyan-400 bg-cyan-500/10" },
  firewall: { label: "Firewall", icon: Shield, color: "text-red-400 bg-red-500/10" },
  server: { label: "Server", icon: Server, color: "text-purple-400 bg-purple-500/10" },
  access_point: { label: "Access Point", icon: Wifi, color: "text-green-400 bg-green-500/10" },
  gateway: { label: "Gateway", icon: Globe, color: "text-indigo-400 bg-indigo-500/10" },
  iot_sensor: { label: "IoT Sensor", icon: Radio, color: "text-amber-400 bg-amber-500/10" },
  plc: { label: "PLC", icon: Cpu, color: "text-orange-400 bg-orange-500/10" },
  hvac: { label: "HVAC", icon: Thermometer, color: "text-teal-400 bg-teal-500/10" },
  camera: { label: "Camera", icon: Camera, color: "text-pink-400 bg-pink-500/10" },
  meter: { label: "Meter", icon: Gauge, color: "text-lime-400 bg-lime-500/10" },
};

const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
  online: { color: "text-green-400", icon: CheckCircle2 },
  offline: { color: "text-red-400", icon: XCircle },
  unknown: { color: "text-muted-foreground", icon: HelpCircle },
};

interface AgentGroup {
  roleId: string;
  roleName: string;
  department: string;
  probes: Array<{
    probe: DiscoveryProbe;
    credential: DiscoveryCredential | undefined;
    assets: DiscoveredAsset[];
  }>;
  directAssets: DiscoveredAsset[];
  totalAssets: number;
  onlineAssets: number;
}

export default function NetworkOpsAgents() {
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  const { data: assets } = useQuery<DiscoveredAsset[]>({ queryKey: ["/api/discovered-assets"] });
  const { data: probes } = useQuery<DiscoveryProbe[]>({ queryKey: ["/api/discovery-probes"] });
  const { data: credentials } = useQuery<DiscoveryCredential[]>({ queryKey: ["/api/discovery-credentials"] });
  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });
  const { data: subscriptions } = useQuery<RoleSubscription[]>({ queryKey: ["/api/role-subscriptions"] });
  const { data: crews } = useQuery<Crew[]>({ queryKey: ["/api/crews"] });

  const agentGroups = useMemo(() => {
    if (!assets || !probes || !credentials || !roles || !subscriptions) return { agents: [] as AgentGroup[], unassigned: [] as DiscoveredAsset[] };

    const aiSubs = subscriptions.filter(s => s.hasAiShadow);
    const assignedAssetIds = new Set<string>();
    const groups: AgentGroup[] = [];

    for (const sub of aiSubs) {
      const role = roles.find(r => r.id === sub.roleId);
      if (!role) continue;

      const crew = crews?.find(c => c.id === role.crewId);
      const agentProbes = probes.filter(p => p.assignedAgentRoleId === role.id);
      const probeGroups = agentProbes.map(probe => {
        const cred = credentials.find(c => c.id === probe.credentialId);
        const probeAssets = assets.filter(a => a.probeId === probe.id && a.assignedAgentRoleId === role.id);
        probeAssets.forEach(a => assignedAssetIds.add(a.id));
        return { probe, credential: cred, assets: probeAssets };
      });

      const directAssets = assets.filter(a => a.assignedAgentRoleId === role.id && !assignedAssetIds.has(a.id));
      directAssets.forEach(a => assignedAssetIds.add(a.id));

      const totalAssets = probeGroups.reduce((s, pg) => s + pg.assets.length, 0) + directAssets.length;
      const onlineAssets = probeGroups.reduce((s, pg) => s + pg.assets.filter(a => a.status === "online").length, 0) + directAssets.filter(a => a.status === "online").length;

      if (totalAssets > 0 || agentProbes.length > 0) {
        groups.push({
          roleId: role.id,
          roleName: role.name,
          department: crew?.name || "Unknown",
          probes: probeGroups,
          directAssets,
          totalAssets,
          onlineAssets,
        });
      }
    }

    const unassigned = assets.filter(a => !assignedAssetIds.has(a.id));
    return { agents: groups, unassigned };
  }, [assets, probes, credentials, roles, subscriptions, crews]);

  const toggleAgent = (roleId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const totalManagedAssets = agentGroups.agents.reduce((s, g) => s + g.totalAssets, 0);
  const totalAgents = agentGroups.agents.length;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Agents</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-active-agents">{totalAgents}</p>
              <p className="text-[10px] text-muted-foreground">with discovery tasks</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MonitorSmartphone className="h-4 w-4 text-blue-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Managed</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-managed-assets">{totalManagedAssets}</p>
              <p className="text-[10px] text-muted-foreground">assets under agents</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Radar className="h-4 w-4 text-green-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Probes</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-active-probes">{probes?.length ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">discovery probes</p>
            </CardContent>
          </Card>
          <Card className="stat-card-gradient">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <HelpCircle className="h-4 w-4 text-amber-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Unassigned</span>
              </div>
              <p className="text-2xl font-bold" data-testid="stat-unassigned-assets">{agentGroups.unassigned.length}</p>
              <p className="text-[10px] text-muted-foreground">need agent assignment</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {agentGroups.agents.map(group => {
            const isExpanded = expandedAgents.has(group.roleId);
            return (
              <Card key={group.roleId} className="overflow-hidden" data-testid={`agent-group-${group.roleId}`}>
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => toggleAgent(group.roleId)}
                  data-testid={`toggle-agent-${group.roleId}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold" data-testid={`agent-name-${group.roleId}`}>{group.roleName}</h3>
                      <Badge variant="outline" className="text-[9px]">{group.department}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Radar className="h-2.5 w-2.5" /> {group.probes.length} probes
                      </span>
                      <span className="flex items-center gap-1">
                        <MonitorSmartphone className="h-2.5 w-2.5" /> {group.totalAssets} assets
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5 text-green-400" /> {group.onlineAssets} online
                      </span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="border-t border-border/30">
                    {group.probes.map(pg => (
                      <div key={pg.probe.id} className="border-b border-border/20 last:border-b-0">
                        <div className="flex items-center gap-3 px-4 py-2 bg-muted/10">
                          <Radar className="h-3.5 w-3.5 text-blue-400" />
                          <span className="text-xs font-medium" data-testid={`probe-name-in-agent-${pg.probe.id}`}>{pg.probe.name}</span>
                          {pg.credential && (
                            <Badge variant="outline" className="text-[8px] gap-1">
                              <Key className="h-2 w-2" /> {pg.credential.name}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[8px] ml-auto">
                            {pg.assets.length} assets
                          </Badge>
                        </div>
                        <div className="divide-y divide-border/20">
                          {pg.assets.map(asset => {
                            const tc = typeConfig[asset.type] || typeConfig.server;
                            const TypeIcon = tc.icon;
                            const sc = statusConfig[asset.status] || statusConfig.unknown;
                            const StatusIcon = sc.icon;
                            return (
                              <div key={asset.id} className="flex items-center gap-3 px-6 py-2 hover:bg-muted/10" data-testid={`agent-asset-${asset.id}`}>
                                <div className={`flex h-6 w-6 items-center justify-center rounded ${tc.color}`}>
                                  <TypeIcon className="h-3 w-3" />
                                </div>
                                <span className="text-xs font-medium flex-1 truncate" data-testid={`agent-asset-name-${asset.id}`}>{asset.name}</span>
                                <span className="text-[10px] text-muted-foreground">{asset.ipAddress}</span>
                                <Badge variant="outline" className="text-[8px]">{tc.label}</Badge>
                                <StatusIcon className={`h-3 w-3 ${sc.color}`} />
                              </div>
                            );
                          })}
                          {pg.assets.length === 0 && (
                            <div className="px-6 py-3 text-[10px] text-muted-foreground/50 text-center">
                              No assets discovered by this probe yet
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {group.directAssets.length > 0 && (
                      <div className="border-t border-border/20">
                        <div className="flex items-center gap-3 px-4 py-2 bg-muted/10">
                          <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">Directly Assigned Assets</span>
                          <Badge variant="outline" className="text-[8px] ml-auto">
                            {group.directAssets.length} assets
                          </Badge>
                        </div>
                        <div className="divide-y divide-border/20">
                          {group.directAssets.map(asset => {
                            const tc = typeConfig[asset.type] || typeConfig.server;
                            const TypeIcon = tc.icon;
                            const sc = statusConfig[asset.status] || statusConfig.unknown;
                            const StatusIcon = sc.icon;
                            return (
                              <div key={asset.id} className="flex items-center gap-3 px-6 py-2 hover:bg-muted/10" data-testid={`direct-asset-${asset.id}`}>
                                <div className={`flex h-6 w-6 items-center justify-center rounded ${tc.color}`}>
                                  <TypeIcon className="h-3 w-3" />
                                </div>
                                <span className="text-xs font-medium flex-1 truncate">{asset.name}</span>
                                <span className="text-[10px] text-muted-foreground">{asset.ipAddress}</span>
                                <Badge variant="outline" className="text-[8px]">{tc.label}</Badge>
                                <StatusIcon className={`h-3 w-3 ${sc.color}`} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {agentGroups.unassigned.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-amber-400" />
              Unassigned Assets
              <Badge variant="outline" className="text-[9px] ml-1">{agentGroups.unassigned.length}</Badge>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agentGroups.unassigned.map(asset => {
                const tc = typeConfig[asset.type] || typeConfig.server;
                const TypeIcon = tc.icon;
                const sc = statusConfig[asset.status] || statusConfig.unknown;
                const StatusIcon = sc.icon;
                return (
                  <Card key={asset.id} className="border-amber-500/20" data-testid={`unassigned-asset-${asset.id}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${tc.color}`}>
                          <TypeIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-semibold truncate">{asset.name}</h4>
                            <StatusIcon className={`h-3 w-3 shrink-0 ${sc.color}`} />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[8px]">{tc.label}</Badge>
                            {asset.ipAddress && <span className="text-[10px] text-muted-foreground">{asset.ipAddress}</span>}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
