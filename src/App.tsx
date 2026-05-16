import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
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
const SettingsPage      = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const CompaniesPage     = lazy(() => import('@/pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const CompanyDetailPage = lazy(() => import('@/pages/CompanyDetailPage').then(m => ({ default: m.CompanyDetailPage })));
const SuperAdminStatsPage = lazy(() => import('@/pages/SuperAdminStatsPage').then(m => ({ default: m.SuperAdminStatsPage })));

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

export default function App() {
  return (
    <ErrorBoundary>
      <AvatarPhotoProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1F2330',
              color: '#F0F2FF',
              border: '1px solid rgba(255,255,255,0.12)',
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
            </Route>

            <Route path="*" element={<DefaultRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </AvatarPhotoProvider>
    </ErrorBoundary>
  );
}
