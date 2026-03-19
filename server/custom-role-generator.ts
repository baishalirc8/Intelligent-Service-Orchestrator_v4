import type { InsertOrgRole } from "@shared/schema";

const AI_PRICE_MIN = 1000;
const AI_PRICE_MAX = 5000;

interface DetectedCustomNeed {
  title: string;
  description: string;
  category: string;
  keywords: string[];
}

const CUSTOM_SKILL_PATTERNS: {
  pattern: RegExp;
  extract: (match: RegExpMatchArray, fullText: string) => DetectedCustomNeed | null;
}[] = [
  {
    pattern: /(?:need|want|looking for|require|hire|find)\s+(?:a |an |someone (?:to|who|for) |help (?:with )?)?(.{10,120}?)(?:\.|,|;|$)/gi,
    extract: (match, _fullText) => {
      const raw = match[1].trim();
      if (raw.length < 10) return null;
      return { title: raw, description: raw, category: "Custom", keywords: extractKeywords(raw) };
    },
  },
  {
    pattern: /(?:struggle|struggling|challenge|challenged|problem|issue|trouble|difficult)\s+(?:with |in |around )?(.{10,120}?)(?:\.|,|;|$)/gi,
    extract: (match, _fullText) => {
      const raw = match[1].trim();
      if (raw.length < 10) return null;
      return { title: `${raw} Specialist`, description: `Addressing challenges in ${raw}`, category: "Custom", keywords: extractKeywords(raw) };
    },
  },
  {
    pattern: /(?:improve|optimize|enhance|streamline|automate|build|implement|develop|create|set up|establish|launch|deploy|manage|scale)\s+(?:our |the |my |a )?(.{8,120}?)(?:\.|,|;|$)/gi,
    extract: (match, _fullText) => {
      const raw = match[1].trim();
      if (raw.length < 8) return null;
      return { title: raw, description: `${capitalizeFirst(match[0].trim().split(/\s/)[0])} ${raw}`, category: "Custom", keywords: extractKeywords(raw) };
    },
  },
];

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "can", "shall", "our", "my", "your",
    "we", "they", "it", "that", "this", "those", "these", "some", "all",
    "any", "each", "every", "both", "more", "most", "other", "such",
    "than", "too", "very", "just", "also", "into", "over", "after",
    "before", "between", "under", "about", "up", "out", "off", "down",
    "through", "during", "only", "then", "so", "no", "not", "if",
    "need", "want", "looking", "help", "someone", "who", "what",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 8);
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const LEVEL_SALARY: Record<string, number> = {
  senior: 140000,
  mid: 95000,
  lead: 125000,
  manager: 145000,
  director: 185000,
};

function computeAiPrice(level: string): { monthlyPrice: number; humanCostMonthly: number } {
  const salary = LEVEL_SALARY[level] || 110000;
  const burdened = Math.round((salary * 1.35) / 12);
  const aiRaw = Math.round(burdened * 0.3);
  const monthlyPrice = Math.min(AI_PRICE_MAX, Math.max(AI_PRICE_MIN, aiRaw));
  return { monthlyPrice, humanCostMonthly: burdened };
}

const DEPT_COLORS: Record<string, string> = {
  "Infrastructure & Cloud Operations": "#3b82f6",
  "Cybersecurity": "#ef4444",
  "Service Management": "#06b6d4",
  "AI & Automation": "#8b5cf6",
  "Data & Analytics": "#10b981",
  "Platform Engineering": "#6366f1",
  "IT Finance & Vendor Management": "#f59e0b",
  "IT Governance": "#64748b",
  "Compliance": "#7c3aed",
  "R&D & Innovation": "#ec4899",
  "Custom": "#0ea5e9",
};

const DEPT_ICONS: Record<string, string> = {
  "Infrastructure & Cloud Operations": "Server",
  "Cybersecurity": "Shield",
  "Service Management": "Headphones",
  "AI & Automation": "Brain",
  "Data & Analytics": "BarChart3",
  "Platform Engineering": "Code",
  "IT Finance & Vendor Management": "DollarSign",
  "IT Governance": "Building2",
  "Compliance": "Scale",
  "R&D & Innovation": "Lightbulb",
  "Custom": "Sparkles",
};

interface DepartmentMapping {
  department: string;
  division: string;
  keywords: string[];
}

