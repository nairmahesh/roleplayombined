import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, useThemeStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { authApi } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AvatarPhotoProvider } from '@/components/practice/PersonaAvatars';
import type { UserRole } from '@/types';

const LoginPage         = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage      = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const DashboardPage     = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PracticePage      = lazy(() => import('@/pages/PracticePage').then(m => ({ default: m.PracticePage })));
const SessionsPage      = lazy(() => import('@/pages/SessionsPage').then(m => ({ default: m.SessionsPage })));
const FeedbackPage      = lazy(() => import('@/pages/FeedbackPage').then(m => ({ default: m.FeedbackPage })));
const LeaderboardPage   = lazy(() => import('@/pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })));
const TeamPage          = lazy(() => import('@/pages/TeamPage').then(m => ({ default: m.TeamPage })));
const SettingsPage          = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const EvaluationPromptsPage = lazy(() => import('@/pages/EvaluationPromptsPage').then(m => ({ default: m.EvaluationPromptsPage })));
const CompaniesPage     = lazy(() => import('@/pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const CompanyDetailPage = lazy(() => import('@/pages/CompanyDetailPage').then(m => ({ default: m.CompanyDetailPage })));
const SuperAdminStatsPage = lazy(() => import('@/pages/SuperAdminStatsPage').then(m => ({ default: m.SuperAdminStatsPage })));
const PlanSettingsPage      = lazy(() => import('@/pages/PlanSettingsPage').then(m => ({ default: m.PlanSettingsPage })));
const SuperAdminAgentsPage  = lazy(() => import('@/pages/SuperAdminAgentsPage').then(m => ({ default: m.SuperAdminAgentsPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role as UserRole)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** SUPER_ADMIN lands on /superadmin/companies; everyone else on /dashboard */
function DefaultRedirect() {
  const user = useAuthStore(s => s.user);
  if (user?.role === 'SUPER_ADMIN') return <Navigate to="/superadmin/companies" replace />;
  return <Navigate to="/dashboard" replace />;
}

function ThemeInit() {
  const theme = useThemeStore(s => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  return null;
}

export default function App() {
  const theme = useThemeStore(s => s.theme);
  const isLight = theme === 'light';
  const { setAuth, clearAuth } = useAuthStore();

  // Restore Supabase session on mount and listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        authApi.me().then(user => {
          setAuth(user, session.access_token, session.refresh_token);
        }).catch(() => clearAuth());
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        clearAuth();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        useAuthStore.getState().updateToken(session.access_token, session.refresh_token);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <AvatarPhotoProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ThemeInit />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: isLight ? '#FFFFFF' : '#1F2330',
              color: isLight ? '#0D0E14' : '#F0F2FF',
              border: isLight ? '1px solid rgba(0,0,0,0.10)' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              fontSize: '13px',
            },
          }}
        />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<RequireGuest><LoginPage /></RequireGuest>} />
            <Route path="/register" element={<RequireGuest><RegisterPage /></RequireGuest>} />

            {/* App shell */}
            <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<DefaultRedirect />} />

              {/* ── Regular user routes ──────────────────────────────────── */}
              <Route path="dashboard"             element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="practice"              element={<ErrorBoundary><PracticePage /></ErrorBoundary>} />
              <Route path="sessions"              element={<ErrorBoundary><SessionsPage /></ErrorBoundary>} />
              <Route path="sessions/:id/feedback" element={<ErrorBoundary><FeedbackPage /></ErrorBoundary>} />
              <Route path="leaderboard"           element={<ErrorBoundary><LeaderboardPage /></ErrorBoundary>} />

              {/* ── Team & Settings (admin) ──────────────────────────────── */}
              <Route
                path="team"
                element={
                  <RequireRole roles={['COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN']}>
                    <ErrorBoundary><TeamPage /></ErrorBoundary>
                  </RequireRole>
                }
              />
              <Route
                path="settings"
                element={
                  <RequireRole roles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                    <ErrorBoundary><SettingsPage /></ErrorBoundary>
                  </RequireRole>
                }
              />
              <Route
                path="settings/plan"
                element={
                  <RequireRole roles={['COMPANY_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'AGENT']}>
                    <ErrorBoundary><PlanSettingsPage /></ErrorBoundary>
                  </RequireRole>
                }
              />
              <Route
                path="settings/evaluation-prompts"
                element={
                  <RequireRole roles={['COMPANY_ADMIN', 'SUPER_ADMIN']}>
                    <ErrorBoundary><EvaluationPromptsPage /></ErrorBoundary>
                  </RequireRole>
                }
              />

              {/* ── Super Admin routes ───────────────────────────────────── */}
              <Route
                path="superadmin/companies"
                element={
                  <RequireRole roles={['SUPER_ADMIN']}>
                    <ErrorBoundary><CompaniesPage /></ErrorBoundary>
                  </RequireRole>
                }
              />
              <Route
                path="superadmin/companies/:id"
                element={
                  <RequireRole roles={['SUPER_ADMIN']}>
                    <ErrorBoundary><CompanyDetailPage /></ErrorBoundary>
                  </RequireRole>
                }
              />
              <Route
                path="superadmin/stats"
                element={
                  <RequireRole roles={['SUPER_ADMIN']}>
                    <ErrorBoundary><SuperAdminStatsPage /></ErrorBoundary>
                  </RequireRole>
                }
              />
              <Route
                path="superadmin/agents"
                element={
                  <RequireRole roles={['SUPER_ADMIN']}>
                    <ErrorBoundary><SuperAdminAgentsPage /></ErrorBoundary>
                  </RequireRole>
                }
              />
            </Route>

            <Route path="*" element={<DefaultRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </AvatarPhotoProvider>
    </ErrorBoundary>
  );
}
