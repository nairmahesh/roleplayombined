import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, Copy, BarChart3, X, Check, Sparkles, Users, TrendingUp, Clock, ChevronDown, ChevronUp, Shield, Loader as Loader2, TriangleAlert as AlertTriangle, RefreshCw } from 'lucide-react';
import { personasApi } from '@/lib/api';
import { PersonaBuilder } from '@/components/practice/PersonaBuilder';
import { AvatarDisplay, EthnicityAvatarPicker, AVATARS } from '@/components/practice/PersonaAvatars';
import { Persona, Framework, PersonaType } from '@/types';
import { useAuthStore, usePageCache } from '@/lib/store';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

// ── Constants ────────────────────────────────────────────────────────────────

const FRAMEWORKS: Framework[] = ['MEDDIC', 'MEDDICC', 'SPIN', 'BANT', 'CHALLENGER', 'SNAP'];
const PERSONA_TYPES: PersonaType[] = ['FRIENDLY', 'WARM', 'NEUTRAL', 'SKEPTICAL', 'RUDE', 'AGGRESSIVE'];

const PERSONA_TYPE_STYLE: Record<PersonaType, string> = {
  FRIENDLY:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/25',
  WARM:       'text-teal-400   bg-teal-400/10    border-teal-400/25',
  NEUTRAL:    'text-sky-400    bg-sky-400/10     border-sky-400/25',
  SKEPTICAL:  'text-amber-400  bg-amber-400/10   border-amber-400/25',
  RUDE:       'text-orange-400 bg-orange-400/10  border-orange-400/25',
  AGGRESSIVE: 'text-red-400    bg-red-400/10     border-red-400/25',
};

// ── Analytics panel ───────────────────────────────────────────────────────────

interface PersonaAnalytics {
  usageCount: number;
  avgScore: number;
  lastUsed: string | null;
  topUsers: Array<{ name: string; count: number }>;
}

