import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Target, Eye, EyeOff, ArrowRight, Shield, Building2, Users, User, Loader } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import clsx from 'clsx';

const DEMO_PASSWORD = 'Demo1234!';

const DEMO_GROUPS = [
  {
    label: 'Platform',
    accounts: [
      { key: 'superadmin', label: 'Super Admin', email: 'superadmin@demo.com', sub: 'superadmin@demo.com', icon: Shield, color: 'text-purple-400', border: 'border-purple-500/20 hover:border-purple-500/40', bg: 'hover:bg-purple-500/5' },
    ],
  },
  {
    label: 'Acme SaaS',
    accounts: [
      { key: 'admin',   label: 'Admin',   email: 'admin@demo.com',   sub: 'Dana Brooks',   icon: Building2, color: 'text-accent',   border: 'border-accent/20 hover:border-accent/40',     bg: 'hover:bg-accent/5' },
      { key: 'manager', label: 'Manager', email: 'manager@demo.com', sub: 'Jamie Scott',   icon: Users,     color: 'text-accent-3', border: 'border-accent-3/20 hover:border-accent-3/40', bg: 'hover:bg-accent-3/5' },
      { key: 'rep',     label: 'Rep',     email: 'rep@demo.com',     sub: 'Alex Rivera',   icon: User,      color: 'text-white/75', border: 'border-white/10 hover:border-white/20',       bg: 'hover:bg-white/[0.04]' },
      { key: 'jordan',  label: 'Rep',     email: 'jordan@demo.com',  sub: 'Jordan Lee',    icon: User,      color: 'text-white/75', border: 'border-white/10 hover:border-white/20',       bg: 'hover:bg-white/[0.04]' },
      { key: 'taylor',  label: 'Rep',     email: 'taylor@demo.com',  sub: 'Taylor Morgan', icon: User,      color: 'text-white/75', border: 'border-white/10 hover:border-white/20',       bg: 'hover:bg-white/[0.04]' },
    ],
  },
  {
    label: 'FinBridge',
    accounts: [
      { key: 'financeadmin', label: 'Admin', email: 'financeadmin@demo.com', sub: 'Lisa Park', icon: Building2, color: 'text-accent', border: 'border-accent/20 hover:border-accent/40', bg: 'hover:bg-accent/5' },
    ],
  },
] as const;

type DemoAccount = typeof DEMO_GROUPS[number]['accounts'][number];

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const loginWith = async (email: string, key?: string) => {
    if (key) setActiveDemo(key);
    setLoading(true);
    try {
      const data = await authApi.login(email, DEMO_PASSWORD);
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Welcome, ${data.user.firstName}!`);
      navigate(data.user.role === 'SUPER_ADMIN' ? '/superadmin/companies' : '/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
      setActiveDemo(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWith(form.email);
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent-2/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center">
            <Target size={20} className="text-white" />
          </div>
          <span className="font-display text-2xl font-extrabold tracking-tight">
            Pitch<span className="text-accent">IQ</span>
          </span>
        </div>

        <div className="card p-8">
          <h2 className="font-display text-xl font-bold mb-1">Welcome back</h2>
          <p className="text-sm text-white/65 mb-6">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-white/70 block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setActiveDemo(null); }}
                placeholder="you@company.com"
                className="input-base"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-white/70 block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/55 hover:text-white/75"
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 mt-1"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.07]">
            <p className="text-[11px] text-white/55 text-center mb-3">
              Demo accounts — click to sign in instantly
            </p>
            <div className="flex flex-col gap-3">
              {DEMO_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 mb-1.5 px-0.5">{group.label}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(group.accounts as readonly DemoAccount[]).map(account => {
                      const Icon = account.icon;
                      const busy = activeDemo === account.key && loading;
                      return (
                        <button
                          key={account.key}
                          type="button"
                          disabled={loading}
                          onClick={() => loginWith(account.email, account.key)}
                          className={clsx(
                            'flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all text-left disabled:opacity-50',
                            account.border, account.bg,
                            activeDemo === account.key && 'ring-1 ring-white/20'
                          )}
                        >
                          {busy
                            ? <Loader size={12} className="flex-shrink-0 animate-spin text-white/50" />
                            : <Icon size={12} className={clsx('flex-shrink-0', account.color)} />
                          }
                          <div className="min-w-0">
                            <div className={clsx('text-[11px] font-semibold truncate', account.color)}>{account.label}</div>
                            <div className="text-[10px] text-white/45 truncate">{account.sub}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-white/55 mt-4">
          No account?{' '}
          <Link to="/register" className="text-accent hover:underline">Start free trial</Link>
        </p>
      </motion.div>
    </div>
  );
}
