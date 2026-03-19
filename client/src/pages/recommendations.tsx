import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Shield, Cloud, Rocket, BarChart3, Brain, Headphones,
  Wifi, Scale, PiggyBank, Layers, Lightbulb, Lock,
  ShieldAlert, Eye, Target, CheckCircle2, XCircle,
  ChevronRight, DollarSign, Sparkles, ArrowRight,
  Check, X, Building2, AlertTriangle, ThumbsUp,
  RotateCcw, Loader2, MessageSquareText, Wand2,
  Plus, Zap, ChevronDown, Send, Bot, Users,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import type { OrgRole, Recommendation, RoleSubscription } from "@shared/schema";

const CHALLENGE_KEYWORDS: Record<string, string[]> = {
  "security-posture": [
    "security", "cyber", "threat", "breach", "vulnerability", "hack", "ransomware",
    "malware", "phishing", "soc", "siem", "firewall", "intrusion", "attack", "endpoint",
    "antivirus", "encryption", "pentest", "penetration test", "exploit", "patch",
    "waf", "ids", "ips", "ddos", "botnet", "spyware", "trojan", "xss", "sql injection",
    "data leak", "incident response", "threat hunting", "sandboxing", "protect",
    "secure", "defense", "defend", "hardening", "nist", "iso 27001",
  ],
  "cloud-migration": [
    "cloud", "aws", "azure", "gcp", "infrastructure", "server", "hosting", "migration",
    "kubernetes", "docker", "container", "scalability", "uptime", "datacenter",
    "data center", "on-premise", "on-prem", "saas", "iaas", "paas", "serverless",
    "virtual machine", "cloud native", "multi-cloud", "hybrid cloud", "ec2", "s3",
    "lambda", "terraform", "cloudformation", "migrate", "provisioning", "elastic",
    "load balancer", "auto-scaling", "autoscaling", "compute", "storage",
  ],
  "devops-velocity": [
    "devops", "ci/cd", "deploy", "pipeline", "release", "git", "jenkins",
    "slow release", "deployment", "continuous", "sre", "developer experience",
    "gitlab", "github actions", "build", "ship", "agile", "sprint", "velocity",
    "continuous integration", "continuous delivery", "continuous deployment",
    "infrastructure as code", "iac", "ansible", "puppet", "chef", "argocd",
    "gitops", "helm", "faster releases", "lead time",
  ],
  "data-analytics": [
    "data", "analytics", "dashboard", "report", "bi", "business intelligence",
    "insight", "data-driven", "metrics", "kpi", "data warehouse", "etl",
    "data lake", "bigquery", "redshift", "snowflake", "tableau", "power bi",
    "looker", "visualization", "data pipeline", "dbt", "spark", "hadoop",
    "sql", "data model", "forecasting", "trend",
  ],
  "ai-automation": [
    "artificial intelligence", "machine learning", "automate processes",
    "automation platform", "rpa", "robotic process", "intelligent automation",
    "predictive analytics", "nlp", "chatbot", "self-healing systems",
    "auto-remediate", "auto-fix", "intelligent ops", "aiops", "copilot",
    "llm", "generative ai", "deep learning", "neural network", "gpt",
    "model training", "inference", "workflow automation", "self-driving",
    "without human intervention", "ai agent", "ai-powered",
  ],
  "itsm-excellence": [
    "service desk", "helpdesk", "help desk", "tickets", "itil", "incident", "sla",
    "response time", "it support", "service management", "change management",
    "ticketing", "jira", "servicenow", "remedy", "trouble ticket", "escalation",
    "knowledge base", "self-service", "service catalog", "problem management",
    "asset management", "cmdb", "configuration management",
    "service request", "user support", "tech support",
  ],
  "network-reliability": [
    "network", "downtime", "outage", "reliability", "latency", "bandwidth",
    "wifi", "connectivity", "vpn", "router", "routers", "switch", "switches",
    "firewall", "firewalls", "lan", "wan", "sd-wan", "dns", "dhcp", "tcp",
    "ip address", "subnet", "vlan", "load balancing", "packet loss",
    "throughput", "wireless", "ethernet", "fiber", "mpls", "bgp", "ospf",
    "network management", "noc", "network operations", "uplink", "gateway",
    "proxy", "nat", "port", "traceroute", "ping", "snmp", "netflow",
    "network performance", "connection", "connected", "disconnect",
    "network infrastructure", "topology", "cable", "cabling",
  ],
  "compliance-governance": [
    "compliance", "gdpr", "hipaa", "sox", "pci", "audit", "regulation",
    "governance", "policy", "risk", "framework", "regulatory", "legal",
    "standards", "certification", "accreditation", "iso", "nist", "cobit",
    "fedramp", "ccpa", "data privacy", "privacy", "data protection",
    "access control", "segregation of duties", "evidence", "attestation",
    "control", "grc", "risk assessment", "third-party risk",
  ],
  "cost-optimization": [
    "cost", "budget", "expensive", "save", "reduce cost", "spending",
    "license", "vendor", "procurement", "finops", "optimize spend",
    "roi", "return on investment", "total cost", "tco", "savings",
    "cost reduction", "cut costs", "lower costs", "cheaper", "pricing",
    "subscription", "billing", "invoice", "financial", "overspending",
    "waste", "efficiency", "optimize", "right-sizing", "reserved instance",
  ],
  "platform-engineering": [
    "platform", "api", "microservice", "mobile app", "development",
    "software", "engineering", "architecture", "developer", "application",
    "frontend", "backend", "full stack", "fullstack", "web app", "webapp",
    "rest api", "graphql", "sdk", "framework", "library", "service mesh",
    "api gateway", "developer portal", "internal developer", "idp",
    "code quality", "code review", "tech debt", "refactor",
  ],
  "innovation-rd": [
    "innovation", "research", "emerging", "blockchain", "quantum", "edge",
    "prototype", "experiment", "r&d", "proof of concept", "poc", "lab",
    "digital twin", "metaverse", "augmented reality", "virtual reality",
    "5g", "web3", "startup", "disrupt", "next generation", "cutting edge",
    "state of the art", "novel", "patent", "intellectual property",
  ],
  "zero-trust": [
    "zero trust", "identity", "access", "iam", "sso", "mfa",
    "authentication", "privilege", "access control", "rbac", "abac",
    "privileged access", "pam", "identity governance", "okta", "azure ad",
    "active directory", "ldap", "saml", "oidc", "oauth", "login",
    "single sign-on", "multi-factor", "two-factor", "2fa", "biometric",
    "credential", "password", "passkey", "identity management",
  ],
  "disaster-recovery": [
    "disaster", "recovery", "backup", "business continuity", "dr",
    "failover", "resilience", "rto", "rpo", "high availability",
    "replication", "redundancy", "site recovery", "geo-redundant",
    "warm standby", "cold standby", "hot standby", "archival", "archive",
    "snapshot", "restore", "rollback", "data loss", "contingency",
  ],
  "observability": [
    "observability", "observability stack", "logging", "apm", "trace",
    "grafana", "prometheus", "metrics", "datadog", "splunk",
    "elk", "elasticsearch", "kibana", "logstash", "new relic", "dynatrace",
    "telemetry", "instrumentation", "health check", "status page",
    "log management", "tracing", "distributed tracing", "opentelemetry",
    "alerting system", "pagerduty", "opsgenie",
    "performance monitoring", "application monitoring", "full-stack monitoring",
  ],
};

