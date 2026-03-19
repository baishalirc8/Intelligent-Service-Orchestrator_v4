import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import holocronLogo from "@assets/Holocron_Logo_Icon_White_1772663128663.png";
import {
  Send, Bot, User, Sparkles, ChevronRight, Loader2,
  Shield, Cloud, Rocket, BarChart3, Headphones, Wifi, Scale,
  PiggyBank, Layers, Lightbulb, Lock, ShieldAlert, Eye, Target,
  ArrowRight, CheckCircle2, Building2, Users, DollarSign, X,
} from "lucide-react";
import type { OrgRole, Recommendation } from "@shared/schema";

const iconMap: Record<string, any> = {
  Shield, Cloud, Rocket, BarChart3, Headphones,
  Wifi, Scale, PiggyBank, Layers, Lightbulb, Lock,
  ShieldAlert, Eye,
};

interface GoalItem {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: string;
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  type: "text" | "goals" | "summary" | "results";
  options?: string[];
  goalOptions?: GoalItem[];
  selectedGoals?: string[];
  recommendations?: any;
}

type OnboardingStep = "welcome" | "needs" | "challenges" | "goals" | "generating" | "results" | "complete";

const CHALLENGE_KEYWORDS: Record<string, string[]> = {
  "security-posture": ["security", "breach", "hack", "cyber", "threat", "attack", "protect", "phishing", "malware", "ransomware", "firewall", "vulnerability", "pentest"],
  "cloud-migration": ["cloud", "aws", "azure", "gcp", "migrate", "migration", "datacenter", "on-premise", "on-prem", "saas", "iaas", "paas", "serverless", "kubernetes", "docker", "container"],
  "devops-velocity": ["devops", "ci/cd", "deploy", "pipeline", "release", "automation", "git", "jenkins", "slow release", "deployment", "continuous", "sre", "developer experience"],
  "data-analytics": ["data", "analytics", "dashboard", "report", "bi", "business intelligence", "insight", "data-driven", "metrics", "kpi", "data warehouse", "etl"],
  "ai-automation": ["ai", "artificial intelligence", "machine learning", "ml", "automate", "automation", "rpa", "bot", "intelligent", "predictive", "nlp", "chatbot"],
  "itsm-excellence": ["service desk", "helpdesk", "tickets", "itil", "incident", "sla", "response time", "support", "service management", "change management"],
  "network-reliability": ["network", "downtime", "outage", "reliability", "latency", "bandwidth", "wifi", "connectivity", "vpn", "monitoring"],
  "compliance-governance": ["compliance", "gdpr", "hipaa", "sox", "pci", "audit", "regulation", "governance", "policy", "risk", "framework"],
  "cost-optimization": ["cost", "budget", "expensive", "save", "reduce cost", "spending", "license", "vendor", "procurement", "finops", "optimize spend"],
  "platform-engineering": ["platform", "api", "microservice", "mobile app", "development", "software", "engineering", "architecture", "developer"],
  "innovation-rd": ["innovation", "research", "emerging", "blockchain", "quantum", "edge", "prototype", "experiment", "r&d"],
  "zero-trust": ["zero trust", "identity", "access", "iam", "sso", "mfa", "authentication", "privilege", "access control"],
  "disaster-recovery": ["disaster", "recovery", "backup", "business continuity", "dr", "failover", "resilience", "rto", "rpo"],
  "observability": ["observability", "monitoring", "logging", "apm", "trace", "alert", "grafana", "prometheus", "metrics", "dashboards"],
};

function detectGoalsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const detected: { id: string; score: number }[] = [];
  for (const [goalId, keywords] of Object.entries(CHALLENGE_KEYWORDS)) {
    const matches = keywords.filter(kw => lower.includes(kw));
    if (matches.length > 0) {
      detected.push({ id: goalId, score: matches.length });
    }
  }
  return detected.sort((a, b) => b.score - a.score).map(d => d.id);
}

