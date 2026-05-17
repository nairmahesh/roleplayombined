# PitchIQ — Requirements & Technical Architecture Document

**Version**: 1.0  
**Date**: 2026-05-17  
**Classification**: Internal — Engineering & Product

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Roles & Permissions](#2-user-roles--permissions)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [System Architecture](#5-system-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Backend Architecture](#7-backend-architecture)
8. [Database Schema](#8-database-schema)
9. [API Contracts](#9-api-contracts)
10. [Real-Time Communication](#10-real-time-communication)
11. [State Management](#11-state-management)
12. [Authentication & Security](#12-authentication--security)
13. [Plan & Feature Gating](#13-plan--feature-gating)
14. [Third-Party Integrations](#14-third-party-integrations)
15. [Routing & Navigation](#15-routing--navigation)
16. [Build & Deployment](#16-build--deployment)
17. [Known Constraints & Assumptions](#17-known-constraints--assumptions)

---

## 1. Product Overview

**PitchIQ** is a multi-tenant, AI-powered sales coaching and roleplay platform. It enables sales teams to practice realistic customer conversations with AI personas, receive structured framework-based feedback, track performance over time, and compete on leaderboards.

### Core Value Propositions

| Proposition | Description |
|---|---|
| AI Roleplay | Practice sales calls against configurable AI personas with realistic objections and buying signals |
| Framework Coaching | Structured feedback mapped to MEDDIC, MEDDICC, SPIN, BANT, Challenger, or SNAP frameworks |
| Performance Analytics | Session history, score trends, framework gap analysis, peer benchmarking |
| Team Management | Managers assign roleplays, set targets, and monitor rep performance |
| Knowledge Base | Attach product docs, FAQs, and competitor intel to inform the AI and brief the user pre-call |
| Peer Learning | Listen to anonymised peer sessions to accelerate ramp time |

---

## 2. User Roles & Permissions

### Role Hierarchy

```
SUPER_ADMIN
  └── COMPANY_ADMIN (per tenant)
        └── MANAGER (per team)
              └── AGENT (individual contributor)
```

### Permission Matrix

| Feature | AGENT | MANAGER | COMPANY_ADMIN | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|
| Practice (own) | yes | yes | yes | yes |
| View own sessions | yes | yes | yes | yes |
| View team sessions | — | yes | yes | yes |
| View all company sessions | — | — | yes | yes |
| Invite users | — | yes | yes | yes |
| Manage roles | — | — | yes | yes |
| Company settings | — | — | yes | yes |
| Plan management | — | — | yes | yes |
| Evaluation rubrics | — | — | yes | yes |
| Save team roleplays | — | yes | yes | yes |
| Leaderboard | yes | yes | yes | yes |
| Super admin panel | — | — | — | yes |
| Cross-tenant access | — | — | — | yes |

---

## 3. Functional Requirements

### 3.1 Authentication

| ID | Requirement |
|---|---|
| AUTH-01 | Users log in with email + password |
| AUTH-02 | JWT access tokens expire; refresh tokens rotate |
| AUTH-03 | Logout revokes refresh token server-side |
| AUTH-04 | Password reset generates a temporary password |
| AUTH-05 | Registration is open for AGENT self-sign-up |
| AUTH-06 | Super Admin accounts are provisioned separately |

### 3.2 Practice (Roleplay)

| ID | Requirement |
|---|---|
| PRAC-01 | User selects or builds a scenario in a 4-step wizard: Context → Persona → Knowledge → Launch |
| PRAC-02 | Context step: set roleplay type, difficulty, language, region |
| PRAC-03 | Persona step: pick preset persona, load saved persona, or build custom |
| PRAC-04 | Knowledge step: attach bot training content (text/URL/file) and pre-call user briefing content |
| PRAC-05 | Knowledge Base has a master on/off toggle and individual section collapse toggles for Bot Training and Pre-Call Briefing |
| PRAC-06 | Launch step: select sales framework (dropdown), call format (phone/online), time limit |
| PRAC-07 | Save for Team dropdown: Save for All Users / Share with Team / Share with Individual (with user filter) |
| PRAC-08 | Pre-call briefing modal presents user material before session start |
| PRAC-09 | Live call interface streams AI responses via ElevenLabs Conversational AI |
| PRAC-10 | Microphone audio is captured, sent to backend for STT; AI replies are synthesised to audio |
| PRAC-11 | Session is recorded (audio or video) via MediaRecorder; recording uploaded to S3 on end |
| PRAC-12 | Call duration is tracked in real time |
| PRAC-13 | Session ends either by user action, time limit, or natural conversation close |
| PRAC-14 | On end, backend scores the session and generates AI feedback |

### 3.3 Personas

| ID | Requirement |
|---|---|
| PER-01 | System ships with preset personas (read-only) |
| PER-02 | Authorised users (plan-gated) can create custom personas |
| PER-03 | Persona attributes: name, title, company, industry, emoji/avatar, difficulty, personality description, system prompt, objections list, buying signals list, supported frameworks, voice ID |
| PER-04 | Personas can be scoped to a company or global (presets) |
| PER-05 | Deleting a persona does not delete historical sessions referencing it |

### 3.4 Sessions & Feedback

| ID | Requirement |
|---|---|
| SESS-01 | Sessions record full transcript (role, content, timestamp per message) |
| SESS-02 | Framework scores are stored per component (e.g., for MEDDIC: Metrics, Economic Buyer, etc.) |
| SESS-03 | Timeline events mark specific moments as GOOD, ISSUE, WARNING, or NEUTRAL |
| SESS-04 | AI feedback includes strengths, areas for improvement, and pro tips |
| SESS-05 | Recordings stored as S3 keys; playback via presigned URL |
| SESS-06 | Feedback page syncs transcript scroll to playback position |
| SESS-07 | Sessions page supports filtering by rep, framework, type, score range, date range |
| SESS-08 | Managers and admins can view all sessions within their scope |

### 3.5 Team Roleplays

| ID | Requirement |
|---|---|
| TR-01 | Managers/admins can save a scenario configuration as a named Team Roleplay |
| TR-02 | Assignment targeting: All Users / by Team / by Region / by Individual user(s) |
| TR-03 | Individual assignment supports filtering by team, region, territory, zone |
| TR-04 | Team Roleplays can be activated/deactivated |
| TR-05 | Peer listening can be enabled per team roleplay |
| TR-06 | Agents see their assigned roleplays on the Practice page |

### 3.6 Analytics & Leaderboard

| ID | Requirement |
|---|---|
| AN-01 | Dashboard shows role-appropriate KPIs (sessions, avg score, pass rate, rank) |
| AN-02 | Manager dashboard shows team-level aggregates and per-rep breakdown |
| AN-03 | Admin dashboard shows company-wide metrics and top performers |
| AN-04 | Leaderboard supports all-time and monthly views |
| AN-05 | Framework performance chart shows per-component average scores |
| AN-06 | AI coaching insights surface patterns across recent sessions |

### 3.7 Team Management

| ID | Requirement |
|---|---|
| TM-01 | Admins/managers can invite users by email (generates temporary password) |
| TM-02 | Roles: AGENT, MANAGER, COMPANY_ADMIN |
| TM-03 | Manager assignment links reports to a manager |
| TM-04 | User attributes: location, region, team, territory, zone |
| TM-05 | Users can be deactivated (soft delete) |

### 3.8 Evaluation Prompts

| ID | Requirement |
|---|---|
| EP-01 | Admins can define scoring rubrics per roleplay type |
| EP-02 | Rubrics contain scoring criterion groups, each with questions and hints |
| EP-03 | A prompt template (with `{transcript}` placeholder) drives AI scoring |
| EP-04 | Global defaults exist; company-specific rubrics override them |
| EP-05 | Only active rubrics are used at scoring time |

### 3.9 Super Admin

| ID | Requirement |
|---|---|
| SA-01 | Super Admin can list, create, and inspect all tenants |
| SA-02 | Platform stats: total companies, users, sessions, active users this month |
| SA-03 | Super Admin can manage users within any company |
| SA-04 | Company setup endpoint allows one-time provisioning |

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Page load < 2s on broadband; API responses < 500ms p95 |
| Scalability | Backend stateless (horizontally scalable); WebSocket server sticky sessions |
| Availability | 99.5% uptime target; graceful degradation if AI services are unavailable |
| Security | JWT auth on all protected endpoints; RLS on all Supabase tables; no PII in logs |
| Accessibility | WCAG 2.1 AA for key flows (login, practice, feedback) |
| Browser Support | Latest 2 versions of Chrome, Edge, Firefox, Safari |
| Mobile | Responsive layout; core flows usable on 375px+ viewport |
| Localisation | Multi-language persona/session support (language field on scenario) |
| Data Retention | Session recordings stored in S3; metadata retained indefinitely unless tenant deletes |
| Rate Limiting | 200 requests per 15 minutes per IP on backend API |

---

## 5. System Architecture

### High-Level Topology

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│  React SPA (Vite + TypeScript)                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  Pages   │ │ Zustand  │ │Socket.IO │ │ElevenLabs│   │
│  │(Lazy)    │ │ Stores   │ │ Client   │ │ React SDK│   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
└───────┼────────────┼────────────┼─────────────┼─────────┘
        │ REST        │            │ WS          │ WS/REST
        ▼             ▼            ▼             ▼
┌──────────────────────────────────────────────────────────┐
│               FastAPI Backend (Python)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │  Routers │ │ Services │ │ Socket   │ │  Auth    │    │
│  │  (10)    │ │  (AI,    │ │ Handlers │ │  (JWT)   │    │
│  │          │ │  Voice,  │ │          │ │          │    │
│  │          │ │  Scoring)│ │          │ │          │    │
│  └────┬─────┘ └────┬─────┘ └──────────┘ └──────────┘    │
└───────┼────────────┼──────────────────────────────────────┘
        │             │
        ▼             ▼
┌─────────────┐  ┌─────────────────────────────────────────┐
│  PostgreSQL  │  │           External Services             │
│  (Primary    │  │  ┌──────────┐ ┌──────────┐ ┌────────┐  │
│   datastore) │  │  │ElevenLabs│ │ Deepgram │ │  AWS   │  │
└─────────────┘  │  │  (TTS)   │ │  (STT)   │ │   S3   │  │
                 │  └──────────┘ └──────────┘ └────────┘  │
                 │  ┌──────────┐                           │
                 │  │ Anthropic│  (Claude — AI Scoring,    │
                 │  │   API    │   Scenario Gen, Feedback) │
                 │  └──────────┘                           │
                 └─────────────────────────────────────────┘
```

### Data Flow — Live Roleplay Session

```
User speaks
    │
    ▼ getUserMedia (16kHz PCM)
AudioWorklet
    │
    ▼ socket.emit('stt:audio')
Backend Socket Handler
    │
    ▼ Deepgram STT WebSocket
Transcript text
    │
    ├─▶ socket.emit('stt:final') ─▶ Frontend displays transcript
    │
    ▼ Persona Engine (Claude API)
AI Response text
    │
    ├─▶ socket.emit('session:ai_message') ─▶ Frontend displays AI turn
    │
    ▼ ElevenLabs TTS
Audio stream
    │
    ▼ Played in browser via HTML Audio
```

---

## 6. Frontend Architecture

### Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | React | 18.3 |
| Language | TypeScript | 5.4 |
| Build tool | Vite | 5.2 |
| Styling | Tailwind CSS | 3.4 |
| Routing | React Router | 6.23 |
| Animation | Framer Motion | 11.1 |
| State | Zustand | 4.5 |
| HTTP | Axios | 1.6 |
| Real-time | Socket.IO Client | 4.7 |
| Charts | Recharts | 2.12 |
| UI primitives | Radix UI | 1.x / 2.x |
| Icons | Lucide React | 0.368 |
| Toasts | React Hot Toast | 2.4 |
| Voice | @elevenlabs/react | 1.6 |
| Date utils | date-fns | 3.6 |

### Directory Structure

```
src/
├── App.tsx                  # Router, lazy imports, guards
├── main.tsx                 # React DOM root, global styles
├── styles/
│   └── global.css           # CSS variables, base resets, Tailwind layers
├── types/
│   └── index.ts             # All shared TypeScript types & constants
├── lib/
│   ├── api.ts               # All HTTP API functions (grouped by domain)
│   ├── socket.ts            # Socket.IO singleton & event helpers
│   └── store.ts             # All Zustand stores
├── hooks/
│   ├── useRecording.ts      # MediaRecorder + S3 upload
│   └── useVoice.ts          # Microphone capture, STT relay, TTS playback
├── components/
│   ├── layout/
│   │   └── AppShell.tsx     # Sidebar, topbar, theme toggle
│   ├── practice/
│   │   ├── CallInterface.tsx
│   │   ├── KnowledgeBaseEditor.tsx
│   │   ├── PersonaAvatars.tsx
│   │   ├── PersonaBuilder.tsx
│   │   ├── PreCallBriefing.tsx
│   │   ├── VoicePicker.tsx
│   │   └── VoicePickerModal.tsx
│   ├── dashboard/
│   │   └── ScoreChart.tsx
│   ├── ErrorBoundary.tsx
│   └── PlanGate.tsx         # Feature flag wrapper
└── pages/
    ├── LoginPage.tsx
    ├── RegisterPage.tsx
    ├── DashboardPage.tsx
    ├── PracticePage.tsx      # Main roleplay wizard (~140KB)
    ├── SessionsPage.tsx
    ├── FeedbackPage.tsx
    ├── LeaderboardPage.tsx
    ├── TeamPage.tsx
    ├── SettingsPage.tsx
    ├── PlanSettingsPage.tsx
    ├── EvaluationPromptsPage.tsx
    ├── CompaniesPage.tsx
    ├── CompanyDetailPage.tsx
    └── SuperAdminStatsPage.tsx
```

### Module Alias

`@/` maps to `./src/` — configured in both `vite.config.ts` and `tsconfig.json`.

### Code Splitting

All pages are lazy-loaded via `React.lazy()` with a Suspense fallback. Vendor chunks are manually split in Rollup:

| Chunk | Modules |
|---|---|
| vendor-react | react, react-dom, react-router-dom |
| vendor-motion | framer-motion |
| vendor-radix | @radix-ui/* |
| vendor-charts | recharts |
| vendor-socket | socket.io-client |
| vendor-utils | axios, zustand, clsx, tailwind-merge, date-fns |

### Design System

- **Typography**: `DM Sans` (body), `Syne` (display/headings), `JetBrains Mono` (code)
- **Font weights**: Regular (400), Medium (500), Bold (700) — max 3 weights
- **Spacing**: 8px base unit throughout
- **Colours**: CSS custom properties (dark/light mode). Key vars: `--bg`, `--bg2`, `--bg3`, `--bg4`, `--accent`, `--border`
- **Dark mode**: Class-based (`dark` on `<html>`); toggled by ThemeStore

---

## 7. Backend Architecture

### Technology Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI (Python) |
| ORM | SQLAlchemy (async) |
| Database | PostgreSQL |
| Migrations | Alembic |
| Real-time | python-socketio (ASGI mount) |
| Auth | JWT (PyJWT) + bcrypt |
| Rate limiting | slowapi (200 req / 15 min / IP) |
| AI | Anthropic Claude API |
| TTS | ElevenLabs HTTP API |
| STT | Deepgram WebSocket |
| Storage | AWS S3 (boto3) |

### Application Entry (`main.py`)

```
FastAPI app
├── CORS middleware
├── Rate limit middleware (slowapi)
├── Exception handlers (validation + global 500)
├── Routers mounted at /api/v1/
│   ├── /auth
│   ├── /users
│   ├── /sessions
│   ├── /personas
│   ├── /analytics
│   ├── /voice
│   ├── /recordings
│   ├── /superadmin
│   ├── /practice
│   └── /team-roleplays
├── Socket.IO app (ASGIApp wrapper)
└── Health check GET /health
```

### Router Summary

| Router | Key Endpoints |
|---|---|
| auth | POST /login, /register, /refresh, /logout |
| users | GET /users, POST /invite, PATCH /:id, POST /:id/reset-password |
| sessions | GET /, POST /, GET /:id, POST /:id/start, POST /:id/end, POST /:id/messages, POST /:id/ai-response |
| personas | GET /, POST /, DELETE /:id |
| analytics | GET /dashboard, GET /leaderboard |
| voice | GET /tts (ElevenLabs proxy) |
| recordings | POST /upload/:sessionId, GET /playback/:sessionId |
| superadmin | GET /stats, GET /companies, POST /companies, GET /companies/:id |
| practice | POST /generate-scenario, POST /generate-questions |
| team-roleplays | GET /, POST /, PATCH /:id, DELETE /:id, GET /target-options |

### Service Layer

| Service | Responsibility |
|---|---|
| `ai/persona_engine.py` | Builds AI system prompt from persona + knowledge base; calls Claude |
| `ai/scenario_generator.py` | Generates scenario config from roleplay type + context (Claude) |
| `scoring/session_analyzer.py` | Scores session transcript against selected framework rubric (Claude) |
| `voice/voice_service.py` | Proxies ElevenLabs TTS requests |
| `recording/recording_service.py` | S3 multipart upload/download, presigned URL generation |
| `avatar/photo_service.py` | Generates/caches AI persona avatar photos |

---

## 8. Database Schema

### Entity Relationship Diagram (simplified)

```
Company ──< User >── Session ──< Message
   │           │         │
   │           │         ├──< FrameworkScore
   │           │         └──< TimelineEvent
   │           │
   └──< Persona ──────────────────────────< Session
   │
   └──< TeamRoleplay
   │
   └──< Subscription
   │
   └──< EvaluationPrompt (nullable companyId = global)

User >── RefreshToken
User ──< User (managerId self-ref)
```

### Table Definitions

#### `companies`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| name | TEXT | |
| slug | TEXT UNIQUE | URL-safe identifier |
| default_framework | ENUM | MEDDIC default |
| pass_threshold | INT | Score % to pass |
| max_agents | INT | Plan limit |
| is_active | BOOL | Soft disable |
| logo_url | TEXT | |
| industry | TEXT | |
| contact_email | TEXT | |
| contact_phone | TEXT | |
| registration_info | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | TEXT UNIQUE | |
| password_hash | TEXT | bcrypt |
| first_name | TEXT | |
| last_name | TEXT | |
| role | ENUM | SUPER_ADMIN, COMPANY_ADMIN, MANAGER, AGENT |
| is_active | BOOL | DEFAULT true |
| company_id | UUID FK → companies | nullable for SUPER_ADMIN |
| manager_id | UUID FK → users | self-referencing |
| avatar_url | TEXT | |
| last_login_at | TIMESTAMPTZ | |
| location | TEXT | city / office |
| region | TEXT | geo region |
| team | TEXT | team name |
| territory | TEXT | sales territory |
| zone | TEXT | sales zone |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| token | TEXT UNIQUE | |
| user_id | UUID FK → users CASCADE | |
| expires_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

#### `personas`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| title | TEXT | |
| company | TEXT | |
| industry | TEXT | |
| emoji | TEXT | single emoji char |
| difficulty | ENUM | EASY, MEDIUM, HARD, EXPERT |
| personality | TEXT | prose description |
| system_prompt | TEXT | AI instruction |
| objections | TEXT[] | array |
| buying_signals | TEXT[] | array |
| frameworks | TEXT[] | compatible frameworks |
| is_preset | BOOL | true = global |
| is_active | BOOL | |
| avatar_url | TEXT | |
| voice_id | TEXT | ElevenLabs voice ID |
| company_id | UUID FK → companies | null = global preset |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `sessions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| type | ENUM | PHONE_CALL, ONLINE_MEETING |
| status | ENUM | PENDING, IN_PROGRESS, COMPLETED, FAILED |
| framework | ENUM | |
| total_score | FLOAT | 0–100 |
| duration_seconds | INT | |
| recording_url | TEXT | S3 key |
| transcript | TEXT | full plain-text (denorm) |
| ai_feedback | JSONB | { strengths, improvements, tips } |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |
| user_id | UUID FK → users | |
| persona_id | UUID FK → personas | |
| company_id | UUID FK → companies | |
| scenario_context | JSONB | ScenarioConfig snapshot |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `messages`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → sessions CASCADE | |
| role | TEXT | 'user' or 'assistant' |
| content | TEXT | |
| audio_url | TEXT | per-turn audio (optional) |
| timestamp_ms | INT | ms from session start |
| created_at | TIMESTAMPTZ | |

#### `framework_scores`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → sessions CASCADE | |
| component | TEXT | e.g. 'Metrics', 'Economic Buyer' |
| score | FLOAT | 0–100 |
| feedback | TEXT | |
| evidence | TEXT[] | quote excerpts |
| created_at | TIMESTAMPTZ | |

#### `timeline_events`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → sessions CASCADE | |
| type | ENUM | ISSUE, GOOD, WARNING, NEUTRAL |
| timestamp_ms | INT | |
| title | TEXT | |
| description | TEXT | |
| suggestion | TEXT | |
| transcript_ref | TEXT | matching transcript snippet |
| better_response | TEXT | AI-suggested alternative |
| created_at | TIMESTAMPTZ | |

#### `team_roleplays`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| company_id | UUID FK → companies | |
| created_by_id | UUID FK → users | |
| name | TEXT | |
| description | TEXT | |
| scenario_config | JSONB | full ScenarioConfig |
| is_active | BOOL | |
| assignment_target | JSONB | { scope, teamIds?, regions?, userIds? } |
| allow_peer_listening | BOOL | |
| completion_count | INT | denorm counter |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `subscriptions`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| company_id | UUID FK → companies UNIQUE | |
| plan | TEXT | starter, growth, pro, enterprise |
| status | TEXT | active, cancelled, trialing |
| sessions_limit | INT | null = unlimited |
| sessions_used | INT | reset monthly |
| billing_email | TEXT | |
| stripe_id | TEXT | Stripe customer ID |
| expires_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `evaluation_prompts`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| company_id | UUID FK → companies | NULL = global default |
| roleplay_type | TEXT | |
| display_name | TEXT | |
| scoring_criteria | JSONB | array of criterion groups |
| prompt_template | TEXT | must contain `{transcript}` |
| is_active | BOOL | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Index**: `(company_id, roleplay_type)`

---

## 9. API Contracts

All endpoints are prefixed `/api/v1/` (except `/health`). All protected routes require `Authorization: Bearer <accessToken>`.

### 9.1 Auth

```
POST /auth/login
  Body: { email, password }
  Response: { user: User, accessToken, refreshToken }

POST /auth/register
  Body: { email, firstName, lastName, password, companyId? }
  Response: { user: User, accessToken, refreshToken }

POST /auth/refresh
  Body: { refreshToken }
  Response: { accessToken, refreshToken }

POST /auth/logout
  Body: { refreshToken? }
  Response: 204
```

### 9.2 Users

```
GET  /users                      → User[]
POST /users/invite               Body: { email, firstName, lastName, role, managerId? } → { user, tempPassword }
PATCH /users/:id                 Body: Partial<User> → User
GET  /users/:id/stats            → { sessionCount, avgScore }
POST /users/:id/reset-password   → { tempPassword }
```

### 9.3 Sessions

```
GET  /sessions          params: { userId?, framework?, type?, minScore?, maxScore?, from?, to?, search? }
                        → { sessions: Session[], total }
GET  /sessions/all      (admin/manager) same params → { sessions, total }
POST /sessions          Body: ScenarioConfig → Session
GET  /sessions/:id      → Session (with messages, frameworkScores, timelineEvents)
POST /sessions/:id/start              → { status }
POST /sessions/:id/end  Body: { durationSeconds } → Session (scored)
POST /sessions/:id/messages  Body: { role, content, timestampMs } → Message
POST /sessions/:id/ai-response Body: { userMessage } → { response }
```

### 9.4 Personas

```
GET  /personas           → Persona[]
POST /personas           Body: PersonaCreateInput → Persona
DELETE /personas/:id     → 204
```

### 9.5 Analytics

```
GET /analytics/dashboard          → DashboardStats
GET /analytics/leaderboard        params: { period?: 'all' | 'monthly' } → LeaderboardEntry[]
```

### 9.6 Team Roleplays

```
GET    /team-roleplays              → TeamRoleplay[]
POST   /team-roleplays              Body: TeamRoleplayCreateInput → TeamRoleplay
PATCH  /team-roleplays/:id          Body: Partial<TeamRoleplay> → TeamRoleplay
DELETE /team-roleplays/:id          → 204
GET    /team-roleplays/target-options → { regions[], teams[], territories[], zones[], users[] }
```

### 9.7 Evaluation Prompts

```
GET   /evaluation-prompts             → EvaluationPrompt[]
GET   /evaluation-prompts/:type       → EvaluationPrompt | null
PATCH /evaluation-prompts/:id         Body: Partial<EvaluationPrompt> → EvaluationPrompt
```

### 9.8 Super Admin

```
GET  /superadmin/stats              → PlatformStats
GET  /superadmin/companies          → CompanyDetail[]
POST /superadmin/companies          Body: CompanyCreateInput → Company
GET  /superadmin/companies/:id      → CompanyDetail
PATCH /superadmin/companies/:id     Body: Partial<Company> → Company
GET  /superadmin/companies/:id/users → User[]
PATCH /superadmin/companies/:id/users/:userId Body: Partial<User> → User
```

### 9.9 Practice (AI Generation)

```
POST /practice/generate-scenario    Body: { roleplayType, difficulty, industry, language } → ScenarioConfig
POST /practice/generate-questions   Body: { framework, scenario } → { questions[] }
```

### 9.10 Voice & Recordings

```
GET  /voice/tts   params: { voiceId, text } → audio/mpeg stream
POST /recordings/upload/:sessionId  Body: FormData(file) → { key }
GET  /recordings/playback/:sessionId → { url } (presigned S3)
```

---

## 10. Real-Time Communication

### Transport

**Socket.IO** over WebSocket (backend ASGI mount; frontend uses `socket.io-client`).

### Connection Lifecycle

```
1. User starts practice session
2. Frontend: connectSocket()
   - Auth callback reads latest accessToken from Zustand
3. Backend validates JWT on connection
4. Session-scoped room: socket joins room `session:{id}`
5. Call ends → Frontend: disconnectSocket()
```

### Events

| Direction | Event | Payload | Description |
|---|---|---|---|
| Client → Server | `stt:audio` | `{ sessionId, buffer: ArrayBuffer }` | PCM audio chunk for STT |
| Client → Server | `session:user_message` | `{ sessionId, text, timestampMs }` | Confirmed user turn |
| Server → Client | `stt:interim` | `{ transcript }` | Partial STT result |
| Server → Client | `stt:final` | `{ transcript }` | Confirmed STT result |
| Server → Client | `session:ai_message` | `{ text, timestampMs }` | AI persona response |

### ElevenLabs Integration

The `CallInterface` component uses `@elevenlabs/react`'s `useConversation` hook for direct browser-to-ElevenLabs WebSocket streaming. This path bypasses the backend Socket.IO channel for lowest latency.

---

## 11. State Management

All stores are Zustand with `persist` middleware (localStorage).

### Store Inventory

| Store | Key | Persisted | Contents |
|---|---|:---:|---|
| `useAuthStore` | `pitchiq-auth` | yes | user, accessToken, refreshToken |
| `useThemeStore` | `pitchiq-theme` | yes | theme: 'dark' \| 'light' |
| `usePlanStore` | `pitchiq-plan` | yes | plan tier, moduleOverrides |
| `useElevenLabsStore` | `pitchiq-elevenlabs` | yes | agentId, apiKey |
| `useSessionStore` | — | no | activeSessionId, isCallActive, callDurationMs |

### Plan Store Detail

```typescript
usePlanStore.can(feature: keyof PlanFeatures): boolean
  // Checks moduleOverrides first, then PLAN_CONFIGS[plan].features[feature]

usePlanStore.getFeatures(): PlanFeatures
  // Merges base plan features with any admin overrides
```

---

## 12. Authentication & Security

### JWT Flow

```
Login → { accessToken (15min), refreshToken (7d) }
        │
        ▼ Stored in Zustand (memory + localStorage)
        │
Every request → Authorization: Bearer <accessToken>
        │
Token expiry → POST /auth/refresh with refreshToken
        │
Logout → DELETE refresh token from DB + clearAuth()
```

### Route Guards

| Guard | Behaviour |
|---|---|
| `RequireAuth` | Redirects to `/login` if `isAuthenticated === false` |
| `RequireGuest` | Redirects to `/` if already authenticated |
| `RequireRole({ roles })` | Redirects to `/dashboard` if `user.role` not in allowed list |

### Supabase RLS (evaluation_prompts table)

- Authenticated users can `SELECT` active prompts (own company or global)
- Company admins can `INSERT`, `UPDATE`, `DELETE` for their own `company_id`
- No policy uses `USING (true)` — all policies check `auth.uid()`

### Password Security

- Stored as bcrypt hash (never plain text)
- Temp passwords generated on invite/reset; user prompted to change on first login

---

## 13. Plan & Feature Gating

### Tiers

| Tier | Sessions/mo | Agents | Key Features |
|---|---|---|---|
| Starter | 50 | 5 | Basic practice, leaderboard |
| Growth | 200 | 20 | + Knowledge base, recordings |
| Pro | unlimited | 50 | + Custom personas, pre-call briefing, evaluation prompts |
| Enterprise | unlimited | unlimited | + API access, multi-language, all features |

### Feature Flags

```typescript
interface PlanFeatures {
  sessionsPerMonth: number | null;   // null = unlimited
  agentsMax: number | null;
  sessionMinutesMax: number | null;
  knowledgeBase: boolean;
  preCallBriefing: boolean;
  customPersonas: boolean;
  teamRoleplays: boolean;
  analytics: boolean;
  leaderboard: boolean;
  recordings: boolean;
  aiCoaching: boolean;
  evaluationPrompts: boolean;
  multiLanguage: boolean;
  apiAccess: boolean;
}
```

### PlanGate Component

```tsx
<PlanGate feature="knowledgeBase" overlay={false} upgradeLabel="Bot Knowledge Base — Pro feature">
  <KnowledgeBaseEditor ... />
</PlanGate>
```

- When `can(feature) === false`: renders upgrade prompt instead of children
- Admin can override individual features via `usePlanStore.setModuleOverride()`

---

## 14. Third-Party Integrations

### ElevenLabs (Voice)

| Usage | Integration |
|---|---|
| Live call TTS | `@elevenlabs/react` `useConversation` hook (direct WS) |
| Voice picker preview | Backend proxy `/api/voice/tts` |
| Voice assignment | voiceId stored on Persona model |
| Config | `VITE_ELEVENLABS_AGENT_ID`, `VITE_ELEVENLABS_API_KEY` env vars |

### Deepgram (STT)

| Usage | Integration |
|---|---|
| Live transcription | Backend WebSocket to Deepgram; chunks forwarded from client via Socket.IO `stt:audio` |
| Config | `DEEPGRAM_API_KEY` backend env var |

### Anthropic Claude (AI)

| Usage | Service file |
|---|---|
| Persona AI responses | `app/services/ai/persona_engine.py` |
| Scenario generation | `app/services/ai/scenario_generator.py` |
| Session scoring + feedback | `app/services/scoring/session_analyzer.py` |
| Config | `ANTHROPIC_API_KEY` backend env var |

### AWS S3 (Storage)

| Usage | Integration |
|---|---|
| Session recording upload | `POST /recordings/upload/:sessionId` (multipart FormData) |
| Playback | Presigned URL via `GET /recordings/playback/:sessionId` |
| Config | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` backend env vars |

### Supabase (Database)

| Usage | Details |
|---|---|
| Primary datastore | PostgreSQL managed by Supabase |
| Migrations | `supabase/migrations/` applied via Supabase CLI / MCP tool |
| RLS | Enabled on all tables; policies enforce auth.uid() ownership |
| Client (frontend) | `@supabase/supabase-js` singleton via `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

---

## 15. Routing & Navigation

### Route Table

| Path | Component | Guard | Roles |
|---|---|---|---|
| `/login` | LoginPage | RequireGuest | — |
| `/register` | RegisterPage | RequireGuest | — |
| `/` | — | RequireAuth | Redirect logic |
| `/dashboard` | DashboardPage | RequireAuth | All |
| `/practice` | PracticePage | RequireAuth | All |
| `/sessions` | SessionsPage | RequireAuth | All |
| `/sessions/:id/feedback` | FeedbackPage | RequireAuth | All |
| `/leaderboard` | LeaderboardPage | RequireAuth | All |
| `/team` | TeamPage | RequireAuth + RequireRole | MANAGER, COMPANY_ADMIN, SUPER_ADMIN |
| `/settings` | SettingsPage | RequireAuth + RequireRole | COMPANY_ADMIN, SUPER_ADMIN |
| `/settings/plan` | PlanSettingsPage | RequireAuth + RequireRole | COMPANY_ADMIN, SUPER_ADMIN |
| `/settings/evaluation-prompts` | EvaluationPromptsPage | RequireAuth + RequireRole | COMPANY_ADMIN, SUPER_ADMIN |
| `/superadmin/companies` | CompaniesPage | RequireAuth + RequireRole | SUPER_ADMIN |
| `/superadmin/companies/:id` | CompanyDetailPage | RequireAuth + RequireRole | SUPER_ADMIN |
| `/superadmin/stats` | SuperAdminStatsPage | RequireAuth + RequireRole | SUPER_ADMIN |

### Sidebar Navigation (by role)

```
OVERVIEW
  Dashboard

PRACTICE
  Practice  [New badge]
  Sessions

COACHING
  Leaderboard

ADMIN (MANAGER+)
  Team

ADMIN (COMPANY_ADMIN+)
  Settings
  └── Plan
  └── Evaluation Prompts

SUPER ADMIN
  Companies
  Platform Stats
```

---

## 16. Build & Deployment

### Environment Variables (Frontend)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_ELEVENLABS_AGENT_ID` | ElevenLabs conversational agent ID |
| `VITE_ELEVENLABS_API_KEY` | ElevenLabs API key |

### Environment Variables (Backend)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret |
| `ANTHROPIC_API_KEY` | Claude API key |
| `DEEPGRAM_API_KEY` | Deepgram STT key |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS key |
| `AWS_ACCESS_KEY_ID` | S3 credentials |
| `AWS_SECRET_ACCESS_KEY` | S3 credentials |
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_REGION` | S3 region |
| `FRONTEND_URL` | Allowed CORS origin |

### Build Commands

```bash
# Frontend
npm run build      # tsc + vite build → dist/

# Backend
uvicorn main:app --host 0.0.0.0 --port 4000

# Docker (both services)
docker-compose up --build
```

### Vite Dev Proxy

```
/api          → http://localhost:4000
/socket.io    → ws://localhost:4000  (WebSocket)
```

### Frontend Build Output

```
dist/
├── index.html
├── _redirects        # SPA fallback for static hosts
└── assets/
    ├── index-*.css
    ├── index-*.js
    ├── vendor-react-*.js
    ├── vendor-motion-*.js
    ├── vendor-charts-*.js
    └── [page-chunk]-*.js   (lazy-loaded)
```

### Docker Compose

Two services: `frontend` (Nginx serving static build) and `backend` (FastAPI uvicorn). Frontend Nginx config (`pitchiq-apache.conf`) proxies `/api` and `/socket.io` to the backend container.

---

## 17. Known Constraints & Assumptions

| # | Constraint / Assumption |
|---|---|
| 1 | ElevenLabs Conversational AI requires a provisioned Agent ID; the platform does not create agents programmatically |
| 2 | Session recordings are bounded by browser MediaRecorder codec support (VP9+Opus or Opus-only) |
| 3 | STT via Deepgram is routed through the backend — audio data passes through the server |
| 4 | Plan limits (sessions/month, agent count) are enforced on the backend; frontend gating is UI-only |
| 5 | `SUPER_ADMIN` users are manually provisioned; no self-service super admin registration |
| 6 | Team Roleplay assignment targeting is stored as JSONB; complex queries (e.g. "all users in region X") are resolved at read time from the users table |
| 7 | Peer session listening requires `allowPeerListening = true` on the TeamRoleplay and a valid recording key |
| 8 | The backend and frontend must share the same Supabase project (env vars must match) |
| 9 | ElevenLabs voice IDs are stored as plain strings; voice library is fetched live from ElevenLabs API |
| 10 | Framework scoring uses Claude; latency on session end depends on transcript length and Claude API response time |

---

*Document generated from codebase analysis — 2026-05-17*
