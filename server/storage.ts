import {
  type User, type InsertUser,
  type AiAgent, type InsertAiAgent,
  type Incident, type InsertIncident,
  type ServiceRequest, type InsertServiceRequest,
  type SecurityEvent, type InsertSecurityEvent,
  type Problem, type InsertProblem,
  type ChangeRequest, type InsertChangeRequest,
  type ServiceCatalogItem, type InsertServiceCatalogItem,
  type KnowledgeArticle, type InsertKnowledgeArticle,
  type SlaDefinition, type InsertSlaDefinition,
  type CmdbItem, type InsertCmdbItem,
  type CmdbRelationship, type InsertCmdbRelationship,
  type Connector, type InsertConnector,
  type Playbook, type InsertPlaybook,
  type PlaybookExecution, type InsertPlaybookExecution,
  type TelemetryMetric, type InsertTelemetryMetric,
  type AgentActivity, type InsertAgentActivity,
  type ChatMessage, type InsertChatMessage,
  type OrgRole, type InsertOrgRole,
  type RoleSubscription, type InsertRoleSubscription,
  type Recommendation, type InsertRecommendation,
  type Crew, type InsertCrew,
  type AgentTask, type InsertAgentTask,
  type AgentWorkflow, type InsertAgentWorkflow,
  type Committee, type InsertCommittee,
  type WorkflowStage, type InsertWorkflowStage,
  type NetworkDevice, type InsertNetworkDevice,
  type DeviceMetric, type InsertDeviceMetric,
  type AgentAlert, type InsertAgentAlert,
  type AgentKpi, type InsertAgentKpi,
  type DiscoveryCredential, type InsertDiscoveryCredential,
  type DiscoveryProbe, type InsertDiscoveryProbe,
  type ProbeType, type InsertProbeType,
  type DiscoveredAsset, type InsertDiscoveredAsset,
  type AgentPerformanceMetric, type InsertAgentPerformanceMetric,
  type AgentConversation, type InsertAgentConversation,
  type AgentMessage, type InsertAgentMessage,
  type AgentNotification, type InsertAgentNotification,
  type UserManagedAgent, type InsertUserManagedAgent,
  type ThresholdCalibration, type InsertThresholdCalibration,
  type MonitoredApplication, type InsertMonitoredApplication,
  type ApplicationTopology, type InsertApplicationTopology,
  type RemediationTask, type InsertRemediationTask,
  type ServiceMetric, type InsertServiceMetric,
  type ServiceMetricAssignment, type InsertServiceMetricAssignment,
  type MissionCriticalGroup, type InsertMissionCriticalGroup,
  type AgentMetricProfile, type InsertAgentMetricProfile,
  type AgentOperationalInsights, type InsertAgentOperationalInsights,
  type AgentScheduledActivity, type InsertAgentScheduledActivity,
  type AiTemplateCache, type InsertAiTemplateCache,
  type AiProvider, type InsertAiProvider,
  type ProbeClusterNode, type InsertProbeClusterNode,
  type ProbeCredentialLink,
  type BcpPlan, type InsertBcpPlan,
  type DrpPlan, type InsertDrpPlan,
  type BiaEntry, type InsertBiaEntry,
  type RiskAssessment, type InsertRiskAssessment,
  type Drill, type InsertDrill,
  type Review, type InsertReview,
  type ProbeActivityLog, type InsertProbeActivityLog,
  type KnownError, type InsertKnownError,
  type SlaBreach, type InsertSlaBreach,
  type CsiRegisterItem, type InsertCsiRegister,
  type Release, type InsertRelease,
  type ReleaseItem, type InsertReleaseItem,
  type ServiceReading, type InsertServiceReading,
  type CapacityThreshold, type InsertCapacityThreshold,
  type CapacityAction, type InsertCapacityAction,
  type CapacityDemandEvent, type InsertCapacityDemandEvent,
  type LogSource, type InsertLogSource,
  type LogEntry, type InsertLogEntry,
  type LogRetentionPolicy, type InsertLogRetentionPolicy,
  type MdmDevice, type InsertMdmDevice,
  type MdmPolicy, type InsertMdmPolicy,
  type MdmEnrollmentToken, type InsertMdmEnrollmentToken,
  type MdmAction, type InsertMdmAction,
  users, aiAgents, incidents, serviceRequests, securityEvents,
  problems, changeRequests, serviceCatalogItems, knowledgeArticles,
  slaDefinitions, cmdbItems, cmdbRelationships,
  infrastructureConnectors, automationPlaybooks, playbookExecutions,
  telemetryMetrics, agentActivities, chatMessages,
  orgRoles, roleSubscriptions, recommendations,
  crews, agentTasks, agentWorkflows, committees, workflowStages,
  networkDevices, deviceMetrics, agentAlerts, agentKpis,
  discoveryCredentials, discoveryProbes, probeTypes, discoveredAssets,
  agentPerformanceMetrics, agentConversations, agentMessages,
  agentNotifications,
  userManagedAgents,
  thresholdCalibrations,
  monitoredApplications,
  applicationTopologies,
  remediationTasks,
  serviceMetrics,
  serviceMetricAssignments,
  missionCriticalGroups,
  agentMetricProfiles,
  agentOperationalInsights,
  agentScheduledActivities,
  aiTemplateCache,
  aiProviders,
  probeClusterNodes,
  probeCredentialLinks,
  bcpPlans,
  drpPlans,
  bcpBiaEntries,
  bcpRiskAssessments,
  bcpDrills,
  bcpReviews,
  probeActivityLogs,
  knownErrors,
  slaBreaches,
  csiRegister,
  releases,
  releaseItems,
  serviceReadings,
  capacityThresholds,
  capacityActions,
  capacityDemandEvents,
  logSources,
  logEntries,
  logRetentionPolicies,
  mdmDevices,
  mdmPolicies,
  mdmEnrollmentTokens,
  mdmActions,
  commandCatalog,
  type InsertCommandCatalog,
  type CommandCatalogEntry,
  commandSchedules,
  type InsertCommandSchedule,
  type CommandSchedule,
  commandApprovals,
  type InsertCommandApproval,
  type CommandApproval,
  type RemediationTask,
  patches,
  type Patch,
  type InsertPatch,
  patchJobs,
  type PatchJob,
  type InsertPatchJob,
  validationProviders,
  type ValidationProvider,
  type InsertValidationProvider,
  validationEnvironments,
  type ValidationEnvironment,
  type InsertValidationEnvironment,
  validationVirtualAssets,
  type ValidationVirtualAsset,
  type InsertValidationVirtualAsset,
  validationProbeDeployments,
  type ValidationProbeDeployment,
  type InsertValidationProbeDeployment,
  validationTests,
  type ValidationTest,
  type InsertValidationTest,
  validationTestRuns,
  type ValidationTestRun,
  type InsertValidationTestRun,
  validationReports,
  type ValidationReport,
  type InsertValidationReport,
  validationProbeConfigs,
  type ValidationProbeConfig,
  type InsertValidationProbeConfig,
  configRfcs,
  type ConfigRfc,
  type InsertConfigRfc,
  configBaselines,
  type ConfigBaseline,
  type InsertConfigBaseline,
  serviceFinancials,
  type ServiceFinancial,
  type InsertServiceFinancial,
  suppliers,
  type Supplier,
  type InsertSupplier,
  supplierContracts,
  type SupplierContract,
  type InsertSupplierContract,
  deployments,
  type Deployment,
  type InsertDeployment,
  stakeholders,
  type Stakeholder,
  type InsertStakeholder,
  serviceReviews,
  type ServiceReview,
  type InsertServiceReview,
  siemCorrelationRules,
  type SiemCorrelationRule,
  securityEvents,
  forensicCases,
  type ForensicCase,
  type InsertForensicCase,
  forensicEvidence,
  type ForensicEvidence,
  type InsertForensicEvidence,
  forensicTimeline,
  type ForensicTimeline,
  type InsertForensicTimeline,
  forensicIndicators,
  type ForensicIndicator,
  type InsertForensicIndicator,
  aiAuditLogs,
  type AiAuditLog,
  type InsertAiAuditLog,
  conclaves,
  type Conclave,
  type InsertConclave,
  conclaveMessages,
  type ConclaveMessage,
  type InsertConclaveMessage,
  flyguysOperators,
  type FlyguysOperator,
  type InsertFlyguysOperator,
  flyguysFleet,
  type FlyguysFleet,
  type InsertFlyguysFleet,
  flyguysRequests,
  type FlyguysRequest,
  type InsertFlyguysRequest,
  flyguaysBids,
  type FlyguaysBid,
  type InsertFlyguaysBid,
  flyguysProjects,
  type FlyguysProject,
  type InsertFlyguysProject,
  flyguysDeliverables,
  type FlyguysDeliverable,
  type InsertFlyguysDeliverable,
  flyguysTransactions,
  type FlyguysTransaction,
  type InsertFlyguysTransaction,
  knowledgeDocuments,
  type KnowledgeDocument,
  type InsertKnowledgeDocument,
  documentChunks,
  type DocumentChunk,
  probeMediaFiles,
  type ProbeMediaFile,
  type InsertProbeMediaFile,
  aiContextEntries,
  type AiContextEntry,
  type InsertAiContextEntry,
} from "@shared/schema";
import { eq, and, desc, gt, lt, sql, ilike, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
export { db };

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserCountry(userId: string, country: string): Promise<void>;
  completeOnboarding(userId: string): Promise<void>;
  completeTour(userId: string): Promise<void>;
  getModulePreferences(userId: string): Promise<Record<string, boolean>>;
  updateModulePreferences(userId: string, prefs: Record<string, boolean>): Promise<void>;

  getRecommendationsByUser(userId: string): Promise<Recommendation[]>;
  getRecommendation(id: string): Promise<Recommendation | undefined>;
  createRecommendation(rec: InsertRecommendation): Promise<Recommendation>;
  updateRecommendation(id: string, updates: Partial<Recommendation>): Promise<Recommendation | undefined>;

  getAgents(): Promise<AiAgent[]>;
  getAgent(id: string): Promise<AiAgent | undefined>;
  createAgent(agent: InsertAiAgent): Promise<AiAgent>;
  updateAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined>;

  getIncidents(): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | undefined>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined>;

  getServiceRequests(): Promise<ServiceRequest[]>;
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  createServiceRequest(sr: InsertServiceRequest): Promise<ServiceRequest>;
  updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined>;

  getSecurityEvents(): Promise<SecurityEvent[]>;
  createSecurityEvent(event: InsertSecurityEvent): Promise<SecurityEvent>;

  getProblems(): Promise<Problem[]>;
  getProblem(id: string): Promise<Problem | undefined>;
  createProblem(problem: InsertProblem): Promise<Problem>;
  updateProblem(id: string, updates: Partial<Problem>): Promise<Problem | undefined>;

  getChangeRequests(): Promise<ChangeRequest[]>;
  getChangeRequest(id: string): Promise<ChangeRequest | undefined>;
  createChangeRequest(cr: InsertChangeRequest): Promise<ChangeRequest>;
  updateChangeRequest(id: string, updates: Partial<ChangeRequest>): Promise<ChangeRequest | undefined>;

  getServiceCatalogItems(): Promise<ServiceCatalogItem[]>;
  getServiceCatalogItem(id: string): Promise<ServiceCatalogItem | undefined>;
  createServiceCatalogItem(item: InsertServiceCatalogItem): Promise<ServiceCatalogItem>;

  getKnowledgeArticles(): Promise<KnowledgeArticle[]>;
  getKnowledgeArticle(id: string): Promise<KnowledgeArticle | undefined>;
  searchKnowledgeArticles(query: string): Promise<KnowledgeArticle[]>;
  getKnowledgeArticleByTag(tag: string): Promise<KnowledgeArticle | undefined>;
  createKnowledgeArticle(article: InsertKnowledgeArticle): Promise<KnowledgeArticle>;
  updateKnowledgeArticle(id: string, updates: Partial<KnowledgeArticle>): Promise<KnowledgeArticle | undefined>;
  deleteKnowledgeArticle(id: string): Promise<void>;

  getSlaDefinitions(): Promise<SlaDefinition[]>;
  createSlaDefinition(sla: InsertSlaDefinition): Promise<SlaDefinition>;
  updateSlaDefinition(id: string, updates: Partial<SlaDefinition>): Promise<SlaDefinition | undefined>;
  deleteSlaDefinition(id: string): Promise<void>;

  getCmdbItems(): Promise<CmdbItem[]>;
  getCmdbItem(id: string): Promise<CmdbItem | undefined>;
  createCmdbItem(item: InsertCmdbItem): Promise<CmdbItem>;
  updateCmdbItem(id: string, updates: Partial<CmdbItem>): Promise<CmdbItem | undefined>;

  getCmdbRelationships(): Promise<CmdbRelationship[]>;
  createCmdbRelationship(rel: InsertCmdbRelationship): Promise<CmdbRelationship>;

  getConnectors(): Promise<Connector[]>;
  getConnector(id: string): Promise<Connector | undefined>;
  createConnector(connector: InsertConnector): Promise<Connector>;
  updateConnector(id: string, updates: Partial<Connector>): Promise<Connector | undefined>;

  getPlaybooks(): Promise<Playbook[]>;
  getPlaybook(id: string): Promise<Playbook | undefined>;
  createPlaybook(playbook: InsertPlaybook): Promise<Playbook>;
  updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined>;

  getPlaybookExecutions(): Promise<PlaybookExecution[]>;
  createPlaybookExecution(exec: InsertPlaybookExecution): Promise<PlaybookExecution>;
  updatePlaybookExecution(id: string, updates: Partial<PlaybookExecution>): Promise<PlaybookExecution | undefined>;

  getTelemetryMetrics(limit?: number): Promise<TelemetryMetric[]>;
  createTelemetryMetric(metric: InsertTelemetryMetric): Promise<TelemetryMetric>;
  getTelemetryBySource(sourceId: string): Promise<TelemetryMetric[]>;

  getAgentActivities(limit?: number): Promise<AgentActivity[]>;
  getAutonomousActivities(limit?: number): Promise<AgentActivity[]>;
  createAgentActivity(activity: InsertAgentActivity): Promise<AgentActivity>;

  getChatMessages(limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  getOrgRoles(): Promise<OrgRole[]>;
  getOrgRole(id: string): Promise<OrgRole | undefined>;
  createOrgRole(role: InsertOrgRole): Promise<OrgRole>;
  updateOrgRole(id: string, updates: Partial<OrgRole>): Promise<OrgRole | undefined>;
  getOrgRolesByDepartment(department: string): Promise<OrgRole[]>;

  getRoleSubscriptions(): Promise<RoleSubscription[]>;
  getRoleSubscriptionsByUser(userId: string): Promise<RoleSubscription[]>;
  getRoleSubscription(id: string): Promise<RoleSubscription | undefined>;
  createRoleSubscription(sub: InsertRoleSubscription): Promise<RoleSubscription>;
  updateRoleSubscription(id: string, updates: Partial<RoleSubscription>): Promise<RoleSubscription | undefined>;
  deleteRoleSubscription(id: string): Promise<boolean>;
  getSubscriptionByRoleId(roleId: string): Promise<RoleSubscription | undefined>;
  getSubscriptionByRoleIdAndUser(roleId: string, userId: string): Promise<RoleSubscription | undefined>;

  getCrews(userId: string): Promise<Crew[]>;
  getCrew(id: string): Promise<Crew | undefined>;
  createCrew(crew: InsertCrew): Promise<Crew>;

  getAgentTasks(userId: string): Promise<AgentTask[]>;
  getAgentTask(id: string): Promise<AgentTask | undefined>;
  createAgentTask(task: InsertAgentTask): Promise<AgentTask>;

  getWorkflows(userId: string): Promise<AgentWorkflow[]>;
  getWorkflow(id: string): Promise<AgentWorkflow | undefined>;
  createWorkflow(workflow: InsertAgentWorkflow): Promise<AgentWorkflow>;
  updateWorkflow(id: string, updates: Partial<AgentWorkflow>): Promise<AgentWorkflow | undefined>;

  getCommittees(userId: string): Promise<Committee[]>;
  getCommittee(id: string): Promise<Committee | undefined>;
  createCommittee(committee: InsertCommittee): Promise<Committee>;
  updateCommittee(id: string, updates: Partial<Committee>): Promise<Committee | undefined>;

  getWorkflowStages(workflowId: string): Promise<WorkflowStage[]>;
  getWorkflowStage(id: string): Promise<WorkflowStage | undefined>;
  createWorkflowStage(stage: InsertWorkflowStage): Promise<WorkflowStage>;
  updateWorkflowStage(id: string, updates: Partial<WorkflowStage>): Promise<WorkflowStage | undefined>;

  getNetworkDevices(userId: string): Promise<NetworkDevice[]>;
  createNetworkDevice(device: InsertNetworkDevice): Promise<NetworkDevice>;
  getDeviceMetrics(userId: string, deviceId?: string): Promise<DeviceMetric[]>;
  createDeviceMetric(metric: InsertDeviceMetric): Promise<DeviceMetric>;
  updateDeviceMetricThresholds(metricId: string, thresholdWarning: number | null, thresholdCritical: number | null): Promise<DeviceMetric | undefined>;
  getAgentAlerts(userId: string): Promise<AgentAlert[]>;
  createAgentAlert(alert: InsertAgentAlert): Promise<AgentAlert>;
  updateAgentAlert(id: string, updates: Partial<AgentAlert>): Promise<AgentAlert | undefined>;
  getAgentKpis(userId: string): Promise<AgentKpi[]>;
  createAgentKpi(kpi: InsertAgentKpi): Promise<AgentKpi>;

  updateAgentTask(id: string, updates: Partial<AgentTask>): Promise<AgentTask | undefined>;

  getDiscoveryCredentials(userId: string): Promise<DiscoveryCredential[]>;
  getDiscoveryCredential(id: string): Promise<DiscoveryCredential | undefined>;
  createDiscoveryCredential(cred: InsertDiscoveryCredential): Promise<DiscoveryCredential>;
  updateDiscoveryCredential(id: string, updates: Partial<DiscoveryCredential>): Promise<DiscoveryCredential | undefined>;
  deleteDiscoveryCredential(id: string): Promise<boolean>;

  getProbeTypes(userId: string): Promise<ProbeType[]>;
  getProbeType(id: string): Promise<ProbeType | undefined>;
  createProbeType(probeType: InsertProbeType): Promise<ProbeType>;
  updateProbeType(id: string, updates: Partial<ProbeType>): Promise<ProbeType | undefined>;
  deleteProbeType(id: string): Promise<boolean>;

  getDiscoveryProbes(userId: string): Promise<DiscoveryProbe[]>;
  getAllDiscoveryProbes(): Promise<DiscoveryProbe[]>;
  getDiscoveryProbe(id: string): Promise<DiscoveryProbe | undefined>;
  getDiscoveryProbeByToken(siteToken: string): Promise<DiscoveryProbe | undefined>;
  createDiscoveryProbe(probe: InsertDiscoveryProbe): Promise<DiscoveryProbe>;
  updateDiscoveryProbe(id: string, updates: Partial<DiscoveryProbe>): Promise<DiscoveryProbe | undefined>;
  deleteDiscoveryProbe(id: string): Promise<boolean>;

  createProbeActivityLog(log: InsertProbeActivityLog): Promise<ProbeActivityLog>;
  getProbeActivityLogs(probeId: string, limit?: number): Promise<ProbeActivityLog[]>;

  getProbeMediaFiles(probeId: string): Promise<ProbeMediaFile[]>;
  getProbeMediaFile(id: string): Promise<ProbeMediaFile | undefined>;
  createProbeMediaFile(file: InsertProbeMediaFile): Promise<ProbeMediaFile>;
  updateProbeMediaFile(id: string, updates: Partial<ProbeMediaFile>): Promise<ProbeMediaFile | undefined>;
  deleteProbeMediaFile(id: string): Promise<boolean>;

  getDiscoveredAssets(userId: string, filters?: { probeId?: string; agentRoleId?: string }): Promise<DiscoveredAsset[]>;
  getDiscoveredAsset(id: string, userId: string): Promise<DiscoveredAsset | undefined>;
  getAssetByProbeAndIdentifier(probeId: string, ipAddress?: string, hostname?: string): Promise<DiscoveredAsset | undefined>;
  getAssetsByProbeId(probeId: string): Promise<DiscoveredAsset[]>;
  createDiscoveredAsset(asset: InsertDiscoveredAsset): Promise<DiscoveredAsset>;
  updateDiscoveredAsset(id: string, updates: Partial<DiscoveredAsset>): Promise<DiscoveredAsset | undefined>;

  getAgentPerformanceMetrics(userId: string): Promise<AgentPerformanceMetric[]>;
  getAgentPerformanceByRole(agentRoleId: string, userId: string): Promise<AgentPerformanceMetric[]>;
  createAgentPerformanceMetric(metric: InsertAgentPerformanceMetric): Promise<AgentPerformanceMetric>;
  updateAgentPerformanceMetric(id: string, updates: Partial<AgentPerformanceMetric>): Promise<AgentPerformanceMetric | undefined>;

  getAgentConversations(userId: string): Promise<AgentConversation[]>;
  getAgentConversation(id: string, userId: string): Promise<AgentConversation | undefined>;
  createAgentConversation(conv: InsertAgentConversation): Promise<AgentConversation>;
  updateAgentConversation(id: string, updates: Partial<AgentConversation>): Promise<void>;
  getAgentMessages(conversationId: string): Promise<AgentMessage[]>;
  createAgentMessage(msg: InsertAgentMessage): Promise<AgentMessage>;

  getAgentNotifications(userId: string, filters?: { agentRoleId?: string; severity?: string; actionStatus?: string; type?: string }): Promise<AgentNotification[]>;
  getAgentNotification(id: string, userId: string): Promise<AgentNotification | undefined>;
  createAgentNotification(notification: InsertAgentNotification): Promise<AgentNotification>;
  updateAgentNotification(id: string, userId: string, updates: Partial<AgentNotification>): Promise<AgentNotification | undefined>;

  getUserManagedAgents(userId: string): Promise<UserManagedAgent[]>;
  setUserManagedAgents(userId: string, agentRoleIds: string[]): Promise<UserManagedAgent[]>;

  getThresholdCalibrations(userId: string): Promise<ThresholdCalibration[]>;
  createThresholdCalibration(cal: InsertThresholdCalibration): Promise<ThresholdCalibration>;
  updateThresholdCalibration(id: string, updates: Partial<ThresholdCalibration>): Promise<ThresholdCalibration | undefined>;

  getMonitoredApplications(userId: string, filters?: { assetId?: string; criticality?: string; status?: string }): Promise<MonitoredApplication[]>;
  createMonitoredApplication(app: InsertMonitoredApplication): Promise<MonitoredApplication>;
  updateMonitoredApplication(id: string, updates: Partial<MonitoredApplication>): Promise<MonitoredApplication | undefined>;
  deleteMonitoredApplicationsByAsset(assetId: string): Promise<void>;

  getApplicationTopologies(userId: string): Promise<ApplicationTopology[]>;
  createApplicationTopology(topo: InsertApplicationTopology): Promise<ApplicationTopology>;
  updateApplicationTopology(id: string, userId: string, updates: Partial<ApplicationTopology>): Promise<ApplicationTopology | undefined>;
  deleteApplicationTopologies(userId: string): Promise<void>;

  getRemediationTasks(assetId: string, userId: string): Promise<RemediationTask[]>;
  getRemediationTasksByBatch(batchId: string, userId: string): Promise<RemediationTask[]>;
  getRemediationTask(id: string): Promise<RemediationTask | undefined>;
  createRemediationTask(task: InsertRemediationTask): Promise<RemediationTask>;
  updateRemediationTask(id: string, updates: Partial<RemediationTask>): Promise<RemediationTask | undefined>;
  clearCompletedRemediationTasks(assetId: string, userId: string): Promise<number>;
  getPendingTasksForProbe(probeId: string): Promise<RemediationTask[]>;
  getPendingRollbacksForProbe(probeId: string): Promise<RemediationTask[]>;
  getQueuedTasksWithEmptyScripts(): Promise<RemediationTask[]>;

  getServiceMetrics(userId: string): Promise<ServiceMetric[]>;
  getAllServiceMetrics(): Promise<ServiceMetric[]>;
  getServiceMetric(id: string): Promise<ServiceMetric | undefined>;
  createServiceMetric(metric: InsertServiceMetric): Promise<ServiceMetric>;
  updateServiceMetric(id: string, updates: Partial<ServiceMetric>): Promise<ServiceMetric | undefined>;
  deleteServiceMetric(id: string): Promise<boolean>;

  getServiceMetricAssignments(userId: string, filters?: { metricId?: string; assetId?: string }): Promise<ServiceMetricAssignment[]>;
  getServiceMetricAssignmentById(id: string): Promise<ServiceMetricAssignment | undefined>;
  getAssignmentsByAssetId(assetId: string): Promise<ServiceMetricAssignment[]>;
  createServiceMetricAssignment(assignment: InsertServiceMetricAssignment): Promise<ServiceMetricAssignment>;
  updateServiceMetricAssignment(id: string, updates: Partial<ServiceMetricAssignment>): Promise<ServiceMetricAssignment | undefined>;
  deleteServiceMetricAssignment(id: string): Promise<boolean>;

  getMissionCriticalGroups(userId: string): Promise<MissionCriticalGroup[]>;
  getMissionCriticalGroup(id: string): Promise<MissionCriticalGroup | undefined>;
  createMissionCriticalGroup(group: InsertMissionCriticalGroup): Promise<MissionCriticalGroup>;
  updateMissionCriticalGroup(id: string, updates: Partial<MissionCriticalGroup>): Promise<MissionCriticalGroup | undefined>;
  deleteMissionCriticalGroup(id: string): Promise<boolean>;

  getAgentMetricProfiles(userId: string, roleId?: string): Promise<AgentMetricProfile[]>;
  getAgentMetricProfile(id: string): Promise<AgentMetricProfile | undefined>;
  createAgentMetricProfile(profile: InsertAgentMetricProfile): Promise<AgentMetricProfile>;
  deleteAgentMetricProfile(id: string): Promise<boolean>;
  deleteAgentMetricProfilesByRole(roleId: string, userId: string): Promise<number>;

  getAgentOperationalInsights(userId: string, roleId: string): Promise<AgentOperationalInsights | undefined>;
  getAllAgentOperationalInsights(userId: string): Promise<AgentOperationalInsights[]>;
  createAgentOperationalInsights(insights: InsertAgentOperationalInsights): Promise<AgentOperationalInsights>;
  deleteAgentOperationalInsightsByRole(roleId: string, userId: string): Promise<boolean>;

  getScheduledActivities(userId: string): Promise<AgentScheduledActivity[]>;
  getScheduledActivitiesByRole(userId: string, roleId: string): Promise<AgentScheduledActivity[]>;
  createScheduledActivity(activity: InsertAgentScheduledActivity): Promise<AgentScheduledActivity>;
  updateScheduledActivityStatus(id: string, userId: string, status: string, notes?: string): Promise<AgentScheduledActivity | undefined>;
  approveScheduledActivity(id: string, approvedBy: string): Promise<AgentScheduledActivity | undefined>;
  deleteScheduledActivity(id: string, userId: string): Promise<boolean>;
  deleteScheduledActivitiesByRole(roleId: string, userId: string): Promise<number>;

  getCacheTemplate(userId: string, cacheCategory: string, cacheKey: string): Promise<AiTemplateCache | undefined>;
  setCacheTemplate(template: InsertAiTemplateCache): Promise<AiTemplateCache>;
  incrementCacheHit(id: string): Promise<void>;
  getCacheTemplates(userId: string): Promise<AiTemplateCache[]>;
  invalidateCacheTemplate(id: string, userId: string): Promise<boolean>;
  invalidateCacheByCategory(userId: string, category: string): Promise<number>;
  invalidateExpiredCaches(): Promise<number>;
  getCacheStats(userId: string): Promise<{ total: number; totalHits: number; totalTokensSaved: number; byCategory: Record<string, { count: number; hits: number; tokensSaved: number }> }>;

  getAiProviders(userId: string): Promise<AiProvider[]>;
  getAiProvider(id: string, userId: string): Promise<AiProvider | undefined>;
  getDefaultAiProvider(userId: string): Promise<AiProvider | undefined>;
  createAiProvider(provider: InsertAiProvider): Promise<AiProvider>;
  updateAiProvider(id: string, userId: string, updates: Partial<AiProvider>): Promise<AiProvider | undefined>;
  deleteAiProvider(id: string, userId: string): Promise<boolean>;
  setDefaultAiProvider(id: string, userId: string): Promise<void>;

  getProbeCredentialLinks(probeId: string): Promise<ProbeCredentialLink[]>;
  addProbeCredentialLink(probeId: string, credentialId: string): Promise<ProbeCredentialLink>;
  removeProbeCredentialLink(probeId: string, credentialId: string): Promise<boolean>;

  getClusterNodes(probeId: string): Promise<ProbeClusterNode[]>;
  getClusterNode(id: string): Promise<ProbeClusterNode | undefined>;
  createClusterNode(node: InsertProbeClusterNode): Promise<ProbeClusterNode>;
  updateClusterNode(id: string, updates: Partial<ProbeClusterNode>): Promise<ProbeClusterNode | undefined>;
  deleteClusterNode(id: string): Promise<boolean>;

  getBcpPlans(userId: string): Promise<BcpPlan[]>;
  getBcpPlan(id: string): Promise<BcpPlan | undefined>;
  createBcpPlan(plan: InsertBcpPlan): Promise<BcpPlan>;
  updateBcpPlan(id: string, updates: Partial<BcpPlan>): Promise<BcpPlan | undefined>;

  getDrpPlans(userId: string): Promise<DrpPlan[]>;
  getDrpPlan(id: string): Promise<DrpPlan | undefined>;
  createDrpPlan(plan: InsertDrpPlan): Promise<DrpPlan>;
  updateDrpPlan(id: string, updates: Partial<DrpPlan>): Promise<DrpPlan | undefined>;

  getBiaEntries(userId: string): Promise<BiaEntry[]>;
  getBiaEntry(id: string): Promise<BiaEntry | undefined>;
  createBiaEntry(entry: InsertBiaEntry): Promise<BiaEntry>;
  updateBiaEntry(id: string, updates: Partial<BiaEntry>): Promise<BiaEntry | undefined>;

  getRiskAssessments(userId: string): Promise<RiskAssessment[]>;
  getRiskAssessment(id: string): Promise<RiskAssessment | undefined>;
  createRiskAssessment(entry: InsertRiskAssessment): Promise<RiskAssessment>;
  updateRiskAssessment(id: string, updates: Partial<RiskAssessment>): Promise<RiskAssessment | undefined>;

  getDrills(userId: string): Promise<Drill[]>;
  getDrill(id: string): Promise<Drill | undefined>;
  createDrill(drill: InsertDrill): Promise<Drill>;
  updateDrill(id: string, updates: Partial<Drill>): Promise<Drill | undefined>;

  getReviews(userId: string): Promise<Review[]>;
  getReview(id: string): Promise<Review | undefined>;
  createReview(review: InsertReview): Promise<Review>;
  updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined>;

  getDashboardStats(): Promise<DashboardStats>;

  // KEDB
  getKnownErrors(): Promise<KnownError[]>;
  getKnownError(id: number): Promise<KnownError | undefined>;
  createKnownError(data: InsertKnownError): Promise<KnownError>;
  updateKnownError(id: number, updates: Partial<KnownError>): Promise<KnownError | undefined>;
  deleteKnownError(id: number): Promise<void>;

  // SLA Breaches
  getSlaBreaches(): Promise<SlaBreach[]>;
  createSlaBreach(data: InsertSlaBreach): Promise<SlaBreach>;
  acknowledgeSlaBreach(id: number, userId: string): Promise<SlaBreach | undefined>;
  computeSlaBreaches(userId: string): Promise<{ created: number }>;

  // CSI Register
  getCsiItems(): Promise<CsiRegisterItem[]>;
  getCsiItem(id: number): Promise<CsiRegisterItem | undefined>;
  createCsiItem(data: InsertCsiRegister): Promise<CsiRegisterItem>;
  updateCsiItem(id: number, updates: Partial<CsiRegisterItem>): Promise<CsiRegisterItem | undefined>;
  deleteCsiItem(id: number): Promise<void>;

  // Releases
  getReleases(): Promise<Release[]>;
  getRelease(id: number): Promise<Release | undefined>;
  createRelease(data: InsertRelease): Promise<Release>;
  updateRelease(id: number, updates: Partial<Release>): Promise<Release | undefined>;
  deleteRelease(id: number): Promise<void>;
  getReleaseItems(releaseId: number): Promise<ReleaseItem[]>;
  createReleaseItem(data: InsertReleaseItem): Promise<ReleaseItem>;
  updateReleaseItem(id: number, updates: Partial<ReleaseItem>): Promise<ReleaseItem | undefined>;
  deleteReleaseItem(id: number): Promise<void>;

  getServiceReadings(filters?: { serviceName?: string; metricType?: string; limit?: number }): Promise<ServiceReading[]>;
  createServiceReading(reading: InsertServiceReading): Promise<ServiceReading>;
  createServiceReadingsBatch(readings: InsertServiceReading[]): Promise<ServiceReading[]>;
  deleteServiceReadingsByService(serviceName: string): Promise<void>;

  getCapacityThresholds(userId: string, serviceName?: string): Promise<CapacityThreshold[]>;
  upsertCapacityThreshold(threshold: InsertCapacityThreshold): Promise<CapacityThreshold>;
  deleteCapacityThreshold(id: string, userId: string): Promise<void>;

  getCapacityActions(userId: string, filters?: { serviceName?: string; status?: string }): Promise<CapacityAction[]>;
  createCapacityAction(action: InsertCapacityAction): Promise<CapacityAction>;
  updateCapacityAction(id: string, userId: string, updates: Partial<InsertCapacityAction & { resolvedAt: Date | null }>): Promise<CapacityAction>;
  deleteCapacityAction(id: string, userId: string): Promise<void>;

  getCapacityDemandEvents(userId: string, serviceName?: string): Promise<CapacityDemandEvent[]>;
  createCapacityDemandEvent(event: InsertCapacityDemandEvent): Promise<CapacityDemandEvent>;
  updateCapacityDemandEvent(id: string, userId: string, updates: Partial<InsertCapacityDemandEvent>): Promise<CapacityDemandEvent>;
  deleteCapacityDemandEvent(id: string, userId: string): Promise<void>;

  getCommandCatalog(userId: string, filters?: { status?: string; category?: string }): Promise<CommandCatalogEntry[]>;
  getCommandCatalogEntry(id: string, userId: string): Promise<CommandCatalogEntry | undefined>;
  createCommandCatalogEntry(entry: InsertCommandCatalog): Promise<CommandCatalogEntry>;
  updateCommandCatalogEntry(id: string, userId: string, updates: Partial<CommandCatalogEntry>): Promise<CommandCatalogEntry | undefined>;
  deleteCommandCatalogEntry(id: string, userId: string): Promise<boolean>;
  incrementCatalogUsage(id: string): Promise<void>;
  updateCatalogAiReview(id: string, review: {
    aiReviewStatus: string; aiReviewVerdict: string; aiReviewScore: number;
    aiReviewNotes: any; aiReviewAt: Date; aiReviewCacheHit: boolean;
  }): Promise<CommandCatalogEntry | undefined>;

  getAllUsers(): Promise<User[]>;
  updateUserCommandScopes(userId: string, scopes: string[]): Promise<User | undefined>;

  // Command Schedules
  getCommandSchedules(userId: string): Promise<CommandSchedule[]>;
  getCommandSchedule(id: string, userId: string): Promise<CommandSchedule | undefined>;
  createCommandSchedule(s: InsertCommandSchedule): Promise<CommandSchedule>;
  updateCommandSchedule(id: string, userId: string, updates: Partial<CommandSchedule>): Promise<CommandSchedule | undefined>;
  deleteCommandSchedule(id: string, userId: string): Promise<boolean>;
  getDueSchedules(): Promise<CommandSchedule[]>;

  // Command Approvals
  getCommandApprovals(filters?: { status?: string; userId?: string }): Promise<CommandApproval[]>;
  getCommandApproval(id: string): Promise<CommandApproval | undefined>;
  createCommandApproval(a: InsertCommandApproval): Promise<CommandApproval>;
  updateCommandApproval(id: string, updates: Partial<CommandApproval>): Promise<CommandApproval | undefined>;

  // Command History (uses existing remediation tasks)
  getCommandHistory(userId: string, filters?: { status?: string; assetId?: string; limit?: number; offset?: number }): Promise<{ tasks: RemediationTask[]; total: number }>;

  // Patches
  getPatches(userId: string, filters?: { status?: string; severity?: string }): Promise<Patch[]>;
  getPatch(id: string, userId: string): Promise<Patch | undefined>;
  createPatch(p: InsertPatch): Promise<Patch>;
  updatePatch(id: string, userId: string, updates: Partial<Patch>): Promise<Patch | undefined>;
  deletePatch(id: string, userId: string): Promise<boolean>;

  // Patch Jobs
  getPatchJobs(userId: string, patchId?: string): Promise<PatchJob[]>;
  getPatchJob(id: string): Promise<PatchJob | undefined>;
  createPatchJob(j: InsertPatchJob): Promise<PatchJob>;
  updatePatchJob(id: string, updates: Partial<PatchJob>): Promise<PatchJob | undefined>;

  // Validation Probe Configs
  getValidationProbeConfigs(userId: string): Promise<ValidationProbeConfig[]>;
  getValidationProbeConfig(id: string, userId: string): Promise<ValidationProbeConfig | undefined>;
  createValidationProbeConfig(c: InsertValidationProbeConfig): Promise<ValidationProbeConfig>;
  updateValidationProbeConfig(id: string, userId: string, updates: Partial<ValidationProbeConfig>): Promise<ValidationProbeConfig | undefined>;
  deleteValidationProbeConfig(id: string, userId: string): Promise<boolean>;

  // Configuration Management
  getConfigRfcs(userId: string, filters?: { assetId?: string; status?: string }): Promise<ConfigRfc[]>;
  getConfigRfc(id: string, userId: string): Promise<ConfigRfc | undefined>;
  createConfigRfc(r: InsertConfigRfc): Promise<ConfigRfc>;
  updateConfigRfc(id: string, userId: string, updates: Partial<ConfigRfc>): Promise<ConfigRfc | undefined>;
  deleteConfigRfc(id: string, userId: string): Promise<boolean>;
  getNextRfcNumber(userId: string): Promise<string>;
  getConfigBaselines(userId: string, assetId?: string): Promise<ConfigBaseline[]>;
  createConfigBaseline(b: InsertConfigBaseline): Promise<ConfigBaseline>;
  deleteConfigBaseline(id: string, userId: string): Promise<boolean>;
  getServiceFinancials(): Promise<ServiceFinancial[]>;
  createServiceFinancial(d: InsertServiceFinancial): Promise<ServiceFinancial>;
  getSuppliers(): Promise<Supplier[]>;
  createSupplier(d: InsertSupplier): Promise<Supplier>;
  getSupplierContracts(): Promise<SupplierContract[]>;
  createSupplierContract(d: InsertSupplierContract): Promise<SupplierContract>;
  getDeployments(): Promise<Deployment[]>;
  createDeployment(d: InsertDeployment): Promise<Deployment>;
  getStakeholders(): Promise<Stakeholder[]>;
  createStakeholder(d: InsertStakeholder): Promise<Stakeholder>;
  getServiceReviews(): Promise<ServiceReview[]>;
  createServiceReview(d: InsertServiceReview): Promise<ServiceReview>;
  getSiemCorrelationRules(): Promise<SiemCorrelationRule[]>;
  updateSiemCorrelationRule(id: string, patch: Partial<{ status: string; hitCount: number }>): Promise<SiemCorrelationRule | undefined>;
  markSecurityEventProcessed(id: string): Promise<void>;
  // Forensics
  getForensicCases(): Promise<ForensicCase[]>;
  getForensicCase(id: string): Promise<ForensicCase | undefined>;
  createForensicCase(data: InsertForensicCase): Promise<ForensicCase>;
  updateForensicCase(id: string, patch: Partial<ForensicCase>): Promise<ForensicCase | undefined>;
  getForensicEvidence(caseId: string): Promise<ForensicEvidence[]>;
  addForensicEvidence(data: InsertForensicEvidence): Promise<ForensicEvidence>;
  getForensicTimeline(caseId: string): Promise<ForensicTimeline[]>;
  addForensicTimelineEvent(data: InsertForensicTimeline): Promise<ForensicTimeline>;
  getForensicIndicators(): Promise<ForensicIndicator[]>;
  // AI Observability & Governance
  createAiAuditLog(log: InsertAiAuditLog): Promise<AiAuditLog>;
  getAiAuditLogs(filters?: { module?: string; status?: string; riskLevel?: string; requiresReview?: boolean; limit?: number; offset?: number }): Promise<AiAuditLog[]>;
  getAiGovernanceStats(): Promise<{ totalCalls: number; todayCalls: number; hallucinationFlags: number; schemaFailures: number; injectionAttempts: number; pendingReviews: number; avgLatencyMs: number; totalTokens: number; byModule: { module: string; count: number; flagged: number; avgLatency: number }[] }>;
  updateAiAuditLogReview(id: number, status: "approved" | "rejected", reviewedBy: string): Promise<AiAuditLog>;
  updateAiAuditLogQualityReview(id: number, data: { qualityReviewStatus: string; qualityReviewResult: string; qualityReviewScore: number; qualityReviewFlags: string[] }): Promise<AiAuditLog>;
  getAiAuditLog(id: number): Promise<AiAuditLog | undefined>;
  // AI Context Store (RAG / fine-tuning dataset)
  createAiContextEntry(data: InsertAiContextEntry): Promise<AiContextEntry>;
  getAiContextEntries(filters?: { module?: string; approvedOnly?: boolean; limit?: number; offset?: number }): Promise<AiContextEntry[]>;
  getAiContextEntriesForInjection(module: string, limit?: number): Promise<AiContextEntry[]>;
  updateAiContextEntry(id: number, data: Partial<AiContextEntry>): Promise<AiContextEntry>;
  deleteAiContextEntry(id: number): Promise<void>;
  // ── Knowledge Base (PGVector) ─────────────────────────────────────────────
  createKnowledgeDocument(data: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  getKnowledgeDocuments(userId?: string): Promise<(KnowledgeDocument & { chunkCount: number })[]>;
  deleteKnowledgeDocument(id: number): Promise<void>;
  createDocumentChunk(data: { documentId: number; chunkIndex: number; content: string; embedding: number[] }): Promise<DocumentChunk>;
  semanticSearch(embedding: number[], limit?: number): Promise<{ id: number; documentId: number; content: string; documentTitle: string; similarity: number }[]>;
  updateKnowledgeDocumentChunkCount(id: number, chunkCount: number): Promise<void>;
  getAiContextStats(): Promise<{ total: number; approved: number; avgQuality: number; totalInjections: number; byModule: { module: string; count: number; approved: number; avgQuality: number }[] }>;
  // Holocron Conclave
  createConclave(data: InsertConclave): Promise<Conclave>;
  getConclaves(userId?: string): Promise<Conclave[]>;
  getConclave(id: number): Promise<Conclave | undefined>;
  updateConclave(id: number, data: Partial<Conclave>): Promise<Conclave>;
  deleteConclave(id: number): Promise<void>;
  createConclaveMessage(msg: InsertConclaveMessage): Promise<ConclaveMessage>;
  getConclaveMessages(conclaveId: number): Promise<ConclaveMessage[]>;
}

export interface DashboardStats {
  totalIncidents: number;
  openIncidents: number;
  criticalIncidents: number;
  totalServiceRequests: number;
  pendingServiceRequests: number;
  totalSecurityEvents: number;
  activeAgents: number;
  totalProblems: number;
  openProblems: number;
  totalChangeRequests: number;
  pendingChanges: number;
  totalCmdbItems: number;
  knowledgeArticles: number;
  totalConnectors: number;
  activeConnectors: number;
  totalPlaybooks: number;
  playbookExecutions: number;
  autonomousActions: number;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
  async updateUserCountry(userId: string, country: string): Promise<void> {
    await db.update(users).set({ country }).where(eq(users.id, userId));
  }
  async completeOnboarding(userId: string): Promise<void> {
    await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, userId));
  }

  async completeTour(userId: string): Promise<void> {
    await db.update(users).set({ tourCompleted: true }).where(eq(users.id, userId));
  }

  async getModulePreferences(userId: string): Promise<Record<string, boolean>> {
    const [user] = await db.select({ modulePreferences: users.modulePreferences }).from(users).where(eq(users.id, userId));
    return (user?.modulePreferences as Record<string, boolean>) || {};
  }

  async updateModulePreferences(userId: string, prefs: Record<string, boolean>): Promise<void> {
    await db.update(users).set({ modulePreferences: prefs }).where(eq(users.id, userId));
  }

  async getRecommendationsByUser(userId: string): Promise<Recommendation[]> {
    return db.select().from(recommendations).where(eq(recommendations.userId, userId)).orderBy(desc(recommendations.createdAt));
  }
  async getRecommendation(id: string): Promise<Recommendation | undefined> {
    const [rec] = await db.select().from(recommendations).where(eq(recommendations.id, id));
    return rec;
  }
  async createRecommendation(rec: InsertRecommendation): Promise<Recommendation> {
    const [created] = await db.insert(recommendations).values(rec).returning();
    return created;
  }
  async updateRecommendation(id: string, updates: Partial<Recommendation>): Promise<Recommendation | undefined> {
    const [updated] = await db.update(recommendations).set({ ...updates, updatedAt: new Date() }).where(eq(recommendations.id, id)).returning();
    return updated;
  }

  async getAgents(): Promise<AiAgent[]> {
    return db.select().from(aiAgents).orderBy(aiAgents.name);
  }
  async getAgent(id: string): Promise<AiAgent | undefined> {
    const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
    return agent;
  }
  async createAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const [created] = await db.insert(aiAgents).values(agent).returning();
    return created;
  }
  async updateAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined> {
    const [updated] = await db.update(aiAgents).set(updates).where(eq(aiAgents.id, id)).returning();
    return updated;
  }

  async getIncidents(): Promise<Incident[]> {
    return db.select().from(incidents).orderBy(desc(incidents.createdAt));
  }
  async getIncident(id: string): Promise<Incident | undefined> {
    const [incident] = await db.select().from(incidents).where(eq(incidents.id, id));
    return incident;
  }
  async createIncident(incident: InsertIncident): Promise<Incident> {
    const [created] = await db.insert(incidents).values(incident).returning();
    return created;
  }
  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | undefined> {
    const [updated] = await db.update(incidents).set({ ...updates, updatedAt: new Date() }).where(eq(incidents.id, id)).returning();
    return updated;
  }

  async getServiceRequests(): Promise<ServiceRequest[]> {
    return db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt));
  }
  async getServiceRequest(id: string): Promise<ServiceRequest | undefined> {
    const [sr] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id));
    return sr;
  }
  async createServiceRequest(sr: InsertServiceRequest): Promise<ServiceRequest> {
    const [created] = await db.insert(serviceRequests).values(sr).returning();
    return created;
  }
  async updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined> {
    const [updated] = await db.update(serviceRequests).set({ ...updates, updatedAt: new Date() }).where(eq(serviceRequests.id, id)).returning();
    return updated;
  }

  async getSecurityEvents(): Promise<SecurityEvent[]> {
    return db.select().from(securityEvents).orderBy(desc(securityEvents.createdAt));
  }
  async createSecurityEvent(event: InsertSecurityEvent): Promise<SecurityEvent> {
    const [created] = await db.insert(securityEvents).values(event).returning();
    return created;
  }

  async getProblems(): Promise<Problem[]> {
    return db.select().from(problems).orderBy(desc(problems.createdAt));
  }
  async getProblem(id: string): Promise<Problem | undefined> {
    const [problem] = await db.select().from(problems).where(eq(problems.id, id));
    return problem;
  }
  async createProblem(problem: InsertProblem): Promise<Problem> {
    const [created] = await db.insert(problems).values(problem).returning();
    return created;
  }
  async updateProblem(id: string, updates: Partial<Problem>): Promise<Problem | undefined> {
    const [updated] = await db.update(problems).set({ ...updates, updatedAt: new Date() }).where(eq(problems.id, id)).returning();
    return updated;
  }

  async getChangeRequests(): Promise<ChangeRequest[]> {
    return db.select().from(changeRequests).orderBy(desc(changeRequests.createdAt));
  }
  async getChangeRequest(id: string): Promise<ChangeRequest | undefined> {
    const [cr] = await db.select().from(changeRequests).where(eq(changeRequests.id, id));
    return cr;
  }
  async createChangeRequest(cr: InsertChangeRequest): Promise<ChangeRequest> {
    const [created] = await db.insert(changeRequests).values(cr).returning();
    return created;
  }
  async updateChangeRequest(id: string, updates: Partial<ChangeRequest>): Promise<ChangeRequest | undefined> {
    const [updated] = await db.update(changeRequests).set({ ...updates, updatedAt: new Date() }).where(eq(changeRequests.id, id)).returning();
    return updated;
  }

  async getServiceCatalogItems(): Promise<ServiceCatalogItem[]> {
    return db.select().from(serviceCatalogItems).orderBy(serviceCatalogItems.category);
  }
  async getServiceCatalogItem(id: string): Promise<ServiceCatalogItem | undefined> {
    const [item] = await db.select().from(serviceCatalogItems).where(eq(serviceCatalogItems.id, id));
    return item;
  }
  async createServiceCatalogItem(item: InsertServiceCatalogItem): Promise<ServiceCatalogItem> {
    const [created] = await db.insert(serviceCatalogItems).values(item).returning();
    return created;
  }

  async getKnowledgeArticles(): Promise<KnowledgeArticle[]> {
    return db.select().from(knowledgeArticles).orderBy(desc(knowledgeArticles.updatedAt));
  }
  async getKnowledgeArticle(id: string): Promise<KnowledgeArticle | undefined> {
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, id));
    return article;
  }
  async searchKnowledgeArticles(query: string): Promise<KnowledgeArticle[]> {
    const pattern = `%${query}%`;
    return db.select().from(knowledgeArticles).where(
      and(
        eq(knowledgeArticles.status, "published"),
        or(
          ilike(knowledgeArticles.title, pattern),
          ilike(knowledgeArticles.content, pattern),
        )
      )
    ).orderBy(desc(knowledgeArticles.helpfulCount)).limit(10);
  }
  async getKnowledgeArticleByTag(tag: string): Promise<KnowledgeArticle | undefined> {
    const [article] = await db.select().from(knowledgeArticles)
      .where(and(
        eq(knowledgeArticles.status, "published"),
        sql`${knowledgeArticles.tags} @> ARRAY[${tag}]::text[]`
      ))
      .orderBy(desc(knowledgeArticles.updatedAt))
      .limit(1);
    return article;
  }
  async createKnowledgeArticle(article: InsertKnowledgeArticle): Promise<KnowledgeArticle> {
    const [created] = await db.insert(knowledgeArticles).values(article).returning();
    return created;
  }
  async updateKnowledgeArticle(id: string, updates: Partial<KnowledgeArticle>): Promise<KnowledgeArticle | undefined> {
    const [updated] = await db.update(knowledgeArticles).set({ ...updates, updatedAt: new Date() }).where(eq(knowledgeArticles.id, id)).returning();
    return updated;
  }
  async deleteKnowledgeArticle(id: string): Promise<void> {
    await db.delete(knowledgeArticles).where(eq(knowledgeArticles.id, id));
  }

  async getSlaDefinitions(): Promise<SlaDefinition[]> {
    return db.select().from(slaDefinitions).orderBy(slaDefinitions.priority);
  }
  async updateSlaDefinition(id: string, updates: Partial<SlaDefinition>): Promise<SlaDefinition | undefined> {
    const [row] = await db.update(slaDefinitions).set(updates).where(eq(slaDefinitions.id, id)).returning();
    return row;
  }
  async deleteSlaDefinition(id: string): Promise<void> {
    await db.delete(slaDefinitions).where(eq(slaDefinitions.id, id));
  }
  async createSlaDefinition(sla: InsertSlaDefinition): Promise<SlaDefinition> {
    const [created] = await db.insert(slaDefinitions).values(sla).returning();
    return created;
  }

  async getCmdbItems(): Promise<CmdbItem[]> {
    return db.select().from(cmdbItems).orderBy(cmdbItems.name);
  }
  async getCmdbItem(id: string): Promise<CmdbItem | undefined> {
    const [item] = await db.select().from(cmdbItems).where(eq(cmdbItems.id, id));
    return item;
  }
  async createCmdbItem(item: InsertCmdbItem): Promise<CmdbItem> {
    const [created] = await db.insert(cmdbItems).values(item).returning();
    return created;
  }
  async updateCmdbItem(id: string, updates: Partial<CmdbItem>): Promise<CmdbItem | undefined> {
    const [updated] = await db.update(cmdbItems).set({ ...updates, updatedAt: new Date() }).where(eq(cmdbItems.id, id)).returning();
    return updated;
  }

  async getCmdbRelationships(): Promise<CmdbRelationship[]> {
    return db.select().from(cmdbRelationships);
  }
  async createCmdbRelationship(rel: InsertCmdbRelationship): Promise<CmdbRelationship> {
    const [created] = await db.insert(cmdbRelationships).values(rel).returning();
    return created;
  }

  async getConnectors(): Promise<Connector[]> {
    return db.select().from(infrastructureConnectors).orderBy(desc(infrastructureConnectors.createdAt));
  }
  async getConnector(id: string): Promise<Connector | undefined> {
    const [c] = await db.select().from(infrastructureConnectors).where(eq(infrastructureConnectors.id, id));
    return c;
  }
  async createConnector(connector: InsertConnector): Promise<Connector> {
    const [created] = await db.insert(infrastructureConnectors).values(connector).returning();
    return created;
  }
  async updateConnector(id: string, updates: Partial<Connector>): Promise<Connector | undefined> {
    const [updated] = await db.update(infrastructureConnectors).set({ ...updates, updatedAt: new Date() }).where(eq(infrastructureConnectors.id, id)).returning();
    return updated;
  }

  async getPlaybooks(): Promise<Playbook[]> {
    return db.select().from(automationPlaybooks).orderBy(desc(automationPlaybooks.createdAt));
  }
  async getPlaybook(id: string): Promise<Playbook | undefined> {
    const [p] = await db.select().from(automationPlaybooks).where(eq(automationPlaybooks.id, id));
    return p;
  }
  async createPlaybook(playbook: InsertPlaybook): Promise<Playbook> {
    const [created] = await db.insert(automationPlaybooks).values(playbook).returning();
    return created;
  }
  async updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined> {
    const [updated] = await db.update(automationPlaybooks).set(updates).where(eq(automationPlaybooks.id, id)).returning();
    return updated;
  }

  async getPlaybookExecutions(): Promise<PlaybookExecution[]> {
    return db.select().from(playbookExecutions).orderBy(desc(playbookExecutions.startedAt));
  }
  async createPlaybookExecution(exec: InsertPlaybookExecution): Promise<PlaybookExecution> {
    const [created] = await db.insert(playbookExecutions).values(exec).returning();
    return created;
  }
  async updatePlaybookExecution(id: string, updates: Partial<PlaybookExecution>): Promise<PlaybookExecution | undefined> {
    const [updated] = await db.update(playbookExecutions).set(updates).where(eq(playbookExecutions.id, id)).returning();
    return updated;
  }

  async getTelemetryMetrics(limit = 200): Promise<TelemetryMetric[]> {
    return db.select().from(telemetryMetrics).orderBy(desc(telemetryMetrics.collectedAt)).limit(limit);
  }
  async createTelemetryMetric(metric: InsertTelemetryMetric): Promise<TelemetryMetric> {
    const [created] = await db.insert(telemetryMetrics).values(metric).returning();
    return created;
  }
  async getTelemetryBySource(sourceId: string): Promise<TelemetryMetric[]> {
    return db.select().from(telemetryMetrics).where(eq(telemetryMetrics.sourceId, sourceId)).orderBy(desc(telemetryMetrics.collectedAt)).limit(50);
  }

  async getAgentActivities(limit = 50): Promise<AgentActivity[]> {
    return db.select().from(agentActivities).orderBy(desc(agentActivities.createdAt)).limit(limit);
  }
  async getAutonomousActivities(limit = 50): Promise<AgentActivity[]> {
    return db.select().from(agentActivities).where(eq(agentActivities.autonomous, true)).orderBy(desc(agentActivities.createdAt)).limit(limit);
  }
  async createAgentActivity(activity: InsertAgentActivity): Promise<AgentActivity> {
    const [created] = await db.insert(agentActivities).values(activity).returning();
    return created;
  }

  async getChatMessages(limit = 100): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).orderBy(chatMessages.createdAt).limit(limit);
  }
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(message).returning();
    return created;
  }

  async getOrgRoles(): Promise<OrgRole[]> {
    return db.select().from(orgRoles).orderBy(orgRoles.sortOrder);
  }
  async getOrgRole(id: string): Promise<OrgRole | undefined> {
    const [role] = await db.select().from(orgRoles).where(eq(orgRoles.id, id));
    return role;
  }
  async createOrgRole(role: InsertOrgRole): Promise<OrgRole> {
    const [created] = await db.insert(orgRoles).values(role).returning();
    return created;
  }
  async updateOrgRole(id: string, updates: Partial<OrgRole>): Promise<OrgRole | undefined> {
    const [row] = await db.update(orgRoles).set(updates).where(eq(orgRoles.id, id)).returning();
    return row;
  }
  async getOrgRolesByDepartment(department: string): Promise<OrgRole[]> {
    return db.select().from(orgRoles).where(eq(orgRoles.department, department)).orderBy(orgRoles.sortOrder);
  }

  async getRoleSubscriptions(): Promise<RoleSubscription[]> {
    return db.select().from(roleSubscriptions).orderBy(desc(roleSubscriptions.subscribedAt));
  }
  async getRoleSubscriptionsByUser(userId: string): Promise<RoleSubscription[]> {
    return db.select().from(roleSubscriptions).where(eq(roleSubscriptions.userId, userId)).orderBy(desc(roleSubscriptions.subscribedAt));
  }
  async getRoleSubscription(id: string): Promise<RoleSubscription | undefined> {
    const [sub] = await db.select().from(roleSubscriptions).where(eq(roleSubscriptions.id, id));
    return sub;
  }
  async createRoleSubscription(sub: InsertRoleSubscription): Promise<RoleSubscription> {
    const [created] = await db.insert(roleSubscriptions).values(sub).returning();
    return created;
  }
  async updateRoleSubscription(id: string, updates: Partial<RoleSubscription>): Promise<RoleSubscription | undefined> {
    const [updated] = await db.update(roleSubscriptions).set(updates).where(eq(roleSubscriptions.id, id)).returning();
    return updated;
  }
  async deleteRoleSubscription(id: string): Promise<boolean> {
    const result = await db.delete(roleSubscriptions).where(eq(roleSubscriptions.id, id)).returning();
    return result.length > 0;
  }
  async getSubscriptionByRoleId(roleId: string): Promise<RoleSubscription | undefined> {
    const [sub] = await db.select().from(roleSubscriptions).where(eq(roleSubscriptions.roleId, roleId));
    return sub;
  }
  async getSubscriptionByRoleIdAndUser(roleId: string, userId: string): Promise<RoleSubscription | undefined> {
    const [sub] = await db.select().from(roleSubscriptions).where(and(eq(roleSubscriptions.roleId, roleId), eq(roleSubscriptions.userId, userId)));
    return sub;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const [incidentStats] = await db.select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${incidents.status} = 'open')::int`,
      critical: sql<number>`count(*) filter (where ${incidents.severity} = 'critical')::int`,
    }).from(incidents);

    const [srStats] = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${serviceRequests.status} = 'pending')::int`,
    }).from(serviceRequests);

    const [eventStats] = await db.select({ total: sql<number>`count(*)::int` }).from(securityEvents);
    const [agentStats] = await db.select({ active: sql<number>`count(*) filter (where ${aiAgents.status} = 'active')::int` }).from(aiAgents);
    const [problemStats] = await db.select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where ${problems.status} != 'resolved')::int`,
    }).from(problems);
    const [changeStats] = await db.select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${changeRequests.status} in ('draft', 'submitted', 'under_review'))::int`,
    }).from(changeRequests);
    const [cmdbStats] = await db.select({ total: sql<number>`count(*)::int` }).from(cmdbItems);
    const [kbStats] = await db.select({ total: sql<number>`count(*)::int` }).from(knowledgeArticles);
    const [connStats] = await db.select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${infrastructureConnectors.status} = 'active')::int`,
    }).from(infrastructureConnectors);
    const [pbStats] = await db.select({ total: sql<number>`count(*)::int` }).from(automationPlaybooks);
    const [execStats] = await db.select({ total: sql<number>`count(*)::int` }).from(playbookExecutions);
    const [autoStats] = await db.select({
      total: sql<number>`count(*) filter (where ${agentActivities.autonomous} = true)::int`,
    }).from(agentActivities);

    return {
      totalIncidents: incidentStats?.total ?? 0,
      openIncidents: incidentStats?.open ?? 0,
      criticalIncidents: incidentStats?.critical ?? 0,
      totalServiceRequests: srStats?.total ?? 0,
      pendingServiceRequests: srStats?.pending ?? 0,
      totalSecurityEvents: eventStats?.total ?? 0,
      activeAgents: agentStats?.active ?? 0,
      totalProblems: problemStats?.total ?? 0,
      openProblems: problemStats?.open ?? 0,
      totalChangeRequests: changeStats?.total ?? 0,
      pendingChanges: changeStats?.pending ?? 0,
      totalCmdbItems: cmdbStats?.total ?? 0,
      knowledgeArticles: kbStats?.total ?? 0,
      totalConnectors: connStats?.total ?? 0,
      activeConnectors: connStats?.active ?? 0,
      totalPlaybooks: pbStats?.total ?? 0,
      playbookExecutions: execStats?.total ?? 0,
      autonomousActions: autoStats?.total ?? 0,
    };
  }

  async getCrews(userId: string): Promise<Crew[]> {
    return db.select().from(crews).where(eq(crews.userId, userId)).orderBy(desc(crews.createdAt));
  }
  async getCrew(id: string): Promise<Crew | undefined> {
    const [crew] = await db.select().from(crews).where(eq(crews.id, id));
    return crew;
  }
  async createCrew(crew: InsertCrew): Promise<Crew> {
    const [created] = await db.insert(crews).values(crew).returning();
    return created;
  }

  async getAgentTasks(userId: string): Promise<AgentTask[]> {
    return db.select().from(agentTasks).where(eq(agentTasks.userId, userId)).orderBy(desc(agentTasks.createdAt));
  }
  async getAgentTask(id: string): Promise<AgentTask | undefined> {
    const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, id));
    return task;
  }
  async createAgentTask(task: InsertAgentTask): Promise<AgentTask> {
    const [created] = await db.insert(agentTasks).values(task).returning();
    return created;
  }

  async getWorkflows(userId: string): Promise<AgentWorkflow[]> {
    return db.select().from(agentWorkflows).where(eq(agentWorkflows.userId, userId)).orderBy(desc(agentWorkflows.createdAt));
  }
  async getWorkflow(id: string): Promise<AgentWorkflow | undefined> {
    const [workflow] = await db.select().from(agentWorkflows).where(eq(agentWorkflows.id, id));
    return workflow;
  }
  async createWorkflow(workflow: InsertAgentWorkflow): Promise<AgentWorkflow> {
    const [created] = await db.insert(agentWorkflows).values(workflow).returning();
    return created;
  }
  async updateWorkflow(id: string, updates: Partial<AgentWorkflow>): Promise<AgentWorkflow | undefined> {
    const [updated] = await db.update(agentWorkflows).set({ ...updates, updatedAt: new Date() }).where(eq(agentWorkflows.id, id)).returning();
    return updated;
  }

  async getCommittees(userId: string): Promise<Committee[]> {
    return db.select().from(committees).where(eq(committees.userId, userId)).orderBy(desc(committees.createdAt));
  }
  async getCommittee(id: string): Promise<Committee | undefined> {
    const [committee] = await db.select().from(committees).where(eq(committees.id, id));
    return committee;
  }
  async createCommittee(committee: InsertCommittee): Promise<Committee> {
    const [created] = await db.insert(committees).values(committee).returning();
    return created;
  }
  async updateCommittee(id: string, updates: Partial<Committee>): Promise<Committee | undefined> {
    const [updated] = await db.update(committees).set({ ...updates, updatedAt: new Date() }).where(eq(committees.id, id)).returning();
    return updated;
  }

  async getWorkflowStages(workflowId: string): Promise<WorkflowStage[]> {
    return db.select().from(workflowStages).where(eq(workflowStages.workflowId, workflowId)).orderBy(workflowStages.stageOrder);
  }
  async getWorkflowStage(id: string): Promise<WorkflowStage | undefined> {
    const [stage] = await db.select().from(workflowStages).where(eq(workflowStages.id, id));
    return stage;
  }
  async createWorkflowStage(stage: InsertWorkflowStage): Promise<WorkflowStage> {
    const [created] = await db.insert(workflowStages).values(stage).returning();
    return created;
  }
  async updateWorkflowStage(id: string, updates: Partial<WorkflowStage>): Promise<WorkflowStage | undefined> {
    const [updated] = await db.update(workflowStages).set(updates).where(eq(workflowStages.id, id)).returning();
    return updated;
  }

  async getNetworkDevices(userId: string): Promise<NetworkDevice[]> {
    return db.select().from(networkDevices).where(eq(networkDevices.userId, userId)).orderBy(desc(networkDevices.createdAt));
  }
  async createNetworkDevice(device: InsertNetworkDevice): Promise<NetworkDevice> {
    const [created] = await db.insert(networkDevices).values(device).returning();
    return created;
  }

  async getDeviceMetrics(userId: string, deviceId?: string): Promise<DeviceMetric[]> {
    if (deviceId) {
      return db.select().from(deviceMetrics).where(and(eq(deviceMetrics.userId, userId), eq(deviceMetrics.deviceId, deviceId))).orderBy(desc(deviceMetrics.timestamp));
    }
    return db.select().from(deviceMetrics).where(eq(deviceMetrics.userId, userId)).orderBy(desc(deviceMetrics.timestamp));
  }
  async createDeviceMetric(metric: InsertDeviceMetric): Promise<DeviceMetric> {
    const [created] = await db.insert(deviceMetrics).values(metric).returning();
    return created;
  }
  async updateDeviceMetricThresholds(metricId: string, thresholdWarning: number | null, thresholdCritical: number | null): Promise<DeviceMetric | undefined> {
    const [updated] = await db.update(deviceMetrics).set({ thresholdWarning, thresholdCritical }).where(eq(deviceMetrics.id, metricId)).returning();
    return updated;
  }

  async getAgentAlerts(userId: string): Promise<AgentAlert[]> {
    return db.select().from(agentAlerts).where(eq(agentAlerts.userId, userId)).orderBy(desc(agentAlerts.createdAt));
  }
  async createAgentAlert(alert: InsertAgentAlert): Promise<AgentAlert> {
    const [created] = await db.insert(agentAlerts).values(alert).returning();
    return created;
  }
  async updateAgentAlert(id: string, updates: Partial<AgentAlert>): Promise<AgentAlert | undefined> {
    const [updated] = await db.update(agentAlerts).set(updates).where(eq(agentAlerts.id, id)).returning();
    return updated;
  }

  async getAgentKpis(userId: string): Promise<AgentKpi[]> {
    return db.select().from(agentKpis).where(eq(agentKpis.userId, userId)).orderBy(desc(agentKpis.updatedAt));
  }
  async createAgentKpi(kpi: InsertAgentKpi): Promise<AgentKpi> {
    const [created] = await db.insert(agentKpis).values(kpi).returning();
    return created;
  }

  async updateAgentTask(id: string, updates: Partial<AgentTask>): Promise<AgentTask | undefined> {
    const [updated] = await db.update(agentTasks).set(updates).where(eq(agentTasks.id, id)).returning();
    return updated;
  }

  async getDiscoveryCredentials(userId: string): Promise<DiscoveryCredential[]> {
    return db.select().from(discoveryCredentials).where(eq(discoveryCredentials.userId, userId)).orderBy(desc(discoveryCredentials.createdAt));
  }
  async getDiscoveryCredential(id: string): Promise<DiscoveryCredential | undefined> {
    const [cred] = await db.select().from(discoveryCredentials).where(eq(discoveryCredentials.id, id));
    return cred;
  }
  async createDiscoveryCredential(cred: InsertDiscoveryCredential): Promise<DiscoveryCredential> {
    const [created] = await db.insert(discoveryCredentials).values(cred).returning();
    return created;
  }
  async updateDiscoveryCredential(id: string, updates: Partial<DiscoveryCredential>): Promise<DiscoveryCredential | undefined> {
    const [updated] = await db.update(discoveryCredentials).set(updates).where(eq(discoveryCredentials.id, id)).returning();
    return updated;
  }
  async deleteDiscoveryCredential(id: string): Promise<boolean> {
    const result = await db.delete(discoveryCredentials).where(eq(discoveryCredentials.id, id));
    return true;
  }

  async getProbeTypes(userId: string): Promise<ProbeType[]> {
    return db.select().from(probeTypes).where(eq(probeTypes.userId, userId)).orderBy(desc(probeTypes.createdAt));
  }
  async getProbeType(id: string): Promise<ProbeType | undefined> {
    const [pt] = await db.select().from(probeTypes).where(eq(probeTypes.id, id));
    return pt;
  }
  async createProbeType(pt: InsertProbeType): Promise<ProbeType> {
    const [created] = await db.insert(probeTypes).values(pt).returning();
    return created;
  }
  async updateProbeType(id: string, updates: Partial<ProbeType>): Promise<ProbeType | undefined> {
    const [updated] = await db.update(probeTypes).set(updates).where(eq(probeTypes.id, id)).returning();
    return updated;
  }
  async deleteProbeType(id: string): Promise<boolean> {
    await db.delete(probeTypes).where(eq(probeTypes.id, id));
    return true;
  }

  async getDiscoveryProbes(userId: string): Promise<DiscoveryProbe[]> {
    return db.select().from(discoveryProbes).where(eq(discoveryProbes.userId, userId)).orderBy(desc(discoveryProbes.createdAt));
  }
  async getAllDiscoveryProbes(): Promise<DiscoveryProbe[]> {
    return db.select().from(discoveryProbes).where(eq(discoveryProbes.enrolled, true)).orderBy(desc(discoveryProbes.lastHeartbeat));
  }
  async getDiscoveryProbe(id: string): Promise<DiscoveryProbe | undefined> {
    const [probe] = await db.select().from(discoveryProbes).where(eq(discoveryProbes.id, id));
    return probe;
  }
  async getDiscoveryProbeByToken(siteToken: string): Promise<DiscoveryProbe | undefined> {
    const [probe] = await db.select().from(discoveryProbes).where(eq(discoveryProbes.siteToken, siteToken));
    return probe;
  }
  async createDiscoveryProbe(probe: InsertDiscoveryProbe): Promise<DiscoveryProbe> {
    const [created] = await db.insert(discoveryProbes).values(probe).returning();
    return created;
  }
  async updateDiscoveryProbe(id: string, updates: Partial<DiscoveryProbe>): Promise<DiscoveryProbe | undefined> {
    const [updated] = await db.update(discoveryProbes).set(updates).where(eq(discoveryProbes.id, id)).returning();
    return updated;
  }
  async deleteDiscoveryProbe(id: string): Promise<boolean> {
    const result = await db.delete(discoveryProbes).where(eq(discoveryProbes.id, id));
    return true;
  }

  async createProbeActivityLog(log: InsertProbeActivityLog): Promise<ProbeActivityLog> {
    const [created] = await db.insert(probeActivityLogs).values(log).returning();
    return created;
  }

  async getProbeActivityLogs(probeId: string, limit: number = 100): Promise<ProbeActivityLog[]> {
    return db.select().from(probeActivityLogs).where(eq(probeActivityLogs.probeId, probeId)).orderBy(desc(probeActivityLogs.createdAt)).limit(limit);
  }

  async getProbeMediaFiles(probeId: string): Promise<ProbeMediaFile[]> {
    return db.select().from(probeMediaFiles).where(eq(probeMediaFiles.probeId, probeId)).orderBy(desc(probeMediaFiles.createdAt));
  }
  async getProbeMediaFile(id: string): Promise<ProbeMediaFile | undefined> {
    const [file] = await db.select().from(probeMediaFiles).where(eq(probeMediaFiles.id, id));
    return file;
  }
  async createProbeMediaFile(file: InsertProbeMediaFile): Promise<ProbeMediaFile> {
    const [created] = await db.insert(probeMediaFiles).values(file).returning();
    return created;
  }
  async updateProbeMediaFile(id: string, updates: Partial<ProbeMediaFile>): Promise<ProbeMediaFile | undefined> {
    const [updated] = await db.update(probeMediaFiles).set(updates).where(eq(probeMediaFiles.id, id)).returning();
    return updated;
  }
  async deleteProbeMediaFile(id: string): Promise<boolean> {
    await db.delete(probeMediaFiles).where(eq(probeMediaFiles.id, id));
    return true;
  }

  async getDiscoveredAssets(userId: string, filters?: { probeId?: string; agentRoleId?: string }): Promise<DiscoveredAsset[]> {
    const conditions = [eq(discoveredAssets.userId, userId)];
    if (filters?.probeId) conditions.push(eq(discoveredAssets.probeId, filters.probeId));
    if (filters?.agentRoleId) conditions.push(eq(discoveredAssets.assignedAgentRoleId, filters.agentRoleId));
    return db.select().from(discoveredAssets).where(and(...conditions)).orderBy(desc(discoveredAssets.createdAt));
  }
  async getAssetByProbeAndIdentifier(probeId: string, ipAddress?: string, hostname?: string): Promise<DiscoveredAsset | undefined> {
    if (ipAddress) {
      const [byIp] = await db.select().from(discoveredAssets).where(and(eq(discoveredAssets.probeId, probeId), eq(discoveredAssets.ipAddress, ipAddress))).limit(1);
      if (byIp) return byIp;
    }
    if (hostname) {
      const [byName] = await db.select().from(discoveredAssets).where(and(eq(discoveredAssets.probeId, probeId), ilike(discoveredAssets.name, hostname))).limit(1);
      if (byName) return byName;
    }
    return undefined;
  }
  async getAssetsByProbeId(probeId: string): Promise<DiscoveredAsset[]> {
    return db.select().from(discoveredAssets).where(eq(discoveredAssets.probeId, probeId));
  }
  async getDiscoveredAsset(id: string, userId: string): Promise<DiscoveredAsset | undefined> {
    const [asset] = await db.select().from(discoveredAssets).where(and(eq(discoveredAssets.id, id), eq(discoveredAssets.userId, userId)));
    return asset;
  }
  async createDiscoveredAsset(asset: InsertDiscoveredAsset): Promise<DiscoveredAsset> {
    const [created] = await db.insert(discoveredAssets).values(asset).returning();
    return created;
  }
  async updateDiscoveredAsset(id: string, updates: Partial<DiscoveredAsset>): Promise<DiscoveredAsset | undefined> {
    const [updated] = await db.update(discoveredAssets).set(updates).where(eq(discoveredAssets.id, id)).returning();
    return updated;
  }

  async getAgentPerformanceMetrics(userId: string): Promise<AgentPerformanceMetric[]> {
    return db.select().from(agentPerformanceMetrics).where(eq(agentPerformanceMetrics.userId, userId)).orderBy(desc(agentPerformanceMetrics.createdAt));
  }
  async getAgentPerformanceByRole(agentRoleId: string, userId: string): Promise<AgentPerformanceMetric[]> {
    return db.select().from(agentPerformanceMetrics).where(and(eq(agentPerformanceMetrics.agentRoleId, agentRoleId), eq(agentPerformanceMetrics.userId, userId))).orderBy(desc(agentPerformanceMetrics.createdAt));
  }
  async createAgentPerformanceMetric(metric: InsertAgentPerformanceMetric): Promise<AgentPerformanceMetric> {
    const [created] = await db.insert(agentPerformanceMetrics).values(metric).returning();
    return created;
  }
  async updateAgentPerformanceMetric(id: string, updates: Partial<AgentPerformanceMetric>): Promise<AgentPerformanceMetric | undefined> {
    const [updated] = await db.update(agentPerformanceMetrics).set(updates).where(eq(agentPerformanceMetrics.id, id)).returning();
    return updated;
  }

  async getAgentConversations(userId: string): Promise<AgentConversation[]> {
    return db.select().from(agentConversations).where(eq(agentConversations.userId, userId)).orderBy(desc(agentConversations.updatedAt));
  }
  async getAgentConversation(id: string, userId: string): Promise<AgentConversation | undefined> {
    const [conv] = await db.select().from(agentConversations).where(and(eq(agentConversations.id, id), eq(agentConversations.userId, userId)));
    return conv;
  }
  async createAgentConversation(conv: InsertAgentConversation): Promise<AgentConversation> {
    const [created] = await db.insert(agentConversations).values(conv).returning();
    return created;
  }
  async updateAgentConversation(id: string, updates: Partial<AgentConversation>): Promise<void> {
    await db.update(agentConversations).set(updates).where(eq(agentConversations.id, id));
  }
  async getAgentMessages(conversationId: string): Promise<AgentMessage[]> {
    return db.select().from(agentMessages).where(eq(agentMessages.conversationId, conversationId)).orderBy(agentMessages.createdAt);
  }
  async createAgentMessage(msg: InsertAgentMessage): Promise<AgentMessage> {
    const [created] = await db.insert(agentMessages).values(msg).returning();
    return created;
  }

  async getAgentNotifications(userId: string, filters?: { agentRoleId?: string; severity?: string; actionStatus?: string; type?: string }): Promise<AgentNotification[]> {
    const conditions = [eq(agentNotifications.userId, userId)];
    if (filters?.agentRoleId) conditions.push(eq(agentNotifications.agentRoleId, filters.agentRoleId));
    if (filters?.severity) conditions.push(eq(agentNotifications.severity, filters.severity));
    if (filters?.actionStatus) conditions.push(eq(agentNotifications.actionStatus, filters.actionStatus));
    if (filters?.type) conditions.push(eq(agentNotifications.type, filters.type));
    return db.select().from(agentNotifications).where(and(...conditions)).orderBy(desc(agentNotifications.createdAt));
  }

  async getAgentNotification(id: string, userId: string): Promise<AgentNotification | undefined> {
    const [notification] = await db.select().from(agentNotifications).where(and(eq(agentNotifications.id, id), eq(agentNotifications.userId, userId)));
    return notification;
  }

  async createAgentNotification(notification: InsertAgentNotification): Promise<AgentNotification> {
    const [created] = await db.insert(agentNotifications).values(notification).returning();
    return created;
  }

  async updateAgentNotification(id: string, userId: string, updates: Partial<AgentNotification>): Promise<AgentNotification | undefined> {
    const [updated] = await db.update(agentNotifications).set(updates).where(and(eq(agentNotifications.id, id), eq(agentNotifications.userId, userId))).returning();
    return updated;
  }

  async getUserManagedAgents(userId: string): Promise<UserManagedAgent[]> {
    return db.select().from(userManagedAgents).where(eq(userManagedAgents.userId, userId));
  }

  async setUserManagedAgents(userId: string, agentRoleIds: string[]): Promise<UserManagedAgent[]> {
    await db.delete(userManagedAgents).where(eq(userManagedAgents.userId, userId));
    if (agentRoleIds.length === 0) return [];
    const values = agentRoleIds.map(agentRoleId => ({ userId, agentRoleId }));
    return db.insert(userManagedAgents).values(values).returning();
  }

  async getThresholdCalibrations(userId: string): Promise<ThresholdCalibration[]> {
    return db.select().from(thresholdCalibrations).where(eq(thresholdCalibrations.userId, userId)).orderBy(desc(thresholdCalibrations.createdAt));
  }

  async createThresholdCalibration(cal: InsertThresholdCalibration): Promise<ThresholdCalibration> {
    const [created] = await db.insert(thresholdCalibrations).values(cal).returning();
    return created;
  }

  async updateThresholdCalibration(id: string, updates: Partial<ThresholdCalibration>): Promise<ThresholdCalibration | undefined> {
    const [updated] = await db.update(thresholdCalibrations).set(updates).where(eq(thresholdCalibrations.id, id)).returning();
    return updated;
  }

  async getMonitoredApplications(userId: string, filters?: { assetId?: string; criticality?: string; status?: string }): Promise<MonitoredApplication[]> {
    const conditions = [eq(monitoredApplications.userId, userId)];
    if (filters?.assetId) conditions.push(eq(monitoredApplications.assetId, filters.assetId));
    if (filters?.criticality) conditions.push(eq(monitoredApplications.criticality, filters.criticality));
    if (filters?.status) conditions.push(eq(monitoredApplications.status, filters.status));
    return db.select().from(monitoredApplications).where(and(...conditions)).orderBy(desc(monitoredApplications.createdAt));
  }

  async createMonitoredApplication(app: InsertMonitoredApplication): Promise<MonitoredApplication> {
    const [created] = await db.insert(monitoredApplications).values(app).returning();
    return created;
  }

  async updateMonitoredApplication(id: string, updates: Partial<MonitoredApplication>): Promise<MonitoredApplication | undefined> {
    const [updated] = await db.update(monitoredApplications).set(updates).where(eq(monitoredApplications.id, id)).returning();
    return updated;
  }

  async deleteMonitoredApplicationsByAsset(assetId: string): Promise<void> {
    await db.delete(monitoredApplications).where(eq(monitoredApplications.assetId, assetId));
  }

  async getApplicationTopologies(userId: string): Promise<ApplicationTopology[]> {
    return db.select().from(applicationTopologies).where(eq(applicationTopologies.userId, userId)).orderBy(desc(applicationTopologies.createdAt));
  }

  async createApplicationTopology(topo: InsertApplicationTopology): Promise<ApplicationTopology> {
    const [created] = await db.insert(applicationTopologies).values(topo).returning();
    return created;
  }

  async updateApplicationTopology(id: string, userId: string, updates: Partial<ApplicationTopology>): Promise<ApplicationTopology | undefined> {
    const [updated] = await db.update(applicationTopologies).set(updates).where(and(eq(applicationTopologies.id, id), eq(applicationTopologies.userId, userId))).returning();
    return updated;
  }

  async deleteApplicationTopologies(userId: string): Promise<void> {
    await db.delete(applicationTopologies).where(eq(applicationTopologies.userId, userId));
  }

  async getRemediationTasks(assetId: string, userId: string): Promise<RemediationTask[]> {
    return db.select().from(remediationTasks).where(and(eq(remediationTasks.assetId, assetId), eq(remediationTasks.userId, userId))).orderBy(desc(remediationTasks.createdAt));
  }

  async getRemediationTasksByBatch(batchId: string, userId: string): Promise<RemediationTask[]> {
    return db.select().from(remediationTasks).where(and(eq(remediationTasks.batchId, batchId), eq(remediationTasks.userId, userId))).orderBy(remediationTasks.createdAt);
  }

  async getRemediationTask(id: string): Promise<RemediationTask | undefined> {
    const [task] = await db.select().from(remediationTasks).where(eq(remediationTasks.id, id));
    return task;
  }

  async createRemediationTask(task: InsertRemediationTask): Promise<RemediationTask> {
    const [created] = await db.insert(remediationTasks).values(task).returning();
    return created;
  }

  async updateRemediationTask(id: string, updates: Partial<RemediationTask>): Promise<RemediationTask | undefined> {
    const [updated] = await db.update(remediationTasks).set(updates).where(eq(remediationTasks.id, id)).returning();
    return updated;
  }

  async clearCompletedRemediationTasks(assetId: string, userId: string): Promise<number> {
    const deleted = await db.delete(remediationTasks).where(
      and(
        eq(remediationTasks.assetId, assetId),
        eq(remediationTasks.userId, userId),
        sql`${remediationTasks.status} IN ('completed', 'failed', 'rejected')`
      )
    ).returning();
    return deleted.length;
  }

  async getPendingTasksForProbe(probeId: string): Promise<RemediationTask[]> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const allDispatched = await db.select().from(remediationTasks).where(
      and(
        eq(remediationTasks.probeId, probeId),
        eq(remediationTasks.status, "dispatched"),
        sql`${remediationTasks.dispatchedAt} < ${fiveMinAgo}`
      )
    ).orderBy(remediationTasks.createdAt);

    const retryable: RemediationTask[] = [];
    for (const task of allDispatched) {
      // Auto-fail only if the task has been dispatched for more than 2 hours with no response.
      // Using dispatchedAt (not approvedAt) so probes that were offline and reconnect
      // still get their tasks re-dispatched rather than immediately auto-failed.
      if (task.dispatchedAt && task.dispatchedAt < twoHoursAgo) {
        await this.updateRemediationTask(task.id, {
          status: "failed",
          completedAt: new Date(),
          error: "Probe did not execute task after 2 hours. The probe may be offline or running an older version that doesn't support remediation. Reset the task and retry when the probe is online."
        });
        console.log(`[REMEDIATION] Auto-failed task ${task.id} (${task.title}) — no probe response after 2 hours`);
      } else {
        retryable.push(task);
      }
    }

    const queued = await db.select().from(remediationTasks).where(and(eq(remediationTasks.probeId, probeId), eq(remediationTasks.status, "queued"))).orderBy(remediationTasks.createdAt);
    return [...queued, ...retryable];
  }

  async getPendingRollbacksForProbe(probeId: string): Promise<RemediationTask[]> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const stuckDispatched = await db.select().from(remediationTasks).where(
      and(
        eq(remediationTasks.probeId, probeId),
        eq(remediationTasks.rollbackStatus, "dispatched"),
        sql`${remediationTasks.rollbackDispatchedAt} < ${fiveMinAgo}`
      )
    ).orderBy(remediationTasks.createdAt);

    const retryable: RemediationTask[] = [];
    for (const task of stuckDispatched) {
      if (task.rollbackDispatchedAt && task.rollbackDispatchedAt < thirtyMinAgo) {
        await this.updateRemediationTask(task.id, {
          rollbackStatus: "failed",
          rollbackedAt: new Date(),
          rollbackError: "Probe did not execute rollback after 30 minutes. The probe may be offline or running an older version."
        });
      } else {
        retryable.push(task);
      }
    }

    const pending = await db.select().from(remediationTasks).where(
      and(eq(remediationTasks.probeId, probeId), eq(remediationTasks.rollbackStatus, "pending"))
    ).orderBy(remediationTasks.createdAt);
    return [...pending, ...retryable];
  }

  async getQueuedTasksWithEmptyScripts(): Promise<RemediationTask[]> {
    return db.select().from(remediationTasks).where(
      and(
        eq(remediationTasks.status, "queued"),
        sql`(${remediationTasks.remediationScript} IS NULL OR TRIM(${remediationTasks.remediationScript}) = '')`
      )
    ).orderBy(remediationTasks.createdAt);
  }

  async getServiceMetrics(userId: string): Promise<ServiceMetric[]> {
    return db.select().from(serviceMetrics).where(eq(serviceMetrics.userId, userId)).orderBy(serviceMetrics.category, serviceMetrics.name);
  }
  async getAllServiceMetrics(): Promise<ServiceMetric[]> {
    return db.select().from(serviceMetrics).orderBy(serviceMetrics.category, serviceMetrics.name);
  }
  async getServiceMetric(id: string): Promise<ServiceMetric | undefined> {
    const [m] = await db.select().from(serviceMetrics).where(eq(serviceMetrics.id, id));
    return m;
  }
  async createServiceMetric(metric: InsertServiceMetric): Promise<ServiceMetric> {
    const [m] = await db.insert(serviceMetrics).values(metric).returning();
    return m;
  }
  async updateServiceMetric(id: string, updates: Partial<ServiceMetric>): Promise<ServiceMetric | undefined> {
    const [m] = await db.update(serviceMetrics).set(updates).where(eq(serviceMetrics.id, id)).returning();
    return m;
  }
  async deleteServiceMetric(id: string): Promise<boolean> {
    const [m] = await db.delete(serviceMetrics).where(eq(serviceMetrics.id, id)).returning();
    return !!m;
  }

  async getServiceMetricAssignments(userId: string, filters?: { metricId?: string; assetId?: string }): Promise<ServiceMetricAssignment[]> {
    const conditions = [eq(serviceMetricAssignments.userId, userId)];
    if (filters?.metricId) conditions.push(eq(serviceMetricAssignments.metricId, filters.metricId));
    if (filters?.assetId) conditions.push(eq(serviceMetricAssignments.assetId, filters.assetId));
    return db.select().from(serviceMetricAssignments).where(and(...conditions));
  }
  async getServiceMetricAssignmentById(id: string): Promise<ServiceMetricAssignment | undefined> {
    const [a] = await db.select().from(serviceMetricAssignments).where(eq(serviceMetricAssignments.id, id));
    return a;
  }
  async getAssignmentsByAssetId(assetId: string): Promise<ServiceMetricAssignment[]> {
    return db.select().from(serviceMetricAssignments).where(eq(serviceMetricAssignments.assetId, assetId));
  }
  async createServiceMetricAssignment(assignment: InsertServiceMetricAssignment): Promise<ServiceMetricAssignment> {
    const [a] = await db.insert(serviceMetricAssignments).values(assignment).returning();
    return a;
  }
  async updateServiceMetricAssignment(id: string, updates: Partial<ServiceMetricAssignment>): Promise<ServiceMetricAssignment | undefined> {
    const [a] = await db.update(serviceMetricAssignments).set(updates).where(eq(serviceMetricAssignments.id, id)).returning();
    return a;
  }
  async deleteServiceMetricAssignment(id: string): Promise<boolean> {
    const [a] = await db.delete(serviceMetricAssignments).where(eq(serviceMetricAssignments.id, id)).returning();
    return !!a;
  }

  async getMissionCriticalGroups(userId: string): Promise<MissionCriticalGroup[]> {
    return db.select().from(missionCriticalGroups).where(eq(missionCriticalGroups.userId, userId)).orderBy(missionCriticalGroups.name);
  }
  async getMissionCriticalGroup(id: string): Promise<MissionCriticalGroup | undefined> {
    const [g] = await db.select().from(missionCriticalGroups).where(eq(missionCriticalGroups.id, id));
    return g;
  }
  async createMissionCriticalGroup(group: InsertMissionCriticalGroup): Promise<MissionCriticalGroup> {
    const [g] = await db.insert(missionCriticalGroups).values(group).returning();
    return g;
  }
  async updateMissionCriticalGroup(id: string, updates: Partial<MissionCriticalGroup>): Promise<MissionCriticalGroup | undefined> {
    const [g] = await db.update(missionCriticalGroups).set(updates).where(eq(missionCriticalGroups.id, id)).returning();
    return g;
  }
  async deleteMissionCriticalGroup(id: string): Promise<boolean> {
    const [g] = await db.delete(missionCriticalGroups).where(eq(missionCriticalGroups.id, id)).returning();
    return !!g;
  }

  async getAgentMetricProfiles(userId: string, roleId?: string): Promise<AgentMetricProfile[]> {
    if (roleId) {
      return db.select().from(agentMetricProfiles).where(and(eq(agentMetricProfiles.userId, userId), eq(agentMetricProfiles.roleId, roleId)));
    }
    return db.select().from(agentMetricProfiles).where(eq(agentMetricProfiles.userId, userId));
  }
  async getAgentMetricProfile(id: string): Promise<AgentMetricProfile | undefined> {
    const [p] = await db.select().from(agentMetricProfiles).where(eq(agentMetricProfiles.id, id));
    return p;
  }
  async createAgentMetricProfile(profile: InsertAgentMetricProfile): Promise<AgentMetricProfile> {
    const [p] = await db.insert(agentMetricProfiles).values(profile).returning();
    return p;
  }
  async deleteAgentMetricProfile(id: string): Promise<boolean> {
    const [p] = await db.delete(agentMetricProfiles).where(eq(agentMetricProfiles.id, id)).returning();
    return !!p;
  }
  async deleteAgentMetricProfilesByRole(roleId: string, userId: string): Promise<number> {
    const deleted = await db.delete(agentMetricProfiles).where(and(eq(agentMetricProfiles.roleId, roleId), eq(agentMetricProfiles.userId, userId))).returning();
    return deleted.length;
  }

  async getAgentOperationalInsights(userId: string, roleId: string): Promise<AgentOperationalInsights | undefined> {
    const [row] = await db.select().from(agentOperationalInsights).where(and(eq(agentOperationalInsights.userId, userId), eq(agentOperationalInsights.roleId, roleId)));
    return row;
  }
  async getAllAgentOperationalInsights(userId: string): Promise<AgentOperationalInsights[]> {
    return db.select().from(agentOperationalInsights).where(eq(agentOperationalInsights.userId, userId));
  }
  async createAgentOperationalInsights(insights: InsertAgentOperationalInsights): Promise<AgentOperationalInsights> {
    const [row] = await db.insert(agentOperationalInsights).values(insights).returning();
    return row;
  }
  async deleteAgentOperationalInsightsByRole(roleId: string, userId: string): Promise<boolean> {
    const [row] = await db.delete(agentOperationalInsights).where(and(eq(agentOperationalInsights.roleId, roleId), eq(agentOperationalInsights.userId, userId))).returning();
    return !!row;
  }

  async getScheduledActivities(userId: string): Promise<AgentScheduledActivity[]> {
    return db.select().from(agentScheduledActivities).where(eq(agentScheduledActivities.userId, userId)).orderBy(agentScheduledActivities.scheduledDate);
  }
  async getScheduledActivitiesByRole(userId: string, roleId: string): Promise<AgentScheduledActivity[]> {
    return db.select().from(agentScheduledActivities).where(and(eq(agentScheduledActivities.userId, userId), eq(agentScheduledActivities.roleId, roleId))).orderBy(agentScheduledActivities.scheduledDate);
  }
  async createScheduledActivity(activity: InsertAgentScheduledActivity): Promise<AgentScheduledActivity> {
    const [row] = await db.insert(agentScheduledActivities).values(activity).returning();
    return row;
  }
  async updateScheduledActivityStatus(id: string, userId: string, status: string, notes?: string): Promise<AgentScheduledActivity | undefined> {
    const updates: Record<string, any> = { status };
    if (status === "completed") updates.completedAt = new Date();
    if (notes) updates.executionNotes = notes;
    const [row] = await db.update(agentScheduledActivities).set(updates).where(and(eq(agentScheduledActivities.id, id), eq(agentScheduledActivities.userId, userId))).returning();
    return row;
  }
  async approveScheduledActivity(id: string, approvedBy: string): Promise<AgentScheduledActivity | undefined> {
    const [row] = await db.update(agentScheduledActivities).set({ status: "approved", approvedBy, approvedAt: new Date() }).where(and(eq(agentScheduledActivities.id, id), eq(agentScheduledActivities.userId, approvedBy))).returning();
    return row;
  }
  async deleteScheduledActivity(id: string, userId: string): Promise<boolean> {
    const [row] = await db.delete(agentScheduledActivities).where(and(eq(agentScheduledActivities.id, id), eq(agentScheduledActivities.userId, userId))).returning();
    return !!row;
  }
  async deleteScheduledActivitiesByRole(roleId: string, userId: string): Promise<number> {
    const deleted = await db.delete(agentScheduledActivities).where(and(eq(agentScheduledActivities.roleId, roleId), eq(agentScheduledActivities.userId, userId))).returning();
    return deleted.length;
  }

  async getCacheTemplate(userId: string, cacheCategory: string, cacheKey: string): Promise<AiTemplateCache | undefined> {
    const [row] = await db.select().from(aiTemplateCache).where(
      and(
        eq(aiTemplateCache.userId, userId),
        eq(aiTemplateCache.cacheCategory, cacheCategory),
        eq(aiTemplateCache.cacheKey, cacheKey),
        gt(aiTemplateCache.expiresAt, new Date())
      )
    );
    return row;
  }

  async setCacheTemplate(template: InsertAiTemplateCache): Promise<AiTemplateCache> {
    const [row] = await db.insert(aiTemplateCache).values(template)
      .onConflictDoUpdate({
        target: [aiTemplateCache.userId, aiTemplateCache.cacheCategory, aiTemplateCache.cacheKey],
        set: {
          responseData: template.responseData,
          tokensSaved: template.tokensSaved,
          expiresAt: template.expiresAt,
          createdAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async incrementCacheHit(id: string): Promise<void> {
    await db.update(aiTemplateCache).set({ hitCount: sql`${aiTemplateCache.hitCount} + 1` }).where(eq(aiTemplateCache.id, id));
  }

  async getCacheTemplates(userId: string): Promise<AiTemplateCache[]> {
    return db.select().from(aiTemplateCache).where(eq(aiTemplateCache.userId, userId)).orderBy(desc(aiTemplateCache.createdAt));
  }

  async invalidateCacheTemplate(id: string, userId: string): Promise<boolean> {
    const [row] = await db.delete(aiTemplateCache).where(and(eq(aiTemplateCache.id, id), eq(aiTemplateCache.userId, userId))).returning();
    return !!row;
  }

  async invalidateCacheByCategory(userId: string, category: string): Promise<number> {
    const deleted = await db.delete(aiTemplateCache).where(and(eq(aiTemplateCache.userId, userId), eq(aiTemplateCache.cacheCategory, category))).returning();
    return deleted.length;
  }

  async invalidateExpiredCaches(): Promise<number> {
    const deleted = await db.delete(aiTemplateCache).where(lt(aiTemplateCache.expiresAt, new Date())).returning();
    return deleted.length;
  }

  async getCacheStats(userId: string): Promise<{ total: number; totalHits: number; totalTokensSaved: number; byCategory: Record<string, { count: number; hits: number; tokensSaved: number }> }> {
    const entries = await db.select().from(aiTemplateCache).where(eq(aiTemplateCache.userId, userId));
    const byCategory: Record<string, { count: number; hits: number; tokensSaved: number }> = {};
    let totalHits = 0;
    let totalTokensSaved = 0;
    for (const e of entries) {
      totalHits += e.hitCount;
      totalTokensSaved += e.tokensSaved;
      if (!byCategory[e.cacheCategory]) byCategory[e.cacheCategory] = { count: 0, hits: 0, tokensSaved: 0 };
      byCategory[e.cacheCategory].count++;
      byCategory[e.cacheCategory].hits += e.hitCount;
      byCategory[e.cacheCategory].tokensSaved += e.tokensSaved;
    }
    return { total: entries.length, totalHits, totalTokensSaved, byCategory };
  }

  async getAiProviders(userId: string): Promise<AiProvider[]> {
    return db.select().from(aiProviders).where(eq(aiProviders.userId, userId)).orderBy(desc(aiProviders.isDefault), desc(aiProviders.createdAt));
  }

  async getAiProvider(id: string, userId: string): Promise<AiProvider | undefined> {
    const [row] = await db.select().from(aiProviders).where(and(eq(aiProviders.id, id), eq(aiProviders.userId, userId)));
    return row;
  }

  async getDefaultAiProvider(userId: string): Promise<AiProvider | undefined> {
    const [row] = await db.select().from(aiProviders).where(and(eq(aiProviders.userId, userId), eq(aiProviders.isDefault, true), eq(aiProviders.enabled, true)));
    return row;
  }

  async createAiProvider(provider: InsertAiProvider): Promise<AiProvider> {
    const [row] = await db.insert(aiProviders).values(provider).returning();
    return row;
  }

  async updateAiProvider(id: string, userId: string, updates: Partial<AiProvider>): Promise<AiProvider | undefined> {
    const [row] = await db.update(aiProviders).set(updates).where(and(eq(aiProviders.id, id), eq(aiProviders.userId, userId))).returning();
    return row;
  }

  async deleteAiProvider(id: string, userId: string): Promise<boolean> {
    const [row] = await db.delete(aiProviders).where(and(eq(aiProviders.id, id), eq(aiProviders.userId, userId))).returning();
    return !!row;
  }

  async setDefaultAiProvider(id: string, userId: string): Promise<void> {
    await db.update(aiProviders).set({ isDefault: false }).where(eq(aiProviders.userId, userId));
    await db.update(aiProviders).set({ isDefault: true }).where(and(eq(aiProviders.id, id), eq(aiProviders.userId, userId)));
  }

  async getClusterNodes(probeId: string): Promise<ProbeClusterNode[]> {
    return db.select().from(probeClusterNodes).where(eq(probeClusterNodes.probeId, probeId));
  }
  async getClusterNode(id: string): Promise<ProbeClusterNode | undefined> {
    const [row] = await db.select().from(probeClusterNodes).where(eq(probeClusterNodes.id, id));
    return row;
  }
  async createClusterNode(node: InsertProbeClusterNode): Promise<ProbeClusterNode> {
    const [created] = await db.insert(probeClusterNodes).values(node).returning();
    return created;
  }
  async updateClusterNode(id: string, updates: Partial<ProbeClusterNode>): Promise<ProbeClusterNode | undefined> {
    const [row] = await db.update(probeClusterNodes).set(updates).where(eq(probeClusterNodes.id, id)).returning();
    return row;
  }
  async deleteClusterNode(id: string): Promise<boolean> {
    const [row] = await db.delete(probeClusterNodes).where(eq(probeClusterNodes.id, id)).returning();
    return !!row;
  }

  async getProbeCredentialLinks(probeId: string): Promise<ProbeCredentialLink[]> {
    return db.select().from(probeCredentialLinks).where(eq(probeCredentialLinks.probeId, probeId));
  }
  async addProbeCredentialLink(probeId: string, credentialId: string): Promise<ProbeCredentialLink> {
    const existing = await db.select().from(probeCredentialLinks).where(and(eq(probeCredentialLinks.probeId, probeId), eq(probeCredentialLinks.credentialId, credentialId)));
    if (existing.length > 0) return existing[0];
    const [created] = await db.insert(probeCredentialLinks).values({ probeId, credentialId }).returning();
    return created;
  }
  async removeProbeCredentialLink(probeId: string, credentialId: string): Promise<boolean> {
    const [row] = await db.delete(probeCredentialLinks).where(and(eq(probeCredentialLinks.probeId, probeId), eq(probeCredentialLinks.credentialId, credentialId))).returning();
    return !!row;
  }

  async getBcpPlans(userId: string): Promise<BcpPlan[]> {
    return db.select().from(bcpPlans).where(eq(bcpPlans.userId, userId)).orderBy(desc(bcpPlans.updatedAt));
  }
  async getBcpPlan(id: string): Promise<BcpPlan | undefined> {
    const [row] = await db.select().from(bcpPlans).where(eq(bcpPlans.id, id));
    return row;
  }
  async createBcpPlan(plan: InsertBcpPlan): Promise<BcpPlan> {
    const [row] = await db.insert(bcpPlans).values(plan).returning();
    return row;
  }
  async updateBcpPlan(id: string, updates: Partial<BcpPlan>): Promise<BcpPlan | undefined> {
    const [row] = await db.update(bcpPlans).set({ ...updates, updatedAt: new Date() }).where(eq(bcpPlans.id, id)).returning();
    return row;
  }

  async getDrpPlans(userId: string): Promise<DrpPlan[]> {
    return db.select().from(drpPlans).where(eq(drpPlans.userId, userId)).orderBy(desc(drpPlans.updatedAt));
  }
  async getDrpPlan(id: string): Promise<DrpPlan | undefined> {
    const [row] = await db.select().from(drpPlans).where(eq(drpPlans.id, id));
    return row;
  }
  async createDrpPlan(plan: InsertDrpPlan): Promise<DrpPlan> {
    const [row] = await db.insert(drpPlans).values(plan).returning();
    return row;
  }
  async updateDrpPlan(id: string, updates: Partial<DrpPlan>): Promise<DrpPlan | undefined> {
    const [row] = await db.update(drpPlans).set({ ...updates, updatedAt: new Date() }).where(eq(drpPlans.id, id)).returning();
    return row;
  }

  async getBiaEntries(userId: string): Promise<BiaEntry[]> {
    return db.select().from(bcpBiaEntries).where(eq(bcpBiaEntries.userId, userId)).orderBy(desc(bcpBiaEntries.updatedAt));
  }
  async getBiaEntry(id: string): Promise<BiaEntry | undefined> {
    const [row] = await db.select().from(bcpBiaEntries).where(eq(bcpBiaEntries.id, id));
    return row;
  }
  async createBiaEntry(entry: InsertBiaEntry): Promise<BiaEntry> {
    const [row] = await db.insert(bcpBiaEntries).values(entry).returning();
    return row;
  }
  async updateBiaEntry(id: string, updates: Partial<BiaEntry>): Promise<BiaEntry | undefined> {
    const [row] = await db.update(bcpBiaEntries).set({ ...updates, updatedAt: new Date() }).where(eq(bcpBiaEntries.id, id)).returning();
    return row;
  }

  async getRiskAssessments(userId: string): Promise<RiskAssessment[]> {
    return db.select().from(bcpRiskAssessments).where(eq(bcpRiskAssessments.userId, userId)).orderBy(desc(bcpRiskAssessments.updatedAt));
  }
  async getRiskAssessment(id: string): Promise<RiskAssessment | undefined> {
    const [row] = await db.select().from(bcpRiskAssessments).where(eq(bcpRiskAssessments.id, id));
    return row;
  }
  async createRiskAssessment(entry: InsertRiskAssessment): Promise<RiskAssessment> {
    const [row] = await db.insert(bcpRiskAssessments).values(entry).returning();
    return row;
  }
  async updateRiskAssessment(id: string, updates: Partial<RiskAssessment>): Promise<RiskAssessment | undefined> {
    const [row] = await db.update(bcpRiskAssessments).set({ ...updates, updatedAt: new Date() }).where(eq(bcpRiskAssessments.id, id)).returning();
    return row;
  }

  async getDrills(userId: string): Promise<Drill[]> {
    return db.select().from(bcpDrills).where(eq(bcpDrills.userId, userId)).orderBy(desc(bcpDrills.updatedAt));
  }
  async getDrill(id: string): Promise<Drill | undefined> {
    const [row] = await db.select().from(bcpDrills).where(eq(bcpDrills.id, id));
    return row;
  }
  async createDrill(drill: InsertDrill): Promise<Drill> {
    const [row] = await db.insert(bcpDrills).values(drill).returning();
    return row;
  }
  async updateDrill(id: string, updates: Partial<Drill>): Promise<Drill | undefined> {
    const [row] = await db.update(bcpDrills).set({ ...updates, updatedAt: new Date() }).where(eq(bcpDrills.id, id)).returning();
    return row;
  }

  async getReviews(userId: string): Promise<Review[]> {
    return db.select().from(bcpReviews).where(eq(bcpReviews.userId, userId)).orderBy(desc(bcpReviews.updatedAt));
  }
  async getReview(id: string): Promise<Review | undefined> {
    const [row] = await db.select().from(bcpReviews).where(eq(bcpReviews.id, id));
    return row;
  }
  async createReview(review: InsertReview): Promise<Review> {
    const [row] = await db.insert(bcpReviews).values(review).returning();
    return row;
  }
  async updateReview(id: string, updates: Partial<Review>): Promise<Review | undefined> {
    const [row] = await db.update(bcpReviews).set({ ...updates, updatedAt: new Date() }).where(eq(bcpReviews.id, id)).returning();
    return row;
  }

  // ============ KEDB ============
  async getKnownErrors(): Promise<KnownError[]> {
    return db.select().from(knownErrors).orderBy(desc(knownErrors.createdAt));
  }
  async getKnownError(id: number): Promise<KnownError | undefined> {
    const [row] = await db.select().from(knownErrors).where(eq(knownErrors.id, id));
    return row;
  }
  async createKnownError(data: InsertKnownError): Promise<KnownError> {
    const count = await db.select({ c: sql<number>`count(*)` }).from(knownErrors);
    const next = (Number(count[0].c) + 1).toString().padStart(4, "0");
    const kedbId = `KE-${next}`;
    const [row] = await db.insert(knownErrors).values({ ...data, kedbId }).returning();
    return row;
  }
  async updateKnownError(id: number, updates: Partial<KnownError>): Promise<KnownError | undefined> {
    const [row] = await db.update(knownErrors).set({ ...updates, updatedAt: new Date() }).where(eq(knownErrors.id, id)).returning();
    return row;
  }
  async deleteKnownError(id: number): Promise<void> {
    await db.delete(knownErrors).where(eq(knownErrors.id, id));
  }

  // ============ SLA Breaches ============
  async getSlaBreaches(): Promise<SlaBreach[]> {
    return db.select().from(slaBreaches).orderBy(desc(slaBreaches.occurredAt));
  }
  async createSlaBreach(data: InsertSlaBreach): Promise<SlaBreach> {
    const [row] = await db.insert(slaBreaches).values(data).returning();
    return row;
  }
  async acknowledgeSlaBreach(id: number, userId: string): Promise<SlaBreach | undefined> {
    const [row] = await db.update(slaBreaches).set({ acknowledgedAt: new Date(), acknowledgedBy: userId }).where(eq(slaBreaches.id, id)).returning();
    return row;
  }
  async computeSlaBreaches(userId: string): Promise<{ created: number }> {
    const defs = await db.select().from(slaDefinitions);
    const allIncidents = await db.select().from(incidents);
    const allSRs = await db.select().from(serviceRequests);
    const existingBreaches = await db.select().from(slaBreaches);
    const existingKeys = new Set(existingBreaches.map(b => `${b.entityType}:${b.entityId}:${b.breachType}`));
    const now = new Date();
    let created = 0;

    const priorityMap: Record<string, { responseTimeMinutes: number; resolutionTimeMinutes: number }> = {};
    for (const def of defs) {
      priorityMap[def.priority] = { responseTimeMinutes: def.responseTimeMinutes, resolutionTimeMinutes: def.resolutionTimeMinutes };
    }

    const checkBreach = async (entityType: string, entity: any, ref: string) => {
      const p = entity.priority || "medium";
      const thresholds = priorityMap[p] || { responseTimeMinutes: 240, resolutionTimeMinutes: 1440 };
      const createdAt = new Date(entity.createdAt || entity.createdAt);
      const resolvedAt = entity.resolvedAt ? new Date(entity.resolvedAt) : null;
      const isOpen = !["resolved", "fulfilled", "closed", "cancelled"].includes(entity.status);

      // Response breach: check if first response was within SLA (we use createdAt as proxy if no responseAt)
      const responseKey = `${entityType}:${entity.id}:response`;
      if (!existingKeys.has(responseKey)) {
        const compareTime = resolvedAt || now;
        const elapsedMinutes = Math.floor((compareTime.getTime() - createdAt.getTime()) / 60000);
        if (elapsedMinutes > thresholds.responseTimeMinutes) {
          await db.insert(slaBreaches).values({
            entityType, entityId: entity.id, entityRef: ref,
            breachType: "response", breachMinutes: elapsedMinutes - thresholds.responseTimeMinutes,
            priority: p, assignedTo: entity.assignedTo || null,
            occurredAt: new Date(createdAt.getTime() + thresholds.responseTimeMinutes * 60000),
          });
          created++;
        }
      }

      // Resolution breach: only if open or resolved late
      const resolutionKey = `${entityType}:${entity.id}:resolution`;
      if (!existingKeys.has(resolutionKey)) {
        if (!isOpen && resolvedAt) {
          const elapsedMinutes = Math.floor((resolvedAt.getTime() - createdAt.getTime()) / 60000);
          if (elapsedMinutes > thresholds.resolutionTimeMinutes) {
            await db.insert(slaBreaches).values({
              entityType, entityId: entity.id, entityRef: ref,
              breachType: "resolution", breachMinutes: elapsedMinutes - thresholds.resolutionTimeMinutes,
              priority: p, assignedTo: entity.assignedTo || null,
              occurredAt: resolvedAt,
            });
            created++;
          }
        } else if (isOpen) {
          const elapsedMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
          if (elapsedMinutes > thresholds.resolutionTimeMinutes) {
            await db.insert(slaBreaches).values({
              entityType, entityId: entity.id, entityRef: ref,
              breachType: "resolution", breachMinutes: elapsedMinutes - thresholds.resolutionTimeMinutes,
              priority: p, assignedTo: entity.assignedTo || null,
              occurredAt: new Date(createdAt.getTime() + thresholds.resolutionTimeMinutes * 60000),
            });
            created++;
          }
        }
      }
    };

    for (const inc of allIncidents) {
      await checkBreach("incident", inc, inc.incidentId || `INC-${inc.id}`);
    }
    for (const sr of allSRs) {
      await checkBreach("service_request", sr, sr.requestId || `SR-${sr.id}`);
    }
    return { created };
  }

  // ============ CSI Register ============
  async getCsiItems(): Promise<CsiRegisterItem[]> {
    return db.select().from(csiRegister).orderBy(desc(csiRegister.createdAt));
  }
  async getCsiItem(id: number): Promise<CsiRegisterItem | undefined> {
    const [row] = await db.select().from(csiRegister).where(eq(csiRegister.id, id));
    return row;
  }
  async createCsiItem(data: InsertCsiRegister): Promise<CsiRegisterItem> {
    const count = await db.select({ c: sql<number>`count(*)` }).from(csiRegister);
    const next = (Number(count[0].c) + 1).toString().padStart(4, "0");
    const csiId = `CSI-${next}`;
    const [row] = await db.insert(csiRegister).values({ ...data, csiId }).returning();
    return row;
  }
  async updateCsiItem(id: number, updates: Partial<CsiRegisterItem>): Promise<CsiRegisterItem | undefined> {
    const [row] = await db.update(csiRegister).set({ ...updates, updatedAt: new Date() }).where(eq(csiRegister.id, id)).returning();
    return row;
  }
  async deleteCsiItem(id: number): Promise<void> {
    await db.delete(csiRegister).where(eq(csiRegister.id, id));
  }

  // ============ Releases ============
  async getReleases(): Promise<Release[]> {
    return db.select().from(releases).orderBy(desc(releases.createdAt));
  }
  async getRelease(id: number): Promise<Release | undefined> {
    const [row] = await db.select().from(releases).where(eq(releases.id, id));
    return row;
  }
  async createRelease(data: InsertRelease): Promise<Release> {
    const count = await db.select({ c: sql<number>`count(*)` }).from(releases);
    const next = (Number(count[0].c) + 1).toString().padStart(4, "0");
    const releaseId = `REL-${next}`;
    const [row] = await db.insert(releases).values({ ...data, releaseId }).returning();
    return row;
  }
  async updateRelease(id: number, updates: Partial<Release>): Promise<Release | undefined> {
    const [row] = await db.update(releases).set({ ...updates, updatedAt: new Date() }).where(eq(releases.id, id)).returning();
    return row;
  }
  async deleteRelease(id: number): Promise<void> {
    await db.delete(releaseItems).where(eq(releaseItems.releaseId, id));
    await db.delete(releases).where(eq(releases.id, id));
  }
  async getReleaseItems(releaseId: number): Promise<ReleaseItem[]> {
    return db.select().from(releaseItems).where(eq(releaseItems.releaseId, releaseId));
  }
  async createReleaseItem(data: InsertReleaseItem): Promise<ReleaseItem> {
    const [row] = await db.insert(releaseItems).values(data).returning();
    return row;
  }
  async updateReleaseItem(id: number, updates: Partial<ReleaseItem>): Promise<ReleaseItem | undefined> {
    const [row] = await db.update(releaseItems).set(updates).where(eq(releaseItems.id, id)).returning();
    return row;
  }
  async deleteReleaseItem(id: number): Promise<void> {
    await db.delete(releaseItems).where(eq(releaseItems.id, id));
  }

  async getServiceReadings(filters?: { serviceName?: string; metricType?: string; limit?: number }): Promise<ServiceReading[]> {
    const conditions = [];
    if (filters?.serviceName) conditions.push(eq(serviceReadings.serviceName, filters.serviceName));
    if (filters?.metricType) conditions.push(eq(serviceReadings.metricType, filters.metricType));
    const q = db.select().from(serviceReadings);
    if (conditions.length > 0) q.where(and(...conditions) as any);
    q.orderBy(desc(serviceReadings.measuredAt));
    if (filters?.limit) q.limit(filters.limit);
    return q;
  }

  async createServiceReading(reading: InsertServiceReading): Promise<ServiceReading> {
    const [r] = await db.insert(serviceReadings).values(reading).returning();
    return r;
  }

  async createServiceReadingsBatch(readings: InsertServiceReading[]): Promise<ServiceReading[]> {
    if (readings.length === 0) return [];
    return db.insert(serviceReadings).values(readings).returning();
  }

  async deleteServiceReadingsByService(serviceName: string): Promise<void> {
    await db.delete(serviceReadings).where(eq(serviceReadings.serviceName, serviceName));
  }

  async getCapacityThresholds(userId: string, serviceName?: string): Promise<CapacityThreshold[]> {
    const conds = [eq(capacityThresholds.userId, userId)];
    if (serviceName) conds.push(eq(capacityThresholds.serviceName, serviceName));
    return db.select().from(capacityThresholds).where(and(...conds)).orderBy(capacityThresholds.serviceName);
  }

  async upsertCapacityThreshold(threshold: InsertCapacityThreshold): Promise<CapacityThreshold> {
    const [row] = await db.insert(capacityThresholds).values(threshold)
      .onConflictDoUpdate({
        target: [capacityThresholds.userId, capacityThresholds.serviceName, capacityThresholds.metricType],
        set: {
          warningThreshold: threshold.warningThreshold,
          criticalThreshold: threshold.criticalThreshold,
          higherIsBetter: threshold.higherIsBetter,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async deleteCapacityThreshold(id: string, userId: string): Promise<void> {
    await db.delete(capacityThresholds).where(and(eq(capacityThresholds.id, id), eq(capacityThresholds.userId, userId)));
  }

  async getCapacityActions(userId: string, filters?: { serviceName?: string; status?: string }): Promise<CapacityAction[]> {
    const conds = [eq(capacityActions.userId, userId)];
    if (filters?.serviceName) conds.push(eq(capacityActions.serviceName, filters.serviceName));
    if (filters?.status) conds.push(eq(capacityActions.status, filters.status));
    return db.select().from(capacityActions).where(and(...conds)).orderBy(desc(capacityActions.createdAt));
  }

  async createCapacityAction(action: InsertCapacityAction): Promise<CapacityAction> {
    const [row] = await db.insert(capacityActions).values(action).returning();
    return row;
  }

  async updateCapacityAction(id: string, userId: string, updates: Partial<InsertCapacityAction & { resolvedAt: Date | null }>): Promise<CapacityAction> {
    const [row] = await db.update(capacityActions).set(updates as any)
      .where(and(eq(capacityActions.id, id), eq(capacityActions.userId, userId)))
      .returning();
    return row;
  }

  async deleteCapacityAction(id: string, userId: string): Promise<void> {
    await db.delete(capacityActions).where(and(eq(capacityActions.id, id), eq(capacityActions.userId, userId)));
  }

  async getCapacityDemandEvents(userId: string, serviceName?: string): Promise<CapacityDemandEvent[]> {
    const conds = [eq(capacityDemandEvents.userId, userId)];
    if (serviceName) conds.push(eq(capacityDemandEvents.serviceName, serviceName));
    return db.select().from(capacityDemandEvents).where(and(...conds)).orderBy(capacityDemandEvents.plannedDate);
  }

  async createCapacityDemandEvent(event: InsertCapacityDemandEvent): Promise<CapacityDemandEvent> {
    const [row] = await db.insert(capacityDemandEvents).values(event).returning();
    return row;
  }

  async updateCapacityDemandEvent(id: string, userId: string, updates: Partial<InsertCapacityDemandEvent>): Promise<CapacityDemandEvent> {
    const [row] = await db.update(capacityDemandEvents).set(updates as any)
      .where(and(eq(capacityDemandEvents.id, id), eq(capacityDemandEvents.userId, userId)))
      .returning();
    return row;
  }

  async deleteCapacityDemandEvent(id: string, userId: string): Promise<void> {
    await db.delete(capacityDemandEvents).where(and(eq(capacityDemandEvents.id, id), eq(capacityDemandEvents.userId, userId)));
  }

  // ── Log Sources ─────────────────────────────────────────────────────────────
  async getLogSources(userId: string): Promise<LogSource[]> {
    return db.select().from(logSources).where(eq(logSources.userId, userId)).orderBy(desc(logSources.createdAt));
  }
  async createLogSource(data: InsertLogSource): Promise<LogSource> {
    const [r] = await db.insert(logSources).values(data).returning();
    return r;
  }
  async updateLogSource(id: string, userId: string, updates: Partial<InsertLogSource & { lastSeen: Date; logCount: number }>): Promise<LogSource> {
    const [r] = await db.update(logSources).set(updates).where(and(eq(logSources.id, id), eq(logSources.userId, userId))).returning();
    return r;
  }
  async deleteLogSource(id: string, userId: string): Promise<void> {
    await db.delete(logSources).where(and(eq(logSources.id, id), eq(logSources.userId, userId)));
  }

  // ── Log Entries ─────────────────────────────────────────────────────────────
  async getLogEntries(userId: string, filters?: {
    sourceId?: string; deviceId?: string; level?: string; host?: string;
    service?: string; q?: string; from?: Date; to?: Date; limit?: number; offset?: number;
  }): Promise<LogEntry[]> {
    const conds = [eq(logEntries.userId, userId)];
    if (filters?.sourceId) conds.push(eq(logEntries.sourceId, filters.sourceId));
    if (filters?.deviceId) conds.push(eq(logEntries.deviceId, filters.deviceId));
    if (filters?.level) conds.push(eq(logEntries.level, filters.level));
    if (filters?.host) conds.push(eq(logEntries.host, filters.host));
    if (filters?.service) conds.push(eq(logEntries.service, filters.service));
    if (filters?.q) conds.push(ilike(logEntries.message, `%${filters.q}%`));
    if (filters?.from) conds.push(gt(logEntries.logTimestamp, filters.from));
    if (filters?.to) conds.push(lt(logEntries.logTimestamp, filters.to));
    return db.select().from(logEntries)
      .where(and(...conds))
      .orderBy(desc(logEntries.logTimestamp))
      .limit(filters?.limit ?? 50)
      .offset(filters?.offset ?? 0);
  }
  async countLogEntries(userId: string, filters?: { level?: string; sourceId?: string }): Promise<number> {
    const conds = [eq(logEntries.userId, userId)];
    if (filters?.level) conds.push(eq(logEntries.level, filters.level));
    if (filters?.sourceId) conds.push(eq(logEntries.sourceId, filters.sourceId));
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(logEntries).where(and(...conds));
    return r?.count ?? 0;
  }
  async createLogEntry(entry: InsertLogEntry): Promise<LogEntry> {
    const [r] = await db.insert(logEntries).values(entry).returning();
    return r;
  }
  async createLogEntriesBatch(entries: InsertLogEntry[]): Promise<number> {
    if (!entries.length) return 0;
    await db.insert(logEntries).values(entries);
    return entries.length;
  }
  async deleteLogEntry(id: string, userId: string): Promise<void> {
    await db.delete(logEntries).where(and(eq(logEntries.id, id), eq(logEntries.userId, userId)));
  }
  async purgeExpiredLogs(userId: string, retentionDays: number, sourceId?: string): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86400000);
    const conds = [eq(logEntries.userId, userId), lt(logEntries.logTimestamp, cutoff)];
    if (sourceId) conds.push(eq(logEntries.sourceId, sourceId));
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(logEntries).where(and(...conds));
    await db.delete(logEntries).where(and(...conds));
    return r?.count ?? 0;
  }

  // ── Log Retention Policies ──────────────────────────────────────────────────
  async getLogRetentionPolicies(userId: string): Promise<LogRetentionPolicy[]> {
    return db.select().from(logRetentionPolicies).where(eq(logRetentionPolicies.userId, userId)).orderBy(desc(logRetentionPolicies.createdAt));
  }
  async createLogRetentionPolicy(data: InsertLogRetentionPolicy): Promise<LogRetentionPolicy> {
    const [r] = await db.insert(logRetentionPolicies).values(data).returning();
    return r;
  }
  async deleteLogRetentionPolicy(id: string, userId: string): Promise<void> {
    await db.delete(logRetentionPolicies).where(and(eq(logRetentionPolicies.id, id), eq(logRetentionPolicies.userId, userId)));
  }

  // ── MDM Devices ─────────────────────────────────────────────────────────────
  async getMdmDevices(userId: string, filters?: { platform?: string; status?: string; complianceStatus?: string }): Promise<MdmDevice[]> {
    const conds = [eq(mdmDevices.userId, userId)];
    if (filters?.platform && filters.platform !== "all") conds.push(eq(mdmDevices.platform, filters.platform));
    if (filters?.status && filters.status !== "all") conds.push(eq(mdmDevices.status, filters.status));
    if (filters?.complianceStatus && filters.complianceStatus !== "all") conds.push(eq(mdmDevices.complianceStatus, filters.complianceStatus));
    return db.select().from(mdmDevices).where(and(...conds)).orderBy(desc(mdmDevices.createdAt));
  }
  async getMdmDevice(id: string, userId: string): Promise<MdmDevice | undefined> {
    const [r] = await db.select().from(mdmDevices).where(and(eq(mdmDevices.id, id), eq(mdmDevices.userId, userId)));
    return r;
  }
  async createMdmDevice(data: InsertMdmDevice & { enrollmentDate?: Date; lastCheckIn?: Date }): Promise<MdmDevice> {
    const [r] = await db.insert(mdmDevices).values(data).returning();
    return r;
  }
  async updateMdmDevice(id: string, userId: string, updates: Partial<MdmDevice>): Promise<MdmDevice> {
    const [r] = await db.update(mdmDevices).set(updates).where(and(eq(mdmDevices.id, id), eq(mdmDevices.userId, userId))).returning();
    return r;
  }
  async deleteMdmDevice(id: string, userId: string): Promise<void> {
    await db.delete(mdmDevices).where(and(eq(mdmDevices.id, id), eq(mdmDevices.userId, userId)));
  }
  async getMdmStats(userId: string): Promise<{ total: number; enrolled: number; pending: number; blocked: number; retired: number; compliant: number; nonCompliant: number; ios: number; android: number }> {
    const devices = await db.select().from(mdmDevices).where(eq(mdmDevices.userId, userId));
    return {
      total: devices.length,
      enrolled: devices.filter(d => d.status === "enrolled").length,
      pending: devices.filter(d => d.status === "pending").length,
      blocked: devices.filter(d => d.status === "blocked").length,
      retired: devices.filter(d => d.status === "retired").length,
      compliant: devices.filter(d => d.complianceStatus === "compliant").length,
      nonCompliant: devices.filter(d => d.complianceStatus === "non_compliant").length,
      ios: devices.filter(d => d.platform === "ios").length,
      android: devices.filter(d => d.platform === "android").length,
    };
  }

  // ── MDM Policies ─────────────────────────────────────────────────────────────
  async getMdmPolicies(userId: string): Promise<MdmPolicy[]> {
    return db.select().from(mdmPolicies).where(eq(mdmPolicies.userId, userId)).orderBy(desc(mdmPolicies.createdAt));
  }
  async getMdmPolicy(id: string, userId: string): Promise<MdmPolicy | undefined> {
    const [r] = await db.select().from(mdmPolicies).where(and(eq(mdmPolicies.id, id), eq(mdmPolicies.userId, userId)));
    return r;
  }
  async createMdmPolicy(data: InsertMdmPolicy): Promise<MdmPolicy> {
    const [r] = await db.insert(mdmPolicies).values(data).returning();
    return r;
  }
  async updateMdmPolicy(id: string, userId: string, updates: Partial<MdmPolicy>): Promise<MdmPolicy> {
    const [r] = await db.update(mdmPolicies).set(updates).where(and(eq(mdmPolicies.id, id), eq(mdmPolicies.userId, userId))).returning();
    return r;
  }
  async deleteMdmPolicy(id: string, userId: string): Promise<void> {
    await db.delete(mdmPolicies).where(and(eq(mdmPolicies.id, id), eq(mdmPolicies.userId, userId)));
  }

  // ── MDM Enrollment Tokens ────────────────────────────────────────────────────
  async createMdmEnrollmentToken(data: InsertMdmEnrollmentToken): Promise<MdmEnrollmentToken> {
    const [r] = await db.insert(mdmEnrollmentTokens).values(data).returning();
    return r;
  }
  async getMdmEnrollmentToken(token: string): Promise<MdmEnrollmentToken | undefined> {
    const [r] = await db.select().from(mdmEnrollmentTokens).where(eq(mdmEnrollmentTokens.token, token));
    return r;
  }
  async getMdmEnrollmentTokensByUser(userId: string): Promise<MdmEnrollmentToken[]> {
    return db.select().from(mdmEnrollmentTokens).where(eq(mdmEnrollmentTokens.userId, userId)).orderBy(desc(mdmEnrollmentTokens.createdAt));
  }
  async markMdmEnrollmentTokenUsed(token: string, deviceId: string): Promise<void> {
    await db.update(mdmEnrollmentTokens).set({ usedAt: new Date(), deviceId }).where(eq(mdmEnrollmentTokens.token, token));
  }
  async deleteMdmEnrollmentToken(id: string, userId: string): Promise<void> {
    await db.delete(mdmEnrollmentTokens).where(and(eq(mdmEnrollmentTokens.id, id), eq(mdmEnrollmentTokens.userId, userId)));
  }

  // ── MDM Actions ──────────────────────────────────────────────────────────────
  async getMdmActions(userId: string, deviceId?: string): Promise<MdmAction[]> {
    const conds = [eq(mdmActions.userId, userId)];
    if (deviceId) conds.push(eq(mdmActions.deviceId, deviceId));
    return db.select().from(mdmActions).where(and(...conds)).orderBy(desc(mdmActions.createdAt));
  }
  async createMdmAction(data: InsertMdmAction): Promise<MdmAction> {
    const [r] = await db.insert(mdmActions).values(data).returning();
    return r;
  }
  async updateMdmAction(id: string, updates: Partial<MdmAction>): Promise<MdmAction> {
    const [r] = await db.update(mdmActions).set(updates).where(eq(mdmActions.id, id)).returning();
    return r;
  }

  // ── Command Catalog ───────────────────────────────────────────────────────
  async getCommandCatalog(userId: string, filters?: { status?: string; category?: string }): Promise<CommandCatalogEntry[]> {
    const conds: any[] = [eq(commandCatalog.userId, userId)];
    if (filters?.status) conds.push(eq(commandCatalog.status, filters.status));
    if (filters?.category) conds.push(eq(commandCatalog.category, filters.category));
    return db.select().from(commandCatalog).where(and(...conds)).orderBy(desc(commandCatalog.createdAt));
  }
  async getCommandCatalogEntry(id: string, userId: string): Promise<CommandCatalogEntry | undefined> {
    const [r] = await db.select().from(commandCatalog).where(and(eq(commandCatalog.id, id), eq(commandCatalog.userId, userId)));
    return r;
  }
  async createCommandCatalogEntry(entry: InsertCommandCatalog): Promise<CommandCatalogEntry> {
    const [r] = await db.insert(commandCatalog).values(entry).returning();
    return r;
  }
  async updateCommandCatalogEntry(id: string, userId: string, updates: Partial<CommandCatalogEntry>): Promise<CommandCatalogEntry | undefined> {
    const [r] = await db.update(commandCatalog).set({ ...updates, updatedAt: new Date() }).where(and(eq(commandCatalog.id, id), eq(commandCatalog.userId, userId))).returning();
    return r;
  }
  async deleteCommandCatalogEntry(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(commandCatalog).where(and(eq(commandCatalog.id, id), eq(commandCatalog.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async incrementCatalogUsage(id: string): Promise<void> {
    await db.update(commandCatalog).set({ usageCount: sql`${commandCatalog.usageCount} + 1`, updatedAt: new Date() }).where(eq(commandCatalog.id, id));
  }
  async updateCatalogAiReview(id: string, review: {
    aiReviewStatus: string; aiReviewVerdict: string; aiReviewScore: number;
    aiReviewNotes: any; aiReviewAt: Date; aiReviewCacheHit: boolean;
  }): Promise<CommandCatalogEntry | undefined> {
    const [r] = await db.update(commandCatalog).set({ ...review, updatedAt: new Date() }).where(eq(commandCatalog.id, id)).returning();
    return r;
  }

  // ── User scope management ─────────────────────────────────────────────────
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.displayName);
  }
  async updateUserCommandScopes(userId: string, scopes: string[]): Promise<User | undefined> {
    const [u] = await db.update(users).set({ commandScopes: scopes }).where(eq(users.id, userId)).returning();
    return u;
  }

  // ── Command Schedules ─────────────────────────────────────────────────────
  async getCommandSchedules(userId: string): Promise<CommandSchedule[]> {
    return db.select().from(commandSchedules).where(eq(commandSchedules.userId, userId)).orderBy(desc(commandSchedules.createdAt));
  }
  async getCommandSchedule(id: string, userId: string): Promise<CommandSchedule | undefined> {
    const [r] = await db.select().from(commandSchedules).where(and(eq(commandSchedules.id, id), eq(commandSchedules.userId, userId)));
    return r;
  }
  async createCommandSchedule(s: InsertCommandSchedule): Promise<CommandSchedule> {
    const [r] = await db.insert(commandSchedules).values(s).returning();
    return r;
  }
  async updateCommandSchedule(id: string, userId: string, updates: Partial<CommandSchedule>): Promise<CommandSchedule | undefined> {
    const [r] = await db.update(commandSchedules).set({ ...updates, updatedAt: new Date() }).where(and(eq(commandSchedules.id, id), eq(commandSchedules.userId, userId))).returning();
    return r;
  }
  async deleteCommandSchedule(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(commandSchedules).where(and(eq(commandSchedules.id, id), eq(commandSchedules.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async getDueSchedules(): Promise<CommandSchedule[]> {
    return db.select().from(commandSchedules).where(
      and(eq(commandSchedules.enabled, true), lt(commandSchedules.nextRunAt, new Date()))
    );
  }

  // ── Command Approvals ─────────────────────────────────────────────────────
  async getCommandApprovals(filters?: { status?: string; userId?: string }): Promise<CommandApproval[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(commandApprovals.status, filters.status));
    if (filters?.userId) conditions.push(eq(commandApprovals.requestedById, filters.userId));
    const query = db.select().from(commandApprovals).orderBy(desc(commandApprovals.requestedAt));
    if (conditions.length > 0) return query.where(and(...conditions));
    return query;
  }
  async getCommandApproval(id: string): Promise<CommandApproval | undefined> {
    const [r] = await db.select().from(commandApprovals).where(eq(commandApprovals.id, id));
    return r;
  }
  async createCommandApproval(a: InsertCommandApproval): Promise<CommandApproval> {
    const [r] = await db.insert(commandApprovals).values(a).returning();
    return r;
  }
  async updateCommandApproval(id: string, updates: Partial<CommandApproval>): Promise<CommandApproval | undefined> {
    const [r] = await db.update(commandApprovals).set(updates).where(eq(commandApprovals.id, id)).returning();
    return r;
  }

  // ── Command History ───────────────────────────────────────────────────────
  async getCommandHistory(userId: string, filters?: { status?: string; assetId?: string; limit?: number; offset?: number }): Promise<{ tasks: RemediationTask[]; total: number }> {
    const conditions = [eq(remediationTasks.userId, userId)];
    if (filters?.status) conditions.push(eq(remediationTasks.status, filters.status));
    if (filters?.assetId) conditions.push(eq(remediationTasks.assetId, filters.assetId));
    const lim = filters?.limit ?? 100;
    const off = filters?.offset ?? 0;
    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(remediationTasks).where(and(...conditions));
    const tasks = await db.select().from(remediationTasks).where(and(...conditions)).orderBy(desc(remediationTasks.createdAt)).limit(lim).offset(off);
    return { tasks, total: countRow.count };
  }

  // ── Patches ────────────────────────────────────────────────────────────────
  async getPatches(userId: string, filters?: { status?: string; severity?: string }): Promise<Patch[]> {
    const conditions = [eq(patches.userId, userId)];
    if (filters?.status) conditions.push(eq(patches.status, filters.status));
    if (filters?.severity) conditions.push(eq(patches.severity, filters.severity));
    return db.select().from(patches).where(and(...conditions)).orderBy(desc(patches.aiPriority), desc(patches.cvssScore));
  }
  async getPatch(id: string, userId: string): Promise<Patch | undefined> {
    const [r] = await db.select().from(patches).where(and(eq(patches.id, id), eq(patches.userId, userId)));
    return r;
  }
  async createPatch(p: InsertPatch): Promise<Patch> {
    const [r] = await db.insert(patches).values(p as any).returning();
    return r;
  }
  async updatePatch(id: string, userId: string, updates: Partial<Patch>): Promise<Patch | undefined> {
    const [r] = await db.update(patches).set({ ...updates, updatedAt: new Date() } as any).where(and(eq(patches.id, id), eq(patches.userId, userId))).returning();
    return r;
  }
  async deletePatch(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(patches).where(and(eq(patches.id, id), eq(patches.userId, userId)));
    return (r as any).rowCount > 0;
  }

  // ── Patch Jobs ─────────────────────────────────────────────────────────────
  async getPatchJobs(userId: string, patchId?: string): Promise<PatchJob[]> {
    const conditions = [eq(patchJobs.userId, userId)];
    if (patchId) conditions.push(eq(patchJobs.patchId, patchId));
    return db.select().from(patchJobs).where(and(...conditions)).orderBy(desc(patchJobs.createdAt));
  }
  async getPatchJob(id: string): Promise<PatchJob | undefined> {
    const [r] = await db.select().from(patchJobs).where(eq(patchJobs.id, id));
    return r;
  }
  async createPatchJob(j: InsertPatchJob): Promise<PatchJob> {
    const [r] = await db.insert(patchJobs).values(j as any).returning();
    return r;
  }
  async updatePatchJob(id: string, updates: Partial<PatchJob>): Promise<PatchJob | undefined> {
    const [r] = await db.update(patchJobs).set(updates as any).where(eq(patchJobs.id, id)).returning();
    return r;
  }

  // ── Autonomous Validation ───────────────────────────────────────────────────
  async getValidationProviders(userId: string): Promise<ValidationProvider[]> {
    return db.select().from(validationProviders).where(eq(validationProviders.userId, userId)).orderBy(desc(validationProviders.createdAt));
  }
  async getValidationProvider(id: string, userId: string): Promise<ValidationProvider | undefined> {
    const [r] = await db.select().from(validationProviders).where(and(eq(validationProviders.id, id), eq(validationProviders.userId, userId)));
    return r;
  }
  async createValidationProvider(p: InsertValidationProvider): Promise<ValidationProvider> {
    const [r] = await db.insert(validationProviders).values(p as any).returning();
    return r;
  }
  async updateValidationProvider(id: string, userId: string, updates: Partial<ValidationProvider>): Promise<ValidationProvider | undefined> {
    const [r] = await db.update(validationProviders).set(updates as any).where(and(eq(validationProviders.id, id), eq(validationProviders.userId, userId))).returning();
    return r;
  }
  async deleteValidationProvider(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(validationProviders).where(and(eq(validationProviders.id, id), eq(validationProviders.userId, userId)));
    return (r as any).rowCount > 0;
  }

  async getValidationEnvironments(userId: string): Promise<ValidationEnvironment[]> {
    return db.select().from(validationEnvironments).where(eq(validationEnvironments.userId, userId)).orderBy(desc(validationEnvironments.createdAt));
  }
  async getValidationEnvironment(id: string, userId: string): Promise<ValidationEnvironment | undefined> {
    const [r] = await db.select().from(validationEnvironments).where(and(eq(validationEnvironments.id, id), eq(validationEnvironments.userId, userId)));
    return r;
  }
  async createValidationEnvironment(e: InsertValidationEnvironment): Promise<ValidationEnvironment> {
    const [r] = await db.insert(validationEnvironments).values(e as any).returning();
    return r;
  }
  async updateValidationEnvironment(id: string, userId: string, updates: Partial<ValidationEnvironment>): Promise<ValidationEnvironment | undefined> {
    const [r] = await db.update(validationEnvironments).set(updates as any).where(and(eq(validationEnvironments.id, id), eq(validationEnvironments.userId, userId))).returning();
    return r;
  }
  async deleteValidationEnvironment(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(validationEnvironments).where(and(eq(validationEnvironments.id, id), eq(validationEnvironments.userId, userId)));
    return (r as any).rowCount > 0;
  }

  async getValidationVirtualAssets(environmentId: string, userId: string): Promise<ValidationVirtualAsset[]> {
    return db.select().from(validationVirtualAssets).where(and(eq(validationVirtualAssets.environmentId, environmentId), eq(validationVirtualAssets.userId, userId))).orderBy(validationVirtualAssets.name);
  }
  async createValidationVirtualAsset(a: InsertValidationVirtualAsset): Promise<ValidationVirtualAsset> {
    const [r] = await db.insert(validationVirtualAssets).values(a as any).returning();
    return r;
  }
  async deleteValidationVirtualAssets(environmentId: string, userId: string): Promise<void> {
    await db.delete(validationVirtualAssets).where(and(eq(validationVirtualAssets.environmentId, environmentId), eq(validationVirtualAssets.userId, userId)));
  }

  async getValidationProbeDeployments(userId: string, environmentId?: string): Promise<ValidationProbeDeployment[]> {
    const conditions = [eq(validationProbeDeployments.userId, userId)];
    if (environmentId) conditions.push(eq(validationProbeDeployments.environmentId, environmentId));
    return db.select().from(validationProbeDeployments).where(and(...conditions)).orderBy(desc(validationProbeDeployments.createdAt));
  }
  async getValidationProbeDeployment(id: string, userId: string): Promise<ValidationProbeDeployment | undefined> {
    const [r] = await db.select().from(validationProbeDeployments).where(and(eq(validationProbeDeployments.id, id), eq(validationProbeDeployments.userId, userId)));
    return r;
  }
  async createValidationProbeDeployment(d: InsertValidationProbeDeployment): Promise<ValidationProbeDeployment> {
    const [r] = await db.insert(validationProbeDeployments).values(d as any).returning();
    return r;
  }
  async updateValidationProbeDeployment(id: string, userId: string, updates: Partial<ValidationProbeDeployment>): Promise<ValidationProbeDeployment | undefined> {
    const [r] = await db.update(validationProbeDeployments).set(updates as any).where(and(eq(validationProbeDeployments.id, id), eq(validationProbeDeployments.userId, userId))).returning();
    return r;
  }
  async deleteValidationProbeDeployment(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(validationProbeDeployments).where(and(eq(validationProbeDeployments.id, id), eq(validationProbeDeployments.userId, userId)));
    return (r as any).rowCount > 0;
  }

  async getValidationTests(userId: string, environmentId?: string): Promise<ValidationTest[]> {
    const conditions = [eq(validationTests.userId, userId)];
    if (environmentId) conditions.push(eq(validationTests.environmentId, environmentId));
    return db.select().from(validationTests).where(and(...conditions)).orderBy(desc(validationTests.createdAt));
  }
  async getValidationTest(id: string, userId: string): Promise<ValidationTest | undefined> {
    const [r] = await db.select().from(validationTests).where(and(eq(validationTests.id, id), eq(validationTests.userId, userId)));
    return r;
  }
  async createValidationTest(t: InsertValidationTest): Promise<ValidationTest> {
    const [r] = await db.insert(validationTests).values(t as any).returning();
    return r;
  }
  async deleteValidationTest(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(validationTests).where(and(eq(validationTests.id, id), eq(validationTests.userId, userId)));
    return (r as any).rowCount > 0;
  }

  async getValidationTestRuns(userId: string, testId?: string): Promise<ValidationTestRun[]> {
    const conditions = [eq(validationTestRuns.userId, userId)];
    if (testId) conditions.push(eq(validationTestRuns.testId, testId));
    return db.select().from(validationTestRuns).where(and(...conditions)).orderBy(desc(validationTestRuns.createdAt));
  }
  async getValidationTestRun(id: string, userId: string): Promise<ValidationTestRun | undefined> {
    const [r] = await db.select().from(validationTestRuns).where(and(eq(validationTestRuns.id, id), eq(validationTestRuns.userId, userId)));
    return r;
  }
  async createValidationTestRun(r: InsertValidationTestRun): Promise<ValidationTestRun> {
    const [row] = await db.insert(validationTestRuns).values(r as any).returning();
    return row;
  }
  async updateValidationTestRun(id: string, userId: string, updates: Partial<ValidationTestRun>): Promise<ValidationTestRun | undefined> {
    const [r] = await db.update(validationTestRuns).set(updates as any).where(and(eq(validationTestRuns.id, id), eq(validationTestRuns.userId, userId))).returning();
    return r;
  }

  async getValidationReports(userId: string): Promise<ValidationReport[]> {
    return db.select().from(validationReports).where(eq(validationReports.userId, userId)).orderBy(desc(validationReports.createdAt));
  }
  async getValidationReport(id: string, userId: string): Promise<ValidationReport | undefined> {
    const [r] = await db.select().from(validationReports).where(and(eq(validationReports.id, id), eq(validationReports.userId, userId)));
    return r;
  }
  async createValidationReport(r: InsertValidationReport): Promise<ValidationReport> {
    const [row] = await db.insert(validationReports).values(r as any).returning();
    return row;
  }
  async updateValidationReport(id: string, userId: string, updates: Partial<ValidationReport>): Promise<ValidationReport | undefined> {
    const [r] = await db.update(validationReports).set(updates as any).where(and(eq(validationReports.id, id), eq(validationReports.userId, userId))).returning();
    return r;
  }
  async deleteValidationReport(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(validationReports).where(and(eq(validationReports.id, id), eq(validationReports.userId, userId)));
    return (r as any).rowCount > 0;
  }

  async getValidationProbeConfigs(userId: string): Promise<ValidationProbeConfig[]> {
    return db.select().from(validationProbeConfigs).where(eq(validationProbeConfigs.userId, userId)).orderBy(desc(validationProbeConfigs.createdAt));
  }
  async getValidationProbeConfig(id: string, userId: string): Promise<ValidationProbeConfig | undefined> {
    const [r] = await db.select().from(validationProbeConfigs).where(and(eq(validationProbeConfigs.id, id), eq(validationProbeConfigs.userId, userId)));
    return r;
  }
  async createValidationProbeConfig(c: InsertValidationProbeConfig): Promise<ValidationProbeConfig> {
    const [r] = await db.insert(validationProbeConfigs).values(c as any).returning();
    return r;
  }
  async updateValidationProbeConfig(id: string, userId: string, updates: Partial<ValidationProbeConfig>): Promise<ValidationProbeConfig | undefined> {
    const [r] = await db.update(validationProbeConfigs).set(updates as any).where(and(eq(validationProbeConfigs.id, id), eq(validationProbeConfigs.userId, userId))).returning();
    return r;
  }
  async deleteValidationProbeConfig(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(validationProbeConfigs).where(and(eq(validationProbeConfigs.id, id), eq(validationProbeConfigs.userId, userId)));
    return (r as any).rowCount > 0;
  }

  // ── Configuration Management ────────────────────────────────────────────────
  async getConfigRfcs(userId: string, filters?: { assetId?: string; status?: string }): Promise<ConfigRfc[]> {
    let q = db.select().from(configRfcs).where(eq(configRfcs.userId, userId)).$dynamic();
    if (filters?.assetId) q = q.where(and(eq(configRfcs.userId, userId), eq(configRfcs.assetId, filters.assetId))) as any;
    if (filters?.status) q = q.where(and(eq(configRfcs.userId, userId), eq(configRfcs.status, filters.status))) as any;
    return (q as any).orderBy(desc(configRfcs.createdAt));
  }
  async getConfigRfc(id: string, userId: string): Promise<ConfigRfc | undefined> {
    const [r] = await db.select().from(configRfcs).where(and(eq(configRfcs.id, id), eq(configRfcs.userId, userId)));
    return r;
  }
  async createConfigRfc(r: InsertConfigRfc): Promise<ConfigRfc> {
    const [row] = await db.insert(configRfcs).values(r as any).returning();
    return row;
  }
  async updateConfigRfc(id: string, userId: string, updates: Partial<ConfigRfc>): Promise<ConfigRfc | undefined> {
    const [r] = await db.update(configRfcs).set(updates as any).where(and(eq(configRfcs.id, id), eq(configRfcs.userId, userId))).returning();
    return r;
  }
  async deleteConfigRfc(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(configRfcs).where(and(eq(configRfcs.id, id), eq(configRfcs.userId, userId)));
    return (r as any).rowCount > 0;
  }
  async getNextRfcNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const rows = await db.select().from(configRfcs).where(eq(configRfcs.userId, userId));
    const seq = String(rows.length + 1).padStart(4, "0");
    return `RFC-${year}-${seq}`;
  }
  async getConfigBaselines(userId: string, assetId?: string): Promise<ConfigBaseline[]> {
    if (assetId) {
      return db.select().from(configBaselines).where(and(eq(configBaselines.userId, userId), eq(configBaselines.assetId, assetId))).orderBy(desc(configBaselines.createdAt));
    }
    return db.select().from(configBaselines).where(eq(configBaselines.userId, userId)).orderBy(desc(configBaselines.createdAt));
  }
  async createConfigBaseline(b: InsertConfigBaseline): Promise<ConfigBaseline> {
    const [row] = await db.insert(configBaselines).values(b as any).returning();
    return row;
  }
  async deleteConfigBaseline(id: string, userId: string): Promise<boolean> {
    const r = await db.delete(configBaselines).where(and(eq(configBaselines.id, id), eq(configBaselines.userId, userId)));
    return (r as any).rowCount > 0;
  }

  async getSecurityIntegrations(userId: string) {
    const { securityIntegrations } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    return db.select().from(securityIntegrations).where(eq(securityIntegrations.userId, userId));
  }

  async upsertSecurityIntegration(userId: string, platform: string, data: Partial<typeof import("@shared/schema").securityIntegrations.$inferSelect>) {
    const { securityIntegrations } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const existing = await db.select().from(securityIntegrations)
      .where(and(eq(securityIntegrations.userId, userId), eq(securityIntegrations.platform, platform)));
    if (existing.length > 0) {
      const [updated] = await db.update(securityIntegrations)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(securityIntegrations.userId, userId), eq(securityIntegrations.platform, platform)))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(securityIntegrations)
        .values({ userId, platform, ...data } as any)
        .returning();
      return created;
    }
  }

  async updateSecurityIntegrationTestStatus(userId: string, platform: string, testStatus: string) {
    const { securityIntegrations } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const [updated] = await db.update(securityIntegrations)
      .set({ testStatus, lastTestedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(securityIntegrations.userId, userId), eq(securityIntegrations.platform, platform)))
      .returning();
    return updated;
  }

  async deleteSecurityIntegration(userId: string, platform: string) {
    const { securityIntegrations } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    const r = await db.delete(securityIntegrations)
      .where(and(eq(securityIntegrations.userId, userId), eq(securityIntegrations.platform, platform)));
    return (r as any).rowCount > 0;
  }

  async getServiceFinancials(): Promise<ServiceFinancial[]> {
    return db.select().from(serviceFinancials).orderBy(desc(serviceFinancials.annualBudget));
  }
  async createServiceFinancial(d: InsertServiceFinancial): Promise<ServiceFinancial> {
    const [r] = await db.insert(serviceFinancials).values(d).returning();
    return r;
  }

  async getSuppliers(): Promise<Supplier[]> {
    return db.select().from(suppliers).orderBy(suppliers.name);
  }
  async createSupplier(d: InsertSupplier): Promise<Supplier> {
    const [r] = await db.insert(suppliers).values(d).returning();
    return r;
  }

  async getSupplierContracts(): Promise<SupplierContract[]> {
    return db.select().from(supplierContracts).orderBy(supplierContracts.endDate);
  }
  async createSupplierContract(d: InsertSupplierContract): Promise<SupplierContract> {
    const [r] = await db.insert(supplierContracts).values(d).returning();
    return r;
  }

  async getDeployments(): Promise<Deployment[]> {
    return db.select().from(deployments).orderBy(desc(deployments.createdAt));
  }
  async createDeployment(d: InsertDeployment): Promise<Deployment> {
    const [r] = await db.insert(deployments).values(d).returning();
    return r;
  }

  async getStakeholders(): Promise<Stakeholder[]> {
    return db.select().from(stakeholders).orderBy(stakeholders.name);
  }
  async createStakeholder(d: InsertStakeholder): Promise<Stakeholder> {
    const [r] = await db.insert(stakeholders).values(d).returning();
    return r;
  }

  async getServiceReviews(): Promise<ServiceReview[]> {
    return db.select().from(serviceReviews).orderBy(desc(serviceReviews.reviewDate));
  }
  async createServiceReview(d: InsertServiceReview): Promise<ServiceReview> {
    const [r] = await db.insert(serviceReviews).values(d).returning();
    return r;
  }

  async getSiemCorrelationRules(): Promise<SiemCorrelationRule[]> {
    return db.select().from(siemCorrelationRules).orderBy(siemCorrelationRules.ruleId);
  }

  async updateSiemCorrelationRule(id: string, patch: Partial<{ status: string; hitCount: number }>): Promise<SiemCorrelationRule | undefined> {
    const [r] = await db
      .update(siemCorrelationRules)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(siemCorrelationRules.id, id))
      .returning();
    return r;
  }

  async markSecurityEventProcessed(id: string): Promise<void> {
    await db
      .update(securityEvents)
      .set({ processed: true })
      .where(eq(securityEvents.id, id));
  }

  // ── Forensics ──────────────────────────────────────────────────────
  async getForensicCases(): Promise<ForensicCase[]> {
    return db.select().from(forensicCases).orderBy(desc(forensicCases.createdAt));
  }

  async getForensicCase(id: string): Promise<ForensicCase | undefined> {
    const [r] = await db.select().from(forensicCases).where(eq(forensicCases.id, id));
    return r;
  }

  async createForensicCase(data: InsertForensicCase): Promise<ForensicCase> {
    const [r] = await db.insert(forensicCases).values(data).returning();
    return r;
  }

  async updateForensicCase(id: string, patch: Partial<ForensicCase>): Promise<ForensicCase | undefined> {
    const [r] = await db
      .update(forensicCases)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(forensicCases.id, id))
      .returning();
    return r;
  }

  async getForensicEvidence(caseId: string): Promise<ForensicEvidence[]> {
    return db.select().from(forensicEvidence)
      .where(eq(forensicEvidence.caseId, caseId))
      .orderBy(forensicEvidence.collectedAt);
  }

  async addForensicEvidence(data: InsertForensicEvidence): Promise<ForensicEvidence> {
    const [r] = await db.insert(forensicEvidence).values(data).returning();
    return r;
  }

  async getForensicTimeline(caseId: string): Promise<ForensicTimeline[]> {
    return db.select().from(forensicTimeline)
      .where(eq(forensicTimeline.caseId, caseId))
      .orderBy(forensicTimeline.eventTime);
  }

  async addForensicTimelineEvent(data: InsertForensicTimeline): Promise<ForensicTimeline> {
    const [r] = await db.insert(forensicTimeline).values(data).returning();
    return r;
  }

  async getForensicIndicators(): Promise<ForensicIndicator[]> {
    return db.select().from(forensicIndicators).orderBy(desc(forensicIndicators.createdAt));
  }

  // ── AI Observability & Governance ──────────────────────────────────────────
  async createAiAuditLog(log: InsertAiAuditLog): Promise<AiAuditLog> {
    const [r] = await db.insert(aiAuditLogs).values(log).returning();
    return r;
  }

  async getAiAuditLogs(filters?: { module?: string; status?: string; riskLevel?: string; requiresReview?: boolean; limit?: number; offset?: number }): Promise<AiAuditLog[]> {
    const conditions: any[] = [];
    if (filters?.module) conditions.push(eq(aiAuditLogs.module, filters.module));
    if (filters?.status) conditions.push(eq(aiAuditLogs.status, filters.status));
    if (filters?.riskLevel) conditions.push(eq(aiAuditLogs.hallucinationRisk, filters.riskLevel));
    if (filters?.requiresReview === true) conditions.push(eq(aiAuditLogs.requiresHumanReview, true));
    const query = db.select().from(aiAuditLogs)
      .$dynamic();
    const base = conditions.length ? query.where(and(...conditions)) : query;
    return base.orderBy(desc(aiAuditLogs.createdAt))
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);
  }

  async getAiGovernanceStats(): Promise<{ totalCalls: number; todayCalls: number; hallucinationFlags: number; schemaFailures: number; injectionAttempts: number; pendingReviews: number; avgLatencyMs: number; totalTokens: number; byModule: { module: string; count: number; flagged: number; avgLatency: number }[] }> {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [totals] = await db.select({
      totalCalls: sql<number>`count(*)::int`,
      todayCalls: sql<number>`count(*) filter (where created_at >= ${today})::int`,
      hallucinationFlags: sql<number>`count(*) filter (where hallucination_risk in ('medium','high'))::int`,
      schemaFailures: sql<number>`count(*) filter (where schema_valid = false)::int`,
      injectionAttempts: sql<number>`count(*) filter (where prompt_injection_detected = true)::int`,
      pendingReviews: sql<number>`count(*) filter (where requires_human_review = true and (human_review_status is null or human_review_status = 'pending'))::int`,
      avgLatencyMs: sql<number>`round(avg(latency_ms))::int`,
      totalTokens: sql<number>`coalesce(sum(total_tokens), 0)::int`,
    }).from(aiAuditLogs);

    const byModule = await db.select({
      module: aiAuditLogs.module,
      count: sql<number>`count(*)::int`,
      flagged: sql<number>`count(*) filter (where hallucination_risk in ('medium','high') or schema_valid = false or prompt_injection_detected = true)::int`,
      avgLatency: sql<number>`round(avg(latency_ms))::int`,
    }).from(aiAuditLogs).groupBy(aiAuditLogs.module).orderBy(desc(sql`count(*)`));

    return { ...totals, byModule };
  }

  async updateAiAuditLogReview(id: number, status: "approved" | "rejected", reviewedBy: string): Promise<AiAuditLog> {
    const [r] = await db.update(aiAuditLogs)
      .set({ humanReviewStatus: status, humanReviewedBy: reviewedBy, humanReviewedAt: new Date() })
      .where(eq(aiAuditLogs.id, id))
      .returning();
    return r;
  }

  async updateAiAuditLogQualityReview(id: number, data: { qualityReviewStatus: string; qualityReviewResult: string; qualityReviewScore: number; qualityReviewFlags: string[] }): Promise<AiAuditLog> {
    const [r] = await db.update(aiAuditLogs)
      .set({
        qualityReviewStatus: data.qualityReviewStatus,
        qualityReviewResult: data.qualityReviewResult,
        qualityReviewScore: data.qualityReviewScore,
        qualityReviewFlags: data.qualityReviewFlags,
      })
      .where(eq(aiAuditLogs.id, id))
      .returning();
    return r;
  }

  async getAiAuditLog(id: number): Promise<AiAuditLog | undefined> {
    const [r] = await db.select().from(aiAuditLogs).where(eq(aiAuditLogs.id, id));
    return r;
  }

  // ── AI Context Store ─────────────────────────────────────────────────────────
  async createAiContextEntry(data: InsertAiContextEntry): Promise<AiContextEntry> {
    const [r] = await db.insert(aiContextEntries).values(data).returning();
    return r;
  }

  async getAiContextEntries(filters?: { module?: string; approvedOnly?: boolean; limit?: number; offset?: number }): Promise<AiContextEntry[]> {
    const conditions = [];
    if (filters?.module) conditions.push(eq(aiContextEntries.module, filters.module));
    if (filters?.approvedOnly) conditions.push(eq(aiContextEntries.approvedForInjection, true));
    const q = db.select().from(aiContextEntries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(aiContextEntries.qualityScore), desc(aiContextEntries.createdAt))
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);
    return q;
  }

  async getAiContextEntriesForInjection(module: string, limit = 3): Promise<AiContextEntry[]> {
    return db.select().from(aiContextEntries)
      .where(and(eq(aiContextEntries.module, module), eq(aiContextEntries.approvedForInjection, true)))
      .orderBy(desc(aiContextEntries.qualityScore))
      .limit(limit);
  }

  async updateAiContextEntry(id: number, data: Partial<AiContextEntry>): Promise<AiContextEntry> {
    const [r] = await db.update(aiContextEntries).set(data).where(eq(aiContextEntries.id, id)).returning();
    return r;
  }

  async deleteAiContextEntry(id: number): Promise<void> {
    await db.delete(aiContextEntries).where(eq(aiContextEntries.id, id));
  }

  // ── Knowledge Base (PGVector) ─────────────────────────────────────────────
  async createKnowledgeDocument(data: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const [r] = await db.insert(knowledgeDocuments).values(data).returning();
    return r;
  }

  async getKnowledgeDocuments(userId?: string): Promise<(KnowledgeDocument & { chunkCount: number })[]> {
    const rows = await db.select().from(knowledgeDocuments)
      .orderBy(desc(knowledgeDocuments.createdAt))
      .limit(200);
    return rows as (KnowledgeDocument & { chunkCount: number })[];
  }

  async deleteKnowledgeDocument(id: number): Promise<void> {
    await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, id));
  }

  async createDocumentChunk(data: { documentId: number; chunkIndex: number; content: string; embedding: number[] }): Promise<DocumentChunk> {
    const embeddingStr = `[${data.embedding.join(",")}]`;
    const result = await db.execute(
      sql`INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
          VALUES (${data.documentId}, ${data.chunkIndex}, ${data.content}, ${embeddingStr}::vector)
          RETURNING id, document_id, chunk_index, content, created_at`
    );
    return result.rows[0] as unknown as DocumentChunk;
  }

  async semanticSearch(embedding: number[], limit = 5): Promise<{ id: number; documentId: number; content: string; documentTitle: string; similarity: number }[]> {
    const embeddingStr = `[${embedding.join(",")}]`;
    const result = await db.execute(
      sql`SELECT dc.id, dc.document_id as "documentId", dc.content,
               kd.title as "documentTitle",
               1 - (dc.embedding <=> ${embeddingStr}::vector) as similarity
          FROM document_chunks dc
          JOIN knowledge_documents kd ON kd.id = dc.document_id
          WHERE dc.embedding IS NOT NULL
          ORDER BY dc.embedding <=> ${embeddingStr}::vector
          LIMIT ${limit}`
    );
    return result.rows as { id: number; documentId: number; content: string; documentTitle: string; similarity: number }[];
  }

  async updateKnowledgeDocumentChunkCount(id: number, chunkCount: number): Promise<void> {
    await db.update(knowledgeDocuments).set({ chunkCount }).where(eq(knowledgeDocuments.id, id));
  }

  async getAiContextStats(): Promise<{ total: number; approved: number; avgQuality: number; totalInjections: number; byModule: { module: string; count: number; approved: number; avgQuality: number }[] }> {
    const all = await db.select().from(aiContextEntries).orderBy(aiContextEntries.module);
    const total = all.length;
    const approved = all.filter(e => e.approvedForInjection).length;
    const avgQuality = total > 0 ? Math.round(all.reduce((s, e) => s + (e.qualityScore ?? 0), 0) / total) : 0;
    const totalInjections = all.reduce((s, e) => s + (e.injectionCount ?? 0), 0);
    const moduleMap: Record<string, { count: number; approved: number; totalQ: number }> = {};
    for (const e of all) {
      if (!moduleMap[e.module]) moduleMap[e.module] = { count: 0, approved: 0, totalQ: 0 };
      moduleMap[e.module].count++;
      if (e.approvedForInjection) moduleMap[e.module].approved++;
      moduleMap[e.module].totalQ += (e.qualityScore ?? 0);
    }
    const byModule = Object.entries(moduleMap).map(([module, v]) => ({
      module,
      count: v.count,
      approved: v.approved,
      avgQuality: v.count > 0 ? Math.round(v.totalQ / v.count) : 0,
    })).sort((a, b) => b.count - a.count);
    return { total, approved, avgQuality, totalInjections, byModule };
  }

  // ── Holocron Conclave ───────────────────────────────────────────────────────
  async createConclave(data: InsertConclave): Promise<Conclave> {
    const [r] = await db.insert(conclaves).values(data).returning();
    return r;
  }

  async getConclaves(userId?: string): Promise<Conclave[]> {
    const base = db.select().from(conclaves);
    const q = userId ? base.where(eq(conclaves.userId, userId)) : base;
    return q.orderBy(desc(conclaves.createdAt)).limit(50);
  }

  async getConclave(id: number): Promise<Conclave | undefined> {
    const [r] = await db.select().from(conclaves).where(eq(conclaves.id, id));
    return r;
  }

  async updateConclave(id: number, data: Partial<Conclave>): Promise<Conclave> {
    const [r] = await db.update(conclaves)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conclaves.id, id))
      .returning();
    return r;
  }

  async deleteConclave(id: number): Promise<void> {
    await db.delete(conclaves).where(eq(conclaves.id, id));
  }

  async createConclaveMessage(msg: InsertConclaveMessage): Promise<ConclaveMessage> {
    const [r] = await db.insert(conclaveMessages).values(msg).returning();
    return r;
  }

  async getConclaveMessages(conclaveId: number): Promise<ConclaveMessage[]> {
    return db.select().from(conclaveMessages)
      .where(eq(conclaveMessages.conclaveId, conclaveId))
      .orderBy(conclaveMessages.round, conclaveMessages.createdAt);
  }

  // ── FLYGUYS OPERATORS ────────────────────────────────────────────────────────
  async getFlyguysOperators(userId: string): Promise<FlyguysOperator[]> {
    return db.select().from(flyguysOperators).where(eq(flyguysOperators.userId, userId)).orderBy(desc(flyguysOperators.createdAt));
  }
  async createFlyguysOperator(data: InsertFlyguysOperator): Promise<FlyguysOperator> {
    const [r] = await db.insert(flyguysOperators).values(data).returning();
    return r;
  }
  async updateFlyguysOperator(id: string, data: Partial<FlyguysOperator>): Promise<FlyguysOperator> {
    const [r] = await db.update(flyguysOperators).set(data).where(eq(flyguysOperators.id, id)).returning();
    return r;
  }
  async deleteFlyguysOperator(id: string): Promise<void> {
    await db.delete(flyguysOperators).where(eq(flyguysOperators.id, id));
  }

  // ── FLYGUYS FLEET ────────────────────────────────────────────────────────────
  async getFlyguysFleet(userId: string): Promise<FlyguysFleet[]> {
    return db.select().from(flyguysFleet).where(eq(flyguysFleet.userId, userId)).orderBy(desc(flyguysFleet.createdAt));
  }
  async getFlyguysFleetByOperator(operatorId: string): Promise<FlyguysFleet[]> {
    return db.select().from(flyguysFleet).where(eq(flyguysFleet.operatorId, operatorId)).orderBy(desc(flyguysFleet.createdAt));
  }
  async createFlyguysFleet(data: InsertFlyguysFleet): Promise<FlyguysFleet> {
    const [r] = await db.insert(flyguysFleet).values(data).returning();
    return r;
  }
  async updateFlyguysFleet(id: string, data: Partial<FlyguysFleet>): Promise<FlyguysFleet> {
    const [r] = await db.update(flyguysFleet).set(data).where(eq(flyguysFleet.id, id)).returning();
    return r;
  }
  async deleteFlyguysFleet(id: string): Promise<void> {
    await db.delete(flyguysFleet).where(eq(flyguysFleet.id, id));
  }

  // ── FLYGUYS REQUESTS ─────────────────────────────────────────────────────────
  async getFlyguysRequests(userId: string): Promise<FlyguysRequest[]> {
    return db.select().from(flyguysRequests).where(eq(flyguysRequests.userId, userId)).orderBy(desc(flyguysRequests.createdAt));
  }
  async getFlyguysRequestsByEmail(email: string): Promise<FlyguysRequest[]> {
    return db.select().from(flyguysRequests).where(eq(flyguysRequests.customerEmail, email.toLowerCase())).orderBy(desc(flyguysRequests.createdAt));
  }
  async getFlyguysAllRequests(): Promise<FlyguysRequest[]> {
    return db.select().from(flyguysRequests).orderBy(desc(flyguysRequests.createdAt));
  }
  async getFlyguysRequestsForStaff(userId: string): Promise<FlyguysRequest[]> {
    // Staff sees their own requests + all portal-submitted requests (userId IS NULL)
    return db.select().from(flyguysRequests)
      .where(or(eq(flyguysRequests.userId, userId), sql`${flyguysRequests.userId} IS NULL`))
      .orderBy(desc(flyguysRequests.createdAt));
  }
  async createFlyguysRequest(data: InsertFlyguysRequest): Promise<FlyguysRequest> {
    const [r] = await db.insert(flyguysRequests).values(data).returning();
    return r;
  }
  async updateFlyguysRequest(id: string, data: Partial<FlyguysRequest>): Promise<FlyguysRequest> {
    const [r] = await db.update(flyguysRequests).set(data).where(eq(flyguysRequests.id, id)).returning();
    return r;
  }
  async deleteFlyguysRequest(id: string): Promise<void> {
    await db.delete(flyguysRequests).where(eq(flyguysRequests.id, id));
  }

  // ── FLYGUYS BIDS ─────────────────────────────────────────────────────────────
  async getFlyguaysBids(userId: string): Promise<FlyguaysBid[]> {
    return db.select().from(flyguaysBids).where(eq(flyguaysBids.userId, userId)).orderBy(desc(flyguaysBids.createdAt));
  }
  async getFlyguaysBidsByRequest(requestId: string): Promise<FlyguaysBid[]> {
    return db.select().from(flyguaysBids).where(eq(flyguaysBids.requestId, requestId)).orderBy(desc(flyguaysBids.createdAt));
  }
  async createFlyguaysBid(data: InsertFlyguaysBid): Promise<FlyguaysBid> {
    const [r] = await db.insert(flyguaysBids).values(data).returning();
    return r;
  }
  async updateFlyguaysBid(id: string, data: Partial<FlyguaysBid>): Promise<FlyguaysBid> {
    const [r] = await db.update(flyguaysBids).set(data).where(eq(flyguaysBids.id, id)).returning();
    return r;
  }

  // ── FLYGUYS PROJECTS ─────────────────────────────────────────────────────────
  async getFlyguysProjects(userId: string): Promise<FlyguysProject[]> {
    return db.select().from(flyguysProjects).where(eq(flyguysProjects.userId, userId)).orderBy(desc(flyguysProjects.createdAt));
  }
  async createFlyguysProject(data: InsertFlyguysProject): Promise<FlyguysProject> {
    const [r] = await db.insert(flyguysProjects).values(data).returning();
    return r;
  }
  async updateFlyguysProject(id: string, data: Partial<FlyguysProject>): Promise<FlyguysProject> {
    const [r] = await db.update(flyguysProjects).set(data).where(eq(flyguysProjects.id, id)).returning();
    return r;
  }
  async deleteFlyguysProject(id: string): Promise<void> {
    await db.delete(flyguysProjects).where(eq(flyguysProjects.id, id));
  }

  // ── FLYGUYS DELIVERABLES ─────────────────────────────────────────────────────
  async getFlyguysDeliverables(projectId: string): Promise<FlyguysDeliverable[]> {
    return db.select().from(flyguysDeliverables).where(eq(flyguysDeliverables.projectId, projectId)).orderBy(desc(flyguysDeliverables.uploadedAt));
  }
  async createFlyguysDeliverable(data: InsertFlyguysDeliverable): Promise<FlyguysDeliverable> {
    const [r] = await db.insert(flyguysDeliverables).values(data).returning();
    return r;
  }
  async deleteFlyguysDeliverable(id: string): Promise<void> {
    await db.delete(flyguysDeliverables).where(eq(flyguysDeliverables.id, id));
  }

  // ── FLYGUYS TRANSACTIONS ─────────────────────────────────────────────────────
  async getFlyguysTransactions(userId: string): Promise<FlyguysTransaction[]> {
    return db.select().from(flyguysTransactions).where(eq(flyguysTransactions.userId, userId)).orderBy(desc(flyguysTransactions.createdAt));
  }
  async createFlyguysTransaction(data: InsertFlyguysTransaction): Promise<FlyguysTransaction> {
    const [r] = await db.insert(flyguysTransactions).values(data).returning();
    return r;
  }
  async updateFlyguysTransaction(id: string, data: Partial<FlyguysTransaction>): Promise<FlyguysTransaction> {
    const [r] = await db.update(flyguysTransactions).set(data).where(eq(flyguysTransactions.id, id)).returning();
    return r;
  }
}

export const storage = new DatabaseStorage();