function AnalyticsPanel({ personaId, onClose }: { personaId: string; onClose: () => void }) {
  const [data, setData] = useState<PersonaAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    personasApi.getAnalytics(personaId)
      .then(setData)
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [personaId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-bg-2 border border-white/10 rounded-[20px] w-full max-w-md shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-accent" />
            <h3 className="font-display font-bold text-[15px]">Usage Analytics</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={22} className="animate-spin text-accent/60" />
            </div>
          ) : data ? (
            <div className="flex flex-col gap-5">
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Sessions', value: data.usageCount, icon: Users, color: 'text-accent' },
                  { label: 'Avg Score', value: data.avgScore > 0 ? `${data.avgScore}%` : '—', icon: TrendingUp, color: 'text-emerald-400' },
                  { label: 'Last Used', value: data.lastUsed ? formatDistanceToNow(new Date(data.lastUsed), { addSuffix: true }) : 'Never', icon: Clock, color: 'text-amber-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-[12px] bg-white/[0.03] border border-white/[0.06]">
                    <Icon size={16} className={color} />
                    <div className="font-display font-bold text-[18px]">{value}</div>
                    <div className="text-[9.5px] text-white/45 text-center leading-tight">{label}</div>
                  </div>
                ))}
              </div>

              {/* Usage bar */}
              {data.usageCount > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-white/55 font-semibold uppercase tracking-wider">Engagement</span>
                    <span className="text-[10px] text-white/40">{data.usageCount} sessions total</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((data.usageCount / 50) * 100, 100)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
                    />
                  </div>
                </div>
              )}

              {/* Top users */}
              {data.topUsers.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-white/55 uppercase tracking-wider mb-2">Top Practitioners</p>
                  <div className="flex flex-col gap-2">
                    {data.topUsers.map((u, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center text-[9px] font-bold text-accent">
                            {u.name[0]}
                          </div>
                          <span className="text-[12px] text-white/80">{u.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 rounded-full bg-white/[0.06] w-20 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent/50"
                              style={{ width: `${Math.min((u.count / (data.topUsers[0]?.count || 1)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-white/50 w-8 text-right">{u.count}×</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.usageCount === 0 && (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <BarChart3 size={24} className="text-white/20" />
                  <p className="text-[12.5px] text-white/45">No sessions recorded yet</p>
                  <p className="text-[11px] text-white/30">Assign this persona to a team roleplay to start tracking.</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

interface EditForm {
  avatarId: string;
  name: string; title: string; company: string; industry: string;
  personaType: PersonaType;
  personality: string; systemPrompt: string;
  objections: string[]; buyingSignals: string[];
  frameworks: Framework[];
}

const SUGGESTED_OBJECTIONS: Record<string, string[]> = {
  price:     ["Your pricing is too high compared to alternatives", "We don't have budget for this right now", "Can we negotiate a lower rate?", "We need a bigger discount to justify this"],
  timing:    ["Now isn't a good time to make a change", "We're locked into a contract until next year", "We have other priorities at the moment", "Can we revisit this in Q3?"],
  value:     ["I don't see how this solves our specific problem", "We already have a solution in place", "What's the ROI on this?", "Prove to me this works for companies like ours"],
  trust:     ["We've been burned by vendors before", "Your company is too new / small for us", "I need references from similar companies", "How do I know your product actually delivers?"],
  technical: ["Our IT team will never approve this", "Integration with our stack looks complex", "What about data security and compliance?", "We'd need a full technical audit first"],
  authority: ["I need to get buy-in from my CFO", "This decision needs to go through procurement", "I'm not the right person to make this call", "Our leadership team would need to see this first"],
};

function SuggestedObjectionsDropdown({ onSelect }: { onSelect: (items: string[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 border border-accent/30 hover:border-accent/60 px-2.5 py-1 rounded-[7px] transition-all">
        <Sparkles size={10} /> AI Suggestions
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1.5 right-0 z-30 w-52 rounded-[12px] border border-white/10 bg-bg-2 shadow-2xl overflow-hidden">
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider">Objection type</p>
            </div>
            {Object.entries(SUGGESTED_OBJECTIONS).map(([key, items]) => (
              <button key={key} type="button" onClick={() => { onSelect(items); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-[12px] text-white/75 hover:bg-white/[0.06] hover:text-white transition-colors capitalize">
                {key}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {open && <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />}
    </div>
  );
}

function EditPersonaModal({ persona, onSave, onClose }: {
  persona: Persona;
  onSave: (updated: Persona) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EditForm>({
    avatarId: persona.avatarId || persona.emoji || AVATARS[0].id,
    name: persona.name,
    title: persona.title,
    company: persona.company ?? '',
    industry: persona.industry ?? '',
    personaType: persona.personaType ?? 'NEUTRAL',
    personality: typeof persona.personality === 'string'
      ? (persona.personality.startsWith('{') ? JSON.parse(persona.personality).description ?? persona.personality : persona.personality)
      : '',
    systemPrompt: persona.systemPrompt,
    objections: persona.objections.length ? persona.objections : [''],
    buyingSignals: persona.buyingSignals.length ? persona.buyingSignals : [''],
    frameworks: persona.frameworks,
  });

  const set = (k: keyof EditForm, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const updateItem = (field: 'objections' | 'buyingSignals', i: number, v: string) => {
    const arr = [...form[field]]; arr[i] = v; set(field, arr);
  };
  const addItem = (field: 'objections' | 'buyingSignals') => set(field, [...form[field], '']);
  const removeItem = (field: 'objections' | 'buyingSignals', i: number) =>
    set(field, form[field].filter((_, idx) => idx !== i));
  const toggleFramework = (fw: Framework) =>
    set('frameworks', form.frameworks.includes(fw) ? form.frameworks.filter(f => f !== fw) : [...form.frameworks, fw]);

  const selectedAvatar = AVATARS.find(a => a.id === form.avatarId) ?? AVATARS[0];

  const handleSave = async () => {
    if (!form.name || !form.title || !form.systemPrompt) {
      toast.error('Name, title, and system prompt are required');
      return;
    }
    setSaving(true);
    try {
      const updated = await personasApi.update(persona.id, {
        ...form,
        emoji: form.avatarId,
        avatarId: form.avatarId,
        objections: form.objections.filter(Boolean),
        buyingSignals: form.buyingSignals.filter(Boolean),
        personality: JSON.stringify({ description: form.personality }),
      });
      onSave(updated);
      toast.success('Persona updated');
    } catch {
      toast.error('Failed to update persona');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-bg-2 border border-white/10 rounded-[20px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <Pencil size={15} className="text-accent" />
            <h2 className="font-display text-lg font-bold">Edit Persona</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/80 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-1 px-6 py-3 border-b border-white/[0.05]">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1">
              <button onClick={() => setStep(s)}
                className={clsx('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                  step === s ? 'bg-accent text-white' : step > s ? 'bg-emerald-500 text-white' : 'bg-white/[0.08] text-white/55'
                )}>
                {step > s ? <Check size={10} /> : s}
              </button>
              {s < 3 && <div className={clsx('w-8 h-px', step > s ? 'bg-emerald-500/50' : 'bg-white/10')} />}
            </div>
          ))}
          <span className="ml-3 text-[12px] text-white/70">{['Identity', 'Behavior', 'Frameworks'][step - 1]}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col gap-5">
                {/* Avatar picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white/70">Avatar</label>
                  </div>
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.06]">
                    <AvatarDisplay avatarId={form.avatarId} size={44} />
                    <div>
                      <p className="text-[13px] font-semibold text-white">{selectedAvatar.name}</p>
                      <p className="text-[11px] text-white/45 capitalize">{selectedAvatar.gender} · {selectedAvatar.ethnicity.replace('-', ' ')}</p>
                    </div>
                    <button type="button" onClick={() => {
                      const others = AVATARS.filter(a => a.id !== form.avatarId);
                      set('avatarId', others[Math.floor(Math.random() * others.length)].id);
                    }} className="ml-auto p-1.5 rounded-[7px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all">
                      <RefreshCw size={13} />
                    </button>
                  </div>
                  <EthnicityAvatarPicker value={form.avatarId} onChange={id => set('avatarId', id)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([['name','Full Name *','Sarah Chen'],['title','Job Title *','VP of Sales'],['company','Company','Acme Corp'],['industry','Industry','SaaS']] as const).map(([k, lbl, ph]) => (
                    <div key={k}>
                      <label className="text-xs font-medium text-white/70 block mb-1.5">{lbl}</label>
                      <input value={form[k as 'name'|'title'|'company'|'industry']} onChange={e => set(k as keyof EditForm, e.target.value)} placeholder={ph} className="input-base" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-medium text-white/70 block mb-2">Persona Type</label>
                  <div className="flex flex-wrap gap-2">
                    {PERSONA_TYPES.map(t => (
                      <button key={t} onClick={() => set('personaType', t)}
                        className={clsx('flex-1 min-w-[80px] py-2 rounded-[9px] text-[12px] font-semibold border transition-all capitalize',
                          form.personaType === t ? 'border-accent bg-accent/10 text-accent' : 'border-white/[0.08] text-white/80 hover:text-white'
                        )}>
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-medium text-white/70 block mb-1.5">Personality Description</label>
                  <textarea value={form.personality} onChange={e => set('personality', e.target.value)} rows={2}
                    placeholder="Skeptical, data-driven, impatient with fluff…" className="input-base resize-none" />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/70 block mb-1.5">
                    AI System Prompt * <span className="font-normal text-white/50">(defines character behaviour)</span>
                  </label>
                  <textarea value={form.systemPrompt} onChange={e => set('systemPrompt', e.target.value)} rows={5}
                    className="input-base resize-none text-[12.5px] leading-relaxed" />
                </div>
                {/* Objections */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white/70">Common Objections</label>
                    <div className="flex items-center gap-2">
                      <SuggestedObjectionsDropdown onSelect={items => set('objections', items)} />
                      <button onClick={() => addItem('objections')} className="text-[11px] text-accent hover:underline flex items-center gap-1">
                        <Plus size={11} /> Add
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {form.objections.map((val, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={val} onChange={e => updateItem('objections', i, e.target.value)}
                          placeholder={`Objection ${i + 1}…`} className="input-base flex-1 text-[12.5px]" />
                        {form.objections.length > 1 && (
                          <button onClick={() => removeItem('objections', i)} className="p-2 text-white/55 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Buying signals */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white/70">Buying Signals</label>
                    <button onClick={() => addItem('buyingSignals')} className="text-[11px] text-accent hover:underline flex items-center gap-1">
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {form.buyingSignals.map((val, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={val} onChange={e => updateItem('buyingSignals', i, e.target.value)}
                          placeholder={`Signal ${i + 1}…`} className="input-base flex-1 text-[12.5px]" />
                        {form.buyingSignals.length > 1 && (
                          <button onClick={() => removeItem('buyingSignals', i)} className="p-2 text-white/55 hover:text-red-400 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col gap-5">
                <div>
                  <label className="text-xs font-medium text-white/70 block mb-2">Frameworks this persona tests</label>
                  <div className="flex flex-wrap gap-2">
                    {FRAMEWORKS.map(fw => (
                      <button key={fw} onClick={() => toggleFramework(fw)}
                        className={clsx('px-4 py-2 rounded-[9px] text-[12.5px] font-semibold border transition-all',
                          form.frameworks.includes(fw) ? 'border-accent bg-accent text-white' : 'border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06]'
                        )}>
                        {fw}
                      </button>
                    ))}
                  </div>
                </div>
                {form.name && (
                  <div className="p-4 rounded-[12px] bg-bg-3 border border-white/[0.08]">
                    <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider mb-3">Preview</p>
                    <div className="flex items-start gap-3">
                      <AvatarDisplay avatarId={form.avatarId} size={48} />
                      <div>
                        <div className="font-display font-bold">{form.name}</div>
                        <div className="text-[12px] text-white/70 mb-2">{form.title}{form.company ? ` · ${form.company}` : ''}</div>
                        <div className="flex gap-1.5 flex-wrap">
                          <span className={clsx('text-[10px] px-2 py-0.5 rounded border', PERSONA_TYPE_STYLE[form.personaType])}>{form.personaType.charAt(0) + form.personaType.slice(1).toLowerCase()}</span>
                          {form.frameworks.map(fw => <span key={fw} className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/60">{fw}</span>)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07]">
          <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} className="btn-ghost disabled:opacity-30">Back</button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn-primary">Continue</button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="btn-primary gap-2">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Persona card ───────────────────────────────────────────────────────────────

function PersonaCard({
  persona, onEdit, onClone, onDelete, onAnalytics,
}: {
  persona: Persona;
  onEdit?: (p: Persona) => void;
  onClone?: (p: Persona) => void;
  onDelete?: (p: Persona) => void;
  onAnalytics: (p: Persona) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const avatarId = persona.avatarId || persona.emoji;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-2 border border-white/[0.08] rounded-[16px] overflow-hidden hover:border-white/[0.14] transition-colors group"
    >
      {/* Card header */}
      <div className="flex items-start gap-4 p-5">
        <AvatarDisplay avatarId={avatarId} size={44} className="rounded-[12px] flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display font-bold text-[14.5px] truncate">{persona.name}</h3>
            {persona.isPreset && (
              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-400 font-semibold flex-shrink-0">
                <Shield size={8} /> Preset
              </span>
            )}
          </div>
          <p className="text-[12px] text-white/55 truncate mt-0.5">{persona.title}{persona.company ? ` · ${persona.company}` : ''}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <span className={clsx('text-[9.5px] px-1.5 py-0.5 rounded border font-medium', PERSONA_TYPE_STYLE[persona.personaType ?? 'NEUTRAL'])}>
              {(persona.personaType ?? 'NEUTRAL').charAt(0) + (persona.personaType ?? 'NEUTRAL').slice(1).toLowerCase()}
            </span>
            {persona.industry && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded border border-white/[0.08] text-white/55">{persona.industry}</span>
            )}
            {persona.frameworks.slice(0, 2).map(fw => (
              <span key={fw} className="text-[9.5px] px-1.5 py-0.5 rounded border border-white/[0.06] text-white/40">{fw}</span>
            ))}
            {persona.frameworks.length > 2 && (
              <span className="text-[9.5px] text-white/35">+{persona.frameworks.length - 2}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionBtn icon={BarChart3} label="Analytics" onClick={() => onAnalytics(persona)} color="text-accent" />
          {onClone && <ActionBtn icon={Copy} label="Clone" onClick={() => onClone(persona)} />}
          {onEdit && !persona.isPreset && (
            <ActionBtn icon={Pencil} label="Edit" onClick={() => onEdit(persona)} />
          )}
          {onDelete && !persona.isPreset && (
            <ActionBtn icon={Trash2} label="Delete" onClick={() => onDelete(persona)} color="text-red-400/70 hover:text-red-400" />
          )}
        </div>
      </div>

      {/* Expandable detail */}
      {persona.systemPrompt && (
        <>
          <div className="border-t border-white/[0.05]">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 w-full px-5 py-2 text-[10.5px] text-white/40 hover:text-white/65 transition-colors"
            >
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              {expanded ? 'Hide' : 'Show'} system prompt
            </button>
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4">
                  <p className="text-[11.5px] text-white/55 leading-relaxed line-clamp-6 bg-white/[0.02] border border-white/[0.05] rounded-[10px] p-3">
                    {persona.systemPrompt}
                  </p>
                  {persona.objections.length > 0 && (
                    <div className="mt-3">
                      <p className="text-[9.5px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">Objections</p>
                      <div className="flex flex-wrap gap-1">
                        {persona.objections.map((o, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/[0.07] border border-red-400/15 text-red-300/70">{o}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {persona.buyingSignals.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[9.5px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">Buying Signals</p>
                      <div className="flex flex-wrap gap-1">
                        {persona.buyingSignals.map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/[0.07] border border-emerald-400/15 text-emerald-300/70">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, color = 'text-white/45 hover:text-white/80' }: {
  icon: React.ElementType; label: string; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={clsx('w-7 h-7 flex items-center justify-center rounded-[8px] hover:bg-white/[0.08] transition-all', color)}
    >
      <Icon size={13} />
    </button>
  );
}

// ── Delete confirm modal ────────────────────────────────────────────────────────

function DeleteModal({ persona, onConfirm, onCancel, deleting }: {
  persona: Persona; onConfirm: () => void; onCancel: () => void; deleting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-bg-2 border border-white/10 rounded-[18px] p-6 w-full max-w-sm shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-11 h-11 rounded-full bg-red-400/10 border border-red-400/20 flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-display font-bold text-[15px] mb-1">Delete Persona?</h3>
            <p className="text-[12.5px] text-white/55 leading-relaxed">
              <strong className="text-white/80">{persona.name}</strong> will be permanently removed. This cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-[10px] bg-white/[0.05] border border-white/10 text-[13px] text-white/75 font-semibold hover:bg-white/[0.09] transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={deleting}
              className="flex-1 py-2.5 rounded-[10px] bg-red-500 text-white text-[13px] font-bold hover:bg-red-400 transition-colors shadow-[0_4px_16px_rgba(239,68,68,0.3)] disabled:opacity-60 flex items-center justify-center gap-2">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PersonasPage() {
  const { user } = useAuthStore(s => ({ user: s.user }));
  const isReadOnly = user?.role === 'AGENT';
  const { getCache, setCache } = usePageCache();

  const cached = getCache<Persona[]>('personas');
  const [personas, setPersonas] = useState<Persona[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [search, setSearch] = useState('');
  const [filterPersonaType, setFilterPersonaType] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'preset' | 'custom'>('all');

  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [deletingPersona, setDeletingPersona] = useState<Persona | null>(null);
  const [analyticsPersonaId, setAnalyticsPersonaId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cloning, setCloningId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    personasApi.list()
      .then(d => { setPersonas(d); setCache('personas', d); })
      .catch(() => toast.error('Failed to load personas'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClone = async (p: Persona) => {
    setCloningId(p.id);
    try {
      const cloned = await personasApi.clone(p);
      setPersonas(prev => [...prev, cloned]);
      toast.success(`Cloned "${p.name}"`);
    } catch {
      toast.error('Failed to clone persona');
    } finally {
      setCloningId(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingPersona) return;
    setIsDeleting(true);
    try {
      await personasApi.delete(deletingPersona.id);
      setPersonas(prev => prev.filter(p => p.id !== deletingPersona.id));
      toast.success('Persona deleted');
      setDeletingPersona(null);
    } catch {
      toast.error('Failed to delete persona');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = (updated: Persona) => {
    setPersonas(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditingPersona(null);
  };

  const filtered = personas.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || (p.industry ?? '').toLowerCase().includes(q);
    const matchDiff = !filterPersonaType || p.personaType === filterPersonaType;
    const matchType = filterType === 'all' || (filterType === 'preset' ? p.isPreset : !p.isPreset);
    return matchSearch && matchDiff && matchType;
  });

  const presetCount = personas.filter(p => p.isPreset).length;
  const customCount = personas.filter(p => !p.isPreset).length;
  const totalUsage = 171; // mock total across all personas

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Personas', value: personas.length, icon: Users, color: 'text-accent' },
          { label: 'Custom', value: customCount, icon: Sparkles, color: 'text-emerald-400' },
          { label: 'Preset', value: presetCount, icon: Shield, color: 'text-amber-400' },
          { label: 'Total Sessions', value: totalUsage, icon: TrendingUp, color: 'text-sky-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-bg-2 border border-white/[0.07] rounded-[14px] p-4 flex items-center gap-3">
            <div className={clsx('w-9 h-9 rounded-[10px] bg-white/[0.04] flex items-center justify-center flex-shrink-0', color)}>
              <Icon size={17} />
            </div>
            <div>
              <div className="font-display font-bold text-[20px] leading-none">{value}</div>
              <div className="text-[10.5px] text-white/45 mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search — grows to fill space */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search personas…"
            className="input-base pl-8 w-full text-[12px] py-1.5"
          />
        </div>

        {/* Type filter */}
        <div className="flex rounded-[9px] border border-white/[0.08] overflow-hidden flex-shrink-0">
          {(['all', 'preset', 'custom'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={clsx('px-3 py-1.5 text-[11px] font-medium capitalize transition-colors',
                filterType === t ? 'bg-accent text-white' : 'text-white/55 hover:text-white/80 hover:bg-white/[0.04]'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* Persona type filter */}
        <select
          value={filterPersonaType}
          onChange={e => setFilterPersonaType(e.target.value)}
          className="input-base text-[11px] py-1.5 w-auto flex-shrink-0 cursor-pointer"
        >
          <option value="">All types</option>
          {PERSONA_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
        </select>

        {/* Create button — managers/admins only */}
        {!isReadOnly && (
          <button
            onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-accent text-white text-[13px] font-semibold hover:bg-accent/85 transition-all shadow-[0_4px_16px_rgba(91,111,255,0.25)] flex-shrink-0"
          >
            <Plus size={14} /> New Persona
          </button>
        )}
      </div>

      {/* Persona grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-accent/50" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Users size={36} className="text-white/15" />
          <p className="text-[14px] text-white/45 font-medium">
            {search || filterPersonaType || filterType !== 'all' ? 'No personas match your filters' : 'No personas yet'}
          </p>
          {!isReadOnly && !search && filterType !== 'preset' && (
            <button onClick={() => setShowBuilder(true)} className="flex items-center gap-1.5 text-[12.5px] text-accent hover:text-accent/80 font-medium mt-1">
              <Plus size={13} /> Create your first persona
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map(p => (
            <PersonaCard
              key={p.id}
              persona={p}
              onEdit={isReadOnly ? undefined : setEditingPersona}
              onClone={isReadOnly ? undefined : handleClone}
              onDelete={isReadOnly ? undefined : setDeletingPersona}
              onAnalytics={p => setAnalyticsPersonaId(p.id)}
            />
          ))}
        </div>
      )}

      {/* Cloning indicator */}
      {cloning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-[12px] bg-bg-2 border border-white/10 shadow-xl text-[13px]">
          <Loader2 size={14} className="animate-spin text-accent" /> Cloning persona…
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showBuilder && (
          <PersonaBuilder
            onCreated={p => { setPersonas(prev => [...prev, p]); setShowBuilder(false); }}
            onClose={() => setShowBuilder(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingPersona && (
          <EditPersonaModal
            persona={editingPersona}
            onSave={handleSaveEdit}
            onClose={() => setEditingPersona(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingPersona && (
          <DeleteModal
            persona={deletingPersona}
            onConfirm={handleDelete}
            onCancel={() => setDeletingPersona(null)}
            deleting={isDeleting}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {analyticsPersonaId && (
          <AnalyticsPanel
            personaId={analyticsPersonaId}
            onClose={() => setAnalyticsPersonaId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
