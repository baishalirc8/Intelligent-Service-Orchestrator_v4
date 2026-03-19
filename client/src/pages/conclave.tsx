import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Microscope, Star, Flag } from "lucide-react";
import type { Conclave, ConclaveMessage } from "@shared/schema";

// ── Agent config (mirrors backend)
const AGENT_META: Record<string, { icon: string; color: string; label: string; bg: string }> = {
  advocate:   { icon: "⚡", color: "text-green-400",  label: "Advocate",      bg: "bg-green-950/40 border-green-700/50" },
  critic:     { icon: "🔍", color: "text-red-400",    label: "Critic",        bg: "bg-red-950/40   border-red-700/50" },
  risk:       { icon: "⚠️", color: "text-orange-400", label: "Risk Assessor", bg: "bg-orange-950/40 border-orange-700/50" },
  pragmatist: { icon: "🔧", color: "text-blue-400",   label: "Pragmatist",   bg: "bg-blue-950/40   border-blue-700/50" },
  ethicist:   { icon: "⚖️", color: "text-purple-400", label: "Ethicist",      bg: "bg-purple-950/40 border-purple-700/50" },
  synthesizer:{ icon: "🧬", color: "text-cyan-400",   label: "Synthesizer",  bg: "bg-cyan-950/40   border-cyan-700/50" },
};

const STATUS_META: Record<string, { label: string; variant: "default"|"secondary"|"destructive"|"outline" }> = {
  open:         { label: "Open",         variant: "secondary" },
  deliberating: { label: "Deliberating", variant: "default" },
  consensus:    { label: "Consensus",    variant: "default" },
  executing:    { label: "Executing",    variant: "default" },
  evaluated:    { label: "Evaluated",    variant: "default" },
  closed:       { label: "Closed",       variant: "outline" },
};

const DOMAIN_LABELS: Record<string, string> = {
  general:        "General",
  itsm:           "ITSM",
  security:       "Security",
  infrastructure: "Infrastructure",
};

type ConclaveDetail = Conclave & { messages: ConclaveMessage[] };

function StanceBar({ messages }: { messages: ConclaveMessage[] }) {
  const scored = messages.filter(m => m.agreementScore !== null && m.round > 0);
  if (!scored.length) return null;
  const avg = Math.round(scored.reduce((a, m) => a + (m.agreementScore ?? 0), 0) / scored.length);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Oppose</span>
        <span className="font-medium">Avg Agreement: {avg}%</span>
        <span>Support</span>
      </div>
      <Progress value={avg} className="h-2" />
    </div>
  );
}

