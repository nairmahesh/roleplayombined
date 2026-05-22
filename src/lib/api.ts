import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from './store';
import type {
  DashboardStats,
  DashboardRecentSession,
  DashboardFrameworkStat,
  LeaderboardEntry,
  Session,
  Persona,
  User,
  TeamRoleplay,
  CompanyDetail,
  EvaluationPrompt,
  PeerSession,
} from '@/types';

// ── Axios instance ────────────────────────────────────────────────────────────

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Demo users (no backend required) ─────────────────────────────────────────

const DEMO_COMPANY = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Demo Company',
  slug: 'demo',
  defaultFramework: 'MEDDIC' as const,
  passThreshold: 70,
  industry: 'Technology',
};

const DEMO_USERS: Record<string, User & { password: string }> = {
  'superadmin@demo.com': {
    id: '10000000-0000-0000-0000-000000000001',
    email: 'superadmin@demo.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'SUPER_ADMIN',
    companyId: DEMO_COMPANY.id,
    company: DEMO_COMPANY,
    isActive: true,
    password: 'Demo1234!',
  },
  'admin@demo.com': {
    id: '10000000-0000-0000-0000-000000000002',
    email: 'admin@demo.com',
    firstName: 'Company',
    lastName: 'Admin',
    role: 'COMPANY_ADMIN',
    companyId: DEMO_COMPANY.id,
    company: DEMO_COMPANY,
    isActive: true,
    password: 'Demo1234!',
  },
  'manager@demo.com': {
    id: '10000000-0000-0000-0000-000000000003',
    email: 'manager@demo.com',
    firstName: 'Demo',
    lastName: 'Manager',
    role: 'MANAGER',
    companyId: DEMO_COMPANY.id,
    company: DEMO_COMPANY,
    isActive: true,
    password: 'Demo1234!',
  },
  'agent@demo.com': {
    id: '10000000-0000-0000-0000-000000000004',
    email: 'agent@demo.com',
    firstName: 'Demo',
    lastName: 'Agent',
    role: 'AGENT',
    companyId: DEMO_COMPANY.id,
    company: DEMO_COMPANY,
    isActive: true,
    password: 'Demo1234!',
  },
};

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const demo = DEMO_USERS[email.toLowerCase()];
    if (demo && demo.password === password) {
      const { password: _pw, ...user } = demo;
      return { user, accessToken: 'demo-token', refreshToken: 'demo-refresh' };
    }
    const { data } = await http.post('/auth/login', { email, password });
    return data as { user: User; accessToken: string; refreshToken: string };
  },

  register: async (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    companySlug?: string;
  }) => {
    const { data } = await http.post('/auth/register', payload);
    return data as { user: User; accessToken: string; refreshToken: string };
  },

  logout: async () => {
    const refreshToken = useAuthStore.getState().refreshToken;
    await http.post('/auth/logout', { refreshToken }).catch(() => {});
  },

  me: async (): Promise<User> => {
    const { data } = await http.get('/auth/me');
    return data as User;
  },
};

// ── Sessions API ──────────────────────────────────────────────────────────────

export const sessionsApi = {
  list: async (params?: Record<string, unknown>) => {
    const { data } = await http.get('/sessions', { params });
    return data as { sessions: Session[]; total: number };
  },

  listAll: async (params?: Record<string, unknown>) => {
    const { data } = await http.get('/sessions', { params });
    return data as { sessions: Session[]; total: number };
  },

  getPeerScores: async (sessionId: string) => {
    const { data } = await http.get(`/sessions/${sessionId}/peer-scores`);
    return data as { userId: string; name: string; score: number; rank: number }[];
  },

  create: async (payload: { type: string; framework: string; personaId?: string; scenarioConfig?: unknown }) => {
    const { data } = await http.post('/sessions', payload);
    return data as Session;
  },

  get: async (id: string) => {
    const { data } = await http.get(`/sessions/${id}`);
    return data as Session;
  },

  start: async (id: string) => {
    const { data } = await http.patch(`/sessions/${id}/start`);
    return data as { status: string };
  },

  end: async (id: string, payload?: unknown) => {
    const { data } = await http.patch(`/sessions/${id}/end`, payload ?? {});
    return data as Session;
  },

  addMessage: async (id: string, payload: unknown) => {
    const { data } = await http.post(`/sessions/${id}/messages`, payload);
    return data;
  },

  getAIResponse: async (id: string, userMessage: string) => {
    const { data } = await http.post(`/sessions/${id}/ai-response`, { userMessage });
    return data as { response: string };
  },

  share: async (id: string) => {
    const { data } = await http.post(`/sessions/${id}/share`);
    return data as { shareUrl: string };
  },
};

