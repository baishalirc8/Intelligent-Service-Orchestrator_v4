import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, ChevronDown, ChevronRight, BookOpen, Cpu, Shield, Brain, Users,
  Network, GitBranch, Activity, BarChart3, MessageSquare, Zap, Settings,
  AlertTriangle, ShieldCheck, Key, Atom, FlaskConical, Server, Terminal,
  FileText, MonitorSmartphone, Target, Cloud, TrendingUp, DollarSign,
  Handshake, Rocket, Heart, Gauge, BrainCircuit, Layers, Workflow,
  RefreshCw, ClipboardList, Package, Database, HelpCircle, ExternalLink,
  CheckCircle2, Info, ScrollText, Lock,
} from "lucide-react";

interface Section {
  id: string;
  icon: typeof BookOpen;
  title: string;
  badge?: string;
  color: string;
  articles: Article[];
}

interface Article {
  title: string;
  content: string[];
}

const SECTIONS: Section[] = [
  {
    id: "getting-started",
    icon: Rocket,
    title: "Getting Started",
    badge: "Start here",
    color: "text-violet-400",
    articles: [
      {
        title: "What is HOLOCRON AI?",
        content: [
          "HOLOCRON AI is a Generative AI-Native IT Orchestration Platform. It unifies your entire IT operation — infrastructure monitoring, ITSM (Incident, Problem, Change, Service Requests), Security & Compliance, BCP/DRP, MDM, and AI governance — under a single AI-powered orchestrator.",
          "The platform uses 'Crews' (departments) and 'Agents' (roles). Every agent can be a human, an AI shadow agent, or both. The AI Orchestrator continuously routes work to the best available agent — human or AI — based on skill, capacity, urgency, and cost.",
          "Key brand concepts: Departments = Crews · Roles = Agents · Modules = Domains",
        ],
      },
      {
        title: "First Login & Onboarding",
        content: [
          "1. Navigate to the platform and log in with your credentials.",
          "2. The Guided Welcome Tour starts automatically for new users — follow the highlighted steps to set up your first Crew and Agent.",
          "3. Visit the Module Catalog (bottom of the sidebar) to enable only the domains you need. Infrastructure is locked on whenever ITSM, Security, or SLA modules are active.",
          "4. The Setup Progress Indicator at the top of the sidebar shows your completion percentage.",
          "5. The Command Palette (Ctrl+K / ⌘K) gives you instant access to any module or action from anywhere in the platform.",
        ],
      },
      {
        title: "Navigation & Layout",
        content: [
          "The left sidebar is organized into domain groups: Organization, Infrastructure, AI Operations, ITSM, Security, and AI Governance.",
          "The sidebar only shows enabled modules — disable unused domains in the Module Catalog to keep navigation clean.",
          "The AI Assistant Avatar (bottom right) is always available for contextual help and quick AI queries.",
          "Use the Recommendations page (sidebar → Recommendations) to see AI-generated suggestions for your environment.",
        ],
      },
    ],
  },
  {
    id: "ai-providers",
    icon: Brain,
    title: "AI Providers & LLM Configuration",
    badge: "Updated",
    color: "text-indigo-400",
    articles: [
      {
        title: "How the AI Provider System Works",
        content: [
          "HOLOCRON AI selects the best available AI provider using a 4-tier priority waterfall, evaluated in order for every AI request:",
          "1. Role-specific provider — if the current agent role has a dedicated provider assigned, that is used first.",
          "2. User default provider — your preferred provider configured in Settings → AI Providers.",
          "3. Environment variable waterfall — the platform automatically detects which free providers are configured via environment secrets: Ollama (local) → Google Gemini → xAI Grok → Groq → Mistral AI → OpenRouter → Together AI → HuggingFace.",
          "4. OpenAI (last resort) — if nothing else is available, the platform uses OPENAI_API_KEY. If that hits a quota limit (429), it automatically retries with the Replit-managed proxy.",
          "Every AI call is logged in the AI Governance module regardless of which provider was used.",
        ],
      },
      {
        title: "Adding a Free LLM Provider",
        content: [
          "Go to Settings → AI Providers (sidebar → AI Governance → AI Providers).",
          "Click 'Add Provider' and select from the Free & Open-weight section: Ollama, Gemini, Grok, Groq, Mistral, OpenRouter, Together AI, or HuggingFace.",
          "Enter your API key. For Ollama (local), no API key is required — just provide the base URL of your Ollama server.",
          "Click 'Test' to verify the connection before saving.",
          "To make this provider the default for all AI calls, click 'Set as Default'.",
          "To assign a provider to a specific role (e.g. your CISO agent uses Gemini, your NOC agent uses Groq), use the 'Assign to Role' option on the provider card.",
        ],
      },
      {
        title: "AI Waterfall Status Panel",
        content: [
          "The AI Providers page shows a live waterfall status panel — a numbered list of all 8 free providers plus OpenAI, each with a green dot (configured) or grey dot (not configured).",
          "The active provider banner at the top of the page shows which provider is currently being used for your AI calls.",
          "To switch providers: either set a new default in Settings, or add the provider's API key as an environment secret and it will be picked up automatically on the next AI call.",
        ],
      },
    ],
  },
  {
    id: "infrastructure",
    icon: Server,
    title: "Infrastructure & Network Ops",
    color: "text-blue-400",
    articles: [
      {
        title: "Probe Deployment",
        content: [
          "Probes are lightweight agents deployed to your infrastructure that collect telemetry and send it to HOLOCRON AI.",
          "Three coupling modes: Coupled (always connected, real-time), Semi-Autonomous (edge AI, store & forward), Fully Autonomous (permanent independence, no reconnection required).",
          "Go to Infrastructure → Discovery to scan your network and auto-discover assets. The AI Discovery Engine uses NMap-style scanning and fingerprinting.",
          "Deploy probes via Infrastructure → Configure. Choose the coupling mode, protocols (WMI, SNMP, SSH, REST, LoRaWAN, BACnet, MQTT, Modbus, ICMP), and target assets.",
        ],
      },
      {
        title: "Asset Management & AI Agent Scan",
        content: [
          "All discovered assets appear in Infrastructure → Asset Management. Each asset has a full profile including firmware, OS, open ports, installed applications, and compliance status.",
          "Click 'Agent Scan' on any asset to run a full multi-domain AI analysis: vulnerability scan, compliance check, security KPIs, penetration test simulation, and application discovery.",
          "The Agent Scan uses multiple specialist AI agents in parallel — each domain (vulnerability, compliance, pentest, etc.) runs its own analysis, then an Orchestrator Agent synthesizes the findings into a unified risk score and recommended actions.",
          "Scan results are available immediately in the asset's detail panel and feed into the Security modules automatically.",
        ],
      },
      {
        title: "Event Management & AI Triage",
        content: [
          "Infrastructure → Event Management is the unified hub for all operational and security events.",
          "AI Triage automatically classifies every incoming event by severity, affected CIs, and likely root cause — in under 3 seconds.",
          "Events above a configurable threshold auto-create ITIL Incidents with full context, SLA countdown, and AI-generated resolution narratives.",
          "The AI Root Cause Analysis engine correlates signals across probes, logs, metrics, and user reports to identify causal chains, not just symptoms.",
        ],
      },
    ],
  },
  {
    id: "itsm",
    icon: ClipboardList,
    title: "ITIL / ITSM Modules",
    color: "text-emerald-400",
    articles: [
      {
        title: "Incident Management",
        content: [
          "Access via sidebar → Incident Management. All 34 ITIL v4 practices are implemented.",
          "Create incidents manually or let the AI auto-create them from events. Every incident gets: auto-severity, category, affected CIs, SLA countdown, and an AI resolution narrative.",
          "Smart Auto-Assignment routes incidents to the best available agent (human or AI) based on skill match, current workload, and on-call roster.",
          "SR → Incident Auto-Link: Service Requests that exceed SLA or fail fulfillment are automatically escalated into Incidents.",
          "The Leaderboard (sidebar → Leaderboard) gamifies incident resolution — agents earn XP for speed, quality, and collaboration.",
        ],
      },
      {
        title: "Problem, Change & Service Requests",
        content: [
          "Problem Management: AI performs root cause analysis and generates permanent fix recommendations. Known errors are stored in the KEDB (Known Error Database).",
          "Change Enablement: Full CAB workflow with AI risk & impact assessment, scheduling, blackout period enforcement, emergency change pathways, and automated Post-Implementation Reviews.",
          "Service Requests: Self-service catalogue with AI-driven fulfilment, approval chains, SLA-based prioritisation, and auto-completion for routine requests.",
          "All four modules feed into shared KPI dashboards and the AI Leaderboard.",
        ],
      },
      {
        title: "SLA, Capacity & CSI",
        content: [
          "SLA Management: Define SLAs, OLAs, and UCs. The AI predicts breach risk hours in advance and proactively reallocates resources.",
          "Capacity Management: AI forecasts resource demand based on historical patterns, seasonal trends, and growth signals. Automated provisioning recommendations included.",
          "CSI Register (Continual Service Improvement): AI suggests ITIL 4-aligned improvements from live incident/problem data, generates full PDCA action plans, and autonomously advances items when progress meets targets.",
          "Financial Management: IT budget tracking, cost modelling, AI-generated variance analysis, and financial forecasting aligned to ITIL Service Financial Management.",
          "Supplier Management: Vendor register, SLA adherence tracking, AI supplier risk scoring, and renewal/escalation alerts.",
        ],
      },
    ],
  },
  {
    id: "security",
    icon: Shield,
    title: "Security & Compliance Suite",
    color: "text-red-400",
    articles: [
      {
        title: "Security Module Overview",
        content: [
          "The Security domain contains 18 modules across 5 sub-groups, all ITIL-aligned.",
          "Threat & Vulnerability: Threat Intelligence (MITRE ATT&CK, IOC management, threat feeds), Vulnerability Management (CVE lifecycle, CVSS scoring), Penetration Testing (multi-environment engagement tracking), Patch & Remediation.",
          "Cloud & Endpoint: CSPM (AWS, Azure, GCP with CIS Benchmarks), EDR/Endpoint Security (alert triage, quarantine, telemetry).",
          "SOC & Incident Response: SOC Operations (alert queue, threat hunting, playbooks, MTTR), Security Incidents (ITIL IR lifecycle — containment, eradication, PIR).",
          "Identity & Compliance: IAM Governance (access reviews, PAM, privilege audit), Compliance Frameworks (NIST CSF, ISO 27001, CIS Controls, SOC 2, DORA), Security Risk Register, Data Protection & DLP.",
          "Tooling: Configuration Audit, Log Aggregation, Command Center, Asset Terminal, Autonomous Validation, Security Awareness Training.",
        ],
      },
      {
        title: "AI-Powered Security Features",
        content: [
          "Threat Briefing: POST /api/security/ai/threat-briefing — AI synthesizes all IOCs, events, alerts, and incidents into an executive threat briefing with severity assessment and recommended actions.",
          "Vulnerability Analysis: AI prioritizes CVEs by CVSS score, exposure window, and asset criticality — generating remediation plans automatically.",
          "SIEM Analysis: AI correlates SIEM events across all sources, identifies kill-chain patterns, and generates structured incident reports.",
          "Pentest Summary: AI generates structured findings, CVSS scores, and remediation roadmaps from pentest data.",
          "The AI Security module feeds into the AI Governance system — all analysis is logged, audited, and subject to the hallucination defense pipeline.",
        ],
      },
      {
        title: "Forensics & Autonomous Validation",
        content: [
          "Forensics Investigation (sidebar → Security → Forensics): Full digital forensics case management. AI generates forensic analysis reports and case export packages.",
          "Autonomous Validation: Continuously validates that security controls, probe deployments, and ITIL processes are operating as expected. Any deviation triggers an alert and auto-creates a remediation task.",
          "Log Aggregation: Collects, normalizes, and AI-analyzes logs from all connected sources. Anomaly detection runs continuously with AI-generated investigation notes.",
        ],
      },
    ],
  },
  {
    id: "ai-knowledge-base",
    icon: Database,
    title: "AI Knowledge Base",
    badge: "New",
    color: "text-violet-400",
    articles: [
      {
        title: "What is the AI Knowledge Base?",
        content: [
          "The AI Knowledge Base (sidebar → AI Governance → AI Knowledge Base) is HOLOCRON AI's Retrieval-Augmented Generation (RAG) store. You ingest documents once, and the platform automatically retrieves the most relevant passages and injects them into every AI call — grounding responses in your actual environment without any retraining.",
          "Supported source types: Plain Text, Runbook / SOP, Policy / Compliance, Incident History, Knowledge Article, Technical Documentation, and Training Data. Each type is visually colour-coded for easy identification.",
          "Under the hood: content is split into ~1,800-character chunks with 200-character overlap, then each chunk is embedded via OpenAI text-embedding-3-small (1,536-dimensional vectors) and stored in PostgreSQL with PGVector. An IVFFlat index enables sub-second cosine similarity search at scale.",
        ],
      },
      {
        title: "Ingesting a Document",
        content: [
          "1. Click 'Ingest Document' (top right of the AI Knowledge Base page).",
          "2. Enter a descriptive title (e.g. 'Network Firewall Runbook v3.2') and select the source type.",
          "3. Optionally add a short description so other users understand the document's scope.",
          "4. Paste the full text content — there is no practical length limit. The chunk estimate updates in real time as you type.",
          "5. Click 'Ingest & Embed'. Processing takes 2–10 seconds depending on document length. When complete, the document appears in the list with a green 'Live' badge and a chunk count.",
          "Once ingested, the document is immediately live — the very next AI call anywhere on the platform will automatically search it for relevant passages.",
        ],
      },
      {
        title: "Ask the Knowledge Base (AI Chat)",
        content: [
          "The 'Ask the KB' tab provides a conversational AI interface grounded entirely in your ingested documents.",
          "Type a question (e.g. 'How do I reset a Cisco ASA to factory defaults?') and press Enter or click Send. HOLOCRON AI: (1) embeds your question, (2) retrieves the top matching chunks above the 35% similarity threshold, (3) constructs a grounded context block, and (4) calls the AI to produce a cited answer.",
          "Each AI response shows the sources used — document name, similarity percentage, and an expandable excerpt. If no knowledge base sources matched, a warning badge alerts you that the answer may not be grounded.",
          "If the knowledge base is empty, quick suggestion prompts appear in the chat empty state to help you get started.",
          "Chat history persists for the session. Use 'Clear chat' to start a new conversation.",
        ],
      },
      {
        title: "Test Retrieval Panel",
        content: [
          "The 'Test Retrieval' tab lets you inspect raw chunk retrieval — exactly what HOLOCRON AI runs internally on every AI call — without triggering a full AI response.",
          "Enter a query and click Search. Results are ranked by cosine similarity. Results above 35% similarity show an amber badge and a ⚡ indicator — these are the chunks that will be injected into the system prompt.",
          "Results below 35% show a red 'Below threshold — not injected' badge. Use this panel to validate that your documents are returning the right content before relying on them in production.",
          "Tip: if a query returns no results, try rephrasing it closer to the exact language used in your document, or ingest more domain-specific content.",
        ],
      },
      {
        title: "How Automatic Injection Works",
        content: [
          "You do not need to do anything beyond ingest — injection is fully automatic.",
          "On every AI call (across all 30+ platform modules), the user's message is embedded and the top-3 most similar chunks above the 35% threshold are retrieved. If any are found, they are prepended to the system prompt as: [KNOWLEDGE BASE — N excerpts] followed by the relevant passages, each labelled with its source document title.",
          "The injection is skipped for the AI Quality Reviewer (to avoid bias in hallucination detection) and for embedding calls themselves (to prevent recursion).",
          "Semantic RAG injection is additive — it runs on top of the Context Store injection, so both environment context and knowledge base passages are available to every AI call simultaneously.",
        ],
      },
    ],
  },
  {
    id: "ai-governance",
    icon: ShieldCheck,
    title: "AI Governance & Safety",
    badge: "Updated",
    color: "text-teal-400",
    articles: [
      {
        title: "AI Governance Overview",
        content: [
          "Every AI call across all 76+ endpoints is logged in the AI Audit Log — module, endpoint, model used, provider, token count, latency, input/output, hallucination risk, and injection detection result.",
          "Access the full governance suite at sidebar → AI Governance → AI Governance.",
          "The KPI dashboard shows: total AI calls, flagged outputs, hallucination risk distribution, prompt injection attempts blocked, human review queue size, and quality trend.",
          "The Audit Log table has expandable rows showing full prompt, response, quality review result, and any flags raised.",
        ],
      },
      {
        title: "Context Store & RAG Injection",
        content: [
          "The Context Store (AI Governance → Context & RAG tab) captures every AI interaction that scores above the quality threshold.",
          "Scoring thresholds: ≥75 → stored; ≥85 → approved for injection (auto-prepended to future AI calls in the same module as factual grounding); ≥90 → promoted as a drift baseline.",
          "The RAG tab shows per-module injection counts, which entries are actively being injected, and an JSONL export of the full context store.",
          "You can manually approve or promote any entry, and view the full content of any stored interaction in an expandable response viewer.",
        ],
      },
      {
        title: "Fine-tune Dataset Curator",
        content: [
          "The 'Fine-tune' tab (AI Governance → Fine-tune) turns your highest-quality AI interactions into a fine-tuning dataset.",
          "All approved context store entries (score ≥85) appear here as candidate prompt/response training pairs. Use Include / Exclude toggles to curate quality, and Edit to correct any pair before export.",
          "AI Enhance: Click the 'AI Enhance' button (wand icon) on any entry to have HOLOCRON AI automatically rewrite the assistant response for clarity, structure, and technical completeness. The improved response loads into the edit form — review it, adjust if needed, and save.",
          "Export JSONL: Click 'Export JSONL' to download all included pairs in standard chat-completion format (system / user / assistant messages). The file is immediately usable with: Unsloth (LoRA fine-tuning, free GPU), Axolotl (QLoRA, multi-GPU), or the OpenAI fine-tuning API.",
          "The self-improving loop: ingest documents → AI calls get grounded → high-quality calls are curated → export a fine-tune dataset → train a specialised model → point any module's AI provider to that model.",
        ],
      },
      {
        title: "Hallucination Detection & Circuit Breakers",
        content: [
          "Every AI output is scored by a 6-factor hallucination risk model: placeholder text detection, hedging language, metric claim verification, temporal claim analysis, self-contradiction detection, and schema compliance.",
          "An independent AI Quality Reviewer runs automatically in the background (800ms after every meaningful AI response). Clean outputs are sampled at 25%; flagged or risky outputs are always reviewed.",
          "Circuit Breakers: If any module receives 3 consecutive quality failures (score < 60 or flagged), the circuit trips. While open, a corrective prompt patch is automatically prepended to every AI call in that module, enforcing fact-grounding and uncertainty disclosure.",
          "When the circuit trips, an ITIL Incident (severity: critical or high) is auto-created with full context. The circuit resets automatically when quality recovers (score ≥ 75 and passed).",
          "The Quality Monitor tab shows per-module scorecards, trend direction (improving/stable/declining), and AI-generated corrective action suggestions.",
        ],
      },
      {
        title: "Prompt Injection Protection",
        content: [
          "All AI endpoints are protected by a 12-pattern regex injection shield running before every AI call.",
          "Patterns covered: ignore/forget instructions, role-override (you are now...), DAN mode, jailbreak, override system/prompt/constraint, [SYSTEM] injection, new instruction prefix, bypass filter/safety, pretend/act-as.",
          "Blocked attempts are logged with the matched pattern, user ID, module, and full input — visible in the AI Governance Audit Log.",
          "The Detection Test Bench (AI Governance → Test tab) allows security teams to validate the injection shield is working correctly.",
        ],
      },
    ],
  },
  {
    id: "conclave",
    icon: Atom,
    title: "Holocron Conclave",
    badge: "New",
    color: "text-indigo-400",
    articles: [
      {
        title: "What is Conclave?",
        content: [
          "Conclave is HOLOCRON AI's multi-agent adversarial deliberation system. It eliminates single-model bias and hallucination by making 5 specialist AI agents debate your most consequential decisions before any action is taken.",
          "Use Conclave for: major architectural decisions, high-risk change requests, strategic IT investments, incident post-mortems, or any decision where a single AI opinion is insufficient.",
          "Access Conclave at sidebar → AI Governance → Conclave.",
        ],
      },
      {
        title: "How a Conclave Works",
        content: [
          "1. Create a Conclave: Enter a topic, context, and domain (infrastructure, security, ITSM, financial, etc.).",
          "2. Deliberation (Round 1 & 2): 5 agents run in parallel — Advocate (makes the case for action), Critic (challenges assumptions), Risk Assessor (quantifies risks), Pragmatist (evaluates feasibility), Ethicist (considers ethical/compliance implications). Each agent produces arguments, a stance, key points, and an agreement score (0–100).",
          "3. Consensus: A Synthesizer agent reads all arguments across both rounds and builds a structured consensus — decision, confidence level, key agreements, unresolved tensions, and recommended actions.",
          "4. Execute: The platform executes the decision (or routes it to the appropriate module for human approval).",
          "5. Evaluate: An independent evaluator agent reviews the decision quality after execution, scoring reasoning, completeness, and outcome alignment.",
          "All Conclave messages and outcomes are stored and audited through the AI Governance system.",
        ],
      },
    ],
  },
  {
    id: "command-control",
    icon: Terminal,
    title: "Command Control Center",
    color: "text-orange-400",
    articles: [
      {
        title: "Overview",
        content: [
          "The Command Control Center (CCC) is HOLOCRON AI's OS-aware multi-asset command dispatch system. Access it via sidebar → Command Center.",
          "The Command Catalog stores reusable scripts with a Draft → Dry Run → Published lifecycle. All commands support parameterized variables, scheduling, and rollback capabilities.",
          "Commands are scoped by domain-based RBAC — users only see and execute commands matching their asset type permissions.",
          "The 4-Eyes Approval Gate requires a second authorized user to approve high-risk commands before execution.",
        ],
      },
      {
        title: "AI Features in CCC",
        content: [
          "NLP Command Composer: Describe what you want to do in plain English, and AI generates a production-grade script with correct syntax for the target OS and protocol.",
          "AI Command Review (KB-First Cache): Click 'AI Review' on any Command Catalog entry to get an AI quality verdict — score, issues, suggestions, and a pass/fail decision. Results are cached via the Knowledge Base to reduce repeated AI calls.",
          "AI Agentic Debug Loop: When a command fails, click 'AI Debug' to initiate a full diagnostic cycle. The AI identifies the root cause, generates a corrected script, and offers options to apply the fix or re-dispatch.",
          "AI Output Analysis: After any command executes, AI can analyze the output for anomalies, errors, and improvement opportunities.",
        ],
      },
    ],
  },
  {
    id: "mdm",
    icon: MonitorSmartphone,
    title: "Mobile Device Management",
    color: "text-green-400",
    articles: [
      {
        title: "Android & iOS Fleet Management",
        content: [
          "HOLOCRON AI provides full MDM for Android (via Termux Probe Agent) and iOS (via a-Shell Probe + Shortcuts).",
          "Access MDM at Infrastructure → Mobile Device.",
          "Features: Device enrollment, live inventory, remote lock/wipe/locate/message, application management, and compliance policy enforcement.",
          "AI-Generated Compliance Policies: Describe your compliance requirements and AI generates MDM policy configurations — passcode rules, encryption requirements, app whitelist/blacklist, network restrictions.",
          "The MDM probe agents integrate with the same AI Agent Scan system — run security scans on mobile devices exactly as you would on servers.",
        ],
      },
    ],
  },
  {
    id: "bcpdrp",
    icon: FileText,
    title: "BCP / DRP",
    color: "text-amber-400",
    articles: [
      {
        title: "AI-Generated Business Continuity",
        content: [
          "Access BCP/DRP at sidebar → BCP / DRP.",
          "Business Impact Analysis (BIA): AI quantifies operational and financial impact with RTO/RPO targets for every critical process — derived from your live CMDB and infrastructure data, not generic templates.",
          "Plan Generation: AI writes complete BCP and DRP documents from live infrastructure context, covering recovery procedures, escalation chains, communication plans, and testing schedules.",
          "Drill Management: Schedule and track continuity drills. AI evaluates drill results and generates improvement recommendations.",
          "Live Integration: When a monitored event crosses a criticality threshold, HOLOCRON AI automatically evaluates BCP relevance, activates the relevant recovery procedures, and tracks mean-time-to-recovery in real time — no manual BCP invocation required.",
        ],
      },
    ],
  },
  {
    id: "faq",
    icon: HelpCircle,
    title: "FAQ & Troubleshooting",
    color: "text-purple-400",
    articles: [
      {
        title: "Common Questions",
        content: [
          "Q: Why is an AI feature returning a generic error?\nA: Check the AI Governance → Audit Log for the specific call. A circuit breaker may have tripped for that module (Quality Monitor tab). Manual circuit reset is available via the 'Reset Circuit' button.",
          "Q: How do I switch to a free LLM provider?\nA: Go to Settings → AI Providers. Add your API key for Groq, Gemini, or another provider and set it as default. The platform uses it immediately for all subsequent AI calls.",
          "Q: Can I run HOLOCRON AI without any external AI API key?\nA: Yes — if you have Ollama running locally, set OLLAMA_BASE_URL as an environment secret and the platform will use your local models for all AI calls at zero API cost.",
          "Q: How do I restrict which commands a user can run?\nA: Command scope is controlled by RBAC in the Command Control Center. Set the domain for each command (e.g. Windows, Linux, Network). Users only see commands matching their assigned asset domains.",
          "Q: What does the Agent Scan cover?\nA: The 5-domain scan covers: Vulnerability (CVEs, patches), Compliance (NIST, CIS, ISO 27001), Security KPIs (patch compliance %, config compliance %), Penetration Testing (whitebox, graybox, blackbox simulations), and Application Discovery. The Orchestrator Agent synthesizes all findings into a single risk score (0–100).",
          "Q: How do I raise a Conclave for a specific change request?\nA: Open the Change in Change Management, then navigate to Conclave and create a new session with the change details as context. The Conclave outcome can be attached to the change record.",
        ],
      },
    ],
  },
];

