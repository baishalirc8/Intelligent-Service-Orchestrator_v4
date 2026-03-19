import { db } from "./storage";
import { sql } from "drizzle-orm";

interface RoleRow {
  id: string;
  name: string;
  title: string;
  level: string;
  department: string;
  division: string | null;
  description: string;
  responsibilities: string[];
  aiCapabilities: string[];
  jobDescription: string | null;
}

const levelExpectations: Record<string, { yearsExp: string; leadership: string; scope: string }> = {
  cxo: { yearsExp: "15+ years", leadership: "Executive leadership and board-level reporting", scope: "Organization-wide strategic direction" },
  vp: { yearsExp: "12+ years", leadership: "Multi-team leadership and department-wide strategy", scope: "Department-wide operations and P&L responsibility" },
  director: { yearsExp: "10+ years", leadership: "Team leadership and cross-functional collaboration", scope: "Division-wide programs and initiatives" },
  manager: { yearsExp: "7+ years", leadership: "Direct team management and mentoring", scope: "Team-level operations and delivery" },
  lead: { yearsExp: "6+ years", leadership: "Technical leadership and team guidance", scope: "Project and squad-level delivery" },
  senior: { yearsExp: "5+ years", leadership: "Mentoring junior staff and technical direction", scope: "Complex technical deliverables" },
  mid: { yearsExp: "2-4 years", leadership: "Independent execution with collaborative support", scope: "Feature-level and task-level delivery" },
  junior: { yearsExp: "0-2 years", leadership: "Learning and contributing under guidance", scope: "Task-level execution with mentorship" },
};

const deptSkillBases: Record<string, string[]> = {
  "Infrastructure & Cloud Operations": ["Linux/Windows server administration", "TCP/IP networking", "Cloud platforms (AWS/Azure/GCP)", "Infrastructure monitoring", "Shell scripting"],
  "Cybersecurity": ["Security frameworks (NIST/ISO 27001)", "Threat analysis", "SIEM platforms", "Vulnerability management", "Incident response"],
  "Service Management": ["ITIL framework", "Ticketing systems (ServiceNow/Jira)", "SLA management", "Customer communication", "Process documentation"],
  "AI & Automation": ["Python/ML frameworks", "Model training & evaluation", "API integration", "Workflow orchestration", "Data pipelines"],
  "Data & Analytics": ["SQL/NoSQL databases", "Data visualization tools", "ETL pipelines", "Statistical analysis", "Data modeling"],
  "Platform Engineering": ["Git/GitHub", "CI/CD pipelines", "Container orchestration", "Software development", "Agile methodology"],
  "IT Finance & Vendor Management": ["Financial analysis", "Contract management", "Vendor evaluation", "Procurement processes", "Budget forecasting"],
  "IT Governance": ["Enterprise architecture frameworks", "Portfolio management", "Strategic planning", "Stakeholder management", "COBIT/TOGAF"],
  "Compliance": ["Regulatory frameworks", "Audit methodology", "Risk assessment", "Policy development", "Compliance monitoring"],
  "R&D & Innovation": ["Research methodology", "Prototyping", "Technology evaluation", "Technical writing", "Innovation management"],
  "Executive": ["Strategic leadership", "Board communication", "P&L management", "Digital transformation", "Organizational development"],
};

function generateJobDescription(role: RoleRow): string {
  const exp = levelExpectations[role.level] || levelExpectations.mid;
  const respList = role.responsibilities.slice(0, 4).join(", ");

  if (role.level === "cxo") {
    return `As ${role.title}, you will serve as the senior technology executive responsible for ${role.description.toLowerCase()} This C-level position requires a visionary leader who can align technology investments with business strategy, manage cross-departmental initiatives, and represent the technology organization to the board and executive stakeholders. You will oversee multiple VPs and their teams, set the strategic direction for the entire IT organization, and drive digital transformation initiatives. Key focus areas include ${respList}.`;
  }
  if (role.level === "vp") {
    return `The ${role.title} is a senior leadership position responsible for ${role.description.toLowerCase()} Reporting to the C-suite, this role requires a strategic thinker who can translate organizational objectives into departmental roadmaps, manage multiple directors and their teams, and drive measurable outcomes. You will own the budget, talent strategy, and operational excellence for your department while fostering innovation and cross-functional collaboration. Core responsibilities include ${respList}.`;
  }
  if (role.level === "director") {
    return `As ${role.title}, you will lead and manage a division responsible for ${role.description.toLowerCase()} This role combines strategic planning with hands-on leadership, requiring you to build and mentor high-performing teams, define technical standards, and deliver programs that advance the department's mission. You will collaborate closely with peer directors and senior leadership to ensure alignment and drive continuous improvement. Your focus areas include ${respList}.`;
  }
  if (role.level === "manager") {
    return `The ${role.title} oversees day-to-day team operations for ${role.description.toLowerCase()} You will manage a team of specialists, coordinate workloads, remove blockers, and ensure deliverables meet quality standards and timelines. This role bridges strategic goals with tactical execution, requiring strong people management skills alongside technical expertise. Key areas of ownership include ${respList}.`;
  }
  return `As a ${role.title} in the ${role.department} department${role.division ? `, ${role.division} division` : ""}, you will be responsible for ${role.description.toLowerCase()} This ${exp.yearsExp} experience role requires ${exp.leadership.toLowerCase()} and focuses on ${exp.scope.toLowerCase()}. You will work collaboratively with team members and stakeholders to deliver high-quality results across ${respList}.`;
}