function fuzzyMatch(word: string, keyword: string): boolean {
  if (word === keyword) return true;
  if (word.length < 4 || keyword.length < 4) return false;
  if (Math.abs(word.length - keyword.length) > 2) return false;
  let distance = 0;
  const maxLen = Math.max(word.length, keyword.length);
  const minLen = Math.min(word.length, keyword.length);
  if (word.length === keyword.length) {
    for (let i = 0; i < word.length; i++) {
      if (word[i] !== keyword[i]) distance++;
    }
    return distance <= (word.length >= 8 ? 2 : 1);
  }
  let i = 0, j = 0;
  while (i < word.length && j < keyword.length) {
    if (word[i] !== keyword[j]) {
      distance++;
      if (distance > 2) return false;
      if (word.length > keyword.length) i++;
      else if (keyword.length > word.length) j++;
      else { i++; j++; }
    } else {
      i++;
      j++;
    }
  }
  distance += (word.length - i) + (keyword.length - j);
  return distance <= (minLen >= 8 ? 2 : 1);
}

function detectGoalsFromText(text: string): { id: string; score: number; matchedKeywords: string[] }[] {
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9'-]+/).filter(w => w.length > 2);
  const detected: { id: string; score: number; matchedKeywords: string[] }[] = [];

  for (const [goalId, keywords] of Object.entries(CHALLENGE_KEYWORDS)) {
    const matches: string[] = [];

    for (const kw of keywords) {
      if (kw.includes(" ") || kw.includes("/") || kw.includes("&")) {
        if (lower.includes(kw)) {
          matches.push(kw);
        }
        continue;
      }

      if (kw.length <= 3) {
        const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
        if (regex.test(text)) {
          matches.push(kw);
        }
        continue;
      }

      if (lower.includes(kw)) {
        matches.push(kw);
        continue;
      }

      for (const word of words) {
        if (fuzzyMatch(word, kw)) {
          matches.push(kw);
          break;
        }
      }
    }

    if (matches.length > 0) {
      detected.push({ id: goalId, score: matches.length, matchedKeywords: [...new Set(matches)] });
    }
  }
  return detected.sort((a, b) => b.score - a.score);
}

