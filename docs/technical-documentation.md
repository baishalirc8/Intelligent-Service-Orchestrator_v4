# HOLOCRON AI - Technical Documentation

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Data Model](#4-data-model)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [API Reference](#6-api-reference)
7. [Probe System](#7-probe-system)
8. [Transport Protocols](#8-transport-protocols)
9. [AI System](#9-ai-system)
10. [ITIL/ITSM Modules](#10-itilitsm-modules)
11. [Gamification & Leaderboard](#11-gamification--leaderboard)
12. [Business Continuity & Disaster Recovery](#12-business-continuity--disaster-recovery)
13. [Security Architecture](#13-security-architecture)
14. [Scalability & Performance](#14-scalability--performance)
15. [Deployment & Configuration](#15-deployment--configuration)

---

## 1. Platform Overview

HOLOCRON AI is a client-facing SaaS platform that provides an AI-powered CIO organizational chart for intelligent automation and strategic IT oversight. The platform follows a human-first approach to IT management, allowing companies to assign human team members to IT roles and optionally enable AI shadow agents to reduce operational costs and enhance efficiency.

The system establishes a human-first CIO hierarchy:

```
CIO -> CTO -> VPs -> Directors -> Managers -> Engineers
```

Roles are categorized across 10 departments plus an Executive department. Departments are referred to as "Crews" and roles as "Agents" within the UI.

### Core Capabilities

- Organizational role management with AI shadow agents
- Infrastructure monitoring via multi-platform probe deployment
- ITIL-aligned ITSM suite (Incidents, Problems, Changes, Service Requests)
- AI-driven root cause analysis and auto-remediation
- Multi-provider AI system with cost management
- Service metrics catalog with AI-driven assignment
- Business Continuity Planning (BCP) and Disaster Recovery Planning (DRP)
- Gamified agent performance leaderboard

---

## 2. System Architecture

### High-Level Architecture

```
+------------------+     +-------------------+     +------------------+
|   React Frontend |<--->| Express.js Backend|<--->| PostgreSQL DB    |
|   (Vite + TS)    |     | (Node.js)         |     | (Drizzle ORM)    |
+------------------+     +-------------------+     +------------------+
                                |
                    +-----------+-----------+
                    |                       |
            +-------+-------+    +---------+---------+
            | AI Providers   |    | Probe Agents       |
            | (OpenAI,       |    | (Coupled, Semi,    |
            |  Gemini,       |    |  Autonomous)       |
            |  Claude)       |    +-------------------+
            +----------------+
```

### Frontend Architecture

- Single-page application built with React and TypeScript
- Routing via `wouter` library
- State management and data fetching via TanStack React Query v5
- Component library: shadcn/ui with Tailwind CSS
- Dark mode theme with blue/purple accent glow effects
- Sidebar navigation using shadcn Sidebar component

### Backend Architecture

- Express.js REST API server
- Session-based authentication via Passport.js
- PostgreSQL database accessed through Drizzle ORM
- Storage interface pattern (`IStorage`) for all CRUD operations
- Zod schema validation on all request bodies (via `drizzle-zod`)
- Vite dev server integration for frontend serving

### Key Navigation Sections

- Organization
- Infrastructure Management
- AI Operations
- Orchestration

### UX Features

- Guided Welcome Tour
- Command Palette (Cmd+K / Ctrl+K)
- Setup Progress Indicator
- Quick Actions Dashboard
- Contextual Help Tooltips
- Keyboard Shortcut Hints
- Context-aware AI Assistant Avatar

---

## 3. Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | UI library |
| TypeScript | Type-safe JavaScript |
| Tailwind CSS | Utility-first CSS framework |
| shadcn/ui | Component library |
| wouter | Client-side routing |
| TanStack Query v5 | Server state management and data fetching |
| lucide-react | Icon library |
| react-icons/si | Company/brand logos |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | HTTP server framework |
| Passport.js | Authentication middleware |
| express-session | Session management |
| connect-pg-simple | PostgreSQL session store |
| bcryptjs | Password hashing |
| Drizzle ORM | Database ORM and query builder |
| drizzle-zod | Schema validation integration |
| Zod | Runtime type validation |

### Database

| Technology | Purpose |
|---|---|
| PostgreSQL | Primary relational database |
| Drizzle ORM | Schema definition and migrations |

### AI Providers

| Provider | Models |
|---|---|
| OpenAI | gpt-4o (primary) |
| Google Gemini | Gemini models |
| Anthropic | Claude models |
| Custom | Any OpenAI-compatible API endpoint |

---

## 4. Data Model

All database tables are defined in `shared/schema.ts` using Drizzle ORM's `pgTable` function. Each table uses UUID primary keys generated via `gen_random_uuid()`.

### 4.1 Core Tables

#### `users`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID, auto-generated |
| username | text | Unique login name |
| password | text | bcrypt-hashed password |
| role | text | User role (default: "client") |
| displayName | text | Display name |
| email | text | Email address (nullable) |
| companyName | text | Company name (nullable) |
| country | text | Country code for salary multiplier (nullable) |
| avatarUrl | text | Profile picture URL (nullable) |
| onboardingCompleted | boolean | Whether onboarding wizard is complete |
| tourCompleted | boolean | Whether guided tour is complete |

#### `orgRoles`

Defines the organizational hierarchy roles (CIO, CTO, VPs, Directors, Managers, Engineers).

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | Internal role name |
| title | text | Display title |
| department | text | Department/crew name |
| division | text | Sub-division (nullable) |
| parentRoleId | varchar | FK to parent role for hierarchy |
| level | integer | Hierarchy level |
| description | text | Role description |
| responsibilities | text[] | Array of responsibility strings |
| aiCapabilities | text[] | AI shadow agent capabilities |
| jobDescription | text | Full job description (nullable) |
| requiredSkills | text[] | Required skill set |
| keyTasks | text[] | Key task list |
| icon | text | Lucide icon name |
| color | text | Tailwind color class |
| monthlyPrice | integer | AI agent monthly cost (nullable) |
| humanCostMonthly | integer | Human role monthly cost (nullable) |
| isSubscribable | boolean | Whether role can be subscribed to |
| sortOrder | integer | Display sort order |

#### `roleSubscriptions`

Maps users to organizational roles and tracks assignment state.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| userId | varchar | FK to users |
| roleId | varchar | FK to orgRoles |
| status | text | Subscription status (default: "active") |
| assignedHumanName | text | Assigned human's name (nullable) |
| assignedHumanEmail | text | Assigned human's email (nullable) |
| hasAiShadow | boolean | Whether AI shadow is enabled |
| availabilityStatus | text | Availability (default: "available") |
| shiftStart | text | Shift start time (nullable) |
| shiftEnd | text | Shift end time (nullable) |
| currentWorkload | integer | Current workload count |
| maxWorkload | integer | Maximum workload capacity |
| contactPhone | text | Contact phone (nullable) |

#### `aiAgents`

Legacy AI agent definitions.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | Agent name |
| type | text | Agent type identifier |
| status | text | Agent status (default: "active") |
| description | text | Agent description |
| capabilities | text[] | Capability list |
| responseTime | text | Typical response time |
| accuracy | text | Accuracy rating |
| tasksCompleted | integer | Total tasks completed |

### 4.2 ITSM Tables

#### `incidents`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| title | text | Incident title |
| description | text | Detailed description |
| severity | text | Severity level (default: "medium") |
| status | text | Lifecycle status (default: "open") |
| category | text | Incident category (nullable) |
| assignedAgentId | varchar | FK to aiAgents (nullable) |
| assignedRoleId | varchar | FK to orgRoles (nullable) |
| reportedBy | text | Reporter name (nullable) |
| resolvedAt | timestamp | Resolution timestamp (nullable) |
| rootCause | text | Root cause analysis (nullable) |
| resolution | text | Resolution description (nullable) |
| slaBreached | boolean | Whether SLA was breached |
| userId | varchar | Owner user ID (nullable) |
| createdAt | timestamp | Creation timestamp |

#### `serviceRequests`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| title | text | Request title |
| description | text | Detailed description |
| status | text | Lifecycle status (default: "pending") |
| priority | text | Priority level (default: "medium") |
| category | text | Request category (nullable) |
| requestType | text | Type of service request (nullable) |
| assignedAgentId | varchar | FK to aiAgents (nullable) |
| assignedRoleId | varchar | FK to orgRoles (nullable) |
| requestedBy | text | Requester name (nullable) |
| linkedIncidentId | varchar | Auto-linked incident (nullable) |
| approvalStatus | text | Approval state (nullable) |
| fulfillmentNotes | text | Fulfillment notes (nullable) |
| resolvedAt | timestamp | Resolution timestamp (nullable) |
| slaBreached | boolean | Whether SLA was breached |
| userId | varchar | Owner user ID (nullable) |
| createdAt | timestamp | Creation timestamp |

#### `problems`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| title | text | Problem title |
| description | text | Problem description |
| status | text | Lifecycle status (default: "open") |
| priority | text | Priority level (default: "medium") |
| category | text | Problem category (nullable) |
| assignedAgentId | varchar | FK to aiAgents (nullable) |
| assignedRoleId | varchar | FK to orgRoles (nullable) |
| rootCause | text | Root cause (nullable) |
| workaround | text | Workaround description (nullable) |
| knownError | boolean | Whether this is a known error |
| relatedIncidentIds | text[] | Linked incident IDs |
| resolvedAt | timestamp | Resolution timestamp (nullable) |
| userId | varchar | Owner user ID (nullable) |
| createdAt | timestamp | Creation timestamp |

#### `changeRequests`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| title | text | Change request title |
| description | text | Description |
| status | text | Lifecycle status (default: "draft") |
| priority | text | Priority (default: "medium") |
| changeType | text | Change type (default: "normal") |
| category | text | Category (nullable) |
| assignedAgentId | varchar | FK to aiAgents (nullable) |
| assignedRoleId | varchar | FK to orgRoles (nullable) |
| riskLevel | text | Risk assessment (nullable) |
| impactAssessment | text | Impact assessment (nullable) |
| rollbackPlan | text | Rollback plan (nullable) |
| scheduledStart | timestamp | Planned start (nullable) |
| scheduledEnd | timestamp | Planned end (nullable) |
| approvalStatus | text | Approval state (nullable) |
| implementedAt | timestamp | Implementation timestamp (nullable) |
| userId | varchar | Owner user ID (nullable) |
| createdAt | timestamp | Creation timestamp |

#### `knowledgeArticles`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| title | text | Article title |
| content | text | Article body content |
| category | text | Category classification |
| tags | text[] | Search tags |
| status | text | Publication status (default: "draft") |
| author | text | Author name (nullable) |
| views | integer | View count |
| helpful | integer | Helpful vote count |
| notHelpful | integer | Not-helpful vote count |
| userId | varchar | Owner user ID |
| createdAt | timestamp | Creation timestamp |

#### `slaDefinitions`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | SLA name |
| description | text | SLA description |
| targetResolutionHours | integer | Resolution target in hours |
| targetResponseMinutes | integer | Response target in minutes |
| priority | text | Applicable priority level |
| category | text | Applicable category |

#### `serviceCatalogItems`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | Service name |
| description | text | Service description |
| category | text | Service category |
| status | text | Availability status (default: "active") |
| slaId | varchar | FK to slaDefinitions (nullable) |
| estimatedDelivery | text | Estimated delivery time (nullable) |
| approvalRequired | boolean | Whether approval is required |
| cost | integer | Service cost (nullable) |

### 4.3 Infrastructure Tables

#### `networkDevices`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | Device name |
| type | text | Device type |
| vendor | text | Vendor name (nullable) |
| model | text | Model name (nullable) |
| ipAddress | text | IP address |
| firmware | text | Firmware version (nullable) |
| status | text | Device status (default: "online") |
| location | text | Physical location (nullable) |
| configHash | text | Configuration hash (nullable) |
| assignedAgentRoleId | varchar | FK to orgRoles (nullable) |
| userId | varchar | Owner user ID |
| createdAt | timestamp | Creation timestamp |

#### `deviceMetrics`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| deviceId | varchar | FK to networkDevices |
| metricName | text | Metric identifier |
| value | real | Current metric value |
| unit | text | Measurement unit |
| thresholdWarning | real | Warning threshold (nullable) |
| thresholdCritical | real | Critical threshold (nullable) |
| status | text | Metric status (default: "normal") |
| userId | varchar | Owner user ID |
| timestamp | timestamp | Collection timestamp |

#### `discoveredAssets`

Stores assets found by probe scans. Indexed for performance:
- `idx_assets_user_probe` on (userId, probeId)
- `idx_assets_probe_ip` on (probeId, ipAddress)
- `idx_assets_probe_name` on (probeId, name)

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| probeId | varchar | FK to discoveryProbes (nullable) |
| name | text | Asset name |
| type | text | Asset type |
| vendor | text | Vendor (nullable) |
| model | text | Model (nullable) |
| ipAddress | text | IP address (nullable) |
| macAddress | text | MAC address (nullable) |
| firmware | text | Firmware version (nullable) |
| status | text | Asset status (default: "online") |
| protocol | text | Discovery protocol (nullable) |
| lastSeen | timestamp | Last seen timestamp |
| assignedAgentRoleId | varchar | Assigned AI agent role (nullable) |
| metadata | jsonb | Additional metadata (nullable) |
| userId | varchar | Owner user ID |
| createdAt | timestamp | Creation timestamp |

#### `discoveryProbes`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | Probe name |
| description | text | Probe description |
| protocol | text | Discovery protocol |
| credentialId | varchar | Primary credential (nullable) |
| scanSubnet | text | Target scan subnet (nullable) |
| scanSchedule | text | Scan schedule (nullable) |
| status | text | Probe status (default: "idle") |
| lastScanAt | timestamp | Last scan timestamp (nullable) |
| discoveredCount | integer | Total discovered assets |
| assignedAgentRoleId | varchar | Assigned agent role (nullable) |
| siteToken | varchar | Unique enrollment token |
| hmacSecret | text | HMAC secret for authentication |
| tokenExpiresAt | timestamp | Token expiration (nullable) |
| enrolledIp | text | Enrolled IP address (nullable) |
| lastNonce | text | Last used nonce for replay protection |
| lastRequestTimestamp | timestamp | Last request time (nullable) |
| probeTypeId | varchar | FK to probeTypes (nullable) |
| deploymentType | text | Deployment platform (nullable) |
| probeVersion | text | Running probe version (nullable) |
| lastHeartbeat | timestamp | Last heartbeat (nullable) |
| heartbeatInterval | integer | Heartbeat interval in seconds (default: 60) |
| ipAddress | text | Probe IP address (nullable) |
| hostname | text | Probe hostname (nullable) |
| osInfo | text | OS information (nullable) |
| enrolled | boolean | Whether probe is enrolled |
| enrolledAt | timestamp | Enrollment timestamp (nullable) |
| cpuUsage | real | CPU usage percentage (nullable) |
| memoryUsage | real | Memory usage percentage (nullable) |
| diskUsage | real | Disk usage percentage (nullable) |
| taskQueueDepth | integer | Task queue depth |
| avgScanDuration | real | Average scan duration (nullable) |
| healthStatus | text | Health status (default: "healthy") |
| healthMetrics | jsonb | Detailed health metrics (nullable) |
| collectionSchedule | jsonb | Metric collection schedule (nullable) |
| bufferStatus | jsonb | Buffer status for semi-autonomous mode (nullable) |
| lastPayloadSize | integer | Last telemetry payload size |
| clusterEnabled | boolean | Whether clustering is enabled |
| clusterMode | text | Cluster mode (default: "standalone") |
| clusterCoordinatorId | varchar | Cluster coordinator probe ID (nullable) |
| userId | varchar | Owner user ID |
| createdAt | timestamp | Creation timestamp |

#### `probeTypes`

Defines the taxonomy of deployable probe types.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | Probe type name |
| description | text | Description |
| icon | text | Lucide icon name (default: "Radar") |
| color | text | Tailwind color class |
| protocol | text | Primary protocol (nullable) |
| deploymentModel | text | Deployment model (nullable) |
| couplingMode | text | Coupling mode: coupled, semi, auto (default: "coupled") |
| characteristics | text[] | Feature characteristics |
| requiresEnrollment | boolean | Whether enrollment is required |
| containerImage | text | Docker image for container-based probes (nullable) |
| containerResources | jsonb | Container resource requirements (nullable) |
| hasLocalReasoning | boolean | Whether probe has local AI reasoning |
| bufferCapacity | integer | Buffer capacity for offline data |
| syncStrategy | text | Synchronization strategy (nullable) |
| communicationProtocols | jsonb | Supported communication protocols |
| userId | varchar | Owner user ID |
| createdAt | timestamp | Creation timestamp |

#### `probeClusterNodes`

Supports horizontal scaling of probes by adding cluster nodes.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| probeId | varchar | FK to discoveryProbes |
| nodeAlias | text | Node display name |
| hardwareTier | text | Hardware tier (default: "performance") |
| cpuCores | integer | CPU core count |
| ramGb | integer | RAM in GB |
| maxMetrics | integer | Maximum metric capacity |
| currentMetrics | integer | Current metric count |
| status | text | Node status (default: "online") |
| lastHeartbeat | timestamp | Last heartbeat (nullable) |
| ipAddress | text | Node IP address (nullable) |
| hostname | text | Node hostname (nullable) |
| cpuUsage | real | CPU usage (nullable) |
| memoryUsage | real | Memory usage (nullable) |
| diskUsage | real | Disk usage (nullable) |
| healthMetrics | jsonb | Detailed health metrics (nullable) |
| joinedAt | timestamp | Join timestamp |
| userId | varchar | Owner user ID |

#### Hardware Tiers

| Tier | CPU Cores | RAM (GB) | Max Metrics | Description |
|---|---|---|---|---|
| entry | 2 | 16 | 1,500 | Small sites |
| standard | 4 | 32 | 3,000 | Mid-size environments |
| performance | 4 | 64 | 5,000 | Production benchmark |
| enterprise | 8 | 128 | 10,000 | Large-scale environments |
| custom | User-defined | User-defined | User-defined | Custom configuration |

#### `probeCredentialLinks`

Many-to-many relationship between probes and credentials.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| probeId | varchar | FK to discoveryProbes |
| credentialId | varchar | FK to discoveryCredentials |
| addedAt | timestamp | Link creation timestamp |

#### `discoveryCredentials`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | Credential name |
| protocol | text | Protocol type |
| host | text | Target host |
| port | integer | Target port (nullable) |
| authType | text | Authentication type (default: "username_password") |
| status | text | Credential status (default: "configured") |
| lastVerified | timestamp | Last verification time (nullable) |
| metadata | jsonb | Additional auth metadata (nullable) |
| userId | varchar | Owner user ID |
| createdAt | timestamp | Creation timestamp |

### 4.4 AI Operations Tables

#### `agentPerformanceMetrics`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| agentRoleId | varchar | FK to orgRoles |
| metricPeriod | text | Evaluation period (default: "monthly") |
| accuracyScore | real | Accuracy percentage |
| taskCompletionRate | real | Task completion rate |
| hallucinationRisk | real | Hallucination risk score |
| driftScore | real | Model drift score |
| avgResponseTime | real | Average response time |
| escalationRate | real | Escalation rate |
| tasksCompleted | integer | Tasks completed count |
| tasksEscalated | integer | Tasks escalated count |
| confidenceScore | real | Overall confidence score |
| lastEvaluatedAt | timestamp | Last evaluation timestamp |
| userId | varchar | Owner user ID |
| createdAt | timestamp | Creation timestamp |

#### `agentConversations` / `agentMessages`

NLP chat interface for AI agents with conversation threading.

#### `agentNotifications`

Human-manager communication system for AI agent alerts with proposed actions and approval workflow.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| agentRoleId | varchar | FK to orgRoles |
| assetId | varchar | Related asset (nullable) |
| type | text | Notification type (default: "issue_detected") |
| severity | text | Severity level (default: "medium") |
| title | text | Notification title |
| description | text | Notification description |
| proposedAction | text | AI-proposed action (nullable) |
| actionStatus | text | Action status (default: "pending") |
| humanResponse | text | Human response (nullable) |
| resolvedAt | timestamp | Resolution timestamp (nullable) |
| userId | varchar | Owner user ID |
| createdAt | timestamp | Creation timestamp |

#### `thresholdCalibrations`

AI-driven threshold calibration for metrics with statistical analysis.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| metricId | varchar | FK to deviceMetrics (nullable) |
| deviceId | varchar | FK to networkDevices (nullable) |
| metricName | text | Metric name |
| currentWarning / currentCritical | real | Current thresholds |
| calibratedWarning / calibratedCritical / calibratedNormal | real | AI-calibrated thresholds |
| unit | text | Measurement unit |
| algorithm | text | Calibration algorithm (default: "variation_calibration") |
| confidence | real | Calibration confidence score |
| dataPointsAnalyzed | integer | Number of data points analyzed |
| varianceCoefficient / meanValue / stdDeviation | real | Statistical measures |
| p95Value / p99Value | real | Percentile values |
| falsePositivesBefore / falsePositivesProjected | integer | False positive reduction metrics |
| status | text | Calibration status (default: "proposed") |
| appliedAt | timestamp | Application timestamp (nullable) |

### 4.5 Application Monitoring Tables

#### `monitoredApplications`

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| assetId | varchar | FK to discoveredAssets |
| name | text | Application name |
| version | text | Version (nullable) |
| category | text | Application category |
| criticality | text | Criticality level (default: "utility") |
| status | text | Running status (default: "running") |
| port | integer | Listening port (nullable) |
| protocol | text | Protocol (nullable) |
| processName | text | OS process name (nullable) |
| uptime | real | Uptime percentage (nullable) |
| responseTime | real | Response time in ms (nullable) |
| cpuUsage / memoryUsage | real | Resource usage (nullable) |
| healthScore | integer | Health score 0-100 (default: 100) |
| dependencies | text[] | Application dependencies (nullable) |
| metadata | jsonb | Additional metadata (nullable) |
| discoveredBy | varchar | Discovery probe ID (nullable) |
| userId | varchar | Owner user ID |

#### `applicationTopologies`

Service topology mapping with health scoring and impact analysis.

#### `remediationTasks`

AI-generated remediation scripts with an approve-then-execute pipeline. Indexed on `(probeId, status)`.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| assetId | varchar | Target asset |
| probeId | varchar | Executing probe (nullable) |
| userId | varchar | Owner user ID |
| title | text | Task title |
| description | text | Task description |
| remediationScript | text | Script content |
| scriptType | text | Script type (default: "powershell") |
| status | text | Lifecycle status (default: "pending_approval") |
| approvedAt / dispatchedAt / completedAt | timestamp | Lifecycle timestamps |
| result | text | Execution result (nullable) |
| error | text | Error details (nullable) |

### 4.6 Orchestration Tables

#### `crews`

Groups of agent roles that work together on processes.

#### `agentTasks`

Individual tasks assigned to agent roles within crews.

#### `agentWorkflows`

Workflow definitions linking tasks and crews with process types.

#### `workflowStages`

Stages within workflows supporting committee-driven approval gates.

#### `committees`

Governance committees with quorum-based approval.

| Column | Type | Description |
|---|---|---|
| id | varchar (PK) | UUID |
| name | text | Committee name |
| type | text | Committee type |
| description | text | Committee description |
| memberRoleIds | text[] | Member role IDs |
| chairRoleId | varchar | Chair role ID (nullable) |
| quorumRequired | integer | Required quorum count |
| status | text | Committee status (default: "active") |
| userId | varchar | Owner user ID |

### 4.7 Additional Tables

- **`securityEvents`** - Security event logging
- **`infrastructureConnectors`** - External infrastructure connectors (protocol, host, port, auth)
- **`automationPlaybooks`** / **`playbookExecutions`** - Automation playbook definitions and execution history
- **`telemetryMetrics`** - Raw telemetry data from probes and agents
- **`agentActivities`** - Agent activity audit log (autonomous flag for AI actions)
- **`chatMessages`** - Legacy chat message store
- **`agentKpis`** - Key performance indicators per agent role
- **`agentAlerts`** - Alert records per device and agent
- **`userManagedAgents`** - Maps users to the AI agents they manage
- **`serviceMetrics`** - Service metrics catalog entries
- **`serviceMetricAssignments`** - Metric-to-asset assignments
- **`agentMetricProfiles`** - AI-generated metric monitoring profiles per role
- **`agentOperationalInsights`** - AI-generated predictive operational insights
- **`agentScheduledActivities`** - Scheduled agent activities with approval workflow
- **`aiCacheTemplates`** - AI response cache for token consumption reduction
- **`aiProviders`** - Multi-provider AI configuration
- **`missionCriticalGroups`** - Mission-critical asset groupings
- **`bcpPlans`** / **`drpPlans`** - Business Continuity and Disaster Recovery plans
- **`bcpBiaEntries`** - Business Impact Analysis entries
- **`bcpRiskAssessments`** - Risk assessment records
- **`bcpDrills`** - Continuity drill records
- **`bcpReviews`** - Plan review records

---

## 5. Authentication & Authorization

### Authentication Flow

HOLOCRON uses session-based authentication with Passport.js Local Strategy:

1. User submits credentials to `POST /api/auth/login`
2. Passport.js Local Strategy validates username/password via bcryptjs comparison
3. On success, a session is created and stored in PostgreSQL via `connect-pg-simple`
4. Session cookie is returned to the client (30-day expiry, httpOnly, secure in production)
5. Subsequent requests include the session cookie automatically

### Session Configuration

```
Store: PostgreSQL (connect-pg-simple, auto-creates table)
Max Age: 30 days
HttpOnly: true
Secure: true (production only)
SameSite: lax
Trust Proxy: enabled in production
```

### Demo Credentials

```
Username: demo
Password: demo123
```

### Authorization Middleware

The `requireAuth` middleware protects authenticated routes:
- Checks `req.isAuthenticated()` via Passport
- Returns `401 Unauthorized` if not authenticated
- Attaches `req.user` with user details (id, username, role, displayName, etc.)

### IDOR Protection

All `requireAuth` routes scope data access by `req.user.id`:
- Data is created with `userId: req.user!.id`
- Read operations filter by `userId`
- Update/delete operations verify `entity.userId === req.user!.id` before proceeding

### Onboarding State

Users have two onboarding flags:
- `onboardingCompleted` - Set via `POST /api/auth/complete-onboarding`
- `tourCompleted` - Set via `POST /api/auth/complete-tour`

---

## 6. API Reference

All API endpoints are prefixed with `/api/`. Request/response bodies are JSON. Authentication is via session cookie.

### 6.1 Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login with credentials |
| POST | /api/auth/logout | Yes | End session |
| GET | /api/auth/me | Yes | Get current user |
| POST | /api/auth/complete-onboarding | Yes | Mark onboarding complete |
| POST | /api/auth/complete-tour | Yes | Mark tour complete |
| PATCH | /api/auth/country | Yes | Update user country |

### 6.2 Dashboard & System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/health | No | Health check |
| GET | /api/dashboard/stats | No | Dashboard statistics |
| GET | /api/countries | No | Available countries list |
| GET | /api/leaderboard | No | Agent leaderboard |

### 6.3 Agents (Legacy AI Agents)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/agents | No | List all agents |
| GET | /api/agents/:id | No | Get agent by ID |
| PATCH | /api/agents/:id | No | Update agent |

### 6.4 Incidents

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/incidents/stats | No | Incident statistics with KPI dashboard |
| GET | /api/incidents | No | List all incidents |
| GET | /api/incidents/:id | No | Get incident by ID |
| POST | /api/incidents | No | Create incident |
| PATCH | /api/incidents/:id | No | Update incident (with lifecycle validation) |

### 6.5 Service Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/service-requests/stats | No | SR statistics |
| GET | /api/service-requests | No | List all service requests |
| GET | /api/service-requests/:id | No | Get SR by ID |
| POST | /api/service-requests | No | Create SR (with auto-link and auto-assignment) |
| PATCH | /api/service-requests/:id | No | Update SR (with lifecycle validation) |

### 6.6 Problems

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/problems/stats | No | Problem statistics |
| GET | /api/problems | No | List all problems |
| GET | /api/problems/:id | No | Get problem by ID |
| POST | /api/problems | No | Create problem |
| PATCH | /api/problems/:id | No | Update problem (with lifecycle validation) |

### 6.7 Change Requests

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/change-requests/stats | No | Change request statistics |
| GET | /api/change-requests | No | List all change requests |
| GET | /api/change-requests/:id | No | Get change request by ID |
| POST | /api/change-requests | No | Create change request |
| PATCH | /api/change-requests/:id | No | Update change request (with lifecycle validation) |

### 6.8 Knowledge Base

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/knowledge | Yes | List knowledge articles |
| GET | /api/knowledge/search | Yes | Search articles (query: `q`) |
| GET | /api/knowledge/:id | Yes | Get article by ID |
| POST | /api/knowledge | Yes | Create article |
| PATCH | /api/knowledge/:id | Yes | Update article |
| DELETE | /api/knowledge/:id | Yes | Delete article |
| POST | /api/knowledge/:id/helpful | Yes | Vote on article helpfulness |
| POST | /api/knowledge/from-task/:taskId | Yes | Generate KB article from completed task |

### 6.9 Service Catalog & SLA

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/service-catalog | No | List catalog items |
| GET | /api/service-catalog/:id | No | Get catalog item |
| POST | /api/service-catalog | No | Create catalog item |
| GET | /api/sla-definitions | No | List SLA definitions |
| POST | /api/sla-definitions | No | Create SLA definition |

### 6.10 CMDB

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/cmdb | No | List CMDB items |
| GET | /api/cmdb/:id | No | Get CMDB item |
| POST | /api/cmdb | No | Create CMDB item |
| PATCH | /api/cmdb/:id | No | Update CMDB item |
| GET | /api/cmdb-relationships | No | List relationships |
| POST | /api/cmdb-relationships | No | Create relationship |

### 6.11 Infrastructure

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/connectors | No | List connectors |
| GET | /api/connectors/:id | No | Get connector |
| POST | /api/connectors | No | Create connector |
| PATCH | /api/connectors/:id | No | Update connector |
| GET | /api/playbooks | No | List playbooks |
| POST | /api/playbooks | No | Create playbook |
| PATCH | /api/playbooks/:id | No | Update playbook |
| GET | /api/playbook-executions | No | List executions |
| POST | /api/playbook-executions | No | Create execution |

### 6.12 Telemetry & Monitoring

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/telemetry | No | List telemetry metrics |
| GET | /api/telemetry/:sourceId | No | Get metrics by source |
| POST | /api/telemetry | No | Submit telemetry |

### 6.13 Organizational Roles

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/org-roles | No | List all roles (salary-adjusted by user country) |
| GET | /api/org-roles/:id | No | Get role (salary-adjusted) |
| PATCH | /api/org-roles/:id/ai-provider | Yes | Set AI provider for role |

### 6.14 Role Subscriptions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/role-subscriptions | Yes | List user's subscriptions |
| POST | /api/role-subscriptions | Yes | Subscribe to role |
| PATCH | /api/role-subscriptions/:id | Yes | Update subscription |
| DELETE | /api/role-subscriptions/:id | Yes | Cancel subscription |

### 6.15 Crews & Workflows

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/crews | Yes | List crews |
| POST | /api/crews | Yes | Create crew |
| PATCH | /api/crews/:id | Yes | Update crew |
| DELETE | /api/crews/:id | Yes | Delete crew |
| GET | /api/agent-tasks | Yes | List tasks |
| POST | /api/agent-tasks | Yes | Create task |
| PATCH | /api/agent-tasks/:id | Yes | Update task |
| POST | /api/agent-tasks/:id/execute | Yes | Execute task (KB-First strategy) |
| GET | /api/agent-workflows | Yes | List workflows |
| POST | /api/agent-workflows | Yes | Create workflow |
| PATCH | /api/agent-workflows/:id | Yes | Update workflow |
| DELETE | /api/agent-workflows/:id | Yes | Delete workflow |
| GET | /api/committees | Yes | List committees |
| POST | /api/committees | Yes | Create committee |
| PATCH | /api/committees/:id | Yes | Update committee |
| DELETE | /api/committees/:id | Yes | Delete committee |

### 6.16 BCP / DRP

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/bcp-plans/stats | Yes | BCP statistics |
| GET | /api/bcp-plans | Yes | List BCP plans |
| POST | /api/bcp-plans | Yes | Create BCP plan |
| PATCH | /api/bcp-plans/:id | Yes | Update BCP plan |
| GET | /api/drp-plans/stats | Yes | DRP statistics |
| GET | /api/drp-plans | Yes | List DRP plans |
| POST | /api/drp-plans | Yes | Create DRP plan |
| PATCH | /api/drp-plans/:id | Yes | Update DRP plan |
| GET | /api/bcp-bia/stats | Yes | BIA statistics |
| GET | /api/bcp-bia | Yes | List BIA entries |
| POST | /api/bcp-bia | Yes | Create BIA entry |
| PATCH | /api/bcp-bia/:id | Yes | Update BIA entry |
| GET | /api/bcp-risks/stats | Yes | Risk assessment statistics |
| GET | /api/bcp-risks | Yes | List risk assessments |
| POST | /api/bcp-risks | Yes | Create risk assessment |
| PATCH | /api/bcp-risks/:id | Yes | Update risk assessment |
| GET | /api/bcp-drills/stats | Yes | Drill statistics |
| GET | /api/bcp-drills | Yes | List drills |
| POST | /api/bcp-drills | Yes | Create drill |
| PATCH | /api/bcp-drills/:id | Yes | Update drill |
| GET | /api/bcp-reviews/stats | Yes | Review statistics |
| GET | /api/bcp-reviews | Yes | List reviews |
| POST | /api/bcp-reviews | Yes | Create review |
| PATCH | /api/bcp-reviews/:id | Yes | Update review |

### 6.17 Discovery & Probes

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/discovery-credentials | Yes | List credentials |
| POST | /api/discovery-credentials | Yes | Create credential |
| PATCH | /api/discovery-credentials/:id | Yes | Update credential |
| DELETE | /api/discovery-credentials/:id | Yes | Delete credential |
| GET | /api/probe-types | Yes | List probe types |
| POST | /api/probe-types | Yes | Create probe type |
| PATCH | /api/probe-types/:id | Yes | Update probe type |
| DELETE | /api/probe-types/:id | Yes | Delete probe type |
| GET | /api/discovery-probes | Yes | List probes |
| POST | /api/discovery-probes | Yes | Create/enroll probe |
| PATCH | /api/discovery-probes/:id | Yes | Update probe |
| DELETE | /api/discovery-probes/:id | Yes | Delete probe |
| GET | /api/discovery-probes/:id/credentials | Yes | List probe's credentials |
| POST | /api/discovery-probes/:id/credentials | Yes | Link credential to probe |
| DELETE | /api/discovery-probes/:id/credentials/:credentialId | Yes | Unlink credential |
| GET | /api/discovered-assets | Yes | List discovered assets |
| POST | /api/discovered-assets | Yes | Create asset |
| GET | /api/discovered-assets/:id/scan-progress | Yes | Get scan progress (SSE) |

### 6.18 Probe Communication (Machine-to-Machine)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/probe-heartbeat | HMAC | Single heartbeat from coupled probe |
| POST | /api/probe-heartbeat-buffered | HMAC | Buffered heartbeat from semi-autonomous probe |
| POST | /api/probe-heartbeat-batch | HMAC | Batch heartbeat (multi-device) |
| GET | /api/probe-config | HMAC | Get probe configuration |

### 6.19 Probe Clustering

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/cluster/tiers | Yes | List hardware tiers |
| GET | /api/discovery-probes/:id/cluster | Yes | Get cluster status |
| POST | /api/discovery-probes/:id/cluster/enable | Yes | Enable clustering |
| POST | /api/discovery-probes/:id/cluster/nodes | Yes | Add cluster node |
| PATCH | /api/discovery-probes/:id/cluster/nodes/:nodeId | Yes | Update node |
| DELETE | /api/discovery-probes/:id/cluster/nodes/:nodeId | Yes | Remove node |

### 6.20 Application Monitoring

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/application-topologies | Yes | List topologies |
| POST | /api/application-topologies/discover | Yes | AI-powered app discovery |
| PATCH | /api/application-topologies/:id | Yes | Update topology |
| DELETE | /api/application-topologies | Yes | Delete all topologies |

### 6.21 Remediation

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/remediation-tasks | Yes | List remediation tasks |
| POST | /api/discovered-assets/:id/generate-remediation | Yes | AI-generate remediation script |
| POST | /api/discovered-assets/:id/agent-scan | Yes | Run agent scan on asset |
| POST | /api/remediation-tasks/:id/approve | Yes | Approve remediation task |
| POST | /api/remediation-tasks/:id/reject | Yes | Reject remediation task |
| POST | /api/remediation-tasks/:id/force-complete | Yes | Force complete task |
| POST | /api/remediation-tasks/:id/cancel | Yes | Cancel task |
| POST | /api/remediation-tasks/:id/report | HMAC | Report task result (from probe) |
| DELETE | /api/remediation-tasks/completed | Yes | Clear completed tasks |

### 6.22 Service Metrics & AI Profiles

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/service-metrics | Yes | List service metrics catalog |
| POST | /api/service-metrics | Yes | Create metric |
| PATCH | /api/service-metrics/:id | Yes | Update metric |
| DELETE | /api/service-metrics/:id | Yes | Delete metric |
| POST | /api/service-metrics/seed | Yes | Seed default metrics catalog |
| POST | /api/service-metrics/ai-analyze-all | Yes | AI-analyze all metrics |
| GET | /api/service-metric-assignments | Yes | List metric assignments |
| POST | /api/service-metric-assignments | Yes | Create assignment |
| PATCH | /api/service-metric-assignments/:id | Yes | Update assignment |
| DELETE | /api/service-metric-assignments/:id | Yes | Delete assignment |
| GET | /api/agent-metric-profiles | Yes | List all agent metric profiles |
| GET | /api/agent-metric-profiles/:roleId | Yes | Get profiles for role |
| DELETE | /api/agent-metric-profiles/:id | Yes | Delete profile |
| POST | /api/agent-metric-profiles/generate/:roleId | Yes | AI-generate profile for role |
| POST | /api/agent-metric-profiles/provision/:roleId | Yes | Provision metrics from profile |
| POST | /api/agent-metric-profiles/generate-all | Yes | AI-generate profiles for all roles |

### 6.23 AI Operations

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/agent-operational-insights/all | Yes | List all operational insights |
| GET | /api/agent-operational-insights/:roleId | Yes | Get insights for role |
| POST | /api/agent-operational-insights/generate/:roleId | Yes | Generate insights for role |
| POST | /api/agent-operational-insights/generate-all | Yes | Generate insights for all roles |
| GET | /api/agent-scheduled-activities | Yes | List scheduled activities |
| POST | /api/agent-scheduled-activities | Yes | Create scheduled activity |
| PATCH | /api/agent-scheduled-activities/:id/status | Yes | Update activity status |
| PATCH | /api/agent-scheduled-activities/:id/approve | Yes | Approve activity |
| DELETE | /api/agent-scheduled-activities/:id | Yes | Delete activity |
| POST | /api/agent-scheduled-activities/populate | Yes | AI-populate scheduled activities |

### 6.24 AI Provider Management

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/ai-providers | Yes | List AI providers |
| GET | /api/ai-providers/models | Yes | List available AI models |
| POST | /api/ai-providers | Yes | Register AI provider |
| PATCH | /api/ai-providers/:id | Yes | Update provider |
| DELETE | /api/ai-providers/:id | Yes | Delete provider |
| POST | /api/ai-providers/:id/set-default | Yes | Set as default provider |
| POST | /api/ai-providers/:id/test | Yes | Test provider connection |

### 6.25 AI Cache Management

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/ai-cache | Yes | List cached templates |
| GET | /api/ai-cache/stats | Yes | Cache statistics (hits, misses, savings) |
| DELETE | /api/ai-cache/:id | Yes | Delete cache entry |
| DELETE | /api/ai-cache/category/:category | Yes | Delete by category |
| POST | /api/ai-cache/cleanup | Yes | Clean up expired entries |

### 6.26 Agent Chat (NLP Interface)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/agent-chat/conversations | Yes | List conversations |
| POST | /api/agent-chat/conversations | Yes | Create conversation |
| GET | /api/agent-chat/conversations/:id/messages | Yes | Get conversation messages |
| POST | /api/agent-chat/conversations/:id/messages | Yes | Send message (AI-routed to appropriate agent) |

### 6.27 Agent Performance & Notifications

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | /api/managed-agents | Yes | List managed agents |
| PUT | /api/managed-agents | Yes | Update managed agents list |
| GET | /api/agent-performance | Yes | List performance metrics |
| GET | /api/agent-performance/:roleId | Yes | Get performance for role |
| GET | /api/agent-notifications | Yes | List notifications (filterable) |
| GET | /api/agent-notifications/:id | Yes | Get notification by ID |
| PATCH | /api/agent-notifications/:id | Yes | Update notification |
| POST | /api/agent-notifications/generate | Yes | AI-generate notifications |

---

## 7. Probe System

### 7.1 Overview

HOLOCRON deploys probe agents to customer infrastructure for asset discovery, telemetry collection, and automated remediation. Probes operate in three coupling modes with varying levels of autonomy.

### 7.2 Coupling Modes

#### Coupled Mode (v4.0.0-coupled)

- Real-time telemetry streaming to the HOLOCRON server
- Heartbeat interval: **60 seconds**
- Requires continuous network connectivity
- All processing happens server-side
- Immediate alert generation and response

#### Semi-Autonomous Mode (v4.0.0-semi)

- Local store-and-forward buffer for offline operation
- Heartbeat interval: **120 seconds**
- Buffers telemetry data when server is unreachable
- Automatic buffer flush when connectivity is restored
- Buffer includes device metrics, asset data, and timestamps

#### Fully Autonomous Mode (v4.0.0-auto)

- On-device AI reasoning with zero server dependency capability
- Heartbeat interval: **300 seconds**
- Self-healing capabilities with autonomous remediation
- Available remediation actions:
  - `kill_top_cpu_process` - Terminates highest CPU-consuming process
  - `clear_memory` - Clears system memory caches
  - `cleanup_disk` - Removes temporary files and logs
  - `throttle_workload` - Reduces system workload
- Local decision-making based on configurable thresholds
- Reports actions taken to server when connectivity is available

### 7.3 Deployment Platforms (7 Targets)

| Platform | Description |
|---|---|
| Kernel-Direct | Distroless containers with direct kernel access |
| Linux Server (x86_64) | Standard Linux server deployment |
| Linux ARM (RPi/Edge) | ARM-based edge devices and Raspberry Pi |
| Windows Server | Windows Server environments |
| Windows Endpoint | Windows desktop/endpoint deployment |
| Docker Container | Containerized probe deployment |
| OT/Industrial | Operational Technology and Industrial Control Systems |

### 7.4 Probe Scripts

Two implementations are available:

**Node.js Probes** (`server/probes/node/`)
- `probe-coupled.ts` - Coupled mode implementation
- `probe-semi.ts` - Semi-autonomous mode with buffer management
- `probe-auto.ts` - Fully autonomous mode with local AI reasoning

**Shell Script Probes** (`server/probes/`)
- `holocron-probe.sh` - Bash implementation for coupled mode
- `holocron-probe-semi.sh` - Bash implementation for semi-autonomous mode
- `holocron-probe-auto.sh` - Bash implementation for autonomous mode

### 7.5 Probe Enrollment

1. Admin creates a probe entry in HOLOCRON, generating a unique `siteToken`
2. Probe agent is deployed with the `siteToken` and `HOLOCRON_API` URL
3. On first heartbeat, the probe sends its `siteToken` for enrollment
4. Server generates an HMAC secret and returns it to the probe
5. All subsequent communications are authenticated via HMAC signatures
6. Server records the probe's IP, hostname, and OS information

### 7.6 Probe Health Monitoring

Each probe reports:
- CPU usage, memory usage, disk usage
- Task queue depth
- Average scan duration
- Health status (healthy/degraded/critical)
- Detailed health metrics (JSON)
- Buffer status (semi-autonomous mode)
- Last payload size

### 7.7 Probe Clustering

Probes support horizontal scaling through clustering:
- A probe can be promoted to a cluster coordinator
- Additional nodes join the cluster contributing metric collection capacity
- Each node has a hardware tier determining its metric capacity
- Cluster status aggregates capacity across all nodes

---

## 8. Transport Protocols

Probes communicate with the HOLOCRON server through a configurable transport chain (`TransportChain`) that supports priority-ordered failover across 9 protocols.

### 8.1 Transport Chain

The `TransportChain` class manages multiple transports:
- Transports are ordered by priority (lower number = higher priority)
- On send, each transport is tried in priority order
- If a transport fails, the next one is attempted automatically
- Active transport is tracked and logged on switches

Configuration via environment variable `HOLOCRON_TRANSPORTS` (JSON array) or defaults to HTTPS.

### 8.2 Supported Protocols

#### HTTPS (Default)

- Standard REST API communication over TLS
- Uses Node.js `https` module
- HMAC signature authentication via headers
- Base URL configurable via `HOLOCRON_API` environment variable
- Headers: `X-Holocron-Signature`, `X-Holocron-Timestamp`, `X-Holocron-Nonce`

#### MQTT

- Publish/subscribe messaging protocol
- Supports TLS and authentication (username/password)
- Configurable broker URL, topic prefix, QoS level
- Default topic: `holocron/probe/{probeid}/telemetry`
- Keep-alive and reconnect support

#### WebSocket

- Persistent bidirectional connection
- Supports TLS (`wss://`) and plain (`ws://`)
- Authentication token support
- Automatic reconnection logic
- JSON message framing

#### CoAP (Constrained Application Protocol)

- Lightweight protocol for constrained devices
- UDP-based with confirmable messages
- Suitable for IoT/OT environments
- Uses `coap` Node.js module

#### Raw TCP

- Direct TCP socket communication
- Length-prefixed JSON messages
- TLS support optional
- Configurable host, port, and timeout

#### Raw UDP

- Connectionless datagram protocol
- Suitable for high-frequency, low-overhead telemetry
- No delivery guarantee (fire-and-forget)
- Configurable host and port

#### Serial

- Direct serial port communication (RS-232/USB)
- Configurable baud rate (default: 115200)
- Line-based protocol with JSON payloads
- Uses `serialport` Node.js module

#### LoRa

- Long-range, low-power radio communication
- RN2483/RN2903 module support via serial AT commands
- Configurable frequency, spreading factor, bandwidth, TX power
- Payload size limit: ~250 bytes
- Hex-encoded compressed payloads

#### Reticulum

- Mesh networking protocol for resilient communication
- Requires `rnsd` daemon (installed via `pip install rns`)
- Supports multiple interface types:
  - AutoInterface (automatic peer discovery)
  - TCPClientInterface (TCP transport)
  - SerialInterface (serial transport)
  - RNodeInterface (LoRa via RNode hardware)
- Uses `rncp` for message delivery
- Supports store-and-forward when destination is unreachable

### 8.3 Transport Configuration Example

```json
[
  {
    "type": "https",
    "priority": 1,
    "enabled": true,
    "config": {
      "baseUrl": "https://holocron.example.com",
      "hmacSecret": "your-hmac-secret"
    }
  },
  {
    "type": "mqtt",
    "priority": 2,
    "enabled": true,
    "config": {
      "brokerUrl": "mqtts://broker.example.com:8883",
      "topicPrefix": "holocron/probe",
      "qos": 1
    }
  },
  {
    "type": "lora",
    "priority": 3,
    "enabled": true,
    "config": {
      "port": "/dev/ttyUSB0",
      "frequency": 868000000,
      "spreadingFactor": 7
    }
  }
]
```

---

## 9. AI System

### 9.1 Multi-Provider Architecture

HOLOCRON supports multiple AI providers that can be configured per organization:

| Provider | Identifier | Description |
|---|---|---|
| OpenAI | `openai` | GPT-4o (primary), GPT-4, GPT-3.5-turbo |
| Google Gemini | `gemini` | Gemini Pro, Gemini Flash |
| Anthropic | `anthropic` | Claude 3.5 Sonnet, Claude 3 Haiku |
| Custom | `custom` | Any OpenAI-compatible API endpoint |

Providers can be:
- Registered with API key and base URL
- Set as default for the organization
- Assigned to specific roles via `PATCH /api/org-roles/:id/ai-provider`
- Tested for connectivity via `POST /api/ai-providers/:id/test`

### 9.2 AI Cost Management

#### Template Cache

AI responses are cached in `aiCacheTemplates` to avoid redundant API calls:
- Cached by category and cache key
- Responses stored with hit count tracking
- Configurable expiry
- Cache statistics available via `/api/ai-cache/stats`

#### Cooldown Guards

Prevents rapid-fire AI calls:
- Time-based cooldowns between similar requests
- Prevents duplicate requests within cooldown windows

#### Deduplication Checks

Before making an AI call, the system checks:
1. Whether an identical request was recently made
2. Whether a cached response exists
3. Whether the result would be meaningfully different

#### AI Cost Estimator

Interactive cost estimation tool in the frontend for projecting AI usage costs based on:
- Number of agents
- Expected task volume
- Provider pricing

### 9.3 AI Features

#### NLP Agent Chat

- Natural language interface to interact with AI agents
- Messages are routed to the most appropriate agent role
- Routing reason is recorded for transparency
- Conversation threading with history

#### Agent Profile Generation

- AI analyzes agent roles against the service metrics catalog
- Generates metric monitoring profiles with priority assignments (critical/recommended/optional)
- Can suggest new metrics not yet in the catalog
- Profiles can be provisioned to create actual metric assignments

#### Operational Insights

- AI-generated predictive insights per agent role
- Based on current metrics, performance data, and historical patterns

#### Root Cause Analysis

- AI-driven analysis of incidents and alerts
- Correlates events across multiple data sources

#### Auto-Remediation Pipeline

1. Alert triggers remediation analysis
2. AI generates remediation script
3. Script is queued for human approval (`pending_approval` status)
4. Admin approves or rejects
5. Approved script is dispatched to the probe agent
6. Probe executes the script and reports results

#### KB-First Execution Strategy

When executing agent tasks:
1. Search the Knowledge Base for relevant articles
2. If a matching article is found, use it as context
3. Only call the AI provider if KB doesn't have sufficient information
4. This reduces token consumption and improves response consistency

#### Smart SR Auto-Assignment

When a Service Request is created:
- System analyzes the request type and content
- Automatically routes to the most relevant AI agent role
- Logs the assignment as an agent activity

#### SR-to-Incident Auto-Link

When a Service Request of type "Incident Report" is created:
- System automatically creates a linked Incident record
- Sets `linkedIncidentId` on the SR
- Logs the auto-creation as an agent activity

---

## 10. ITIL/ITSM Modules

### 10.1 Module Structure

Each ITIL module follows a consistent pattern:

- **KPI Dashboard** - Statistical overview via `/stats` endpoint
- **List View** - Paginated, searchable, filterable list
- **Detail View** - Full record with lifecycle pipeline
- **Create/Edit Forms** - Zod-validated input forms
- **Lifecycle Pipeline** - Server-side state transition validation

### 10.2 Incident Management

**Lifecycle States:** open -> investigating -> in_progress -> resolved (resolved can reopen to open)

**Statistics Endpoint** returns:
- Total count, counts by status
- Mean Time to Resolve (MTTR)
- SLA breach rate
- Counts by priority and category
- Resolution rate

### 10.3 Service Request Management

**Lifecycle States:** pending -> assigned -> in_progress -> on_hold -> pending_approval -> fulfilled/resolved/cancelled (with server-side transition validation)

**Features:**
- Auto-link to incidents for "Incident Report" type
- Smart AI agent auto-assignment based on request type
- XP awarded on fulfillment

### 10.4 Problem Management

**Lifecycle States:** open -> investigating -> root_cause_identified -> resolved (with server-side transition validation)

**Features:**
- Related incident linking
- Known error database
- Workaround documentation

### 10.5 Change Management

**Lifecycle States:** draft -> submitted -> under_review -> approved -> scheduled -> implemented -> closed (with server-side transition validation; also supports rejected, failed, cancelled states)

**Features:**
- Risk assessment (low/medium/high/critical)
- Impact assessment
- Rollback plan documentation
- Scheduled implementation windows
- Committee-driven approval gates

### 10.6 Knowledge Management

- Searchable article repository
- Category-based organization
- Helpfulness voting system
- Auto-generation from completed tasks
- Used by KB-First execution strategy

---

## 11. Gamification & Leaderboard

### 11.1 XP System

| Action | XP Awarded |
|---|---|
| Incident Resolved | 100 XP |
| Service Request Fulfilled | 50 XP |
| Critical Incident Bonus | 200 XP |
| Speed Bonus (resolved < 2 hours) | 75 XP |

### 11.2 Rank System

Ranks advance every 3 levels:

| Rank | Level Range |
|---|---|
| Bronze | 1-3 |
| Silver | 4-6 |
| Gold | 7-9 |
| Platinum | 10-12 |
| Diamond | 13-15 |
| Legendary | 16+ |

### 11.3 Leaderboard

The `/api/leaderboard` endpoint aggregates:
- Resolved incidents per agent
- Fulfilled service requests per agent
- Total XP calculation
- Level and rank determination
- Sorted by total XP descending

---

## 12. Business Continuity & Disaster Recovery

### 12.1 BCP Plans

Business Continuity Plans with lifecycle management:
- Plan creation with scope, objectives, and recovery strategies
- Status tracking (draft, review, approved, active, archived)

### 12.2 DRP Plans

Disaster Recovery Plans:
- Recovery strategies and procedures
- RTO/RPO targets
- Status lifecycle management

### 12.3 Business Impact Analysis (BIA)

- Process/function criticality assessment
- Maximum Tolerable Downtime (MTD) in hours
- Recovery Time Objective (RTO) in hours
- Workaround availability tracking
- Department-level aggregation

**Statistics include:**
- Total entries, critical count
- High MTD risk count (MTD <= 4 hours)
- Average RTO
- Workaround availability percentage
- Breakdown by criticality and department

### 12.4 Risk Assessments

- Threat category classification
- Risk scoring (likelihood x impact)
- Residual risk after mitigation
- Status tracking (identified, mitigated, accepted)

**Statistics include:**
- Total, critical (score >= 20), high (score >= 12)
- Mitigated, accepted, identified counts
- Breakdown by category, residual risk, and status

### 12.5 Drills

Continuity/recovery drill management:
- Drill type classification
- Scheduling with overdue detection
- Pass/fail result tracking
- Pass rate calculation

### 12.6 Reviews

Plan review management:
- Review type classification
- Status tracking (pending, in_progress, completed)
- Changes required flagging

---

## 13. Security Architecture

### 13.1 Authentication Security

- Passwords hashed with bcryptjs (salt rounds configurable)
- Session secrets stored in environment variables
- Session cookies: httpOnly, secure (production), sameSite: lax
- 30-day session expiry

### 13.2 Probe Communication Security (HMAC)

All probe-to-server communication is authenticated via HMAC-SHA256:

**Request Headers:**
- `X-Holocron-Signature` - HMAC-SHA256 signature of the request body
- `X-Holocron-Timestamp` - Unix timestamp of the request
- `X-Holocron-Nonce` - Unique nonce to prevent replay attacks

**Server-side Validation:**
1. Extract signature, timestamp, and nonce from headers
2. Verify timestamp is within acceptable window
3. Verify nonce has not been previously used
4. Compute expected HMAC using stored secret
5. Compare signatures using timing-safe comparison
6. Update stored nonce on success

**Probe-side Secret Storage:**
- Secrets stored in EnvironmentFile (systemd) with `chmod 600`
- Not embedded in probe scripts or configuration files

### 13.3 IDOR Protection

All authenticated routes enforce data isolation:
- Data creation injects `userId: req.user!.id`
- Read operations filter by userId
- Update/delete operations verify ownership before proceeding
- Returns 404 (not 403) for non-owned resources to prevent enumeration

### 13.4 Input Validation

- All request bodies validated using Zod schemas from `drizzle-zod`
- Insert schemas use `.pick()` or `.omit()` to exclude auto-generated fields
- Patch schemas use `.partial()` for partial updates
- Invalid requests return 400 with error details

---

## 14. Scalability & Performance

### 14.1 Database Optimization

- Composite indexes on frequently queried columns:
  - `idx_assets_user_probe` on (userId, probeId)
  - `idx_assets_probe_ip` on (probeId, ipAddress)
  - `idx_assets_probe_name` on (probeId, name)
  - `idx_remediation_probe_status` on (probeId, status)
- UUID primary keys for distributed ID generation
- JSONB columns for flexible metadata storage

### 14.2 Probe Scalability

- Designed for 1,000+ servers
- Probe clustering for horizontal scaling
- Hardware tiers from 1,500 to 10,000 metrics per node
- Adaptive heartbeat intervals (60s / 120s / 300s based on coupling mode)
- Batch heartbeat endpoint for multi-device telemetry

### 14.3 AI Cost Optimization

- Template cache system reduces redundant AI calls
- Cooldown guards prevent rapid-fire requests
- KB-First execution strategy minimizes token consumption
- Deduplication checks avoid duplicate work

### 14.4 Frontend Performance

- TanStack Query v5 for intelligent caching and background refetching
- Query key hierarchy for granular cache invalidation
- Skeleton/loading states during data fetching
- Pagination support across all list views

---

## 15. Deployment & Configuration

### 15.1 Environment Variables

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| SESSION_SECRET | Express session secret |
| OPENAI_API_KEY | OpenAI API key (for default AI provider) |
| NODE_ENV | Environment (development/production) |
| HOLOCRON_API | Base URL for probe communication |
| HOLOCRON_TRANSPORTS | JSON transport chain configuration |

### 15.2 Development Setup

The application uses a unified development server:
- Vite dev server serves the React frontend
- Express.js serves the API backend
- Both run on the same port via `server/vite.ts` integration
- Run with `npm run dev`

### 15.3 Database Schema

Database schema is managed via Drizzle ORM:
- Schema defined in `shared/schema.ts`
- Drizzle configuration in `drizzle.config.ts`
- Tables auto-created on first connection where applicable
- Session table auto-created by `connect-pg-simple`

### 15.4 Project Structure

```
/
+-- client/                    # Frontend React application
|   +-- src/
|       +-- components/        # Reusable UI components
|       |   +-- ui/            # shadcn/ui base components
|       |   +-- app-sidebar.tsx # Main navigation sidebar
|       +-- pages/             # Route page components
|       +-- hooks/             # Custom React hooks
|       +-- lib/               # Utility functions and query client
+-- server/                    # Backend Express application
|   +-- routes.ts              # API route definitions
|   +-- storage.ts             # IStorage interface and implementation
|   +-- auth.ts                # Authentication setup
|   +-- vite.ts                # Vite dev server integration
|   +-- probes/                # Probe agent implementations
|       +-- node/              # Node.js probe scripts
|       |   +-- probe-coupled.ts
|       |   +-- probe-semi.ts
|       |   +-- probe-auto.ts
|       |   +-- transports.ts  # Transport protocol implementations
|       +-- shell/             # Shell script probe implementations
|           +-- probe-coupled.sh
|           +-- probe-semi.sh
|           +-- probe-auto.sh
+-- shared/                    # Shared code between frontend and backend
|   +-- schema.ts              # Database schema and types
|   +-- countries.ts           # Country data for salary multipliers
+-- docs/                      # Documentation
+-- drizzle.config.ts          # Drizzle ORM configuration
+-- package.json               # Dependencies and scripts
+-- tsconfig.json              # TypeScript configuration
+-- tailwind.config.ts         # Tailwind CSS configuration
+-- vite.config.ts             # Vite build configuration
```