function generateRequiredSkills(role: RoleRow): string[] {
  const baseSkills = deptSkillBases[role.department] || ["Technical proficiency", "Problem-solving", "Communication", "Documentation", "Teamwork"];
  const skills: string[] = [];

  const nameWords = `${role.name} ${role.title} ${role.description}`.toLowerCase();

  if (nameWords.includes("architect")) skills.push("System design & architecture patterns", "Technical documentation (ADRs, HLDs)", "Stakeholder communication");
  if (nameWords.includes("engineer") && !nameWords.includes("manager")) skills.push("Hands-on technical implementation", "Troubleshooting & debugging", "Code review practices");
  if (nameWords.includes("analyst")) skills.push("Data analysis & reporting", "Requirements gathering", "Analytical thinking");
  if (nameWords.includes("manager") || role.level === "manager") skills.push("Team leadership & mentoring", "Project planning & tracking", "Stakeholder management");
  if (nameWords.includes("security") || role.department === "Cybersecurity") skills.push("Security best practices", "Threat modeling");
  if (nameWords.includes("cloud") || nameWords.includes("aws") || nameWords.includes("azure") || nameWords.includes("gcp")) skills.push("Cloud architecture & services", "Cost optimization");
  if (nameWords.includes("devops") || nameWords.includes("ci/cd") || nameWords.includes("pipeline")) skills.push("CI/CD pipeline design", "Infrastructure as Code");
  if (nameWords.includes("kubernetes") || nameWords.includes("k8s") || nameWords.includes("container")) skills.push("Container orchestration (Kubernetes)", "Docker");
  if (nameWords.includes("network")) skills.push("Network protocols & topology", "Firewall & routing");
  if (nameWords.includes("database") || nameWords.includes("dba") || nameWords.includes("data")) skills.push("Database management & optimization", "SQL proficiency");
  if (nameWords.includes("ai") || nameWords.includes("ml") || nameWords.includes("machine learning")) skills.push("Machine learning frameworks (PyTorch/TensorFlow)", "Model evaluation & tuning");
  if (nameWords.includes("frontend") || nameWords.includes("ui") || nameWords.includes("ux")) skills.push("Modern JavaScript/TypeScript", "UI/UX design principles");
  if (nameWords.includes("backend") || nameWords.includes("api")) skills.push("Server-side development (Node.js/Python/Go)", "REST/GraphQL API design");
  if (nameWords.includes("ios") || nameWords.includes("swift")) skills.push("Swift/SwiftUI", "Apple developer ecosystem");
  if (nameWords.includes("android") || nameWords.includes("kotlin")) skills.push("Kotlin/Jetpack Compose", "Android SDK & tooling");
  if (nameWords.includes("mobile") && !nameWords.includes("ios") && !nameWords.includes("android")) skills.push("React Native or Flutter", "Mobile app lifecycle management");
  if (nameWords.includes("github") || nameWords.includes("git")) skills.push("GitHub Enterprise administration", "Git workflows & branching strategies");
  if (nameWords.includes("compliance") || nameWords.includes("regulatory") || nameWords.includes("gdpr") || nameWords.includes("sox") || nameWords.includes("hipaa") || nameWords.includes("pci")) skills.push("Regulatory compliance frameworks", "Audit readiness");
  if (nameWords.includes("automation") || nameWords.includes("rpa")) skills.push("Workflow automation tools", "Scripting (Python/PowerShell)");
  if (nameWords.includes("monitoring") || nameWords.includes("observability")) skills.push("Monitoring platforms (Datadog/Prometheus/Grafana)", "Alerting & escalation design");
  if (nameWords.includes("incident") || nameWords.includes("soc")) skills.push("Incident response procedures", "Root cause analysis");
  if (nameWords.includes("terraform") || nameWords.includes("iac")) skills.push("Terraform/Pulumi/CloudFormation", "State management");
  if (nameWords.includes("serverless") || nameWords.includes("lambda")) skills.push("Serverless architectures (Lambda/Functions)", "Event-driven design");
  if (nameWords.includes("microservice")) skills.push("Microservices design patterns", "Distributed systems");
  if (nameWords.includes("research") || nameWords.includes("innovation")) skills.push("Research methodology", "Prototyping & experimentation");
  if (nameWords.includes("procurement") || nameWords.includes("vendor")) skills.push("Vendor management & negotiation", "RFP/RFQ processes");
  if (nameWords.includes("iot") || nameWords.includes("edge")) skills.push("IoT protocols (MQTT/CoAP)", "Edge computing platforms");
  if (nameWords.includes("sre") || nameWords.includes("reliability")) skills.push("SRE practices & error budgets", "Chaos engineering");
  if (nameWords.includes("qa") || nameWords.includes("quality") || nameWords.includes("test")) skills.push("Test automation frameworks", "Quality metrics & reporting");
  if (nameWords.includes("blockchain") || nameWords.includes("web3")) skills.push("Smart contracts & DLT", "Consensus mechanisms");
  if (nameWords.includes("quantum")) skills.push("Quantum computing fundamentals", "Qiskit/Cirq frameworks");
  if (nameWords.includes("patent") || nameWords.includes("ip")) skills.push("Intellectual property law", "Patent analysis");
  if (nameWords.includes("technical writer") || nameWords.includes("documentation")) skills.push("Technical writing", "Documentation platforms (Confluence/GitBook)");
  if (nameWords.includes("devsecops") || nameWords.includes("supply chain")) skills.push("SAST/DAST/SCA tools", "Software supply chain security");
  if (nameWords.includes("cache") || nameWords.includes("redis")) skills.push("Redis/Memcached", "Caching strategies");
  if (nameWords.includes("search") || nameWords.includes("elasticsearch")) skills.push("Elasticsearch/OpenSearch", "Full-text search optimization");

  if (role.level === "cxo" || role.level === "vp") skills.push("Executive communication & board reporting", "Strategic planning & budgeting", "Organizational leadership");
  if (role.level === "director") skills.push("Program management", "Cross-functional leadership", "Budget ownership");
  if (role.level === "senior") skills.push("Technical mentoring", "Design review leadership", "Production incident ownership");
  if (role.level === "mid" || role.level === "junior") skills.push("Continuous learning mindset", "Collaborative problem solving");

  for (const base of baseSkills.slice(0, 2)) {
    if (!skills.includes(base)) skills.push(base);
  }

  const unique = [...new Set(skills)];
  return unique.slice(0, 10);
}

