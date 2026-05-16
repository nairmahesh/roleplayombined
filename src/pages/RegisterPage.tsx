// pitchiq/frontend/src/pages/RegisterPage.tsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Target, ArrowRight } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', companyName: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authApi.register(form);
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate('/dashboard');
      toast.success('Account created! Welcome to PitchIQ');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-[12px] bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center">
            <Target size={20} className="text-white" />
          </div>
          <span className="font-display text-2xl font-extrabold tracking-tight">
            Pitch<span className="text-accent">IQ</span>
          </span>
        </div>

        <div className="card p-8">
          <h2 className="font-display text-xl font-bold mb-1">Start your free trial</h2>
          <p className="text-sm text-white/80 mb-6">50 sessions free. No credit card required.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">First name</label>
                <input required value={form.firstName} onChange={set('firstName')} placeholder="Mahesh" className="input-base" />
              </div>
              <div>
                <label className="text-xs font-medium text-white/70 block mb-1.5">Last name</label>
                <input required value={form.lastName} onChange={set('lastName')} placeholder="Nair" className="input-base" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-white/70 block mb-1.5">Company name</label>
              <input required value={form.companyName} onChange={set('companyName')} placeholder="Acme Corp" className="input-base" />
            </div>
            <div>
              <label className="text-xs font-medium text-white/70 block mb-1.5">Work email</label>
              <input type="email" required value={form.email} onChange={set('email')} placeholder="you@company.com" className="input-base" />
            </div>
            <div>
              <label className="text-xs font-medium text-white/70 block mb-1.5">Password</label>
              <input type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="Min 8 characters" className="input-base" />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-1">
              {loading ? 'Creating account…' : 'Create account'}
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-white/55 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
