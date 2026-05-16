// pitchiq/frontend/src/lib/store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

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
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
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