// ── Demo personas fallback ────────────────────────────────────────────────────

const DEMO_PERSONAS: Persona[] = [
  {
    id: 'demo-p1',
    name: 'Sarah Chen',
    title: 'VP of Engineering',
    company: 'TechCorp',
    industry: 'Technology',
    emoji: '👩‍💻',
    avatarId: 'sarah',
    difficulty: 'MEDIUM',
    personality: 'Analytical and data-driven. Skeptical of vendor claims. Needs ROI proof.',
    systemPrompt: 'You are Sarah Chen, VP of Engineering at TechCorp. You are analytical and skeptical. Push for technical depth and concrete metrics before agreeing to anything.',
    objections: ['We already have a solution', 'Prove the ROI first', 'Our team will need training time'],
    buyingSignals: ['Can you show me a technical demo?', 'What does the implementation timeline look like?'],
    frameworks: ['MEDDIC', 'SNAP'],
    isPreset: true,
  },
  {
    id: 'demo-p2',
    name: 'Marcus Webb',
    title: 'CFO',
    company: 'GrowthCo',
    industry: 'Finance',
    emoji: '💼',
    avatarId: 'marcus',
    difficulty: 'HARD',
    personality: 'Budget-focused. Wants cost justification upfront. Short on time.',
    systemPrompt: 'You are Marcus Webb, CFO at GrowthCo. You are busy and financially driven. You need clear cost-benefit analysis and fast answers.',
    objections: ['The budget is already allocated', 'I need sign-off from the board', 'What\'s the total cost of ownership?'],
    buyingSignals: ['What are the payment terms?', 'Can we pilot this first?'],
    frameworks: ['MEDDIC', 'BANT'],
    isPreset: true,
  },
  {
    id: 'demo-p3',
    name: 'Priya Nair',
    title: 'Head of Operations',
    company: 'ScaleUp Inc',
    industry: 'SaaS',
    emoji: '⚙️',
    avatarId: 'priya',
    difficulty: 'EASY',
    personality: 'Process-oriented and collaborative. Open to change if it reduces friction.',
    systemPrompt: 'You are Priya Nair, Head of Operations at ScaleUp Inc. You are open-minded and focused on making your team\'s workflows smoother.',
    objections: ['How long does onboarding take?', 'Will this integrate with our current stack?'],
    buyingSignals: ['This could save us a lot of manual work', 'Who else on my team should be in this conversation?'],
    frameworks: ['SNAP', 'MEDDIC'],
    isPreset: true,
  },
  {
    id: 'demo-p4',
    name: 'Jordan Lee',
    title: 'Director of Sales',
    company: 'Pipeline Pro',
    industry: 'Sales',
    emoji: '🎯',
    avatarId: 'jordan',
    difficulty: 'MEDIUM',
    personality: 'Competitive and results-driven. Wants to know how this helps his team close faster.',
    systemPrompt: 'You are Jordan Lee, Director of Sales at Pipeline Pro. You are competitive and only care about revenue impact. Challenge the salesperson to prove direct impact on quota attainment.',
    objections: ['My reps don\'t have time for more tools', 'We tried something like this before and it didn\'t stick'],
    buyingSignals: ['How fast do teams typically see results?', 'Can I see case studies from similar companies?'],
    frameworks: ['BANT', 'MEDDIC'],
    isPreset: true,
  },
  {
    id: 'demo-p5',
    name: 'Aisha Okonkwo',
    title: 'CTO',
    company: 'Nexus Labs',
    industry: 'Technology',
    emoji: '🧠',
    avatarId: 'aisha',
    difficulty: 'HARD',
    personality: 'Visionary but deeply technical. Will probe architecture and security hard.',
    systemPrompt: 'You are Aisha Okonkwo, CTO at Nexus Labs. You are technically brilliant and won\'t accept vague answers. Ask deep questions about security, scalability, and architecture.',
    objections: ['How does this handle data sovereignty?', 'What\'s your uptime SLA?', 'Show me your SOC 2 report'],
    buyingSignals: ['Interesting — how does the API work?', 'Can we do a security review?'],
    frameworks: ['MEDDIC', 'SNAP'],
    isPreset: true,
  },
  {
    id: 'demo-p6',
    name: 'Carlos Mendez',
    title: 'CEO',
    company: 'Meridian Group',
    industry: 'Consulting',
    emoji: '🏢',
    avatarId: 'carlos',
    difficulty: 'HARD',
    personality: 'Big-picture thinker. Wants strategic value, not features. Time is precious.',
    systemPrompt: 'You are Carlos Mendez, CEO of Meridian Group. You are strategic and pressed for time. Dismiss feature-level talk and demand to understand the business transformation this enables.',
    objections: ['I need my leadership team aligned first', 'We\'re focused on other priorities right now'],
    buyingSignals: ['Who are your other enterprise clients?', 'What does success look like at 12 months?'],
    frameworks: ['MEDDIC', 'SNAP'],
    isPreset: true,
  },
];

