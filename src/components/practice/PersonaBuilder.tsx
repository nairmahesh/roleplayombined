// pitchiq/frontend/src/components/practice/PersonaBuilder.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { X, Plus, Trash2, Sparkles, Check, Loader as Loader2, RefreshCw } from 'lucide-react';
import { personasApi } from '@/lib/api';
import { Persona, Framework } from '@/types';
import { EthnicityAvatarPicker, AvatarDisplay, AVATARS } from '@/components/practice/PersonaAvatars';
import clsx from 'clsx';

const FRAMEWORKS: Framework[] = ['MEDDIC', 'MEDDICC', 'SPIN', 'BANT', 'CHALLENGER', 'SNAP'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;

// Curated AI-generated objections per personality type
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
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[11px] text-accent hover:text-accent/80 border border-accent/30 hover:border-accent/60 px-2.5 py-1 rounded-[7px] transition-all"
      >
        <Sparkles size={10} /> AI Suggestions
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            className="absolute top-full mt-1.5 right-0 z-30 w-56 rounded-[12px] border border-white/10 bg-bg-2 shadow-2xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-[10px] font-semibold text-white/45 uppercase tracking-wider">Objection type</p>
            </div>
            {Object.entries(SUGGESTED_OBJECTIONS).map(([key, items]) => (
              <button
                key={key}
                type="button"
                onClick={() => { onSelect(items); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-[12px] text-white/75 hover:bg-white/[0.06] hover:text-white transition-colors capitalize"
              >
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

interface Props {
  onCreated: (persona: Persona) => void;
  onClose: () => void;
  initialAvatarId?: string;
}

export function PersonaBuilder({ onCreated, onClose, initialAvatarId }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    avatarId: initialAvatarId ?? AVATARS[0].id,
    name: '',
    title: '',
    company: '',
    industry: '',
    difficulty: 'MEDIUM' as typeof DIFFICULTIES[number],
    personality: '',
    systemPrompt: '',
    objections: [''],
    buyingSignals: [''],
    frameworks: [] as Framework[],
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const addItem = (field: 'objections' | 'buyingSignals') =>
    set(field, [...form[field], '']);
  const updateItem = (field: 'objections' | 'buyingSignals', i: number, v: string) => {
    const arr = [...form[field]]; arr[i] = v; set(field, arr);
  };
  const removeItem = (field: 'objections' | 'buyingSignals', i: number) =>
    set(field, form[field].filter((_, idx) => idx !== i));
  const toggleFramework = (fw: Framework) =>
    set('frameworks', form.frameworks.includes(fw)
      ? form.frameworks.filter(f => f !== fw)
      : [...form.frameworks, fw]);

  const selectedAvatar = AVATARS.find(a => a.id === form.avatarId) ?? AVATARS[0];

  const handleSave = async () => {
    if (!form.name || !form.title || !form.systemPrompt) {
      toast.error('Name, title, and system prompt are required');
      return;
    }
    setSaving(true);
    try {
      const persona = await personasApi.create({
        ...form,
        emoji: form.avatarId,
        avatarId: form.avatarId,
        objections: form.objections.filter(Boolean),
        buyingSignals: form.buyingSignals.filter(Boolean),
        personality: JSON.stringify({ description: form.personality }),
      });
      onCreated(persona);
      toast.success(`Persona "${form.name}" created`);
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Failed to create persona');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-bg-2 border border-white/10 rounded-[20px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <Sparkles size={16} className="text-accent" />
            <h2 className="font-display text-lg font-bold">Create Custom Persona</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/80 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-white/[0.05]">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1">
              <button
                onClick={() => setStep(s)}
                className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                  step === s ? 'bg-accent text-white' : step > s ? 'bg-accent-3 text-white' : 'bg-white/[0.08] text-white/55'
                )}
              >
                {step > s ? <Check size={10} /> : s}
              </button>
              {s < 3 && <div className={clsx('w-8 h-px', step > s ? 'bg-accent-3' : 'bg-white/10')} />}
            </div>
          ))}
          <span className="ml-3 text-[12px] text-white/80">
            {['Identity', 'Behavior', 'Frameworks'][step - 1]}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col gap-5">
                {/* Avatar picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white/70">Avatar</label>
                    <span className="text-[10px] text-white/40">Filter by gender & ethnicity</span>
                  </div>

                  {/* Selected preview */}
                  <div className="flex items-center gap-3 mb-3 p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.06]">
                    <AvatarDisplay avatarId={form.avatarId} size={44} />
                    <div>
                      <p className="text-[13px] font-semibold text-white">{selectedAvatar.name}</p>
                      <p className="text-[11px] text-white/45 capitalize">{selectedAvatar.gender} · {selectedAvatar.ethnicity.replace('-', ' ')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const others = AVATARS.filter(a => a.id !== form.avatarId);
                        set('avatarId', others[Math.floor(Math.random() * others.length)].id);
                      }}
                      className="ml-auto p-1.5 rounded-[7px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                      title="Random avatar"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>

                  <EthnicityAvatarPicker value={form.avatarId} onChange={id => set('avatarId', id)} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-white/70 block mb-1.5">Full Name *</label>
                    <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Sarah Chen" className="input-base" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/70 block mb-1.5">Job Title *</label>
                    <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="VP of Sales" className="input-base" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/70 block mb-1.5">Company</label>
                    <input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Corp" className="input-base" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/70 block mb-1.5">Industry</label>
                    <input value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="SaaS" className="input-base" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-white/70 block mb-2">Difficulty</label>
                  <div className="flex flex-wrap gap-2">
                    {DIFFICULTIES.map(d => (
                      <button
                        key={d}
                        onClick={() => set('difficulty', d)}
                        className={clsx(
                          'flex-1 min-w-[70px] py-2 rounded-[9px] text-[12px] font-semibold border transition-all capitalize',
                          form.difficulty === d ? 'border-accent bg-accent/10 text-accent' : 'border-white/[0.08] text-white/80 hover:text-white'
                        )}
                      >
                        {d.toLowerCase()}
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
                  <textarea
                    value={form.personality}
                    onChange={e => set('personality', e.target.value)}
                    rows={2}
                    placeholder="Skeptical, data-driven, impatient with fluff. Values proof over promises..."
                    className="input-base resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-white/70 block mb-1.5">
                    AI System Prompt *
                    <span className="ml-1 text-white/40 font-normal">(defines how the AI behaves in character)</span>
                  </label>
                  <textarea
                    value={form.systemPrompt}
                    onChange={e => set('systemPrompt', e.target.value)}
                    rows={5}
                    placeholder={`You are ${form.name || 'Sarah Chen'}, ${form.title || 'VP of Sales'} at ${form.company || 'GrowthCo'}. You're open to new tools but have been burned by bad implementations before. You'll ask about adoption, training timelines, and ROI...`}
                    className="input-base resize-none text-[12.5px] leading-relaxed"
                  />
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
                    {form.objections.map((obj, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={obj}
                          onChange={e => updateItem('objections', i, e.target.value)}
                          placeholder={`Objection ${i + 1}...`}
                          className="input-base flex-1 text-[12.5px]"
                        />
                        {form.objections.length > 1 && (
                          <button onClick={() => removeItem('objections', i)} className="p-2 text-white/55 hover:text-accent-4 transition-colors">
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
                    <label className="text-xs font-medium text-white/70">Buying Signals (what makes them receptive)</label>
                    <button onClick={() => addItem('buyingSignals')} className="text-[11px] text-accent hover:underline flex items-center gap-1">
                      <Plus size={11} /> Add
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {form.buyingSignals.map((sig, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={sig}
                          onChange={e => updateItem('buyingSignals', i, e.target.value)}
                          placeholder={`Signal ${i + 1}...`}
                          className="input-base flex-1 text-[12.5px]"
                        />
                        {form.buyingSignals.length > 1 && (
                          <button onClick={() => removeItem('buyingSignals', i)} className="p-2 text-white/55 hover:text-accent-4 transition-colors">
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
                  <label className="text-xs font-medium text-white/70 block mb-2">
                    Which frameworks does this persona test?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FRAMEWORKS.map(fw => (
                      <button
                        key={fw}
                        onClick={() => toggleFramework(fw)}
                        className={clsx(
                          'px-4 py-2 rounded-[9px] text-[12.5px] font-semibold border transition-all',
                          form.frameworks.includes(fw)
                            ? 'border-accent bg-accent text-white'
                            : 'border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06]'
                        )}
                      >
                        {fw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview card */}
                {form.name && (
                  <div className="p-4 rounded-[12px] bg-bg-3 border border-white/[0.08]">
                    <div className="text-[11px] font-semibold text-white/55 uppercase tracking-wider mb-3">Preview</div>
                    <div className="flex items-start gap-3">
                      <AvatarDisplay avatarId={form.avatarId} size={48} />
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold">{form.name}</div>
                        <div className="text-[12px] text-white/70 mb-2">{form.title}{form.company ? ` · ${form.company}` : ''}</div>
                        <div className="flex gap-1.5 flex-wrap">
                          <span className={clsx('text-[10px] px-2 py-0.5 rounded border',
                            form.difficulty === 'EASY' ? 'border-emerald-500/30 text-emerald-400' :
                            form.difficulty === 'MEDIUM' ? 'border-amber-500/30 text-amber-400' : 'border-red-500/30 text-red-400'
                          )}>{form.difficulty}</span>
                          {form.frameworks.map(fw => (
                            <span key={fw} className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/60">{fw}</span>
                          ))}
                        </div>
                        {form.objections.filter(Boolean).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {form.objections.filter(Boolean).slice(0, 3).map((o, i) => (
                              <span key={i} className="text-[9.5px] px-2 py-0.5 rounded-full bg-red-400/[0.07] border border-red-400/15 text-red-300/70">{o}</span>
                            ))}
                            {form.objections.filter(Boolean).length > 3 && (
                              <span className="text-[9.5px] text-white/35">+{form.objections.filter(Boolean).length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.07]">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="btn-ghost disabled:opacity-30"
          >
            Back
          </button>
          <div className="flex gap-2">
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} className="btn-primary">
                Continue
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="btn-primary gap-2">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {saving ? 'Creating…' : 'Create Persona'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
