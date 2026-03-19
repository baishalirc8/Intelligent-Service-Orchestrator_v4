# HOLOCRON AI - Automation Orchestration Platform

## Overview
HOLOCRON AI is an AI-powered SaaS platform designed to enhance IT operations management by integrating human teams with optional AI shadow agents. Its core purpose is to optimize IT operations, reduce costs, and provide strategic IT oversight through intelligent automation and a human-first approach, establishing a new standard for IT management aligned with ITIL principles.

## User Preferences
I prefer detailed explanations.
I want iterative development.
Ask before making major changes.

## System Architecture

### Core Concepts
The system models an IT hierarchy with 10 departments plus an Executive department, allowing for human team members and optional AI shadow agents to augment roles. The platform emphasizes a human-first approach, leveraging AI for automation and strategic insights within this structure.

### Tech Stack
-   **Frontend**: React + TypeScript, Tailwind CSS, shadcn/ui, wouter, TanStack Query
-   **Backend**: Express.js, Node.js
-   **Database**: PostgreSQL with Drizzle ORM
-   **Authentication**: Passport.js with session management and bcryptjs.

### UI/UX Design System
The platform features a dark mode theme with blue/purple accent glow effects. Departments are termed "Crews" and roles are "Agents." Key navigation includes Organization, Infrastructure Management, AI Operations, and Orchestration. UX is enhanced with a Guided Welcome Tour, Command Palette, Setup Progress Indicator, Quick Actions Dashboard, Contextual Help Tooltips, Keyboard Shortcut Hints, and a context-aware AI Assistant Avatar.

### Key Features and Implementations
-   **Onboarding & Infrastructure Management**: Interactive setup, multi-platform probe deployment (Coupled, Semi-Autonomous, Fully Autonomous modes), NOC-style Discovery Dashboard, Asset Management, Probe Health Monitoring, AI-powered application discovery, unified Event Management with AI-driven Root Cause Analysis, live Performance Monitoring, and AI Auto-Remediation with an approval pipeline.
-   **Mobile Device Management (MDM)**: Comprehensive Android & iOS fleet management, including enrollment, inventory, remote actions, and a compliance policy engine.
-   **AI Operations**: AI Agent Ops Console for task visibility and performance, NLP Agent Chat Interface, human-manager communication for AI agent alerts, Multi-Credential Probes, and Probe Clustering.
-   **Scalability**: Designed for high-volume environments (1,000+ servers) with optimizations like database indexing, asset lookup, batch processing, and adaptive heartbeat intervals.
-   **Service Metrics Catalog**: Centralized registry for monitorable metrics, AI-driven assignment, AI-generated best-practice profiles, predictive operational insights, and AI Cost Management.
-   **ITIL ITSM Suite**: Comprehensive ITIL-aligned modules for Incidents, Problems, Changes, Service Requests, BCP/DRP, Known Error Database (KEDB), SLA/OLA Management, Real-time SLA Breach Tracker, Service Health Monitor, Capacity Management, CSI Register, and Release Management. Features include SR→Incident Auto-Link, Smart AI Agent Auto-Assignment, On-Call Roster, Gamified Leaderboard, Workflow Orchestration, and AI Agent Task Management with a "KB-First Execution" strategy.
-   **Command Control Center (CCC)**: OS-aware ITIL v4 multi-asset command dispatch system with a persistent Command Catalog (Draft → Dry Run → Published lifecycle), execution history, rollback, parameterized variables, AI output analysis, scheduled commands, and 4-Eyes approval.
-   **AI Agentic Debug Loop**: AI-powered debugging for failed commands, root cause identification, script generation, and fix application options.
-   **AI NLP Command Composer**: Generates production-grade scripts from natural language intent using asset context and a KB cache.
-   **AI Command Review (KB-First Cache)**: On-demand AI quality assurance for Command Catalog entries.
-   **Command Scope RBAC**: Domain-based role-based access control.
-   **AI-Driven Patch Management**: Full ITIL v4-aligned patch lifecycle management including CVE Registry with AI Prioritization, deployment, and compliance tracking.
-   **Asset Terminal**: Custom terminal emulator for remote command execution on enrolled assets.
-   **Security & Compliance Domain**: Full ITIL-aligned cybersecurity suite with 18 modules across Threat & Vulnerability, Cloud & Endpoint, SOC & Incident Response, Identity & Compliance, Tooling, and Awareness.
-   **Module Catalog & Dynamic Sidebar**: Users activate modules from 6 domains, with domain dependencies ensuring core modules are active when required.
-   **Flyguys Drone Services Use-Case Factory**: Full partner integration for drone operations, including requests, bidding, projects, operators, fleet, transactions, and a Drone Mission Tracker with interactive map, real-time tracking, AI route adherence monitoring, and alerts.
-   **AI Quality Reviewer & Governance**: Automatic AI quality review, real-time hallucination detection, prompt injection protection, schema validation, drift monitoring, human-in-the-loop review, and an AI Remediation Pipeline with Circuit Breaker, Auto-Incident creation, and Prompt Patching.
-   **Holocron Conclave**: Multi-agent adversarial deliberation system for structured consensus to reduce hallucination.
-   **AI Knowledge Base (Semantic RAG)**: PGVector-powered document ingestion and retrieval. Documents are chunked (~1,800 chars, 200-char overlap) and embedded via OpenAI text-embedding-3-small (1,536-dim). On every AI call, top-3 semantically similar chunks (cosine similarity >35%) are auto-injected into the system prompt. Includes: AI Chat interface grounded in knowledge base with source citations, Test Retrieval panel for raw chunk inspection, and document management (ingest/delete). Tables: `knowledge_documents`, `document_chunks`. Routes: POST /api/ai-knowledge-base/ingest, GET/DELETE /api/ai-knowledge-base/documents, POST /api/ai-knowledge-base/search, POST /api/ai-knowledge-base/chat.
-   **Fine-tune Dataset Curator**: Curates AI Governance context store entries into JSONL training datasets for fine-tuning open-weight LLMs. Features: Include/Exclude toggles, inline pair editing, per-entry JSONL preview, AI Enhance (rewrites assistant response for quality via HOLOCRON AI), and JSONL export compatible with Unsloth/Axolotl/OpenAI fine-tuning API. New columns on `ai_context_entries`: `excluded_from_finetune`, `finetune_user_message`, `finetune_assistant_response`. Routes: PATCH /api/ai-governance/context-store/:id/finetune, GET /api/ai-governance/finetune-export.jsonl, POST /api/ai-governance/context-store/:id/ai-enhance.

## External Dependencies
-   **PostgreSQL**: Primary relational database.
-   **Passport.js**: Authentication middleware.
-   **express-session, connect-pg-simple**: Session management.
-   **bcryptjs**: Password hashing.
-   **React, TypeScript, Tailwind CSS, shadcn/ui, wouter, TanStack Query, Express.js, Node.js, Drizzle ORM**: Core development technologies.
-   **Multi-Provider AI System with Free LLM Priority Chain**: Integrates various AI providers (e.g., Ollama, Gemini, Grok, Groq, Mistral, OpenRouter, Together AI, HuggingFace, OpenAI) with a priority chain and fallback mechanisms for AI call instrumentation, audit logging, and provider management.
-   **react-leaflet, OpenStreetMap**: For interactive map functionalities in the Drone Mission Tracker.