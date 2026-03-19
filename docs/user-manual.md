# HOLOCRON AI Platform — User Manual

> **Version**: 7.0  
> **Audience**: IT Managers, NOC Operators, Service Desk Staff, Infrastructure Teams

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Organization Management](#2-organization-management)
3. [Infrastructure Management](#3-infrastructure-management)
4. [AI Operations](#4-ai-operations)
5. [ITIL Service Management](#5-itil-service-management)
6. [Orchestration](#6-orchestration)
7. [Probe Deployment Guide](#7-probe-deployment-guide)
8. [FAQ / Troubleshooting](#8-faq--troubleshooting)

---

## 1. Getting Started

### 1.1 Logging In

Navigate to the HOLOCRON AI platform URL in your browser. You will be presented with the login screen.

**Demo Credentials**:
- **Username**: `demo`
- **Password**: `demo123`

Enter your credentials and click **Log In**. On success you are redirected to the main dashboard.

### 1.2 Onboarding Tour

First-time users are greeted with an interactive **Guided Welcome Tour** that walks through the key areas of the platform:

1. **Crews & Agents** — How to manage your department hierarchy
2. **Infrastructure Cockpit** — Real-time operational overview
3. **Agent Matrix** — Browsing available AI roles
4. **Agent Chat** — Natural language interface for AI agents
5. **Recommendations** — AI-generated operational insights

The tour highlights sidebar items and provides contextual tips. You can skip the tour at any time or restart it from the help menu.

### 1.3 Navigation Overview

The platform uses a **sidebar navigation** organized into four sections:

| Section | Pages | Description |
|---------|-------|-------------|
| **Organization** | Crews & Agents, Active Agents | Manage departments, roles, and subscriptions |
| **Infrastructure Mgmt** | Cockpit, Configuration, Discovery, Assets, Events, Performance, Calendar, Service Metrics, Applications | Monitor and manage infrastructure |
| **AI Operations** | Agent Matrix, Ops Console, Agent Chat, Recommendations, Leaderboard | AI agent management and analytics |
| **Orchestration** | Incidents, Problems, Changes, Service Requests, On-Call Roster, Tasks, Workflows, Knowledge Base, BCP/DRP | ITIL service management and workflows |

The Infrastructure Management section is collapsible — click the section header to expand or collapse it. The Configuration sub-group (Configure, Service Metrics, Application Monitor) is also independently collapsible.

Each sidebar item includes a contextual help tooltip (hover over the small help icon that appears on the right side of inactive items).

### 1.4 Command Palette (Ctrl+K / Cmd+K)

Press **Ctrl+K** (Windows/Linux) or **Cmd+K** (Mac) to open the **Command Palette** — a quick-access search that lets you:

- Jump to any page instantly by typing its name
- Search for specific features or actions
- Navigate without using the sidebar

Start typing and select from the filtered results.

### 1.5 User Profile & Logout

Your user profile is displayed at the bottom of the sidebar, showing:
- Your display name
- Your company name (if set)
- A logout button (click the door icon)

### 1.6 Agent Status Indicator

At the top of the sidebar (below the HOLOCRON AI logo), the **Agent Status** panel shows:
- Number of AI shadows currently active
- Total roles assigned
- A progress bar showing AI coverage ratio

---

## 2. Organization Management

### 2.1 Crews & Agents (`/dashboard`)

The **Crews & Agents** page is your central hub for managing your organizational structure.

**Key Concepts**:
- **Crews** = Departments (e.g., Network Operations, Security, Database Administration)
- **Agents** = Roles within those departments (e.g., Network Engineer, DBA, Security Analyst)

**Creating a Crew**:
1. Navigate to **Crews & Agents** from the sidebar
2. Click **Create Crew**
3. Enter the crew name (department name)
4. The crew appears in the left panel as a department group

**Subscribing to Agents (Roles)**:
1. From the Crews & Agents page, browse available roles in the **Agent Matrix** or use the subscription panel
2. Click **Subscribe** on a role to add it to your organization
3. Each subscription represents one role seat in your org chart

**Assigning Humans**:
1. Select a subscribed role
2. Enter the **human name** of the person filling that role
3. Optionally add their **email** and **contact phone**
4. Save the assignment

**Enabling AI Shadows**:
1. On any subscribed role, toggle the **AI Shadow** switch
2. When enabled, an AI agent mirrors the human in that role
3. The AI shadow can autonomously handle tasks, respond to incidents, and provide recommendations
4. AI shadows appear with a purple "AI Shadow" badge throughout the platform

### 2.2 Active Agents (`/subscriptions`)

The **Active Agents** page provides a view of all your current role subscriptions:

- View subscription status (active, pending, cancelled)
- See which roles have AI shadows enabled
- Monitor per-role activity and workload
- Manage subscription lifecycle

---

## 3. Infrastructure Management

### 3.1 Cockpit (`/infrastructure/cockpit`)

The **Infrastructure Cockpit** is your central command center — a NOC-style real-time dashboard showing:

- **Overall Infrastructure Health** — Aggregated health score across all monitored assets
- **Active Alerts** — Critical, high, medium, and low severity alerts
- **AI Agent Coverage** — Which agents are monitoring which asset types
- **Discovery Status** — Active probe scans and recent discoveries
- **Quick Stats** — Total devices, services, and metrics being monitored

Use this page as your daily starting point to assess infrastructure status at a glance.

### 3.2 Configuring Discovery Probes (`/infrastructure/configure`)

The **Configure** page is where you deploy and manage discovery probes.

**Deploying a New Probe**:
1. Click **Deploy Probe** to open the deployment dialog
2. Select the **Probe Type** (determines coupling mode and capabilities)
3. Configure the probe parameters:
   - Name and description
   - Target network ranges
   - Credentials to use for discovery
   - Polling interval
4. Switch to the **Download** tab to get the probe package

**Download Tab — 7 Target Platforms**:

| Platform | Description | Use Case |
|----------|-------------|----------|
| **Kernel-Direct** | Distroless container with direct kernel access | Highest performance, minimal attack surface |
| **Linux Server (x86_64)** | Standard Linux server deployment | General-purpose data center servers |
| **Linux ARM (RPi/Edge)** | ARM-based deployment for Raspberry Pi and edge devices | Remote sites, IoT gateways |
| **Windows Server** | Windows Server service installation | Windows-based data centers |
| **Windows Endpoint** | Windows desktop/endpoint agent | End-user device monitoring |
| **Docker Container** | Containerized deployment | Cloud-native and Kubernetes environments |
| **OT/Industrial** | Specialized for operational technology | SCADA, PLCs, industrial control systems |

Each platform tab provides:
- Platform-specific installation commands
- A **Copy** button to copy commands to clipboard
- Configuration file templates
- Prerequisites and system requirements

### 3.3 Running Network Discovery Scans (`/infrastructure/discovery`)

The **Discovery** page lets you run network discovery scans:

**Setting Up Discovery**:
1. First, create **Discovery Credentials** (SNMP community strings, SSH keys, API tokens, etc.)
2. Supported credential protocols: SNMP v2c, SNMP v3, SSH, WMI, API, HTTP/HTTPS, LoRaWAN, BACnet, Modbus, MQTT
3. For API/HTTP credentials, configure endpoint paths, HTTP methods, content types, custom headers, rate limits, timeouts, SSL verification, and pagination

**Running a Scan**:
1. Select or create a discovery probe
2. Assign credentials to the probe
3. Click **Start Scan**
4. Monitor scan progress in real-time (progress bar, discovered device count)
5. When complete, review discovered assets

**Credential Management**:
- Add, edit, and delete discovery credentials
- Credentials are verified against target devices
- Status tracking: Configured, Verified, Failed

### 3.4 Asset Management (`/infrastructure/assets`)

The **Asset Management** page shows all discovered devices and assets:

- View devices by type (server, router, switch, firewall, workstation, etc.)
- See device details: hostname, IP address, OS, vendor, model
- Monitor device health status
- Link assets to AI agents for automated monitoring
- Search and filter assets by various criteria
- Paginated view for large asset inventories

### 3.5 Event Management (`/infrastructure/events`)

The **Event Management** page provides a unified view of all infrastructure events:

- View alerts, events, and incidents from all monitored sources
- Filter by severity (Critical, High, Medium, Low, Info)
- Filter by event type, source, and status
- **AI Root Cause Analysis**: For critical events, click the AI analysis button to get an AI-generated root cause assessment
- **AI Auto-Remediation**: For applicable events, the system can suggest and execute automated remediation actions (with approval workflow)
- Timeline view showing event correlation

### 3.6 Application Monitoring (`/infrastructure/applications`)

The **Application Monitor** provides:

- AI-powered application discovery
- Application health and uptime monitoring
- Dependency mapping between applications and infrastructure
- Performance metrics per application
- Alert configuration for application-specific thresholds

### 3.7 Performance Analytics (`/infrastructure/performance`)

The **Performance** page provides trend analysis:

- Historical performance data for infrastructure components
- CPU, memory, disk, and network utilization trends
- Anomaly detection highlights
- Comparative analysis across time periods
- Export capabilities for reporting

### 3.8 Activity Calendar (`/infrastructure/calendar`)

The **Activity Calendar** shows:

- Scheduled maintenance windows
- AI agent activity timelines
- Discovery scan schedules
- Change implementation dates
- Drill and test schedules

### 3.9 Service Metrics (`/infrastructure/service-metrics`)

The **Service Metrics** page is a centralized registry of monitorable metrics:

- Browse and configure metrics to monitor
- AI-driven metric assignment suggestions
- Best-practice monitoring profiles generated by AI
- Predictive operational insights

### 3.10 Probe Taxonomy (`/infrastructure/taxonomy`)

The **Probe Taxonomy** page explains the three coupling modes for probes and lets you manage probe type definitions.

**Three Coupling Modes**:

| Mode | Icon | Description |
|------|------|-------------|
| **Coupled** | Server | Requires constant server connectivity. Real-time telemetry and direct command dispatch. Always connected, server-driven, no local storage. |
| **Semi-Autonomous** | WiFi | Full local AI reasoning on edge devices (Raspberry Pi, drones). Operates independently and eventually reconnects to sync collected data and decisions. Store-and-forward sync. |
| **Fully Autonomous** | Brain | Full local AI reasoning with permanent independence. Operates indefinitely without server contact — self-healing, self-deciding, fully self-sufficient. No reconnection required. |

**Managing Probe Types**:
1. Click **New Probe Type** to create a custom probe definition
2. Select the coupling mode (this sets default configurations)
3. Configure:
   - Name and description
   - Discovery protocol (SNMP, SSH, WMI, HTTP, API, Modbus, BACnet, MQTT, LoRaWAN)
   - Deployment model (Bare-Metal, Container, Embedded, Cloud)
   - For edge modes: container image, resource requirements (CPU, Memory, Storage), buffer capacity, sync strategy
   - Local AI reasoning toggle
   - Enrollment requirement
   - Capabilities (custom tags)
4. Configure **Communication Protocols** — the transport chain with priority-ordered fallback:
   - HTTPS, MQTT, WebSocket, CoAP, Raw TCP, Raw UDP, Serial (RS-232/485), LoRa Radio, Reticulum (RNS)
   - Each protocol can be enabled/disabled and reordered by priority
   - Protocol-specific configuration (broker URLs, topics, QoS, TLS, baud rates, etc.)

---

## 4. AI Operations

### 4.1 Agent Matrix (`/agent-matrix`)

The **Agent Matrix** provides a comprehensive overview of all available AI agent roles:

- Browse all agent roles organized by department
- See which roles are subscribed and which have AI shadows
- View agent capabilities, specializations, and recommended use cases
- Subscribe to new roles directly from the matrix
- Filter by department, level, and status

### 4.2 Ops Console (`/agent-console`)

The **Ops Console** is your window into AI agent operations:

- Real-time activity feed showing what each AI agent is doing
- Task execution logs and results
- Agent performance metrics
- Error tracking and diagnostics
- Filter by agent, task type, and status

### 4.3 Agent Chat (`/agent-chat`)

The **Agent Chat** provides a natural language interface to interact with AI agents:

- Type questions or commands in plain English
- The system automatically routes your message to the most appropriate AI agent
- Get instant responses, analysis, and recommendations
- Request specific actions (e.g., "Check the status of server DB-01")
- View conversation history
- AI agents reference the Knowledge Base before making external AI calls (KB-First strategy)

### 4.4 Recommendations (`/recommendations`)

The **Recommendations** page shows AI-generated insights and suggestions:

- Proactive recommendations for infrastructure improvements
- Cost optimization suggestions
- Security posture improvements
- Performance tuning recommendations
- Capacity planning insights
- Each recommendation includes priority, impact assessment, and suggested actions

### 4.5 Leaderboard (`/leaderboard`)

The **Leaderboard** is a gamified ranking system for AI agents based on their performance:

**XP System**:

| Action | XP Earned |
|--------|-----------|
| Incident Resolved | +100 XP |
| Service Request Completed | +50 XP |
| Critical Incident Resolved | +200 XP |
| Speed Bonus (resolved in < 2 hours) | +75 XP |

**Rank Progression**:

| Rank | Description |
|------|-------------|
| **Bronze** | Starting rank |
| **Silver** | Consistent performer |
| **Gold** | High performer with significant contributions |
| **Platinum** | Elite performer |
| **Diamond** | Top-tier agent |
| **Legendary** | The absolute best performers |

**Leaderboard Features**:
- **Top Performers Podium** — The top 3 agents are displayed prominently with trophy/medal icons
- **Full Rankings Table** — All agents listed with their stats
- **Summary Cards** — Total resolved, average resolution time, fastest resolution, total XP
- Per-agent stats: incidents resolved, service requests completed, average resolution time, fastest resolution, critical incidents handled, streak count
- XP progress bars showing progress within current level (every 500 XP = 1 level)
- Auto-refreshes every 30 seconds

---

## 5. ITIL Service Management

### 5.1 Incidents (`/incidents`)

The **Incidents** module follows ITIL incident management best practices:

**Incident Lifecycle**: Open → Investigating → In Progress → Resolved (can reopen)

**Severity Levels**: Critical, High, Medium, Low

**Creating an Incident**:
1. Click **New Incident**
2. Fill in title, description, severity, and category
3. Assign to an agent or team
4. Submit — the incident enters "Open" status

**Managing Incidents**:
- View KPI dashboard with total counts, by-severity breakdowns, and lifecycle pipeline
- Search and filter by status, severity, category, and assignment
- Click on an incident to see full details
- Progress incidents through the lifecycle with action buttons
- View resolution notes and timeline
- Paginated list for large volumes

### 5.2 Problems (`/problems`)

The **Problems** module handles root cause analysis:

- Create problem records to track underlying causes of recurring incidents
- Link problems to related incidents
- Perform root cause analysis (RCA) with AI assistance
- Track known errors and workarounds
- Lifecycle: Open → Investigating → Known Error → Resolved

### 5.3 Changes (`/changes`)

The **Changes** module implements ITIL change management:

**Change Types**: Standard, Normal, Emergency

**Lifecycle**: Draft → Submitted → Under Review → Approved → Scheduled → Implemented → Closed (or Failed/Cancelled/Rejected at various stages)

**Key Features**:
- **CAB Approval** — Changes requiring Change Advisory Board review are routed through the committee workflow
- **Risk Assessment** — Each change includes risk level (Low, Medium, High, Critical), impact analysis, and rollback plan
- **Implementation Plan** — Detailed steps, timeline, and resource requirements
- **Post-Implementation Review** — Track outcomes after deployment
- Filter by type, status, risk level, and assignment

### 5.4 Service Requests (`/service-requests`)

The **Service Requests** module manages user-facing service requests:

**Key Features**:
- Create service requests for common IT needs
- Request types include: Access Request, Hardware Request, Software Install, Incident Report, General Inquiry, and more
- **Auto-Link to Incidents** — When a request type is "Incident Report", the system automatically creates a linked Incident record
- **AI Agent Auto-Assignment** — New service requests are automatically routed to the most relevant AI agent based on request type and content
- Track request status through completion
- View KPIs and distribution analytics
- Search and filter capabilities

---

## 6. Orchestration

### 6.1 On-Call Roster (`/on-call-roster`)

The **On-Call Roster** manages personnel availability for incident response:

**Availability Statuses**:
| Status | Description |
|--------|-------------|
| Available | Ready to take assignments |
| On Call | Designated on-call responder |
| Busy | Currently handling tasks |
| On Break | Temporarily unavailable |
| Off Duty | Not working |

**Features**:
- View all personnel with their current status (animated pulse dots for available/on-call)
- Edit availability: set status, shift duration, max workload, and contact phone
- Shift time display showing start and end times
- Workload bars showing current task load vs. capacity
- AI Shadow indicators showing which roles have AI backup
- Summary cards: Total Personnel, Available Now, On Call, Utilization %, Active Tasks
- Availability distribution bar showing status breakdown
- Filter by status, department, and search by name/role
- Auto-refreshes every 15 seconds

### 6.2 Tasks (`/tasks`)

The **Tasks** page manages AI agent task assignments:

- View and manage tasks assigned to AI agents
- Task status tracking (pending, in progress, completed, failed)
- AI-powered autonomous task execution
- **KB-First Execution** — AI agents search the Knowledge Base for relevant information before making external AI API calls, reducing costs
- Task priority and deadline management
- Assignment and reassignment capabilities

### 6.3 Workflows (`/workflows`)

The **Workflows** page manages orchestration pipelines:

**Process Types**:
- **Sequential** — Stages execute one after another in order
- **Parallel** — Multiple stages can execute simultaneously
- **Conditional** — Stage execution depends on conditions and outcomes of previous stages

**Creating a Workflow**:
1. Click **New Workflow**
2. Enter name, description, and process type
3. Submit to create a draft workflow
4. Add stages to the workflow (task, approval gate, automated, notification)

**Approval Gates & Committees**:
- Workflows can include **approval gate** stages that require committee approval
- Create committees (CAB, Security Review Board, Emergency Change Committee, Problem Review Board, or Custom)
- Each committee has:
  - Members selected from assigned personnel
  - A designated chair
  - Quorum requirement (minimum votes needed)
- Approval gates track current approvals vs. required approvals

**Stage Types**:
| Type | Description |
|------|-------------|
| Task | A work item to be completed |
| Approval Gate | Requires committee vote to proceed |
| Automated | Executes automatically without human intervention |
| Notification | Sends notifications to stakeholders |

**Workflow Lifecycle**: Draft → Active → Completed (or Paused/Failed)

**Dashboard Stats**: Total workflows, active/draft/completed counts, pending approval gates, committee counts

### 6.4 Knowledge Base (`/knowledge-base`)

The **Knowledge Base** is a centralized repository of ITIL articles:

- Create and manage knowledge articles
- Categories for organizing content
- Search functionality for quick access
- **AI-Assisted Generation** — AI agents can generate article drafts based on resolved incidents
- Articles are referenced by AI agents during task execution (KB-First strategy) to reduce external API token consumption
- Version tracking and review workflows

### 6.5 BCP / DRP (`/bcp-drp`)

The **Business Continuity Planning / Disaster Recovery Planning** module provides comprehensive resilience management across six tabs:

**BCP Plans Tab**:
- Create and manage Business Continuity Plans
- Each plan includes: title, description, category (operational, financial, technology, personnel, facilities), business impact level, RTO/RPO targets, critical processes, recovery strategy, stakeholders, and owner
- Lifecycle: Draft → Under Review → Approved → Active → Expired
- KPI dashboard with plan counts, status pipeline, and impact distribution
- Search and filter by status, category, and impact level

**DRP Plans Tab**:
- Create and manage Disaster Recovery Plans
- Each plan includes: title, description, disaster type (natural disaster, cyber attack, hardware failure, power outage, data breach, network failure, pandemic, other), severity, RTO/RPO targets, recovery procedures, failover type, affected systems, and owner
- Lifecycle: Draft → Under Review → Approved → Active → Testing
- KPI dashboard with test result tracking

**Impact Analysis (BIA) Tab**:
- Create Business Impact Analysis entries
- Assess the impact of disruptions on critical business processes
- Link to BCP plans

**Risk Register Tab**:
- Maintain a risk assessment register
- Track identified risks, likelihood, impact, and mitigation strategies
- Link risks to BCP/DRP plans

**Drills & Exercises Tab**:
- Schedule and track continuity/recovery drills
- Record drill results: Passed, Failed, Partial, Not Tested
- Track lessons learned and improvement actions

**Reviews Tab**:
- Schedule and conduct plan reviews
- Track review outcomes and action items
- Ensure plans remain current and effective

---

## 7. Probe Deployment Guide

### 7.1 Choosing the Right Coupling Mode

| If you need... | Choose... |
|----------------|-----------|
| Real-time monitoring with constant connectivity | **Coupled** |
| Edge deployment that works offline and syncs later | **Semi-Autonomous** |
| Fully independent operation with no server dependency | **Fully Autonomous** |

**Coupled** probes are best for data center environments with reliable network connectivity. They provide real-time telemetry but cannot operate if the connection to the Holocron server is lost.

**Semi-Autonomous** probes are ideal for remote sites, branch offices, or mobile deployments (drones, vehicles). They collect data locally and sync when connectivity is available. They include store-and-forward buffering.

**Fully Autonomous** probes are designed for isolated environments or scenarios requiring complete independence. They include on-device AI reasoning and never need to reconnect to the server.

### 7.2 Choosing the Right Platform

| Platform | Best For |
|----------|----------|
| **Kernel-Direct** | Production servers requiring minimal overhead and maximum security |
| **Linux Server (x86_64)** | Standard data center Linux servers |
| **Linux ARM (RPi/Edge)** | Raspberry Pi, edge gateways, ARM-based devices |
| **Windows Server** | Windows Server environments |
| **Windows Endpoint** | Monitoring Windows desktops and laptops |
| **Docker Container** | Kubernetes clusters, cloud-native infrastructure |
| **OT/Industrial** | SCADA systems, PLCs, industrial control networks |

### 7.3 Step-by-Step Deployment

**General Steps** (all platforms):

1. **Navigate** to Infrastructure → Configure (`/infrastructure/configure`)
2. **Click** "Deploy Probe"
3. **Select** your probe type (coupling mode)
4. **Configure** the probe:
   - Give it a descriptive name
   - Set the target network ranges
   - Assign discovery credentials
   - Set the polling interval
5. **Switch** to the "Download" tab
6. **Select** your target platform
7. **Copy** the installation commands
8. **Execute** the commands on your target system
9. **Verify** the probe appears in the probe list with a "connected" status

**Linux Server Deployment**:
```bash
# 1. Download the probe package
# 2. Extract and install
# 3. Configure the environment file with your server URL and probe token
# 4. Start the probe service
# 5. Enable auto-start on boot
```

**Docker Deployment**:
```bash
# 1. Pull the probe container image
# 2. Run with appropriate environment variables
# 3. Map required volumes for persistent storage
# 4. Configure network access to target subnets
```

**Windows Deployment**:
```powershell
# 1. Download the Windows probe installer
# 2. Run the installer with admin privileges
# 3. Configure the service with your server connection details
# 4. Start the Holocron Probe service
```

**Security Best Practices**:
- Store configuration in environment files, not inline
- Set file permissions to `chmod 600` on config files (Linux)
- Never embed secrets directly in scripts
- Use TLS/SSL for all probe-to-server communication

### 7.4 Transport Protocol Selection Guide

Probes communicate with the Holocron server using a **Transport Chain** — a priority-ordered list of protocols with automatic failover.

| Protocol | Best For | Notes |
|----------|----------|-------|
| **HTTPS** | General purpose, most environments | Default protocol, works through firewalls |
| **MQTT** | IoT environments, pub/sub patterns | Lightweight, supports QoS levels 0-2, optional TLS |
| **WebSocket** | Real-time bidirectional communication | Persistent connection, good for frequent updates |
| **CoAP** | Constrained devices, low-bandwidth networks | UDP-based, very lightweight |
| **Raw TCP** | Direct socket communication | JSON framing, good for high-throughput scenarios |
| **Raw UDP** | Connectionless, fire-and-forget telemetry | Lowest overhead, no delivery guarantee |
| **Serial (RS-232/485)** | Industrial/OT equipment | Hardware serial port, configurable baud rate |
| **LoRa Radio** | Long-range, low-power deployments | Via RN2483/RNode hardware, ISM band frequencies |
| **Reticulum (RNS)** | Encrypted mesh networking | End-to-end encryption, works over any transport |

**Failover**: If the primary protocol fails, the probe automatically tries the next protocol in priority order until a connection is established.

### 7.5 Troubleshooting Common Issues

**Probe Not Connecting**:
- Verify the server URL is correct and accessible from the probe's network
- Check firewall rules — ensure the required ports are open
- Verify the probe token/credentials are valid
- Check the probe logs for connection error details

**Discovery Not Finding Devices**:
- Verify the target network range is correct
- Ensure discovery credentials (SNMP community strings, SSH keys, etc.) are valid
- Check that the probe has network access to the target subnet
- Try a smaller subnet range first to validate configuration

**Probe Shows "Error" Status**:
- Check the probe's local logs for error messages
- Verify the probe has sufficient system resources (CPU, memory, disk)
- Ensure all required dependencies are installed
- Restart the probe service and check if the issue persists

**Intermittent Connectivity**:
- Configure multiple transport protocols in the Transport Chain for failover
- Set appropriate reconnect intervals
- For unreliable networks, consider Semi-Autonomous mode with store-and-forward buffering
- Check network quality (latency, packet loss) between probe and server

**High Resource Usage**:
- Increase the polling interval to reduce frequency of checks
- Reduce the number of target subnets per probe
- Use probe clustering to distribute the load across multiple nodes
- Review and optimize the metrics being collected

---

## 8. FAQ / Troubleshooting

### General

**Q: How do I reset my password?**  
A: Contact your system administrator. Password management is handled through the admin interface.

**Q: Can multiple users be logged in at the same time?**  
A: Yes, HOLOCRON AI supports concurrent sessions. Each user has independent access.

**Q: What browsers are supported?**  
A: HOLOCRON AI works best on modern browsers — Chrome, Firefox, Edge, and Safari (latest versions).

### Organization

**Q: What's the difference between a Crew and an Agent?**  
A: A **Crew** is a department (e.g., "Network Operations"). An **Agent** is a role within that department (e.g., "Senior Network Engineer"). Think of Crews as teams and Agents as job positions.

**Q: What does "AI Shadow" mean?**  
A: An AI Shadow is an artificial intelligence agent that mirrors a human role. When enabled, the AI shadow can autonomously handle routine tasks, respond to alerts, and provide recommendations — working alongside (or in place of) the human assigned to that role.

**Q: Can I have a role without a human assigned?**  
A: Yes. You can subscribe to a role and enable only the AI shadow without assigning a human. This is useful for augmenting your team with AI-only positions.

### Infrastructure

**Q: How often do probes report data?**  
A: The default polling interval is configurable per probe. Typical intervals range from 30 seconds to 5 minutes depending on the metric type and criticality.

**Q: Can a probe monitor devices across different subnets?**  
A: Yes, as long as the probe has network connectivity to those subnets. Configure multiple network ranges in the probe settings.

**Q: What happens if a Semi-Autonomous probe loses connectivity?**  
A: It continues operating independently, storing collected data in its local buffer. When connectivity is restored, it syncs all buffered data back to the server. Buffer capacity is configurable (default: 10,000 entries).

### AI Operations

**Q: How does Agent Chat know which AI agent to use?**  
A: The system uses NLP-based routing to analyze your message and direct it to the most relevant AI agent based on the content, context, and agent specializations.

**Q: What is the KB-First Execution strategy?**  
A: Before making an external AI API call (which costs tokens), AI agents first search the Knowledge Base for relevant articles and solutions. This reduces operational costs and provides faster responses for known issues.

**Q: How is XP calculated on the Leaderboard?**  
A: XP is earned automatically based on agent actions: 100 XP per incident resolved, 50 XP per service request completed, 200 XP for critical incident resolution, and 75 XP for speed bonuses (resolved in under 2 hours). Every 500 XP equals one level.

### ITIL / Service Management

**Q: What happens when I create an "Incident Report" service request?**  
A: The system automatically creates a linked Incident record and associates it with the service request. This ensures proper ITIL process alignment.

**Q: How does AI Auto-Assignment work for service requests?**  
A: When a new service request is submitted, the system analyzes the request type and content, then automatically assigns it to the most relevant AI agent based on role specializations and current workload.

**Q: What is a CAB approval?**  
A: CAB (Change Advisory Board) is a committee that reviews and approves change requests. In HOLOCRON AI, you create committees with designated members and a chair, set a quorum requirement, and route change workflows through approval gates that require the committee's vote.

### Workflows

**Q: What's the difference between Sequential, Parallel, and Conditional workflows?**  
A: **Sequential** executes stages one after another. **Parallel** allows multiple stages to run at the same time. **Conditional** uses the outcome of previous stages to decide which stages to execute next.

**Q: What is a quorum in committee voting?**  
A: The quorum is the minimum number of committee members who must vote for the decision to be valid. For example, if a committee has 5 members and a quorum of 3, at least 3 members must cast their vote before the approval gate can proceed.

### BCP / DRP

**Q: What is RTO and RPO?**  
A: **RTO** (Recovery Time Objective) is the maximum acceptable time to restore a service after disruption. **RPO** (Recovery Point Objective) is the maximum acceptable amount of data loss measured in time. For example, an RTO of 4 hours means the service must be restored within 4 hours, and an RPO of 1 hour means you can afford to lose at most 1 hour of data.

**Q: How do BCP and DRP differ?**  
A: **BCP** (Business Continuity Planning) focuses on how to continue operations during and after a disruption — it covers processes, people, and procedures. **DRP** (Disaster Recovery Planning) specifically addresses technology recovery — restoring IT systems, data, and infrastructure after a disaster.

---

*HOLOCRON AI Platform v7.0 — Automation Orchestration Platform*