function generateKeyTasks(role: RoleRow): string[] {
  const tasks: string[] = [];
  const nameWords = `${role.name} ${role.title} ${role.description}`.toLowerCase();

  if (role.level === "cxo") {
    tasks.push(
      "Set and communicate the technology vision and multi-year strategic roadmap",
      "Present technology strategy and risk posture to the board of directors quarterly",
      "Approve major technology investments and vendor partnerships",
      "Chair the IT governance and steering committees",
      "Drive digital transformation initiatives across business units",
      "Review and approve the annual IT budget and resource allocation",
      "Oversee enterprise risk management related to technology",
      "Build and retain top technology leadership talent",
    );
    return tasks;
  }

  if (role.level === "vp") {
    tasks.push(
      `Define and execute the ${role.department} department strategy aligned with CIO/CTO vision`,
      "Manage department budget, headcount, and vendor relationships",
      "Conduct monthly business reviews with directors and present KPIs to leadership",
      "Recruit, mentor, and develop director-level and senior talent",
      "Drive continuous improvement programs across all divisions",
      `Establish and enforce ${role.department.toLowerCase()} standards and best practices`,
      "Collaborate with peer VPs on cross-departmental initiatives",
      "Report department performance, risks, and opportunities to executive leadership",
    );
    return tasks;
  }

  if (role.level === "director") {
    tasks.push(
      `Lead and manage the ${role.division || role.department} team, including hiring, performance reviews, and career development`,
      `Define the technical roadmap for ${role.division || role.department} programs and initiatives`,
      "Conduct weekly team standups and bi-weekly planning sessions",
      "Review and approve technical designs and architecture decisions",
      "Manage division budget and resource allocation",
      "Coordinate with peer directors and external stakeholders",
    );
  }

  if (role.level === "manager") {
    tasks.push(
      "Manage day-to-day team operations, assign tasks, and track deliverables",
      "Conduct one-on-ones and performance reviews for direct reports",
      "Triage and prioritize incoming work requests",
      "Ensure team adherence to processes, SLAs, and quality standards",
      "Escalate blockers and risks to director-level leadership",
    );
  }

  for (const resp of role.responsibilities) {
    const r = resp.toLowerCase();
    if (r.includes("strategy")) tasks.push(`Develop and maintain the ${r} for the team and stakeholders`);
    else if (r.includes("architecture") || r.includes("design")) tasks.push(`Review and approve ${r} proposals and implementation plans`);
    else if (r.includes("monitoring") || r.includes("alerting")) tasks.push(`Configure and maintain ${r} systems, review dashboards, and respond to alerts`);
    else if (r.includes("automation") || r.includes("scripting")) tasks.push(`Build and maintain ${r} workflows to reduce manual toil`);
    else if (r.includes("compliance") || r.includes("audit")) tasks.push(`Conduct ${r} assessments, maintain evidence, and prepare for reviews`);
    else if (r.includes("testing") || r.includes("qa")) tasks.push(`Execute ${r} cycles, document results, and track defects to resolution`);
    else if (r.includes("development") || r.includes("engineering")) tasks.push(`Perform ${r} including code reviews, pull requests, and documentation`);
    else if (r.includes("incident") || r.includes("response")) tasks.push(`Lead or participate in ${r} activities, including triage, resolution, and post-mortems`);
    else if (r.includes("review") || r.includes("assessment")) tasks.push(`Conduct regular ${r} and produce actionable findings`);
    else if (r.includes("documentation") || r.includes("reporting")) tasks.push(`Create and maintain ${r} for stakeholders and audit trails`);
    else if (r.includes("training") || r.includes("mentoring")) tasks.push(`Provide ${r} to team members and stakeholders`);
    else if (r.includes("management")) tasks.push(`Handle ${r} workflows including planning, tracking, and reporting`);
    else tasks.push(`Execute ${r} tasks according to team standards and SLAs`);
  }

  if (nameWords.includes("engineer") || nameWords.includes("developer")) {
    tasks.push("Participate in on-call rotations and respond to production issues");
    tasks.push("Write and maintain technical documentation for systems and processes");
  }
  if (nameWords.includes("architect")) {
    tasks.push("Produce architecture decision records (ADRs) and reference architectures");
    tasks.push("Evaluate new technologies and tools for fitness in the enterprise context");
  }
  if (nameWords.includes("analyst")) {
    tasks.push("Produce regular reports and dashboards for management review");
    tasks.push("Analyze data and trends to provide actionable recommendations");
  }

  const unique = [...new Set(tasks)];
  return unique.slice(0, 10);
}