function MessageBubble({ msg, onGoalToggle, selectedGoals }: {
  msg: ChatMessage;
  onGoalToggle?: (id: string) => void;
  selectedGoals?: Set<string>;
}) {
  const isAssistant = msg.role === "assistant";
  return (
    <div className={`flex gap-3 ${isAssistant ? "" : "flex-row-reverse"}`} data-testid={`chat-message-${msg.id}`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${
        isAssistant ? "bg-primary text-primary-foreground" : "bg-muted"
      }`}>
        {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className={`max-w-[80%] space-y-3 ${isAssistant ? "" : "flex flex-col items-end"}`}>
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isAssistant
            ? "bg-muted text-foreground rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-tr-sm"
        }`}>
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>

        {msg.type === "goals" && msg.goalOptions && onGoalToggle && selectedGoals && (
          <div className="space-y-2 w-full">
            <div className="grid grid-cols-1 gap-1.5">
              {msg.goalOptions.map(goal => {
                const isSelected = selectedGoals.has(goal.id);
                const IconComp = iconMap[goal.icon] || Target;
                return (
                  <button
                    key={goal.id}
                    onClick={() => onGoalToggle(goal.id)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all text-sm ${
                      isSelected
                        ? "bg-primary/10 border-2 border-primary shadow-sm"
                        : "bg-background border-2 border-transparent hover:bg-muted"
                    }`}
                    data-testid={`onboard-goal-${goal.id}`}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      <IconComp className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{goal.label}</p>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {msg.options && msg.options.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.options.map(opt => (
              <Badge key={opt} variant="secondary" className="text-xs cursor-default">
                {opt}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [detectedGoals, setDetectedGoals] = useState<string[]>([]);
  const [userNeeds, setUserNeeds] = useState("");
  const [userChallenges, setUserChallenges] = useState("");
  const [recResult, setRecResult] = useState<any>(null);

  const { data: goals } = useQuery<GoalItem[]>({ queryKey: ["/api/goals"] });
  const { data: roles } = useQuery<OrgRole[]>({ queryKey: ["/api/org-roles"] });

  const generateMutation = useMutation({
    mutationFn: async (goalIds: string[]) => {
      const res = await apiRequest("POST", "/api/recommendations", { goals: goalIds });
      return res.json();
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/complete-onboarding");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (step === "welcome" && messages.length === 0 && user) {
      const greeting = user.companyName
        ? `Welcome to HOLOCRON AI, ${user.displayName}! I'm here to help ${user.companyName} find the right AI Agents for your IT team.\n\nTo give you the best recommendations, I'd like to understand your needs. Let's start with a quick conversation.`
        : `Welcome to HOLOCRON AI, ${user.displayName}! I'm here to help you find the perfect AI Agents for your IT team.\n\nTo give you the best recommendations, let me ask you a few questions.`;

      addAssistantMessage(greeting);

      setTimeout(() => {
        addAssistantMessage("What does your organization need help with in IT? For example: managing cloud infrastructure, improving security, automating processes, handling service desk tickets, or something else?\n\nFeel free to describe it in your own words.");
        setStep("needs");
      }, 1200);
    }
  }, [step, user]);

  function addAssistantMessage(content: string, extra?: Partial<ChatMessage>) {
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "assistant",
      content,
      type: "text",
      ...extra,
    }]);
  }

  function addUserMessage(content: string) {
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "user",
      content,
      type: "text",
    }]);
  }

  function showGoalSelection(goalsData: GoalItem[], allDetected: string[]) {
    if (allDetected.length > 0) {
      const preSelected = new Set(allDetected);
      setSelectedGoals(preSelected);
      const matchedGoals = goalsData.filter(g => preSelected.has(g.id));
      const unmatchedGoals = goalsData.filter(g => !preSelected.has(g.id));

      addAssistantMessage(
        `Based on what you've told me, I've identified ${matchedGoals.length} key area${matchedGoals.length !== 1 ? "s" : ""} where AI Agents can help. I've pre-selected them below, but feel free to adjust.\n\nSelect all the goals that matter to your organization, then click "Generate My Recommendations".`,
        {
          type: "goals",
          goalOptions: [...matchedGoals, ...unmatchedGoals],
          selectedGoals: Array.from(preSelected),
        }
      );
    } else {
      addAssistantMessage(
        "Thanks for sharing! Now let me understand your priorities better. Select the IT goals that matter most to your organization.\n\nPick as many as you need, then click \"Generate My Recommendations\".",
        {
          type: "goals",
          goalOptions: goalsData,
        }
      );
    }
    setStep("goals");
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");

    if (step === "needs") {
      addUserMessage(text);
      setUserNeeds(text);
      const detected = detectGoalsFromText(text);
      setDetectedGoals(prev => [...new Set([...prev, ...detected])]);

      setTimeout(() => {
        addAssistantMessage("Got it! That's really helpful. Now, what are the biggest challenges or pain points your IT team faces today?\n\nFor example: frequent security incidents, slow deployments, high infrastructure costs, compliance headaches, lack of visibility into systems, etc.");
        setStep("challenges");
      }, 800);

    } else if (step === "challenges") {
      addUserMessage(text);
      setUserChallenges(text);
      const detected = detectGoalsFromText(text);
      const allDetected = [...new Set([...detectedGoals, ...detected])];
      setDetectedGoals(allDetected);

      setTimeout(() => {
        const goalsData = goals || queryClient.getQueryData<GoalItem[]>(["/api/goals"]);
        if (!goalsData) {
          addAssistantMessage("I'm still loading the available goals. One moment...");
          const waitForGoals = setInterval(() => {
            const loaded = queryClient.getQueryData<GoalItem[]>(["/api/goals"]);
            if (loaded) {
              clearInterval(waitForGoals);
              showGoalSelection(loaded, allDetected);
            }
          }, 500);
          return;
        }
        showGoalSelection(goalsData, allDetected);
      }, 800);

    } else if (step === "goals") {
      addUserMessage(text);
      const detected = detectGoalsFromText(text);
      if (detected.length > 0) {
        const updated = new Set(selectedGoals);
        detected.forEach(d => updated.add(d));
        setSelectedGoals(updated);
        addAssistantMessage(`I've added those areas to your selection. You now have ${updated.size} goals selected. Adjust the selection below and click "Generate My Recommendations" when ready.`);
      } else {
        addAssistantMessage("I see — please use the goal cards below to select your priorities, or describe your needs and I'll try to match them.");
      }
    }
  }

  function handleGoalToggle(id: string) {
    setSelectedGoals(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate() {
    if (selectedGoals.size === 0) {
      toast({ title: "Please select at least one goal", variant: "destructive" });
      return;
    }
    setStep("generating");
    addAssistantMessage(`Analyzing your requirements across ${selectedGoals.size} goal${selectedGoals.size !== 1 ? "s" : ""}... Let me find the best AI Agents for your team.`);

    try {
      const data = await generateMutation.mutateAsync(Array.from(selectedGoals));
      setRecResult(data);

      setTimeout(() => {
        const count = data.details?.length || 0;
        const totalMonthly = data.recommendation?.totalMonthly || 0;
        addAssistantMessage(
          `Here are your personalized recommendations! I've found ${count} AI Agent${count !== 1 ? "s" : ""} that can help achieve your goals.\n\nTotal investment: ${formatPrice(totalMonthly)}/month — that's 70% less than equivalent human hiring costs.\n\nYou can review these in detail on your Recommendations page. Ready to explore your organization chart?`,
          { type: "results" }
        );
        setStep("results");
      }, 1500);
    } catch (err: any) {
      addAssistantMessage("I couldn't generate recommendations right now. Let's try selecting different goals or you can explore the full catalog on the Organization Chart page.");
      setStep("goals");
    }
  }

  async function handleComplete(goToDashboard: boolean) {
    try {
      await completeOnboardingMutation.mutateAsync();
      if (goToDashboard) {
        setLocation("/dashboard");
      } else {
        setLocation("/recommendations");
      }
    } catch {
      toast({ title: "Something went wrong", description: "Please try again", variant: "destructive" });
    }
  }

  async function handleSkip() {
    try {
      await completeOnboardingMutation.mutateAsync();
      setLocation("/dashboard");
    } catch {
      toast({ title: "Something went wrong", description: "Please try again", variant: "destructive" });
    }
  }

  const showInput = step === "needs" || step === "challenges" || step === "goals";
  const showGoalConfirm = step === "goals" && selectedGoals.size > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur-sm px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <img src={holocronLogo} alt="Holocron AI" className="h-5 w-5 object-contain" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight" data-testid="text-onboarding-title">HOLOCRON AI</h1>
            <p className="text-[11px] text-muted-foreground">Setup Assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground" data-testid="button-skip-onboarding">
          Skip for now <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </header>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="chat-messages">
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onGoalToggle={msg.type === "goals" ? handleGoalToggle : undefined}
              selectedGoals={msg.type === "goals" ? selectedGoals : undefined}
            />
          ))}

          {step === "generating" && (
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Analyzing your requirements...
              </div>
            </div>
          )}

          {step === "results" && recResult && (
            <div className="space-y-4 ml-11">
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Your Recommendations Summary</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-background">
                      <p className="text-lg font-bold text-primary" data-testid="text-rec-count">{recResult.details?.length || 0}</p>
                      <p className="text-[10px] text-muted-foreground">AI Agents</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-background">
                      <p className="text-lg font-bold text-purple-600 dark:text-purple-400" data-testid="text-rec-monthly">{formatPrice(recResult.recommendation?.totalMonthly || 0)}</p>
                      <p className="text-[10px] text-muted-foreground">Monthly</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-background">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">70%</p>
                      <p className="text-[10px] text-muted-foreground">Savings</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="flex-1 gap-1.5" onClick={() => handleComplete(false)} data-testid="button-view-recommendations">
                      <Target className="h-3.5 w-3.5" /> View Recommendations
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => handleComplete(true)} data-testid="button-go-to-dashboard">
                      <Building2 className="h-3.5 w-3.5" /> Explore Org Chart
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {showGoalConfirm && (
          <div className="px-6 pb-2">
            <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="w-full gap-2" data-testid="button-generate-onboarding">
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate My Recommendations ({selectedGoals.size} goal{selectedGoals.size !== 1 ? "s" : ""})
                </>
              )}
            </Button>
          </div>
        )}

        {showInput && (
          <div className="p-4 border-t bg-background/95 backdrop-blur-sm">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={
                  step === "needs" ? "Describe what your organization needs help with..." :
                  step === "challenges" ? "What are your biggest IT challenges?" :
                  "Type to refine your goals..."
                }
                className="flex-1"
                autoFocus
                data-testid="input-onboarding-chat"
              />
              <Button type="submit" size="icon" disabled={!inputValue.trim()} data-testid="button-send-chat">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            {step === "goals" && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Select goals above or type your needs to auto-detect them
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