const DEPARTMENT_MAPPINGS: DepartmentMapping[] = [
  { department: "Cybersecurity", division: "Security Operations", keywords: ["security", "cyber", "threat", "hack", "soc", "siem", "firewall", "vulnerability", "pentest", "endpoint", "malware", "phishing", "encryption", "breach"] },
  { department: "Infrastructure & Cloud Operations", division: "Cloud Engineering", keywords: ["cloud", "aws", "azure", "gcp", "infrastructure", "server", "kubernetes", "docker", "container", "network", "dns", "vpn", "datacenter", "hosting", "devops", "backup", "disaster"] },
  { department: "Platform Engineering", division: "Software Engineering", keywords: ["software", "development", "code", "api", "frontend", "backend", "mobile", "app", "web", "fullstack", "react", "node", "python", "java", "microservice", "cicd", "pipeline", "testing", "qa"] },
  { department: "Data & Analytics", division: "Data Engineering", keywords: ["data", "analytics", "dashboard", "reporting", "bi", "business intelligence", "etl", "warehouse", "lake", "sql", "visualization", "metrics", "kpi"] },
  { department: "AI & Automation", division: "AI Agent Development", keywords: ["ai", "machine learning", "ml", "automation", "rpa", "bot", "chatbot", "nlp", "deep learning", "model", "neural", "llm", "gpt", "copilot"] },
  { department: "Service Management", division: "Service Desk", keywords: ["support", "helpdesk", "help desk", "service desk", "ticket", "itil", "incident", "sla", "change management", "service catalog"] },
  { department: "Compliance", division: "Regulatory Compliance", keywords: ["compliance", "audit", "regulation", "gdpr", "hipaa", "sox", "pci", "governance", "policy", "risk", "iso", "nist", "legal"] },
  { department: "IT Finance & Vendor Management", division: "Procurement", keywords: ["vendor", "procurement", "license", "contract", "cost", "budget", "spend", "finops", "billing", "invoice"] },
  { department: "IT Governance", division: "Architecture", keywords: ["architecture", "strategy", "governance", "roadmap", "enterprise", "pmo", "portfolio", "transformation"] },
  { department: "R&D & Innovation", division: "Innovation Lab", keywords: ["research", "innovation", "prototype", "emerging", "blockchain", "quantum", "iot", "edge", "ar", "vr", "patent", "experiment"] },
];

function detectDepartment(text: string): { department: string; division: string } {
  const lower = text.toLowerCase();
  let bestMatch: DepartmentMapping | null = null;
  let bestScore = 0;

  for (const mapping of DEPARTMENT_MAPPINGS) {
    const score = mapping.keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = mapping;
    }
  }

  if (bestMatch && bestScore >= 1) {
    return { department: bestMatch.department, division: bestMatch.division };
  }

  return { department: "Platform Engineering", division: "Custom Roles" };
}

function detectLevel(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(director|head of|vp|vice president|chief)\b/.test(lower)) return "director";
  if (/\b(manager|lead|team lead|supervisor)\b/.test(lower)) return "manager";
  if (/\b(senior|sr\.|principal|staff)\b/.test(lower)) return "senior";
  if (/\b(junior|jr\.|entry|intern|trainee)\b/.test(lower)) return "junior";
  return "mid";
}

function generateResponsibilities(title: string, keywords: string[]): string[] {
  const base = [
    `${title} strategy and planning`,
    `${title} implementation and execution`,
    `${title} monitoring and optimization`,
    `Stakeholder communication and reporting`,
  ];
  return base.slice(0, 4);
}

function generateAiCapabilities(title: string, keywords: string[]): string[] {
  return [
    `Automated ${keywords[0] || title.toLowerCase()} analysis`,
    `Intelligent ${keywords[1] || "process"} optimization`,
    `${titleCase(keywords[2] || "performance")} monitoring and alerting`,
    `Predictive ${keywords[3] || "trend"} analytics`,
  ];
}

function generateKeyTasks(title: string, responsibilities: string[]): string[] {
  return responsibilities.map(r => `Execute ${r.toLowerCase()} tasks according to team standards and SLAs`);
}

function generateJobDescription(name: string, department: string, division: string, level: string, description: string, responsibilities: string[]): string {
  const levelDesc: Record<string, string> = {
    director: "lead and manage a division responsible for",
    manager: "manage and coordinate team efforts in",
    senior: "provide senior-level expertise in",
    mid: "execute and contribute to",
    lead: "lead team initiatives in",
    junior: "support and learn about",
  };
  const verb = levelDesc[level] || "contribute to";
  return `As a ${name} in the ${department} department, ${division} division, you will ${verb} ${description.toLowerCase()}. You will work collaboratively with team members and stakeholders to deliver high-quality results across ${responsibilities.slice(0, 3).join(", ")}.`;
}

function generateRequiredSkills(keywords: string[]): string[] {
  const generic = ["Analytical thinking", "Communication skills", "Problem solving", "Continuous learning mindset", "Collaborative problem solving"];
  const specific = keywords.slice(0, 3).map(kw => `${titleCase(kw)} expertise`);
  return [...specific, ...generic].slice(0, 8);
}

