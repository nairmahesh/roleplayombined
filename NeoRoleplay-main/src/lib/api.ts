// pitchiq/frontend/src/lib/api.ts

import axios from 'axios';
import { useAuthStore } from './store';
import { resetSocket } from './socket';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach JWT to every request
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 → refresh token → retry
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
  failedQueue = [];
}

api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
        .then(token => { original.headers.Authorization = `Bearer ${token}`; return api(original); });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { refreshToken } = useAuthStore.getState();
      if (!refreshToken) throw new Error('No refresh token');
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      useAuthStore.getState().updateToken(data.accessToken, data.refreshToken);
      processQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (err) {
      processQueue(err, null);
      resetSocket();
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

// ── API helpers ───────────────────────────────────────────────────────────────

export const authApi = {
  login:   (email: string, password: string) => api.post('/auth/login', { email, password }).then(r => r.data),
  register:(data: any) => api.post('/auth/register', data).then(r => r.data),
  logout:  (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me:      () => api.get('/auth/me').then(r => r.data),
};

export const sessionsApi = {
  list:          (params?: any)        => api.get('/sessions', { params }).then(r => r.data),
  create:        (data: any)           => api.post('/sessions', data).then(r => r.data),
  get:           (id: string)          => api.get(`/sessions/${id}`).then(r => r.data),
  start:         (id: string)          => api.post(`/sessions/${id}/start`).then(r => r.data),
  end:           (id: string, data: any) => api.post(`/sessions/${id}/end`, data).then(r => r.data),
  addMessage:    (id: string, data: any) => api.post(`/sessions/${id}/messages`, data).then(r => r.data),
  // Calls the backend AI proxy — API key never touches the browser
  getAIResponse: (id: string, userMessage: string) =>
    api.post(`/sessions/${id}/respond`, { userMessage }).then(r => r.data),
  share:         (id: string)          => api.post(`/sessions/${id}/share`).then(r => r.data),
};

export const personasApi = {
  list:   ()           => api.get('/personas').then(r => r.data),
  create: (data: any)  => api.post('/personas', data).then(r => r.data),
  delete: (id: string) => api.delete(`/personas/${id}`),
};

export const analyticsApi = {
  dashboard:   () =>            api.get('/analytics/dashboard').then(r => r.data),
  leaderboard: (period?: string) => api.get('/analytics/leaderboard', { params: { period } }).then(r => r.data),
};

export const usersApi = {
  list:          ()                      => api.get('/users').then(r => r.data),
  invite:        (data: any)             => api.post('/users/invite', data).then(r => r.data),
  update:        (id: string, data: any) => api.patch(`/users/${id}`, data).then(r => r.data),
  stats:         (id: string)            => api.get(`/users/${id}/stats`).then(r => r.data),
  resetPassword: (id: string)            => api.post(`/users/${id}/reset-password`).then(r => r.data),
};

export const superadminApi = {
  setup:         (data: any)             => api.post('/superadmin/setup', data).then(r => r.data),
  getStats:      ()                      => api.get('/superadmin/stats').then(r => r.data),
  listCompanies: ()                      => api.get('/superadmin/companies').then(r => r.data),
  createCompany: (data: any)             => api.post('/superadmin/companies', data).then(r => r.data),
  getCompany:    (id: string)            => api.get(`/superadmin/companies/${id}`).then(r => r.data),
  updateCompany: (id: string, data: any) => api.patch(`/superadmin/companies/${id}`, data).then(r => r.data),
  getCompanyUsers: (id: string)          => api.get(`/superadmin/companies/${id}/users`).then(r => r.data),
  updateCompanyUser: (companyId: string, userId: string, data: any) =>
    api.patch(`/superadmin/companies/${companyId}/users/${userId}`, data).then(r => r.data),
};

export const voiceApi = {
  getTTSUrl: (voiceId: string) => `${BASE_URL}/voice/${voiceId}/tts`,
};

export const practiceApi = {
  generateScenario: (data: { keywords: string; industry: string; roleplayType: string }) =>
    api.post('/practice/generate-scenario', data).then(r => r.data),
  generateQuestions: (data: { personaContext: string; roleplayType: string }) =>
    api.post('/practice/generate-questions', data).then(r => r.data),
};

export const teamRoleplaysApi = {
  list:   ()                      => api.get('/team-roleplays').then(r => r.data),
  create: (data: { name: string; description?: string; scenarioConfig: any }) =>
    api.post('/team-roleplays', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/team-roleplays/${id}`, data).then(r => r.data),
  delete: (id: string)            => api.delete(`/team-roleplays/${id}`),
};
