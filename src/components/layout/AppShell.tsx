import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { resetSocket } from '@/lib/socket';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, Play, ClipboardList, BarChart3,
  Trophy, Users, Settings, LogOut, Target,
  Building2, Globe, Menu, X,
} from 'lucide-react';
import clsx from 'clsx';

type NavItem = {
  label: string;
  to: string;
  icon: React.ElementType;
  section: string;
  badge?: string;
  roles?: string[];
};

const NAV_ITEMS: NavItem[] = [
  // ── Platform (Super Admin only) ───────────────────────────────────────────
  { label: 'Companies',   to: '/superadmin/companies', icon: Building2,      section: 'Platform', roles: ['SUPER_ADMIN'] },
  { label: 'Platform',    to: '/superadmin/stats',     icon: Globe,          section: 'Platform', roles: ['SUPER_ADMIN'] },

  // ── Overview (all non-super-admin) ────────────────────────────────────────
  { label: 'Dashboard',   to: '/dashboard',  icon: LayoutDashboard, section: 'Overview', roles: ['COMPANY_ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Practice',    to: '/practice',   icon: Play,            section: 'Overview', badge: 'New', roles: ['COMPANY_ADMIN', 'MANAGER', 'AGENT'] },
  { label: 'Sessions',    to: '/sessions',   icon: ClipboardList,   section: 'Overview', roles: ['COMPANY_ADMIN', 'MANAGER', 'AGENT'] },

  // ── Coaching ──────────────────────────────────────────────────────────────
  { label: 'Leaderboard', to: '/leaderboard',icon: Trophy,          section: 'Coaching', roles: ['COMPANY_ADMIN', 'MANAGER', 'AGENT'] },

  // ── Admin ─────────────────────────────────────────────────────────────────
  { label: 'Team',        to: '/team',       icon: Users,           section: 'Admin', roles: ['COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN'] },
  { label: 'Settings',    to: '/settings',   icon: Settings,        section: 'Admin', roles: ['COMPANY_ADMIN', 'SUPER_ADMIN'] },
];

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { user, clearAuth, refreshToken } = useAuthStore(s => ({
    user: s.user,
    clearAuth: s.clearAuth,
    refreshToken: s.refreshToken,
  }));
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } finally {
      resetSocket();
      clearAuth();
      navigate('/login');
      toast.success('Logged out');
    }
  };

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'U';

  const visibleNav = NAV_ITEMS.filter(item =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  const sections = [...new Set(visibleNav.map(n => n.section))];

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* ─── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ─── Sidebar ────────────────────────────────────────────────────────── */}
      <nav className={clsx(
        "fixed md:static inset-y-0 left-0 z-30 w-[240px] min-w-[240px] bg-bg-2 border-r border-white/[0.07] flex flex-col transition-transform duration-300 md:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center">
              <Target size={16} className="text-white" />
            </div>
            <span className="font-display text-[18px] font-extrabold tracking-tight">
              Pitch<span className="text-accent">IQ</span>
            </span>
            {isSuperAdmin && (
              <span className="text-[9px] font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/25 ml-auto">
                SUPER
              </span>
            )}
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto md:hidden p-1 rounded-[8px] hover:bg-white/[0.05] text-white/40 hover:text-white"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 py-4 overflow-y-auto">
          {sections.map(section => {
            const items = visibleNav.filter(n => n.section === section);
            return (
              <div key={section} className="mb-2">
                <div className="px-5 py-2 text-[10px] font-semibold tracking-[1.5px] text-white/30 uppercase">
                  {section}
                </div>
                {items.map(item => (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      clsx('nav-item', isActive && 'nav-item-active font-medium')
                    }
                  >
                    <item.icon size={15} className="opacity-75 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-white">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </div>

        {/* User footer */}
        <div className="p-4 border-t border-white/[0.07]">
          <div className="flex items-center gap-2.5 p-2.5 rounded-[10px] bg-white/[0.03] border border-white/[0.06] cursor-pointer hover:bg-white/[0.06] transition-colors group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium truncate">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-[10.5px] text-white/30 capitalize">
                {user?.role?.replace(/_/g, ' ').toLowerCase()}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Log out"
            >
              <LogOut size={13} className="text-white/65 hover:text-white/70" />
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 md:px-7 py-4 border-b border-white/[0.07] bg-bg flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-[9px] hover:bg-white/[0.05] text-white/60 hover:text-white mr-1"
            >
              <Menu size={18} />
            </button>
            <PageTitle path={location.pathname} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function PageTitle({ path }: { path: string }) {
  const titles: Record<string, [string, string]> = {
    '/dashboard':               ['Dashboard',         'Welcome back'],
    '/practice':                ['Practice',          'Choose a scenario to begin'],
    '/sessions':                ['My Sessions',       'Your roleplay history'],
    '/leaderboard':             ['Leaderboard',       'Company rankings'],
    '/team':                    ['Team',              'Manage your agents'],
    '/settings':                ['Settings',          'Platform configuration'],
    '/superadmin/companies':    ['Companies',         'Platform-wide company management'],
    '/superadmin/stats':        ['Platform Overview', 'System-wide statistics'],
  };
  const key = Object.keys(titles).find(k => path.startsWith(k)) || '/dashboard';
  const [title, sub] = titles[key] || ['PitchIQ', ''];
  return (
    <>
      <h1 className="font-display text-[20px] font-bold tracking-tight leading-none">{title}</h1>
      <p className="text-[13px] text-white/35 mt-0.5">{sub}</p>
    </>
  );
}
