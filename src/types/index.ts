// pitchiq/frontend/src/types/index.ts

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'AGENT';

// ── Plan / Feature system ──────────────────────────────────────────────────────
export type PlanTier = 'starter' | 'growth' | 'pro' | 'enterprise';

export interface PlanFeatures {
  // core limits
  sessionsPerMonth: number | null;   // null = unlimited
  agentsMax: number | null;
  sessionMinutesMax: number | null;  // per session cap, null = unlimited
  // modules
  knowledgeBase: boolean;            // train bot on docs/URLs
  preCallBriefing: boolean;          // user reads content before call
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

export const PLAN_CONFIGS: Record<PlanTier, { label: string; price: string; color: string; features: PlanFeatures }> = {
  starter: {
    label: 'Starter', price: '$49/mo', color: '#6B7280',
    features: {
      sessionsPerMonth: 20, agentsMax: 3, sessionMinutesMax: 5,
      knowledgeBase: false, preCallBriefing: false,
      customPersonas: false, teamRoleplays: false,
      analytics: false, leaderboard: true, recordings: false,
      aiCoaching: false, evaluationPrompts: false,
      multiLanguage: false, apiAccess: false,
    },
  },
  growth: {
    label: 'Growth', price: '$149/mo', color: '#06D6A0',
    features: {
      sessionsPerMonth: 100, agentsMax: 15, sessionMinutesMax: 10,
      knowledgeBase: false, preCallBriefing: false,
      customPersonas: true, teamRoleplays: true,
      analytics: true, leaderboard: true, recordings: true,
      aiCoaching: true, evaluationPrompts: false,
      multiLanguage: false, apiAccess: false,
    },
  },
  pro: {
    label: 'Pro', price: '$349/mo', color: '#5B6FFF',
    features: {
      sessionsPerMonth: 500, agentsMax: 50, sessionMinutesMax: 20,
      knowledgeBase: true, preCallBriefing: true,
      customPersonas: true, teamRoleplays: true,
      analytics: true, leaderboard: true, recordings: true,
      aiCoaching: true, evaluationPrompts: true,
      multiLanguage: true, apiAccess: false,
    },
  },
  enterprise: {
    label: 'Enterprise', price: 'Custom', color: '#FFD166',
    features: {
      sessionsPerMonth: null, agentsMax: null, sessionMinutesMax: null,
      knowledgeBase: true, preCallBriefing: true,
      customPersonas: true, teamRoleplays: true,
      analytics: true, leaderboard: true, recordings: true,
      aiCoaching: true, evaluationPrompts: true,
      multiLanguage: true, apiAccess: true,
    },
  },
};

// ── Knowledge base attachment ──────────────────────────────────────────────────
export type KnowledgeBaseEntryType = 'text' | 'url' | 'file';

export interface KnowledgeBaseEntry {
  id: string;
  type: KnowledgeBaseEntryType;
  label: string;     // display name
  content: string;   // raw text / url / filename
  forRole: 'bot' | 'user' | 'both';
  createdAt: string;
}
export type SessionType = 'PHONE_CALL' | 'ONLINE_MEETING';
export type SessionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type Framework = 'MEDDIC' | 'MEDDICC' | 'SPIN' | 'BANT' | 'CHALLENGER' | 'SNAP';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
export type TimelineEventType = 'ISSUE' | 'GOOD' | 'WARNING' | 'NEUTRAL';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  companyId: string;
  managerId?: string;
  isActive?: boolean;
  lastLoginAt?: string;
  company?: Company;
  avgScore?: number;
  sessionCount?: number;
  location?: string;
  region?: string;       // geographic region e.g. 'EMEA', 'APAC', 'North America'
  team?: string;         // team name e.g. 'Enterprise', 'SMB', 'SDR Team'
  territory?: string;    // sales territory
  zone?: string;         // zone/district
  _count?: { sessions: number };
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  defaultFramework: Framework;
  passThreshold: number;
  isActive?: boolean;
  industry?: string;
  contactEmail?: string;
  contactPhone?: string;
  registrationInfo?: string;
  maxAgents?: number;
}

export interface CompanyAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface CompanyDetail extends Company {
  createdAt: string;
  agentCount: number;
  adminCount: number;
  totalSessions: number;
  admins: CompanyAdmin[];
}

export interface PlatformStats {
  totalCompanies: number;
  activeCompanies: number;
  totalUsers: number;
  totalSessions: number;
  activeUsersThisMonth: number;
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  company?: string;
  industry?: string;
  emoji: string;
  difficulty: Difficulty;
  personality: string;
  systemPrompt: string;
  objections: string[];
  buyingSignals: string[];
  frameworks: Framework[];
  isPreset: boolean;
  voiceId?: string;
  agentId?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestampMs: number;
  audioUrl?: string;
}

export interface FrameworkScore {
  id: string;
  component: string;
  score: number;
  feedback: string;
  evidence: string[];
}

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestampMs: number;
  title: string;
  description: string;
  suggestion?: string;
  transcriptRef?: string;
  betterResponse?: string;
}

export interface ScenarioConfig {
  industry: string;
  roleplayType: string;
  personaContext: string;
  displayName: string;
  displayTitle: string;
  displayEmoji: string;
  difficulty: string;
  suggestedQuestions: string[];
  objections?: string[];
  aiCanEnd?: boolean;
  endCondition?: string;
  timeLimitMins?: number | null;
  avatarId?: string;
  elevenlabsVoiceId?: string;
  language?: string;
  // Knowledge base
  botKnowledge?: KnowledgeBaseEntry[];    // context fed to the AI bot
  userBriefing?: KnowledgeBaseEntry[];    // content shown to user before call
}

