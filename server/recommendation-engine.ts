import type { OrgRole } from "@shared/schema";

export interface ITGoal {
  id: string;
  label: string;
  description: string;
  category: string;
  icon: string;
  departments: string[];
  keywords: string[];
  levelPriority: string[];
}

export const IT_GOALS: ITGoal[] = [
  {
    id: "security-posture",
    label: "Strengthen Security Posture",
    description: "Protect against cyber threats, ensure compliance, and build a robust security operations center",
    category: "Security",
    icon: "Shield",
    departments: ["Cybersecurity"],
    keywords: ["security", "soc", "threat", "vulnerability", "penetration", "forensic", "siem", "iam", "compliance", "grc", "dlp", "endpoint", "email security", "cloud security"],
    levelPriority: ["director", "senior", "manager", "mid"],
  },
  {
    id: "cloud-migration",
    label: "Cloud Migration & Modernization",
    description: "Move infrastructure to the cloud, adopt cloud-native architecture, and optimize cloud costs",
    category: "Infrastructure",
    icon: "Cloud",
    departments: ["Infrastructure & Cloud Operations", "Platform Engineering"],
    keywords: ["cloud", "aws", "azure", "gcp", "virtualization", "kubernetes", "container", "serverless", "microservice", "datacenter", "migration", "iaas", "paas", "finops"],
    levelPriority: ["director", "senior", "mid"],
  },
  {
    id: "devops-velocity",
    label: "Accelerate DevOps & CI/CD",
    description: "Speed up software delivery with CI/CD pipelines, GitOps, SRE practices, and developer experience improvements",
    category: "Engineering",
    icon: "Rocket",
    departments: ["Platform Engineering"],
    keywords: ["devops", "ci/cd", "sre", "pipeline", "gitops", "release", "deploy", "automation", "github", "artifact", "developer experience", "scm"],
    levelPriority: ["director", "senior", "manager", "mid"],
  },
  {
    id: "data-analytics",
    label: "Data-Driven Decision Making",
    description: "Build data pipelines, business intelligence, and analytics capabilities to inform strategy",
    category: "Data",
    icon: "BarChart3",
    departments: ["Data & Analytics"],
    keywords: ["data", "analytics", "bi", "dashboard", "etl", "data engineer", "data quality", "business intelligence", "reporting", "data scientist", "mlops"],
    levelPriority: ["director", "senior", "mid"],
  },
  {
    id: "ai-automation",
    label: "AI & Intelligent Automation",
    description: "Deploy AI/ML capabilities, RPA bots, and intelligent automation across IT operations",
    category: "Innovation",
    icon: "Brain",
    departments: ["AI & Automation", "R&D & Innovation"],
    keywords: ["machine learning", "nlp", "rpa", "orchestration", "ai safety", "mlops", "deep learning", "neural network", "inference", "model training"],
    levelPriority: ["director", "senior", "mid"],
  },
  {
    id: "itsm-excellence",
    label: "IT Service Management Excellence",
    description: "Improve service desk operations, change management, SLA compliance, and ITIL best practices",
    category: "Operations",
    icon: "Headphones",
    departments: ["Service Management"],
    keywords: ["service desk", "itil", "change", "release", "problem", "sla", "asset", "cmdb", "knowledge", "incident", "service catalog", "availability"],
    levelPriority: ["director", "manager", "mid"],
  },
  {
    id: "network-reliability",
    label: "Network Reliability & Performance",
    description: "Ensure high availability, optimize network infrastructure, and implement robust monitoring",
    category: "Infrastructure",
    icon: "Wifi",
    departments: ["Infrastructure & Cloud Operations"],
    keywords: ["network", "noc", "monitoring", "wireless", "firewall", "vpn", "telecom", "voip", "observability", "capacity", "availability", "uptime"],
    levelPriority: ["director", "senior", "manager", "mid"],
  },
  {
    id: "compliance-governance",
    label: "Regulatory Compliance & Governance",
    description: "Meet GDPR, SOX, HIPAA, PCI-DSS requirements and establish strong IT governance frameworks",
    category: "Compliance",
    icon: "Scale",
    departments: ["Compliance", "Cybersecurity"],
    keywords: ["compliance", "gdpr", "sox", "hipaa", "pci", "audit", "governance", "policy", "risk", "regulatory", "standards", "framework", "grc", "business continuity"],
    levelPriority: ["director", "senior", "manager", "mid"],
  },
  {
    id: "cost-optimization",
    label: "IT Cost Optimization",
    description: "Reduce IT spending through vendor management, license optimization, and FinOps practices",
    category: "Finance",
    icon: "PiggyBank",
    departments: ["IT Finance & Vendor Management"],
    keywords: ["procurement", "vendor", "license", "contract", "finops", "cost", "budget", "asset", "sam", "cloud cost"],
    levelPriority: ["director", "manager", "mid"],
  },
  {
    id: "platform-engineering",
    label: "Modern Platform Engineering",
    description: "Build internal developer platforms, mobile apps, and modern software architecture",
    category: "Engineering",
    icon: "Layers",
    departments: ["Platform Engineering"],
    keywords: ["platform", "mobile", "ios", "android", "api gateway", "service mesh", "developer portal", "devsecops", "database platform", "cache", "search"],
    levelPriority: ["director", "senior", "mid"],
  },
  {
    id: "innovation-rd",
    label: "Innovation & Emerging Tech",
    description: "Explore quantum computing, blockchain, edge AI, and emerging technologies to stay ahead",
    category: "Innovation",
    icon: "Lightbulb",
    departments: ["R&D & Innovation"],
    keywords: ["research", "innovation", "quantum", "blockchain", "edge ai", "emerging", "patent", "evangelist", "ux research", "prototype"],
    levelPriority: ["director", "senior", "mid"],
  },
  {
    id: "zero-trust",
    label: "Zero Trust & Identity Management",
    description: "Implement zero-trust architecture with strong IAM, SSO, PAM, and identity governance",
    category: "Security",
    icon: "Lock",
    departments: ["Cybersecurity"],
    keywords: ["iam", "identity", "zero trust", "pam", "sso", "federation", "access", "privilege", "governance", "authentication"],
    levelPriority: ["director", "senior", "mid"],
  },
  {
    id: "disaster-recovery",
    label: "Disaster Recovery & Business Continuity",
    description: "Ensure business continuity with robust backup, DR, and resilience strategies",
    category: "Infrastructure",
    icon: "ShieldAlert",
    departments: ["Infrastructure & Cloud Operations", "Compliance"],
    keywords: ["backup", "disaster recovery", "business continuity", "resilience", "failover", "redundancy", "risk", "dr", "availability"],
    levelPriority: ["director", "senior", "mid"],
  },
  {
    id: "observability",
    label: "Full-Stack Observability",
    description: "Implement comprehensive monitoring, logging, APM, and alerting across all systems",
    category: "Operations",
    icon: "Eye",
    departments: ["Data & Analytics", "Infrastructure & Cloud Operations"],
    keywords: ["observability", "monitoring", "apm", "log", "synthetic", "alerting", "dashboard", "metrics", "tracing", "grafana", "prometheus"],
    levelPriority: ["director", "senior", "mid"],
  },
];

