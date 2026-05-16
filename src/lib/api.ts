// Mock API — no backend required for preview
import type {
  DashboardStats,
  LeaderboardEntry,
  Session,
  Persona,
  User,
  TeamRoleplay,
  Framework,
  CompanyDetail,
} from '@/types';

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_USER: User = {
  id: 'u1',
  email: 'agent@demo.com',
  firstName: 'Alex',
  lastName: 'Rivera',
  role: 'AGENT',
  companyId: 'c1',
  avgScore: 74,
  sessionCount: 12,
};

const MOCK_DASHBOARD: DashboardStats = {
  totalSessions: 12,
  avgScore: 74,
  activeUsers: 8,
  passRate: 67,
  recentSessions: [
    { id: 's1', endedAt: new Date(Date.now() - 3_600_000).toISOString(), durationSeconds: 720, framework: 'MEDDIC', sessionType: 'PHONE_CALL', personaName: 'Sarah Chen', personaEmoji: '👩‍💼', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 81 },
    { id: 's2', endedAt: new Date(Date.now() - 86_400_000).toISOString(), durationSeconds: 540, framework: 'SPIN', sessionType: 'ONLINE_MEETING', personaName: 'Marcus Thompson', personaEmoji: '🧑‍💼', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 68 },
    { id: 's3', endedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), durationSeconds: 900, framework: 'BANT', sessionType: 'PHONE_CALL', personaName: 'Priya Patel', personaEmoji: '👩‍🔬', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 75 },
    { id: 's4', endedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(), durationSeconds: 480, framework: 'MEDDIC', sessionType: 'ONLINE_MEETING', personaName: 'James Kim', personaEmoji: '👨‍💻', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 55 },
  ],
  frameworkStats: [
    { component: 'Metrics', avgScore: 82, count: 8 },
    { component: 'Economic Buyer', avgScore: 71, count: 8 },
    { component: 'Decision Criteria', avgScore: 65, count: 8 },
    { component: 'Decision Process', avgScore: 78, count: 8 },
    { component: 'Identify Pain', avgScore: 88, count: 8 },
    { component: 'Champion', avgScore: 60, count: 8 },
  ],
  agentExtra: { sessionsThisWeek: 3, streak: 2, rank: 4 },
};

