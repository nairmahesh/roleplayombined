// pitchiq/frontend/src/lib/store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, PlanTier, PLAN_CONFIGS, PlanFeatures } from '@/types';

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

// ─── Theme State ──────────────────────────────────────────────────────────────
interface ThemeState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('light', theme === 'light');
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        get().setTheme(next);
      },
    }),
    {
      name: 'pitchiq-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.classList.toggle('light', state.theme === 'light');
          document.documentElement.classList.toggle('dark', state.theme === 'dark');
        }
      },
    }
  )
);

// ─── ElevenLabs Config ────────────────────────────────────────────────────────
interface ElevenLabsConfigState {
  agentId: string;
  apiKey: string;
  setAgentId: (id: string) => void;
  setApiKey: (key: string) => void;
}

export const useElevenLabsStore = create<ElevenLabsConfigState>()(
  persist(
    (set) => ({
      agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID || '',
      apiKey:  import.meta.env.VITE_ELEVENLABS_API_KEY  || '',
      setAgentId: (agentId) => set({ agentId }),
      setApiKey:  (apiKey)  => set({ apiKey }),
    }),
    { name: 'pitchiq-elevenlabs' }
  )
);

// ─── Plan / Feature Store ─────────────────────────────────────────────────────
interface PlanState {
  plan: PlanTier;
  // per-module overrides (admin can toggle modules on/off)
  moduleOverrides: Partial<Record<keyof PlanFeatures, boolean>>;
  setPlan: (plan: PlanTier) => void;
  setModuleOverride: (key: keyof PlanFeatures, value: boolean) => void;
  getFeatures: () => PlanFeatures;
  can: (feature: keyof PlanFeatures) => boolean;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plan: 'pro' as PlanTier, // demo defaults to pro so all features visible
      moduleOverrides: {},
      setPlan: (plan) => set({ plan }),
      setModuleOverride: (key, value) =>
        set(s => ({ moduleOverrides: { ...s.moduleOverrides, [key]: value } })),
      getFeatures: () => {
        const base = PLAN_CONFIGS[get().plan].features;
        const overrides = get().moduleOverrides;
        return { ...base, ...overrides } as PlanFeatures;
      },
      can: (feature) => {
        const overrides = get().moduleOverrides;
        if (feature in overrides) return Boolean(overrides[feature]);
        return Boolean(PLAN_CONFIGS[get().plan].features[feature]);
      },
    }),
    { name: 'pitchiq-plan' }
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
