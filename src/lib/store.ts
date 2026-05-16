// pitchiq/frontend/src/lib/store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

const DEMO_USER: User = {
  id: 'u1',
  email: 'agent@demo.com',
  firstName: 'Alex',
  lastName: 'Rivera',
  role: 'AGENT',
  companyId: 'c1',
  avgScore: 74,
  sessionCount: 12,
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateToken: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: DEMO_USER,
      accessToken: 'mock-token',
      refreshToken: 'mock-refresh',
      isAuthenticated: true,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      clearAuth: () =>
        set({ user: DEMO_USER, accessToken: 'mock-token', refreshToken: 'mock-refresh', isAuthenticated: true }),
      updateToken: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),
    }),
    {
      name: 'pitchiq-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ─── Session UI State ─────────────────────────────────────────────────────────
interface SessionState {
  activeSessionId: string | null;
  isCallActive: boolean;
  callDurationMs: number;
  setActiveSession: (id: string | null) => void;
  setCallActive: (active: boolean) => void;
  setCallDuration: (ms: number) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSessionId: null,
  isCallActive: false,
  callDurationMs: 0,
  setActiveSession: (id) => set({ activeSessionId: id }),
  setCallActive: (active) => set({ isCallActive: active }),
  setCallDuration: (ms) => set({ callDurationMs: ms }),
}));
