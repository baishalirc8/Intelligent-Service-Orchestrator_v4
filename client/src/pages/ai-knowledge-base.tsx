import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Database, Search, Plus, Trash2, FileText, Cpu, RefreshCw, Upload,
  BookOpen, Layers, Zap, CheckCircle2, AlertCircle, X, ChevronDown, ChevronRight,
  Brain, Sparkles, MessageSquare, SendHorizonal, Bot, User, BookMarked,
} from "lucide-react";

interface KnowledgeDocument {
  id: number;
  userId: string | null;
  title: string;
  sourceType: string;
  description: string | null;
  chunkCount: number;
  createdAt: string;
}

interface SearchResult {
  id: number;
  documentId: number;
  content: string;
  documentTitle: string;
  similarity: number;
}

interface ChatSource {
  documentTitle: string;
  similarity: number;
  excerpt: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  providerName?: string;
}

const SOURCE_TYPES = [
  { value: "text",      label: "Plain Text" },
  { value: "runbook",   label: "Runbook / SOP" },
  { value: "policy",    label: "Policy / Compliance" },
  { value: "incident",  label: "Incident History" },
  { value: "knowledge", label: "Knowledge Article" },
  { value: "technical", label: "Technical Documentation" },
  { value: "training",  label: "Training Data" },
];

const SOURCE_COLORS: Record<string, string> = {
  runbook:   "text-blue-400 border-blue-500/30",
  policy:    "text-violet-400 border-violet-500/30",
  incident:  "text-red-400 border-red-500/30",
  knowledge: "text-cyan-400 border-cyan-500/30",
  technical: "text-amber-400 border-amber-500/30",
  training:  "text-green-400 border-green-500/30",
  text:      "text-muted-foreground border-border",
};