export async function enrichRolesWithJobData() {
  const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM org_roles WHERE job_description IS NOT NULL AND job_description != ''`);
  const rows = result.rows as any[];
  const count = parseInt(rows[0]?.cnt || "0", 10);
  if (count > 0) return;

  const rolesResult = await db.execute(sql`SELECT id, name, title, level, department, division, description, responsibilities, ai_capabilities FROM org_roles`);
  const roles = rolesResult.rows as any[];

  if (roles.length === 0) return;

  console.log(`[enrich] Generating job descriptions, skills, and tasks for ${roles.length} roles...`);

  for (const row of roles) {
    const role: RoleRow = {
      id: row.id,
      name: row.name,
      title: row.title,
      level: row.level,
      department: row.department,
      division: row.division,
      description: row.description,
      responsibilities: row.responsibilities || [],
      aiCapabilities: row.ai_capabilities || [],
      jobDescription: null,
    };

    const jobDescription = generateJobDescription(role);
    const requiredSkills = generateRequiredSkills(role);
    const keyTasks = generateKeyTasks(role);

    const skillsLiteral = `{${requiredSkills.map(s => `"${s.replace(/"/g, '\\"')}"`).join(",")}}`;
    const tasksLiteral = `{${keyTasks.map(t => `"${t.replace(/"/g, '\\"')}"`).join(",")}}`;

    await db.execute(sql`UPDATE org_roles SET
      job_description = ${jobDescription},
      required_skills = ${skillsLiteral}::text[],
      key_tasks = ${tasksLiteral}::text[]
      WHERE id = ${role.id}`);
  }

  console.log(`[enrich] Enriched ${roles.length} roles with job data`);
}