const MOCK_SESSIONS: Session[] = [
  {
    id: 's1',
    type: 'PHONE_CALL',
    status: 'COMPLETED',
    framework: 'MEDDIC',
    totalScore: 81,
    durationSeconds: 720,
    startedAt: new Date(Date.now() - 3_700_000).toISOString(),
    endedAt: new Date(Date.now() - 3_600_000).toISOString(),
    createdAt: new Date(Date.now() - 3_700_000).toISOString(),
    persona: { id: 'p1', name: 'Sarah Chen', title: 'VP of Sales', emoji: '👩‍💼', difficulty: 'MEDIUM' },
    frameworkScores: [
      { id: 'fs1', component: 'Metrics', score: 85, feedback: 'Good use of quantitative metrics', evidence: ['You mentioned a 20% efficiency gain'] },
      { id: 'fs2', component: 'Economic Buyer', score: 78, feedback: 'Identified the buyer well', evidence: ['Asked about budget authority early'] },
      { id: 'fs3', component: 'Identify Pain', score: 92, feedback: 'Excellent pain discovery', evidence: ['Uncovered 3 distinct pain points'] },
      { id: 'fs4', component: 'Champion', score: 68, feedback: 'Could build champion relationship more', evidence: ['Did not ask about internal advocates'] },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Strong discovery call with excellent pain identification. Your ability to quantify business impact was impressive.',
      strengths: ['Excellent pain point discovery', 'Strong metric articulation', 'Professional tone throughout'],
      improvements: ['Build champion relationships earlier', 'Ask more about decision timeline', 'Follow up on budget qualification'],
      proTip: 'Try using the "impact gap" technique — ask "what happens if this problem persists for another 6 months?" to create urgency.',
    }),
    timelineEvents: [
      { id: 'te1', type: 'GOOD', timestampMs: 45000, title: 'Strong opener', description: 'Opened with a relevant industry insight', suggestion: undefined },
      { id: 'te2', type: 'ISSUE', timestampMs: 180000, title: 'Missed objection', description: 'Prospect raised pricing concern but you moved on', suggestion: 'Acknowledge pricing objections directly', betterResponse: 'I understand cost is a concern — what ROI threshold would make this a clear yes for you?' },
      { id: 'te3', type: 'GOOD', timestampMs: 320000, title: 'Pain identified', description: 'Uncovered key operational pain point', suggestion: undefined },
    ],
  },
  {
    id: 's2',
    type: 'ONLINE_MEETING',
    status: 'COMPLETED',
    framework: 'SPIN',
    totalScore: 68,
    durationSeconds: 540,
    startedAt: new Date(Date.now() - 87_000_000).toISOString(),
    endedAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 87_000_000).toISOString(),
    persona: { id: 'p2', name: 'Marcus Thompson', title: 'CTO', emoji: '🧑‍💼', difficulty: 'HARD' },
    frameworkScores: [
      { id: 'fs5', component: 'Situation Questions', score: 75, feedback: 'Good situational awareness', evidence: [] },
      { id: 'fs6', component: 'Problem Questions', score: 62, feedback: 'Could dig deeper into problems', evidence: [] },
      { id: 'fs7', component: 'Implication Questions', score: 58, feedback: 'Implication questions were surface-level', evidence: [] },
      { id: 'fs8', component: 'Need-Payoff Questions', score: 77, feedback: 'Good need-payoff alignment', evidence: [] },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'A decent SPIN session but implication questions need more depth to create compelling urgency.',
      strengths: ['Good situation framing', 'Strong need-payoff close'],
      improvements: ['Deepen implication questions', 'Spend more time on problem exploration'],
      proTip: 'Chain your implication questions: each answer should naturally lead to the next deeper implication.',
    }),
    timelineEvents: [],
  },
  {
    id: 's3',
    type: 'PHONE_CALL',
    status: 'COMPLETED',
    framework: 'BANT',
    totalScore: 75,
    durationSeconds: 900,
    startedAt: new Date(Date.now() - 2 * 86_400_000 - 600_000).toISOString(),
    endedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 86_400_000 - 600_000).toISOString(),
    persona: { id: 'p3', name: 'Priya Patel', title: 'Head of Engineering', emoji: '👩‍🔬', difficulty: 'MEDIUM' },
    frameworkScores: [
      { id: 'fs9', component: 'Budget', score: 70, feedback: 'Budget discussed but not qualified', evidence: [] },
      { id: 'fs10', component: 'Authority', score: 80, feedback: 'Clearly identified decision maker', evidence: [] },
      { id: 'fs11', component: 'Need', score: 85, feedback: 'Strong need identification', evidence: [] },
      { id: 'fs12', component: 'Timeline', score: 65, feedback: 'Timeline discussion was vague', evidence: [] },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Good BANT qualification with strong need identification. Budget and timeline need more precision.',
      strengths: ['Strong authority identification', 'Clear need articulation'],
      improvements: ['Qualify budget more precisely', 'Establish concrete timeline milestones'],
      proTip: 'When asking about budget, try "What investment range have you allocated for solving this?" instead of a direct budget question.',
    }),
    timelineEvents: [],
  },
];

