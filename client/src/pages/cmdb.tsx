import { useQuery } from "@tanstack/react-query";
import type { CmdbItem, CmdbRelationship } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Server, Database, Shield, Globe, Network, HardDrive, Monitor, Search, ArrowRight, Link2, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const typeIcons: Record<string, typeof Server> = {
  "Firewall": Shield,
  "Database Server": Database,
  "Mail Gateway": Globe,
  "SIEM Platform": Monitor,
  "Web Server": Server,
  "VPN Gateway": Network,
  "DNS Server": Globe,
  "Backup Server": HardDrive,
};

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  decommissioned: "bg-red-500/10 text-red-500 border-red-500/20",
  retired: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const envColors: Record<string, string> = {
  production: "bg-red-500/10 text-red-500 border-red-500/20",
  staging: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  development: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

function CmdbCard({ item }: { item: CmdbItem }) {
  const IconComp = typeIcons[item.type] || Server;
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="border border-border" data-testid={`card-cmdb-${item.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconComp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-mono font-semibold text-sm" data-testid={`text-cmdb-name-${item.id}`}>{item.name}</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowDetails(!showDetails)} data-testid={`button-details-${item.id}`}>
                {showDetails ? "Less" : "Details"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">{item.type}</Badge>
              <Badge variant="outline" className={statusColors[item.status]}>{item.status}</Badge>
              <Badge variant="outline" className={envColors[item.environment] || ""}>{item.environment}</Badge>
            </div>

            {showDetails && (
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {item.ipAddress && <div><span className="text-muted-foreground">IP:</span> <span className="font-mono">{item.ipAddress}</span></div>}
                {item.osVersion && <div><span className="text-muted-foreground">OS:</span> {item.osVersion}</div>}
                {item.manufacturer && <div><span className="text-muted-foreground">Mfr:</span> {item.manufacturer}</div>}
                {item.model && <div><span className="text-muted-foreground">Model:</span> {item.model}</div>}
                {item.owner && <div><span className="text-muted-foreground">Owner:</span> {item.owner}</div>}
                {item.location && <div><span className="text-muted-foreground">Location:</span> {item.location}</div>}
                {item.serialNumber && <div className="col-span-2"><span className="text-muted-foreground">S/N:</span> <span className="font-mono">{item.serialNumber}</span></div>}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Cmdb() {
  const { data: items, isLoading: itemsLoading } = useQuery<CmdbItem[]>({ queryKey: ["/api/cmdb"] });
  const { data: relationships } = useQuery<CmdbRelationship[]>({ queryKey: ["/api/cmdb-relationships"] });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const types = [...new Set(items?.map(i => i.type) ?? [])];
  const filtered = items?.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase()) || (i.ipAddress && i.ipAddress.includes(search));
    const matchType = typeFilter === "all" || i.type === typeFilter;
    return matchSearch && matchType;
  }) ?? [];

  const itemNameMap = new Map(items?.map(i => [i.id, i.name]) ?? []);

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Configuration Management Database</h1>
        <p className="text-sm text-muted-foreground">IT assets, configuration items, relationships, and infrastructure dependencies</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Server className="h-5 w-5 text-amber-500" /></div>
          <div><p className="text-2xl font-bold" data-testid="text-total-cis">{items?.length ?? 0}</p><p className="text-xs text-muted-foreground">Configuration Items</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Link2 className="h-5 w-5 text-blue-500" /></div>
          <div><p className="text-2xl font-bold" data-testid="text-total-rels">{relationships?.length ?? 0}</p><p className="text-xs text-muted-foreground">Relationships</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center"><Monitor className="h-5 w-5 text-green-500" /></div>
          <div><p className="text-2xl font-bold">{items?.filter(i => i.status === "active").length ?? 0}</p><p className="text-xs text-muted-foreground">Active CIs</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center"><Database className="h-5 w-5 text-purple-500" /></div>
          <div><p className="text-2xl font-bold">{types.length}</p><p className="text-xs text-muted-foreground">CI Types</p></div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, type, or IP..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-search-cmdb" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={typeFilter === "all" ? "default" : "outline"} onClick={() => { setTypeFilter("all"); setPage(0); }} data-testid="button-filter-all">All</Button>
          {types.map(t => (
            <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"} onClick={() => { setTypeFilter(t); setPage(0); }} data-testid={`button-filter-${t.toLowerCase().replace(/\s+/g, "-")}`}>
              {t}
            </Button>
          ))}
        </div>
      </div>

      {(() => {
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const safePage = Math.min(page, totalPages - 1);
        const paginatedItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
        const start = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
        const end = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

        return itemsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedItems.map(item => <CmdbCard key={item.id} item={item} />)}
              {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 md:col-span-2">No configuration items found</p>}
            </div>
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-4 pt-2" data-testid="pagination-footer">
                <span className="text-sm text-muted-foreground" data-testid="text-pagination-info">Showing {start}–{end} of {filtered.length}</span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" disabled={safePage === 0} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <Button key={i} size="sm" variant={safePage === i ? "default" : "outline"} onClick={() => setPage(i)} data-testid={`button-page-${i}`}>
                      {i + 1}
                    </Button>
                  ))}
                  <Button size="icon" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {relationships && relationships.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">CI Relationships</h2>
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                {relationships.map(rel => (
                  <div key={rel.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded" data-testid={`row-relationship-${rel.id}`}>
                    <Badge variant="secondary" className="font-mono text-xs">{itemNameMap.get(rel.sourceItemId) || "Unknown"}</Badge>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                      <span className="font-medium">{rel.relationshipType.replace(/_/g, " ")}</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">{itemNameMap.get(rel.targetItemId) || "Unknown"}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
