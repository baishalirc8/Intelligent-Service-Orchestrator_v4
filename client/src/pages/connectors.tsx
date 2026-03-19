import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  Network,
  Terminal,
  Monitor,
  Globe,
  Cpu,
  FileText,
  Server,
  Wifi,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  ShieldCheck,
  Radio,
  Search,
} from "lucide-react";

const PAGE_SIZE = 10;
import type { Connector, AiAgent } from "@shared/schema";

const protocolIcons: Record<string, React.ElementType> = {
  snmp: Network,
  ssh: Terminal,
  wmi: Monitor,
  rest_api: Globe,
  mqtt: Cpu,
  syslog: FileText,
  netflow: Radio,
};

const protocolColors: Record<string, string> = {
  snmp: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  ssh: "bg-green-500/15 text-green-600 dark:text-green-400",
  wmi: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  rest_api: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  mqtt: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  syslog: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  netflow: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/15 text-green-600 dark:text-green-400",
  configured: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  error: "bg-red-500/15 text-red-600 dark:text-red-400",
  disabled: "bg-gray-500/15 text-gray-400",
};

function ConnectorCard({ connector, agents }: { connector: Connector; agents: AiAgent[] }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = protocolIcons[connector.protocol] || Server;
  const agent = agents.find(a => a.id === connector.agentId);
  const meta = connector.metadata as Record<string, any> | null;

  return (
    <Card className="hover-elevate" data-testid={`card-connector-${connector.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${protocolColors[connector.protocol] || "bg-gray-500/15 text-gray-400"}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{connector.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {connector.host}:{connector.port}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] ${protocolColors[connector.protocol]}`} data-testid={`badge-protocol-${connector.id}`}>
              {connector.protocol.toUpperCase()}
            </Badge>
            <Badge variant="outline" className={`text-[10px] ${statusColors[connector.status]}`} data-testid={`badge-status-${connector.id}`}>
              {connector.status === "active" && <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1" />}
              {connector.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Discovered</span>
            <p className="text-lg font-bold" data-testid={`text-discovered-${connector.id}`}>{connector.discoveredAssets}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Credential</span>
            <p className="text-xs font-medium flex items-center gap-1 mt-1">
              <ShieldCheck className="h-3 w-3 text-green-500" />
              {connector.credentialType.replace(/_/g, " ")}
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Scan Interval</span>
            <p className="text-xs font-medium flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {(connector.scanInterval ?? 0) === 0 ? "Real-time" : `${connector.scanInterval}m`}
            </p>
          </div>
        </div>

        {agent && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t">
            <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
              {agent.name.charAt(0)}
            </div>
            <span className="text-xs text-muted-foreground">Managed by <span className="font-medium text-foreground">{agent.name}</span></span>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground mt-3 w-full"
          data-testid={`button-expand-connector-${connector.id}`}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Hide" : "Show"} connection details
        </button>

        {expanded && meta && (
          <div className="mt-3 pt-3 border-t space-y-2">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">Connection Metadata</p>
            {connector.credentialRef && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Credential Ref:</span>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{connector.credentialRef}</code>
              </div>
            )}
            {Object.entries(meta).map(([key, val]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground capitalize whitespace-nowrap">{key.replace(/([A-Z])/g, " $1")}:</span>
                <span className="font-medium break-all">
                  {Array.isArray(val) ? val.join(", ") : typeof val === "object" ? JSON.stringify(val) : String(val)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Connectors() {
  const { data: connectors, isLoading } = useQuery<Connector[]>({ queryKey: ["/api/connectors"] });
  const { data: agents } = useQuery<AiAgent[]>({ queryKey: ["/api/agents"] });
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  const protocols = [...new Set(connectors?.map(c => c.protocol) ?? [])];
  const filtered = (filter === "all" ? connectors : connectors?.filter(c => c.protocol === filter))?.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.host.toLowerCase().includes(q) || c.protocol.toLowerCase().includes(q);
  }) ?? [];
  const totalDiscovered = connectors?.reduce((sum, c) => sum + (c.discoveredAssets || 0), 0) ?? 0;
  const activeCount = connectors?.filter(c => c.status === "active").length ?? 0;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Infrastructure Connectors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoring protocol connections — AI agents use these to discover and manage your infrastructure
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1.5" data-testid="badge-total-discovered">
            <Wifi className="h-3 w-3" />
            {totalDiscovered} assets discovered
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            {activeCount} active
          </Badge>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search connectors..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          className="pl-9"
          data-testid="input-search-connectors"
        />
      </div>

      <div className="flex gap-2 flex-wrap" data-testid="connector-protocol-filters">
        <button
          onClick={() => { setFilter("all"); setPage(0); }}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          data-testid="filter-all"
        >
          All ({connectors?.length ?? 0})
        </button>
        {protocols.map(p => {
          const count = connectors?.filter(c => c.protocol === p).length ?? 0;
          return (
            <button
              key={p}
              onClick={() => { setFilter(p); setPage(0); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              data-testid={`filter-${p}`}
            >
              {p.toUpperCase()} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {paged.map(c => (
          <ConnectorCard key={c.id} connector={c} agents={agents ?? []} />
        ))}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-3 py-2 border rounded-md border-border/30 bg-muted/10">
          <span className="text-[10px] text-muted-foreground" data-testid="text-connectors-showing">
            Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              data-testid="connectors-page-prev"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i}
                size="icon"
                variant={i === safePage ? "default" : "ghost"}
                className="h-6 w-6 text-[10px]"
                onClick={() => setPage(i)}
                data-testid={`connectors-page-${i}`}
              >
                {i + 1}
              </Button>
            ))}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
              data-testid="connectors-page-next"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
