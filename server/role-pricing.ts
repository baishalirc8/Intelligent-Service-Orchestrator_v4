import { db } from "./storage";
import { sql } from "drizzle-orm";

interface MarketRate {
  annualSalaryUsd: number;
  monthlyRate: number;
  aiMonthlyRate: number;
}

const US_MARKET_RATES: Record<string, Record<string, number>> = {
  cxo: {
    default: 300000,
    "Chief Information Officer": 350000,
    "Chief Technology Officer": 320000,
  },
  vp: {
    default: 220000,
    "VP of Cybersecurity": 260000,
    "VP of AI & Automation": 250000,
    "VP of Infrastructure & Cloud Operations": 230000,
    "VP of Platform Engineering": 230000,
    "VP of R&D & Innovation": 240000,
    "VP of Data & Analytics": 225000,
    "VP of Service Management": 200000,
    "VP of Compliance": 210000,
    "VP of IT Finance & Vendor Management": 195000,
  },
  director: {
    default: 185000,
    "Director of SOC": 195000,
    "Director of AI Agent Development": 210000,
    "Director of Security Engineering": 200000,
    "Director of Software Engineering": 200000,
    "Director of Cloud-Native Architecture": 205000,
    "Director of Applied Research": 210000,
    "Director of Emerging Technology": 200000,
    "Director of Data Engineering": 195000,
    "Director of DevOps & SRE": 195000,
    "Director of DevSecOps": 195000,
    "Director of Mobile Engineering": 195000,
    "Director of SCM & CI/CD": 185000,
    "Director of Developer Experience": 185000,
    "Director of Data Platform Engineering": 190000,
    "Director of MLOps": 195000,
    "Director of Innovation Lab": 190000,
    "Director of Automation & Orchestration": 185000,
    "Director of QA": 175000,
    "Director of IT Procurement": 165000,
    "Director of Vendor Management": 165000,
    "Director of Regulatory Compliance": 180000,
    "Director of Audit & Assurance": 180000,
    "Director of Policy & Standards": 175000,
    "Director of Risk Management": 185000,
    "Director of Network Operations": 185000,
    "Director of Cloud & Datacenter": 195000,
    "Director of Server Administration": 175000,
    "Director of Database Administration": 180000,
    "Director of IoT & Edge Computing": 190000,
    "Director of NOC": 175000,
    "Director of GRC": 185000,
    "Director of IAM": 190000,
    "Director of Observability": 185000,
    "Director of Business Intelligence": 180000,
    "Director of Service Desk": 160000,
    "Director of Change & Release Management": 170000,
    "Director of Problem Management": 170000,
    "Director of SLA Management": 165000,
    "Director of Asset & Config Management": 165000,
  },
  manager: {
    default: 145000,
    "Engineering Manager (Backend)": 165000,
    "Engineering Manager (Frontend)": 160000,
    "SOC Manager": 155000,
    "SRE Manager": 160000,
    "QA Manager": 145000,
    "IT Procurement Manager": 130000,
    "Service Desk Manager": 120000,
    "Change Manager": 135000,
    "Problem Manager": 135000,
    "SLA Manager": 130000,
    "IT Asset Manager": 125000,
    "Configuration Manager": 130000,
    "GRC Manager": 145000,
  },
  lead: {
    default: 140000,
  },
  senior: {
    default: 145000,

    "Senior Backend Engineer": 165000,
    "Senior Frontend Engineer": 160000,
    "Senior DevOps Engineer": 160000,
    "Senior SRE": 160000,
    "Senior QA Engineer": 140000,

    "AI/ML Architect": 190000,
    "Senior ML Engineer": 175000,

    "Cloud Architect": 185000,
    "Senior Cloud Engineer (AWS)": 170000,
    "Senior Cloud Engineer (Azure)": 165000,
    "Senior Cloud Engineer (GCP)": 165000,

    "Network Architect": 165000,
    "Senior Network Engineer": 145000,

    "Senior Microservices Architect": 180000,
    "Event-Driven Architecture Engineer": 170000,

    "Senior Security Architect": 185000,
    "Penetration Tester": 155000,
    "Digital Forensics Analyst": 140000,
    "IAM Architect": 175000,
    "Senior IAM Engineer": 155000,

    "Principal Research Scientist": 195000,
    "Senior Research Engineer": 170000,
    "Senior Emerging Tech Engineer": 165000,
    "Senior Innovation Engineer": 160000,

    "Observability Architect": 170000,
    "Senior Monitoring Engineer": 145000,
    "BI Architect": 160000,
    "Senior Data Engineer": 165000,

    "Senior DX Engineer": 160000,
    "Senior DevSecOps Engineer": 165000,
    "Senior Database Platform Engineer": 160000,
    "Senior CI/CD Engineer": 155000,

    "GitHub Platform Administrator": 155000,

    "Senior iOS Engineer": 170000,
    "Senior Android Engineer": 170000,

    "Senior Automation Engineer": 150000,
    "Automation Architect": 165000,

    "Service Desk Analyst Tier 3": 95000,
    "Senior Regulatory Compliance Analyst": 140000,
    "Senior IT Auditor": 145000,
    "Senior Policy Analyst": 135000,
    "Senior Risk Analyst": 145000,

    "IoT Solutions Architect": 170000,
    "Senior Server Administrator": 130000,
    "Senior DBA": 150000,
  },
  mid: {
    default: 110000,

    "Backend Engineer": 130000,
    "Frontend Engineer": 125000,
    "Full Stack Engineer": 130000,
    "API Engineer": 125000,
    "Site Reliability Engineer": 145000,
    "DevOps Engineer": 135000,
    "Container/K8s Engineer": 140000,
    "IaC Engineer": 140000,

    "ML Engineer": 145000,
    "NLP Engineer": 145000,
    "AI Agent Developer (Infra)": 140000,
    "AI Agent Developer (Security)": 140000,
    "AI Agent Developer (ITSM)": 135000,
    "Data Scientist": 140000,
    "MLOps Engineer": 140000,
    "AI Safety Engineer": 145000,
    "Model Performance Analyst": 130000,

    "Automation Engineer": 120000,
    "RPA Developer": 110000,
    "Integration Engineer": 120000,

    "Network Engineer": 105000,
    "Wireless Network Engineer": 105000,
    "Network Security Engineer": 120000,
    "Telecom Engineer": 100000,
    "VoIP Engineer": 100000,

    "Virtualization Engineer": 115000,
    "Storage Engineer": 110000,
    "Backup & DR Engineer": 105000,

    "Server Administrator": 100000,
    "Linux Administrator": 105000,
    "Windows Administrator": 100000,
    "Configuration Management Engineer": 110000,
    "Patch Management Specialist": 95000,

    "DBA (SQL)": 120000,
    "DBA (NoSQL)": 120000,
    "Database Performance Analyst": 115000,
    "Database Security Specialist": 125000,

    "IoT Platform Engineer": 125000,
    "Embedded Systems Engineer": 130000,
    "Edge Computing Engineer": 130000,
    "BMS Engineer": 110000,
    "ICS Engineer": 120000,

    "NOC Analyst Tier 1": 65000,
    "NOC Analyst Tier 2": 80000,
    "Monitoring Tools Engineer": 105000,
    "Capacity Planner": 110000,

    "SOC Analyst Tier 1": 70000,
    "SOC Analyst Tier 2": 85000,
    "SOC Analyst Tier 3": 100000,
    "Threat Hunter": 120000,
    "SIEM Engineer": 125000,
    "Threat Intelligence Analyst": 110000,

    "GRC Analyst": 100000,
    "Compliance Analyst": 95000,
    "Security Awareness Specialist": 90000,
    "Risk Analyst (Cyber)": 105000,

    "IAM Engineer": 130000,
    "PAM Engineer": 130000,
    "Identity Governance Analyst": 110000,
    "SSO/Federation Specialist": 120000,

    "Application Security Engineer": 140000,
    "Cloud Security Engineer": 145000,
    "Endpoint Security Engineer": 115000,
    "Email Security Engineer": 105000,
    "DLP Engineer": 110000,
    "Vulnerability Management Analyst": 110000,

    "Service Desk Analyst Tier 1": 55000,
    "Service Desk Analyst Tier 2": 70000,
    "Knowledge Management Specialist": 80000,

    "Release Engineer": 110000,
    "Change Coordinator": 85000,

    "Problem Analyst": 90000,

    "SLA Reporting Analyst": 85000,
    "Availability Manager": 100000,
    "Capacity Management Analyst": 95000,

    "Software Asset Manager (SAM)": 95000,
    "CMDB Analyst": 90000,

    "Log Management Engineer": 115000,
    "APM Engineer": 120000,
    "Synthetic Monitoring Engineer": 110000,

    "Senior BI Analyst": 120000,
    "BI Developer": 110000,
    "Dashboard Analyst": 95000,
    "IT Finance Analyst": 95000,

    "Data Engineer": 135000,
    "Data Quality Analyst": 100000,
    "ETL Developer": 110000,

    "Procurement Analyst": 80000,
    "License Compliance Analyst": 85000,
    "Vendor Relationship Manager": 95000,
    "Contract Administrator": 85000,
    "Cloud FinOps Analyst": 115000,

    "GDPR Compliance Specialist": 110000,
    "SOX Compliance Analyst": 105000,
    "HIPAA Compliance Specialist": 110000,
    "PCI-DSS Compliance Analyst": 105000,
    "IT Auditor": 100000,
    "Continuous Compliance Monitor": 105000,
    "Policy Analyst": 90000,
    "Standards & Frameworks Analyst": 95000,
    "Risk Analyst": 100000,
    "Business Continuity Analyst": 105000,

    "iOS Engineer": 145000,
    "Android Engineer": 145000,
    "Cross-Platform Mobile Engineer": 135000,
    "Mobile DevOps Engineer": 130000,

    "CI/CD Engineer": 130000,
    "GitOps Engineer": 135000,
    "Artifact & Registry Manager": 115000,
    "Release Manager": 115000,

    "Service Mesh Engineer": 140000,
    "API Gateway Engineer": 130000,
    "Serverless Engineer": 135000,

    "DX Engineer": 130000,
    "Developer Portal Engineer": 125000,
    "Technical Writer": 95000,

    "DevSecOps Engineer": 140000,
    "Supply Chain Security Engineer": 145000,
    "Secrets Management Engineer": 130000,

    "Database Platform Engineer": 130000,
    "Cache & In-Memory Engineer": 130000,
    "Search Infrastructure Engineer": 130000,

    "Research Engineer": 135000,
    "Research Analyst": 100000,
    "Emerging Tech Engineer": 130000,
    "Quantum Computing Researcher": 155000,
    "Edge AI Specialist": 145000,
    "Blockchain/Web3 Engineer": 140000,
    "Innovation Engineer": 120000,
    "UX Researcher": 110000,
    "Technology Evangelist": 105000,
    "IP & Patent Analyst": 110000,

    "QA Engineer": 100000,
    "Security QA Engineer": 115000,
    "Performance Engineer": 125000,
  },
  junior: {
    default: 75000,
  },
};

