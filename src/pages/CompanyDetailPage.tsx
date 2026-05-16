import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2, CreditCard as Edit2, Check, X, Users, ShieldCheck, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import { superadminApi } from '@/lib/api';
import { CompanyDetail, User } from '@/types';
import clsx from 'clsx';

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  SUPER_ADMIN:   { label: 'Super Admin', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
  COMPANY_ADMIN: { label: 'Admin',       cls: 'bg-accent/10 text-[#9BA8FF] border-accent/20' },
  MANAGER:       { label: 'Manager',     cls: 'bg-accent-3/10 text-accent-3 border-accent-3/20' },
  AGENT:         { label: 'Agent',       cls: 'bg-white/[0.06] text-white/70 border-white/10' },
};

interface EditField {
  name: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;
  registrationInfo: string;
  maxAgents: number;
  passThreshold: number;
}

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditField | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([superadminApi.getCompany(id), superadminApi.getCompanyUsers(id)])
      .then(([co, us]) => { setCompany(co); setUsers(us); })
      .finally(() => setLoading(false));
  }, [id]);

  const startEdit = () => {
    if (!company) return;
    setEditForm({
      name: company.name,
      contactEmail: company.contactEmail || '',
      contactPhone: company.contactPhone || '',
      industry: company.industry || '',
      registrationInfo: company.registrationInfo || '',
      maxAgents: company.maxAgents ?? 10,
      passThreshold: company.passThreshold ?? 70,
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditForm(null); };

  const saveEdit = async () => {
    if (!id || !editForm) return;
    setSaving(true);
    try {
      await superadminApi.updateCompany(id, {
        name: editForm.name || undefined,
        contactEmail: editForm.contactEmail || undefined,
        contactPhone: editForm.contactPhone || undefined,
        industry: editForm.industry || undefined,
        registrationInfo: editForm.registrationInfo || undefined,
        maxAgents: editForm.maxAgents,
        passThreshold: editForm.passThreshold,
      });
      const updated = await superadminApi.getCompany(id);
      setCompany(updated);
      setEditing(false);
      setEditForm(null);
      toast.success('Company updated');
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const toggleCompanyActive = async () => {
    if (!id || !company) return;
    try {
      await superadminApi.updateCompany(id, { isActive: !company.isActive });
      setCompany(c => c ? { ...c, isActive: !c.isActive } : c);
      toast.success(company.isActive ? 'Company deactivated' : 'Company activated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const toggleUserActive = async (user: User) => {
    if (!id) return;
    try {
      await superadminApi.updateCompanyUser(id, user.id, { isActive: !user.isActive });
      setUsers(us => us.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
      toast.success(`${user.firstName} ${user.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update user status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-20 text-white/55">Company not found</div>
    );
  }

  const ef = (field: keyof EditField) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setEditForm(prev => prev ? { ...prev, [field]: e.target.value } : prev);

  return (
    <div className="flex flex-col gap-5">
      {/* Back + header */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate('/superadmin/companies')}
          className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex-1">
          <h2 className="font-display text-xl font-bold">{company.name}</h2>
          <p className="text-sm text-white/80 mt-0.5">{company.slug}</p>
        </div>
        <button
          onClick={toggleCompanyActive}
          className={clsx(
            'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
            company.isActive
              ? 'bg-accent-3/10 text-accent-3 border-accent-3/25 hover:bg-accent-3/20'
              : 'bg-white/[0.06] text-white/80 border-white/10 hover:bg-white/10'
          )}
        >
          {company.isActive ? 'Active' : 'Inactive'}
        </button>
        {!editing ? (
          <button onClick={startEdit} className="btn-ghost gap-1.5 text-xs">
            <Edit2 size={12} /> Edit
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button onClick={saveEdit} disabled={saving} className="btn-primary gap-1.5 text-xs">
              <Check size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancelEdit} className="btn-ghost gap-1.5 text-xs">
              <X size={12} /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Agents', value: company.agentCount, icon: Users },
          { label: 'Admins', value: company.adminCount, icon: ShieldCheck },
          { label: 'Sessions', value: company.totalSessions, icon: RefreshCw },
          { label: 'Max Agents', value: company.maxAgents, icon: Users },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <s.icon size={14} className="text-white/55 mb-2" />
            <div className="font-display text-2xl font-bold">{s.value}</div>
            <div className="text-[11px] text-white/80 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Company details */}
      <div className="card p-5">
        <h3 className="font-display text-[13px] font-bold mb-4 flex items-center gap-2">
          <Building2 size={14} className="text-accent" /> Company Details
        </h3>
        {editing && editForm ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/80 block mb-1">Company Name</label>
              <input value={editForm.name} onChange={ef('name')} className="input-base" />
            </div>
            <div>
              <label className="text-xs text-white/80 block mb-1">Industry</label>
              <input value={editForm.industry} onChange={ef('industry')} className="input-base" placeholder="Technology" />
            </div>
            <div>
              <label className="text-xs text-white/80 block mb-1">Contact Email</label>
              <input type="email" value={editForm.contactEmail} onChange={ef('contactEmail')} className="input-base" />
            </div>
            <div>
              <label className="text-xs text-white/80 block mb-1">Contact Phone</label>
              <input value={editForm.contactPhone} onChange={ef('contactPhone')} className="input-base" />
            </div>
            <div>
              <label className="text-xs text-white/80 block mb-1">Max Agents</label>
              <input type="number" min={1} value={editForm.maxAgents} onChange={ef('maxAgents')} className="input-base" />
            </div>
            <div>
              <label className="text-xs text-white/80 block mb-1">Pass Threshold (%)</label>
              <input type="number" min={50} max={100} value={editForm.passThreshold} onChange={ef('passThreshold')} className="input-base" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="text-xs text-white/80 block mb-1">Registration Info</label>
              <textarea
                value={editForm.registrationInfo}
                onChange={ef('registrationInfo')}
                className="input-base min-h-[64px] resize-none"
                placeholder="Business registration number, address, etc."
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              { label: 'Industry', value: company.industry || '—' },
              { label: 'Contact Email', value: company.contactEmail || '—' },
              { label: 'Contact Phone', value: company.contactPhone || '—' },
              { label: 'Pass Threshold', value: `${company.passThreshold}%` },
              { label: 'Max Agents', value: company.maxAgents },
              { label: 'Created', value: new Date(company.createdAt).toLocaleDateString() },
              {
                label: 'Registration Info',
                value: company.registrationInfo || '—',
                wide: true,
              },
            ].map(row => (
              <div key={row.label} className={row.wide ? 'col-span-1 sm:col-span-2' : ''}>
                <div className="text-[11px] text-white/75 mb-0.5">{row.label}</div>
                <div className="text-white/80">{row.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admins */}
      {company.admins.length > 0 && (
        <div className="card p-5">
          <h3 className="font-display text-[13px] font-bold mb-3 flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" /> Company Admins
          </h3>
          <div className="space-y-2">
            {company.admins.map(admin => (
              <div
                key={admin.id}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-white/[0.02] border border-white/[0.05]"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                  {admin.firstName[0]}{admin.lastName[0]}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{admin.firstName} {admin.lastName}</div>
                  <div className="text-[11px] text-white/75">{admin.email}</div>
                </div>
                <div className="text-[11px] text-white/75">
                  {admin.lastLoginAt
                    ? `Last login ${new Date(admin.lastLoginAt).toLocaleDateString()}`
                    : 'Never logged in'}
                </div>
                <span className={clsx(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                  admin.isActive
                    ? 'bg-accent-3/10 text-accent-3 border-accent-3/20'
                    : 'bg-white/[0.05] text-white/55 border-white/10'
                )}>
                  {admin.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="card">
        <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="font-display text-[13px] font-bold">All Users ({users.length})</h3>
        </div>

        <div
          className="grid text-[11px] font-semibold text-white/55 uppercase tracking-wider px-5 py-2.5 border-b border-white/[0.04]"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
        >
          <div>User</div>
          <div>Role</div>
          <div>Sessions</div>
          <div>Avg Score</div>
          <div>Status</div>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-white/55 text-sm">No users in this company</div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {users.map((u, i) => {
              const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.AGENT;
              const score = u.avgScore || 0;
              const scoreColor =
                score >= 80 ? 'text-accent-3' :
                score >= 65 ? 'text-accent-5' :
                score > 0   ? 'text-accent-4' : 'text-white/55';

              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid items-center px-5 py-3 hover:bg-white/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {u.firstName[0]}{u.lastName[0]}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium">{u.firstName} {u.lastName}</div>
                      <div className="text-[11px] text-white/55">{u.email}</div>
                    </div>
                  </div>
                  <div>
                    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border', roleCfg.cls)}>
                      {roleCfg.label}
                    </span>
                  </div>
                  <div className="text-[13px] text-white/70">{u.sessionCount ?? 0}</div>
                  <div className={clsx('font-display text-[14px] font-bold', scoreColor)}>
                    {score > 0 ? score.toFixed(1) : '—'}
                  </div>
                  <div>
                    <button
                      onClick={() => toggleUserActive(u)}
                      className={clsx(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all',
                        u.isActive !== false
                          ? 'bg-accent-3/10 text-accent-3 border-accent-3/20 hover:bg-accent-3/20'
                          : 'bg-white/[0.05] text-white/55 border-white/10 hover:bg-white/10'
                      )}
                    >
                      {u.isActive !== false ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