export interface RecommendedRole {
  roleId: string;
  reason: string;
  goalIds: string[];
  priority: "critical" | "high" | "medium";
  impact: string;
}

export function generateRecommendations(
  goals: string[],
  allRoles: OrgRole[],
  existingSubscriptionRoleIds: Set<string>
): RecommendedRole[] {
  const selectedGoals = IT_GOALS.filter(g => goals.includes(g.id));
  if (selectedGoals.length === 0) return [];

  const roleScores = new Map<string, { score: number; goalIds: string[]; reasons: string[]; keywordHits: number }>();

  for (const goal of selectedGoals) {
    for (const r of allRoles) {
      if (!r.isSubscribable) continue;
      if (existingSubscriptionRoleIds.has(r.id)) continue;

      const nameDesc = `${r.name} ${r.title || ""} ${r.description}`.toLowerCase();
      const fullText = `${nameDesc} ${r.responsibilities?.join(" ") || ""} ${r.aiCapabilities?.join(" ") || ""}`.toLowerCase();

      const nameKeywordMatches = goal.keywords.filter(kw => nameDesc.includes(kw.toLowerCase()));
      const fullKeywordMatches = goal.keywords.filter(kw => fullText.includes(kw.toLowerCase()));

      if (fullKeywordMatches.length === 0) continue;

      const existing = roleScores.get(r.id) || { score: 0, goalIds: [], reasons: [], keywordHits: 0, nameHits: 0 };

      let score = 0;

      score += nameKeywordMatches.length * 5;

      score += (fullKeywordMatches.length - nameKeywordMatches.length);

      const deptMatch = goal.departments.some(d => r.department === d);
      if (deptMatch && nameKeywordMatches.length > 0) score += 3;
      else if (deptMatch) score += 1;

      existing.score += score;
      existing.keywordHits += fullKeywordMatches.length;
      existing.nameHits = (existing.nameHits || 0) + nameKeywordMatches.length;
      if (!existing.goalIds.includes(goal.id)) existing.goalIds.push(goal.id);

      const reason = generateReason(r, goal, fullKeywordMatches);
      if (reason && !existing.reasons.includes(reason)) existing.reasons.push(reason);

      roleScores.set(r.id, existing);
    }
  }

  const scored = Array.from(roleScores.entries())
    .filter(([_, data]) => data.nameHits >= 1 || data.keywordHits >= 3)
    .sort((a, b) => b[1].score - a[1].score);

  if (scored.length === 0) return [];

  const topScore = scored[0][1].score;
  const threshold = topScore * 0.5;
  const relevant = scored.filter(([_, data]) => data.score >= threshold);

  const maxRoles = Math.min(relevant.length, 5);

  return relevant.slice(0, maxRoles).map(([roleId, data]) => {
    const role = allRoles.find(r => r.id === roleId)!;
    const priority: "critical" | "high" | "medium" =
      data.goalIds.length >= 3 || data.score >= topScore * 0.8 ? "critical" :
      data.goalIds.length >= 2 || data.score >= topScore * 0.5 ? "high" : "medium";

    return {
      roleId,
      reason: data.reasons.join(" "),
      goalIds: data.goalIds,
      priority,
      impact: generateImpact(role, data.goalIds, selectedGoals),
    };
  });
}