// ── Personas API ──────────────────────────────────────────────────────────────

export const personasApi = {
  list: async () => {
    try {
      const { data } = await http.get('/personas');
      const personas = data as Persona[];
      return personas.length ? personas : DEMO_PERSONAS;
    } catch {
      return DEMO_PERSONAS;
    }
  },

  create: async (payload: Partial<Persona>) => {
    const { data } = await http.post('/personas', payload);
    return data as Persona;
  },

  update: async (id: string, payload: Partial<Persona>) => {
    const { data } = await http.patch(`/personas/${id}`, payload);
    return data as Persona;
  },

  delete: async (id: string) => {
    await http.delete(`/personas/${id}`);
  },

  clone: async (persona: Persona) => {
    const { id: _id, ...rest } = persona;
    const { data } = await http.post('/personas', { ...rest, name: `${persona.name} (Copy)`, isPreset: false });
    return data as Persona;
  },

  getAnalytics: async (id: string) => {
    const { data } = await http.get(`/personas/${id}/analytics`);
    return data as { usageCount: number; avgScore: number; lastUsed: string | null; topUsers: { name: string; count: number }[] };
  },
};

// ── Demo dashboard data ───────────────────────────────────────────────────────

function demoDashboard(role: string | undefined): DashboardStats {
  const recentSessions: DashboardRecentSession[] = [
    { id: 's1', endedAt: new Date(Date.now() - 3_600_000).toISOString(), durationSeconds: 420, framework: 'MEDDIC', sessionType: 'PHONE_CALL', personaName: 'Sarah Chen', personaEmoji: '👩', userFirstName: 'Demo', userLastName: 'Agent', totalScore: 82 },
    { id: 's2', endedAt: new Date(Date.now() - 86_400_000).toISOString(), durationSeconds: 600, framework: 'MEDDIC', sessionType: 'ONLINE_MEETING', personaName: 'Marcus Webb', personaEmoji: '👨', userFirstName: 'Demo', userLastName: 'Agent', totalScore: 71 },
    { id: 's3', endedAt: new Date(Date.now() - 172_800_000).toISOString(), durationSeconds: 380, framework: 'SNAP', sessionType: 'PHONE_CALL', personaName: 'Priya Nair', personaEmoji: '👩', userFirstName: 'Demo', userLastName: 'Agent', totalScore: 58 },
  ];
  const frameworkStats: DashboardFrameworkStat[] = [
    { component: 'Metrics', avgScore: 79, count: 8 },
    { component: 'Economic Buyer', avgScore: 65, count: 8 },
    { component: 'Decision Criteria', avgScore: 88, count: 8 },
    { component: 'Decision Process', avgScore: 72, count: 8 },
    { component: 'Identify Pain', avgScore: 55, count: 8 },
    { component: 'Champion', avgScore: 84, count: 8 },
  ];

  if (role === 'AGENT') {
    return {
      totalSessions: 12,
      avgScore: 74,
      activeUsers: 1,
      passRate: 67,
      recentSessions,
      frameworkStats,
      agentExtra: { sessionsThisWeek: 3, streak: 2, rank: 4 },
    };
  }
  const members = [
    { id: 'm1', firstName: 'Alex', lastName: 'Rivera', sessionCount: 18, avgScore: 88, sessionsThisWeek: 5 },
    { id: 'm2', firstName: 'Jordan', lastName: 'Kim', sessionCount: 15, avgScore: 81, sessionsThisWeek: 4 },
    { id: 'm3', firstName: 'Morgan', lastName: 'Taylor', sessionCount: 11, avgScore: 74, sessionsThisWeek: 2 },
    { id: 'm4', firstName: 'Demo', lastName: 'Agent', sessionCount: 12, avgScore: 74, sessionsThisWeek: 3 },
    { id: 'm5', firstName: 'Casey', lastName: 'Walsh', sessionCount: 7, avgScore: 61, sessionsThisWeek: 0 },
    { id: 'm6', firstName: 'Riley', lastName: 'Scott', sessionCount: 4, avgScore: 58, sessionsThisWeek: 0 },
  ];
  return {
    totalSessions: 67,
    avgScore: 74,
    activeUsers: members.length,
    passRate: 71,
    recentSessions: [
      ...recentSessions,
      { id: 's4', endedAt: new Date(Date.now() - 7_200_000).toISOString(), durationSeconds: 510, framework: 'MEDDIC', sessionType: 'ONLINE_MEETING', personaName: 'Wei Zhang', personaEmoji: '👨', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 88 },
    ],
    frameworkStats,
    managerExtra: { teamSize: members.length, members },
  };
}

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: async (): Promise<DashboardStats> => {
    try {
      const { data } = await http.get('/analytics/dashboard');
      return data as DashboardStats;
    } catch {
      const user = useAuthStore.getState().user;
      return demoDashboard(user?.role);
    }
  },

  leaderboard: async (period?: string): Promise<LeaderboardEntry[]> => {
    try {
      const { data } = await http.get('/analytics/leaderboard', { params: period ? { period } : undefined });
      return data as LeaderboardEntry[];
    } catch {
      return [];
    }
  },
};

