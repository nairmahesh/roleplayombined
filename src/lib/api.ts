import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from './store';
import type {
  DashboardStats,
  DashboardFrameworkStat,
  DashboardRecentSession,
  TeamMemberSummary,
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

// ── Demo users (localStorage auth) ───────────────────────────────────────────

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

const LS_KEY = 'pitchiq-session';

function makeToken(userId: string) {
  return btoa(JSON.stringify({ userId, exp: Date.now() + 86400_000 }));
}

// ── Auth API (localStorage-backed) ───────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const record = DEMO_USERS[email.toLowerCase()];
    if (!record || record.password !== password) {
      throw { response: { data: { detail: 'Invalid email or password' } } };
    }
    const { password: _pw, ...user } = record;
    const accessToken = makeToken(user.id);
    const refreshToken = makeToken(user.id + '-refresh');
    localStorage.setItem(LS_KEY, JSON.stringify({ user, accessToken, refreshToken }));
    return { user, accessToken, refreshToken };
  },

  register: async (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    companySlug?: string;
  }) => {
    const user: User = {
      id: crypto.randomUUID(),
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: 'AGENT',
      companyId: '',
      isActive: true,
    };
    const accessToken = makeToken(user.id);
    const refreshToken = makeToken(user.id + '-refresh');
    localStorage.setItem(LS_KEY, JSON.stringify({ user, accessToken, refreshToken }));
    return { user, accessToken, refreshToken };
  },

  logout: async () => {
    localStorage.removeItem(LS_KEY);
  },

  me: async (): Promise<User> => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error('Not authenticated');
    return JSON.parse(raw).user as User;
  },

  restoreSession: (): { user: User; accessToken: string; refreshToken: string } | null => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
};

// ── Mock data store (localStorage-backed) ────────────────────────────────────

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const MOCK_PERSONAS: Persona[] = [
  {
    id: 'p1', name: 'Sarah Chen', title: 'VP of Engineering', company: 'TechCorp', industry: 'SaaS',
    emoji: '👩‍💻', difficulty: 'MEDIUM', personality: 'Analytical, data-driven, skeptical of ROI claims',
    systemPrompt: 'You are Sarah Chen, VP of Engineering at TechCorp. You are evaluating sales pitches carefully.',
    objections: ['We already have an internal solution', 'The timeline is too aggressive', 'Budget is frozen until Q4'],
    buyingSignals: ['How does it integrate with our stack?', 'What does onboarding look like?'],
    frameworks: ['MEDDIC', 'SPIN'],
    isPreset: true,
  },
  {
    id: 'p2', name: 'Marcus Johnson', title: 'CFO', company: 'RetailCo', industry: 'Retail',
    emoji: '💼', difficulty: 'HARD', personality: 'Numbers-focused, time-constrained, needs clear ROI',
    systemPrompt: 'You are Marcus Johnson, CFO at RetailCo. You focus on financial impact and risk.',
    objections: ['What is the total cost of ownership?', 'We need to see proof of ROI first', 'Our board is risk-averse'],
    buyingSignals: ['What payback period can we expect?', 'Do you have case studies from our sector?'],
    frameworks: ['BANT', 'MEDDIC'],
    isPreset: true,
  },
  {
    id: 'p3', name: 'Priya Patel', title: 'Head of Sales', company: 'GrowthCo', industry: 'FinTech',
    emoji: '🎯', difficulty: 'EASY', personality: 'Collaborative, growth-focused, open to new tools',
    systemPrompt: 'You are Priya Patel, Head of Sales at GrowthCo. You are exploring tools to help your team hit targets.',
    objections: ['Will this slow my team down?', 'What training is required?'],
    buyingSignals: ['How quickly can we deploy?', 'Can we run a pilot?'],
    frameworks: ['SPIN', 'CHALLENGER', 'SNAP'],
    isPreset: true,
  },
  {
    id: 'p4', name: 'James Wright', title: 'CTO', company: 'HealthTech Inc', industry: 'Healthcare',
    emoji: '🏥', difficulty: 'EXPERT', personality: 'Security-conscious, compliance-driven, deeply technical',
    systemPrompt: 'You are James Wright, CTO at HealthTech Inc. Security and compliance are your top priorities.',
    objections: ['How do you handle HIPAA compliance?', 'What are your SLA guarantees?', 'We cannot move data to the cloud'],
    buyingSignals: ['Tell me about your security architecture', 'Who are your other healthcare clients?'],
    frameworks: ['MEDDIC', 'MEDDICC'],
    isPreset: true,
  },
];

