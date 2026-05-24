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

// Attach Authorization header on every request
http.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Handle 401 — attempt token refresh, then retry once
let refreshing: Promise<void> | null = null;

http.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = (async () => {
          const { refreshToken, updateToken, clearAuth } = useAuthStore.getState();
          if (!refreshToken) { clearAuth(); return; }
          try {
            const res = await axios.post<{ accessToken: string; refreshToken: string }>(
              '/api/auth/refresh',
              { refreshToken }
            );
            updateToken(res.data.accessToken, res.data.refreshToken);
          } catch {
            clearAuth();
          }
        })().finally(() => { refreshing = null; });
      }
      await refreshing;
      original.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
      return http(original);
    }
    return Promise.reject(err);
  }
);

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await http.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { email, password }
    );
    return data;
  },
  register: async (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    companySlug?: string;
  }) => {
    const { data } = await http.post<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/register',
      payload
    );
    return data;
  },
  logout: async (refreshToken?: string) => {
    await http.post('/auth/logout', { refreshToken });
  },
  me: async (): Promise<User> => {
    const { data } = await http.get<User>('/auth/me');
    return data;
  },
};

// ── Sessions API ──────────────────────────────────────────────────────────────

export const sessionsApi = {
  list: async (params?: Record<string, unknown>) => {
    const { data } = await http.get<{ sessions: Session[]; total: number }>('/sessions', { params });
    return data;
  },
  listAll: async (params?: Record<string, unknown>) => {
    const { data } = await http.get<{ sessions: Session[]; total: number }>('/sessions', { params });
    return data;
  },
  getPeerScores: async (sessionId: string) => {
    const { data } = await http.get<{ userId: string; name: string; score: number; rank: number }[]>(
      `/sessions/${sessionId}/peer-scores`
    );
    return data;
  },
  create: async (payload: { type: string; framework: string; personaId?: string; scenarioConfig?: unknown }) => {
    const { data } = await http.post<Session>('/sessions', payload);
    return data;
  },
  get: async (id: string) => {
    const { data } = await http.get<Session>(`/sessions/${id}`);
    return data;
  },
  start: async (id: string) => {
    const { data } = await http.patch<{ status: string }>(`/sessions/${id}/start`);
    return data;
  },
  end: async (id: string, payload?: unknown) => {
    const { data } = await http.patch<Session>(`/sessions/${id}/end`, payload);
    return data;
  },
  addMessage: async (
    id: string,
    payload: { role: 'user' | 'assistant'; content: string; timestampMs: number; audioUrl?: string }
  ) => {
    const { data } = await http.post(`/sessions/${id}/messages`, payload);
    return data;
  },
  getAIResponse: async (id: string, _userMessage: string) => {
    const { data } = await http.post<{ response: string }>(`/sessions/${id}/ai-response`);
    return data;
  },
  share: async (id: string) => {
    const { data } = await http.post<{ shareUrl: string }>(`/sessions/${id}/share`);
    return data;
  },
  getPlaybackUrl: async (sessionId: string): Promise<string | null> => {
    try {
      const { data } = await http.get<{ url: string }>(`/recordings/playback/${sessionId}`);
      return data.url;
    } catch {
      return null;
    }
  },
};

// ── Personas API ──────────────────────────────────────────────────────────────

export const personasApi = {
  list: async (): Promise<Persona[]> => {
    const { data } = await http.get<Persona[]>('/personas');
    return data;
  },
  create: async (payload: Partial<Persona>): Promise<Persona> => {
    const { data } = await http.post<Persona>('/personas', payload);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await http.delete(`/personas/${id}`);
  },
};

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: async (): Promise<DashboardStats> => {
    const { data } = await http.get<DashboardStats>('/analytics/dashboard');
    return data;
  },
  leaderboard: async (_period?: string): Promise<LeaderboardEntry[]> => {
    const { data } = await http.get<LeaderboardEntry[]>('/analytics/leaderboard');
    return data;
  },
};

// ── Users API ─────────────────────────────────────────────────────────────────

