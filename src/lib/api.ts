import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from './store';
import type {
  DashboardStats,
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

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
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

  end: async (id: string, payload?: { durationSeconds?: number; skipAnalysis?: boolean; transcript?: unknown; convaiConversationId?: string }) => {
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

// ── Personas API ──────────────────────────────────────────────────────────────

export const personasApi = {
  list: async () => {
    const { data } = await http.get('/personas');
    return data as Persona[];
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

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: async (): Promise<DashboardStats> => {
    const { data } = await http.get('/analytics/dashboard');
    return data as DashboardStats;
  },

  leaderboard: async (period?: string): Promise<LeaderboardEntry[]> => {
    const { data } = await http.get('/analytics/leaderboard', { params: period ? { period } : undefined });
    return data as LeaderboardEntry[];
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

  getCompanyPersonas: async (companyId: string) => {
    const { data } = await http.get(`/superadmin/companies/${companyId}/personas`);
    return data as Persona[];
  },

  updateCompanyPersona: async (companyId: string, personaId: string, payload: Partial<Persona>) => {
    const { data } = await http.patch(`/superadmin/companies/${companyId}/personas/${personaId}`, payload);
    return data as Persona;
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
      personaType: string;
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
