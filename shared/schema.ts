import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, boolean, jsonb, real, doublePrecision, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("client"),
  displayName: text("display_name").notNull(),
  email: text("email"),
  companyName: text("company_name"),
  country: text("country"),
  avatarUrl: text("avatar_url"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  tourCompleted: boolean("tour_completed").notNull().default(false),
  commandScopes: text("command_scopes").array().default(sql`'{}'`),
  modulePreferences: jsonb("module_preferences").default(sql`'{}'`),
});

export const aiAgents = pgTable("ai_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("active"),
  capabilities: text("capabilities").array().notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  tasksHandled: integer("tasks_handled").notNull().default(0),
  lastActive: timestamp("last_active").defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  category: text("category").notNull(),
  source: text("source").notNull(),
  assignedAgentId: varchar("assigned_agent_id"),
  assignedUserId: varchar("assigned_user_id"),
  problemId: varchar("problem_id"),
  sourceServiceRequestId: varchar("source_service_request_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const serviceRequests = pgTable("service_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  requesterId: varchar("requester_id"),
  handlerType: text("handler_type").notNull().default("ai"),
  assignedAgentId: varchar("assigned_agent_id"),
  assignedUserId: varchar("assigned_user_id"),
  assignedHumanName: varchar("assigned_human_name"),
  catalogItemId: varchar("catalog_item_id"),
  linkedIncidentId: varchar("linked_incident_id"),
  slaDeadline: timestamp("sla_deadline"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const securityEvents = pgTable("security_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(),
  source: text("source").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  rawData: jsonb("raw_data"),
  processed: boolean("processed").notNull().default(false),
  incidentId: varchar("incident_id"),
  detectedByAgentId: varchar("detected_by_agent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const problems = pgTable("problems", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  category: text("category").notNull(),
  rootCause: text("root_cause"),
  workaround: text("workaround"),
  knownError: boolean("known_error").notNull().default(false),
  affectedServices: text("affected_services").array(),
  relatedIncidentCount: integer("related_incident_count").notNull().default(0),
  assignedAgentId: varchar("assigned_agent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const changeRequests = pgTable("change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("normal"),
  status: text("status").notNull().default("draft"),
  priority: text("priority").notNull().default("medium"),
  riskLevel: text("risk_level").notNull().default("low"),
  impactAssessment: text("impact_assessment"),
  rollbackPlan: text("rollback_plan"),
  scheduledStart: timestamp("scheduled_start"),
  scheduledEnd: timestamp("scheduled_end"),
  approvedBy: text("approved_by"),
  implementedBy: text("implemented_by"),
  affectedCIs: text("affected_cis").array(),
  assignedAgentId: varchar("assigned_agent_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const serviceCatalogItems = pgTable("service_catalog_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  icon: text("icon").notNull(),
  estimatedTime: text("estimated_time"),
  slaTarget: text("sla_target"),
  approvalRequired: boolean("approval_required").notNull().default(false),
  active: boolean("active").notNull().default(true),
  formFields: jsonb("form_fields"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const knowledgeArticles = pgTable("knowledge_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  tags: text("tags").array(),
  status: text("status").notNull().default("published"),
  authorId: varchar("author_id"),
  viewCount: integer("view_count").notNull().default(0),
  helpfulCount: integer("helpful_count").notNull().default(0),
  relatedProblemId: varchar("related_problem_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const slaDefinitions = pgTable("sla_definitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull(),
  agreementType: text("agreement_type").notNull().default("sla"),
  serviceScope: text("service_scope"),
  counterparty: text("counterparty"),
  responseTimeMinutes: integer("response_time_minutes").notNull(),
  resolutionTimeMinutes: integer("resolution_time_minutes").notNull(),
  escalationPolicy: text("escalation_policy"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cmdbItems = pgTable("cmdb_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull().default("hardware"),
  status: text("status").notNull().default("active"),
  environment: text("environment").notNull().default("production"),
  owner: text("owner"),
  location: text("location"),
  ipAddress: text("ip_address"),
  osVersion: text("os_version"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  firmware: text("firmware"),
  purchaseDate: timestamp("purchase_date"),
  warrantyExpiry: timestamp("warranty_expiry"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cmdbRelationships = pgTable("cmdb_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceItemId: varchar("source_item_id").notNull(),
  targetItemId: varchar("target_item_id").notNull(),
  relationshipType: text("relationship_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const infrastructureConnectors = pgTable("infrastructure_connectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  protocol: text("protocol").notNull(),
  host: text("host").notNull(),
  port: integer("port"),
  status: text("status").notNull().default("configured"),
  credentialType: text("credential_type").notNull(),
  credentialRef: text("credential_ref"),
  discoveredAssets: integer("discovered_assets").notNull().default(0),
  lastScan: timestamp("last_scan"),
  scanInterval: integer("scan_interval_minutes").notNull().default(60),
  agentId: varchar("agent_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const automationPlaybooks = pgTable("automation_playbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  triggerType: text("trigger_type").notNull(),
  triggerCondition: text("trigger_condition").notNull(),
  actions: jsonb("actions").notNull(),
  agentId: varchar("agent_id"),
  enabled: boolean("enabled").notNull().default(true),
  executionCount: integer("execution_count").notNull().default(0),
  lastExecuted: timestamp("last_executed"),
  category: text("category").notNull().default("remediation"),
  severity: text("severity").notNull().default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playbookExecutions = pgTable("playbook_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playbookId: varchar("playbook_id").notNull(),
  agentId: varchar("agent_id").notNull(),
  status: text("status").notNull().default("running"),
  triggerReason: text("trigger_reason").notNull(),
  actionsTaken: jsonb("actions_taken"),
  result: text("result"),
  targetAsset: text("target_asset"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const telemetryMetrics = pgTable("telemetry_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull(),
  sourceName: text("source_name").notNull(),
  metricName: text("metric_name").notNull(),
  metricValue: real("metric_value").notNull(),
  unit: text("unit").notNull(),
  status: text("status").notNull().default("normal"),
  collectedAt: timestamp("collected_at").defaultNow(),
});

export const agentActivities = pgTable("agent_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),
  autonomous: boolean("autonomous").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull(),
  content: text("content").notNull(),
  agentId: varchar("agent_id"),
  userId: varchar("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orgRoles = pgTable("org_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  division: text("division"),
  parentRoleId: varchar("parent_role_id"),
  level: text("level").notNull(),
  description: text("description").notNull(),
  responsibilities: text("responsibilities").array().notNull(),
  aiCapabilities: text("ai_capabilities").array().notNull(),
  jobDescription: text("job_description"),
  requiredSkills: text("required_skills").array(),
  keyTasks: text("key_tasks").array(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  monthlyPrice: integer("monthly_price"),
  humanCostMonthly: integer("human_cost_monthly"),
  isSubscribable: boolean("is_subscribable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  aiProviderId: varchar("ai_provider_id"),
});

export const roleSubscriptions = pgTable("role_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  roleId: varchar("role_id").notNull(),
  status: text("status").notNull().default("active"),
  assignedHumanName: varchar("assigned_human_name"),
  assignedHumanEmail: varchar("assigned_human_email"),
  hasAiShadow: boolean("has_ai_shadow").notNull().default(false),
  subscribedAt: timestamp("subscribed_at").defaultNow(),
  availabilityStatus: text("availability_status").notNull().default("off_duty"),
  shiftStart: timestamp("shift_start"),
  shiftEnd: timestamp("shift_end"),
  currentWorkload: integer("current_workload").notNull().default(0),
  maxWorkload: integer("max_workload").notNull().default(5),
  lastStatusChange: timestamp("last_status_change"),
  contactPhone: varchar("contact_phone"),
});

export const recommendations = pgTable("recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  goals: text("goals").array().notNull(),
  status: text("status").notNull().default("pending"),
  roleIds: text("role_ids").array().notNull(),
  approvedRoleIds: text("approved_role_ids").array().notNull().default(sql`'{}'::text[]`),
  rejectedRoleIds: text("rejected_role_ids").array().notNull().default(sql`'{}'::text[]`),
  totalMonthly: integer("total_monthly").notNull().default(0),
  approvedMonthly: integer("approved_monthly").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const crews = pgTable("crews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  department: text("department"),
  processType: text("process_type").notNull().default("sequential"),
  status: text("status").notNull().default("idle"),
  agentRoleIds: text("agent_role_ids").array().notNull().default(sql`'{}'::text[]`),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentTasks = pgTable("agent_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  expectedOutput: text("expected_output").notNull(),
  status: text("status").notNull().default("pending"),
  assignedRoleId: varchar("assigned_role_id"),
  crewId: varchar("crew_id"),
  priority: text("priority").notNull().default("medium"),
  context: text("context"),
  output: text("output"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const agentWorkflows = pgTable("agent_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  processType: text("process_type").notNull().default("sequential"),
  status: text("status").notNull().default("draft"),
  taskIds: text("task_ids").array().notNull().default(sql`'{}'::text[]`),
  crewId: varchar("crew_id"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const committees = pgTable("committees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("cab"),
  description: text("description").notNull(),
  memberRoleIds: text("member_role_ids").array().notNull().default(sql`'{}'::text[]`),
  chairRoleId: varchar("chair_role_id"),
  quorumRequired: integer("quorum_required").notNull().default(2),
  status: text("status").notNull().default("active"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const workflowStages = pgTable("workflow_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull(),
  name: text("name").notNull(),
  stageOrder: integer("stage_order").notNull().default(0),
  stageType: text("stage_type").notNull().default("task"),
  assignedRoleId: varchar("assigned_role_id"),
  committeeId: varchar("committee_id"),
  status: text("status").notNull().default("pending"),
  requiredApprovals: integer("required_approvals").notNull().default(1),
  currentApprovals: integer("current_approvals").notNull().default(0),
  currentRejections: integer("current_rejections").notNull().default(0),
  notes: text("notes"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const networkDevices = pgTable("network_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  vendor: text("vendor").notNull(),
  model: text("model").notNull(),
  ipAddress: text("ip_address").notNull(),
  firmware: text("firmware"),
  status: text("status").notNull().default("online"),
  location: text("location"),
  configHash: text("config_hash"),
  lastSeen: timestamp("last_seen").defaultNow(),
  assignedAgentRoleId: varchar("assigned_agent_role_id"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deviceMetrics = pgTable("device_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").notNull(),
  metricName: text("metric_name").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull(),
  thresholdWarning: real("threshold_warning"),
  thresholdCritical: real("threshold_critical"),
  status: text("status").notNull().default("normal"),
  userId: varchar("user_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const agentAlerts = pgTable("agent_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id"),
  agentRoleId: varchar("agent_role_id"),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("medium"),
  message: text("message").notNull(),
  details: text("details"),
  acknowledged: boolean("acknowledged").notNull().default(false),
  falsePositive: boolean("false_positive").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentKpis = pgTable("agent_kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentRoleId: varchar("agent_role_id").notNull(),
  kpiName: text("kpi_name").notNull(),
  currentValue: real("current_value").notNull(),
  targetValue: real("target_value").notNull(),
  unit: text("unit").notNull(),
  trend: text("trend").notNull().default("stable"),
  period: text("period").notNull().default("monthly"),
  userId: varchar("user_id").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRecommendationSchema = createInsertSchema(recommendations).pick({
  userId: true,
  goals: true,
  status: true,
  roleIds: true,
  approvedRoleIds: true,
  rejectedRoleIds: true,
  totalMonthly: true,
  approvedMonthly: true,
});

export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;
export type Recommendation = typeof recommendations.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true, role: true, displayName: true, email: true, companyName: true, country: true, avatarUrl: true });
export const insertAiAgentSchema = createInsertSchema(aiAgents).pick({ name: true, type: true, description: true, status: true, capabilities: true, icon: true, color: true });
export const insertIncidentSchema = createInsertSchema(incidents).pick({ title: true, description: true, severity: true, status: true, category: true, source: true, assignedAgentId: true, assignedUserId: true, problemId: true });
export const insertServiceRequestSchema = createInsertSchema(serviceRequests).pick({ title: true, description: true, type: true, priority: true, status: true, requesterId: true, assignedAgentId: true, assignedUserId: true, catalogItemId: true });
export const insertSecurityEventSchema = createInsertSchema(securityEvents).pick({ eventType: true, source: true, severity: true, message: true, rawData: true, processed: true, incidentId: true, detectedByAgentId: true });
export const insertProblemSchema = createInsertSchema(problems).pick({ title: true, description: true, status: true, priority: true, category: true, rootCause: true, workaround: true, knownError: true, affectedServices: true, relatedIncidentCount: true, assignedAgentId: true });
export const insertChangeRequestSchema = createInsertSchema(changeRequests).pick({ title: true, description: true, type: true, status: true, priority: true, riskLevel: true, impactAssessment: true, rollbackPlan: true, affectedCIs: true, assignedAgentId: true, approvedBy: true, implementedBy: true });
export const insertServiceCatalogItemSchema = createInsertSchema(serviceCatalogItems).pick({ name: true, description: true, category: true, icon: true, estimatedTime: true, slaTarget: true, approvalRequired: true, active: true, formFields: true });
export const insertKnowledgeArticleSchema = createInsertSchema(knowledgeArticles).pick({ title: true, content: true, category: true, tags: true, status: true, authorId: true, relatedProblemId: true });
export const insertSlaDefinitionSchema = createInsertSchema(slaDefinitions).pick({ name: true, description: true, priority: true, agreementType: true, serviceScope: true, counterparty: true, responseTimeMinutes: true, resolutionTimeMinutes: true, escalationPolicy: true, active: true });
export const insertCmdbItemSchema = createInsertSchema(cmdbItems).pick({ name: true, type: true, category: true, status: true, environment: true, owner: true, location: true, ipAddress: true, osVersion: true, manufacturer: true, model: true, serialNumber: true, firmware: true, metadata: true });
export const insertCmdbRelationshipSchema = createInsertSchema(cmdbRelationships).pick({ sourceItemId: true, targetItemId: true, relationshipType: true });
export const insertConnectorSchema = createInsertSchema(infrastructureConnectors).pick({ name: true, protocol: true, host: true, port: true, status: true, credentialType: true, credentialRef: true, scanInterval: true, agentId: true, metadata: true });
export const insertPlaybookSchema = createInsertSchema(automationPlaybooks).pick({ name: true, description: true, triggerType: true, triggerCondition: true, actions: true, agentId: true, enabled: true, category: true, severity: true });
export const insertPlaybookExecutionSchema = createInsertSchema(playbookExecutions).pick({ playbookId: true, agentId: true, status: true, triggerReason: true, actionsTaken: true, result: true, targetAsset: true });
export const insertTelemetryMetricSchema = createInsertSchema(telemetryMetrics).pick({ sourceId: true, sourceName: true, metricName: true, metricValue: true, unit: true, status: true });
export const insertAgentActivitySchema = createInsertSchema(agentActivities).pick({ agentId: true, action: true, details: true, relatedEntityType: true, relatedEntityId: true, autonomous: true }).extend({ relatedEntityId: z.string().optional() });
export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({ role: true, content: true, agentId: true, userId: true });
export const insertOrgRoleSchema = createInsertSchema(orgRoles).pick({ name: true, title: true, department: true, division: true, parentRoleId: true, level: true, description: true, responsibilities: true, aiCapabilities: true, jobDescription: true, requiredSkills: true, keyTasks: true, icon: true, color: true, monthlyPrice: true, humanCostMonthly: true, isSubscribable: true, sortOrder: true });
export const insertRoleSubscriptionSchema = createInsertSchema(roleSubscriptions).pick({ userId: true, roleId: true, status: true, assignedHumanName: true, assignedHumanEmail: true, hasAiShadow: true, availabilityStatus: true, shiftStart: true, shiftEnd: true, currentWorkload: true, maxWorkload: true, contactPhone: true });
export const insertCrewSchema = createInsertSchema(crews).pick({ name: true, description: true, department: true, processType: true, status: true, agentRoleIds: true, userId: true });
export const insertAgentTaskSchema = createInsertSchema(agentTasks).pick({ description: true, expectedOutput: true, status: true, assignedRoleId: true, crewId: true, priority: true, context: true, output: true, userId: true });
export const insertAgentWorkflowSchema = createInsertSchema(agentWorkflows).pick({ name: true, description: true, processType: true, status: true, taskIds: true, crewId: true, userId: true });
export const insertCommitteeSchema = createInsertSchema(committees).pick({ name: true, type: true, description: true, memberRoleIds: true, chairRoleId: true, quorumRequired: true, status: true, userId: true });
export const insertWorkflowStageSchema = createInsertSchema(workflowStages).pick({ workflowId: true, name: true, stageOrder: true, stageType: true, assignedRoleId: true, committeeId: true, status: true, requiredApprovals: true, notes: true });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type AiAgent = typeof aiAgents.$inferSelect;
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type SecurityEvent = typeof securityEvents.$inferSelect;
export type InsertProblem = z.infer<typeof insertProblemSchema>;
export type Problem = typeof problems.$inferSelect;
export type InsertChangeRequest = z.infer<typeof insertChangeRequestSchema>;
export type ChangeRequest = typeof changeRequests.$inferSelect;
export type InsertServiceCatalogItem = z.infer<typeof insertServiceCatalogItemSchema>;
export type ServiceCatalogItem = typeof serviceCatalogItems.$inferSelect;
export type InsertKnowledgeArticle = z.infer<typeof insertKnowledgeArticleSchema>;
export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;
export type InsertSlaDefinition = z.infer<typeof insertSlaDefinitionSchema>;
export type SlaDefinition = typeof slaDefinitions.$inferSelect;
export type InsertCmdbItem = z.infer<typeof insertCmdbItemSchema>;
export type CmdbItem = typeof cmdbItems.$inferSelect;
export type InsertCmdbRelationship = z.infer<typeof insertCmdbRelationshipSchema>;
export type CmdbRelationship = typeof cmdbRelationships.$inferSelect;
export type InsertConnector = z.infer<typeof insertConnectorSchema>;
export type Connector = typeof infrastructureConnectors.$inferSelect;
export type InsertPlaybook = z.infer<typeof insertPlaybookSchema>;
export type Playbook = typeof automationPlaybooks.$inferSelect;
export type InsertPlaybookExecution = z.infer<typeof insertPlaybookExecutionSchema>;
export type PlaybookExecution = typeof playbookExecutions.$inferSelect;
export type InsertTelemetryMetric = z.infer<typeof insertTelemetryMetricSchema>;
export type TelemetryMetric = typeof telemetryMetrics.$inferSelect;
export type InsertAgentActivity = z.infer<typeof insertAgentActivitySchema>;
export type AgentActivity = typeof agentActivities.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertOrgRole = z.infer<typeof insertOrgRoleSchema>;
export type OrgRole = typeof orgRoles.$inferSelect;
export type InsertRoleSubscription = z.infer<typeof insertRoleSubscriptionSchema>;
export type RoleSubscription = typeof roleSubscriptions.$inferSelect;
export type InsertCrew = z.infer<typeof insertCrewSchema>;
export type Crew = typeof crews.$inferSelect;
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentWorkflow = z.infer<typeof insertAgentWorkflowSchema>;
export type AgentWorkflow = typeof agentWorkflows.$inferSelect;
export type InsertCommittee = z.infer<typeof insertCommitteeSchema>;
export type Committee = typeof committees.$inferSelect;
export type InsertWorkflowStage = z.infer<typeof insertWorkflowStageSchema>;
export type WorkflowStage = typeof workflowStages.$inferSelect;

export const discoveryCredentials = pgTable("discovery_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  protocol: text("protocol").notNull(),
  host: text("host").notNull(),
  port: integer("port"),
  authType: text("auth_type").notNull().default("username_password"),
  status: text("status").notNull().default("configured"),
  lastVerified: timestamp("last_verified"),
  metadata: jsonb("metadata"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const discoveryProbes = pgTable("discovery_probes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  protocol: text("protocol").notNull(),
  credentialId: varchar("credential_id"),
  scanSubnet: text("scan_subnet"),
  scanSchedule: text("scan_schedule"),
  status: text("status").notNull().default("idle"),
  lastScanAt: timestamp("last_scan_at"),
  discoveredCount: integer("discovered_count").notNull().default(0),
  assignedAgentRoleId: varchar("assigned_agent_role_id"),
  siteToken: varchar("site_token").unique(),
  hmacSecret: text("hmac_secret"),
  tokenExpiresAt: timestamp("token_expires_at"),
  enrolledIp: text("enrolled_ip"),
  lastNonce: text("last_nonce"),
  lastRequestTimestamp: timestamp("last_request_timestamp"),
  probeTypeId: varchar("probe_type_id"),
  deploymentType: text("deployment_type"),
  probeVersion: text("probe_version"),
  lastHeartbeat: timestamp("last_heartbeat"),
  heartbeatInterval: integer("heartbeat_interval").default(60),
  ipAddress: text("ip_address"),
  hostname: text("hostname"),
  osInfo: text("os_info"),
  enrolled: boolean("enrolled").default(false),
  enrolledAt: timestamp("enrolled_at"),
  cpuUsage: real("cpu_usage"),
  memoryUsage: real("memory_usage"),
  diskUsage: real("disk_usage"),
  taskQueueDepth: integer("task_queue_depth").default(0),
  avgScanDuration: real("avg_scan_duration"),
  healthStatus: text("health_status").default("healthy"),
  healthMetrics: jsonb("health_metrics"),
  collectionSchedule: jsonb("collection_schedule"),
  bufferStatus: jsonb("buffer_status"),
  lastPayloadSize: integer("last_payload_size").default(0),
  clusterEnabled: boolean("cluster_enabled").default(false),
  clusterMode: text("cluster_mode").default("standalone"),
  clusterCoordinatorId: varchar("cluster_coordinator_id"),
  mediaAddonEnabled: boolean("media_addon_enabled").default(false),
  mediaAddonConfig: jsonb("media_addon_config"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const probeClusterNodes = pgTable("probe_cluster_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  probeId: varchar("probe_id").notNull(),
  nodeAlias: text("node_alias").notNull(),
  hardwareTier: text("hardware_tier").notNull().default("performance"),
  cpuCores: integer("cpu_cores").notNull().default(4),
  ramGb: integer("ram_gb").notNull().default(64),
  maxMetrics: integer("max_metrics").notNull().default(5000),
  currentMetrics: integer("current_metrics").notNull().default(0),
  status: text("status").notNull().default("online"),
  lastHeartbeat: timestamp("last_heartbeat"),
  ipAddress: text("ip_address"),
  hostname: text("hostname"),
  cpuUsage: real("cpu_usage"),
  memoryUsage: real("memory_usage"),
  diskUsage: real("disk_usage"),
  healthMetrics: jsonb("health_metrics"),
  joinedAt: timestamp("joined_at").defaultNow(),
  userId: varchar("user_id").notNull(),
});

export const insertProbeClusterNodeSchema = createInsertSchema(probeClusterNodes).omit({ id: true, joinedAt: true });
export type InsertProbeClusterNode = z.infer<typeof insertProbeClusterNodeSchema>;
export type ProbeClusterNode = typeof probeClusterNodes.$inferSelect;

export const probeCredentialLinks = pgTable("probe_credential_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  probeId: varchar("probe_id").notNull(),
  credentialId: varchar("credential_id").notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const insertProbeCredentialLinkSchema = createInsertSchema(probeCredentialLinks).omit({ id: true, addedAt: true });
export type InsertProbeCredentialLink = z.infer<typeof insertProbeCredentialLinkSchema>;
export type ProbeCredentialLink = typeof probeCredentialLinks.$inferSelect;

export const HARDWARE_TIERS: Record<string, { label: string; cpuCores: number; ramGb: number; maxMetrics: number; description: string }> = {
  entry: { label: "Entry", cpuCores: 2, ramGb: 16, maxMetrics: 1500, description: "Small sites, up to 1,500 metrics" },
  standard: { label: "Standard", cpuCores: 4, ramGb: 32, maxMetrics: 3000, description: "Mid-size environments, up to 3,000 metrics" },
  performance: { label: "Performance", cpuCores: 4, ramGb: 64, maxMetrics: 5000, description: "Production benchmark, up to 5,000 metrics" },
  enterprise: { label: "Enterprise", cpuCores: 8, ramGb: 128, maxMetrics: 10000, description: "Large-scale environments, up to 10,000 metrics" },
  custom: { label: "Custom", cpuCores: 0, ramGb: 0, maxMetrics: 0, description: "User-defined hardware configuration" },
};

export const probeTypes = pgTable("probe_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("Radar"),
  color: text("color").notNull().default("text-blue-400"),
  protocol: text("protocol"),
  deploymentModel: text("deployment_model"),
  couplingMode: text("coupling_mode").notNull().default("coupled"),
  characteristics: text("characteristics").array().notNull().default(sql`'{}'::text[]`),
  requiresEnrollment: boolean("requires_enrollment").default(false),
  containerImage: text("container_image"),
  containerResources: jsonb("container_resources"),
  hasLocalReasoning: boolean("has_local_reasoning").default(false),
  bufferCapacity: integer("buffer_capacity").default(0),
  syncStrategy: text("sync_strategy"),
  communicationProtocols: jsonb("communication_protocols").default(sql`'[]'::jsonb`),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const discoveredAssets = pgTable("discovered_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  probeId: varchar("probe_id"),
  name: text("name").notNull(),
  type: text("type").notNull(),
  vendor: text("vendor"),
  model: text("model"),
  ipAddress: text("ip_address"),
  macAddress: text("mac_address"),
  firmware: text("firmware"),
  status: text("status").notNull().default("online"),
  protocol: text("protocol"),
  lastSeen: timestamp("last_seen").defaultNow(),
  assignedAgentRoleId: varchar("assigned_agent_role_id"),
  metadata: jsonb("metadata"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_assets_user_probe").on(table.userId, table.probeId),
  index("idx_assets_probe_ip").on(table.probeId, table.ipAddress),
  index("idx_assets_probe_name").on(table.probeId, table.name),
]);

export const insertNetworkDeviceSchema = createInsertSchema(networkDevices).pick({ name: true, type: true, vendor: true, model: true, ipAddress: true, firmware: true, status: true, location: true, configHash: true, assignedAgentRoleId: true, userId: true });
export const insertDeviceMetricSchema = createInsertSchema(deviceMetrics).pick({ deviceId: true, metricName: true, value: true, unit: true, thresholdWarning: true, thresholdCritical: true, status: true, userId: true });
export const insertAgentAlertSchema = createInsertSchema(agentAlerts).pick({ deviceId: true, agentRoleId: true, type: true, severity: true, message: true, details: true, acknowledged: true, falsePositive: true, userId: true });
export const insertAgentKpiSchema = createInsertSchema(agentKpis).pick({ agentRoleId: true, kpiName: true, currentValue: true, targetValue: true, unit: true, trend: true, period: true, userId: true });

export type InsertNetworkDevice = z.infer<typeof insertNetworkDeviceSchema>;
export type NetworkDevice = typeof networkDevices.$inferSelect;
export type InsertDeviceMetric = z.infer<typeof insertDeviceMetricSchema>;
export type DeviceMetric = typeof deviceMetrics.$inferSelect;
export type InsertAgentAlert = z.infer<typeof insertAgentAlertSchema>;
export type AgentAlert = typeof agentAlerts.$inferSelect;
export type InsertAgentKpi = z.infer<typeof insertAgentKpiSchema>;
export type AgentKpi = typeof agentKpis.$inferSelect;

export const agentPerformanceMetrics = pgTable("agent_performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentRoleId: varchar("agent_role_id").notNull(),
  metricPeriod: text("metric_period").notNull().default("monthly"),
  accuracyScore: real("accuracy_score").notNull().default(0),
  taskCompletionRate: real("task_completion_rate").notNull().default(0),
  hallucinationRisk: real("hallucination_risk").notNull().default(0),
  driftScore: real("drift_score").notNull().default(0),
  avgResponseTime: real("avg_response_time").notNull().default(0),
  escalationRate: real("escalation_rate").notNull().default(0),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  tasksEscalated: integer("tasks_escalated").notNull().default(0),
  confidenceScore: real("confidence_score").notNull().default(0),
  lastEvaluatedAt: timestamp("last_evaluated_at").defaultNow(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentConversations = pgTable("agent_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentMessages = pgTable("agent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  agentRoleId: varchar("agent_role_id"),
  routingReason: text("routing_reason"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgentPerformanceMetricSchema = createInsertSchema(agentPerformanceMetrics).pick({ agentRoleId: true, metricPeriod: true, accuracyScore: true, taskCompletionRate: true, hallucinationRisk: true, driftScore: true, avgResponseTime: true, escalationRate: true, tasksCompleted: true, tasksEscalated: true, confidenceScore: true, userId: true });
export const insertAgentConversationSchema = createInsertSchema(agentConversations).pick({ title: true, userId: true });
export const insertAgentMessageSchema = createInsertSchema(agentMessages).pick({ conversationId: true, role: true, content: true, agentRoleId: true, routingReason: true, userId: true });

export type InsertAgentPerformanceMetric = z.infer<typeof insertAgentPerformanceMetricSchema>;
export type AgentPerformanceMetric = typeof agentPerformanceMetrics.$inferSelect;
export type InsertAgentConversation = z.infer<typeof insertAgentConversationSchema>;
export type AgentConversation = typeof agentConversations.$inferSelect;
export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentMessage = typeof agentMessages.$inferSelect;

export const agentNotifications = pgTable("agent_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentRoleId: varchar("agent_role_id").notNull(),
  assetId: varchar("asset_id"),
  type: text("type").notNull().default("issue_detected"),
  severity: text("severity").notNull().default("medium"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  proposedAction: text("proposed_action"),
  actionStatus: text("action_status").notNull().default("pending"),
  humanResponse: text("human_response"),
  resolvedAt: timestamp("resolved_at"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgentNotificationSchema = createInsertSchema(agentNotifications).pick({ agentRoleId: true, assetId: true, type: true, severity: true, title: true, description: true, proposedAction: true, actionStatus: true, humanResponse: true, userId: true });
export type InsertAgentNotification = z.infer<typeof insertAgentNotificationSchema>;
export type AgentNotification = typeof agentNotifications.$inferSelect;

export const userManagedAgents = pgTable("user_managed_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  agentRoleId: varchar("agent_role_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const insertUserManagedAgentSchema = createInsertSchema(userManagedAgents).pick({ userId: true, agentRoleId: true });
export type InsertUserManagedAgent = z.infer<typeof insertUserManagedAgentSchema>;
export type UserManagedAgent = typeof userManagedAgents.$inferSelect;

export const thresholdCalibrations = pgTable("threshold_calibrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricId: varchar("metric_id"),
  deviceId: varchar("device_id"),
  metricName: text("metric_name").notNull(),
  currentWarning: real("current_warning"),
  currentCritical: real("current_critical"),
  calibratedWarning: real("calibrated_warning"),
  calibratedCritical: real("calibrated_critical"),
  calibratedNormal: real("calibrated_normal"),
  unit: text("unit").notNull(),
  algorithm: text("algorithm").notNull().default("variation_calibration"),
  confidence: real("confidence").notNull().default(0),
  dataPointsAnalyzed: integer("data_points_analyzed").notNull().default(0),
  varianceCoefficient: real("variance_coefficient"),
  meanValue: real("mean_value"),
  stdDeviation: real("std_deviation"),
  p95Value: real("p95_value"),
  p99Value: real("p99_value"),
  falsePositivesBefore: integer("false_positives_before").default(0),
  falsePositivesProjected: integer("false_positives_projected").default(0),
  status: text("status").notNull().default("proposed"),
  appliedAt: timestamp("applied_at"),
  agentRoleId: varchar("agent_role_id"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertThresholdCalibrationSchema = createInsertSchema(thresholdCalibrations).pick({
  metricId: true, deviceId: true, metricName: true,
  currentWarning: true, currentCritical: true,
  calibratedWarning: true, calibratedCritical: true, calibratedNormal: true,
  unit: true, algorithm: true, confidence: true, dataPointsAnalyzed: true,
  varianceCoefficient: true, meanValue: true, stdDeviation: true,
  p95Value: true, p99Value: true,
  falsePositivesBefore: true, falsePositivesProjected: true,
  status: true, agentRoleId: true, userId: true,
});
export type InsertThresholdCalibration = z.infer<typeof insertThresholdCalibrationSchema>;
export type ThresholdCalibration = typeof thresholdCalibrations.$inferSelect;

export const monitoredApplications = pgTable("monitored_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull(),
  name: text("name").notNull(),
  version: text("version"),
  category: text("category").notNull(),
  criticality: text("criticality").notNull().default("utility"),
  status: text("status").notNull().default("running"),
  port: integer("port"),
  protocol: text("protocol"),
  processName: text("process_name"),
  uptime: real("uptime"),
  responseTime: real("response_time"),
  cpuUsage: real("cpu_usage"),
  memoryUsage: real("memory_usage"),
  healthScore: integer("health_score").default(100),
  lastChecked: timestamp("last_checked").defaultNow(),
  dependencies: text("dependencies").array(),
  metadata: jsonb("metadata"),
  discoveredBy: varchar("discovered_by"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMonitoredApplicationSchema = createInsertSchema(monitoredApplications).omit({ id: true, createdAt: true });
export type InsertMonitoredApplication = z.infer<typeof insertMonitoredApplicationSchema>;
export type MonitoredApplication = typeof monitoredApplications.$inferSelect;

export const applicationTopologies = pgTable("application_topologies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  criticality: text("criticality").notNull().default("business"),
  status: text("status").notNull().default("healthy"),
  assetIds: text("asset_ids").array().notNull(),
  serviceIds: text("service_ids").array(),
  healthScore: integer("health_score").default(100),
  impactAnalysis: jsonb("impact_analysis"),
  topology: jsonb("topology"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApplicationTopologySchema = createInsertSchema(applicationTopologies).omit({ id: true, createdAt: true });
export type InsertApplicationTopology = z.infer<typeof insertApplicationTopologySchema>;
export type ApplicationTopology = typeof applicationTopologies.$inferSelect;

export const remediationTasks = pgTable("remediation_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").notNull(),
  probeId: varchar("probe_id"),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  remediationScript: text("remediation_script").notNull(),
  rollbackScript: text("rollback_script"),
  scriptType: text("script_type").notNull().default("powershell"),
  status: text("status").notNull().default("pending_approval"),
  approvedAt: timestamp("approved_at"),
  dispatchedAt: timestamp("dispatched_at"),
  completedAt: timestamp("completed_at"),
  result: text("result"),
  error: text("error"),
  rollbackStatus: text("rollback_status"),
  rollbackResult: text("rollback_result"),
  rollbackError: text("rollback_error"),
  rollbackDispatchedAt: timestamp("rollback_dispatched_at"),
  rollbackedAt: timestamp("rollbacked_at"),
  createdAt: timestamp("created_at").defaultNow(),
  batchId: varchar("batch_id"),
  category: varchar("category"),
  riskLevel: varchar("risk_level").default("low"),
  originType: varchar("origin_type").default("human"),
  changeRef: varchar("change_ref"),
}, (table) => [
  index("idx_remediation_probe_status").on(table.probeId, table.status),
]);

export const insertRemediationTaskSchema = createInsertSchema(remediationTasks).omit({ id: true, approvedAt: true, dispatchedAt: true, completedAt: true, result: true, error: true, rollbackStatus: true, rollbackResult: true, rollbackError: true, rollbackDispatchedAt: true, rollbackedAt: true, createdAt: true });
export type InsertRemediationTask = z.infer<typeof insertRemediationTaskSchema>;
export type RemediationTask = typeof remediationTasks.$inferSelect;

export const insertDiscoveryCredentialSchema = createInsertSchema(discoveryCredentials).pick({ name: true, protocol: true, host: true, port: true, authType: true, status: true, metadata: true, userId: true });
export const insertProbeTypeSchema = createInsertSchema(probeTypes).pick({ name: true, description: true, icon: true, color: true, protocol: true, deploymentModel: true, couplingMode: true, characteristics: true, requiresEnrollment: true, containerImage: true, containerResources: true, hasLocalReasoning: true, bufferCapacity: true, syncStrategy: true, communicationProtocols: true, assignedAgentRoleId: true, userId: true });
export type InsertProbeType = z.infer<typeof insertProbeTypeSchema>;
export type ProbeType = typeof probeTypes.$inferSelect;

export const insertDiscoveryProbeSchema = createInsertSchema(discoveryProbes).pick({ name: true, description: true, protocol: true, credentialId: true, scanSubnet: true, scanSchedule: true, status: true, discoveredCount: true, assignedAgentRoleId: true, probeTypeId: true, userId: true });
export const insertDiscoveredAssetSchema = createInsertSchema(discoveredAssets).pick({ probeId: true, name: true, type: true, vendor: true, model: true, ipAddress: true, macAddress: true, firmware: true, status: true, protocol: true, assignedAgentRoleId: true, metadata: true, userId: true });

export type InsertDiscoveryCredential = z.infer<typeof insertDiscoveryCredentialSchema>;
export type DiscoveryCredential = typeof discoveryCredentials.$inferSelect;
export type InsertDiscoveryProbe = z.infer<typeof insertDiscoveryProbeSchema>;
export type DiscoveryProbe = typeof discoveryProbes.$inferSelect;
export type InsertDiscoveredAsset = z.infer<typeof insertDiscoveredAssetSchema>;
export type DiscoveredAsset = typeof discoveredAssets.$inferSelect;

export const serviceMetrics = pgTable("service_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  protocol: text("protocol").notNull(),
  collectionMode: text("collection_mode").notNull().default("continuous"),
  defaultInterval: integer("default_interval"),
  enabled: boolean("enabled").notNull().default(true),
  unit: text("unit"),
  warningThreshold: real("warning_threshold"),
  criticalThreshold: real("critical_threshold"),
  icon: text("icon").notNull().default("Activity"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServiceMetricSchema = createInsertSchema(serviceMetrics).omit({ id: true, createdAt: true });
export type InsertServiceMetric = z.infer<typeof insertServiceMetricSchema>;
export type ServiceMetric = typeof serviceMetrics.$inferSelect;

export const serviceMetricAssignments = pgTable("service_metric_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metricId: varchar("metric_id").notNull(),
  assetId: varchar("asset_id").notNull(),
  collectionMode: text("collection_mode").notNull().default("continuous"),
  interval: integer("interval"),
  enabled: boolean("enabled").notNull().default(true),
  lastValue: real("last_value"),
  lastCollected: timestamp("last_collected"),
  status: text("status").notNull().default("unknown"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServiceMetricAssignmentSchema = createInsertSchema(serviceMetricAssignments).omit({ id: true, createdAt: true });
export type InsertServiceMetricAssignment = z.infer<typeof insertServiceMetricAssignmentSchema>;
export type ServiceMetricAssignment = typeof serviceMetricAssignments.$inferSelect;

export const missionCriticalGroups = pgTable("mission_critical_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  criticality: text("criticality").notNull().default("high"),
  status: text("status").notNull().default("healthy"),
  assetIds: text("asset_ids").array().notNull().default(sql`'{}'`),
  metricIds: text("metric_ids").array().notNull().default(sql`'{}'`),
  healthScore: integer("health_score").notNull().default(100),
  icon: text("icon").notNull().default("Box"),
  color: text("color").notNull().default("#3b82f6"),
  metadata: jsonb("metadata"),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMissionCriticalGroupSchema = createInsertSchema(missionCriticalGroups).omit({ id: true, createdAt: true });
export type InsertMissionCriticalGroup = z.infer<typeof insertMissionCriticalGroupSchema>;
export type MissionCriticalGroup = typeof missionCriticalGroups.$inferSelect;

export const agentMetricProfiles = pgTable("agent_metric_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  metricId: varchar("metric_id").notNull(),
  priority: text("priority").notNull().default("recommended"),
  reasoning: text("reasoning"),
  autoProvision: boolean("auto_provision").notNull().default(true),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgentMetricProfileSchema = createInsertSchema(agentMetricProfiles).omit({ id: true, createdAt: true });
export type InsertAgentMetricProfile = z.infer<typeof insertAgentMetricProfileSchema>;
export type AgentMetricProfile = typeof agentMetricProfiles.$inferSelect;

export const agentOperationalInsights = pgTable("agent_operational_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  userId: varchar("user_id").notNull(),
  predictiveMeasures: jsonb("predictive_measures").notNull().default([]),
  preventiveMeasures: jsonb("preventive_measures").notNull().default([]),
  prescriptiveMeasures: jsonb("prescriptive_measures").notNull().default([]),
  maintenanceActivities: jsonb("maintenance_activities").notNull().default([]),
  bestPractices: jsonb("best_practices").notNull().default([]),
  generatedAt: timestamp("generated_at").defaultNow(),
}, (table) => [
  uniqueIndex("agent_insights_user_role_idx").on(table.userId, table.roleId),
]);

export const insertAgentOperationalInsightsSchema = createInsertSchema(agentOperationalInsights).omit({ id: true, generatedAt: true });
export type InsertAgentOperationalInsights = z.infer<typeof insertAgentOperationalInsightsSchema>;
export type AgentOperationalInsights = typeof agentOperationalInsights.$inferSelect;

export const agentScheduledActivities = pgTable("agent_scheduled_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull(),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  activityType: text("activity_type").notNull(),
  frequency: text("frequency").notNull().default("monthly"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  status: text("status").notNull().default("scheduled"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
  executionNotes: text("execution_notes"),
  sourceInsightId: varchar("source_insight_id"),
  icon: text("icon").notNull().default("Activity"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAgentScheduledActivitySchema = createInsertSchema(agentScheduledActivities).omit({ id: true, createdAt: true });
export type InsertAgentScheduledActivity = z.infer<typeof insertAgentScheduledActivitySchema>;
export type AgentScheduledActivity = typeof agentScheduledActivities.$inferSelect;

export const aiTemplateCache = pgTable("ai_template_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  cacheCategory: text("cache_category").notNull(),
  assetType: text("asset_type").notNull(),
  cacheKey: text("cache_key").notNull(),
  responseData: jsonb("response_data").notNull(),
  tokensSaved: integer("tokens_saved").notNull().default(0),
  hitCount: integer("hit_count").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("ai_cache_user_cat_key_idx").on(table.userId, table.cacheCategory, table.cacheKey),
]);

export const insertAiTemplateCacheSchema = createInsertSchema(aiTemplateCache).omit({ id: true, hitCount: true, createdAt: true });
export type InsertAiTemplateCache = z.infer<typeof insertAiTemplateCacheSchema>;
export type AiTemplateCache = typeof aiTemplateCache.$inferSelect;

export const aiProviders = pgTable("ai_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  providerType: text("provider_type").notNull(),
  apiKey: text("api_key").notNull(),
  baseUrl: text("base_url"),
  model: text("model").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAiProviderSchema = createInsertSchema(aiProviders).omit({ id: true, createdAt: true });
export type InsertAiProvider = z.infer<typeof insertAiProviderSchema>;
export type AiProvider = typeof aiProviders.$inferSelect;

export const bcpPlans = pgTable("bcp_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("draft"),
  category: text("category").notNull(),
  businessImpactLevel: text("business_impact_level").notNull(),
  rtoHours: integer("rto_hours").notNull(),
  rpoHours: integer("rpo_hours").notNull(),
  criticalProcesses: text("critical_processes").array().notNull().default(sql`'{}'::text[]`),
  recoveryStrategy: text("recovery_strategy").notNull(),
  stakeholders: text("stakeholders").array().notNull().default(sql`'{}'::text[]`),
  lastTestedAt: timestamp("last_tested_at"),
  nextReviewDate: timestamp("next_review_date"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  owner: varchar("owner").notNull(),
  priority: text("priority").notNull().default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBcpPlanSchema = createInsertSchema(bcpPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBcpPlan = z.infer<typeof insertBcpPlanSchema>;
export type BcpPlan = typeof bcpPlans.$inferSelect;

export const drpPlans = pgTable("drp_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("draft"),
  disasterType: text("disaster_type").notNull(),
  severity: text("severity").notNull().default("medium"),
  rtoHours: integer("rto_hours").notNull(),
  rpoHours: integer("rpo_hours").notNull(),
  affectedSystems: text("affected_systems").array().notNull().default(sql`'{}'::text[]`),
  recoveryProcedures: text("recovery_procedures").notNull(),
  failoverType: text("failover_type").notNull(),
  failoverTarget: varchar("failover_target"),
  backupLocation: varchar("backup_location"),
  lastTestedAt: timestamp("last_tested_at"),
  testResult: text("test_result").notNull().default("not_tested"),
  nextTestDate: timestamp("next_test_date"),
  bcpPlanId: varchar("bcp_plan_id"),
  owner: varchar("owner").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDrpPlanSchema = createInsertSchema(drpPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDrpPlan = z.infer<typeof insertDrpPlanSchema>;
export type DrpPlan = typeof drpPlans.$inferSelect;

export const bcpBiaEntries = pgTable("bcp_bia_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  businessFunction: text("business_function").notNull(),
  department: text("department").notNull(),
  criticality: text("criticality").notNull().default("medium"),
  mtdHours: integer("mtd_hours").notNull(),
  rtoHours: integer("rto_hours").notNull(),
  rpoHours: integer("rpo_hours").notNull(),
  financialImpactPerHour: integer("financial_impact_per_hour").notNull().default(0),
  dependencies: text("dependencies").array().notNull().default(sql`'{}'::text[]`),
  workaroundAvailable: boolean("workaround_available").notNull().default(false),
  workaroundDescription: text("workaround_description"),
  linkedBcpPlanId: varchar("linked_bcp_plan_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBiaEntrySchema = createInsertSchema(bcpBiaEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBiaEntry = z.infer<typeof insertBiaEntrySchema>;
export type BiaEntry = typeof bcpBiaEntries.$inferSelect;

export const bcpRiskAssessments = pgTable("bcp_risk_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  threatName: text("threat_name").notNull(),
  threatCategory: text("threat_category").notNull(),
  likelihood: integer("likelihood").notNull().default(3),
  impact: integer("impact").notNull().default(3),
  riskScore: integer("risk_score").notNull().default(9),
  currentControls: text("current_controls").notNull(),
  residualRisk: text("residual_risk").notNull().default("medium"),
  mitigationStrategy: text("mitigation_strategy").notNull(),
  riskOwner: varchar("risk_owner").notNull(),
  status: text("status").notNull().default("identified"),
  linkedBcpPlanId: varchar("linked_bcp_plan_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRiskAssessmentSchema = createInsertSchema(bcpRiskAssessments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRiskAssessment = z.infer<typeof insertRiskAssessmentSchema>;
export type RiskAssessment = typeof bcpRiskAssessments.$inferSelect;

export const bcpDrills = pgTable("bcp_drills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  drillType: text("drill_type").notNull(),
  linkedPlanId: varchar("linked_plan_id"),
  linkedPlanType: text("linked_plan_type"),
  scheduledDate: timestamp("scheduled_date").notNull(),
  executedDate: timestamp("executed_date"),
  status: text("status").notNull().default("scheduled"),
  participants: text("participants").array().notNull().default(sql`'{}'::text[]`),
  scenario: text("scenario").notNull(),
  findings: text("findings"),
  lessonsLearned: text("lessons_learned"),
  result: text("result").notNull().default("pending"),
  nextDrillDate: timestamp("next_drill_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDrillSchema = createInsertSchema(bcpDrills).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDrill = z.infer<typeof insertDrillSchema>;
export type Drill = typeof bcpDrills.$inferSelect;

export const bcpReviews = pgTable("bcp_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  linkedPlanId: varchar("linked_plan_id"),
  linkedPlanType: text("linked_plan_type"),
  reviewType: text("review_type").notNull(),
  reviewDate: timestamp("review_date").notNull(),
  reviewer: varchar("reviewer").notNull(),
  status: text("status").notNull().default("pending"),
  findings: text("findings"),
  recommendations: text("recommendations"),
  changesRequired: boolean("changes_required").notNull().default(false),
  changesDescription: text("changes_description"),
  nextReviewDate: timestamp("next_review_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReviewSchema = createInsertSchema(bcpReviews).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Review = typeof bcpReviews.$inferSelect;

export const probeActivityLogs = pgTable("probe_activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  probeId: varchar("probe_id").notNull(),
  eventType: text("event_type").notNull(),
  message: text("message").notNull(),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProbeActivityLogSchema = createInsertSchema(probeActivityLogs).omit({ id: true, createdAt: true });
export type InsertProbeActivityLog = z.infer<typeof insertProbeActivityLogSchema>;
export type ProbeActivityLog = typeof probeActivityLogs.$inferSelect;

// ============================================================
// PROBE MEDIA ADD-ON — Drone/sensor media streaming & AI parse
// ============================================================
export const probeMediaFiles = pgTable("probe_media_files", {
  id:              varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  probeId:         varchar("probe_id").notNull(),
  userId:          varchar("user_id").notNull(),
  missionId:       varchar("mission_id"),         // optional link to flyguys_projects
  fileType:        text("file_type").notNull(),    // image | video | audio | text
  originalFilename: text("original_filename").notNull(),
  filePath:        text("file_path").notNull(),    // server-side storage path
  fileSizeBytes:   integer("file_size_bytes"),
  mimeType:        text("mime_type"),
  streamingMode:   text("streaming_mode").default("batch"), // live | batch
  uploadStatus:    text("upload_status").notNull().default("complete"), // pending | uploading | complete | failed
  checksum:        text("checksum"),
  capturedAt:      timestamp("captured_at"),
  aiParseStatus:   text("ai_parse_status").default("pending"),   // pending | processing | complete | failed
  aiParseResult:   jsonb("ai_parse_result"),
  metadata:        jsonb("metadata"),
  createdAt:       timestamp("created_at").defaultNow(),
});
export const insertProbeMediaFileSchema = createInsertSchema(probeMediaFiles).omit({ id: true, createdAt: true });
export type InsertProbeMediaFile = z.infer<typeof insertProbeMediaFileSchema>;
export type ProbeMediaFile = typeof probeMediaFiles.$inferSelect;

// ============================================================
// KNOWN ERROR DATABASE (KEDB) — ITIL Problem Management
// ============================================================
export const knownErrors = pgTable("known_errors", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  kedbId: varchar("kedb_id", { length: 20 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rootCause: text("root_cause"),
  workaround: text("workaround").notNull(),
  resolution: text("resolution"),
  status: text("status").notNull().default("open"),
  affectedServices: text("affected_services").array().default([]),
  affectedCiIds: integer("affected_ci_ids").array().default([]),
  problemId: integer("problem_id"),
  raisedBy: varchar("raised_by"),
  reviewDate: timestamp("review_date"),
  closedAt: timestamp("closed_at"),
  incidentCount: integer("incident_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKnownErrorSchema = createInsertSchema(knownErrors).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnownError = z.infer<typeof insertKnownErrorSchema>;
export type KnownError = typeof knownErrors.$inferSelect;

// ============================================================
// SLA BREACHES — Real breach tracking per incident/SR
// ============================================================
export const slaBreaches = pgTable("sla_breaches", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slaDefinitionId: text("sla_definition_id"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  entityRef: text("entity_ref"),
  breachType: text("breach_type").notNull(),
  breachMinutes: integer("breach_minutes").notNull(),
  priority: text("priority").notNull(),
  assignedTo: varchar("assigned_to"),
  occurredAt: timestamp("occurred_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by"),
  rootCause: text("root_cause"),
  preventionNotes: text("prevention_notes"),
});

export const insertSlaBreachSchema = createInsertSchema(slaBreaches).omit({ id: true, occurredAt: true });
export type InsertSlaBreach = z.infer<typeof insertSlaBreachSchema>;
export type SlaBreach = typeof slaBreaches.$inferSelect;

// ============================================================
// CSI REGISTER — Continual Service Improvement
// ============================================================
export const csiRegister = pgTable("csi_register", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  csiId: varchar("csi_id", { length: 20 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("identified"),
  baseline: text("baseline"),
  target: text("target"),
  currentMeasure: text("current_measure"),
  owner: varchar("owner"),
  sponsor: text("sponsor"),
  startDate: timestamp("start_date"),
  targetDate: timestamp("target_date"),
  completedAt: timestamp("completed_at"),
  linkedIncidents: integer("linked_incidents").array().default([]),
  linkedProblems: integer("linked_problems").array().default([]),
  linkedChanges: integer("linked_changes").array().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCsiRegisterSchema = createInsertSchema(csiRegister).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCsiRegister = z.infer<typeof insertCsiRegisterSchema>;
export type CsiRegisterItem = typeof csiRegister.$inferSelect;

// ============================================================
// RELEASES — Release Management
// ============================================================
export const releases = pgTable("releases", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  releaseId: varchar("release_id", { length: 20 }).notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("planned"),
  environment: text("environment").notNull().default("production"),
  version: text("version").notNull(),
  plannedStart: timestamp("planned_start"),
  plannedEnd: timestamp("planned_end"),
  actualStart: timestamp("actual_start"),
  actualEnd: timestamp("actual_end"),
  releaseManager: varchar("release_manager"),
  goLiveApproval: boolean("go_live_approval").default(false),
  goLiveApprovedBy: varchar("go_live_approved_by"),
  goLiveApprovedAt: timestamp("go_live_approved_at"),
  rollbackPlan: text("rollback_plan"),
  linkedChangeIds: integer("linked_change_ids").array().default([]),
  affectedServices: text("affected_services").array().default([]),
  deploymentNotes: text("deployment_notes"),
  postDeployChecklist: jsonb("post_deploy_checklist").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const releaseItems = pgTable("release_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  releaseId: integer("release_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  changeId: integer("change_id"),
  deployedAt: timestamp("deployed_at"),
  deployedBy: varchar("deployed_by"),
  notes: text("notes"),
});

export const insertReleaseSchema = createInsertSchema(releases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRelease = z.infer<typeof insertReleaseSchema>;
export type Release = typeof releases.$inferSelect;

export const insertReleaseItemSchema = createInsertSchema(releaseItems).omit({ id: true });
export type InsertReleaseItem = z.infer<typeof insertReleaseItemSchema>;
export type ReleaseItem = typeof releaseItems.$inferSelect;

export const serviceReadings = pgTable("service_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull(),
  metricType: text("metric_type").notNull(),
  value: real("value").notNull(),
  unit: text("unit").notNull().default(""),
  period: text("period").notNull().default("point"),
  source: text("source").notNull().default("ai_agent"),
  note: text("note"),
  measuredAt: timestamp("measured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertServiceReadingSchema = createInsertSchema(serviceReadings).omit({ id: true, createdAt: true });
export type InsertServiceReading = z.infer<typeof insertServiceReadingSchema>;
export type ServiceReading = typeof serviceReadings.$inferSelect;

export const capacityThresholds = pgTable("capacity_thresholds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceName: text("service_name").notNull(),
  metricType: text("metric_type").notNull(),
  warningThreshold: real("warning_threshold").notNull(),
  criticalThreshold: real("critical_threshold").notNull(),
  higherIsBetter: boolean("higher_is_better").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCapacityThresholdSchema = createInsertSchema(capacityThresholds).omit({ id: true, updatedAt: true });
export type InsertCapacityThreshold = z.infer<typeof insertCapacityThresholdSchema>;
export type CapacityThreshold = typeof capacityThresholds.$inferSelect;

export const capacityActions = pgTable("capacity_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceName: text("service_name").notNull(),
  metricType: text("metric_type"),
  title: text("title").notNull(),
  rationale: text("rationale"),
  urgency: text("urgency").notNull().default("monitor"),
  status: text("status").notNull().default("open"),
  owner: text("owner"),
  dueDate: text("due_date"),
  notes: text("notes"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertCapacityActionSchema = createInsertSchema(capacityActions).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertCapacityAction = z.infer<typeof insertCapacityActionSchema>;
export type CapacityAction = typeof capacityActions.$inferSelect;

export const capacityDemandEvents = pgTable("capacity_demand_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  serviceName: text("service_name").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  expectedImpact: text("expected_impact"),
  estimatedLoadIncreasePct: real("estimated_load_increase_pct"),
  plannedDate: text("planned_date").notNull(),
  status: text("status").notNull().default("planned"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCapacityDemandEventSchema = createInsertSchema(capacityDemandEvents).omit({ id: true, createdAt: true });
export type InsertCapacityDemandEvent = z.infer<typeof insertCapacityDemandEventSchema>;
export type CapacityDemandEvent = typeof capacityDemandEvents.$inferSelect;

// ── Log Aggregation ─────────────────────────────────────────────────────────

export const logSources = pgTable("log_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull(),
  type: varchar("type").notNull(), // "api" | "agent" | "syslog" | "splunk" | "elasticsearch" | "datadog" | "loki"
  mode: varchar("mode").notNull().default("standalone"), // "standalone" | "external"
  config: jsonb("config").$type<Record<string, string>>(),
  status: varchar("status").notNull().default("active"), // "active" | "inactive" | "error"
  lastSeen: timestamp("last_seen"),
  logCount: integer("log_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertLogSourceSchema = createInsertSchema(logSources).omit({ id: true, createdAt: true, lastSeen: true, logCount: true });
export type InsertLogSource = z.infer<typeof insertLogSourceSchema>;
export type LogSource = typeof logSources.$inferSelect;

export const logEntries = pgTable("log_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  sourceId: varchar("source_id"),
  deviceId: varchar("device_id"),
  level: varchar("level").notNull().default("info"), // "debug" | "info" | "warn" | "error" | "critical"
  message: text("message").notNull(),
  service: varchar("service"),
  host: varchar("host"),
  tags: text("tags").array().default(sql`'{}'`),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  logTimestamp: timestamp("log_timestamp").notNull().defaultNow(),
  ingestedAt: timestamp("ingested_at").defaultNow(),
});
export const insertLogEntrySchema = createInsertSchema(logEntries).omit({ id: true, ingestedAt: true });
export type InsertLogEntry = z.infer<typeof insertLogEntrySchema>;
export type LogEntry = typeof logEntries.$inferSelect;

export const logRetentionPolicies = pgTable("log_retention_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  sourceId: varchar("source_id"),
  name: varchar("name").notNull(),
  retentionDays: integer("retention_days").notNull().default(90),
  level: varchar("level"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertLogRetentionPolicySchema = createInsertSchema(logRetentionPolicies).omit({ id: true, createdAt: true });
export type InsertLogRetentionPolicy = z.infer<typeof insertLogRetentionPolicySchema>;
export type LogRetentionPolicy = typeof logRetentionPolicies.$inferSelect;

// ============================================================
// MDM — Mobile Device Management (Android & iOS)
// ============================================================

export const mdmDevices = pgTable("mdm_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // 'ios' | 'android'
  model: text("model"),
  manufacturer: text("manufacturer"),
  osVersion: text("os_version"),
  serialNumber: text("serial_number"),
  imei: text("imei"),
  phoneNumber: text("phone_number"),
  status: text("status").notNull().default("pending"), // enrolled | pending | blocked | retired
  complianceStatus: text("compliance_status").notNull().default("unknown"), // compliant | non_compliant | unknown
  ownership: text("ownership").notNull().default("corporate"), // corporate | byod
  department: text("department"),
  enrolledBy: text("enrolled_by"),
  lastCheckIn: timestamp("last_check_in"),
  enrollmentDate: timestamp("enrollment_date"),
  enrollmentToken: varchar("enrollment_token"),
  policyId: varchar("policy_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_mdm_devices_user").on(table.userId),
]);
export const insertMdmDeviceSchema = createInsertSchema(mdmDevices).omit({ id: true, createdAt: true, lastCheckIn: true, enrollmentDate: true });
export type InsertMdmDevice = z.infer<typeof insertMdmDeviceSchema>;
export type MdmDevice = typeof mdmDevices.$inferSelect;

export const mdmPolicies = pgTable("mdm_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  platform: text("platform").notNull().default("all"), // ios | android | all
  isDefault: boolean("is_default").default(false),
  rules: jsonb("rules").$type<Record<string, any>[]>().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMdmPolicySchema = createInsertSchema(mdmPolicies).omit({ id: true, createdAt: true });
export type InsertMdmPolicy = z.infer<typeof insertMdmPolicySchema>;
export type MdmPolicy = typeof mdmPolicies.$inferSelect;

export const mdmEnrollmentTokens = pgTable("mdm_enrollment_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: varchar("token").unique().notNull(),
  platform: text("platform").notNull(), // ios | android
  label: text("label"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  deviceId: varchar("device_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMdmEnrollmentTokenSchema = createInsertSchema(mdmEnrollmentTokens).omit({ id: true, createdAt: true, usedAt: true, deviceId: true });
export type InsertMdmEnrollmentToken = z.infer<typeof insertMdmEnrollmentTokenSchema>;
export type MdmEnrollmentToken = typeof mdmEnrollmentTokens.$inferSelect;

export const mdmActions = pgTable("mdm_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  deviceId: varchar("device_id").notNull(),
  action: text("action").notNull(), // lock | wipe | message | locate | push_policy | block | unblock
  status: text("status").notNull().default("pending"), // pending | sent | completed | failed
  payload: jsonb("payload").$type<Record<string, any>>(),
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});
export const insertMdmActionSchema = createInsertSchema(mdmActions).omit({ id: true, createdAt: true, completedAt: true, result: true });
export type InsertMdmAction = z.infer<typeof insertMdmActionSchema>;
export type MdmAction = typeof mdmActions.$inferSelect;

// ── Command Catalog ──────────────────────────────────────────────────────────
export const commandCatalog = pgTable("command_catalog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  scriptType: text("script_type").notNull().default("bash"),
  script: text("script").notNull(),
  riskLevel: text("risk_level").notNull().default("low"),
  authorType: text("author_type").notNull().default("human"),
  authorName: text("author_name"),
  compatibleOs: text("compatible_os").array().default(sql`'{}'`),
  tags: text("tags").array().default(sql`'{}'`),
  status: text("status").notNull().default("draft"),
  dryRunAssetId: varchar("dry_run_asset_id"),
  dryRunBatchId: varchar("dry_run_batch_id"),
  dryRunResult: text("dry_run_result"),
  dryRunError: text("dry_run_error"),
  dryRunAt: timestamp("dry_run_at"),
  publishedAt: timestamp("published_at"),
  version: integer("version").notNull().default(1),
  usageCount: integer("usage_count").notNull().default(0),
  changeRef: text("change_ref"),
  // AI Review fields
  aiReviewStatus: text("ai_review_status"),
  aiReviewVerdict: text("ai_review_verdict"),
  aiReviewScore: integer("ai_review_score"),
  aiReviewNotes: jsonb("ai_review_notes"),
  aiReviewAt: timestamp("ai_review_at"),
  aiReviewCacheHit: boolean("ai_review_cache_hit"),
  // Rollback
  rollbackScript: text("rollback_script"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertCommandCatalogSchema = createInsertSchema(commandCatalog).omit({ id: true, createdAt: true, updatedAt: true, dryRunAt: true, publishedAt: true, usageCount: true, aiReviewAt: true });
export type InsertCommandCatalog = z.infer<typeof insertCommandCatalogSchema>;
export type CommandCatalogEntry = typeof commandCatalog.$inferSelect;

// ── Command Schedules ────────────────────────────────────────────────────────
export const commandSchedules = pgTable("command_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  script: text("script").notNull(),
  scriptType: text("script_type").notNull().default("bash"),
  assetIds: text("asset_ids").array().notNull().default(sql`'{}'`),
  cronExpression: text("cron_expression").notNull(),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  lastBatchId: varchar("last_batch_id"),
  enabled: boolean("enabled").notNull().default(true),
  riskLevel: text("risk_level").notNull().default("low"),
  category: text("category").notNull().default("general"),
  catalogEntryId: varchar("catalog_entry_id"),
  changeRef: text("change_ref"),
  runCount: integer("run_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertCommandScheduleSchema = createInsertSchema(commandSchedules).omit({ id: true, nextRunAt: true, lastRunAt: true, lastBatchId: true, runCount: true, createdAt: true, updatedAt: true });
export type InsertCommandSchedule = z.infer<typeof insertCommandScheduleSchema>;
export type CommandSchedule = typeof commandSchedules.$inferSelect;

// ── Command Approvals ────────────────────────────────────────────────────────
export const commandApprovals = pgTable("command_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull(),
  batchId: varchar("batch_id").notNull(),
  title: text("title").notNull(),
  script: text("script").notNull(),
  scriptType: text("script_type").notNull().default("bash"),
  assetId: varchar("asset_id").notNull(),
  assetName: text("asset_name"),
  riskLevel: text("risk_level").notNull().default("high"),
  changeRef: text("change_ref"),
  requestedById: varchar("requested_by_id").notNull(),
  requestedByName: text("requested_by_name"),
  approvedById: varchar("approved_by_id"),
  approvedByName: text("approved_by_name"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected | expired
  notes: text("notes"),
  requestedAt: timestamp("requested_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  expiresAt: timestamp("expires_at"),
});
export const insertCommandApprovalSchema = createInsertSchema(commandApprovals).omit({ id: true, approvedById: true, approvedByName: true, resolvedAt: true, requestedAt: true });
export type InsertCommandApproval = z.infer<typeof insertCommandApprovalSchema>;
export type CommandApproval = typeof commandApprovals.$inferSelect;

// ── Patches ───────────────────────────────────────────────────────────────────
export const patches = pgTable("patches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"), // critical | high | medium | low
  cvssScore: real("cvss_score"),
  cveId: text("cve_id"),
  vendor: text("vendor"),
  product: text("product"),
  patchType: text("patch_type").notNull().default("security"), // security | feature | hotfix | firmware
  status: text("status").notNull().default("available"), // available | scheduled | deploying | deployed | failed | skipped
  scriptType: text("script_type").notNull().default("powershell"),
  patchScript: text("patch_script").notNull().default(""),
  rollbackScript: text("rollback_script"),
  affectedOs: text("affected_os").array().default(sql`'{}'`),
  affectedAssetTypes: text("affected_asset_types").array().default(sql`'{}'`),
  aiPriority: integer("ai_priority").default(0),
  aiNotes: text("ai_notes"),
  tags: text("tags").array().default(sql`'{}'`),
  changeRef: text("change_ref"),
  scheduledAt: timestamp("scheduled_at"),
  deployedAt: timestamp("deployed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertPatchSchema = createInsertSchema(patches).omit({ id: true, createdAt: true, updatedAt: true, deployedAt: true });
export type InsertPatch = z.infer<typeof insertPatchSchema>;
export type Patch = typeof patches.$inferSelect;

// ── Patch Jobs ────────────────────────────────────────────────────────────────
export const patchJobs = pgTable("patch_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  patchId: varchar("patch_id"),
  assetId: varchar("asset_id").notNull(),
  probeId: varchar("probe_id").notNull(),
  taskId: varchar("task_id"),
  status: text("status").notNull().default("pending"), // pending | executing | completed | failed | rolled_back
  result: text("result"),
  error: text("error"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPatchJobSchema = createInsertSchema(patchJobs).omit({ id: true, createdAt: true, completedAt: true, startedAt: true });
export type InsertPatchJob = z.infer<typeof insertPatchJobSchema>;
export type PatchJob = typeof patchJobs.$inferSelect;

// ── Terminal Sessions ─────────────────────────────────────────────────────────
export const terminalSessions = pgTable("terminal_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  assetId: varchar("asset_id").notNull(),
  probeId: varchar("probe_id").notNull(),
  scriptType: text("script_type").notNull().default("bash"),
  commands: jsonb("commands").notNull().default(sql`'[]'`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export type TerminalSession = typeof terminalSessions.$inferSelect;

// ── Autonomous Validation ─────────────────────────────────────────────────────

export const validationProviders = pgTable("validation_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("mock"), // mock | eve-ng | cml | gns3 | netlab | custom
  baseUrl: text("base_url"),
  apiKey: text("api_key"),
  username: text("username"),
  password: text("password"),
  status: text("status").notNull().default("unchecked"), // unchecked | connected | error | disabled
  config: jsonb("config").default(sql`'{}'`),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertValidationProviderSchema = createInsertSchema(validationProviders).omit({ id: true, createdAt: true, lastCheckedAt: true });
export type InsertValidationProvider = z.infer<typeof insertValidationProviderSchema>;
export type ValidationProvider = typeof validationProviders.$inferSelect;

export const validationEnvironments = pgTable("validation_environments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  providerId: varchar("provider_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  topology: text("topology"),
  status: text("status").notNull().default("idle"), // idle | reserving | active | releasing | error
  topology_data: jsonb("topology_data").default(sql`'{}'`),
  nodeCount: integer("node_count").default(0),
  providerEnvId: text("provider_env_id"),
  reservedAt: timestamp("reserved_at"),
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertValidationEnvironmentSchema = createInsertSchema(validationEnvironments).omit({ id: true, createdAt: true, reservedAt: true, releasedAt: true });
export type InsertValidationEnvironment = z.infer<typeof insertValidationEnvironmentSchema>;
export type ValidationEnvironment = typeof validationEnvironments.$inferSelect;

export const validationVirtualAssets = pgTable("validation_virtual_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  environmentId: varchar("environment_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // router | switch | firewall | server | iot | loadbalancer | wan
  ipAddress: text("ip_address"),
  macAddress: text("mac_address"),
  vendor: text("vendor"),
  model: text("model"),
  os: text("os"),
  status: text("status").notNull().default("unknown"), // unknown | online | offline | booting
  interfaces: jsonb("interfaces").default(sql`'[]'`),
  metadata: jsonb("metadata").default(sql`'{}'`),
  discoveredAt: timestamp("discovered_at").defaultNow(),
});
export const insertValidationVirtualAssetSchema = createInsertSchema(validationVirtualAssets).omit({ id: true, discoveredAt: true });
export type InsertValidationVirtualAsset = z.infer<typeof insertValidationVirtualAssetSchema>;
export type ValidationVirtualAsset = typeof validationVirtualAssets.$inferSelect;

export const validationProbeDeployments = pgTable("validation_probe_deployments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  environmentId: varchar("environment_id").notNull(),
  probeId: varchar("probe_id"),
  probeName: text("probe_name").notNull(),
  probeType: text("probe_type").notNull().default("docker"), // docker | native | agent
  status: text("status").notNull().default("pending"), // pending | deploying | active | failed | stopped
  targetAssetIds: text("target_asset_ids").array().default(sql`'{}'`),
  config: jsonb("config").default(sql`'{}'`),
  deployedAt: timestamp("deployed_at"),
  lastHeartbeat: timestamp("last_heartbeat"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertValidationProbeDeploymentSchema = createInsertSchema(validationProbeDeployments).omit({ id: true, createdAt: true, deployedAt: true, lastHeartbeat: true });
export type InsertValidationProbeDeployment = z.infer<typeof insertValidationProbeDeploymentSchema>;
export type ValidationProbeDeployment = typeof validationProbeDeployments.$inferSelect;

export const validationTests = pgTable("validation_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  environmentId: varchar("environment_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  protocols: text("protocols").array().default(sql`'{}'`), // icmp | ssh | snmp | http | https | netconf | bgp | ospf | modbus | mqtt
  targetAssetIds: text("target_asset_ids").array().default(sql`'{}'`),
  config: jsonb("config").default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertValidationTestSchema = createInsertSchema(validationTests).omit({ id: true, createdAt: true });
export type InsertValidationTest = z.infer<typeof insertValidationTestSchema>;
export type ValidationTest = typeof validationTests.$inferSelect;

export const validationTestRuns = pgTable("validation_test_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: varchar("test_id").notNull(),
  userId: varchar("user_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | running | passed | failed | partial | cancelled
  progress: integer("progress").default(0),
  results: jsonb("results").default(sql`'[]'`),
  summary: jsonb("summary").default(sql`'{}'`),
  telemetry: jsonb("telemetry").default(sql`'[]'`),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertValidationTestRunSchema = createInsertSchema(validationTestRuns).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export type InsertValidationTestRun = z.infer<typeof insertValidationTestRunSchema>;
export type ValidationTestRun = typeof validationTestRuns.$inferSelect;

export const validationReports = pgTable("validation_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  environmentId: varchar("environment_id"),
  name: text("name").notNull(),
  type: text("type").notNull().default("summary"), // summary | detailed | compliance | executive
  status: text("status").notNull().default("generating"), // generating | ready | failed
  reportData: jsonb("report_data").default(sql`'{}'`),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertValidationReportSchema = createInsertSchema(validationReports).omit({ id: true, createdAt: true, generatedAt: true });
export type InsertValidationReport = z.infer<typeof insertValidationReportSchema>;
export type ValidationReport = typeof validationReports.$inferSelect;

export const validationProbeConfigs = pgTable("validation_probe_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  probeType: text("probe_type").notNull(),
  targetDeviceType: text("target_device_type").notNull(),
  config: jsonb("config").default(sql`'{}'`),
  certificationStatus: text("certification_status").notNull().default("uncertified"),
  lastCertifiedAt: timestamp("last_certified_at"),
  certificationReport: jsonb("certification_report").default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertValidationProbeConfigSchema = createInsertSchema(validationProbeConfigs).omit({ id: true, createdAt: true, lastCertifiedAt: true });
export type InsertValidationProbeConfig = z.infer<typeof insertValidationProbeConfigSchema>;
export type ValidationProbeConfig = typeof validationProbeConfigs.$inferSelect;

// ── Configuration Management ─────────────────────────────────────────────────
export const configRfcs = pgTable("config_rfcs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  assetId: varchar("asset_id").notNull(),
  rfcNumber: text("rfc_number").notNull(),
  title: text("title").notNull(),
  changeType: text("change_type").notNull().default("normal"),
  category: text("category").notNull().default("all"),
  standard: text("standard").notNull(),
  mode: text("mode").notNull().default("audit"),
  status: text("status").notNull().default("draft"),
  risk: text("risk").notNull().default("medium"),
  summary: text("summary"),
  impact: text("impact"),
  driftFindings: jsonb("drift_findings").default(sql`'[]'`),
  changes: jsonb("changes").default(sql`'[]'`),
  rollbackPlan: text("rollback_plan"),
  maintenanceWindow: text("maintenance_window"),
  currentConfigSnapshot: jsonb("current_config_snapshot").default(sql`'{}'`),
  complianceScoreBefore: integer("compliance_score_before"),
  complianceScoreTarget: integer("compliance_score_target"),
  aiModel: text("ai_model"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertConfigRfcSchema = createInsertSchema(configRfcs).omit({ id: true, createdAt: true, approvedAt: true, executedAt: true, completedAt: true });
export type InsertConfigRfc = z.infer<typeof insertConfigRfcSchema>;
export type ConfigRfc = typeof configRfcs.$inferSelect;

export const configBaselines = pgTable("config_baselines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  assetId: varchar("asset_id").notNull(),
  name: text("name").notNull(),
  standard: text("standard").notNull(),
  scope: text("scope").notNull().default("all"),
  configSnapshot: jsonb("config_snapshot").default(sql`'{}'`),
  complianceScore: integer("compliance_score"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertConfigBaselineSchema = createInsertSchema(configBaselines).omit({ id: true, createdAt: true });
export type InsertConfigBaseline = z.infer<typeof insertConfigBaselineSchema>;
export type ConfigBaseline = typeof configBaselines.$inferSelect;

export const securityIntegrations = pgTable("security_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  platform: text("platform").notNull(),
  category: text("category").notNull(),
  displayName: text("display_name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  credentials: jsonb("credentials").default(sql`'{}'`),
  testStatus: text("test_status").notNull().default("untested"),
  lastTestedAt: timestamp("last_tested_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSecurityIntegrationSchema = createInsertSchema(securityIntegrations).omit({ id: true, createdAt: true, updatedAt: true, lastTestedAt: true });
export type InsertSecurityIntegration = z.infer<typeof insertSecurityIntegrationSchema>;
export type SecurityIntegration = typeof securityIntegrations.$inferSelect;

/* ═══════════════════════════════════════════════════════════════════
   SERVICE FINANCIAL MANAGEMENT  (ITIL 4 General Management Practice)
   ═══════════════════════════════════════════════════════════════════ */
export const serviceFinancials = pgTable("service_financials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceName: text("service_name").notNull(),
  serviceCatalogItemId: varchar("service_catalog_item_id"),
  annualBudget: real("annual_budget").notNull().default(0),
  ytdSpend: real("ytd_spend").notNull().default(0),
  monthlyRunRate: real("monthly_run_rate").notNull().default(0),
  costModel: text("cost_model").notNull().default("fixed"),
  costCenter: text("cost_center").notNull(),
  allocatedTo: text("allocated_to").array().default(sql`'{}'`),
  currency: text("currency").notNull().default("USD"),
  forecastedAnnual: real("forecasted_annual").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertServiceFinancialSchema = createInsertSchema(serviceFinancials).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertServiceFinancial = z.infer<typeof insertServiceFinancialSchema>;
export type ServiceFinancial = typeof serviceFinancials.$inferSelect;

/* ═══════════════════════════════════════════════════════════════════
   SUPPLIER MANAGEMENT  (ITIL 4 General Management Practice)
   ═══════════════════════════════════════════════════════════════════ */
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  riskTier: text("risk_tier").notNull().default("medium"),
  status: text("status").notNull().default("active"),
  website: text("website"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export const supplierContracts = pgTable("supplier_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierId: varchar("supplier_id").notNull(),
  name: text("name").notNull(),
  contractValue: real("contract_value").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  renewalNoticeDays: integer("renewal_notice_days").notNull().default(90),
  status: text("status").notNull().default("active"),
  slaUptimeTarget: real("sla_uptime_target"),
  actualUptime: real("actual_uptime"),
  autoRenew: boolean("auto_renew").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSupplierContractSchema = createInsertSchema(supplierContracts).omit({ id: true, createdAt: true });
export type InsertSupplierContract = z.infer<typeof insertSupplierContractSchema>;
export type SupplierContract = typeof supplierContracts.$inferSelect;

/* ═══════════════════════════════════════════════════════════════════
   DEPLOYMENT MANAGEMENT  (ITIL 4 Technical Management Practice)
   ═══════════════════════════════════════════════════════════════════ */
export const deployments = pgTable("deployments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  version: text("version").notNull(),
  environment: text("environment").notNull(),
  status: text("status").notNull().default("planned"),
  deploymentType: text("deployment_type").notNull().default("release"),
  releaseId: varchar("release_id"),
  changeRequestId: varchar("change_request_id"),
  deployedBy: text("deployed_by").notNull(),
  affectedServices: text("affected_services").array().default(sql`'{}'`),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMinutes: integer("duration_minutes"),
  rollbackAvailable: boolean("rollback_available").notNull().default(true),
  rollbackReason: text("rollback_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertDeploymentSchema = createInsertSchema(deployments).omit({ id: true, createdAt: true });
export type InsertDeployment = z.infer<typeof insertDeploymentSchema>;
export type Deployment = typeof deployments.$inferSelect;

/* ═══════════════════════════════════════════════════════════════════
   RELATIONSHIP MANAGEMENT  (ITIL 4 General Management Practice)
   ═══════════════════════════════════════════════════════════════════ */
export const stakeholders = pgTable("stakeholders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  relationshipType: text("relationship_type").notNull().default("key_user"),
  services: text("services").array().default(sql`'{}'`),
  satisfactionScore: integer("satisfaction_score"),
  lastReviewDate: text("last_review_date"),
  escalationContact: boolean("escalation_contact").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertStakeholderSchema = createInsertSchema(stakeholders).omit({ id: true, createdAt: true });
export type InsertStakeholder = z.infer<typeof insertStakeholderSchema>;
export type Stakeholder = typeof stakeholders.$inferSelect;

export const serviceReviews = pgTable("service_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  stakeholderId: varchar("stakeholder_id"),
  reviewDate: text("review_date").notNull(),
  status: text("status").notNull().default("scheduled"),
  slaPerformance: real("sla_performance"),
  openIncidents: integer("open_incidents").notNull().default(0),
  csatScore: real("csat_score"),
  actionItems: text("action_items").array().default(sql`'{}'`),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertServiceReviewSchema = createInsertSchema(serviceReviews).omit({ id: true, createdAt: true });
export type InsertServiceReview = z.infer<typeof insertServiceReviewSchema>;
export type ServiceReview = typeof serviceReviews.$inferSelect;

/* ═══════════════════════════════════════════════════════════════════
   SIEM CORRELATION RULES  (ITIL 4 — Event Management Practice)
   ═══════════════════════════════════════════════════════════════════ */
// ── FORENSICS ─────────────────────────────────────────────────────────────────

export const forensicCases = pgTable("forensic_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: varchar("case_number", { length: 30 }).notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  status: text("status").notNull().default("open"),         // open | active | escalated | legal_hold | closed
  priority: text("priority").notNull().default("medium"),   // critical | high | medium | low
  domain: text("domain").notNull().default("digital"),      // digital | physical | hr_insider | financial | legal
  assignedTo: text("assigned_to"),
  legalHold: boolean("legal_hold").notNull().default(false),
  escalatedTo: text("escalated_to"),                        // legal | hr | law_enforcement | management
  linkedIncidentId: varchar("linked_incident_id"),
  linkedAssetId: varchar("linked_asset_id"),
  linkedSupplierId: varchar("linked_supplier_id"),
  linkedSecurityEventIds: text("linked_security_event_ids").array().default(sql`'{}'::text[]`),
  linkedUserIds: text("linked_user_ids").array().default(sql`'{}'::text[]`),
  linkedContractId: varchar("linked_contract_id"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertForensicCaseSchema = createInsertSchema(forensicCases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertForensicCase = z.infer<typeof insertForensicCaseSchema>;
export type ForensicCase = typeof forensicCases.$inferSelect;

export const forensicEvidence = pgTable("forensic_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  domain: text("domain").notNull().default("digital"),      // digital | physical | hr_insider | financial | legal
  evidenceType: text("evidence_type").notNull(),             // log_file | screenshot | memory_dump | cctv_clip | badge_record | transaction | email | document | testimony | hash_verify
  source: text("source").notNull(),                         // system/tool that produced the evidence
  filePath: text("file_path"),
  fileHash: text("file_hash"),                              // SHA-256 for chain of custody
  fileSize: text("file_size"),
  custodian: text("custodian"),                             // person responsible for chain of custody
  admissible: boolean("admissible").notNull().default(true),
  collectedAt: timestamp("collected_at").defaultNow(),
  collectedBy: text("collected_by"),
  notes: text("notes"),
  linkedObjectType: text("linked_object_type"),             // incident | security_event | asset | user | contract
  linkedObjectId: varchar("linked_object_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertForensicEvidenceSchema = createInsertSchema(forensicEvidence).omit({ id: true, createdAt: true });
export type InsertForensicEvidence = z.infer<typeof insertForensicEvidenceSchema>;
export type ForensicEvidence = typeof forensicEvidence.$inferSelect;

export const forensicTimeline = pgTable("forensic_timeline", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").notNull(),
  eventTime: timestamp("event_time").notNull(),
  domain: text("domain").notNull().default("digital"),
  actor: text("actor"),                                     // user / system / unknown
  action: text("action").notNull(),
  target: text("target"),
  outcome: text("outcome"),                                 // success | failure | unknown | blocked
  ipAddress: text("ip_address"),
  location: text("location"),
  evidenceId: varchar("evidence_id"),
  isMilestone: boolean("is_milestone").notNull().default(false),
  mitre: varchar("mitre", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertForensicTimelineSchema = createInsertSchema(forensicTimeline).omit({ id: true, createdAt: true });
export type InsertForensicTimeline = z.infer<typeof insertForensicTimelineSchema>;
export type ForensicTimeline = typeof forensicTimeline.$inferSelect;

export const forensicIndicators = pgTable("forensic_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull(),                         // digital | physical | hr_insider | financial | legal
  name: text("name").notNull(),
  description: text("description"),
  signal: text("signal").notNull(),                         // what pattern/metric to watch
  threshold: text("threshold"),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("monitoring"),   // monitoring | triggered | case_opened | suppressed
  lastTriggered: timestamp("last_triggered"),
  caseId: varchar("case_id"),                               // if already escalated to a case
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertForensicIndicatorSchema = createInsertSchema(forensicIndicators).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertForensicIndicator = z.infer<typeof insertForensicIndicatorSchema>;
export type ForensicIndicator = typeof forensicIndicators.$inferSelect;

// ── SIEM ──────────────────────────────────────────────────────────────────────

export const siemCorrelationRules = pgTable("siem_correlation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id", { length: 20 }).notNull().unique(),
  name: text("name").notNull(),
  mitre: varchar("mitre", { length: 20 }).notNull(),
  itilType: text("itil_type").notNull().default("Warning"),
  status: text("status").notNull().default("Active"),
  hitCount: integer("hit_count").notNull().default(0),
  lastTuned: text("last_tuned"),
  description: text("description"),
  eventTypes: text("event_types").array().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertSiemCorrelationRuleSchema = createInsertSchema(siemCorrelationRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSiemCorrelationRule = z.infer<typeof insertSiemCorrelationRuleSchema>;
export type SiemCorrelationRule = typeof siemCorrelationRules.$inferSelect;

// ── HOLOCRON CONCLAVE ─────────────────────────────────────────────────────────
export const conclaves = pgTable("conclaves", {
  id:                 serial("id").primaryKey(),
  userId:             varchar("user_id", { length: 255 }),
  title:              varchar("title", { length: 255 }).notNull(),
  topic:              text("topic").notNull(),
  context:            text("context"),
  domain:             varchar("domain", { length: 100 }).default("general"), // itsm | security | infrastructure | general
  status:             varchar("status", { length: 30 }).notNull().default("open"), // open | deliberating | consensus | executing | evaluated | closed
  roundCount:         integer("round_count").notNull().default(0),
  maxRounds:          integer("max_rounds").notNull().default(2),
  consensusDecision:  text("consensus_decision"),
  consensusScore:     integer("consensus_score"),   // 0-100 avg agreement
  executionResult:    text("execution_result"),
  evaluationResult:   text("evaluation_result"),
  evaluationScore:    integer("evaluation_score"),  // 0-100 outcome quality
  triggerNewConclave: boolean("trigger_new_conclave").default(false),
  createdAt:          timestamp("created_at").defaultNow(),
  updatedAt:          timestamp("updated_at").defaultNow(),
});
export const insertConclaveSchema = createInsertSchema(conclaves).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConclave = z.infer<typeof insertConclaveSchema>;
export type Conclave = typeof conclaves.$inferSelect;

export const conclaveMessages = pgTable("conclave_messages", {
  id:             serial("id").primaryKey(),
  conclaveId:     integer("conclave_id").references(() => conclaves.id, { onDelete: "cascade" }).notNull(),
  round:          integer("round").notNull(),         // 1 = initial, 2 = challenge, 0 = consensus
  agentRole:      varchar("agent_role", { length: 50 }).notNull(), // advocate | critic | risk | pragmatist | ethicist | synthesizer
  agentName:      varchar("agent_name", { length: 100 }).notNull(),
  content:        text("content").notNull(),
  stance:         varchar("stance", { length: 30 }),  // support | challenge | neutral | synthesize | mixed
  keyPoints:      text("key_points").array().default(sql`'{}'::text[]`),
  agreementScore: integer("agreement_score"),          // 0-100
  model:          varchar("model", { length: 100 }),
  providerName:   varchar("provider_name", { length: 100 }),
  latencyMs:      integer("latency_ms").default(0),
  createdAt:      timestamp("created_at").defaultNow(),
});
export const insertConclaveMessageSchema = createInsertSchema(conclaveMessages).omit({ id: true, createdAt: true });
export type InsertConclaveMessage = z.infer<typeof insertConclaveMessageSchema>;
export type ConclaveMessage = typeof conclaveMessages.$inferSelect;

// ── AI OBSERVABILITY & GOVERNANCE ─────────────────────────────────────────────
export const aiAuditLogs = pgTable("ai_audit_logs", {
  id:                      serial("id").primaryKey(),
  userId:                  varchar("user_id", { length: 255 }),
  module:                  varchar("module", { length: 100 }).notNull().default("unknown"),
  endpoint:                varchar("endpoint", { length: 255 }),
  model:                   varchar("model", { length: 100 }),
  providerName:            varchar("provider_name", { length: 100 }),
  promptTokens:            integer("prompt_tokens").default(0),
  completionTokens:        integer("completion_tokens").default(0),
  totalTokens:             integer("total_tokens").default(0),
  latencyMs:               integer("latency_ms").default(0),
  schemaValid:             boolean("schema_valid").default(true),
  hallucinationRisk:       varchar("hallucination_risk", { length: 20 }).default("none"),
  hallucinationFlags:      text("hallucination_flags").array().default(sql`'{}'::text[]`),
  promptInjectionDetected: boolean("prompt_injection_detected").default(false),
  riskFlags:               text("risk_flags").array().default(sql`'{}'::text[]`),
  inputSummary:            text("input_summary"),
  outputSummary:           text("output_summary"),
  responseSchemaErrors:    text("response_schema_errors").array().default(sql`'{}'::text[]`),
  status:                  varchar("status", { length: 30 }).default("success"),
  requiresHumanReview:     boolean("requires_human_review").default(false),
  humanReviewStatus:       varchar("human_review_status", { length: 20 }),
  humanReviewedBy:         varchar("human_reviewed_by", { length: 255 }),
  humanReviewedAt:         timestamp("human_reviewed_at"),
  driftScore:              integer("drift_score").default(0),
  qualityReviewStatus:     varchar("quality_review_status", { length: 20 }).default("none"),
  qualityReviewResult:     text("quality_review_result"),
  qualityReviewScore:      integer("quality_review_score"),
  qualityReviewFlags:      text("quality_review_flags").array().default(sql`'{}'::text[]`),
  createdAt:               timestamp("created_at").defaultNow(),
});
export const insertAiAuditLogSchema = createInsertSchema(aiAuditLogs).omit({ id: true, createdAt: true });
export type InsertAiAuditLog = z.infer<typeof insertAiAuditLogSchema>;
export type AiAuditLog = typeof aiAuditLogs.$inferSelect;

// ── AI Context Store (RAG layer for hallucination reduction) ──────────────────
// Holds curated, high-quality AI interactions promoted from the audit log.
// These entries are injected as few-shot context into future calls on the same module.
export const aiContextEntries = pgTable("ai_context_entries", {
  id:                       serial("id").primaryKey(),
  userId:                   varchar("user_id", { length: 255 }),
  module:                   varchar("module", { length: 100 }).notNull(),
  endpoint:                 varchar("endpoint", { length: 255 }),
  model:                    varchar("model", { length: 100 }),
  systemPrompt:             text("system_prompt"),
  userMessage:              text("user_message"),
  assistantResponse:        text("assistant_response").notNull(),
  qualityScore:             integer("quality_score").default(0),
  hallucinationRisk:        varchar("hallucination_risk", { length: 20 }).default("none"),
  approvedForInjection:     boolean("approved_for_injection").default(false),
  injectionCount:           integer("injection_count").default(0),
  isDriftBaseline:          boolean("is_drift_baseline").default(false),
  tags:                     text("tags").array().default(sql`'{}'::text[]`),
  sourceLogId:              integer("source_log_id"),
  excludedFromFinetune:     boolean("excluded_from_finetune").notNull().default(false),
  finetuneUserMessage:      text("finetune_user_message"),
  finetuneAssistantResponse: text("finetune_assistant_response"),
  createdAt:                timestamp("created_at").defaultNow(),
});
export const insertAiContextEntrySchema = createInsertSchema(aiContextEntries).omit({ id: true, createdAt: true });
export type InsertAiContextEntry = z.infer<typeof insertAiContextEntrySchema>;
export type AiContextEntry = typeof aiContextEntries.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════════
// ── FLYGUYS PLATFORM ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Drone operators (owners who fulfill jobs)
export const flyguysOperators = pgTable("flyguys_operators", {
  id:               varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name:             varchar("name", { length: 255 }).notNull(),
  email:            varchar("email", { length: 255 }).notNull(),
  phone:            varchar("phone", { length: 50 }),
  companyName:      varchar("company_name", { length: 255 }),
  status:           varchar("status", { length: 50 }).notNull().default("pending"),  // pending | approved | suspended
  certifications:   text("certifications").array().default(sql`'{}'::text[]`),
  coveredRegions:   text("covered_regions").array().default(sql`'{}'::text[]`),
  rating:           integer("rating").default(0),          // 0-5 stars x10 (stored as int, div10 for display)
  completedJobs:    integer("completed_jobs").default(0),
  notes:            text("notes"),
  userId:           varchar("user_id", { length: 255 }),
  createdAt:        timestamp("created_at").defaultNow(),
});
export const insertFlyguysOperatorSchema = createInsertSchema(flyguysOperators).omit({ id: true, createdAt: true });
export type InsertFlyguysOperator = z.infer<typeof insertFlyguysOperatorSchema>;
export type FlyguysOperator = typeof flyguysOperators.$inferSelect;

// Drone asset registry (owned by operators)
export const flyguysFleet = pgTable("flyguys_fleet", {
  id:                  varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  operatorId:          varchar("operator_id", { length: 255 }).notNull(),
  make:                varchar("make", { length: 100 }).notNull(),
  model:               varchar("model", { length: 100 }).notNull(),
  droneType:           varchar("drone_type", { length: 100 }).notNull(),  // mapping | inspection | photography | delivery | surveillance
  registrationNumber:  varchar("registration_number", { length: 100 }),
  maxFlightTimeMin:    integer("max_flight_time_min"),
  maxRangeKm:          integer("max_range_km"),
  cameraResolution:    varchar("camera_resolution", { length: 100 }),
  payloadCapacityKg:   integer("payload_capacity_kg"),
  status:              varchar("status", { length: 50 }).default("available"),  // available | in-mission | maintenance
  probeId:             varchar("probe_id", { length: 255 }),            // linked HOLOCRON probe
  cmdbItemId:          varchar("cmdb_item_id", { length: 255 }),        // auto-registered CMDB asset
  probeLinkedAt:       timestamp("probe_linked_at"),
  userId:              varchar("user_id", { length: 255 }),
  createdAt:           timestamp("created_at").defaultNow(),
});
export const insertFlyguysFleetSchema = createInsertSchema(flyguysFleet).omit({ id: true, createdAt: true });
export type InsertFlyguysFleet = z.infer<typeof insertFlyguysFleetSchema>;
export type FlyguysFleet = typeof flyguysFleet.$inferSelect;

// Customer service requests
export const flyguysRequests = pgTable("flyguys_requests", {
  id:              varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerName:    varchar("customer_name", { length: 255 }).notNull(),
  customerEmail:   varchar("customer_email", { length: 255 }).notNull(),
  customerPhone:   varchar("customer_phone", { length: 50 }),
  customerCompany: varchar("customer_company", { length: 255 }),
  title:           varchar("title", { length: 500 }).notNull(),
  serviceType:     varchar("service_type", { length: 100 }).notNull(),   // mapping | inspection | photography | delivery | surveillance | other
  location:        varchar("location", { length: 500 }).notNull(),
  description:     text("description"),
  budgetUsd:       integer("budget_usd"),
  preferredDate:   varchar("preferred_date", { length: 100 }),
  status:              varchar("status", { length: 50 }).notNull().default("open"),  // open | under-review | published | claimed | in-progress | delivered | cancelled
  origin:              varchar("origin", { length: 50 }).default("staff"),   // staff | portal
  adjustedAmountUsd:   integer("adjusted_amount_usd"),     // Flyguys-negotiated amount shown to operators
  flyguysNotes:        text("flyguys_notes"),               // Internal review/negotiation notes
  documentUrls:        text("document_urls").array().default(sql`'{}'::text[]`),  // customer-uploaded docs
  requiredDroneType:      varchar("required_drone_type", { length: 100 }),  // drone type needed for task
  locationLat:            doublePrecision("location_lat"),
  locationLng:            doublePrecision("location_lng"),
  aiDroneRecommendation:  text("ai_drone_recommendation"),  // JSON: { recommendedDroneType, reasoning, confidence, shortlistedOperatorIds, operatorReasons }
  splitType:              varchar("split_type", { length: 20 }).default("single"),  // "single" | "multi"
  maxOperators:           integer("max_operators").default(1),  // how many operators share this request (multi only)
  claimedCount:           integer("claimed_count").default(0),  // how many operators have claimed so far
  assignedOperatorIds:    text("assigned_operator_ids").array().default(sql`'{}'::text[]`),  // hand-picked operators for multi-split
  userId:              varchar("user_id", { length: 255 }),
  createdAt:           timestamp("created_at").defaultNow(),
});
export const insertFlyguysRequestSchema = createInsertSchema(flyguysRequests).omit({ id: true, createdAt: true });
export type InsertFlyguysRequest = z.infer<typeof insertFlyguysRequestSchema>;
export type FlyguysRequest = typeof flyguysRequests.$inferSelect;

// Operator bids on customer requests
export const flyguaysBids = pgTable("flyguys_bids", {
  id:           varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId:    varchar("request_id", { length: 255 }).notNull(),
  operatorId:   varchar("operator_id", { length: 255 }).notNull(),
  amountUsd:    integer("amount_usd").notNull(),
  timeline:     varchar("timeline", { length: 200 }),
  droneId:      varchar("drone_id", { length: 255 }),
  notes:        text("notes"),
  status:       varchar("status", { length: 50 }).notNull().default("pending"),  // pending | accepted | rejected
  userId:       varchar("user_id", { length: 255 }),
  createdAt:    timestamp("created_at").defaultNow(),
});
export const insertFlyguaysBidSchema = createInsertSchema(flyguaysBids).omit({ id: true, createdAt: true });
export type InsertFlyguaysBid = z.infer<typeof insertFlyguaysBidSchema>;
export type FlyguaysBid = typeof flyguaysBids.$inferSelect;

// Awarded projects (from accepted bid)
export const flyguysProjects = pgTable("flyguys_projects", {
  id:               varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId:        varchar("request_id", { length: 255 }),
  bidId:            varchar("bid_id", { length: 255 }),
  operatorId:       varchar("operator_id", { length: 255 }),
  title:            varchar("title", { length: 500 }).notNull(),
  customerName:     varchar("customer_name", { length: 255 }),
  serviceType:      varchar("service_type", { length: 100 }),
  location:         varchar("location", { length: 500 }),
  status:           varchar("status", { length: 50 }).notNull().default("active"),  // active | in-progress | delivered | completed | cancelled
  projectValueUsd:  integer("project_value_usd"),
  commissionPct:    integer("commission_pct").notNull().default(15),
  commissionUsd:    integer("commission_usd"),
  startDate:        varchar("start_date", { length: 100 }),
  dueDate:          varchar("due_date", { length: 100 }),
  deliveredAt:      timestamp("delivered_at"),
  deliveryNotes:    text("delivery_notes"),
  probeLinked:      boolean("probe_linked").default(false),
  userId:           varchar("user_id", { length: 255 }),
  createdAt:        timestamp("created_at").defaultNow(),
  // Mission tracker / drone itinerary fields
  waypointsJson:    text("waypoints_json"),           // JSON: [{lat,lng,label,order}]
  currentLat:       doublePrecision("current_lat"),
  currentLng:       doublePrecision("current_lng"),
  currentHeading:   doublePrecision("current_heading").default(0),
  routeAlerts:      text("route_alerts").array().default(sql`ARRAY[]::TEXT[]`),
  trackingActive:   boolean("tracking_active").default(false),
  lastPositionAt:   timestamp("last_position_at"),
});
export const insertFlyguysProjectSchema = createInsertSchema(flyguysProjects).omit({ id: true, createdAt: true });
export type InsertFlyguysProject = z.infer<typeof insertFlyguysProjectSchema>;
export type FlyguysProject = typeof flyguysProjects.$inferSelect;

// Deliverables / artifacts per project (videos, images, reports)
export const flyguysDeliverables = pgTable("flyguys_deliverables", {
  id:          varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId:   varchar("project_id", { length: 255 }).notNull(),
  fileName:    varchar("file_name", { length: 500 }).notNull(),
  fileType:    varchar("file_type", { length: 100 }).notNull(),   // video | image | report | raw-data
  fileSizeMb:  integer("file_size_mb"),
  fileUrl:     varchar("file_url", { length: 1000 }),
  description: text("description"),
  probeId:     varchar("probe_id", { length: 255 }),
  userId:      varchar("user_id", { length: 255 }),
  uploadedAt:  timestamp("uploaded_at").defaultNow(),
});
export const insertFlyguysDeliverableSchema = createInsertSchema(flyguysDeliverables).omit({ id: true, uploadedAt: true });
export type InsertFlyguysDeliverable = z.infer<typeof insertFlyguysDeliverableSchema>;
export type FlyguysDeliverable = typeof flyguysDeliverables.$inferSelect;

// Financial transactions and commission ledger
export const flyguysTransactions = pgTable("flyguys_transactions", {
  id:            varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId:     varchar("project_id", { length: 255 }),
  type:          varchar("type", { length: 100 }).notNull(),   // customer-payment | operator-payout | commission-credit | refund
  amountUsd:     integer("amount_usd").notNull(),
  status:        varchar("status", { length: 50 }).notNull().default("pending"),  // pending | completed | failed
  description:   text("description"),
  reference:     varchar("reference", { length: 255 }),
  userId:        varchar("user_id", { length: 255 }),
  createdAt:     timestamp("created_at").defaultNow(),
});
export const insertFlyguysTransactionSchema = createInsertSchema(flyguysTransactions).omit({ id: true, createdAt: true });
export type InsertFlyguysTransaction = z.infer<typeof insertFlyguysTransactionSchema>;
export type FlyguysTransaction = typeof flyguysTransactions.$inferSelect;

// ============================================================
// AI KNOWLEDGE BASE — PGVector Semantic RAG Documents
// ============================================================
import { customType } from "drizzle-orm/pg-core";

export const vector1536 = customType<{ data: number[] }>({
  dataType() { return "vector(1536)"; },
  toDriver(value: number[]) { return `[${value.join(",")}]`; },
  fromDriver(value: any) {
    if (typeof value === "string") return value.slice(1, -1).split(",").map(Number);
    return value as number[];
  },
});

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  title: varchar("title", { length: 500 }).notNull(),
  sourceType: varchar("source_type", { length: 50 }).notNull().default("text"),
  description: text("description"),
  chunkCount: integer("chunk_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({ id: true, createdAt: true, chunkCount: true });
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;

export const documentChunks = pgTable("document_chunks", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector1536("embedding"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type DocumentChunk = typeof documentChunks.$inferSelect;
