import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Building2, CreditCard as Edit2, Check, X, Users, ShieldCheck,
  RefreshCw, Bot, MessageSquare, Save, ChevronDown, ChevronUp, Shield,
  Loader as Loader2,
} from 'lucide-react';
import { superadminApi } from '@/lib/api';
import { CompanyDetail, User, Persona, FirstSpeaker } from '@/types';
import { AvatarDisplay } from '@/components/practice/PersonaAvatars';
import clsx from 'clsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  SUPER_ADMIN:   { label: 'Super Admin', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/25' },
  COMPANY_ADMIN: { label: 'Admin',       cls: 'bg-accent/10 text-[#9BA8FF] border-accent/20' },
  MANAGER:       { label: 'Manager',     cls: 'bg-accent-3/10 text-accent-3 border-accent-3/20' },
  AGENT:         { label: 'Agent',       cls: 'bg-white/[0.06] text-white/70 border-white/10' },
};

const PERSONA_TYPE_STYLE: Record<string, string> = {
  FRIENDLY:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  WARM:       'text-teal-400 bg-teal-400/10 border-teal-400/25',
  NEUTRAL:    'text-sky-400 bg-sky-400/10 border-sky-400/25',
  SKEPTICAL:  'text-amber-400 bg-amber-400/10 border-amber-400/25',
  RUDE:       'text-orange-400 bg-orange-400/10 border-orange-400/25',
  AGGRESSIVE: 'text-red-400 bg-red-400/10 border-red-400/25',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditField {
  name: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;
  registrationInfo: string;
  maxAgents: number;
  passThreshold: number;
}

interface PersonaEdit {
  systemPrompt: string;
  openingLine: string;
  firstSpeaker: FirstSpeaker;
  personality: string;
}

type Tab = 'overview' | 'users' | 'personas';

// ── Persona row ───────────────────────────────────────────────────────────────

function PersonaRow({
  persona,
  companyId,
  onUpdated,
}: {
  persona: Persona;
  companyId: string;
  onUpdated: (updated: Persona) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PersonaEdit>({
    systemPrompt: persona.systemPrompt ?? '',
    openingLine: persona.openingLine ?? '',
    firstSpeaker: persona.firstSpeaker ?? 'persona',
    personality: typeof persona.personality === 'string'
      ? (persona.personality.startsWith('{') ? (JSON.parse(persona.personality).description ?? persona.personality) : persona.personality)
      : '',
  });

  const set = (k: keyof PersonaEdit, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await superadminApi.updateCompanyPersona(companyId, persona.id, {
        systemPrompt: form.systemPrompt,
        openingLine: form.openingLine,
        firstSpeaker: form.firstSpeaker,
        personality: form.personality,
      });
      onUpdated(updated);
      setEditing(false);
      toast.success(`"${persona.name}" updated`);
    } catch {
      toast.error('Failed to save persona');
    } finally {
      setSaving(false);
    }
  };

  const personaTypeKey = (persona.personaType ?? '').toUpperCase();
  const typeStyle = PERSONA_TYPE_STYLE[personaTypeKey] ?? 'text-white/60 bg-white/[0.06] border-white/10';

  return (
    <div className="border border-white/[0.07] rounded-[14px] overflow-hidden bg-bg-3">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <AvatarDisplay avatarId={persona.avatarId ?? persona.emoji} size={36} className="flex-shrink-0 rounded-[9px]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[13.5px]">{persona.name}</span>
            {persona.isPreset && (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-400 font-semibold flex-shrink-0">
                <Shield size={8} /> Preset
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-white/55 truncate">
            {persona.title}{persona.company ? ` · ${persona.company}` : ''}
          </div>
        </div>

        {/* Badges */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {persona.personaType && (
            <span className={clsx('text-[9.5px] px-1.5 py-0.5 rounded border font-medium', typeStyle)}>
              {persona.personaType.charAt(0) + persona.personaType.slice(1).toLowerCase()}
            </span>
          )}
          <span className={clsx(
            'text-[9.5px] px-1.5 py-0.5 rounded border font-medium',
            (persona.firstSpeaker ?? 'persona') === 'persona'
              ? 'text-sky-400 bg-sky-400/10 border-sky-400/25'
              : 'text-white/50 bg-white/[0.04] border-white/10'
          )}>
            {(persona.firstSpeaker ?? 'persona') === 'persona' ? 'Persona answers' : 'User first'}
          </span>
        </div>

        {expanded ? <ChevronUp size={14} className="text-white/40 flex-shrink-0" /> : <ChevronDown size={14} className="text-white/40 flex-shrink-0" />}
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] flex flex-col gap-4">
              {!editing ? (
                <>
                  {/* Read view */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">Who speaks first</p>
                      <p className="text-[12.5px] text-white/80">
                        {(persona.firstSpeaker ?? 'persona') === 'persona' ? 'Persona speaks first' : 'User speaks first (persona waits)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">Opening line</p>
                      <p className="text-[12.5px] text-white/80 italic">
                        {persona.openingLine
                          ? `"${persona.openingLine}"`
                          : <span className="not-italic text-white/35">Auto (derived from session type)</span>}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">Personality</p>
                      <p className="text-[12px] text-white/70 leading-relaxed">
                        {form.personality || <span className="text-white/30">Not set</span>}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-1.5">System Prompt</p>
                      <p className="text-[11.5px] text-white/60 leading-relaxed font-mono bg-black/20 rounded-[8px] p-3 whitespace-pre-wrap">
                        {persona.systemPrompt || <span className="text-white/30">Not set</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-accent hover:text-accent/80 border border-accent/30 hover:border-accent/60 px-3 py-1.5 rounded-[8px] transition-all"
                    >
                      <Edit2 size={12} /> Edit Persona
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Edit view */}
                  <div className="flex flex-col gap-4">
                    {/* Who speaks first */}
                    <div>
                      <label className="text-[10px] font-semibold text-white/45 uppercase tracking-wider block mb-2">Who speaks first?</label>
                      <div className="flex gap-2">
                        {(['persona', 'user'] as FirstSpeaker[]).map(s => (
                          <button
                            key={s}
                            onClick={() => set('firstSpeaker', s)}
                            className={clsx(
                              'flex-1 py-2 rounded-[9px] text-[12px] font-semibold border transition-all',
                              form.firstSpeaker === s
                                ? 'border-accent bg-accent/10 text-accent'
                                : 'border-white/[0.08] text-white/70 hover:text-white hover:border-white/20'
                            )}
                          >
                            {s === 'persona' ? `${persona.name.split(' ')[0]} speaks first` : 'User speaks first'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Opening line */}
                    <div>
                      <label className="text-[10px] font-semibold text-white/45 uppercase tracking-wider block mb-1.5">
                        Opening line <span className="normal-case font-normal text-white/30">(leave blank for auto)</span>
                      </label>
                      <input
                        value={form.openingLine}
                        onChange={e => set('openingLine', e.target.value)}
                        placeholder={
                          form.firstSpeaker === 'persona'
                            ? `e.g. "${persona.name.split(' ')[0]} speaking."`
                            : 'Persona will wait for the user to speak'
                        }
                        className="input-base text-[12.5px]"
                      />
                      <p className="text-[10.5px] text-white/30 mt-1.5">
                        {form.firstSpeaker === 'persona'
                          ? 'Auto: phone calls get a short phone answer; meetings get a warm welcome.'
                          : 'The AI will stay silent until the user speaks first.'}
                      </p>
                    </div>

                    {/* Personality */}
                    <div>
                      <label className="text-[10px] font-semibold text-white/45 uppercase tracking-wider block mb-1.5">Personality description</label>
                      <textarea
                        value={form.personality}
                        onChange={e => set('personality', e.target.value)}
                        rows={2}
                        className="input-base resize-none text-[12.5px] leading-relaxed"
                        placeholder="Brief character notes — e.g. 'Analytical, skeptical, impatient with fluff'"
                      />
                    </div>

                    {/* System prompt */}
                    <div>
                      <label className="text-[10px] font-semibold text-white/45 uppercase tracking-wider block mb-1.5">
                        System prompt <span className="normal-case font-normal text-white/30">(defines AI behaviour in-call)</span>
                      </label>
                      <textarea
                        value={form.systemPrompt}
                        onChange={e => set('systemPrompt', e.target.value)}
                        rows={8}
                        className="input-base resize-none text-[11.5px] leading-relaxed font-mono"
                        placeholder="You are [Name], [Title] at [Company]..."
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="btn-ghost gap-1.5 text-xs"
                      disabled={saving}
                    >
                      <X size={12} /> Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn-primary gap-1.5 text-xs"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditField | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!id) return;
    Promise.all([superadminApi.getCompany(id), superadminApi.getCompanyUsers(id)])
      .then(([co, us]) => { setCompany(co); setUsers(us); })
      .finally(() => setLoading(false));
  }, [id]);

  // Lazy-load personas when that tab is first opened
  useEffect(() => {
    if (tab !== 'personas' || !id || personas.length > 0 || loadingPersonas) return;
    setLoadingPersonas(true);
    superadminApi.getCompanyPersonas(id)
      .then(setPersonas)
      .catch(() => toast.error('Failed to load personas'))
      .finally(() => setLoadingPersonas(false));
  }, [tab, id]);

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
    return <div className="text-center py-20 text-white/55">Company not found</div>;
  }

  const ef = (field: keyof EditField) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setEditForm(prev => prev ? { ...prev, [field]: e.target.value } : prev);

  const presetPersonas = personas.filter(p => p.isPreset);
  const customPersonas = personas.filter(p => !p.isPreset);

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
        {tab === 'overview' && (!editing ? (
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
        ))}
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-[12px] bg-white/[0.04] border border-white/[0.06] w-fit">
        {([
          { key: 'overview', label: 'Overview', icon: Building2 },
          { key: 'users',    label: `Users (${users.length})`, icon: Users },
          { key: 'personas', label: `Personas (${personas.length || '…'})`, icon: Bot },
        ] as { key: Tab; label: string; icon: React.FC<{ size: number }> }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] text-[12px] font-semibold transition-all',
              tab === t.key
                ? 'bg-accent text-white shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
            )}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-5">
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
                  { label: 'Registration Info', value: company.registrationInfo || '—', wide: true },
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
        </div>
      )}

      {/* ── Users tab ── */}
      {tab === 'users' && (
        <div className="card">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="font-display text-[13px] font-bold">All Users ({users.length})</h3>
          </div>
          <div className="hidden md:grid text-[11px] font-semibold text-white/55 uppercase tracking-wider px-5 py-2.5 border-b border-white/[0.04]"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
            <div>User</div><div>Role</div><div>Sessions</div><div>Avg Score</div><div>Status</div>
          </div>
          {users.length === 0 ? (
            <div className="p-8 text-center text-white/55 text-sm">No users in this company</div>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {users.map((u, i) => {
                const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.AGENT;
                const score = u.avgScore || 0;
                const scoreColor = score >= 80 ? 'text-accent-3' : score >= 65 ? 'text-accent-5' : score > 0 ? 'text-accent-4' : 'text-white/55';
                return (
                  <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/[0.02] transition-colors">
                    {/* Mobile */}
                    <div className="md:hidden flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate">{u.firstName} {u.lastName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className={clsx('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', roleCfg.cls)}>{roleCfg.label}</span>
                            <span className="text-[11px] text-white/55">{u.sessionCount ?? 0} sessions</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className={clsx('font-display text-[15px] font-bold', scoreColor)}>{score > 0 ? score.toFixed(1) : '—'}</span>
                        <button onClick={() => toggleUserActive(u)}
                          className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all',
                            u.isActive !== false ? 'bg-accent-3/10 text-accent-3 border-accent-3/20' : 'bg-white/[0.05] text-white/55 border-white/10')}>
                          {u.isActive !== false ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:grid items-center px-5 py-3" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                          {u.firstName[0]}{u.lastName[0]}
                        </div>
                        <div>
                          <div className="text-[13px] font-medium">{u.firstName} {u.lastName}</div>
                          <div className="text-[11px] text-white/55">{u.email}</div>
                        </div>
                      </div>
                      <div><span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border', roleCfg.cls)}>{roleCfg.label}</span></div>
                      <div className="text-[13px] text-white/70">{u.sessionCount ?? 0}</div>
                      <div className={clsx('font-display text-[14px] font-bold', scoreColor)}>{score > 0 ? score.toFixed(1) : '—'}</div>
                      <div>
                        <button onClick={() => toggleUserActive(u)}
                          className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all',
                            u.isActive !== false ? 'bg-accent-3/10 text-accent-3 border-accent-3/20 hover:bg-accent-3/20' : 'bg-white/[0.05] text-white/55 border-white/10 hover:bg-white/10')}>
                          {u.isActive !== false ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Personas tab ── */}
      {tab === 'personas' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-white/55">
              Click any persona to view or edit its system prompt, opening line, and conversation behaviour.
            </p>
          </div>

          {loadingPersonas ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-white/40" />
            </div>
          ) : personas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Bot size={36} className="text-white/15" />
              <p className="text-[14px] text-white/45">No personas found</p>
            </div>
          ) : (
            <>
              {/* Preset personas */}
              {presetPersonas.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={12} className="text-amber-400" />
                    <p className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-wider">Preset Personas ({presetPersonas.length})</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {presetPersonas.map(p => (
                      <PersonaRow
                        key={p.id}
                        persona={p}
                        companyId={id!}
                        onUpdated={updated => setPersonas(ps => ps.map(x => x.id === updated.id ? updated : x))}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Custom personas */}
              {customPersonas.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 mt-2">
                    <MessageSquare size={12} className="text-accent" />
                    <p className="text-[11px] font-semibold text-accent/80 uppercase tracking-wider">Custom Prospects ({customPersonas.length})</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {customPersonas.map(p => (
                      <PersonaRow
                        key={p.id}
                        persona={p}
                        companyId={id!}
                        onUpdated={updated => setPersonas(ps => ps.map(x => x.id === updated.id ? updated : x))}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
