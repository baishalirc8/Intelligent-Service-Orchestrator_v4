import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertKnowledgeArticleSchema } from "@shared/schema";
import type { KnowledgeArticle } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BookOpen, Eye, ThumbsUp, Search, Tag, Plus, FileText,
  FolderOpen, TrendingUp, ChevronLeft, ChevronRight, Pencil,
  Inbox, Filter, CheckCircle2, Clock
} from "lucide-react";
import { useState } from "react";

const PAGE_SIZE = 10;

const CATEGORIES = [
  "Firewall", "Networking", "Security", "Database", "Server",
  "Identity & Access", "Email & Messaging", "Cloud", "Storage",
  "Endpoint", "Compliance", "ITSM Process", "General"
];

const createArticleSchema = insertKnowledgeArticleSchema.extend({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  tags: z.string().optional(),
  status: z.string().default("published"),
});

type CreateArticleForm = z.infer<typeof createArticleSchema>;

function KpiCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle?: string; icon: any; color: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400" data-testid={`badge-status-${status}`}>
        <CheckCircle2 className="h-3 w-3" />
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-400" data-testid={`badge-status-${status}`}>
      <Clock className="h-3 w-3" />
      Draft
    </span>
  );
}

function ArticleCard({ article, onView, onEdit }: {
  article: KnowledgeArticle;
  onView: (id: string) => void;
  onEdit: (article: KnowledgeArticle) => void;
}) {
  const { toast } = useToast();

  const helpfulMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/knowledge/${article.id}/helpful`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({ title: "Thank you for your feedback!" });
    },
  });

  return (
    <Card className="border-border/50" data-testid={`card-article-${article.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onView(article.id)}>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-medium text-sm" data-testid={`text-article-title-${article.id}`}>{article.title}</h3>
              <StatusBadge status={article.status} />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{article.content.substring(0, 150)}...</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">{article.category}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />{article.viewCount} views
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />{article.helpfulCount} helpful
              </span>
              {article.tags && article.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" onClick={() => helpfulMutation.mutate()} disabled={helpfulMutation.isPending} data-testid={`button-helpful-${article.id}`}>
              <ThumbsUp className="h-3 w-3 mr-1" />Helpful
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onEdit(article)} data-testid={`button-edit-article-${article.id}`}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onView(article.id)} data-testid={`button-view-article-${article.id}`}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ArticleDetailDialog({ articleId, open, onClose }: {
  articleId: string | null; open: boolean; onClose: () => void;
}) {
  const { data: article } = useQuery<KnowledgeArticle>({
    queryKey: ["/api/knowledge", articleId],
    enabled: !!articleId && open,
  });

  if (!article) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {article.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={article.status} />
            <Badge variant="secondary">{article.category}</Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />{article.viewCount} views
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />{article.helpfulCount} helpful
            </span>
          </div>
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">
                  <Tag className="h-2.5 w-2.5 mr-1" />{tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed" data-testid={`text-article-content-${article.id}`}>
            {article.content}
          </div>
          <div className="text-xs text-muted-foreground">
            Last updated: {article.updatedAt ? new Date(article.updatedAt).toLocaleDateString() : "N/A"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateEditDialog({ open, onOpenChange, editArticle }: {
  open: boolean; onOpenChange: (open: boolean) => void; editArticle: KnowledgeArticle | null;
}) {
  const { toast } = useToast();
  const isEdit = !!editArticle;

  const form = useForm<CreateArticleForm>({
    resolver: zodResolver(createArticleSchema),
    defaultValues: {
      title: editArticle?.title ?? "",
      content: editArticle?.content ?? "",
      category: editArticle?.category ?? "",
      tags: editArticle?.tags?.join(", ") ?? "",
      status: editArticle?.status ?? "published",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateArticleForm) => {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      };
      if (isEdit && editArticle) {
        await apiRequest("PATCH", `/api/knowledge/${editArticle.id}`, payload);
      } else {
        await apiRequest("POST", "/api/knowledge", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      onOpenChange(false);
      form.reset();
      toast({ title: isEdit ? "Article updated" : "Article created", description: isEdit ? "The article has been updated." : "The article has been published to the knowledge base." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); form.reset(); } else { onOpenChange(true); } }}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Article" : "Create Article"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl><Input {...field} placeholder="Article title" data-testid="input-article-title" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl><Textarea {...field} className="resize-none min-h-[160px]" placeholder="Article content..." data-testid="input-article-content" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-article-category"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-article-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="tags" render={({ field }) => (
              <FormItem>
                <FormLabel>Tags (comma separated)</FormLabel>
                <FormControl><Input {...field} placeholder="e.g. firewall, vpn, security" data-testid="input-article-tags" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-article">
              {createMutation.isPending ? (isEdit ? "Updating..." : "Creating...") : (isEdit ? "Update Article" : "Create Article")}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function KnowledgeBase() {
  const { data: articles, isLoading } = useQuery<KnowledgeArticle[]>({ queryKey: ["/api/knowledge"] });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<KnowledgeArticle | null>(null);
  const [viewArticleId, setViewArticleId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const categories = Array.from(new Set(articles?.map(a => a.category) ?? [])).sort();
  const published = articles?.filter(a => a.status === "published").length ?? 0;
  const drafts = articles?.filter(a => a.status === "draft").length ?? 0;
  const totalViews = articles?.reduce((sum, a) => sum + (a.viewCount || 0), 0) ?? 0;
  const mostHelpful = articles?.reduce((best, a) => (a.helpfulCount > (best?.helpfulCount ?? 0) ? a : best), articles[0] as KnowledgeArticle | undefined);

  const filtered = (articles ?? []).filter(a => {
    const matchSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.toLowerCase().includes(search.toLowerCase()) ||
      (a.tags && a.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));
    const matchCategory = categoryFilter === "all" || a.category === categoryFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchCategory && matchStatus;
  }).sort((a, b) => {
    return new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleEdit = (article: KnowledgeArticle) => {
    setEditArticle(article);
    setCreateDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) setEditArticle(null);
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">Solutions, guides, and documentation for common IT issues</p>
        </div>
        <Button onClick={() => { setEditArticle(null); setCreateDialogOpen(true); }} data-testid="button-create-article">
          <Plus className="h-4 w-4 mr-2" />
          New Article
        </Button>
      </div>

      {!isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="kpi-grid">
          <KpiCard title="Total Articles" value={articles?.length ?? 0} subtitle={`${categories.length} categories`} icon={BookOpen} color="bg-teal-500/15 text-teal-400" />
          <KpiCard title="Published" value={published} subtitle="Active articles" icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" />
          <KpiCard title="Draft" value={drafts} subtitle="In progress" icon={FileText} color="bg-amber-500/15 text-amber-400" />
          <KpiCard title="Categories" value={categories.length} subtitle="Topic areas" icon={FolderOpen} color="bg-blue-500/15 text-blue-400" />
          <KpiCard title="Total Views" value={totalViews} subtitle="All-time reads" icon={Eye} color="bg-purple-500/15 text-purple-400" />
          <KpiCard title="Most Helpful" value={mostHelpful ? `${mostHelpful.helpfulCount}` : "0"} subtitle={mostHelpful?.title ? mostHelpful.title.substring(0, 20) + "..." : "N/A"} icon={ThumbsUp} color="bg-green-500/15 text-green-400" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={categoryFilter === "all" ? "default" : "outline"} onClick={() => { setCategoryFilter("all"); setPage(0); }} data-testid="button-filter-all">All</Button>
        {categories.map(cat => (
          <Button key={cat} size="sm" variant={categoryFilter === cat ? "default" : "outline"} onClick={() => { setCategoryFilter(cat); setPage(0); }} data-testid={`button-filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}>
            {cat}
          </Button>
        ))}
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search articles by title, content, or tags..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" data-testid="input-search-kb" />
              </div>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="text-[10px]">{filtered.length} articles</Badge>
          </div>

          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
          ) : paginatedItems.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No articles match your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedItems.map(article => (
                <ArticleCard key={article.id} article={article} onView={setViewArticleId} onEdit={handleEdit} />
              ))}
            </div>
          )}

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 border-t pt-3" data-testid="pagination-footer">
              <span className="text-xs text-muted-foreground" data-testid="text-showing-range">
                Showing {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" disabled={safePage === 0} onClick={() => setPage(p => p - 1)} data-testid="button-prev-page">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-3">{safePage + 1}/{totalPages}</span>
                <Button size="icon" variant="outline" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-next-page">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateEditDialog open={createDialogOpen} onOpenChange={handleCloseDialog} editArticle={editArticle} />
      <ArticleDetailDialog articleId={viewArticleId} open={!!viewArticleId} onClose={() => setViewArticleId(null)} />
    </div>
  );
}