const MOCK_PERSONAS: Persona[] = [
  { id: 'p1', name: 'Sarah Chen', title: 'VP of Sales', company: 'TechCorp', industry: 'SaaS', emoji: '👩‍💼', difficulty: 'MEDIUM', personality: 'Analytical, data-driven', systemPrompt: '', objections: ['Too expensive', 'Already have a solution'], buyingSignals: ['Asking about ROI', 'Mentioning budget'], frameworks: ['MEDDIC', 'BANT'], isPreset: true },
  { id: 'p2', name: 'Marcus Thompson', title: 'CTO', company: 'FinanceFlow', industry: 'FinTech', emoji: '🧑‍💼', difficulty: 'HARD', personality: 'Technical, skeptical', systemPrompt: '', objections: ['Security concerns', 'Integration complexity'], buyingSignals: ['Technical deep-dive questions'], frameworks: ['SPIN', 'MEDDICC'], isPreset: true },
  { id: 'p3', name: 'Priya Patel', title: 'Head of Engineering', company: 'BuildFast', industry: 'Construction Tech', emoji: '👩‍🔬', difficulty: 'MEDIUM', personality: 'Practical, ROI-focused', systemPrompt: '', objections: ['Implementation time', 'Team adoption'], buyingSignals: ['Asking about timelines'], frameworks: ['BANT', 'CHALLENGER'], isPreset: true },
  { id: 'p4', name: 'Robert Blake', title: 'CFO', company: 'RetailPro', industry: 'Retail', emoji: '👨‍💼', difficulty: 'EXPERT', personality: 'Cost-conscious, risk-averse', systemPrompt: '', objections: ['High cost', 'Not priority', 'Already tried similar'], buyingSignals: ['Asking about payment terms'], frameworks: ['MEDDIC', 'SNAP'], isPreset: true },
  { id: 'p5', name: 'Emma Wilson', title: 'Marketing Director', company: 'GrowthCo', industry: 'Marketing', emoji: '👩‍🎨', difficulty: 'EASY', personality: 'Creative, results-oriented', systemPrompt: '', objections: ['Internal bandwidth', 'Timing'], buyingSignals: ['Campaign ideas', 'Asking about case studies'], frameworks: ['SPIN', 'SNAP'], isPreset: true },
  { id: 'p6', name: 'Carlos Rodriguez', title: 'Operations Manager', company: 'LogiSync', industry: 'Logistics', emoji: '🧑‍🏭', difficulty: 'MEDIUM', personality: 'Process-driven, methodical', systemPrompt: '', objections: ['Process disruption', 'Training required'], buyingSignals: ['Asking about workflow integration'], frameworks: ['BANT', 'CHALLENGER'], isPreset: true },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, user: { id: 'u2', firstName: 'Jordan', lastName: 'Lee', avatarUrl: undefined }, avgScore: 91, sessionCount: 24 },
  { rank: 2, user: { id: 'u3', firstName: 'Taylor', lastName: 'Morgan', avatarUrl: undefined }, avgScore: 87, sessionCount: 18 },
  { rank: 3, user: { id: 'u4', firstName: 'Morgan', lastName: 'Kim', avatarUrl: undefined }, avgScore: 83, sessionCount: 21 },
  { rank: 4, user: { id: 'u1', firstName: 'Alex', lastName: 'Rivera', avatarUrl: undefined }, avgScore: 74, sessionCount: 12 },
  { rank: 5, user: { id: 'u5', firstName: 'Sam', lastName: 'Patel', avatarUrl: undefined }, avgScore: 71, sessionCount: 15 },
  { rank: 6, user: { id: 'u6', firstName: 'Casey', lastName: 'Zhang', avatarUrl: undefined }, avgScore: 68, sessionCount: 9 },
  { rank: 7, user: { id: 'u7', firstName: 'Riley', lastName: 'Johnson', avatarUrl: undefined }, avgScore: 65, sessionCount: 7 },
  { rank: 8, user: { id: 'u8', firstName: 'Drew', lastName: 'Okonkwo', avatarUrl: undefined }, avgScore: 59, sessionCount: 5 },
];

const MOCK_TEAM_USERS: User[] = [
  { id: 'u2', email: 'jordan@demo.com', firstName: 'Jordan', lastName: 'Lee', role: 'AGENT', companyId: 'c1', avgScore: 91, sessionCount: 24 },
  { id: 'u3', email: 'taylor@demo.com', firstName: 'Taylor', lastName: 'Morgan', role: 'AGENT', companyId: 'c1', avgScore: 87, sessionCount: 18 },
  { id: 'u4', email: 'morgan@demo.com', firstName: 'Morgan', lastName: 'Kim', role: 'AGENT', companyId: 'c1', avgScore: 83, sessionCount: 21 },
  { id: 'u5', email: 'sam@demo.com', firstName: 'Sam', lastName: 'Patel', role: 'AGENT', companyId: 'c1', avgScore: 71, sessionCount: 15 },
  MOCK_USER,
];