function generateReason(role: OrgRole, goal: ITGoal, keywordMatches: string[]): string {
  const goalLabel = goal.label;
  const roleName = role.name;

  if (keywordMatches.length > 2) {
    return `${roleName} directly supports "${goalLabel}" with expertise in ${keywordMatches.slice(0, 3).join(", ")}.`;
  }
  if (role.department === goal.departments[0]) {
    return `${roleName} is a core ${role.department} role essential for achieving "${goalLabel}".`;
  }
  return `${roleName} contributes to "${goalLabel}" through ${role.responsibilities?.slice(0, 2).join(" and ") || "specialized capabilities"}.`;
}

function generateImpact(role: OrgRole, goalIds: string[], goals: ITGoal[]): string {
  const impactGoals = goals.filter(g => goalIds.includes(g.id));
  if (impactGoals.length > 1) {
    return `This AI Agent supports ${impactGoals.length} of your goals: ${impactGoals.map(g => g.label).join(", ")}. Subscribing will accelerate progress across multiple strategic objectives.`;
  }
  const cap = role.aiCapabilities?.slice(0, 3).join(", ") || "autonomous task handling";
  return `The AI Agent for this role can autonomously handle ${cap}, reducing manual workload and accelerating your ${impactGoals[0]?.label || "IT"} objectives.`;
}