function AgentCard({ msg }: { msg: ConclaveMessage }) {
  const meta = AGENT_META[msg.agentRole] ?? AGENT_META.synthesizer;
  const [expanded, setExpanded] = useState(false);
  const short = msg.content.length > 350;
  return (
    <div data-testid={`agent-card-${msg.agentRole}-r${msg.round}`} className={`rounded-lg border p-4 space-y-2 ${meta.bg}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span className={`font-semibold text-sm ${meta.color}`}>{msg.agentName}</span>
          {msg.round === 0
            ? <Badge variant="default" className="text-xs bg-cyan-700">Synthesis</Badge>
            : <Badge variant="outline" className="text-xs">Round {msg.round}</Badge>}
          {msg.stance && (
            <Badge variant="outline" className={`text-xs capitalize ${
              msg.stance === "support" ? "border-green-600 text-green-400" :
              msg.stance === "challenge" ? "border-red-600 text-red-400" :
              msg.stance === "synthesize" ? "border-cyan-600 text-cyan-400" :
              "border-muted text-muted-foreground"}`}>
              {msg.stance}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {msg.agreementScore !== null && (
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${
              (msg.agreementScore ?? 0) >= 60 ? "bg-green-900/50 text-green-300" :
              (msg.agreementScore ?? 0) >= 40 ? "bg-yellow-900/50 text-yellow-300" :
              "bg-red-900/50 text-red-300"}`}>
              {msg.agreementScore}% agree
            </span>
          )}
          {msg.latencyMs != null && msg.latencyMs > 0 && (
            <span className="text-xs text-muted-foreground">{(msg.latencyMs / 1000).toFixed(1)}s</span>
          )}
        </div>
      </div>

      <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
        {short && !expanded ? msg.content.slice(0, 350) + "…" : msg.content}
      </div>
      {short && (
        <button
          data-testid={`btn-expand-${msg.agentRole}-r${msg.round}`}
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? "Show less ↑" : "Show more ↓"}
        </button>
      )}

      {msg.keyPoints && msg.keyPoints.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {msg.keyPoints.map((kp, i) => (
            <span key={i} className="text-[11px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full border border-border/50">
              {kp}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ConclaveDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ConclaveDetail>({
    queryKey: ["/api/conclave", id],
    queryFn: () => apiRequest("GET", `/api/conclave/${id}`).then(r => r.json()),
    refetchInterval: 4000,
  });

  const deliberate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/conclave/${id}/deliberate`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/conclave", id] }); qc.invalidateQueries({ queryKey: ["/api/conclave"] }); },
    onError: (e: any) => toast({ title: "Deliberation failed", description: e.message, variant: "destructive" }),
  });
  const consensus = useMutation({
    mutationFn: () => apiRequest("POST", `/api/conclave/${id}/consensus`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/conclave", id] }); qc.invalidateQueries({ queryKey: ["/api/conclave"] }); },
    onError: (e: any) => toast({ title: "Consensus failed", description: e.message, variant: "destructive" }),
  });
  const execute = useMutation({
    mutationFn: () => apiRequest("POST", `/api/conclave/${id}/execute`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/conclave", id] }); qc.invalidateQueries({ queryKey: ["/api/conclave"] }); },
    onError: (e: any) => toast({ title: "Execution failed", description: e.message, variant: "destructive" }),
  });
  const evaluate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/conclave/${id}/evaluate`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/conclave", id] }); qc.invalidateQueries({ queryKey: ["/api/conclave"] }); },
    onError: (e: any) => toast({ title: "Evaluation failed", description: e.message, variant: "destructive" }),
  });

  const [qaReview, setQaReview] = useState<{
    score: number; status: string; flags: string[]; result: string;
  } | null>(null);

  const reviewConsensus = useMutation({
    mutationFn: async (text: string) => {
      const r = await apiRequest("POST", "/api/ai-governance/review-text", { text, module: "conclave", feature: "consensus-decision", context: `Conclave session: ${data?.title ?? ""}. Topic: ${data?.topic ?? ""}` });
      return r.json();
    },
    onSuccess: (result) => {
      setQaReview(result);
      toast({ title: result.status === "passed" ? "Consensus quality verified" : "Quality issues found", description: `Score: ${result.score}/100`, variant: result.status === "passed" ? "default" : "destructive" });
    },
    onError: (e: any) => toast({ title: "Quality review failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading conclave…</p>
      </div>
    </div>
  );
  if (!data) return <div className="text-center p-8 text-muted-foreground">Conclave not found.</div>;

  const c = data;
  const msgs = data.messages ?? [];
  const round1 = msgs.filter(m => m.round === 1);
  const round2 = msgs.filter(m => m.round === 2);
  const synthMsg = msgs.find(m => m.round === 0);
  const canDeliberate = (c.status === "open" || c.status === "deliberating") && c.roundCount < c.maxRounds;
  const canConsensus = c.roundCount > 0 && (c.status === "deliberating" || c.status === "open") && !synthMsg;
  const canExecute = c.status === "consensus";
  const canEvaluate = (c.status === "evaluated" || c.status === "executing") && !!c.executionResult && !c.evaluationResult;

  const busy = deliberate.isPending || consensus.isPending || execute.isPending || evaluate.isPending;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="btn-conclave-back" className="shrink-0">
          ← Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold truncate">{c.title}</h2>
            <Badge variant={STATUS_META[c.status]?.variant ?? "secondary"} data-testid="badge-conclave-status">
              {STATUS_META[c.status]?.label ?? c.status}
            </Badge>
            <Badge variant="outline" className="text-xs">{DOMAIN_LABELS[c.domain ?? "general"] ?? c.domain}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.topic}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Rounds Run</p>
          <p className="text-2xl font-bold" data-testid="stat-rounds">{c.roundCount} / {c.maxRounds}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Agent Messages</p>
          <p className="text-2xl font-bold" data-testid="stat-messages">{msgs.filter(m => m.round > 0).length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Consensus Score</p>
          <p className="text-2xl font-bold" data-testid="stat-consensus">
            {c.consensusScore !== null && c.consensusScore !== undefined ? `${c.consensusScore}%` : "—"}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Eval Score</p>
          <p className="text-2xl font-bold" data-testid="stat-eval">
            {c.evaluationScore !== null && c.evaluationScore !== undefined ? `${c.evaluationScore}%` : "—"}
          </p>
        </Card>
      </div>

      {/* Agreement bar */}
      {msgs.filter(m => m.round > 0).length > 0 && (
        <Card className="p-4"><StanceBar messages={msgs} /></Card>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {canDeliberate && (
          <Button
            data-testid="btn-deliberate"
            onClick={() => deliberate.mutate()}
            disabled={busy}
            className="bg-primary"
          >
            {deliberate.isPending
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"/>Running Round {c.roundCount + 1}…</>
              : `▶ Run Round ${c.roundCount + 1} (${5} agents)`}
          </Button>
        )}
        {canConsensus && (
          <Button
            data-testid="btn-consensus"
            onClick={() => consensus.mutate()}
            disabled={busy}
            variant="outline"
            className="border-cyan-600 text-cyan-400 hover:bg-cyan-950/40"
          >
            {consensus.isPending
              ? <><span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mr-2"/>Synthesizing…</>
              : "🧬 Build Consensus"}
          </Button>
        )}
        {canExecute && (
          <Button
            data-testid="btn-execute"
            onClick={() => execute.mutate()}
            disabled={busy}
            variant="outline"
            className="border-green-600 text-green-400 hover:bg-green-950/40"
          >
            {execute.isPending
              ? <><span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin mr-2"/>Executing…</>
              : "⚙ Execute Decision"}
          </Button>
        )}
        {canEvaluate && (
          <Button
            data-testid="btn-evaluate"
            onClick={() => evaluate.mutate()}
            disabled={busy}
            variant="outline"
            className="border-yellow-600 text-yellow-400 hover:bg-yellow-950/40"
          >
            {evaluate.isPending
              ? <><span className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mr-2"/>Evaluating…</>
              : "📊 Evaluate Outcome"}
          </Button>
        )}
        {synthMsg && (
          <Button
            data-testid="btn-review-consensus"
            onClick={() => reviewConsensus.mutate(synthMsg.content ?? "")}
            disabled={reviewConsensus.isPending}
            variant="outline"
            className="border-violet-600 text-violet-400 hover:bg-violet-950/40 gap-1.5"
          >
            {reviewConsensus.isPending
              ? <><span className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />Reviewing Quality…</>
              : <><Microscope className="w-3.5 h-3.5" />Review Consensus Quality</>}
          </Button>
        )}
        {c.status === "closed" && c.triggerNewConclave && (
          <Badge variant="outline" className="text-yellow-400 border-yellow-600 px-3 py-1">
            ⚠ AI recommends a new Conclave session
          </Badge>
        )}
      </div>

      {/* Deliberation rounds */}
      {round1.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Round 1 — Initial Positions</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {round1.map(m => <AgentCard key={m.id} msg={m} />)}
          </div>
        </section>
      )}
      {round2.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Round 2 — Challenge & Refine</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {round2.map(m => <AgentCard key={m.id} msg={m} />)}
          </div>
        </section>
      )}

      {/* Synthesizer consensus */}
      {synthMsg && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Synthesizer Consensus</h3>
          <AgentCard msg={synthMsg} />
        </section>
      )}

      {/* AI Quality Review panel */}
      {qaReview && (
        <section data-testid="section-qa-review">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Microscope className="h-4 w-4 text-violet-400" />
            AI Quality Review
          </h3>
          <Card className={`border-2 ${qaReview.status === "passed" ? "border-green-600/40 bg-green-950/20" : "border-red-600/40 bg-red-950/20"}`}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Star className={`h-4 w-4 ${qaReview.status === "passed" ? "text-green-400" : "text-red-400"}`} />
                  <span className={`text-lg font-bold ${qaReview.status === "passed" ? "text-green-400" : "text-red-400"}`}>
                    {qaReview.score}/100
                  </span>
                </div>
                <Badge className={qaReview.status === "passed"
                  ? "bg-green-500/15 text-green-400 border-green-500/30 border"
                  : "bg-red-500/15 text-red-400 border-red-500/30 border"}>
                  {qaReview.status === "passed" ? "✓ Passed" : "⚑ Flagged"}
                </Badge>
              </div>
              {qaReview.flags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-400 mb-1.5">Issues Found</p>
                  <div className="flex flex-wrap gap-1">
                    {qaReview.flags.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] border-red-500/30 text-red-400">
                        <Flag className="h-2.5 w-2.5 mr-1" />{f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Reviewer Critique</p>
                <div className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-qa-critique">
                  {qaReview.result}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Execution result */}
      {c.executionResult && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Execution Report</h3>
          <Card className="border-green-700/40 bg-green-950/20">
            <CardContent className="pt-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-execution-result">
                {c.executionResult}
              </p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Evaluation result */}
      {c.evaluationResult && (
        <section>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Evaluation Report</h3>
          <Card className={`${c.evaluationScore && c.evaluationScore >= 70 ? "border-yellow-700/40 bg-yellow-950/20" : "border-orange-700/40 bg-orange-950/20"}`}>
            <CardContent className="pt-4 space-y-3">
              <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-evaluation-result">
                {c.evaluationResult}
              </p>
              {c.triggerNewConclave && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm pt-2 border-t border-border/50">
                  <span>⚠</span>
                  <span>The AI evaluation recommends opening a new Conclave session to address outstanding issues.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function CreateConclaveDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", topic: "", context: "", domain: "general" });

  const create = useMutation({
    mutationFn: () => apiRequest("POST", "/api/conclave", form).then(r => r.json()),
    onSuccess: (data: Conclave) => {
      qc.invalidateQueries({ queryKey: ["/api/conclave"] });
      onCreated(data.id);
      setForm({ title: "", topic: "", context: "", domain: "general" });
    },
    onError: (e: any) => toast({ title: "Failed to create conclave", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-create-conclave">
        <DialogHeader>
          <DialogTitle>New Conclave Session</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Raise a topic for multi-agent adversarial deliberation. 6 specialized AI agents will debate, build consensus, execute, and evaluate.
          </p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Session Title</Label>
            <Input data-testid="input-conclave-title" placeholder="e.g. Zero-Trust Network Architecture Migration" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Topic / Question</Label>
            <Textarea data-testid="input-conclave-topic" rows={3} placeholder="Describe the decision, proposal, or question to deliberate on…" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Context <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea data-testid="input-conclave-context" rows={2} placeholder="Relevant background, constraints, or current state…" value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Domain</Label>
            <Select value={form.domain} onValueChange={v => setForm(f => ({ ...f, domain: v }))}>
              <SelectTrigger data-testid="select-conclave-domain">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="itsm">ITSM</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="infrastructure">Infrastructure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={onClose} data-testid="btn-cancel-conclave">Cancel</Button>
          <Button
            data-testid="btn-create-conclave"
            onClick={() => create.mutate()}
            disabled={!form.title.trim() || !form.topic.trim() || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create Conclave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConclaveListItem({ c, onSelect, onDelete }: { c: Conclave; onSelect: () => void; onDelete: () => void }) {
  const meta = STATUS_META[c.status] ?? { label: c.status, variant: "secondary" };
  return (
    <Card
      data-testid={`card-conclave-${c.id}`}
      className="hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate text-sm">{c.title}</h3>
              <Badge variant={meta.variant} className="text-xs shrink-0">{meta.label}</Badge>
              <Badge variant="outline" className="text-xs shrink-0">{DOMAIN_LABELS[c.domain ?? "general"] ?? c.domain}</Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">{c.topic}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
              <span>Rounds: {c.roundCount}/{c.maxRounds}</span>
              {c.consensusScore !== null && c.consensusScore !== undefined && <span>Consensus: {c.consensusScore}%</span>}
              {c.evaluationScore !== null && c.evaluationScore !== undefined && <span>Eval: {c.evaluationScore}%</span>}
              {c.triggerNewConclave && <span className="text-yellow-400">⚠ New session recommended</span>}
            </div>
          </div>
          <Button
            data-testid={`btn-delete-conclave-${c.id}`}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={e => { e.stopPropagation(); onDelete(); }}
          >
            ×
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConclavePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: list = [], isLoading } = useQuery<Conclave[]>({
    queryKey: ["/api/conclave"],
    queryFn: () => apiRequest("GET", "/api/conclave").then(r => r.json()),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/conclave/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/conclave"] });
      toast({ title: "Conclave deleted" });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const statusOrder = ["deliberating", "consensus", "executing", "open", "evaluated", "closed"];
  const sorted = [...list].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-2xl">🧬</span> Holocron Conclave
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multi-agent adversarial deliberation — 5 specialized AI agents debate, then a Synthesizer builds consensus, executes, and evaluates.
          </p>
        </div>
        <Button
          data-testid="btn-new-conclave"
          onClick={() => setShowCreate(true)}
          className="shrink-0"
        >
          + New Session
        </Button>
      </div>

      {/* Agent legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(AGENT_META).map(([role, m]) => (
          <div key={role} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${m.bg} ${m.color}`}>
            <span>{m.icon}</span><span>{m.label}</span>
          </div>
        ))}
      </div>

      <Separator />

      {/* Main content */}
      {selectedId ? (
        <ConclaveDetail id={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <>
          {isLoading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!isLoading && list.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <span className="text-5xl">🧬</span>
                <h3 className="text-lg font-semibold">No Conclaves Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Start a new Conclave session to submit a topic for multi-agent adversarial deliberation.
                  Agents will debate, reach consensus, execute, and evaluate decisions.
                </p>
                <Button data-testid="btn-empty-new-conclave" onClick={() => setShowCreate(true)}>
                  Start First Conclave
                </Button>
              </CardContent>
            </Card>
          )}
          {!isLoading && sorted.length > 0 && (
            <div className="space-y-3">
              {sorted.map(c => (
                <ConclaveListItem
                  key={c.id}
                  c={c}
                  onSelect={() => setSelectedId(c.id)}
                  onDelete={() => deleteMut.mutate(c.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CreateConclaveDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={id => { setShowCreate(false); setSelectedId(id); }}
      />
    </div>
  );
}