// ── Users API ─────────────────────────────────────────────────────────────────

export const usersApi = {
  list: async () => {
    const { data } = await http.get('/users');
    return data as User[];
  },

  invite: async (payload: Partial<User> & { password?: string }) => {
    const { data } = await http.post('/users/invite', payload);
    return data as { user: User; tempPassword: string };
  },

  update: async (id: string, payload: Partial<User>) => {
    const { data } = await http.patch(`/users/${id}`, payload);
    return data as User;
  },

  stats: async (id: string) => {
    const { data } = await http.get(`/users/${id}/stats`);
    return data as { sessionCount: number; avgScore: number };
  },

  resetPassword: async (id: string) => {
    const { data } = await http.post(`/users/${id}/reset-password`);
    return data as { tempPassword: string };
  },
};

// ── Superadmin API ────────────────────────────────────────────────────────────

export const superadminApi = {
  setup: async (payload: unknown) => {
    const { data } = await http.post('/superadmin/setup', payload);
    return data;
  },

  getStats: async () => {
    const { data } = await http.get('/superadmin/stats');
    return data as {
      totalCompanies: number;
      activeCompanies: number;
      totalUsers: number;
      totalSessions: number;
      activeUsersThisMonth: number;
    };
  },

  listCompanies: async () => {
    const { data } = await http.get('/superadmin/companies');
    return data as CompanyDetail[];
  },

  createCompany: async (payload: Partial<CompanyDetail> & { adminEmail?: string; adminFirstName?: string; adminLastName?: string }) => {
    const { data } = await http.post('/superadmin/companies', payload);
    return data as CompanyDetail & { tempPassword?: string; adminEmail?: string };
  },

  getCompany: async (id: string) => {
    const { data } = await http.get(`/superadmin/companies/${id}`);
    return data as CompanyDetail;
  },

  updateCompany: async (id: string, payload: Partial<CompanyDetail>) => {
    const { data } = await http.patch(`/superadmin/companies/${id}`, payload);
    return data as CompanyDetail;
  },

  getCompanyUsers: async (id: string) => {
    const { data } = await http.get(`/superadmin/companies/${id}/users`);
    return data as User[];
  },

  updateCompanyUser: async (companyId: string, userId: string, payload: Partial<User>) => {
    const { data } = await http.patch(`/superadmin/companies/${companyId}/users/${userId}`, payload);
    return data as User;
  },

  syncPersonaAgents: async () => {
    const { data } = await http.post('/superadmin/sync-persona-agents');
    return data as { synced: number; results: { name: string; agentId: string | null; status: string }[] };
  },
};