function getAnnualRate(roleName: string, level: string): number {
  const levelRates = US_MARKET_RATES[level];
  if (!levelRates) return 100000;
  return levelRates[roleName] || levelRates.default || 100000;
}

function computeMonthlyHumanRate(annualSalary: number): number {
  const burdenedCost = annualSalary * 1.35;
  return Math.round(burdenedCost / 12);
}

const AI_PRICE_MIN = 1000;
const AI_PRICE_MAX = 5000;

function computeAiMonthlyRate(monthlyHumanRate: number): number {
  const raw = Math.round(monthlyHumanRate * 0.30);
  return Math.min(AI_PRICE_MAX, Math.max(AI_PRICE_MIN, raw));
}

export async function updateRolePricing() {
  const result = await db.execute(sql`SELECT id, name, level, monthly_price, human_cost_monthly FROM org_roles WHERE is_subscribable = true`);
  const roles = result.rows as any[];

  if (roles.length === 0) return;

  const sampleRole = roles.find((r: any) => r.name === "Senior Backend Engineer");
  if (sampleRole && sampleRole.monthly_price === 5000 && sampleRole.human_cost_monthly === 18563) {
    return;
  }

  console.log(`[pricing] Updating market-rate pricing for ${roles.length} subscribable roles...`);

  for (const role of roles) {
    const annual = getAnnualRate(role.name, role.level);
    const monthlyHuman = computeMonthlyHumanRate(annual);
    const aiMonthly = computeAiMonthlyRate(monthlyHuman);

    await db.execute(sql`UPDATE org_roles SET monthly_price = ${aiMonthly}, human_cost_monthly = ${monthlyHuman} WHERE id = ${role.id}`);
  }

  console.log(`[pricing] Updated pricing for ${roles.length} roles (AI Agent = 30% of burdened monthly cost)`);
}
