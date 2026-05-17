import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, PlanTier, PLAN_CONFIGS, PlanFeatures } from '@/types';

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

// ElevenLabs is TTS-only via the backend. No keys or IDs are stored in the frontend.

// ─── Plan / Feature Store ─────────────────────────────────────────────────────
interface PlanState {
  plan: PlanTier;
  moduleOverrides: Partial<Record<keyof PlanFeatures, boolean>>;
  setPlan: (plan: PlanTier) => void;
  setModuleOverride: (key: keyof PlanFeatures, value: boolean) => void;
  getFeatures: () => PlanFeatures;
  can: (feature: keyof PlanFeatures) => boolean;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      plan: 'pro' as PlanTier,
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