// ── Voice API ─────────────────────────────────────────────────────────────────

export interface AgentConfig {
  name?: string;
  conversation_config?: {
    agent?: { prompt?: { prompt?: string; llm?: string; temperature?: number }; first_message?: string; language?: string };
    tts?: { voice_id?: string; model_id?: string };
  };
}

export interface AgentSummary {
  agent_id: string;
  name: string;
  created_at_unix_secs?: number;
}

export const voiceApi = {
  getSignedUrl: async (personaId?: string): Promise<string> => {
    const params = personaId ? { personaId } : undefined;
    const { data } = await http.get('/voice/signed-url', { params });
    return (data as { signedUrl: string }).signedUrl;
  },

  getTTSUrl: (_voiceId: string) => `/api/voice/tts/${_voiceId}`,

  listVoices: async () => {
    const { data } = await http.get('/voice/voices');
    return data as { voice_id: string; name: string }[];
  },

  health: async () => {
    const { data } = await http.get('/voice/health');
    return data as { ttsAvailable: boolean; convaiAvailable: boolean; agentConfigured: boolean; issues: string[] };
  },

  listAgents: async () => {
    const { data } = await http.get('/voice/agents');
    return data as AgentSummary[];
  },

  getAgent: async (agentId: string) => {
    const { data } = await http.get(`/voice/agents/${agentId}`);
    return data;
  },

  createAgent: async (payload: AgentConfig) => {
    const { data } = await http.post('/voice/agents', payload);
    return data as { agent_id: string };
  },

  updateAgent: async (agentId: string, payload: AgentConfig) => {
    const { data } = await http.patch(`/voice/agents/${agentId}`, payload);
    return data;
  },

  deleteAgent: async (agentId: string) => {
    await http.delete(`/voice/agents/${agentId}`);
  },
};

// ── Practice API ──────────────────────────────────────────────────────────────

export const practiceApi = {
  generateScenario: async (payload: unknown) => {
    const { data } = await http.post('/practice/generate-scenario', payload);
    return data as {
      displayName: string;
      displayTitle: string;
      displayEmoji: string;
      difficulty: string;
      personaContext: string;
      suggestedQuestions: string[];
    };
  },

  generateQuestions: async (payload: unknown) => {
    const { data } = await http.post('/practice/generate-questions', payload);
    return data as { questions: string[] };
  },
};

// ── Team Roleplays API ────────────────────────────────────────────────────────