function SectionAccordion({ section }: { section: Section }) {
  const [openArticles, setOpenArticles] = useState<Set<number>>(new Set([0]));

  const toggle = (i: number) => {
    setOpenArticles(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {section.articles.map((article, i) => (
        <div key={i} className="border border-border/40 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-accent/30 transition-colors"
            onClick={() => toggle(i)}
            data-testid={`button-article-${section.id}-${i}`}
          >
            <span className="text-sm font-medium">{article.title}</span>
            {openArticles.has(i)
              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            }
          </button>
          {openArticles.has(i) && (
            <div className="px-4 pb-4 space-y-2 bg-accent/10">
              {article.content.map((para, j) => (
                <p key={j} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function UserManual() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filteredSections = SECTIONS.map(section => ({
    ...section,
    articles: section.articles.filter(a =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.some(c => c.toLowerCase().includes(search.toLowerCase()))
    ),
  })).filter(s => !search || s.articles.length > 0);

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">User Manual</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Complete reference guide for the HOLOCRON AI platform — all modules, AI features, and configuration.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">v2.1</Badge>
            <Badge variant="outline" className="text-xs text-teal-400 border-teal-500/30">Updated March 2026</Badge>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search the manual..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-manual"
          />
        </div>

        {!search && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(prev => prev === section.id ? null : section.id);
                  setTimeout(() => document.getElementById(`section-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  activeSection === section.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/40 hover:border-border/70 hover:bg-accent/20"
                }`}
                data-testid={`button-nav-${section.id}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <section.icon className={`h-4 w-4 ${section.color} shrink-0`} />
                  {section.badge && (
                    <Badge className="text-[9px] px-1.5 py-0 h-4" variant="secondary">{section.badge}</Badge>
                  )}
                </div>
                <p className="text-xs font-medium leading-tight">{section.title}</p>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {filteredSections.map(section => (
            <Card key={section.id} id={`section-${section.id}`} className="border-border/50" data-testid={`card-section-${section.id}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`h-9 w-9 rounded-xl border border-border/50 bg-accent/20 flex items-center justify-center shrink-0`}>
                    <section.icon className={`h-4 w-4 ${section.color}`} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold">{section.title}</h2>
                    {section.badge && (
                      <Badge variant="secondary" className="text-[10px]">{section.badge}</Badge>
                    )}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">{section.articles.length} article{section.articles.length !== 1 ? "s" : ""}</span>
                </div>
                <SectionAccordion section={section} />
              </CardContent>
            </Card>
          ))}
          {filteredSections.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No articles match your search</p>
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl border border-border/40 bg-accent/10 flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">ITIL Knowledge Base</p>
            <p>For detailed ITIL process documentation, incident playbooks, and workaround articles, visit the <strong>Knowledge Base</strong> module in the ITSM sidebar section. The Knowledge Base is a live, editable article repository for your team — distinct from this platform manual.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