const COVERED_TERMS: Record<string, string[]> = {
  "security-posture": ["security", "cyber", "threat", "firewall", "soc", "siem", "vulnerability", "encryption", "phishing", "malware"],
  "cloud-migration": ["cloud", "aws", "azure", "gcp", "kubernetes", "docker", "infrastructure", "server", "hosting", "migration", "container"],
  "devops-velocity": ["devops", "ci/cd", "pipeline", "deploy", "release", "git", "jenkins", "sre", "build"],
  "data-analytics": ["data", "analytics", "dashboard", "reporting", "bi", "etl", "warehouse", "visualization", "metrics"],
  "ai-automation": ["machine learning", "rpa", "automation", "nlp", "chatbot", "deep learning", "ai agent", "model training"],
  "itsm-excellence": ["service desk", "helpdesk", "ticket", "itil", "incident", "sla", "change management"],
  "network-reliability": ["network", "noc", "wireless", "firewall", "vpn", "router", "switch", "dns", "bandwidth"],
  "compliance-governance": ["compliance", "audit", "gdpr", "hipaa", "sox", "pci", "governance", "policy", "risk"],
  "cost-optimization": ["cost", "budget", "vendor", "procurement", "license", "finops", "spend"],
  "platform-engineering": ["platform", "api", "microservice", "mobile", "software", "developer", "frontend", "backend"],
  "innovation-rd": ["research", "innovation", "blockchain", "quantum", "edge", "prototype", "emerging"],
  "zero-trust": ["identity", "iam", "sso", "mfa", "authentication", "access control", "privilege"],
  "disaster-recovery": ["disaster", "recovery", "backup", "business continuity", "failover", "resilience"],
  "observability": ["observability", "monitoring", "apm", "logging", "tracing", "alerting", "grafana", "prometheus"],
};

function isCoveredByMatchedGoals(needKeywords: string[], matchedGoalIds: string[]): boolean {
  if (matchedGoalIds.length === 0) return false;
  const coveredKeywords = new Set<string>();
  for (const goalId of matchedGoalIds) {
    const terms = COVERED_TERMS[goalId];
    if (terms) terms.forEach(t => coveredKeywords.add(t));
  }
  const overlapCount = needKeywords.filter(kw => {
    for (const covered of coveredKeywords) {
      if (kw.includes(covered) || covered.includes(kw)) return true;
    }
    return false;
  }).length;
  return overlapCount >= Math.ceil(needKeywords.length * 0.5);
}

export function detectUnmatchedNeeds(
  text: string,
  matchedGoalIds: string[]
): DetectedCustomNeed[] {
  const detected: DetectedCustomNeed[] = [];
  const seenTitles = new Set<string>();

  for (const { pattern, extract } of CUSTOM_SKILL_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpMatchArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const need = extract(match, text);
      if (!need) continue;

      const normalizedTitle = need.title.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
      if (seenTitles.has(normalizedTitle)) continue;
      if (normalizedTitle.length < 8) continue;

      if (isCoveredByMatchedGoals(need.keywords, matchedGoalIds)) continue;

      seenTitles.add(normalizedTitle);
      detected.push(need);
    }
  }

  return detected.slice(0, 5);
}

export function buildCustomRole(need: DetectedCustomNeed, existingSortOrder: number): InsertOrgRole {
  const { department, division } = detectDepartment(need.description);
  const level = detectLevel(need.title);
  const cleanTitle = titleCase(need.title.replace(/specialist$/i, "").trim());
  const name = cleanTitle.endsWith("Specialist") || cleanTitle.endsWith("Engineer") || cleanTitle.endsWith("Analyst") || cleanTitle.endsWith("Manager") || cleanTitle.endsWith("Architect") || cleanTitle.endsWith("Lead")
    ? cleanTitle
    : `${cleanTitle} Specialist`;
  const responsibilities = generateResponsibilities(cleanTitle, need.keywords);
  const aiCapabilities = generateAiCapabilities(cleanTitle, need.keywords);
  const keyTasks = generateKeyTasks(cleanTitle, responsibilities);
  const jobDescription = generateJobDescription(name, department, division, level, need.description, responsibilities);
  const requiredSkills = generateRequiredSkills(need.keywords);
  const { monthlyPrice, humanCostMonthly } = computeAiPrice(level);
  const color = DEPT_COLORS[department] || DEPT_COLORS["Custom"];
  const icon = DEPT_ICONS[department] || DEPT_ICONS["Custom"];

  return {
    name,
    title: name,
    department,
    division,
    parentRoleId: null,
    level,
    description: capitalizeFirst(need.description),
    responsibilities,
    aiCapabilities,
    jobDescription,
    requiredSkills,
    keyTasks,
    icon,
    color,
    monthlyPrice,
    humanCostMonthly,
    isSubscribable: true,
    sortOrder: existingSortOrder + 1,
  };
}