export const teamRoleplaysApi = {
  list: async () => {
    const { data } = await http.get('/team-roleplays');
    return data as TeamRoleplay[];
  },

  create: async (payload: Partial<TeamRoleplay>) => {
    const { data } = await http.post('/team-roleplays', payload);
    return data as TeamRoleplay;
  },

  update: async (id: string, payload: Partial<TeamRoleplay>) => {
    const { data } = await http.patch(`/team-roleplays/${id}`, payload);
    return data as TeamRoleplay;
  },

  delete: async (id: string) => {
    await http.delete(`/team-roleplays/${id}`);
  },

  getTargetOptions: async () => {
    const { data } = await http.get('/team-roleplays/target-options');
    return data as {
      teams: string[];
      regions: string[];
      territories: string[];
      users: { id: string; name: string; team?: string; region?: string }[];
    };
  },
};

// ── Evaluation Prompts API ────────────────────────────────────────────────────

export const evaluationPromptsApi = {
  list: async () => {
    const { data } = await http.get('/evaluation-prompts');
    return data as EvaluationPrompt[];
  },

  get: async (roleplayType: string) => {
    const { data } = await http.get(`/evaluation-prompts/${roleplayType}`);
    return data as EvaluationPrompt | null;
  },

  update: async (id: string, payload: Partial<EvaluationPrompt>) => {
    const { data } = await http.patch(`/evaluation-prompts/${id}`, payload);
    return data as EvaluationPrompt;
  },
};

// ── Peer Sessions API ─────────────────────────────────────────────────────────

export const peerSessionsApi = {
  list: async (_sessionId: string) => {
    const { data } = await http.get('/peer-sessions');
    return data as PeerSession[];
  },
};

// ── Usage / Cost API ──────────────────────────────────────────────────────────

export interface UsageSummary {
  period: { days: number; since: string };
  totals: { totalCostUsd: number; geminiPromptTokens: number; geminiOutputTokens: number; ttsCharacters: number; convaiMinutes: number; callCount: number; requestCount: number };
  byService: { _id: string; costUsd: number; requestCount: number }[];
  dailyTrend: { _id: string; costUsd: number; sessions: number }[];
  recent: { service: string; operation: string; model?: string; promptTokens?: number; completionTokens?: number; characters?: number; durationSeconds?: number; estimatedCostUsd: number; createdAt: string }[];
  pricing: { geminiInputPerMToken: number; geminiOutputPerMToken: number; ttsPerKChars: number; convaiPerMinute: number };
}

export interface UserUsageStat {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  sessions: number;
  callMinutes: number;
  tokensUsed: number;
  costUsd: number;
  sessionCap: number | null;
  minutesCap: number | null;
  tokensCap: number | null;
}

export interface PlatformUsageSummary extends UsageSummary {
  actualCostUsd: number;
  billedCostUsd: number;
  marginUsd: number;
  marginPct: number;
  byCompany: { companyId: string; companyName: string; sessions: number; costUsd: number; billedUsd: number }[];
}

export const usageApi = {
  getSummary: async (days = 30, companyId?: string): Promise<UsageSummary> => {
    const params: Record<string, unknown> = { days };
    if (companyId) params.companyId = companyId;
    const { data } = await http.get('/usage', { params });
    return data as UsageSummary;
  },

  getUserStats: async (days = 30, companyId?: string): Promise<UserUsageStat[]> => {
    const params: Record<string, unknown> = { days };
    if (companyId) params.companyId = companyId;
    const { data } = await http.get('/usage/users', { params });
    return data as UserUsageStat[];
  },

  updateUserCap: async (userId: string, caps: { sessionCap: number | null; minutesCap: number | null; tokensCap: number | null }): Promise<void> => {
    await http.patch(`/usage/users/${userId}/cap`, caps);
  },

  getPlatformSummary: async (days = 30): Promise<PlatformUsageSummary> => {
    const { data } = await http.get('/usage/platform', { params: { days } });
    return data as PlatformUsageSummary;
  },
};

export const api = http;
