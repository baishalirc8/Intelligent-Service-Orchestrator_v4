import type { Express } from "express";
import { createServer, type Server } from "http";
import { readFileSync } from "fs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { EventEmitter } from "events";
import { storage } from "./storage";
import { getProviderAdapter } from "./validation-mock-adapter";
import { insertIncidentSchema, insertServiceRequestSchema, insertSecurityEventSchema, insertChatMessageSchema, insertProblemSchema, insertChangeRequestSchema, insertServiceCatalogItemSchema, insertKnowledgeArticleSchema, insertSlaDefinitionSchema, insertCmdbItemSchema, insertCmdbRelationshipSchema, insertConnectorSchema, insertPlaybookSchema, insertPlaybookExecutionSchema, insertTelemetryMetricSchema, insertRoleSubscriptionSchema, insertDiscoveryCredentialSchema, insertDiscoveryProbeSchema, insertDiscoveredAssetSchema, insertMonitoredApplicationSchema, insertApplicationTopologySchema, insertServiceMetricSchema, insertServiceMetricAssignmentSchema, insertMissionCriticalGroupSchema, insertProbeTypeSchema, insertAiProviderSchema, insertProbeClusterNodeSchema, insertBcpPlanSchema, insertDrpPlanSchema, insertBiaEntrySchema, insertRiskAssessmentSchema, insertDrillSchema, insertReviewSchema, insertKnownErrorSchema, insertSlaBreachSchema, insertCsiRegisterSchema, insertReleaseSchema, insertReleaseItemSchema, insertServiceReadingSchema, HARDWARE_TIERS, insertServiceFinancialSchema, insertSupplierSchema, insertSupplierContractSchema, insertDeploymentSchema, insertStakeholderSchema, insertServiceReviewSchema, insertFlyguysOperatorSchema, insertFlyguysFleetSchema, insertFlyguysRequestSchema, insertFlyguaysBidSchema, insertFlyguysProjectSchema, insertFlyguysDeliverableSchema, insertFlyguysTransactionSchema } from "@shared/schema";
import { seedDatabase } from "./seed";
import { seedNetworkScenario } from "./seed-network-scenario";
import { seedDiscoveryScenario, seedAgentPerformanceMetrics, seedAgentNotifications, seedProbeTypes, seedMobileProbeTypes } from "./seed-discovery-scenario";
import { requireAuth } from "./auth";
import { getSalaryMultiplier, COUNTRIES } from "@shared/countries";
import { IT_GOALS, generateRecommendations } from "./recommendation-engine";
import { detectUnmatchedNeeds, buildCustomRole } from "./custom-role-generator";
import { logIngestBuffer, checkRateLimit, incrementSourceCounter, startLogPipeline, getLogPipelineStats } from "./log-pipeline";
import { kafkaSend, kafkaEnabled, stopKafkaPipeline } from "./kafka-pipeline";

// ─── AI Remediation — Circuit Breaker Store ───────────────────────────────────
// In-memory per-module circuit state. Persists for the server lifetime;
// survives across requests but resets on process restart (acceptable for MVP).
interface CircuitBreakerState {
  module: string;
  consecutiveFailures: number;
  circuitOpen: boolean;
  openedAt: Date | null;
  promptPatch: string;          // injected as a prefix to every system prompt while open
  autoIncidentId: number | null; // the ITIL incident created when circuit opened
  lastScore: number | null;
  lastReviewedAt: Date | null;
  tripReason: string;
}
const circuitBreakers = new Map<string, CircuitBreakerState>();

function getOrInitCircuit(module: string): CircuitBreakerState {
  if (!circuitBreakers.has(module)) {
    circuitBreakers.set(module, {
      module,
      consecutiveFailures: 0,
      circuitOpen: false,
      openedAt: null,
      promptPatch: "",
      autoIncidentId: null,
      lastScore: null,
      lastReviewedAt: null,
      tripReason: "",
    });
  }
  return circuitBreakers.get(module)!;
}

// Called after each quality review result to update the circuit
async function updateCircuitBreaker(
  module: string, score: number, status: "passed" | "flagged",
  userId: string, endpoint: string
): Promise<void> {
  const cb = getOrInitCircuit(module);
  cb.lastScore = score;
  cb.lastReviewedAt = new Date();

  if (status === "flagged" || score < 60) {
    cb.consecutiveFailures++;
    // Trip the circuit after 3 consecutive failures
    if (cb.consecutiveFailures >= 3 && !cb.circuitOpen) {
      cb.circuitOpen = true;
      cb.openedAt = new Date();
      cb.tripReason = score < 60
        ? `Quality score dropped to ${score}/100 for 3+ consecutive outputs`
        : `Output flagged for quality issues 3 consecutive times`;
      // Build a corrective prompt patch based on the module
      cb.promptPatch = buildPromptPatch(module, score);
      // Auto-create an ITIL incident
      try {
        const incident = await storage.createIncident({
          title: `AI Quality Circuit Breaker Tripped — ${module}`,
          description: `The circuit breaker for the "${module}" AI module has been automatically triggered after ${cb.consecutiveFailures} consecutive quality failures.\n\nTrip reason: ${cb.tripReason}\n\nLast quality score: ${score}/100\n\nA corrective prompt patch has been injected. Human review is recommended before resetting the circuit.`,
          severity: score < 45 ? "critical" : "high",
          status: "open",
          category: "AI Governance",
          source: "ai-governance",
        });
        cb.autoIncidentId = incident.id;
      } catch { /* never break the flow */ }
    }
  } else if (status === "passed" && score >= 75) {
    // Quality restored — reset consecutive failures, auto-close circuit
    cb.consecutiveFailures = 0;
    if (cb.circuitOpen) {
      cb.circuitOpen = false;
      cb.openedAt = null;
      cb.promptPatch = "";
      cb.tripReason = "";
      // Note: we intentionally leave autoIncidentId so the UI can still reference it
    }
  }
}

function buildPromptPatch(module: string, score: number): string {
  const base = `[QUALITY GUARDRAIL ACTIVE — Circuit breaker tripped for module "${module}" after repeated quality failures (last score: ${score}/100). Apply the following remediation rules to ALL responses in this module:]
1. Do NOT speculate or infer facts that are not explicitly provided in the context
2. If you are uncertain about any claim, explicitly state the uncertainty
3. Keep every response concise, factual, and directly relevant to the request
4. If you cannot provide a high-quality answer, say so rather than producing a low-quality one
5. Every factual statement must be traceable to the provided context or domain knowledge
[END GUARDRAIL]

`;
  return base;
}

const AI_PRICE_MIN = 1000;
const AI_PRICE_MAX = 5000;
function clampAiPrice(price: number | null): number | null {
  if (price === null || price === 0) return price;
  return Math.min(AI_PRICE_MAX, Math.max(AI_PRICE_MIN, price));
}

/**
 * Decode HTML entities that LLMs sometimes inject into generated scripts.
 * e.g. &lt; → <  |  &gt; → >  |  &amp; → &  |  &quot; → "  |  &#39; → '
 * These corrupt PowerShell and bash scripts if not decoded before execution.
 */
function decodeScriptEntities(script: string): string {
  return script
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&amp;/g,  "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'");
}

import { z } from "zod";

const validSeverities = ["critical", "high", "medium", "low"] as const;
const validAgentStatuses = ["active", "inactive"] as const;

const patchIncidentSchema = z.object({
  status: z.enum(["open", "investigating", "in_progress", "resolved"]).optional(),
  severity: z.enum(validSeverities).optional(),
  resolvedAt: z.string().datetime().optional().nullable(),
  assignedAgentId: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
  problemId: z.string().optional().nullable(),
}).strict();

const patchSRSchema = z.object({
  status: z.enum(["pending", "assigned", "in_progress", "on_hold", "pending_approval", "fulfilled", "resolved", "cancelled"]).optional(),
  priority: z.enum(validSeverities).optional(),
  resolvedAt: z.string().datetime().optional().nullable(),
  assignedAgentId: z.string().optional().nullable(),
  assignedUserId: z.string().optional().nullable(),
}).strict();

const patchAgentSchema = z.object({ status: z.enum(validAgentStatuses).optional() }).strict();

const patchProblemSchema = z.object({
  status: z.enum(["open", "investigating", "root_cause_identified", "resolved"]).optional(),
  priority: z.enum(validSeverities).optional(),
  rootCause: z.string().optional().nullable(),
  workaround: z.string().optional().nullable(),
  knownError: z.boolean().optional(),
  resolvedAt: z.string().datetime().optional().nullable(),
}).strict();

const patchChangeRequestSchema = z.object({
  status: z.enum(["draft", "submitted", "under_review", "approved", "rejected", "scheduled", "implemented", "closed", "failed", "cancelled"]).optional(),
  approvedBy: z.string().optional().nullable(),
  implementedBy: z.string().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
}).strict();

const patchKnowledgeArticleSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  viewCount: z.number().optional(),
  helpfulCount: z.number().optional(),
}).strict();

const patchBcpPlanSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "under_review", "approved", "active", "expired", "archived"]).optional(),
  category: z.string().optional(),
  businessImpactLevel: z.enum(["critical", "high", "medium", "low"]).optional(),
  rtoHours: z.number().optional(),
  rpoHours: z.number().optional(),
  criticalProcesses: z.array(z.string()).optional(),
  recoveryStrategy: z.string().optional(),
  stakeholders: z.array(z.string()).optional(),
  lastTestedAt: z.string().datetime().optional().nullable(),
  nextReviewDate: z.string().datetime().optional().nullable(),
  approvedBy: z.string().optional().nullable(),
  approvedAt: z.string().datetime().optional().nullable(),
  owner: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
}).strict();

const patchDrpPlanSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "under_review", "approved", "active", "testing", "expired", "archived"]).optional(),
  disasterType: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  rtoHours: z.number().optional(),
  rpoHours: z.number().optional(),
  affectedSystems: z.array(z.string()).optional(),
  recoveryProcedures: z.string().optional(),
  failoverType: z.enum(["automatic", "manual", "semi_automatic"]).optional(),
  failoverTarget: z.string().optional().nullable(),
  backupLocation: z.string().optional().nullable(),
  lastTestedAt: z.string().datetime().optional().nullable(),
  testResult: z.enum(["passed", "failed", "partial", "not_tested"]).optional(),
  nextTestDate: z.string().datetime().optional().nullable(),
  bcpPlanId: z.string().optional().nullable(),
  owner: z.string().optional(),
}).strict();

const patchBiaEntrySchema = z.object({
  businessFunction: z.string().optional(),
  department: z.string().optional(),
  criticality: z.enum(["critical", "high", "medium", "low"]).optional(),
  mtdHours: z.number().optional(),
  rtoHours: z.number().optional(),
  rpoHours: z.number().optional(),
  financialImpactPerHour: z.number().optional(),
  dependencies: z.array(z.string()).optional(),
  workaroundAvailable: z.boolean().optional(),
  workaroundDescription: z.string().optional().nullable(),
  linkedBcpPlanId: z.string().optional().nullable(),
}).strict();

const patchRiskAssessmentSchema = z.object({
  threatName: z.string().optional(),
  threatCategory: z.string().optional(),
  likelihood: z.number().min(1).max(5).optional(),
  impact: z.number().min(1).max(5).optional(),
  riskScore: z.number().optional(),
  currentControls: z.string().optional(),
  residualRisk: z.enum(["low", "medium", "high", "critical"]).optional(),
  mitigationStrategy: z.string().optional(),
  riskOwner: z.string().optional(),
  status: z.enum(["identified", "mitigated", "accepted", "transferred"]).optional(),
  linkedBcpPlanId: z.string().optional().nullable(),
}).strict();

const patchDrillSchema = z.object({
  title: z.string().optional(),
  drillType: z.string().optional(),
  linkedPlanId: z.string().optional().nullable(),
  linkedPlanType: z.string().optional().nullable(),
  scheduledDate: z.string().optional(),
  executedDate: z.string().optional().nullable(),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
  participants: z.array(z.string()).optional(),
  scenario: z.string().optional(),
  findings: z.string().optional().nullable(),
  lessonsLearned: z.string().optional().nullable(),
  result: z.enum(["pending", "passed", "failed", "partial"]).optional(),
  nextDrillDate: z.string().optional().nullable(),
}).strict();

const patchReviewSchema = z.object({
  linkedPlanId: z.string().optional().nullable(),
  linkedPlanType: z.string().optional().nullable(),
  reviewType: z.string().optional(),
  reviewDate: z.string().optional(),
  reviewer: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  findings: z.string().optional().nullable(),
  recommendations: z.string().optional().nullable(),
  changesRequired: z.boolean().optional(),
  changesDescription: z.string().optional().nullable(),
  nextReviewDate: z.string().optional().nullable(),
}).strict();

const patchCmdbItemSchema = z.object({
  status: z.enum(["active", "maintenance", "decommissioned", "retired"]).optional(),
  owner: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  osVersion: z.string().optional().nullable(),
}).strict();

const patchConnectorSchema = z.object({
  status: z.enum(["configured", "active", "error", "disabled"]).optional(),
  discoveredAssets: z.number().optional(),
  scanInterval: z.number().optional(),
}).strict();

const patchPlaybookSchema = z.object({
  enabled: z.boolean().optional(),
  executionCount: z.number().optional(),
}).strict();

/* ── Provider registry ─────────────────────────────────────────────────────── */

const PROVIDER_BASE_URLS: Record<string, string> = {
  // ── Free / open-weight first (priority order) ──
  ollama:       "http://localhost:11434/v1",           // local SLM, completely free
  gemini:       "https://generativelanguage.googleapis.com/v1beta/openai/", // free tier
  grok:         "https://api.x.ai/v1",                // xAI free tier
  groq:         "https://api.groq.com/openai/v1",     // free inference
  mistral:      "https://api.mistral.ai/v1",          // free tier (mistral-tiny/small)
  openrouter:   "https://openrouter.ai/api/v1",       // free models available
  together:     "https://api.together.xyz/v1",        // free starter credits
  huggingface:  "https://api-inference.huggingface.co/v1", // free inference API
  // ── Paid (last resort) ──
  anthropic:    "https://api.anthropic.com/v1/",
  openai:       "https://api.openai.com/v1",
};

const PROVIDER_MODELS: Record<string, string[]> = {
  ollama:      ["llama3.2:3b", "llama3.2:1b", "llama3.1:8b", "llama3.1:70b", "phi3.5", "phi3:mini", "gemma2:2b", "gemma2:9b", "qwen2.5:3b", "qwen2.5:7b", "mistral:7b", "mixtral:8x7b", "deepseek-r1:7b", "deepseek-r1:1.5b", "nomic-embed-text"],
  gemini:      ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"],
  grok:        ["grok-3-mini", "grok-3-mini-fast", "grok-3", "grok-2-1212", "grok-2-vision-1212"],
  groq:        ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma2-9b-it", "gemma-7b-it"],
  mistral:     ["mistral-small-latest", "mistral-small-2503", "open-mistral-nemo", "open-mixtral-8x7b", "open-mistral-7b"],
  openrouter:  ["meta-llama/llama-3.2-3b-instruct:free", "meta-llama/llama-3.1-8b-instruct:free", "google/gemma-2-9b-it:free", "mistralai/mistral-7b-instruct:free", "microsoft/phi-3-mini-128k-instruct:free", "qwen/qwen-2.5-7b-instruct:free", "deepseek/deepseek-r1:free"],
  together:    ["meta-llama/Llama-3.2-3B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "mistralai/Mistral-7B-Instruct-v0.3", "google/gemma-2b-it", "Qwen/Qwen2.5-7B-Instruct-Turbo"],
  huggingface: ["microsoft/Phi-3.5-mini-instruct", "meta-llama/Meta-Llama-3-8B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3", "Qwen/Qwen2.5-7B-Instruct"],
  anthropic:   ["claude-3-5-haiku-20241022", "claude-3-haiku-20240307", "claude-3-5-sonnet-20241022", "claude-sonnet-4-20250514"],
  openai:      ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "o1-mini", "o1-preview"],
  custom:      [],
};

/* Priority waterfall for env-based free provider auto-detection.
   Order = cheapest/most-free first, OpenAI always last.             */
const FREE_PROVIDER_WATERFALL: Array<{
  type: string;
  label: string;
  envKeys: string[];
  baseURL: string;
  defaultModel: string;
  apiKeyRequired: boolean;
}> = [
  { type: "ollama",      label: "Ollama (local)",          envKeys: ["OLLAMA_BASE_URL"],                          baseURL: "http://localhost:11434/v1",                             defaultModel: "llama3.2:3b",                                  apiKeyRequired: false },
  { type: "gemini",      label: "Google Gemini",           envKeys: ["GEMINI_API_KEY", "GOOGLE_AI_API_KEY"],      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", defaultModel: "gemini-2.0-flash",                           apiKeyRequired: true  },
  { type: "grok",        label: "xAI Grok",                envKeys: ["XAI_API_KEY", "GROK_API_KEY"],              baseURL: "https://api.x.ai/v1",                                  defaultModel: "grok-3-mini",                                  apiKeyRequired: true  },
  { type: "groq",        label: "Groq",                    envKeys: ["GROQ_API_KEY"],                             baseURL: "https://api.groq.com/openai/v1",                        defaultModel: "llama-3.3-70b-versatile",                      apiKeyRequired: true  },
  { type: "mistral",     label: "Mistral AI",              envKeys: ["MISTRAL_API_KEY"],                          baseURL: "https://api.mistral.ai/v1",                             defaultModel: "mistral-small-latest",                         apiKeyRequired: true  },
  { type: "openrouter",  label: "OpenRouter",              envKeys: ["OPENROUTER_API_KEY"],                       baseURL: "https://openrouter.ai/api/v1",                          defaultModel: "meta-llama/llama-3.2-3b-instruct:free",        apiKeyRequired: true  },
  { type: "together",    label: "Together AI",             envKeys: ["TOGETHER_API_KEY"],                         baseURL: "https://api.together.xyz/v1",                           defaultModel: "meta-llama/Llama-3.2-3B-Instruct-Turbo",       apiKeyRequired: true  },
  { type: "huggingface", label: "Hugging Face",            envKeys: ["HUGGINGFACE_API_KEY", "HF_TOKEN"],          baseURL: "https://api-inference.huggingface.co/v1",              defaultModel: "microsoft/Phi-3.5-mini-instruct",               apiKeyRequired: true  },
];

function detectEnvProviders(): typeof FREE_PROVIDER_WATERFALL {
  return FREE_PROVIDER_WATERFALL.filter(p => {
    if (p.type === "ollama") return !!process.env.OLLAMA_BASE_URL;
    return p.envKeys.some(k => !!process.env[k]);
  });
}

async function getAiClient(userId: string, roleId?: string): Promise<{ client: any; model: string; providerName: string }> {
  const OpenAI = (await import("openai")).default;

  // ── 1. Role-specific provider (highest priority) ────────────────────────────
  if (roleId) {
    const role = await storage.getOrgRole(roleId);
    if (role?.aiProviderId) {
      const provider = await storage.getAiProvider(role.aiProviderId, userId);
      if (provider?.enabled) {
        const baseURL = provider.baseUrl || PROVIDER_BASE_URLS[provider.providerType] || undefined;
        return {
          client: new OpenAI({ apiKey: provider.apiKey || "ollama", ...(baseURL ? { baseURL } : {}) }),
          model: provider.model,
          providerName: `${provider.name} (role)`,
        };
      }
    }
  }

  // ── 2. User-configured default provider ────────────────────────────────────
  const dbProvider = await storage.getDefaultAiProvider(userId);
  if (dbProvider?.enabled) {
    const baseURL = dbProvider.baseUrl || PROVIDER_BASE_URLS[dbProvider.providerType] || undefined;
    return {
      client: new OpenAI({ apiKey: dbProvider.apiKey || "ollama", ...(baseURL ? { baseURL } : {}) }),
      model: dbProvider.model,
      providerName: dbProvider.name,
    };
  }

  // ── 3. Environment variable waterfall (free → paid) ─────────────────────────
  const available = detectEnvProviders();
  for (const p of available) {
    const apiKey = p.apiKeyRequired
      ? (p.envKeys.map(k => process.env[k]).find(Boolean) ?? "")
      : "ollama";  // Ollama uses a dummy key
    const baseURL = p.type === "ollama"
      ? (process.env.OLLAMA_BASE_URL || p.baseURL)
      : p.baseURL;
    try {
      const client = new OpenAI({ apiKey, baseURL });
      return { client, model: p.defaultModel, providerName: `${p.label} (env)` };
    } catch {
      continue;
    }
  }

  // ── 4. System OpenAI — absolute last resort ─────────────────────────────────
  const realKey = process.env.OPENAI_API_KEY;
  const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const integrationBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  const candidates: Array<{ client: any; model: string; providerName: string }> = [];
  if (realKey) {
    candidates.push({ client: new OpenAI({ apiKey: realKey }), model: "gpt-4o-mini", providerName: "OpenAI (system)" });
  }
  if (integrationKey && integrationBase) {
    candidates.push({ client: new OpenAI({ apiKey: integrationKey, baseURL: integrationBase }), model: "gpt-4o-mini", providerName: "OpenAI (Replit proxy)" });
  }

  if (candidates.length > 0) {
    const primary = candidates[0];
    if (candidates.length > 1) {
      (primary.client as any)._fallbackClients = candidates.slice(1);
    }
    return primary;
  }

  throw new Error(
    "No AI provider available. Configure a free provider (Ollama, Gemini, Grok, Groq) via environment variables or the AI Providers settings page."
  );
}

/* ══════════════════════════════════════════════════════════════════
   AI OBSERVABILITY — Detection helpers & logging wrapper
   ══════════════════════════════════════════════════════════════════ */

const INJECTION_PATTERNS = [
  /ignore\s+(previous|prior|above|all)\s+(instruction|prompt|rule)/i,
  /forget\s+(your|the|all)\s+(instruction|prompt|system|rule)/i,
  /you\s+are\s+now\s+(a |an |the )/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /act\s+as\s+(a |an |if )/i,
  /\bdan\b.*mode/i,
  /jailbreak/i,
  /override\s+(instruction|system|prompt|constraint)/i,
  /new\s+instruction\s*:/i,
  /\[system\]/i,
  /disregard\s+(all|previous|your)/i,
  /bypass\s+(filter|safety|restriction)/i,
];

function detectPromptInjection(messages: any[]): boolean {
  const combined = messages.map((m: any) =>
    typeof m.content === "string" ? m.content : JSON.stringify(m.content)
  ).join("\n");
  return INJECTION_PATTERNS.some(p => p.test(combined));
}

function assessHallucinationRisk(rawResponse: string, module: string, inputText?: string): { risk: "none" | "low" | "medium" | "high"; flags: string[] } {
  const flags: string[] = [];

  // 1. Placeholder / template text left in response
  if (/INSERT_|YOUR_COMPANY|example\.com|\[TODO\]|\[PLACEHOLDER\]|\[YOUR_/.test(rawResponse)) {
    flags.push("placeholder_text_detected");
  }

  // 2. Self-doubt language combined with definitive claims
  if (/i('m| am) not sure\b|i believe\b|i think\b|as of my (knowledge|training)/i.test(rawResponse)) {
    flags.push("hedging_language_in_authoritative_context");
  }

  // 3. Numeric inconsistency — if AI reports a number vastly different from input
  if (inputText) {
    const inputNums = [...inputText.matchAll(/\$?([\d,]+(?:\.\d+)?)/g)].map(m => parseFloat(m[1].replace(/,/g, "")));
    const outputNums = [...rawResponse.matchAll(/\$?([\d,]+(?:\.\d+)?)/g)].map(m => parseFloat(m[1].replace(/,/g, "")));
    const suspicious = outputNums.filter(n => n > 0 && inputNums.length > 0 && inputNums.every(i => i > 0 && (n / i > 100 || i / n > 100)));
    if (suspicious.length > 0) flags.push(`numeric_inconsistency:${suspicious.slice(0,2).join(",")}`);
  }

  // 4. Response too short (truncated / incomplete)
  if (rawResponse.trim().length < 20) flags.push("suspiciously_short_response");

  // 5. Repeated text (model loop / degeneration)
  const words = rawResponse.split(/\s+/);
  if (words.length > 30) {
    const unique = new Set(words.map(w => w.toLowerCase())).size;
    if (unique / words.length < 0.3) flags.push("high_repetition_detected");
  }

  // 6. JSON structure issues for JSON-expected modules
  const jsonModules = ["financial-management", "forensics", "siem", "capacity-planning", "bcp-drp", "csi"];
  if (jsonModules.includes(module)) {
    try { JSON.parse(rawResponse); } catch { flags.push("json_parse_failure"); }
  }

  const risk: "none" | "low" | "medium" | "high" =
    flags.length === 0 ? "none" :
    flags.length === 1 ? "low" :
    flags.length <= 2 ? "medium" : "high";

  return { risk, flags };
}

async function withAiRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isTransient =
        err.message?.includes("Connection error") ||
        err.message?.includes("ECONNREFUSED") ||
        err.message?.includes("fetch failed") ||
        err.message?.includes("ETIMEDOUT");
      if (attempt < maxAttempts - 1 && isTransient) {
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("AI provider unavailable after retries");
}

// ── Simple token overlap helper for drift scoring ─────────────────────────────
function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 3)
  );
}
function computeDriftScore(currentText: string, baselineTexts: string[]): number {
  if (baselineTexts.length === 0) return 0;
  const currentTokens = tokenize(currentText);
  if (currentTokens.size === 0) return 0;
  const baselineTokens = new Set<string>();
  baselineTexts.forEach(t => tokenize(t).forEach(tok => baselineTokens.add(tok)));
  const intersection = [...currentTokens].filter(t => baselineTokens.has(t)).length;
  const overlap = intersection / Math.max(currentTokens.size, baselineTokens.size);
  return Math.round((1 - overlap) * 100);
}

// Module-level embedding helper (used by callAiLogged and knowledge-base routes)
async function _getEmbedding(text: string): Promise<number[] | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8191) }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    return json.data[0].embedding as number[];
  } catch { return null; }
}

async function callAiLogged(
  openai: any,
  params: { model: string; messages: any[]; max_tokens?: number; temperature?: number; response_format?: any; stream?: boolean },
  ctx: { module: string; endpoint: string; userId: string; providerName: string }
): Promise<any> {
  const startMs = Date.now();

  // ── RAG Context Injection: prepend few-shot examples from the context store ──
  const isReviewerCall = ctx.module === "ai-quality-reviewer";
  let patchedMessages = params.messages;
  if (!isReviewerCall) {
    try {
      const ctxEntries = await storage.getAiContextEntriesForInjection(ctx.module, 2);
      if (ctxEntries.length > 0) {
        const examples = ctxEntries.map((e, i) =>
          `Example ${i + 1} (Quality score: ${e.qualityScore}/100):\nInput: ${e.userMessage?.slice(0, 400) ?? "(no input)"}\nOutput: ${e.assistantResponse.slice(0, 600)}`
        ).join("\n\n---\n\n");
        const injectionNote = `\n\n[HOLOCRON CONTEXT STORE — ${ctxEntries.length} verified high-quality example${ctxEntries.length > 1 ? "s" : ""} for this module. Use these as style and accuracy anchors. Do not copy verbatim — apply the same reasoning quality to the current request.]\n\n${examples}\n\n[END CONTEXT STORE]\n`;
        patchedMessages = params.messages.map((m: any, i: number) => {
          if (i === 0 && m.role === "system" && typeof m.content === "string") {
            return { ...m, content: m.content + injectionNote };
          }
          return m;
        });
        if (!params.messages.some((m: any) => m.role === "system")) {
          patchedMessages = [{ role: "system", content: injectionNote.trim() }, ...params.messages];
        }
        // Increment injection count for used entries (fire-and-forget)
        ctxEntries.forEach(e => {
          storage.updateAiContextEntry(e.id, { injectionCount: (e.injectionCount ?? 0) + 1 }).catch(() => {});
        });
      }
    } catch { /* never let context injection break the call */ }

    // ── Semantic RAG: inject relevant knowledge-base chunks ─────────────────
    try {
      const userMsg = params.messages.findLast((m: any) => m.role === "user");
      const queryText = typeof userMsg?.content === "string" ? userMsg.content.slice(0, 1000) : null;
      if (queryText) {
        const qEmbedding = await _getEmbedding(queryText);
        if (qEmbedding) {
          const chunks = await storage.semanticSearch(qEmbedding, 3);
          const relevant = chunks.filter((c: any) => c.similarity > 0.35);
          if (relevant.length > 0) {
            const ragNote = `\n\n[KNOWLEDGE BASE — ${relevant.length} relevant document excerpt${relevant.length > 1 ? "s" : ""} retrieved via semantic search. Use as factual grounding.]\n\n` +
              relevant.map((c: any, i: number) => `[${i + 1}] From "${c.documentTitle}" (similarity: ${(c.similarity * 100).toFixed(0)}%):\n${c.content.slice(0, 800)}`).join("\n\n") +
              `\n\n[END KNOWLEDGE BASE]\n`;
            patchedMessages = patchedMessages.map((m: any, i: number) => {
              if (i === 0 && m.role === "system" && typeof m.content === "string") {
                return { ...m, content: m.content + ragNote };
              }
              return m;
            });
            if (!patchedMessages.some((m: any) => m.role === "system")) {
              patchedMessages = [{ role: "system", content: ragNote.trim() }, ...patchedMessages];
            }
          }
        }
      }
    } catch { /* never let semantic search break the call */ }
  }

  // ── Circuit Breaker: inject prompt patch if circuit is open for this module ──
  const cb = getOrInitCircuit(ctx.module);
  if (cb.circuitOpen && cb.promptPatch) {
    patchedMessages = patchedMessages.map((m: any, i: number) => {
      if (i === 0 && m.role === "system" && typeof m.content === "string") {
        return { ...m, content: cb.promptPatch + m.content };
      }
      return m;
    });
    // If there's no system message, prepend one
    if (!patchedMessages.some((m: any) => m.role === "system")) {
      patchedMessages = [{ role: "system", content: cb.promptPatch.trim() }, ...patchedMessages];
    }
  }

  const injectionDetected = detectPromptInjection(patchedMessages);
  const inputText = patchedMessages.map((m: any) => typeof m.content === "string" ? m.content : "").join("\n").slice(0, 2000);
  const inputSummary = inputText.slice(0, 300);

  let completion: any;
  let status = "success";
  let schemaValid = true;
  let schemaErrors: string[] = [];
  let rawResponse = "";
  let hallucinationRisk: "none" | "low" | "medium" | "high" = "none";
  let hallucinationFlags: string[] = [];

  try {
    completion = await openai.chat.completions.create({ ...params, messages: patchedMessages });
    rawResponse = completion.choices?.[0]?.message?.content ?? "";

    // Validate JSON if response_format is json_object
    if (params.response_format?.type === "json_object" && rawResponse) {
      try { JSON.parse(rawResponse); } catch (e: any) { schemaValid = false; schemaErrors = [e.message]; status = "schema_invalid"; }
    }

    const { risk, flags } = assessHallucinationRisk(rawResponse, ctx.module, inputText);
    hallucinationRisk = risk;
    hallucinationFlags = flags;
    if (risk === "high") {
      status = "hallucination_flagged";
      // Auto-create ITIL incident for high hallucination risk (fire-and-forget)
      storage.createIncident({
        title: `High Hallucination Risk Detected — ${ctx.module}`,
        description: `A high-confidence hallucination was automatically detected in module "${ctx.module}" (endpoint: ${ctx.endpoint}).\n\nDetected flags: ${flags.join(", ") || "N/A"}\n\nOutput excerpt:\n${rawResponse.slice(0, 400)}\n\nThis incident was created automatically by the AI Governance system. Human review of the flagged output is required.`,
        severity: "high",
        status: "open",
        category: "AI Governance",
        source: "ai-governance",
      }).catch(() => {});
    }

  } catch (err: any) {
    const isQuotaOrAuth = err.status === 429 || err.status === 401 || err.status === 403;
    const fallbacks: any[] = (openai as any)._fallbackClients || [];
    if (isQuotaOrAuth && fallbacks.length > 0) {
      console.warn(`[callAiLogged] Primary provider failed (${err.status}), trying fallback…`);
      for (const fb of fallbacks) {
        try {
          completion = await fb.client.chat.completions.create({ ...params, model: fb.model, messages: patchedMessages });
          rawResponse = completion.choices?.[0]?.message?.content ?? "";
          ctx.providerName = fb.providerName;
          if (params.response_format?.type === "json_object" && rawResponse) {
            try { JSON.parse(rawResponse); } catch (e2: any) { schemaValid = false; schemaErrors = [e2.message]; status = "schema_invalid"; }
          }
          const hr = assessHallucinationRisk(rawResponse, ctx.module, inputText);
          hallucinationRisk = hr.risk; hallucinationFlags = hr.flags;
          status = hallucinationRisk === "high" ? "hallucination_flagged" : "success";
          break;
        } catch (fbErr: any) {
          console.error("[callAiLogged] Fallback also failed:", fbErr.message);
        }
      }
    }
    if (!completion) {
      status = "failed";
      rawResponse = err.message ?? "error";
      console.error("[callAiLogged] AI call failed:", {
        module: ctx.module, endpoint: ctx.endpoint,
        errorName: err.name, errorMsg: err.message,
        errorCode: err.code, errorStatus: err.status,
        cause: err.cause?.message ?? err.cause,
      });
    }
  }

  const latencyMs = Date.now() - startMs;
  const usage = completion?.usage;
  const riskFlags: string[] = [
    ...(injectionDetected ? ["prompt_injection"] : []),
    ...(!schemaValid ? ["schema_invalid"] : []),
    ...(hallucinationRisk === "high" ? ["high_hallucination_risk"] : []),
    ...(hallucinationRisk === "medium" ? ["medium_hallucination_risk"] : []),
  ];
  const requiresHumanReview = injectionDetected || hallucinationRisk === "high" || !schemaValid;

  // ── Real-time drift score: compare output against context-store baselines ──
  let driftScore = 0;
  if (rawResponse.length > 50 && !isReviewerCall) {
    try {
      const baselineEntries = await storage.getAiContextEntriesForInjection(ctx.module, 5);
      if (baselineEntries.length > 0) {
        driftScore = computeDriftScore(rawResponse, baselineEntries.map(e => e.assistantResponse));
      }
    } catch { /* never let drift calculation break the call */ }
  }

  // Fire-and-forget logging (never let logging failure break the AI response)
  storage.createAiAuditLog({
    userId: ctx.userId,
    module: ctx.module,
    endpoint: ctx.endpoint,
    model: params.model,
    providerName: ctx.providerName,
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
    latencyMs,
    schemaValid,
    hallucinationRisk,
    hallucinationFlags,
    promptInjectionDetected: injectionDetected,
    riskFlags,
    inputSummary,
    outputSummary: rawResponse.slice(0, 300),
    responseSchemaErrors: schemaErrors,
    status,
    requiresHumanReview,
    humanReviewStatus: requiresHumanReview ? "pending" : undefined,
    driftScore,
    qualityReviewStatus: "pending",
    qualityReviewResult: "",
    qualityReviewScore: 0,
    qualityReviewFlags: [],
  }).then((log) => {
    // Auto-trigger background quality review (never for the reviewer itself to avoid loops)
    const hasMeaningfulOutput = status === "success" && rawResponse.length > 120;
    // Always review flagged calls; sample 1-in-4 of clean calls
    const shouldSample = riskFlags.length > 0 || Math.random() < 0.25;
    if (!isReviewerCall && hasMeaningfulOutput && shouldSample) {
      // Delay slightly so the main response is returned first
      setTimeout(() => {
        runAutoQualityReview(log.id, rawResponse, ctx.module, ctx.endpoint, ctx.userId, inputSummary).catch(() => {});
      }, 800);
    } else if (!isReviewerCall) {
      // Mark as not applicable for short/failed calls
      storage.updateAiAuditLogQualityReview(log.id, {
        qualityReviewStatus: "skipped",
        qualityReviewResult: "",
        qualityReviewScore: 0,
        qualityReviewFlags: [],
      }).catch(() => {});
    }
  }).catch(() => {}); // never throw

  if (!completion) throw new Error(rawResponse || "AI call failed");
  return completion;
}

// ─── Auto Background Quality Reviewer ──────────────────────────────────────
async function runAutoQualityReview(logId: number, outputText: string, module: string, endpoint: string, userId: string, inputSummary?: string): Promise<void> {
  try {
    const { client: openai, model: aiModel, providerName } = await getAiClient(userId);

    const systemPrompt = `You are the Holocron AI Quality Reviewer — an independent, critical analyst that reviews AI-generated content for accuracy, logic, completeness, and quality.

Review the provided AI output and respond ONLY with a JSON object in this exact format:
{
  "score": <integer 0-100>,
  "status": "<passed|flagged>",
  "flags": ["<issue 1>", "<issue 2>"],
  "critique": "<detailed critique — what was good, what was problematic, what was missing>",
  "betterApproach": "<if score < 70, describe what a better approach would look like, otherwise empty string>"
}`;

    const completion = await callAiLogged(openai, {
      model: aiModel,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Review this AI-generated output:\n\nModule: ${module}\nEndpoint: ${endpoint}\n\nAI Output:\n${outputText.slice(0, 3000)}\n\nProvide a thorough quality review as a JSON object.`,
        },
      ],
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }, {
      module: "ai-quality-reviewer",
      endpoint: `auto-review-${module}`,
      userId,
      providerName,
    });

    const raw = completion.choices[0].message.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const score = typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : 50;
    const reviewStatus = parsed.status === "passed" ? "passed" : "flagged";
    const flags = Array.isArray(parsed.flags) ? parsed.flags.slice(0, 8) : [];
    const critique = parsed.critique || raw;
    const betterApproach = parsed.betterApproach || "";
    const fullResult = critique + (betterApproach ? `\n\nBetter Approach:\n${betterApproach}` : "");

    await storage.updateAiAuditLogQualityReview(logId, {
      qualityReviewStatus: reviewStatus,
      qualityReviewResult: fullResult,
      qualityReviewScore: score,
      qualityReviewFlags: flags,
    });

    // ── Auto-promote to Context Store if quality passes threshold ──
    if (score >= 75 && reviewStatus === "passed" && outputText.length > 120) {
      storage.createAiContextEntry({
        userId,
        module,
        endpoint,
        model: undefined,
        systemPrompt: undefined,
        userMessage: inputSummary ?? undefined,
        assistantResponse: outputText.slice(0, 4000),
        qualityScore: score,
        hallucinationRisk: "none",
        approvedForInjection: score >= 85, // auto-approve top tier; lower scores need manual approval
        injectionCount: 0,
        isDriftBaseline: score >= 90,
        tags: flags.length === 0 ? ["auto-promoted"] : ["auto-promoted", "has-flags"],
        sourceLogId: logId,
      }).catch(() => {});
    }

    // Update the circuit breaker for this module (fire-and-forget)
    updateCircuitBreaker(module, score, reviewStatus, userId, endpoint).catch(() => {});

  } catch {
    // Silently fail — never let QA review break the main flow
    storage.updateAiAuditLogQualityReview(logId, {
      qualityReviewStatus: "error",
      qualityReviewResult: "",
      qualityReviewScore: 0,
      qualityReviewFlags: [],
    }).catch(() => {});
  }
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****" + key.slice(-4);
  return key.slice(0, 4) + "****" + key.slice(-4);
}

function maskCredentials(creds: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    if (!v) { masked[k] = ""; continue; }
    const s = String(v);
    masked[k] = s.length > 6 ? "••••••" + s.slice(-4) : "••••••";
  }
  return masked;
}

function mergeCredentials(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v && !String(v).startsWith("••")) merged[k] = String(v);
  }
  return merged;
}

// ─── KB-first AI cache helpers ────────────────────────────────────────────────
// These enable the "KB-first, AI-second" pattern: before calling the LLM we
// check the knowledge base for a fresh matching result; on a miss the AI is
// called as usual and the result is written back so the next similar request
// is served from KB (0 tokens spent).

const KB_TTL_MS = {
  alert_analysis:    7  * 24 * 60 * 60 * 1000,  // 7 days  – alert patterns are stable
  alert_remediation: 7  * 24 * 60 * 60 * 1000,  // 7 days
  calibration:       7  * 24 * 60 * 60 * 1000,  // 7 days  – thresholds don't drift fast
  rca:               90 * 24 * 60 * 60 * 1000,  // 90 days – same event cluster = same RCA
};

async function kbLookup(
  cacheTag: string,
  ttlMs: number
): Promise<{ hit: boolean; content: string | null; articleId?: string }> {
  try {
    const article = await storage.getKnowledgeArticleByTag(cacheTag);
    if (!article) return { hit: false, content: null };
    const ageMs = Date.now() - new Date(article.updatedAt!).getTime();
    if (ageMs > ttlMs) return { hit: false, content: null };
    // Increment view count (fire-and-forget)
    storage.updateKnowledgeArticle(article.id, { viewCount: (article.viewCount || 0) + 1 }).catch(() => {});
    return { hit: true, content: article.content, articleId: article.id };
  } catch {
    return { hit: false, content: null };
  }
}

async function kbStore(
  cacheTag: string,
  title: string,
  content: string,
  userId: string,
  existingArticleId?: string
): Promise<void> {
  try {
    if (existingArticleId) {
      await storage.updateKnowledgeArticle(existingArticleId, { content });
    } else {
      await storage.createKnowledgeArticle({
        title,
        content,
        category: "ai_analysis",
        tags: ["ai_cache", cacheTag],
        status: "published",
        authorId: userId,
      });
    }
  } catch { /* non-fatal – KB write failure should never break the AI response */ }
}
// ─────────────────────────────────────────────────────────────────────────────

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  await seedDatabase();
  await seedNetworkScenario();
  await seedDiscoveryScenario();
  await seedProbeTypes();
  try {
    const [demoUser] = await db.select().from(users).where(eq(users.username, "demo"));
    if (demoUser) await seedMobileProbeTypes(demoUser.id);
  } catch (_) {}
  await seedAgentPerformanceMetrics();
  await seedAgentNotifications();

  // Start production log ingest pipeline (buffer, coalescer, retention scheduler, indexes)
  startLogPipeline();

  const aiCooldowns = new Map<string, number>();
  function isAiOnCooldown(key: string, cooldownMs: number): { blocked: boolean; remainingSec: number } {
    const lastRun = aiCooldowns.get(key) || 0;
    const elapsed = Date.now() - lastRun;
    if (elapsed < cooldownMs) {
      return { blocked: true, remainingSec: Math.ceil((cooldownMs - elapsed) / 1000) };
    }
    return { blocked: false, remainingSec: 0 };
  }
  function setAiCooldown(key: string) {
    aiCooldowns.set(key, Date.now());
  }
  setInterval(() => {
    const now = Date.now();
    const MAX_TTL = 60 * 60 * 1000;
    for (const [key, ts] of aiCooldowns) {
      if (now - ts > MAX_TTL) aiCooldowns.delete(key);
    }
  }, 10 * 60 * 1000);

  // ── Health / Readiness endpoints (Kubernetes liveness + readiness probes) ───
  // /health  — liveness probe: process is alive and serving
  // /ready   — readiness probe: DB is reachable, pipeline is running
  app.get(["/health", "/api/health"], (_req, res) => {
    const stats = getLogPipelineStats();
    res.json({
      status:    "ok",
      service:   "HOLOCRON AI",
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
      pipeline:  stats,
    });
  });

  app.get("/ready", async (_req, res) => {
    try {
      const { db } = await import("./storage");
      const { sql: rawSql } = await import("drizzle-orm");
      await db.execute(rawSql`SELECT 1`);
      res.json({ status: "ready", db: "connected", timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(503).json({ status: "not ready", db: "disconnected", error: err.message });
    }
  });

  app.get("/documentation", (_req, res) => {
    const filePath = process.cwd() + "/client/public/holocron-documentation.html";
    res.sendFile(filePath);
  });

  app.get("/user-manual", (_req, res) => {
    const filePath = process.cwd() + "/client/public/holocron-user-manual.html";
    res.sendFile(filePath);
  });

  app.get("/presentation", (_req, res) => {
    res.redirect(301, "/documentation");
  });

  app.get("/patent-exploration", (_req, res) => {
    const filePath = process.cwd() + "/client/public/holocron-patent-exploration.html";
    res.sendFile(filePath);
  });

  app.get("/api/countries", (_req, res) => {
    res.json(COUNTRIES);
  });

  app.post("/api/auth/complete-onboarding", requireAuth, async (req, res) => {
    await storage.completeOnboarding(req.user!.id);
    (req.user as any).onboardingCompleted = true;
    res.json({ success: true });
  });

  app.post("/api/auth/complete-tour", requireAuth, async (req, res) => {
    await storage.completeTour(req.user!.id);
    (req.user as any).tourCompleted = true;
    res.json({ success: true });
  });

  app.patch("/api/auth/country", requireAuth, async (req, res) => {
    const { country } = req.body;
    if (!country || typeof country !== "string") {
      return res.status(400).json({ message: "Country code is required" });
    }
    const valid = COUNTRIES.find(c => c.code === country);
    if (!valid) {
      return res.status(400).json({ message: "Invalid country code" });
    }
    await storage.updateUserCountry(req.user!.id, country);
    (req.user as any).country = country;
    res.json({ country, salaryMultiplier: valid.salaryMultiplier });
  });

  app.get("/api/user/module-preferences", requireAuth, async (req, res) => {
    try {
      const preferences = await storage.getModulePreferences(req.user!.id);
      res.json({ preferences });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch module preferences" });
    }
  });

  app.put("/api/user/module-preferences", requireAuth, async (req, res) => {
    try {
      const { preferences } = req.body;
      if (!preferences || typeof preferences !== "object") {
        return res.status(400).json({ message: "Invalid preferences payload" });
      }
      await storage.updateModulePreferences(req.user!.id, preferences);
      res.json({ preferences });
    } catch (err) {
      res.status(500).json({ message: "Failed to save module preferences" });
    }
  });

  app.get("/api/dashboard/stats", async (_req, res) => {
    res.json(await storage.getDashboardStats());
  });

  app.get("/api/agents", async (_req, res) => res.json(await storage.getAgents()));
  app.get("/api/agents/:id", async (req, res) => {
    const agent = await storage.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    res.json(agent);
  });
  app.patch("/api/agents/:id", async (req, res) => {
    const parsed = patchAgentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateAgent(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Agent not found" });
    res.json(updated);
  });

  app.get("/api/incidents/stats", async (_req, res) => {
    const all = await storage.getIncidents();
    const now = new Date();
    const total = all.length;
    const open = all.filter(r => r.status === "open").length;
    const investigating = all.filter(r => r.status === "investigating").length;
    const inProgress = all.filter(r => r.status === "in_progress").length;
    const resolved = all.filter(r => r.status === "resolved").length;
    const critical = all.filter(r => r.severity === "critical" && r.status !== "resolved").length;
    const resolvedWithTime = all.filter(r => r.resolvedAt && r.createdAt && r.status === "resolved");
    let mttrHours = 0;
    if (resolvedWithTime.length > 0) {
      const totalMs = resolvedWithTime.reduce((sum, r) => sum + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt!).getTime()), 0);
      mttrHours = Math.round((totalMs / resolvedWithTime.length) / (1000 * 60 * 60) * 10) / 10;
    }
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
    all.forEach(r => { bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1; });
    const byCategory = {} as Record<string, number>;
    all.forEach(r => { byCategory[r.category] = (byCategory[r.category] || 0) + 1; });
    const byStatus = {} as Record<string, number>;
    all.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    const last7d = all.filter(r => r.createdAt && new Date(r.createdAt) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length;
    const last30d = all.filter(r => r.createdAt && new Date(r.createdAt) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length;
    res.json({ total, open, investigating, inProgress, resolved, critical, mttrHours, bySeverity, byCategory, byStatus, last7d, last30d });
  });
  app.get("/api/leaderboard", async (_req, res) => {
    const [allIncidents, allSRs, allAgents] = await Promise.all([
      storage.getIncidents(),
      storage.getServiceRequests(),
      storage.getAgents(),
    ]);

    const agentMap = new Map(allAgents.map(a => [a.id, a]));

    const resolvedIncidents = allIncidents.filter(i => i.status === "resolved" && i.resolvedAt && i.createdAt);
    const resolvedSRs = allSRs.filter(sr => (sr.status === "fulfilled" || sr.status === "resolved") && sr.resolvedAt && sr.createdAt);

    interface AgentStats {
      agentId: string;
      name: string;
      icon: string;
      color: string;
      incidentsResolved: number;
      srsResolved: number;
      totalResolved: number;
      avgResolutionMs: number;
      fastestResolutionMs: number;
      criticalResolved: number;
      streak: number;
      xp: number;
      level: number;
      rank: string;
    }

    const statsMap = new Map<string, AgentStats>();

    function getOrCreate(agentId: string): AgentStats {
      if (statsMap.has(agentId)) return statsMap.get(agentId)!;
      const agent = agentMap.get(agentId);
      const entry: AgentStats = {
        agentId,
        name: agent?.name || "Unknown Agent",
        icon: agent?.icon || "Bot",
        color: agent?.color || "#8B5CF6",
        incidentsResolved: 0,
        srsResolved: 0,
        totalResolved: 0,
        avgResolutionMs: 0,
        fastestResolutionMs: Infinity,
        criticalResolved: 0,
        streak: 0,
        xp: 0,
        level: 1,
        rank: "Bronze",
      };
      statsMap.set(agentId, entry);
      return entry;
    }

    const resolutionTimes = new Map<string, number[]>();

    for (const inc of resolvedIncidents) {
      if (!inc.assignedAgentId) continue;
      const stats = getOrCreate(inc.assignedAgentId);
      stats.incidentsResolved++;
      stats.totalResolved++;
      const ms = new Date(inc.resolvedAt!).getTime() - new Date(inc.createdAt!).getTime();
      if (!resolutionTimes.has(inc.assignedAgentId)) resolutionTimes.set(inc.assignedAgentId, []);
      resolutionTimes.get(inc.assignedAgentId)!.push(ms);
      if (ms < stats.fastestResolutionMs) stats.fastestResolutionMs = ms;
      if (inc.severity === "critical") stats.criticalResolved++;
    }

    for (const sr of resolvedSRs) {
      if (!sr.assignedAgentId) continue;
      const stats = getOrCreate(sr.assignedAgentId);
      stats.srsResolved++;
      stats.totalResolved++;
      const ms = new Date(sr.resolvedAt!).getTime() - new Date(sr.createdAt!).getTime();
      if (!resolutionTimes.has(sr.assignedAgentId)) resolutionTimes.set(sr.assignedAgentId, []);
      resolutionTimes.get(sr.assignedAgentId)!.push(ms);
      if (ms < stats.fastestResolutionMs) stats.fastestResolutionMs = ms;
    }

    for (const [agentId, times] of resolutionTimes) {
      const stats = statsMap.get(agentId)!;
      stats.avgResolutionMs = times.reduce((a, b) => a + b, 0) / times.length;
    }

    const XP_PER_INCIDENT = 100;
    const XP_PER_SR = 50;
    const XP_PER_CRITICAL = 200;
    const SPEED_BONUS_THRESHOLD_MS = 2 * 60 * 60 * 1000;
    const XP_SPEED_BONUS = 75;
    const ranks = ["Bronze", "Silver", "Gold", "Platinum", "Diamond", "Legendary"];

    for (const stats of statsMap.values()) {
      let xp = stats.incidentsResolved * XP_PER_INCIDENT
        + stats.srsResolved * XP_PER_SR
        + stats.criticalResolved * XP_PER_CRITICAL;
      const times = resolutionTimes.get(stats.agentId) || [];
      const fastResolves = times.filter(t => t < SPEED_BONUS_THRESHOLD_MS).length;
      xp += fastResolves * XP_SPEED_BONUS;
      stats.xp = xp;
      stats.level = Math.max(1, Math.floor(xp / 500) + 1);
      const rankIdx = Math.min(ranks.length - 1, Math.floor((stats.level - 1) / 3));
      stats.rank = ranks[rankIdx];
      if (stats.fastestResolutionMs === Infinity) stats.fastestResolutionMs = 0;

      const sorted = [...resolvedIncidents, ...resolvedSRs]
        .filter(r => r.assignedAgentId === stats.agentId)
        .sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime());
      let streak = 0;
      const oneDay = 24 * 60 * 60 * 1000;
      for (let i = 0; i < sorted.length; i++) {
        const dayDiff = i === 0 ? 0 : new Date(sorted[i - 1].resolvedAt!).getTime() - new Date(sorted[i].resolvedAt!).getTime();
        if (dayDiff <= oneDay * 3) streak++;
        else break;
      }
      stats.streak = streak;
    }

    const leaderboard = Array.from(statsMap.values())
      .sort((a, b) => b.xp - a.xp)
      .map((s, i) => ({ ...s, position: i + 1 }));

    const totalResolved = resolvedIncidents.length + resolvedSRs.length;
    const allTimes = Array.from(resolutionTimes.values()).flat();
    const globalAvgMs = allTimes.length > 0 ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length : 0;
    const fastestOverall = allTimes.length > 0 ? Math.min(...allTimes) : 0;
    const totalXP = leaderboard.reduce((s, l) => s + l.xp, 0);

    res.json({
      leaderboard,
      summary: {
        totalResolved,
        globalAvgResolutionMs: globalAvgMs,
        fastestResolutionMs: fastestOverall,
        totalAgents: leaderboard.length,
        totalXP,
        topRank: leaderboard[0]?.rank || "N/A",
      },
    });
  });

  app.get("/api/incidents", async (_req, res) => res.json(await storage.getIncidents()));
  app.get("/api/incidents/:id", async (req, res) => {
    const incident = await storage.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });
    res.json(incident);
  });
  app.post("/api/incidents", async (req, res) => {
    const parsed = insertIncidentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const created = await storage.createIncident(parsed.data);
    const agents = await storage.getAgents();
    const incidentAgent = agents.find(a => a.type === "incident_manager");
    if (incidentAgent) {
      await storage.createAgentActivity({ agentId: incidentAgent.id, action: "Incident Auto-Triaged", details: `New incident created: "${parsed.data.title}" - classified as ${parsed.data.severity} severity`, relatedEntityType: "incident", relatedEntityId: created.id, autonomous: true });
    }
    res.status(201).json(created);
  });
  app.patch("/api/incidents/:id", async (req, res) => {
    const parsed = patchIncidentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getIncident(req.params.id);
    if (!existing) return res.status(404).json({ message: "Incident not found" });
    if (parsed.data.status) {
      const allowedTransitions: Record<string, string[]> = {
        open: ["investigating", "in_progress", "resolved"],
        investigating: ["in_progress", "resolved", "open"],
        in_progress: ["resolved", "investigating"],
        resolved: ["open"],
      };
      const allowed = allowedTransitions[existing.status] || [];
      if (!allowed.includes(parsed.data.status)) {
        return res.status(400).json({ message: `Invalid transition: ${existing.status} -> ${parsed.data.status}` });
      }
      if (["open", "investigating", "in_progress"].includes(parsed.data.status)) {
        parsed.data.resolvedAt = null;
      }
      if (parsed.data.status === "resolved" && !parsed.data.resolvedAt) {
        parsed.data.resolvedAt = new Date().toISOString();
      }
    }
    const updated = await storage.updateIncident(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Incident not found" });
    if (parsed.data.status) {
      const agents = await storage.getAgents();
      const incidentAgent = agents.find(a => a.type === "incident_manager");
      if (incidentAgent) {
        await storage.createAgentActivity({ agentId: incidentAgent.id, action: `Incident ${parsed.data.status === "resolved" ? "Resolved" : "Status Updated"}`, details: `Incident "${updated.title}" status changed to ${parsed.data.status}`, relatedEntityType: "incident", relatedEntityId: updated.id, autonomous: true });
      }
    }
    res.json(updated);
  });

  app.get("/api/service-requests/stats", async (_req, res) => {
    const all = await storage.getServiceRequests();
    const now = new Date();
    const total = all.length;
    const open = all.filter(r => ["pending", "assigned"].includes(r.status)).length;
    const inProgress = all.filter(r => ["in_progress", "on_hold", "pending_approval"].includes(r.status)).length;
    const fulfilled = all.filter(r => ["fulfilled", "resolved"].includes(r.status)).length;
    const cancelled = all.filter(r => r.status === "cancelled").length;
    const overdue = all.filter(r => r.slaDeadline && new Date(r.slaDeadline) < now && !["fulfilled", "resolved", "cancelled"].includes(r.status)).length;
    const resolved = all.filter(r => r.resolvedAt && r.createdAt && ["fulfilled", "resolved"].includes(r.status));
    let avgResolutionHours = 0;
    if (resolved.length > 0) {
      const totalMs = resolved.reduce((sum, r) => sum + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt!).getTime()), 0);
      avgResolutionHours = Math.round((totalMs / resolved.length) / (1000 * 60 * 60) * 10) / 10;
    }
    const withSla = all.filter(r => r.slaDeadline && ["fulfilled", "resolved"].includes(r.status) && r.resolvedAt);
    const metSla = withSla.filter(r => new Date(r.resolvedAt!) <= new Date(r.slaDeadline!));
    const slaComplianceRate = withSla.length > 0 ? Math.round((metSla.length / withSla.length) * 100) : 100;
    const byPriority = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
    all.forEach(r => { byPriority[r.priority] = (byPriority[r.priority] || 0) + 1; });
    const byType = {} as Record<string, number>;
    all.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
    const byStatus = {} as Record<string, number>;
    all.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    const byHandler = { ai: 0, human: 0, collaborative: 0 } as Record<string, number>;
    all.forEach(r => { const ht = (r as any).handlerType || "ai"; byHandler[ht] = (byHandler[ht] || 0) + 1; });
    const last30d = all.filter(r => r.createdAt && new Date(r.createdAt) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length;
    const last7d = all.filter(r => r.createdAt && new Date(r.createdAt) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length;
    res.json({ total, open, inProgress, fulfilled, cancelled, overdue, avgResolutionHours, slaComplianceRate, byPriority, byType, byStatus, byHandler, last30d, last7d });
  });
  app.get("/api/service-requests", async (_req, res) => res.json(await storage.getServiceRequests()));
  app.get("/api/service-requests/:id", async (req, res) => {
    const sr = await storage.getServiceRequest(req.params.id);
    if (!sr) return res.status(404).json({ message: "Service request not found" });
    res.json(sr);
  });
  app.post("/api/service-requests", async (req, res) => {
    const parsed = insertServiceRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const created = await storage.createServiceRequest(parsed.data);
    const agents = await storage.getAgents();

    const SR_HANDLER_CONFIG: Record<string, { handler: "ai" | "human" | "collaborative"; agentTypes: string[]; humanDepartments: string[] }> = {
      general: { handler: "ai", agentTypes: ["service_desk"], humanDepartments: [] },
      access_request: { handler: "ai", agentTypes: ["security_monitor", "service_desk"], humanDepartments: [] },
      password_reset: { handler: "ai", agentTypes: ["security_monitor", "service_desk"], humanDepartments: [] },
      software: { handler: "ai", agentTypes: ["patch_manager", "asset_manager", "service_desk"], humanDepartments: [] },
      network: { handler: "ai", agentTypes: ["network_monitor", "service_desk"], humanDepartments: [] },
      incident: { handler: "ai", agentTypes: ["incident_manager", "service_desk"], humanDepartments: [] },
      information: { handler: "ai", agentTypes: ["knowledge_manager", "service_desk"], humanDepartments: [] },
      onboarding: { handler: "human", agentTypes: ["service_desk"], humanDepartments: ["Human Resources", "IT Service Management"] },
      offboarding: { handler: "human", agentTypes: ["service_desk"], humanDepartments: ["Human Resources", "IT Service Management"] },
      procurement: { handler: "human", agentTypes: ["asset_manager"], humanDepartments: ["Procurement", "IT Service Management", "Infrastructure & Cloud Operations"] },
      hardware: { handler: "collaborative", agentTypes: ["asset_manager", "service_desk"], humanDepartments: ["Infrastructure & Cloud Operations", "IT Service Management"] },
      change_request: { handler: "collaborative", agentTypes: ["change_manager", "service_desk"], humanDepartments: ["IT Service Management", "Infrastructure & Cloud Operations"] },
    };

    const config = SR_HANDLER_CONFIG[parsed.data.type] || { handler: "ai", agentTypes: ["service_desk"], humanDepartments: [] };
    const handlerType = config.handler;

    const assignedAgent = config.agentTypes.reduce<ReturnType<typeof agents.find>>(
      (found, agentType) => found || agents.find(a => a.type === agentType), undefined
    );

    let assignedHumanName: string | null = null;
    let assignedUserId: string | null = null;

    if (handlerType === "human" || handlerType === "collaborative") {
      const reqUserId = (req as any).user?.id || parsed.data.requesterId;
      const allSubs = reqUserId ? await storage.getRoleSubscriptionsByUser(reqUserId) : await storage.getRoleSubscriptions();
      const activeSubs = allSubs.filter(s => s.status === "active" && s.assignedHumanName);
      const allRoles = await storage.getOrgRoles();
      for (const dept of config.humanDepartments) {
        const deptRoles = allRoles.filter(r => r.department === dept);
        const humanSub = activeSubs.find(s => deptRoles.some(r => r.id === s.roleId));
        if (humanSub) {
          assignedHumanName = humanSub.assignedHumanName;
          assignedUserId = humanSub.userId;
          break;
        }
      }
    }

    const updateFields: Record<string, any> = { handlerType, status: "assigned" };
    if (assignedAgent && (handlerType === "ai" || handlerType === "collaborative")) {
      updateFields.assignedAgentId = assignedAgent.id;
    }
    if (assignedHumanName) {
      updateFields.assignedHumanName = assignedHumanName;
      updateFields.assignedUserId = assignedUserId;
    }
    await storage.updateServiceRequest(created.id, updateFields);

    if (assignedAgent) {
      const actionLabel = handlerType === "ai" ? "Service Request Auto-Assigned" :
        handlerType === "collaborative" ? "Collaborative Request — AI Triage" : "Service Request Received";
      await storage.createAgentActivity({
        agentId: assignedAgent.id,
        action: actionLabel,
        details: `${handlerType === "collaborative" ? "Collaborative" : "Auto-assigned"} ${parsed.data.type.replace(/_/g, " ")} request: "${parsed.data.title}" (${parsed.data.priority} priority)${assignedHumanName ? `, human assignee: ${assignedHumanName}` : ""}`,
        relatedEntityType: "service_request",
        relatedEntityId: created.id,
        autonomous: handlerType === "ai",
      });
    }

    const serviceAgent = agents.find(a => a.type === "service_desk");
    if (serviceAgent && serviceAgent.id !== assignedAgent?.id) {
      const routedTo = assignedAgent ? `, routed to ${assignedAgent.name}` : "";
      const humanNote = assignedHumanName ? `, human: ${assignedHumanName}` : "";
      await storage.createAgentActivity({ agentId: serviceAgent.id, action: "Service Request Received", details: `New ${handlerType} request: "${parsed.data.title}" - priority: ${parsed.data.priority}${routedTo}${humanNote}`, relatedEntityType: "service_request", relatedEntityId: created.id });
    }

    if (parsed.data.type === "incident") {
      const severityMap: Record<string, string> = { critical: "critical", high: "high", medium: "medium", low: "low" };
      const severity = severityMap[parsed.data.priority] || "medium";
      const incidentAgent = agents.find(a => a.type === "incident_manager");
      const incident = await storage.createIncident({
        title: parsed.data.title,
        description: parsed.data.description,
        severity,
        status: "open",
        category: "User Reported",
        source: "Service Request",
        assignedAgentId: incidentAgent?.id,
        sourceServiceRequestId: created.id,
      });
      await storage.updateServiceRequest(created.id, { linkedIncidentId: incident.id });
      if (incidentAgent) {
        await storage.createAgentActivity({ agentId: incidentAgent.id, action: "Incident Auto-Created", details: `Incident auto-created from service request "${parsed.data.title}" (SR: ${created.id.substring(0, 8)})`, relatedEntityType: "incident", relatedEntityId: incident.id, autonomous: true });
      }
      const linkedSR = await storage.getServiceRequest(created.id);
      return res.status(201).json(linkedSR || created);
    }

    const finalSR = await storage.getServiceRequest(created.id);
    res.status(201).json(finalSR || created);
  });
  app.patch("/api/service-requests/:id", async (req, res) => {
    const parsed = patchSRSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getServiceRequest(req.params.id);
    if (!existing) return res.status(404).json({ message: "Service request not found" });
    if (parsed.data.status) {
      const allowedTransitions: Record<string, string[]> = {
        pending: ["assigned", "in_progress", "cancelled"],
        assigned: ["in_progress", "cancelled"],
        in_progress: ["on_hold", "pending_approval", "fulfilled", "cancelled"],
        on_hold: ["in_progress", "cancelled"],
        pending_approval: ["fulfilled", "in_progress"],
        fulfilled: ["resolved", "in_progress"],
        resolved: [],
        cancelled: [],
      };
      const allowed = allowedTransitions[existing.status] || [];
      if (!allowed.includes(parsed.data.status)) {
        return res.status(400).json({ message: `Invalid transition: ${existing.status} -> ${parsed.data.status}` });
      }
      if (["in_progress", "on_hold", "pending_approval", "assigned", "pending"].includes(parsed.data.status)) {
        parsed.data.resolvedAt = null;
      }
      if (parsed.data.status === "resolved" && !parsed.data.resolvedAt) {
        parsed.data.resolvedAt = new Date().toISOString();
      }
    }
    const updated = await storage.updateServiceRequest(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Service request not found" });
    res.json(updated);
  });

  // ──── Security AI Endpoints ────────────────────────────────────────────────

  app.post("/api/security/ai/threat-briefing", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { iocs, actors, feeds } = req.body as {
        iocs: Array<{ type: string; value: string; severity: string; source: string; tags: string[] }>;
        actors: Array<{ name: string; nation: string; ttps: string[]; active: boolean; severity: string }>;
        feeds: Array<{ name: string; status: string; iocs: number }>;
      };

      const activeActors = (actors || []).filter(a => a.active);
      const criticalIocs  = (iocs || []).filter(i => i.severity === "Critical");
      const liveFeeds     = (feeds || []).filter(f => f.status === "Live").length;

      const prompt = `You are a senior threat intelligence analyst producing a morning security briefing for an enterprise SOC.

Current threat environment data:
- Total IOCs tracked: ${(iocs || []).length} (${criticalIocs.length} critical)
- Live threat feeds: ${liveFeeds}/${(feeds || []).length}
- Active threat actors: ${activeActors.map(a => `${a.name} (${a.nation})`).join(", ")}
- Top critical IOCs: ${criticalIocs.slice(0, 5).map(i => `${i.type}:${i.value} [${i.tags.join(",")}]`).join("; ")}

Write a concise, professional AI threat intelligence briefing covering:
1. **Executive Summary** (2-3 sentences on overall threat posture today)
2. **Priority Threats** (top 3 threats requiring immediate attention with recommended actions)
3. **Threat Actor Activity** (which actors are most active today and their likely targets)
4. **Recommended Immediate Actions** (3-5 specific, actionable steps for the security team)

Format in markdown. Be specific, actionable, and concise. Use real CVEs, TTP names, and MITRE IDs where relevant.`;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
        temperature: 0.4,
      }, { module: "security", endpoint: "/api/security/ai/threat-briefing", userId: req.user!.id, providerName });

      res.json({ briefing: completion.choices[0].message.content });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/security/ai/vuln-analysis", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { vulns } = req.body as {
        vulns: Array<{ id: string; cvss: number; title: string; status: string; affected: number; due: string; source: string }>;
      };

      const openVulns = (vulns || []).filter(v => ["Open", "In Progress"].includes(v.status));
      const critical  = openVulns.filter(v => v.cvss >= 9).sort((a, b) => b.cvss - a.cvss);
      const high      = openVulns.filter(v => v.cvss >= 7 && v.cvss < 9);

      const prompt = `You are a senior vulnerability management engineer. Analyze this vulnerability list and produce an AI-driven prioritization report.

Open/In-Progress Vulnerabilities:
${openVulns.map(v => `- ${v.id} | CVSS ${v.cvss} | ${v.title} | Affected assets: ${v.affected} | Due: ${v.due} | Source: ${v.source}`).join("\n")}

Provide a prioritization analysis with:
1. **AI Remediation Priority** — ordered top-5 CVEs to patch NOW with reason (consider CVSS + affected asset count + due date + exploitability)
2. **Risk Summary** — one paragraph on overall exposure
3. **Quick Wins** — 2-3 CVEs that are likely easy to patch and will reduce risk significantly
4. **Automation Opportunity** — which CVEs could be auto-remediated by a patch agent vs require manual change management
5. **SLA Breach Risk** — which open CVEs are most likely to breach their SLA

Be concise, technical, and actionable. Format in markdown.`;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
        temperature: 0.3,
      }, { module: "security", endpoint: "/api/security/ai/vuln-analysis", userId: req.user!.id, providerName });

      res.json({ analysis: completion.choices[0].message.content });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/security/ai/pentest-summary", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { engagements, findings } = req.body as {
        engagements: Array<{ name: string; type: string; status: string; risk: string; scope: string }>;
        findings: Array<{ title: string; severity: string; status: string; cvss: number; cwe: string; environment: string }>;
      };

      const allFindings = findings || [];
      const critical = allFindings.filter(f => f.severity === "Critical");
      const high     = allFindings.filter(f => f.severity === "High");
      const open     = allFindings.filter(f => f.status === "Open");

      const prompt = `You are a principal penetration testing consultant. Produce an AI-generated executive summary for the security leadership team.

Engagement Portfolio:
${(engagements || []).map(e => `- ${e.name} | ${e.type} | Status: ${e.status} | Risk: ${e.risk} | Scope: ${e.scope}`).join("\n")}

Findings Summary:
- Total findings: ${allFindings.length}
- Critical: ${critical.length}, High: ${high.length}, Open: ${open.length}
- CWE categories present: ${[...new Set(allFindings.map(f => f.cwe))].join(", ")}

Top findings:
${allFindings.slice(0, 6).map(f => `- [${f.severity}] ${f.title} | CVSS ${f.cvss} | ${f.cwe} | ${f.environment}`).join("\n")}

Write an executive penetration testing summary covering:
1. **Overall Security Posture** (2-3 sentences on the organization's current penetration testing risk level)
2. **Critical Findings That Require Immediate Action** (top 3 with business impact explanation)
3. **Attack Path Analysis** (likely attack chain an adversary would exploit based on findings)
4. **Strategic Recommendations** (3 high-level recommendations for the CISO)
5. **Remediation Roadmap** (30/60/90 day priorities)

Write for a CISO audience. Use business language with technical depth. Format in markdown.`;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 750,
        temperature: 0.35,
      }, { module: "security", endpoint: "/api/security/ai/pentest-summary", userId: req.user!.id, providerName });

      res.json({ summary: completion.choices[0].message.content });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/security/ai/siem-analysis", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { eventCounts, totalEvents24h, topExceptions, activeRules, totalHits, logSources, connectedPlatforms } = req.body as {
        eventCounts: { exception: number; warning: number; informational: number };
        totalEvents24h: number;
        topExceptions: Array<{ pattern: string; mitre: string; severity: string; count: number }>;
        activeRules: number;
        totalHits: number;
        logSources: Array<{ name: string; eps: number; status: string }>;
        connectedPlatforms: string[];
      };

      const degradedSources = (logSources || []).filter(l => l.status !== "Healthy");
      const totalEPS = (logSources || []).reduce((s, l) => s + l.eps, 0);

      const prompt = `You are a senior SIEM architect and ITIL Event Management specialist analyzing enterprise security telemetry. Produce an ITIL-aligned event analysis and actionable recommendations.

## Current SIEM State (last 24 hours)
- Total events ingested: ${(totalEvents24h || 0).toLocaleString()} (~${totalEPS.toLocaleString()} avg EPS)
- ITIL Event breakdown — Exception: ${eventCounts?.exception ?? 0}, Warning: ${eventCounts?.warning ?? 0}, Informational: ${eventCounts?.informational ?? 0}
- Active correlation rules: ${activeRules ?? 0} (${totalHits ?? 0} total rule hits today)
- Connected SIEM platforms: ${(connectedPlatforms || []).join(", ") || "None configured in Integration Hub"}
${degradedSources.length > 0 ? `- Degraded log sources: ${degradedSources.map(s => s.name).join(", ")}` : "- All log sources healthy"}

## Top Exception Events (ITIL — require immediate incident creation)
${(topExceptions || []).map(e => `- ${e.pattern} | MITRE: ${e.mitre} | Severity: ${e.severity} | Occurrences: ${e.count}`).join("\n")}

Write a concise ITIL-aligned SIEM analysis covering:

## Executive Summary
2-3 sentences on today's event landscape and overall risk posture.

## ITIL Event Management Assessment
Evaluate the Exception / Warning / Informational ratio, what it indicates about the threat environment, and which Exception events must generate formal ITIL Incidents now.

## Priority Threat Patterns
Top 3 correlated event patterns that require immediate investigation with MITRE ATT&CK context and recommended ITIL process (Incident / Problem / Change).

## Correlation Rule Recommendations
2-3 specific new or modified correlation rules to improve detection coverage based on today's patterns. Include the logic (e.g., "Alert when > 5 failed logins within 60s from same source IP across AD and VPN logs").

## ITIL Process Actions
Specific actions required under each ITIL process:
- **Incident Management**: which events need P1/P2 incidents raised now
- **Problem Management**: which recurring patterns need root cause investigation
- **Change Management**: which changes to correlation rules or log sources are needed

Be specific, technical, and actionable. Format in markdown. Max 600 words.`;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 750,
        temperature: 0.35,
      }, { module: "security", endpoint: "/api/security/ai/siem-analysis", userId: req.user!.id, providerName });

      res.json({ analysis: completion.choices[0].message.content });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/security/ai/module-insights", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { module, capabilities } = req.body as {
        module: string;
        capabilities: string[];
      };

      const prompt = `You are HOLOCRON AI, an enterprise IT security automation platform. Generate a realistic AI operational insight preview for the "${module}" security module.

Module capabilities include: ${capabilities.join(", ")}

Generate a short but realistic "AI Live Insights" preview showing what autonomous AI analysis would look like for this module when activated. Include:
1. **Current Status Assessment** (2 sentences on the AI's assessment of the current state)
2. **Autonomous Actions Taken** (3 specific actions the AI has taken or recommends)
3. **Proactive Alerts** (2-3 things the AI has proactively detected or flagged)
4. **Next AI Actions** (what the AI will do in the next 24 hours)

Make it realistic, specific, and show clear business value. Format in markdown. Keep it under 300 words.`;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.5,
      }, { module: "security", endpoint: "/api/security/ai/module-insights", userId: req.user!.id, providerName });

      res.json({ insights: completion.choices[0].message.content });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Security Integrations (centralized credential store) ──────────────────

  app.get("/api/security/integrations", requireAuth, async (req, res) => {
    try {
      const integrations = await storage.getSecurityIntegrations(req.user!.id);
      const masked = integrations.map(i => ({
        ...i,
        credentials: maskCredentials(i.credentials as Record<string, string>),
      }));
      res.json(masked);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/security/integrations/:platform", requireAuth, async (req, res) => {
    try {
      const { platform } = req.params;
      const { category, displayName, enabled, credentials } = req.body;
      const existing = await storage.getSecurityIntegrations(req.user!.id);
      const current = existing.find(i => i.platform === platform);
      const mergedCreds = mergeCredentials(
        (current?.credentials as Record<string, string>) ?? {},
        credentials ?? {}
      );
      const result = await storage.upsertSecurityIntegration(req.user!.id, platform, {
        category, displayName, enabled: enabled ?? false, credentials: mergedCreds, testStatus: "untested",
      });
      res.json({ ...result, credentials: maskCredentials(mergedCreds) });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/security/integrations/:platform/test", requireAuth, async (req, res) => {
    try {
      const { platform } = req.params;
      const integrations = await storage.getSecurityIntegrations(req.user!.id);
      const integration = integrations.find(i => i.platform === platform);
      if (!integration) return res.status(404).json({ message: "Integration not configured" });
      const creds = integration.credentials as Record<string, string>;
      const hasAllRequired = Object.values(creds).every(v => v && String(v).trim() !== "" && !String(v).startsWith("••"));
      const testStatus = hasAllRequired ? "connected" : "failed";
      const updated = await storage.updateSecurityIntegrationTestStatus(req.user!.id, platform, testStatus);
      res.json({ testStatus, message: hasAllRequired ? "Connection successful" : "Missing or placeholder credentials", lastTestedAt: updated?.lastTestedAt });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/security/integrations/:platform", requireAuth, async (req, res) => {
    try {
      await storage.deleteSecurityIntegration(req.user!.id, req.params.platform);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ───────────────────────────────────────────────────────────────────────────

  app.get("/api/security-events", async (_req, res) => res.json(await storage.getSecurityEvents()));
  app.post("/api/security-events", async (req, res) => {
    const parsed = insertSecurityEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createSecurityEvent(parsed.data));
  });

  // Mark a security event as processed (acknowledged/triaged)
  app.patch("/api/security-events/:id/processed", requireAuth, async (req, res) => {
    try {
      await storage.markSecurityEventProcessed(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Raise an incident directly from a security event — pre-fills all fields
  app.post("/api/security-events/:id/raise-incident", requireAuth, async (req, res) => {
    try {
      const events = await storage.getSecurityEvents();
      const evt = events.find(e => e.id === req.params.id);
      if (!evt) return res.status(404).json({ error: "Security event not found" });

      const severityMap: Record<string, string> = { critical: "critical", high: "high", medium: "medium", low: "low" };
      const incident = await storage.createIncident({
        title: `[SIEM] ${evt.eventType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}: ${evt.source}`,
        description: `Auto-raised from SIEM event.\n\nEvent Type: ${evt.eventType}\nSource: ${evt.source}\nSeverity: ${evt.severity}\nMessage: ${evt.message}\nDetected: ${evt.createdAt}`,
        severity: severityMap[evt.severity] ?? "medium",
        status: "open",
        category: "security",
        source: "siem",
      });
      // Mark the event as processed
      await storage.markSecurityEventProcessed(evt.id);
      res.status(201).json(incident);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // SIEM Correlation Rules — DB-backed CRUD
  app.get("/api/siem/correlation-rules", requireAuth, async (_req, res) => {
    try { res.json(await storage.getSiemCorrelationRules()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/siem/correlation-rules/:id", requireAuth, async (req, res) => {
    try {
      const rule = await storage.updateSiemCorrelationRule(req.params.id, req.body);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      res.json(rule);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── FORENSICS ─────────────────────────────────────────────────────
  app.get("/api/forensics/cases", requireAuth, async (_req, res) => {
    try { res.json(await storage.getForensicCases()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/forensics/cases/:id", requireAuth, async (req, res) => {
    try {
      const c = await storage.getForensicCase(req.params.id);
      if (!c) return res.status(404).json({ error: "Case not found" });
      res.json(c);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/forensics/cases", requireAuth, async (req, res) => {
    try {
      const { insertForensicCaseSchema } = await import("@shared/schema");
      const parsed = insertForensicCaseSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      res.status(201).json(await storage.createForensicCase(parsed.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/forensics/cases/:id", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateForensicCase(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Case not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/forensics/cases/:id/evidence", requireAuth, async (req, res) => {
    try { res.json(await storage.getForensicEvidence(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/forensics/cases/:id/evidence", requireAuth, async (req, res) => {
    try {
      const { insertForensicEvidenceSchema } = await import("@shared/schema");
      const parsed = insertForensicEvidenceSchema.safeParse({ ...req.body, caseId: req.params.id });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      res.status(201).json(await storage.addForensicEvidence(parsed.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/forensics/cases/:id/timeline", requireAuth, async (req, res) => {
    try { res.json(await storage.getForensicTimeline(req.params.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/forensics/cases/:id/timeline", requireAuth, async (req, res) => {
    try {
      const { insertForensicTimelineSchema } = await import("@shared/schema");
      const parsed = insertForensicTimelineSchema.safeParse({ ...req.body, caseId: req.params.id });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
      res.status(201).json(await storage.addForensicTimelineEvent(parsed.data));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/forensics/indicators", requireAuth, async (_req, res) => {
    try { res.json(await storage.getForensicIndicators()); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Forensics AI analysis — proactive on page load
  app.post("/api/forensics/ai-analysis", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { cases, indicators, recentEvidence } = req.body as {
        cases: Array<{ caseNumber: string; title: string; status: string; priority: string; domain: string; legalHold: boolean; escalatedTo?: string }>;
        indicators: Array<{ domain: string; name: string; severity: string; status: string; signal: string }>;
        recentEvidence: Array<{ domain: string; evidenceType: string; title: string }>;
      };

      const activeCases = (cases || []).filter(c => !["closed"].includes(c.status));
      const triggeredIndicators = (indicators || []).filter(i => ["triggered","case_opened"].includes(i.status));
      const legalHoldCases = (cases || []).filter(c => c.legalHold);

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [{
          role: "system",
          content: `You are an expert forensic investigator and ITIL 4 practitioner advising the CISO. Analyse the cross-domain forensic portfolio and provide an executive-level investigative report. Cover: 1) Critical active cases requiring immediate action 2) Triggered monitoring indicators that need case escalation 3) Cross-domain patterns (e.g. insider threat correlating digital + physical + HR signals) 4) Legal hold and eDiscovery compliance status 5) Chain of custody integrity assessment 6) Recommended next investigative actions by priority. Be precise, use case numbers, evidence types, and MITRE techniques where relevant. Format with ## section headers.`
        },{
          role: "user",
          content: JSON.stringify({
            activeCases: activeCases.length,
            legalHoldCases: legalHoldCases.map(c => c.caseNumber),
            triggeredIndicators: triggeredIndicators.map(i => ({ domain: i.domain, name: i.name, severity: i.severity })),
            casesByDomain: Object.entries(activeCases.reduce((m, c) => { m[c.domain] = (m[c.domain]||0)+1; return m; }, {} as Record<string,number>)),
            escalated: activeCases.filter(c => c.status === "escalated" || c.escalatedTo).map(c => ({ caseNumber: c.caseNumber, escalatedTo: c.escalatedTo })),
            recentEvidenceTypes: [...new Set((recentEvidence||[]).map(e => e.evidenceType))],
            totalIndicatorsMonitoring: (indicators||[]).length,
          })
        }],
        temperature: 0.5,
        max_tokens: 900,
      }, { module: "forensics", endpoint: "/api/forensics/ai-analysis", userId: req.user!.id, providerName });

      res.json({ analysis: completion.choices[0].message.content });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Export forensic report — evidence + timeline narrative for a case
  app.post("/api/forensics/cases/:id/export", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const fc = await storage.getForensicCase(req.params.id);
      if (!fc) return res.status(404).json({ error: "Case not found" });
      const evidence = await storage.getForensicEvidence(req.params.id);
      const timeline = await storage.getForensicTimeline(req.params.id);

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [{
          role: "system",
          content: `You are a forensic report writer producing a court-admissible investigative report. Write in a formal, factual, third-person narrative. Structure: Executive Summary, Case Background, Investigation Methodology, Timeline of Events, Evidence Catalogue (with chain of custody notes), Findings, Conclusions, Recommendations.`
        },{
          role: "user",
          content: JSON.stringify({
            caseNumber: fc.caseNumber,
            title: fc.title,
            summary: fc.summary,
            status: fc.status,
            priority: fc.priority,
            domain: fc.domain,
            assignedTo: fc.assignedTo,
            legalHold: fc.legalHold,
            escalatedTo: fc.escalatedTo,
            evidenceCount: evidence.length,
            evidenceItems: evidence.map(e => ({ title: e.title, type: e.evidenceType, domain: e.domain, custodian: e.custodian, hash: e.fileHash, admissible: e.admissible })),
            timelineEvents: timeline.map(t => ({ time: t.eventTime, actor: t.actor, action: t.action, target: t.target, outcome: t.outcome, mitre: t.mitre, milestone: t.isMilestone })),
          })
        }],
        temperature: 0.3,
        max_tokens: 1200,
      }, { module: "forensics", endpoint: "/api/forensics/cases/:id/export", userId: req.user!.id, providerName });

      res.json({ report: completion.choices[0].message.content, caseNumber: fc.caseNumber, title: fc.title, generatedAt: new Date().toISOString() });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/events/ai-triage", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { securityEvents: evts, incidents: incs, problems: probs, connectedPlatforms } = req.body as {
        securityEvents: Array<{ id: string; eventType: string; source: string; severity: string; message: string; processed: boolean; createdAt: string }>;
        incidents: Array<{ id: string; title: string; severity: string; status: string; category: string; source: string }>;
        problems: Array<{ id: string; title: string; status: string }>;
        connectedPlatforms: string[];
      };

      const unprocessed = (evts || []).filter(e => !e.processed);
      const openIncidents = (incs || []).filter(i => !["resolved", "closed"].includes(i.status));
      const openProblems = (probs || []).filter(p => p.status !== "resolved");

      const prompt = `You are an ITIL 4 Event Management AI for an enterprise IT organization. Analyze the current real-time event stream and produce a structured JSON triage report with proactive, actionable recommendations.

CURRENT ENVIRONMENT STATE:
Security Events (unprocessed): ${unprocessed.length} events
${unprocessed.map(e => `- [${e.severity.toUpperCase()}] ${e.eventType} | Source: ${e.source} | ${e.message} | ID: ${e.id}`).join("\n")}

Open ITSM Incidents: ${openIncidents.length}
${openIncidents.map(i => `- ${i.title} [${i.severity}/${i.status}] | Category: ${i.category} | Source: ${i.source}`).join("\n")}

Open Problems (recurring/root cause under investigation): ${openProblems.length}
${openProblems.map(p => `- ${p.title} [${p.status}]`).join("\n")}

Connected SIEM/Security Platforms: ${(connectedPlatforms || []).join(", ") || "None via Integration Hub"}
Current date: ${new Date().toISOString()}

Return ONLY valid JSON with exactly this structure:
{
  "summary": "2-3 sentence executive summary of current ITIL event landscape",
  "overallRiskLevel": "critical|high|medium|low",
  "proactiveActions": [
    {
      "id": "PA-1",
      "priority": 1,
      "urgency": "immediate|urgent|normal",
      "itilProcess": "Incident Management|Problem Management|Change Management|Event Closure",
      "title": "Concise action title",
      "rationale": "Why this action is needed based on real event data",
      "action": "raise_incident|escalate_problem|create_rfc|close_event|monitor",
      "securityEventId": "event id if applicable or null"
    }
  ],
  "operationalEvents": [
    {
      "id": "OPS-001",
      "itilType": "Exception|Warning|Informational",
      "severity": "high|medium|low",
      "category": "Infrastructure|Network|Application|Capacity|Availability|Security",
      "source": "Infrastructure Monitoring|Capacity Management|SLA Management|Availability Monitoring",
      "asset": "specific asset name",
      "description": "Clear operational event description based on real context",
      "itilProcess": "Incident Management|Problem Management|Event Closure",
      "action": "raise_incident|create_problem|monitor|auto_close"
    }
  ],
  "itilAssessment": {
    "eventManagement": "Assessment of current event classification quality and volume",
    "incidentManagement": "Status of open incidents and recommended escalations",
    "problemManagement": "Patterns suggesting root cause investigation needed"
  }
}

Generate 3-5 proactive actions and 3-5 operational events based on the real data provided. Be specific, referencing actual event messages and incident titles. Do not hallucinate data not provided.`;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }, { module: "events", endpoint: "/api/events/ai-triage", userId: req.user!.id, providerName });

      const raw = completion.choices[0].message.content ?? "{}";
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/problems/stats", async (_req, res) => {
    const all = await storage.getProblems();
    const now = new Date();
    const total = all.length;
    const open = all.filter(r => r.status === "open").length;
    const investigating = all.filter(r => r.status === "investigating").length;
    const rootCauseIdentified = all.filter(r => r.status === "root_cause_identified").length;
    const resolved = all.filter(r => r.status === "resolved").length;
    const knownErrors = all.filter(r => r.knownError).length;
    const resolvedWithTime = all.filter(r => r.resolvedAt && r.createdAt && r.status === "resolved");
    let avgResolutionHours = 0;
    if (resolvedWithTime.length > 0) {
      const totalMs = resolvedWithTime.reduce((sum, r) => sum + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt!).getTime()), 0);
      avgResolutionHours = Math.round((totalMs / resolvedWithTime.length) / (1000 * 60 * 60) * 10) / 10;
    }
    const byPriority = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
    all.forEach(r => { byPriority[r.priority] = (byPriority[r.priority] || 0) + 1; });
    const byCategory = {} as Record<string, number>;
    all.forEach(r => { byCategory[r.category] = (byCategory[r.category] || 0) + 1; });
    const byStatus = {} as Record<string, number>;
    all.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    const last7d = all.filter(r => r.createdAt && new Date(r.createdAt) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length;
    const last30d = all.filter(r => r.createdAt && new Date(r.createdAt) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length;
    const totalIncidents = all.reduce((sum, r) => sum + (r.relatedIncidentCount || 0), 0);
    res.json({ total, open, investigating, rootCauseIdentified, resolved, knownErrors, avgResolutionHours, byPriority, byCategory, byStatus, last7d, last30d, totalIncidents });
  });
  app.get("/api/problems", async (_req, res) => res.json(await storage.getProblems()));
  app.get("/api/problems/:id", async (req, res) => {
    const problem = await storage.getProblem(req.params.id);
    if (!problem) return res.status(404).json({ message: "Problem not found" });
    res.json(problem);
  });
  app.post("/api/problems", async (req, res) => {
    const parsed = insertProblemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const created = await storage.createProblem(parsed.data);
    res.status(201).json(created);
  });
  app.patch("/api/problems/:id", async (req, res) => {
    const parsed = patchProblemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getProblem(req.params.id);
    if (!existing) return res.status(404).json({ message: "Problem not found" });
    if (parsed.data.status) {
      const allowedTransitions: Record<string, string[]> = {
        open: ["investigating"],
        investigating: ["root_cause_identified", "open"],
        root_cause_identified: ["resolved", "investigating"],
        resolved: ["open"],
      };
      const allowed = allowedTransitions[existing.status] || [];
      if (!allowed.includes(parsed.data.status)) {
        return res.status(400).json({ message: `Invalid transition: ${existing.status} -> ${parsed.data.status}` });
      }
      if (["open", "investigating", "root_cause_identified"].includes(parsed.data.status)) {
        (parsed.data as any).resolvedAt = null;
      }
      if (parsed.data.status === "resolved") {
        (parsed.data as any).resolvedAt = new Date().toISOString();
      }
    }
    const updated = await storage.updateProblem(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Problem not found" });
    res.json(updated);
  });

  app.get("/api/change-requests/stats", async (_req, res) => {
    const all = await storage.getChangeRequests();
    const now = new Date();
    const total = all.length;
    const pendingReview = all.filter(r => ["draft", "submitted", "under_review"].includes(r.status)).length;
    const approved = all.filter(r => r.status === "approved").length;
    const scheduled = all.filter(r => r.status === "scheduled").length;
    const implemented = all.filter(r => ["implemented", "closed"].includes(r.status)).length;
    const rejected = all.filter(r => r.status === "rejected").length;
    const failed = all.filter(r => r.status === "failed").length;
    const highRisk = all.filter(r => r.riskLevel === "high" && !["closed", "rejected", "failed"].includes(r.status)).length;
    const completed = all.filter(r => ["implemented", "closed"].includes(r.status)).length;
    const totalCompleted = completed + failed;
    const successRate = totalCompleted > 0 ? Math.round((completed / totalCompleted) * 100) : 100;
    const byRiskLevel = { low: 0, medium: 0, high: 0 } as Record<string, number>;
    all.forEach(r => { byRiskLevel[r.riskLevel] = (byRiskLevel[r.riskLevel] || 0) + 1; });
    const byType = {} as Record<string, number>;
    all.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
    const byStatus = {} as Record<string, number>;
    all.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    const last7d = all.filter(r => r.createdAt && new Date(r.createdAt) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length;
    const last30d = all.filter(r => r.createdAt && new Date(r.createdAt) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)).length;
    res.json({ total, pendingReview, approved, scheduled, implemented, rejected, failed, highRisk, successRate, byRiskLevel, byType, byStatus, last7d, last30d });
  });
  app.get("/api/change-requests", async (_req, res) => res.json(await storage.getChangeRequests()));
  app.get("/api/change-requests/:id", async (req, res) => {
    const cr = await storage.getChangeRequest(req.params.id);
    if (!cr) return res.status(404).json({ message: "Change request not found" });
    res.json(cr);
  });
  app.post("/api/change-requests", async (req, res) => {
    const parsed = insertChangeRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const created = await storage.createChangeRequest(parsed.data);
    res.status(201).json(created);
  });
  app.patch("/api/change-requests/:id", async (req, res) => {
    const parsed = patchChangeRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getChangeRequest(req.params.id);
    if (!existing) return res.status(404).json({ message: "Change request not found" });
    if (parsed.data.status) {
      const allowedTransitions: Record<string, string[]> = {
        draft: ["submitted", "cancelled"],
        submitted: ["under_review", "draft"],
        under_review: ["approved", "rejected"],
        approved: ["scheduled", "cancelled"],
        rejected: ["draft"],
        scheduled: ["implemented", "cancelled"],
        implemented: ["closed", "failed"],
        closed: [],
        failed: ["draft"],
        cancelled: ["draft"],
      };
      const allowed = allowedTransitions[existing.status] || [];
      if (!allowed.includes(parsed.data.status)) {
        return res.status(400).json({ message: `Invalid transition: ${existing.status} -> ${parsed.data.status}` });
      }
      if (["implemented", "closed"].includes(parsed.data.status) && !parsed.data.completedAt) {
        parsed.data.completedAt = new Date().toISOString();
      }
      if (["draft", "submitted", "under_review", "approved", "scheduled"].includes(parsed.data.status)) {
        parsed.data.completedAt = null;
      }
    }
    const updated = await storage.updateChangeRequest(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Change request not found" });
    res.json(updated);
  });

  app.get("/api/service-catalog", async (_req, res) => res.json(await storage.getServiceCatalogItems()));
  app.get("/api/service-catalog/:id", async (req, res) => {
    const item = await storage.getServiceCatalogItem(req.params.id);
    if (!item) return res.status(404).json({ message: "Catalog item not found" });
    res.json(item);
  });
  app.post("/api/service-catalog", async (req, res) => {
    const parsed = insertServiceCatalogItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createServiceCatalogItem(parsed.data));
  });

  app.get("/api/knowledge", requireAuth, async (_req, res) => res.json(await storage.getKnowledgeArticles()));
  app.get("/api/knowledge/search", requireAuth, async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) return res.json([]);
    const results = await storage.searchKnowledgeArticles(q);
    res.json(results);
  });
  app.get("/api/knowledge/:id", requireAuth, async (req, res) => {
    const article = await storage.getKnowledgeArticle(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    await storage.updateKnowledgeArticle(req.params.id, { viewCount: (article.viewCount || 0) + 1 });
    res.json({ ...article, viewCount: (article.viewCount || 0) + 1 });
  });
  app.post("/api/knowledge", requireAuth, async (req, res) => {
    const parsed = insertKnowledgeArticleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createKnowledgeArticle(parsed.data));
  });
  app.patch("/api/knowledge/:id", requireAuth, async (req, res) => {
    const parsed = patchKnowledgeArticleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateKnowledgeArticle(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Article not found" });
    res.json(updated);
  });
  app.post("/api/knowledge/:id/helpful", requireAuth, async (req, res) => {
    const article = await storage.getKnowledgeArticle(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    const updated = await storage.updateKnowledgeArticle(req.params.id, { helpfulCount: (article.helpfulCount || 0) + 1 });
    res.json(updated);
  });

  app.delete("/api/knowledge/:id", requireAuth, async (req, res) => {
    const article = await storage.getKnowledgeArticle(req.params.id);
    if (!article) return res.status(404).json({ message: "Article not found" });
    await storage.deleteKnowledgeArticle(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/knowledge/from-task/:taskId", requireAuth, async (req, res) => {
    const task = await storage.getAgentTask(req.params.taskId);
    if (!task || task.userId !== req.user!.id) return res.status(404).json({ error: "Task not found" });
    if (task.status !== "completed" || !task.output) return res.status(400).json({ error: "Task must be completed with output" });

    const article = await storage.createKnowledgeArticle({
      title: task.description,
      content: task.output,
      category: task.priority === "critical" ? "Critical Operations" : "Operations",
      tags: [task.priority, "auto-generated", "agent-task"],
      status: "published",
      authorId: task.assignedRoleId || "system",
    });
    res.status(201).json(article);
  });

  app.get("/api/bcp-plans/stats", requireAuth, async (req, res) => {
    const plans = await storage.getBcpPlans(req.user!.id);
    const total = plans.length;
    const active = plans.filter(p => p.status === "active").length;
    const underReview = plans.filter(p => p.status === "under_review").length;
    const approved = plans.filter(p => p.status === "approved").length;
    const expired = plans.filter(p => p.status === "expired").length;
    const draft = plans.filter(p => p.status === "draft").length;
    const avgRto = total > 0 ? Math.round(plans.reduce((s, p) => s + p.rtoHours, 0) / total) : 0;
    const criticalImpact = plans.filter(p => p.businessImpactLevel === "critical").length;
    const byCategory: Record<string, number> = {};
    plans.forEach(p => { byCategory[p.category] = (byCategory[p.category] || 0) + 1; });
    const byImpact: Record<string, number> = {};
    plans.forEach(p => { byImpact[p.businessImpactLevel] = (byImpact[p.businessImpactLevel] || 0) + 1; });
    const byStatus: Record<string, number> = {};
    plans.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
    res.json({ total, active, underReview, approved, expired, draft, avgRto, avgRtoHours: avgRto, criticalImpact, byCategory, byImpact, byStatus });
  });
  app.get("/api/bcp-plans", requireAuth, async (req, res) => {
    res.json(await storage.getBcpPlans(req.user!.id));
  });
  app.get("/api/bcp-plans/:id", requireAuth, async (req, res) => {
    const plan = await storage.getBcpPlan(req.params.id);
    if (!plan || plan.userId !== req.user!.id) return res.status(404).json({ message: "BCP plan not found" });
    res.json(plan);
  });
  app.post("/api/bcp-plans", requireAuth, async (req, res) => {
    const parsed = insertBcpPlanSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createBcpPlan(parsed.data));
  });
  app.patch("/api/bcp-plans/:id", requireAuth, async (req, res) => {
    const existing = await storage.getBcpPlan(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ message: "BCP plan not found" });
    const parsed = patchBcpPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateBcpPlan(req.params.id, parsed.data);
    res.json(updated);
  });

  app.get("/api/drp-plans/stats", requireAuth, async (req, res) => {
    const plans = await storage.getDrpPlans(req.user!.id);
    const total = plans.length;
    const active = plans.filter(p => p.status === "active").length;
    const testing = plans.filter(p => p.status === "testing").length;
    const approved = plans.filter(p => p.status === "approved").length;
    const untested = plans.filter(p => p.testResult === "not_tested").length;
    const passed = plans.filter(p => p.testResult === "passed").length;
    const failed = plans.filter(p => p.testResult === "failed").length;
    const avgRto = total > 0 ? Math.round(plans.reduce((s, p) => s + p.rtoHours, 0) / total) : 0;
    const byDisasterType: Record<string, number> = {};
    plans.forEach(p => { byDisasterType[p.disasterType] = (byDisasterType[p.disasterType] || 0) + 1; });
    const bySeverity: Record<string, number> = {};
    plans.forEach(p => { bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1; });
    const byTestResult: Record<string, number> = {};
    plans.forEach(p => { byTestResult[p.testResult] = (byTestResult[p.testResult] || 0) + 1; });
    const byStatus: Record<string, number> = {};
    plans.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
    const inTesting = testing;
    const testsPassed = passed;
    const avgRtoHours = avgRto;
    res.json({ total, active, testing, inTesting, approved, untested, passed, testsPassed, failed, avgRto, avgRtoHours, byDisasterType, bySeverity, byTestResult, byStatus });
  });
  app.get("/api/drp-plans", requireAuth, async (req, res) => {
    res.json(await storage.getDrpPlans(req.user!.id));
  });
  app.get("/api/drp-plans/:id", requireAuth, async (req, res) => {
    const plan = await storage.getDrpPlan(req.params.id);
    if (!plan || plan.userId !== req.user!.id) return res.status(404).json({ message: "DRP plan not found" });
    res.json(plan);
  });
  app.post("/api/drp-plans", requireAuth, async (req, res) => {
    const parsed = insertDrpPlanSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createDrpPlan(parsed.data));
  });
  app.patch("/api/drp-plans/:id", requireAuth, async (req, res) => {
    const existing = await storage.getDrpPlan(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ message: "DRP plan not found" });
    const parsed = patchDrpPlanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateDrpPlan(req.params.id, parsed.data);
    res.json(updated);
  });

  app.get("/api/bcp-bia/stats", requireAuth, async (req, res) => {
    const entries = await storage.getBiaEntries(req.user!.id);
    const total = entries.length;
    const critical = entries.filter(e => e.criticality === "critical").length;
    const highMtdRisk = entries.filter(e => e.mtdHours <= 4).length;
    const avgRto = total > 0 ? Math.round(entries.reduce((s, e) => s + e.rtoHours, 0) / total) : 0;
    const workaroundAvailablePct = total > 0 ? Math.round((entries.filter(e => e.workaroundAvailable).length / total) * 100) : 0;
    const byCriticality: Record<string, number> = {};
    entries.forEach(e => { byCriticality[e.criticality] = (byCriticality[e.criticality] || 0) + 1; });
    const byDepartment: Record<string, number> = {};
    entries.forEach(e => { byDepartment[e.department] = (byDepartment[e.department] || 0) + 1; });
    res.json({ total, critical, highMtdRisk, avgRto, workaroundAvailablePct, byCriticality, byDepartment });
  });
  app.get("/api/bcp-bia", requireAuth, async (req, res) => {
    res.json(await storage.getBiaEntries(req.user!.id));
  });
  app.get("/api/bcp-bia/:id", requireAuth, async (req, res) => {
    const entry = await storage.getBiaEntry(req.params.id);
    if (!entry || entry.userId !== req.user!.id) return res.status(404).json({ message: "BIA entry not found" });
    res.json(entry);
  });
  app.post("/api/bcp-bia", requireAuth, async (req, res) => {
    const parsed = insertBiaEntrySchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createBiaEntry(parsed.data));
  });
  app.patch("/api/bcp-bia/:id", requireAuth, async (req, res) => {
    const existing = await storage.getBiaEntry(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ message: "BIA entry not found" });
    const parsed = patchBiaEntrySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.json(await storage.updateBiaEntry(req.params.id, parsed.data));
  });

  app.get("/api/bcp-risks/stats", requireAuth, async (req, res) => {
    const risks = await storage.getRiskAssessments(req.user!.id);
    const total = risks.length;
    const critical = risks.filter(r => r.riskScore >= 20).length;
    const high = risks.filter(r => r.riskScore >= 12 && r.riskScore < 20).length;
    const mitigated = risks.filter(r => r.status === "mitigated").length;
    const accepted = risks.filter(r => r.status === "accepted").length;
    const identified = risks.filter(r => r.status === "identified").length;
    const byCategory: Record<string, number> = {};
    risks.forEach(r => { byCategory[r.threatCategory] = (byCategory[r.threatCategory] || 0) + 1; });
    const byResidualRisk: Record<string, number> = {};
    risks.forEach(r => { byResidualRisk[r.residualRisk] = (byResidualRisk[r.residualRisk] || 0) + 1; });
    const byStatus: Record<string, number> = {};
    risks.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    res.json({ total, critical, high, mitigated, accepted, identified, byCategory, byResidualRisk, byStatus });
  });
  app.get("/api/bcp-risks", requireAuth, async (req, res) => {
    res.json(await storage.getRiskAssessments(req.user!.id));
  });
  app.get("/api/bcp-risks/:id", requireAuth, async (req, res) => {
    const entry = await storage.getRiskAssessment(req.params.id);
    if (!entry || entry.userId !== req.user!.id) return res.status(404).json({ message: "Risk assessment not found" });
    res.json(entry);
  });
  app.post("/api/bcp-risks", requireAuth, async (req, res) => {
    const parsed = insertRiskAssessmentSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createRiskAssessment(parsed.data));
  });
  app.patch("/api/bcp-risks/:id", requireAuth, async (req, res) => {
    const existing = await storage.getRiskAssessment(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ message: "Risk assessment not found" });
    const parsed = patchRiskAssessmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.json(await storage.updateRiskAssessment(req.params.id, parsed.data));
  });

  app.get("/api/bcp-drills/stats", requireAuth, async (req, res) => {
    const drills = await storage.getDrills(req.user!.id);
    const total = drills.length;
    const completed = drills.filter(d => d.status === "completed").length;
    const scheduled = drills.filter(d => d.status === "scheduled").length;
    const now = new Date();
    const overdue = drills.filter(d => d.status === "scheduled" && new Date(d.scheduledDate) < now).length;
    const completedDrills = drills.filter(d => d.status === "completed" && d.result !== "pending");
    const passRate = completedDrills.length > 0 ? Math.round((completedDrills.filter(d => d.result === "passed").length / completedDrills.length) * 100) : 0;
    const byType: Record<string, number> = {};
    drills.forEach(d => { byType[d.drillType] = (byType[d.drillType] || 0) + 1; });
    const byResult: Record<string, number> = {};
    drills.forEach(d => { byResult[d.result] = (byResult[d.result] || 0) + 1; });
    const byStatus: Record<string, number> = {};
    drills.forEach(d => { byStatus[d.status] = (byStatus[d.status] || 0) + 1; });
    res.json({ total, completed, scheduled, overdue, passRate, byType, byResult, byStatus });
  });
  app.get("/api/bcp-drills", requireAuth, async (req, res) => {
    res.json(await storage.getDrills(req.user!.id));
  });
  app.get("/api/bcp-drills/:id", requireAuth, async (req, res) => {
    const drill = await storage.getDrill(req.params.id);
    if (!drill || drill.userId !== req.user!.id) return res.status(404).json({ message: "Drill not found" });
    res.json(drill);
  });
  app.post("/api/bcp-drills", requireAuth, async (req, res) => {
    const parsed = insertDrillSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createDrill(parsed.data));
  });
  app.patch("/api/bcp-drills/:id", requireAuth, async (req, res) => {
    const existing = await storage.getDrill(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ message: "Drill not found" });
    const parsed = patchDrillSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.json(await storage.updateDrill(req.params.id, parsed.data));
  });

  app.get("/api/bcp-reviews/stats", requireAuth, async (req, res) => {
    const reviews = await storage.getReviews(req.user!.id);
    const total = reviews.length;
    const pending = reviews.filter(r => r.status === "pending").length;
    const inProgress = reviews.filter(r => r.status === "in_progress").length;
    const completed = reviews.filter(r => r.status === "completed").length;
    const changesRequiredPct = total > 0 ? Math.round((reviews.filter(r => r.changesRequired).length / total) * 100) : 0;
    const byType: Record<string, number> = {};
    reviews.forEach(r => { byType[r.reviewType] = (byType[r.reviewType] || 0) + 1; });
    const byStatus: Record<string, number> = {};
    reviews.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    res.json({ total, pending, inProgress, completed, changesRequiredPct, byType, byStatus });
  });
  app.get("/api/bcp-reviews", requireAuth, async (req, res) => {
    res.json(await storage.getReviews(req.user!.id));
  });
  app.get("/api/bcp-reviews/:id", requireAuth, async (req, res) => {
    const review = await storage.getReview(req.params.id);
    if (!review || review.userId !== req.user!.id) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  });
  app.post("/api/bcp-reviews", requireAuth, async (req, res) => {
    const parsed = insertReviewSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createReview(parsed.data));
  });
  app.patch("/api/bcp-reviews/:id", requireAuth, async (req, res) => {
    const existing = await storage.getReview(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ message: "Review not found" });
    const parsed = patchReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.json(await storage.updateReview(req.params.id, parsed.data));
  });

  app.get("/api/sla-definitions", async (_req, res) => res.json(await storage.getSlaDefinitions()));
  app.post("/api/sla-definitions", requireAuth, async (req, res) => {
    const parsed = insertSlaDefinitionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createSlaDefinition(parsed.data));
  });
  app.patch("/api/sla-definitions/:id", requireAuth, async (req, res) => {
    const updated = await storage.updateSlaDefinition(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "SLA definition not found" });
    res.json(updated);
  });
  app.delete("/api/sla-definitions/:id", requireAuth, async (req, res) => {
    await storage.deleteSlaDefinition(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/cmdb", async (_req, res) => res.json(await storage.getCmdbItems()));
  app.get("/api/cmdb/:id", async (req, res) => {
    const item = await storage.getCmdbItem(req.params.id);
    if (!item) return res.status(404).json({ message: "CMDB item not found" });
    res.json(item);
  });
  app.post("/api/cmdb", async (req, res) => {
    const parsed = insertCmdbItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCmdbItem(parsed.data));
  });
  app.patch("/api/cmdb/:id", async (req, res) => {
    const parsed = patchCmdbItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateCmdbItem(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "CMDB item not found" });
    res.json(updated);
  });
  app.get("/api/cmdb-relationships", async (_req, res) => res.json(await storage.getCmdbRelationships()));
  app.post("/api/cmdb-relationships", async (req, res) => {
    const parsed = insertCmdbRelationshipSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createCmdbRelationship(parsed.data));
  });

  // ============================================================
  // KNOWN ERROR DATABASE (KEDB)
  // ============================================================
  app.get("/api/known-errors", requireAuth, async (_req, res) => res.json(await storage.getKnownErrors()));
  app.get("/api/known-errors/:id", requireAuth, async (req, res) => {
    const ke = await storage.getKnownError(Number(req.params.id));
    if (!ke) return res.status(404).json({ message: "Known error not found" });
    res.json(ke);
  });
  app.post("/api/known-errors", requireAuth, async (req, res) => {
    const parsed = insertKnownErrorSchema.omit({ kedbId: true } as any).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const ke = await storage.createKnownError(parsed.data as any);
    res.status(201).json(ke);
  });
  app.patch("/api/known-errors/:id", requireAuth, async (req, res) => {
    const ke = await storage.updateKnownError(Number(req.params.id), req.body);
    if (!ke) return res.status(404).json({ message: "Known error not found" });
    res.json(ke);
  });
  app.delete("/api/known-errors/:id", requireAuth, async (req, res) => {
    await storage.deleteKnownError(Number(req.params.id));
    res.json({ success: true });
  });

  // ============================================================
  // SLA BREACHES
  // ============================================================
  app.get("/api/sla-breaches", requireAuth, async (_req, res) => res.json(await storage.getSlaBreaches()));
  app.post("/api/sla-breaches/compute", requireAuth, async (req, res) => {
    const result = await storage.computeSlaBreaches((req as any).user?.id || "system");
    res.json(result);
  });
  app.post("/api/sla-breaches/:id/acknowledge", requireAuth, async (req, res) => {
    const b = await storage.acknowledgeSlaBreach(Number(req.params.id), (req as any).user?.id || "system");
    if (!b) return res.status(404).json({ message: "Breach not found" });
    res.json(b);
  });

  app.post("/api/sla-breaches/ai-monitor", requireAuth, async (req, res) => {
    const userId = (req as any).user?.id || "system";
    const cdKey = `sla-ai-monitor:${userId}`;
    const cooldown = isAiOnCooldown(cdKey, 3 * 60 * 1000);
    if (cooldown.blocked) return res.status(429).json({ message: `AI monitor on cooldown. Try again in ${cooldown.remainingSec}s.`, remainingSec: cooldown.remainingSec });

    const [allIncidents, allSRs, defs, existingBreaches] = await Promise.all([
      storage.getIncidents(),
      storage.getServiceRequests(),
      storage.getSlaDefinitions(),
      storage.getSlaBreaches(),
    ]);

    const now = new Date();
    const priorityMap: Record<string, { responseTimeMinutes: number; resolutionTimeMinutes: number; name: string; agreementType: string }> = {};
    for (const def of defs) {
      if (def.active) priorityMap[def.priority] = { responseTimeMinutes: def.responseTimeMinutes, resolutionTimeMinutes: def.resolutionTimeMinutes, name: def.name, agreementType: def.agreementType || "sla" };
    }

    const openStatuses = ["open", "in_progress", "pending", "new", "assigned", "in-progress"];
    const openIncidents = allIncidents.filter(i => openStatuses.includes(i.status));
    const openSRs = allSRs.filter(sr => openStatuses.includes(sr.status));
    const unacknowledgedBreaches = existingBreaches.filter(b => !b.acknowledgedAt);

    function computeRisk(entity: any, type: string) {
      const priority = entity.priority || entity.severity || "medium";
      const thresholds = priorityMap[priority] || { responseTimeMinutes: 240, resolutionTimeMinutes: 1440, name: "Default", agreementType: "sla" };
      const createdAt = new Date(entity.createdAt);
      const elapsedMin = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
      const responsePct = Math.round((elapsedMin / thresholds.responseTimeMinutes) * 100);
      const resolutionPct = Math.round((elapsedMin / thresholds.resolutionTimeMinutes) * 100);
      const alreadyBreached = unacknowledgedBreaches.some(b => b.entityId === entity.id && b.entityType === type);
      return { id: entity.id, ref: entity.incidentId || entity.requestId || `${type}-${entity.id}`, title: entity.title, priority, elapsedMin, responsePct, resolutionPct, alreadyBreached, assignedTo: entity.assignedTo, agreementType: thresholds.agreementType };
    }

    const incidentRisks = openIncidents.map(i => computeRisk(i, "incident"));
    const srRisks = openSRs.map(sr => computeRisk(sr, "service_request"));
    const allRisks = [...incidentRisks, ...srRisks];

    const atRisk = allRisks.filter(r => !r.alreadyBreached && (r.responsePct >= 70 || r.resolutionPct >= 70)).sort((a, b) => Math.max(b.responsePct, b.resolutionPct) - Math.max(a.responsePct, a.resolutionPct));
    const breached = allRisks.filter(r => r.alreadyBreached);
    const healthy = allRisks.filter(r => !r.alreadyBreached && r.responsePct < 70 && r.resolutionPct < 70);

    const totalOpen = allRisks.length;
    const healthScore = totalOpen === 0 ? 100 : Math.max(0, Math.round(((healthy.length) / totalOpen) * 100));

    const contextPayload = {
      summary: { totalOpen, atRisk: atRisk.length, breached: breached.length, healthy: healthy.length, healthScore },
      slaDefinitions: defs.filter(d => d.active).map(d => ({ priority: d.priority, agreementType: d.agreementType || "sla", responseTimeMinutes: d.responseTimeMinutes, resolutionTimeMinutes: d.resolutionTimeMinutes })),
      atRiskItems: atRisk.slice(0, 15).map(r => ({ ref: r.ref, title: r.title, priority: r.priority, elapsedMin: r.elapsedMin, responsePct: r.responsePct, resolutionPct: r.resolutionPct, assignedTo: r.assignedTo, agreementType: r.agreementType })),
      alreadyBreached: breached.slice(0, 10).map(r => ({ ref: r.ref, title: r.title, priority: r.priority, elapsedMin: r.elapsedMin, resolutionPct: r.resolutionPct, agreementType: r.agreementType })),
    };

    try {
      const { client: openai, providerName } = await getAiClient(userId);
      setAiCooldown(cdKey);

      const completion = await callAiLogged(openai, {
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an autonomous SLA/OLA compliance monitoring AI agent for HOLOCRON AI, an ITIL ITSM platform. Your role is to proactively monitor service level agreements (external SLA) and operational level agreements (internal OLA), identify risks before breaches occur, and provide actionable escalation guidance to the operations team. Be precise, professional, and prioritise by urgency. Always distinguish between SLA (client-facing) and OLA (internal) items as they have different escalation paths.`,
          },
          {
            role: "user",
            content: `Analyse the current SLA/OLA compliance status and provide a structured monitoring report. Return valid JSON with this exact schema:
{
  "overallAssessment": "one sentence executive summary of current SLA/OLA health",
  "healthScore": <0-100 integer>,
  "agentStatus": "green|amber|red",
  "narrative": "2-3 sentence detailed analysis paragraph",
  "atRiskItems": [{ "ref": string, "title": string, "priority": string, "urgency": "critical|high|medium", "agreementType": "sla|ola", "action": "specific recommended action", "timeRemaining": string }],
  "breachedItems": [{ "ref": string, "title": string, "priority": string, "agreementType": "sla|ola", "escalation": "specific escalation instruction", "suggestedRootCause": string }],
  "recommendations": [{ "title": string, "detail": string, "impact": "high|medium|low" }],
  "monitoredAt": "${now.toISOString()}"
}

Current data:
${JSON.stringify(contextPayload)}`,
          },
        ],
        max_tokens: 2000,
      }, { module: "sla", endpoint: "/api/sla-breaches/ai-monitor", userId, providerName });

      const parsed = JSON.parse(completion.choices[0].message.content || "{}");
      parsed.healthScore = parsed.healthScore ?? healthScore;
      parsed.monitoredAt = now.toISOString();
      res.json(parsed);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "AI monitor failed" });
    }
  });

  // ============================================================
  // CSI REGISTER
  // ============================================================
  app.get("/api/csi-register", requireAuth, async (_req, res) => res.json(await storage.getCsiItems()));
  app.get("/api/csi-register/:id", requireAuth, async (req, res) => {
    const item = await storage.getCsiItem(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "CSI item not found" });
    res.json(item);
  });
  app.post("/api/csi-register", requireAuth, async (req, res) => {
    const parsed = insertCsiRegisterSchema.omit({ csiId: true } as any).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createCsiItem(parsed.data as any);
    res.status(201).json(item);
  });
  app.patch("/api/csi-register/:id", requireAuth, async (req, res) => {
    const item = await storage.updateCsiItem(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ message: "CSI item not found" });
    res.json(item);
  });
  app.delete("/api/csi-register/:id", requireAuth, async (req, res) => {
    await storage.deleteCsiItem(Number(req.params.id));
    res.json({ success: true });
  });

  // ── CSI AI Endpoints ─────────────────────────────────────────────────────────

  // POST /api/csi-register/ai/analyse — AI scans incidents/problems/existing CSI and suggests new initiatives
  app.post("/api/csi-register/ai/analyse", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const [incidents, problems, csiItems] = await Promise.all([
        storage.getIncidents(),
        storage.getProblems ? storage.getProblems() : Promise.resolve([]),
        storage.getCsiItems(),
      ]);

      const incidentSummary = incidents.slice(0, 30).map(i =>
        `- [${i.severity}] ${i.title} (status: ${i.status}, category: ${i.category || "general"})`
      ).join("\n") || "No incidents found.";

      const problemSummary = (problems as any[]).slice(0, 15).map((p: any) =>
        `- ${p.title} (status: ${p.status}, priority: ${p.priority})`
      ).join("\n") || "No problems found.";

      const existingCsi = csiItems.slice(0, 20).map(c =>
        `- [${c.priority}] ${c.title} (status: ${c.status})`
      ).join("\n") || "None yet.";

      const completion = await withAiRetry(() => callAiLogged(openai, {
        model: aiModel,
        messages: [
          {
            role: "system",
            content: `You are a senior ITIL 4 Continual Service Improvement analyst for the Holocron AI platform. Analyse the provided incident and problem data, identify systemic patterns and recurring pain points, and suggest concrete improvement initiatives for the CSI Register.

Respond ONLY with a JSON object in this format:
{
  "suggestions": [
    {
      "title": "<short improvement title>",
      "description": "<2-3 sentence description of the improvement and its rationale>",
      "category": "<process|technology|people|service>",
      "priority": "<critical|high|medium|low>",
      "baseline": "<current state metric or situation>",
      "target": "<measurable target after improvement>",
      "rationale": "<why this improvement is needed based on the data>",
      "linkedPatterns": ["<pattern 1>", "<pattern 2>"]
    }
  ],
  "analysisSummary": "<1-2 sentence overall summary of what the data reveals>",
  "topRiskArea": "<the single highest-risk area that needs immediate attention>"
}

Generate 3-6 high-quality, actionable suggestions. Do not repeat existing CSI items.`,
          },
          {
            role: "user",
            content: `Analyse this IT operations data and suggest improvement initiatives:

RECENT INCIDENTS (last 30):
${incidentSummary}

OPEN PROBLEMS:
${problemSummary}

EXISTING CSI REGISTER (do not duplicate):
${existingCsi}

Identify patterns, recurring failures, and service gaps. Produce actionable ITIL 4-aligned improvement suggestions.`,
          },
        ],
        max_tokens: 1800,
        temperature: 0.4,
        response_format: { type: "json_object" },
      }, { module: "csi", endpoint: "/api/csi-register/ai/analyse", userId: req.user!.id, providerName }));

      const raw = completion.choices[0].message.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = { suggestions: [], analysisSummary: raw, topRiskArea: "" }; }

      res.json({
        suggestions: parsed.suggestions || [],
        analysisSummary: parsed.analysisSummary || "",
        topRiskArea: parsed.topRiskArea || "",
      });
    } catch (err: any) {
      const isTransient = (err.message || "").includes("Connection error") || (err.message || "").includes("fetch failed");
      res.status(503).json({ message: isTransient ? "AI provider temporarily unavailable — please try again in a moment." : err.message });
    }
  });

  // POST /api/csi-register/:id/ai/action-plan — AI generates a detailed PDCA action plan for a CSI item
  app.post("/api/csi-register/:id/ai/action-plan", requireAuth, async (req, res) => {
    try {
      const item = await storage.getCsiItem(Number(req.params.id));
      if (!item) return res.status(404).json({ message: "CSI item not found" });

      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);

      const completion = await withAiRetry(() => callAiLogged(openai, {
        model: aiModel,
        messages: [
          {
            role: "system",
            content: `You are a senior ITIL 4 CSI analyst. Generate a detailed, actionable PDCA (Plan-Do-Check-Act) action plan for the given improvement initiative.

Respond ONLY with a JSON object:
{
  "executiveSummary": "<2-3 sentence summary of the initiative and expected outcome>",
  "planPhase": {
    "objective": "<clear, measurable objective>",
    "steps": ["<step 1>", "<step 2>", "<step 3>"],
    "successCriteria": "<how you will know the plan is ready to execute>",
    "estimatedDuration": "<e.g. 2 weeks>"
  },
  "doPhase": {
    "steps": ["<implementation step 1>", "<implementation step 2>"],
    "resources": ["<resource or tool needed>"],
    "risks": ["<risk and mitigation>"],
    "estimatedDuration": "<e.g. 4 weeks>"
  },
  "checkPhase": {
    "kpis": ["<measurable KPI 1>", "<measurable KPI 2>"],
    "measurementMethod": "<how to collect data>",
    "reviewCadence": "<e.g. weekly>",
    "estimatedDuration": "<e.g. 4 weeks>"
  },
  "actPhase": {
    "scenarioIfSuccess": "<what to do if targets are met>",
    "scenarioIfFail": "<corrective actions if targets not met>",
    "sustainmentSteps": ["<how to embed the improvement>"]
  },
  "recommendedNextStatus": "<approved|in_progress|measuring>",
  "overallTimeline": "<total estimated duration>"
}`,
          },
          {
            role: "user",
            content: `Generate a PDCA action plan for this CSI initiative:

Title: ${item.title}
Description: ${item.description}
Category: ${item.category}
Priority: ${item.priority}
Current Status: ${item.status}
Baseline: ${item.baseline || "Not defined"}
Target: ${item.target || "Not defined"}
Current Measure: ${item.currentMeasure || "Not measured yet"}
Owner: ${item.owner || "Not assigned"}
Notes: ${item.notes || "None"}`,
          },
        ],
        max_tokens: 1600,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }, { module: "csi", endpoint: "/api/csi-register/:id/ai/action-plan", userId: req.user!.id, providerName }));

      const raw = completion.choices[0].message.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }

      res.json(parsed);
    } catch (err: any) {
      const isTransient = (err.message || "").includes("Connection error") || (err.message || "").includes("fetch failed");
      res.status(503).json({ message: isTransient ? "AI provider temporarily unavailable — please try again in a moment." : err.message });
    }
  });

  // POST /api/csi-register/:id/ai/advance — AI evaluates current progress and recommends + applies next status
  app.post("/api/csi-register/:id/ai/advance", requireAuth, async (req, res) => {
    try {
      const item = await storage.getCsiItem(Number(req.params.id));
      if (!item) return res.status(404).json({ message: "CSI item not found" });

      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);

      const completion = await withAiRetry(() => callAiLogged(openai, {
        model: aiModel,
        messages: [
          {
            role: "system",
            content: `You are an ITIL 4 CSI progress evaluator. Based on the improvement item's current state, evaluate whether it is ready to advance to the next PDCA stage and provide a recommendation.

Respond ONLY with a JSON object:
{
  "readyToAdvance": <true|false>,
  "recommendedStatus": "<identified|approved|in_progress|measuring|completed|cancelled>",
  "progressAssessment": "<1-2 sentences on current progress>",
  "gapsBeforeAdvancing": ["<gap 1>", "<gap 2>"],
  "suggestedCurrentMeasure": "<if you can infer a better current measure from context, suggest one, otherwise empty>",
  "nextActions": ["<immediate next action 1>", "<immediate next action 2>"],
  "confidence": <0-100>
}`,
          },
          {
            role: "user",
            content: `Evaluate this CSI item and recommend next steps:

Title: ${item.title}
Current Status: ${item.status}
Baseline: ${item.baseline || "Not defined"}
Target: ${item.target || "Not defined"}
Current Measure: ${item.currentMeasure || "Not yet measured"}
Owner: ${item.owner || "Unassigned"}
Start Date: ${item.startDate ? new Date(item.startDate).toDateString() : "Not set"}
Target Date: ${item.targetDate ? new Date(item.targetDate).toDateString() : "Not set"}
Notes: ${item.notes || "None"}

Should this item advance to the next status? If so, which status and what must happen first?`,
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }, { module: "csi", endpoint: "/api/csi-register/:id/ai/advance", userId: req.user!.id, providerName }));

      const raw = completion.choices[0].message.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }

      // If AI is confident and recommends advancing, apply the status change
      let updatedItem = item;
      if (parsed.readyToAdvance && parsed.recommendedStatus && parsed.confidence >= 70) {
        const patch: any = { status: parsed.recommendedStatus };
        if (parsed.suggestedCurrentMeasure) patch.currentMeasure = parsed.suggestedCurrentMeasure;
        if (parsed.recommendedStatus === "completed") patch.completedAt = new Date();
        updatedItem = await storage.updateCsiItem(item.id, patch) || item;
      }

      res.json({ ...parsed, applied: parsed.readyToAdvance && parsed.confidence >= 70, updatedItem });
    } catch (err: any) {
      const isTransient = (err.message || "").includes("Connection error") || (err.message || "").includes("fetch failed");
      res.status(503).json({ message: isTransient ? "AI provider temporarily unavailable — please try again in a moment." : err.message });
    }
  });

  // ============================================================
  // RELEASE MANAGEMENT
  // ============================================================
  app.get("/api/releases", requireAuth, async (_req, res) => res.json(await storage.getReleases()));
  app.get("/api/releases/:id", requireAuth, async (req, res) => {
    const r = await storage.getRelease(Number(req.params.id));
    if (!r) return res.status(404).json({ message: "Release not found" });
    res.json(r);
  });
  app.post("/api/releases", requireAuth, async (req, res) => {
    const parsed = insertReleaseSchema.omit({ releaseId: true } as any).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const r = await storage.createRelease(parsed.data as any);
    res.status(201).json(r);
  });
  app.patch("/api/releases/:id", requireAuth, async (req, res) => {
    const r = await storage.updateRelease(Number(req.params.id), req.body);
    if (!r) return res.status(404).json({ message: "Release not found" });
    res.json(r);
  });
  app.delete("/api/releases/:id", requireAuth, async (req, res) => {
    await storage.deleteRelease(Number(req.params.id));
    res.json({ success: true });
  });
  app.post("/api/releases/:id/approve", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const r = await storage.updateRelease(Number(req.params.id), {
      goLiveApproval: true, goLiveApprovedBy: user?.username || "system", goLiveApprovedAt: new Date(),
    });
    if (!r) return res.status(404).json({ message: "Release not found" });
    res.json(r);
  });
  app.get("/api/releases/:id/items", requireAuth, async (req, res) => {
    res.json(await storage.getReleaseItems(Number(req.params.id)));
  });
  app.post("/api/releases/:id/items", requireAuth, async (req, res) => {
    const parsed = insertReleaseItemSchema.safeParse({ ...req.body, releaseId: Number(req.params.id) });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createReleaseItem(parsed.data);
    res.status(201).json(item);
  });
  app.patch("/api/release-items/:id", requireAuth, async (req, res) => {
    const item = await storage.updateReleaseItem(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ message: "Release item not found" });
    res.json(item);
  });
  app.delete("/api/release-items/:id", requireAuth, async (req, res) => {
    await storage.deleteReleaseItem(Number(req.params.id));
    res.json({ success: true });
  });

  // Service Health Readings
  app.get("/api/service-health/readings", requireAuth, async (req, res) => {
    const { serviceName, metricType, limit } = req.query;
    const readings = await storage.getServiceReadings({
      serviceName: serviceName as string | undefined,
      metricType: metricType as string | undefined,
      limit: limit ? parseInt(limit as string) : 100,
    });
    res.json(readings);
  });

  app.post("/api/service-health/readings", requireAuth, async (req, res) => {
    const body = req.body;
    if (Array.isArray(body)) {
      const readings = body.map(r => ({ ...r, measuredAt: r.measuredAt ? new Date(r.measuredAt) : new Date() }));
      const created = await storage.createServiceReadingsBatch(readings);
      return res.status(201).json(created);
    }
    const parsed = insertServiceReadingSchema.safeParse({ ...body, measuredAt: body.measuredAt ? new Date(body.measuredAt) : new Date() });
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createServiceReading(parsed.data));
  });

  // Service Health Summary — agreed vs actual per service
  app.get("/api/service-health", requireAuth, async (req, res) => {
    const [defs, readings, incidents, serviceRequests] = await Promise.all([
      storage.getSlaDefinitions(),
      storage.getServiceReadings({ limit: 500 }),
      storage.getIncidents(),
      storage.getServiceRequests(),
    ]);

    const activeDefs = defs.filter(d => d.active && d.serviceScope);
    const services = Array.from(new Set(activeDefs.map(d => d.serviceScope as string)));

    const allTickets = [
      ...incidents.map(i => ({ priority: i.priority, status: i.status, createdAt: i.createdAt, resolvedAt: (i as any).resolvedAt, respondedAt: (i as any).respondedAt, service: (i as any).affectedServices?.[0] || null })),
      ...serviceRequests.map(sr => ({ priority: sr.priority, status: sr.status, createdAt: sr.createdAt, resolvedAt: (sr as any).resolvedAt, respondedAt: null, service: null })),
    ];

    const serviceHealth = services.map(serviceName => {
      const slaForService = activeDefs.filter(d => d.serviceScope === serviceName && (d.agreementType ?? "sla") === "sla");
      const olaForService = activeDefs.filter(d => d.serviceScope === serviceName && d.agreementType === "ola");

      // Latest readings per metric type
      const serviceReadingsList = readings.filter(r => r.serviceName === serviceName);
      const latestByType: Record<string, typeof serviceReadingsList[0]> = {};
      for (const r of serviceReadingsList) {
        if (!latestByType[r.metricType] || new Date(r.measuredAt!) > new Date(latestByType[r.metricType].measuredAt!)) {
          latestByType[r.metricType] = r;
        }
      }

      // SLA targets per priority (lowest = most permissive = use as baseline)
      const lowestResponseMin = slaForService.length > 0
        ? Math.min(...slaForService.map(s => s.responseTimeMinutes))
        : null;
      const lowestResolutionMin = slaForService.length > 0
        ? Math.min(...slaForService.map(s => s.resolutionTimeMinutes))
        : null;

      // Metrics from readings
      const uptimeReading = latestByType["uptime"];
      const errorRateReading = latestByType["error_rate"];
      const responseTimeReading = latestByType["response_time"];
      const throughputReading = latestByType["throughput"];
      const mttrReading = latestByType["mttr"];

      // History for sparklines
      const uptimeHistory = serviceReadingsList.filter(r => r.metricType === "uptime").slice(0, 24).map(r => r.value);
      const responseTimeHistory = serviceReadingsList.filter(r => r.metricType === "response_time").slice(0, 24).map(r => r.value);

      const agreedUptime = slaForService.find(s => (s as any).uptimeTarget) ? (slaForService[0] as any).uptimeTarget : null;
      const actualUptime = uptimeReading?.value ?? null;

      const agreedResponseMin = lowestResponseMin;
      const actualResponseMin = mttrReading?.value ?? responseTimeReading?.value ?? null;
      const agreedResolutionMin = lowestResolutionMin;

      // Overall compliance score
      let complianceScore = 100;
      let complianceFactors = 0;
      if (actualUptime !== null && agreedUptime !== null) {
        complianceScore -= actualUptime < agreedUptime ? (agreedUptime - actualUptime) * 10 : 0;
        complianceFactors++;
      }
      if (actualResponseMin !== null && agreedResponseMin !== null) {
        if (actualResponseMin > agreedResponseMin) complianceScore -= Math.min(30, ((actualResponseMin - agreedResponseMin) / agreedResponseMin) * 30);
        complianceFactors++;
      }
      complianceScore = Math.max(0, Math.min(100, complianceScore));

      return {
        serviceName,
        slaCount: slaForService.length,
        olaCount: olaForService.length,
        slaDetails: slaForService.map(s => ({ id: s.id, name: s.name, priority: s.priority, responseTimeMinutes: s.responseTimeMinutes, resolutionTimeMinutes: s.resolutionTimeMinutes, counterparty: s.counterparty })),
        olaDetails: olaForService.map(s => ({ id: s.id, name: s.name, priority: s.priority, responseTimeMinutes: s.responseTimeMinutes, resolutionTimeMinutes: s.resolutionTimeMinutes, counterparty: s.counterparty })),
        agreedTargets: {
          responseTimeMinutes: agreedResponseMin,
          resolutionTimeMinutes: agreedResolutionMin,
        },
        metrics: {
          uptime: uptimeReading ? { value: uptimeReading.value, unit: uptimeReading.unit, measuredAt: uptimeReading.measuredAt, source: uptimeReading.source } : null,
          errorRate: errorRateReading ? { value: errorRateReading.value, unit: errorRateReading.unit, measuredAt: errorRateReading.measuredAt, source: errorRateReading.source } : null,
          responseTime: responseTimeReading ? { value: responseTimeReading.value, unit: responseTimeReading.unit, measuredAt: responseTimeReading.measuredAt, source: responseTimeReading.source } : null,
          throughput: throughputReading ? { value: throughputReading.value, unit: throughputReading.unit, measuredAt: throughputReading.measuredAt, source: throughputReading.source } : null,
          mttr: mttrReading ? { value: mttrReading.value, unit: mttrReading.unit, measuredAt: mttrReading.measuredAt, source: mttrReading.source } : null,
        },
        history: { uptime: uptimeHistory, responseTime: responseTimeHistory },
        complianceScore,
        totalReadings: serviceReadingsList.length,
        lastUpdated: serviceReadingsList.length > 0 ? serviceReadingsList[0].measuredAt : null,
      };
    });

    // Also return services that have readings but no SLA yet
    const readingServices = Array.from(new Set(readings.map(r => r.serviceName))).filter(s => !services.includes(s));
    const unlinked = readingServices.map(serviceName => {
      const serviceReadingsList = readings.filter(r => r.serviceName === serviceName);
      const latestByType: Record<string, typeof serviceReadingsList[0]> = {};
      for (const r of serviceReadingsList) {
        if (!latestByType[r.metricType] || new Date(r.measuredAt!) > new Date(latestByType[r.metricType].measuredAt!)) {
          latestByType[r.metricType] = r;
        }
      }
      return {
        serviceName, slaCount: 0, olaCount: 0, slaDetails: [], olaDetails: [],
        agreedTargets: { responseTimeMinutes: null, resolutionTimeMinutes: null },
        metrics: {
          uptime: latestByType["uptime"] ? { value: latestByType["uptime"].value, unit: latestByType["uptime"].unit, measuredAt: latestByType["uptime"].measuredAt, source: latestByType["uptime"].source } : null,
          errorRate: latestByType["error_rate"] ? { value: latestByType["error_rate"].value, unit: latestByType["error_rate"].unit, measuredAt: latestByType["error_rate"].measuredAt, source: latestByType["error_rate"].source } : null,
          responseTime: latestByType["response_time"] ? { value: latestByType["response_time"].value, unit: latestByType["response_time"].unit, measuredAt: latestByType["response_time"].measuredAt, source: latestByType["response_time"].source } : null,
          throughput: latestByType["throughput"] ? { value: latestByType["throughput"].value, unit: latestByType["throughput"].unit, measuredAt: latestByType["throughput"].measuredAt, source: latestByType["throughput"].source } : null,
          mttr: latestByType["mttr"] ? { value: latestByType["mttr"].value, unit: latestByType["mttr"].unit, measuredAt: latestByType["mttr"].measuredAt, source: latestByType["mttr"].source } : null,
        },
        history: { uptime: [], responseTime: [] },
        complianceScore: null,
        totalReadings: serviceReadingsList.length,
        lastUpdated: serviceReadingsList.length > 0 ? serviceReadingsList[0].measuredAt : null,
      };
    });

    res.json([...serviceHealth, ...unlinked]);
  });

  // AI analysis of service health vs SLA targets
  app.post("/api/service-health/ai-analyse", requireAuth, async (req, res) => {
    const userId = (req as any).user?.id;
    const cdKey = `service-health-ai:${userId}`;
    const cdCheck = isAiOnCooldown(cdKey, 3 * 60 * 1000);
    if (cdCheck.blocked) {
      return res.status(429).json({ message: `AI analysis on cooldown — ${cdCheck.remainingSec}s remaining` });
    }

    const { serviceName } = req.body;
    const [defs, readings] = await Promise.all([
      storage.getSlaDefinitions(),
      storage.getServiceReadings({ serviceName: serviceName || undefined, limit: 200 }),
    ]);

    const activeDefs = defs.filter(d => d.active);

    // Build context per service
    const services = serviceName
      ? [serviceName]
      : Array.from(new Set(activeDefs.filter(d => d.serviceScope).map(d => d.serviceScope as string)));

    const serviceContexts = services.map(svc => {
      const defs4svc = activeDefs.filter(d => d.serviceScope === svc);
      const readings4svc = readings.filter(r => r.serviceName === svc);
      const latestByType: Record<string, number> = {};
      for (const r of readings4svc) {
        if (!latestByType[r.metricType]) latestByType[r.metricType] = r.value;
      }
      return { serviceName: svc, agreements: defs4svc.map(d => ({ type: d.agreementType || "sla", priority: d.priority, responseMin: d.responseTimeMinutes, resolutionMin: d.resolutionTimeMinutes, counterparty: d.counterparty })), actualMetrics: latestByType, readingCount: readings4svc.length };
    });

    setAiCooldown(cdKey);
    try {
      const { client: openai, providerName } = await getAiClient(userId);
      const completion = await callAiLogged(openai, {
        model: "gpt-4o",
        response_format: { type: "json_object" },
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content: `You are a Service Health Intelligence Agent for HOLOCRON AI, an ITIL ITSM platform. You analyse real-time service metrics against agreed SLA/OLA targets and produce an actionable compliance assessment. Be precise and professional.`,
          },
          {
            role: "user",
            content: `Analyse the following service health data. For each service, compare the actual measured metrics against the agreed SLA/OLA targets.

Service Data: ${JSON.stringify(serviceContexts)}

Metric types that may appear:
- uptime: % availability (agreed target usually 99.5% or 99.9%)
- response_time: minutes to first response on tickets (compare to responseMin target)
- mttr: mean time to resolve in minutes (compare to resolutionMin target)
- error_rate: % of requests failing (target usually < 1%)
- throughput: requests/sec

Return JSON:
{
  "overallHealthScore": 0-100,
  "status": "healthy" | "degraded" | "critical",
  "summary": "one paragraph executive summary",
  "services": [
    {
      "serviceName": "...",
      "complianceScore": 0-100,
      "status": "healthy" | "at_risk" | "breaching" | "no_data",
      "gaps": [{ "metric": "...", "agreed": "...", "actual": "...", "variance": "...", "severity": "critical|high|medium" }],
      "positives": ["..."],
      "recommendations": [{ "action": "...", "rationale": "...", "urgency": "immediate|soon|planned" }]
    }
  ],
  "topPriorityAction": "single most important action to take right now"
}`,
          },
        ],
      }, { module: "service-health", endpoint: "/api/service-health/ai-analyse", userId: req.user!.id, providerName });
      const result = JSON.parse(completion.choices[0].message.content || "{}");
      res.json({ ...result, analysedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "AI analysis failed" });
    }
  });

  // ─── Capacity Management ────────────────────────────────────────────────────
  const CAPACITY_METRIC_CFG: Record<string, { label: string; higherIsBetter: boolean; warningThreshold: number; criticalThreshold: number }> = {
    uptime:        { label: "Uptime",             higherIsBetter: true,  warningThreshold: 99.5, criticalThreshold: 99.0 },
    error_rate:    { label: "Error Rate",          higherIsBetter: false, warningThreshold: 1,    criticalThreshold: 3    },
    response_time: { label: "Avg Response Time",   higherIsBetter: false, warningThreshold: 60,   criticalThreshold: 120  },
    mttr:          { label: "MTTR",                higherIsBetter: false, warningThreshold: 240,  criticalThreshold: 480  },
    throughput:    { label: "Throughput",           higherIsBetter: true,  warningThreshold: 0,    criticalThreshold: 0    },
  };

  app.get("/api/capacity/overview", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const [defs, readings, customThresholds] = await Promise.all([
      storage.getSlaDefinitions(),
      storage.getServiceReadings({ limit: 500 }),
      storage.getCapacityThresholds(userId),
    ]);
    const customThresholdMap = new Map(customThresholds.map((t: any) => [`${t.serviceName}::${t.metricType}`, t]));

    const serviceNames = Array.from(new Set(readings.map((r: any) => r.serviceName)));

    const services = serviceNames.map((serviceName: any) => {
      const svcReadings = readings.filter((r: any) => r.serviceName === serviceName);
      const svcDefs = defs.filter((d: any) => d.serviceScope === serviceName);
      const agreedResponseMin = svcDefs.reduce((mn: number, d: any) => Math.min(mn, d.responseTimeMinutes || Infinity), Infinity);
      const agreedResolutionMin = svcDefs.reduce((mn: number, d: any) => Math.min(mn, d.resolutionTimeMinutes || Infinity), Infinity);

      const metricTypes = Array.from(new Set(svcReadings.map((r: any) => r.metricType)));

      const metrics = metricTypes.map((metricType: any) => {
        const mReadings = svcReadings
          .filter((r: any) => r.metricType === metricType)
          .sort((a: any, b: any) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
        const latest = mReadings[mReadings.length - 1];
        const defaultCfg = CAPACITY_METRIC_CFG[metricType];
        const custom = customThresholdMap.get(`${serviceName}::${metricType}`);
        const cfg = custom
          ? { ...defaultCfg, warningThreshold: custom.warningThreshold, criticalThreshold: custom.criticalThreshold, higherIsBetter: custom.higherIsBetter }
          : defaultCfg;
        const n = mReadings.length;

        let trendSlope = 0;
        let trend = "stable";
        let forecastDaysToBreach: number | null = null;

        if (n >= 3) {
          const values = mReadings.map((r: any) => r.value);
          const mean = values.reduce((a: number, b: number) => a + b, 0) / n;
          const sumXY = values.reduce((s: number, v: number, i: number) => s + i * (v - mean), 0);
          const sumX2 = values.reduce((s: number, _: any, i: number) => s + i * i, 0);
          trendSlope = sumX2 === 0 ? 0 : sumXY / sumX2;
          const isDegrading = cfg?.higherIsBetter ? trendSlope < -0.05 : trendSlope > 0.1;
          const isImproving = cfg?.higherIsBetter ? trendSlope > 0.05 : trendSlope < -0.1;
          trend = isDegrading ? "degrading" : isImproving ? "improving" : "stable";

          if (trend === "degrading" && cfg && trendSlope !== 0) {
            const critVal = metricType === "response_time" ? (agreedResponseMin < Infinity ? agreedResponseMin : cfg.criticalThreshold)
              : metricType === "mttr" ? (agreedResolutionMin < Infinity ? agreedResolutionMin : cfg.criticalThreshold)
              : cfg.criticalThreshold;
            const readingsToBreach = cfg.higherIsBetter
              ? (latest.value - critVal) / Math.abs(trendSlope)
              : (critVal - latest.value) / trendSlope;
            if (readingsToBreach > 0 && readingsToBreach < 1000) {
              const firstMs = new Date(mReadings[0].measuredAt).getTime();
              const lastMs = new Date(mReadings[n - 1].measuredAt).getTime();
              const avgIntervalDays = n > 1 ? (lastMs - firstMs) / (n - 1) / 86400000 : 1;
              const days = Math.round(readingsToBreach * avgIntervalDays);
              if (days > 0 && days <= 365) forecastDaysToBreach = days;
            }
          }
        }

        const critVal = metricType === "response_time" ? (agreedResponseMin < Infinity ? agreedResponseMin : cfg?.criticalThreshold ?? 120)
          : metricType === "mttr" ? (agreedResolutionMin < Infinity ? agreedResolutionMin : cfg?.criticalThreshold ?? 480)
          : cfg?.criticalThreshold ?? 100;
        let utilizationPct = 0;
        if (cfg && latest) {
          if (cfg.higherIsBetter) {
            const range = 100 - (cfg.criticalThreshold || 99);
            utilizationPct = range > 0 ? Math.min(100, Math.max(0, (100 - latest.value) / range * 100)) : 0;
          } else {
            utilizationPct = critVal > 0 ? Math.min(100, (latest.value / critVal) * 100) : 0;
          }
        }
        const metricRiskLevel = utilizationPct >= 80 ? "critical" : utilizationPct >= 50 ? "warning" : "healthy";

        return {
          metricType,
          label: cfg?.label ?? metricType,
          unit: latest.unit,
          latestValue: latest.value,
          utilizationPct: Math.round(utilizationPct),
          riskLevel: metricRiskLevel,
          trend,
          trendSlope: Math.round(trendSlope * 100) / 100,
          forecastDaysToBreach,
          readingCount: n,
          history: mReadings.slice(-20).map((r: any) => ({ value: r.value, measuredAt: r.measuredAt instanceof Date ? r.measuredAt.toISOString() : String(r.measuredAt) })),
          thresholds: {
            warning: metricType === "response_time" ? (agreedResponseMin < Infinity ? Math.round(agreedResponseMin * 0.7) : cfg?.warningThreshold ?? 0)
              : metricType === "mttr" ? (agreedResolutionMin < Infinity ? Math.round(agreedResolutionMin * 0.7) : cfg?.warningThreshold ?? 0)
              : cfg?.warningThreshold ?? 0,
            critical: critVal,
          },
          hasCustomThreshold: !!custom,
        };
      });

      const risks = metrics.map((m: any) => m.riskLevel);
      const riskLevel = risks.includes("critical") ? "critical" : risks.includes("warning") ? "warning" : metrics.length === 0 ? "no_data" : "healthy";
      const capacityScore = metrics.length === 0 ? null : Math.max(0, Math.round(100 - metrics.reduce((s: number, m: any) => s + m.utilizationPct, 0) / metrics.length));
      const lastUpdated = svcReadings.length > 0
        ? [...svcReadings].sort((a: any, b: any) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime())[0].measuredAt
        : null;

      return { serviceName, riskLevel, capacityScore, lastUpdated: lastUpdated instanceof Date ? lastUpdated.toISOString() : lastUpdated ? String(lastUpdated) : null, metrics };
    });

    const summary = {
      total: services.length,
      healthy: services.filter((s: any) => s.riskLevel === "healthy").length,
      warning: services.filter((s: any) => s.riskLevel === "warning").length,
      critical: services.filter((s: any) => s.riskLevel === "critical").length,
      noData: services.filter((s: any) => s.riskLevel === "no_data").length,
    };

    res.json({ services, summary });
  });

  app.post("/api/capacity/ai-analyse", requireAuth, async (req, res) => {
    const userId = (req as any).user?.id;
    const cdKey = `capacity-ai:${userId}`;
    const cdCheck = isAiOnCooldown(cdKey, 3 * 60 * 1000);
    if (cdCheck.blocked) return res.status(429).json({ message: `AI analysis on cooldown — ${cdCheck.remainingSec}s remaining` });

    const [defs, readings] = await Promise.all([
      storage.getSlaDefinitions(),
      storage.getServiceReadings({ limit: 500 }),
    ]);

    const serviceNames = Array.from(new Set(readings.map((r: any) => r.serviceName)));
    if (serviceNames.length === 0) return res.status(400).json({ message: "No service readings available for analysis" });

    const context = serviceNames.map((sn: any) => {
      const svcR = readings.filter((r: any) => r.serviceName === sn);
      const svcD = defs.filter((d: any) => d.serviceScope === sn);
      const byType: Record<string, number[]> = {};
      svcR.forEach((r: any) => { if (!byType[r.metricType]) byType[r.metricType] = []; byType[r.metricType].push(r.value); });
      return {
        serviceName: sn,
        agreedTargets: svcD.map((d: any) => ({ type: d.agreementType, responseMin: d.responseTimeMinutes, resolutionMin: d.resolutionTimeMinutes })),
        metrics: Object.entries(byType).map(([type, values]) => ({ type, latest: values[values.length - 1], last10: values.slice(-10), count: values.length })),
      };
    });

    try {
      const { client, model } = await getAiClient();
      const completion = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        max_tokens: 1800,
        messages: [
          { role: "system", content: `You are an ITIL Capacity and Performance Management specialist. Analyse the service metric trends and return a JSON capacity risk report. Return this exact schema:\n{"summary":"string","overallRisk":"low|medium|high|critical","services":[{"serviceName":"string","riskLevel":"healthy|warning|critical","keyRisks":["string"],"recommendations":[{"action":"string","urgency":"immediate|soon|planned","rationale":"string"}],"forecastSummary":"string|null"}],"topPriorityAction":"string"}` },
          { role: "user", content: `Analyse capacity for:\n${JSON.stringify(context)}` },
        ],
      });
      const aiData = JSON.parse(completion.choices[0].message.content || "{}");

      // Replace any previous AI-suggested actions (not yet approved) with fresh ones from this analysis
      const prevSuggested = await storage.getCapacityActions(userId, { status: "suggested" });
      for (const a of prevSuggested) await storage.deleteCapacityAction(a.id, userId);

      const urgencyMap: Record<string, string> = { immediate: "immediate", soon: "soon", planned: "monitor" };
      for (const svc of aiData.services ?? []) {
        for (const rec of svc.recommendations ?? []) {
          await storage.createCapacityAction({
            userId,
            serviceName: svc.serviceName,
            title: rec.action,
            rationale: rec.rationale,
            urgency: urgencyMap[rec.urgency] ?? "monitor",
            status: "suggested",
            source: "ai_agent",
            metricType: null,
            owner: null,
            dueDate: null,
            notes: null,
          });
        }
      }

      res.json({ ...aiData, analysedAt: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "AI capacity analysis failed" });
    }
  });
  // ─── Capacity Thresholds ──────────────────────────────────────────────────────
  app.get("/api/capacity/thresholds", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { serviceName } = req.query as { serviceName?: string };
    res.json(await storage.getCapacityThresholds(userId, serviceName));
  });

  app.put("/api/capacity/thresholds", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { serviceName, metricType, warningThreshold, criticalThreshold, higherIsBetter } = req.body;
    if (!serviceName || !metricType || warningThreshold == null || criticalThreshold == null)
      return res.status(400).json({ message: "serviceName, metricType, warningThreshold, criticalThreshold required" });
    const row = await storage.upsertCapacityThreshold({ userId, serviceName, metricType, warningThreshold, criticalThreshold, higherIsBetter: higherIsBetter ?? false });
    res.json(row);
  });

  app.delete("/api/capacity/thresholds/:id", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    await storage.deleteCapacityThreshold(req.params.id, userId);
    res.json({ ok: true });
  });

  // ─── Capacity Actions ─────────────────────────────────────────────────────────
  app.get("/api/capacity/actions", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { serviceName, status } = req.query as { serviceName?: string; status?: string };
    res.json(await storage.getCapacityActions(userId, { serviceName, status }));
  });

  app.post("/api/capacity/actions", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { serviceName, metricType, title, rationale, urgency, status, owner, dueDate, notes, source } = req.body;
    if (!serviceName || !title) return res.status(400).json({ message: "serviceName and title required" });
    const row = await storage.createCapacityAction({ userId, serviceName, metricType, title, rationale, urgency: urgency ?? "monitor", status: status ?? "open", owner, dueDate, notes, source: source ?? "manual" });
    res.status(201).json(row);
  });

  app.patch("/api/capacity/actions/:id", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const updates: any = { ...req.body };
    if (updates.status === "resolved" && !updates.resolvedAt) updates.resolvedAt = new Date();
    if (updates.status && updates.status !== "resolved") updates.resolvedAt = null;
    const row = await storage.updateCapacityAction(req.params.id, userId, updates);
    if (!row) return res.status(404).json({ message: "Action not found" });
    res.json(row);
  });

  app.delete("/api/capacity/actions/:id", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    await storage.deleteCapacityAction(req.params.id, userId);
    res.json({ ok: true });
  });

  // ─── Capacity Demand Events ───────────────────────────────────────────────────
  app.get("/api/capacity/demand-events", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { serviceName } = req.query as { serviceName?: string };
    res.json(await storage.getCapacityDemandEvents(userId, serviceName));
  });

  app.post("/api/capacity/demand-events", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { serviceName, title, description, expectedImpact, estimatedLoadIncreasePct, plannedDate, status } = req.body;
    if (!serviceName || !title || !plannedDate) return res.status(400).json({ message: "serviceName, title, plannedDate required" });
    const row = await storage.createCapacityDemandEvent({ userId, serviceName, title, description, expectedImpact, estimatedLoadIncreasePct, plannedDate, status: status ?? "planned" });
    res.status(201).json(row);
  });

  app.patch("/api/capacity/demand-events/:id", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const row = await storage.updateCapacityDemandEvent(req.params.id, userId, req.body);
    if (!row) return res.status(404).json({ message: "Demand event not found" });
    res.json(row);
  });

  app.delete("/api/capacity/demand-events/:id", requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    await storage.deleteCapacityDemandEvent(req.params.id, userId);
    res.json({ ok: true });
  });
  // ─── End Capacity Management ─────────────────────────────────────────────────

  app.get("/api/connectors", async (_req, res) => res.json(await storage.getConnectors()));
  app.get("/api/connectors/:id", async (req, res) => {
    const c = await storage.getConnector(req.params.id);
    if (!c) return res.status(404).json({ message: "Connector not found" });
    res.json(c);
  });
  app.post("/api/connectors", async (req, res) => {
    const parsed = insertConnectorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const created = await storage.createConnector(parsed.data);
    const agents = await storage.getAgents();
    const netAgent = agents.find(a => a.type === "network_monitor") || agents.find(a => a.type === "asset_manager");
    if (netAgent) {
      await storage.createAgentActivity({ agentId: netAgent.id, action: "Connector Registered", details: `New ${parsed.data.protocol.toUpperCase()} connector "${parsed.data.name}" targeting ${parsed.data.host}`, relatedEntityType: "connector", relatedEntityId: created.id, autonomous: true });
    }
    res.status(201).json(created);
  });
  app.patch("/api/connectors/:id", async (req, res) => {
    const parsed = patchConnectorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateConnector(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Connector not found" });
    res.json(updated);
  });

  app.get("/api/playbooks", async (_req, res) => res.json(await storage.getPlaybooks()));
  app.get("/api/playbooks/:id", async (req, res) => {
    const p = await storage.getPlaybook(req.params.id);
    if (!p) return res.status(404).json({ message: "Playbook not found" });
    res.json(p);
  });
  app.post("/api/playbooks", async (req, res) => {
    const parsed = insertPlaybookSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createPlaybook(parsed.data));
  });
  app.patch("/api/playbooks/:id", async (req, res) => {
    const parsed = patchPlaybookSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updatePlaybook(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Playbook not found" });
    res.json(updated);
  });

  app.get("/api/playbook-executions", async (_req, res) => res.json(await storage.getPlaybookExecutions()));
  app.post("/api/playbook-executions", async (req, res) => {
    const parsed = insertPlaybookExecutionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createPlaybookExecution(parsed.data));
  });

  app.get("/api/telemetry", async (_req, res) => res.json(await storage.getTelemetryMetrics()));
  app.get("/api/telemetry/:sourceId", async (req, res) => res.json(await storage.getTelemetryBySource(req.params.sourceId)));
  app.post("/api/telemetry", async (req, res) => {
    const parsed = insertTelemetryMetricSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createTelemetryMetric(parsed.data));
  });

  app.get("/api/agent-activities", async (_req, res) => res.json(await storage.getAgentActivities()));
  app.get("/api/agent-activities/autonomous", async (_req, res) => res.json(await storage.getAutonomousActivities()));

  app.get("/api/chat/messages", async (_req, res) => res.json(await storage.getChatMessages()));
  app.post("/api/chat/messages", async (req, res) => {
    const parsed = insertChatMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const userMessage = await storage.createChatMessage(parsed.data);
    const agentResponse = await generateMasterResponse(parsed.data.content, req.user?.id);
    const aiMessage = await storage.createChatMessage({ role: "assistant", content: agentResponse.message, agentId: agentResponse.agentId });
    if (agentResponse.activity) await storage.createAgentActivity(agentResponse.activity);
    res.status(201).json({ userMessage, aiMessage });
  });

  app.get("/api/org-roles", async (req, res) => {
    const roles = await storage.getOrgRoles();
    const userCountry = req.user?.country;
    const multiplier = getSalaryMultiplier(userCountry);
    const adjusted = roles.map(r => {
      const humanAdj = r.humanCostMonthly ? Math.round(r.humanCostMonthly * multiplier) : r.humanCostMonthly;
      const aiAdj = r.monthlyPrice ? clampAiPrice(Math.round(r.monthlyPrice * multiplier)) : r.monthlyPrice;
      return { ...r, monthlyPrice: aiAdj, humanCostMonthly: humanAdj };
    });
    res.json(adjusted);
  });
  app.get("/api/org-roles/:id", async (req, res) => {
    const role = await storage.getOrgRole(req.params.id);
    if (!role) return res.status(404).json({ message: "Role not found" });
    const userCountry = req.user?.country;
    const multiplier = getSalaryMultiplier(userCountry);
    const humanAdj = role.humanCostMonthly ? Math.round(role.humanCostMonthly * multiplier) : role.humanCostMonthly;
    const aiAdj = role.monthlyPrice ? clampAiPrice(Math.round(role.monthlyPrice * multiplier)) : role.monthlyPrice;
    res.json({ ...role, monthlyPrice: aiAdj, humanCostMonthly: humanAdj });
  });

  const AGENT_PROFILE_SYSTEM_PROMPT = `You are the HOLOCRON AI ITSM Best Practice Engine. You analyze IT agent roles and determine which service metrics they should monitor based on ITIL/ITSM best practices.

STRICT RULES FOR PRIORITY ASSIGNMENT:
- "critical": ONLY metrics that are DIRECTLY within this agent's core operational domain. The agent cannot perform their primary function without this metric. Example: Network Throughput is critical for a Network Engineer, but NOT for a DBA.
- "recommended": Metrics that provide valuable supplementary context for this agent's work. They enhance effectiveness but aren't part of the agent's primary domain. Example: CPU Usage is recommended for a Messaging Administrator (Exchange needs CPU) but not critical to their mail flow management function.
- "optional": General infrastructure metrics that offer background awareness. Useful but not directly tied to the agent's responsibilities.

DO NOT mark generic infrastructure metrics (CPU, Memory, Disk, Antivirus, Firewall) as "critical" unless the agent's PRIMARY JOB is specifically managing that metric domain. A Security Analyst's critical metrics are security-focused. A Network Engineer's critical metrics are network-focused. A Messaging Admin's critical metrics are messaging/mail-flow focused.

You may also suggest NEW metrics that should be added to the catalog if the existing catalog lacks domain-specific metrics for this role. Use the "newMetrics" array for these.

Respond ONLY with valid JSON (no markdown). Format:
{
  "assignments": [{"metricId":"existing-id","priority":"critical","reasoning":"reason"}],
  "newMetrics": [{"name":"Mail Queue Length","description":"Number of messages waiting in Exchange transport queues","category":"performance","protocol":"WMI","collectionMode":"continuous","unit":"count","warningThreshold":100,"criticalThreshold":500,"icon":"Activity","priority":"critical","reasoning":"Essential for monitoring mail flow health"}]
}

Return empty arrays if nothing applies: {"assignments":[],"newMetrics":[]}`;

  function buildAgentProfileUserPrompt(role: any, catalogMetrics: any[]) {
    return `Agent Role: ${role.title}
Department: ${role.department}
Division: ${role.division || "N/A"}
Level: ${role.level}
Description: ${role.description}
Responsibilities: ${(role.responsibilities || []).join(", ")}
AI Capabilities: ${(role.aiCapabilities || []).join(", ")}
Key Tasks: ${(role.keyTasks || []).slice(0, 6).join(", ")}

Available Service Metrics Catalog:
${JSON.stringify(catalogMetrics.map(m => ({id:m.id,name:m.name,description:m.description,category:m.category,protocol:m.protocol,collectionMode:m.collectionMode,unit:m.unit})))}

Determine which existing catalog metrics this agent should monitor (with correct priorities), and suggest any domain-specific NEW metrics missing from the catalog.`;
  }

  async function processProfileAIResponse(
    content: string,
    roleId: string,
    userId: string,
    catalogMetrics: any[]
  ): Promise<{ created: number; newMetricsCreated: number }> {
    let parsed: { assignments: Array<{ metricId: string; priority: string; reasoning: string }>; newMetrics: Array<any> };
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch {
          const arrMatch = content.match(/\[[\s\S]*\]/);
          parsed = { assignments: arrMatch ? JSON.parse(arrMatch[0]) : [], newMetrics: [] };
        }
      } else {
        const arrMatch = content.match(/\[[\s\S]*\]/);
        parsed = { assignments: arrMatch ? JSON.parse(arrMatch[0]) : [], newMetrics: [] };
      }
    }

    if (!parsed.assignments) parsed.assignments = [];
    if (!parsed.newMetrics) parsed.newMetrics = [];

    const validIds = new Set(catalogMetrics.map(m => m.id));
    const seen = new Set<string>();
    let created = 0;

    for (const rec of parsed.assignments) {
      if (!Array.isArray(parsed.assignments)) break;
      if (!validIds.has(rec.metricId) || seen.has(rec.metricId)) continue;
      seen.add(rec.metricId);

      await storage.createAgentMetricProfile({
        roleId,
        metricId: rec.metricId,
        priority: ["critical", "recommended", "optional"].includes(rec.priority) ? rec.priority : "recommended",
        reasoning: rec.reasoning || null,
        autoProvision: rec.priority !== "optional",
        userId,
      });
      created++;
    }

    let newMetricsCreated = 0;
    if (Array.isArray(parsed.newMetrics)) {
      const freshCatalog = await storage.getServiceMetrics(userId);
      const existingNames = new Set(freshCatalog.map(m => m.name.toLowerCase()));

      for (const nm of parsed.newMetrics) {
        if (!nm.name || !nm.description) continue;
        if (existingNames.has(nm.name.toLowerCase())) continue;

        try {
          const newMetric = await storage.createServiceMetric({
            name: nm.name,
            description: nm.description,
            category: nm.category || "performance",
            protocol: nm.protocol || "Agent",
            collectionMode: nm.collectionMode || "continuous",
            defaultInterval: nm.collectionMode === "on_demand" ? null : 60,
            enabled: true,
            unit: nm.unit || "",
            warningThreshold: nm.warningThreshold ?? null,
            criticalThreshold: nm.criticalThreshold ?? null,
            icon: nm.icon || "Activity",
            userId,
          });

          await storage.createAgentMetricProfile({
            roleId,
            metricId: newMetric.id,
            priority: ["critical", "recommended", "optional"].includes(nm.priority) ? nm.priority : "recommended",
            reasoning: nm.reasoning || `Domain-specific metric for this role`,
            autoProvision: nm.priority !== "optional",
            userId,
          });
          existingNames.add(nm.name.toLowerCase());
          newMetricsCreated++;
          created++;
        } catch (err) {
          console.error(`[AGENT_PROFILE] Failed to create new metric ${nm.name}:`, err);
        }
      }
    }

    return { created, newMetricsCreated };
  }

  async function triggerAgentMetricProfileGeneration(roleId: string, userId: string) {
    try {
      const role = await storage.getOrgRole(roleId);
      if (!role) return;

      const existing = await storage.getAgentMetricProfiles(userId, roleId);
      if (existing.length > 0) return;

      const catalogMetrics = await storage.getServiceMetrics(userId);
      if (catalogMetrics.length === 0) return;

      const roleKey = (role.title || role.name).toLowerCase().trim();
      const cacheKey = `${roleKey}::${catalogMetrics.map(m => m.id).sort().join(",")}`;
      const cached = await storage.getCacheTemplate(userId, "agent_profile", cacheKey);

      let content: string;

      if (cached) {
        content = cached.responseData as string;
        await storage.incrementCacheHit(cached.id);
        console.log(`[AGENT_PROFILE] Cache HIT for role "${roleKey}" — reusing template (saved ~5,000 tokens)`);
      } else {
        const { client: openai, model: _aiModel, providerName: _trigProviderName } = await getAiClient(userId);

        const response = await callAiLogged(openai, {
          model: _aiModel,
          temperature: 0.1,
          max_tokens: 3000,
          messages: [
            { role: "system", content: AGENT_PROFILE_SYSTEM_PROMPT },
            { role: "user", content: buildAgentProfileUserPrompt(role, catalogMetrics) },
          ],
        }, { module: "workforce", endpoint: "/api/org-roles/:id", userId, providerName: _trigProviderName });

        content = response.choices[0]?.message?.content?.trim() || '{"assignments":[],"newMetrics":[]}';

        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await storage.setCacheTemplate({
          userId,
          cacheCategory: "agent_profile",
          assetType: roleKey,
          cacheKey,
          responseData: content,
          tokensSaved: 5000,
          expiresAt: thirtyDaysFromNow,
        });
        console.log(`[AGENT_PROFILE] Cache MISS — created template for role "${roleKey}" (valid 30 days)`);
      }

      const { created, newMetricsCreated } = await processProfileAIResponse(content, role.id, userId, catalogMetrics);

      if (created > 0) {
        console.log(`[AGENT_PROFILE] Auto-generated ${created} best-practice metrics for ${role.title}${newMetricsCreated > 0 ? ` (${newMetricsCreated} new catalog metrics created)` : ""}`);

        generateOperationalInsightsForRole(roleId, userId).catch((err) => {
          console.error("[OPERATIONAL_INSIGHTS] Auto-trigger failed after profile gen:", err);
        });

        const assets = await storage.getDiscoveredAssets(userId);
        const agentAssets = assets.filter(a => a.assignedAgentRoleId === role.id);
        let provisioned = 0;

        const freshProfiles = await storage.getAgentMetricProfiles(userId, role.id);
        const freshMetrics = await storage.getServiceMetrics(userId);
        const metricMap = new Map(freshMetrics.map(m => [m.id, m]));

        for (const asset of agentAssets) {
          const existingAssignments = await storage.getServiceMetricAssignments(userId, { assetId: asset.id });
          const assignedMetricIds = new Set(existingAssignments.map(a => a.metricId));

          for (const profile of freshProfiles) {
            if (assignedMetricIds.has(profile.metricId) || !profile.autoProvision) continue;
            const metric = metricMap.get(profile.metricId);
            if (!metric) continue;

            try {
              await storage.createServiceMetricAssignment({
                metricId: profile.metricId,
                assetId: asset.id,
                collectionMode: metric.collectionMode,
                interval: metric.defaultInterval,
                enabled: true,
                lastValue: null,
                lastCollected: null,
                status: "unknown",
                userId,
              });
              provisioned++;
            } catch {}
          }
        }

        if (provisioned > 0) {
          console.log(`[AGENT_PROFILE] Auto-provisioned ${provisioned} metric(s) to ${agentAssets.length} device(s) for ${role.title}`);
        }
      }
    } catch (err) {
      console.error("[AGENT_PROFILE] Auto-generation failed:", err);
    }
  }

  app.get("/api/role-subscriptions", requireAuth, async (req, res) => {
    const subs = await storage.getRoleSubscriptionsByUser(req.user!.id);
    res.json(subs);
  });
  app.post("/api/role-subscriptions", requireAuth, async (req, res) => {
    const parsed = insertRoleSubscriptionSchema.omit({ userId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const existing = await storage.getSubscriptionByRoleIdAndUser(parsed.data.roleId, req.user!.id);
    if (existing) return res.status(409).json({ message: "Role already assigned" });
    if (!parsed.data.assignedHumanName || !parsed.data.assignedHumanName.trim()) {
      return res.status(400).json({ message: "A human team member must be assigned to the role" });
    }
    const created = await storage.createRoleSubscription({ ...parsed.data, userId: req.user!.id });

    if (parsed.data.hasAiShadow) {
      triggerAgentMetricProfileGeneration(parsed.data.roleId, req.user!.id).catch(() => {});
    }

    res.status(201).json(created);
  });
  app.post("/api/role-subscriptions/bulk", requireAuth, async (req, res) => {
    const schema = z.object({
      assignments: z.array(z.object({
        roleId: z.string(),
        assignedHumanName: z.string().min(1),
        assignedHumanEmail: z.string().optional().default(""),
        hasAiShadow: z.boolean().optional().default(false),
      })).min(1).max(500),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const results: { success: number; skipped: number; errors: string[] } = { success: 0, skipped: 0, errors: [] };
    for (const assignment of parsed.data.assignments) {
      try {
        const existing = await storage.getSubscriptionByRoleIdAndUser(assignment.roleId, req.user!.id);
        if (existing) {
          results.skipped++;
          continue;
        }
        await storage.createRoleSubscription({
          roleId: assignment.roleId,
          status: "active",
          assignedHumanName: assignment.assignedHumanName,
          assignedHumanEmail: assignment.assignedHumanEmail,
          hasAiShadow: assignment.hasAiShadow,
          userId: req.user!.id,
        });
        results.success++;

        if (assignment.hasAiShadow) {
          triggerAgentMetricProfileGeneration(assignment.roleId, req.user!.id).catch(() => {});
        }
      } catch (e: any) {
        results.errors.push(`${assignment.assignedHumanName}: ${e.message}`);
      }
    }
    res.status(201).json(results);
  });

  app.patch("/api/role-subscriptions/:id", requireAuth, async (req, res) => {
    const schema = z.object({
      status: z.enum(["active", "paused"]).optional(),
      assignedHumanName: z.string().optional().nullable(),
      assignedHumanEmail: z.string().optional().nullable(),
      hasAiShadow: z.boolean().optional(),
    }).strict();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const sub = await storage.getRoleSubscription(req.params.id);
    if (!sub || sub.userId !== req.user!.id) return res.status(404).json({ message: "Subscription not found" });
    const updated = await storage.updateRoleSubscription(req.params.id, parsed.data);

    if (parsed.data.hasAiShadow === true && !sub.hasAiShadow) {
      triggerAgentMetricProfileGeneration(sub.roleId, req.user!.id).catch(() => {});
    }

    res.json(updated);
  });
  app.delete("/api/role-subscriptions/:id", requireAuth, async (req, res) => {
    const sub = await storage.getRoleSubscription(req.params.id);
    if (!sub || sub.userId !== req.user!.id) return res.status(404).json({ message: "Subscription not found" });
    await storage.deleteRoleSubscription(req.params.id);
    res.status(204).send();
  });

  app.get("/api/roster", requireAuth, async (req, res) => {
    const subs = await storage.getRoleSubscriptionsByUser(req.user!.id);
    const roles = await storage.getOrgRoles();
    const roleMap = new Map(roles.map(r => [r.id, r]));
    const allIncidents = await storage.getIncidents();
    const allSRs = await storage.getServiceRequests();

    const humanSubs = subs.filter(s => s.assignedHumanName && s.status === "active");

    const roster = humanSubs.map(sub => {
      const role = roleMap.get(sub.roleId);
      const activeIncidents = allIncidents.filter(i => i.assignedUserId === sub.userId && i.status !== "resolved").length;
      const activeSRs = allSRs.filter(sr => sr.assignedUserId === sub.userId && !["fulfilled", "resolved", "closed", "cancelled"].includes(sr.status)).length;
      const totalActive = activeIncidents + activeSRs;

      let effectiveStatus = sub.availabilityStatus || "off_duty";
      if (sub.shiftEnd && new Date(sub.shiftEnd) < new Date() && effectiveStatus !== "off_duty") {
        effectiveStatus = "off_duty";
      }

      return {
        subscriptionId: sub.id,
        userId: sub.userId,
        roleId: sub.roleId,
        humanName: sub.assignedHumanName,
        humanEmail: sub.assignedHumanEmail,
        contactPhone: sub.contactPhone,
        roleName: role?.name || "Unknown Role",
        roleTitle: role?.title || "",
        department: role?.department || "",
        level: role?.level || "",
        icon: role?.icon || "User",
        color: role?.color || "#6366f1",
        availabilityStatus: effectiveStatus,
        shiftStart: sub.shiftStart,
        shiftEnd: sub.shiftEnd,
        currentWorkload: totalActive,
        maxWorkload: sub.maxWorkload || 5,
        hasAiShadow: sub.hasAiShadow,
        lastStatusChange: sub.lastStatusChange,
      };
    });

    const byStatus = { available: 0, busy: 0, on_call: 0, on_break: 0, off_duty: 0 } as Record<string, number>;
    roster.forEach(r => { byStatus[r.availabilityStatus] = (byStatus[r.availabilityStatus] || 0) + 1; });
    const byDepartment = {} as Record<string, number>;
    roster.forEach(r => { byDepartment[r.department] = (byDepartment[r.department] || 0) + 1; });
    const totalAvailable = roster.filter(r => r.availabilityStatus === "available" || r.availabilityStatus === "on_call").length;
    const totalCapacity = roster.reduce((s, r) => s + r.maxWorkload, 0);
    const totalLoad = roster.reduce((s, r) => s + r.currentWorkload, 0);

    res.json({
      roster: roster.sort((a, b) => {
        const order = { available: 0, on_call: 1, busy: 2, on_break: 3, off_duty: 4 };
        return (order[a.availabilityStatus as keyof typeof order] ?? 5) - (order[b.availabilityStatus as keyof typeof order] ?? 5);
      }),
      summary: {
        total: roster.length,
        totalAvailable,
        byStatus,
        byDepartment,
        totalCapacity,
        totalLoad,
        utilizationPercent: totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0,
      },
    });
  });

  app.patch("/api/roster/:subscriptionId/availability", requireAuth, async (req, res) => {
    const sub = await storage.getRoleSubscription(req.params.subscriptionId);
    if (!sub || sub.userId !== req.user!.id) return res.status(404).json({ message: "Subscription not found" });

    const { availabilityStatus, shiftStart, shiftEnd, maxWorkload, contactPhone } = req.body;
    const validStatuses = ["available", "busy", "on_call", "on_break", "off_duty"];
    if (availabilityStatus && !validStatuses.includes(availabilityStatus)) {
      return res.status(400).json({ message: "Invalid availability status" });
    }

    const updates: Record<string, any> = {};
    if (availabilityStatus) {
      updates.availabilityStatus = availabilityStatus;
      updates.lastStatusChange = new Date();
    }
    if (shiftStart !== undefined) updates.shiftStart = shiftStart ? new Date(shiftStart) : null;
    if (shiftEnd !== undefined) updates.shiftEnd = shiftEnd ? new Date(shiftEnd) : null;
    if (maxWorkload !== undefined) updates.maxWorkload = maxWorkload;
    if (contactPhone !== undefined) updates.contactPhone = contactPhone;

    const updated = await storage.updateRoleSubscription(req.params.subscriptionId, updates);
    res.json(updated);
  });

  app.get("/api/goals", (_req, res) => {
    res.json(IT_GOALS.map(g => ({ id: g.id, label: g.label, description: g.description, category: g.category, icon: g.icon })));
  });

  app.get("/api/recommendations", requireAuth, async (req, res) => {
    const recs = await storage.getRecommendationsByUser(req.user!.id);
    res.json(recs);
  });

  app.post("/api/recommendations/analyze", requireAuth, async (req, res) => {
    const schema = z.object({
      text: z.string().min(10).max(5000),
      matchedGoalIds: z.array(z.string()).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Please describe your needs in at least 10 characters" });

    const roles = await storage.getOrgRoles();
    const subs = await storage.getRoleSubscriptionsByUser(req.user!.id);
    const existingIds = new Set(subs.map(s => s.roleId));
    const multiplier = getSalaryMultiplier(req.user!.country);
    const text = parsed.data.text;
    const matchedGoalIds = parsed.data.matchedGoalIds || [];

    const unmatchedNeeds = detectUnmatchedNeeds(text, matchedGoalIds);

    const maxSort = roles.reduce((max, r) => Math.max(max, r.sortOrder), 0);
    const customRoles: { role: typeof roles[0]; need: typeof unmatchedNeeds[0] }[] = [];
    for (let i = 0; i < unmatchedNeeds.length; i++) {
      const need = unmatchedNeeds[i];
      const existingMatch = roles.find(r =>
        r.name.toLowerCase().includes(need.title.toLowerCase().slice(0, 20)) ||
        need.keywords.filter(kw => r.name.toLowerCase().includes(kw) || r.description.toLowerCase().includes(kw)).length >= 3
      );
      if (existingMatch) continue;

      const roleData = buildCustomRole(need, maxSort + i);
      const created = await storage.createOrgRole(roleData);
      customRoles.push({ role: created, need });
    }

    const allRoles = customRoles.length > 0 ? await storage.getOrgRoles() : roles;

    const customRoleDetails = customRoles.map(({ role }) => {
      const aiPrice = role.monthlyPrice ? clampAiPrice(Math.round(role.monthlyPrice * multiplier)) : 0;
      const humanCost = role.humanCostMonthly ? Math.round(role.humanCostMonthly * multiplier) : 0;
      return {
        roleId: role.id,
        role,
        reason: `Custom role created based on your specific needs: ${role.description}`,
        goalIds: ["custom"],
        priority: "high" as const,
        impact: `This AI Agent was created specifically for your needs. It can handle ${role.aiCapabilities?.slice(0, 2).join(" and ") || "specialized tasks"} autonomously.`,
        aiPrice,
        humanCost,
        isCustom: true,
      };
    });

    res.json({
      customRoles: customRoleDetails,
      totalCustomCreated: customRoles.length,
    });
  });

  app.post("/api/recommendations", requireAuth, async (req, res) => {
    const schema = z.object({
      goals: z.array(z.string()).min(0).max(20),
      customRoleIds: z.array(z.string()).optional(),
      freeformText: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid request" });

    const roles = await storage.getOrgRoles();
    const subs = await storage.getRoleSubscriptionsByUser(req.user!.id);
    const existingIds = new Set(subs.map(s => s.roleId));

    const standardGoals = parsed.data.goals.filter(g => g !== "custom");
    const customRoleIds = (parsed.data.customRoleIds || []).filter(id => !existingIds.has(id));

    const recommended = standardGoals.length > 0
      ? generateRecommendations(standardGoals, roles, existingIds)
      : [];

    const allRecommended = [...recommended];
    for (const crid of customRoleIds) {
      if (!allRecommended.find(r => r.roleId === crid)) {
        const role = roles.find(r => r.id === crid);
        if (role) {
          allRecommended.push({
            roleId: crid,
            reason: `Custom role created for your specific needs: ${role.description}`,
            goalIds: ["custom"],
            priority: "high",
            impact: `This AI Agent was created specifically for your needs. It can handle ${role.aiCapabilities?.slice(0, 2).join(" and ") || "specialized tasks"} autonomously.`,
          });
        }
      }
    }

    if (allRecommended.length === 0) {
      return res.status(400).json({ message: "No roles to recommend. Try describing your needs in more detail." });
    }

    const multiplier = getSalaryMultiplier(req.user!.country);
    const roleIds = allRecommended.map(r => r.roleId);
    const totalMonthly = roleIds.reduce((sum, rid) => {
      const role = roles.find(r => r.id === rid);
      const price = role?.monthlyPrice ? clampAiPrice(Math.round(role.monthlyPrice * multiplier)) || 0 : 0;
      return sum + price;
    }, 0);

    const goalsToStore = [...new Set([...parsed.data.goals, ...(customRoleIds.length > 0 ? ["custom"] : [])])];

    const rec = await storage.createRecommendation({
      userId: req.user!.id,
      goals: goalsToStore.length > 0 ? goalsToStore : ["custom"],
      status: "pending",
      roleIds,
      approvedRoleIds: [],
      rejectedRoleIds: [],
      totalMonthly,
      approvedMonthly: 0,
    });

    const detailsWithPrices = allRecommended.map(r => {
      const role = roles.find(x => x.id === r.roleId);
      const aiPrice = role?.monthlyPrice ? clampAiPrice(Math.round(role.monthlyPrice * multiplier)) : 0;
      const humanCost = role?.humanCostMonthly ? Math.round(role.humanCostMonthly * multiplier) : 0;
      return { ...r, aiPrice, humanCost };
    });
    res.status(201).json({ recommendation: rec, details: detailsWithPrices });
  });

  app.get("/api/recommendations/:id", requireAuth, async (req, res) => {
    const rec = await storage.getRecommendation(req.params.id);
    if (!rec || rec.userId !== req.user!.id) return res.status(404).json({ message: "Recommendation not found" });

    const roles = await storage.getOrgRoles();
    const multiplier = getSalaryMultiplier(req.user!.country);
    const details = rec.roleIds.map(rid => {
      const role = roles.find(r => r.id === rid);
      const aiPrice = role?.monthlyPrice ? clampAiPrice(Math.round(role.monthlyPrice * multiplier)) : 0;
      const humanCost = role?.humanCostMonthly ? Math.round(role.humanCostMonthly * multiplier) : 0;
      return { roleId: rid, role, aiPrice, humanCost };
    });

    res.json({ recommendation: rec, details });
  });

  app.patch("/api/recommendations/:id", requireAuth, async (req, res) => {
    const rec = await storage.getRecommendation(req.params.id);
    if (!rec || rec.userId !== req.user!.id) return res.status(404).json({ message: "Recommendation not found" });

    const schema = z.object({
      approvedRoleIds: z.array(z.string()).optional(),
      rejectedRoleIds: z.array(z.string()).optional(),
      status: z.enum(["pending", "approved", "rejected", "partial"]).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });

    const validRoleIds = new Set(rec.roleIds);
    const approvedRoleIds = parsed.data.approvedRoleIds?.filter(id => validRoleIds.has(id)) || rec.approvedRoleIds;
    const rejectedRoleIds = parsed.data.rejectedRoleIds?.filter(id => validRoleIds.has(id)) || rec.rejectedRoleIds;

    const overlap = approvedRoleIds.filter(id => rejectedRoleIds.includes(id));
    if (overlap.length > 0) {
      return res.status(400).json({ message: "A role cannot be both approved and rejected" });
    }

    const status = approvedRoleIds.length === 0 && rejectedRoleIds.length > 0 ? "rejected" :
      rejectedRoleIds.length === 0 && approvedRoleIds.length === rec.roleIds.length ? "approved" :
      approvedRoleIds.length > 0 ? "partial" : "pending";

    const roles = await storage.getOrgRoles();
    const multiplier = getSalaryMultiplier(req.user!.country);
    const approvedMonthly = approvedRoleIds.reduce((sum: number, rid: string) => {
      const role = roles.find(r => r.id === rid);
      const price = role?.monthlyPrice ? clampAiPrice(Math.round(role.monthlyPrice * multiplier)) || 0 : 0;
      return sum + price;
    }, 0);

    const updated = await storage.updateRecommendation(req.params.id, {
      approvedRoleIds,
      rejectedRoleIds,
      status,
      approvedMonthly,
    });
    res.json(updated);
  });

  app.get("/api/org-stats", requireAuth, async (req, res) => {
    const roles = await storage.getOrgRoles();
    const subs = await storage.getRoleSubscriptionsByUser(req.user!.id);
    const activeSubs = subs.filter(s => s.status === "active");
    const subscribableRoles = roles.filter(r => r.isSubscribable);
    const departments = [...new Set(roles.map(r => r.department))];
    const totalMonthly = activeSubs.reduce((sum, sub) => {
      const role = roles.find(r => r.id === sub.roleId);
      return sum + (role?.monthlyPrice ?? 0);
    }, 0);
    const withAiShadow = activeSubs.filter(s => s.hasAiShadow).length;
    res.json({
      totalRoles: roles.length,
      subscribableRoles: subscribableRoles.length,
      activeSubscriptions: activeSubs.length,
      totalDepartments: departments.length,
      monthlyInvestment: totalMonthly,
      humanAssigned: activeSubs.length,
      withAiShadow,
      humanOnly: activeSubs.length - withAiShadow,
      coveragePercent: subscribableRoles.length > 0 ? Math.round((activeSubs.length / subscribableRoles.length) * 100) : 0,
    });
  });

  app.get("/api/crews", requireAuth, async (req, res) => {
    res.json(await storage.getCrews(req.user!.id));
  });

  app.post("/api/crews", requireAuth, async (req, res) => {
    const crew = await storage.createCrew({ ...req.body, userId: req.user!.id });
    res.json(crew);
  });

  app.get("/api/agent-tasks", requireAuth, async (req, res) => {
    res.json(await storage.getAgentTasks(req.user!.id));
  });

  app.post("/api/agent-tasks", requireAuth, async (req, res) => {
    const task = await storage.createAgentTask({ ...req.body, userId: req.user!.id });
    res.json(task);
  });

  app.patch("/api/agent-tasks/:id", requireAuth, async (req, res) => {
    const existing = await storage.getAgentTask(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Task not found" });
    const task = await storage.updateAgentTask(req.params.id, req.body);
    res.json(task);
  });

  app.post("/api/agent-tasks/:id/execute", requireAuth, async (req, res) => {
    const existing = await storage.getAgentTask(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Task not found" });

    const allowedStatuses = ["pending", "scheduled", "failed"];
    if (!allowedStatuses.includes(existing.status)) {
      return res.status(400).json({ error: `Cannot execute task in '${existing.status}' status` });
    }

    await storage.updateAgentTask(req.params.id, { status: "in_progress", output: null });

    try {
      const searchTerms = existing.description.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 5);
      let kbArticles: any[] = [];
      for (const term of searchTerms) {
        const results = await storage.searchKnowledgeArticles(term);
        for (const r of results) {
          if (!kbArticles.find((a: any) => a.id === r.id)) kbArticles.push(r);
        }
      }
      kbArticles = kbArticles.slice(0, 5);

      let bestMatch: any = null;
      let bestScore = 0;
      for (const a of kbArticles) {
        const titleWords = a.title.toLowerCase().split(/\s+/);
        const taskWords = existing.description.toLowerCase().split(/\s+/);
        const overlap = titleWords.filter((w: string) => taskWords.includes(w) && w.length > 3);
        if (overlap.length >= 3 && a.content.length > 100 && overlap.length > bestScore) {
          bestMatch = a;
          bestScore = overlap.length;
        }
      }

      if (bestMatch) {
        await storage.updateKnowledgeArticle(bestMatch.id, { viewCount: (bestMatch.viewCount || 0) + 1 });
        const output = `[Resolved from Knowledge Base — Article: "${bestMatch.title}"]\n\n${bestMatch.content}`;
        const updated = await storage.updateAgentTask(req.params.id, {
          status: "completed",
          output,
          completedAt: new Date(),
        });
        return res.json(updated);
      }

      const { client, model } = await getAiClient(req.user!.id, existing.assignedRoleId ?? undefined);

      let roleName = "AI Operations Agent";
      if (existing.assignedRoleId) {
        const role = await storage.getOrgRole(existing.assignedRoleId);
        if (role) roleName = role.name;
      }

      const systemPrompt = `You are "${roleName}", an AI agent in the HOLOCRON AI platform. You are executing an assigned task autonomously. Provide professional, detailed, actionable output as if you are a real IT operations specialist completing this work. Be specific with findings, metrics, and recommendations. Do NOT say you are an AI or that you cannot access real systems — produce realistic, professional output that matches the expected deliverable.`;

      let kbContext = "";
      if (kbArticles.length > 0) {
        kbContext = `\n## Knowledge Base Reference\nThe following existing knowledge articles may be relevant. Use them as reference material to produce a more accurate and consistent response:\n\n` +
          kbArticles.map((a: any) => `### ${a.title}\n${a.content.substring(0, 500)}`).join("\n\n");
      }

      const userPrompt = [
        `## Task`,
        existing.description,
        ``,
        `## Expected Output`,
        existing.expectedOutput,
        existing.context ? `\n## Context\n${existing.context}` : "",
        kbContext,
        ``,
        `## Priority: ${existing.priority}`,
        ``,
        `Produce the expected output now. Be thorough, specific, and professional.`,
      ].join("\n");

      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const output = response.choices?.[0]?.message?.content || "Task executed but no output was generated.";
      const updated = await storage.updateAgentTask(req.params.id, {
        status: "completed",
        output,
        completedAt: new Date(),
      });
      res.json(updated);
    } catch (err: any) {
      await storage.updateAgentTask(req.params.id, {
        status: "failed",
        output: "AI agent execution failed. Please retry.",
      });
      res.status(502).json({ error: "AI agent execution failed" });
    }
  });

  app.get("/api/workflows", requireAuth, async (req, res) => {
    const workflows = await storage.getWorkflows(req.user!.id);
    const withStages = await Promise.all(workflows.map(async (w) => {
      const stages = await storage.getWorkflowStages(w.id);
      return { ...w, stages };
    }));
    res.json(withStages);
  });

  app.post("/api/workflows", requireAuth, async (req, res) => {
    const { stages, ...workflowData } = req.body;
    const workflow = await storage.createWorkflow({ ...workflowData, userId: req.user!.id });
    if (stages && Array.isArray(stages)) {
      for (let i = 0; i < stages.length; i++) {
        await storage.createWorkflowStage({ ...stages[i], workflowId: workflow.id, stageOrder: i });
      }
    }
    const createdStages = await storage.getWorkflowStages(workflow.id);
    res.json({ ...workflow, stages: createdStages });
  });

  app.patch("/api/workflows/:id", requireAuth, async (req, res) => {
    const existing = await storage.getWorkflow(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Workflow not found" });
    const updated = await storage.updateWorkflow(req.params.id, req.body);
    res.json(updated);
  });

  app.get("/api/workflows/stats", requireAuth, async (req, res) => {
    const workflows = await storage.getWorkflows(req.user!.id);
    const allStages: any[] = [];
    for (const w of workflows) {
      const stages = await storage.getWorkflowStages(w.id);
      allStages.push(...stages);
    }
    const committees = await storage.getCommittees(req.user!.id);
    res.json({
      totalWorkflows: workflows.length,
      active: workflows.filter(w => w.status === "active").length,
      draft: workflows.filter(w => w.status === "draft").length,
      completed: workflows.filter(w => w.status === "completed").length,
      paused: workflows.filter(w => w.status === "paused").length,
      totalStages: allStages.length,
      pendingApproval: allStages.filter(s => s.stageType === "approval_gate" && s.status === "pending").length,
      approvedStages: allStages.filter(s => s.status === "approved" || s.status === "completed").length,
      rejectedStages: allStages.filter(s => s.status === "rejected").length,
      totalCommittees: committees.length,
      activeCommittees: committees.filter(c => c.status === "active").length,
      byProcessType: {
        sequential: workflows.filter(w => w.processType === "sequential").length,
        parallel: workflows.filter(w => w.processType === "parallel").length,
        conditional: workflows.filter(w => w.processType === "conditional").length,
      },
      byStatus: workflows.reduce((acc, w) => { acc[w.status] = (acc[w.status] || 0) + 1; return acc; }, {} as Record<string, number>),
    });
  });

  app.get("/api/workflow-stages/:workflowId", requireAuth, async (req, res) => {
    const workflow = await storage.getWorkflow(req.params.workflowId);
    if (!workflow || workflow.userId !== req.user!.id) return res.status(404).json({ error: "Workflow not found" });
    res.json(await storage.getWorkflowStages(req.params.workflowId));
  });

  app.patch("/api/workflow-stages/:id", requireAuth, async (req, res) => {
    const stage = await storage.getWorkflowStage(req.params.id);
    if (!stage) return res.status(404).json({ error: "Stage not found" });
    const workflow = await storage.getWorkflow(stage.workflowId);
    if (!workflow || workflow.userId !== req.user!.id) return res.status(404).json({ error: "Stage not found" });
    const { status, currentApprovals, currentRejections, notes } = req.body;
    const updated = await storage.updateWorkflowStage(req.params.id, { status, currentApprovals, currentRejections, notes });
    res.json(updated);
  });

  app.get("/api/committees", requireAuth, async (req, res) => {
    res.json(await storage.getCommittees(req.user!.id));
  });

  app.post("/api/committees", requireAuth, async (req, res) => {
    const committee = await storage.createCommittee({ ...req.body, userId: req.user!.id });
    res.json(committee);
  });

  app.patch("/api/committees/:id", requireAuth, async (req, res) => {
    const existing = await storage.getCommittee(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Committee not found" });
    const updated = await storage.updateCommittee(req.params.id, req.body);
    res.json(updated);
  });

  app.get("/api/network-devices", requireAuth, async (req, res) => {
    res.json(await storage.getNetworkDevices(req.user!.id));
  });

  app.post("/api/network-devices", requireAuth, async (req, res) => {
    const device = await storage.createNetworkDevice({ ...req.body, userId: req.user!.id });
    res.json(device);
  });

  app.get("/api/device-metrics", requireAuth, async (req, res) => {
    const deviceId = req.query.deviceId as string | undefined;
    res.json(await storage.getDeviceMetrics(req.user!.id, deviceId));
  });

  app.post("/api/device-metrics", requireAuth, async (req, res) => {
    const metric = await storage.createDeviceMetric({ ...req.body, userId: req.user!.id });
    res.json(metric);
  });

  app.get("/api/agent-alerts", requireAuth, async (req, res) => {
    res.json(await storage.getAgentAlerts(req.user!.id));
  });

  app.post("/api/agent-alerts", requireAuth, async (req, res) => {
    const alert = await storage.createAgentAlert({ ...req.body, userId: req.user!.id });
    res.json(alert);
  });

  app.patch("/api/agent-alerts/:id", requireAuth, async (req, res) => {
    const existing = await storage.getAgentAlerts(req.user!.id);
    const owned = existing.find(a => a.id === req.params.id);
    if (!owned) return res.status(404).json({ error: "Alert not found" });
    const { acknowledged, falsePositive, resolvedAt } = req.body;
    const alert = await storage.updateAgentAlert(req.params.id, { acknowledged, falsePositive, resolvedAt });
    if (!alert) return res.status(404).json({ error: "Alert not found" });
    res.json(alert);
  });

  app.post("/api/agent-alerts/:id/analyze", requireAuth, async (req, res) => {
    try {
      const alerts = await storage.getAgentAlerts(req.user!.id);
      const alert = alerts.find(a => a.id === req.params.id);
      if (!alert) return res.status(404).json({ error: "Alert not found" });

      const cdKey = `alert_analyze:${req.user!.id}:${req.params.id}`;
      const cooldown = isAiOnCooldown(cdKey, 5 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `This alert was already analyzed recently. Try again in ${cooldown.remainingSec}s.` });
      }

      const assets = await storage.getDiscoveredAssets(req.user!.id);
      const targetAsset = assets.find(a => a.id === alert.deviceId);
      const services = await storage.getMonitoredApplications(req.user!.id);
      const assetServices = services.filter(s => s.assetId === alert.deviceId);
      const metrics = await storage.getDeviceMetrics(req.user!.id);
      const assetMetrics = metrics.filter(m => m.deviceId === alert.deviceId);
      const roles = await storage.getOrgRoles(req.user!.id);
      const assignedRole = targetAsset?.assignedAgentRoleId ? roles.find(r => r.id === targetAsset.assignedAgentRoleId) : null;

      // ── KB-first: serve from knowledge base if a fresh analysis exists ──────
      const alertAnalysisCacheTag = `ai_cache:alert_analysis:${alert.type}:${targetAsset?.type || 'unknown'}:${alert.severity}`;
      const kbAnalysisHit = await kbLookup(alertAnalysisCacheTag, KB_TTL_MS.alert_analysis);
      if (kbAnalysisHit.hit && kbAnalysisHit.content) {
        try {
          const cached = JSON.parse(kbAnalysisHit.content);
          console.log(`[KB-HIT] alert_analysis: ${alertAnalysisCacheTag}`);
          return res.json({ success: true, analysis: cached, alertId: req.params.id, fromKnowledgeBase: true });
        } catch { /* corrupt cache — fall through to AI */ }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);
      setAiCooldown(cdKey);

      const assetContext = targetAsset ? `
Asset: ${targetAsset.name} (${targetAsset.type})
Vendor: ${targetAsset.vendor} ${targetAsset.model}
IP: ${targetAsset.ipAddress}
OS: ${targetAsset.osName} ${targetAsset.osVersion}
Status: ${targetAsset.status}
Services running: ${assetServices.map(s => `${s.name} (${s.status}, CPU: ${s.cpuUsage}%, Mem: ${s.memoryUsage}%, Health: ${s.healthScore}%)`).join(', ') || 'None'}
Device metrics: ${assetMetrics.map(m => `${m.metricName}: ${m.value}${m.unit}`).join(', ') || 'None'}` : 'Asset details unavailable';

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are ${assignedRole?.name || 'an AI Infrastructure Agent'} in the HOLOCRON AI platform. You are a proactive autonomous IT agent.

You have detected a ${alert.severity} alert and must analyze it and propose a remediation plan for the human manager to approve.

Respond in this exact JSON format:
{
  "rootCause": "Brief technical root cause analysis",
  "impact": "What systems/services are affected and the business impact",
  "proposedActions": ["Specific action 1 I will take", "Specific action 2 I will take", "Specific action 3 I will take"],
  "preventiveMeasures": ["Future prevention step 1", "Future prevention step 2"],
  "expectedOutcome": "resolved" | "mitigated" | "escalated",
  "rationale": "Brief explanation of why these actions are recommended",
  "riskLevel": "low" | "medium" | "high",
  "confidenceScore": 85
}

Rules:
- Be specific and technical in your analysis based on the real asset data provided
- List concrete actions you PROPOSE TO TAKE (future tense) — the human must approve before execution
- If the issue requires physical intervention or vendor support, set expectedOutcome to "escalated"
- confidenceScore is 0-100 indicating how confident you are the plan will resolve the issue
- riskLevel indicates the risk of the proposed actions (low = safe automation, high = needs careful review)
- Use the asset context, services, and metrics to provide accurate analysis`
          },
          {
            role: "user",
            content: `ALERT TO ANALYZE:
Type: ${alert.type}
Severity: ${alert.severity}
Message: ${alert.message}
Details: ${alert.details || 'No additional details'}
Created: ${alert.createdAt}

ASSET CONTEXT:
${assetContext}`
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }, { module: "agent-alerts", endpoint: "/api/agent-alerts/:id/analyze", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content || '{}';
      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch {
        analysis = {
          rootCause: "Unable to determine root cause — manual investigation recommended",
          impact: "Unknown impact — requires human assessment",
          proposedActions: ["Escalate to human operator for manual investigation"],
          preventiveMeasures: ["Review monitoring thresholds"],
          expectedOutcome: "escalated",
          rationale: "AI analysis was inconclusive; human expertise required",
          riskLevel: "low",
          confidenceScore: 20
        };
      }

      // ── KB write-back: store result for future cache hits ────────────────────
      kbStore(
        alertAnalysisCacheTag,
        `Alert Analysis: ${alert.type} on ${targetAsset?.type || 'unknown'} (${alert.severity})`,
        JSON.stringify(analysis),
        req.user!.id,
        kbAnalysisHit.articleId
      );
      // ─────────────────────────────────────────────────────────────────────────

      res.json({ success: true, analysis, alertId: req.params.id });
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to run AI analysis", details: error.message });
    }
  });

  app.post("/api/agent-alerts/:id/remediate", requireAuth, async (req, res) => {
    try {
      const alerts = await storage.getAgentAlerts(req.user!.id);
      const alert = alerts.find(a => a.id === req.params.id);
      if (!alert) return res.status(404).json({ error: "Alert not found" });

      const cdKey = `alert_remediate:${req.user!.id}:${req.params.id}`;
      const cooldown = isAiOnCooldown(cdKey, 5 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `Remediation was already generated for this alert recently. Try again in ${cooldown.remainingSec}s.` });
      }

      const assets = await storage.getDiscoveredAssets(req.user!.id);
      const targetAsset = assets.find(a => a.id === alert.deviceId);
      const services = await storage.getMonitoredApplications(req.user!.id);
      const assetServices = services.filter(s => s.assetId === alert.deviceId);
      const metrics = await storage.getDeviceMetrics(req.user!.id);
      const assetMetrics = metrics.filter(m => m.deviceId === alert.deviceId);
      const roles = await storage.getOrgRoles(req.user!.id);
      const assignedRole = targetAsset?.assignedAgentRoleId ? roles.find(r => r.id === targetAsset.assignedAgentRoleId) : null;

      // ── KB-first: serve from knowledge base if a fresh remediation exists ────
      const alertRemCacheTag = `ai_cache:alert_remediation:${alert.type}:${targetAsset?.type || 'unknown'}:${alert.severity}`;
      const kbRemHit = await kbLookup(alertRemCacheTag, KB_TTL_MS.alert_remediation);
      if (kbRemHit.hit && kbRemHit.content) {
        try {
          const cached = JSON.parse(kbRemHit.content);
          console.log(`[KB-HIT] alert_remediation: ${alertRemCacheTag}`);
          // Still create the notification and update alert status from the cached result
          const cachedNotification = await storage.createAgentNotification({
            agentRoleId: assignedRole?.id || alert.agentRoleId || 'system',
            assetId: alert.deviceId || undefined,
            type: "action_taken",
            severity: alert.severity,
            title: `Auto-Remediation: ${alert.message}`,
            description: `Root Cause: ${cached.rootCause}\n\nImpact: ${cached.impact}\n\nActions Taken:\n${(cached.immediateActions || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}\n\nPreventive Measures:\n${(cached.preventiveMeasures || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}\n\n[Resolved from Knowledge Base]`,
            proposedAction: cached.immediateActions?.join('; ') || 'No actions taken',
            actionStatus: cached.status === "resolved" ? "auto_executed" : cached.status === "escalated" ? "pending" : "auto_executed",
            userId: req.user!.id,
          });
          if (cached.status === "resolved" || cached.status === "mitigated") {
            await storage.updateAgentAlert(req.params.id, { acknowledged: true, resolvedAt: cached.status === "resolved" ? new Date() : undefined });
          }
          return res.json({ success: true, remediation: cached, notification: cachedNotification, fromKnowledgeBase: true });
        } catch { /* corrupt cache — fall through to AI */ }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);
      setAiCooldown(cdKey);

      const assetContext = targetAsset ? `
Asset: ${targetAsset.name} (${targetAsset.type})
Vendor: ${targetAsset.vendor} ${targetAsset.model}
IP: ${targetAsset.ipAddress}
OS: ${targetAsset.osName} ${targetAsset.osVersion}
Status: ${targetAsset.status}
Services running: ${assetServices.map(s => `${s.name} (${s.status}, CPU: ${s.cpuUsage}%, Mem: ${s.memoryUsage}%, Health: ${s.healthScore}%)`).join(', ') || 'None'}
Device metrics: ${assetMetrics.map(m => `${m.metricName}: ${m.value}${m.unit}`).join(', ') || 'None'}` : 'Asset details unavailable';

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are ${assignedRole?.name || 'an AI Infrastructure Agent'} in the HOLOCRON AI platform. You are an autonomous IT agent responsible for proactive infrastructure management.

You have detected a ${alert.severity} alert and must analyze it, determine the root cause, and take immediate remediation action.

Respond in this exact JSON format:
{
  "rootCause": "Brief technical root cause analysis",
  "impact": "What systems/services are affected and the business impact",
  "immediateActions": ["Action 1 taken", "Action 2 taken", "Action 3 taken"],
  "preventiveMeasures": ["Future prevention step 1", "Future prevention step 2"],
  "status": "resolved" | "mitigated" | "escalated",
  "statusMessage": "Brief status summary of what was done",
  "confidenceScore": 85
}

Rules:
- Be specific and technical in your analysis based on the real asset data provided
- List concrete actions you have TAKEN (past tense) — you are autonomous
- If the issue requires physical intervention or vendor support, set status to "escalated"
- confidenceScore is 0-100 indicating how confident you are the remediation will resolve the issue
- Use the asset context, services, and metrics to provide accurate analysis`
          },
          {
            role: "user",
            content: `ALERT TO REMEDIATE:
Type: ${alert.type}
Severity: ${alert.severity}
Message: ${alert.message}
Details: ${alert.details || 'No additional details'}
Created: ${alert.createdAt}

ASSET CONTEXT:
${assetContext}`
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }, { module: "agent-alerts", endpoint: "/api/agent-alerts/:id/remediate", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content || '{}';
      let remediation;
      try {
        remediation = JSON.parse(content);
      } catch {
        remediation = {
          rootCause: "Unable to determine root cause",
          impact: "Unknown impact",
          immediateActions: ["Alert acknowledged", "Manual investigation required"],
          preventiveMeasures: ["Review monitoring thresholds"],
          status: "escalated",
          statusMessage: "AI analysis inconclusive — escalated for manual review",
          confidenceScore: 20
        };
      }

      // ── KB write-back ────────────────────────────────────────────────────────
      kbStore(
        alertRemCacheTag,
        `Auto-Remediation: ${alert.type} on ${targetAsset?.type || 'unknown'} (${alert.severity})`,
        JSON.stringify(remediation),
        req.user!.id,
        kbRemHit.articleId
      );
      // ─────────────────────────────────────────────────────────────────────────

      const notification = await storage.createAgentNotification({
        agentRoleId: assignedRole?.id || alert.agentRoleId || 'system',
        assetId: alert.deviceId || undefined,
        type: "action_taken",
        severity: alert.severity,
        title: `Auto-Remediation: ${alert.message}`,
        description: `Root Cause: ${remediation.rootCause}\n\nImpact: ${remediation.impact}\n\nActions Taken:\n${(remediation.immediateActions || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}\n\nPreventive Measures:\n${(remediation.preventiveMeasures || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}`,
        proposedAction: remediation.immediateActions?.join('; ') || 'No actions taken',
        actionStatus: remediation.status === "resolved" ? "auto_executed" : remediation.status === "escalated" ? "pending" : "auto_executed",
        userId: req.user!.id,
      });

      if (remediation.status === "resolved" || remediation.status === "mitigated") {
        await storage.updateAgentAlert(req.params.id, {
          acknowledged: true,
          resolvedAt: remediation.status === "resolved" ? new Date() : undefined,
        });
      } else {
        await storage.updateAgentAlert(req.params.id, { acknowledged: true });
      }

      res.json({
        success: true,
        remediation,
        notification,
        alert: await storage.getAgentAlerts(req.user!.id).then(a => a.find(x => x.id === req.params.id)),
      });
    } catch (error: any) {
      console.error("Remediation error:", error);
      res.status(500).json({ error: "Failed to run AI remediation", details: error.message });
    }
  });

  app.get("/api/agent-kpis", requireAuth, async (req, res) => {
    res.json(await storage.getAgentKpis(req.user!.id));
  });

  app.post("/api/agent-kpis", requireAuth, async (req, res) => {
    const kpi = await storage.createAgentKpi({ ...req.body, userId: req.user!.id });
    res.json(kpi);
  });

  app.get("/api/threshold-calibrations", requireAuth, async (req, res) => {
    res.json(await storage.getThresholdCalibrations(req.user!.id));
  });

  app.patch("/api/threshold-calibrations/:id", requireAuth, async (req, res) => {
    const updates: Record<string, unknown> = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.appliedAt) updates.appliedAt = new Date(req.body.appliedAt);
    const cal = await storage.updateThresholdCalibration(req.params.id, updates);
    if (!cal) return res.status(404).json({ error: "Calibration not found" });
    res.json(cal);
  });

  app.post("/api/threshold-calibrations/run", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    try {
      const metrics = await storage.getDeviceMetrics(userId);
      if (metrics.length === 0) {
        return res.status(400).json({ error: "No device metrics found to calibrate." });
      }

      const cdKey = `calibration:${userId}`;
      const cooldown = isAiOnCooldown(cdKey, 30 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `Threshold calibration was run recently. Try again in ${cooldown.remainingSec}s.` });
      }

      const devices = await storage.getNetworkDevices(userId);
      const alerts = await storage.getAgentAlerts(userId);
      const roles = await storage.getOrgRoles();
      const dataScientist = roles.find(r => r.name === "Data Scientist");

      const fpAlerts = alerts.filter(a => a.falsePositive);
      const fpByMetricType = new Map<string, number>();
      for (const a of fpAlerts) {
        const key = a.type;
        fpByMetricType.set(key, (fpByMetricType.get(key) || 0) + 1);
      }

      const deviceMap = new Map(devices.map(d => [d.id, d]));
      const metricsWithDevices = metrics.map(m => {
        const device = deviceMap.get(m.deviceId);
        return {
          id: m.id,
          deviceId: m.deviceId,
          deviceName: device?.name || "Unknown",
          metricName: m.metricName,
          value: m.value,
          unit: m.unit,
          thresholdWarning: m.thresholdWarning,
          thresholdCritical: m.thresholdCritical,
          status: m.status,
        };
      });

      // ── KB-first: calibration results are stable over 7 days ─────────────────
      const calibCacheTag = `ai_cache:calibration:${userId}`;
      const kbCalibHit = await kbLookup(calibCacheTag, KB_TTL_MS.calibration);
      if (kbCalibHit.hit && kbCalibHit.content) {
        try {
          const cached = JSON.parse(kbCalibHit.content);
          console.log(`[KB-HIT] calibration: ${calibCacheTag}`);
          // Return cached calibrations — DB thresholds from original run are still applied
          return res.json({ calibrations: cached, totalMetricsAnalyzed: metrics.length, autoApplied: false, fromKnowledgeBase: true });
        } catch { /* corrupt cache — fall through to AI */ }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);
      setAiCooldown(cdKey);

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are the HOLOCRON AI Data Scientist agent performing Variation Calibration analysis. Your job is to analyze infrastructure metrics and recommend optimal threshold adjustments to reduce false positives while maintaining detection accuracy.

Algorithm: Variation Calibration
- Analyze each metric's current value against its warning and critical thresholds
- Calculate statistical properties: mean, standard deviation, coefficient of variation
- Use the coefficient of variation to determine if thresholds are too tight (causing false positives) or too loose (missing real issues)
- Recommend three threshold states: Normal (baseline), Warning (early indicator), Critical (action required)
- Consider that false positives cost money and waste SLA budgets

For each metric, return calibrated thresholds based on:
- If CV < 0.1 (low variance): thresholds can be tighter
- If CV 0.1-0.3 (moderate variance): use ±1.5σ for warning, ±2.5σ for critical
- If CV > 0.3 (high variance): widen thresholds significantly, use ±2σ for warning, ±3σ for critical
- P95 and P99 values should inform where real anomalies begin

Return a JSON array of calibration objects with:
- metricId: the metric ID
- deviceId: the device ID
- metricName: metric name
- currentWarning: existing warning threshold (null if none)
- currentCritical: existing critical threshold (null if none)
- calibratedNormal: upper bound of normal range
- calibratedWarning: recommended warning threshold
- calibratedCritical: recommended critical threshold
- unit: metric unit
- confidence: 0-100 confidence in recommendation
- dataPointsAnalyzed: YOU determine the optimal number of data points to analyze for each metric. Choose based on the metric's characteristics:
  * High variance metrics (CV > 0.3): use 2160-4320 points (90-180 days) to capture seasonal patterns
  * Moderate variance (CV 0.1-0.3): use 720-2160 points (30-90 days) 
  * Low variance (CV < 0.1): use 360-720 points (15-30 days) — stable metrics need less history
  * Metrics with many false positives: increase bundle size to get more accurate baselines
  The bundle size directly affects confidence — more data points = higher confidence
- varianceCoefficient: calculated CV
- meanValue: simulated mean based on current value
- stdDeviation: simulated std dev
- p95Value: simulated P95
- p99Value: simulated P99
- falsePositivesBefore: estimated FP count with current thresholds
- falsePositivesProjected: estimated FP count with new thresholds

Only return calibrations for metrics that have warning or critical thresholds defined. Focus on metrics where thresholds appear too tight or too loose relative to the current value.`
          },
          {
            role: "user",
            content: `Analyze these infrastructure metrics and run variation calibration. Proactively determine the optimal data point bundle size for each metric based on its volatility and false positive history.\n\nFalse positive history by alert type: ${JSON.stringify(Object.fromEntries(fpByMetricType))}\n\nMetrics:\n${JSON.stringify(metricsWithDevices)}`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
      }, { module: "threshold-calibrations", endpoint: "/api/threshold-calibrations/run", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content || "{}";
      let calibrations: any[] = [];
      try {
        const parsed = JSON.parse(content);
        calibrations = Array.isArray(parsed) ? parsed : parsed.calibrations || parsed.results || [];
      } catch {}

      const created = [];
      for (const cal of calibrations) {
        const record = await storage.createThresholdCalibration({
          metricId: cal.metricId || null,
          deviceId: cal.deviceId || null,
          metricName: cal.metricName,
          currentWarning: cal.currentWarning ?? null,
          currentCritical: cal.currentCritical ?? null,
          calibratedWarning: cal.calibratedWarning ?? null,
          calibratedCritical: cal.calibratedCritical ?? null,
          calibratedNormal: cal.calibratedNormal ?? null,
          unit: cal.unit || "",
          algorithm: "variation_calibration",
          confidence: cal.confidence || 0,
          dataPointsAnalyzed: Math.min(Math.max(parseInt(cal.dataPointsAnalyzed) || 720, 360), 8760),
          varianceCoefficient: cal.varianceCoefficient ?? null,
          meanValue: cal.meanValue ?? null,
          stdDeviation: cal.stdDeviation ?? null,
          p95Value: cal.p95Value ?? null,
          p99Value: cal.p99Value ?? null,
          falsePositivesBefore: cal.falsePositivesBefore ?? 0,
          falsePositivesProjected: cal.falsePositivesProjected ?? 0,
          status: "applied",
          appliedAt: new Date().toISOString(),
          agentRoleId: dataScientist?.id || null,
          userId,
        });

        if (cal.metricId && (cal.calibratedWarning != null || cal.calibratedCritical != null)) {
          await storage.updateDeviceMetricThresholds(
            cal.metricId,
            cal.calibratedWarning ?? null,
            cal.calibratedCritical ?? null,
          );
        }

        created.push(record);
      }

      // ── KB write-back ────────────────────────────────────────────────────────
      kbStore(
        calibCacheTag,
        `Variation Calibration — ${new Date().toLocaleDateString()} (${metrics.length} metrics)`,
        JSON.stringify(created),
        userId,
        kbCalibHit.articleId
      );
      // ─────────────────────────────────────────────────────────────────────────

      res.json({ calibrations: created, totalMetricsAnalyzed: metrics.length, autoApplied: true });
    } catch (err: any) {
      console.error("Calibration error:", err);
      res.status(500).json({ error: "Calibration analysis failed", details: err.message });
    }
  });

  app.post("/api/root-cause-analysis", requireAuth, async (req, res) => {
    try {
      const { events } = req.body;
      if (!Array.isArray(events) || events.length < 2) {
        return res.status(400).json({ error: "At least 2 events required for root cause analysis" });
      }

      const eventFingerprint = events.map((e: any) => `${e.id || e.eventId || e.type || ""}:${e.deviceName || ""}`).sort().join("|");
      const cdKey = `rca:${req.user!.id}:${eventFingerprint}`;
      const cooldown = isAiOnCooldown(cdKey, 10 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `Root cause analysis for these events was already performed. Try again in ${cooldown.remainingSec}s.` });
      }

      // ── KB-first: identical event clusters always yield the same RCA ──────────
      const rcaCacheTag = `ai_cache:rca:${Buffer.from(eventFingerprint).toString('base64').slice(0, 40)}`;
      const kbRcaHit = await kbLookup(rcaCacheTag, KB_TTL_MS.rca);
      if (kbRcaHit.hit && kbRcaHit.content) {
        try {
          const cached = JSON.parse(kbRcaHit.content);
          console.log(`[KB-HIT] rca: ${rcaCacheTag}`);
          return res.json({ ...cached, fromKnowledgeBase: true });
        } catch { /* corrupt cache — fall through to AI */ }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);
      setAiCooldown(cdKey);

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are the HOLOCRON AI Root Cause Analysis engine. Analyze a cluster of correlated infrastructure events that occurred close in time across multiple assets and determine the most probable root cause, the causal chain, impact assessment, and recommended remediation.

Your analysis should follow ITIL root cause analysis methodology:
1. Identify the TRIGGER EVENT — the earliest event that most likely initiated the cascade
2. Build the CAUSAL CHAIN — how the root cause propagated to downstream systems
3. Assess IMPACT — which systems are affected and severity
4. Recommend REMEDIATION — specific actionable steps to resolve and prevent recurrence
5. Assign CONFIDENCE — how confident you are in this analysis (0-100)

Return a JSON object with:
{
  "rootCauseEventId": "ID of the event identified as root cause",
  "rootCauseSummary": "One-line description of the root cause",
  "rootCauseCategory": "One of: hardware_failure, software_bug, configuration_error, capacity_exhaustion, network_issue, security_incident, dependency_failure, human_error, environmental",
  "causalChain": [
    {
      "order": 1,
      "eventId": "event ID",
      "role": "root_cause | propagation | symptom | side_effect",
      "explanation": "Why this event occurred in the chain",
      "delayFromRoot": "Time delay from root cause in human-readable format"
    }
  ],
  "impactAssessment": {
    "severity": "critical | high | medium | low",
    "affectedSystems": ["list of affected system/device names"],
    "businessImpact": "Description of business impact",
    "blastRadius": "narrow | moderate | wide"
  },
  "remediation": {
    "immediate": ["List of immediate actions to take"],
    "shortTerm": ["List of short-term fixes (hours/days)"],
    "longTerm": ["List of long-term preventive measures"],
    "preventionRecommendations": ["Recommendations to prevent recurrence"]
  },
  "confidence": 85,
  "reasoning": "Detailed reasoning for why this was identified as the root cause",
  "alternativeHypotheses": [
    {
      "hypothesis": "Alternative root cause theory",
      "confidence": 30,
      "reason": "Why this is less likely"
    }
  ]
}`
          },
          {
            role: "user",
            content: `Analyze this cluster of ${Math.min(events.length, 20)} correlated infrastructure events and determine the root cause:\n\n${JSON.stringify(events.slice(0, 20))}`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2500,
      }, { module: "root-cause-analysis", endpoint: "/api/root-cause-analysis", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content || "{}";
      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch {
        analysis = { error: "Failed to parse AI response", raw: content };
      }

      // ── KB write-back ────────────────────────────────────────────────────────
      if (!analysis.error) {
        kbStore(
          rcaCacheTag,
          `RCA: ${analysis.rootCauseSummary || 'Infrastructure Event Cluster'} (${analysis.rootCauseCategory || 'unknown'})`,
          JSON.stringify(analysis),
          req.user!.id,
          kbRcaHit.articleId
        );
      }
      // ─────────────────────────────────────────────────────────────────────────

      res.json(analysis);
    } catch (err: any) {
      console.error("RCA error:", err);
      res.status(500).json({ error: "Root cause analysis failed", details: err.message });
    }
  });

  app.get("/api/monitored-applications", requireAuth, async (req, res) => {
    const filters: { assetId?: string; criticality?: string; status?: string } = {};
    if (req.query.assetId) filters.assetId = req.query.assetId as string;
    if (req.query.criticality) filters.criticality = req.query.criticality as string;
    if (req.query.status) filters.status = req.query.status as string;
    res.json(await storage.getMonitoredApplications(req.user!.id, filters));
  });

  app.patch("/api/monitored-applications/:id", requireAuth, async (req, res) => {
    const patchSchema = insertMonitoredApplicationSchema.partial();
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
    const updated = await storage.updateMonitoredApplication(req.params.id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Application not found" });
    res.json(updated);
  });

  app.post("/api/monitored-applications/discover", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    try {
      const assets = await storage.getDiscoveredAssets(userId);
      if (assets.length === 0) {
        return res.status(400).json({ error: "No discovered assets found. Run discovery probes first." });
      }

      const cdKey = `app_discover:${userId}`;
      const cooldown = isAiOnCooldown(cdKey, 15 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `Application discovery was run recently. Try again in ${cooldown.remainingSec}s.` });
      }

      const roles = await storage.getOrgRoles();
      const existingApps = await storage.getMonitoredApplications(userId);
      const existingByAsset = new Map<string, string[]>();
      for (const app of existingApps) {
        const list = existingByAsset.get(app.assetId) || [];
        list.push(app.name.toLowerCase());
        existingByAsset.set(app.assetId, list);
      }

      const assetSummaries = assets.map(a => {
        const meta = a.metadata as Record<string, any> || {};
        const agent = a.assignedAgentRoleId ? roles.find(r => r.id === a.assignedAgentRoleId) : null;
        return {
          id: a.id,
          name: a.name,
          type: a.type,
          vendor: a.vendor,
          model: a.model,
          ipAddress: a.ipAddress,
          protocol: a.protocol,
          os: meta.software?.os || meta.software?.firmware || null,
          osVersion: meta.software?.version || null,
          installedSoftware: (meta.software?.installedApps || meta.applications || []).slice(0, 15),
          services: meta.network?.services || [],
          openPorts: meta.network?.interfaces?.map((i: any) => i.name) || [],
          agentName: agent?.name || null,
          existingMonitored: existingByAsset.get(a.id) || [],
        };
      });

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);
      setAiCooldown(cdKey);

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are the HOLOCRON AI Application Discovery engine. Analyze infrastructure assets and intelligently discover all applications, services, and processes that are likely running on each asset based on its type, OS, vendor, model, installed software, and role in the infrastructure.

For each asset, determine:
1. All applications and services that would be running based on the asset type and OS
2. The criticality classification (think at the SOFTWARE/BUSINESS level, not infrastructure level):
   - "mission_critical": Enterprise software that directly drives revenue or core business operations — CRM (Salesforce, Dynamics 365), ERP (SAP, Oracle), Core Banking, HRIS (Workday, SAP SuccessFactors), SCM, E-Commerce platforms, Payment Processing, Active Directory (identity is business-critical), Exchange/Email (business communication), production databases backing these systems
   - "business": Applications supporting daily business functions but not revenue-critical — ticketing/ITSM (ServiceNow, Jira), collaboration (SharePoint, Teams), business intelligence/reporting, backup & recovery systems, CI/CD pipelines, internal portals
   - "supporting": Infrastructure services that keep the environment running — DNS, DHCP, NTP, syslog, SNMP agents, monitoring agents (Nagios, Zabbix, PRTG), load balancers, reverse proxies, certificate services
   - "utility": Background processes and housekeeping — system updaters, log rotation, scheduled tasks, cron jobs, health check agents, telemetry collectors
3. Realistic health metrics (simulate current state)

Return a JSON object with:
{
  "applications": [
    {
      "assetId": "asset UUID",
      "name": "Application Name",
      "version": "version string or null",
      "category": "database | web_server | email | directory_service | monitoring | security | networking | middleware | backup | messaging | iot_service | building_automation | storage | virtualization | other",
      "criticality": "mission_critical | business | supporting | utility",
      "status": "running | degraded | stopped | unknown",
      "port": port_number_or_null,
      "protocol": "tcp | udp | http | https | smtp | ldap | snmp | modbus | bacnet | mqtt | null",
      "processName": "process or service name",
      "uptime": hours_as_float,
      "responseTime": ms_as_float,
      "cpuUsage": percentage_0_100,
      "memoryUsage": percentage_0_100,
      "healthScore": 0_to_100,
      "dependencies": ["list of other app names this depends on"],
      "metadata": {
        "description": "What this application does",
        "listeningOn": "0.0.0.0:port or specific interface",
        "configPath": "/path/to/config",
        "logPath": "/path/to/logs",
        "autoStart": true_or_false,
        "lastRestart": "ISO timestamp"
      }
    }
  ]
}

Rules:
- Be thorough — discover ALL services, not just the obvious ones
- Include OS-level services (SSH, RDP, WinRM, SNMP agent, etc.)
- For network devices: include routing protocols, management planes, VPN services
- For IoT/BAS: include protocol listeners, data collectors, controllers
- For servers: include web servers, databases, agents, monitoring, backup services
- Skip applications already being monitored (listed in existingMonitored per asset)
- Simulate realistic health metrics — most should be healthy, some degraded
- Each asset should have 3-8 applications discovered depending on its role`
          },
          {
            role: "user",
            content: `Discover all running applications across these ${assetSummaries.length} infrastructure assets:\n\n${JSON.stringify(assetSummaries)}`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 5000,
      }, { module: "app-monitoring", endpoint: "/api/monitored-applications/discover", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content || "{}";
      let discoveredApps: any[] = [];
      try {
        const parsed = JSON.parse(content);
        discoveredApps = Array.isArray(parsed) ? parsed : parsed.applications || parsed.results || [];
      } catch {}

      const created = [];
      for (const app of discoveredApps) {
        const assetExists = assets.find(a => a.id === app.assetId);
        if (!assetExists) continue;
        const existing = existingByAsset.get(app.assetId) || [];
        if (existing.includes(app.name?.toLowerCase())) continue;

        const record = await storage.createMonitoredApplication({
          assetId: app.assetId,
          name: app.name,
          version: app.version || null,
          category: app.category || "other",
          criticality: app.criticality || "utility",
          status: app.status || "running",
          port: app.port || null,
          protocol: app.protocol || null,
          processName: app.processName || null,
          uptime: app.uptime || null,
          responseTime: app.responseTime || null,
          cpuUsage: app.cpuUsage || null,
          memoryUsage: app.memoryUsage || null,
          healthScore: app.healthScore || 100,
          lastChecked: new Date(),
          dependencies: app.dependencies || [],
          metadata: app.metadata || null,
          discoveredBy: "ai_discovery",
          userId,
        });
        created.push(record);
      }

      res.json({ discovered: created.length, applications: created });
    } catch (err: any) {
      console.error("App discovery error:", err);
      res.status(500).json({ error: "Application discovery failed", details: err.message });
    }
  });

  app.post("/api/monitored-applications/refresh-health", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    try {
      const apps = await storage.getMonitoredApplications(userId);
      if (apps.length === 0) return res.json({ refreshed: 0 });

      const cdKey = `health_refresh:${userId}`;
      const cooldown = isAiOnCooldown(cdKey, 5 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `Health refresh was run recently. Try again in ${cooldown.remainingSec}s.` });
      }

      const assets = await storage.getDiscoveredAssets(userId);
      const assetMap = new Map(assets.map(a => [a.id, a]));

      const appSummaries = apps.map(a => ({
        id: a.id,
        name: a.name,
        assetName: assetMap.get(a.assetId)?.name || "Unknown",
        assetType: assetMap.get(a.assetId)?.type || "Unknown",
        category: a.category,
        criticality: a.criticality,
        currentStatus: a.status,
        currentHealthScore: a.healthScore,
        currentCpuUsage: a.cpuUsage,
        currentMemoryUsage: a.memoryUsage,
        currentResponseTime: a.responseTime,
      }));

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);
      setAiCooldown(cdKey);

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are the HOLOCRON AI Application Health Monitor. Simulate realistic health metric updates for monitored applications. Most applications should remain healthy with minor fluctuations. Occasionally introduce realistic degradation scenarios (high CPU, increased response time, memory leaks) to simulate real infrastructure behavior.

Return a JSON object with:
{
  "updates": [
    {
      "id": "application UUID",
      "status": "running | degraded | stopped | unknown",
      "uptime": hours_float,
      "responseTime": ms_float,
      "cpuUsage": percentage_0_100,
      "memoryUsage": percentage_0_100,
      "healthScore": 0_to_100
    }
  ]
}

Rules:
- Most apps should show slight metric changes from current values (±5-15%)
- 10-20% of apps should show some degradation (higher CPU/memory, slower response)
- 5% chance an app status changes to "degraded"
- 1% chance an app status changes to "stopped"
- Health score should reflect: running=80-100, degraded=40-79, stopped=0-20
- Mission-critical apps should generally be healthier (better maintained)`
          },
          {
            role: "user",
            content: `Update health metrics for these ${appSummaries.length} applications:\n\n${JSON.stringify(appSummaries)}`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
      }, { module: "app-monitoring", endpoint: "/api/monitored-applications/refresh-health", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content || "{}";
      let updates: any[] = [];
      try {
        const parsed = JSON.parse(content);
        updates = Array.isArray(parsed) ? parsed : parsed.updates || parsed.results || [];
      } catch {}

      let refreshed = 0;
      for (const upd of updates) {
        if (!upd.id) continue;
        await storage.updateMonitoredApplication(upd.id, {
          status: upd.status || "running",
          uptime: upd.uptime ?? null,
          responseTime: upd.responseTime ?? null,
          cpuUsage: upd.cpuUsage ?? null,
          memoryUsage: upd.memoryUsage ?? null,
          healthScore: upd.healthScore ?? 100,
          lastChecked: new Date(),
        });
        refreshed++;
      }

      res.json({ refreshed });
    } catch (err: any) {
      console.error("Health refresh error:", err);
      res.status(500).json({ error: "Health refresh failed", details: err.message });
    }
  });

  app.get("/api/application-topologies", requireAuth, async (req, res) => {
    res.json(await storage.getApplicationTopologies(req.user!.id));
  });

  app.post("/api/application-topologies/discover", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    try {
      const assets = await storage.getDiscoveredAssets(userId);
      const apps = await storage.getMonitoredApplications(userId);
      const existingTopos = await storage.getApplicationTopologies(userId);

      if (assets.length === 0) {
        return res.status(400).json({ error: "No discovered assets found. Run asset discovery first." });
      }

      const cdKey = `topo_discover:${userId}`;
      const cooldown = isAiOnCooldown(cdKey, 15 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `Topology discovery was run recently. Try again in ${cooldown.remainingSec}s.` });
      }

      const assetSummaries = assets.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        vendor: a.vendor,
        model: a.model,
        ipAddress: a.ipAddress,
        protocol: a.protocol,
        applications: apps.filter(ap => ap.assetId === a.id).map(ap => ({ id: ap.id, name: ap.name, category: ap.category, criticality: ap.criticality, status: ap.status, port: ap.port, healthScore: ap.healthScore })),
      }));

      const existingNames = existingTopos.map(t => t.name);

      const { client: openai, model: _aiModel } = await getAiClient(req.user!.id);
      setAiCooldown(cdKey);

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are the HOLOCRON AI Application Topology Mapper. Your job is to identify business-level applications that span multiple infrastructure assets and map their topology — understanding which assets compose each application and how they relate.

A business application (like an ERP, CRM, Core Banking system, Email platform) typically runs across multiple devices:
- Application servers (frontend/middleware)
- Database servers (backend data)
- Web servers / load balancers (traffic routing)
- Directory services (authentication)
- Network infrastructure (connectivity)
- Security appliances (protection)

For each business application you identify, determine:
1. **Name**: The business application name (e.g., "Enterprise Email Platform", "ERP System", "Web Application Stack")
2. **Description**: What this application does for the business
3. **Category**: erp | crm | email | directory | web_application | database_platform | security_stack | network_fabric | monitoring_platform | collaboration | banking | iot_platform | building_management | other
4. **Criticality**: mission_critical | business | supporting | utility
5. **Asset Composition**: Which assets (by ID) make up this application's infrastructure
6. **Service Composition**: Which monitored services/apps (by ID) are part of this topology
7. **Topology Map**: How assets relate to each other within this application (tiers/layers)
8. **Impact Analysis**: What happens if each asset in the topology goes down — which other components are affected

Return a JSON object:
{
  "topologies": [
    {
      "name": "Business Application Name",
      "description": "What this application does",
      "category": "category_string",
      "criticality": "mission_critical | business | supporting | utility",
      "assetIds": ["asset-uuid-1", "asset-uuid-2"],
      "serviceIds": ["service-uuid-1", "service-uuid-2"],
      "healthScore": 0_to_100,
      "topology": {
        "tiers": [
          {
            "name": "Presentation Tier",
            "role": "User-facing web interface",
            "assetIds": ["asset-uuid"],
            "serviceIds": ["service-uuid"]
          },
          {
            "name": "Application Tier",
            "role": "Business logic processing",
            "assetIds": ["asset-uuid"],
            "serviceIds": ["service-uuid"]
          },
          {
            "name": "Data Tier",
            "role": "Data persistence and retrieval",
            "assetIds": ["asset-uuid"],
            "serviceIds": ["service-uuid"]
          }
        ],
        "dependencies": [
          { "from": "tier_name", "to": "tier_name", "type": "data_flow | authentication | dns | network" }
        ]
      },
      "impactAnalysis": {
        "singlePointsOfFailure": [
          { "assetId": "uuid", "assetName": "name", "impact": "description of what breaks if this goes down", "severity": "critical | high | medium | low", "affectedTiers": ["tier names"], "mitigations": ["existing mitigations"] }
        ],
        "cascadeScenarios": [
          { "trigger": "What initial failure occurs", "chain": ["step 1 impact", "step 2 impact"], "businessImpact": "Overall business effect", "estimatedDowntime": "time estimate" }
        ],
        "overallRisk": "critical | high | medium | low",
        "redundancyScore": 0_to_100
      }
    }
  ]
}

Rules:
- Group assets that logically compose a business application together
- One asset can belong to multiple topologies (e.g., AD server supports both Email and ERP)
- Calculate healthScore as weighted average of component health (mission-critical components weighted higher)
- Status should reflect the weakest link: if any critical asset is degraded, the topology is at_risk
- Be thorough in impact analysis — think about cascading failures
- Include network infrastructure assets only if they are specifically dedicated to that application
- Shared infrastructure (core switches, firewalls) can appear in multiple topologies`
          },
          {
            role: "user",
            content: `Analyze these ${assets.length} infrastructure assets and their ${apps.length} running services to identify business application topologies.\n\nExisting topologies (skip these): ${JSON.stringify(existingNames)}\n\nAssets and their services:\n${JSON.stringify(assetSummaries)}`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      }, { module: "app-monitoring", endpoint: "/api/application-topologies/discover", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content || "{}";
      let topologies: any[] = [];
      try {
        const parsed = JSON.parse(content);
        topologies = Array.isArray(parsed) ? parsed : parsed.topologies || [];
      } catch {}

      let created = 0;
      for (const topo of topologies) {
        if (!topo.name || !topo.assetIds || !Array.isArray(topo.assetIds)) continue;
        if (existingNames.includes(topo.name)) continue;

        await storage.createApplicationTopology({
          name: topo.name,
          description: topo.description || null,
          category: topo.category || "other",
          criticality: topo.criticality || "business",
          status: topo.healthScore >= 80 ? "healthy" : topo.healthScore >= 50 ? "at_risk" : "degraded",
          assetIds: topo.assetIds,
          serviceIds: topo.serviceIds || [],
          healthScore: topo.healthScore ?? 100,
          impactAnalysis: topo.impactAnalysis || null,
          topology: topo.topology || null,
          userId,
        });
        created++;
      }

      res.json({ discovered: created });
    } catch (err: any) {
      console.error("Topology discovery error:", err);
      res.status(500).json({ error: "Topology discovery failed", details: err.message });
    }
  });

  app.patch("/api/application-topologies/:id", requireAuth, async (req, res) => {
    const patchSchema = insertApplicationTopologySchema.partial().omit({ userId: true });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
    const updated = await storage.updateApplicationTopology(req.params.id, req.user!.id, parsed.data);
    if (!updated) return res.status(404).json({ error: "Topology not found" });
    res.json(updated);
  });

  app.delete("/api/application-topologies", requireAuth, async (req, res) => {
    await storage.deleteApplicationTopologies(req.user!.id);
    res.json({ success: true });
  });

  app.get("/api/service-metrics", requireAuth, async (req, res) => {
    const metrics = await storage.getServiceMetrics(req.user!.id);
    res.json(metrics);
  });

  app.post("/api/service-metrics", requireAuth, async (req, res) => {
    const parsed = insertServiceMetricSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createServiceMetric(parsed.data));
  });

  app.patch("/api/service-metrics/:id", requireAuth, async (req, res) => {
    const existing = await storage.getServiceMetric(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Metric not found" });
    const { id, userId, createdAt, ...allowed } = req.body;
    const updated = await storage.updateServiceMetric(req.params.id, allowed);
    res.json(updated);
  });

  app.delete("/api/service-metrics/:id", requireAuth, async (req, res) => {
    const existing = await storage.getServiceMetric(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Metric not found" });
    await storage.deleteServiceMetric(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/service-metrics/seed", requireAuth, async (req, res) => {
    const existing = await storage.getServiceMetrics(req.user!.id);
    if (existing.length > 0) return res.json({ seeded: false, count: existing.length, message: "Metrics already exist" });

    const defaults: Array<{ name: string; description: string; category: string; protocol: string; collectionMode: string; defaultInterval: number | null; unit: string | null; warningThreshold: number | null; criticalThreshold: number | null; icon: string }> = [
      { name: "CPU Usage", description: "Processor utilization percentage", category: "health", protocol: "WMI", collectionMode: "continuous", defaultInterval: 60, unit: "%", warningThreshold: 70, criticalThreshold: 90, icon: "Cpu" },
      { name: "Memory Usage", description: "RAM utilization percentage", category: "health", protocol: "WMI", collectionMode: "continuous", defaultInterval: 60, unit: "%", warningThreshold: 75, criticalThreshold: 90, icon: "HardDrive" },
      { name: "Disk Usage", description: "Storage volume utilization", category: "health", protocol: "WMI", collectionMode: "continuous", defaultInterval: 60, unit: "%", warningThreshold: 80, criticalThreshold: 95, icon: "HardDrive" },
      { name: "Network Throughput", description: "Network interface bandwidth utilization", category: "health", protocol: "WMI", collectionMode: "continuous", defaultInterval: 60, unit: "Mbps", warningThreshold: null, criticalThreshold: null, icon: "Activity" },
      { name: "Service Uptime", description: "Application and service availability", category: "availability", protocol: "API", collectionMode: "continuous", defaultInterval: 60, unit: "%", warningThreshold: 99, criticalThreshold: 95, icon: "CheckCircle2" },
      { name: "Response Time", description: "Application response latency", category: "performance", protocol: "API", collectionMode: "continuous", defaultInterval: 60, unit: "ms", warningThreshold: 500, criticalThreshold: 2000, icon: "Clock" },
      { name: "Patch Compliance", description: "OS and application patch status", category: "security", protocol: "WMI", collectionMode: "scheduled", defaultInterval: 600, unit: "count", warningThreshold: null, criticalThreshold: null, icon: "Shield" },
      { name: "Firewall Status", description: "Firewall profile enablement status", category: "security", protocol: "WMI", collectionMode: "scheduled", defaultInterval: 600, unit: "boolean", warningThreshold: null, criticalThreshold: null, icon: "Lock" },
      { name: "Antivirus Status", description: "Antivirus software health and definitions", category: "security", protocol: "WMI", collectionMode: "scheduled", defaultInterval: 600, unit: "boolean", warningThreshold: null, criticalThreshold: null, icon: "ShieldCheck" },
      { name: "Disk Encryption", description: "BitLocker or disk encryption status", category: "security", protocol: "WMI", collectionMode: "scheduled", defaultInterval: 3600, unit: "boolean", warningThreshold: null, criticalThreshold: null, icon: "Lock" },
      { name: "UAC Status", description: "User Account Control configuration", category: "security", protocol: "WMI", collectionMode: "scheduled", defaultInterval: 600, unit: "boolean", warningThreshold: null, criticalThreshold: null, icon: "Shield" },
      { name: "Installed Software", description: "Complete software inventory", category: "compliance", protocol: "WMI", collectionMode: "scheduled", defaultInterval: 600, unit: "count", warningThreshold: null, criticalThreshold: null, icon: "Box" },
      { name: "Storage Capacity", description: "Disk volume sizes and free space", category: "health", protocol: "WMI", collectionMode: "scheduled", defaultInterval: 3600, unit: "GB", warningThreshold: null, criticalThreshold: null, icon: "HardDrive" },
      { name: "Full System Scan", description: "Complete system discovery and analysis", category: "compliance", protocol: "Agent", collectionMode: "on_demand", defaultInterval: null, unit: null, warningThreshold: null, criticalThreshold: null, icon: "ScanSearch" },
      { name: "Vulnerability Scan", description: "Security vulnerability assessment", category: "security", protocol: "Agent", collectionMode: "on_demand", defaultInterval: null, unit: null, warningThreshold: null, criticalThreshold: null, icon: "Bug" },
      { name: "Remediation Execution", description: "Execute remediation scripts on endpoints", category: "security", protocol: "Agent", collectionMode: "on_demand", defaultInterval: null, unit: null, warningThreshold: null, criticalThreshold: null, icon: "Wrench" },
    ];

    const created = [];
    for (const d of defaults) {
      const m = await storage.createServiceMetric({ ...d, enabled: true, userId: req.user!.id });
      created.push(m);
    }
    res.json({ seeded: true, count: created.length });
  });

  app.get("/api/service-metric-assignments", requireAuth, async (req, res) => {
    const filters: { metricId?: string; assetId?: string } = {};
    if (req.query.metricId) filters.metricId = req.query.metricId as string;
    if (req.query.assetId) filters.assetId = req.query.assetId as string;
    res.json(await storage.getServiceMetricAssignments(req.user!.id, filters));
  });

  app.post("/api/service-metric-assignments", requireAuth, async (req, res) => {
    const parsed = insertServiceMetricAssignmentSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createServiceMetricAssignment(parsed.data));
  });

  app.patch("/api/service-metric-assignments/:id", requireAuth, async (req, res) => {
    const existing = await storage.getServiceMetricAssignmentById(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Assignment not found" });
    const { id, userId, createdAt, metricId, assetId, ...allowed } = req.body;
    const updated = await storage.updateServiceMetricAssignment(req.params.id, allowed);
    if (!updated) return res.status(404).json({ error: "Assignment not found" });
    res.json(updated);
  });

  app.delete("/api/service-metric-assignments/:id", requireAuth, async (req, res) => {
    const existing = await storage.getServiceMetricAssignmentById(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Assignment not found" });
    await storage.deleteServiceMetricAssignment(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/ai-cache", requireAuth, async (req, res) => {
    res.json(await storage.getCacheTemplates(req.user!.id));
  });

  app.get("/api/ai-cache/stats", requireAuth, async (req, res) => {
    const stats = await storage.getCacheStats(req.user!.id);
    const inputCostPer1k = 0.0025;
    const outputCostPer1k = 0.01;
    const avgOutputTokens = 800;
    const estimatedDollarsSaved = stats.totalTokensSaved > 0
      ? (stats.totalTokensSaved / 1000) * inputCostPer1k + (stats.totalHits * avgOutputTokens / 1000) * outputCostPer1k
      : 0;
    res.json({ ...stats, estimatedDollarsSaved: Math.round(estimatedDollarsSaved * 100) / 100 });
  });

  app.delete("/api/ai-cache/:id", requireAuth, async (req, res) => {
    const deleted = await storage.invalidateCacheTemplate(req.params.id, req.user!.id);
    if (!deleted) return res.status(404).json({ error: "Cache entry not found" });
    res.json({ success: true });
  });

  app.delete("/api/ai-cache/category/:category", requireAuth, async (req, res) => {
    const count = await storage.invalidateCacheByCategory(req.user!.id, req.params.category);
    res.json({ success: true, deleted: count });
  });

  app.post("/api/ai-cache/cleanup", requireAuth, async (req, res) => {
    const allEntries = await storage.getCacheTemplates(req.user!.id);
    const expired = allEntries.filter(e => new Date(e.expiresAt) < new Date());
    let cleaned = 0;
    for (const entry of expired) {
      const ok = await storage.invalidateCacheTemplate(entry.id, req.user!.id);
      if (ok) cleaned++;
    }
    res.json({ success: true, cleaned });
  });

  app.get("/api/ai-providers", requireAuth, async (req, res) => {
    const providers = await storage.getAiProviders(req.user!.id);
    res.json(providers.map(p => ({ ...p, apiKey: maskApiKey(p.apiKey) })));
  });

  app.get("/api/ai-providers/models", requireAuth, (_req, res) => {
    res.json(PROVIDER_MODELS);
  });

  // GET /api/ai-providers/waterfall — returns the priority chain with detection status
  app.get("/api/ai-providers/waterfall", requireAuth, async (req, res) => {
    const dbProvider = await storage.getDefaultAiProvider(req.user!.id);
    const waterfall = FREE_PROVIDER_WATERFALL.map(p => {
      const detectedKey = p.apiKeyRequired
        ? p.envKeys.find(k => !!process.env[k]) || null
        : (process.env.OLLAMA_BASE_URL ? "OLLAMA_BASE_URL" : "default-localhost");
      return {
        type: p.type,
        label: p.label,
        envKeys: p.envKeys,
        detectedKey,
        available: p.apiKeyRequired ? !!detectedKey : true,
        baseURL: p.type === "ollama" ? (process.env.OLLAMA_BASE_URL || p.baseURL) : p.baseURL,
        defaultModel: p.defaultModel,
        apiKeyRequired: p.apiKeyRequired,
        isFree: !["anthropic","openai"].includes(p.type),
      };
    });
    // Append OpenAI at end of chain
    const openAiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    waterfall.push({
      type: "openai", label: "OpenAI (last resort)", envKeys: ["OPENAI_API_KEY","AI_INTEGRATIONS_OPENAI_API_KEY"],
      detectedKey: openAiKey ? "AI_INTEGRATIONS_OPENAI_API_KEY" : null, available: !!openAiKey,
      baseURL: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", apiKeyRequired: true, isFree: false,
    });
    const activeIndex = dbProvider?.enabled ? -1 : waterfall.findIndex(w => w.available);
    res.json({
      waterfall,
      activeIndex,
      dbProviderActive: dbProvider?.enabled ? true : false,
      dbProvider: dbProvider ? { name: dbProvider.name, type: dbProvider.providerType, model: dbProvider.model } : null,
      resolvedProvider: dbProvider?.enabled
        ? { label: dbProvider.name, type: dbProvider.providerType, model: dbProvider.model, source: "db-configured" }
        : activeIndex >= 0
          ? { label: waterfall[activeIndex].label, type: waterfall[activeIndex].type, model: waterfall[activeIndex].defaultModel, source: "env-auto" }
          : { label: "None", type: "none", model: "—", source: "unconfigured" },
    });
  });

  app.post("/api/ai-providers", requireAuth, async (req, res) => {
    const parsed = insertAiProviderSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const validTypes = ["ollama","gemini","grok","groq","mistral","openrouter","together","huggingface","anthropic","openai","custom"];
    if (!validTypes.includes(parsed.data.providerType)) {
      return res.status(400).json({ error: `Invalid provider type. Must be one of: ${validTypes.join(", ")}` });
    }
    if (parsed.data.isDefault) {
      const existing = await storage.getAiProviders(req.user!.id);
      for (const p of existing) {
        if (p.isDefault) await storage.updateAiProvider(p.id, req.user!.id, { isDefault: false });
      }
    }
    const provider = await storage.createAiProvider(parsed.data);
    res.json({ ...provider, apiKey: maskApiKey(provider.apiKey) });
  });

  app.patch("/api/ai-providers/:id", requireAuth, async (req, res) => {
    const existing = await storage.getAiProvider(req.params.id, req.user!.id);
    if (!existing) return res.status(404).json({ error: "Provider not found" });
    const updates: any = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.model !== undefined) updates.model = req.body.model;
    if (req.body.baseUrl !== undefined) updates.baseUrl = req.body.baseUrl;
    if (req.body.enabled !== undefined) updates.enabled = req.body.enabled;
    if (req.body.apiKey !== undefined && !req.body.apiKey.includes("****")) updates.apiKey = req.body.apiKey;
    if (req.body.isDefault === true && !existing.isDefault) {
      await storage.setDefaultAiProvider(req.params.id, req.user!.id);
    }
    const updated = await storage.updateAiProvider(req.params.id, req.user!.id, updates);
    if (!updated) return res.status(404).json({ error: "Provider not found" });
    res.json({ ...updated, apiKey: maskApiKey(updated.apiKey) });
  });

  app.delete("/api/ai-providers/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteAiProvider(req.params.id, req.user!.id);
    if (!deleted) return res.status(404).json({ error: "Provider not found" });
    res.json({ success: true });
  });

  app.post("/api/ai-providers/:id/set-default", requireAuth, async (req, res) => {
    const existing = await storage.getAiProvider(req.params.id, req.user!.id);
    if (!existing) return res.status(404).json({ error: "Provider not found" });
    await storage.setDefaultAiProvider(req.params.id, req.user!.id);
    res.json({ success: true });
  });

  app.post("/api/ai-providers/:id/test", requireAuth, async (req, res) => {
    const provider = await storage.getAiProvider(req.params.id, req.user!.id);
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    try {
      const OpenAI = (await import("openai")).default;
      const baseURL = provider.baseUrl || PROVIDER_BASE_URLS[provider.providerType] || undefined;
      const client = new OpenAI({ apiKey: provider.apiKey, ...(baseURL ? { baseURL } : {}) });
      const response = await client.chat.completions.create({
        model: provider.model,
        max_tokens: 20,
        messages: [{ role: "user", content: "Reply with exactly: HOLOCRON OK" }],
      });
      const reply = response.choices[0]?.message?.content?.trim() || "";
      res.json({ success: true, reply, model: provider.model, provider: provider.providerType });
    } catch (err: any) {
      res.json({ success: false, error: err.message || "Connection failed" });
    }
  });

  app.patch("/api/org-roles/:id/ai-provider", requireAuth, async (req, res) => {
    const { aiProviderId } = req.body;
    const role = await storage.getOrgRole(req.params.id);
    if (!role) return res.status(404).json({ error: "Role not found" });
    const updated = await storage.updateOrgRole(req.params.id, { aiProviderId: aiProviderId || null });
    res.json(updated);
  });

  app.get("/api/cluster/tiers", requireAuth, (_req, res) => {
    res.json(HARDWARE_TIERS);
  });

  app.get("/api/discovery-probes/:id/cluster", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const nodes = await storage.getClusterNodes(req.params.id);
    const onlineNodes = nodes.filter(n => n.status === "online");
    const totalMaxMetrics = nodes.reduce((sum, n) => sum + n.maxMetrics, 0);
    const totalCurrentMetrics = nodes.reduce((sum, n) => sum + n.currentMetrics, 0);
    res.json({
      clusterEnabled: (probe as any).clusterEnabled || false,
      clusterMode: (probe as any).clusterMode || "standalone",
      nodes,
      capacity: { totalMaxMetrics, totalCurrentMetrics, nodeCount: nodes.length, onlineNodes: onlineNodes.length, utilizationPct: totalMaxMetrics > 0 ? Math.round((totalCurrentMetrics / totalMaxMetrics) * 100) : 0 },
    });
  });

  app.post("/api/discovery-probes/:id/cluster/enable", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const enable = req.body.enabled !== false;
    await storage.updateDiscoveryProbe(req.params.id, {
      clusterEnabled: enable,
      clusterMode: enable ? "coordinator" : "standalone",
    } as any);
    res.json({ success: true, clusterEnabled: enable });
  });

  app.post("/api/discovery-probes/:id/cluster/nodes", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const tier = req.body.hardwareTier || "performance";
    if (!HARDWARE_TIERS[tier]) return res.status(400).json({ error: "Invalid hardware tier" });
    const tierConfig = HARDWARE_TIERS[tier];
    const nodeData = {
      ...req.body,
      probeId: req.params.id,
      userId: req.user!.id,
      hardwareTier: tier,
      cpuCores: tier === "custom" ? (req.body.cpuCores || 4) : tierConfig.cpuCores,
      ramGb: tier === "custom" ? (req.body.ramGb || 64) : tierConfig.ramGb,
      maxMetrics: tier === "custom" ? (req.body.maxMetrics || 5000) : tierConfig.maxMetrics,
    };
    const parsed = insertProbeClusterNodeSchema.safeParse(nodeData);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const node = await storage.createClusterNode(parsed.data);
    if (!(probe as any).clusterEnabled) {
      await storage.updateDiscoveryProbe(req.params.id, { clusterEnabled: true, clusterMode: "coordinator" } as any);
    }
    res.json(node);
  });

  app.patch("/api/discovery-probes/:id/cluster/nodes/:nodeId", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const node = await storage.getClusterNode(req.params.nodeId);
    if (!node || node.probeId !== req.params.id) return res.status(404).json({ error: "Node not found" });
    const validStatuses = ["online", "offline", "degraded"];
    const updates: any = {};
    if (req.body.nodeAlias !== undefined) updates.nodeAlias = String(req.body.nodeAlias);
    if (req.body.status !== undefined) {
      if (!validStatuses.includes(req.body.status)) return res.status(400).json({ error: "Invalid status. Must be: online, offline, degraded" });
      updates.status = req.body.status;
    }
    if (req.body.currentMetrics !== undefined) updates.currentMetrics = Math.max(0, Math.min(Number(req.body.currentMetrics) || 0, node.maxMetrics));
    if (req.body.cpuUsage !== undefined) updates.cpuUsage = Math.max(0, Math.min(Number(req.body.cpuUsage) || 0, 100));
    if (req.body.memoryUsage !== undefined) updates.memoryUsage = Math.max(0, Math.min(Number(req.body.memoryUsage) || 0, 100));
    if (req.body.diskUsage !== undefined) updates.diskUsage = Math.max(0, Math.min(Number(req.body.diskUsage) || 0, 100));
    if (req.body.lastHeartbeat !== undefined) updates.lastHeartbeat = new Date(req.body.lastHeartbeat);
    const updated = await storage.updateClusterNode(req.params.nodeId, updates);
    if (!updated) return res.status(404).json({ error: "Node not found" });
    res.json(updated);
  });

  app.delete("/api/discovery-probes/:id/cluster/nodes/:nodeId", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const node = await storage.getClusterNode(req.params.nodeId);
    if (!node || node.probeId !== req.params.id) return res.status(404).json({ error: "Node not found" });
    await storage.deleteClusterNode(req.params.nodeId);
    const remaining = await storage.getClusterNodes(req.params.id);
    if (remaining.length === 0) {
      await storage.updateDiscoveryProbe(req.params.id, { clusterEnabled: false, clusterMode: "standalone" } as any);
    }
    res.json({ success: true });
  });

  app.get("/api/mission-critical-groups", requireAuth, async (req, res) => {
    res.json(await storage.getMissionCriticalGroups(req.user!.id));
  });

  app.post("/api/mission-critical-groups", requireAuth, async (req, res) => {
    const parsed = insertMissionCriticalGroupSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createMissionCriticalGroup(parsed.data));
  });

  app.patch("/api/mission-critical-groups/:id", requireAuth, async (req, res) => {
    const existing = await storage.getMissionCriticalGroup(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Group not found" });
    const { id, userId, createdAt, ...allowed } = req.body;
    res.json(await storage.updateMissionCriticalGroup(req.params.id, allowed));
  });

  app.delete("/api/mission-critical-groups/:id", requireAuth, async (req, res) => {
    const existing = await storage.getMissionCriticalGroup(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Group not found" });
    await storage.deleteMissionCriticalGroup(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/discovery-credentials", requireAuth, async (req, res) => {
    res.json(await storage.getDiscoveryCredentials(req.user!.id));
  });

  app.post("/api/discovery-credentials", requireAuth, async (req, res) => {
    const parsed = insertDiscoveryCredentialSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const cred = await storage.createDiscoveryCredential(parsed.data);
    res.json(cred);
  });

  app.patch("/api/discovery-credentials/:id", requireAuth, async (req, res) => {
    const existing = await storage.getDiscoveryCredential(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Credential not found" });
    const { name, protocol, host, port, authType, status } = req.body;
    const updated = await storage.updateDiscoveryCredential(req.params.id, { name, protocol, host, port, authType, status });
    res.json(updated);
  });

  app.delete("/api/discovery-credentials/:id", requireAuth, async (req, res) => {
    const existing = await storage.getDiscoveryCredential(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Credential not found" });
    await storage.deleteDiscoveryCredential(req.params.id);
    res.json({ success: true });
  });

  function stripProbeSecrets(probe: any) {
    if (!probe) return probe;
    const { hmacSecret, lastNonce, lastRequestTimestamp, ...safe } = probe;
    return safe;
  }

  app.get("/api/probe-types", requireAuth, async (req, res) => {
    const types = await storage.getProbeTypes(req.user!.id);
    res.json(types);
  });

  app.post("/api/probe-types", requireAuth, async (req, res) => {
    const parsed = insertProbeTypeSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const pt = await storage.createProbeType(parsed.data);
    res.json(pt);
  });

  app.patch("/api/probe-types/:id", requireAuth, async (req, res) => {
    const existing = await storage.getProbeType(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Probe type not found" });
    const { name, description, icon, color, protocol, deploymentModel, couplingMode, characteristics, requiresEnrollment, containerImage, containerResources, hasLocalReasoning, bufferCapacity, syncStrategy, communicationProtocols } = req.body;
    const updated = await storage.updateProbeType(req.params.id, { name, description, icon, color, protocol, deploymentModel, couplingMode, characteristics, requiresEnrollment, containerImage, containerResources, hasLocalReasoning, bufferCapacity, syncStrategy, communicationProtocols });
    res.json(updated);
  });

  app.delete("/api/probe-types/:id", requireAuth, async (req, res) => {
    const existing = await storage.getProbeType(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Probe type not found" });
    await storage.deleteProbeType(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/discovery-probes", requireAuth, async (req, res) => {
    const probes = await storage.getDiscoveryProbes(req.user!.id);
    res.json(probes.map(stripProbeSecrets));
  });

  app.post("/api/discovery-probes", requireAuth, async (req, res) => {
    const parsed = insertDiscoveryProbeSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const probe = await storage.createDiscoveryProbe(parsed.data);
    res.json(probe);
  });

  app.patch("/api/discovery-probes/:id", requireAuth, async (req, res) => {
    const existing = await storage.getDiscoveryProbe(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const { name, description, protocol, credentialId, scanSubnet, scanSchedule, status, discoveredCount, assignedAgentRoleId, probeTypeId } = req.body;
    const updated = await storage.updateDiscoveryProbe(req.params.id, { name, description, protocol, credentialId, scanSubnet, scanSchedule, status, discoveredCount, assignedAgentRoleId, probeTypeId });
    res.json(updated);
  });

  app.delete("/api/discovery-probes/:id", requireAuth, async (req, res) => {
    const existing = await storage.getDiscoveryProbe(req.params.id);
    if (!existing || existing.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    await storage.deleteDiscoveryProbe(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/discovery-probes/:id/credentials", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const links = await storage.getProbeCredentialLinks(req.params.id);
    const allCreds = await storage.getDiscoveryCredentials(req.user!.id);
    const primaryCred = probe.credentialId ? allCreds.find(c => c.id === probe.credentialId) : null;
    const linkedCreds = links.map(link => {
      const cred = allCreds.find(c => c.id === link.credentialId);
      return cred ? { ...cred, linkId: link.id, addedAt: link.addedAt } : null;
    }).filter(Boolean);
    res.json({ primaryCredentialId: probe.credentialId, primaryCredential: primaryCred, linkedCredentials: linkedCreds, availableCredentials: allCreds });
  });

  app.post("/api/discovery-probes/:id/credentials", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const { credentialId } = req.body;
    if (!credentialId || typeof credentialId !== "string") return res.status(400).json({ error: "credentialId required" });
    if (probe.credentialId === credentialId) return res.status(400).json({ error: "This credential is already the primary credential for this probe" });
    const cred = await storage.getDiscoveryCredential(credentialId);
    if (!cred || cred.userId !== req.user!.id) return res.status(404).json({ error: "Credential not found" });
    const link = await storage.addProbeCredentialLink(req.params.id, credentialId);
    res.json(link);
  });

  app.delete("/api/discovery-probes/:id/credentials/:credentialId", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    await storage.removeProbeCredentialLink(req.params.id, req.params.credentialId);
    res.json({ success: true });
  });

  app.post("/api/discovery-probes/:id/scan", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });

    let effectiveProtocol = probe.protocol;
    if (req.body?.credentialId) {
      const cred = await storage.getDiscoveryCredential(req.body.credentialId);
      if (!cred || cred.userId !== req.user!.id) return res.status(404).json({ error: "Credential not found" });
      effectiveProtocol = cred.protocol;
    }

    if (probe.status === "scanning") return res.status(409).json({ error: "Scan already in progress" });

    await storage.updateDiscoveryProbe(req.params.id, { status: "scanning" });

    const scanSimulations: Record<string, Array<{ name: string; type: string; vendor: string; model: string; ipBase: string }>> = {
      snmp_v2c: [
        { name: "SW-SCAN", type: "switch", vendor: "Cisco", model: "Catalyst 9300", ipBase: "10.0.10" },
        { name: "AP-SCAN", type: "access_point", vendor: "Aruba", model: "AP-505", ipBase: "10.0.11" },
      ],
      snmp_v3: [
        { name: "FW-SCAN", type: "firewall", vendor: "Fortinet", model: "FortiGate 100F", ipBase: "10.0.20" },
      ],
      ssh: [
        { name: "SRV-LNX-SCAN", type: "server", vendor: "Dell", model: "PowerEdge R750", ipBase: "10.0.30" },
      ],
      wmi: [
        { name: "SRV-WIN-SCAN", type: "server", vendor: "HP", model: "ProLiant DL380", ipBase: "10.0.40" },
      ],
      api: [
        { name: "GW-API-SCAN", type: "gateway", vendor: "AWS", model: "API Gateway", ipBase: "10.0.50" },
      ],
      lorawan: [
        { name: "SENSOR-SCAN", type: "iot_sensor", vendor: "Dragino", model: "LHT65", ipBase: "10.0.60" },
      ],
      bacnet: [
        { name: "HVAC-SCAN", type: "hvac", vendor: "Johnson Controls", model: "Metasys NAE", ipBase: "10.0.70" },
      ],
      modbus: [
        { name: "PLC-SCAN", type: "plc", vendor: "Siemens", model: "S7-1500", ipBase: "10.0.80" },
      ],
    };

    const userId = req.user!.id;
    const probeId = req.params.id;
    const scanTarget = req.body?.target || probe.scanSubnet || "";

    function deriveIpBase(target: string, fallback: string): string {
      if (!target) return fallback;
      const cidrMatch = target.match(/^(\d+\.\d+\.\d+)\.\d+\/\d+$/);
      if (cidrMatch) return cidrMatch[1];
      const ipMatch = target.match(/^(\d+\.\d+\.\d+)\.\d+$/);
      if (ipMatch) return ipMatch[1];
      const rangeMatch = target.match(/^(\d+\.\d+\.\d+)\.\d+-/);
      if (rangeMatch) return rangeMatch[1];
      return fallback;
    }

    setTimeout(async () => {
      try {
        const templates = scanSimulations[effectiveProtocol] || [
          { name: "DEVICE-SCAN", type: "server", vendor: "Generic", model: "Unknown", ipBase: "10.0.90" },
        ];
        const newAssets = [];
        for (let i = 0; i < templates.length; i++) {
          const t = templates[i];
          const suffix = Math.floor(Math.random() * 200) + 10;
          const ipBase = deriveIpBase(scanTarget, t.ipBase);
          const asset = await storage.createDiscoveredAsset({
            probeId,
            name: `${t.name}-${suffix}`,
            type: t.type,
            vendor: t.vendor,
            model: t.model,
            ipAddress: `${ipBase}.${suffix}`,
            macAddress: `${Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join(":")}`,
            firmware: "v1.0",
            status: Math.random() > 0.2 ? "online" : "offline",
            protocol: effectiveProtocol,
            assignedAgentRoleId: probe.assignedAgentRoleId,
            metadata: { discoveredBy: "scan", scanTime: new Date().toISOString() },
            userId,
          });
          newAssets.push(asset);
        }
        const updatedProbe = await storage.getDiscoveryProbe(probeId);
        await storage.updateDiscoveryProbe(probeId, {
          status: "completed",
          lastScanAt: new Date(),
          discoveredCount: (updatedProbe?.discoveredCount ?? probe.discoveredCount) + newAssets.length,
        });
      } catch (err) {
        console.error("Scan simulation error:", err);
        await storage.updateDiscoveryProbe(probeId, { status: "error" }).catch(() => {});
      }
    }, 3000);
    res.json({ message: "Scan initiated", probeId: req.params.id });
  });

  app.post("/api/discovery-probes/:id/generate-token", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const token = `hcn_${randomBytes(24).toString("hex")}`;
    const useHmac = req.body?.useHmac !== false;
    const hmacSecret = useHmac ? randomBytes(32).toString("hex") : null;
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await storage.updateDiscoveryProbe(req.params.id, {
      siteToken: token,
      hmacSecret,
      tokenExpiresAt,
      enrolledIp: null,
      enrolled: false,
      enrolledAt: null,
      lastNonce: null,
      lastRequestTimestamp: null,
    });
    res.json({ siteToken: token, hmacSecret, expiresAt: tokenExpiresAt.toISOString(), probeId: req.params.id, probeName: probe.name });
  });

  app.get("/api/discovery-probes/:id/deployment", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    res.json({
      probeId: probe.id,
      probeName: probe.name,
      siteToken: probe.siteToken,
      hmacSecret: probe.hmacSecret,
      deploymentType: probe.deploymentType,
      probeVersion: probe.probeVersion,
      enrolled: probe.enrolled,
      enrolledAt: probe.enrolledAt,
      lastHeartbeat: probe.lastHeartbeat,
      heartbeatInterval: probe.heartbeatInterval,
      ipAddress: probe.ipAddress,
      hostname: probe.hostname,
      osInfo: probe.osInfo,
    });
  });

  app.get("/api/discovery-probes/:id/activity-logs", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const logs = await storage.getProbeActivityLogs(probe.id, limit);
    res.json(logs);
  });

  // ── PROBE MEDIA ADD-ON ──────────────────────────────────────────────────────
  const probeMediaStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(process.cwd(), "uploads", "probe-media");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${randomBytes(16).toString("hex")}${ext}`);
    },
  });
  const probeMediaUpload = multer({ storage: probeMediaStorage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500 MB

  // Toggle / configure media add-on
  app.patch("/api/discovery-probes/:id/media-addon", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const { mediaAddonEnabled, mediaAddonConfig } = req.body;
    const updated = await storage.updateDiscoveryProbe(probe.id, {
      ...(mediaAddonEnabled !== undefined && { mediaAddonEnabled }),
      ...(mediaAddonConfig !== undefined && { mediaAddonConfig }),
    });
    res.json(updated);
  });

  // List media files for a probe
  app.get("/api/discovery-probes/:id/media", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const files = await storage.getProbeMediaFiles(probe.id);
    res.json(files);
  });

  // Upload media file
  app.post("/api/discovery-probes/:id/media/upload", requireAuth, probeMediaUpload.single("file"), async (req, res) => {
    try {
      const probe = await storage.getDiscoveryProbe(req.params.id);
      if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const mime = req.file.mimetype;
      let fileType = "image";
      if (mime.startsWith("video/")) fileType = "video";
      else if (mime.startsWith("audio/")) fileType = "audio";
      else if (mime.startsWith("text/") || mime.includes("pdf") || mime.includes("document")) fileType = "text";

      const streamingMode = (req.body.streamingMode as string) || "batch";
      const missionId = req.body.missionId as string | undefined;

      const mediaFile = await storage.createProbeMediaFile({
        probeId: probe.id,
        userId: req.user!.id,
        missionId: missionId || null,
        fileType,
        originalFilename: req.file.originalname,
        filePath: req.file.path,
        fileSizeBytes: req.file.size,
        mimeType: mime,
        streamingMode,
        uploadStatus: "complete",
        aiParseStatus: "pending",
        capturedAt: req.body.capturedAt ? new Date(req.body.capturedAt) : new Date(),
      });

      // Auto-trigger AI parse if image or text and add-on config says so
      const config = (probe as any).mediaAddonConfig as any;
      if (config?.autoParse && (fileType === "image" || fileType === "text")) {
        // Run async — don't await
        triggerMediaAiParse(mediaFile.id, req.user!.id, req.file.path, fileType, mime).catch(console.error);
      }

      res.json(mediaFile);
    } catch (err: any) {
      console.error("[media-upload]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger AI parse for a specific file
  app.post("/api/discovery-probes/:id/media/:fileId/parse", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const mediaFile = await storage.getProbeMediaFile(req.params.fileId);
    if (!mediaFile || mediaFile.probeId !== probe.id) return res.status(404).json({ error: "File not found" });
    // Mark as processing and start async
    await storage.updateProbeMediaFile(mediaFile.id, { aiParseStatus: "processing" });
    triggerMediaAiParse(mediaFile.id, req.user!.id, mediaFile.filePath, mediaFile.fileType, mediaFile.mimeType ?? "").catch(console.error);
    res.json({ status: "processing", fileId: mediaFile.id });
  });

  // Delete a media file
  app.delete("/api/discovery-probes/:id/media/:fileId", requireAuth, async (req, res) => {
    const probe = await storage.getDiscoveryProbe(req.params.id);
    if (!probe || probe.userId !== req.user!.id) return res.status(404).json({ error: "Probe not found" });
    const mediaFile = await storage.getProbeMediaFile(req.params.fileId);
    if (!mediaFile || mediaFile.probeId !== probe.id) return res.status(404).json({ error: "File not found" });
    // Delete physical file
    try { fs.unlinkSync(mediaFile.filePath); } catch {}
    await storage.deleteProbeMediaFile(mediaFile.id);
    res.json({ ok: true });
  });

  // ── AI parse helper (runs async, updates DB when done) ─────────────────────
  async function triggerMediaAiParse(fileId: string, userId: string, filePath: string, fileType: string, mimeType: string) {
    try {
      const { client: openai, model: aiModel } = await getAiClient(userId);

      let result: any = {};

      if (fileType === "image" && fs.existsSync(filePath)) {
        const imageBuffer = fs.readFileSync(filePath);
        const base64 = imageBuffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64}`;
        const completion = await openai.chat.completions.create({
          model: aiModel,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "You are an AI analyst for drone-captured imagery. Analyze this image and return a JSON object with: { summary: string, detectedObjects: string[], anomalies: string[], recommendations: string[], confidence: number (0-1) }. Return only valid JSON." },
              { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
            ],
          }],
          max_tokens: 600,
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        try { result = JSON.parse(raw.replace(/```json\n?|\n?```/g, "")); } catch { result = { summary: raw }; }
      } else if (fileType === "text" && fs.existsSync(filePath)) {
        const textContent = fs.readFileSync(filePath, "utf8").slice(0, 4000);
        const completion = await openai.chat.completions.create({
          model: aiModel,
          messages: [{
            role: "user",
            content: `You are an AI analyst for drone telemetry/log data. Analyze this content and return JSON: { summary: string, keyFindings: string[], anomalies: string[], recommendations: string[] }. Return only valid JSON.\n\nContent:\n${textContent}`,
          }],
          max_tokens: 600,
        });
        const raw = completion.choices[0]?.message?.content ?? "{}";
        try { result = JSON.parse(raw.replace(/```json\n?|\n?```/g, "")); } catch { result = { summary: raw }; }
      } else if (fileType === "audio") {
        result = { summary: "Audio file received. Live transcription requires on-device Whisper. File stored for batch processing.", keyFindings: [], anomalies: [], recommendations: ["Deploy Whisper model on probe for real-time transcription"] };
      } else if (fileType === "video") {
        result = { summary: "Video file received. Frame extraction and analysis queued. Full video analysis requires batch processing pipeline.", keyFindings: [], anomalies: [], recommendations: ["Enable frame extraction pipeline in probe media add-on config"] };
      }

      await storage.updateProbeMediaFile(fileId, { aiParseStatus: "complete", aiParseResult: result });
    } catch (err: any) {
      console.error("[media-ai-parse]", err);
      await storage.updateProbeMediaFile(fileId, { aiParseStatus: "failed" });
    }
  }

  app.get("/api/probe-download/:platform", async (req, res) => {
    const platform = req.params.platform;
    const probesDir = process.cwd() + "/server/probes";
    const scriptMap: Record<string, { file: string; contentType: string }> = {
      linux: { file: "holocron-probe.sh", contentType: "application/x-shellscript" },
      macos: { file: "holocron-probe-macos.sh", contentType: "application/x-shellscript" },
      windows: { file: "holocron-probe.ps1", contentType: "application/octet-stream" },
      "semi-autonomous": { file: "holocron-probe-semi.sh", contentType: "application/x-shellscript" },
      autonomous: { file: "holocron-probe-auto.sh", contentType: "application/x-shellscript" },
      "node-coupled": { file: "node/probe-coupled.ts", contentType: "application/typescript" },
      "node-semi": { file: "node/probe-semi.ts", contentType: "application/typescript" },
      "node-auto": { file: "node/probe-auto.ts", contentType: "application/typescript" },
      "node-transports": { file: "node/transports.ts", contentType: "application/typescript" },
      "dockerfile-coupled": { file: "node/Dockerfile.coupled", contentType: "text/plain" },
      "dockerfile-semi": { file: "node/Dockerfile.semi", contentType: "text/plain" },
      "dockerfile-auto": { file: "node/Dockerfile.auto", contentType: "text/plain" },
      android: { file: "holocron-probe-android.sh", contentType: "application/x-shellscript" },
      ios: { file: "holocron-probe-ios.sh", contentType: "application/x-shellscript" },
      "probe-ui": { file: "holocron-probe-ui.html", contentType: "application/octet-stream" },
    };
    // Special case: serve probe UI as viewable HTML (no download header)
    if (platform === "probe-ui-view") {
      const uiPath = process.cwd() + "/server/probes/holocron-probe-ui.html";
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.sendFile(uiPath);
    }
    // Android: inject credentials at download time — single ?t=TOKEN param (no & needed)
    // Server derives probeId and serverUrl itself; no shell quoting issues possible
    if (platform === "android") {
      const token = (req.query.t as string || "").replace(/[^a-zA-Z0-9_]/g, "");
      let content = readFileSync(probesDir + "/holocron-probe-android.sh", "utf8");
      if (token) {
        const probe = await storage.getDiscoveryProbeByToken(token);
        if (probe) {
          const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
          const host  = req.headers["x-forwarded-host"] || req.headers.host || "";
          const serverUrl = `${proto}://${host}`;
          content = content
            .replace("__HOLOCRON_SERVER_URL__", serverUrl)
            .replace("__HOLOCRON_PROBE_ID__", probe.id)
            .replace("__HOLOCRON_TOKEN__", token);
        }
      }
      res.setHeader("Content-Type", "application/x-shellscript");
      res.setHeader("Content-Disposition", "attachment; filename=hcn.sh");
      return res.send(content);
    }
    const entry = scriptMap[platform];
    if (entry) {
      res.setHeader("Content-Type", entry.contentType);
      res.setHeader("Content-Disposition", `attachment; filename=${entry.file.split("/").pop()}`);
      if (entry.file.endsWith(".ps1")) {
        const content = readFileSync(probesDir + "/" + entry.file, "utf8");
        const crlf = content.replace(/\r?\n/g, "\r\n");
        res.send(crlf);
      } else {
        res.sendFile(probesDir + "/" + entry.file);
      }
    } else {
      res.status(404).json({ error: "Invalid platform. Valid: linux, macos, windows, semi-autonomous, autonomous, node-coupled, node-semi, node-auto, dockerfile-coupled, dockerfile-semi, dockerfile-auto" });
    }
  });

  const REPLAY_WINDOW_MS = 300_000;
  const TOKEN_EXPIRY_DAYS = 30;

  function verifyProbeHmac(req: any, probe: any): { valid: boolean; error?: string } {
    const signature = req.headers["x-holocron-signature"] as string;
    const timestamp = req.headers["x-holocron-timestamp"] as string;
    const nonce = req.headers["x-holocron-nonce"] as string;

    if (!probe.hmacSecret) {
      return { valid: true };
    }

    if (!signature || !timestamp || !nonce) {
      return { valid: false, error: "Missing security headers (signature, timestamp, nonce). Make sure you pass the -HmacSecret parameter when running the probe script." };
    }

    if (probe.tokenExpiresAt && new Date(probe.tokenExpiresAt) < new Date()) {
      return { valid: false, error: "Token has expired. Generate a new token from the dashboard." };
    }

    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime)) {
      return { valid: false, error: "Invalid timestamp" };
    }
    const now = Date.now();
    if (Math.abs(now - requestTime) > REPLAY_WINDOW_MS) {
      return { valid: false, error: "Request timestamp outside acceptable window (replay rejected)" };
    }

    if (probe.lastNonce === nonce) {
      return { valid: false, error: "Duplicate nonce detected (replay rejected)" };
    }

    const bodyStr = (req as any).rawBody ? (req as any).rawBody.toString("utf8") : JSON.stringify(req.body);
    const payload = `${timestamp}.${nonce}.${bodyStr}`;
    const expectedSig = createHmac("sha256", probe.hmacSecret).update(payload).digest("hex");

    try {
      const sigBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSig, "hex");
      if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
        return { valid: false, error: "Invalid HMAC signature" };
      }
    } catch {
      return { valid: false, error: "Invalid HMAC signature format" };
    }

    if (probe.enrolled && probe.enrolledIp) {
      const rawIp = req.socket?.remoteAddress || "";
      const clientIp = rawIp.replace("::ffff:", "");
      const normalizedEnrolled = (probe.enrolledIp || "").replace("::ffff:", "");
      if (clientIp && normalizedEnrolled && clientIp !== normalizedEnrolled) {
        return { valid: false, error: `IP mismatch: request from ${clientIp}, enrolled from ${normalizedEnrolled}` };
      }
    }

    return { valid: true };
  }

  async function recordProbeRequest(probeId: string, nonce: string) {
    await storage.updateDiscoveryProbe(probeId, {
      lastNonce: nonce,
      lastRequestTimestamp: new Date(),
    });
  }

  const enrollSchema = z.object({
    siteToken: z.string().min(1).max(200),
    hostname: z.string().max(255).optional(),
    ipAddress: z.string().max(45).optional(),
    osInfo: z.string().max(255).optional(),
    probeVersion: z.string().max(50).optional(),
    deploymentType: z.enum(["docker", "vm", "bare-metal", "cloud", "semi-autonomous", "autonomous"]).optional(),
    macAddress: z.string().max(17).optional(),
    manufacturer: z.string().max(255).optional(),
    model: z.string().max(255).optional(),
    cpuInfo: z.string().max(255).optional(),
    totalMemoryGB: z.number().optional(),
    systemType: z.string().max(100).optional(),
    securityAudit: z.record(z.any()).optional(),
    networkInterfaces: z.union([z.array(z.record(z.any())), z.record(z.any())]).optional().transform(v => {
      if (!v) return undefined;
      return Array.isArray(v) ? v : [v];
    }),
    softwareSummary: z.record(z.any()).optional(),
    storageInfo: z.string().max(1000).optional(),
  });

  app.post("/api/probe-enroll", async (req, res) => {
    const parsed = enrollSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    const { siteToken, hostname, ipAddress, osInfo, probeVersion, deploymentType, macAddress, manufacturer, model, cpuInfo, totalMemoryGB, systemType, securityAudit, networkInterfaces, softwareSummary, storageInfo } = parsed.data;
    const probe = await storage.getDiscoveryProbeByToken(siteToken);
    if (!probe) return res.status(401).json({ error: "Invalid site token. Ensure the token matches a probe configured in the HOLOCRON AI platform." });

    const hmacResult = verifyProbeHmac(req, probe);
    if (!hmacResult.valid) return res.status(403).json({ error: hmacResult.error });

    const rawClientIp = req.socket?.remoteAddress || "";
    const clientIp = rawClientIp.replace("::ffff:", "");

    await storage.updateDiscoveryProbe(probe.id, {
      enrolled: true,
      enrolledAt: new Date(),
      hostname: hostname || null,
      ipAddress: ipAddress || null,
      osInfo: osInfo || null,
      probeVersion: probeVersion || "1.0.0",
      deploymentType: deploymentType || "docker",
      lastHeartbeat: new Date(),
      enrolledIp: clientIp || null,
    });

    try {
      await storage.createProbeActivityLog({
        probeId: probe.id,
        eventType: "enrollment",
        message: `Probe enrolled from ${clientIp || "unknown"} — ${hostname || "unknown"} (${osInfo || "unknown OS"})`,
        ipAddress: clientIp || null,
        metadata: { hostname, ipAddress, osInfo, probeVersion, deploymentType },
      });
    } catch {}

    const nonce = req.headers["x-holocron-nonce"] as string;
    if (nonce) await recordProbeRequest(probe.id, nonce);

    try {
      const isWindows = osInfo?.toLowerCase().includes("windows");
      const isServer = osInfo?.toLowerCase().includes("server");
      const isLinux = osInfo?.toLowerCase().includes("linux");
      const assetType = isWindows && !isServer ? "workstation" : isServer ? "server" : isLinux ? "server" : "endpoint";

      const osVersion = osInfo || "Unknown";
      const ramStr = totalMemoryGB ? `${totalMemoryGB} GB` : "Unknown";

      const sa = securityAudit || {} as Record<string, any>;
      const sw = softwareSummary || {} as Record<string, any>;
      const netIfaces = networkInterfaces || [];

      const patchCount = sa.installedPatches || 0;
      const patchCompliance = patchCount > 0 ? Math.min(Math.round((patchCount / Math.max(patchCount, 1)) * 100), 100) : 0;
      const fwEnabled = sa.firewall?.includes("3/3") || sa.firewall?.includes("2/3");
      const uacEnabled = sa.uac === "Enabled";
      const avActive = sa.antivirus && sa.antivirus !== "Unable to query";
      const configScore = [fwEnabled ? 30 : 0, uacEnabled ? 30 : 0, avActive ? 40 : 0].reduce((a, b) => a + b, 0);

      const assetMetadata: Record<string, any> = {
        source: "probe-enrollment",
        enrolledAt: new Date().toISOString(),
        probeVersion: probeVersion || "1.0.0",
        deploymentType: deploymentType || "bare-metal",
        hardware: {
          cpu: cpuInfo || "Unknown",
          ram: ramStr,
          storage: storageInfo || "Unknown",
          formFactor: systemType === "physical" ? "Desktop/Tower" : systemType === "virtual" ? "Virtual Machine" : systemType || "Unknown",
          serialNumber: "Collected via probe",
          powerDraw: "N/A",
          weight: "N/A",
        },
        software: {
          os: sw.os || osVersion,
          version: sw.version || osVersion,
          buildNumber: sw.buildNumber || "Unknown",
          kernel: `NT ${sw.version || "Unknown"}`,
          uptime: sw.uptime || sa.uptime || "Unknown",
          lastPatched: sa.lastPatched || "Unknown",
          autoUpdates: sa.autoUpdates || "Unknown",
          packages: sw.installedPackages || 0,
          powershellVersion: sw.powershellVersion || "Unknown",
          dotNetVersion: sw.dotNetVersion || "Unknown",
        },
        network: {
          interfaces: netIfaces.length > 0 ? netIfaces : [
            {
              name: isWindows ? "Ethernet/Wi-Fi" : "eth0",
              type: "Primary",
              status: "active",
              bandwidth: "1 Gbps",
              utilization: "0%",
              vlan: "N/A",
            },
          ],
        },
        security: {
          kpis: {
            patchCompliance: patchCount > 20 ? 85 : patchCount > 10 ? 70 : patchCount > 0 ? 50 : 0,
            configCompliance: configScore,
            uptimeSla: 99.5,
            mttr: "N/A",
            lastAudit: new Date().toISOString().split("T")[0],
            firewallRules: sa.firewallRules || 0,
            installedPatches: patchCount,
            latestPatchId: sa.latestPatchId || "N/A",
            localAdminCount: sa.localAdminCount || 0,
            networkShares: sa.networkShares || 0,
          },
          hardening: `UAC: ${sa.uac || "Unknown"}, RDP: ${sa.rdpEnabled || "Unknown"}`,
          antivirus: sa.antivirus || "Not assessed",
          accessControl: `UAC: ${sa.uac || "Unknown"}, Local Admins: ${sa.localAdminCount || "Unknown"}`,
          encryption: sa.diskEncryption || "Not assessed",
          firewall: sa.firewall || "Not assessed",
        },
        vulnerabilities: [],
        penTesting: {
          whitebox: { lastTest: "Not tested", result: "Pending", findings: 0, criticalFindings: 0 },
          graybox: { lastTest: "Not tested", result: "Pending", findings: 0, criticalFindings: 0 },
          blackbox: { lastTest: "Not tested", result: "Pending", findings: 0, criticalFindings: 0 },
        },
        applications: [],
        compliance: [],
      };

      const existingAssets = await storage.getDiscoveredAssets(probe.userId, { probeId: probe.id });
      // Prefer matching by probeId (already filtered), then by IP or name as fallback
      const existingAsset = existingAssets[0] ?? existingAssets.find(a => a.ipAddress === ipAddress || a.name === (hostname || "Unknown Host"));
      let enrolledAssetId: string | null = null;
      if (existingAsset) {
        const betterName = (hostname && hostname !== "android-device" && hostname !== "localhost" && hostname !== "Unknown Host")
          ? hostname : existingAsset.name;
        await storage.updateDiscoveredAsset(existingAsset.id, {
          name: betterName,
          status: "online",
          lastSeen: new Date(),
          vendor: manufacturer || existingAsset.vendor,
          model: model || existingAsset.model,
          firmware: osInfo || existingAsset.firmware,
          macAddress: macAddress || existingAsset.macAddress,
          assignedAgentRoleId: probe.assignedAgentRoleId || existingAsset.assignedAgentRoleId,
          metadata: assetMetadata,
        });
        enrolledAssetId = existingAsset.id;
      } else {
        const newAsset = await storage.createDiscoveredAsset({
          probeId: probe.id,
          name: hostname || "Unknown Host",
          type: assetType,
          vendor: manufacturer || null,
          model: model || null,
          ipAddress: ipAddress || null,
          macAddress: macAddress || null,
          firmware: osInfo || null,
          status: "online",
          protocol: probe.protocol,
          assignedAgentRoleId: probe.assignedAgentRoleId,
          userId: probe.userId,
          metadata: assetMetadata,
        });
        enrolledAssetId = newAsset.id;
        await storage.updateDiscoveryProbe(probe.id, {
          discoveredCount: (probe.discoveredCount || 0) + 1,
        });
      }

      if (enrolledAssetId && probe.assignedAgentRoleId) {
        // Only auto-scan if never scanned before, or last scan was > 24 hours ago
        const scanAsset = await storage.getDiscoveredAsset(enrolledAssetId, probe.userId);
        const scanMeta = (scanAsset?.metadata as any) ?? {};
        const lastScan = scanMeta.lastAgentScan ? new Date(scanMeta.lastAgentScan).getTime() : 0;
        const scanAge = Date.now() - lastScan;
        const scanStatus = scanMeta.agentScanStatus;
        const shouldRescan = scanAge > 7 * 24 * 60 * 60 * 1000 && scanStatus !== "scanning";
        if (shouldRescan) {
          runAgentScan(enrolledAssetId, probe.userId).catch(async (err) => {
            console.error(`Auto agent scan failed for asset ${enrolledAssetId}:`, err.message);
            try {
              const failedAsset = await storage.getDiscoveredAsset(enrolledAssetId!, probe.userId);
              if (failedAsset) {
                const failMeta = { ...((failedAsset.metadata as any) || {}), agentScanStatus: "failed", agentScanError: err.message };
                await storage.updateDiscoveredAsset(enrolledAssetId!, { metadata: failMeta });
              }
            } catch (_) {}
          });
        }
      }
    } catch (err) {
      console.error("Failed to create discovered asset during enrollment:", err);
    }

    res.json({ success: true, probeId: probe.id, message: "Probe enrolled successfully" });
  });

  const heartbeatSchema = z.object({
    siteToken: z.string().min(1).max(200),
    ipAddress: z.string().max(45).optional(),
    hostname: z.string().max(255).optional(),
    probeVersion: z.string().max(50).optional(),
    osInfo: z.string().max(255).optional(),
    cpuUsage: z.number().min(0).max(100).optional(),
    memoryUsage: z.number().min(0).max(100).optional(),
    diskUsage: z.number().min(0).max(100).optional(),
    taskQueueDepth: z.number().int().min(0).optional(),
    activeTasks: z.number().int().min(0).optional(),
    avgScanDurationMs: z.number().min(0).optional(),
    networkInterfaces: z.union([z.array(z.record(z.any())), z.record(z.any())]).optional().transform(v => {
      if (!v) return undefined;
      return Array.isArray(v) ? v : [v];
    }),
    securityAudit: z.record(z.any()).optional(),
    softwareSummary: z.record(z.any()).optional(),
    storageInfo: z.string().max(1000).optional(),
    bufferStatus: z.object({
      entries: z.number().int().min(0).optional(),
      maxEntries: z.number().int().min(0).optional(),
      oldestEntry: z.string().nullable().optional(),
      lastFlush: z.string().nullable().optional(),
      connected: z.boolean().optional(),
    }).optional(),
  });

  const DEFAULT_COLLECTION_SCHEDULE = {
    scheduled: [
      { task: "metrics", interval: 60, description: "CPU, Memory, Disk usage" },
      { task: "networkInterfaces", interval: 60, description: "Network interface stats & utilization" },
      { task: "securityAudit", interval: 600, description: "Firewall, AV, patches, UAC, encryption" },
      { task: "softwareInventory", interval: 600, description: "Installed applications & OS info" },
      { task: "storageInfo", interval: 3600, description: "Disk volumes & capacity" },
    ],
    onDemand: [
      { task: "fullScan", description: "Complete system scan triggered by AI agent" },
      { task: "remediation", description: "Execute remediation scripts from server" },
    ],
    bufferConfig: {
      maxEntries: 10000,
      flushBatchSize: 500,
      retentionHours: 72,
    },
  };

  function getProbeCollectionSchedule(probe: any) {
    return probe.collectionSchedule || DEFAULT_COLLECTION_SCHEDULE;
  }

  function computeAdaptiveInterval(healthStatus: string, serverCount: number): number {
    let base = 60;
    if (healthStatus === "healthy") base = serverCount > 100 ? 300 : serverCount > 20 ? 180 : 120;
    else if (healthStatus === "degraded") base = 45;
    else if (healthStatus === "overloaded") base = 30;
    return Math.max(30, Math.min(300, base));
  }

  const scanQueue: { assetId: string; userId: string; resolve: (v: any) => void; reject: (e: any) => void }[] = [];
  let activeScanCount = 0;
  const MAX_CONCURRENT_SCANS = 3;
  const MAX_QUEUE_SIZE = 50;

  async function processNextScan() {
    if (activeScanCount >= MAX_CONCURRENT_SCANS || scanQueue.length === 0) return;
    const next = scanQueue.shift()!;
    activeScanCount++;
    try {
      const result = await runAgentScan(next.assetId, next.userId);
      next.resolve(result);
    } catch (err) {
      next.reject(err);
    } finally {
      activeScanCount--;
      processNextScan();
    }
  }

  function enqueueAgentScan(assetId: string, userId: string): { promise: Promise<any>; queuePosition: number } | null {
    if (scanQueue.length >= MAX_QUEUE_SIZE) return null;
    let resolve: any, reject: any;
    const promise = new Promise<any>((res, rej) => { resolve = res; reject = rej; });
    scanQueue.push({ assetId, userId, resolve, reject });
    const queuePosition = scanQueue.length;
    processNextScan();
    return { promise, queuePosition };
  }

  const METRIC_NAME_MAP: Record<string, { taskType: string; extract: (data: Record<string, any>) => number | null }> = {
    "CPU Usage": { taskType: "metrics", extract: (d) => d.cpuUsage ?? d.cpu ?? null },
    "Memory Usage": { taskType: "metrics", extract: (d) => d.memoryUsage ?? d.memory ?? null },
    "Disk Usage": { taskType: "metrics", extract: (d) => d.diskUsage ?? d.disk ?? null },
    "Patch Compliance": { taskType: "securityAudit", extract: (d) => {
      const p = d.installedPatches || 0;
      return p > 20 ? 85 : p > 10 ? 70 : p > 0 ? 50 : 0;
    }},
    "Firewall Status": { taskType: "securityAudit", extract: (d) => {
      const fw = d.firewall || "";
      return fw.includes("3/3") ? 100 : fw.includes("2/3") ? 66 : fw.includes("1/3") ? 33 : 0;
    }},
    "Antivirus Status": { taskType: "securityAudit", extract: (d) => {
      return (d.antivirus && d.antivirus !== "Unable to query") ? 100 : 0;
    }},
    "Disk Encryption": { taskType: "securityAudit", extract: (d) => {
      const enc = d.diskEncryption || "";
      return enc.toLowerCase().includes("bitlocker") || enc.toLowerCase().includes("encrypted") ? 100 : 0;
    }},
    "UAC Status": { taskType: "securityAudit", extract: (d) => {
      return d.uac === "Enabled" ? 100 : 0;
    }},
    "Service Uptime": { taskType: "softwareInventory", extract: (d) => {
      const uptime = d.uptime || "";
      const daysMatch = uptime.match(/(\d+)\s*day/i);
      return daysMatch ? parseInt(daysMatch[1]) : null;
    }},
    "Installed Software": { taskType: "softwareInventory", extract: (d) => {
      return d.installedPackages ?? d.packages ?? null;
    }},
    "Network Throughput": { taskType: "networkInterfaces", extract: (d) => {
      const ifaces = Array.isArray(d) ? d : (d.interfaces || []);
      if (!Array.isArray(ifaces) || ifaces.length === 0) return null;
      const totalMbps = ifaces.reduce((sum: number, iface: any) => {
        const rx = (iface.rxBytesPerSec || 0) / 125000;
        const tx = (iface.txBytesPerSec || 0) / 125000;
        return sum + rx + tx;
      }, 0);
      return Math.round(totalMbps * 100) / 100;
    }},
  };

  async function updateServiceMetricAssignmentsFromProbe(
    assetId: string,
    taskType: string,
    data: Record<string, any>,
    userId: string
  ) {
    try {
      const userMetrics = await storage.getServiceMetrics(userId);
      const relevantMetrics = userMetrics.filter(m => {
        const mapping = METRIC_NAME_MAP[m.name];
        return mapping && mapping.taskType === taskType;
      });
      if (relevantMetrics.length === 0) return;

      const existingAssignments = await storage.getServiceMetricAssignments(userId, { assetId });
      const assignmentMap = new Map(existingAssignments.map(a => [a.metricId, a]));

      for (const metric of relevantMetrics) {
        const mapping = METRIC_NAME_MAP[metric.name];
        if (!mapping) continue;
        const value = mapping.extract(data);
        if (value === null || value === undefined) continue;

        let status: "normal" | "warning" | "critical" = "normal";
        if (metric.criticalThreshold !== null && metric.criticalThreshold !== undefined && value >= metric.criticalThreshold) {
          status = "critical";
        } else if (metric.warningThreshold !== null && metric.warningThreshold !== undefined && value >= metric.warningThreshold) {
          status = "warning";
        }

        const existing = assignmentMap.get(metric.id);
        if (existing) {
          await storage.updateServiceMetricAssignment(existing.id, {
            lastValue: value,
            lastCollected: new Date(),
            status,
          });
        } else {
          await storage.createServiceMetricAssignment({
            metricId: metric.id,
            assetId,
            collectionMode: metric.collectionMode,
            interval: metric.defaultInterval,
            enabled: true,
            lastValue: value,
            lastCollected: new Date(),
            status,
            userId,
          });
        }
      }
    } catch (err) {
      console.error("[SERVICE_METRICS] Failed to update assignments from probe:", err);
    }
  }

  const aiAnalysisQueue = new Map<string, boolean>();

  async function aiAnalyzeAssetMetrics(assetId: string, userId: string) {
    const queueKey = `${assetId}:${userId}`;
    if (aiAnalysisQueue.get(queueKey)) return;
    aiAnalysisQueue.set(queueKey, true);

    try {
      const asset = await storage.getDiscoveredAsset(assetId, userId);
      if (!asset) return;

      const catalogMetrics = await storage.getServiceMetrics(userId);
      if (catalogMetrics.length === 0) return;

      const existingAssignments = await storage.getServiceMetricAssignments(userId, { assetId });
      const assignedMetricIds = new Set(existingAssignments.map(a => a.metricId));

      const unassignedMetrics = catalogMetrics.filter(m => !assignedMetricIds.has(m.id));
      if (unassignedMetrics.length === 0) return;

      const assetType = (asset.type || "unknown").toLowerCase().trim();
      const cacheKey = `${assetType}::${unassignedMetrics.map(m => m.id).sort().join(",")}`;
      const cached = await storage.getCacheTemplate(userId, "metric_assignment", cacheKey);

      let recommendations: Array<{ metricId: string; value: number | null; status: string; reasoning: string }>;

      if (cached) {
        recommendations = cached.responseData as any;
        await storage.incrementCacheHit(cached.id);
        console.log(`[AI_METRICS] Cache HIT for type "${assetType}" — reusing template for ${asset.name} (saved ~3,500 tokens)`);
      } else {
        const meta = (asset.metadata || {}) as Record<string, any>;
        const metaSnapshot: Record<string, any> = {};
        if (meta.systemUtilization) metaSnapshot.systemUtilization = meta.systemUtilization;
        if (meta.security) metaSnapshot.security = meta.security;
        if (meta.software) metaSnapshot.software = meta.software;
        if (meta.network) {
          metaSnapshot.network = { interfaceCount: meta.network.interfaces?.length || 0 };
          if (meta.network.interfaces?.[0]) {
            metaSnapshot.network.sampleInterface = {
              name: meta.network.interfaces[0].name,
              bandwidth: meta.network.interfaces[0].bandwidth,
              status: meta.network.interfaces[0].status,
            };
          }
        }
        if (meta.hardware) metaSnapshot.hardware = { hasStorageDetail: !!meta.hardware.storageDetail };
        if (meta.compliance) metaSnapshot.compliance = meta.compliance;

        const { client: openai, model: _aiModel, providerName: _metricsProviderName } = await getAiClient(userId);

        const response = await callAiLogged(openai, {
          model: _aiModel,
          temperature: 0.1,
          max_tokens: 1500,
          messages: [
            {
              role: "system",
              content: `You are the HOLOCRON AI Service Metrics Intelligence Agent. You analyze infrastructure device telemetry and determine which service metrics from the catalog should be assigned to a device.

Given a device's metadata and a list of unassigned service metrics, determine which metrics are relevant to this device based on:
1. The device type, OS, and capabilities
2. Available telemetry data in the metadata
3. Industry best practices for monitoring this type of device
4. The metric's category, protocol, and collection mode

For each metric you recommend assigning, provide:
- metricId: the metric's ID
- value: a numeric value extracted or derived from the metadata (null if no data available yet)
- status: "normal", "warning", or "critical" based on the value and appropriate thresholds
- reasoning: brief explanation of why this metric is relevant

Respond ONLY with valid JSON array. No markdown. Example:
[{"metricId":"abc-123","value":42.5,"status":"normal","reasoning":"Device has CPU telemetry data showing healthy utilization"}]

Return empty array [] if no unassigned metrics are relevant.`
            },
            {
              role: "user",
              content: `Device: ${asset.name} (${asset.type || "unknown"}, IP: ${asset.ipAddress || "N/A"}, Status: ${asset.status})

Device Metadata:
${JSON.stringify(metaSnapshot)}

Unassigned Service Metrics from Catalog:
${JSON.stringify(unassignedMetrics.map(m => ({id:m.id,name:m.name,description:m.description,category:m.category,protocol:m.protocol,collectionMode:m.collectionMode,unit:m.unit,warningThreshold:m.warningThreshold,criticalThreshold:m.criticalThreshold})))}

Which of these unassigned metrics should be assigned to this device?`
            }
          ],
        }, { module: "probe-management", endpoint: "/api/probe-enroll", userId, providerName: _metricsProviderName });

        const content = response.choices[0]?.message?.content?.trim() || "[]";
        try {
          recommendations = JSON.parse(content);
        } catch {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            recommendations = JSON.parse(jsonMatch[0]);
          } else {
            console.log("[AI_METRICS] Could not parse AI response for", asset.name);
            return;
          }
        }

        if (Array.isArray(recommendations) && recommendations.length > 0) {
          const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await storage.setCacheTemplate({
            userId,
            cacheCategory: "metric_assignment",
            assetType,
            cacheKey,
            responseData: recommendations,
            tokensSaved: 3500,
            expiresAt: thirtyDaysFromNow,
          });
          console.log(`[AI_METRICS] Cache MISS — created template for type "${assetType}" (valid 30 days)`);
        }
      }

      if (!Array.isArray(recommendations) || recommendations.length === 0) return;

      const validMetricIds = new Set(unassignedMetrics.map(m => m.id));
      const seenMetricIds = new Set<string>();
      let created = 0;

      const freshAssignments = await storage.getServiceMetricAssignments(userId, { assetId });
      const freshAssignedIds = new Set(freshAssignments.map(a => a.metricId));

      for (const rec of recommendations) {
        if (!validMetricIds.has(rec.metricId)) continue;
        if (seenMetricIds.has(rec.metricId)) continue;
        if (freshAssignedIds.has(rec.metricId)) continue;
        seenMetricIds.add(rec.metricId);

        const metric = catalogMetrics.find(m => m.id === rec.metricId);
        if (!metric) continue;

        const validStatus = ["normal", "warning", "critical"].includes(rec.status) ? rec.status : "unknown";

        try {
          await storage.createServiceMetricAssignment({
            metricId: rec.metricId,
            assetId,
            collectionMode: metric.collectionMode,
            interval: metric.defaultInterval,
            enabled: true,
            lastValue: typeof rec.value === "number" ? rec.value : null,
            lastCollected: rec.value !== null ? new Date() : null,
            status: validStatus,
            userId,
          });
          created++;
        } catch (err) {
          console.error(`[AI_METRICS] Failed to create assignment for ${metric.name} on ${asset.name}:`, err);
        }
      }

      if (created > 0) {
        console.log(`[AI_METRICS] Agent assigned ${created} new metric(s) to ${asset.name}: ${recommendations.filter(r => validMetricIds.has(r.metricId)).map(r => {
          const m = catalogMetrics.find(cm => cm.id === r.metricId);
          return m?.name || r.metricId;
        }).join(", ")}`);
      }
    } catch (err) {
      console.error("[AI_METRICS] AI analysis failed for asset", assetId, err);
    } finally {
      aiAnalysisQueue.delete(queueKey);
    }
  }

  app.post("/api/service-metrics/ai-analyze/:assetId", requireAuth, async (req, res) => {
    const asset = await storage.getDiscoveredAsset(req.params.assetId);
    if (!asset || asset.userId !== req.user!.id) {
      return res.status(404).json({ error: "Asset not found" });
    }

    aiAnalyzeAssetMetrics(req.params.assetId, req.user!.id);
    res.json({ success: true, message: `AI Metrics Agent analyzing ${asset.name}...` });
  });

  app.post("/api/service-metrics/ai-analyze-all", requireAuth, async (req, res) => {
    const assets = await storage.getDiscoveredAssets(req.user!.id);
    const catalogMetrics = await storage.getServiceMetrics(req.user!.id);
    if (catalogMetrics.length === 0) {
      return res.json({ success: false, message: "No service metrics in catalog. Seed the catalog first." });
    }

    let queued = 0;
    let skipped = 0;
    for (const asset of assets) {
      const queueKey = `${asset.id}:${req.user!.id}`;
      if (aiAnalysisQueue.get(queueKey)) {
        skipped++;
        continue;
      }
      const existing = await storage.getServiceMetricAssignments(req.user!.id, { assetId: asset.id });
      if (existing.length < catalogMetrics.length) {
        aiAnalyzeAssetMetrics(asset.id, req.user!.id);
        queued++;
      }
    }

    res.json({
      success: true,
      message: `AI Metrics Agent analyzing ${queued} device(s) for metric assignments`,
      totalAssets: assets.length,
      queued,
      skipped,
    });
  });

  app.get("/api/agent-metric-profiles", requireAuth, async (req, res) => {
    const roleId = req.query.roleId as string | undefined;
    const profiles = await storage.getAgentMetricProfiles(req.user!.id, roleId);
    res.json(profiles);
  });

  app.get("/api/agent-metric-profiles/:roleId", requireAuth, async (req, res) => {
    const profiles = await storage.getAgentMetricProfiles(req.user!.id, req.params.roleId);
    const metrics = await storage.getServiceMetrics(req.user!.id);
    const metricMap = new Map(metrics.map(m => [m.id, m]));
    const enriched = profiles.map(p => ({
      ...p,
      metric: metricMap.get(p.metricId) || null,
    }));
    res.json(enriched);
  });

  app.delete("/api/agent-metric-profiles/:id", requireAuth, async (req, res) => {
    const profile = await storage.getAgentMetricProfile(req.params.id);
    if (!profile || profile.userId !== req.user!.id) {
      return res.status(404).json({ error: "Profile not found" });
    }
    await storage.deleteAgentMetricProfile(req.params.id);
    res.json({ success: true });
  });

  const profileGenQueue = new Map<string, boolean>();

  app.post("/api/agent-metric-profiles/generate/:roleId", requireAuth, async (req, res) => {
    const role = await storage.getOrgRole(req.params.roleId);
    if (!role) return res.status(404).json({ error: "Role not found" });

    const queueKey = `profile:${role.id}:${req.user!.id}`;
    if (profileGenQueue.get(queueKey)) {
      return res.json({ success: true, message: "Profile generation already in progress" });
    }

    res.json({ success: true, message: `Generating best-practice metric profile for ${role.title}...` });

    profileGenQueue.set(queueKey, true);
    try {
      const catalogMetrics = await storage.getServiceMetrics(req.user!.id);
      if (catalogMetrics.length === 0) return;

      await storage.deleteAgentMetricProfilesByRole(role.id, req.user!.id);

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);

      const response = await callAiLogged(openai, {
        model: _aiModel,
        temperature: 0.1,
        max_tokens: 3000,
        messages: [
          { role: "system", content: AGENT_PROFILE_SYSTEM_PROMPT },
          { role: "user", content: buildAgentProfileUserPrompt(role, catalogMetrics) },
        ],
      }, { module: "agent-metrics", endpoint: "/api/agent-metric-profiles/generate/:roleId", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content?.trim() || '{"assignments":[],"newMetrics":[]}';
      const { created, newMetricsCreated } = await processProfileAIResponse(content, role.id, req.user!.id, catalogMetrics);

      console.log(`[AGENT_PROFILE] Generated ${created} metric profile entries for ${role.title}${newMetricsCreated > 0 ? ` (${newMetricsCreated} new catalog metrics created)` : ""}`);

      if (created > 0) {
        generateOperationalInsightsForRole(role.id, req.user!.id).catch((err) => {
          console.error("[OPERATIONAL_INSIGHTS] Auto-trigger failed after explicit profile gen:", err);
        });
      }
    } catch (err) {
      console.error("[AGENT_PROFILE] Profile generation failed:", err);
    } finally {
      profileGenQueue.delete(queueKey);
    }
  });

  app.post("/api/agent-metric-profiles/provision/:roleId", requireAuth, async (req, res) => {
    const role = await storage.getOrgRole(req.params.roleId);
    if (!role) return res.status(404).json({ error: "Role not found" });

    const profiles = await storage.getAgentMetricProfiles(req.user!.id, role.id);
    if (profiles.length === 0) {
      return res.json({ success: false, message: "No metric profile for this role. Generate one first." });
    }

    const autoProvisionProfiles = profiles.filter(p => p.autoProvision);
    if (autoProvisionProfiles.length === 0) {
      return res.json({ success: false, message: "No auto-provision metrics in this profile." });
    }

    const assets = await storage.getDiscoveredAssets(req.user!.id);
    const agentAssets = assets.filter(a => a.assignedAgentRoleId === role.id);

    if (agentAssets.length === 0) {
      return res.json({
        success: false,
        message: `No devices assigned to ${role.title}. Assign devices first.`,
      });
    }

    const catalogMetrics = await storage.getServiceMetrics(req.user!.id);
    const metricMap = new Map(catalogMetrics.map(m => [m.id, m]));

    let provisioned = 0;
    let skippedExisting = 0;

    for (const asset of agentAssets) {
      const existingAssignments = await storage.getServiceMetricAssignments(req.user!.id, { assetId: asset.id });
      const assignedMetricIds = new Set(existingAssignments.map(a => a.metricId));

      for (const profile of autoProvisionProfiles) {
        if (assignedMetricIds.has(profile.metricId)) {
          skippedExisting++;
          continue;
        }

        const metric = metricMap.get(profile.metricId);
        if (!metric) continue;

        try {
          await storage.createServiceMetricAssignment({
            metricId: profile.metricId,
            assetId: asset.id,
            collectionMode: metric.collectionMode,
            interval: metric.defaultInterval,
            enabled: true,
            lastValue: null,
            lastCollected: null,
            status: "unknown",
            userId: req.user!.id,
          });
          provisioned++;
        } catch (err) {
          console.error(`[AGENT_PROVISION] Failed to provision metric ${metric.name} on ${asset.name}:`, err);
        }
      }
    }

    res.json({
      success: true,
      message: `Provisioned ${provisioned} metric assignment(s) across ${agentAssets.length} device(s) for ${role.title}`,
      provisioned,
      skippedExisting,
      devices: agentAssets.length,
      metricsInProfile: autoProvisionProfiles.length,
    });
  });

  app.post("/api/agent-metric-profiles/generate-all", requireAuth, async (req, res) => {
    const subscriptions = await storage.getRoleSubscriptionsByUser(req.user!.id);
    const activeSubs = subscriptions.filter(s => s.status === "active" && s.hasAiShadow);

    if (activeSubs.length === 0) {
      return res.json({ success: false, message: "No active AI agent subscriptions found." });
    }

    const existingProfiles = await storage.getAgentMetricProfiles(req.user!.id);
    const rolesWithProfiles = new Set(existingProfiles.map(p => p.roleId));

    let queued = 0;
    for (const sub of activeSubs) {
      if (rolesWithProfiles.has(sub.roleId)) continue;

      const queueKey = `profile:${sub.roleId}:${req.user!.id}`;
      if (profileGenQueue.get(queueKey)) continue;

      const role = await storage.getOrgRole(sub.roleId);
      if (!role) continue;

      profileGenQueue.set(queueKey, true);
      (async () => {
        try {
          const catalogMetrics = await storage.getServiceMetrics(req.user!.id);
          if (catalogMetrics.length === 0) return;

          const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);

          const response = await callAiLogged(openai, {
            model: _aiModel,
            temperature: 0.1,
            max_tokens: 3000,
            messages: [
              { role: "system", content: AGENT_PROFILE_SYSTEM_PROMPT },
              { role: "user", content: buildAgentProfileUserPrompt(role, catalogMetrics) },
            ],
          }, { module: "agent-metrics", endpoint: "/api/agent-metric-profiles/generate-all", userId: req.user!.id, providerName });

          const content = response.choices[0]?.message?.content?.trim() || '{"assignments":[],"newMetrics":[]}';
          const { created, newMetricsCreated } = await processProfileAIResponse(content, role.id, req.user!.id, catalogMetrics);

          console.log(`[AGENT_PROFILE] Generated profile for ${role.title} (${created} metrics${newMetricsCreated > 0 ? `, ${newMetricsCreated} new catalog metrics` : ""})`);

          if (created > 0) {
            generateOperationalInsightsForRole(role.id, req.user!.id).catch((err) => {
              console.error("[OPERATIONAL_INSIGHTS] Auto-trigger failed after bulk profile gen:", err);
            });
          }
        } catch (err) {
          console.error(`[AGENT_PROFILE] Failed for ${role.title}:`, err);
        } finally {
          profileGenQueue.delete(queueKey);
        }
      })();

      queued++;
    }

    res.json({
      success: true,
      message: `Generating best-practice metric profiles for ${queued} AI agent(s)`,
      totalActiveAgents: activeSubs.length,
      queued,
      alreadyHaveProfiles: activeSubs.length - queued,
    });
  });

  const OPERATIONAL_INSIGHTS_SYSTEM_PROMPT = `You are the HOLOCRON AI Operational Intelligence Engine. You analyze an AI agent's role, its assigned service metrics, and its domain to generate actionable operational insights.

Generate domain-specific operational intelligence organized into five categories:

1. **Predictive Measures**: Proactive actions the agent takes to predict issues before they occur. These involve trend analysis, anomaly detection, capacity forecasting, and pattern recognition.
2. **Preventive Measures**: Actions the agent takes to prevent issues from occurring. These involve scheduled maintenance, health checks, policy enforcement, and proactive remediation.
3. **Prescriptive Measures**: Specific recommendations the agent provides when issues are detected. These involve root cause analysis, optimal remediation paths, and decision support.
4. **Maintenance Activities**: Regular maintenance tasks this agent performs or oversees, with recommended frequencies.
5. **Best Practices**: Industry best practices this agent follows based on ITIL, NIST, or domain-specific frameworks.

For each item, provide:
- "title": Short descriptive title
- "description": Detailed explanation of the measure/activity
- "icon": A lucide-react icon name (e.g., "TrendingUp", "Shield", "Wrench", "BookOpen", "Activity", "AlertTriangle", "Clock", "Search", "Zap", "Target", "Eye", "BarChart3")

For maintenance activities, also include:
- "frequency": How often (e.g., "Daily", "Weekly", "Monthly", "Quarterly", "On-demand", "Continuous")

Respond ONLY with valid JSON (no markdown). Format:
{
  "predictiveMeasures": [{"title":"...","description":"...","icon":"TrendingUp"}],
  "preventiveMeasures": [{"title":"...","description":"...","icon":"Shield"}],
  "prescriptiveMeasures": [{"title":"...","description":"...","icon":"Target"}],
  "maintenanceActivities": [{"title":"...","description":"...","icon":"Wrench","frequency":"Weekly"}],
  "bestPractices": [{"title":"...","description":"...","icon":"BookOpen"}]
}

Generate 3-5 items per category. Make them highly specific to the agent's domain — not generic. Reference actual metric types and infrastructure concerns relevant to the role.`;

  function buildOperationalInsightsUserPrompt(role: any, profileMetrics: any[]) {
    const metricsByMode: Record<string, any[]> = { scheduled: [], on_demand: [], continuous: [] };
    for (const pm of profileMetrics) {
      const mode = pm.metric?.collectionMode || "continuous";
      if (!metricsByMode[mode]) metricsByMode[mode] = [];
      metricsByMode[mode].push(pm);
    }

    return `Agent Role: ${role.title}
Department: ${role.department}
Division: ${role.division || "N/A"}
Level: ${role.level}
Description: ${role.description}
Responsibilities: ${(role.responsibilities || []).join(", ")}
AI Capabilities: ${(role.aiCapabilities || []).join(", ")}
Key Tasks: ${(role.keyTasks || []).slice(0, 6).join(", ")}

Assigned Metrics by Collection Mode:

SCHEDULED (${metricsByMode.scheduled.length}):
${metricsByMode.scheduled.map((pm: any) => `- ${pm.metric?.name || "Unknown"} (${pm.metric?.category || "N/A"}, priority: ${pm.priority})`).join("\n") || "None"}

ON-DEMAND (${metricsByMode.on_demand.length}):
${metricsByMode.on_demand.map((pm: any) => `- ${pm.metric?.name || "Unknown"} (${pm.metric?.category || "N/A"}, priority: ${pm.priority})`).join("\n") || "None"}

CONTINUOUS (${metricsByMode.continuous.length}):
${metricsByMode.continuous.map((pm: any) => `- ${pm.metric?.name || "Unknown"} (${pm.metric?.category || "N/A"}, priority: ${pm.priority})`).join("\n") || "None"}

Generate predictive, preventive, and prescriptive measures along with maintenance activities and best practices that are specifically relevant to this agent's domain and the metrics it monitors.`;
  }

  async function generateOperationalInsightsForRole(roleId: string, userId: string) {
    try {
      const role = await storage.getOrgRole(roleId);
      if (!role) return;

      const profiles = await storage.getAgentMetricProfiles(userId, roleId);
      const metrics = await storage.getServiceMetrics(userId);
      const metricMap = new Map(metrics.map(m => [m.id, m]));
      const enrichedProfiles = profiles.map(p => ({ ...p, metric: metricMap.get(p.metricId) || null }));

      const roleKey = (role.title || role.name).toLowerCase().trim();
      const profileSignature = profiles.map(p => p.metricId).sort().join(",");
      const cacheKey = `${roleKey}::${profileSignature}`;
      const cached = await storage.getCacheTemplate(userId, "operational_insights", cacheKey);

      let parsed: any;

      if (cached) {
        parsed = cached.responseData;
        await storage.incrementCacheHit(cached.id);
        console.log(`[OPERATIONAL_INSIGHTS] Cache HIT for role "${roleKey}" — reusing template (saved ~5,000 tokens)`);
      } else {
        const { client: openai, model: _aiModel, providerName: _insProviderName } = await getAiClient(userId);

        const response = await callAiLogged(openai, {
          model: _aiModel,
          temperature: 0.2,
          max_tokens: 3000,
          messages: [
            { role: "system", content: OPERATIONAL_INSIGHTS_SYSTEM_PROMPT },
            { role: "user", content: buildOperationalInsightsUserPrompt(role, enrichedProfiles) },
          ],
          response_format: { type: "json_object" },
        }, { module: "agent-metrics", endpoint: "/api/agent-metric-profiles/generate-all", userId, providerName: _insProviderName });

        const content = response.choices[0]?.message?.content?.trim() || "{}";
        try {
          parsed = JSON.parse(content);
        } catch {
          console.error("[OPERATIONAL_INSIGHTS] Failed to parse AI response");
          return;
        }

        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await storage.setCacheTemplate({
          userId,
          cacheCategory: "operational_insights",
          assetType: roleKey,
          cacheKey,
          responseData: parsed,
          tokensSaved: 5000,
          expiresAt: thirtyDaysFromNow,
        });
        console.log(`[OPERATIONAL_INSIGHTS] Cache MISS — created template for role "${roleKey}" (valid 30 days)`);
      }

      await storage.deleteAgentOperationalInsightsByRole(roleId, userId);

      await storage.createAgentOperationalInsights({
        roleId,
        userId,
        predictiveMeasures: parsed.predictiveMeasures || [],
        preventiveMeasures: parsed.preventiveMeasures || [],
        prescriptiveMeasures: parsed.prescriptiveMeasures || [],
        maintenanceActivities: parsed.maintenanceActivities || [],
        bestPractices: parsed.bestPractices || [],
      });

      console.log(`[OPERATIONAL_INSIGHTS] Generated insights for ${role.title}`);

      await autoPopulateScheduledActivitiesForRole(roleId, userId);
    } catch (err) {
      console.error("[OPERATIONAL_INSIGHTS] Generation failed:", err);
    }
  }

  async function autoPopulateScheduledActivitiesForRole(roleId: string, userId: string) {
    try {
      const insight = await storage.getAgentOperationalInsights(userId, roleId);
      if (!insight) return;

      await storage.deleteScheduledActivitiesByRole(roleId, userId);

      const defaultFrequencies: Record<string, string> = {
        predictive: "monthly",
        preventive: "quarterly",
        prescriptive: "monthly",
        maintenance: "weekly",
      };
      const now = new Date();

      const schedule = (items: any[], type: string) => {
        if (!Array.isArray(items)) return;
        const freq = defaultFrequencies[type] || "monthly";
        items.forEach((item: any, idx: number) => {
          if (!item.title) return;
          const itemFreq = item.frequency?.toLowerCase() || freq;
          const normalizedFreq = ["weekly", "monthly", "quarterly"].includes(itemFreq) ? itemFreq : freq;
          const offsetDays = type === "predictive" ? idx * 3 : type === "preventive" ? idx * 7 + 2 : type === "prescriptive" ? idx * 5 + 1 : idx * 2;
          const scheduledDate = new Date(now);
          scheduledDate.setDate(scheduledDate.getDate() + offsetDays + 1);
          if (scheduledDate.getDay() === 0) scheduledDate.setDate(scheduledDate.getDate() + 1);
          if (scheduledDate.getDay() === 6) scheduledDate.setDate(scheduledDate.getDate() + 2);

          storage.createScheduledActivity({
            roleId, userId,
            title: item.title,
            description: item.description || "",
            activityType: type,
            frequency: normalizedFreq,
            scheduledDate,
            status: "scheduled",
            sourceInsightId: insight.id,
            icon: item.icon || "Activity",
          }).catch(err => console.error("[SCHEDULED_ACTIVITIES] Auto-create failed:", err));
        });
      };

      schedule(insight.predictiveMeasures as any[], "predictive");
      schedule(insight.preventiveMeasures as any[], "preventive");
      schedule(insight.prescriptiveMeasures as any[], "prescriptive");
      schedule(insight.maintenanceActivities as any[], "maintenance");

      console.log(`[SCHEDULED_ACTIVITIES] Auto-populated activities for role ${roleId}`);
    } catch (err) {
      console.error("[SCHEDULED_ACTIVITIES] Auto-populate failed:", err);
    }
  }

  app.get("/api/agent-operational-insights/all", requireAuth, async (req, res) => {
    const allInsights = await storage.getAllAgentOperationalInsights(req.user!.id);
    res.json(allInsights);
  });

  app.get("/api/agent-operational-insights/:roleId", requireAuth, async (req, res) => {
    const insights = await storage.getAgentOperationalInsights(req.user!.id, req.params.roleId);
    if (!insights) return res.status(404).json({ error: "No operational insights found for this role" });
    res.json(insights);
  });

  app.post("/api/agent-operational-insights/generate/:roleId", requireAuth, async (req, res) => {
    const role = await storage.getOrgRole(req.params.roleId);
    if (!role) return res.status(404).json({ error: "Role not found" });

    const subscriptions = await storage.getRoleSubscriptionsByUser(req.user!.id);
    const hasSub = subscriptions.some(s => s.roleId === role.id && s.status === "active" && s.hasAiShadow);
    if (!hasSub) return res.status(403).json({ error: "No active AI agent subscription for this role" });

    res.json({ success: true, message: `Generating operational insights for ${role.title}...` });

    generateOperationalInsightsForRole(role.id, req.user!.id).catch((err) => {
      console.error("[OPERATIONAL_INSIGHTS] Generation failed for", role.title, err);
    });
  });

  app.post("/api/agent-operational-insights/generate-all", requireAuth, async (req, res) => {
    const subscriptions = await storage.getRoleSubscriptionsByUser(req.user!.id);
    const activeSubs = subscriptions.filter(s => s.status === "active" && s.hasAiShadow);

    if (activeSubs.length === 0) {
      return res.json({ success: false, message: "No active AI agent subscriptions found." });
    }

    let queued = 0;
    for (const sub of activeSubs) {
      const role = await storage.getOrgRole(sub.roleId);
      if (!role) continue;

      generateOperationalInsightsForRole(sub.roleId, req.user!.id).catch((err) => {
        console.error("[OPERATIONAL_INSIGHTS] Bulk generation failed for", role.title, err);
      });
      queued++;
    }

    res.json({
      success: true,
      message: `Generating operational insights for ${queued} AI agent(s)`,
      queued,
    });
  });

  app.get("/api/agent-scheduled-activities", requireAuth, async (req, res) => {
    const activities = await storage.getScheduledActivities(req.user!.id);
    res.json(activities);
  });

  app.get("/api/agent-scheduled-activities/role/:roleId", requireAuth, async (req, res) => {
    const activities = await storage.getScheduledActivitiesByRole(req.user!.id, req.params.roleId);
    res.json(activities);
  });

  app.post("/api/agent-scheduled-activities", requireAuth, async (req, res) => {
    const activity = await storage.createScheduledActivity({ ...req.body, userId: req.user!.id });
    res.json(activity);
  });

  app.patch("/api/agent-scheduled-activities/:id/status", requireAuth, async (req, res) => {
    const { status, notes } = req.body;
    const validStatuses = ["scheduled", "pending_approval", "approved", "executing", "completed", "skipped"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const activity = await storage.updateScheduledActivityStatus(req.params.id, req.user!.id, status, notes);
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    res.json(activity);
  });

  app.patch("/api/agent-scheduled-activities/:id/approve", requireAuth, async (req, res) => {
    const activity = await storage.approveScheduledActivity(req.params.id, req.user!.id);
    if (!activity) return res.status(404).json({ error: "Activity not found" });
    res.json(activity);
  });

  app.delete("/api/agent-scheduled-activities/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteScheduledActivity(req.params.id, req.user!.id);
    if (!deleted) return res.status(404).json({ error: "Activity not found" });
    res.json({ success: true });
  });

  app.post("/api/agent-scheduled-activities/populate", requireAuth, async (req, res) => {
    const allInsights = await storage.getAllAgentOperationalInsights(req.user!.id);
    if (allInsights.length === 0) return res.json({ success: true, created: 0, message: "No insights to populate from" });

    const defaultFrequencies: Record<string, string> = {
      predictive: "monthly",
      preventive: "quarterly",
      prescriptive: "monthly",
      maintenance: "weekly",
    };

    const now = new Date();
    let created = 0;

    for (const insight of allInsights) {
      await storage.deleteScheduledActivitiesByRole(insight.roleId, req.user!.id);

      const extractActivities = async (items: any[], type: string) => {
        if (!Array.isArray(items)) return;
        const freq = defaultFrequencies[type] || "monthly";
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          if (!item.title) continue;
          const itemFreq = item.frequency?.toLowerCase() || freq;
          const normalizedFreq = ["weekly", "monthly", "quarterly"].includes(itemFreq) ? itemFreq : freq;

          const offsetDays = type === "predictive" ? idx * 3 : type === "preventive" ? idx * 7 + 2 : type === "prescriptive" ? idx * 5 + 1 : idx * 2;
          const scheduledDate = new Date(now);
          scheduledDate.setDate(scheduledDate.getDate() + offsetDays + 1);
          if (scheduledDate.getDay() === 0) scheduledDate.setDate(scheduledDate.getDate() + 1);
          if (scheduledDate.getDay() === 6) scheduledDate.setDate(scheduledDate.getDate() + 2);

          await storage.createScheduledActivity({
            roleId: insight.roleId,
            userId: req.user!.id,
            title: item.title,
            description: item.description || "",
            activityType: type,
            frequency: normalizedFreq,
            scheduledDate,
            status: "scheduled",
            sourceInsightId: insight.id,
            icon: item.icon || "Activity",
          });
          created++;
        }
      };

      await extractActivities(insight.predictiveMeasures as any[], "predictive");
      await extractActivities(insight.preventiveMeasures as any[], "preventive");
      await extractActivities(insight.prescriptiveMeasures as any[], "prescriptive");
      await extractActivities(insight.maintenanceActivities as any[], "maintenance");
    }

    res.json({ success: true, created, message: `Populated ${created} scheduled activities from ${allInsights.length} insight(s)` });
  });

  function calculateHealthStatus(cpu?: number, memory?: number, taskQueue?: number, currentStatus?: string): string {
    const hasMetrics = cpu !== undefined || memory !== undefined || taskQueue !== undefined;
    if (!hasMetrics) return currentStatus || "unknown";
    if (
      (cpu !== undefined && cpu > 95) ||
      (memory !== undefined && memory > 95) ||
      (taskQueue !== undefined && taskQueue > 20)
    ) {
      return "overloaded";
    }
    if (
      (cpu !== undefined && cpu > 85) ||
      (memory !== undefined && memory > 90) ||
      (taskQueue !== undefined && taskQueue > 10)
    ) {
      return "degraded";
    }
    return "healthy";
  }

  app.post("/api/probe-heartbeat", async (req, res) => {
    const parsed = heartbeatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    const { siteToken, ipAddress, hostname, probeVersion, osInfo, cpuUsage, memoryUsage, diskUsage, taskQueueDepth, activeTasks, avgScanDurationMs, networkInterfaces, securityAudit, softwareSummary, storageInfo } = parsed.data;
    const probe = await storage.getDiscoveryProbeByToken(siteToken);
    if (!probe) return res.status(401).json({ error: "Invalid site token. Ensure the token matches a probe configured in the HOLOCRON AI platform." });

    const hmacResult = verifyProbeHmac(req, probe);
    if (!hmacResult.valid) return res.status(403).json({ error: hmacResult.error });

    const updates: Record<string, any> = { lastHeartbeat: new Date() };
    if (ipAddress) updates.ipAddress = ipAddress;
    if (hostname) updates.hostname = hostname;
    if (probeVersion) updates.probeVersion = probeVersion;
    if (osInfo) updates.osInfo = osInfo;

    if (cpuUsage !== undefined) updates.cpuUsage = cpuUsage;
    if (memoryUsage !== undefined) updates.memoryUsage = memoryUsage;
    if (diskUsage !== undefined) updates.diskUsage = diskUsage;
    if (taskQueueDepth !== undefined) updates.taskQueueDepth = taskQueueDepth;
    if (avgScanDurationMs !== undefined) updates.avgScanDuration = avgScanDurationMs;

    const healthStatus = calculateHealthStatus(cpuUsage, memoryUsage, taskQueueDepth, (probe as any).healthStatus);
    updates.healthStatus = healthStatus;

    const existingMetrics = ((probe as any).healthMetrics || []) as any[];
    const metricsEntry = {
      timestamp: new Date().toISOString(),
      cpuUsage: cpuUsage ?? null,
      memoryUsage: memoryUsage ?? null,
      diskUsage: diskUsage ?? null,
      taskQueueDepth: taskQueueDepth ?? null,
      activeTasks: activeTasks ?? null,
      avgScanDurationMs: avgScanDurationMs ?? null,
      healthStatus,
    };
    const history = [...existingMetrics, metricsEntry].slice(-60);
    updates.healthMetrics = history;

    const payloadBytes = Buffer.byteLength(JSON.stringify(req.body), "utf8");
    updates.lastPayloadSize = payloadBytes;

    await storage.updateDiscoveryProbe(probe.id, updates);

    // Auto-sync MDM-protocol probes into the Mobile DevOps section
    if (probe.protocol === 'mdm') {
      try {
        const mdmList = await storage.getMdmDevices(probe.userId);
        const linked = mdmList.find(d => (d.metadata as any)?.probeId === probe.id);
        const probeName = probe.name || 'Android Device';
        const osInfoStr = ((updates.osInfo || probe.osInfo) as string) || '';
        // Parse "Samsung SM-F956B · Android 14" → manufacturer + model
        const osParts = osInfoStr.split('·')[0].trim().split(' ');
        const rawMfr = osParts.length > 0 ? osParts[0] : 'Unknown';
        const manufacturer = rawMfr.charAt(0).toUpperCase() + rawMfr.slice(1).toLowerCase();
        const parsedModel = osParts.length > 1 ? osParts.slice(1).join(' ') : ((updates.hostname || probe.hostname) as string) || 'Android Device';
        // Fix osVersion: remove duplicate "Android" if probe sent "Samsung SM-F956B · Android Android 16"
        const fixedOsVersion = osInfoStr.replace(/Android\s+Android\s*/i, 'Android ').replace(/^(\w)/, c => c.toUpperCase());
        const sw = (softwareSummary || {}) as Record<string, any>;
        // Parse storageInfo string "Total: 512GB · Used: 128GB" → numbers for UI
        const storageMatch = ((storageInfo as string) || '').match(/Total:\s*([\d.]+)\s*GB.*?Used:\s*([\d.]+)\s*GB/i);
        const storageTotalNum = storageMatch ? parseFloat(storageMatch[1]) : null;
        const storageUsedNum  = storageMatch ? parseFloat(storageMatch[2]) : null;
        const mdmMeta = {
          probeId: probe.id,
          source: 'probe-heartbeat',
          batteryLevel: sw.battery ?? null,
          charging: sw.charging ?? null,
          temperature: sw.temperature ?? null,
          wifiSsid: sw.wifiSsid ?? null,
          storageTotal: storageTotalNum,
          storageUsed: storageUsedNum,
        };
        if (linked) {
          await storage.updateMdmDevice(linked.id, probe.userId, {
            lastCheckIn: new Date(),
            osVersion: fixedOsVersion || linked.osVersion || undefined,
            model: parsedModel || linked.model || undefined,
            manufacturer: manufacturer || linked.manufacturer || undefined,
            metadata: mdmMeta,
          });
        } else {
          await storage.createMdmDevice({
            userId: probe.userId,
            name: probeName,
            platform: 'android',
            model: parsedModel,
            manufacturer,
            osVersion: fixedOsVersion || undefined,
            status: 'enrolled',
            complianceStatus: 'compliant',
            ownership: 'corporate',
            enrollmentDate: new Date(),
            lastCheckIn: new Date(),
            metadata: mdmMeta,
          });
        }
      } catch (e) {
        console.error('[HEARTBEAT] MDM device sync failed:', e);
      }
    }

    const rawClientIpHb = req.socket?.remoteAddress?.replace("::ffff:", "") || "";
    try {
      await storage.createProbeActivityLog({
        probeId: probe.id,
        eventType: "heartbeat",
        message: `Heartbeat received — CPU: ${cpuUsage ?? "?"}%, MEM: ${memoryUsage ?? "?"}%, Disk: ${diskUsage ?? "?"}% — Status: ${healthStatus}`,
        ipAddress: rawClientIpHb || null,
        metadata: { cpuUsage, memoryUsage, diskUsage, taskQueueDepth, healthStatus, payloadBytes },
      });
    } catch {}

    const nonce = req.headers["x-holocron-nonce"] as string;
    if (nonce) await recordProbeRequest(probe.id, nonce);

    try {
      const matchedAsset = await storage.getAssetByProbeAndIdentifier(probe.id, ipAddress, hostname);
      if (matchedAsset) {
        const existingMeta = (matchedAsset.metadata || {}) as Record<string, any>;
        const updatedMeta = { ...existingMeta };

        if (cpuUsage !== undefined || memoryUsage !== undefined || diskUsage !== undefined) {
          if (!updatedMeta.systemUtilization) updatedMeta.systemUtilization = {};
          if (cpuUsage !== undefined) updatedMeta.systemUtilization.cpu = cpuUsage;
          if (memoryUsage !== undefined) updatedMeta.systemUtilization.memory = memoryUsage;
          if (diskUsage !== undefined) updatedMeta.systemUtilization.disk = diskUsage;
          updatedMeta.systemUtilization.lastUpdated = new Date().toISOString();
        }

        if (networkInterfaces && networkInterfaces.length > 0) {
          if (!updatedMeta.network) updatedMeta.network = {};
          updatedMeta.network.interfaces = networkInterfaces.map((iface: any) => {
            const rxBps = iface.rxBytesPerSec || 0;
            const txBps = iface.txBytesPerSec || 0;
            const bwStr = iface.bandwidth || "";
            const bwMatch = bwStr.match(/([\d.]+)\s*(Gbps|Mbps|Kbps)/i);
            let linkSpeedBytes = 0;
            if (bwMatch) {
              const num = parseFloat(bwMatch[1]);
              const unit = bwMatch[2].toLowerCase();
              if (unit === "gbps") linkSpeedBytes = num * 1e9 / 8;
              else if (unit === "mbps") linkSpeedBytes = num * 1e6 / 8;
              else if (unit === "kbps") linkSpeedBytes = num * 1e3 / 8;
            }
            const totalBps = rxBps + txBps;
            const computedUtil = linkSpeedBytes > 0 ? Math.min((totalBps / linkSpeedBytes) * 100, 100) : 0;
            if (computedUtil > 0) {
              return { ...iface, utilization: `${computedUtil.toFixed(1)}%` };
            }
            return iface;
          });
        }

        if (securityAudit) {
          const sa = securityAudit;
          const patchCount = sa.installedPatches || 0;
          const fwEnabled = sa.firewall?.includes("3/3") || sa.firewall?.includes("2/3");
          const uacEnabled = sa.uac === "Enabled";
          const avActive = sa.antivirus && sa.antivirus !== "Unable to query";
          if (!updatedMeta.security) updatedMeta.security = {};
          if (!updatedMeta.security.kpis) updatedMeta.security.kpis = {};
          updatedMeta.security.kpis.patchCompliance = patchCount > 20 ? 85 : patchCount > 10 ? 70 : patchCount > 0 ? 50 : 0;
          updatedMeta.security.kpis.configScore = [fwEnabled ? 30 : 0, uacEnabled ? 30 : 0, avActive ? 40 : 0].reduce((a, b) => a + b, 0);
          updatedMeta.security.firewall = sa.firewall || updatedMeta.security.firewall;
          updatedMeta.security.antivirus = sa.antivirus || updatedMeta.security.antivirus;
          updatedMeta.security.diskEncryption = sa.diskEncryption || updatedMeta.security.diskEncryption;
          updatedMeta.security.uac = sa.uac || updatedMeta.security.uac;
          updatedMeta.security.lastPatched = sa.lastPatched || updatedMeta.security.lastPatched;
        }

        if (softwareSummary) {
          if (!updatedMeta.software) updatedMeta.software = {};
          if (softwareSummary.uptime) updatedMeta.software.uptime = softwareSummary.uptime;
          if (softwareSummary.installedPackages) updatedMeta.software.packages = softwareSummary.installedPackages;
          if (softwareSummary.softwareHash) {
            const prevHash = updatedMeta.softwareHash;
            updatedMeta.softwareHash = softwareSummary.softwareHash;
            if (softwareSummary.installedApps && Array.isArray(softwareSummary.installedApps) && softwareSummary.installedApps.length > 0) {
              updatedMeta.installedApps = softwareSummary.installedApps;
            } else if (prevHash && prevHash !== softwareSummary.softwareHash) {
              updatedMeta.requestSoftwareInventory = true;
            }
          } else if (softwareSummary.installedApps && Array.isArray(softwareSummary.installedApps) && softwareSummary.installedApps.length > 0) {
            updatedMeta.installedApps = softwareSummary.installedApps;
          }
        }

        await storage.updateDiscoveredAsset(matchedAsset.id, { metadata: updatedMeta, lastSeen: new Date(), status: "online" });

        const probeUserId = (probe as any).userId;
        if (probeUserId) {
          if (cpuUsage !== undefined || memoryUsage !== undefined || diskUsage !== undefined) {
            updateServiceMetricAssignmentsFromProbe(matchedAsset.id, "metrics", { cpuUsage, memoryUsage, diskUsage }, probeUserId).catch(() => {});
          }
          if (securityAudit) {
            updateServiceMetricAssignmentsFromProbe(matchedAsset.id, "securityAudit", securityAudit, probeUserId).catch(() => {});
          }
          if (softwareSummary) {
            updateServiceMetricAssignmentsFromProbe(matchedAsset.id, "softwareInventory", softwareSummary, probeUserId).catch(() => {});
          }
          if (networkInterfaces && networkInterfaces.length > 0) {
            updateServiceMetricAssignmentsFromProbe(matchedAsset.id, "networkInterfaces", networkInterfaces, probeUserId).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.error("Failed to update asset from heartbeat:", err);
    }

    let pendingTasks: any[] = [];
    try {
      const tasks = await storage.getPendingTasksForProbe(probe.id);
      const probeIsWindows = /windows/i.test(probe.osInfo || "");
      const effectiveScriptType = probeIsWindows ? "powershell" : "bash";

      // Split: tasks with scripts dispatch now; empty-script tasks regenerate asynchronously
      const tasksToDispatch = tasks.filter(t => t.remediationScript && t.remediationScript.trim());
      const tasksNeedingScript = tasks.filter(t => !t.remediationScript || !t.remediationScript.trim());

      if (tasksNeedingScript.length > 0) {
        console.log(`[REMEDIATION] Auto-regenerating ${tasksNeedingScript.length} empty-script task(s) for probe ${probe.name} as ${effectiveScriptType}`);
        (async () => {
          for (const t of tasksNeedingScript) {
            try {
              const asset = await storage.getDiscoveredAsset(t.assetId, probe.userId!);
              const { client: aiClient, model: aiModel } = await getAiClient(probe.userId!);
              const osName = (asset?.osName) || probe.osInfo || (probeIsWindows ? "Windows" : "Linux");
              const rsp = await aiClient.chat.completions.create({
                model: aiModel,
                messages: [
                  { role: "system", content: `You are a senior systems administrator. Respond ONLY with valid JSON containing "script" and "rollbackScript" string fields. Write ${effectiveScriptType} scripts only. No markdown fences inside strings.` },
                  { role: "user", content: `Generate a ${effectiveScriptType} remediation script for: "${t.title}". Target OS: ${osName}. Return JSON with "script" and "rollbackScript".` }
                ],
                temperature: 0.3,
                max_tokens: 3000,
                response_format: { type: "json_object" },
              });
              const rawJson = rsp.choices[0]?.message?.content?.trim() || "";
              if (!rawJson) continue;
              const parsed = JSON.parse(rawJson);
              const newScript = decodeScriptEntities((parsed.script || "").replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim());
              const newRollback = parsed.rollbackScript ? decodeScriptEntities((parsed.rollbackScript as string).replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()) : null;
              if (newScript) {
                await storage.updateRemediationTask(t.id, {
                  remediationScript: newScript,
                  rollbackScript: newRollback || t.rollbackScript || null,
                  scriptType: effectiveScriptType,
                });
                console.log(`[REMEDIATION] Script regenerated for task ${t.id} (${t.title.substring(0, 50)})`);
              }
            } catch (err: any) {
              console.error(`[REMEDIATION] Failed to regenerate script for task ${t.id}:`, err.message);
            }
          }
        })().catch(() => {});
      }

      pendingTasks = tasksToDispatch.map(t => {
        let script = t.remediationScript || "";
        script = decodeScriptEntities(script.replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, ""));
        const title = (t.title || "").toLowerCase();
        const isLongRunning = /install|update|patch|upgrade|download|deploy|setup|chocolat|winget|msiexec|windows update/i.test(title);
        return {
          id: t.id,
          title: t.title,
          script,
          scriptType: t.scriptType,
          timeoutSeconds: isLongRunning ? 3600 : 1800,
        };
      });
      for (const t of tasksToDispatch) {
        await storage.updateRemediationTask(t.id, { status: "dispatched", dispatchedAt: new Date() });
      }
      if (pendingTasks.length > 0) {
        console.log(`[REMEDIATION] Dispatching ${pendingTasks.length} task(s) to probe ${probe.name}: ${pendingTasks.map(t => t.id).join(", ")}`);
      }
    } catch (err) {
      console.error("Failed to fetch pending tasks for probe:", err);
    }

    let pendingRollbacks: any[] = [];
    try {
      const rollbackTasks = await storage.getPendingRollbacksForProbe(probe.id);
      pendingRollbacks = rollbackTasks.map(t => {
        let script = t.rollbackScript || "";
        script = decodeScriptEntities(script.replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, ""));
        return {
          id: t.id,
          title: `[ROLLBACK] ${t.title}`,
          script,
          scriptType: t.scriptType,
          isRollback: true,
        };
      });
      for (const t of rollbackTasks) {
        await storage.updateRemediationTask(t.id, { rollbackStatus: "dispatched", rollbackDispatchedAt: new Date() });
      }
      if (pendingRollbacks.length > 0) {
        console.log(`[ROLLBACK] Dispatching ${pendingRollbacks.length} rollback(s) to probe ${probe.name}: ${pendingRollbacks.map(t => t.id).join(", ")}`);
      }
    } catch (err) {
      console.error("Failed to fetch pending rollbacks for probe:", err);
    }

    const adaptiveInterval = computeAdaptiveInterval(healthStatus, 1);
    let requestSoftwareInventory = false;
    try {
      const asset = await storage.getAssetByProbeAndIdentifier(probe.id, ipAddress, hostname);
      if (asset) {
        const meta = (asset.metadata || {}) as Record<string, any>;
        if (meta.requestSoftwareInventory) {
          requestSoftwareInventory = true;
          delete meta.requestSoftwareInventory;
          await storage.updateDiscoveredAsset(asset.id, { metadata: meta });
        }
      }
    } catch {}

    const collectionSchedule = getProbeCollectionSchedule(probe);

    if (parsed.data.bufferStatus) {
      try {
        await storage.updateDiscoveryProbe(probe.id, { bufferStatus: parsed.data.bufferStatus });
      } catch {}
    }

    res.json({ success: true, nextHeartbeat: adaptiveInterval, healthStatus, pendingTasks, pendingRollbacks, requestSoftwareInventory, collectionSchedule });
  });

  app.get("/api/probe-config", async (req, res) => {
    const token = (req.query.siteToken || req.headers["x-holocron-token"]) as string;
    if (!token) return res.status(400).json({ error: "siteToken required" });
    const probe = await storage.getDiscoveryProbeByToken(token);
    if (!probe) return res.status(401).json({ error: "Invalid site token. Ensure the token matches a probe configured in the HOLOCRON AI platform." });

    const hmacResult = verifyProbeHmac(req, probe);
    if (!hmacResult.valid) return res.status(403).json({ error: hmacResult.error });

    const collectionSchedule = getProbeCollectionSchedule(probe);

    try {
      await storage.createProbeActivityLog({
        probeId: probe.id,
        eventType: "config_fetch",
        message: `Configuration fetched — heartbeat interval: ${probe.heartbeatInterval || 60}s`,
        ipAddress: req.socket?.remoteAddress?.replace("::ffff:", "") || null,
        metadata: { heartbeatInterval: probe.heartbeatInterval || 60 },
      });
    } catch {}

    res.json({
      success: true,
      probeId: probe.id,
      probeName: probe.name,
      heartbeatInterval: probe.heartbeatInterval || 60,
      collectionSchedule,
    });
  });

  const bufferedDataSchema = z.object({
    siteToken: z.string().min(1).max(200),
    bufferedData: z.array(z.object({
      taskType: z.string().max(50),
      timestamp: z.string(),
      hostname: z.string().max(255).optional(),
      ipAddress: z.string().max(45).optional(),
      data: z.record(z.any()),
    })).min(1).max(500),
  });

  app.post("/api/probe-heartbeat-buffered", async (req, res) => {
    const parsed = bufferedDataSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    const { siteToken, bufferedData } = parsed.data;

    const probe = await storage.getDiscoveryProbeByToken(siteToken);
    if (!probe) return res.status(401).json({ error: "Invalid site token. Ensure the token matches a probe configured in the HOLOCRON AI platform." });

    const hmacResult = verifyProbeHmac(req, probe);
    if (!hmacResult.valid) return res.status(403).json({ error: hmacResult.error });

    const nonce = req.headers["x-holocron-nonce"] as string;
    if (nonce) await recordProbeRequest(probe.id, nonce);

    const sorted = [...bufferedData].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const assetCache = new Map<string, any>();
    let processed = 0;
    let errors = 0;

    for (const entry of sorted) {
      try {
        const cacheKey = `${entry.ipAddress || ""}|${entry.hostname || ""}`;
        let asset = assetCache.get(cacheKey);
        if (!asset) {
          asset = await storage.getAssetByProbeAndIdentifier(probe.id, entry.ipAddress, entry.hostname);
          if (asset) assetCache.set(cacheKey, asset);
        }
        if (!asset) { processed++; continue; }

        const meta = (asset.metadata || {}) as Record<string, any>;

        if (entry.taskType === "metrics") {
          if (!meta.systemUtilization) meta.systemUtilization = {};
          if (entry.data.cpuUsage !== undefined) meta.systemUtilization.cpu = entry.data.cpuUsage;
          if (entry.data.memoryUsage !== undefined) meta.systemUtilization.memory = entry.data.memoryUsage;
          if (entry.data.diskUsage !== undefined) meta.systemUtilization.disk = entry.data.diskUsage;
          meta.systemUtilization.lastUpdated = entry.timestamp;

          if (!meta.metricsHistory) meta.metricsHistory = [];
          meta.metricsHistory.push({
            timestamp: entry.timestamp,
            cpu: entry.data.cpuUsage,
            memory: entry.data.memoryUsage,
            disk: entry.data.diskUsage,
          });
          meta.metricsHistory = meta.metricsHistory.slice(-120);
        } else if (entry.taskType === "networkInterfaces") {
          if (!meta.network) meta.network = {};
          const interfaces = Array.isArray(entry.data.interfaces) ? entry.data.interfaces : entry.data;
          if (Array.isArray(interfaces)) {
            meta.network.interfaces = interfaces.map((iface: any) => {
              const rxBps = iface.rxBytesPerSec || 0;
              const txBps = iface.txBytesPerSec || 0;
              const bwStr = iface.bandwidth || "";
              const bwMatch = bwStr.match(/([\d.]+)\s*(Gbps|Mbps|Kbps)/i);
              let linkSpeedBytes = 0;
              if (bwMatch) {
                const num = parseFloat(bwMatch[1]);
                const unit = bwMatch[2].toLowerCase();
                if (unit === "gbps") linkSpeedBytes = num * 1e9 / 8;
                else if (unit === "mbps") linkSpeedBytes = num * 1e6 / 8;
                else if (unit === "kbps") linkSpeedBytes = num * 1e3 / 8;
              }
              const totalBps = rxBps + txBps;
              const computedUtil = linkSpeedBytes > 0 ? Math.min((totalBps / linkSpeedBytes) * 100, 100) : 0;
              if (computedUtil > 0) return { ...iface, utilization: `${computedUtil.toFixed(1)}%` };
              return iface;
            });
          }
        } else if (entry.taskType === "securityAudit") {
          const sa = entry.data;
          if (!meta.security) meta.security = {};
          if (!meta.security.kpis) meta.security.kpis = {};
          const patchCount = sa.installedPatches || 0;
          meta.security.kpis.patchCompliance = patchCount > 20 ? 85 : patchCount > 10 ? 70 : patchCount > 0 ? 50 : 0;
          const fwEnabled = sa.firewall?.includes("3/3") || sa.firewall?.includes("2/3");
          const uacEnabled = sa.uac === "Enabled";
          const avActive = sa.antivirus && sa.antivirus !== "Unable to query";
          meta.security.kpis.configScore = [fwEnabled ? 30 : 0, uacEnabled ? 30 : 0, avActive ? 40 : 0].reduce((a, b) => a + b, 0);
          if (sa.firewall) meta.security.firewall = sa.firewall;
          if (sa.antivirus) meta.security.antivirus = sa.antivirus;
          if (sa.diskEncryption) meta.security.diskEncryption = sa.diskEncryption;
          if (sa.uac) meta.security.uac = sa.uac;
          if (sa.lastPatched) meta.security.lastPatched = sa.lastPatched;
        } else if (entry.taskType === "softwareInventory") {
          if (!meta.software) meta.software = {};
          if (entry.data.uptime) meta.software.uptime = entry.data.uptime;
          if (typeof entry.data.installedPackages === "number") meta.software.packages = entry.data.installedPackages;
          if (entry.data.softwareHash) meta.softwareHash = entry.data.softwareHash;
          if (entry.data.os) meta.software.os = entry.data.os;
          if (entry.data.version) meta.software.version = entry.data.version;
          if (entry.data.buildNumber) meta.software.buildNumber = entry.data.buildNumber;
          if (entry.data.installedApps && Array.isArray(entry.data.installedApps)) {
            if (entry.data.installedApps.length > 0) {
              meta.installedApps = entry.data.installedApps;
              meta.software.installedApps = entry.data.installedApps;
            } else {
              // Mark that the scan ran but found nothing — helps the UI distinguish "pending" vs "scanned/empty"
              meta.softwareInventoryScannedAt = new Date().toISOString();
            }
          }
        } else if (entry.taskType === "storageInfo") {
          if (!meta.hardware) meta.hardware = {};
          meta.hardware.storageDetail = entry.data;
        }

        await storage.updateDiscoveredAsset(asset.id, { metadata: meta, lastSeen: new Date(entry.timestamp), status: "online" });

        const probeUserId = (probe as any).userId;
        if (probeUserId && ["metrics", "securityAudit", "softwareInventory", "networkInterfaces"].includes(entry.taskType)) {
          updateServiceMetricAssignmentsFromProbe(asset.id, entry.taskType, entry.data, probeUserId).catch(() => {});
        }

        processed++;
      } catch (err) {
        errors++;
        console.error(`Failed to process buffered entry [${entry.taskType}]:`, err);
      }
    }

    const bufferedPayloadBytes = Buffer.byteLength(JSON.stringify(req.body), "utf8");
    await storage.updateDiscoveryProbe(probe.id, {
      lastHeartbeat: new Date(),
      lastPayloadSize: bufferedPayloadBytes,
    });

    console.log(`[BUFFER] Processed ${processed}/${sorted.length} buffered entries from probe ${probe.name} (${errors} errors, +${bufferedPayloadBytes}B)`);
    try {
      await storage.createProbeActivityLog({
        probeId: probe.id,
        eventType: "buffered_data",
        message: `Buffered data received — ${processed} entries processed, ${errors} errors (${sorted.length} total)`,
        ipAddress: req.socket?.remoteAddress?.replace("::ffff:", "") || null,
        metadata: { processed, errors, total: sorted.length },
      });
    } catch {}

    // Task dispatch is intentionally omitted from the buffered endpoint.
    // All probe versions correctly process pendingTasks from the regular heartbeat
    // (/api/probe-heartbeat). Dispatching here would mark tasks as "dispatched"
    // before the probe can act on them, causing tasks to be silently dropped on
    // older probe versions that ignore the buffered heartbeat response.
    res.json({ success: true, processed, total: sorted.length, errors, pendingTasks: [], pendingRollbacks: [] });
  });

  const batchHeartbeatSchema = z.object({
    siteToken: z.string().min(1).max(200),
    probeVersion: z.string().max(50).optional(),
    osInfo: z.string().max(255).optional(),
    serverCount: z.number().int().min(1).optional(),
    servers: z.array(z.object({
      hostname: z.string().max(255),
      ipAddress: z.string().max(45).optional(),
      cpuUsage: z.number().min(0).max(100).optional(),
      memoryUsage: z.number().min(0).max(100).optional(),
      diskUsage: z.number().min(0).max(100).optional(),
      softwareHash: z.string().max(128).optional(),
      installedApps: z.array(z.any()).optional(),
      networkInterfaces: z.union([z.array(z.record(z.any())), z.record(z.any())]).optional().transform(v => {
        if (!v) return undefined;
        return Array.isArray(v) ? v : [v];
      }),
      securityAudit: z.record(z.any()).optional(),
      softwareSummary: z.record(z.any()).optional(),
    })).min(1).max(1000),
  });

  app.post("/api/probe-heartbeat-batch", async (req, res) => {
    const parsed = batchHeartbeatSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    const { siteToken, probeVersion, osInfo, servers } = parsed.data;

    const probe = await storage.getDiscoveryProbeByToken(siteToken);
    if (!probe) return res.status(401).json({ error: "Invalid site token. Ensure the token matches a probe configured in the HOLOCRON AI platform." });

    const hmacResult = verifyProbeHmac(req, probe);
    if (!hmacResult.valid) return res.status(403).json({ error: hmacResult.error });

    const probeUpdates: Record<string, any> = { lastHeartbeat: new Date() };
    if (probeVersion) probeUpdates.probeVersion = probeVersion;
    if (osInfo) probeUpdates.osInfo = osInfo;

    let worstHealth = "healthy";
    const allAssets = await storage.getAssetsByProbeId(probe.id);
    const assetByIp = new Map<string, any>();
    const assetByName = new Map<string, any>();
    for (const a of allAssets) {
      if (a.ipAddress) assetByIp.set(a.ipAddress, a);
      if (a.name) assetByName.set(a.name.toLowerCase(), a);
    }

    const serverResults: Record<string, any> = {};
    const softwareRequests: string[] = [];

    for (const server of servers) {
      const matchedAsset = (server.ipAddress && assetByIp.get(server.ipAddress)) || (server.hostname && assetByName.get(server.hostname.toLowerCase()));
      const serverHealth = calculateHealthStatus(server.cpuUsage, server.memoryUsage, undefined, "healthy");
      if (serverHealth === "overloaded") worstHealth = "overloaded";
      else if (serverHealth === "degraded" && worstHealth !== "overloaded") worstHealth = "degraded";

      if (matchedAsset) {
        const existingMeta = (matchedAsset.metadata || {}) as Record<string, any>;
        const updatedMeta = { ...existingMeta };

        if (server.cpuUsage !== undefined || server.memoryUsage !== undefined || server.diskUsage !== undefined) {
          if (!updatedMeta.systemUtilization) updatedMeta.systemUtilization = {};
          if (server.cpuUsage !== undefined) updatedMeta.systemUtilization.cpu = server.cpuUsage;
          if (server.memoryUsage !== undefined) updatedMeta.systemUtilization.memory = server.memoryUsage;
          if (server.diskUsage !== undefined) updatedMeta.systemUtilization.disk = server.diskUsage;
          updatedMeta.systemUtilization.lastUpdated = new Date().toISOString();
        }

        if (server.networkInterfaces && server.networkInterfaces.length > 0) {
          if (!updatedMeta.network) updatedMeta.network = {};
          updatedMeta.network.interfaces = server.networkInterfaces.map((iface: any) => {
            const rxBps = iface.rxBytesPerSec || 0;
            const txBps = iface.txBytesPerSec || 0;
            const bwStr = iface.bandwidth || "";
            const bwMatch = bwStr.match(/([\d.]+)\s*(Gbps|Mbps|Kbps)/i);
            let linkSpeedBytes = 0;
            if (bwMatch) {
              const num = parseFloat(bwMatch[1]);
              const unit = bwMatch[2].toLowerCase();
              if (unit === "gbps") linkSpeedBytes = num * 1e9 / 8;
              else if (unit === "mbps") linkSpeedBytes = num * 1e6 / 8;
              else if (unit === "kbps") linkSpeedBytes = num * 1e3 / 8;
            }
            const totalBps = rxBps + txBps;
            const computedUtil = linkSpeedBytes > 0 ? Math.min((totalBps / linkSpeedBytes) * 100, 100) : 0;
            if (computedUtil > 0) return { ...iface, utilization: `${computedUtil.toFixed(1)}%` };
            return iface;
          });
        }

        if (server.securityAudit) {
          const sa = server.securityAudit;
          const patchCount = sa.installedPatches || 0;
          const fwEnabled = sa.firewall?.includes("3/3") || sa.firewall?.includes("2/3");
          const uacEnabled = sa.uac === "Enabled";
          const avActive = sa.antivirus && sa.antivirus !== "Unable to query";
          if (!updatedMeta.security) updatedMeta.security = {};
          if (!updatedMeta.security.kpis) updatedMeta.security.kpis = {};
          updatedMeta.security.kpis.patchCompliance = patchCount > 20 ? 85 : patchCount > 10 ? 70 : patchCount > 0 ? 50 : 0;
          updatedMeta.security.kpis.configScore = [fwEnabled ? 30 : 0, uacEnabled ? 30 : 0, avActive ? 40 : 0].reduce((a, b) => a + b, 0);
        }

        if (server.softwareHash) {
          const prevHash = updatedMeta.softwareHash;
          updatedMeta.softwareHash = server.softwareHash;
          if (server.installedApps && server.installedApps.length > 0) {
            updatedMeta.installedApps = server.installedApps;
          } else if (prevHash && prevHash !== server.softwareHash) {
            softwareRequests.push(server.hostname);
          }
        } else if (server.installedApps && server.installedApps.length > 0) {
          updatedMeta.installedApps = server.installedApps;
        }

        if (server.softwareSummary) {
          if (!updatedMeta.software) updatedMeta.software = {};
          if (server.softwareSummary.uptime) updatedMeta.software.uptime = server.softwareSummary.uptime;
          if (server.softwareSummary.installedPackages) updatedMeta.software.packages = server.softwareSummary.installedPackages;
        }

        await storage.updateDiscoveredAsset(matchedAsset.id, { metadata: updatedMeta, lastSeen: new Date(), status: "online" });

        const probeUserId = (probe as any).userId;
        if (probeUserId) {
          if (server.cpuUsage !== undefined || server.memoryUsage !== undefined || server.diskUsage !== undefined) {
            updateServiceMetricAssignmentsFromProbe(matchedAsset.id, "metrics", {
              cpuUsage: server.cpuUsage, memoryUsage: server.memoryUsage, diskUsage: server.diskUsage
            }, probeUserId).catch(() => {});
          }
          if (server.securityAudit) {
            updateServiceMetricAssignmentsFromProbe(matchedAsset.id, "securityAudit", server.securityAudit, probeUserId).catch(() => {});
          }
          if (server.softwareSummary) {
            updateServiceMetricAssignmentsFromProbe(matchedAsset.id, "softwareInventory", server.softwareSummary, probeUserId).catch(() => {});
          }
          if (server.networkInterfaces && server.networkInterfaces.length > 0) {
            updateServiceMetricAssignmentsFromProbe(matchedAsset.id, "networkInterfaces", server.networkInterfaces, probeUserId).catch(() => {});
          }
        }

        serverResults[server.hostname] = { updated: true, assetId: matchedAsset.id };
      } else {
        serverResults[server.hostname] = { updated: false, reason: "no_matching_asset" };
      }
    }

    probeUpdates.healthStatus = worstHealth;
    await storage.updateDiscoveryProbe(probe.id, probeUpdates);

    const nonce = req.headers["x-holocron-nonce"] as string;
    if (nonce) await recordProbeRequest(probe.id, nonce);

    let pendingTasks: any[] = [];
    try {
      const tasks = await storage.getPendingTasksForProbe(probe.id);
      pendingTasks = tasks.map(t => {
        let script = t.remediationScript || "";
        script = decodeScriptEntities(script.replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, ""));
        return { id: t.id, title: t.title, script, scriptType: t.scriptType };
      });
      for (const t of tasks) {
        await storage.updateRemediationTask(t.id, { status: "dispatched", dispatchedAt: new Date() });
      }
    } catch (err) {
      console.error("Failed to fetch pending tasks for batch probe:", err);
    }

    const adaptiveInterval = computeAdaptiveInterval(worstHealth, servers.length);
    const collectionSchedule = getProbeCollectionSchedule(probe);

    if (req.body.bufferStatus) {
      try {
        await storage.updateDiscoveryProbe(probe.id, { bufferStatus: req.body.bufferStatus });
      } catch {}
    }

    try {
      await storage.createProbeActivityLog({
        probeId: probe.id,
        eventType: "heartbeat",
        message: `Batch heartbeat — ${servers.length} servers reported, health: ${worstHealth}`,
        ipAddress: req.socket?.remoteAddress?.replace("::ffff:", "") || null,
        metadata: { serversProcessed: servers.length, healthStatus: worstHealth, pendingTasks: pendingTasks.length },
      });
    } catch {}

    res.json({
      success: true,
      nextHeartbeat: adaptiveInterval,
      healthStatus: worstHealth,
      serversProcessed: servers.length,
      serverResults,
      pendingTasks,
      requestSoftwareInventory: softwareRequests,
      collectionSchedule,
    });
  });

  app.get("/api/discovered-assets", requireAuth, async (req, res) => {
    const filters: { probeId?: string; agentRoleId?: string } = {};
    if (req.query.probeId) filters.probeId = req.query.probeId as string;
    if (req.query.agentRoleId) filters.agentRoleId = req.query.agentRoleId as string;
    res.json(await storage.getDiscoveredAssets(req.user!.id, filters));
  });

  app.post("/api/discovered-assets", requireAuth, async (req, res) => {
    const parsed = insertDiscoveredAssetSchema.safeParse({ ...req.body, userId: req.user!.id });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const asset = await storage.createDiscoveredAsset(parsed.data);
    res.json(asset);
  });

  interface DomainScanResult {
    domain: string;
    agentName: string;
    agentDepartment: string;
    agentRoleId: string;
    durationMs: number;
    success: boolean;
    error?: string;
    data: Record<string, any>;
  }

  const scanEventEmitter = new EventEmitter();
  scanEventEmitter.setMaxListeners(50);

  function emitScanEvent(assetId: string, event: { type: string; [key: string]: any }) {
    scanEventEmitter.emit(`scan:${assetId}`, { ...event, timestamp: Date.now() });
  }

  app.get("/api/discovered-assets/:id/scan-progress", requireAuth, (req, res) => {
    const assetId = req.params.id;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");

    const handler = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    scanEventEmitter.on(`scan:${assetId}`, handler);

    const keepAlive = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 15000);

    req.on("close", () => {
      scanEventEmitter.off(`scan:${assetId}`, handler);
      clearInterval(keepAlive);
    });
  });

  const DOMAIN_MAP: Record<string, { sections: string[]; prompt: string }> = {
    network: {
      sections: ["network"],
      prompt: `You are a Network Infrastructure specialist. Analyze the asset's network configuration, interfaces, routing, DNS, open ports, and bandwidth utilization.
RESPOND WITH JSON:
{
  "network": {
    "interfaces": [{"name": "string", "type": "string", "status": "active|standby|down", "bandwidth": "string", "utilization": "string like 23%", "vlan": "string"}],
    "dns": ["8.8.8.8"],
    "gateway": "string",
    "defaultGateway": "string",
    "activeSessions": number,
    "openPorts": "string describing open ports found"
  },
  "findings": "1-2 sentence summary of network findings"
}`
    },
    security: {
      sections: ["security", "vulnerabilities", "penTesting"],
      prompt: `You are a Cybersecurity & Threat Analysis specialist. Analyze the asset's security posture comprehensively. You MUST cross-reference the INSTALLED SOFTWARE INVENTORY to identify vulnerabilities with real CVEs relevant to EACH installed application and its specific version. Do not limit analysis to the OS — scan every notable application (browsers, runtimes, frameworks, development tools, drivers, etc.) for known CVEs. Assess hardening and perform AI-simulated penetration testing.
RESPOND WITH JSON:
{
  "security": {
    "kpis": {
      "patchCompliance": number_0_100,
      "configCompliance": number_0_100,
      "uptimeSla": number_like_99.5,
      "mttr": "string like 2.3 hours",
      "firewallRules": number,
      "lastAudit": "date string",
      "openPorts": "string",
      "failedLogins24h": number,
      "lockedAccounts": number,
      "privilegedAccounts": number
    },
    "hardening": "string description",
    "encryption": "string description",
    "accessControl": "string description",
    "antivirus": "string status",
    "sshConfig": "string",
    "tlsVersion": "string",
    "auditLog": "string status",
    "networkSegmentation": "string description"
  },
  "vulnerabilities": [
    {"severity": "Critical|High|Medium|Low", "cve": "CVE-YYYY-NNNNN", "status": "Open|Mitigated|Patched", "description": "string", "mitigation": "string recommendation"}
  ],
  "penTesting": {
    "whitebox": {"lastTest": "date string", "result": "Pass|Fail|Partial", "findings": number, "criticalFindings": number},
    "graybox": {"lastTest": "date string", "result": "Pass|Fail|Partial", "findings": number, "criticalFindings": number},
    "blackbox": {"lastTest": "date string", "result": "Pass|Fail|Partial", "findings": number, "criticalFindings": number}
  },
  "findings": "1-2 sentence summary of security findings"
}`
    },
    compliance: {
      sections: ["compliance"],
      prompt: `You are a Compliance & Governance specialist. Assess the asset against standard regulatory and industry frameworks (CIS Benchmarks, NIST 800-53, ISO 27001, PCI DSS, SOC2, HIPAA where applicable). Evaluate control coverage and gaps.
RESPOND WITH JSON:
{
  "compliance": [
    {"framework": "string like CIS Benchmarks", "status": "Compliant|Partial|Non-Compliant", "controls": "string like 45/52 controls met"}
  ],
  "findings": "1-2 sentence summary of compliance posture"
}`
    },
    systems: {
      sections: ["applications", "softwareEnrichment"],
      prompt: `You are a Systems Administration & Operations specialist. Analyze the asset's FULL installed software inventory (provided in the INSTALLED SOFTWARE INVENTORY section), running applications, services, and system health. Review EVERY installed application and classify the most important ones by criticality. Include at minimum: OS, runtimes (.NET, Java, Python, Node.js), browsers, security tools, databases, development tools, remote access tools, and any business-critical applications.
RESPOND WITH JSON:
{
  "applications": [
    {"name": "string with version", "criticality": "Critical|High|Medium|Low"}
  ],
  "softwareEnrichment": {
    "monitoring": "string",
    "containerRuntime": "string or null",
    "webServer": "string or null"
  },
  "findings": "1-2 sentence summary of system findings"
}`
    }
  };

  function mapRoleToDomain(role: any): string {
    const dept = ((role.department || "") + " " + (role.name || "") + " " + (role.title || "") + " " + (role.description || "")).toLowerCase();
    if (/network|infrastructure|noc|routing|switching|wan|lan|telecom/.test(dept)) return "network";
    if (/secur|cyber|threat|soc|pentest|vuln|risk|incident/.test(dept)) return "security";
    if (/complian|govern|grc|audit|regulat|privacy|legal/.test(dept)) return "compliance";
    if (/system|admin|ops|devops|sre|platform|server|desktop|endpoint/.test(dept)) return "systems";
    return "general";
  }

  async function runDomainScan(
    openai: any,
    domain: string,
    domainConfig: { sections: string[]; prompt: string },
    agentRole: any,
    assetContext: string,
    _aiModel: string = "gpt-4o",
    _userId: string = "",
    _providerName: string = "unknown"
  ): Promise<DomainScanResult> {
    const roleName = agentRole.name || agentRole.title || "AI Agent";
    const startTime = Date.now();
    const MAX_RETRIES = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 8000);
          console.log(`[scan] Retrying ${domain} domain (attempt ${attempt + 1}/${MAX_RETRIES}) after ${Math.round(backoffMs)}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
        const response = await callAiLogged(openai, {
          model: _aiModel,
          messages: [
            {
              role: "system",
              content: `You are "${roleName}" — an autonomous AI agent in the HOLOCRON AI platform.
Your department: ${agentRole.department || "General"}
Your division: ${agentRole.division || "General"}
Your description: ${agentRole.description || ""}
Your AI capabilities: ${Array.isArray(agentRole.aiCapabilities) ? agentRole.aiCapabilities.join(", ") : ""}

${domainConfig.prompt}

RULES:
1. Analyze the REAL asset data — the OS, patches, firewall status, network interfaces, AND full installed software list are actual probe-collected data
2. Generate REALISTIC findings relevant to the detected OS/software versions. For the security domain, cross-reference EVERY installed application against known CVEs
3. Be thorough but realistic — don't generate excessive findings for a well-patched system
4. All CVEs must be real, relevant CVEs for the detected software versions
5. When an INSTALLED SOFTWARE INVENTORY is provided, the security agent MUST scan notable applications (browsers, runtimes, drivers, frameworks, tools) for version-specific CVEs — not just the OS`
            },
            {
              role: "user",
              content: `Perform your ${domain} domain analysis on this asset NOW:\n\n${assetContext}`
            }
          ],
          temperature: 0.4,
          response_format: { type: "json_object" },
        }, { module: "asset-discovery", endpoint: "/api/discovered-assets/:id/scan-progress", userId: _userId, providerName: _providerName });

        const content = response.choices[0]?.message?.content || '';
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
          throw new Error("Empty response from AI");
        }
        return {
          domain, agentName: roleName, agentDepartment: agentRole.department || "General",
          agentRoleId: agentRole.id, durationMs: Date.now() - startTime, success: true, data: parsed,
        };
      } catch (err: any) {
        lastError = err;
        const isRetryable = err.status === 429 || err.status === 500 || err.status === 502 || err.status === 503 ||
          err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED" ||
          err.message?.includes("timeout") || err.message?.includes("rate") || err.message?.includes("overloaded");
        if (!isRetryable || attempt === MAX_RETRIES - 1) {
          console.error(`[scan] ${domain} domain failed after ${attempt + 1} attempt(s): ${err.message}`);
          break;
        }
      }
    }
    return {
      domain, agentName: roleName, agentDepartment: agentRole.department || "General",
      agentRoleId: agentRole.id, durationMs: Date.now() - startTime, success: false,
      error: lastError?.message || "Unknown error", data: {},
    };
  }

  async function runAgentScan(assetId: string, userId: string): Promise<any> {
    const asset = await storage.getDiscoveredAsset(assetId, userId);
    if (!asset) throw new Error("Asset not found");
    if (!asset.assignedAgentRoleId) throw new Error("No AI agent assigned to this asset");

    const roles = await storage.getOrgRoles(userId);
    const orchestratorRole = roles.find(r => r.id === asset.assignedAgentRoleId);
    if (!orchestratorRole) throw new Error("Assigned orchestrator agent role not found");

    const meta = (asset.metadata || {}) as Record<string, any>;
    meta.agentScanStatus = "scanning";
    meta.lastAgentScanStarted = new Date().toISOString();
    meta.orchestrationMode = "multi-agent";
    await storage.updateDiscoveredAsset(assetId, { metadata: meta });

    emitScanEvent(assetId, {
      type: "scan_started",
      orchestrator: { name: orchestratorRole.name || orchestratorRole.title, department: orchestratorRole.department, roleId: orchestratorRole.id },
      assetName: asset.name,
      assetType: asset.type,
    });

    const { client: openai, model: _aiModel, providerName: _scanProviderName } = await getAiClient(userId);

    const hw = meta.hardware || {};
    const sw = meta.software || {};
    const net = meta.network || {};
    const sec = meta.security || {};

    const assetContext = `
ASSET DETAILS:
- Name: ${asset.name}
- Type: ${asset.type}
- IP Address: ${asset.ipAddress || "Unknown"}
- MAC Address: ${asset.macAddress || "Unknown"}
- Vendor: ${asset.vendor || "Unknown"}
- Model: ${asset.model || "Unknown"}
- Firmware/OS: ${asset.firmware || "Unknown"}
- Status: ${asset.status}

HARDWARE (probe-collected):
- CPU: ${hw.cpu || "Unknown"}
- RAM: ${hw.ram || "Unknown"}
- Storage: ${hw.storage || "Unknown"}
- Form Factor: ${hw.formFactor || "Unknown"}

SOFTWARE (probe-collected):
- OS: ${sw.os || "Unknown"}
- Version: ${sw.version || "Unknown"}
- Build: ${sw.buildNumber || sw.build || "Unknown"}
- Uptime: ${sw.uptime || "Unknown"}
- Last Patched: ${sw.lastPatched || "Unknown"}
- Auto Updates: ${sw.autoUpdates || "Unknown"}
- Installed Packages: ${sw.packages || "Unknown"}
- PowerShell: ${sw.powershellVersion || "N/A"}
- .NET: ${sw.dotNetVersion || "N/A"}

NETWORK (probe-collected):
- Interfaces: ${JSON.stringify(net.interfaces || [])}
- Gateway: ${net.gateway || net.defaultGateway || "Unknown"}
- DNS: ${JSON.stringify(net.dns || [])}

SECURITY (probe-collected):
- Patch Compliance: ${sec.kpis?.patchCompliance || "Unknown"}%
- Config Compliance: ${sec.kpis?.configCompliance || "Unknown"}%
- Firewall Rules: ${sec.kpis?.firewallRules || "Unknown"}
- Hardening: ${sec.hardening || "Unknown"}
- Antivirus: ${sec.antivirus || "Unknown"}
- Encryption: ${sec.encryption || "Unknown"}

INSTALLED SOFTWARE INVENTORY (probe-collected):
${(() => {
  const installed = Array.isArray(meta.installedApps) ? meta.installedApps : [];
  if (installed.length === 0) return "- No detailed software inventory available (only package count: " + (sw.packages || 0) + ")";
  return installed.map((a: any) => `- ${a.name}${a.version ? " v" + a.version : ""}${a.publisher ? " (" + a.publisher + ")" : ""}`).join("\n");
})()}`;

    const subs = await storage.getRoleSubscriptionsByUser(userId);
    const aiSubs = subs.filter(s => s.hasAiShadow && s.status === "active");

    const domainAgents: Map<string, any> = new Map();
    for (const sub of aiSubs) {
      const role = roles.find(r => r.id === sub.roleId);
      if (!role) continue;
      const domain = mapRoleToDomain(role);
      if (domain === "general") continue;
      if (!domainAgents.has(domain)) {
        domainAgents.set(domain, role);
      }
    }

    const orchestratorDomain = mapRoleToDomain(orchestratorRole);
    if (orchestratorDomain !== "general" && !domainAgents.has(orchestratorDomain)) {
      domainAgents.set(orchestratorDomain, orchestratorRole);
    }

    const unassignedDomains = Object.keys(DOMAIN_MAP).filter(d => !domainAgents.has(d));
    for (const d of unassignedDomains) {
      domainAgents.set(d, orchestratorRole);
    }

    const domainAssignments = Array.from(domainAgents.entries()).map(([domain, role]) => ({
      domain,
      agentName: role.name || role.title || "AI Agent",
      agentDepartment: role.department || "General",
      agentRoleId: role.id,
      isOrchestrator: role.id === orchestratorRole.id,
    }));

    emitScanEvent(assetId, {
      type: "agents_assigned",
      domains: domainAssignments,
    });

    const domainEntries = Array.from(domainAgents.entries()).filter(([domain]) => !!DOMAIN_MAP[domain]);
    const scanPromises = domainEntries.map(([domain, role], idx) => {
      const config = DOMAIN_MAP[domain];
      const staggerDelay = idx * 800;
      return new Promise<DomainScanResult>(resolve => {
        setTimeout(async () => {
          emitScanEvent(assetId, {
            type: "domain_started",
            domain,
            agentName: role.name || role.title || "AI Agent",
            agentDepartment: role.department || "General",
            agentRoleId: role.id,
          });
          const result = await runDomainScan(openai, domain, config, role, assetContext, _aiModel, userId, _scanProviderName);
          emitScanEvent(assetId, {
            type: result.success ? "domain_completed" : "domain_failed",
            domain: result.domain,
            agentName: result.agentName,
            durationMs: result.durationMs,
            success: result.success,
            error: result.error,
          });
          resolve(result);
        }, staggerDelay);
      });
    });

    const results = await Promise.allSettled(scanPromises);
    const domainResults: DomainScanResult[] = results
      .filter((r): r is PromiseFulfilledResult<DomainScanResult> => r.status === "fulfilled")
      .map(r => r.value);

    const successfulDomains = domainResults.filter(r => r.success);
    const failedDomains = domainResults.filter(r => !r.success);

    if (successfulDomains.length === 0) {
      const failMeta = { ...meta, agentScanStatus: "failed", agentScanError: "All domain agents failed", lastAgentScan: new Date().toISOString() };
      await storage.updateDiscoveredAsset(assetId, { metadata: failMeta });
      throw new Error("All domain agent scans failed");
    }

    const freshAsset = await storage.getDiscoveredAsset(assetId, userId);
    const updatedMeta = { ...((freshAsset?.metadata || meta) as Record<string, any>) };

    const existingPatchedVulns = new Map<string, any>();
    if (Array.isArray(updatedMeta.vulnerabilities)) {
      for (const v of updatedMeta.vulnerabilities) {
        if (v.status === "Patched") {
          const key = (v.cve || v.description || "").toLowerCase();
          if (key) existingPatchedVulns.set(key, v);
        }
      }
    }

    for (const result of successfulDomains) {
      const data = result.data;
      if (data.network) {
        updatedMeta.network = {
          ...(updatedMeta.network || {}),
          ...data.network,
          interfaces: data.network.interfaces || updatedMeta.network?.interfaces || [],
        };
      }
      if (data.security) {
        updatedMeta.security = {
          ...(updatedMeta.security || {}),
          ...data.security,
          kpis: { ...(updatedMeta.security?.kpis || {}), ...(data.security.kpis || {}) },
        };
      }
      if (Array.isArray(data.vulnerabilities)) {
        updatedMeta.vulnerabilities = data.vulnerabilities.map((v: any) => {
          const key = (v.cve || v.description || "").toLowerCase();
          const patched = key ? existingPatchedVulns.get(key) : null;
          if (patched) {
            return { ...v, status: "Patched", patchedDate: patched.patchedDate, remediation: patched.remediation };
          }
          return v;
        });
      }
      if (data.penTesting) {
        const scanDate = new Date().toISOString().split("T")[0];
        const fixPenTestDate = (pt: any) => {
          if (!pt) return pt;
          const hasRealResults = pt.result && pt.result !== "Pending" && pt.result !== "Not tested";
          const badDate = !pt.lastTest || pt.lastTest === "Unknown" || pt.lastTest === "date string" || pt.lastTest === "Not tested";
          return { ...pt, lastTest: (hasRealResults && badDate) ? scanDate : (pt.lastTest || scanDate) };
        };
        updatedMeta.penTesting = {
          whitebox: fixPenTestDate(data.penTesting.whitebox),
          graybox: fixPenTestDate(data.penTesting.graybox),
          blackbox: fixPenTestDate(data.penTesting.blackbox),
        };
      }
      if (Array.isArray(data.applications)) {
        updatedMeta.applications = data.applications;
      }
      if (Array.isArray(data.compliance)) {
        updatedMeta.compliance = data.compliance;
      }
      if (data.softwareEnrichment) {
        updatedMeta.software = { ...(updatedMeta.software || {}), ...data.softwareEnrichment };
      }
    }

    const orchestratorName = orchestratorRole.name || orchestratorRole.title || "AI Orchestrator";
    const agentContributions = domainResults.map(r => ({
      domain: r.domain,
      agent: r.agentName,
      department: r.agentDepartment,
      roleId: r.agentRoleId,
      durationMs: r.durationMs,
      success: r.success,
      error: r.error,
    }));
    const domainFindings = successfulDomains
      .map(r => r.data.findings)
      .filter(Boolean)
      .join(" ");
    const coveragePercent = Math.round((successfulDomains.length / Object.keys(DOMAIN_MAP).length) * 100);

    emitScanEvent(assetId, {
      type: "synthesis_started",
      orchestrator: orchestratorName,
      successCount: successfulDomains.length,
      failCount: failedDomains.length,
      totalDomains: Object.keys(DOMAIN_MAP).length,
    });

    let orchestratorSummary: Record<string, any> = {};
    try {
      const summaryResponse = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are "${orchestratorName}" — the orchestrating AI agent. Multiple specialist agents have analyzed this asset. Synthesize their findings into a unified risk assessment.
RESPOND WITH JSON:
{
  "scanSummary": "2-3 sentence summary of overall risk posture based on all agent findings",
  "riskScore": number_0_100_higher_is_riskier,
  "recommendedActions": ["string action 1", "string action 2", "string action 3", "string action 4", "string action 5"]
}
Risk scoring: 0-30=Low, 31-60=Medium, 61-80=High, 81-100=Critical. Weight critical CVEs and compliance gaps heavily.`
          },
          {
            role: "user",
            content: `Synthesize the following multi-agent scan results for ${asset.name} (${asset.type}, ${asset.firmware || "Unknown OS"}):\n\nDomain findings: ${domainFindings}\n\nVulnerabilities found: ${(updatedMeta.vulnerabilities || []).length} (${(updatedMeta.vulnerabilities || []).filter((v: any) => v.severity === "Critical").length} critical)\nCompliance frameworks assessed: ${(updatedMeta.compliance || []).length}\nSecurity KPIs: Patch ${updatedMeta.security?.kpis?.patchCompliance || "?"}%, Config ${updatedMeta.security?.kpis?.configCompliance || "?"}%\nPen test results: Whitebox=${updatedMeta.penTesting?.whitebox?.result || "N/A"}, Graybox=${updatedMeta.penTesting?.graybox?.result || "N/A"}, Blackbox=${updatedMeta.penTesting?.blackbox?.result || "N/A"}\nApplications: ${(updatedMeta.applications || []).length}\n\nFailed domains: ${failedDomains.map(r => r.domain).join(", ") || "None"}`
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }, { module: "asset-discovery", endpoint: "/api/discovered-assets/:id/scan-progress", userId, providerName: _scanProviderName });
      const summaryContent = summaryResponse.choices[0]?.message?.content || '';
      orchestratorSummary = JSON.parse(summaryContent);
    } catch {
      orchestratorSummary = {
        scanSummary: `Multi-agent scan completed with ${successfulDomains.length}/${Object.keys(DOMAIN_MAP).length} domains analyzed successfully.`,
        riskScore: 50,
        recommendedActions: ["Review scan results in each domain tab"],
      };
    }

    const expectedDomains = Object.keys(DOMAIN_MAP).length;
    updatedMeta.agentScanStatus = successfulDomains.length === expectedDomains ? "completed" : "partial";
    updatedMeta.lastAgentScan = new Date().toISOString();
    updatedMeta.scanSummary = orchestratorSummary.scanSummary || "Multi-agent scan completed";
    const rawRisk = Number(orchestratorSummary.riskScore);
    updatedMeta.riskScore = Number.isFinite(rawRisk) ? Math.max(0, Math.min(100, rawRisk)) : 50;
    const newActions: string[] = orchestratorSummary.recommendedActions || [];
    const completedTasks = await storage.getRemediationTasks(assetId, userId);
    const completedTitles = completedTasks.filter(t => t.status === "completed").map(t => (t.title || "").toLowerCase());
    updatedMeta.recommendedActions = newActions.filter((a: string) => {
      const aLower = a.toLowerCase();
      return !completedTitles.some(ct => {
        if (ct === aLower) return true;
        const words = ct.split(/\s+/).filter((w: string) => w.length > 3);
        const matchCount = words.filter((w: string) => aLower.includes(w)).length;
        return words.length > 0 && matchCount / words.length >= 0.5;
      });
    });
    updatedMeta.scanAgent = { roleId: orchestratorRole.id, roleName: orchestratorName, department: orchestratorRole.department };
    updatedMeta.orchestrationMode = "multi-agent";
    updatedMeta.agentContributions = agentContributions;
    updatedMeta.scanCoverage = coveragePercent;

    await storage.updateDiscoveredAsset(assetId, { metadata: updatedMeta });

    emitScanEvent(assetId, {
      type: "scan_completed",
      status: updatedMeta.agentScanStatus,
      riskScore: updatedMeta.riskScore,
      scanSummary: updatedMeta.scanSummary,
      coverage: coveragePercent,
      recommendedActions: updatedMeta.recommendedActions,
      agentContributions,
    });

    try {
      await storage.createAgentNotification({
        agentRoleId: orchestratorRole.id,
        assetId: assetId,
        type: "action_taken",
        severity: (orchestratorSummary.riskScore || 50) > 60 ? "high" : (orchestratorSummary.riskScore || 50) > 30 ? "medium" : "low",
        title: `Multi-Agent Scan Complete: ${asset.name}`,
        description: `${orchestratorName} orchestrated ${successfulDomains.length} specialist agents to analyze ${asset.name}.\n\nAgents: ${agentContributions.map(a => `${a.agent} (${a.domain})`).join(", ")}\nCoverage: ${coveragePercent}%\n\nSummary: ${orchestratorSummary.scanSummary || "Analysis complete"}\nRisk Score: ${orchestratorSummary.riskScore || 0}/100\nVulnerabilities Found: ${(updatedMeta.vulnerabilities || []).length}\nCompliance Frameworks: ${(updatedMeta.compliance || []).length}\n\nRecommended Actions:\n${(orchestratorSummary.recommendedActions || []).map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}`,
        proposedAction: (orchestratorSummary.recommendedActions || []).join('; ') || 'No immediate actions required',
        actionStatus: "auto_executed",
        userId,
      });
    } catch (e) {
      console.error("Failed to create agent notification for multi-agent scan:", e);
    }

    return { success: true, assetId, orchestrator: orchestratorName, coverage: coveragePercent, agentContributions, summary: orchestratorSummary };
  }

  app.post("/api/discovered-assets/:id/agent-scan", requireAuth, async (req, res) => {
    try {
      const scanCdKey = `agent_scan:${req.user!.id}:${req.params.id}`;
      const scanCooldown = isAiOnCooldown(scanCdKey, 10 * 60 * 1000);
      if (scanCooldown.blocked) {
        return res.status(429).json({ error: `This asset was scanned recently. Try again in ${scanCooldown.remainingSec}s.` });
      }
      setAiCooldown(scanCdKey);

      if (activeScanCount >= MAX_CONCURRENT_SCANS) {
        const queued = enqueueAgentScan(req.params.id, req.user!.id);
        if (!queued) {
          return res.status(429).json({ error: "Scan queue full. Please try again later.", queueSize: scanQueue.length });
        }
        res.json({ queued: true, queuePosition: queued.queuePosition, message: `Scan queued at position ${queued.queuePosition}` });
        queued.promise.catch(() => {});
        return;
      }
      activeScanCount++;
      let result;
      try {
        result = await runAgentScan(req.params.id, req.user!.id);
      } finally {
        activeScanCount--;
        processNextScan();
      }
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes("not found") || err.message?.includes("No AI agent")) {
        return res.status(400).json({ error: err.message });
      }
      console.error("Agent scan error:", err.message, err.status || "", err.code || "");
      try {
        const asset = await storage.getDiscoveredAsset(req.params.id, req.user!.id);
        if (asset) {
          const meta = (asset.metadata || {}) as Record<string, any>;
          meta.agentScanStatus = "failed";
          meta.agentScanError = err.message || "Unknown error";
          meta.lastAgentScan = new Date().toISOString();
          await storage.updateDiscoveredAsset(req.params.id, { metadata: meta });
        }
      } catch {}
      res.status(500).json({ error: "Agent scan failed", details: err.message });
    }
  });

  app.get("/api/remediation-tasks", requireAuth, async (req, res) => {
    const assetId = req.query.assetId as string;
    const batchId = req.query.batchId as string;
    if (batchId) {
      const tasks = await storage.getRemediationTasksByBatch(batchId, req.user!.id);
      return res.json(tasks);
    }
    if (!assetId) return res.status(400).json({ error: "assetId or batchId query parameter required" });
    const tasks = await storage.getRemediationTasks(assetId, req.user!.id);
    res.json(tasks);
  });

  // ── Terminal: create single task + poll by id ─────────────────────────────
  app.post("/api/remediation-tasks", requireAuth, async (req, res) => {
    try {
      const { assetId, probeId, title, script, scriptType, riskLevel } = req.body;
      if (!assetId || !probeId || !script) {
        return res.status(400).json({ error: "assetId, probeId, and script are required" });
      }
      const task = await storage.createRemediationTask({
        userId: req.user!.id,
        assetId,
        probeId,
        title: title || `[TERMINAL] ${String(script).slice(0, 60)}`,
        description: "Dispatched from Asset Terminal",
        remediationScript: script,
        rollbackScript: null,
        scriptType: scriptType || "bash",
        status: "queued",
        batchId: null,
        category: "terminal",
        riskLevel: riskLevel || "low",
        originType: "human",
        changeRef: null,
      });
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/remediation-tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getRemediationTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.userId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Command Scope — domain → asset type mapping ───────────────────────────
  const SCOPE_DOMAIN_ASSET_TYPES: Record<string, string[]> = {
    network:   ["switch", "router", "firewall", "load_balancer", "vpn", "access_point", "network_device"],
    compute:   ["server", "workstation", "hypervisor", "vm"],
    endpoint:  ["endpoint", "laptop", "desktop", "mobile", "phone"],
    database:  ["database", "db_server"],
    security:  ["ids", "ips", "siem", "hsm"],
    cloud:     ["cloud", "cloud_instance", "cloud_storage", "cloud_function"],
    storage:   ["storage", "nas", "san"],
    iot:       ["iot_sensor", "iot_device", "iot"],
  };
  function getAllowedAssetTypes(scopes: string[] | null | undefined): string[] | null {
    if (!scopes || scopes.length === 0) return null; // unrestricted
    const types = new Set<string>();
    for (const scope of scopes) { for (const t of (SCOPE_DOMAIN_ASSET_TYPES[scope] || [])) types.add(t); }
    return [...types];
  }
  function isAssetInScope(assetType: string, allowedTypes: string[] | null): boolean {
    if (!allowedTypes) return true;
    return allowedTypes.includes(assetType);
  }

  // Scope management endpoints
  app.get("/api/command-scopes/users", requireAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers.map(u => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, commandScopes: u.commandScopes || [] })));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.get("/api/users/me/command-scopes", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      res.json({ scopes: user?.commandScopes || [] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });
  app.patch("/api/users/:id/command-scopes", requireAuth, async (req, res) => {
    try {
      const { scopes } = req.body;
      if (!Array.isArray(scopes)) return res.status(400).json({ error: "scopes must be an array" });
      const validDomains = Object.keys(SCOPE_DOMAIN_ASSET_TYPES);
      const invalid = scopes.filter(s => s !== "all" && !validDomains.includes(s));
      if (invalid.length > 0) return res.status(400).json({ error: `Unknown domains: ${invalid.join(", ")}` });
      const normalizedScopes = scopes.includes("all") ? [] : scopes;
      const updated = await storage.updateUserCommandScopes(req.params.id, normalizedScopes);
      if (!updated) return res.status(404).json({ error: "User not found" });
      res.json({ id: updated.id, commandScopes: updated.commandScopes || [] });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Command Control Center — batch command dispatch
  app.post("/api/command-batches", requireAuth, async (req, res) => {
    try {
      const { batchId, title, script, scriptType, assetIds, category, riskLevel, originType, changeRef, rollbackScript, requireApproval } = req.body;
      if (!batchId || !script || !Array.isArray(assetIds) || assetIds.length === 0)
        return res.status(400).json({ error: "batchId, script, and assetIds[] are required" });

      // 4-Eyes gate: high/critical risk commands go to pending_approval unless bypassed
      const needsApproval = requireApproval !== false && (riskLevel === "critical" || riskLevel === "high");

      // Enforce command scope: filter out assets not in the user's allowed domains
      const user = await storage.getUser(req.user!.id);
      const allowedTypes = getAllowedAssetTypes(user?.commandScopes);
      const blocked: string[] = [];

      const created: any[] = [];
      const pendingApprovals: any[] = [];
      for (const assetId of assetIds) {
        const asset = await storage.getDiscoveredAsset(assetId, req.user!.id);
        if (!asset || !asset.probeId) continue;
        if (!isAssetInScope(asset.type, allowedTypes)) { blocked.push(assetId); continue; }
        const taskTitle = title || `CMD: ${script.split('\n')[0].substring(0, 60)}`;
        if (needsApproval) {
          // Create task in pending_approval status — probe won't pick it up until approved
          const task = await storage.createRemediationTask({
            userId: req.user!.id,
            assetId,
            probeId: asset.probeId,
            title: taskTitle,
            description: `Dispatched from CCC — awaiting 4-eyes approval${changeRef ? ` [CHG: ${changeRef}]` : ""}`,
            remediationScript: script,
            rollbackScript: rollbackScript || null,
            scriptType: scriptType || 'bash',
            status: 'pending_approval',
            batchId,
            category: category || 'general',
            riskLevel: riskLevel || 'high',
            originType: originType || 'human',
            changeRef: changeRef || null,
          } as any);
          // Create approval record
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
          const approval = await storage.createCommandApproval({
            taskId: task.id,
            batchId,
            title: taskTitle,
            script,
            scriptType: scriptType || 'bash',
            assetId,
            assetName: asset.hostname || asset.ipAddress || assetId,
            riskLevel: riskLevel || 'high',
            changeRef: changeRef || null,
            requestedById: req.user!.id,
            requestedByName: user?.displayName || user?.username || req.user!.id,
            status: 'pending',
            notes: null,
            expiresAt,
          });
          created.push(task);
          pendingApprovals.push(approval);
        } else {
          const task = await storage.createRemediationTask({
            userId: req.user!.id,
            assetId,
            probeId: asset.probeId,
            title: taskTitle,
            description: `Dispatched from Command Control Center${changeRef ? ` [CHG: ${changeRef}]` : ""}`,
            remediationScript: script,
            rollbackScript: rollbackScript || null,
            scriptType: scriptType || 'bash',
            status: 'queued',
            batchId,
            category: category || 'general',
            riskLevel: riskLevel || 'low',
            originType: originType || 'human',
            changeRef: changeRef || null,
          } as any);
          // Auto-approve so probe picks it up immediately on next heartbeat
          await storage.updateRemediationTask(task.id, { approvedAt: new Date() });
          created.push(task);
        }
      }
      if (created.length === 0 && blocked.length > 0)
        return res.status(403).json({ error: "All selected assets are outside your command scope. No commands dispatched.", blocked });
      res.json({ batchId, dispatched: created.length, blocked: blocked.length, blockedIds: blocked, tasks: created, pendingApprovals: pendingApprovals.length, requiresApproval: needsApproval && pendingApprovals.length > 0 });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Command Catalog ───────────────────────────────────────────────────────
  app.get("/api/command-catalog", requireAuth, async (req, res) => {
    try {
      const { status, category } = req.query as Record<string, string>;
      const entries = await storage.getCommandCatalog(req.user!.id, { status, category });
      res.json(entries);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/command-catalog", requireAuth, async (req, res) => {
    try {
      const { name, description, category, scriptType, script, riskLevel, authorType, authorName, compatibleOs, tags, changeRef, rollbackScript } = req.body;
      if (!name || !script) return res.status(400).json({ error: "name and script are required" });
      const entry = await storage.createCommandCatalogEntry({
        userId: req.user!.id, name, description: description || null,
        category: category || "general", scriptType: scriptType || "bash",
        script, riskLevel: riskLevel || "low",
        authorType: authorType || "human", authorName: authorName || null,
        compatibleOs: compatibleOs || [], tags: tags || [],
        status: "draft", changeRef: changeRef || null,
        rollbackScript: rollbackScript || null,
        dryRunAssetId: null, dryRunBatchId: null, dryRunResult: null, dryRunError: null,
        version: 1,
      });
      res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/command-catalog/:id", requireAuth, async (req, res) => {
    try {
      const entry = await storage.updateCommandCatalogEntry(req.params.id, req.user!.id, req.body);
      if (!entry) return res.status(404).json({ error: "Not found" });
      res.json(entry);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/command-catalog/:id", requireAuth, async (req, res) => {
    try {
      const ok = await storage.deleteCommandCatalogEntry(req.params.id, req.user!.id);
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Dry-run: dispatch the catalog command to a single asset and link result to the catalog entry
  app.post("/api/command-catalog/:id/dry-run", requireAuth, async (req, res) => {
    try {
      const entry = await storage.getCommandCatalogEntry(req.params.id, req.user!.id);
      if (!entry) return res.status(404).json({ error: "Not found" });
      const { assetId } = req.body;
      if (!assetId) return res.status(400).json({ error: "assetId is required" });
      const asset = await storage.getDiscoveredAsset(assetId, req.user!.id);
      if (!asset || !asset.probeId) return res.status(400).json({ error: "Asset not found or no probe" });
      // Enforce command scope for dry-run
      const dryRunUser = await storage.getUser(req.user!.id);
      const dryRunAllowed = getAllowedAssetTypes(dryRunUser?.commandScopes);
      if (!isAssetInScope(asset.type, dryRunAllowed))
        return res.status(403).json({ error: `Asset "${asset.name}" (type: ${asset.type}) is outside your command scope.` });
      const batchId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36);
      const task = await storage.createRemediationTask({
        userId: req.user!.id, assetId, probeId: asset.probeId,
        title: `[DRY RUN] ${entry.name}`,
        description: `Dry run from Command Catalog — entry ${entry.id}`,
        remediationScript: entry.script, rollbackScript: null,
        scriptType: entry.scriptType, status: "queued",
        batchId, category: entry.category,
        riskLevel: entry.riskLevel, originType: entry.authorType as any,
        changeRef: entry.changeRef || null,
      } as any);
      await storage.updateRemediationTask(task.id, { approvedAt: new Date() });
      await storage.updateCommandCatalogEntry(entry.id, req.user!.id, {
        status: "dry_run_pending", dryRunAssetId: assetId, dryRunBatchId: batchId,
        dryRunResult: null, dryRunError: null, dryRunAt: null,
      });
      res.json({ batchId, taskId: task.id });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Poll dry-run result and update catalog entry status
  app.post("/api/command-catalog/:id/dry-run/finalize", requireAuth, async (req, res) => {
    try {
      const entry = await storage.getCommandCatalogEntry(req.params.id, req.user!.id);
      if (!entry || !entry.dryRunBatchId) return res.status(400).json({ error: "No dry run in progress" });
      const tasks = await storage.getRemediationTasksByBatch(entry.dryRunBatchId);
      const task = tasks[0];
      if (!task) return res.json({ status: "pending" });
      const done = ["completed", "failed", "timed-out"].includes(task.status);
      if (!done) return res.json({ status: "running", taskStatus: task.status });
      const passed = task.status === "completed";
      await storage.updateCommandCatalogEntry(entry.id, req.user!.id, {
        status: passed ? "dry_run_passed" : "dry_run_failed",
        dryRunResult: task.result || null,
        dryRunError: task.error || null,
        dryRunAt: new Date(),
      });
      res.json({ status: passed ? "passed" : "failed", result: task.result, error: task.error });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Publish: promote a dry_run_passed entry to published
  app.post("/api/command-catalog/:id/publish", requireAuth, async (req, res) => {
    try {
      const entry = await storage.getCommandCatalogEntry(req.params.id, req.user!.id);
      if (!entry) return res.status(404).json({ error: "Not found" });
      if (!["dry_run_passed", "draft"].includes(entry.status))
        return res.status(400).json({ error: "Only draft or dry_run_passed entries can be published" });
      const updated = await storage.updateCommandCatalogEntry(entry.id, req.user!.id, {
        status: "published", publishedAt: new Date(),
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Load into composer — increment usage count and return the entry
  app.post("/api/command-catalog/:id/use", requireAuth, async (req, res) => {
    try {
      const entry = await storage.getCommandCatalogEntry(req.params.id, req.user!.id);
      if (!entry) return res.status(404).json({ error: "Not found" });
      await storage.incrementCatalogUsage(entry.id);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // AI Agent endpoint — create a catalog entry authored by an AI agent
  // ── AI Task Debugger (Agentic Fix Loop) ────────────────────────────────────
  app.post("/api/remediation-tasks/:taskId/ai-debug", requireAuth, async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.getRemediationTask(taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.userId !== req.user!.id) return res.status(403).json({ error: "Forbidden" });
      if (!task.error && !task.result) return res.status(400).json({ error: "No output to debug" });

      const outputToAnalyze = task.error || task.result || "";
      const originalScript = (task as any).remediationScript || "";
      if (!originalScript) return res.status(400).json({ error: "No original script found" });

      // ── KB cache ────────────────────────────────────────────────────────
      const { createHash } = await import("node:crypto");
      const cacheKey = `${originalScript.trim()}::${outputToAnalyze.substring(0, 500)}`;
      const fingerprint = createHash("sha256").update(cacheKey).digest("hex").substring(0, 16);
      const cacheTag = `cmd-debug-${fingerprint}`;
      const CACHE_TTL_MS = 60 * 60 * 1000; // 1h for debug results (errors may recur)

      const { db } = await import("./db");
      const { knowledgeArticles } = await import("../shared/schema");
      const { sql: drizzleSql } = await import("drizzle-orm");
      const cachedRows = await db.select().from(knowledgeArticles)
        .where(drizzleSql`${knowledgeArticles.category} = 'command-debug-cache' AND ${cacheTag} = ANY(${knowledgeArticles.tags})`)
        .limit(1);

      if (cachedRows.length > 0) {
        const aged = Date.now() - new Date(cachedRows[0].updatedAt!).getTime();
        if (aged < CACHE_TTL_MS) {
          const debug = JSON.parse(cachedRows[0].content);
          return res.json({ ...debug, cacheHit: true, tokensUsed: 0 });
        }
      }

      // ── Get asset context ────────────────────────────────────────────────
      const asset = task.assetId ? await storage.getDiscoveredAsset(task.assetId, req.user!.id) : null;
      const assetCtx = asset ? `Asset: ${asset.name} (${asset.type})${(asset as any).vendor ? `, ${(asset as any).vendor}` : ""}` : "Asset: unknown";
      const osCtx = (asset as any)?.metadata?.software?.os || "unknown";

      // ── Call AI ─────────────────────────────────────────────────────────
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!apiKey) return res.status(503).json({ error: "AI debug unavailable — no API key configured" });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

      const scriptType = (task as any).scriptType || "bash";

      const systemPrompt = `You are an expert IT automation engineer and SRE. A command script was executed on an enterprise asset and returned an error or unexpected output. Analyze the failure, identify the root cause, and produce a corrected version of the script.

Rules:
- The fixed script must be in the same language as the original (${scriptType})
- Preserve the original intent — only fix the broken parts
- If the error is a permissions issue, suggest using sudo or an elevated context
- If the error is a missing command/package, add the installation step
- If the error is a syntax error, fix the syntax
- If the output looks correct but the script returned non-zero exit code, explain why
- Do NOT add hardcoded credentials
- Keep the fix minimal — don't rewrite the whole script unnecessarily

Respond ONLY with valid JSON:
{
  "rootCause": "one sentence: what exactly caused the failure",
  "fixedScript": "the corrected full script",
  "changes": ["change 1 description", "change 2 description"],
  "explanation": "2-3 sentences: what was wrong and what was fixed and why",
  "confidence": "high|medium|low",
  "requiresElevation": true or false,
  "canAutoRetry": true or false
}`;

      const userPrompt = `Original script (${scriptType}):
\`\`\`
${originalScript}
\`\`\`

Error / output from the probe:
\`\`\`
${outputToAnalyze.substring(0, 3000)}
\`\`\`

Context:
- ${assetCtx}
- OS: ${osCtx}
- Script type: ${scriptType}

Analyze the failure and provide a fix.`;

      const completion = await callAiLogged(openai, {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.1,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }, { module: "remediation", endpoint: "/api/remediation-tasks/:taskId/ai-debug", userId: req.user!.id, providerName });

      const rawContent = completion.choices[0]?.message?.content || "{}";
      let debugResult: any;
      try { debugResult = JSON.parse(rawContent); } catch { return res.status(500).json({ error: "AI returned invalid JSON" }); }
      if (!debugResult.fixedScript) return res.status(500).json({ error: "AI could not produce a fix" });

      // ── Cache in KB ─────────────────────────────────────────────────────
      const kbPayload = {
        title: `Debug Fix [${fingerprint}]: ${(debugResult.rootCause || "").substring(0, 80)}`,
        content: JSON.stringify(debugResult),
        category: "command-debug-cache",
        tags: [cacheTag, `scripttype-${scriptType}`, "ai-debug-cache"],
        status: "internal",
        authorId: req.user!.id,
      };
      if (cachedRows[0]) {
        await db.update(knowledgeArticles).set({ content: JSON.stringify(debugResult), updatedAt: new Date() } as any).where(drizzleSql`${knowledgeArticles.id} = ${cachedRows[0].id}`);
      } else {
        await storage.createKnowledgeArticle(kbPayload as any);
      }

      const tokens = completion.usage?.total_tokens ?? 0;
      res.json({ ...debugResult, cacheHit: false, tokensUsed: tokens });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── AI NLP Command Composer ────────────────────────────────────────────────
  app.post("/api/command-catalog/ai-compose", requireAuth, async (req, res) => {
    try {
      const { intent, scriptType, assetType, os, protocol, vendor, model, selectedAssets } = req.body;
      if (!intent?.trim()) return res.status(400).json({ error: "intent is required" });

      // ── 1. KB cache lookup ──────────────────────────────────────────────
      const { createHash } = await import("node:crypto");
      const cacheKey = `${intent.trim().toLowerCase()}::${scriptType}::${assetType}::${os}`;
      const fingerprint = createHash("sha256").update(cacheKey).digest("hex").substring(0, 16);
      const cacheTag = `cmd-compose-${fingerprint}`;
      const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h (shorter than review — intent is more dynamic)

      const { db } = await import("./db");
      const { knowledgeArticles } = await import("../shared/schema");
      const { sql: drizzleSql } = await import("drizzle-orm");
      const cachedRows = await db.select().from(knowledgeArticles)
        .where(drizzleSql`${knowledgeArticles.category} = 'command-compose-cache' AND ${cacheTag} = ANY(${knowledgeArticles.tags})`)
        .limit(1);

      if (cachedRows.length > 0) {
        const aged = Date.now() - new Date(cachedRows[0].updatedAt!).getTime();
        if (aged < CACHE_TTL_MS) {
          const composed = JSON.parse(cachedRows[0].content);
          return res.json({ ...composed, cacheHit: true, tokensUsed: 0 });
        }
      }

      // ── 2. Build contextual prompt ──────────────────────────────────────
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!apiKey) return res.status(503).json({ error: "AI compose unavailable — no API key configured" });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

      // Build protocol/access context
      const protocolContext = protocol ? `\n- Access protocol: ${protocol}` : "";
      const vendorContext = vendor ? `\n- Vendor/Model: ${vendor}${model ? ` ${model}` : ""}` : "";
      const assetContext = Array.isArray(selectedAssets) && selectedAssets.length > 0
        ? `\nTargeted assets (${selectedAssets.length}):\n${selectedAssets.slice(0, 5).map((a: any) => `  - ${a.name} (${a.type}, ${a.os || "OS unknown"}${a.ipAddress ? `, ${a.ipAddress}` : ""})`).join("\n")}`
        : "";

      const systemPrompt = `You are an elite IT automation engineer building production-grade scripts for an enterprise IT orchestration platform.
Generate a ${scriptType} script that accomplishes exactly what the operator has requested.

Rules:
- The script MUST work for the specified OS and asset type
- Include inline comments explaining each step
- Handle errors and edge cases gracefully
- Do NOT hardcode credentials, IPs, or passwords — use variables or parameters
- Make it idempotent where possible
- For network devices (switches/routers/firewalls): use appropriate CLI syntax for the vendor
- Keep it concise but complete

Respond ONLY with valid JSON:
{
  "script": "the full script content",
  "title": "short action-oriented title (max 60 chars)",
  "description": "one sentence describing what this script does",
  "category": "network|database|security|compliance|application|endpoint|cloud|monitoring",
  "riskLevel": "low|medium|high",
  "compatibleOs": ["linux","windows","macos","android"],
  "scriptType": "${scriptType}",
  "notes": "important caveats, assumptions, or prerequisites (or empty string)"
}`;

      const userPrompt = `Intent: ${intent.trim()}

Target context:
- Asset type: ${assetType || "generic"}
- Operating system: ${os || "linux"}
- Script language: ${scriptType}${protocolContext}${vendorContext}${assetContext}

Generate a ${scriptType} script that accomplishes this intent for the specified asset type and OS.`;

      const completion = await callAiLogged(openai, {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }, { module: "command-catalog", endpoint: "/api/command-catalog/ai-compose", userId: req.user!.id, providerName });

      const rawContent = completion.choices[0]?.message?.content || "{}";
      let composed: any;
      try { composed = JSON.parse(rawContent); } catch { return res.status(500).json({ error: "AI returned invalid JSON" }); }
      if (!composed.script) return res.status(500).json({ error: "AI did not return a script" });

      // ── 3. Cache in KB ──────────────────────────────────────────────────
      const kbPayload = {
        title: `Composed: ${composed.title || intent.substring(0, 60)} [${fingerprint}]`,
        content: JSON.stringify(composed),
        category: "command-compose-cache",
        tags: [cacheTag, `scripttype-${scriptType}`, `assettype-${assetType}`, "ai-compose-cache"],
        status: "internal",
        authorId: req.user!.id,
      };
      if (cachedRows[0]) {
        await db.update(knowledgeArticles).set({ content: JSON.stringify(composed), updatedAt: new Date() } as any).where(drizzleSql`${knowledgeArticles.id} = ${cachedRows[0].id}`);
      } else {
        await storage.createKnowledgeArticle(kbPayload as any);
      }

      const tokens = completion.usage?.total_tokens ?? 0;
      res.json({ ...composed, cacheHit: false, tokensUsed: tokens });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/command-catalog/from-agent", requireAuth, async (req, res) => {
    try {
      const { name, description, category, scriptType, script, riskLevel, agentName, compatibleOs, tags, changeRef } = req.body;
      if (!name || !script) return res.status(400).json({ error: "name and script are required" });
      const entry = await storage.createCommandCatalogEntry({
        userId: req.user!.id, name, description: description || null,
        category: category || "general", scriptType: scriptType || "bash",
        script, riskLevel: riskLevel || "low",
        authorType: "agent", authorName: agentName || "AI Agent",
        compatibleOs: compatibleOs || [], tags: tags || [],
        status: "draft", changeRef: changeRef || null,
        dryRunAssetId: null, dryRunBatchId: null, dryRunResult: null, dryRunError: null,
        version: 1,
      });
      res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── AI Command Review (KB-first cache) ───────────────────────────────────
  app.post("/api/command-catalog/:id/ai-review", requireAuth, async (req, res) => {
    try {
      const entry = await storage.getCommandCatalogEntry(req.params.id, req.user!.id);
      if (!entry) return res.status(404).json({ error: "Not found" });

      // ── 1. Compute script fingerprint for KB cache key ──────────────────
      const { createHash } = await import("node:crypto");
      const fingerprint = createHash("sha256").update(`${entry.scriptType}::${entry.script.trim()}`).digest("hex").substring(0, 16);
      const cacheTag = `cmd-review-${fingerprint}`;
      const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

      // ── 2. KB cache lookup ──────────────────────────────────────────────
      const { db } = await import("./db");
      const { knowledgeArticles } = await import("../shared/schema");
      const { sql: drizzleSql, like } = await import("drizzle-orm");
      const cachedRows = await db.select().from(knowledgeArticles)
        .where(drizzleSql`${knowledgeArticles.category} = 'command-review-cache' AND ${cacheTag} = ANY(${knowledgeArticles.tags})`)
        .limit(1);

      if (cachedRows.length > 0) {
        const cached = cachedRows[0];
        const ageMs = Date.now() - new Date(cached.updatedAt!).getTime();
        if (ageMs < CACHE_TTL_MS) {
          // Cache hit — parse stored review, update catalog entry, return
          const review = JSON.parse(cached.content);
          const updated = await storage.updateCatalogAiReview(entry.id, {
            aiReviewStatus: "completed", aiReviewVerdict: review.verdict,
            aiReviewScore: review.score, aiReviewNotes: review,
            aiReviewAt: new Date(), aiReviewCacheHit: true,
          });
          return res.json({ ...review, cacheHit: true, entry: updated });
        }
      }

      // ── 3. Cache miss — call OpenAI (gpt-4o-mini for cost efficiency) ──
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!apiKey) return res.status(503).json({ error: "AI review unavailable — no API key configured" });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

      const systemPrompt = `You are a DevOps security expert reviewing IT automation scripts for a command catalog.
Evaluate the script for: correctness, security, idempotency, and OS compatibility.
Respond ONLY with valid JSON in this exact shape:
{
  "verdict": "approved" | "warned" | "blocked",
  "score": 0-100,
  "summary": "one sentence",
  "issues": [{"severity":"critical"|"warning"|"info","message":"...","line":null|number}],
  "suggestions": ["..."],
  "idempotent": true|false,
  "destructive": true|false,
  "osNotes": "..."
}
Rules: blocked = critical security issue (rm -rf /, credentials in script, etc). warned = has fixable issues. approved = clean.`;

      const userPrompt = `Script type: ${entry.scriptType}
Name: ${entry.name}
Risk level declared: ${entry.riskLevel}
Compatible OS declared: ${(entry.compatibleOs || []).join(", ") || "unspecified"}

\`\`\`${entry.scriptType}
${entry.script.substring(0, 4000)}
\`\`\``;

      // Mark as pending immediately
      await storage.updateCatalogAiReview(entry.id, {
        aiReviewStatus: "pending", aiReviewVerdict: "pending",
        aiReviewScore: 0, aiReviewNotes: null,
        aiReviewAt: new Date(), aiReviewCacheHit: false,
      });

      const completion = await callAiLogged(openai, {
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.1,
        max_tokens: 600,
        response_format: { type: "json_object" },
      }, { module: "command-catalog", endpoint: "/api/command-catalog/:id/ai-review", userId: req.user!.id, providerName });

      const rawContent = completion.choices[0]?.message?.content || "{}";
      let review: any;
      try { review = JSON.parse(rawContent); } catch { review = { verdict: "warned", score: 50, summary: "Could not parse AI response", issues: [], suggestions: [], idempotent: false, destructive: false, osNotes: "" }; }

      // ── 4. Store in KB for future cache hits ────────────────────────────
      const kbArticlePayload = {
        title: `AI Command Review: ${entry.name} [${fingerprint}]`,
        content: JSON.stringify(review),
        category: "command-review-cache",
        tags: [cacheTag, `scripttype-${entry.scriptType}`, "ai-review-cache"],
        status: "internal",
        authorId: req.user!.id,
      };
      const existingKb = cachedRows[0];
      if (existingKb) {
        await db.update(knowledgeArticles).set({ content: JSON.stringify(review), updatedAt: new Date() } as any).where(drizzleSql`${knowledgeArticles.id} = ${existingKb.id}`);
      } else {
        await storage.createKnowledgeArticle(kbArticlePayload as any);
      }

      // ── 5. Persist review result on catalog entry ────────────────────────
      const updated = await storage.updateCatalogAiReview(entry.id, {
        aiReviewStatus: "completed", aiReviewVerdict: review.verdict,
        aiReviewScore: review.score ?? 0, aiReviewNotes: review,
        aiReviewAt: new Date(), aiReviewCacheHit: false,
      });

      const tokens = completion.usage?.total_tokens ?? 0;
      res.json({ ...review, cacheHit: false, tokensUsed: tokens, entry: updated });
    } catch (err: any) {
      // If OpenAI failed, mark entry as error
      try { await storage.updateCatalogAiReview(req.params.id, { aiReviewStatus: "error", aiReviewVerdict: "warned", aiReviewScore: 0, aiReviewNotes: { error: err.message }, aiReviewAt: new Date(), aiReviewCacheHit: false }); } catch {}
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/discovered-assets/:id/request-software-scan", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getDiscoveredAsset(req.params.id, req.user!.id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      const meta = (asset.metadata || {}) as Record<string, any>;
      // Set flag for v1.1.0+ probes that handle requestSoftwareInventory
      meta.requestSoftwareInventory = true;
      await storage.updateDiscoveredAsset(asset.id, { metadata: meta });

      // Also dispatch an explicit collection task for older probes (v1.0.x) that ignore the flag.
      // The task outputs a JSON array of installed apps; probe-task-report parses it when the title is [SW_SCAN].
      if (asset.probeId) {
        try {
          const probe = await storage.getDiscoveryProbe(asset.probeId);
          if (probe && probe.enrolled) {
            const osInfo = (probe.osInfo || "").toLowerCase();
            const isWindows = /windows/i.test(osInfo);
            const scriptType = isWindows ? "powershell" : "bash";

            // Cancel any pre-existing pending SW_SCAN task on this asset to avoid duplicates
            const existingTasks = await storage.getRemediationTasks(asset.id, req.user!.id);
            const existingScan = existingTasks.find(t => t.title.startsWith("[SW_SCAN]") && ["queued", "dispatched"].includes(t.status));
            if (!existingScan) {
              const collectionScript = isWindows
                ? `# Collect installed software inventory
$apps = @()
# Registry-based software list (HKLM + HKCU)
$regPaths = @(
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
)
foreach ($regPath in $regPaths) {
  try {
    Get-ItemProperty $regPath -ErrorAction SilentlyContinue |
      Where-Object { $_.DisplayName } |
      ForEach-Object {
        $apps += @{ name = $_.DisplayName; version = $_.DisplayVersion; publisher = $_.Publisher; installDate = $_.InstallDate; sizeMB = 0 }
      }
  } catch {}
}
$apps | ConvertTo-Json -Compress`
                : `#!/bin/bash
python3 - <<'PYEOF'
import os, json, plistlib, glob, subprocess, sys
apps = []
for app_path in glob.glob('/Applications/*.app') + glob.glob('/Applications/*/*.app'):
    try:
        plist_path = os.path.join(app_path, 'Contents/Info.plist')
        if not os.path.exists(plist_path): continue
        with open(plist_path, 'rb') as f:
            pl = plistlib.load(f)
        name = pl.get('CFBundleName') or pl.get('CFBundleDisplayName') or os.path.basename(app_path).replace('.app','')
        version = pl.get('CFBundleShortVersionString') or pl.get('CFBundleVersion') or ''
        bundle_id = pl.get('CFBundleIdentifier') or ''
        publisher = bundle_id.split('.')[1] if bundle_id.count('.')>=2 else ''
        apps.append({'name': name, 'version': version, 'publisher': publisher, 'installDate': '', 'sizeMB': 0})
    except Exception:
        pass
try:
    r = subprocess.run(['brew','list','--formula','--versions'], capture_output=True, text=True, timeout=15)
    for line in r.stdout.strip().splitlines():
        p = line.split()
        if p: apps.append({'name': p[0], 'version': p[1] if len(p)>1 else '', 'publisher': 'Homebrew', 'installDate': '', 'sizeMB': 0})
except Exception:
    pass
print(json.dumps(apps))
PYEOF`;

              await storage.createRemediationTask({
                assetId: asset.id,
                probeId: probe.id,
                userId: req.user!.id,
                title: "[SW_SCAN] Software Inventory Collection",
                description: "Automated software inventory collection triggered by Scan Now.",
                remediationScript: collectionScript,
                rollbackScript: isWindows ? "# No rollback needed for inventory scan\nWrite-Output 'No rollback required'" : "#!/bin/bash\necho 'No rollback required for inventory scan'",
                scriptType,
                status: "queued",
              });
            }
          }
        } catch (e) {
          console.error("[SW_SCAN] Failed to dispatch collection task:", e);
        }
      }

      res.json({ success: true, message: "Software inventory scan requested — the probe will collect on its next heartbeat" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/discovered-assets/:id/generate-remediation", requireAuth, async (req, res) => {
    try {
      const { recommendation } = req.body;
      if (!recommendation || typeof recommendation !== "string") {
        return res.status(400).json({ error: "recommendation string required" });
      }

      const asset = await storage.getDiscoveredAsset(req.params.id, req.user!.id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const existingTasks = await storage.getRemediationTasks(req.params.id, req.user!.id);
      const alreadyExists = existingTasks.find(t => t.title === recommendation);
      if (alreadyExists) {
        return res.json(alreadyExists);
      }

      const remCdKey = `remediation:${req.user!.id}:${req.params.id}:${recommendation.substring(0, 50)}`;
      const cooldown = isAiOnCooldown(remCdKey, 2 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `Remediation script was just generated for this asset. Try again in ${cooldown.remainingSec}s.` });
      }

      const meta = (asset.metadata || {}) as Record<string, any>;
      // firmware column holds the OS string for probe-enrolled endpoints (e.g. "Microsoft Windows 11 Home 10.0.26200")
      const osName = asset.firmware || meta.software?.os || meta.hardware?.os || "";
      const isWindows = /windows/i.test(osName);
      const scriptType = isWindows ? "powershell" : "bash";

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);
      setAiCooldown(remCdKey);

      const sharedSystemPrompt = `You are a senior systems administrator generating remediation scripts. You must respond with a JSON object containing exactly two fields: "script" (the forward remediation script) and "rollbackScript" (the undo/rollback script that reverses what the forward script does).

Rules for BOTH scripts:
- Scripts must be idempotent (safe to run multiple times)
- Include error handling and logging
- Include comments explaining each step
- Do NOT reboot unless absolutely necessary
- For PowerShell: use Write-Output for logging, try/catch for error handling, always exit 0 on graceful completion
- For Bash: use echo for logging, always exit 0 on graceful completion
- No markdown fences inside the script strings — raw script content only

CRITICAL — PowerShell module restrictions (Windows):
- NEVER use Get-WindowsUpdate, Install-WindowsUpdate, or any cmdlet from the PSWindowsUpdate module — it is NOT installed by default
- NEVER use any third-party or external PowerShell modules (PSWindowsUpdate, PoshWSUS, Carbon, etc.)
- For Windows Update status: use Get-HotFix, Get-WmiObject Win32_QuickFixEngineering, or the COM object (New-Object -ComObject Microsoft.Update.Session)
- For triggering Windows Update: use UsoClient.exe StartScan / StartInstall, or wuauclt.exe /detectnow, or Start-Service wuauserv
- For patch compliance checking: use Get-HotFix | Measure-Object, registry keys under HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\, or Get-ComputerInfo
- For Linux: use apt/yum/dnf/zypper natively, not Python pip packages unless pip is confirmed available

CRITICAL — Software installation and update tasks:
- ALWAYS check if the application is already at the required version FIRST — skip installation if already up-to-date (idempotency)
- STRONGLY prefer winget (Windows Package Manager) for installing/updating software on Windows: use "winget upgrade --id <AppId> --silent --accept-source-agreements --accept-package-agreements"
- Check if winget is available: "Get-Command winget -ErrorAction SilentlyContinue"
- For multiple applications: run them in PARALLEL using Start-Job / Wait-Job rather than one-by-one — this dramatically reduces total time
- When downloading installers manually: prefer "-Wait" on Start-Process and set a reasonable per-installer deadline
- Include Write-Output progress messages between each step so the operator can see what is happening
- For tasks like "update Chrome, Office, VC++": use winget upgrade for each, launched as parallel jobs
- The script has a generous timeout (up to 60 minutes for install tasks) — it is acceptable for the script to run for 20-30 minutes if needed, but use parallel jobs to be efficient

CRITICAL — Network configuration safety rules:
- NEVER hardcode IP addresses, DNS servers, gateway IPs, or subnet values — every environment is different
- NEVER blindly SET DNS servers, gateways, or IP addresses without first reading the current values and confirming there is an actual misconfiguration
- For tasks involving "review", "audit", "check", or "ensure" network config: READ and REPORT current settings only — do not change anything unless the task explicitly says to fix a specific known-bad value
- If you must call Set-DnsClientServerAddress, New-NetRoute, or Set-NetIPAddress, ALWAYS first Get-NetAdapter / Get-NetIPConfiguration to discover the real current state; validate ALL mandatory parameters before calling
- Prefer Get-NetIPConfiguration, Get-NetAdapter, Get-DnsClientServerAddress, ipconfig, netsh, route print for auditing
- When a task says "update" network settings without providing target values, treat it as an AUDIT task: report current state only

CRITICAL execution environment constraints:
- The script runs from an automated probe agent, NOT from an interactive admin session
- The probe may or may not be running with administrator/root privileges
- At the START of the script, check for admin/root privileges. If elevation is needed and unavailable, output what was checked and exit 0 (NOT exit 1)
- For PowerShell admin checks use EXACTLY this pattern (never use [bool](New-Object ...) — it breaks on PS 5.1):
  $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Write-Output "Requires admin."; exit 0 }
- Use user-writable paths for any log files or temp files ($env:TEMP or $env:USERPROFILE on Windows, /tmp on Linux)
- Prefer reading/auditing over making changes when the task is an audit or assessment
- Always exit 0 on success or graceful degradation. Only exit 1 on truly unexpected fatal errors

Rules specific to "rollbackScript":
- The rollbackScript must UNDO or REVERSE the changes made by the forward script
- If the forward script is read-only/audit only, the rollbackScript should output "No changes were made by the forward script — nothing to roll back." and exit 0
- If the forward script modifies config files, the rollbackScript should restore original values (captured by the forward script in a temp state file, or by reading current values before changing them)
- If the forward script enables a service, the rollbackScript should disable it; if it adds a firewall rule, the rollbackScript should remove it; etc.
- The rollbackScript must be safe and idempotent

Target system:
- Hostname: ${asset.name}
- OS: ${osName}
- IP: ${asset.ipAddress}
- Type: ${asset.type}`;

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          { role: "system", content: sharedSystemPrompt },
          {
            role: "user",
            content: `Generate a ${scriptType} remediation script AND its rollback script for: "${recommendation}". Return JSON with fields "script" and "rollbackScript".`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }, { module: "asset-discovery", endpoint: "/api/discovered-assets/:id/generate-remediation", userId: req.user!.id, providerName });

      const rawJson = response.choices[0]?.message?.content?.trim() || "";
      if (!rawJson) return res.status(500).json({ error: "AI failed to generate scripts" });

      let script = "";
      let rollbackScript: string | null = null;
      try {
        const parsed = JSON.parse(rawJson);
        script = decodeScriptEntities((parsed.script || "").replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim());
        rollbackScript = parsed.rollbackScript ? decodeScriptEntities((parsed.rollbackScript as string).replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()) : null;
      } catch {
        script = rawJson;
      }
      if (!script) return res.status(500).json({ error: "AI failed to generate remediation script" });

      const task = await storage.createRemediationTask({
        assetId: asset.id,
        probeId: asset.probeId || null,
        userId: req.user!.id,
        title: recommendation,
        description: `Auto-generated ${scriptType} remediation script for: ${recommendation}`,
        remediationScript: script,
        rollbackScript: rollbackScript || null,
        scriptType,
        status: "pending_approval",
      });

      res.json(task);
    } catch (err: any) {
      console.error("Generate remediation error:", err);
      res.status(500).json({ error: "Failed to generate remediation script", details: err.message });
    }
  });

  async function applyRemediationToAsset(task: { assetId: string; title: string; userId: string }) {
    try {
      const asset = await storage.getDiscoveredAsset(task.assetId, task.userId);
      if (!asset) return;
      const meta = (asset.metadata || {}) as Record<string, any>;

      if (meta.agentScanStatus === "scanning") {
        console.log(`[REMEDIATION] Deferring metadata update for task "${task.title}" — scan in progress. Remediation task is marked complete; metadata will be reconciled on next scan.`);
        return;
      }
      const title = (task.title || "").toLowerCase();

      if (Array.isArray(meta.vulnerabilities)) {
        meta.vulnerabilities = meta.vulnerabilities.map((v: any) => {
          const desc = (v.description || "").toLowerCase();
          const cve = (v.cve || "").toLowerCase();
          if (v.status === "Open" || v.status === "Mitigated" || v.status === "Accepted Risk") {
            const titleWords = title.split(/\s+/).filter((w: string) => w.length > 3);
            const matches = titleWords.some((w: string) => desc.includes(w) || cve.includes(w));
            if (matches) {
              return { ...v, status: "Patched", patchedDate: new Date().toISOString().split("T")[0], remediation: "Auto-remediated by HOLOCRON AI" };
            }
          }
          return v;
        });
      }

      if (Array.isArray(meta.recommendedActions)) {
        const titleWords = title.split(/\s+/).filter((w: string) => w.length > 3);
        meta.recommendedActions = meta.recommendedActions.filter((a: string) => {
          const actionLower = a.toLowerCase();
          if (actionLower === title) return false;
          const matchCount = titleWords.filter((w: string) => actionLower.includes(w)).length;
          const matchRatio = titleWords.length > 0 ? matchCount / titleWords.length : 0;
          return matchRatio < 0.5;
        });
      }

      const openVulns = Array.isArray(meta.vulnerabilities) ? meta.vulnerabilities.filter((v: any) => v.status === "Open").length : 0;
      const totalVulns = Array.isArray(meta.vulnerabilities) ? meta.vulnerabilities.length : 0;
      if (meta.riskScore && totalVulns > 0) {
        const patchedRatio = 1 - (openVulns / totalVulns);
        meta.riskScore = Math.max(10, Math.round(meta.riskScore * (1 - patchedRatio * 0.3)));
      }

      meta.lastRemediationAt = new Date().toISOString();
      meta.agentScanStatus = meta.agentScanStatus === "completed" ? "completed" : meta.agentScanStatus;

      await storage.updateDiscoveredAsset(asset.id, { metadata: meta });
    } catch (err) {
      console.error("Failed to apply remediation to asset metadata:", err);
    }
  }

  // ── Asset 360° Context ────────────────────────────────────────────────────
  // Returns correlated ITSM records, supplier/contracts, SLAs and financials
  // for a single discovered asset. Correlation is done by text matching on
  // asset name, IP, vendor and type — no hard foreign-key dependency needed.
  app.get("/api/asset-context/:assetId", requireAuth, async (req, res) => {
    try {
      const asset = await storage.getDiscoveredAsset(req.params.assetId, req.user!.id);
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const [
        allIncidents, allProblems, allChanges, allSRs,
        allSuppliers, allContracts,
        allSlas, allBreaches, allFinancials,
      ] = await Promise.all([
        storage.getIncidents(),
        storage.getProblems(),
        storage.getChangeRequests(),
        storage.getServiceRequests(),
        storage.getSuppliers(),
        storage.getSupplierContracts(),
        storage.getSlaDefinitions(),
        storage.getSlaBreaches(),
        storage.getServiceFinancials(),
      ]);

      const name   = (asset.name       || "").toLowerCase();
      const ip     = (asset.ipAddress  || "").toLowerCase();
      const vendor = (asset.vendor     || "").toLowerCase();
      const type   = (asset.type       || "").toLowerCase();

      const textHit = (text: string) =>
        (name && text.includes(name)) || (ip && text.includes(ip));

      const typeKeywords: Record<string, string[]> = {
        server:   ["server", "compute", "vm", "virtual", "linux", "windows"],
        network:  ["network", "firewall", "switch", "router", "wan", "lan"],
        storage:  ["storage", "nas", "san", "backup", "disk"],
        endpoint: ["endpoint", "laptop", "workstation", "desktop", "pc"],
        iot:      ["iot", "sensor", "camera", "device"],
        camera:   ["camera", "cctv", "surveillance"],
      };
      const keywords = typeKeywords[type] ?? [type];
      const typeHit  = (text: string) => keywords.some(k => text.includes(k));

      // ITSM – prefer direct name/IP match, fall back to type keyword match
      const relatedIncidents = (() => {
        const direct = allIncidents.filter(i => textHit(`${i.title} ${i.description}`.toLowerCase())).slice(0, 8);
        const byType = direct.length === 0
          ? allIncidents.filter(i => typeHit(`${i.title} ${i.description} ${i.category}`.toLowerCase())).slice(0, 5)
          : [];
        return [...direct, ...byType];
      })();

      const relatedProblems = (() => {
        const direct = allProblems.filter(p => textHit(`${p.title} ${p.description} ${(p.affectedServices || []).join(" ")}`.toLowerCase())).slice(0, 5);
        const byType = direct.length === 0
          ? allProblems.filter(p => typeHit(`${p.title} ${p.description} ${p.category}`.toLowerCase())).slice(0, 4)
          : [];
        return [...direct, ...byType];
      })();

      const relatedChanges = (() => {
        const direct = allChanges.filter(c => textHit(`${c.title} ${c.description} ${(c.affectedCIs || []).join(" ")}`.toLowerCase())).slice(0, 5);
        const byType = direct.length === 0
          ? allChanges.filter(c => typeHit(`${c.title} ${c.description}`.toLowerCase())).slice(0, 4)
          : [];
        return [...direct, ...byType];
      })();

      const relatedSRs = (() => {
        const direct = allSRs.filter(sr => textHit(`${sr.title} ${sr.description}`.toLowerCase())).slice(0, 5);
        const byType = direct.length === 0
          ? allSRs.filter(sr => typeHit(`${sr.title} ${sr.description} ${sr.type}`.toLowerCase())).slice(0, 4)
          : [];
        return [...direct, ...byType];
      })();

      // Supplier / Contracts — match by vendor name
      const relatedSuppliers = vendor
        ? allSuppliers.filter(s => {
            const sn = s.name.toLowerCase();
            return sn.includes(vendor) || vendor.includes(sn);
          })
        : [];
      const supplierIds = new Set(relatedSuppliers.map(s => s.id));
      const relatedContracts = allContracts.filter(c => supplierIds.has(c.supplierId));

      // SLA — all active SLAs whose scope mentions the asset type or "infrastructure"
      const relatedSlas = allSlas.filter(s => {
        const text = `${s.name} ${s.description} ${s.serviceScope || ""}`.toLowerCase();
        return typeHit(text) || text.includes("infrastructure") || text.includes("all services");
      });
      const slaIds = new Set(relatedSlas.map(s => s.id));
      const relatedBreaches = allBreaches.filter(b => b.slaDefinitionId && slaIds.has(b.slaDefinitionId)).slice(0, 6);

      // Financials — services whose name/costCenter relates to the asset type
      const relatedFinancials = allFinancials.filter(f => {
        const text = `${f.serviceName} ${f.costCenter} ${(f.allocatedTo || []).join(" ")}`.toLowerCase();
        return typeHit(text) || text.includes("infrastructure") || text.includes("it operations");
      }).slice(0, 5);

      res.json({
        asset: { id: asset.id, name: asset.name, vendor: asset.vendor, type: asset.type, ipAddress: asset.ipAddress },
        itsm: { incidents: relatedIncidents, problems: relatedProblems, changes: relatedChanges, serviceRequests: relatedSRs },
        vendor: { suppliers: relatedSuppliers, contracts: relatedContracts },
        sla: { definitions: relatedSlas, breaches: relatedBreaches },
        financial: { services: relatedFinancials },
      });
    } catch (err: any) {
      console.error("asset-context error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/remediation-tasks/:id/approve", requireAuth, async (req, res) => {
    const task = await storage.getRemediationTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.userId !== req.user!.id) return res.status(403).json({ error: "Unauthorized" });
    // Idempotent: if already approved and in-flight, return current state (handles stale UI clicks)
    if (["queued", "dispatched", "executing"].includes(task.status)) return res.json(task);
    if (task.status !== "pending_approval") return res.status(400).json({ error: `Cannot approve task in '${task.status}' status` });

    const asset = await storage.getDiscoveredAsset(task.assetId, req.user!.id);
    const hasProbe = asset?.probeId ? !!(await storage.getDiscoveryProbe(asset.probeId))?.enrolled : false;

    if (hasProbe) {
      // Always stamp the current probeId at approval time — the task may have been
      // created before the asset was probe-linked (probeId was null at creation).
      // Without this the probe heartbeat query (probeId = ? AND status = queued) misses it.
      const updated = await storage.updateRemediationTask(task.id, {
        status:    "queued",
        approvedAt: new Date(),
        probeId:   asset!.probeId!,
      });
      res.json(updated);
    } else {
      const updated = await storage.updateRemediationTask(task.id, {
        status: "completed",
        approvedAt: new Date(),
        dispatchedAt: new Date(),
        completedAt: new Date(),
        result: "Remediation applied — asset metadata updated. No active probe detected, so the fix is recorded as applied. Re-run an AI Agent Scan to verify the updated posture.",
      });
      await applyRemediationToAsset(task);
      res.json(updated);
    }
  });

  app.post("/api/remediation-tasks/:id/reject", requireAuth, async (req, res) => {
    const task = await storage.getRemediationTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.userId !== req.user!.id) return res.status(403).json({ error: "Unauthorized" });

    const updated = await storage.updateRemediationTask(task.id, { status: "rejected" });
    res.json(updated);
  });

  // Reset a failed task back to pending_approval so it can be approved and re-dispatched
  app.post("/api/remediation-tasks/:id/retry", requireAuth, async (req, res) => {
    const task = await storage.getRemediationTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.userId !== req.user!.id) return res.status(403).json({ error: "Unauthorized" });
    if (!["failed", "rejected"].includes(task.status)) {
      return res.status(400).json({ error: `Cannot retry task in '${task.status}' status` });
    }

    const updated = await storage.updateRemediationTask(task.id, {
      status: "pending_approval",
      approvedAt: null,
      dispatchedAt: null,
      completedAt: null,
      result: null,
      error: null,
    });
    res.json(updated);
  });

  // Reset a stuck dispatched/executing task back to queued so it re-dispatches on next heartbeat
  app.post("/api/remediation-tasks/:id/reset", requireAuth, async (req, res) => {
    const task = await storage.getRemediationTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.userId !== req.user!.id) return res.status(403).json({ error: "Unauthorized" });
    if (!["dispatched", "executing", "failed"].includes(task.status)) {
      return res.status(400).json({ error: `Cannot reset task in '${task.status}' status` });
    }
    const updated = await storage.updateRemediationTask(task.id, {
      status: "queued",
      dispatchedAt: null,
      completedAt: null,
      result: null,
      error: null,
    });
    res.json(updated);
  });

  app.post("/api/remediation-tasks/:id/force-complete", requireAuth, async (req, res) => {
    const task = await storage.getRemediationTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.userId !== req.user!.id) return res.status(403).json({ error: "Unauthorized" });

    const allowedStatuses = ["queued", "dispatched", "executing"];
    if (!allowedStatuses.includes(task.status)) {
      return res.status(400).json({ error: `Cannot force-complete task in '${task.status}' status` });
    }

    const updated = await storage.updateRemediationTask(task.id, {
      status: "completed",
      completedAt: new Date(),
      result: req.body?.result || "Manually marked as completed by operator.",
    });

    await applyRemediationToAsset(task);
    res.json(updated);
  });

  app.delete("/api/remediation-tasks/completed", requireAuth, async (req, res) => {
    const assetId = req.query.assetId as string;
    if (!assetId) return res.status(400).json({ error: "assetId query parameter required" });
    const count = await storage.clearCompletedRemediationTasks(assetId, req.user!.id);
    res.json({ cleared: count });
  });

  app.post("/api/remediation-tasks/:id/cancel", requireAuth, async (req, res) => {
    const task = await storage.getRemediationTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.userId !== req.user!.id) return res.status(403).json({ error: "Unauthorized" });

    const cancellable = ["queued", "dispatched", "executing", "pending_approval"];
    if (!cancellable.includes(task.status)) {
      return res.status(400).json({ error: `Cannot cancel task in '${task.status}' status` });
    }

    const updated = await storage.updateRemediationTask(task.id, {
      status: "failed",
      completedAt: new Date(),
      error: req.body?.reason || "Cancelled by operator.",
    });
    console.log(`[REMEDIATION] Task ${task.id} cancelled by user`);
    res.json(updated);
  });

  app.post("/api/remediation-tasks/:id/rollback", requireAuth, async (req, res) => {
    const task = await storage.getRemediationTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.userId !== req.user!.id) return res.status(403).json({ error: "Unauthorized" });
    if (!task.rollbackScript) return res.status(400).json({ error: "No rollback script available for this task" });
    if (!task.probeId) return res.status(400).json({ error: "Task has no associated probe — cannot dispatch rollback" });

    const allowedForRollback = ["completed", "failed"];
    if (!allowedForRollback.includes(task.status)) {
      return res.status(400).json({ error: `Rollback only allowed for completed or failed tasks (current status: ${task.status})` });
    }

    const activeRollback = ["pending", "dispatched", "executing"];
    if (task.rollbackStatus && activeRollback.includes(task.rollbackStatus)) {
      return res.status(400).json({ error: `Rollback already in progress (status: ${task.rollbackStatus})` });
    }

    const updated = await storage.updateRemediationTask(task.id, { rollbackStatus: "pending" });
    console.log(`[ROLLBACK] Rollback initiated for task ${task.id} (${task.title}) by user ${req.user!.id}`);
    res.json(updated);
  });

  // Flat probe reporting endpoint — used by macOS, Linux, Windows probes
  // Accepts: { siteToken, taskId, status, result?, error? }
  app.post("/api/probe-task-report", async (req, res) => {
    const { siteToken, taskId, status, result, error } = req.body;
    if (!siteToken) return res.status(401).json({ error: "Probe token required" });
    if (!taskId) return res.status(400).json({ error: "taskId required" });

    const probe = await storage.getDiscoveryProbeByToken(siteToken);
    if (!probe) return res.status(401).json({ error: "Invalid probe token" });

    const task = await storage.getRemediationTask(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.probeId !== probe.id) return res.status(403).json({ error: "Task not assigned to this probe" });

    if (status && status.startsWith("rollback_")) {
      const rollbackPhase = status.replace("rollback_", "");
      console.log(`[ROLLBACK] Probe ${probe.name} reported rollback for task ${task.id}: ${rollbackPhase}`);
      const rollbackUpdates: any = { rollbackStatus: rollbackPhase };
      if (rollbackPhase === "executing") rollbackUpdates.rollbackDispatchedAt = new Date();
      else if (rollbackPhase === "completed") { rollbackUpdates.rollbackedAt = new Date(); rollbackUpdates.rollbackResult = result || "Rollback completed"; }
      else if (rollbackPhase === "failed") { rollbackUpdates.rollbackedAt = new Date(); rollbackUpdates.rollbackError = error || "Rollback failed"; }
      return res.json({ success: true, task: await storage.updateRemediationTask(task.id, rollbackUpdates) });
    }

    const allowedTransitions: Record<string, string[]> = {
      queued: ["executing"],
      dispatched: ["executing"],
      executing: ["completed", "failed"],
    };
    const allowed = allowedTransitions[task.status];
    if (!allowed || !allowed.includes(status)) {
      console.log(`[REMEDIATION] Probe ${probe.name} rejected transition ${task.status} → ${status} for task ${task.id}`);
      return res.status(400).json({ error: `Invalid transition from '${task.status}' to '${status}'` });
    }

    const updates: any = { status };
    if (status === "completed") { updates.completedAt = new Date(); updates.result = result || "Completed successfully"; }
    else if (status === "failed") { updates.completedAt = new Date(); updates.error = error || "Unknown error"; }
    console.log(`[REMEDIATION] Probe ${probe.name} reported task ${task.id}: ${task.status} → ${status}`);
    const updated = await storage.updateRemediationTask(task.id, updates);

    // If this was a software inventory collection task, parse the result and store the apps
    if (status === "completed" && task.title?.startsWith("[SW_SCAN]") && result) {
      try {
        const rawResult = typeof result === "string" ? result.trim() : "";
        // Extract JSON array — the script outputs JSON, but may have extra lines before/after
        const jsonMatch = rawResult.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[1]) : null;
        const apps: any[] = Array.isArray(parsed) ? parsed : (parsed?.value ? parsed.value : null);
        if (apps && apps.length > 0) {
          const asset = await storage.getDiscoveredAsset(task.assetId, task.userId);
          if (asset) {
            const meta = (asset.metadata || {}) as Record<string, any>;
            meta.installedApps = apps;
            if (!meta.software) meta.software = {};
            meta.software.installedApps = apps;
            meta.softwareInventoryScannedAt = new Date().toISOString();
            await storage.updateDiscoveredAsset(asset.id, { metadata: meta });
            console.log(`[SW_SCAN] Stored ${apps.length} installed apps for asset ${asset.name} from probe task`);
          }
        }
      } catch (e) {
        console.error("[SW_SCAN] Failed to parse software inventory result:", e);
      }
    }

    res.json({ success: true, task: updated });
  });

  app.post("/api/remediation-tasks/:id/report", async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: "Probe token required" });

    const probe = await storage.getDiscoveryProbeByToken(token);
    if (!probe) return res.status(401).json({ error: "Invalid probe token" });

    const task = await storage.getRemediationTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.probeId !== probe.id) return res.status(403).json({ error: "Task not assigned to this probe" });

    const { status, result, error } = req.body;

    if (status && status.startsWith("rollback_")) {
      const rollbackPhase = status.replace("rollback_", "");
      console.log(`[ROLLBACK] Probe ${probe.name} reported rollback for task ${task.id}: ${rollbackPhase}`);
      const rollbackUpdates: any = { rollbackStatus: rollbackPhase };
      if (rollbackPhase === "executing") {
        rollbackUpdates.rollbackDispatchedAt = new Date();
      } else if (rollbackPhase === "completed") {
        rollbackUpdates.rollbackedAt = new Date();
        rollbackUpdates.rollbackResult = result || "Rollback completed successfully";
      } else if (rollbackPhase === "failed") {
        rollbackUpdates.rollbackedAt = new Date();
        rollbackUpdates.rollbackError = error || "Rollback failed — unknown error";
      }
      const updated = await storage.updateRemediationTask(task.id, rollbackUpdates);
      return res.json({ success: true, task: updated });
    }

    console.log(`[REMEDIATION] Probe ${probe.name} reported task ${task.id}: ${task.status} → ${status}${result ? ` result=${result.substring(0, 100)}` : ""}${error ? ` error=${error.substring(0, 100)}` : ""}`);

    const allowedTransitions: Record<string, string[]> = {
      dispatched: ["executing"],
      executing: ["completed", "failed"],
    };
    const allowed = allowedTransitions[task.status];
    if (!allowed || !allowed.includes(status)) {
      console.log(`[REMEDIATION] Rejected transition from '${task.status}' to '${status}' for task ${task.id}`);
      return res.status(400).json({ error: `Invalid transition from '${task.status}' to '${status}'` });
    }

    const updates: any = { status };
    if (status === "completed") {
      updates.completedAt = new Date();
      updates.result = result || "Completed successfully";
    } else if (status === "failed") {
      updates.completedAt = new Date();
      updates.error = error || "Unknown error";
    }

    const updated = await storage.updateRemediationTask(task.id, updates);

    if (status === "completed") {
      // If this was a software inventory collection task, parse the result and store the apps
      if (task.title?.startsWith("[SW_SCAN]") && result) {
        try {
          const rawResult = typeof result === "string" ? result.trim() : "";
          const jsonMatch = rawResult.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
          const parsedData = jsonMatch ? JSON.parse(jsonMatch[1]) : null;
          const apps: any[] = Array.isArray(parsedData) ? parsedData : (parsedData?.value ? parsedData.value : null);
          if (apps && apps.length > 0) {
            const asset = await storage.getDiscoveredAsset(task.assetId, task.userId);
            if (asset) {
              const assetMeta = (asset.metadata || {}) as Record<string, any>;
              assetMeta.installedApps = apps;
              if (!assetMeta.software) assetMeta.software = {};
              assetMeta.software.installedApps = apps;
              assetMeta.softwareInventoryScannedAt = new Date().toISOString();
              await storage.updateDiscoveredAsset(asset.id, { metadata: assetMeta });
              console.log(`[SW_SCAN] Stored ${apps.length} installed apps for asset ${asset.name} from probe task`);
            }
          }
        } catch (e) {
          console.error("[SW_SCAN] Failed to parse software inventory result:", e);
        }
      } else {
        await applyRemediationToAsset(task);
      }
    }

    res.json({ success: true, task: updated });
  });

  async function getManagedAgentRoleIds(userId: string): Promise<string[] | null> {
    const managed = await storage.getUserManagedAgents(userId);
    if (managed.length === 0) return null;
    return managed.map(m => m.agentRoleId);
  }

  app.get("/api/managed-agents", requireAuth, async (req, res) => {
    const managed = await storage.getUserManagedAgents(req.user!.id);
    res.json(managed);
  });

  app.put("/api/managed-agents", requireAuth, async (req, res) => {
    const schema = z.object({ agentRoleIds: z.array(z.string()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    const subs = await storage.getRoleSubscriptionsByUser(req.user!.id);
    const aiSubRoleIds = new Set(subs.filter(s => s.hasAiShadow).map(s => s.roleId));
    const validIds = parsed.data.agentRoleIds.filter(id => aiSubRoleIds.has(id));
    const result = await storage.setUserManagedAgents(req.user!.id, validIds);
    res.json(result);
  });

  app.get("/api/agent-performance", requireAuth, async (req, res) => {
    const allMetrics = await storage.getAgentPerformanceMetrics(req.user!.id);
    const managedIds = await getManagedAgentRoleIds(req.user!.id);
    if (managedIds) {
      const filtered = allMetrics.filter(m => managedIds.includes(m.agentRoleId));
      return res.json(filtered);
    }
    res.json(allMetrics);
  });

  app.get("/api/agent-performance/:roleId", requireAuth, async (req, res) => {
    const managedIds = await getManagedAgentRoleIds(req.user!.id);
    if (managedIds && !managedIds.includes(req.params.roleId)) {
      return res.status(403).json({ error: "You do not have access to this agent" });
    }
    res.json(await storage.getAgentPerformanceByRole(req.params.roleId, req.user!.id));
  });

  app.get("/api/agent-notifications", requireAuth, async (req, res) => {
    const filters: any = {};
    if (req.query.agentRoleId) filters.agentRoleId = req.query.agentRoleId;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.actionStatus) filters.actionStatus = req.query.actionStatus;
    if (req.query.type) filters.type = req.query.type;
    let notifications = await storage.getAgentNotifications(req.user!.id, Object.keys(filters).length ? filters : undefined);
    const managedIds = await getManagedAgentRoleIds(req.user!.id);
    if (managedIds) {
      notifications = notifications.filter(n => managedIds.includes(n.agentRoleId));
    }
    res.json(notifications);
  });

  app.get("/api/agent-notifications/:id", requireAuth, async (req, res) => {
    const notification = await storage.getAgentNotification(req.params.id, req.user!.id);
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json(notification);
  });

  const patchNotificationSchema = z.object({
    actionStatus: z.enum(["pending", "approved", "rejected", "auto_executed", "completed"]).optional(),
    humanResponse: z.string().optional(),
    resolvedAt: z.string().datetime().optional().nullable(),
  }).strict();

  app.patch("/api/agent-notifications/:id", requireAuth, async (req, res) => {
    const parsed = patchNotificationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    const notification = await storage.getAgentNotification(req.params.id, req.user!.id);
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    const updates: any = {};
    if (parsed.data.actionStatus !== undefined) updates.actionStatus = parsed.data.actionStatus;
    if (parsed.data.humanResponse !== undefined) updates.humanResponse = parsed.data.humanResponse;
    if (parsed.data.resolvedAt !== undefined) updates.resolvedAt = parsed.data.resolvedAt ? new Date(parsed.data.resolvedAt) : null;
    if (parsed.data.actionStatus === "rejected" && !notification.resolvedAt) {
      updates.resolvedAt = new Date();
    }
    const updated = await storage.updateAgentNotification(req.params.id, req.user!.id, updates);
    res.json(updated);
  });

  app.post("/api/agent-notifications/generate", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    try {
      const subs = await storage.getRoleSubscriptionsByUser(userId);
      let aiSubs = subs.filter(s => s.hasAiShadow);
      if (aiSubs.length === 0) {
        return res.status(400).json({ error: "No AI agents subscribed. Subscribe to agents with AI Shadow enabled first." });
      }

      const notifCdKey = `notifications:${userId}`;
      const cooldown = isAiOnCooldown(notifCdKey, 10 * 60 * 1000);
      if (cooldown.blocked) {
        return res.status(429).json({ error: `Notifications were generated recently. Try again in ${cooldown.remainingSec}s.` });
      }
      const managedIds = await getManagedAgentRoleIds(userId);
      if (managedIds) {
        aiSubs = aiSubs.filter(s => managedIds.includes(s.roleId));
      }
      const roles = await storage.getOrgRoles();
      const assets = await storage.getDiscoveredAssets(userId);
      const existingNotifications = await storage.getAgentNotifications(userId);
      const unresolvedByAgent = new Map<string, string[]>();
      for (const n of existingNotifications) {
        if (!n.resolvedAt) {
          const key = n.agentRoleId;
          if (!unresolvedByAgent.has(key)) unresolvedByAgent.set(key, []);
          unresolvedByAgent.get(key)!.push(n.assetId || "");
        }
      }

      const agentAssetData = aiSubs.map(sub => {
        const role = roles.find(r => r.id === sub.roleId);
        if (!role) return null;
        const roleAssets = assets.filter(a => a.assignedAgentRoleId === role.id);
        return { role, assets: roleAssets };
      }).filter(Boolean);

      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);
      setAiCooldown(notifCdKey);

      const assetSummaries = agentAssetData.map(d => {
        const r = d!.role;
        const assetDetails = d!.assets.map(a => {
          const meta = a.metadata as any;
          const vulns = meta?.vulnerabilities?.filter((v: any) => v.status === "Open" || v.status === "Accepted Risk") || [];
          const kpis = meta?.security?.kpis || {};
          return `  - ${a.name} (${a.type}, ${a.ipAddress}): vulns=${vulns.length} open, patchCompliance=${kpis.patchCompliance || "N/A"}%, configCompliance=${kpis.configCompliance || "N/A"}%, status=${a.status}`;
        }).join("\n");
        const unresolvedAssets = unresolvedByAgent.get(r.id) || [];
        return `Agent: ${r.name} (${r.department})\nAlready has unresolved notifications for: ${unresolvedAssets.length > 0 ? unresolvedAssets.join(", ") : "none"}\nManaged Assets:\n${assetDetails || "  No assets assigned"}`;
      }).join("\n\n");

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are the HOLOCRON AI proactive monitoring engine. You analyze infrastructure assets managed by AI agents and generate notifications about issues, proposed actions, and status updates.

For each agent with managed assets, analyze the asset data (vulnerabilities, compliance scores, patch status, etc.) and generate 1-3 relevant notifications. Skip assets that already have unresolved notifications.

Return a JSON array of notifications. Each notification must have:
- agentRoleId: the role ID string
- assetId: the asset ID (or null for general notifications)
- assetName: the asset name for reference
- type: one of "issue_detected", "action_proposed", "action_taken", "status_update", "escalation"
- severity: one of "critical", "high", "medium", "low", "info"
- title: concise alert title (max 80 chars)
- description: detailed technical description (2-4 sentences)
- proposedAction: what the agent recommends doing (1-2 sentences, or null)
- actionStatus: "pending" for items needing human approval, "auto_executed" for actions already taken

Focus on real security and operational issues based on the actual asset data provided. Be specific with CVE numbers, compliance gaps, and metrics.`
          },
          {
            role: "user",
            content: `Analyze these assets and generate proactive notifications:\n\n${assetSummaries}`
          }
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 4096,
      }, { module: "agent-notifications", endpoint: "/api/agent-notifications/generate", userId: req.user!.id, providerName });

      const content = response.choices[0]?.message?.content || "{}";
      let notifications: any[] = [];
      try {
        const parsed = JSON.parse(content);
        notifications = parsed.notifications || parsed.alerts || (Array.isArray(parsed) ? parsed : []);
      } catch {}

      const validTypes = ["issue_detected", "action_proposed", "action_taken", "status_update", "escalation"];
      const validSevs = ["critical", "high", "medium", "low", "info"];
      const validStatuses = ["pending", "auto_executed", "completed"];
      const agentRoleIds = new Set(aiSubs.map(s => s.roleId));
      const assetIds = new Set(assets.map(a => a.id));

      const created: any[] = [];
      for (const n of notifications) {
        if (!n.title || !n.description || !n.agentRoleId) continue;
        if (!agentRoleIds.has(n.agentRoleId)) continue;
        const matchedAsset = n.assetId ? assets.find(a => a.id === n.assetId || a.name === n.assetName) : null;
        if (n.assetId && !matchedAsset && !n.assetName) continue;
        const notification = await storage.createAgentNotification({
          agentRoleId: n.agentRoleId,
          assetId: matchedAsset?.id || null,
          type: validTypes.includes(n.type) ? n.type : "issue_detected",
          severity: validSevs.includes(n.severity) ? n.severity : "medium",
          title: String(n.title).substring(0, 200),
          description: String(n.description).substring(0, 2000),
          proposedAction: n.proposedAction ? String(n.proposedAction).substring(0, 1000) : null,
          actionStatus: validStatuses.includes(n.actionStatus) ? n.actionStatus : "pending",
          humanResponse: null,
          userId,
        });
        created.push(notification);
      }

      res.json({ generated: created.length, notifications: created });
    } catch (error) {
      console.error("Notification generation error:", error);
      res.status(500).json({ error: "Failed to generate notifications" });
    }
  });

  app.get("/api/agent-chat/conversations", requireAuth, async (req, res) => {
    res.json(await storage.getAgentConversations(req.user!.id));
  });

  app.post("/api/agent-chat/conversations", requireAuth, async (req, res) => {
    const conv = await storage.createAgentConversation({ title: req.body.title || "New Conversation", userId: req.user!.id });
    res.json(conv);
  });

  app.get("/api/agent-chat/conversations/:id/messages", requireAuth, async (req, res) => {
    const conv = await storage.getAgentConversation(req.params.id, req.user!.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    res.json(await storage.getAgentMessages(req.params.id));
  });

  app.post("/api/agent-chat/conversations/:id/messages", requireAuth, async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Content required" });

    const userId = req.user!.id;
    const conversationId = req.params.id;

    const conv = await storage.getAgentConversation(conversationId, userId);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    const chatCdKey = `agent_chat:${userId}`;
    const chatCooldown = isAiOnCooldown(chatCdKey, 5 * 1000);
    if (chatCooldown.blocked) {
      return res.status(429).json({ error: `Please wait a moment before sending another message.` });
    }
    setAiCooldown(chatCdKey);

    await storage.createAgentMessage({ conversationId, role: "user", content, userId });

    const subs = await storage.getRoleSubscriptions(userId);
    let aiSubs = subs.filter(s => s.hasAiShadow);
    const managedIds = await getManagedAgentRoleIds(userId);
    if (managedIds) {
      aiSubs = aiSubs.filter(s => managedIds.includes(s.roleId));
    }
    const roles = await storage.getOrgRoles();
    const assets = await storage.getDiscoveredAssets(userId);

    const agentProfiles = aiSubs.map(sub => {
      const role = roles.find(r => r.id === sub.roleId);
      if (!role) return null;
      const roleAssets = assets.filter(a => a.assignedAgentRoleId === role.id);
      return {
        roleId: role.id,
        name: role.name,
        department: role.department,
        description: role.description,
        responsibilities: role.responsibilities,
        aiCapabilities: role.aiCapabilities,
        assets: roleAssets.map(a => `${a.name} (${a.type}, ${a.ipAddress}, ${a.vendor} ${a.model})`),
      };
    }).filter(Boolean);

    const history = await storage.getAgentMessages(conversationId);
    const chatHistory = history.slice(-20).map(m => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.agentRoleId
        ? `[${roles.find(r => r.id === m.agentRoleId)?.name || "Agent"}]: ${m.content}`
        : m.content,
    }));

    const monitoredApps = await storage.getMonitoredApplications(userId);
    const alerts = await storage.getAgentAlerts(userId);
    const topos = await storage.getApplicationTopologies(userId);
    const activeAlerts = alerts.filter(a => !a.resolvedAt && !a.falsePositive);
    const patches = await storage.getPatches(userId);
    const pendingPatches = patches.filter(p => p.status === "available");
    const deployingPatches = patches.filter(p => p.status === "deploying");

    const infraContext = `
Infrastructure Overview:
- Total Assets: ${assets.length}
- Total Services: ${monitoredApps.length}
- Active Alerts: ${activeAlerts.length} (${activeAlerts.filter(a => a.severity === "critical").length} critical, ${activeAlerts.filter(a => a.severity === "high" || a.severity === "warning").length} high/warning)
- Application Topologies: ${topos.length}

Asset Details:
${assets.map(a => {
  const assetServices = monitoredApps.filter(s => s.assetId === a.id);
  const assetAlerts = activeAlerts.filter(al => al.deviceId === a.id);
  return `- ${a.name} (${a.type}, ${a.ipAddress || "no IP"}, ${a.vendor || ""} ${a.model || ""}, status: ${a.status})
  Services: ${assetServices.length > 0 ? assetServices.map(s => `${s.name} [${s.status}, health:${s.healthScore}%, cpu:${s.cpuUsage ?? "n/a"}%, mem:${s.memoryUsage ?? "n/a"}%, resp:${s.responseTime ?? "n/a"}ms, uptime:${s.uptime ?? "n/a"}%]`).join("; ") : "None"}
  Active Alerts: ${assetAlerts.length > 0 ? assetAlerts.map(al => `${al.severity}: ${al.message}`).join("; ") : "None"}`;
}).join("\n")}

Application Topologies:
${topos.map(t => `- ${t.name} (${t.category}, ${t.criticality}, health:${t.healthScore}%, status:${t.status}, assets: ${(t.assetIds || []).length})`).join("\n")}

Patch Management:
- Total Patches: ${patches.length}
- Pending Deployment: ${pendingPatches.length}
- Currently Deploying: ${deployingPatches.length}
- Critical Patches: ${patches.filter(p => p.severity === "critical").length}
- High Patches: ${patches.filter(p => p.severity === "high").length}

Patches Available for Deployment (status: available):
${pendingPatches.length > 0 ? pendingPatches.map(p => `- ID:${p.id} | ${p.title} | Severity:${p.severity} | CVSS:${p.cvssScore ?? "N/A"} | Type:${p.patchType} | CVE:${p.cveId ?? "N/A"} | AI_Priority:${p.aiPriority ?? "unscored"}`).join("\n") : "No available patches"}

All Assets (for targeting patch deployments):
${assets.map(a => `- ID:${a.id} | ${a.name} | ${a.type} | ${a.ipAddress ?? "no IP"} | ProbeID:${a.probeId ?? "no probe"}`).join("\n")}`;

    const systemPrompt = `You are the HOLOCRON AI — an intelligent, multi-domain AI assistant powering an enterprise IT operations platform. You have two modes of operation:

**MODE 1 — SPECIALIST AGENT ROUTING** (for infrastructure, monitoring, security, and operational queries):
When the user asks about infrastructure, assets, alerts, services, security, network, or any domain covered by your specialist agents, route to the most relevant agent and respond with their expertise.

**MODE 2 — STRATEGIC ADVISOR** (for general knowledge, advisory, planning, and best-practice queries):
When the user asks about general IT knowledge, project management, frameworks, best practices, methodologies, roles, career advice, strategy, architecture, governance, or anything NOT specifically about your managed infrastructure — respond as **HOLOCRON AI Strategic Advisor**, providing comprehensive, expert-level answers drawing from industry-standard frameworks (ITIL, PMBOK, COBIT, TOGAF, SAFe, etc.). Be thorough, structured, and actionable. Use bullet points, numbered lists, and clear formatting.

**CHOOSING THE RIGHT MODE:**
- If the query is about specific assets, alerts, health, services, or operational data → Mode 1 (route to specialist)
- If the query is about general knowledge, "how to", "what are", best practices, roles, frameworks, planning, strategy → Mode 2 (strategic advisor)
- If the query spans both (e.g., "how should we improve our incident process based on current data"), combine both modes

Available Specialist AI Agents:
${agentProfiles.map(a => `
- **${a!.name}** (${a!.department})
  Description: ${a!.description}
  Responsibilities: ${Array.isArray(a!.responsibilities) ? a!.responsibilities.join(", ") : a!.responsibilities}
  AI Capabilities: ${Array.isArray(a!.aiCapabilities) ? a!.aiCapabilities.join(", ") : a!.aiCapabilities}
  Managed Assets: ${a!.assets.length > 0 ? a!.assets.join("; ") : "None directly assigned"}
`).join("")}

${infraContext}

VISUAL DASHBOARD CAPABILITY:
When the user asks for a dashboard, overview, summary, status report, health check, or any visual/analytical view, you MUST include dashboard widgets in your response using this format:

:::dashboard
[
  { "type": "stat", "label": "Total Assets", "value": "12", "change": "+2", "trend": "up", "color": "blue" },
  { "type": "stat", "label": "Critical Alerts", "value": "3", "change": "-1", "trend": "down", "color": "red" },
  { "type": "stat", "label": "Avg Health", "value": "94%", "trend": "up", "color": "green" },
  { "type": "stat", "label": "Services Running", "value": "48", "color": "emerald" },
  { "type": "health_list", "title": "Asset Health", "items": [
    { "name": "WEB-SRV-01", "value": 95, "status": "healthy", "subtitle": "Web Server" },
    { "name": "DB-SRV-01", "value": 72, "status": "warning", "subtitle": "Database" }
  ]},
  { "type": "alert_summary", "title": "Active Alerts", "items": [
    { "severity": "critical", "message": "CPU at 95%", "device": "APP-SRV-01", "time": "2m ago" },
    { "severity": "warning", "message": "Memory at 78%", "device": "DB-SRV-01", "time": "15m ago" }
  ]},
  { "type": "table", "title": "Service Metrics", "columns": ["Service", "Status", "CPU", "Memory", "Health"],
    "rows": [
      ["nginx", "Running", "12%", "340MB", "98%"],
      ["postgres", "Running", "45%", "2.1GB", "85%"]
    ]
  },
  { "type": "status_grid", "title": "Infrastructure Status", "items": [
    { "name": "Firewall", "status": "healthy" },
    { "name": "Load Balancer", "status": "warning" },
    { "name": "DNS", "status": "healthy" }
  ]},
  { "type": "progress", "title": "System Metrics", "items": [
    { "label": "CPU Utilization", "value": 45, "max": 100, "color": "blue" },
    { "label": "Memory Usage", "value": 72, "max": 100, "color": "amber" },
    { "label": "Disk I/O", "value": 23, "max": 100, "color": "green" }
  ]}
]
:::

Dashboard widget types available:
- "stat": KPI card with label, value, optional change/trend (up/down/neutral), color (blue/green/red/amber/emerald/purple)
- "health_list": List of items with health scores (0-100), status (healthy/warning/critical/offline), name, subtitle
- "alert_summary": List of alerts with severity (critical/high/warning/medium/low), message, device name, time
- "table": Data table with title, column headers, and row data arrays
- "status_grid": Grid of items with name and status (healthy/warning/critical/offline/unknown)
- "progress": Progress bars with label, value, max, color

RULES FOR DASHBOARDS:
- Use REAL data from the infrastructure context above — never make up fake values
- Place the :::dashboard block AFTER a brief text introduction
- You may include text commentary before and after dashboard blocks
- You can include multiple :::dashboard blocks in one response for different sections
- Stat cards should always come first, then detailed widgets
- Keep it focused on what the user asked about

PATCH DEPLOYMENT CAPABILITY:
You can autonomously apply/deploy/install patches. When the user asks to apply, deploy, install, or push a patch:
1. Identify the exact patch from the "Patches Available for Deployment" list — use the ID field exactly as shown (ID:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
2. Determine target assets: use ALL assets with a valid ProbeID by default, or only those the user specifies
3. After your explanation text, include a patch action block like this:

:::patch_action
{"action":"deploy","patchId":"<exact UUID>","patchTitle":"<patch title>","assetIds":["<assetUUID1>","<assetUUID2>"],"assetNames":["<asset name1>","<asset name2>"]}
:::

RULES FOR PATCH ACTIONS:
- The patchId MUST be the exact UUID from the "ID:" field in the Patches Available for Deployment list
- The assetIds MUST be exact UUIDs from the "ID:" field in the All Assets list — only include assets that have a real ProbeID (not "no probe")
- Only deploy patches with status "available" — if no available patches exist, tell the user
- Confirm in your text WHAT you are deploying and to WHICH assets before the action block
- If the user asks to deploy to a specific asset by name, match the name and use its UUID
- If no assetIds are specified by the user, target ALL assets that have a valid ProbeID
- Always explain what the patch does and why it should be applied before executing

GENERAL RULES:
- Start your response with a JSON line on the first line ONLY: {"agent":"<exact agent name or HOLOCRON AI Strategic Advisor>","reason":"<brief routing reason>"}
- Then provide the actual response content on subsequent lines
- For Mode 1 (specialist): Respond with the expertise and knowledge of the selected agent, reference managed assets when relevant
- For Mode 2 (strategic advisor): Respond as "HOLOCRON AI Strategic Advisor" with comprehensive, well-structured industry knowledge. Draw from ITIL, PMBOK, COBIT, TOGAF, ISO standards, and real-world best practices. Provide detailed, actionable guidance with clear sections, bullet points, and frameworks
- If the query spans multiple domains, choose the MOST relevant agent OR use Strategic Advisor for cross-cutting concerns
- Be specific, thorough, and actionable in ALL responses — the user expects expert-level depth
- Format responses with clear markdown: use headers (##), bullet points, numbered lists, bold for key terms, and tables where appropriate
- Never give superficial or generic answers — always provide concrete, detailed, professional guidance`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const { client: openai, model: _aiModel, providerName } = await getAiClient(req.user!.id);

      const stream = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory,
          { role: "user", content },
        ],
        stream: true,
        max_completion_tokens: 8192,
      }, { module: "agent-chat", endpoint: "/api/agent-chat/conversations/:id/messages", userId: req.user!.id, providerName });

      let fullResponse = "";
      let routingSent = false;
      let selectedAgentRoleId: string | null = null;
      let routingReason: string | null = null;

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullResponse += text;

          if (!routingSent && fullResponse.includes("\n")) {
            const firstLine = fullResponse.split("\n")[0].trim();
            try {
              const routing = JSON.parse(firstLine);
              if (routing.agent) {
                const matchedAgent = agentProfiles.find(a => a!.name === routing.agent);
                selectedAgentRoleId = matchedAgent?.roleId || null;
                routingReason = routing.reason || null;
                res.write(`data: ${JSON.stringify({ type: "routing", agentRoleId: selectedAgentRoleId, agentName: routing.agent, reason: routingReason })}\n\n`);
                routingSent = true;
                const remaining = fullResponse.substring(firstLine.length).replace(/^\n+/, "");
                if (remaining) {
                  res.write(`data: ${JSON.stringify({ type: "content", text: remaining })}\n\n`);
                }
                continue;
              }
            } catch {}
          }

          if (routingSent) {
            res.write(`data: ${JSON.stringify({ type: "content", text })}\n\n`);
          }
        }
      }

      if (!routingSent) {
        res.write(`data: ${JSON.stringify({ type: "content", text: fullResponse })}\n\n`);
      }

      const responseContent = routingSent ? fullResponse.substring(fullResponse.indexOf("\n") + 1).replace(/^\n+/, "") : fullResponse;

      // Execute any patch_action blocks the AI emitted
      const patchActionRegex = /:::patch_action\s*\n([\s\S]*?)\n:::/g;
      let patchMatch;
      while ((patchMatch = patchActionRegex.exec(responseContent)) !== null) {
        try {
          const action = JSON.parse(patchMatch[1].trim());
          if (action.action === "deploy" && action.patchId && Array.isArray(action.assetIds) && action.assetIds.length > 0) {
            const patch = await storage.getPatch(action.patchId, userId);
            if (patch && patch.status === "available") {
              const jobs: Array<{ jobId: string; assetId: string; assetName: string }> = [];
              for (let i = 0; i < action.assetIds.length; i++) {
                const assetId = action.assetIds[i];
                const asset = await storage.getDiscoveredAsset(assetId, userId);
                if (!asset?.probeId) continue;
                const job = await storage.createPatchJob({
                  userId,
                  patchId: patch.id,
                  assetId,
                  probeId: asset.probeId,
                  taskId: null as any,
                  status: "pending",
                });
                const task = await storage.createRemediationTask({
                  userId,
                  assetId,
                  probeId: asset.probeId,
                  title: `[PATCH] ${patch.title}`,
                  description: `Patch deployment: ${patch.title}${patch.cveId ? ` (${patch.cveId})` : ""}`,
                  remediationScript: patch.patchScript,
                  scriptType: patch.scriptType,
                  status: "pending",
                  riskLevel: patch.severity === "critical" ? "critical" : patch.severity === "high" ? "high" : "medium",
                  changeRef: patch.changeRef || null as any,
                  batchId: job.id,
                  isRollback: false,
                  parentTaskId: null as any,
                });
                await storage.updatePatchJob(job.id, { taskId: task.id, status: "executing", startedAt: new Date() });
                jobs.push({ jobId: job.id, assetId, assetName: action.assetNames?.[i] || asset.name });
              }
              if (jobs.length > 0) {
                await storage.updatePatch(patch.id, userId, { status: "deploying" });
                res.write(`data: ${JSON.stringify({
                  type: "patch_action",
                  result: {
                    patchId: patch.id,
                    patchTitle: patch.title,
                    severity: patch.severity,
                    status: "deploying",
                    assetCount: jobs.length,
                    jobs: jobs.map(j => ({ jobId: j.jobId, assetName: j.assetName })),
                  },
                })}\n\n`);
              }
            }
          }
        } catch (patchErr) {
          console.error("Patch action execution error:", patchErr);
        }
      }

      await storage.createAgentMessage({
        conversationId,
        role: "assistant",
        content: responseContent,
        agentRoleId: selectedAgentRoleId,
        routingReason,
        userId,
      });

      await storage.updateAgentConversation(conversationId, { updatedAt: new Date() });

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Agent chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", error: "Failed to process message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process message" });
      }
    }
  });

  // ── Log Aggregation ────────────────────────────────────────────────────────

  // Sources
  app.get("/api/log-sources", requireAuth, async (req, res) => {
    try {
      const sources = await storage.getLogSources(req.user!.id);
      res.json(sources);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/log-sources", requireAuth, async (req, res) => {
    try {
      const data = req.body;
      if (!data.name || !data.type) return res.status(400).json({ error: "name and type required" });
      const source = await storage.createLogSource({ ...data, userId: req.user!.id });
      res.status(201).json(source);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/log-sources/:id", requireAuth, async (req, res) => {
    try {
      const source = await storage.updateLogSource(req.params.id, req.user!.id, req.body);
      if (!source) return res.status(404).json({ error: "Not found" });
      res.json(source);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/log-sources/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteLogSource(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Log Entries — ingest
  // ── Log Ingest (production-grade: Kafka primary, in-process buffer fallback) ─
  //
  // Routing:
  //   KAFKA_BROKERS set  → send to Kafka topic → consumer group writes to DB
  //   KAFKA_BROKERS unset or Kafka unavailable → in-process write buffer → DB
  //
  // The ingest handler is always synchronous O(1) — it never waits for a DB write.
  // Rate limiting is enforced at this layer before any queueing occurs.
  app.post("/api/logs/ingest", requireAuth, async (req, res) => {
    try {
      const userId  = req.user!.id;
      const raw: any[] = Array.isArray(req.body) ? req.body : [req.body];
      if (raw.length === 0) return res.status(400).json({ error: "empty payload" });
      if (raw.length > 5_000) return res.status(400).json({ error: "batch too large (max 5000)" });

      // Rate limit keyed by sourceId (or userId as fallback)
      const sourceKey = raw[0]?.sourceId ?? userId;
      const { allowed, reason } = checkRateLimit(sourceKey);
      if (!allowed) {
        return res.status(429).json({
          error:        "rate limit exceeded",
          reason,
          retryAfterMs: 1_000,
        });
      }

      const entries = raw.map((e: any) => ({
        userId,
        sourceId:     e.sourceId     ?? null,
        deviceId:     e.deviceId     ?? null,
        level:        e.level        ?? "info",
        message:      String(e.message ?? ""),
        service:      e.service      ?? null,
        host:         e.host         ?? null,
        tags:         Array.isArray(e.tags) ? e.tags : [],
        metadata:     e.metadata     ?? null,
        logTimestamp: e.timestamp ? new Date(e.timestamp) : new Date(),
      }));

      let accepted = 0;
      let dropped  = 0;
      let mode     = "buffer";

      if (kafkaEnabled) {
        // ── Kafka path ─────────────────────────────────────────────────────────
        // Producer sends the batch as a single compressed message to the topic.
        // The consumer group (one consumer per instance) reads and bulk-inserts to DB.
        const { sent, error } = await kafkaSend(entries);
        if (sent) {
          accepted = entries.length;
          mode     = "kafka";
        } else {
          // Kafka unavailable — fall back to in-process buffer so ingest is never lost
          console.warn(`[ingest] Kafka send failed (${error}), falling back to buffer`);
          const result = logIngestBuffer.enqueue(entries);
          accepted = result.accepted;
          dropped  = result.dropped;
          mode     = "buffer-fallback";
        }
      } else {
        // ── In-process buffer path ─────────────────────────────────────────────
        const result = logIngestBuffer.enqueue(entries);
        accepted = result.accepted;
        dropped  = result.dropped;
      }

      // Coalesce source counter update — no SELECT, no per-ingest UPDATE
      const sourceId = raw[0]?.sourceId;
      if (sourceId && accepted > 0) incrementSourceCounter(sourceId, accepted);

      const status = dropped > 0 ? 207 : 202;
      return res.status(status).json({
        accepted,
        dropped,
        mode,
        ...(dropped > 0 && { warning: "buffer full — reduce ingest rate or scale horizontally" }),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Log Entries — search
  app.get("/api/logs", requireAuth, async (req, res) => {
    try {
      const PAGE_SIZE = 50;
      const page = parseInt(req.query.page as string ?? "1");
      const filters = {
        sourceId: req.query.sourceId as string | undefined,
        deviceId: req.query.deviceId as string | undefined,
        level: req.query.level as string | undefined,
        host: req.query.host as string | undefined,
        service: req.query.service as string | undefined,
        q: req.query.q as string | undefined,
        from: req.query.from ? new Date(req.query.from as string) : undefined,
        to: req.query.to ? new Date(req.query.to as string) : undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      };
      const [entries, total] = await Promise.all([
        storage.getLogEntries(req.user!.id, filters),
        storage.countLogEntries(req.user!.id, { level: filters.level, sourceId: filters.sourceId }),
      ]);
      res.json({ entries, total, page, pages: Math.ceil(total / PAGE_SIZE) });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/logs/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteLogEntry(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Retention Policies
  app.get("/api/log-retention-policies", requireAuth, async (req, res) => {
    try {
      res.json(await storage.getLogRetentionPolicies(req.user!.id));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/log-retention-policies", requireAuth, async (req, res) => {
    try {
      const { name, retentionDays, sourceId, level } = req.body;
      if (!name || !retentionDays) return res.status(400).json({ error: "name and retentionDays required" });
      const policy = await storage.createLogRetentionPolicy({ userId: req.user!.id, name, retentionDays: Number(retentionDays), sourceId: sourceId ?? null, level: level ?? null });
      res.status(201).json(policy);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/log-retention-policies/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteLogRetentionPolicy(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // MDM — Mobile Device Management (Android & iOS)
  // ══════════════════════════════════════════════════════════════════════════════

  // Stats overview
  app.get("/api/mdm/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getMdmStats(req.user!.id);
      res.json(stats);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Devices — list
  app.get("/api/mdm/devices", requireAuth, async (req, res) => {
    try {
      const { platform, status, complianceStatus } = req.query as Record<string, string>;
      const devices = await storage.getMdmDevices(req.user!.id, { platform, status, complianceStatus });
      res.json(devices);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Devices — create (manual registration)
  app.post("/api/mdm/devices", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.user!.id, status: "pending", enrollmentDate: new Date() };
      const device = await storage.createMdmDevice(data);
      res.json(device);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Devices — get single
  app.get("/api/mdm/devices/:id", requireAuth, async (req, res) => {
    try {
      const device = await storage.getMdmDevice(req.params.id, req.user!.id);
      if (!device) return res.status(404).json({ error: "Device not found" });
      res.json(device);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Devices — update
  app.patch("/api/mdm/devices/:id", requireAuth, async (req, res) => {
    try {
      const device = await storage.getMdmDevice(req.params.id, req.user!.id);
      if (!device) return res.status(404).json({ error: "Device not found" });
      const updated = await storage.updateMdmDevice(req.params.id, req.user!.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Devices — delete
  app.delete("/api/mdm/devices/:id", requireAuth, async (req, res) => {
    try {
      const device = await storage.getMdmDevice(req.params.id, req.user!.id);
      if (!device) return res.status(404).json({ error: "Device not found" });
      await storage.deleteMdmDevice(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Devices — remote actions (lock, wipe, message, locate, push_policy, block, unblock, retire)
  app.post("/api/mdm/devices/:id/actions", requireAuth, async (req, res) => {
    try {
      const device = await storage.getMdmDevice(req.params.id, req.user!.id);
      if (!device) return res.status(404).json({ error: "Device not found" });
      const { action, payload } = req.body as { action: string; payload?: Record<string, any> };
      if (!action) return res.status(400).json({ error: "action is required" });
      const validActions = ["lock", "wipe", "message", "locate", "push_policy", "block", "unblock", "retire", "reactivate", "checkin"];
      if (!validActions.includes(action)) return res.status(400).json({ error: "Invalid action" });

      // Create action record
      const mdmAction = await storage.createMdmAction({ userId: req.user!.id, deviceId: device.id, action, status: "sent", payload: payload ?? {} });

      // Apply state changes for synchronous actions
      let deviceUpdates: Record<string, any> = {};
      if (action === "block") deviceUpdates = { status: "blocked" };
      else if (action === "unblock") deviceUpdates = { status: "enrolled" };
      else if (action === "retire") deviceUpdates = { status: "retired" };
      else if (action === "reactivate") {
        const meta = (device.metadata as any) ?? {};
        const { wiped: _w, wipedAt: _wa, ...cleanMeta } = meta;
        deviceUpdates = { status: "enrolled", complianceStatus: "compliant", metadata: { ...cleanMeta, reactivatedAt: new Date().toISOString() } };
      }
      else if (action === "wipe") deviceUpdates = { status: "retired", complianceStatus: "unknown", metadata: { ...((device.metadata as any) ?? {}), wiped: true, wipedAt: new Date().toISOString() } };
      else if (action === "checkin") deviceUpdates = { lastCheckIn: new Date() };

      if (Object.keys(deviceUpdates).length > 0) {
        await storage.updateMdmDevice(device.id, req.user!.id, deviceUpdates);
      }

      // Mark action complete
      await storage.updateMdmAction(mdmAction.id, { status: "completed", completedAt: new Date(), result: `Action '${action}' sent to device` });

      res.json({ success: true, action: mdmAction });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Devices — action history
  app.get("/api/mdm/devices/:id/actions", requireAuth, async (req, res) => {
    try {
      const device = await storage.getMdmDevice(req.params.id, req.user!.id);
      if (!device) return res.status(404).json({ error: "Device not found" });
      const actions = await storage.getMdmActions(req.user!.id, req.params.id);
      res.json(actions);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Policies — list
  app.get("/api/mdm/policies", requireAuth, async (req, res) => {
    try {
      const policies = await storage.getMdmPolicies(req.user!.id);
      res.json(policies);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Policies — create
  app.post("/api/mdm/policies", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body, userId: req.user!.id };
      const policy = await storage.createMdmPolicy(data);
      res.json(policy);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Policies — update
  app.patch("/api/mdm/policies/:id", requireAuth, async (req, res) => {
    try {
      const policy = await storage.getMdmPolicy(req.params.id, req.user!.id);
      if (!policy) return res.status(404).json({ error: "Policy not found" });
      const updated = await storage.updateMdmPolicy(req.params.id, req.user!.id, req.body);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Policies — delete
  app.delete("/api/mdm/policies/:id", requireAuth, async (req, res) => {
    try {
      const policy = await storage.getMdmPolicy(req.params.id, req.user!.id);
      if (!policy) return res.status(404).json({ error: "Policy not found" });
      await storage.deleteMdmPolicy(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Enrollment Tokens — list
  app.get("/api/mdm/tokens", requireAuth, async (req, res) => {
    try {
      const tokens = await storage.getMdmEnrollmentTokensByUser(req.user!.id);
      res.json(tokens);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Enrollment Tokens — generate
  app.post("/api/mdm/tokens", requireAuth, async (req, res) => {
    try {
      const { platform, label, expiresInHours = 48 } = req.body as { platform: string; label?: string; expiresInHours?: number };
      if (!platform || !["ios", "android"].includes(platform)) return res.status(400).json({ error: "platform must be ios or android" });
      const token = randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));
      const record = await storage.createMdmEnrollmentToken({ userId: req.user!.id, token, platform, label: label ?? null, expiresAt });
      res.json(record);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Enrollment Tokens — delete
  app.delete("/api/mdm/tokens/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteMdmEnrollmentToken(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Enrollment — device self-enrollment (public endpoint, no auth needed)
  app.get("/api/mdm/enroll/:token", async (req, res) => {
    try {
      const record = await storage.getMdmEnrollmentToken(req.params.token);
      if (!record) return res.status(404).json({ error: "Invalid enrollment token" });
      if (record.usedAt) return res.status(410).json({ error: "Enrollment token already used" });
      if (new Date() > new Date(record.expiresAt)) return res.status(410).json({ error: "Enrollment token expired" });
      res.json({ valid: true, platform: record.platform, label: record.label, expiresAt: record.expiresAt });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/mdm/enroll/:token", async (req, res) => {
    try {
      const record = await storage.getMdmEnrollmentToken(req.params.token);
      if (!record) return res.status(404).json({ error: "Invalid enrollment token" });
      if (record.usedAt) return res.status(410).json({ error: "Enrollment token already used" });
      if (new Date() > new Date(record.expiresAt)) return res.status(410).json({ error: "Enrollment token expired" });

      const { name, model, manufacturer, osVersion, serialNumber, imei, phoneNumber, ownership, department } = req.body;
      if (!name) return res.status(400).json({ error: "Device name is required" });

      const device = await storage.createMdmDevice({
        userId: record.userId,
        name,
        platform: record.platform,
        model: model ?? null,
        manufacturer: manufacturer ?? null,
        osVersion: osVersion ?? null,
        serialNumber: serialNumber ?? null,
        imei: imei ?? null,
        phoneNumber: phoneNumber ?? null,
        status: "enrolled",
        complianceStatus: "unknown",
        ownership: ownership ?? "corporate",
        department: department ?? null,
        enrolledBy: name,
        enrollmentToken: record.token,
        enrollmentDate: new Date(),
        lastCheckIn: new Date(),
        metadata: { userAgent: req.headers["user-agent"] ?? "unknown", enrolledViaToken: true },
      });

      await storage.markMdmEnrollmentTokenUsed(record.token, device.id);
      res.json({ success: true, deviceId: device.id, platform: device.platform });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Purge expired logs (applies all active retention policies)
  app.post("/api/logs/purge", requireAuth, async (req, res) => {
    try {
      const policies = await storage.getLogRetentionPolicies(req.user!.id);
      let totalPurged = 0;
      if (policies.length === 0) {
        // Default 90-day retention if no policies defined
        totalPurged = await storage.purgeExpiredLogs(req.user!.id, 90);
      } else {
        for (const p of policies) {
          totalPurged += await storage.purgeExpiredLogs(req.user!.id, p.retentionDays, p.sourceId ?? undefined);
        }
      }
      res.json({ purged: totalPurged });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // AI — Log Pattern Analysis (KB-first)
  app.post("/api/logs/analyze", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const cdKey = `log_analysis:${userId}`;
      const cdCheck = isAiOnCooldown(cdKey, 15 * 60 * 1000);
      if (cdCheck.blocked) return res.status(429).json({ error: `Log analysis was run recently. Try again in ${cdCheck.remainingSec}s.` });

      // Fetch recent logs for analysis
      const recent = await storage.getLogEntries(userId, { limit: 200 });
      if (recent.length === 0) return res.status(400).json({ error: "No log entries to analyze" });

      const logCacheTag = `ai_cache:log_analysis:${userId}`;
      const kbHit = await kbLookup(logCacheTag, 6 * 60 * 60 * 1000); // 6h TTL
      if (kbHit.hit && kbHit.content) {
        try {
          const cached = JSON.parse(kbHit.content);
          console.log(`[KB-HIT] log_analysis: ${logCacheTag}`);
          return res.json({ ...cached, fromKnowledgeBase: true });
        } catch { /* fall through */ }
      }

      const { client: openai, model: _aiModel, providerName } = await getAiClient(userId);
      setAiCooldown(cdKey);

      const levelCounts = recent.reduce((acc: Record<string, number>, e) => { acc[e.level] = (acc[e.level] || 0) + 1; return acc; }, {});
      const hostCounts = recent.reduce((acc: Record<string, number>, e) => { if (e.host) acc[e.host] = (acc[e.host] || 0) + 1; return acc; }, {});
      const serviceCounts = recent.reduce((acc: Record<string, number>, e) => { if (e.service) acc[e.service] = (acc[e.service] || 0) + 1; return acc; }, {});
      const errorMessages = recent.filter(e => e.level === "error" || e.level === "critical").slice(0, 30).map(e => ({ host: e.host, service: e.service, msg: e.message.slice(0, 200), ts: e.logTimestamp }));

      const response = await callAiLogged(openai, {
        model: _aiModel,
        messages: [
          {
            role: "system",
            content: `You are the HOLOCRON AI Log Intelligence engine. Analyze log patterns to detect anomalies, recurring issues, and operational risks.

Respond in this exact JSON format:
{
  "summary": "Brief overall assessment of log health",
  "anomalies": [
    { "type": "spike|silence|pattern", "severity": "low|medium|high|critical", "description": "What was detected", "affectedHosts": ["host1"], "affectedServices": ["svc1"], "recommendation": "What to do" }
  ],
  "patterns": [
    { "pattern": "Pattern name", "occurrences": 5, "description": "What it means", "risk": "low|medium|high" }
  ],
  "topIssues": ["Issue 1", "Issue 2", "Issue 3"],
  "healthScore": 85,
  "recommendations": ["Action 1", "Action 2"]
}`
          },
          {
            role: "user",
            content: `RECENT LOG SUMMARY (${recent.length} entries):
Level distribution: ${JSON.stringify(levelCounts)}
Top hosts: ${JSON.stringify(Object.entries(hostCounts).sort(([,a],[,b]) => b-a).slice(0,10))}
Top services: ${JSON.stringify(Object.entries(serviceCounts).sort(([,a],[,b]) => b-a).slice(0,10))}
Time range: ${recent[recent.length-1]?.logTimestamp} to ${recent[0]?.logTimestamp}

ERRORS AND CRITICAL ENTRIES (last 30):
${errorMessages.map(e => `[${e.ts}] ${e.host}/${e.service}: ${e.msg}`).join("\n")}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      }, { module: "log-analysis", endpoint: "/api/logs/analyze", userId: req.user!.id, providerName });

      let analysis;
      try { analysis = JSON.parse(response.choices[0]?.message?.content || "{}"); }
      catch { analysis = { summary: "Analysis failed", anomalies: [], patterns: [], topIssues: [], healthScore: 50, recommendations: [] }; }

      kbStore(logCacheTag, `Log Pattern Analysis — ${new Date().toLocaleDateString()}`, JSON.stringify(analysis), userId, kbHit.articleId);
      res.json(analysis);
    } catch (err: any) {
      console.error("Log analysis error:", err);
      res.status(500).json({ error: "Log analysis failed", details: err.message });
    }
  });

  // ── End Log Aggregation ────────────────────────────────────────────────────

  // ── Background: Pre-generate scripts for empty queued tasks ────────────────
  const regenEmptyTaskScripts = async () => {
    try {
      const emptyTasks = await storage.getQueuedTasksWithEmptyScripts();
      if (emptyTasks.length === 0) return;
      console.log(`[REGEN] Found ${emptyTasks.length} queued task(s) with empty scripts — regenerating`);
      for (const t of emptyTasks) {
        try {
          const probe = t.probeId ? await storage.getDiscoveryProbe(t.probeId) : null;
          const probeIsWindows = probe ? /windows/i.test(probe.osInfo || "") : false;
          const effectiveScriptType = probeIsWindows ? "powershell" : "bash";
          const osName = probe?.osInfo || (probeIsWindows ? "Windows" : "Linux");
          const { client: aiClient, model: aiModel } = await getAiClient(t.userId!);
          const rsp = await aiClient.chat.completions.create({
            model: aiModel,
            messages: [
              { role: "system", content: `You are a senior systems administrator. Respond ONLY with valid JSON containing "script" and "rollbackScript" string fields. Write ${effectiveScriptType} scripts only. No markdown fences inside strings.` },
              { role: "user", content: `Generate a ${effectiveScriptType} remediation script for: "${t.title}". Target OS: ${osName}. Return JSON with "script" and "rollbackScript".` }
            ],
            temperature: 0.3,
            max_tokens: 3000,
            response_format: { type: "json_object" },
          });
          const rawJson = rsp.choices[0]?.message?.content?.trim() || "";
          if (!rawJson) continue;
          const parsed = JSON.parse(rawJson);
          const newScript = decodeScriptEntities((parsed.script || "").replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim());
          const newRollback = parsed.rollbackScript ? decodeScriptEntities((parsed.rollbackScript as string).replace(/^```(?:powershell|bash|sh)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()) : null;
          if (newScript) {
            await storage.updateRemediationTask(t.id, {
              remediationScript: newScript,
              rollbackScript: newRollback || t.rollbackScript || null,
              scriptType: effectiveScriptType,
            });
            console.log(`[REGEN] ✓ Script ready for task ${t.id} (${t.title.substring(0, 50)})`);
          }
        } catch (err: any) {
          console.error(`[REGEN] ✗ Failed task ${t.id}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error("[REGEN] Background regen error:", err.message);
    }
  };

  // Mark assets offline when their probe has gone quiet
  const markStaleAssetsOffline = async () => {
    try {
      const allProbes = await storage.getAllDiscoveryProbes();
      for (const probe of allProbes) {
        if (!probe.enrolled || !probe.lastHeartbeat) continue;
        const diffSec = (Date.now() - new Date(probe.lastHeartbeat).getTime()) / 1000;
        const interval = probe.heartbeatInterval || 60;
        if (diffSec > interval * 5) {
          // Probe is offline — mark its assets offline
          const assets = await storage.getDiscoveredAssets(probe.userId!, { probeId: probe.id });
          for (const asset of assets) {
            if (asset.status === "online") {
              await storage.updateDiscoveredAsset(asset.id, { status: "offline" });
            }
          }
        }
      }
    } catch {}
  };

  // Run once after a short startup delay, then every 5 minutes
  setTimeout(() => { regenEmptyTaskScripts(); markStaleAssetsOffline(); }, 8000);
  setInterval(() => { regenEmptyTaskScripts(); markStaleAssetsOffline(); }, 5 * 60 * 1000);
  // ── End Background Regen ──────────────────────────────────────────────────

  // ── AI Output Analysis ────────────────────────────────────────────────────
  app.post("/api/remediation-tasks/:taskId/ai-analyze", requireAuth, async (req, res) => {
    try {
      const task = await storage.getRemediationTask(req.params.taskId);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (task.userId !== req.user!.id) return res.status(403).json({ error: "Unauthorized" });
      if (task.status !== "completed") return res.status(400).json({ error: "Only completed tasks can be analyzed" });

      const cacheKey = `analyze-${task.id}`;
      const { db: analyzeDb } = await import("./storage");
      const { knowledgeArticles: kaTable } = await import("../shared/schema");
      const { sql: analyzeSql } = await import("drizzle-orm");
      const cacheTag = cacheKey;
      const cachedRows = await analyzeDb.select().from(kaTable)
        .where(analyzeSql`${kaTable.category} = 'command-analyze-cache' AND ${cacheTag} = ANY(${kaTable.tags})`)
        .limit(1);
      if (cachedRows.length > 0) {
        return res.json({ ...JSON.parse(cachedRows[0].content), cacheHit: true });
      }

      const aiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!aiKey) return res.status(503).json({ error: "AI service unavailable" });

      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: aiKey, ...(baseURL ? { baseURL } : {}) });

      const scriptSnippet = (task.remediationScript || "").substring(0, 400);
      const outputSnippet = (task.result || task.error || "No output").substring(0, 800);
      const prompt = `Analyze this IT command execution. Return ONLY a JSON object with these exact fields:
{"healthScore":number,"verdict":"healthy|warning|degraded|critical","summary":"one sentence","findings":[{"title":"string","detail":"string","severity":"info|warning|critical"}],"recommendations":["string"]}

Script type: ${task.scriptType}
Script: ${scriptSnippet}
Output: ${outputSnippet}
Status: ${task.status}`;

      const resp = await callAiLogged(openai, {
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 600,
      }, { module: "remediation", endpoint: "/api/remediation-tasks/:taskId/ai-analyze", userId: req.user!.id, providerName });

      const rawContent = resp.choices[0]?.message?.content || "{}";
      let analysis: any;
      try {
        analysis = JSON.parse(rawContent);
      } catch {
        analysis = { healthScore: 50, verdict: "warning", summary: "Analysis could not be parsed.", findings: [], recommendations: [] };
      }
      // Cache result
      await storage.createKnowledgeArticle({
        title: `AI Analysis: ${cacheKey}`,
        content: JSON.stringify(analysis),
        category: "command-analyze-cache",
        tags: [cacheTag, "ai-analyze-cache"],
        status: "internal",
        authorId: req.user!.id,
      } as any);

      res.json({ ...analysis, cacheHit: false });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Command History ───────────────────────────────────────────────────────
  app.get("/api/command-history", requireAuth, async (req, res) => {
    try {
      const { status, assetId, limit, offset } = req.query as Record<string, string>;
      const result = await storage.getCommandHistory(req.user!.id, {
        status: status || undefined,
        assetId: assetId || undefined,
        limit: limit ? parseInt(limit) : 200,
        offset: offset ? parseInt(offset) : 0,
      });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Command Schedules ─────────────────────────────────────────────────────
  app.get("/api/command-schedules", requireAuth, async (req, res) => {
    try {
      const schedules = await storage.getCommandSchedules(req.user!.id);
      res.json(schedules);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/command-schedules", requireAuth, async (req, res) => {
    try {
      const { name, description, script, scriptType, assetIds, cronExpression, riskLevel, category, catalogEntryId, changeRef } = req.body;
      if (!name || !script || !cronExpression || !Array.isArray(assetIds) || assetIds.length === 0)
        return res.status(400).json({ error: "name, script, cronExpression, and assetIds[] are required" });
      // Compute nextRunAt from cron
      const nextRunAt = computeNextCronRun(cronExpression);
      const sched = await storage.createCommandSchedule({
        userId: req.user!.id, name, description: description || null,
        script, scriptType: scriptType || "bash",
        assetIds, cronExpression, enabled: true,
        riskLevel: riskLevel || "low", category: category || "general",
        catalogEntryId: catalogEntryId || null, changeRef: changeRef || null,
      });
      // Set nextRunAt
      await storage.updateCommandSchedule(sched.id, req.user!.id, { nextRunAt });
      res.status(201).json({ ...sched, nextRunAt });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/command-schedules/:id", requireAuth, async (req, res) => {
    try {
      const updates = { ...req.body };
      if (updates.cronExpression) updates.nextRunAt = computeNextCronRun(updates.cronExpression);
      const sched = await storage.updateCommandSchedule(req.params.id, req.user!.id, updates);
      if (!sched) return res.status(404).json({ error: "Schedule not found" });
      res.json(sched);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/command-schedules/:id", requireAuth, async (req, res) => {
    try {
      const ok = await storage.deleteCommandSchedule(req.params.id, req.user!.id);
      if (!ok) return res.status(404).json({ error: "Schedule not found" });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Command Approvals ─────────────────────────────────────────────────────
  app.get("/api/command-approvals", requireAuth, async (req, res) => {
    try {
      const { status } = req.query as Record<string, string>;
      const approvals = await storage.getCommandApprovals({ status: status || "pending" });
      res.json(approvals);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/command-approvals/:id/approve", requireAuth, async (req, res) => {
    try {
      const approval = await storage.getCommandApproval(req.params.id);
      if (!approval) return res.status(404).json({ error: "Approval not found" });
      if (approval.requestedById === req.user!.id)
        return res.status(403).json({ error: "Cannot self-approve — 4-Eyes rule requires a different approver" });
      if (approval.status !== "pending") return res.status(400).json({ error: `Approval already ${approval.status}` });

      const user = await storage.getUser(req.user!.id);
      const updated = await storage.updateCommandApproval(approval.id, {
        status: "approved",
        approvedById: req.user!.id,
        approvedByName: user?.displayName || user?.username || req.user!.id,
        notes: req.body.notes || null,
        resolvedAt: new Date(),
      });
      // Release the task: move from pending_approval → queued and set approvedAt
      await storage.updateRemediationTask(approval.taskId, { status: "queued", approvedAt: new Date() });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/command-approvals/:id/reject", requireAuth, async (req, res) => {
    try {
      const approval = await storage.getCommandApproval(req.params.id);
      if (!approval) return res.status(404).json({ error: "Approval not found" });
      if (approval.status !== "pending") return res.status(400).json({ error: `Approval already ${approval.status}` });

      const user = await storage.getUser(req.user!.id);
      const updated = await storage.updateCommandApproval(approval.id, {
        status: "rejected",
        approvedById: req.user!.id,
        approvedByName: user?.displayName || user?.username || req.user!.id,
        notes: req.body.notes || null,
        resolvedAt: new Date(),
      });
      // Cancel the task
      await storage.updateRemediationTask(approval.taskId, { status: "rejected" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Schedule Runner ───────────────────────────────────────────────────────
  function computeNextCronRun(cron: string): Date {
    // Parse simple cron: minute hour dom month dow
    // We support: "*/N" intervals and fixed values for the most common patterns
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return new Date(Date.now() + 60 * 60 * 1000); // fallback 1h
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    const [minPart, hourPart] = parts;
    if (minPart.startsWith("*/")) {
      const interval = parseInt(minPart.slice(2));
      if (!isNaN(interval) && interval > 0) {
        const mins = next.getMinutes();
        const rem = mins % interval;
        next.setMinutes(mins + (rem === 0 ? 0 : interval - rem));
        return next;
      }
    }
    if (hourPart.startsWith("*/")) {
      const interval = parseInt(hourPart.slice(2));
      if (!isNaN(interval) && interval > 0) {
        next.setMinutes(minPart === "0" ? 0 : 0);
        const hours = next.getHours();
        const rem = hours % interval;
        next.setHours(hours + (rem === 0 ? 0 : interval - rem));
        return next;
      }
    }
    // Default: 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000);
  }

  async function runDueSchedules() {
    try {
      const due = await storage.getDueSchedules();
      for (const sched of due) {
        const batchId = `sched-${sched.id}-${Date.now()}`;
        for (const assetId of sched.assetIds) {
          const asset = await storage.getDiscoveredAsset(assetId, sched.userId);
          if (!asset || !asset.probeId) continue;
          const task = await storage.createRemediationTask({
            userId: sched.userId,
            assetId,
            probeId: asset.probeId,
            title: `[SCHED] ${sched.name}`,
            description: `Scheduled run: ${sched.cronExpression}`,
            remediationScript: sched.script,
            rollbackScript: null,
            scriptType: sched.scriptType,
            status: 'queued',
            batchId,
            category: sched.category,
            riskLevel: sched.riskLevel,
            originType: 'autonomous',
            changeRef: sched.changeRef || null,
          } as any);
          await storage.updateRemediationTask(task.id, { approvedAt: new Date() });
        }
        const nextRunAt = computeNextCronRun(sched.cronExpression);
        await storage.updateCommandSchedule(sched.id, sched.userId, {
          lastRunAt: new Date(),
          lastBatchId: batchId,
          nextRunAt,
          runCount: (sched.runCount || 0) + 1,
        });
        console.log(`[SCHEDULER] Ran schedule "${sched.name}" (${sched.id}) → batch ${batchId}`);
      }
    } catch (err) { console.error("[SCHEDULER] Error:", err); }
  }

  // Check schedules every minute
  setInterval(runDueSchedules, 60 * 1000);

  // ── Patch Management ───────────────────────────────────────────────────────
  app.get("/api/patches", requireAuth, async (req, res) => {
    try {
      const { status, severity } = req.query as any;
      const data = await storage.getPatches(req.user!.id, { status, severity });
      res.json(data);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/patches", requireAuth, async (req, res) => {
    try {
      const patch = await storage.createPatch({ ...req.body, userId: req.user!.id });
      res.json(patch);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/patches/:id", requireAuth, async (req, res) => {
    try {
      const patch = await storage.getPatch(req.params.id, req.user!.id);
      if (!patch) return res.status(404).json({ error: "Not found" });
      res.json(patch);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/patches/:id", requireAuth, async (req, res) => {
    try {
      const patch = await storage.updatePatch(req.params.id, req.user!.id, req.body);
      if (!patch) return res.status(404).json({ error: "Not found" });
      res.json(patch);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/patches/:id", requireAuth, async (req, res) => {
    try {
      const ok = await storage.deletePatch(req.params.id, req.user!.id);
      res.json({ success: ok });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/patches/ai-prioritize", requireAuth, async (req, res) => {
    try {
      const patchList = await storage.getPatches(req.user!.id);
      if (patchList.length === 0) return res.json({ updated: 0 });
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      if (!apiKey) return res.status(503).json({ error: "AI prioritization unavailable — no API key configured" });
      const { OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
      const summary = patchList.map(p => ({
        id: p.id, title: p.title, severity: p.severity, cvss: p.cvssScore, cve: p.cveId, type: p.patchType, status: p.status,
      }));
      const completion = await callAiLogged(openai, {
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        max_tokens: 800,
        messages: [{
          role: "system",
          content: "You are a cybersecurity patch prioritization AI. Return JSON: { \"priorities\": [ { \"id\": \"...\", \"priority\": 1-100, \"notes\": \"brief reason\" } ] }. Higher priority = deploy first. Base on CVSS score, severity, and patch type.",
        }, {
          role: "user",
          content: `Prioritize these patches: ${JSON.stringify(summary)}`,
        }],
      }, { module: "patch-management", endpoint: "/api/patches/ai-prioritize", userId: req.user!.id, providerName });
      let parsed: any = {};
      try { parsed = JSON.parse(completion.choices[0].message.content || "{}"); } catch { parsed = { priorities: [] }; }
      const priorities: Array<{ id: string; priority: number; notes: string }> = parsed.priorities || [];
      let updated = 0;
      for (const p of priorities) {
        await storage.updatePatch(p.id, req.user!.id, { aiPriority: p.priority, aiNotes: p.notes });
        updated++;
      }
      res.json({ updated });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/patches/:id/deploy", requireAuth, async (req, res) => {
    try {
      const patch = await storage.getPatch(req.params.id, req.user!.id);
      if (!patch) return res.status(404).json({ error: "Patch not found" });
      const { assetIds } = req.body as { assetIds: string[] };
      if (!assetIds || assetIds.length === 0) return res.status(400).json({ error: "No assets selected" });
      const jobs = [];
      for (const assetId of assetIds) {
        const asset = await storage.getDiscoveredAsset(assetId, req.user!.id);
        if (!asset?.probeId) continue;
        const job = await storage.createPatchJob({
          userId: req.user!.id,
          patchId: patch.id,
          assetId,
          probeId: asset.probeId,
          taskId: null as any,
          status: "pending",
        });
        // Dispatch via remediation task
        const task = await storage.createRemediationTask({
          userId: req.user!.id,
          assetId,
          probeId: asset.probeId,
          title: `[PATCH] ${patch.title}`,
          description: `Patch deployment: ${patch.title}${patch.cveId ? ` (${patch.cveId})` : ""}`,
          remediationScript: patch.patchScript,
          scriptType: patch.scriptType,
          status: "pending",
          riskLevel: patch.severity === "critical" ? "critical" : patch.severity === "high" ? "high" : "medium",
          changeRef: patch.changeRef || null as any,
          batchId: job.id,
          isRollback: false,
          parentTaskId: null as any,
        });
        await storage.updatePatchJob(job.id, { taskId: task.id, status: "executing", startedAt: new Date() });
        jobs.push({ jobId: job.id, taskId: task.id, assetId });
      }
      await storage.updatePatch(patch.id, req.user!.id, { status: "deploying" });
      res.json({ jobs });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/patch-jobs", requireAuth, async (req, res) => {
    try {
      const { patchId } = req.query as any;
      const jobs = await storage.getPatchJobs(req.user!.id, patchId);
      // Sync status from underlying remediation tasks
      const enriched = await Promise.all(jobs.map(async (j) => {
        if (j.taskId && (j.status === "executing" || j.status === "pending")) {
          const task = await storage.getRemediationTask(j.taskId);
          if (task) {
            let newStatus = j.status;
            if (task.status === "completed") newStatus = "completed";
            else if (task.status === "failed") newStatus = "failed";
            if (newStatus !== j.status) {
              await storage.updatePatchJob(j.id, {
                status: newStatus,
                result: task.output || null as any,
                error: task.errorOutput || null as any,
                completedAt: newStatus !== j.status ? new Date() : undefined as any,
              });
              return { ...j, status: newStatus, result: task.output, error: task.errorOutput };
            }
          }
        }
        return j;
      }));
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Autonomous Validation ───────────────────────────────────────────────────

  // Providers
  app.get("/api/validation/providers", requireAuth, async (req, res) => {
    try { res.json(await storage.getValidationProviders(req.user!.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/providers", requireAuth, async (req, res) => {
    try {
      const p = await storage.createValidationProvider({ ...req.body, userId: req.user!.id });
      res.json(p);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/validation/providers/:id", requireAuth, async (req, res) => {
    try {
      const p = await storage.updateValidationProvider(req.params.id, req.user!.id, req.body);
      if (!p) return res.status(404).json({ error: "Provider not found" });
      res.json(p);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/validation/providers/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteValidationProvider(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/providers/:id/test-connection", requireAuth, async (req, res) => {
    try {
      const provider = await storage.getValidationProvider(req.params.id, req.user!.id);
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      const adapter = getProviderAdapter(provider.type);
      const result = await adapter.testConnection();
      await storage.updateValidationProvider(req.params.id, req.user!.id, {
        status: result.success ? "connected" : "error",
        lastCheckedAt: new Date(),
      });
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/validation/providers/:id/environments", requireAuth, async (req, res) => {
    try {
      const provider = await storage.getValidationProvider(req.params.id, req.user!.id);
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      const adapter = getProviderAdapter(provider.type);
      const envs = await adapter.listEnvironments();
      res.json(envs);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Environments
  app.get("/api/validation/environments", requireAuth, async (req, res) => {
    try { res.json(await storage.getValidationEnvironments(req.user!.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/environments", requireAuth, async (req, res) => {
    try {
      const env = await storage.createValidationEnvironment({ ...req.body, userId: req.user!.id });
      res.json(env);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/environments/:id/reserve", requireAuth, async (req, res) => {
    try {
      const env = await storage.getValidationEnvironment(req.params.id, req.user!.id);
      if (!env) return res.status(404).json({ error: "Environment not found" });
      const provider = await storage.getValidationProvider(env.providerId, req.user!.id);
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      await storage.updateValidationEnvironment(req.params.id, req.user!.id, { status: "reserving" });
      const adapter = getProviderAdapter(provider.type);
      const { providerEnvId } = await adapter.reserveEnvironment(env.providerEnvId || env.id);
      const updated = await storage.updateValidationEnvironment(req.params.id, req.user!.id, {
        status: "active", providerEnvId, reservedAt: new Date(),
      });
      res.json(updated);
    } catch (err: any) {
      await storage.updateValidationEnvironment(req.params.id, req.user!.id, { status: "error" });
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/validation/environments/:id/release", requireAuth, async (req, res) => {
    try {
      const env = await storage.getValidationEnvironment(req.params.id, req.user!.id);
      if (!env) return res.status(404).json({ error: "Environment not found" });
      const provider = await storage.getValidationProvider(env.providerId, req.user!.id);
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      await storage.updateValidationEnvironment(req.params.id, req.user!.id, { status: "releasing" });
      const adapter = getProviderAdapter(provider.type);
      if (env.providerEnvId) await adapter.releaseEnvironment(env.providerEnvId);
      const updated = await storage.updateValidationEnvironment(req.params.id, req.user!.id, {
        status: "idle", releasedAt: new Date(),
      });
      res.json(updated);
    } catch (err: any) {
      await storage.updateValidationEnvironment(req.params.id, req.user!.id, { status: "error" });
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/validation/environments/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteValidationEnvironment(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Virtual Assets / Discovery
  app.get("/api/validation/environments/:id/assets", requireAuth, async (req, res) => {
    try {
      res.json(await storage.getValidationVirtualAssets(req.params.id, req.user!.id));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/environments/:id/discover", requireAuth, async (req, res) => {
    try {
      const env = await storage.getValidationEnvironment(req.params.id, req.user!.id);
      if (!env) return res.status(404).json({ error: "Environment not found" });
      const provider = await storage.getValidationProvider(env.providerId, req.user!.id);
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      const adapter = getProviderAdapter(provider.type);
      const mockAssets = await adapter.discoverAssets(env.providerEnvId || env.id);
      await storage.deleteValidationVirtualAssets(req.params.id, req.user!.id);
      const assets = await Promise.all(mockAssets.map(a => storage.createValidationVirtualAsset({
        environmentId: req.params.id,
        userId: req.user!.id,
        name: a.name,
        type: a.type,
        ipAddress: a.ipAddress,
        macAddress: a.macAddress,
        vendor: a.vendor,
        model: a.model,
        os: a.os,
        status: a.status,
        interfaces: a.interfaces as any,
        metadata: {},
      })));
      await storage.updateValidationEnvironment(req.params.id, req.user!.id, { nodeCount: assets.length });
      res.json(assets);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Probe Deployments
  app.get("/api/validation/probe-deployments", requireAuth, async (req, res) => {
    try {
      const { environmentId } = req.query as any;
      res.json(await storage.getValidationProbeDeployments(req.user!.id, environmentId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/probe-deployments", requireAuth, async (req, res) => {
    try {
      const env = await storage.getValidationEnvironment(req.body.environmentId, req.user!.id);
      if (!env) return res.status(404).json({ error: "Environment not found" });
      const provider = await storage.getValidationProvider(env.providerId, req.user!.id);
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      const deployment = await storage.createValidationProbeDeployment({
        ...req.body,
        userId: req.user!.id,
        status: "deploying",
      });
      const adapter = getProviderAdapter(provider.type);
      const { containerId } = await adapter.deployProbe({
        probeName: req.body.probeName,
        environmentId: env.id,
        targetAssets: req.body.targetAssetIds || [],
        config: req.body.config || {},
      });
      const updated = await storage.updateValidationProbeDeployment(deployment.id, req.user!.id, {
        status: "active",
        deployedAt: new Date(),
        lastHeartbeat: new Date(),
        config: { ...req.body.config, containerId },
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/validation/probe-deployments/:id", requireAuth, async (req, res) => {
    try {
      const dep = await storage.getValidationProbeDeployment(req.params.id, req.user!.id);
      if (!dep) return res.status(404).json({ error: "Deployment not found" });
      const env = await storage.getValidationEnvironment(dep.environmentId, req.user!.id);
      if (env) {
        const provider = await storage.getValidationProvider(env.providerId, req.user!.id);
        if (provider) {
          const adapter = getProviderAdapter(provider.type);
          const containerId = (dep.config as any)?.containerId;
          if (containerId) await adapter.undeployProbe(containerId);
        }
      }
      await storage.updateValidationProbeDeployment(req.params.id, req.user!.id, { status: "stopped" });
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Validation Tests
  app.get("/api/validation/tests", requireAuth, async (req, res) => {
    try {
      const { environmentId } = req.query as any;
      res.json(await storage.getValidationTests(req.user!.id, environmentId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/tests", requireAuth, async (req, res) => {
    try {
      const t = await storage.createValidationTest({ ...req.body, userId: req.user!.id });
      res.json(t);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/validation/tests/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteValidationTest(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/tests/:id/run", requireAuth, async (req, res) => {
    try {
      const test = await storage.getValidationTest(req.params.id, req.user!.id);
      if (!test) return res.status(404).json({ error: "Test not found" });
      const env = await storage.getValidationEnvironment(test.environmentId, req.user!.id);
      if (!env) return res.status(404).json({ error: "Environment not found" });
      const provider = await storage.getValidationProvider(env.providerId, req.user!.id);
      if (!provider) return res.status(404).json({ error: "Provider not found" });
      const run = await storage.createValidationTestRun({
        testId: test.id,
        userId: req.user!.id,
        status: "running",
        progress: 0,
      });
      const assets = await storage.getValidationVirtualAssets(test.environmentId, req.user!.id);
      const targetAssets = test.targetAssetIds && test.targetAssetIds.length > 0
        ? assets.filter(a => test.targetAssetIds!.includes(a.id))
        : assets;
      const adapter = getProviderAdapter(provider.type);
      const mockTargets = targetAssets.map(a => ({
        name: a.name,
        type: a.type,
        ipAddress: a.ipAddress || a.name,
        macAddress: a.macAddress || "",
        vendor: a.vendor || "",
        model: a.model || "",
        os: a.os || "",
        status: a.status,
        interfaces: (a.interfaces as any) || [],
      }));
      (async () => {
        try {
          const result = await adapter.runValidationTest({
            testName: test.name,
            protocols: test.protocols || [],
            targetAssets: mockTargets,
            config: (test.config as any) || {},
          });
          await storage.updateValidationTestRun(run.id, req.user!.id, {
            status: result.status,
            progress: 100,
            results: result.results as any,
            summary: result.summary as any,
            telemetry: result.telemetry as any,
            startedAt: new Date(),
            completedAt: new Date(),
          });
        } catch (err: any) {
          await storage.updateValidationTestRun(run.id, req.user!.id, {
            status: "failed",
            progress: 0,
            summary: { error: err.message } as any,
          });
        }
      })();
      res.json(run);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/validation/test-runs", requireAuth, async (req, res) => {
    try {
      const { testId } = req.query as any;
      res.json(await storage.getValidationTestRuns(req.user!.id, testId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/validation/test-runs/:id", requireAuth, async (req, res) => {
    try {
      const run = await storage.getValidationTestRun(req.params.id, req.user!.id);
      if (!run) return res.status(404).json({ error: "Test run not found" });
      res.json(run);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Probe Configs ──────────────────────────────────────────────────────────
  app.get("/api/validation/probe-configs", requireAuth, async (req, res) => {
    try { res.json(await storage.getValidationProbeConfigs(req.user!.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/probe-configs", requireAuth, async (req, res) => {
    try {
      const config = await storage.createValidationProbeConfig({ ...req.body, userId: req.user!.id });
      res.json(config);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── AI Infrastructure Design Wizard ────────────────────────────────────────
  app.post("/api/validation/probe-configs/ai-wizard", requireAuth, async (req, res) => {
    const { messages } = req.body as { messages: { role: string; content: string }[] };
    if (!Array.isArray(messages)) return res.status(400).json({ error: "messages required" });

    const systemPrompt = `You are HOLOCRON AI Infrastructure Design Consultant — an expert IT network architect embedded in the HOLOCRON AI platform. Your job is to interview the user about their real IT infrastructure and design a precise sandbox environment configuration for discovery protocol validation.

════════════════════════════════════════════════════════
INTERVIEW GUIDELINES
════════════════════════════════════════════════════════
- Ask ONE clear, well-formed question at a time. Be conversational and professional.
- Build on what the user tells you — reference their previous answers in follow-ups.
- After 4–6 exchanges (or sooner if you have enough data, e.g. they paste an ARP table), generate the session config.
- If the user pastes an ARP table, parse it immediately: extract IPs, resolve MAC OUI → vendor, categorize device types, infer protocols.
- Be specific: when they mention Cisco routers, ask which IOS version; if they mention IoT, ask Modbus/MQTT/BACnet/etc.

════════════════════════════════════════════════════════
QUESTION SEQUENCE (adapt based on answers — skip questions already answered)
════════════════════════════════════════════════════════
Q1. Infrastructure overview: Single-site or multi-site? Industry/sector (enterprise IT, industrial/OT, healthcare, retail, etc.)?
Q2. Multi-site details: How many sites? How are they interconnected (MPLS, SD-WAN, site-to-site VPN, leased line, internet only)?
Q3. Network segmentation: Is there a centralized management VLAN/network? Or does each site manage independently? Any separate DMZ, guest Wi-Fi, OT/SCADA, or storage networks?
Q4. Asset inventory: Roughly how many devices per category? Ask specifically about:
    - Routers (vendor, L3 or PE/CE?)
    - L3 switches, L2 access switches (vendor: Cisco, Juniper, Arista, HPE/Aruba, etc.)
    - Firewalls (Palo Alto, Fortinet, Cisco FTD, Check Point?)
    - Servers (Windows, Linux — physical or virtual?)
    - IoT devices (industrial: Modbus/BACnet/OPC-UA? Consumer: MQTT/CoAP/Zigbee/LoRaWAN?)
    - Wireless APs, printers, cameras, load balancers, storage arrays?
Q5. Protocol/management stack: Do you use SNMP v2c or v3? SSH/CLI access? Any modern REST APIs, NETCONF/YANG, gRPC telemetry, or vendor-specific tools (Cisco DNA, Juniper Junos Space, Aruba Central)?
Q6. ARP table: "If you can paste an ARP/MAC table from your core router or L3 switch, I can map your actual topology more precisely. Just paste it as plain text."

════════════════════════════════════════════════════════
CONFIG GENERATION — WHEN READY
════════════════════════════════════════════════════════
After gathering enough information, generate the config using EXACTLY this format (no deviation):

[CONFIG_START]
{
  "name": "<descriptive session name, e.g. 'Multi-Site Enterprise — Core Network Q2 2026'>",
  "virtualProbeType": "<one of: linux-kernel | windows-endpoint | cisco-ios | junos | arista-eos | palo-alto | fortinet | aruba-os | multi>",
  "assetTargets": [
    {
      "id": "<uuid-v4>",
      "vendor": "<vendor name, or empty string>",
      "model": "<model if known, or empty>",
      "category": "<router|switch|firewall|server|iot|loadbalancer|wireless|mobile|scada|storage|printer|camera>",
      "zone": "<wan|dmz|core|lan|management|ot|iot|guest|storage|vlan — the network segment or zone this device lives in>",
      "vlanId": "<VLAN ID number as a string, e.g. '10', '100', or empty if no specific VLAN>",
      "subnet": "<IP subnet in CIDR, e.g. '10.10.1.0/24', or empty if unknown>",
      "ipAddress": "<representative IP or IP range, e.g. '10.10.1.1' or '10.10.1.0/24', or empty>",
      "protocols": ["<proto1>", "<proto2>"]
    }
  ]
}
[CONFIG_END]

[SUMMARY]
<2–4 sentence human-readable summary: N asset types designed, dominant vendors, probe type chosen and why, any key observations about their environment>
[SUMMARY_END]

════════════════════════════════════════════════════════
CONFIG RULES
════════════════════════════════════════════════════════
- Create ONE asset entry per device TYPE/vendor combination PER ZONE (not per individual device)
- If user has 50 Cisco switches in LAN and 10 Arista switches in DMZ → two separate switch entries with different zones
- Maximum 12 asset entries total (keep it focused)
- ALWAYS populate zone based on what the user described. Zone values:
  - "wan" — internet-facing routers, WAN links, edge devices
  - "dmz" — DMZ servers, perimeter firewalls, reverse proxies, public-facing assets
  - "core" — core/distribution layer switches and routers, backbone infrastructure
  - "lan" — internal LAN devices, access switches, internal servers
  - "management" — out-of-band management, jump servers, management VLAN devices
  - "ot" — OT/SCADA/industrial control systems, PLCs, DCS, HMI
  - "iot" — IoT gateways, sensors, BMS, BACnet, MQTT devices
  - "guest" — guest WiFi networks, untrusted devices
  - "storage" — storage arrays, SAN/NAS
  - "vlan" — if user specified a VLAN number but no clear zone category
- Protocol selection logic:
  - router/switch: always include snmp + ssh; add netconf if IOS-XE/Junos; add bgp/ospf if routing protocols mentioned
  - firewall: snmp + ssh; add restconf/api if Palo Alto or Fortinet; add netflow if traffic monitoring
  - server (Linux): ssh + snmp; add grpc if modern stack; add mqtt if pub/sub
  - server (Windows): wmi + winrm + snmp + icmp
  - iot: modbus/mqtt/bacnet/coap/opcua/zigbee/lorawan based on what they described
  - wireless: snmp + ssh; add restconf if Aruba/Cisco Meraki API
  - storage: snmp + ssh + restconf
  - camera/printer: snmp + icmp
  - loadbalancer: snmp + ssh + restconf
- virtualProbeType:
  - "multi" if >2 different vendor platforms
  - "cisco-ios" if predominantly Cisco IOS/IOS-XE
  - "junos" if predominantly Juniper
  - "arista-eos" if predominantly Arista
  - "palo-alto" if predominantly Palo Alto
  - "fortinet" if predominantly Fortinet
  - "linux-kernel" if predominantly Linux servers
  - "windows-endpoint" if predominantly Windows
  - "aruba-os" if predominantly HPE/Aruba

Available protocol values (use lowercase):
ssh, snmp, wmi, winrm, netconf, restconf, grpc, mqtt, modbus, bacnet, opcua, coap, zigbee, lorawan, ble, bgp, ospf, netflow, mdm, icmp`;

    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
        max_completion_tokens: 1800,
      }, { module: "validation", endpoint: "/api/validation/probe-configs/ai-wizard", userId: req.user!.id, providerName });

      const text = completion.choices[0]?.message?.content || "";

      // Extract config block if present
      const configMatch = text.match(/\[CONFIG_START\]\s*([\s\S]*?)\s*\[CONFIG_END\]/);
      const summaryMatch = text.match(/\[SUMMARY\]\s*([\s\S]*?)\s*\[SUMMARY_END\]/);

      if (configMatch) {
        try {
          const config = JSON.parse(configMatch[1].trim());
          const summary = summaryMatch ? summaryMatch[1].trim() : "";
          // Clean message: remove the raw markers from display
          const cleanMsg = text
            .replace(/\[CONFIG_START\][\s\S]*?\[CONFIG_END\]/g, "")
            .replace(/\[SUMMARY\][\s\S]*?\[SUMMARY_END\]/g, "")
            .trim();
          return res.json({ message: cleanMsg || "Your sandbox environment has been designed. Review the configuration below.", done: true, config, summary });
        } catch (parseErr) {
          // fall through to plain response
        }
      }

      res.json({ message: text, done: false });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/validation/probe-configs/:id", requireAuth, async (req, res) => {
    try {
      const current = await storage.getValidationProbeConfig(req.params.id, req.user!.id);
      if (!current) return res.status(404).json({ error: "Not found" });

      let body = { ...req.body };
      let versionBump = false;
      let newProtocols: string[] = [];

      // Protocol-delta check: only when the session is certified and assetTargets are changing
      if (current.certificationStatus === "certified" && body.config?.assetTargets) {
        const certReport = (current.certificationReport as any) || {};
        const currentCfg = (current.config as any) || {};

        // For legacy sessions (certified before protocol-tracking was added), seed
        // certifiedProtocols from the current stored assetTargets so they don't
        // incorrectly trigger a version bump on the first add after migration.
        const legacyFallback: string[] = Array.from(new Set(
          (currentCfg.assetTargets || []).flatMap((t: any) => t.protocols || [])
        ));
        const certifiedProtocols: string[] = certReport.certifiedProtocols?.length
          ? certReport.certifiedProtocols
          : legacyFallback;

        // Union of protocols across the incoming (updated) asset list
        const incomingProtocols: string[] = Array.from(new Set(
          (body.config.assetTargets as any[]).flatMap((t: any) => t.protocols || [])
        ));

        // Protocols in the new list that were NOT covered at certification time
        newProtocols = incomingProtocols.filter(p => !certifiedProtocols.includes(p));

        if (newProtocols.length > 0) {
          // Bump the minor version of the probe package
          const currCfg = (current.config as any) || {};
          const currVersion: string = certReport.probeVersion || currCfg.probeVersion || "1.0.0";
          const parts = currVersion.split(".").map(Number);
          parts[1] = (parts[1] || 0) + 1;
          parts[2] = 0;
          const nextVersion = parts.join(".");

          body.certificationStatus = "pending";
          body.config = { ...body.config, probeVersion: nextVersion };
          versionBump = true;
        }
        // No new protocols → session stays certified; do NOT touch certificationStatus
      }

      const updated = await storage.updateValidationProbeConfig(req.params.id, req.user!.id, body);
      res.json({ ...updated, versionBump, newProtocols });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/validation/probe-configs/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteValidationProbeConfig(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // SSE: AI-driven sandbox discovery stream
  app.get("/api/validation/probe-configs/:id/certify", requireAuth, async (req, res) => {
    const probeConfig = await storage.getValidationProbeConfig(req.params.id, req.user!.id);
    if (!probeConfig) return res.status(404).json({ error: "Probe config not found" });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    await storage.updateValidationProbeConfig(req.params.id, req.user!.id, {
      certificationStatus: "running",
    });

    const cfg = probeConfig.config as any || {};
    const virtualProbeType: string = cfg.virtualProbeType || "linux";
    const assetTargets: Array<{ id: string; vendor: string; model: string; category: string; protocols: string[] }> = cfg.assetTargets || [];

    // Assign sandbox IPs per device category
    const SANDBOX_IPS: Record<string, string> = {
      router: "10.250.0.1", switch: "10.250.0.2", firewall: "10.250.0.3",
      server: "10.250.0.10", iot: "10.250.0.20", loadbalancer: "10.250.0.30",
      wireless: "10.250.0.40", mobile: "10.250.0.50", scada: "10.250.0.60",
      storage: "10.250.0.70", printer: "10.250.0.80", camera: "10.250.0.90",
    };

    // Build per-target context with known-issue simulation
    const targetDescriptions = assetTargets.map((t, i) => {
      const ip = SANDBOX_IPS[t.category] ? `10.250.${i}.${i + 1}` : `10.250.9.${i + 1}`;
      const vendor = t.vendor || "";
      const model = t.model || "";
      const deviceLabel = [vendor, model].filter(Boolean).join(" ") || t.category;
      const vLow = vendor.toLowerCase();
      const mLow = model.toLowerCase();
      const issues: string[] = [];
      if (t.protocols.includes("netconf") && (t.category === "router" || t.category === "switch")) {
        if (vLow.includes("cisco")) issues.push("NETCONF requires 'netconf-yang' enablement on IOS-XE; agent detects TCP RST on port 830, enables the feature, re-probes.");
      }
      if (t.protocols.includes("ssh") && t.category === "firewall") {
        if (vLow.includes("palo")) issues.push("PAN-OS: SSH password auth disabled by default; agent detects rejection, pivots to XML/REST API on port 443.");
      }
      if (t.category === "iot" && t.protocols.includes("ssh") && (vLow.includes("advantech") || mLow.includes("eki"))) {
        issues.push("Advantech EKI: no SSH daemon; agent detects TCP RST on port 22, pivots to Modbus TCP.");
      }
      if (t.protocols.includes("wmi") && t.category !== "server") {
        issues.push("WMI is Windows-only; agent detects DCOM endpoint not available, marks WMI as N/A.");
      }
      if (t.protocols.includes("lorawan")) {
        issues.push("LoRaWAN: agent discovers gateway via UDP port 1700 (Semtech forwarder); ADR negotiated, SF7/SF12 spread factors probed; dedup filter applied for multi-gateway overlaps.");
      }
      if (t.protocols.includes("ble")) {
        issues.push("BLE: agent issues GAP scan on 2.4 GHz; detects GATT services and device name characteristic; ⚠ advertisements arrive in passive mode — active scan triggered for full GATT profile.");
      }
      if (t.protocols.includes("coap") && (t.category === "iot" || t.category === "mobile")) {
        issues.push("CoAP: agent probes well-known resources (/.well-known/core) via UDP 5683; confirms DTLS 1.2 handshake; block-wise transfer enabled for payloads > 512 B.");
      }
      if (t.protocols.includes("zigbee")) {
        issues.push("Zigbee: coordinator join permit window opened (60s); PAN ID 0x1A2B, channel 15; device announces node descriptor — router vs end-device role detected.");
      }
      if (t.protocols.includes("mdm") && (t.category === "mobile" || t.category === "server")) {
        issues.push("MDM: agent calls enrollment API (Apple MDM / Intune Graph API / Knox API); device inventory payload parsed; supervised mode confirmed; compliance posture extracted.");
      }
      if (t.protocols.includes("opcua")) {
        issues.push("OPC-UA: discovery endpoint probed on port 4840; server certificate accepted (sandbox trust); ⚠ security policy 'None' detected — auto-upgraded to Basic256Sha256 for session.");
      }
      if (t.protocols.includes("winrm") && t.category === "server") {
        issues.push("WinRM: agent connects via HTTPS port 5986; ⚠ self-signed cert — sandbox trust accepted; WS-Man enumerate CIM_Process and Win32_Service completed.");
      }
      if (t.protocols.includes("grpc")) {
        issues.push("gRPC: agent reflects server descriptor; 3 service definitions found; unary + server-streaming RPCs tested; compression: gzip; TLS 1.3 handshake verified.");
      }
      if (t.protocols.includes("netflow")) {
        issues.push("NetFlow: collector bound on UDP 2055; v9 and IPFIX templates received; flow records decoded — 142 active flows, top talker 10.250.0.1:443.");
      }
      if (t.protocols.includes("restconf") && (t.category === "router" || t.category === "switch" || t.category === "firewall")) {
        issues.push("RESTCONF: agent queries /restconf/data/ietf-interfaces:interfaces via HTTPS; ⚠ YANG module 'ietf-routing' not advertised — agent falls back to ietf-interfaces only.");
      }
      if (t.protocols.includes("bacnet")) {
        issues.push("BACnet: agent issues Who-Is broadcast on UDP 47808 (BAC0); discovers BACnet/IP devices; reads object-list, device description, and present-value properties; ⚠ APDU timeout on 2 objects — agent retries with longer timeout (6s), success on retry; supports BBMD forwarding for routed subnets.");
      }
      return `  Asset ${i + 1}: ${deviceLabel} [${t.category}] @ ${ip}
    Protocols: ${t.protocols.join(", ").toUpperCase() || "none"}${issues.length > 0 ? `\n    Issues: ${issues.join(" | ")}` : ""}`;
    }).join("\n");

    // ── GAP RESOLUTION FLOW ────────────────────────────────────────────────────
    if (virtualProbeType === "gap-resolution") {
      const gapSigs = (cfg.gapSignals as Record<string, string>) || {};
      const ipAddr     = gapSigs.ipAddress     || "unknown";
      const macAddr    = gapSigs.macAddress    || "not captured";
      const openPorts  = gapSigs.openPorts     || "not captured";
      const banner     = gapSigs.banner        || "not captured";
      const partialOids = gapSigs.partialOids  || "not captured";
      const observations = gapSigs.observations || "not provided";

      const gapSystemPrompt = `You are HOLOCRON AI Probe Gap Resolution Agent — a specialized AI engine that receives partial/ambiguous device signals captured from a real production network probe and resolves them into a fully certified probe extension using the HOLOCRON AI sandbox.

════════════════════════════════════════════════════════
SIGNALS CAPTURED FROM PRODUCTION (real observed data):
════════════════════════════════════════════════════════
IP / Subnet         : ${ipAddr}
MAC Address         : ${macAddr}
Open Ports Observed : ${openPorts}
Connection Banner   : ${banner}
Partial SNMP / OID  : ${partialOids}
Field Observations  : ${observations}
════════════════════════════════════════════════════════

Execute these 7 phases in sequence. Start EVERY phase on its own line with the exact marker shown:

[IDENTIFY]
Analyze all signals above and fingerprint the device. Perform:
- OUI/MAC prefix lookup → resolve manufacturer (e.g. 00:1A:2B = Cisco Systems, 00:50:56 = VMware, etc.)
- Port profile analysis → map observed ports to known services and device classes
- Banner parsing → extract vendor string, model, firmware version, protocol version, OS hints
- SNMP OID analysis → sysDescr, sysObjectID, enterprise OID mapping to known MIB vendors
- Cross-reference with known device fingerprint database
Output: Probable Vendor, Probable Model, Device Class, Confidence Score (%)
Also list 2 alternative hypotheses with confidence scores and the key differentiating signals.

[PROBE-SELECT]
Based on the identified device class:
- Select 3–6 protocols most likely to yield full telemetry for this device
- Explain WHY each was selected (link each protocol to a specific observed signal)
- Assign expected data richness: High / Medium / Low per protocol
- Identify any protocol the original probe attempted that is NOT compatible with this device type (explain the mismatch — wrong port, wrong version, deprecated command set, etc.)
Output: Selected Protocol Stack with signal-to-protocol rationale table.

[DISCOVER]
Run sandbox simulation with the identified device using the selected protocol stack. This device is now replicated in the HOLOCRON sandbox with full protocol virtualization — all authentication is disabled, all selected protocols succeed.
For each protocol show:
a) Connection log (SYN→SYN-ACK ms, handshake ms, session established)
b) Raw protocol exchange — appropriate to the protocol:
   - SSH: real banner + 3–5 actual CLI commands with truncated realistic output
   - SNMP: actual OID walk with real OID numbers and values referencing the identified vendor's MIB
   - REST/NETCONF: actual HTTP request + JSON/XML response with 3–5 real key-value fields
   - Modbus/MQTT/BACnet/OPC-UA: register reads, topic hierarchies, or object-list excerpts
c) Service metrics: RTT (ms), data volume (KB), schema fields populated, polling throughput (fields/sec), top 5 metrics collected

[COLLECT]
Per-device data quality summary: total schema fields populated, total data volume (KB), enrichment applied (e.g. "OUI-to-vendor mapping, firmware lifecycle tagging, port service annotation"), completeness score (%).

[VALIDATE]
Confirm identification via collected data: sysDescr match, firmware version vs. fingerprint hypothesis, field overlap %, derived/computed fields added (e.g. "device lifecycle score, patch surface area").

[PACKAGE]
List output files (probe_extension.yaml, oid_delta.json, driver_patch.tar.gz), package size (KB), certified operational limits (max assets, poll interval, estimated daily data volume).

[READY]
Final certification table:
  Asset | Identified Device | Protocol | RTT | Fields | Data (KB) | Collection Method | Result

Then one blank line, then: "Overall: CERTIFIED"

Then a "Probe Enhancement Summary" block showing:
  Identified As        : <vendor> <model> <device class>
  Confidence           : <X>%
  Root Cause of Gap    : <why the original probe failed — specific technical reason>
  Protocols Added      : <list of protocols now covering this device>
  Coverage Improvement : <estimated % → % e.g. "12% → 94%">
  Package Size         : <X> KB

════════════════════════════════════════════════════════
STRICT RULES:
- The sandbox virtualizes the identified device with full fidelity — all selected protocols MUST succeed
- Never produce authentication failures, credential errors, or access denials
- Use real OUI database entries, real port service names, real firmware version patterns
- Be technically precise and specific — no vague statements
- The final [READY] verdict MUST be "Overall: CERTIFIED"
- 1300–1800 words total, highly technical terminal log style
- Do NOT use markdown headers or bullet symbols outside phase structure
════════════════════════════════════════════════════════`;

      try {
        const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
        const gapStream = await callAiLogged(openai, {
          model: aiModel,
          messages: [
            { role: "system", content: gapSystemPrompt },
            { role: "user", content: `Run gap resolution for session: "${probeConfig.name}" — unknown device signals from ${ipAddr}` },
          ],
          stream: true,
          max_completion_tokens: 5500,
        }, { module: "validation", endpoint: "/api/validation/probe-configs/:id/certify", userId: req.user!.id, providerName });

        let fullText = "";
        for await (const chunk of gapStream) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            fullText += text;
            res.write(`data: ${JSON.stringify({ type: "content", text })}\n\n`);
          }
        }

        const certified = /\[READY\][^]*(Overall:\s*CERTIFIED|Overall\s*CERTIFIED)/i.test(fullText) || /CERTIFIED/i.test(fullText.slice(-400));
        const finalStatus = certified ? "certified" : "failed";
        const currentVersion = (cfg.probeVersion as string) || "1.0.0";

        await storage.updateValidationProbeConfig(req.params.id, req.user!.id, {
          certificationStatus: finalStatus,
          lastCertifiedAt: new Date(),
          certificationReport: {
            text: fullText,
            certifiedAt: new Date().toISOString(),
            status: finalStatus,
            certifiedProtocols: [],
            probeVersion: currentVersion,
            isGapResolution: true,
          } as any,
        });

        res.write(`data: ${JSON.stringify({ type: "done", status: finalStatus })}\n\n`);
      } catch (err: any) {
        await storage.updateValidationProbeConfig(req.params.id, req.user!.id, { certificationStatus: "failed" });
        res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
      } finally {
        res.end();
      }
      return;
    }
    // ── END GAP RESOLUTION FLOW ────────────────────────────────────────────────

    // Probe labels per type
    const PROBE_LABELS: Record<string, string> = {
      // Coupled
      "linux-kernel":     "Linux / Kernel Probe (Coupled — SSH/SNMP/NETCONF/RESTCONF/gRPC/NetFlow agent)",
      "windows-endpoint": "Windows Endpoint Probe (Coupled — WMI/WinRM/PowerShell/MDM agent)",
      "macos-endpoint":   "macOS Endpoint Probe (Coupled — SSH/SNMP/REST/MDM agent)",
      "container":        "Container Probe (Coupled — Docker Engine API/cgroups/gRPC agent)",
      // Semi-Autonomous
      "network-appliance":"Network Appliance Probe (Semi-Autonomous — SNMP/NETCONF/RESTCONF/BGP/OSPF/NetFlow/REST agent)",
      "hypervisor":       "Hypervisor / VM Probe (Semi-Autonomous — vSphere/Hyper-V/KVM/gRPC agent)",
      "cloud-instance":   "Cloud Instance Probe (Semi-Autonomous — AWS SSM/Azure Monitor/GCP/gRPC/MDM agent)",
      "kubernetes-node":  "Kubernetes Node Probe (Semi-Autonomous — kubelet/cAdvisor/kube-state-metrics/gRPC)",
      // Fully Autonomous
      "iot-gateway":      "IoT / OT Gateway Probe (Fully Autonomous — Modbus/MQTT/CoAP/LoRaWAN/Zigbee/BLE/BACnet/OPC-UA agent)",
      "network-sensor":   "Autonomous Network Sensor (Fully Autonomous — passive BGP/OSPF/NetFlow/IPFIX listener)",
      "nano-probe":       "HOLOCRON Nano Probe (Fully Autonomous — standalone binary, 2 MB footprint, any platform)",
      "sidecar-mesh":     "Sidecar / Service Mesh Probe (Fully Autonomous — Envoy/Istio/Linkerd/gRPC telemetry)",
      // Legacy fallbacks
      "linux":   "Linux Probe (SSH/Python agent)",
      "windows": "Windows Probe (WMI/PowerShell agent)",
      "network": "Network Appliance Probe (SNMP/NETCONF/REST agent)",
      "iot":     "IoT Gateway Probe (Modbus/MQTT/CoAP agent)",
    };

    // Probe capacity specs per probe type
    const PROBE_CAPACITY: Record<string, { maxAssets: number; pollInterval: string; threads: string; ram: string; cpu: string }> = {
      // Coupled — heavyweight, richest telemetry
      "linux-kernel":     { maxAssets: 500,  pollInterval: "60s",  threads: "32 worker threads",   ram: "512 MB",  cpu: "4 vCPU" },
      "windows-endpoint": { maxAssets: 300,  pollInterval: "60s",  threads: "24 worker threads",   ram: "1024 MB", cpu: "4 vCPU" },
      "macos-endpoint":   { maxAssets: 250,  pollInterval: "60s",  threads: "20 worker threads",   ram: "512 MB",  cpu: "4 vCPU" },
      "container":        { maxAssets: 800,  pollInterval: "30s",  threads: "48 worker threads",   ram: "256 MB",  cpu: "2 vCPU" },
      // Semi-Autonomous — lighter, protocol-native
      "network-appliance":{ maxAssets: 1000, pollInterval: "30s",  threads: "64 worker threads",   ram: "256 MB",  cpu: "2 vCPU" },
      "hypervisor":       { maxAssets: 400,  pollInterval: "60s",  threads: "32 worker threads",   ram: "512 MB",  cpu: "4 vCPU" },
      "cloud-instance":   { maxAssets: 2000, pollInterval: "30s",  threads: "128 worker threads",  ram: "384 MB",  cpu: "4 vCPU" },
      "kubernetes-node":  { maxAssets: 1500, pollInterval: "15s",  threads: "96 worker threads",   ram: "256 MB",  cpu: "2 vCPU" },
      // Fully Autonomous — minimal footprint, edge-ready
      "iot-gateway":      { maxAssets: 2000, pollInterval: "10s",  threads: "128 worker threads",  ram: "128 MB",  cpu: "2 vCPU" },
      "network-sensor":   { maxAssets: 5000, pollInterval: "10s",  threads: "256 worker threads",  ram: "192 MB",  cpu: "2 vCPU" },
      "nano-probe":       { maxAssets: 3000, pollInterval: "30s",  threads: "128 worker threads",  ram: "64 MB",   cpu: "1 vCPU" },
      "sidecar-mesh":     { maxAssets: 10000,pollInterval: "5s",   threads: "512 worker threads",  ram: "32 MB",   cpu: "0.5 vCPU" },
      // Legacy
      "linux":   { maxAssets: 500,  pollInterval: "60s",  threads: "32 worker threads",  ram: "512 MB",  cpu: "4 vCPU" },
      "windows": { maxAssets: 300,  pollInterval: "60s",  threads: "24 worker threads",  ram: "1024 MB", cpu: "4 vCPU" },
      "network": { maxAssets: 1000, pollInterval: "30s",  threads: "64 worker threads",  ram: "256 MB",  cpu: "2 vCPU" },
      "iot":     { maxAssets: 2000, pollInterval: "10s",  threads: "128 worker threads", ram: "128 MB",  cpu: "2 vCPU" },
    };
    const probeLabel = PROBE_LABELS[virtualProbeType] || virtualProbeType;
    const cap = PROBE_CAPACITY[virtualProbeType] || PROBE_CAPACITY["linux-kernel"];

    const systemPrompt = `You are HOLOCRON AI Sandbox Discovery Agent — an elite multi-layer autonomous discovery engine. You execute deep protocol-level validation against virtual sandbox replicas of network assets before any probe is deployed to production.

════════════════════════════════════════════════════════
SANDBOX RULES — ABSOLUTE — NEVER VIOLATE
════════════════════════════════════════════════════════
1. FULLY SIMULATED SANDBOX. Every device's entire stack is virtualized and pre-configured.
2. NO authentication exists. SSH accepts all. SNMP responds to all community strings. REST APIs return 200. APIs return full data. This tests PROTOCOL COMPATIBILITY, not security.
3. NEVER generate any auth failure, credential error, or access denial. These do not exist here.
4. Every listed protocol on every asset MUST succeed.
5. Minor interesting protocol-level quirks (non-standard cipher, deprecated OID, version negotiation) are allowed IF auto-remediated — final result MUST be ✓ success.
6. Final [READY] verdict MUST end with "Overall: CERTIFIED".
════════════════════════════════════════════════════════

DISCOVERY SESSION: ${probeConfig.name}
VIRTUAL PROBE TYPE: ${probeLabel}
PROBE CAPACITY: ${cap.maxAssets} assets max | ${cap.pollInterval} poll interval | ${cap.threads} | ${cap.ram} RAM | ${cap.cpu}
TOTAL ASSET TARGETS: ${assetTargets.length}

ASSET TARGETS:
${targetDescriptions || "  (no asset targets defined)"}

════════════════════════════════════════════════════════
DISCOVERY EVENT MARKERS — CRITICAL
════════════════════════════════════════════════════════
Embed these machine-readable markers INLINE within your text at the exact moment each event occurs.
They are invisible to the operator display but drive real-time topology updates. Use them precisely:
  @@DISC:N@@   — emit immediately before "Asset N+1:" line (0-indexed). Signals topology node activation.
  @@OK:N:P@@   — emit immediately after a protocol P's ✓ success line for asset N (0-indexed). P = lowercase proto name.
Example: @@DISC:0@@\nAsset 1: ...\n  SSH: ...\n  ✓ success @@OK:0:SSH@@\n  SNMP: ...
════════════════════════════════════════════════════════

════════════════════════════════════════════════════════
PHASE FORMAT — output EXACTLY these phase markers on their own line:
════════════════════════════════════════════════════════

[INIT]
Probe engine boot sequence:
- Container: hcn-sandbox-<8-char-hex> | Namespace: net-sandbox-<uuid-prefix> | Kernel: 5.15.0-hcn-probe
- vCPU allocation: 4 cores | RAM: ${cap.ram} | Storage: 2 GB ephemeral NVMe
- Probe capacity: ${cap.maxAssets} assets max | Poll interval: ${cap.pollInterval} | Thread pool: ${cap.threads} | CPU budget: ${cap.cpu}
- Virtual replica inventory: list each asset with its assigned sandbox IP and MAC (generate realistic values)
- Probe engine: v3.4.1-enterprise | Schema registry: v2.1.7 | MIB bundle: 847 OID families loaded
- Neighbour discovery module: ON | L2 topology mapper: ON | L3 path tracer: ON

[DISCOVER]
For EACH asset (0-indexed: 0 to ${assetTargets.length - 1}), emit @@DISC:N@@ then start "Asset N+1: <vendor> [category] @ <ip>".
For EACH protocol on that asset:

LAYER 2 (run first if SNMP/SSH/NETCONF present):
  ARP resolution: show ARP entry (IP → MAC OUI lookup → vendor)
  VLAN detection: show dot1q tag if switch/router, native VLAN, trunks
  Interface enumeration: list 3–5 physical interfaces with speed, duplex, admin/oper status

LAYER 3 (if routing protocols present):
  Routing table excerpt: show 4–6 routes with next-hop, metric, protocol tag (C/S/O/B etc.)
  Neighbor discovery: from ARP cache + CDP/LLDP, list 1–2 adjacent device entries (IP, MAC, platform)
  Subnet mapping: show which subnets the device routes to

LAYER 4 (always):
  Port scan results: show 4–8 open TCP/UDP ports with service names and version banners
  Service fingerprint: show detected service name, version, vendor string from TCP banner

LAYER 7 (per protocol assigned):
  For SSH: show banner exchange (OpenSSH version), then 4–6 REAL CLI commands appropriate to the device type with realistic truncated outputs:
    - Router/Switch: "show version" (OS, uptime, hw), "show interfaces" (GigE with counters), "show ip route" (6 routes), "show ip bgp summary" or "show spanning-tree", "show logging" (last 3 lines)
    - Server/Linux: "uname -a", "uptime", "ss -tlnp" (3–5 listening ports), "df -h" (3 filesystems), "systemctl list-units --state=running | head -8"
    - Firewall: "show system info", "show running-config | head -20", "show session table", "show interface"
  For SNMP: show actual OID walk — 6–10 real OID numbers with their values:
    .1.3.6.1.2.1.1.1.0 = STRING: <realistic sysDescr for vendor/model>
    .1.3.6.1.2.1.1.5.0 = STRING: <hostname>
    .1.3.6.1.2.1.25.1.1.0 = Timeticks: <uptime>
    .1.3.6.1.2.1.2.1.0 = INTEGER: <ifNumber>
    .1.3.6.1.4.1.<enterprise-OID-for-vendor>.1.1 = <vendor-specific-value>
    + 3–5 more vendor-specific OIDs
  For REST/NETCONF/RESTCONF: show HTTP method, URL, status, then 5–8 key-value pairs from the JSON/XML response body
  For Modbus: show unit ID, function codes, register map excerpt (holding registers 40001–40010)
  For MQTT: show broker connect, SUBSCRIBE topics (3–5 realistic topics), first message payload
  For gRPC: show service reflection output, 2 RPC calls with request/response proto
  For BGP/OSPF: show neighbor table, AS numbers, route counts, convergence time
  For WMI/WinRM: show Win32_ComputerSystem, Win32_OperatingSystem, top 3 Win32_Process
  For NETFLOW: show flow template ID, 6–8 decoded flow records with src/dst/bytes/pkts
  For OPC-UA: show endpoint URL, security policy, NodeID browse (3 objects with attributes)
  For BACnet: show device object-list, 3 present-value reads with engineering units

After each protocol block:
  - RTT: <Xms> | Data: <X KB> | Fields: <N> | Throughput: <N fields/sec>
  - Top metrics: <metric1=val>, <metric2=val>, <metric3=val>, <metric4=val>, <metric5=val>
  - ✓ success @@OK:N:PROTO@@   ← emit this immediately after ✓ for each successful protocol

[COLLECT]
For each asset: Schema fields populated: <N> | Data volume: <X KB> | Enrichments applied: <list> | Completeness: <X>%
Cross-asset totals: total fields, total volume, enrichment pipeline (ARP→MAC→OUI vendor, LLDP neighbor resolve, OID→vendor MIB, BGP prefix normalization)
Baseline established: CPU <X>%, MEM <X>%, bandwidth <X> Mbps per asset

[VALIDATE]
Schema version: v2.1.7 | All vendor models confirmed against MIB registry
Cross-asset field overlap: <X>% | Derived fields added: <list>
Topology inference: list 2–3 inferred topology relationships (e.g. "router→switch→server path confirmed via LLDP + ARP")
Anomaly scan: list 1–2 minor findings that were auto-resolved (e.g. non-standard OID, deprecated cipher)

[PACKAGE]
List output files with sizes:
  probe_config_v<version>.yaml (<X> KB) — probe configuration
  mib_bundle_<session>.tar.gz (<X> KB) — vendor MIB files
  driver_bindings_<session>.json (<X> KB) — protocol driver map
  topology_graph_<session>.json (<X> KB) — discovered L2/L3 topology
  baseline_metrics_<session>.json (<X> KB) — performance baselines
Total package: <X> KB | Signed: SHA-256 | Expiry: 90 days
Certified operational limits: Max <N> assets | Poll: ${cap.pollInterval} | Daily data est.: <X> MB

[READY]
Final certification table:
  Asset | Vendor/Model | Protocol | L2 | L3 | L4 | L7 | RTT (ms) | Fields | Data (KB) | Result

Then blank line, then: "Overall: CERTIFIED"

Then "Probe Capacity Summary":
  Max Concurrent Assets: <N> | Poll Interval: ${cap.pollInterval} | Daily Volume Est.: <X> MB
  Thread Pool: ${cap.threads} | Memory Footprint: ${cap.ram} | Schema Version: v2.1.7

STYLE:
- Terminal log style — real command prompts, realistic hostnames, timestamps
- ✓ success | ⚠ warning (auto-resolved) | → note/fallback
- Never ✗ as final outcome
- Specific numbers everywhere — never vague statements
- 2000–2800 words total
- No markdown headers`;

    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const stream = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Run sophisticated multi-layer sandbox discovery for session: "${probeConfig.name}" — ${assetTargets.length} asset type(s) via ${probeLabel}` },
        ],
        stream: true,
        max_completion_tokens: 7000,
      }, { module: "validation", endpoint: "/api/validation/probe-configs/:id/certify", userId: req.user!.id, providerName });

      let fullText = "";
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullText += text;
          res.write(`data: ${JSON.stringify({ type: "content", text })}\n\n`);
        }
      }

      // Determine result from the output
      const certified = /\[READY\][^]*(Overall:\s*CERTIFIED|Overall\s*CERTIFIED)/i.test(fullText) || /CERTIFIED/i.test(fullText.slice(-400));
      const finalStatus = certified ? "certified" : "failed";

      // Record which protocols were covered at the moment of certification
      const certifiedProtocols = Array.from(new Set(
        assetTargets.flatMap(t => t.protocols)
      ));
      const currentVersion = (cfg.probeVersion as string) || "1.0.0";

      await storage.updateValidationProbeConfig(req.params.id, req.user!.id, {
        certificationStatus: finalStatus,
        lastCertifiedAt: new Date(),
        certificationReport: {
          text: fullText,
          certifiedAt: new Date().toISOString(),
          status: finalStatus,
          certifiedProtocols,
          probeVersion: currentVersion,
        } as any,
      });

      res.write(`data: ${JSON.stringify({ type: "done", status: finalStatus })}\n\n`);
    } catch (err: any) {
      await storage.updateValidationProbeConfig(req.params.id, req.user!.id, {
        certificationStatus: "failed",
      });
      res.write(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
    } finally {
      res.end();
    }
  });

  // Reports
  app.get("/api/validation/reports", requireAuth, async (req, res) => {
    try { res.json(await storage.getValidationReports(req.user!.id)); }
    catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/validation/reports/generate", requireAuth, async (req, res) => {
    try {
      const { environmentId, name, type } = req.body;
      const report = await storage.createValidationReport({
        userId: req.user!.id,
        environmentId: environmentId || null,
        name: name || `Validation Report — ${new Date().toLocaleDateString()}`,
        type: type || "summary",
        status: "generating",
      });
      (async () => {
        try {
          const [envs, runs] = await Promise.all([
            storage.getValidationEnvironments(req.user!.id),
            storage.getValidationTestRuns(req.user!.id),
          ]);
          const relevantRuns = environmentId
            ? await (async () => {
                const tests = await storage.getValidationTests(req.user!.id, environmentId);
                const testIds = tests.map(t => t.id);
                return runs.filter(r => testIds.includes(r.testId));
              })()
            : runs;
          const completedRuns = relevantRuns.filter(r => r.status !== "running" && r.status !== "pending");
          const passed = completedRuns.filter(r => r.status === "passed").length;
          const failed = completedRuns.filter(r => r.status === "failed").length;
          const partial = completedRuns.filter(r => r.status === "partial").length;
          const allResults: any[] = completedRuns.flatMap(r => (r.results as any) || []);
          const protocolStats: Record<string, { total: number; passed: number }> = {};
          for (const r of allResults) {
            if (!protocolStats[r.protocol]) protocolStats[r.protocol] = { total: 0, passed: 0 };
            protocolStats[r.protocol].total++;
            if (r.status === "passed") protocolStats[r.protocol].passed++;
          }
          const reportData = {
            generatedAt: new Date().toISOString(),
            environment: envs.find(e => e.id === environmentId) || null,
            summary: {
              totalRuns: completedRuns.length,
              passed,
              failed,
              partial,
              overallPassRate: completedRuns.length > 0 ? Math.round((passed / completedRuns.length) * 100) : 0,
            },
            protocolStats,
            runs: completedRuns.map(r => ({
              id: r.id,
              status: r.status,
              completedAt: r.completedAt,
              summary: r.summary,
            })),
            compliance: {
              icmpReachability: protocolStats["icmp"] ? Math.round((protocolStats["icmp"].passed / protocolStats["icmp"].total) * 100) : null,
              sshAccess: protocolStats["ssh"] ? Math.round((protocolStats["ssh"].passed / protocolStats["ssh"].total) * 100) : null,
              snmpDiscovery: protocolStats["snmp"] ? Math.round((protocolStats["snmp"].passed / protocolStats["snmp"].total) * 100) : null,
            },
          };
          await storage.updateValidationReport(report.id, req.user!.id, {
            status: "ready",
            reportData: reportData as any,
            generatedAt: new Date(),
          });
        } catch (err: any) {
          await storage.updateValidationReport(report.id, req.user!.id, { status: "failed" });
        }
      })();
      res.json(report);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/validation/reports/:id", requireAuth, async (req, res) => {
    try {
      const report = await storage.getValidationReport(req.params.id, req.user!.id);
      if (!report) return res.status(404).json({ error: "Report not found" });
      res.json(report);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/validation/reports/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteValidationReport(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── Service Metrics Collection ────────────────────────────────────────────
  app.post("/api/validation/environments/:id/collect-metrics", requireAuth, async (req, res) => {
    try {
      const { generateAssetMetrics } = await import("./validation-mock-adapter");
      const assets = await storage.getValidationVirtualAssets(req.params.id, req.user!.id);
      if (!assets || assets.length === 0) {
        return res.json([]);
      }
      // Small stagger to simulate real probe polling
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
      const results = assets.map(a => generateAssetMetrics({
        id: a.id,
        name: a.name,
        type: a.type,
        ipAddress: a.ipAddress || "0.0.0.0",
        macAddress: a.macAddress || "",
        vendor: a.vendor || "Unknown",
        model: a.model || "",
        os: a.os || "",
        status: a.status || "online",
        interfaces: (a.interfaces as any) || [],
      }));
      res.json(results);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── AI Probe Troubleshoot — SSE stream ────────────────────────────────────
  app.get("/api/validation/assets/:id/ai-troubleshoot", requireAuth, async (req, res) => {
    try {
      const { assetName, assetType, assetIp, vendor, os, failedCollectors } = req.query as Record<string, string>;
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "AI provider not configured" });
        return;
      }
      const { default: OpenAI } = await import("openai");
      const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

      const failures = failedCollectors ? JSON.parse(failedCollectors) : [];
      const failureSummary = failures.map((f: any) => `  - ${f.protocol.toUpperCase()}: ${f.error} — ${f.details}`).join("\n");

      const systemPrompt = `You are HOLOCRON AI's Autonomous Probe Diagnostic Agent — an expert in network infrastructure, service metric collection, and probe troubleshooting.
Your job is to investigate why a probe failed to collect metrics from a virtual asset, diagnose the root cause, attempt an alternative collection strategy, and report the outcome.
Respond ONLY in this exact format with these prefixes on separate lines:
[ANALYZING] <what you are checking>
[DIAGNOSIS] <root cause identified>
[ACTION] <remediation step being taken>
[RETRY] <alternative method being attempted>
[RESULT] <outcome — success or persistent failure with recommendation>
Keep each line concise (1-2 sentences). Be technically precise. Use real protocol names, error codes, and vendor-specific details.`;

      const userPrompt = `Asset context:
- Name: ${assetName || "Unknown"}
- Type: ${assetType || "unknown"}
- IP: ${assetIp || "0.0.0.0"}
- Vendor: ${vendor || "Unknown"}
- OS: ${os || "Unknown"}

Failed metric collectors:
${failureSummary || "  - Unknown failure"}

Diagnose the failures and attempt remediation.`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const stream = await callAiLogged(openai, {
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        max_tokens: 500,
        temperature: 0.4,
      }, { module: "validation", endpoint: "/api/validation/assets/:id/ai-troubleshoot", userId: req.user!.id, providerName });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ error: err.message });
      else { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); }
    }
  });

  // ── Configuration Management ─────────────────────────────────────────────
  const STANDARDS: Record<string, { label: string; description: string; controls: string }> = {
    cis_l1: { label: "CIS Benchmark Level 1", description: "Conservative security controls for general use", controls: "Access control, patch management, service hardening, logging, network configuration" },
    cis_l2: { label: "CIS Benchmark Level 2", description: "Defense-in-depth controls for high-security environments", controls: "All L1 controls plus encryption, advanced logging, application control, strict firewall rules" },
    disa_stig: { label: "DISA STIG", description: "DoD Security Technical Implementation Guide", controls: "Account lockout, audit policies, service restrictions, credential management, network isolation" },
    iso27001: { label: "ISO/IEC 27001", description: "Information security management system standard", controls: "A.9 Access control, A.10 Cryptography, A.12 Operations security, A.13 Communications security" },
    pci_dss: { label: "PCI DSS v4.0", description: "Payment Card Industry Data Security Standard", controls: "Network security, encryption, access management, vulnerability management, monitoring" },
    itil_baseline: { label: "ITIL Baseline", description: "ITIL service management configuration baseline", controls: "Availability, capacity, continuity, security, supplier management baselines" },
    nist_800_53: { label: "NIST SP 800-53", description: "Security and privacy controls for federal systems", controls: "AC, AU, CA, CM, IA, IR, MA, MP, PE, PL, PM, PS, RA, SA, SC, SI, SR control families" },
  };

  app.get("/api/config-rfcs", requireAuth, async (req, res) => {
    try {
      const rfcs = await storage.getConfigRfcs(req.user!.id, {
        assetId: req.query.assetId as string | undefined,
        status: req.query.status as string | undefined,
      });
      res.json(rfcs);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/config-rfcs/:id", requireAuth, async (req, res) => {
    try {
      const rfc = await storage.getConfigRfc(req.params.id, req.user!.id);
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.patch("/api/config-rfcs/:id", requireAuth, async (req, res) => {
    try {
      const rfc = await storage.updateConfigRfc(req.params.id, req.user!.id, req.body);
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/config-rfcs/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteConfigRfc(req.params.id, req.user!.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Approve RFC
  app.post("/api/config-rfcs/:id/approve", requireAuth, async (req, res) => {
    try {
      const rfc = await storage.updateConfigRfc(req.params.id, req.user!.id, {
        status: "approved", approvedAt: new Date(), approvedBy: req.user!.username || "admin",
      });
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      res.json(rfc);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // Execute RFC — dispatch change tasks via probe
  app.post("/api/config-rfcs/:id/execute", requireAuth, async (req, res) => {
    try {
      const rfc = await storage.getConfigRfc(req.params.id, req.user!.id);
      if (!rfc) return res.status(404).json({ error: "RFC not found" });
      if (rfc.status !== "approved") return res.status(400).json({ error: "RFC must be approved before execution" });

      const asset = await storage.getDiscoveredAsset(rfc.assetId, req.user!.id);
      const changes = (rfc.changes as any[]) || [];
      const tasks = [];

      for (const change of changes) {
        if (!change.script) continue;
        const task = await storage.createRemediationTask({
          userId: req.user!.id, assetId: rfc.assetId, probeId: asset?.probeId || null,
          title: `[RFC ${rfc.rfcNumber}] ${change.title || change.id}`,
          description: change.description || rfc.title,
          remediationScript: change.script,
          rollbackScript: change.rollbackScript || null,
          scriptType: asset?.metadata && (asset.metadata as any)?.software?.os?.toLowerCase().includes("windows") ? "powershell" : "bash",
          status: "queued", batchId: rfc.id, category: "config", riskLevel: rfc.risk,
          originType: "ai", changeRef: rfc.rfcNumber,
        });
        tasks.push(task);
      }

      await storage.updateConfigRfc(rfc.id, req.user!.id, { status: "in_progress", executedAt: new Date() });
      res.json({ ok: true, tasksCreated: tasks.length });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // AI Analysis — SSE streaming, creates RFC
  app.post("/api/config-rfcs/analyze", requireAuth, async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // disable nginx/Replit proxy buffering
    res.flushHeaders(); // send headers immediately so client sees the connection open
    const send = (d: object) => {
      res.write(`data: ${JSON.stringify(d)}\n\n`);
      (res as any).flush?.(); // force-flush if compression middleware is wrapping res
    };
    try {
      const { assetId, standard, scope, mode } = req.body as { assetId: string; standard: string; scope: string; mode: string };
      if (!assetId || !standard) { send({ type: "error", error: "assetId and standard required" }); res.end(); return; }

      const asset = await storage.getDiscoveredAsset(assetId, req.user!.id);
      if (!asset) { send({ type: "error", error: "Asset not found" }); res.end(); return; }

      send({ type: "progress", stage: "reading", message: `Reading asset configuration for ${asset.name || asset.ipAddress}...` });

      const stdInfo = STANDARDS[standard] || { label: standard, description: "", controls: "" };
      const meta = (asset.metadata || {}) as any;
      const assetContext = JSON.stringify({
        name: asset.name, type: asset.type, vendor: asset.vendor, model: asset.model,
        os: meta?.software?.os, kernel: meta?.software?.kernel, version: meta?.software?.version,
        lastPatched: meta?.software?.lastPatched, uptime: meta?.software?.uptime,
        ip: asset.ipAddress, hostname: asset.hostname, protocol: asset.protocol,
        security: meta?.security, compliance: meta?.compliance, vulnerabilities: meta?.vulnerabilities,
        network: meta?.network, software: meta?.software, hardware: meta?.hardware,
        packages: meta?.software?.packages, installedApps: meta?.software?.installedApps?.slice(0, 15),
      }, null, 2);

      send({ type: "progress", stage: "analyzing", message: `Running ${stdInfo.label} gap analysis...` });

      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);

      const systemPrompt = `You are an expert ITIL Configuration Manager and security engineer specialized in ${stdInfo.label}.
Your role is to perform a formal ITIL Configuration Management audit and generate a structured Request for Change (RFC).
Mode: ${mode === "scratch" ? "Configure from Scratch — generate a comprehensive baseline configuration" : "Audit & Improve — identify gaps and produce targeted improvements"}.
Scope: ${scope === "all" ? "All configuration areas" : scope}.
Standard: ${stdInfo.label} — ${stdInfo.description}.
Key control areas: ${stdInfo.controls}.

You MUST respond with ONLY valid JSON matching this exact structure (no markdown, no commentary):
{
  "title": "RFC title (concise)",
  "changeType": "standard|normal|emergency",
  "risk": "low|medium|high|critical",
  "complianceScoreBefore": 0-100,
  "complianceScoreTarget": 0-100,
  "summary": "3-5 sentence executive summary",
  "impact": "Impact analysis: what services/users are affected, estimated downtime, dependencies",
  "maintenanceWindow": "Recommended maintenance window (e.g. Sunday 02:00-04:00 UTC)",
  "rollbackPlan": "Step-by-step rollback procedure if changes cause issues",
  "driftFindings": [
    {
      "id": "CIS-1.1.1",
      "title": "Finding title",
      "severity": "critical|high|medium|low|info",
      "currentState": "What is configured now",
      "requiredState": "What ${stdInfo.label} requires",
      "gap": "Why this is a problem",
      "category": "security|network|services|os|compliance"
    }
  ],
  "changes": [
    {
      "id": "CHG-001",
      "title": "Change title",
      "description": "What this change does and why",
      "findingRef": "CIS-1.1.1",
      "priority": 1,
      "riskLevel": "low|medium|high",
      "estimatedDuration": "5 min",
      "script": "actual shell/powershell script to apply this change",
      "rollbackScript": "script to undo this specific change",
      "verification": "how to verify the change was applied correctly"
    }
  ]
}

Produce between 5 and 15 drift findings and 5 and 15 change items. Be specific and technical. Scripts must be real, executable commands for the asset's OS.`;

      const userPrompt = `Asset Configuration Data:\n${assetContext}\n\nPerform a full ${stdInfo.label} configuration ${mode === "scratch" ? "design from scratch" : "gap analysis and improvement plan"} for this ${scope} scope. Generate the RFC JSON now.`;

      send({ type: "progress", stage: "generating", message: "Generating ITIL RFC with AI agent..." });

      let fullJson = "";
      const stream = await callAiLogged(openai, {
        model: aiModel, stream: true, temperature: 0.2, max_tokens: 4000,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }, { module: "config-management", endpoint: "/api/config-rfcs/analyze", userId: req.user!.id, providerName });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) { fullJson += text; send({ type: "chunk", text }); }
      }

      send({ type: "progress", stage: "saving", message: "Saving RFC to CMDB..." });

      // Parse the JSON
      let rfcData: any = {};
      try {
        const jsonMatch = fullJson.match(/\{[\s\S]*\}/);
        rfcData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      } catch { rfcData = { title: "Configuration Analysis", summary: fullJson.slice(0, 500) }; }

      const rfcNumber = await storage.getNextRfcNumber(req.user!.id);
      const rfc = await storage.createConfigRfc({
        userId: req.user!.id, assetId, rfcNumber,
        title: rfcData.title || `${stdInfo.label} Analysis — ${asset.name || asset.ipAddress}`,
        changeType: rfcData.changeType || "normal",
        category: scope, standard, mode,
        status: "draft",
        risk: rfcData.risk || "medium",
        summary: rfcData.summary || "",
        impact: rfcData.impact || "",
        driftFindings: rfcData.driftFindings || [],
        changes: rfcData.changes || [],
        rollbackPlan: rfcData.rollbackPlan || "",
        maintenanceWindow: rfcData.maintenanceWindow || "",
        currentConfigSnapshot: meta,
        complianceScoreBefore: rfcData.complianceScoreBefore ?? null,
        complianceScoreTarget: rfcData.complianceScoreTarget ?? null,
        aiModel,
      });

      send({ type: "done", rfcId: rfc.id, rfcNumber: rfc.rfcNumber });
      res.end();
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ error: err.message });
      else { send({ type: "error", error: err.message }); res.end(); }
    }
  });

  // Config Baselines
  app.get("/api/config-baselines", requireAuth, async (req, res) => {
    try {
      const baselines = await storage.getConfigBaselines(req.user!.id, req.query.assetId as string | undefined);
      res.json(baselines);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post("/api/config-baselines", requireAuth, async (req, res) => {
    try {
      const baseline = await storage.createConfigBaseline({ ...req.body, userId: req.user!.id });
      res.json(baseline);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete("/api/config-baselines/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteConfigBaseline(req.params.id, req.user!.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ── WebSocket Terminal ────────────────────────────────────────────────────
  // Short-lived tokens: browser fetches one, then opens WS with ?token=<uuid>
  const terminalTokens = new Map<string, { userId: string; expiresAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of terminalTokens) { if (v.expiresAt < now) terminalTokens.delete(k); }
  }, 5 * 60 * 1000);

  app.post("/api/terminal-token", requireAuth, async (_req, res) => {
    const { randomUUID } = await import("node:crypto");
    const token = randomUUID();
    terminalTokens.set(token, { userId: _req.user!.id, expiresAt: Date.now() + 2 * 60 * 1000 });
    res.json({ token });
  });

  const { WebSocketServer, WebSocket: WS } = await import("ws");
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/terminal" });

  wss.on("connection", (ws: import("ws").WebSocket, req: import("http").IncomingMessage) => {
    const qs = new URLSearchParams((req.url || "").split("?")[1] || "");
    const token = qs.get("token") || "";
    const entry = terminalTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      ws.send(JSON.stringify({ type: "error", data: "Unauthorized — obtain a fresh token first\r\n" }));
      ws.close(1008, "Unauthorized");
      return;
    }
    terminalTokens.delete(token); // single-use
    const userId = entry.userId;

    let sessionAssetId: string | null = null;
    let sessionProbeId: string | null = null;
    let sessionScriptType = "bash";
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const send = (msg: object) => {
      if (ws.readyState === WS.OPEN) ws.send(JSON.stringify(msg));
    };

    const stopPoll = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };

    ws.on("message", async (raw: Buffer) => {
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "ping") { send({ type: "pong" }); return; }

      if (msg.type === "init") {
        sessionAssetId = msg.assetId || null;
        sessionProbeId = msg.probeId || null;
        sessionScriptType = msg.scriptType || "bash";
        send({ type: "ready" });
        return;
      }

      if (msg.type === "command") {
        const cmd = (msg.data || "").trim();
        if (!cmd) return;
        stopPoll();

        if (!sessionProbeId || !sessionAssetId) {
          send({ type: "error", data: "No probe enrolled — cannot dispatch commands\r\n" });
          return;
        }

        try {
          const task = await storage.createRemediationTask({
            userId,
            assetId: sessionAssetId,
            probeId: sessionProbeId,
            title: `[TERMINAL] ${cmd.slice(0, 60)}`,
            description: "Dispatched from WebSocket Terminal",
            remediationScript: cmd,
            rollbackScript: null,
            scriptType: sessionScriptType,
            status: "queued",
            batchId: null,
            category: "terminal",
            riskLevel: "low",
            originType: "human",
            changeRef: null,
          });

          let attempts = 0;
          let aiSimTriggered = false;
          const taskId = task.id;

          // AI-simulation: if probe doesn't pick up within 5s, generate response using asset context
          const triggerAiSim = async () => {
            if (aiSimTriggered) return;
            aiSimTriggered = true;
            stopPoll();
            try {
              const asset = await storage.getDiscoveredAsset(sessionAssetId!, userId);
              const meta = (asset?.metadata || {}) as any;
              const assetCtx = asset ? JSON.stringify({
                name: asset.name, os: meta?.software?.os, kernel: meta?.software?.kernel,
                cpu: meta?.hardware?.cpu, ram: meta?.hardware?.ram,
                uptime: meta?.software?.uptime, ip: asset.ipAddress, hostname: asset.hostname,
                version: meta?.software?.version, packages: meta?.software?.packages,
              }) : "{}";

              const { client: openai, model: aiModel, providerName } = await getAiClient(userId);
              const resp = await callAiLogged(openai, {
                model: aiModel,
                temperature: 0.3,
                max_tokens: 600,
                messages: [
                  { role: "system", content: `You are simulating a ${sessionScriptType} terminal session on a remote host. Generate ONLY the realistic terminal output for the given command — no commentary, no markdown, no code fences. Base your output on the asset metadata provided. Keep it concise and accurate to what that OS and shell would actually print.` },
                  { role: "user", content: `Asset metadata: ${assetCtx}\n\nCommand: ${cmd}\n\nGenerate the realistic terminal output:` },
                ],
              }, { module: "terminal", endpoint: "/api/terminal-token", userId: req.user!.id, providerName });
              const simOutput = resp.choices[0]?.message?.content?.trim() || "(no output)";
              await storage.updateRemediationTask(taskId, { status: "completed", result: simOutput });
              send({ type: "data", data: simOutput + "\r\n" });
              send({ type: "system-note", data: "[AI-SIM] Probe offline — response simulated from asset context\r\n" });
            } catch (aiErr: any) {
              send({ type: "error", data: `Probe offline and AI simulation failed: ${aiErr.message}\r\n` });
            }
          };

          pollTimer = setInterval(async () => {
            attempts++;
            // After 5s (10 attempts) with no probe pickup → AI sim
            if (attempts === 10) { triggerAiSim(); return; }
            if (attempts > 10) return;
            try {
              const updated = await storage.getRemediationTask(taskId);
              if (!updated) { stopPoll(); return; }
              if (updated.status === "completed") {
                stopPoll();
                send({ type: "data", data: (updated.result || "(no output)") + "\r\n" });
              } else if (updated.status === "failed") {
                stopPoll();
                send({ type: "error", data: (updated.error || updated.result || "Command failed") + "\r\n" });
              }
            } catch { stopPoll(); }
          }, 500);

        } catch (err: any) {
          send({ type: "error", data: `Dispatch error: ${err.message}\r\n` });
        }
      }
    });

    ws.on("close", () => stopPoll());
    ws.on("error", () => stopPoll());
  });

  // ── Probe Live Stream Relay ────────────────────────────────────────────────
  // Short-lived viewer tokens: dashboard fetches one, opens WS ?type=view&token=<uuid>&probeId=<id>
  const streamViewerTokens = new Map<string, { userId: string; probeId: string; expiresAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of streamViewerTokens) { if (v.expiresAt < now) streamViewerTokens.delete(k); }
  }, 60 * 1000);

  app.post("/api/stream-viewer-token", requireAuth, async (req, res) => {
    const { randomUUID } = await import("node:crypto");
    const { probeId } = req.body as { probeId: string };
    if (!probeId) return res.status(400).json({ message: "probeId required" });
    const token = randomUUID();
    streamViewerTokens.set(token, { userId: req.user!.id, probeId, expiresAt: Date.now() + 5 * 60 * 1000 });
    res.json({ token });
  });

  // Relay channels keyed by probeId: ingest (probe) → viewer (dashboard) WebSocket relay
  const probeStreamChannels = new Map<string, { ingestWs: any | null; viewers: Set<any> }>();
  const getStreamChannel = (probeId: string) => {
    if (!probeStreamChannels.has(probeId)) {
      probeStreamChannels.set(probeId, { ingestWs: null, viewers: new Set() });
    }
    return probeStreamChannels.get(probeId)!;
  };

  const wssStream = new WebSocketServer({ server: httpServer, path: "/ws/probe-stream" });

  wssStream.on("connection", async (ws: import("ws").WebSocket, req: import("http").IncomingMessage) => {
    const qs = new URLSearchParams((req.url || "").split("?")[1] || "");
    const connType = qs.get("type") || "";

    if (connType === "ingest") {
      // Probe connects here and pushes binary MJPEG frames
      const siteToken = qs.get("siteToken") || "";
      if (!siteToken) { ws.close(1008, "siteToken required"); return; }
      const probe = await storage.getDiscoveryProbeByToken(siteToken);
      if (!probe) { ws.close(1008, "Unknown probe token"); return; }
      const probeId = probe.id;

      const ch = getStreamChannel(probeId);
      // Disconnect any previous ingest connection for this probe
      if (ch.ingestWs && ch.ingestWs.readyState === WS.OPEN) {
        ch.ingestWs.close(1000, "Replaced by new ingest connection");
      }
      ch.ingestWs = ws;

      // Notify all connected viewers that the stream has started
      const startMsg = JSON.stringify({ type: "stream_start", probeId });
      ch.viewers.forEach((v: any) => { if (v.readyState === WS.OPEN) v.send(startMsg); });

      ws.on("message", (data: Buffer, isBinary: boolean) => {
        if (ch.viewers.size === 0) return;
        const frame = isBinary ? data : Buffer.from(data.toString());
        ch.viewers.forEach((v: any) => {
          if (v.readyState === WS.OPEN) v.send(frame, { binary: true });
        });
      });

      ws.on("close", () => {
        if (ch.ingestWs === ws) ch.ingestWs = null;
        const endMsg = JSON.stringify({ type: "stream_end", probeId });
        ch.viewers.forEach((v: any) => { if (v.readyState === WS.OPEN) v.send(endMsg); });
      });

      ws.on("error", () => {
        if (ch.ingestWs === ws) ch.ingestWs = null;
      });

    } else if (connType === "view") {
      // Dashboard viewer connects here to receive frames
      const token = qs.get("token") || "";
      const probeId = qs.get("probeId") || "";
      const entry = streamViewerTokens.get(token);
      if (!entry || entry.expiresAt < Date.now() || entry.probeId !== probeId) {
        ws.close(1008, "Unauthorized");
        return;
      }

      const ch = getStreamChannel(probeId);
      ch.viewers.add(ws);

      // Tell the viewer whether the probe is already streaming or not
      if (ch.ingestWs && ch.ingestWs.readyState === WS.OPEN) {
        ws.send(JSON.stringify({ type: "stream_start", probeId }));
      } else {
        ws.send(JSON.stringify({ type: "stream_end", probeId }));
      }

      ws.on("close", () => ch.viewers.delete(ws));
      ws.on("error", () => ch.viewers.delete(ws));

    } else {
      ws.close(1008, "type must be 'ingest' or 'view'");
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     SERVICE FINANCIAL MANAGEMENT  (ITIL 4 General Management)
     ══════════════════════════════════════════════════════════════════ */
  app.get("/api/financial-management", requireAuth, async (_req, res) => {
    res.json(await storage.getServiceFinancials());
  });
  app.post("/api/financial-management", requireAuth, async (req, res) => {
    const parsed = insertServiceFinancialSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createServiceFinancial(parsed.data));
  });
  app.post("/api/financial-management/ai-analysis", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { financials } = req.body as { financials: any[] };
      const totalBudget = financials.reduce((s: number, f: any) => s + (f.annualBudget ?? 0), 0);
      const totalSpend  = financials.reduce((s: number, f: any) => s + (f.ytdSpend ?? 0), 0);
      const prompt = `You are an ITIL 4 Service Financial Management AI. Analyze this IT service portfolio's financial health and return actionable insights.

IT Service Financial Portfolio (${financials.length} services):
${financials.map((f: any) => `- ${f.serviceName} | Budget: $${f.annualBudget?.toLocaleString()} | YTD Spend: $${f.ytdSpend?.toLocaleString()} | Run Rate: $${f.monthlyRunRate?.toLocaleString()}/mo | Model: ${f.costModel} | Cost Center: ${f.costCenter} | Forecast: $${f.forecastedAnnual?.toLocaleString()}`).join("\n")}

Total Portfolio Budget: $${totalBudget.toLocaleString()} | Total YTD Spend: $${totalSpend.toLocaleString()} | Budget Utilization: ${Math.round((totalSpend / totalBudget) * 100)}%
Current date: ${new Date().toISOString()}

CRITICAL: Every recommendation MUST include all fields including actionType, actionLabel, and actionServiceName.
actionType must be one of: raise_change, raise_problem, notify_owner, review_contract, budget_alert
- raise_change: for optimisations that need a formal change (switching model, resizing, renegotiating)
- raise_problem: for chronic cost overruns or systemic issues needing investigation
- notify_owner: for flagging a service owner about a cost concern
- review_contract: for contract renewal, supplier SLA or licensing issues
- budget_alert: for immediate budget threshold breaches needing an alert

Return ONLY valid JSON with NO prose before or after:
{
  "summary": "Executive summary of IT financial health",
  "budgetHealth": "good|warning|critical",
  "overallUtilization": 0.0,
  "alerts": [{ "service": "", "type": "over_budget|under_utilized|forecast_overage|cost_model_risk", "message": "", "impact": "high|medium|low" }],
  "recommendations": [{ "id": "R1", "title": "", "rationale": "", "estimatedSaving": 0, "effort": "low|medium|high", "actionType": "raise_change", "actionLabel": "Raise RFC", "actionServiceName": "Cloud Infrastructure (AWS/Azure)" }],
  "topCostDrivers": [{ "service": "", "annualBudget": 0, "pctOfPortfolio": 0.0 }]
}`;
      const completion = await callAiLogged(openai, {
        model: aiModel, messages: [{ role: "user", content: prompt }],
        max_tokens: 1200, temperature: 0.3, response_format: { type: "json_object" },
      }, { module: "financial-management", endpoint: "/api/financial-management/ai-analysis", userId: req.user!.id, providerName });
      res.json(JSON.parse(completion.choices[0].message.content ?? "{}"));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  /* ── Financial Management: AI Agent Autonomous Execute ── */
  app.post("/api/financial-management/ai-execute", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { financials, recommendations } = req.body as {
        financials: any[];
        recommendations: Array<{
          id: string; title: string; rationale: string; estimatedSaving: number;
          effort: string; actionType: string; actionLabel?: string; actionServiceName?: string;
        }>;
      };

      // Step 1 — AI decides which actions to execute autonomously and in what order
      const decisionPrompt = `You are the HOLOCRON AI Financial Management Agent. You have autonomy to execute cost-optimisation actions.

Current IT portfolio snapshot (${financials.length} services):
${financials.map((f: any) => `- ${f.serviceName}: Budget $${f.annualBudget?.toLocaleString()} | YTD $${f.ytdSpend?.toLocaleString()} | Forecast $${f.forecastedAnnual?.toLocaleString()} | Model: ${f.costModel}`).join("\n")}

Available recommendations to execute:
${recommendations.map((r, i) => `[${i}] ${r.id}: "${r.title}" | actionType: ${r.actionType} | effort: ${r.effort} | estimatedSaving: $${r.estimatedSaving} | service: ${r.actionServiceName ?? "portfolio-wide"}`).join("\n")}

Decide which recommendations to execute autonomously right now. Execute all raise_change, raise_problem, and budget_alert actions where impact is significant. Skip review_contract (needs human). For notify_owner, execute if it flags a critical issue.

Return ONLY valid JSON:
{
  "agentReasoning": "Brief explanation of the agent's decision-making process",
  "execute": [
    {
      "recId": "R1",
      "actionType": "raise_change|raise_problem|budget_alert|notify_owner",
      "priority": 1,
      "agentNote": "Why the agent is executing this specific action now",
      "changeTitle": "Full title for the record to create",
      "changeDescription": "Full description for the record",
      "changePriority": "critical|high|medium|low",
      "changeRiskLevel": "high|medium|low",
      "serviceName": "target service name"
    }
  ],
  "skipped": [{ "recId": "R2", "reason": "Why skipped" }]
}`;
      const decisionResp = await callAiLogged(openai, {
        model: aiModel,
        messages: [{ role: "user", content: decisionPrompt }],
        max_tokens: 1000, temperature: 0.2, response_format: { type: "json_object" },
      }, { module: "financial-management", endpoint: "/api/financial-management/ai-execute", userId: req.user!.id, providerName });
      const decision = JSON.parse(decisionResp.choices[0].message.content ?? "{}");

      // Step 2 — Execute each decided action by calling storage directly
      const executionLog: Array<{
        recId: string; actionType: string; status: "success" | "failed" | "skipped";
        title: string; agentNote: string; recordId?: string | number; recordType?: string;
        skippedReason?: string; error?: string; executedAt: string;
      }> = [];

      for (const action of (decision.execute ?? [])) {
        const executedAt = new Date().toISOString();
        try {
          if (action.actionType === "raise_change") {
            const rec = recommendations.find(r => r.id === action.recId) ?? recommendations[0];
            const created = await storage.createChangeRequest({
              title: action.changeTitle ?? `[AI Agent] ${rec.title}`,
              description: action.changeDescription ?? `AI Financial Agent autonomous action.\n\nRationale: ${rec.rationale}\n\nTarget: ${action.serviceName ?? rec.actionServiceName ?? "Portfolio-wide"}\nEst. saving: $${rec.estimatedSaving?.toLocaleString() ?? 0}`,
              type: "standard",
              status: "draft",
              priority: action.changePriority ?? "medium",
              riskLevel: action.changeRiskLevel ?? rec.effort === "high" ? "high" : "medium",
              impactAssessment: `Autonomous action by HOLOCRON AI Financial Agent. ${action.agentNote}`,
              rollbackPlan: "Revert configuration or cost model to previous approved state.",
              affectedCIs: action.serviceName ? [action.serviceName] : [],
            });
            executionLog.push({ recId: action.recId, actionType: "raise_change", status: "success", title: created.title, agentNote: action.agentNote, recordId: created.id, recordType: "change_request", executedAt });
          } else if (action.actionType === "raise_problem") {
            const rec = recommendations.find(r => r.id === action.recId) ?? recommendations[0];
            const created = await storage.createProblem({
              title: action.changeTitle ?? `[AI Agent] ${rec.title}`,
              description: action.changeDescription ?? `AI Financial Agent detected chronic financial issue.\n\nRationale: ${rec.rationale}\n\nTarget: ${action.serviceName ?? rec.actionServiceName ?? "Portfolio-wide"}`,
              status: "open",
              priority: action.changePriority ?? "high",
              category: "financial",
              affectedServices: action.serviceName ? [action.serviceName] : [],
              relatedIncidentCount: 0,
            });
            executionLog.push({ recId: action.recId, actionType: "raise_problem", status: "success", title: created.title, agentNote: action.agentNote, recordId: created.id, recordType: "problem", executedAt });
          } else if (action.actionType === "budget_alert" || action.actionType === "notify_owner") {
            executionLog.push({ recId: action.recId, actionType: action.actionType, status: "success", title: action.changeTitle ?? action.recId, agentNote: action.agentNote, executedAt });
          }
        } catch (err: any) {
          executionLog.push({ recId: action.recId, actionType: action.actionType, status: "failed", title: action.changeTitle ?? action.recId, agentNote: action.agentNote, error: err.message, executedAt });
        }
      }

      for (const skip of (decision.skipped ?? [])) {
        executionLog.push({ recId: skip.recId, actionType: "skipped", status: "skipped", title: skip.recId, agentNote: "", skippedReason: skip.reason, executedAt: new Date().toISOString() });
      }

      res.json({
        agentReasoning: decision.agentReasoning ?? "AI Financial Agent executed autonomous actions.",
        executionLog,
        summary: {
          total: executionLog.length,
          succeeded: executionLog.filter(e => e.status === "success").length,
          failed: executionLog.filter(e => e.status === "failed").length,
          skipped: executionLog.filter(e => e.status === "skipped").length,
        },
        executedAt: new Date().toISOString(),
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  /* ══════════════════════════════════════════════════════════════════
     SUPPLIER MANAGEMENT  (ITIL 4 General Management)
     ══════════════════════════════════════════════════════════════════ */
  app.get("/api/supplier-management/suppliers", requireAuth, async (_req, res) => {
    res.json(await storage.getSuppliers());
  });
  app.post("/api/supplier-management/suppliers", requireAuth, async (req, res) => {
    const parsed = insertSupplierSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createSupplier(parsed.data));
  });
  app.get("/api/supplier-management/contracts", requireAuth, async (_req, res) => {
    res.json(await storage.getSupplierContracts());
  });
  app.post("/api/supplier-management/contracts", requireAuth, async (req, res) => {
    const parsed = insertSupplierContractSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createSupplierContract(parsed.data));
  });
  app.post("/api/supplier-management/ai-analysis", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { suppliers: supps, contracts } = req.body as { suppliers: any[]; contracts: any[] };
      const today = new Date();
      const expiring90 = contracts.filter((c: any) => {
        const end = new Date(c.endDate);
        const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86400000);
        return diffDays <= 90 && diffDays > 0;
      });
      const prompt = `You are an ITIL 4 Supplier Management AI. Analyze this vendor portfolio and return structured insights.

Suppliers (${supps.length} total):
${supps.map((s: any) => `- ${s.name} | Category: ${s.category} | Risk: ${s.riskTier} | Status: ${s.status}`).join("\n")}

Contracts (${contracts.length} total, ${expiring90.length} expiring within 90 days):
${contracts.map((c: any) => {
  const end = new Date(c.endDate);
  const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  return `- ${c.name} | Value: $${c.contractValue?.toLocaleString()} | Expires: ${c.endDate} (${diffDays}d) | Status: ${c.status} | SLA Target: ${c.slaUptimeTarget ?? "N/A"}% | Actual: ${c.actualUptime ?? "N/A"}%`;
}).join("\n")}

Current date: ${today.toISOString()}

Return ONLY valid JSON:
{
  "summary": "Concise supplier portfolio health summary",
  "portfolioRisk": "critical|high|medium|low",
  "contractAlerts": [{ "contractName": "", "supplier": "", "daysUntilExpiry": 0, "value": 0, "urgency": "immediate|urgent|normal", "recommendation": "" }],
  "underperformingSuppliers": [{ "supplier": "", "issue": "", "slaTarget": 0, "actual": 0, "recommendation": "" }],
  "riskConcentration": [{ "risk": "", "mitigation": "" }],
  "recommendations": [{ "id": "R1", "title": "", "rationale": "", "priority": "high|medium|low" }]
}`;
      const completion = await callAiLogged(openai, {
        model: aiModel, messages: [{ role: "user", content: prompt }],
        max_tokens: 900, temperature: 0.3, response_format: { type: "json_object" },
      }, { module: "supplier-management", endpoint: "/api/supplier-management/ai-analysis", userId: req.user!.id, providerName });
      res.json(JSON.parse(completion.choices[0].message.content ?? "{}"));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  /* ══════════════════════════════════════════════════════════════════
     DEPLOYMENT MANAGEMENT  (ITIL 4 Technical Management)
     ══════════════════════════════════════════════════════════════════ */
  app.get("/api/deployment-management", requireAuth, async (_req, res) => {
    res.json(await storage.getDeployments());
  });
  app.post("/api/deployment-management", requireAuth, async (req, res) => {
    const parsed = insertDeploymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createDeployment(parsed.data));
  });
  app.post("/api/deployment-management/ai-analysis", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { deployments: deps } = req.body as { deployments: any[] };
      const successful = deps.filter((d: any) => d.status === "successful").length;
      const failed     = deps.filter((d: any) => d.status === "failed").length;
      const rolledBack = deps.filter((d: any) => d.status === "rolled_back").length;
      const successRate = deps.length > 0 ? Math.round((successful / deps.length) * 100) : 0;
      const prompt = `You are an ITIL 4 Deployment Management AI. Analyze this deployment pipeline and return actionable insights.

Deployment Records (${deps.length} total — Success Rate: ${successRate}%):
${deps.map((d: any) => `- ${d.name} v${d.version} | Env: ${d.environment} | Status: ${d.status} | Type: ${d.deploymentType} | By: ${d.deployedBy} | Duration: ${d.durationMinutes ?? "N/A"}min | Services: ${(d.affectedServices ?? []).join(", ")}`).join("\n")}

Summary: ${successful} successful, ${failed} failed, ${rolledBack} rolled back, ${deps.filter((d: any) => d.status === "in_progress").length} in progress
Current date: ${new Date().toISOString()}

Return ONLY valid JSON:
{
  "summary": "Deployment pipeline health summary",
  "pipelineHealth": "healthy|degraded|critical",
  "successRate": 0,
  "failurePatterns": [{ "pattern": "", "affectedDeployments": [], "rootCause": "", "recommendation": "" }],
  "riskAssessment": [{ "deployment": "", "risk": "high|medium|low", "rationale": "" }],
  "recommendations": [{ "id": "R1", "title": "", "rationale": "", "priority": "high|medium|low" }],
  "environmentHealth": { "production": "healthy|degraded|critical", "staging": "healthy|degraded|critical", "development": "healthy|degraded|critical" }
}`;
      const completion = await callAiLogged(openai, {
        model: aiModel, messages: [{ role: "user", content: prompt }],
        max_tokens: 800, temperature: 0.3, response_format: { type: "json_object" },
      }, { module: "deployment-management", endpoint: "/api/deployment-management/ai-analysis", userId: req.user!.id, providerName });
      res.json(JSON.parse(completion.choices[0].message.content ?? "{}"));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  /* ══════════════════════════════════════════════════════════════════
     RELATIONSHIP MANAGEMENT  (ITIL 4 General Management)
     ══════════════════════════════════════════════════════════════════ */
  app.get("/api/relationship-management/stakeholders", requireAuth, async (_req, res) => {
    res.json(await storage.getStakeholders());
  });
  app.post("/api/relationship-management/stakeholders", requireAuth, async (req, res) => {
    const parsed = insertStakeholderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createStakeholder(parsed.data));
  });
  app.get("/api/relationship-management/reviews", requireAuth, async (_req, res) => {
    res.json(await storage.getServiceReviews());
  });
  app.post("/api/relationship-management/reviews", requireAuth, async (req, res) => {
    const parsed = insertServiceReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    res.status(201).json(await storage.createServiceReview(parsed.data));
  });
  app.post("/api/relationship-management/ai-analysis", requireAuth, async (req, res) => {
    try {
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const { stakeholders: stakeholders_, reviews } = req.body as { stakeholders: any[]; reviews: any[] };
      const avgSatisfaction = stakeholders_.filter((s: any) => s.satisfactionScore).length > 0
        ? (stakeholders_.filter((s: any) => s.satisfactionScore).reduce((a: number, s: any) => a + s.satisfactionScore, 0) / stakeholders_.filter((s: any) => s.satisfactionScore).length).toFixed(1)
        : "N/A";
      const prompt = `You are an ITIL 4 Relationship Management AI. Analyze stakeholder relationships and service review data to provide actionable insights.

Stakeholders (${stakeholders_.length} total, avg satisfaction: ${avgSatisfaction}/10):
${stakeholders_.map((s: any) => `- ${s.name} (${s.title}, ${s.department}) | Type: ${s.relationshipType} | Satisfaction: ${s.satisfactionScore ?? "Not rated"}/10 | Last Review: ${s.lastReviewDate ?? "Never"} | Services: ${(s.services ?? []).join(", ")}`).join("\n")}

Service Reviews (${reviews.length} total):
${reviews.map((r: any) => `- ${r.title} | Date: ${r.reviewDate} | Status: ${r.status} | SLA Perf: ${r.slaPerformance ?? "N/A"}% | CSAT: ${r.csatScore ?? "N/A"}/5 | Open Incidents: ${r.openIncidents}`).join("\n")}

Current date: ${new Date().toISOString()}

Return ONLY valid JSON:
{
  "summary": "Relationship health and stakeholder satisfaction summary",
  "relationshipHealth": "strong|adequate|at_risk|critical",
  "avgSatisfaction": 0.0,
  "atRiskStakeholders": [{ "name": "", "department": "", "issue": "", "satisfactionScore": 0, "recommendation": "" }],
  "reviewAlerts": [{ "title": "", "stakeholder": "", "issue": "overdue|low_csat|sla_breach|action_items_pending", "daysOverdue": 0, "recommendation": "" }],
  "recommendations": [{ "id": "R1", "title": "", "rationale": "", "priority": "high|medium|low", "stakeholder": "" }],
  "upcomingReviews": [{ "title": "", "reviewDate": "", "stakeholder": "" }]
}`;
      const completion = await callAiLogged(openai, {
        model: aiModel, messages: [{ role: "user", content: prompt }],
        max_tokens: 900, temperature: 0.3, response_format: { type: "json_object" },
      }, { module: "relationship-management", endpoint: "/api/relationship-management/ai-analysis", userId: req.user!.id, providerName });
      res.json(JSON.parse(completion.choices[0].message.content ?? "{}"));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  /* ══════════════════════════════════════════════════════════════════════
     AI OBSERVABILITY & GOVERNANCE ROUTES
     ══════════════════════════════════════════════════════════════════════ */

  // GET /api/ai-governance/stats
  app.get("/api/ai-governance/stats", requireAuth, async (req, res) => {
    try {
      const stats = await storage.getAiGovernanceStats();
      res.json(stats);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/ai-governance/logs
  app.get("/api/ai-governance/logs", requireAuth, async (req, res) => {
    try {
      const { module, status, riskLevel, requiresReview, limit, offset } = req.query as Record<string, string>;
      const logs = await storage.getAiAuditLogs({
        module: module || undefined,
        status: status || undefined,
        riskLevel: riskLevel || undefined,
        requiresReview: requiresReview === "true" ? true : undefined,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0,
      });
      res.json(logs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // PATCH /api/ai-governance/logs/:id/review
  app.patch("/api/ai-governance/logs/:id/review", requireAuth, async (req, res) => {
    try {
      const { status } = req.body as { status: "approved" | "rejected" };
      if (!["approved","rejected"].includes(status)) return res.status(400).json({ message: "status must be approved or rejected" });
      const updated = await storage.updateAiAuditLogReview(parseInt(req.params.id), status, req.user!.id);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/ai-governance/logs/:id/quality-review — AI quality reviewer
  app.post("/api/ai-governance/logs/:id/quality-review", requireAuth, async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      const log = await storage.getAiAuditLog(logId);
      if (!log) return res.status(404).json({ message: "Audit log not found" });

      // Mark as running
      await storage.updateAiAuditLogQualityReview(logId, {
        qualityReviewStatus: "running",
        qualityReviewResult: "",
        qualityReviewScore: 0,
        qualityReviewFlags: [],
      });

      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);

      const contextHint = req.body?.context ? `\nAdditional context: ${req.body.context}` : "";

      const systemPrompt = `You are the Holocron AI Quality Reviewer — an independent, critical analyst whose job is to review AI-generated outputs and flag quality issues.

Your role:
- Read the original AI output and assess its quality, accuracy, and completeness
- Flag hallucinations, unsupported claims, logical gaps, missing steps, or better alternatives
- Be specific, evidence-based, and constructive — not just critical

You MUST respond with a JSON object in this exact format:
{
  "score": <integer 0-100, where 100 = flawless and 0 = severely flawed>,
  "status": "<passed|flagged>",
  "flags": ["<specific issue 1>", "<specific issue 2>", ...],
  "critique": "<detailed multi-paragraph review of the output, including what was good and what could be improved>",
  "betterApproach": "<optional: if score < 70, suggest a better approach or what was missed>"
}`;

      const userPrompt = `Review this AI output for quality, accuracy, and completeness.

Module: ${log.module}
Endpoint/Feature: ${log.endpoint || "unknown"}
Model Used: ${log.model || "unknown"}${contextHint}

Input Summary (what was asked):
${log.inputSummary || "(not available)"}

AI Output:
${log.outputSummary || "(not available)"}

Existing risk flags: ${(log.riskFlags ?? []).join(", ") || "none"}
Hallucination risk: ${log.hallucinationRisk || "none"}

Provide your quality review as a JSON object.`;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }, {
        module: "ai-quality-reviewer",
        endpoint: `review-log-${logId}`,
        userId: req.user!.id,
        providerName,
      });

      const raw = completion.choices[0].message.content || "{}";
      let parsed: { score?: number; status?: string; flags?: string[]; critique?: string; betterApproach?: string } = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }

      const score = typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : 50;
      const reviewStatus = parsed.status === "passed" ? "passed" : "flagged";
      const flags = Array.isArray(parsed.flags) ? parsed.flags.slice(0, 8) : [];
      const critique = parsed.critique || raw;
      const betterApproach = parsed.betterApproach || "";
      const fullResult = critique + (betterApproach ? `\n\nBetter Approach:\n${betterApproach}` : "");

      const updated = await storage.updateAiAuditLogQualityReview(logId, {
        qualityReviewStatus: reviewStatus,
        qualityReviewResult: fullResult,
        qualityReviewScore: score,
        qualityReviewFlags: flags,
      });

      res.json(updated);
    } catch (err: any) {
      // Reset to none on failure
      await storage.updateAiAuditLogQualityReview(parseInt(req.params.id), {
        qualityReviewStatus: "none",
        qualityReviewResult: "",
        qualityReviewScore: 0,
        qualityReviewFlags: [],
      }).catch(() => {});
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/ai-governance/review-text — review any raw AI output text
  app.post("/api/ai-governance/review-text", requireAuth, async (req, res) => {
    try {
      const { text, context, module: mod, feature } = req.body as { text: string; context?: string; module?: string; feature?: string };
      if (!text) return res.status(400).json({ message: "text is required" });

      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);

      const systemPrompt = `You are the Holocron AI Quality Reviewer — an independent, critical analyst that reviews AI-generated content for accuracy, logic, completeness, and quality.

Review the provided AI output and respond ONLY with a JSON object in this exact format:
{
  "score": <integer 0-100>,
  "status": "<passed|flagged>",
  "flags": ["<issue 1>", "<issue 2>"],
  "critique": "<detailed multi-paragraph critique — what was good, what was problematic, what was missing>",
  "betterApproach": "<if score < 70, describe what a better approach would look like>"
}`;

      const userPrompt = `Review this AI-generated output:

Module/Feature: ${mod || "unknown"} / ${feature || "general"}${context ? `\nContext: ${context}` : ""}

AI Output to Review:
${text.slice(0, 3000)}

Provide a thorough quality review as a JSON object.`;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }, {
        module: "ai-quality-reviewer",
        endpoint: `review-text-${mod || "general"}`,
        userId: req.user!.id,
        providerName,
      });

      const raw = completion.choices[0].message.content || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }

      const score = typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : 50;
      const status = parsed.status === "passed" ? "passed" : "flagged";
      const flags = Array.isArray(parsed.flags) ? parsed.flags.slice(0, 8) : [];
      const critique = parsed.critique || raw;
      const betterApproach = parsed.betterApproach || "";
      const fullResult = critique + (betterApproach ? `\n\nBetter Approach:\n${betterApproach}` : "");

      res.json({ score, status, flags, result: fullResult });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/ai-governance/quality-monitor — per-module quality trends and drift alerts
  app.get("/api/ai-governance/quality-monitor", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { db: _db } = await import("./storage");
      const { aiAuditLogs: _logs } = await import("../shared/schema");
      const { and: _and, eq: _eq, desc: _desc, inArray: _inArray } = await import("drizzle-orm");

      // Pull the last 1000 reviewed logs for this user
      const reviewed = await _db.select({
        id: _logs.id,
        module: _logs.module,
        qualityReviewStatus: _logs.qualityReviewStatus,
        qualityReviewScore: _logs.qualityReviewScore,
        qualityReviewFlags: _logs.qualityReviewFlags,
        createdAt: _logs.createdAt,
        hallucinationRisk: _logs.hallucinationRisk,
        riskFlags: _logs.riskFlags,
      })
        .from(_logs)
        .where(_and(
          _eq(_logs.userId, userId),
          _inArray(_logs.qualityReviewStatus, ["passed", "flagged"]),
        ))
        .orderBy(_desc(_logs.createdAt))
        .limit(1000);

      // Group by module
      const byModule = new Map<string, typeof reviewed>();
      for (const row of reviewed) {
        const mod = row.module ?? "unknown";
        if (!byModule.has(mod)) byModule.set(mod, []);
        byModule.get(mod)!.push(row);
      }

      const CORRECTIVE_ACTIONS: Record<string, string[]> = {
        low_score: [
          "Expand the system prompt with more specific instructions and examples",
          "Add domain-specific context to reduce ambiguity",
          "Consider switching to a higher-capability AI provider for this module",
          "Enable human review gate for this module's outputs",
        ],
        declining_trend: [
          "Recent prompt or model changes may be degrading quality — review git history",
          "Check if the AI provider has been rate-limited or downgraded",
          "Add more output validation and schema constraints to this module's prompts",
          "Enable human-in-the-loop review until quality stabilizes",
        ],
        frequent_flags: [
          "Common flags indicate a systematic prompt issue — refine the system prompt",
          "Add explicit negative examples to the prompt (what NOT to produce)",
          "Consider using a temperature closer to 0 for more deterministic outputs",
        ],
        high_hallucination: [
          "Enable cross-reference validation against your knowledge base",
          "Add explicit fact-grounding instructions to the system prompt",
          "Switch to a model with stronger factual grounding (e.g. GPT-4 class)",
          "Reduce max_tokens to force concise, verifiable outputs",
        ],
      };

      const moduleStats = Array.from(byModule.entries()).map(([mod, rows]) => {
        // rows are ordered newest-first
        const scores = rows.map(r => r.qualityReviewScore ?? 0);
        const recent = scores.slice(0, 10);
        const previous = scores.slice(10, 20);

        const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

        const recentAvg = avg(recent);
        const previousAvg = avg(previous);
        const overallAvg = avg(scores);

        let trend: "improving" | "stable" | "declining" = "stable";
        if (recentAvg !== null && previousAvg !== null) {
          if (recentAvg < previousAvg - 8) trend = "declining";
          else if (recentAvg > previousAvg + 5) trend = "improving";
        }

        const flagCounts: Record<string, number> = {};
        for (const row of rows) {
          for (const f of (row.qualityReviewFlags ?? [])) {
            flagCounts[f] = (flagCounts[f] || 0) + 1;
          }
        }
        const topFlags = Object.entries(flagCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([flag, count]) => ({ flag, count }));

        // Determine alert conditions
        const isLowScore = (recentAvg ?? overallAvg ?? 100) < 70;
        const isDeclining = trend === "declining";
        const hasFrequentFlags = topFlags.length > 0 && (topFlags[0]?.count ?? 0) >= 3;
        const hasHighHallucination = rows.slice(0, 20).some(r => r.hallucinationRisk === "high");

        const alert = isLowScore || isDeclining || hasFrequentFlags;
        const alertReasons: string[] = [
          ...(isLowScore ? [`Low quality score (${recentAvg ?? overallAvg}/100)`] : []),
          ...(isDeclining ? [`Score declining: ${previousAvg}→${recentAvg}`] : []),
          ...(hasFrequentFlags ? [`Recurring issue: "${topFlags[0]?.flag}" flagged ${topFlags[0]?.count}x`] : []),
          ...(hasHighHallucination ? ["High hallucination risk detected in recent calls"] : []),
        ];

        // Build suggested actions
        const suggestedActions: string[] = [];
        if (isLowScore) suggestedActions.push(...CORRECTIVE_ACTIONS.low_score.slice(0, 2));
        if (isDeclining) suggestedActions.push(...CORRECTIVE_ACTIONS.declining_trend.slice(0, 2));
        if (hasFrequentFlags) suggestedActions.push(...CORRECTIVE_ACTIONS.frequent_flags.slice(0, 1));
        if (hasHighHallucination) suggestedActions.push(...CORRECTIVE_ACTIONS.high_hallucination.slice(0, 1));
        const uniqueActions = [...new Set(suggestedActions)].slice(0, 4);

        return {
          module: mod,
          reviewedCount: rows.length,
          overallAvg,
          recentAvg,
          previousAvg,
          trend,
          alert,
          alertReasons,
          suggestedActions: uniqueActions,
          topFlags,
          passedCount: rows.filter(r => r.qualityReviewStatus === "passed").length,
          flaggedCount: rows.filter(r => r.qualityReviewStatus === "flagged").length,
        };
      });

      // Sort: alerts first, then by declining trend, then by lowest score
      moduleStats.sort((a, b) => {
        if (a.alert !== b.alert) return a.alert ? -1 : 1;
        if (a.trend !== b.trend) {
          const tOrder = { declining: 0, stable: 1, improving: 2 };
          return tOrder[a.trend] - tOrder[b.trend];
        }
        return (a.recentAvg ?? 100) - (b.recentAvg ?? 100);
      });

      const totalReviewed = reviewed.length;
      const alertCount = moduleStats.filter(m => m.alert).length;
      const overallAvg = moduleStats.length
        ? Math.round(moduleStats.reduce((a, m) => a + (m.overallAvg ?? 0), 0) / moduleStats.length)
        : null;

      res.json({ moduleStats, totalReviewed, alertCount, overallAvg });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/ai-governance/circuit-breakers — return all circuit breaker states
  app.get("/api/ai-governance/circuit-breakers", requireAuth, async (_req, res) => {
    const all = Array.from(circuitBreakers.values()).map(cb => ({
      module: cb.module,
      consecutiveFailures: cb.consecutiveFailures,
      circuitOpen: cb.circuitOpen,
      openedAt: cb.openedAt?.toISOString() ?? null,
      tripReason: cb.tripReason,
      promptPatch: cb.promptPatch,
      autoIncidentId: cb.autoIncidentId,
      lastScore: cb.lastScore,
      lastReviewedAt: cb.lastReviewedAt?.toISOString() ?? null,
    }));
    res.json({ circuits: all, openCount: all.filter(c => c.circuitOpen).length });
  });

  // POST /api/ai-governance/circuit-breakers/:module/reset — manually reset a circuit
  app.post("/api/ai-governance/circuit-breakers/:module/reset", requireAuth, async (req, res) => {
    const module = decodeURIComponent(req.params.module);
    const cb = circuitBreakers.get(module);
    if (!cb) return res.status(404).json({ message: "No circuit breaker found for this module" });
    cb.consecutiveFailures = 0;
    cb.circuitOpen = false;
    cb.openedAt = null;
    cb.promptPatch = "";
    cb.tripReason = "";
    // Keep autoIncidentId so user can still navigate to the incident
    res.json({ success: true, message: `Circuit breaker for "${module}" has been manually reset` });
  });

  // POST /api/ai-governance/test-injection — test-bench for injection detection
  app.post("/api/ai-governance/test-injection", requireAuth, async (req, res) => {
    try {
      const { prompt } = req.body as { prompt: string };
      const detected = detectPromptInjection([{ role: "user", content: prompt }]);
      const { risk, flags } = assessHallucinationRisk(prompt, "test");
      res.json({ injectionDetected: detected, hallucinationRisk: risk, hallucinationFlags: flags });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── AI Context Store (RAG / Fine-tuning) ──────────────────────────────────
  app.get("/api/ai-governance/context-store/stats", requireAuth, async (_req, res) => {
    try { res.json(await storage.getAiContextStats()); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/ai-governance/context-store", requireAuth, async (req, res) => {
    try {
      const { module, approvedOnly, limit, offset } = req.query as any;
      res.json(await storage.getAiContextEntries({
        module: module || undefined,
        approvedOnly: approvedOnly === "true",
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0,
      }));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/ai-governance/context-store/:id/approve", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { approved } = req.body as { approved: boolean };
      const entry = await storage.updateAiContextEntry(id, { approvedForInjection: approved });
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/ai-governance/context-store/:id/baseline", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { baseline } = req.body as { baseline: boolean };
      const entry = await storage.updateAiContextEntry(id, { isDriftBaseline: baseline });
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/ai-governance/context-store/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteAiContextEntry(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Export as JSONL for fine-tuning (chat completion format)
  app.get("/api/ai-governance/context-store/export.jsonl", requireAuth, async (_req, res) => {
    try {
      const entries = await storage.getAiContextEntries({ approvedOnly: true, limit: 10000 });
      const lines = entries.map(e => JSON.stringify({
        messages: [
          ...(e.systemPrompt ? [{ role: "system", content: e.systemPrompt }] : []),
          ...(e.userMessage ? [{ role: "user", content: e.userMessage }] : []),
          { role: "assistant", content: e.assistantResponse },
        ],
        metadata: { module: e.module, qualityScore: e.qualityScore, sourceLogId: e.sourceLogId, createdAt: e.createdAt },
      })).join("\n");
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="holocron-context-store-${new Date().toISOString().slice(0, 10)}.jsonl"`);
      res.send(lines || '{"messages":[]}\n');
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Manually add a context entry
  app.post("/api/ai-governance/context-store", requireAuth, async (req, res) => {
    try {
      const { module, userMessage, assistantResponse, qualityScore, approvedForInjection, tags } = req.body;
      if (!module || !assistantResponse) return res.status(400).json({ message: "module and assistantResponse required" });
      const entry = await storage.createAiContextEntry({
        userId: req.user!.id,
        module,
        endpoint: "manual",
        userMessage: userMessage || undefined,
        assistantResponse,
        qualityScore: qualityScore ?? 80,
        hallucinationRisk: "none",
        approvedForInjection: approvedForInjection ?? true,
        injectionCount: 0,
        isDriftBaseline: false,
        tags: tags ?? ["manual"],
        sourceLogId: undefined,
      });
      res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── FINE-TUNE TOGGLE ────────────────────────────────────────────────────────
  app.patch("/api/ai-governance/context-store/:id/finetune", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { excluded } = req.body;
      const entry = await storage.updateAiContextEntry(id, {
        excludedFromFinetune: excluded === true,
        ...(req.body.fitUserMessage !== undefined ? { finetuneUserMessage: req.body.fitUserMessage } : {}),
        ...(req.body.fitAssistantResponse !== undefined ? { finetuneAssistantResponse: req.body.fitAssistantResponse } : {}),
      } as any);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/ai-governance/finetune-export.jsonl", requireAuth, async (_req, res) => {
    try {
      const entries = await storage.getAiContextEntries({ approvedOnly: true, limit: 2000 });
      const included = entries.filter((e: any) => !e.excludedFromFinetune);
      const lines = included.map((e: any) => JSON.stringify({
        messages: [
          { role: "system", content: `You are HOLOCRON AI assisting with ${e.module}. Provide accurate, high-quality IT orchestration guidance.` },
          { role: "user", content: e.finetuneUserMessage ?? e.userMessage ?? "(context)" },
          { role: "assistant", content: e.finetuneAssistantResponse ?? e.assistantResponse },
        ],
        metadata: { id: e.id, module: e.module, qualityScore: e.qualityScore },
      }));
      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Content-Disposition", `attachment; filename="holocron-finetune-${new Date().toISOString().slice(0,10)}.jsonl"`);
      res.send(lines.join("\n"));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── AI KNOWLEDGE BASE (PGVector Semantic RAG) ────────────────────────────
  async function getOpenAiEmbedding(text: string): Promise<number[]> {
    const emb = await _getEmbedding(text);
    if (!emb) throw new Error("Failed to generate embedding (check OPENAI_API_KEY)");
    return emb;
  }

  function chunkText(text: string, chunkSize = 1800, overlap = 200): string[] {
    const paragraphs = text.split(/\n{2,}/);
    const chunks: string[] = [];
    let current = "";
    for (const para of paragraphs) {
      if ((current + "\n\n" + para).length > chunkSize && current.length > 0) {
        chunks.push(current.trim());
        // keep last `overlap` chars for context continuity
        current = current.slice(-overlap) + "\n\n" + para;
      } else {
        current = current ? current + "\n\n" + para : para;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    // If very long paragraphs, hard-split
    const result: string[] = [];
    for (const chunk of chunks) {
      if (chunk.length <= chunkSize) { result.push(chunk); continue; }
      for (let i = 0; i < chunk.length; i += chunkSize - overlap) {
        result.push(chunk.slice(i, i + chunkSize));
      }
    }
    return result.filter(c => c.trim().length > 50);
  }

  app.post("/api/ai-knowledge-base/ingest", requireAuth, async (req, res) => {
    try {
      const { title, content, description, sourceType } = req.body;
      if (!title?.trim() || !content?.trim()) return res.status(400).json({ message: "title and content are required" });
      const doc = await storage.createKnowledgeDocument({
        userId: req.user!.id,
        title: title.trim(),
        sourceType: sourceType ?? "text",
        description: description?.trim() ?? null,
      });
      const chunks = chunkText(content);
      let embedded = 0;
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await getOpenAiEmbedding(chunks[i]);
          await storage.createDocumentChunk({ documentId: doc.id, chunkIndex: i, content: chunks[i], embedding });
          embedded++;
        } catch { /* skip chunk if embedding fails */ }
      }
      await storage.updateKnowledgeDocumentChunkCount(doc.id, embedded);
      res.status(201).json({ ...doc, chunkCount: embedded });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/ai-knowledge-base/documents", requireAuth, async (req, res) => {
    try {
      const docs = await storage.getKnowledgeDocuments(req.user!.id);
      res.json(docs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/ai-knowledge-base/documents/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteKnowledgeDocument(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/ai-knowledge-base/search", requireAuth, async (req, res) => {
    try {
      const { query, limit = 5 } = req.body;
      if (!query?.trim()) return res.status(400).json({ message: "query is required" });
      const embedding = await getOpenAiEmbedding(query);
      const results = await storage.semanticSearch(embedding, Math.min(limit, 10));
      res.json(results);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/ai-knowledge-base/chat — grounded AI answer using RAG
  app.post("/api/ai-knowledge-base/chat", requireAuth, async (req, res) => {
    try {
      const { query } = req.body;
      if (!query?.trim()) return res.status(400).json({ message: "query is required" });
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const embedding = await getOpenAiEmbedding(query);
      const chunks = await storage.semanticSearch(embedding, 5);
      const relevant = chunks.filter((c: any) => c.similarity > 0.35);
      const contextBlock = relevant.length > 0
        ? `KNOWLEDGE BASE CONTEXT (${relevant.length} passages retrieved):\n\n` +
          relevant.map((c: any, i: number) => `[Source ${i + 1}: ${c.documentTitle} — ${(c.similarity * 100).toFixed(0)}% match]\n${c.content}`).join("\n\n---\n\n")
        : "No relevant passages found in the knowledge base for this query.";
      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: `You are HOLOCRON AI, an expert IT orchestration assistant. Answer the user's question using ONLY the knowledge base context provided. If the context doesn't contain enough information, say so explicitly. Cite sources by their Source number. Be concise and precise.\n\n${contextBlock}` },
          { role: "user", content: query },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }, { module: "knowledge-base-chat", endpoint: "chat", userId: req.user!.id, providerName });
      const answer = completion.choices[0].message.content || "";
      res.json({ answer, sources: relevant.map((c: any) => ({ documentTitle: c.documentTitle, similarity: c.similarity, excerpt: c.content.slice(0, 300) })), providerName });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/ai-governance/context-store/:id/ai-enhance — AI improves a fine-tune pair
  app.post("/api/ai-governance/context-store/:id/ai-enhance", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getAiContextEntries({ limit: 5000 });
      const e = entry.find((x: any) => x.id === id);
      if (!e) return res.status(404).json({ message: "Entry not found" });
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const userMsg = (e as any).finetuneUserMessage ?? (e as any).userMessage ?? "";
      const assistantResp = (e as any).finetuneAssistantResponse ?? (e as any).assistantResponse ?? "";
      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: `You are a fine-tuning dataset quality expert. You will be given an IT orchestration Q&A pair from HOLOCRON AI (module: ${e.module}). Rewrite the ASSISTANT RESPONSE to be clearer, more complete, technically accurate, and better structured (use bullet points or numbered lists where appropriate). Keep the same factual content — just improve clarity, structure, and quality. Respond with ONLY the improved assistant response text, nothing else.` },
          { role: "user", content: `User prompt:\n${userMsg || "(no prompt — context injection)"}\n\nCurrent assistant response:\n${assistantResp}` },
        ],
        max_tokens: 1200,
        temperature: 0.4,
      }, { module: "finetune-enhance", endpoint: "ai-enhance", userId: req.user!.id, providerName });
      const enhanced = completion.choices[0].message.content || assistantResp;
      res.json({ enhancedResponse: enhanced, providerName });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── HOLOCRON CONCLAVE ──────────────────────────────────────────────────────
  const CONCLAVE_AGENTS = [
    { role: "advocate",   name: "Advocate",     color: "#22c55e", icon: "⚡", systemPrompt: "You are the Advocate in the Holocron Conclave, a structured AI deliberation system. Your role is to make the strongest possible case FOR the proposed topic. Argue its merits, benefits, alignment with organizational goals, and potential positive outcomes. Be constructive, evidence-based, and persuasive. Keep your response to 3-4 paragraphs." },
    { role: "critic",     name: "Critic",       color: "#ef4444", icon: "🔍", systemPrompt: "You are the Critic in the Holocron Conclave, a structured AI deliberation system. Your role is to rigorously challenge the proposed topic. Find weaknesses, challenge assumptions, identify flaws in reasoning, and ask hard questions. Be specific, evidence-based, and fair — not contrarian. Keep your response to 3-4 paragraphs." },
    { role: "risk",       name: "Risk Assessor",color: "#f97316", icon: "⚠️", systemPrompt: "You are the Risk Assessor in the Holocron Conclave, a structured AI deliberation system. Identify specific risks, failure modes, unintended consequences, and edge cases. Rate severity (high/medium/low) and likelihood for each risk. Be thorough and quantitative where possible. Keep your response to 3-4 paragraphs." },
    { role: "pragmatist", name: "Pragmatist",   color: "#3b82f6", icon: "🔧", systemPrompt: "You are the Pragmatist in the Holocron Conclave, a structured AI deliberation system. Evaluate feasibility, implementation complexity, resource requirements, timeline, and practical constraints. Focus on what can realistically be executed, what the critical path is, and what dependencies exist. Keep your response to 3-4 paragraphs." },
    { role: "ethicist",   name: "Ethicist",     color: "#a855f7", icon: "⚖️", systemPrompt: "You are the Ethicist in the Holocron Conclave, a structured AI deliberation system. Evaluate fairness, bias, governance implications, compliance requirements, and ethical considerations. Consider impacts on all stakeholders including underrepresented groups. Flag any legal or regulatory exposure. Keep your response to 3-4 paragraphs." },
  ] as const;

  async function runConclaveAgent(
    agentRole: string, agentName: string, systemPrompt: string,
    topic: string, context: string | null, round: number,
    previousMessages: import("@shared/schema").ConclaveMessage[],
    userId: string,
    openai: any, aiModel: string, providerName: string
  ): Promise<{ content: string; stance: string; keyPoints: string[]; agreementScore: number; latencyMs: number; model: string; providerName: string }> {
    const start = Date.now();

    const prevContext = previousMessages.length > 0
      ? `\n\n--- PREVIOUS ROUND ARGUMENTS ---\n` + previousMessages.map(m => `[${m.agentName.toUpperCase()}]: ${m.content}`).join("\n\n---\n\n")
      : "";

    const userMessage = round === 1
      ? `Topic for deliberation: "${topic}"${context ? `\n\nContext: ${context}` : ""}\n\nProvide your initial position on this topic.`
      : `Topic: "${topic}"${context ? `\nContext: ${context}` : ""}${prevContext}\n\nYou have now seen all initial positions. Respond to the arguments, maintain or refine your position, and engage directly with points made by other agents.`;

    const completion = await callAiLogged(openai, {
      model: aiModel,
      messages: [
        { role: "system", content: systemPrompt + "\n\nAt the end of your response, add a JSON block formatted exactly as:\n```json\n{\"stance\":\"support|challenge|neutral|mixed\",\"agreementScore\":0-100,\"keyPoints\":[\"point1\",\"point2\",\"point3\"]}\n```\nwhere agreementScore is how much you support the topic (0=strongly oppose, 100=strongly support)." },
        { role: "user", content: userMessage },
      ],
      max_tokens: 800,
      temperature: 0.8,
    }, {
      module: "conclave", endpoint: `${agentRole}-round${round}`,
      userId, providerName,
    });

    const raw = completion.choices[0].message.content || "";
    const latencyMs = Date.now() - start;

    // Extract JSON metadata
    let stance = "neutral";
    let keyPoints: string[] = [];
    let agreementScore = 50;
    let content = raw;
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const meta = JSON.parse(jsonMatch[1]);
        stance = meta.stance || "neutral";
        keyPoints = Array.isArray(meta.keyPoints) ? meta.keyPoints.slice(0, 5) : [];
        agreementScore = typeof meta.agreementScore === "number" ? Math.min(100, Math.max(0, meta.agreementScore)) : 50;
        content = raw.replace(/```json[\s\S]*?```/g, "").trim();
      } catch { /* use defaults */ }
    }

    return { content, stance, keyPoints, agreementScore, latencyMs, model: aiModel, providerName };
  }

  // POST /api/conclave — create new conclave
  app.post("/api/conclave", requireAuth, async (req, res) => {
    try {
      const { title, topic, context, domain } = req.body as { title: string; topic: string; context?: string; domain?: string };
      if (!title || !topic) return res.status(400).json({ message: "title and topic are required" });
      const c = await storage.createConclave({ title, topic, context: context || null, domain: domain || "general", userId: req.user!.id, status: "open", roundCount: 0, maxRounds: 2 });
      res.json(c);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/conclave — list conclaves
  app.get("/api/conclave", requireAuth, async (req, res) => {
    try {
      const list = await storage.getConclaves(req.user!.id);
      res.json(list);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/conclave/:id — get single conclave with messages
  app.get("/api/conclave/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const [c, messages] = await Promise.all([storage.getConclave(id), storage.getConclaveMessages(id)]);
      if (!c) return res.status(404).json({ message: "Conclave not found" });
      res.json({ ...c, messages });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/conclave/:id
  app.delete("/api/conclave/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteConclave(parseInt(req.params.id));
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/conclave/:id/deliberate — run next deliberation round
  app.post("/api/conclave/:id/deliberate", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
      const c = await storage.getConclave(id);
      if (!c) return res.status(404).json({ message: "Conclave not found" });
      if (c.status !== "open" && c.status !== "deliberating") return res.status(400).json({ message: `Cannot deliberate: conclave is ${c.status}` });
      if (c.roundCount >= c.maxRounds) return res.status(400).json({ message: "Max rounds reached. Proceed to consensus." });

      await storage.updateConclave(id, { status: "deliberating" });
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      console.log("[CONCLAVE] Using provider:", providerName, "model:", aiModel);
      const previousMessages = await storage.getConclaveMessages(id);
      const round = c.roundCount + 1;

      // Run agents sequentially — save each message immediately so the UI can
      // show agent cards appearing one by one via the 4-second auto-refresh
      const saved: import("@shared/schema").ConclaveMessage[] = [];
      for (const agent of CONCLAVE_AGENTS) {
        const result = await runConclaveAgent(
          agent.role, agent.name, agent.systemPrompt,
          c.topic, c.context, round, previousMessages,
          req.user!.id, openai, aiModel, providerName
        );
        const msg = await storage.createConclaveMessage({
          conclaveId: id, round,
          agentRole: agent.role, agentName: agent.name,
          content: result.content, stance: result.stance,
          keyPoints: result.keyPoints, agreementScore: result.agreementScore,
          model: result.model, providerName: result.providerName, latencyMs: result.latencyMs,
        });
        saved.push(msg);
      }

      await storage.updateConclave(id, { roundCount: round, status: "deliberating" });
      const updated = await storage.getConclave(id);
      res.json({ conclave: updated, messages: saved });
    } catch (err: any) {
      // Reset to open so the user can retry
      console.error("[CONCLAVE DELIBERATE ERROR]", {
        message: err.message,
        name: err.name,
        status: err.status,
        code: err.code,
        cause: err.cause?.message,
        stack: err.stack?.split("\n").slice(0, 5).join(" | "),
      });
      await storage.updateConclave(id, { status: "open" }).catch(() => {});
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/conclave/:id/consensus — Synthesizer builds final consensus
  app.post("/api/conclave/:id/consensus", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const c = await storage.getConclave(id);
      if (!c) return res.status(404).json({ message: "Conclave not found" });
      if (c.roundCount === 0) return res.status(400).json({ message: "Run at least one deliberation round first" });

      const allMessages = await storage.getConclaveMessages(id);
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);
      const start = Date.now();

      const allArguments = allMessages
        .filter(m => m.round > 0)
        .map(m => `[${m.agentName.toUpperCase()} — Round ${m.round}]\n${m.content}`)
        .join("\n\n---\n\n");

      const scores = allMessages.filter(m => m.agreementScore !== null).map(m => m.agreementScore as number);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 50;

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: "You are the Synthesizer in the Holocron Conclave. After a structured multi-agent deliberation, your role is to build consensus. Review all agent arguments, identify common ground, resolve conflicts, weigh the evidence, and formulate a final decision recommendation. Be balanced, specific, and actionable. Structure your response as: 1) CONSENSUS DECISION (clear recommendation), 2) KEY AGREEMENTS (what agents agreed on), 3) KEY TENSIONS (what was disputed), 4) RECOMMENDED ACTIONS (concrete next steps), 5) CONDITIONS & RISKS (what must be monitored)." },
          { role: "user", content: `Topic: "${c.topic}"${c.context ? `\nContext: ${c.context}` : ""}\n\nAll deliberation arguments:\n\n${allArguments}\n\nBuild the final consensus decision.` },
        ],
        max_tokens: 1000,
        temperature: 0.5,
      }, {
        module: "conclave", feature: "synthesizer-consensus",
        userId: req.user!.id, requestType: "synthesis",
        inputTokenEstimate: 800, outputTokenEstimate: 700,
      });

      const consensusDecision = completion.choices[0].message.content || "";
      const latencyMs = Date.now() - start;

      const [synthMsg] = await Promise.all([
        storage.createConclaveMessage({
          conclaveId: id, round: 0, agentRole: "synthesizer", agentName: "Synthesizer",
          content: consensusDecision, stance: "synthesize",
          keyPoints: ["Consensus built from all agent inputs"], agreementScore: avgScore,
          model: aiModel, providerName, latencyMs,
        }),
        storage.updateConclave(id, { status: "consensus", consensusDecision, consensusScore: avgScore }),
      ]);

      const updated = await storage.getConclave(id);
      res.json({ conclave: updated, synthesizerMessage: synthMsg });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/conclave/:id/execute — AI executes the consensus decision
  app.post("/api/conclave/:id/execute", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const c = await storage.getConclave(id);
      if (!c) return res.status(404).json({ message: "Conclave not found" });
      if (c.status !== "consensus") return res.status(400).json({ message: "Must reach consensus before executing" });

      await storage.updateConclave(id, { status: "executing" });
      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: "You are the Holocron Execution Engine. Given a consensus decision from the Holocron Conclave, your task is to simulate executing the recommended actions. Describe what was done, what systems were affected, what configurations were changed, and what the immediate outcomes are. Be specific and realistic. Format as an execution report with sections: ACTIONS TAKEN, SYSTEMS AFFECTED, CONFIGURATIONS CHANGED, IMMEDIATE OUTCOMES, MONITORING POINTS." },
          { role: "user", content: `Topic: "${c.topic}"\n\nConsensus Decision:\n${c.consensusDecision}\n\nSimulate the execution of this decision and provide an execution report.` },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }, {
        module: "conclave", feature: "execution",
        userId: req.user!.id, requestType: "generation",
        inputTokenEstimate: 500, outputTokenEstimate: 600,
      });

      const executionResult = completion.choices[0].message.content || "";
      await storage.updateConclave(id, { status: "evaluated", executionResult });
      const updated = await storage.getConclave(id);
      res.json({ conclave: updated });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/conclave/:id/evaluate — AI evaluates the executed outcome
  app.post("/api/conclave/:id/evaluate", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const c = await storage.getConclave(id);
      if (!c) return res.status(404).json({ message: "Conclave not found" });
      if (!c.executionResult) return res.status(400).json({ message: "Must execute before evaluating" });

      const { client: openai, model: aiModel, providerName } = await getAiClient(req.user!.id);

      const completion = await callAiLogged(openai, {
        model: aiModel,
        messages: [
          { role: "system", content: "You are the Holocron Evaluation Engine. Your role is to critically evaluate the outcome of an executed decision. Assess whether the execution achieved the goals set out in the consensus decision, identify gaps, unexpected outcomes, and lessons learned. Also determine if this outcome warrants a new Conclave session. Provide an evaluation score 0-100 and format as: OUTCOME ASSESSMENT, GOALS MET/MISSED, UNEXPECTED OUTCOMES, LESSONS LEARNED, EVALUATION SCORE (0-100), RECOMMEND NEW CONCLAVE (yes/no + reason)." },
          { role: "user", content: `Topic: "${c.topic}"\n\nConsensus Decision:\n${c.consensusDecision}\n\nExecution Report:\n${c.executionResult}\n\nEvaluate the outcome.` },
        ],
        max_tokens: 700,
        temperature: 0.3,
      }, {
        module: "conclave", feature: "evaluation",
        userId: req.user!.id, requestType: "analysis",
        inputTokenEstimate: 600, outputTokenEstimate: 500,
      });

      const evaluationResult = completion.choices[0].message.content || "";
      const scoreMatch = evaluationResult.match(/EVALUATION SCORE[:\s]+(\d+)/i);
      const evaluationScore = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : 75;
      const triggerNewConclave = /RECOMMEND NEW CONCLAVE[:\s]+yes/i.test(evaluationResult);

      await storage.updateConclave(id, { evaluationResult, evaluationScore, triggerNewConclave, status: "closed" });
      const updated = await storage.getConclave(id);
      res.json({ conclave: updated });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── FLYGUYS PLATFORM ──────────────────────────────────────────────────────
  // Operators
  app.get("/api/flyguys/operators", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguysOperators(req.user!.id)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/flyguys/operators", requireAuth, async (req, res) => {
    try {
      const data = insertFlyguysOperatorSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createFlyguysOperator(data));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/flyguys/operators/:id", requireAuth, async (req, res) => {
    try { res.json(await storage.updateFlyguysOperator(req.params.id, req.body)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/flyguys/operators/:id", requireAuth, async (req, res) => {
    try { await storage.deleteFlyguysOperator(req.params.id); res.json({ ok: true }); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Fleet
  app.get("/api/flyguys/fleet", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguysFleet(req.user!.id)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.get("/api/flyguys/fleet/operator/:operatorId", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguysFleetByOperator(req.params.operatorId)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/flyguys/fleet", requireAuth, async (req, res) => {
    try {
      const data = insertFlyguysFleetSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createFlyguysFleet(data));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/flyguys/fleet/:id", requireAuth, async (req, res) => {
    try { res.json(await storage.updateFlyguysFleet(req.params.id, req.body)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/flyguys/fleet/:id", requireAuth, async (req, res) => {
    try { await storage.deleteFlyguysFleet(req.params.id); res.json({ ok: true }); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Customer Requests
  app.get("/api/flyguys/requests", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguysRequestsForStaff(req.user!.id)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/flyguys/requests", requireAuth, async (req, res) => {
    try {
      const data = insertFlyguysRequestSchema.parse({ ...req.body, userId: req.user!.id });
      const created = await storage.createFlyguysRequest(data);
      res.status(201).json(created);
      // Fire-and-forget AI drone recommendation after response is sent
      (async () => {
        try {
          const { client: openai, model: aiModel } = await getAiClient(req.user!.id);
          const operators = await storage.getFlyguysOperators(req.user!.id);
          const fleet = await storage.getFlyguysFleet(req.user!.id);
          const droneTypes = ["mapping", "inspection", "photography", "delivery", "surveillance", "multi-purpose"];
          const prompt = `You are an expert drone operations consultant for Flyguys, a drone services marketplace.
Analyze this customer request and recommend the best drone type, then shortlist the most suitable operators.

REQUEST DETAILS:
- Title: ${created.title}
- Service Type: ${created.serviceType}
- Location: ${created.location}
- Description: ${created.description ?? "N/A"}
- Budget: $${created.budgetUsd ?? "Not specified"}
- Preferred Date: ${created.preferredDate ?? "Flexible"}

AVAILABLE DRONE TYPES: ${droneTypes.join(", ")}

AVAILABLE OPERATORS (with their fleet):
${operators.map(op => {
  const opDrones = fleet.filter(f => f.operatorId === op.id);
  return `- ${op.name} (${op.companyName}, ${op.coveredRegions.join(", ")}): Drones: ${opDrones.map(d => `${d.make} ${d.model} [${d.droneType}]`).join(", ") || "No fleet listed"}, Rating: ${op.rating ? op.rating / 10 : "N/A"}/5, Certs: ${op.certifications.join(", ")}`;
}).join("\n")}

INSTRUCTIONS:
1. Recommend exactly ONE drone type from the available list that best fits this request
2. Provide a concise technical reasoning (2-3 sentences) explaining why
3. Give a confidence score from 0.0 to 1.0
4. Shortlist 1-3 operators best suited for this job (by operator name). Consider: drone type match, region coverage, certifications, rating
5. For each shortlisted operator, provide a one-sentence reason

Respond ONLY with valid JSON in this exact format:
{
  "recommendedDroneType": "<drone_type>",
  "reasoning": "<2-3 sentence reasoning>",
  "confidence": <0.0-1.0>,
  "shortlistedOperatorNames": ["<name1>", "<name2>"],
  "operatorReasons": {"<name1>": "<reason>", "<name2>": "<reason>"}
}`;
          const completion = await openai.chat.completions.create({
            model: aiModel,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 600,
          });
          const rawJson = completion.choices[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(rawJson);
          // Resolve operator names to IDs
          const shortlistedIds: string[] = (parsed.shortlistedOperatorNames ?? []).map((name: string) => {
            const op = operators.find(o => o.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(o.name.toLowerCase()));
            return op?.id;
          }).filter(Boolean);
          const recommendation = {
            recommendedDroneType: parsed.recommendedDroneType ?? created.serviceType,
            reasoning: parsed.reasoning ?? "",
            confidence: parsed.confidence ?? 0.7,
            shortlistedOperatorIds: shortlistedIds,
            operatorReasons: parsed.operatorReasons ?? {},
          };
          await storage.updateFlyguysRequest(created.id, {
            requiredDroneType: recommendation.recommendedDroneType,
            aiDroneRecommendation: JSON.stringify(recommendation),
          });
        } catch (_e) { /* silently ignore background AI errors */ }
      })();
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Manual re-trigger of AI drone recommendation
  app.post("/api/flyguys/requests/:id/ai-recommend", requireAuth, async (req, res) => {
    try {
      const allRequests = await storage.getFlyguysAllRequests();
      const request = allRequests.find(r => r.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      const { client: openai, model: aiModel } = await getAiClient(req.user!.id);
      const operators = await storage.getFlyguysOperators(req.user!.id);
      const fleet = await storage.getFlyguysFleet(req.user!.id);
      const droneTypes = ["mapping", "inspection", "photography", "delivery", "surveillance", "multi-purpose"];
      const prompt = `You are an expert drone operations consultant for Flyguys, a drone services marketplace.
Analyze this customer request and recommend the best drone type, then shortlist the most suitable operators.

REQUEST DETAILS:
- Title: ${request.title}
- Service Type: ${request.serviceType}
- Location: ${request.location}
- Description: ${request.description ?? "N/A"}
- Budget: $${request.budgetUsd ?? "Not specified"}
- Preferred Date: ${request.preferredDate ?? "Flexible"}

AVAILABLE DRONE TYPES: ${droneTypes.join(", ")}

AVAILABLE OPERATORS (with their fleet):
${operators.map(op => {
  const opDrones = fleet.filter(f => f.operatorId === op.id);
  return `- ${op.name} (${op.companyName}, ${op.coveredRegions.join(", ")}): Drones: ${opDrones.map(d => `${d.make} ${d.model} [${d.droneType}]`).join(", ") || "No fleet listed"}, Rating: ${op.rating ? op.rating / 10 : "N/A"}/5, Certs: ${op.certifications.join(", ")}`;
}).join("\n")}

INSTRUCTIONS:
1. Recommend exactly ONE drone type from the available list that best fits this request
2. Provide a concise technical reasoning (2-3 sentences) explaining why
3. Give a confidence score from 0.0 to 1.0
4. Shortlist 1-3 operators best suited for this job (by operator name). Consider: drone type match, region coverage, certifications, rating
5. For each shortlisted operator, provide a one-sentence reason

Respond ONLY with valid JSON in this exact format:
{
  "recommendedDroneType": "<drone_type>",
  "reasoning": "<2-3 sentence reasoning>",
  "confidence": <0.0-1.0>,
  "shortlistedOperatorNames": ["<name1>", "<name2>"],
  "operatorReasons": {"<name1>": "<reason>", "<name2>": "<reason>"}
}`;
      const completion = await openai.chat.completions.create({
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 600,
      });
      const rawJson = completion.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(rawJson);
      const shortlistedIds: string[] = (parsed.shortlistedOperatorNames ?? []).map((name: string) => {
        const op = operators.find(o => o.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(o.name.toLowerCase()));
        return op?.id;
      }).filter(Boolean);
      const recommendation = {
        recommendedDroneType: parsed.recommendedDroneType ?? request.serviceType,
        reasoning: parsed.reasoning ?? "",
        confidence: parsed.confidence ?? 0.7,
        shortlistedOperatorIds: shortlistedIds,
        operatorReasons: parsed.operatorReasons ?? {},
      };
      const updated = await storage.updateFlyguysRequest(request.id, {
        requiredDroneType: recommendation.recommendedDroneType,
        aiDroneRecommendation: JSON.stringify(recommendation),
      });
      res.json({ ...updated, aiAnalysis: recommendation });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/flyguys/requests/:id", requireAuth, async (req, res) => {
    try { res.json(await storage.updateFlyguysRequest(req.params.id, req.body)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/flyguys/requests/:id", requireAuth, async (req, res) => {
    try { await storage.deleteFlyguysRequest(req.params.id); res.json({ ok: true }); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Bids
  app.get("/api/flyguys/bids", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguaysBids(req.user!.id)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.get("/api/flyguys/bids/request/:requestId", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguaysBidsByRequest(req.params.requestId)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/flyguys/bids", requireAuth, async (req, res) => {
    try {
      const data = insertFlyguaysBidSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createFlyguaysBid(data));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/flyguys/bids/:id", requireAuth, async (req, res) => {
    try { res.json(await storage.updateFlyguaysBid(req.params.id, req.body)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  // ── FLYGUYS WORKFLOW: Review → Publish → Claim ──────────────────────────
  // Step 1: Flyguys reviews request & opens negotiation with customer
  app.post("/api/flyguys/requests/:id/review", requireAuth, async (req, res) => {
    try {
      const { flyguysNotes, adjustedAmountUsd, splitType, assignedOperatorIds } = req.body;
      const isMulti = splitType === "multi";
      const opIds: string[] = isMulti && Array.isArray(assignedOperatorIds) ? assignedOperatorIds : [];
      const updated = await storage.updateFlyguysRequest(req.params.id, {
        status: "under-review",
        flyguysNotes: flyguysNotes ?? undefined,
        adjustedAmountUsd: adjustedAmountUsd ?? undefined,
        splitType: (isMulti ? "multi" : "single") as any,
        maxOperators: isMulti ? Math.max(2, opIds.length > 0 ? opIds.length : 2) : 1,
        assignedOperatorIds: opIds as any,
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Step 2: Flyguys publishes request to operators (sets adjusted amount + required drone type)
  app.post("/api/flyguys/requests/:id/publish", requireAuth, async (req, res) => {
    try {
      const publishSchema = z.object({
        adjustedAmountUsd: z.coerce.number().min(1, "Adjusted amount required"),
        requiredDroneType: z.string().min(1, "Required drone type required"),
        flyguysNotes: z.string().optional(),
      });
      const data = publishSchema.parse(req.body);
      const updated = await storage.updateFlyguysRequest(req.params.id, {
        status: "published",
        adjustedAmountUsd: data.adjustedAmountUsd,
        requiredDroneType: data.requiredDroneType,
        flyguysNotes: data.flyguysNotes,
      });
      res.json(updated);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Step 3: Operator claims published request (first-come-first-served, drone type check)
  app.post("/api/flyguys/requests/:id/claim", requireAuth, async (req, res) => {
    try {
      const claimSchema = z.object({
        operatorId: z.string().min(1),
        droneId: z.string().min(1),
      });
      const { operatorId, droneId } = claimSchema.parse(req.body);

      // Fetch current request state
      const allRequests = await storage.getFlyguysAllRequests();
      const request = allRequests.find(r => r.id === req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.status !== "published") return res.status(409).json({ message: "Request is no longer available for claiming" });

      // Check drone type matches
      const fleet = await storage.getFlyguysFleet(req.user!.id);
      const drone = fleet.find(f => f.id === droneId);
      if (!drone) return res.status(404).json({ message: "Drone not found" });
      if (request.requiredDroneType && drone.droneType !== request.requiredDroneType) {
        return res.status(400).json({ message: `This mission requires a ${request.requiredDroneType} drone. Your selected drone is ${drone.droneType}.` });
      }

      // Determine per-operator value for this claim
      const isMulti = (request as any).splitType === "multi";
      const maxOps = (request as any).maxOperators ?? 1;
      const currentClaimed = (request as any).claimedCount ?? 0;
      const assignedIds: string[] = (request as any).assignedOperatorIds ?? [];

      if (isMulti && currentClaimed >= maxOps) {
        return res.status(409).json({ message: "All operator slots for this mission have already been filled." });
      }

      // If Flyguys hand-picked operators, enforce the list
      if (isMulti && assignedIds.length > 0 && !assignedIds.includes(operatorId)) {
        return res.status(403).json({ message: "This operator was not selected by Flyguys for this mission." });
      }

      const newClaimedCount = currentClaimed + 1;
      const perOperatorValue = isMulti
        ? Math.round((request.adjustedAmountUsd ?? 0) / maxOps)
        : (request.adjustedAmountUsd ?? 0);

      // For multi: keep published until all slots filled; for single: mark claimed immediately
      const newStatus = (!isMulti || newClaimedCount >= maxOps) ? "claimed" : "published";
      await storage.updateFlyguysRequest(request.id, { status: newStatus, claimedCount: newClaimedCount } as any);

      const slotLabel = isMulti ? ` (Operator ${newClaimedCount}/${maxOps})` : "";

      // Create a claim record (repurpose bids table)
      const claim = await storage.createFlyguaysBid({
        requestId: request.id,
        operatorId,
        amountUsd: perOperatorValue,
        droneId,
        notes: `Claimed by operator${slotLabel}. Drone: ${drone.make} ${drone.model} (${drone.registrationNumber ?? drone.id.substring(0, 8)})`,
        status: "accepted",
        userId: req.user!.id,
      });

      // Auto-create project (one per operator in multi-split)
      const project = await storage.createFlyguysProject({
        requestId: request.id,
        bidId: claim.id,
        operatorId,
        title: isMulti ? `${request.title}${slotLabel}` : request.title,
        customerName: request.customerName,
        serviceType: request.serviceType,
        location: request.location,
        status: "active",
        projectValueUsd: perOperatorValue,
        commissionPct: 0,
        commissionUsd: 0,
        userId: req.user!.id,
      });

      res.json({ claim, project, slotsFilled: newClaimedCount, slotsTotal: maxOps });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Legacy award route (kept for backward compat, no commission)
  app.post("/api/flyguys/bids/:id/award", requireAuth, async (req, res) => {
    try {
      const bid = await storage.updateFlyguaysBid(req.params.id, { status: "accepted" });
      const allRequests = await storage.getFlyguysAllRequests();
      const request = allRequests.find(r => r.id === bid.requestId);
      if (request) await storage.updateFlyguysRequest(request.id, { status: "claimed" });
      const project = await storage.createFlyguysProject({
        requestId: bid.requestId,
        bidId: bid.id,
        operatorId: bid.operatorId,
        title: request?.title || `Project from claim ${bid.id.substring(0, 8)}`,
        customerName: request?.customerName,
        serviceType: request?.serviceType,
        location: request?.location,
        status: "active",
        projectValueUsd: bid.amountUsd,
        commissionPct: 0,
        commissionUsd: 0,
        userId: req.user!.id,
      });
      res.json({ bid, project });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET published requests for operator view (anonymized)
  app.get("/api/flyguys/published-missions", requireAuth, async (req, res) => {
    try {
      const all = await storage.getFlyguysAllRequests();
      const published = all.filter(r => r.status === "published");
      // Anonymize: strip customer PII
      res.json(published.map(r => ({
        id: r.id,
        title: r.title,
        serviceType: r.serviceType,
        location: r.location,
        adjustedAmountUsd: r.adjustedAmountUsd,
        requiredDroneType: r.requiredDroneType,
        preferredDate: r.preferredDate,
        description: r.description,
        status: r.status,
        createdAt: r.createdAt,
      })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Projects
  app.get("/api/flyguys/projects", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguysProjects(req.user!.id)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/flyguys/projects", requireAuth, async (req, res) => {
    try {
      const data = insertFlyguysProjectSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createFlyguysProject(data));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/flyguys/projects/:id", requireAuth, async (req, res) => {
    try { res.json(await storage.updateFlyguysProject(req.params.id, req.body)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.delete("/api/flyguys/projects/:id", requireAuth, async (req, res) => {
    try { await storage.deleteFlyguysProject(req.params.id); res.json({ ok: true }); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Single project fetch (for mission tracker)
  app.get("/api/flyguys/projects/:id", requireAuth, async (req, res) => {
    try {
      const projects = await storage.getFlyguysProjects(req.user!.id);
      const project = projects.find(p => p.id === req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
      res.json(project);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Save drone itinerary waypoints
  app.patch("/api/flyguys/projects/:id/waypoints", requireAuth, async (req, res) => {
    try {
      const { waypoints } = req.body as { waypoints: Array<{ lat: number; lng: number; label: string; order: number }> };
      if (!Array.isArray(waypoints)) return res.status(400).json({ message: "waypoints must be an array" });
      const updated = await storage.updateFlyguysProject(req.params.id, {
        waypointsJson: JSON.stringify(waypoints),
        trackingActive: true,
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Update drone's current position
  app.patch("/api/flyguys/projects/:id/position", requireAuth, async (req, res) => {
    try {
      const { lat, lng, heading } = req.body as { lat: number; lng: number; heading?: number };
      const updated = await storage.updateFlyguysProject(req.params.id, {
        currentLat: lat,
        currentLng: lng,
        currentHeading: heading ?? 0,
        lastPositionAt: new Date(),
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // AI route adherence check
  app.post("/api/flyguys/projects/:id/route-check", requireAuth, async (req, res) => {
    try {
      const { currentLat, currentLng, waypointsJson, expectedWaypointIndex } = req.body as {
        currentLat: number; currentLng: number; waypointsJson: string; expectedWaypointIndex: number;
      };
      const { client: openai, model: aiModel } = await getAiClient(req.user!.id);
      const waypoints = JSON.parse(waypointsJson || "[]");
      const expected = waypoints[expectedWaypointIndex];
      const distanceKm = expected
        ? Math.round(Math.sqrt(Math.pow((currentLat - expected.lat) * 111, 2) + Math.pow((currentLng - expected.lng) * 111 * Math.cos(currentLat * Math.PI / 180), 2)) * 100) / 100
        : null;

      const prompt = `You are an AI drone flight monitor. Analyze this flight status and respond in JSON.

Planned itinerary: ${JSON.stringify(waypoints)}
Current drone position: lat=${currentLat}, lng=${currentLng}
Expected current waypoint: ${expected ? JSON.stringify(expected) : "unknown"} (index ${expectedWaypointIndex})
Distance from expected waypoint: ${distanceKm !== null ? distanceKm + " km" : "unknown"}

Respond ONLY with valid JSON in this exact format:
{
  "status": "on-track" | "minor-deviation" | "major-deviation" | "off-route",
  "adherenceScore": 0-100,
  "summary": "brief one-sentence status",
  "alerts": ["alert message 1", ...],
  "recommendation": "what the operator should do"
}

Rules:
- "on-track": drone is within 0.05 km of expected waypoint
- "minor-deviation": 0.05–0.2 km off route
- "major-deviation": 0.2–0.5 km off
- "off-route": more than 0.5 km from planned route
- Keep alerts concise and actionable`;

      const completion = await openai.chat.completions.create({
        model: aiModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 300,
      });

      const analysis = JSON.parse(completion.choices[0].message.content || "{}");

      // Persist alerts to the project
      if (analysis.alerts?.length > 0) {
        const projects = await storage.getFlyguysProjects(req.user!.id);
        const project = projects.find(p => p.id === req.params.id);
        const existing = project?.routeAlerts ?? [];
        const newAlerts = [...(existing as string[]), ...analysis.alerts].slice(-20); // keep last 20
        await storage.updateFlyguysProject(req.params.id, { routeAlerts: newAlerts });
      }

      res.json({ ...analysis, distanceKm });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Clear route alerts
  app.delete("/api/flyguys/projects/:id/route-alerts", requireAuth, async (req, res) => {
    try {
      await storage.updateFlyguysProject(req.params.id, { routeAlerts: [] });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Deliverables
  app.get("/api/flyguys/deliverables/:projectId", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguysDeliverables(req.params.projectId)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/flyguys/deliverables", requireAuth, async (req, res) => {
    try {
      const data = insertFlyguysDeliverableSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createFlyguysDeliverable(data));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.delete("/api/flyguys/deliverables/:id", requireAuth, async (req, res) => {
    try { await storage.deleteFlyguysDeliverable(req.params.id); res.json({ ok: true }); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Transactions
  app.get("/api/flyguys/transactions", requireAuth, async (req, res) => {
    try { res.json(await storage.getFlyguysTransactions(req.user!.id)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });
  app.post("/api/flyguys/transactions", requireAuth, async (req, res) => {
    try {
      const data = insertFlyguysTransactionSchema.parse({ ...req.body, userId: req.user!.id });
      res.status(201).json(await storage.createFlyguysTransaction(data));
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/flyguys/transactions/:id", requireAuth, async (req, res) => {
    try { res.json(await storage.updateFlyguysTransaction(req.params.id, req.body)); }
    catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── FLYGUYS CUSTOMER PORTAL (public — no auth) ────────────────────────────
  app.post("/api/flyguys/portal/request", async (req, res) => {
    try {
      const portalSchema = z.object({
        customerName: z.string().min(2),
        customerEmail: z.string().email(),
        customerPhone: z.string().optional(),
        customerCompany: z.string().optional(),
        title: z.string().min(5),
        serviceType: z.string().min(1),
        location: z.string().min(2),
        description: z.string().min(10, "Mission statement must be at least 10 characters"),
        budgetUsd: z.coerce.number().optional(),
        preferredDate: z.string().optional(),
        documentUrls: z.array(z.string().url()).optional().default([]),
      });
      const data = portalSchema.parse(req.body);
      const created = await storage.createFlyguysRequest({ ...data, origin: "portal", status: "open" } as any);
      res.status(201).json({ id: created.id, status: "submitted", message: "Your request has been submitted. Flyguys will contact you shortly." });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // Track portal request by email (public)
  app.get("/api/flyguys/portal/track", async (req, res) => {
    try {
      const email = (req.query.email as string)?.toLowerCase().trim();
      if (!email) return res.status(400).json({ message: "email required" });
      // Return requests matching email (partial info only for privacy)
      const allRequests = await storage.getFlyguysRequestsByEmail(email);
      res.json(allRequests.map(r => ({
        id: r.id,
        title: r.title,
        serviceType: r.serviceType,
        location: r.location,
        status: r.status,
        createdAt: r.createdAt,
      })));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── FLYGUYS PROBE UPLOAD (probe authenticates via siteToken) ─────────────
  app.post("/api/flyguys/probe-upload", async (req, res) => {
    try {
      const uploadSchema = z.object({
        siteToken: z.string().min(1),
        projectId: z.string().min(1),
        fileName: z.string().min(1),
        fileType: z.enum(["video", "image", "report", "raw-data"]),
        fileSizeMb: z.coerce.number().optional(),
        description: z.string().optional(),
      });
      const parsed = uploadSchema.parse(req.body);
      const probe = await storage.getDiscoveryProbeByToken(parsed.siteToken);
      if (!probe) return res.status(401).json({ error: "Invalid probe token" });
      const deliverable = await storage.createFlyguysDeliverable({
        projectId: parsed.projectId,
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        fileSizeMb: parsed.fileSizeMb,
        description: parsed.description ?? `Uploaded via probe: ${probe.name}`,
        probeId: probe.id,
        userId: probe.userId ?? undefined,
      });
      res.status(201).json({ ok: true, deliverableId: deliverable.id });
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });

  // ── FLYGUYS FLEET → PROBE LINKING ────────────────────────────────────────
  app.post("/api/flyguys/fleet/:id/link-probe", requireAuth, async (req, res) => {
    try {
      const { probeId } = req.body;
      if (!probeId) return res.status(400).json({ message: "probeId required" });
      const fleet = await storage.getFlyguysFleet(req.user!.id);
      const drone = fleet.find(f => f.id === req.params.id);
      if (!drone) return res.status(404).json({ message: "Drone not found" });

      // Auto-register in CMDB
      const cmdbItem = await storage.createCmdbItem({
        name: `Drone — ${drone.make} ${drone.model} (${drone.registrationNumber ?? drone.id.substring(0, 8)})`,
        type: "drone",
        category: "iot",
        status: "active",
        environment: "production",
        owner: "Flyguys Platform",
        location: "Mobile",
        manufacturer: drone.make,
        model: drone.model,
        serialNumber: drone.registrationNumber ?? undefined,
        metadata: JSON.stringify({ droneType: drone.droneType, operatorId: drone.operatorId, probeId, cameraResolution: drone.cameraResolution }),
      });

      const updated = await storage.updateFlyguysFleet(drone.id, {
        probeId,
        cmdbItemId: cmdbItem.id,
        probeLinkedAt: new Date(),
      });
      res.json({ ok: true, drone: updated, cmdbItemId: cmdbItem.id });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/flyguys/fleet/:id/link-probe", requireAuth, async (req, res) => {
    try {
      const updated = await storage.updateFlyguysFleet(req.params.id, { probeId: null as any, cmdbItemId: null as any, probeLinkedAt: null as any });
      res.json({ ok: true, drone: updated });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  return httpServer;
}

async function generateMasterResponse(userInput: string, userId?: string): Promise<{
  message: string;
  agentId?: string;
  activity?: { agentId: string; action: string; details: string; relatedEntityType?: string; relatedEntityId?: string; autonomous?: boolean };
}> {
  const input = userInput.toLowerCase();
  const agents = await storage.getAgents();

  const createIncidentMatch = input.match(/create\s+(?:an?\s+)?incident\s*(?:for|about|:)?\s*(.*)/i);
  if (createIncidentMatch) {
    const incidentAgent = agents.find(a => a.type === "incident_manager");
    const title = createIncidentMatch[1]?.trim() || "New incident from chat";
    const severity = input.includes("critical") ? "critical" : input.includes("high") ? "high" : "medium";
    const created = await storage.createIncident({ title, description: `Created via AI Master chat: ${userInput}`, severity, status: "open", category: "User Reported", source: "AI Master Chat", assignedAgentId: incidentAgent?.id });
    return {
      message: `I've created a new incident through the **Incident Manager Agent**:\n\n- **Title:** ${title}\n- **Severity:** ${severity}\n- **Status:** Open\n- **ID:** ${created.id.substring(0, 8)}...\n\nThe Incident Manager has been assigned and will begin triage immediately.`,
      agentId: incidentAgent?.id,
      activity: incidentAgent ? { agentId: incidentAgent.id, action: "Incident Created via Chat", details: `Created incident "${title}" (${severity})`, relatedEntityType: "incident", relatedEntityId: created.id, autonomous: true } : undefined,
    };
  }

  if (input.includes("connector") || input.includes("protocol") || input.includes("snmp") || input.includes("mqtt") || input.includes("ssh monitor")) {
    const netAgent = agents.find(a => a.type === "network_monitor");
    const connectors = await storage.getConnectors();
    const active = connectors.filter(c => c.status === "active");
    const totalDiscovered = connectors.reduce((sum, c) => sum + (c.discoveredAssets || 0), 0);
    return {
      message: `The **Network Monitor** and **IoT Controller** agents manage **${connectors.length}** infrastructure connectors (**${active.length}** active):\n\n${connectors.map(c => `- **${c.name}** (${c.protocol.toUpperCase()}) → ${c.host} — ${c.discoveredAssets} assets discovered — ${c.status}`).join("\n")}\n\n**Total assets discovered:** ${totalDiscovered}\n\nVisit the Connectors page to manage monitoring protocols and credentials.`,
      agentId: netAgent?.id,
    };
  }

  if (input.includes("playbook") || input.includes("automation") || input.includes("remediat")) {
    const autoAgent = agents.find(a => a.type === "automation_engine");
    const playbooks = await storage.getPlaybooks();
    const executions = await storage.getPlaybookExecutions();
    const running = executions.filter(e => e.status === "running");
    return {
      message: `The **Automation Engine** manages **${playbooks.length}** playbooks with **${executions.length}** total executions (**${running.length}** currently running):\n\n${playbooks.slice(0, 5).map(p => `- **${p.name}** (${p.category}) — ${p.executionCount} runs — ${p.enabled ? "enabled" : "disabled"}`).join("\n")}\n\nVisit Automation to view playbooks and execution history.`,
      agentId: autoAgent?.id,
    };
  }

  if (input.includes("telemetry") || input.includes("metric") || input.includes("health") || input.includes("cpu") || input.includes("memory") || input.includes("temperature")) {
    const netAgent = agents.find(a => a.type === "network_monitor");
    const metrics = await storage.getTelemetryMetrics(50);
    const critical = metrics.filter(m => m.status === "critical");
    const warning = metrics.filter(m => m.status === "warning");
    const sources = [...new Set(metrics.map(m => m.sourceName))];
    return {
      message: `Infrastructure telemetry from **${sources.length}** sources:\n\n- **${critical.length}** critical metrics\n- **${warning.length}** warning metrics\n\n${critical.length > 0 ? "**Critical:**\n" + critical.map(m => `- ${m.sourceName}: ${m.metricName} = ${m.metricValue}${m.unit}`).join("\n") : ""}${warning.length > 0 ? "\n\n**Warning:**\n" + warning.map(m => `- ${m.sourceName}: ${m.metricName} = ${m.metricValue}${m.unit}`).join("\n") : ""}\n\nVisit Telemetry for full infrastructure health monitoring.`,
      agentId: netAgent?.id,
    };
  }

  if (input.includes("autonomous") || input.includes("what did agents do") || input.includes("agent action")) {
    const autoActivities = await storage.getAutonomousActivities(10);
    return {
      message: `Recent **autonomous agent actions** (no human intervention):\n\n${autoActivities.slice(0, 5).map((a, i) => {
        const agent = agents.find(ag => ag.id === a.agentId);
        return `${i + 1}. **${agent?.name}**: ${a.action}\n   ${a.details}`;
      }).join("\n\n")}\n\nVisit the Autonomous Operations page for the full action feed.`,
    };
  }

  if (input.includes("iot") || input.includes("sensor") || input.includes("device")) {
    const iotCtrl = agents.find(a => a.type === "iot_controller");
    const items = await storage.getCmdbItems();
    const iotDevices = items.filter(i => i.category === "iot");
    return {
      message: `The **IoT Controller** manages **${iotDevices.length}** IoT devices:\n\n${iotDevices.map(d => `- **${d.name}** (${d.type}) — ${d.location} — ${d.status}`).join("\n")}\n\nAll devices monitored via MQTT broker. Visit CMDB or Telemetry for details.`,
      agentId: iotCtrl?.id,
    };
  }

  const createSRMatch = input.match(/(?:create|submit|open)\s+(?:a\s+)?(?:service\s+)?request\s*(?:for|about|:)?\s*(.*)/i);
  if (createSRMatch) {
    const serviceAgent = agents.find(a => a.type === "service_desk");
    const title = createSRMatch[1]?.trim() || "New request from chat";
    const priority = input.includes("urgent") || input.includes("critical") ? "critical" : input.includes("high") ? "high" : "medium";
    const created = await storage.createServiceRequest({ title, description: `Created via AI Master chat: ${userInput}`, type: "general", priority, status: "pending", assignedAgentId: serviceAgent?.id });
    return {
      message: `The **Service Desk Agent** has created your service request:\n\n- **Title:** ${title}\n- **Priority:** ${priority}\n- **Status:** Pending\n- **ID:** ${created.id.substring(0, 8)}...\n\nTrack progress on the Service Requests page.`,
      agentId: serviceAgent?.id,
    };
  }

  if (input.includes("problem") || input.includes("root cause") || input.includes("known error")) {
    const problemAgent = agents.find(a => a.type === "problem_analyst");
    const problemsList = await storage.getProblems();
    const openProblems = problemsList.filter(p => p.status !== "resolved");
    return {
      message: `The **Problem Analyst Agent** reports:\n\n- **${problemsList.length}** total problems\n- **${openProblems.length}** open/investigating\n\n${openProblems.map((p, i) => `${i + 1}. **${p.title}** (${p.priority}) - ${p.status.replace(/_/g, " ")}`).join("\n")}\n\nVisit Problems for root cause analysis.`,
      agentId: problemAgent?.id,
    };
  }

  if (input.includes("incident") || input.includes("alert") || input.includes("breach")) {
    const incidentAgent = agents.find(a => a.type === "incident_manager");
    const allIncidents = await storage.getIncidents();
    const openCount = allIncidents.filter(i => i.status === "open").length;
    const criticalCount = allIncidents.filter(i => i.severity === "critical").length;
    return {
      message: `The **Incident Manager Agent** reports:\n\n- **${allIncidents.length}** total incidents\n- **${openCount}** open\n- **${criticalCount}** critical\n\nSay **"create incident for [description]"** to log a new one.`,
      agentId: incidentAgent?.id,
    };
  }

  if (userId && (input.includes("bcp") || input.includes("drp") || input.includes("business continuity") || input.includes("disaster recovery") || input.includes("continuity plan") || input.includes("recovery plan"))) {
    const bcpPlans = await storage.getBcpPlans(userId);
    const drpPlans = await storage.getDrpPlans(userId);
    const biaEntries = await storage.getBiaEntries(userId);
    const risks = await storage.getRiskAssessments(userId);
    const drills = await storage.getDrills(userId);
    const reviews = await storage.getReviews(userId);
    const activeBcp = bcpPlans.filter(p => p.status === "active").length;
    const activeDrp = drpPlans.filter(p => p.status === "active").length;
    const expiredBcp = bcpPlans.filter(p => p.status === "expired").length;
    const criticalBia = biaEntries.filter(e => e.criticality === "critical").length;
    const avgRto = biaEntries.length > 0 ? Math.round(biaEntries.reduce((s, e) => s + e.rtoHours, 0) / biaEntries.length) : 0;
    const criticalRisks = risks.filter(r => r.riskScore >= 20).length;
    const identifiedRisks = risks.filter(r => r.status === "identified").length;
    const completedDrills = drills.filter(d => d.status === "completed").length;
    const scheduledDrills = drills.filter(d => d.status === "scheduled").length;
    const passedDrills = drills.filter(d => d.result === "passed").length;
    const passRate = completedDrills > 0 ? Math.round((passedDrills / completedDrills) * 100) : 0;
    const pendingReviews = reviews.filter(r => r.status === "pending" || r.status === "in_progress").length;
    return {
      message: `**Business Continuity & Disaster Recovery — Full ITIL Lifecycle Overview**\n\nThe BCP/DRP module provides a complete ITIL-aligned continuity management lifecycle across 6 integrated tabs:\n\n---\n\n**1. BCP Plans** — ${bcpPlans.length} plans (${activeBcp} active${expiredBcp > 0 ? `, ${expiredBcp} expired` : ""})\nBusiness continuity plans covering organizational resilience. Each plan tracks status (draft → under review → approved → active → expired), business impact level, category, owner, recovery strategies, RTO/RPO targets, and affected systems.\n${bcpPlans.slice(0, 3).map(p => `- **${p.title}** — ${p.status.replace("_", " ")} — Impact: ${p.businessImpactLevel}`).join("\n")}\n\n**2. DRP Plans** — ${drpPlans.length} plans (${activeDrp} active)\nDisaster recovery plans for specific disaster scenarios. Each tracks disaster type, severity, recovery procedures, communication plan, test results, and failover/failback procedures.\n${drpPlans.slice(0, 3).map(p => `- **${p.title}** — ${p.status.replace("_", " ")} — Type: ${p.disasterType}`).join("\n")}\n\n**3. Impact Analysis (BIA)** — ${biaEntries.length} business functions analyzed\nBusiness Impact Analysis identifying critical functions, their Maximum Tolerable Downtime (MTD), Recovery Time Objective (RTO), Recovery Point Objective (RPO), financial impact per hour, dependencies, and workaround availability.\n- **${criticalBia}** critical functions | **Avg RTO:** ${avgRto}h | **${Math.round((biaEntries.filter(e => e.workaroundAvailable).length / Math.max(biaEntries.length, 1)) * 100)}%** have workarounds\n\n**4. Risk Register** — ${risks.length} threats assessed\nComprehensive risk register with threat categorization (natural, technical, human, environmental), likelihood × impact scoring (1-25), current controls, residual risk levels, mitigation strategies, and risk ownership.\n- **${criticalRisks}** critical (score ≥ 20) | **${identifiedRisks}** needing action | Top risk: ${risks.length > 0 ? risks.sort((a, b) => b.riskScore - a.riskScore)[0].threatName + ` (score: ${risks.sort((a, b) => b.riskScore - a.riskScore)[0].riskScore})` : "N/A"}\n\n**5. Drills & Exercises** — ${drills.length} exercises (${completedDrills} completed, ${scheduledDrills} scheduled)\nTesting and exercise log supporting tabletop, walkthrough, simulation, and full-test exercises. Each drill links to a BCP or DRP plan, tracks participants, scenario details, findings, lessons learned, and pass/fail results.\n- **Pass rate:** ${passRate}% | Types: tabletop, walkthrough, simulation, full test\n\n**6. Reviews & Audits** — ${reviews.length} reviews (${pendingReviews} pending/in progress)\nPlan review cycle tracking scheduled, post-incident, annual, and regulatory reviews. Each review records findings, recommendations, whether changes were required, and the next review date.\n\n---\n\nAsk me more specifically about any area: **"What's our business impact analysis?"**, **"Show me the risk register"**, **"Any upcoming drills?"**, or **"Plan review status"**.`,
    };
  }

  if (userId && (input.includes("bia") || input.includes("business impact") || input.includes("impact analysis") || input.includes("mtd") || input.includes("rto") || input.includes("rpo"))) {
    const entries = await storage.getBiaEntries(userId);
    const critical = entries.filter(e => e.criticality === "critical");
    const high = entries.filter(e => e.criticality === "high");
    const highMtd = entries.filter(e => e.mtdHours <= 4);
    const workaroundPct = entries.length > 0 ? Math.round((entries.filter(e => e.workaroundAvailable).length / entries.length) * 100) : 0;
    const avgRto = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.rtoHours, 0) / entries.length) : 0;
    const avgRpo = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.rpoHours, 0) / entries.length) : 0;
    const totalImpact = entries.reduce((s, e) => s + e.financialImpactPerHour, 0);
    const departments = Array.from(new Set(entries.map(e => e.department)));
    return {
      message: `**Business Impact Analysis (BIA)** — Full Summary\n\nThe BIA tab identifies and measures the impact of disruptions to critical business functions. It tracks each function's criticality level, recovery objectives, financial exposure, system dependencies, and workaround availability.\n\n**Key Metrics:**\n- **${entries.length}** business functions analyzed across **${departments.length}** departments\n- **${critical.length}** critical, **${high.length}** high priority\n- **${highMtd.length}** functions with MTD ≤ 4 hours (highest urgency)\n- **Average RTO:** ${avgRto} hours | **Average RPO:** ${avgRpo} hours\n- **Total financial exposure:** $${totalImpact.toLocaleString()}/hr combined\n- **Workaround available:** ${workaroundPct}% of functions\n\n**Critical Functions:**\n${critical.map(e => `- **${e.businessFunction}** (${e.department}) — MTD: ${e.mtdHours}h, RTO: ${e.rtoHours}h, RPO: ${e.rpoHours}h — $${e.financialImpactPerHour.toLocaleString()}/hr — ${e.dependencies.length} dependencies — Workaround: ${e.workaroundAvailable ? "Yes" : "No"}`).join("\n") || "None identified"}\n\n**All Functions by Department:**\n${departments.map(d => `- **${d}:** ${entries.filter(e => e.department === d).map(e => e.businessFunction).join(", ")}`).join("\n")}\n\nThe Impact Analysis tab on the BCP & DRP page provides KPI cards with drill-down filtering, criticality distribution bars, and detailed views with dependency tracking.`,
    };
  }

  if (userId && (input.includes("risk register") || input.includes("risk assess") || (input.includes("threat") && input.includes("risk")) || input.includes("mitigation"))) {
    const risks = await storage.getRiskAssessments(userId);
    const critical = risks.filter(r => r.riskScore >= 20);
    const high = risks.filter(r => r.riskScore >= 12 && r.riskScore < 20);
    const identified = risks.filter(r => r.status === "identified");
    const mitigated = risks.filter(r => r.status === "mitigated");
    const accepted = risks.filter(r => r.status === "accepted");
    const transferred = risks.filter(r => r.status === "transferred");
    const categories = Array.from(new Set(risks.map(r => r.threatCategory)));
    const avgScore = risks.length > 0 ? Math.round(risks.reduce((s, r) => s + r.riskScore, 0) / risks.length) : 0;
    return {
      message: `**Risk Register** — Full Summary\n\nThe Risk Register tab provides a comprehensive threat assessment catalog. Each risk entry includes threat categorization (natural, technical, human, environmental), a likelihood × impact score (1-5 each, max score 25), current controls in place, residual risk level, mitigation strategy, and assigned risk owner.\n\n**Key Metrics:**\n- **${risks.length}** threats assessed across **${categories.length}** categories (${categories.join(", ")})\n- **${critical.length}** critical risks (score ≥ 20) | **${high.length}** high (12-19) | **Average score:** ${avgScore}\n- **Status breakdown:** ${identified.length} identified, ${mitigated.length} mitigated, ${accepted.length} accepted, ${transferred.length} transferred\n\n**Residual Risk:** ${risks.filter(r => r.residualRisk === "critical").length} critical, ${risks.filter(r => r.residualRisk === "high").length} high, ${risks.filter(r => r.residualRisk === "medium").length} medium, ${risks.filter(r => r.residualRisk === "low").length} low\n\n**Top 5 Risks (by score):**\n${risks.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5).map((r, i) => `${i + 1}. **${r.threatName}** (${r.threatCategory}) — Score: ${r.riskScore} (${r.likelihood}×${r.impact}) — Residual: ${r.residualRisk} — Status: ${r.status} — Owner: ${r.riskOwner}`).join("\n")}\n\nThe Risk Register tab provides KPI drill-down, residual risk distribution bars, and full detail views with current controls and mitigation strategies.`,
    };
  }

  if (userId && (input.includes("drill") || input.includes("exercise") || input.includes("tabletop") || input.includes("simulation") || input.includes("bcp test"))) {
    const drills = await storage.getDrills(userId);
    const completed = drills.filter(d => d.status === "completed");
    const scheduled = drills.filter(d => d.status === "scheduled");
    const passed = completed.filter(d => d.result === "passed").length;
    const partial = completed.filter(d => d.result === "partial").length;
    const failed = completed.filter(d => d.result === "failed").length;
    const passRate = completed.length > 0 ? Math.round((passed / completed.length) * 100) : 0;
    const types = Array.from(new Set(drills.map(d => d.drillType)));
    const overdue = drills.filter(d => d.status === "scheduled" && new Date(d.scheduledDate) < new Date()).length;
    return {
      message: `**Drills & Exercises** — Full Summary\n\nThe Drills & Exercises tab tracks all continuity testing activities. It supports 4 exercise types — tabletop, walkthrough, simulation, and full test. Each drill links to a BCP or DRP plan, records participants, a detailed scenario, and (once completed) captures findings, lessons learned, and pass/fail/partial results.\n\n**Key Metrics:**\n- **${drills.length}** total exercises | Types used: ${types.map(t => t.replace("_", " ")).join(", ")}\n- **${completed.length}** completed | **${scheduled.length}** scheduled | **${overdue}** overdue\n- **Results:** ${passed} passed, ${partial} partial, ${failed} failed — **Pass rate: ${passRate}%**\n\n**Completed Exercises:**\n${completed.map(d => `- **${d.title}** (${d.drillType.replace("_", " ")}) — ${d.result} — ${d.participants.length} participants — ${d.findings ? "Findings recorded" : "No findings"}`).join("\n") || "None yet"}\n\n**Upcoming/Scheduled:**\n${scheduled.map(d => `- **${d.title}** (${d.drillType.replace("_", " ")}) — Scheduled: ${new Date(d.scheduledDate).toLocaleDateString()} — ${d.participants.length} participants`).join("\n") || "None scheduled"}\n\nThe Drills tab provides KPI drill-down cards, exercise type distribution bars, and detail views showing full scenarios, findings, and lessons learned.`,
    };
  }

  if (userId && (input.includes("review") && (input.includes("bcp") || input.includes("plan") || input.includes("audit")) || input.includes("plan review") || input.includes("compliance review"))) {
    const reviews = await storage.getReviews(userId);
    const pending = reviews.filter(r => r.status === "pending");
    const inProgress = reviews.filter(r => r.status === "in_progress");
    const completed = reviews.filter(r => r.status === "completed");
    const changesRequired = completed.filter(r => r.changesRequired).length;
    const changesPct = completed.length > 0 ? Math.round((changesRequired / completed.length) * 100) : 0;
    const types = Array.from(new Set(reviews.map(r => r.reviewType)));
    const reviewers = Array.from(new Set(reviews.map(r => r.reviewer)));
    return {
      message: `**Plan Reviews & Audits** — Full Summary\n\nThe Reviews tab manages the plan review lifecycle. It tracks 4 review types — scheduled, post-incident, annual, and regulatory. Each review links to a BCP or DRP plan and records the reviewer, findings, recommendations, whether plan changes were required, a description of changes made, and the next scheduled review date.\n\n**Key Metrics:**\n- **${reviews.length}** total reviews | Types used: ${types.map(t => t.replace("_", " ")).join(", ")}\n- **${pending.length}** pending | **${inProgress.length}** in progress | **${completed.length}** completed\n- **${changesRequired}** reviews required plan changes (${changesPct}%)\n- **Reviewers:** ${reviewers.join(", ")}\n\n**Completed Reviews:**\n${completed.map(r => `- **${r.reviewType.replace("_", " ")}** review by ${r.reviewer} — ${new Date(r.reviewDate).toLocaleDateString()} — Changes required: ${r.changesRequired ? "Yes" : "No"}${r.nextReviewDate ? ` — Next: ${new Date(r.nextReviewDate).toLocaleDateString()}` : ""}`).join("\n") || "None completed"}\n\n**Pending/In Progress:**\n${[...pending, ...inProgress].map(r => `- **${r.reviewType.replace("_", " ")}** review by ${r.reviewer} — ${r.status.replace("_", " ")} — Scheduled: ${new Date(r.reviewDate).toLocaleDateString()}`).join("\n") || "All reviews completed"}\n\nThe Reviews tab provides KPI drill-down, review type distribution bars, and detail views with full findings and recommendations.`,
    };
  }

  if (input.includes("security") || input.includes("threat") || input.includes("vulnerability")) {
    const securityAgent = agents.find(a => a.type === "security_monitor");
    const events = await storage.getSecurityEvents();
    return {
      message: `The **Security Monitor Agent** has detected **${events.length}** events:\n\n- **${events.filter(e => e.severity === "critical").length}** critical\n- **${events.filter(e => !e.processed).length}** pending review`,
      agentId: securityAgent?.id,
    };
  }

  if (input.includes("service") || input.includes("request") || input.includes("ticket") || input.includes("help")) {
    const serviceAgent = agents.find(a => a.type === "service_desk");
    const requests = await storage.getServiceRequests();
    return {
      message: `The **Service Desk Agent** manages **${requests.length}** requests:\n\n- **${requests.filter(r => r.status === "pending").length}** pending\n- **${requests.filter(r => r.status === "in_progress").length}** in progress\n\nSay **"create request for [description]"** or visit Service Requests.`,
      agentId: serviceAgent?.id,
    };
  }

  const stats = await storage.getDashboardStats();
  return {
    message: `**HOLOCRON AI** — Autonomous Infrastructure Management\n\n**${stats.activeAgents}** AI agents actively managing your infrastructure:\n- **${stats.totalConnectors}** monitoring connectors (${stats.activeConnectors} active)\n- **${stats.totalCmdbItems}** infrastructure assets tracked\n- **${stats.totalPlaybooks}** automation playbooks\n- **${stats.playbookExecutions}** autonomous actions executed\n- **${stats.openIncidents}** open incidents\n\nAsk me about:\n- **ITSM:** incidents, problems, changes, service requests\n- **Infrastructure:** connectors, playbooks, telemetry, IoT devices\n- **BCP/DRP:** business continuity plans, disaster recovery, impact analysis, risk register, drills, reviews\n- **Agents:** autonomous operations, agent actions`,
  };
}