export const usersApi = {
  list: async (): Promise<User[]> => {
    const { data } = await http.get<User[]>('/users');
    return data;
  },
  invite: async (payload: Partial<User> & { password?: string }) => {
    const { data } = await http.post<{ user: User; tempPassword: string }>('/users/invite', payload);
    return data;
  },
  update: async (id: string, payload: Partial<User>) => {
    const { data } = await http.patch<User>(`/users/${id}`, payload);
    return data;
  },
  stats: async (id: string) => {
    const { data } = await http.get<{ sessionCount: number; avgScore: number }>(`/users/${id}/stats`);
    return data;
  },
  resetPassword: async (id: string) => {
    const { data } = await http.post<{ tempPassword: string }>(`/users/${id}/reset-password`);
    return data;
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
    return data;
  },
  listCompanies: async (): Promise<CompanyDetail[]> => {
    const { data } = await http.get<CompanyDetail[]>('/superadmin/companies');
    return data;
  },
  createCompany: async (payload: Partial<CompanyDetail> & { adminEmail?: string; adminFirstName?: string; adminLastName?: string }) => {
    const { data } = await http.post<CompanyDetail & { tempPassword?: string; adminEmail?: string }>('/superadmin/companies', payload);
    return data;
  },
  getCompany: async (id: string): Promise<CompanyDetail> => {
    const { data } = await http.get<CompanyDetail>(`/superadmin/companies/${id}`);
    return data;
  },
  updateCompany: async (id: string, payload: Partial<CompanyDetail>) => {
    const { data } = await http.patch<CompanyDetail>(`/superadmin/companies/${id}`, payload);
    return data;
  },
  getCompanyUsers: async (id: string): Promise<User[]> => {
    const { data } = await http.get<User[]>(`/superadmin/companies/${id}/users`);
    return data;
  },
  updateCompanyUser: async (companyId: string, userId: string, payload: Partial<User>) => {
    const { data } = await http.patch(`/superadmin/companies/${companyId}/users/${userId}`, payload);
    return data;
  },
  syncPersonaAgents: async (): Promise<{ synced: number; results: { name: string; agentId: string | null; status: string }[] }> => {
    const { data } = await http.post('/superadmin/sync-persona-agents');
    return data;
  },
};

// ── Voice API ─────────────────────────────────────────────────────────────────

export interface AgentConfig {
  name?: string;
  conversation_config?: {
    agent?: {
      prompt?: {
        prompt?: string;
        llm?: string;
        temperature?: number;
      };
      first_message?: string;
      language?: string;
    };
    tts?: {
      voice_id?: string;
      model_id?: string;
    };
  };
}

export interface AgentSummary {
  agent_id: string;
  name: string;
  created_at_unix_secs?: number;
}

export const voiceApi = {
  // Returns a signed ElevenLabs WebSocket URL from the backend (API key stays server-side).
  // Optionally pass personaId to use that persona's dedicated agent.
  getSignedUrl: async (personaId?: string): Promise<string> => {
    const { data } = await http.get<{ signedUrl: string }>('/voice/signed-url', {
      params: personaId ? { personaId } : undefined,
    });
    return data.signedUrl;
  },
  // Returns the backend TTS endpoint path — caller POSTs { text } with Bearer token
  getTTSUrl: (voiceId: string) => `/api/voice/tts/${voiceId}`,
  listVoices: async () => {
    const { data } = await http.get<{ voice_id: string; name: string }[]>('/voice/voices');
    return data;
  },
  health: async (): Promise<{ ttsAvailable: boolean; convaiAvailable: boolean; agentConfigured: boolean; issues: string[] }> => {
    const { data } = await http.get('/voice/health');
    return data;
  },
  listAgents: async (): Promise<AgentSummary[]> => {
    const { data } = await http.get<AgentSummary[]>('/voice/agents');
    return data;
  },
  getAgent: async (agentId: string): Promise<unknown> => {
    const { data } = await http.get(`/voice/agents/${agentId}`);
    return data;
  },
  createAgent: async (payload: AgentConfig): Promise<{ agent_id: string }> => {
    const { data } = await http.post<{ agent_id: string }>('/voice/agents', payload);
    return data;
  },
  updateAgent: async (agentId: string, payload: AgentConfig): Promise<unknown> => {
    const { data } = await http.patch(`/voice/agents/${agentId}`, payload);
    return data;
  },
  deleteAgent: async (agentId: string): Promise<void> => {
    await http.delete(`/voice/agents/${agentId}`);
  },
};