export interface Session {
  id: string;
  type: SessionType;
  status: SessionStatus;
  framework: Framework;
  totalScore?: number;
  durationSeconds?: number;
  recordingUrl?: string;
  aiFeedback?: string; // JSON string
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  persona?: Pick<Persona, 'id' | 'name' | 'title' | 'emoji' | 'difficulty'>;
  scenarioConfig?: ScenarioConfig;
  frameworkScores?: FrameworkScore[];
  timelineEvents?: TimelineEvent[];
  messages?: Message[];
}

// ── Assignment targeting ───────────────────────────────────────────────────────
export type AssignmentScope = 'all' | 'team' | 'region' | 'individual';

export interface AssignmentTarget {
  scope: AssignmentScope;
  teamIds?: string[];       // if scope = 'team'
  regions?: string[];       // if scope = 'region'
  userIds?: string[];       // if scope = 'individual'
}

// ── Peer session listening ─────────────────────────────────────────────────────
export interface PeerSession {
  sessionId: string;
  userId: string;
  userName: string;
  userLocation?: string;
  userTeam?: string;
  score: number;
  rank: number;
  durationSeconds: number;
  completedAt: string;
  canListen: boolean;   // manager allowed listening
  playbackUrl?: string;
}

export interface TeamRoleplay {
  id: string;
  name: string;
  description?: string;
  scenarioConfig: ScenarioConfig;
  isActive: boolean;
  createdById: string;
  createdBy: Pick<User, 'id' | 'firstName' | 'lastName'>;
  createdAt: string;
  updatedAt: string;
  // Assignment targeting
  assignmentTarget?: AssignmentTarget;
  allowPeerListening?: boolean;  // whether peers can hear each other's sessions
  completionCount?: number;      // how many people have completed it
}

export interface DashboardRecentSession {
  id: string;
  endedAt?: string;
  durationSeconds?: number;
  framework: string;
  sessionType: string;
  personaName: string;
  personaEmoji: string;
  userFirstName: string;
  userLastName: string;
  totalScore?: number;
}

export interface DashboardFrameworkStat {
  component: string;
  avgScore?: number;
  count: number;
}

export interface AgentDashboardExtra {
  sessionsThisWeek: number;
  streak: number;
  rank?: number;
}

export interface TeamMemberSummary {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  sessionCount: number;
  avgScore?: number;
  sessionsThisWeek: number;
  lastSessionAt?: string;
}

export interface ManagerDashboardExtra {
  teamSize: number;
  members: TeamMemberSummary[];
}

export interface DashboardStats {
  totalSessions: number;
  avgScore?: number;
  activeUsers: number;
  passRate: number;
  recentSessions: DashboardRecentSession[];
  frameworkStats: DashboardFrameworkStat[];
  agentExtra?: AgentDashboardExtra;
  managerExtra?: ManagerDashboardExtra;
}

export interface LeaderboardEntry {
  rank: number;
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'avatarUrl'>;
  avgScore: number;
  sessionCount: number;
}

// Parsed AI feedback JSON
export interface ParsedFeedback {
  overallFeedback: string;
  strengths: string[];
  improvements: string[];
  proTip: string;
  scorecardGroups?: ScorecardGroup[];
}

// Rubric-based scoring (per roleplay type)
export interface ScorecardCriterion {
  question: string;
  hint?: string;
  passed: boolean;
  reasoning: string; // AI's one-line evidence
}

export interface ScorecardGroup {
  group: string;
  maxPoints: number;
  earnedPoints: number;
  criteria: ScorecardCriterion[];
}

// Evaluation prompt definition (stored in DB / admin settings)
export interface EvaluationCriterionDef {
  question: string;
  hint?: string;
}

export interface EvaluationGroupDef {
  group: string;
  criteria: EvaluationCriterionDef[];
}

export interface EvaluationPrompt {
  id: string;
  companyId?: string;
  roleplayType: string;
  displayName: string;
  scoringCriteria: EvaluationGroupDef[];
  promptTemplate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const FRAMEWORK_INFO: Record<Framework, { label: string; components: string[]; color: string }> = {
  MEDDIC: {
    label: 'MEDDIC',
    components: ['Metrics', 'Economic Buyer', 'Decision Criteria', 'Decision Process', 'Identify Pain', 'Champion'],
    color: '#5B6FFF',
  },
  MEDDICC: {
    label: 'MEDDICC',
    components: ['Metrics', 'Economic Buyer', 'Decision Criteria', 'Decision Process', 'Identify Pain', 'Champion', 'Competition'],
    color: '#7C3AED',
  },
  SPIN: {
    label: 'SPIN',
    components: ['Situation Questions', 'Problem Questions', 'Implication Questions', 'Need-Payoff Questions'],
    color: '#06D6A0',
  },
  BANT: {
    label: 'BANT',
    components: ['Budget', 'Authority', 'Need', 'Timeline'],
    color: '#FFD166',
  },
  CHALLENGER: {
    label: 'Challenger',
    components: ['Teach', 'Tailor', 'Take Control'],
    color: '#FF6B6B',
  },
  SNAP: {
    label: 'SNAP',
    components: ['Simple', 'iNvaluable', 'Aligned', 'Priority'],
    color: '#06D6A0',
  },
};

export const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; className: string }> = {
  EASY: { label: 'Easy', className: 'tag-green' },
  MEDIUM: { label: 'Medium', className: 'tag-amber' },
  HARD: { label: 'Hard', className: 'tag-red' },
  EXPERT: { label: 'Expert', className: 'tag-red' },
};