const MOCK_TEAM_ROLEPLAYS: TeamRoleplay[] = [
  {
    id: 'tr1',
    name: 'Cold Call Blitz',
    description: 'Practice rapid cold calling with a skeptical VP',
    scenarioConfig: {
      industry: 'SaaS',
      roleplayType: 'cold_call',
      personaContext: 'Skeptical VP of Sales',
      displayName: 'Sarah Chen',
      displayTitle: 'VP of Sales',
      displayEmoji: '👩‍💼',
      difficulty: 'MEDIUM',
      suggestedQuestions: [],
    },
    isActive: true,
    createdById: 'u1',
    createdBy: { id: 'u1', firstName: 'Alex', lastName: 'Rivera' },
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  },
];

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, _password: string) => {
    await delay(400);
    const roleMap: Record<string, typeof MOCK_USER> = {
      'agent@demo.com': MOCK_USER,
      'admin@demo.com': { ...MOCK_USER, id: 'u-admin', email: 'admin@demo.com', firstName: 'Dana', lastName: 'Brooks', role: 'COMPANY_ADMIN' },
      'manager@demo.com': { ...MOCK_USER, id: 'u-mgr', email: 'manager@demo.com', firstName: 'Jamie', lastName: 'Scott', role: 'MANAGER' },
      'superadmin@demo.com': { ...MOCK_USER, id: 'u-sa', email: 'superadmin@demo.com', firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN' },
    };
    const user = roleMap[email] ?? MOCK_USER;
    return { user, accessToken: 'mock-token', refreshToken: 'mock-refresh' };
  },
  register: async (data: any) => {
    await delay(400);
    return { user: { ...MOCK_USER, ...data, id: 'u-new' }, accessToken: 'mock-token', refreshToken: 'mock-refresh' };
  },
  logout: async (_refreshToken?: string) => { await delay(100); },
  me: async () => { await delay(100); return MOCK_USER; },
};

// ── Sessions API ──────────────────────────────────────────────────────────────

export const sessionsApi = {
  list: async (_params?: any) => { await delay(300); return { sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length }; },
  create: async (_data: any) => {
    await delay(300);
    return { ...MOCK_SESSIONS[0], id: `s-new-${Date.now()}`, status: 'PENDING' };
  },
  get: async (id: string) => { await delay(200); return MOCK_SESSIONS.find(s => s.id === id) ?? MOCK_SESSIONS[0]; },
  start: async (_id: string) => { await delay(200); return { status: 'IN_PROGRESS' }; },
  end: async (_id: string, _data: any) => { await delay(300); return MOCK_SESSIONS[0]; },
  addMessage: async (_id: string, data: any) => { await delay(100); return { id: `m-${Date.now()}`, ...data }; },
  getAIResponse: async (_id: string, _userMessage: string) => {
    await delay(800);
    return { response: "That's an interesting point. Can you tell me more about your current process and where the bottlenecks are?" };
  },
  share: async (_id: string) => { await delay(200); return { shareUrl: '#' }; },
};

// ── Personas API ──────────────────────────────────────────────────────────────

export const personasApi = {
  list: async () => { await delay(200); return MOCK_PERSONAS; },
  create: async (data: any) => { await delay(300); return { ...data, id: `p-${Date.now()}`, isPreset: false }; },
  delete: async (_id: string) => { await delay(200); },
};

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: async () => { await delay(350); return MOCK_DASHBOARD; },
  leaderboard: async (_period?: string) => { await delay(300); return MOCK_LEADERBOARD; },
};

// ── Users API ─────────────────────────────────────────────────────────────────

export const usersApi = {
  list: async () => { await delay(250); return MOCK_TEAM_USERS; },
  invite: async (data: any) => { await delay(300); return { ...data, id: `u-${Date.now()}` }; },
  update: async (id: string, data: any) => { await delay(200); return { id, ...data }; },
  stats: async (_id: string) => { await delay(200); return { sessionCount: 12, avgScore: 74 }; },
  resetPassword: async (_id: string) => { await delay(200); return { tempPassword: 'TempPass123!' }; },
};

// ── Superadmin API ────────────────────────────────────────────────────────────

