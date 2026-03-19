import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { SeverityBadge } from "./dashboard";
import type { SecurityEvent } from "@shared/schema";

export default function SecurityEvents() {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data: events, isLoading } = useQuery<SecurityEvent[]>({
    queryKey: ["/api/security-events"],
  });

  const filtered = events?.filter(ev => {
    const matchSearch = !search || ev.message.toLowerCase().includes(search.toLowerCase()) || ev.source.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === "all" || ev.severity === severityFilter;
    return matchSearch && matchSeverity;
  }) ?? [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedEvents = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const severityCounts = events?.reduce((acc, ev) => {
    acc[ev.severity] = (acc[ev.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-security-title">
          Security Events
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time security event monitoring and analysis
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["critical", "high", "medium", "low"].map(sev => (
          <Card
            key={sev}
            className={`cursor-pointer hover-elevate ${severityFilter === sev ? "ring-1 ring-primary" : ""}`}
            onClick={() => { setSeverityFilter(f => f === sev ? "all" : sev); setPage(0); }}
            data-testid={`filter-severity-${sev}`}
          >
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{severityCounts[sev] ?? 0}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{sev}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search events by message or source..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
            data-testid="input-search-events"
          />
        </div>
        {severityFilter !== "all" && (
          <Badge
            variant="secondary"
            className="cursor-pointer"
            onClick={() => { setSeverityFilter("all"); setPage(0); }}
            data-testid="badge-clear-filter"
          >
            {severityFilter} &times;
          </Badge>
        )}
      </div>

      <Card data-testid="card-events-list">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Event Log
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">{filtered.length} events</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No events match your criteria</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {paginatedEvents.map(ev => (
                <div key={ev.id} className="px-5 py-4" data-testid={`event-item-${ev.id}`}>
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-medium uppercase tracking-wider text-muted-foreground">
                        {ev.eventType.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">&middot;</span>
                      <span className="text-xs text-muted-foreground">{ev.source}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SeverityBadge severity={ev.severity} />
                      <Badge variant={ev.processed ? "secondary" : "outline"} className="text-[10px]">
                        {ev.processed ? "Processed" : "Pending"}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90">{ev.message}</p>
                  {ev.createdAt && (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {new Date(ev.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2 border-t px-5 py-3" data-testid="pagination-footer">
              <span className="text-xs text-muted-foreground" data-testid="text-pagination-info">
                Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <Button
                    key={i}
                    variant={safePage === i ? "default" : "outline"}
                    size="icon"
                    onClick={() => setPage(i)}
                    data-testid={`button-page-${i}`}
                  >
                    {i + 1}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
