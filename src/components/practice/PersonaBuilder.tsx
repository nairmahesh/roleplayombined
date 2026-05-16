// pitchiq/frontend/src/components/practice/PersonaBuilder.tsx
// Allows managers/admins to create custom AI personas

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { X, Plus, Trash2, Sparkles, Check, User, Frown, Smile, CircleHelp as HelpCircle, Smartphone, Building2, CircleAlert as AlertCircle, Search, Briefcase, Target, DollarSign, Microscope } from 'lucide-react';
import { personasApi } from '@/lib/api';
import { Persona, Framework } from '@/types';
import clsx from 'clsx';

const FRAMEWORKS: Framework[] = ['MEDDIC', 'MEDDICC', 'SPIN', 'BANT', 'CHALLENGER', 'SNAP'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;

const PERSONA_ICONS = [
  { id: 'user',         Icon: User,         label: 'Professional'  },
  { id: 'frown',        Icon: Frown,        label: 'Frustrated'    },
  { id: 'smile',        Icon: Smile,        label: 'Friendly'      },
  { id: 'help',         Icon: HelpCircle,   label: 'Skeptical'     },
  { id: 'phone',        Icon: Smartphone,   label: 'Mobile-first'  },
  { id: 'building',     Icon: Building2,    label: 'Enterprise'    },
  { id: 'alert',        Icon: AlertCircle,  label: 'Demanding'     },
  { id: 'search',       Icon: Search,       label: 'Analytical'    },
  { id: 'briefcase',    Icon: Briefcase,    label: 'Executive'     },
  { id: 'target',       Icon: Target,       label: 'Goal-driven'   },
  { id: 'dollar',       Icon: DollarSign,   label: 'Cost-conscious'},
  { id: 'microscope',   Icon: Microscope,   label: 'Technical'     },
] as const;

type PersonaIconId = typeof PERSONA_ICONS[number]['id'];

interface Props {
  onCreated: (persona: Persona) => void;
  onClose: () => void;
}

export function PersonaBuilder({ onCreated, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    title: '',
    company: '',
    industry: '',
    iconId: 'user' as PersonaIconId,
    difficulty: 'MEDIUM' as const,
    personality: '',
    systemPrompt: '',
    objections: [''],
    buyingSignals: [''],
    frameworks: [] as Framework[],
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const addItem = (field: 'objections' | 'buyingSignals') =>
    set(field, [...form[field], '']);

  const updateItem = (field: 'objections' | 'buyingSignals', i: number, v: string) => {
    const arr = [...form[field]];
    arr[i] = v;
    set(field, arr);
  };

  const removeItem = (field: 'objections' | 'buyingSignals', i: number) =>
    set(field, form[field].filter((_, idx) => idx !== i));

  const toggleFramework = (fw: Framework) => {
    set('frameworks', form.frameworks.includes(fw)
      ? form.frameworks.filter(f => f !== fw)
      : [...form.frameworks, fw]
    );
  };

  const selectedIconEntry = PERSONA_ICONS.find(p => p.id === form.iconId) ?? PERSONA_ICONS[0];
  const SelectedIcon = selectedIconEntry.Icon;

  const handleSave = async () => {
    if (!form.name || !form.title || !form.systemPrompt) {
      toast.error('Name, title, and system prompt are required');
      return;
    }
    setSaving(true);
    try {
      const persona = await personasApi.create({
        ...form,
        emoji: form.iconId,
        objections: form.objections.filter(Boolean),
        buyingSignals: form.buyingSignals.filter(Boolean),
        personality: JSON.stringify({ description: form.personality }),
      });
      onCreated(persona);
      toast.success(`Persona "${form.name}" created`);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create persona');
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
              <motion.div key="s1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="flex flex-col gap-4">
                {/* Icon picker */}
                <div>
                  <label className="text-xs font-medium text-white/70 block mb-2">Persona Icon</label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {PERSONA_ICONS.map(({ id, Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => set('iconId', id)}
                        title={label}
                        className={clsx(
                          'flex flex-col items-center gap-1 p-2 rounded-[10px] border transition-all hover:scale-105',
                          form.iconId === id ? 'border-accent bg-accent/15' : 'border-white/[0.08] bg-white/[0.04] hover:border-white/20'
                        )}
                      >
                        <Icon size={16} className={form.iconId === id ? 'text-accent' : 'text-white/70'} />
                        <span className="text-[9px] text-white/75 truncate w-full text-center">{label}</span>
                      </button>
                    ))}
                  </div>
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
                    <span className="ml-1 text-white/70 font-normal">(This defines how the AI behaves in character)</span>
                  </label>
                  <textarea
                    value={form.systemPrompt}
                    onChange={e => set('systemPrompt', e.target.value)}
                    rows={5}
                    placeholder={`You are Sarah Chen, VP of Sales at GrowthCo. You're open to new tools but have been burned by bad implementations before. You'll ask about adoption, training timelines, and ROI. Your main pain is that your reps spend 40% of their time on admin tasks...`}
                    className="input-base resize-none text-[12.5px] leading-relaxed"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-white/70">Common Objections</label>
                    <button onClick={() => addItem('objections')} className="text-[11px] text-accent hover:underline flex items-center gap-1">
                      <Plus size={11} /> Add
                    </button>
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

                {form.name && (
                  <div className="p-4 rounded-[12px] bg-bg-3 border border-white/[0.08]">
                    <div className="text-[11px] font-semibold text-white/55 uppercase tracking-wider mb-3">Preview</div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
                        <SelectedIcon size={18} className="text-accent" />
                      </div>
                      <div>
                        <div className="font-display font-bold">{form.name}</div>
                        <div className="text-[12px] text-white/70 mb-2">{form.title}{form.company ? ` · ${form.company}` : ''}</div>
                        <div className="flex gap-1.5 flex-wrap">
                          <span className={clsx('tag text-[10px]',
                            (form.difficulty as string) === 'EASY' ? 'tag-green' :
                            (form.difficulty as string) === 'MEDIUM' ? 'tag-amber' : 'tag-red'
                          )}>{form.difficulty}</span>
                          {form.frameworks.map(fw => <span key={fw} className="tag text-[10px]">{fw}</span>)}
                        </div>
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
                <Sparkles size={13} />
                {saving ? 'Creating…' : 'Create Persona'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