const MOCK_COMPANIES: CompanyDetail[] = [
  { id: 'c1', name: 'TechCorp', slug: 'techcorp', defaultFramework: 'MEDDIC' as Framework, passThreshold: 70, isActive: true, industry: 'SaaS', agentCount: 8, adminCount: 2, totalSessions: 127, createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(), admins: [] },
  { id: 'c2', name: 'FinanceFlow', slug: 'financeflow', defaultFramework: 'BANT' as Framework, passThreshold: 75, isActive: true, industry: 'FinTech', agentCount: 12, adminCount: 3, totalSessions: 214, createdAt: new Date(Date.now() - 180 * 86_400_000).toISOString(), admins: [] },
  { id: 'c3', name: 'RetailPro', slug: 'retailpro', defaultFramework: 'SPIN' as Framework, passThreshold: 65, isActive: false, industry: 'Retail', agentCount: 5, adminCount: 1, totalSessions: 43, createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(), admins: [] },
];

export const superadminApi = {
  setup: async (data: any) => { await delay(400); return data; },
  getStats: async () => {
    await delay(300);
    return { totalCompanies: 3, activeCompanies: 2, totalUsers: 25, totalSessions: 384, activeUsersThisMonth: 18 };
  },
  listCompanies: async () => { await delay(300); return MOCK_COMPANIES; },
  createCompany: async (data: any) => { await delay(400); return { ...data, id: `c-${Date.now()}`, isActive: true, agentCount: 0, adminCount: 0, totalSessions: 0, admins: [] }; },
  getCompany: async (id: string) => { await delay(200); return MOCK_COMPANIES.find(c => c.id === id) ?? MOCK_COMPANIES[0]; },
  updateCompany: async (id: string, data: any) => { await delay(300); return { id, ...data }; },
  getCompanyUsers: async (_id: string) => { await delay(200); return MOCK_TEAM_USERS; },
  updateCompanyUser: async (_companyId: string, userId: string, data: any) => { await delay(200); return { id: userId, ...data }; },
};

// ── Voice API ─────────────────────────────────────────────────────────────────

export const voiceApi = {
  getTTSUrl: (_voiceId: string) => '',
};

// ── Practice API ──────────────────────────────────────────────────────────────

export const practiceApi = {
  generateScenario: async (_data: any) => {
    await delay(600);
    return {
      personaContext: 'You are a skeptical VP of Sales at a mid-sized SaaS company.',
      displayName: 'Jennifer Walsh',
      displayTitle: 'VP of Sales',
      displayEmoji: '👩‍💼',
      difficulty: 'MEDIUM',
      suggestedQuestions: [
        "What's your current sales cycle length?",
        "How are you measuring team performance today?",
        "What would success look like in 90 days?",
      ],
      objections: ["We already have a solution", "Not in budget right now"],
    };
  },
  generateQuestions: async (_data: any) => {
    await delay(400);
    return {
      questions: [
        "What's your biggest challenge with your current process?",
        "How does this impact your revenue targets?",
        "Who else is involved in this decision?",
      ],
    };
  },
};

// ── Team Roleplays API ────────────────────────────────────────────────────────

export const teamRoleplaysApi = {
  list: async () => { await delay(200); return MOCK_TEAM_ROLEPLAYS; },
  create: async (data: any) => { await delay(300); return { ...data, id: `tr-${Date.now()}`, isActive: true, createdById: 'u1', createdBy: { id: 'u1', firstName: 'Alex', lastName: 'Rivera' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; },
  update: async (id: string, data: any) => { await delay(200); return { id, ...data }; },
  delete: async (_id: string) => { await delay(200); },
};

// Stub axios instance used by a few pages directly (VoicePicker, FeedbackPage)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _apiStub: any = {
  get: (_url: string, _config?: any) => Promise.resolve({ data: {} as any }),
  post: (_url: string, _data?: any) => Promise.resolve({ data: {} as any }),
  patch: (_url: string, _data?: any) => Promise.resolve({ data: {} as any }),
  delete: (_url: string) => Promise.resolve({ data: {} as any }),
};
export const api: any = _apiStub;