const iconMap: Record<string, any> = {
  Shield, Cloud, Rocket, BarChart3, Brain, Headphones,
  Wifi, Scale, PiggyBank, Layers, Lightbulb, Lock,
  ShieldAlert, Eye,
};

const categoryColors: Record<string, string> = {
  Security: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/20",
  Infrastructure: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  Engineering: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/20",
  Data: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  Innovation: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  Operations: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  Compliance: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
  Finance: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20",
};

const priorityConfig = {
  critical: { label: "Critical", color: "bg-red-500/15 text-red-700 dark:text-red-300", icon: AlertTriangle },
  high: { label: "High Priority", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300", icon: Target },
  medium: { label: "Recommended", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300", icon: CheckCircle2 },
};

interface GoalItem {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: string;
}

interface RecommendedRoleDetail {
  roleId: string;
  reason: string;
  goalIds: string[];
  priority: "critical" | "high" | "medium";
  impact: string;
  aiPrice: number;
  humanCost: number;
  isCustom?: boolean;
}

interface CustomRoleResult {
  roleId: string;
  role: OrgRole;
  reason: string;
  goalIds: string[];
  priority: "high";
  impact: string;
  aiPrice: number;
  humanCost: number;
  isCustom: boolean;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(amount);
}

function HelpInput({
  goals,
  selected,
  onToggle,
  onGenerate,
  isPending,
  onBulkSelect,
  onCustomRolesCreated,
}: {
  goals: GoalItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onGenerate: (customRoleIds: string[]) => void;
  isPending: boolean;
  onBulkSelect: (ids: string[]) => void;
  onCustomRolesCreated: (roles: CustomRoleResult[]) => void;
}) {
  const { toast } = useToast();
  const [requirementsText, setRequirementsText] = useState("");
  const [nlpDetected, setNlpDetected] = useState<{ id: string; score: number; matchedKeywords: string[] }[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showGoalGrid, setShowGoalGrid] = useState(false);
  const [customRoles, setCustomRoles] = useState<CustomRoleResult[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const categories = useMemo(() => {
    const map = new Map<string, GoalItem[]>();
    goals.forEach(g => {
      if (!map.has(g.category)) map.set(g.category, []);
      map.get(g.category)!.push(g);
    });
    return Array.from(map.entries());
  }, [goals]);

  const handleAnalyze = useCallback(async () => {
    if (!requirementsText.trim()) return;
    setIsAnalyzing(true);

    const localResults = detectGoalsFromText(requirementsText);
    setNlpDetected(localResults);
    setHasAnalyzed(true);

    if (localResults.length > 0) {
      onBulkSelect(localResults.map(r => r.id));
    }

    try {
      const matchedGoalIds = localResults.map(r => r.id);
      const res = await apiRequest("POST", "/api/recommendations/analyze", { text: requirementsText, matchedGoalIds });
      const data = await res.json();

      if (data.customRoles && data.customRoles.length > 0) {
        setCustomRoles(data.customRoles);
        onCustomRolesCreated(data.customRoles);
        queryClient.invalidateQueries({ queryKey: ["/api/org-roles"] });
        toast({
          title: `${data.totalCustomCreated} custom agent${data.totalCustomCreated > 1 ? "s" : ""} created`,
          description: "We created new AI agent roles tailored to your specific needs.",
        });
      }
    } catch {
    }

    setIsAnalyzing(false);
  }, [requirementsText, onBulkSelect, onCustomRolesCreated, toast]);

  const detectedGoalIds = useMemo(() => new Set(nlpDetected.map(d => d.id)), [nlpDetected]);
  const hasResults = hasAnalyzed && (nlpDetected.length > 0 || customRoles.length > 0);
  const hasNothing = hasAnalyzed && nlpDetected.length === 0 && customRoles.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" data-testid="text-goals-title">How can I help you?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell me what you need — I'll find the right AI agents for you, or create new ones if they don't exist yet.
        </p>
      </div>

      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/3 overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-purple-500/10 border border-primary/10">
              <MessageSquareText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Describe what you need</p>
              <p className="text-[11px] text-muted-foreground/60">I'll match existing agents or create custom ones on the fly</p>
            </div>
          </div>

          <Textarea
            value={requirementsText}
            onChange={e => {
              setRequirementsText(e.target.value);
              if (hasAnalyzed) {
                setHasAnalyzed(false);
                setCustomRoles([]);
              }
            }}
            placeholder="Example: We need someone to manage our Salesforce CRM, build custom integrations with HubSpot, improve our social media marketing automation, and set up a customer success program..."
            className="min-h-[120px] resize-y text-sm bg-background"
            data-testid="textarea-requirements"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              {hasAnalyzed
                ? "Results ready — review below or refine your description"
                : "I'll analyze your needs and find or create the right agents"}
            </p>
            <Button
              onClick={handleAnalyze}
              disabled={!requirementsText.trim() || isAnalyzing}
              variant={hasAnalyzed ? "outline" : "default"}
              size="sm"
              className="gap-2 shrink-0"
              data-testid="button-analyze-requirements"
            >
              {isAnalyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {isAnalyzing ? "Analyzing..." : hasAnalyzed ? "Re-Analyze" : "Find Agents"}
            </Button>
          </div>

          {hasAnalyzed && (
            <div className="rounded-lg border bg-background p-4 space-y-3" data-testid="nlp-results">
              {nlpDetected.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <p className="text-sm font-medium">
                      Matched {nlpDetected.length} existing capability{nlpDetected.length !== 1 ? " areas" : " area"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {nlpDetected.map(d => {
                      const goal = goals.find(g => g.id === d.id);
                      if (!goal) return null;
                      const IconComp = iconMap[goal.icon] || Target;
                      return (
                        <div key={d.id} className="flex items-center gap-2 text-xs" data-testid={`nlp-match-${d.id}`}>
                          <IconComp className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="font-medium">{goal.label}</span>
                          <span className="text-muted-foreground">—</span>
                          <span className="text-muted-foreground">
                            matched: {d.matchedKeywords.slice(0, 4).map(kw => `"${kw}"`).join(", ")}
                            {d.matchedKeywords.length > 4 && ` +${d.matchedKeywords.length - 4} more`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {customRoles.length > 0 && (
                <div className="space-y-2">
                  {nlpDetected.length > 0 && <div className="h-px bg-border" />}
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-purple-500" />
                    <p className="text-sm font-medium">
                      Created {customRoles.length} custom agent{customRoles.length !== 1 ? "s" : ""} for your specific needs
                    </p>
                  </div>
                  <div className="space-y-2">
                    {customRoles.map(cr => (
                      <div key={cr.roleId} className="flex items-start gap-2 text-xs p-2 rounded-md bg-purple-500/5 border border-purple-500/10" data-testid={`custom-role-${cr.roleId}`}>
                        <Sparkles className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cr.role.name}</span>
                            <Badge className="text-[9px] bg-purple-500/15 text-purple-700 dark:text-purple-300">New</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{cr.role.description}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-muted-foreground">{cr.role.department}</span>
                            <span className="text-[10px] font-medium text-primary">{formatPrice(cr.aiPrice || 0)}/mo</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hasNothing && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <p className="text-sm text-muted-foreground">
                    Try describing your needs in more detail — what specific challenges, tools, or outcomes are you looking for?
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <button
          onClick={() => setShowGoalGrid(!showGoalGrid)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          data-testid="toggle-goal-grid"
        >
          {showGoalGrid ? "Hide" : "Browse"} existing capabilities
          <ChevronDown className={`h-3 w-3 transition-transform ${showGoalGrid ? "rotate-180" : ""}`} />
        </button>
        <div className="h-px flex-1 bg-border" />
      </div>

      {showGoalGrid && (
        <div className="space-y-4">
          {categories.map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{category}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map(goal => {
                  const isSelected = selected.has(goal.id);
                  const isNlpMatch = detectedGoalIds.has(goal.id);
                  const IconComp = iconMap[goal.icon] || Target;
                  return (
                    <button
                      key={goal.id}
                      onClick={() => onToggle(goal.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : isNlpMatch
                          ? "border-primary/40 bg-primary/5"
                          : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
                      }`}
                      data-testid={`goal-${goal.id}`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{goal.label}</p>
                          {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          {isNlpMatch && !isSelected && (
                            <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">
                              detected
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
        <div>
          <p className="text-sm font-medium">
            {selected.size > 0 || customRoles.length > 0
              ? `${selected.size} goal${selected.size !== 1 ? "s" : ""} selected${customRoles.length > 0 ? ` + ${customRoles.length} custom agent${customRoles.length > 1 ? "s" : ""}` : ""}`
              : "Describe your needs above or select goals to get started"}
          </p>
          <p className="text-xs text-muted-foreground">We'll find the best AI Agents for your priorities</p>
        </div>
        <Button
          onClick={() => onGenerate(customRoles.map(cr => cr.roleId))}
          disabled={(selected.size === 0 && customRoles.length === 0) || isPending}
          className="gap-2"
          data-testid="button-generate-recommendations"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate Recommendations
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function RecommendationReview({
  recommendation,
  details,
  roles,
  goals,
  onApprove,
  onBack,
}: {
  recommendation: Recommendation;
  details: RecommendedRoleDetail[];
  roles: OrgRole[];
  goals: GoalItem[];
  onApprove: (approvedIds: string[], rejectedIds: string[]) => void;
  onBack: () => void;
}) {
  const [approved, setApproved] = useState<Set<string>>(new Set(recommendation.approvedRoleIds || []));
  const [rejected, setRejected] = useState<Set<string>>(new Set(recommendation.rejectedRoleIds || []));

  const toggleApprove = (roleId: string) => {
    const next = new Set(approved);
    const nextRej = new Set(rejected);
    if (next.has(roleId)) {
      next.delete(roleId);
    } else {
      next.add(roleId);
      nextRej.delete(roleId);
    }
    setApproved(next);
    setRejected(nextRej);
  };

  const toggleReject = (roleId: string) => {
    const next = new Set(rejected);
    const nextApp = new Set(approved);
    if (next.has(roleId)) {
      next.delete(roleId);
    } else {
      next.add(roleId);
      nextApp.delete(roleId);
    }
    setRejected(next);
    setApproved(nextApp);
  };

  const approveAll = () => {
    setApproved(new Set(details.map(d => d.roleId)));
    setRejected(new Set());
  };

  const selectedGoals = goals.filter(g => recommendation.goals.includes(g.id));

  const priceMap = useMemo(() => {
    const map = new Map<string, { aiPrice: number; humanCost: number }>();
    details.forEach(d => map.set(d.roleId, { aiPrice: d.aiPrice, humanCost: d.humanCost }));
    return map;
  }, [details]);

  const approvedMonthly = useMemo(() => {
    return Array.from(approved).reduce((sum, rid) => {
      return sum + (priceMap.get(rid)?.aiPrice ?? 0);
    }, 0);
  }, [approved, priceMap]);

  const totalMonthly = useMemo(() => {
    return details.reduce((sum, d) => sum + d.aiPrice, 0);
  }, [details]);

  const groupedByPriority = useMemo(() => {
    const groups: Record<string, { detail: RecommendedRoleDetail; role: OrgRole }[]> = {
      critical: [], high: [], medium: [],
    };
    details.forEach(d => {
      const role = roles.find(r => r.id === d.roleId);
      if (role) groups[d.priority].push({ detail: d, role });
    });
    return groups;
  }, [details, roles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2" data-testid="button-back-to-goals">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Start Over
          </Button>
          <h2 className="text-xl font-bold" data-testid="text-recommendation-title">Your AI Agent Recommendations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve the AI Agents we've selected for you
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={approveAll} data-testid="button-approve-all">
          <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Approve All
        </Button>
      </div>

      {selectedGoals.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {selectedGoals.map(g => {
            const IconComp = iconMap[g.icon] || Target;
            return (
              <Badge key={g.id} variant="outline" className={`gap-1.5 ${categoryColors[g.category] || ""}`}>
                <IconComp className="h-3 w-3" />
                {g.label}
              </Badge>
            );
          })}
          {recommendation.goals.includes("custom") && (
            <Badge variant="outline" className="gap-1.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20">
              <Sparkles className="h-3 w-3" />
              Custom Agents
            </Badge>
          )}
        </div>
      )}

      <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Monthly</p>
              <p className="text-lg font-bold" data-testid="text-total-monthly">{formatPrice(totalMonthly)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Selected</p>
              <p className="text-lg font-bold text-primary" data-testid="text-selected-monthly">{formatPrice(approvedMonthly)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-approved-count">
              <Check className="h-3 w-3 text-green-500" /> {approved.size} approved
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-rejected-count">
              <X className="h-3 w-3 text-red-500" /> {rejected.size} rejected
            </Badge>
          </div>
        </CardContent>
      </Card>

      {(["critical", "high", "medium"] as const).map(priority => {
        const items = groupedByPriority[priority];
        if (items.length === 0) return null;
        const config = priorityConfig[priority];
        const PriorityIcon = config.icon;

        return (
          <div key={priority} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className={`${config.color} gap-1`} data-testid={`priority-${priority}`}>
                <PriorityIcon className="h-3 w-3" /> {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{items.length} role{items.length > 1 ? "s" : ""}</span>
            </div>

            {items.map(({ detail, role }) => {
              const isApproved = approved.has(detail.roleId);
              const isRejected = rejected.has(detail.roleId);
              const isCustom = detail.isCustom || detail.goalIds.includes("custom");

              return (
                <Card
                  key={detail.roleId}
                  className={`transition-all ${
                    isApproved ? "border-green-500/30 bg-green-500/5" :
                    isRejected ? "border-red-500/30 bg-red-500/5 opacity-60" : ""
                  }`}
                  data-testid={`rec-role-${detail.roleId}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg shrink-0 relative"
                        style={{ backgroundColor: `${role.color}15`, color: role.color }}
                      >
                        {isCustom ? <Sparkles className="h-5 w-5" /> : <Target className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold">{role.name}</h4>
                              {isCustom && (
                                <Badge className="text-[9px] bg-purple-500/15 text-purple-700 dark:text-purple-300">Custom Agent</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                              <Building2 className="h-3 w-3" /> {role.department}
                              {role.division && <span>· {role.division}</span>}
                            </p>
                          </div>
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-sm font-bold text-primary">{formatPrice(detail.aiPrice)}/mo</span>
                            {detail.humanCost > 0 && (
                              <span className="text-[10px] text-muted-foreground line-through">{formatPrice(detail.humanCost)}</span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground mt-2">{detail.reason || role.description}</p>

                        {detail.impact && (
                          <p className="text-[11px] text-muted-foreground/70 mt-1 italic">{detail.impact}</p>
                        )}

                        {role.aiCapabilities && role.aiCapabilities.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {role.aiCapabilities.slice(0, 4).map(cap => (
                              <Badge key={cap} variant="outline" className="text-[9px]">{cap}</Badge>
                            ))}
                            {role.aiCapabilities.length > 4 && (
                              <Badge variant="outline" className="text-[9px]">+{role.aiCapabilities.length - 4}</Badge>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            size="sm"
                            variant={isApproved ? "default" : "outline"}
                            onClick={() => toggleApprove(detail.roleId)}
                            className="gap-1.5"
                            data-testid={`approve-${detail.roleId}`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            {isApproved ? "Approved" : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant={isRejected ? "destructive" : "ghost"}
                            onClick={() => toggleReject(detail.roleId)}
                            className="gap-1.5"
                            data-testid={`reject-${detail.roleId}`}
                          >
                            <X className="h-3.5 w-3.5" />
                            {isRejected ? "Rejected" : "Skip"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}

      {(approved.size > 0 || rejected.size > 0) && recommendation.status === "pending" && (
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
          <div>
            <p className="text-sm font-medium">{approved.size} approved, {rejected.size} skipped</p>
            <p className="text-xs text-muted-foreground">
              Confirm to save your selections
            </p>
          </div>
          <Button
            onClick={() => onApprove(Array.from(approved), Array.from(rejected))}
            className="gap-2"
            data-testid="button-confirm-selections"
          >
            <CheckCircle2 className="h-4 w-4" />
            Confirm Selections
          </Button>
        </div>
      )}

      {recommendation.status !== "pending" && (
        <ApprovedTeamSummary
          approvedRoleIds={recommendation.approvedRoleIds || []}
          rejectedRoleIds={recommendation.rejectedRoleIds || []}
          details={details}
          roles={roles}
          goals={selectedGoals}
        />
      )}
    </div>
  );
}

function ApprovedTeamSummary({
  approvedRoleIds,
  rejectedRoleIds,
  details,
  roles,
  goals,
}: {
  approvedRoleIds: string[];
  rejectedRoleIds: string[];
  details: RecommendedRoleDetail[];
  roles: OrgRole[];
  goals: GoalItem[];
}) {
  const { data: subscriptions } = useQuery<RoleSubscription[]>({
    queryKey: ["/api/role-subscriptions"],
  });

  const approvedDetails = useMemo(() => {
    return details
      .filter(d => approvedRoleIds.includes(d.roleId))
      .map(d => {
        const role = roles.find(r => r.id === d.roleId);
        const sub = subscriptions?.find(s => s.roleId === d.roleId);
        return { detail: d, role, subscription: sub };
      })
      .filter(item => item.role);
  }, [details, approvedRoleIds, roles, subscriptions]);

  const byDepartment = useMemo(() => {
    const map = new Map<string, typeof approvedDetails>();
    approvedDetails.forEach(item => {
      const dept = item.role!.department;
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(item);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [approvedDetails]);

  const totalAiCost = approvedDetails.reduce((s, i) => s + i.detail.aiPrice, 0);
  const totalHumanCost = approvedDetails.reduce((s, i) => s + i.detail.humanCost, 0);
  const totalSavings = totalHumanCost - totalAiCost;
  const assignedCount = approvedDetails.filter(i => i.subscription?.assignedHumanName).length;

  return (
    <div className="space-y-4" data-testid="approved-team-summary">
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold" data-testid="text-confirmed-title">Selections Confirmed — Your AI Team</p>
              <p className="text-xs text-muted-foreground">
                {approvedRoleIds.length} AI Agent{approvedRoleIds.length !== 1 ? "s" : ""} approved
                {rejectedRoleIds.length > 0 && ` · ${rejectedRoleIds.length} skipped`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-background/50 border border-border/30" data-testid="summary-ai-agents">
              <div className="flex items-center gap-1.5 mb-1">
                <Bot className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">AI Agents</span>
              </div>
              <p className="text-lg font-bold">{approvedRoleIds.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30" data-testid="summary-departments">
              <div className="flex items-center gap-1.5 mb-1">
                <Building2 className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Departments</span>
              </div>
              <p className="text-lg font-bold">{byDepartment.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30" data-testid="summary-monthly-cost">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign className="h-3.5 w-3.5 text-green-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Monthly</span>
              </div>
              <p className="text-lg font-bold">{formatPrice(totalAiCost)}</p>
            </div>
            <div className="p-3 rounded-lg bg-background/50 border border-border/30" data-testid="summary-savings">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Savings</span>
              </div>
              <p className="text-lg font-bold text-green-500">{formatPrice(totalSavings)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {byDepartment.map(([dept, items]) => (
        <div key={dept} className="space-y-2" data-testid={`dept-group-${dept.toLowerCase().replace(/\s+/g, "-")}`}>
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dept}</h4>
            <Badge variant="outline" className="text-[9px]" data-testid={`badge-dept-count-${dept.toLowerCase().replace(/\s+/g, "-")}`}>{items.length} agent{items.length !== 1 ? "s" : ""}</Badge>
          </div>

          {items.map(({ detail, role, subscription }) => {
            const isCustom = detail.isCustom || detail.goalIds.includes("custom");
            const hasHuman = !!subscription?.assignedHumanName;
            const hasAi = !!subscription?.hasAiShadow;

            return (
              <Card key={detail.roleId} className="border-border/40 hover:border-primary/20 transition-all" data-testid={`team-agent-${detail.roleId}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                      style={{ backgroundColor: `${role!.color}15`, color: role!.color }}
                    >
                      {isCustom ? <Sparkles className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-sm font-semibold" data-testid={`agent-name-${detail.roleId}`}>{role!.name}</h5>
                          {isCustom && (
                            <Badge className="text-[8px] bg-purple-500/15 text-purple-700 dark:text-purple-300">Custom</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-primary">{formatPrice(detail.aiPrice)}/mo</span>
                          {detail.humanCost > 0 && (
                            <span className="text-[9px] text-muted-foreground line-through">{formatPrice(detail.humanCost)}</span>
                          )}
                        </div>
                      </div>

                      {role!.division && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{role!.division}</p>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-1.5" data-testid={`workforce-status-${detail.roleId}`}>
                          {hasHuman ? (
                            <Badge variant="outline" className="text-[9px] gap-1 bg-blue-500/10 text-blue-400 border-blue-500/20" data-testid={`badge-human-${detail.roleId}`}>
                              <Users className="h-2.5 w-2.5" />
                              {subscription!.assignedHumanName}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground" data-testid={`badge-human-${detail.roleId}`}>
                              <Users className="h-2.5 w-2.5" />
                              Needs Assignment
                            </Badge>
                          )}
                          {hasAi ? (
                            <Badge variant="outline" className="text-[9px] gap-1 bg-green-500/10 text-green-400 border-green-500/20" data-testid={`badge-ai-${detail.roleId}`}>
                              <Bot className="h-2.5 w-2.5" />
                              AI Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground" data-testid={`badge-ai-${detail.roleId}`}>
                              <Bot className="h-2.5 w-2.5" />
                              AI Available
                            </Badge>
                          )}
                        </div>
                      </div>

                      {role!.aiCapabilities && role!.aiCapabilities.length > 0 && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {role!.aiCapabilities.slice(0, 3).map(cap => (
                            <Badge key={cap} variant="outline" className="text-[8px] text-muted-foreground">{cap}</Badge>
                          ))}
                          {role!.aiCapabilities.length > 3 && (
                            <Badge variant="outline" className="text-[8px] text-muted-foreground">+{role!.aiCapabilities.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

      {assignedCount < approvedRoleIds.length && (
        <Card className="border-amber-500/20 bg-amber-500/5" data-testid="card-needs-assignment-warning">
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-4 w-4 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs font-medium" data-testid="text-needs-assignment">
                {approvedRoleIds.length - assignedCount} role{approvedRoleIds.length - assignedCount !== 1 ? "s" : ""} still need a human team member assigned
              </p>
              <p className="text-[10px] text-muted-foreground">
                Visit Crews & Agents to assign team members and activate AI shadows.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PastRecommendations({
  recs,
  goals,
  onView,
}: {
  recs: Recommendation[];
  goals: GoalItem[];
  onView: (rec: Recommendation) => void;
}) {
  if (recs.length === 0) return null;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    approved: "bg-green-500/15 text-green-700 dark:text-green-300",
    partial: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    rejected: "bg-red-500/15 text-red-700 dark:text-red-300",
  };

  return (
    <div className="space-y-3" data-testid="past-recommendations">
      <h3 className="text-sm font-semibold text-muted-foreground">Previous Recommendations</h3>
      {recs.map(rec => (
        <Card key={rec.id} className="hover:border-muted-foreground/20 transition-all cursor-pointer" onClick={() => onView(rec)} data-testid={`past-rec-${rec.id}`}>
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-[10px] ${statusColors[rec.status] || ""}`}>
                  {rec.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {rec.roleIds.length} roles recommended
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(rec.createdAt!).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {rec.goals.filter(gid => gid !== "custom").slice(0, 3).map(gid => {
                  const g = goals.find(x => x.id === gid);
                  return g ? <Badge key={gid} variant="outline" className="text-[9px]">{g.label}</Badge> : null;
                })}
                {rec.goals.includes("custom") && (
                  <Badge variant="outline" className="text-[9px] bg-purple-500/15 text-purple-700 dark:text-purple-300">Custom</Badge>
                )}
                {rec.goals.filter(gid => gid !== "custom").length > 3 && <Badge variant="outline" className="text-[9px]">+{rec.goals.filter(gid => gid !== "custom").length - 3}</Badge>}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Recommendations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [activeRec, setActiveRec] = useState<{ recommendation: Recommendation; details: RecommendedRoleDetail[] } | null>(null);
  const [pendingCustomRoles, setPendingCustomRoles] = useState<CustomRoleResult[]>([]);

  const { data: goals, isLoading: goalsLoading } = useQuery<GoalItem[]>({
    queryKey: ["/api/goals"],
  });

  const { data: roles } = useQuery<OrgRole[]>({
    queryKey: ["/api/org-roles"],
  });

  const { data: pastRecs } = useQuery<Recommendation[]>({
    queryKey: ["/api/recommendations"],
  });

  const generateMutation = useMutation({
    mutationFn: async ({ goals, customRoleIds }: { goals: string[]; customRoleIds: string[] }) => {
      const res = await apiRequest("POST", "/api/recommendations", { goals, customRoleIds });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      setActiveRec(data);
      toast({ title: "Recommendations generated", description: `${data.details.length} AI Agent roles recommended for your needs.` });
    },
    onError: (err: any) => {
      toast({ title: "Failed to generate", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, approvedRoleIds, rejectedRoleIds }: { id: string; approvedRoleIds: string[]; rejectedRoleIds: string[] }) => {
      const status = approvedRoleIds.length === 0 ? "rejected" :
        rejectedRoleIds.length === 0 ? "approved" : "partial";
      const res = await apiRequest("PATCH", `/api/recommendations/${id}`, {
        approvedRoleIds,
        rejectedRoleIds,
        status,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recommendations"] });
      if (activeRec) {
        setActiveRec({ ...activeRec, recommendation: data });
      }
      toast({
        title: "Selections confirmed",
        description: "Your selections have been saved. Go to Crews & Agents to assign team members to approved roles.",
      });
    },
  });

  const viewPastRec = async (rec: Recommendation) => {
    try {
      const res = await apiRequest("GET", `/api/recommendations/${rec.id}`);
      const data = await res.json();
      const recDetails: RecommendedRoleDetail[] = data.details.map((d: any) => ({
        roleId: d.roleId,
        reason: d.role?.description || "",
        goalIds: data.recommendation.goals,
        priority: "medium" as const,
        impact: "",
        aiPrice: d.aiPrice || 0,
        humanCost: d.humanCost || 0,
      }));
      setActiveRec({ recommendation: data.recommendation, details: recDetails });
    } catch {
      toast({ title: "Failed to load recommendation", variant: "destructive" });
    }
  };

  const toggleGoal = (id: string) => {
    const next = new Set(selectedGoals);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedGoals(next);
  };

  if (goalsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-recommendations-page-title">
            <span className="gradient-text">AI Agent Recommendations</span>
          </h1>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Describe what you need and we'll find or create the right AI Agents — at 70% less than human hiring costs.
          </p>
        </div>

        {activeRec && roles && goals ? (
          <RecommendationReview
            recommendation={activeRec.recommendation}
            details={activeRec.details}
            roles={roles}
            goals={goals}
            onApprove={(approved, rejected) =>
              approveMutation.mutate({ id: activeRec.recommendation.id, approvedRoleIds: approved, rejectedRoleIds: rejected })
            }
            onBack={() => {
              setActiveRec(null);
              setSelectedGoals(new Set());
              setPendingCustomRoles([]);
            }}
          />
        ) : (
          <>
            {goals && (
              <HelpInput
                goals={goals}
                selected={selectedGoals}
                onToggle={toggleGoal}
                onGenerate={(customRoleIds) =>
                  generateMutation.mutate({
                    goals: Array.from(selectedGoals),
                    customRoleIds,
                  })
                }
                isPending={generateMutation.isPending}
                onBulkSelect={(ids) => setSelectedGoals(prev => {
                  const merged = new Set(prev);
                  ids.forEach(id => merged.add(id));
                  return merged;
                })}
                onCustomRolesCreated={(roles) => setPendingCustomRoles(roles)}
              />
            )}

            {pastRecs && goals && (
              <PastRecommendations recs={pastRecs} goals={goals} onView={viewPastRec} />
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
