import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ServiceCatalogItem } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, KeyRound, Download, Monitor, Globe, Mail, ShieldCheck, Server, Clock, CheckCircle2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const iconMap: Record<string, typeof UserPlus> = {
  UserPlus, KeyRound, Download, Monitor, Globe, Mail, ShieldCheck, Server,
};

function CatalogCard({ item }: { item: ServiceCatalogItem }) {
  const IconComp = iconMap[item.icon] || Server;
  const { toast } = useToast();

  const requestMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/service-requests", {
      title: `Request: ${item.name}`,
      description: `Service catalog request for "${item.name}". ${item.description}`,
      type: item.category.toLowerCase().replace(/\s+/g, "_"),
      priority: "medium",
      status: "pending",
      catalogItemId: item.id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests"] });
      toast({ title: "Service request submitted", description: `Your request for "${item.name}" has been created and assigned to the Service Desk.` });
    },
    onError: () => {
      toast({ title: "Failed to submit request", variant: "destructive" });
    },
  });

  return (
    <Card className="border border-border transition-shadow hover:shadow-md" data-testid={`card-catalog-${item.id}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <IconComp className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm mb-1" data-testid={`text-catalog-name-${item.id}`}>{item.name}</h3>
            <p className="text-xs text-muted-foreground mb-3">{item.description}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">{item.category}</Badge>
              {item.estimatedTime && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />{item.estimatedTime}
                </span>
              )}
              {item.slaTarget && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />SLA: {item.slaTarget}
                </span>
              )}
              {item.approvalRequired && (
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">Approval Required</Badge>
              )}
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => requestMutation.mutate()}
            disabled={requestMutation.isPending}
            data-testid={`button-request-${item.id}`}
          >
            {requestMutation.isPending ? "Submitting..." : "Request"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ServiceCatalog() {
  const { data: items, isLoading } = useQuery<ServiceCatalogItem[]>({ queryKey: ["/api/service-catalog"] });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const categories = [...new Set(items?.map(i => i.category) ?? [])];
  const filtered = items?.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === "all" || i.category === categoryFilter;
    return matchSearch && matchCategory;
  }) ?? [];

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const showingTo = Math.min((safePage + 1) * PAGE_SIZE, filtered.length);

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Service Catalog</h1>
        <p className="text-sm text-muted-foreground">Browse and request IT services available to your organization</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search services..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-search-catalog" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={categoryFilter === "all" ? "default" : "outline"} onClick={() => { setCategoryFilter("all"); setPage(0); }} data-testid="button-filter-all">All</Button>
          {categories.map(cat => (
            <Button key={cat} size="sm" variant={categoryFilter === cat ? "default" : "outline"} onClick={() => { setCategoryFilter(cat); setPage(0); }} data-testid={`button-filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}>
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{filtered.length} services available</CardTitle>
        </CardHeader>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {paginatedItems.map(item => <CatalogCard key={item.id} item={item} />)}
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 md:col-span-2">No services found</p>}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t pt-4" data-testid="pagination-footer">
          <span className="text-sm text-muted-foreground" data-testid="text-showing-count">
            Showing {showingFrom}–{showingTo} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              disabled={safePage === 0}
              onClick={() => setPage(p => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i}
                size="sm"
                variant={safePage === i ? "default" : "outline"}
                onClick={() => setPage(i)}
                data-testid={`button-page-${i}`}
              >
                {i + 1}
              </Button>
            ))}
            <Button
              size="icon"
              variant="outline"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
