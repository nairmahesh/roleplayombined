// pitchiq/frontend/src/types/index.ts

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'AGENT';
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