// ── Practice API ──────────────────────────────────────────────────────────────

export const practiceApi = {
  generateScenario: async (payload: { industry?: string; roleplayType: string; difficulty?: string; keywords?: string }) => {
    const { data } = await http.post('/practice/generate-scenario', payload);
    return data;
  },
  generateQuestions: async (payload: { industry?: string; roleplayType: string; framework?: string; personaContext?: string }) => {
    const { data } = await http.post('/practice/generate-questions', payload);
    return data;
  },
};

// ── Team Roleplays API ────────────────────────────────────────────────────────

export const teamRoleplaysApi = {
  list: async (): Promise<TeamRoleplay[]> => {
    const { data } = await http.get<TeamRoleplay[]>('/team-roleplays');
    return data;
  },
  create: async (payload: Partial<TeamRoleplay>): Promise<TeamRoleplay> => {
    const { data } = await http.post<TeamRoleplay>('/team-roleplays', payload);
    return data;
  },
  update: async (id: string, payload: Partial<TeamRoleplay>): Promise<TeamRoleplay> => {
    const { data } = await http.patch<TeamRoleplay>(`/team-roleplays/${id}`, payload);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await http.delete(`/team-roleplays/${id}`);
  },
  getTargetOptions: async () => {
    const { data } = await http.get('/team-roleplays/target-options');
    return data;
  },
};

// ── Evaluation Prompts API ────────────────────────────────────────────────────

export const evaluationPromptsApi = {
  list: async (): Promise<EvaluationPrompt[]> => {
    const { data } = await http.get<EvaluationPrompt[]>('/evaluation-prompts');
    return data;
  },
  get: async (roleplayType: string): Promise<EvaluationPrompt | null> => {
    try {
      const { data } = await http.get<EvaluationPrompt>(`/evaluation-prompts/${roleplayType}`);
      return data;
    } catch {
      return null;
    }
  },
  update: async (id: string, payload: Partial<EvaluationPrompt>): Promise<EvaluationPrompt> => {
    const { data } = await http.patch<EvaluationPrompt>(`/evaluation-prompts/${id}`, payload);
    return data;
  },
};

// ── Peer Sessions API ─────────────────────────────────────────────────────────

export const peerSessionsApi = {
  list: async (_sessionId: string): Promise<PeerSession[]> => {
    const { data } = await http.get<PeerSession[]>('/peer-sessions');
    return data;
  },
};

// ── Usage / Cost API ──────────────────────────────────────────────────────────

export interface UsageSummary {
  period: { days: number; since: string };
  totals: {
    totalCostUsd: number;
    geminiPromptTokens: number;
    geminiOutputTokens: number;
    ttsCharacters: number;
    convaiMinutes: number;
    callCount: number;
    requestCount: number;
  };
  byService: { _id: string; costUsd: number; requestCount: number }[];
  dailyTrend: { _id: string; costUsd: number }[];
  recent: {
    service: string;
    operation: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    characters?: number;
    durationSeconds?: number;
    estimatedCostUsd: number;
    createdAt: string;
  }[];
  pricing: {
    geminiInputPerMToken: number;
    geminiOutputPerMToken: number;
    ttsPerKChars: number;
    convaiPerMinute: number;
  };
}

export const usageApi = {
  getSummary: async (days = 30, companyId?: string): Promise<UsageSummary> => {
    const { data } = await http.get<UsageSummary>('/usage', {
      params: { days, ...(companyId ? { companyId } : {}) },
    });
    return data;
  },
};

// Kept for any legacy direct usage — proxies to the axios instance
export const api = http;