export default function AiKnowledgeBasePage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // Ingest form
  const [title, setTitle]           = useState("");
  const [content, setContent]       = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState("text");
  const [showIngest, setShowIngest] = useState(false);

  // Search / Chat tab
  const [activeTab, setActiveTab]   = useState<"chat" | "search">("chat");

  // AI Chat
  const [chatInput, setChatInput]       = useState("");
  const [chatHistory, setChatHistory]   = useState<ChatMessage[]>([]);
  const [expandedSrc, setExpandedSrc]   = useState<number | null>(null);

  // Semantic Search
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  const { data: documents = [], isLoading, refetch } = useQuery<KnowledgeDocument[]>({
    queryKey: ["/api/ai-knowledge-base/documents"],
  });

  const ingestMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-knowledge-base/ingest", {
        title: title.trim(),
        content: content.trim(),
        description: description.trim() || undefined,
        sourceType,
      });
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/ai-knowledge-base/documents"] });
      toast({ title: "Document ingested", description: `"${data.title}" split into ${data.chunkCount} chunks and embedded.` });
      setTitle(""); setContent(""); setDescription(""); setSourceType("text");
      setShowIngest(false);
    },
    onError: (err: any) => toast({ title: "Ingest failed", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/ai-knowledge-base/documents/${id}`);
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai-knowledge-base/documents"] });
      toast({ title: "Document removed" });
    },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const chatMut = useMutation({
    mutationFn: async (query: string) => {
      const r = await apiRequest("POST", "/api/ai-knowledge-base/chat", { query });
      return r.json() as Promise<{ answer: string; sources: ChatSource[]; providerName: string }>;
    },
    onSuccess: (data, query) => {
      setChatHistory(prev => [
        ...prev,
        { role: "user", content: query },
        { role: "assistant", content: data.answer, sources: data.sources, providerName: data.providerName },
      ]);
      setChatInput("");
    },
    onError: (err: any) => toast({ title: "Chat failed", description: err.message, variant: "destructive" }),
  });

  const searchMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ai-knowledge-base/search", { query: searchQuery, limit: 6 });
      return r.json();
    },
    onSuccess: (data: SearchResult[]) => setSearchResults(data),
    onError: (err: any) => toast({ title: "Search failed", description: err.message, variant: "destructive" }),
  });

  const handleChat = () => {
    const q = chatInput.trim();
    if (!q || chatMut.isPending || documents.length === 0) return;
    chatMut.mutate(q);
  };

  const totalChunks = documents.reduce((s, d) => s + d.chunkCount, 0);

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-6xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-400 shrink-0" /> AI Knowledge Base
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
            Ingest runbooks, policies, and incident history. HOLOCRON AI semantically retrieves relevant passages and injects them into every AI call — no retraining required.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowIngest(v => !v)} className="w-full sm:w-auto shrink-0" data-testid="button-toggle-ingest">
          {showIngest ? <X className="h-3.5 w-3.5 mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          {showIngest ? "Cancel" : "Ingest Document"}
        </Button>
      </div>

      {/* ── How it works banner ─────────────────────────────────────────── */}
      <Card className="border-violet-500/30 bg-violet-500/5">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Upload,   label: "1. Ingest",   desc: "Paste runbooks, policies, SOPs, or incident history. Auto-chunked and embedded via OpenAI text-embedding-3-small." },
            { icon: Search,   label: "2. Retrieve", desc: "On every AI call, your question is embedded and the top-matching chunks are retrieved via PGVector cosine similarity (>35% threshold)." },
            { icon: Sparkles, label: "3. Ground",   desc: "Relevant passages are injected into the system prompt — dramatically reducing hallucinations about your actual environment." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex gap-3">
              <div className="h-8 w-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: FileText, label: "Documents",      value: documents.length,  accent: "text-foreground" },
          { icon: Layers,   label: "Embedded Chunks", value: totalChunks,       accent: "text-violet-400" },
          { icon: Cpu,      label: "Avg / Doc",       value: documents.length > 0 ? Math.round(totalChunks / documents.length) : 0, accent: "text-amber-400" },
        ].map(({ icon: Icon, label, value, accent }) => (
          <Card key={label} className="border-border">
            <CardContent className="p-2 sm:p-3 flex items-center gap-2">
              <Icon className={`h-4 w-4 shrink-0 ${accent} hidden sm:block`} />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{label}</p>
                <p className={`text-lg sm:text-xl font-bold leading-tight ${accent}`}>{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Ingest form (collapsible) ────────────────────────────────────── */}
      {showIngest && (
        <Card className="border-violet-500/30">
          <CardHeader className="pb-3 px-4 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4 text-violet-400" /> Ingest New Document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <Input
                  placeholder="e.g. Network Firewall Runbook v3.2"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  data-testid="input-doc-title"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Source Type</label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger data-testid="select-source-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <Input
                placeholder="Brief summary of what this document covers"
                value={description}
                onChange={e => setDescription(e.target.value)}
                data-testid="input-doc-description"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Content * (paste full text)</label>
              <Textarea
                placeholder="Paste the full text of your document here. HOLOCRON AI will automatically split it into semantic chunks (~1800 chars each) and embed each chunk..."
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={7}
                className="font-mono text-xs resize-y"
                data-testid="textarea-doc-content"
              />
              <p className="text-[10px] text-muted-foreground">
                ~{Math.ceil(Math.max(1, content.length) / 1800)} chunks estimated · {content.length.toLocaleString()} chars
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowIngest(false)} className="w-full sm:w-auto">Cancel</Button>
              <Button
                size="sm"
                onClick={() => ingestMut.mutate()}
                disabled={!title.trim() || !content.trim() || ingestMut.isPending}
                className="w-full sm:w-auto"
                data-testid="button-ingest-submit"
              >
                {ingestMut.isPending ? <RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-2" />}
                {ingestMut.isPending ? "Embedding…" : "Ingest & Embed"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── AI Chat + Semantic Search tabs ─────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "chat" | "search")}>
        <TabsList className="w-full sm:w-auto h-8">
          <TabsTrigger value="chat" className="text-xs flex-1 sm:flex-none gap-1.5" data-testid="tab-kb-chat">
            <MessageSquare className="h-3.5 w-3.5" /> Ask the KB
          </TabsTrigger>
          <TabsTrigger value="search" className="text-xs flex-1 sm:flex-none gap-1.5" data-testid="tab-kb-search">
            <Search className="h-3.5 w-3.5" /> Test Retrieval
          </TabsTrigger>
        </TabsList>

        {/* ── AI CHAT tab ─────────────────────────────────────────────────── */}
        <TabsContent value="chat" className="mt-3">
          <Card className="border-violet-500/30">
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-violet-400" /> Ask the Knowledge Base
                </CardTitle>
                {chatHistory.length > 0 && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground" onClick={() => setChatHistory([])}>
                    Clear chat
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <p className="text-xs text-muted-foreground">
                Ask any question — HOLOCRON AI will retrieve relevant passages from your knowledge base and answer with source citations grounded in your actual documents.
              </p>

              {/* Chat history */}
              {chatHistory.length > 0 && (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" data-testid="chat-history">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5 text-violet-400" />
                        </div>
                      )}
                      <div className={`max-w-[85%] sm:max-w-[75%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                        <div className={`rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-violet-500/20 text-foreground"
                            : "bg-muted/40 border border-border text-foreground"
                        }`}>
                          {msg.content}
                        </div>
                        {/* Sources */}
                        {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                          <div className="space-y-1 w-full">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                              Sources used ({msg.sources.length}) · via {msg.providerName}
                            </p>
                            {msg.sources.map((src, si) => (
                              <div key={si} className="rounded border border-border bg-muted/10 text-[10px]">
                                <button
                                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left"
                                  onClick={() => setExpandedSrc(expandedSrc === i * 100 + si ? null : i * 100 + si)}
                                  data-testid={`button-src-expand-${i}-${si}`}
                                >
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <BookMarked className="h-2.5 w-2.5 text-violet-400 shrink-0" />
                                    <span className="truncate font-medium">{src.documentTitle}</span>
                                    <Badge variant="outline" className={`text-[9px] shrink-0 ${src.similarity > 0.6 ? "text-green-400 border-green-500/30" : "text-amber-400 border-amber-500/30"}`}>
                                      {(src.similarity * 100).toFixed(0)}%
                                    </Badge>
                                  </span>
                                  {expandedSrc === i * 100 + si ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" />}
                                </button>
                                {expandedSrc === i * 100 + si && (
                                  <div className="px-2 pb-2 text-muted-foreground leading-relaxed border-t border-border pt-1 font-mono">
                                    {src.excerpt}{src.excerpt.length >= 300 ? "…" : ""}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.role === "assistant" && (!msg.sources || msg.sources.length === 0) && (
                          <p className="text-[10px] text-amber-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> No knowledge base sources matched — answer may not be grounded.
                          </p>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ))}
                  {chatMut.isPending && (
                    <div className="flex gap-2 justify-start">
                      <div className="h-6 w-6 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-violet-400" />
                      </div>
                      <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-violet-400" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {chatHistory.length === 0 && !chatMut.isPending && (
                <div className="rounded-lg border border-dashed border-border bg-muted/5 p-6 text-center space-y-2">
                  <Brain className="h-8 w-8 mx-auto text-violet-400/40" />
                  <p className="text-xs text-muted-foreground">
                    {documents.length === 0
                      ? "Ingest at least one document to enable AI chat."
                      : "Ask anything — HOLOCRON AI will answer using your knowledge base."}
                  </p>
                  {documents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                      {["How do I reset a Cisco ASA firewall?", "What is our password policy?", "Summarize recent incidents"].map(q => (
                        <button
                          key={q}
                          className="text-[10px] px-2 py-1 rounded border border-violet-500/30 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10 transition-colors"
                          onClick={() => { setChatInput(q); }}
                          data-testid={`button-suggestion-${q.slice(0, 10)}`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2 pt-1">
                <Input
                  placeholder={documents.length === 0 ? "Ingest documents first…" : "Ask a question grounded in your knowledge base…"}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleChat()}
                  disabled={documents.length === 0}
                  className="text-sm"
                  data-testid="input-chat-query"
                />
                <Button
                  size="sm"
                  onClick={handleChat}
                  disabled={!chatInput.trim() || chatMut.isPending || documents.length === 0}
                  data-testid="button-chat-send"
                >
                  {chatMut.isPending
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <SendHorizonal className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SEMANTIC SEARCH tab ──────────────────────────────────────────── */}
        <TabsContent value="search" className="mt-3">
          <Card className="border-border">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4 text-cyan-400" /> Semantic Retrieval Test
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4">
              <p className="text-xs text-muted-foreground">
                Test raw retrieval quality. This is exactly what HOLOCRON AI runs on every AI call — results above 35% similarity are injected into the system prompt.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. How do I reset a Cisco ASA firewall to factory defaults?"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchQuery.trim() && searchMut.mutate()}
                  data-testid="input-semantic-search"
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => searchMut.mutate()}
                  disabled={!searchQuery.trim() || searchMut.isPending || documents.length === 0}
                  data-testid="button-run-search"
                >
                  {searchMut.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {documents.length === 0 && (
                <p className="text-xs text-muted-foreground/60 italic">Ingest at least one document to enable semantic search.</p>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2 mt-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{searchResults.length} results retrieved</p>
                  {searchResults.map((r, i) => (
                    <div
                      key={r.id}
                      className={`rounded-lg border p-3 space-y-2 ${r.similarity > 0.6 ? "border-green-500/30 bg-green-500/5" : r.similarity > 0.35 ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-muted/10"}`}
                      data-testid={`search-result-${i}`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                          <span className="text-xs font-semibold">{r.documentTitle}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${r.similarity > 0.6 ? "text-green-400 border-green-500/30" : r.similarity > 0.35 ? "text-amber-400 border-amber-500/30" : "text-muted-foreground"}`}
                          >
                            {(r.similarity * 100).toFixed(0)}% match
                            {r.similarity > 0.35 && <Zap className="h-2.5 w-2.5 ml-0.5" />}
                          </Badge>
                          {r.similarity <= 0.35 && (
                            <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Below threshold — not injected</Badge>
                          )}
                        </div>
                        <Button
                          size="sm" variant="ghost" className="h-5 w-5 p-0"
                          onClick={() => setExpandedResult(expandedResult === r.id ? null : r.id)}
                        >
                          {expandedResult === r.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </Button>
                      </div>
                      {expandedResult === r.id && (
                        <pre className="text-xs bg-muted/30 rounded p-2 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto">
                          {r.content}
                        </pre>
                      )}
                      {expandedResult !== r.id && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {searchMut.isSuccess && searchResults.length === 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  No relevant chunks found above the 35% similarity threshold. Try rephrasing your query or ingesting more documents.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Document list ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Ingested Documents ({documents.length})
          </p>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => refetch()} data-testid="button-refresh-docs">
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : documents.length === 0 ? (
          <Card className="border-dashed border-border">
            <CardContent className="p-8 sm:p-12 text-center space-y-2">
              <Database className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No documents yet</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                Ingest your first document — runbooks, policies, incident history, or any technical reference — and HOLOCRON AI will automatically use it to ground its responses.
              </p>
              <Button size="sm" className="mt-2" onClick={() => setShowIngest(true)} data-testid="button-empty-ingest">
                <Plus className="h-3.5 w-3.5 mr-1" /> Ingest First Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const colorCls = SOURCE_COLORS[doc.sourceType] ?? SOURCE_COLORS.text;
              return (
                <Card key={doc.id} className="border-border" data-testid={`card-doc-${doc.id}`}>
                  <CardContent className="p-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-8 w-8 rounded bg-muted/40 flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{doc.title}</p>
                        {doc.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">{doc.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${colorCls}`}>
                            {SOURCE_TYPES.find(s => s.value === doc.sourceType)?.label ?? doc.sourceType}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Layers className="h-2.5 w-2.5" />{doc.chunkCount} chunks
                          </span>
                          {doc.chunkCount > 0 && (
                            <span className="text-[10px] text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Live
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-300 shrink-0"
                      onClick={() => deleteMut.mutate(doc.id)}
                      disabled={deleteMut.isPending}
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
