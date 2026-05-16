import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Building2, Plus, Users, BarChart3, ChevronRight,
  Activity, Globe, Phone, FileText,
} from 'lucide-react';
import { superadminApi } from '@/lib/api';
import { CompanyDetail, PlatformStats } from '@/types';
import clsx from 'clsx';

interface CreateForm {
  companyName: string;
  industry: string;
  contactEmail: string;
  contactPhone: string;
  registrationInfo: string;
  maxAgents: number;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
}

const EMPTY_FORM: CreateForm = {
  companyName: '',
  industry: '',
  contactEmail: '',
  contactPhone: '',
  registrationInfo: '',
  maxAgents: 10,
  adminEmail: '',
  adminFirstName: '',
  adminLastName: '',
};

export function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<CompanyDetail[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    companyName: string;
    adminEmail: string;
    tempPassword: string;
  } | null>(null);

  const load = () =>
    Promise.all([superadminApi.listCompanies(), superadminApi.getStats()])
      .then(([cos, st]) => { setCompanies(cos); setStats(st); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const f = (field: keyof CreateForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const result = await superadminApi.createCompany({ ...form, maxAgents: Number(form.maxAgents) });
      setCreatedResult(result);
      const updated = await superadminApi.listCompanies();
      const statsUpdated = await superadminApi.getStats();
      setCompanies(updated);
      setStats(statsUpdated);
      setForm(EMPTY_FORM);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (company: CompanyDetail) => {
    try {
      await superadminApi.updateCompany(company.id, { isActive: !company.isActive });
      setCompanies(cs =>
        cs.map(c => c.id === company.id ? { ...c, isActive: !c.isActive } : c)
      );
      toast.success(`${company.name} ${!company.isActive ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update company status');
    }
  };

  const STAT_CARDS = stats ? [
    { label: 'Total Companies', value: stats.totalCompanies, icon: Building2, color: 'text-accent' },
    { label: 'Active', value: stats.activeCompanies, icon: Activity, color: 'text-accent-3' },
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-accent-2' },
    { label: 'Total Sessions', value: stats.totalSessions, icon: BarChart3, color: 'text-accent-5' },
    { label: 'Active (30d)', value: stats.activeUsersThisMonth, icon: Activity, color: 'text-accent-4' },
  ] : [];

  const cols = '2.5fr 1.5fr 1fr 1fr 0.8fr 60px';

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Companies</h2>
          <p className="text-sm text-white/65 mt-0.5">Platform-wide company management</p>
        </div>
        <button
          onClick={() => { setShowCreate(v => !v); setCreatedResult(null); }}
          className="btn-primary gap-2"
        >
          <Plus size={13} /> Create Company
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {STAT_CARDS.map(s => (
            <div key={s.label} className="card p-4">
              <s.icon size={15} className={clsx('mb-2', s.color)} />
              <div className="font-display text-2xl font-bold">{s.value}</div>
              <div className="text-[11px] text-white/65 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create Company Form */}
      {showCreate && !createdResult && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleCreate}
          className="card p-5 border-accent/20"
        >
          <h3 className="font-display text-[14px] font-bold mb-4">Create New Company</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs text-white/65 block mb-1">Company Name *</label>
              <input
                required
                value={form.companyName}
                onChange={f('companyName')}
                className="input-base"
                placeholder="Acme Corporation"
              />
            </div>
            <div>
              <label className="text-xs text-white/65 block mb-1">Max Agents</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.maxAgents}
                onChange={f('maxAgents')}
                className="input-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-white/65 block mb-1">Industry</label>
              <input value={form.industry} onChange={f('industry')} className="input-base" placeholder="Technology" />
            </div>
            <div>
              <label className="text-xs text-white/65 block mb-1">Contact Email</label>
              <input type="email" value={form.contactEmail} onChange={f('contactEmail')} className="input-base" placeholder="contact@company.com" />
            </div>
            <div>
              <label className="text-xs text-white/65 block mb-1">Contact Phone</label>
              <input value={form.contactPhone} onChange={f('contactPhone')} className="input-base" placeholder="+1 555 000 0000" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-white/65 block mb-1">Registration Info</label>
            <textarea
              value={form.registrationInfo}
              onChange={f('registrationInfo')}
              className="input-base min-h-[56px] resize-none"
              placeholder="Business registration number, address, etc."
            />
          </div>

          <div className="border-t border-white/[0.07] pt-4 mb-4">
            <p className="text-[11px] font-semibold text-white/65 uppercase tracking-wider mb-3">
              Company Admin Account
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/65 block mb-1">First Name *</label>
                <input required value={form.adminFirstName} onChange={f('adminFirstName')} className="input-base" placeholder="First" />
              </div>
              <div>
                <label className="text-xs text-white/65 block mb-1">Last Name *</label>
                <input required value={form.adminLastName} onChange={f('adminLastName')} className="input-base" placeholder="Last" />
              </div>
              <div>
                <label className="text-xs text-white/65 block mb-1">Work Email *</label>
                <input type="email" required value={form.adminEmail} onChange={f('adminEmail')} className="input-base" placeholder="admin@company.com" />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="btn-primary">
              {creating ? 'Creating…' : 'Create Company'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost">
              Cancel
            </button>
          </div>
        </motion.form>
      )}

      {/* Created result banner */}
      {createdResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-5 border-accent-3/30 bg-accent-3/5"
        >
          <p className="text-accent-3 font-semibold text-sm mb-3">Company created successfully</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-white/65 mb-1">Company</div>
              <div className="font-medium">{createdResult.companyName}</div>
            </div>
            <div>
              <div className="text-xs text-white/65 mb-1">Admin Email</div>
              <div className="font-medium">{createdResult.adminEmail}</div>
            </div>
            <div>
              <div className="text-xs text-white/65 mb-1">Temp Password</div>
              <div className="font-mono font-bold text-accent bg-accent/10 px-2 py-0.5 rounded inline-block">
                {createdResult.tempPassword}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-white/30 mt-3">
            Share the temp password securely with the company admin.
          </p>
          <button
            onClick={() => { setCreatedResult(null); setShowCreate(false); }}
            className="btn-ghost mt-3 text-xs"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Companies Table */}
      <div className="card">
        {/* Desktop header */}
        <div
          className="hidden md:grid text-[11px] font-semibold text-white/30 uppercase tracking-wider px-5 py-3 border-b border-white/[0.06]"
          style={{ gridTemplateColumns: cols }}
        >
          <div>Company</div>
          <div>Contact</div>
          <div>Agents</div>
          <div>Sessions</div>
          <div>Status</div>
          <div />
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/30">Loading companies…</div>
        ) : companies.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 size={28} className="text-white/15 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No companies yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {companies.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="hover:bg-white/[0.02] transition-colors"
              >
                {/* Mobile card */}
                <div className="md:hidden px-4 py-3.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[13.5px]">{c.name}</span>
                      <button
                        onClick={() => toggleActive(c)}
                        className={clsx(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all',
                          c.isActive
                            ? 'bg-accent-3/10 text-accent-3 border-accent-3/25'
                            : 'bg-white/[0.05] text-white/35 border-white/10'
                        )}
                      >
                        {c.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                    <div className="text-[11px] text-white/30 mt-0.5">
                      {c.industry && <span>{c.industry} · </span>}
                      <span>{c.agentCount}/{c.maxAgents} agents · {c.totalSessions} sessions</span>
                    </div>
                    {c.contactEmail && (
                      <div className="text-[11px] text-white/40 mt-0.5 truncate">{c.contactEmail}</div>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/superadmin/companies/${c.id}`)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/30 hover:text-white transition-colors flex-shrink-0 mt-0.5"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Desktop row */}
                <div
                  className="hidden md:grid items-center px-5 py-3.5"
                  style={{ gridTemplateColumns: cols }}
                >
                  <div>
                    <div className="font-medium text-[13.5px]">{c.name}</div>
                    <div className="text-[11px] text-white/30 mt-0.5 flex items-center gap-2">
                      {c.industry && (
                        <span className="flex items-center gap-1">
                          <Globe size={9} /> {c.industry}
                        </span>
                      )}
                      {c.admins[0] && (
                        <span>Admin: {c.admins[0].firstName} {c.admins[0].lastName}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/20 mt-0.5">
                      Created {new Date(c.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-[12px] text-white/50 space-y-0.5">
                    {c.contactEmail && (
                      <div className="flex items-center gap-1 truncate">
                        <Globe size={9} className="text-white/25 flex-shrink-0" />
                        <span className="truncate">{c.contactEmail}</span>
                      </div>
                    )}
                    {c.contactPhone && (
                      <div className="flex items-center gap-1">
                        <Phone size={9} className="text-white/25 flex-shrink-0" />
                        {c.contactPhone}
                      </div>
                    )}
                    {!c.contactEmail && !c.contactPhone && <span className="text-white/20">—</span>}
                  </div>
                  <div className="text-[13px]">
                    <span className="font-semibold">{c.agentCount}</span>
                    <span className="text-white/30 text-xs ml-1">/ {c.maxAgents}</span>
                  </div>
                  <div className="text-[13px] text-white/50">{c.totalSessions}</div>
                  <div>
                    <button
                      onClick={() => toggleActive(c)}
                      className={clsx(
                        'text-[10.5px] font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer',
                        c.isActive
                          ? 'bg-accent-3/10 text-accent-3 border-accent-3/25 hover:bg-accent-3/20'
                          : 'bg-white/[0.05] text-white/35 border-white/10 hover:bg-white/10'
                      )}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => navigate(`/superadmin/companies/${c.id}`)}
                      className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/30 hover:text-white transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