const MOCK_SESSIONS: Session[] = [
  {
    id: 's1', type: 'PHONE_CALL', status: 'COMPLETED', framework: 'MEDDIC',
    totalScore: 84, durationSeconds: 480,
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    endedAt: new Date(Date.now() - 83400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    persona: { id: 'p1', name: 'Sarah Chen', title: 'VP of Engineering', emoji: '👩‍💻', difficulty: 'MEDIUM' },
    user: { id: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent' },
    frameworkScores: [
      { id: 'fs1', component: 'Metrics', score: 88, feedback: 'Strong quantification of business impact.', evidence: ['You cited a 30% reduction in churn'] },
      { id: 'fs2', component: 'Economic Buyer', score: 90, feedback: 'Correctly identified decision maker.', evidence: [] },
      { id: 'fs3', component: 'Decision Criteria', score: 78, feedback: 'Good coverage but missed compliance angle.', evidence: [] },
      { id: 'fs4', component: 'Decision Process', score: 82, feedback: 'Asked about timeline and stakeholders.', evidence: [] },
      { id: 'fs5', component: 'Identify Pain', score: 85, feedback: 'Uncovered core pain points effectively.', evidence: [] },
      { id: 'fs6', component: 'Champion', score: 80, feedback: 'Identified internal champion early.', evidence: [] },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Strong performance overall. You demonstrated excellent command of the MEDDIC framework and built rapport quickly.',
      strengths: ['Clear ROI articulation', 'Active listening', 'Handled price objection well'],
      improvements: ['Ask earlier about decision timeline', 'Probe deeper on competitive landscape'],
      proTip: 'Try using the "Why now?" question earlier to create urgency without pressure.',
    }),
  },
  {
    id: 's2', type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'SPIN',
    totalScore: 71, durationSeconds: 620,
    startedAt: new Date(Date.now() - 172800000).toISOString(),
    endedAt: new Date(Date.now() - 168600000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    persona: { id: 'p2', name: 'Marcus Johnson', title: 'CFO', emoji: '💼', difficulty: 'HARD' },
    user: { id: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent' },
    frameworkScores: [
      { id: 'fs7', component: 'Situation Questions', score: 75, feedback: 'Good context gathering.', evidence: [] },
      { id: 'fs8', component: 'Problem Questions', score: 68, feedback: 'Could probe more on root causes.', evidence: [] },
      { id: 'fs9', component: 'Implication Questions', score: 70, feedback: 'Linked problems to business impact.', evidence: [] },
      { id: 'fs10', component: 'Need-Payoff Questions', score: 72, feedback: 'Led the prospect to articulate value.', evidence: [] },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Solid use of SPIN methodology. Focus on deepening implication questions for greater impact.',
      strengths: ['Good discovery phase', 'Stayed calm under pressure'],
      improvements: ['Spend more time on implication questions', 'Quantify the cost of inaction'],
      proTip: 'When a CFO objects on budget, ask what the cost of NOT solving this problem is.',
    }),
  },
  {
    id: 's3', type: 'PHONE_CALL', status: 'COMPLETED', framework: 'BANT',
    totalScore: 92, durationSeconds: 360,
    startedAt: new Date(Date.now() - 259200000).toISOString(),
    endedAt: new Date(Date.now() - 256200000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    persona: { id: 'p3', name: 'Priya Patel', title: 'Head of Sales', emoji: '🎯', difficulty: 'EASY' },
    user: { id: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent' },
    frameworkScores: [
      { id: 'fs11', component: 'Budget', score: 95, feedback: 'Expertly navigated budget conversation.', evidence: [] },
      { id: 'fs12', component: 'Authority', score: 90, feedback: 'Confirmed decision-making authority early.', evidence: [] },
      { id: 'fs13', component: 'Need', score: 92, feedback: 'Deep need discovery.', evidence: [] },
      { id: 'fs14', component: 'Timeline', score: 90, feedback: 'Clear timeline established.', evidence: [] },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Excellent session. Near-perfect BANT execution with outstanding rapport building.',
      strengths: ['Natural conversation flow', 'Confident closing', 'Excellent objection handling'],
      improvements: ['Could explore upsell opportunities'],
      proTip: 'Use this session as a template — your pacing and question flow were ideal.',
    }),
  },
];

const MOCK_MEMBERS: TeamMemberSummary[] = [
  { id: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent', sessionCount: 3, avgScore: 82, sessionsThisWeek: 2 },
  { id: 'u2', firstName: 'Alex', lastName: 'Rivera', sessionCount: 18, avgScore: 88, sessionsThisWeek: 4 },
  { id: 'u3', firstName: 'Jordan', lastName: 'Kim', sessionCount: 14, avgScore: 79, sessionsThisWeek: 3 },
  { id: 'u4', firstName: 'Taylor', lastName: 'Brooks', sessionCount: 9, avgScore: 74, sessionsThisWeek: 1 },
  { id: 'u5', firstName: 'Morgan', lastName: 'Lee', sessionCount: 6, avgScore: 68, sessionsThisWeek: 0 },
  { id: 'u6', firstName: 'Casey', lastName: 'Park', sessionCount: 4, avgScore: 71, sessionsThisWeek: 0 },
];

const FRAMEWORK_STATS: DashboardFrameworkStat[] = [
  { component: 'Metrics', avgScore: 83, count: 12 },
  { component: 'Economic Buyer', avgScore: 77, count: 12 },
  { component: 'Decision Criteria', avgScore: 71, count: 12 },
  { component: 'Decision Process', avgScore: 68, count: 12 },
  { component: 'Identify Pain', avgScore: 85, count: 12 },
  { component: 'Champion', avgScore: 74, count: 12 },
];

function recentSessionsFromMock(): DashboardRecentSession[] {
  return MOCK_SESSIONS.map(s => ({
    id: s.id,
    endedAt: s.endedAt,
    durationSeconds: s.durationSeconds,
    framework: s.framework,
    sessionType: s.type,
    personaName: s.persona?.name ?? 'Unknown',
    personaEmoji: s.persona?.emoji ?? '🎭',
    userFirstName: s.user?.firstName ?? '',
    userLastName: s.user?.lastName ?? '',
    totalScore: s.totalScore,
  }));
}

function delay<T>(val: T, ms = 300): Promise<T> {
  return new Promise(res => setTimeout(() => res(val), ms));
}

// ── Sessions API ──────────────────────────────────────────────────────────────

export const sessionsApi = {
  list: async (_params?: Record<string, unknown>) =>
    delay({ sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length }),
  listAll: async (_params?: Record<string, unknown>) =>
    delay({ sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length }),
  getPeerScores: async (_sessionId: string) => delay([] as { userId: string; name: string; score: number; rank: number }[]),
  create: async (payload: { type: string; framework: string; personaId?: string; scenarioConfig?: unknown }) => {
    const newSession: Session = {
      id: `s-${Date.now()}`,
      type: payload.type as Session['type'],
      status: 'PENDING',
      framework: payload.framework as Session['framework'],
      createdAt: new Date().toISOString(),
    };
    return delay(newSession);
  },
  get: async (id: string) => {
    const s = MOCK_SESSIONS.find(s => s.id === id) ?? MOCK_SESSIONS[0];
    return delay({ ...s, id });
  },
  start: async (_id: string) => delay({ status: 'IN_PROGRESS' }),
  end: async (id: string, _payload?: unknown) => {
    const s = MOCK_SESSIONS.find(s => s.id === id) ?? MOCK_SESSIONS[0];
    return delay({ ...s, status: 'COMPLETED' as Session['status'] });
  },
  addMessage: async (_id: string, _payload: unknown) => delay({}),
  getAIResponse: async (_id: string, _userMessage: string) =>
    delay({ response: "That's a great point. Can you tell me more about your current process and where the biggest pain points are?" }),
  share: async (_id: string) => delay({ shareUrl: `${window.location.origin}/sessions/shared` }),
};

// ── Personas API ──────────────────────────────────────────────────────────────

const LS_PERSONAS = 'pitchiq-personas';

function loadPersonas(): Persona[] {
  try {
    const raw = localStorage.getItem(LS_PERSONAS);
    return raw ? JSON.parse(raw) : MOCK_PERSONAS;
  } catch { return MOCK_PERSONAS; }
}

function savePersonas(personas: Persona[]) {
  localStorage.setItem(LS_PERSONAS, JSON.stringify(personas));
}

export const personasApi = {
  list: async () => delay(loadPersonas()),
  create: async (payload: Partial<Persona>) => {
    const personas = loadPersonas();
    const newP: Persona = { ...payload, id: `p-${Date.now()}`, isPreset: false } as Persona;
    savePersonas([...personas, newP]);
    return delay(newP);
  },
  update: async (id: string, payload: Partial<Persona>) => {
    const personas = loadPersonas().map(p => p.id === id ? { ...p, ...payload } : p);
    savePersonas(personas);
    return delay(personas.find(p => p.id === id)!);
  },
  delete: async (id: string) => {
    savePersonas(loadPersonas().filter(p => p.id !== id));
    return delay(undefined as void);
  },
  clone: async (persona: Persona) => {
    const newP: Persona = { ...persona, id: `p-${Date.now()}`, name: `${persona.name} (Copy)`, isPreset: false };
    const personas = loadPersonas();
    savePersonas([...personas, newP]);
    return delay(newP);
  },
  getAnalytics: async (_id: string) =>
    delay({ usageCount: Math.floor(Math.random() * 20), avgScore: 75 + Math.floor(Math.random() * 20), lastUsed: new Date(Date.now() - 86400000).toISOString(), topUsers: [] }),
};

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: async (): Promise<DashboardStats> => {
    const savedSession = localStorage.getItem('pitchiq-session');
    const role = savedSession ? JSON.parse(savedSession).user?.role : 'AGENT';

    const base: DashboardStats = {
      totalSessions: 44,
      avgScore: 79,
      activeUsers: 6,
      passRate: 77,
      recentSessions: recentSessionsFromMock(),
      frameworkStats: FRAMEWORK_STATS,
    };

    if (role === 'AGENT') {
      return delay({
        ...base,
        totalSessions: 3,
        agentExtra: { sessionsThisWeek: 2, streak: 3, rank: 2 },
      });
    }
    if (role === 'MANAGER') {
      return delay({
        ...base,
        managerExtra: { teamSize: MOCK_MEMBERS.length, members: MOCK_MEMBERS },
      });
    }
    return delay({
      ...base,
      managerExtra: { teamSize: MOCK_MEMBERS.length, members: MOCK_MEMBERS },
    });
  },

  leaderboard: async (_period?: string): Promise<LeaderboardEntry[]> =>
    delay(
      [...MOCK_MEMBERS]
        .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
        .map((m, i) => ({
          rank: i + 1,
          user: { id: m.id, firstName: m.firstName, lastName: m.lastName },
          avgScore: m.avgScore ?? 0,
          sessionCount: m.sessionCount,
        }))
    ),
};

// ── Users API ─────────────────────────────────────────────────────────────────

const LS_USERS = 'pitchiq-users';

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(LS_USERS);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return MOCK_MEMBERS.map(m => ({
    id: m.id,
    email: `${m.firstName.toLowerCase()}.${m.lastName.toLowerCase()}@demo.com`,
    firstName: m.firstName,
    lastName: m.lastName,
    role: 'AGENT' as const,
    companyId: DEMO_COMPANY_ID,
    isActive: true,
    avgScore: m.avgScore,
    sessionCount: m.sessionCount,
  }));
}

export const usersApi = {
  list: async () => delay(loadUsers()),
  invite: async (payload: Partial<User> & { password?: string }) => {
    const users = loadUsers();
    const newUser: User = {
      id: `u-${Date.now()}`,
      email: payload.email ?? '',
      firstName: payload.firstName ?? '',
      lastName: payload.lastName ?? '',
      role: payload.role ?? 'AGENT',
      companyId: DEMO_COMPANY_ID,
      isActive: true,
    };
    localStorage.setItem(LS_USERS, JSON.stringify([...users, newUser]));
    return delay({ user: newUser, tempPassword: 'TempPass123!' });
  },
  update: async (id: string, payload: Partial<User>) => {
    const users = loadUsers().map(u => u.id === id ? { ...u, ...payload } : u);
    localStorage.setItem(LS_USERS, JSON.stringify(users));
    return delay(users.find(u => u.id === id)!);
  },
  stats: async (_id: string) => delay({ sessionCount: 3, avgScore: 79 }),
  resetPassword: async (_id: string) => delay({ tempPassword: 'TempPass123!' }),
};

// ── Superadmin API ────────────────────────────────────────────────────────────

const MOCK_COMPANIES: CompanyDetail[] = [
  {
    id: DEMO_COMPANY_ID, name: 'Demo Company', slug: 'demo', defaultFramework: 'MEDDIC',
    passThreshold: 70, isActive: true, industry: 'Technology',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    agentCount: 6, adminCount: 1, totalSessions: 44,
    admins: [{ id: '10000000-0000-0000-0000-000000000002', email: 'admin@demo.com', firstName: 'Company', lastName: 'Admin', isActive: true }],
  },
  {
    id: 'c2', name: 'Acme Sales Co', slug: 'acme', defaultFramework: 'SPIN',
    passThreshold: 65, isActive: true, industry: 'Manufacturing',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    agentCount: 12, adminCount: 2, totalSessions: 127,
    admins: [],
  },
  {
    id: 'c3', name: 'FinPro Partners', slug: 'finpro', defaultFramework: 'BANT',
    passThreshold: 75, isActive: true, industry: 'Financial Services',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    agentCount: 8, adminCount: 1, totalSessions: 89,
    admins: [],
  },
];

const LS_COMPANIES = 'pitchiq-companies';

function loadCompanies(): CompanyDetail[] {
  try {
    const raw = localStorage.getItem(LS_COMPANIES);
    return raw ? JSON.parse(raw) : MOCK_COMPANIES;
  } catch { return MOCK_COMPANIES; }
}

export const superadminApi = {
  setup: async (_payload: unknown) => delay({}),
  getStats: async () => delay({
    totalCompanies: 3, activeCompanies: 3,
    totalUsers: 26, totalSessions: 260, activeUsersThisMonth: 18,
  }),
  listCompanies: async () => delay(loadCompanies()),
  createCompany: async (payload: Partial<CompanyDetail> & { adminEmail?: string; adminFirstName?: string; adminLastName?: string }) => {
    const companies = loadCompanies();
    const newCo: CompanyDetail = {
      id: `c-${Date.now()}`,
      name: payload.name ?? 'New Company',
      slug: payload.slug ?? `co-${Date.now()}`,
      defaultFramework: payload.defaultFramework ?? 'MEDDIC',
      passThreshold: payload.passThreshold ?? 70,
      isActive: true,
      industry: payload.industry,
      createdAt: new Date().toISOString(),
      agentCount: 0, adminCount: payload.adminEmail ? 1 : 0, totalSessions: 0,
      admins: payload.adminEmail ? [{ id: `a-${Date.now()}`, email: payload.adminEmail, firstName: payload.adminFirstName ?? '', lastName: payload.adminLastName ?? '', isActive: true }] : [],
    };
    localStorage.setItem(LS_COMPANIES, JSON.stringify([...companies, newCo]));
    return delay({ ...newCo, tempPassword: 'TempPass123!', adminEmail: payload.adminEmail });
  },
  getCompany: async (id: string) => {
    const co = loadCompanies().find(c => c.id === id) ?? MOCK_COMPANIES[0];
    return delay({ ...co, id });
  },
  updateCompany: async (id: string, payload: Partial<CompanyDetail>) => {
    const companies = loadCompanies().map(c => c.id === id ? { ...c, ...payload } : c);
    localStorage.setItem(LS_COMPANIES, JSON.stringify(companies));
    return delay(companies.find(c => c.id === id)!);
  },
  getCompanyUsers: async (_id: string) => delay(loadUsers()),
  updateCompanyUser: async (_companyId: string, userId: string, payload: Partial<User>) => {
    const users = loadUsers().map(u => u.id === userId ? { ...u, ...payload } : u);
    localStorage.setItem(LS_USERS, JSON.stringify(users));
    return delay(users.find(u => u.id === userId));
  },
  syncPersonaAgents: async () => delay({ synced: 0, results: [] as { name: string; agentId: string | null; status: string }[] }),
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
  getSignedUrl: async (_personaId?: string): Promise<string> => delay(''),
  getTTSUrl: (_voiceId: string) => `/api/voice/tts/${_voiceId}`,
  listVoices: async () => delay([] as { voice_id: string; name: string }[]),
  health: async () => delay({ ttsAvailable: false, convaiAvailable: false, agentConfigured: false, issues: ['No backend connected — demo mode'] }),
  listAgents: async () => delay([] as AgentSummary[]),
  getAgent: async (_agentId: string) => delay({}),
  createAgent: async (_payload: AgentConfig) => delay({ agent_id: '' }),
  updateAgent: async (_agentId: string, _payload: AgentConfig) => delay({}),
  deleteAgent: async (_agentId: string) => delay(undefined as void),
};

// ── Practice API ──────────────────────────────────────────────────────────────

export const practiceApi = {
  generateScenario: async (_payload: unknown) => delay({
    displayName: 'Custom Scenario',
    displayTitle: 'Prospect',
    displayEmoji: '🎯',
    difficulty: 'MEDIUM',
    personaContext: 'A mid-market prospect evaluating your solution.',
    suggestedQuestions: ['What are your biggest pain points today?', 'What does success look like?'],
  }),
  generateQuestions: async (_payload: unknown) => delay({
    questions: ['What is your current process?', 'Where do you see the biggest inefficiency?', 'What would an ideal solution look like?'],
  }),
};

// ── Team Roleplays API ────────────────────────────────────────────────────────

const LS_ROLEPLAYS = 'pitchiq-roleplays';

function loadRoleplays(): TeamRoleplay[] {
  try {
    const raw = localStorage.getItem(LS_ROLEPLAYS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export const teamRoleplaysApi = {
  list: async () => delay(loadRoleplays()),
  create: async (payload: Partial<TeamRoleplay>) => {
    const items = loadRoleplays();
    const newItem: TeamRoleplay = {
      id: `tr-${Date.now()}`,
      name: payload.name ?? 'New Roleplay',
      scenarioConfig: payload.scenarioConfig!,
      isActive: true,
      createdById: '10000000-0000-0000-0000-000000000002',
      createdBy: { id: '10000000-0000-0000-0000-000000000002', firstName: 'Company', lastName: 'Admin' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...payload,
    } as TeamRoleplay;
    localStorage.setItem(LS_ROLEPLAYS, JSON.stringify([...items, newItem]));
    return delay(newItem);
  },
  update: async (id: string, payload: Partial<TeamRoleplay>) => {
    const items = loadRoleplays().map(r => r.id === id ? { ...r, ...payload, updatedAt: new Date().toISOString() } : r);
    localStorage.setItem(LS_ROLEPLAYS, JSON.stringify(items));
    return delay(items.find(r => r.id === id)!);
  },
  delete: async (id: string) => {
    localStorage.setItem(LS_ROLEPLAYS, JSON.stringify(loadRoleplays().filter(r => r.id !== id)));
    return delay(undefined as void);
  },
  getTargetOptions: async () => delay({
    teams: ['Enterprise', 'SMB', 'SDR Team'],
    regions: ['EMEA', 'APAC', 'North America'],
    territories: ['East', 'West', 'Central'],
    users: loadUsers().map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, team: u.team, region: u.region })),
  }),
};

// ── Evaluation Prompts API ────────────────────────────────────────────────────

const MOCK_EVAL_PROMPTS: EvaluationPrompt[] = [
  {
    id: 'ep1', roleplayType: 'cold_call', displayName: 'Cold Call', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert SDR coach evaluating a cold call roleplay. Score each criterion 0 (not done) or 1 (done well), with a one-sentence evidence quote from the transcript.`,
    scoringCriteria: [
      {
        group: 'Opener',
        criteria: [
          { question: 'Permission-based opener?', hint: 'Did the rep ask for a brief moment before pitching? e.g. "Do you have 30 seconds?"' },
          { question: 'Used research on prospect?', hint: 'Referenced something specific about the prospect or company to personalise the opener.' },
        ],
      },
      {
        group: 'Discovery',
        criteria: [
          { question: 'SDR asked for preconceptions of product?', hint: 'Did the rep ask about current awareness or opinion of the product/category before pitching?' },
        ],
      },
      {
        group: 'Social Proof',
        criteria: [
          { question: 'Provided social proof?', hint: 'Cited a relevant customer reference, metric, or case study.' },
          { question: 'Asked if social proof was relevant?', hint: 'Checked whether the example resonated with this specific prospect.' },
        ],
      },
      {
        group: 'Takeaway',
        criteria: [
          { question: 'Re-confirmed that the time works for the prospect?', hint: 'Checked that timing still worked before closing.' },
          { question: 'Asked for success criteria for next call?', hint: 'Asked what a successful next call would look like for the prospect.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Next steps agreed upon?', hint: 'Both parties agreed on a clear next step.' },
          { question: 'Follow-up meeting booked?', hint: 'A specific date/time for a follow-up was confirmed.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep2', roleplayType: 'discovery_call', displayName: 'Discovery Call', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert AE coach evaluating a discovery call roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Introduction & Agenda',
        criteria: [
          { question: 'Did the seller discuss the agenda and ask for prospect\'s input?', hint: 'Set an agenda AND asked if the prospect wants to add anything.' },
          { question: 'Did the seller introduce an Upfront Contract?', hint: 'Established mutual expectations: what will happen and what the outcome will be.' },
        ],
      },
      {
        group: 'Pain & Metrics Discovery',
        criteria: [
          { question: 'Did the seller uncover specific pain points?', hint: 'At least one concrete, specific problem the prospect is experiencing.' },
          { question: 'Did the seller uncover relevant metrics?', hint: 'Quantified impact — time lost, revenue lost, cost, or other measurable metric.' },
        ],
      },
      {
        group: 'Objection Handling',
        criteria: [
          { question: 'Did the seller handle objections effectively using the FFF framework?', hint: 'Acknowledged, empathised (Feel-Felt-Found), then reframed any objection raised.' },
        ],
      },
      {
        group: 'Customer Reference & Value Pyramid Discovery',
        criteria: [
          { question: 'Did the seller present a customer reference?', hint: 'Referenced a similar customer and their outcome.' },
          { question: 'Did the seller explore the prospect\'s goal-setting framework?', hint: 'Asked how the prospect measures success or sets targets.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Did the seller revisit the upfront contract and define next steps?', hint: 'Closed by referencing the start-of-call agreement and confirming concrete next steps.' },
          { question: 'Did the seller qualify out or in effectively?', hint: 'Reached a clear conclusion about whether this is a qualified opportunity.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep3', roleplayType: 'sales_pitch', displayName: 'Sales Pitch', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert sales coach evaluating a sales pitch roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Value Proposition',
        criteria: [
          { question: 'Was the value proposition clear and specific?', hint: 'Articulated what the product does and who it helps in concrete terms.' },
          { question: 'Was the pitch personalised to the prospect\'s situation?', hint: 'Referenced specific context or pain points of this prospect.' },
        ],
      },
      {
        group: 'Differentiation',
        criteria: [
          { question: 'Did the rep differentiate from competition?', hint: 'Explained what makes this solution different from alternatives.' },
          { question: 'Was a customer story or case study used?', hint: 'Backed claims with a real customer outcome.' },
        ],
      },
      {
        group: 'ROI & Business Case',
        criteria: [
          { question: 'Was ROI or business value quantified?', hint: 'Provided a number, time saving, or cost reduction estimate.' },
        ],
      },
      {
        group: 'Objection Handling',
        criteria: [
          { question: 'Were objections handled effectively?', hint: 'Acknowledged, explored, and reframed at least one objection.' },
          { question: 'Was momentum maintained after objections?', hint: 'Returned to the pitch without losing energy after handling pushback.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Was a clear next step defined?', hint: 'Both parties agreed on a specific next action.' },
          { question: 'Was urgency or a reason to act now established?', hint: 'Gave a compelling reason to move forward now vs. later.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep4', roleplayType: 'objection_handling', displayName: 'Objection Handling', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert sales coach evaluating an objection handling roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Acknowledgement',
        criteria: [
          { question: 'Did the rep acknowledge the objection without defending?', hint: 'Showed they heard the concern before responding.' },
          { question: 'Did the rep explore the root cause with a question?', hint: 'Asked a clarifying question to understand the objection deeper.' },
        ],
      },
      {
        group: 'Response',
        criteria: [
          { question: 'Did the rep provide relevant evidence or reframe?', hint: 'Used a customer story, data point, or reframe to address the concern.' },
          { question: 'Did the rep confirm the objection was resolved?', hint: 'Checked: "Does that make sense?" or similar before moving on.' },
        ],
      },
      {
        group: 'Momentum',
        criteria: [
          { question: 'Did the rep maintain momentum toward the next step?', hint: 'Transitioned back to the opportunity without losing energy.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep5', roleplayType: 'negotiation', displayName: 'Negotiation', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert sales coach evaluating a negotiation roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Anchoring',
        criteria: [
          { question: 'Did the rep anchor high before conceding?', hint: 'Opened at full price/terms before negotiating.' },
          { question: 'Did the rep trade concessions (not give without getting)?', hint: 'Every concession was paired with a request for something in return.' },
        ],
      },
      {
        group: 'Value Protection',
        criteria: [
          { question: 'Did the rep protect margin and core terms?', hint: 'Avoided discounting on price without moving something else (scope, timeline, terms).' },
          { question: 'Did the rep use value justification before conceding?', hint: 'Re-stated ROI or business case before offering any flexibility.' },
        ],
      },
      {
        group: 'Outcome',
        criteria: [
          { question: 'Was a mutually agreed outcome reached?', hint: 'Both parties aligned on a specific deal or next step.' },
          { question: 'Was the relationship maintained throughout?', hint: 'Tone remained collaborative, not adversarial.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep6', roleplayType: 'account_expansion', displayName: 'Account Expansion', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert CSM/AE coach evaluating an account expansion roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Relationship & Context',
        criteria: [
          { question: 'Did the rep reference the existing relationship and past wins?', hint: 'Opened by acknowledging what\'s already been achieved together.' },
          { question: 'Did the rep identify a new business need or expansion trigger?', hint: 'Surfaced a specific new problem, team, or use case not yet solved.' },
        ],
      },
      {
        group: 'Expansion Discovery',
        criteria: [
          { question: 'Did the rep map to additional stakeholders?', hint: 'Identified or asked about other decision-makers or teams that could benefit.' },
          { question: 'Did the rep present an expansion business case with ROI?', hint: 'Showed the financial or operational value of the expanded solution.' },
        ],
      },
      {
        group: 'Next Steps',
        criteria: [
          { question: 'Was a clear next step for the expansion defined?', hint: 'Agreed on a specific action to advance the expansion conversation.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep7', roleplayType: 'customer_support', displayName: 'Customer Support', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert customer success coach evaluating a customer support roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Empathy & Acknowledgement',
        criteria: [
          { question: 'Did the rep acknowledge the customer\'s frustration?', hint: 'Validated the customer\'s feelings before problem-solving.' },
          { question: 'Did the rep apologise or take ownership appropriately?', hint: 'Took responsibility without over-promising or deflecting.' },
        ],
      },
      {
        group: 'Problem Resolution',
        criteria: [
          { question: 'Did the rep ask clarifying questions to understand the issue?', hint: 'Gathered enough detail before proposing a solution.' },
          { question: 'Was a clear resolution or next step provided?', hint: 'Customer left knowing exactly what happens next.' },
        ],
      },
      {
        group: 'Experience & Retention',
        criteria: [
          { question: 'Did the rep confirm customer satisfaction before closing?', hint: 'Asked if the resolution met the customer\'s needs.' },
          { question: 'Did the rep look for an opportunity to add value or expand?', hint: 'Mentioned a related feature, resource, or upsell where appropriate.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

const LS_EVAL = 'pitchiq-eval-prompts';
const EVAL_VERSION = 'v3'; // bump to force-refresh cached rubrics

function loadEvalPrompts(): EvaluationPrompt[] {
  try {
    const version = localStorage.getItem(LS_EVAL + '-version');
    if (version !== EVAL_VERSION) {
      localStorage.removeItem(LS_EVAL);
      localStorage.setItem(LS_EVAL + '-version', EVAL_VERSION);
    }
    const raw = localStorage.getItem(LS_EVAL);
    return raw ? JSON.parse(raw) : MOCK_EVAL_PROMPTS;
  } catch { return MOCK_EVAL_PROMPTS; }
}

export const evaluationPromptsApi = {
  list: async () => delay(loadEvalPrompts()),
  get: async (roleplayType: string) => delay(loadEvalPrompts().find(e => e.roleplayType === roleplayType) ?? null),
  update: async (id: string, payload: Partial<EvaluationPrompt>) => {
    const items = loadEvalPrompts().map(e => e.id === id ? { ...e, ...payload, updatedAt: new Date().toISOString() } : e);
    localStorage.setItem(LS_EVAL, JSON.stringify(items));
    return delay(items.find(e => e.id === id)!);
  },
};

// ── Peer Sessions API ─────────────────────────────────────────────────────────

export const peerSessionsApi = {
  list: async (_sessionId: string) => delay([] as PeerSession[]),
};

// ── Usage / Cost API ──────────────────────────────────────────────────────────

export interface UsageSummary {
  period: { days: number; since: string };
  totals: { totalCostUsd: number; geminiPromptTokens: number; geminiOutputTokens: number; ttsCharacters: number; convaiMinutes: number; callCount: number; requestCount: number };
  byService: { _id: string; costUsd: number; requestCount: number }[];
  dailyTrend: { _id: string; costUsd: number }[];
  recent: { service: string; operation: string; model?: string; promptTokens?: number; completionTokens?: number; characters?: number; durationSeconds?: number; estimatedCostUsd: number; createdAt: string }[];
  pricing: { geminiInputPerMToken: number; geminiOutputPerMToken: number; ttsPerKChars: number; convaiPerMinute: number };
}

export const usageApi = {
  getSummary: async (_days = 30, _companyId?: string): Promise<UsageSummary> => delay({
    period: { days: 30, since: new Date(Date.now() - 30 * 86400000).toISOString() },
    totals: { totalCostUsd: 4.82, geminiPromptTokens: 120000, geminiOutputTokens: 45000, ttsCharacters: 18000, convaiMinutes: 22, callCount: 44, requestCount: 88 },
    byService: [{ _id: 'gemini', costUsd: 3.10, requestCount: 44 }, { _id: 'elevenlabs', costUsd: 1.72, requestCount: 44 }],
    dailyTrend: [],
    recent: [],
    pricing: { geminiInputPerMToken: 0.35, geminiOutputPerMToken: 1.05, ttsPerKChars: 0.18, convaiPerMinute: 0.10 },
  }),
};

export const api = http;
