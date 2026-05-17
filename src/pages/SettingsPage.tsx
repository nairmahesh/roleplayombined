import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import { voiceApi, AgentSummary, AgentConfig, usageApi, UsageSummary } from '@/lib/api';
import {
  Save, Zap, Globe, Shield, ChevronRight, FileText, Plus, Trash2,
  RefreshCw, Bot, Edit2, X, Check, DollarSign, TrendingUp,
} from 'lucide-react';

// ── Agent row ─────────────────────────────────────────────────────────────────

function AgentRow({
  agent,
  onDelete,
  onUpdate,
}: {
  agent: AgentSummary;
  onDelete: (id: string) => void;
  onUpdate: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(agent.name);

  const save = () => {
    if (name.trim() && name !== agent.name) onUpdate(agent.agent_id, name.trim());
    setEditing(false);
  };

  const cancel = () => { setEditing(false); setName(agent.name); };

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-[10px] border border-border bg-bg-2">
      <Bot size={14} className="text-accent shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            className="input-base text-[12.5px] w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            aria-label="Agent name"
            autoFocus
          />
        ) : (
          <>
            <div className="text-[13px] font-medium truncate">{agent.name}</div>
            <div className="text-[10.5px] font-mono truncate text-[color:var(--text3)]">{agent.agent_id}</div>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {editing ? (
          <>
            <button
              type="button"
              onClick={save}
              className="icon-btn text-green-400"
              aria-label="Save agent name"
            >
              <Check size={13} />
            </button>
            <button
              type="button"
              onClick={cancel}
              className="icon-btn"
              aria-label="Cancel editing"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="icon-btn"
              aria-label={`Edit name for agent ${agent.name}`}
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(agent.agent_id)}
              className="icon-btn text-red-400/70 hover:text-red-400"
              aria-label={`Delete agent ${agent.name}`}
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Agents manager ────────────────────────────────────────────────────────────

function AgentsManager() {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await voiceApi.listAgents();
      setAgents(data);
    } catch {
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const payload: AgentConfig = {
      name: newName.trim(),
      conversation_config: {
        agent: {
          first_message: 'Hello! Ready to begin the roleplay?',
          language: 'en',
          prompt: {
            prompt: newPrompt.trim() || 'You are a sales prospect in a roleplay. Stay in character.',
            llm: 'gpt-4o-mini',
            temperature: 0.7,
          },
        },
        tts: { voice_id: 'EXAVITQu4vr4xnSDxMaL', model_id: 'eleven_turbo_v2' },
      },
    };
    try {
      await voiceApi.createAgent(payload);
      toast.success('Agent created');
      setNewName('');
      setNewPrompt('');
      setCreating(false);
      load();
    } catch {
      toast.error('Failed to create agent');
    }
  };

  const handleDelete = async (agentId: string) => {
    try {
      await voiceApi.deleteAgent(agentId);
      setAgents(a => a.filter(x => x.agent_id !== agentId));
      toast.success('Agent deleted');
    } catch {
      toast.error('Failed to delete agent');
    }
  };

  const handleUpdate = async (agentId: string, name: string) => {
    try {
      await voiceApi.updateAgent(agentId, { name });
      setAgents(a => a.map(x => x.agent_id === agentId ? { ...x, name } : x));
      toast.success('Agent updated');
    } catch {
      toast.error('Failed to update agent');
    }
  };

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[color:var(--text3)]">
          Agents are managed server-side using your ElevenLabs API key.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="icon-btn"
            aria-label="Refresh agents list"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setCreating(v => !v)}
            className="btn-primary py-1.5 px-3 text-[12px] gap-1.5"
          >
            <Plus size={12} aria-hidden="true" /> New Agent
          </button>
        </div>
      </div>

      {creating && (
        <div className="flex flex-col gap-3 p-4 rounded-[10px] border border-border bg-bg-3">
          <div>
            <label htmlFor="new-agent-name" className="sr-only">Agent name</label>
            <input
              id="new-agent-name"
              className="input-base text-[12.5px]"
              placeholder="Agent name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="new-agent-prompt" className="sr-only">System prompt</label>
            <textarea
              id="new-agent-prompt"
              className="input-base text-[12.5px] resize-none"
              placeholder="System prompt (optional — defaults to generic sales roleplay)"
              rows={3}
              value={newPrompt}
              onChange={e => setNewPrompt(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setCreating(false)} className="btn-ghost py-1.5 px-3 text-[12px]">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="btn-primary py-1.5 px-3 text-[12px]"
              disabled={!newName.trim()}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[12px] text-center py-4 text-[color:var(--text3)]">Loading agents…</div>
      ) : agents.length === 0 ? (
        <div className="text-[12px] text-center py-4 text-[color:var(--text3)]">
          No agents yet. A default agent is auto-created on the first call session.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {agents.map(a => (
            <AgentRow key={a.agent_id} agent={a} onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Usage / cost panel ────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, string> = {
  gemini:              'Gemini AI',
  elevenlabs_tts:      'ElevenLabs TTS',
  elevenlabs_convai:   'ElevenLabs ConvAI',
};

function UsagePanel() {
  const [data, setData]       = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]       = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await usageApi.getSummary(days));
    } catch {
      toast.error('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => `$${n.toFixed(4)}`;

  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {([7, 30, 90] as const).map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-colors ${days === d ? 'bg-accent/20 text-accent' : 'text-[color:var(--text3)] hover:text-[color:var(--text2)]'}`}
            >
              {d}d
            </button>
          ))}
        </div>
        <button type="button" onClick={load} className="icon-btn" aria-label="Refresh usage data">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="text-[12px] text-center py-4 text-[color:var(--text3)]">Loading…</div>
      ) : data ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Total cost', value: fmt(data.totals.totalCostUsd) },
              { label: 'API calls', value: data.totals.requestCount?.toLocaleString() ?? '0' },
              { label: 'Call minutes', value: (data.totals.convaiMinutes ?? 0).toFixed(1) },
              { label: 'TTS chars', value: (data.totals.ttsCharacters ?? 0).toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-[10px] border border-border bg-bg-2 text-center">
                <div className="text-[11px] text-[color:var(--text3)] mb-1">{label}</div>
                <div className="text-[15px] font-bold font-mono">{value}</div>
              </div>
            ))}
          </div>

          {/* By service */}
          {data.byService.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text3)]">By Service</div>
              {data.byService.map(s => (
                <div key={s._id} className="flex items-center justify-between px-3 py-2 rounded-[8px] border border-border bg-bg-2">
                  <div>
                    <span className="text-[12px] font-medium">{SERVICE_LABELS[s._id] ?? s._id}</span>
                    <span className="ml-2 text-[10.5px] text-[color:var(--text3)]">{s.requestCount} calls</span>
                  </div>
                  <span className="text-[12px] font-mono font-semibold text-accent">{fmt(s.costUsd)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pricing reference */}
          <div className="text-[10.5px] text-[color:var(--text3)] leading-relaxed p-3 rounded-[8px] bg-bg-3">
            Pricing estimates: Gemini 2.0 Flash ${data.pricing.geminiInputPerMToken}/M input · ${data.pricing.geminiOutputPerMToken}/M output · ElevenLabs TTS ${data.pricing.ttsPerKChars}/K chars · ConvAI ${data.pricing.convaiPerMinute}/min
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Main settings page ────────────────────────────────────────────────────────

export function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const [voiceProvider, setVoiceProvider] = useState('elevenlabs');
  const [latencyMode, setLatencyMode] = useState('ultra');
  const [defaultFramework, setDefaultFramework] = useState<'MEDDIC' | 'MEDDICC' | 'SPIN' | 'BANT' | 'CHALLENGER' | 'SNAP'>(
    (user?.company?.defaultFramework as 'MEDDIC' | 'MEDDICC' | 'SPIN' | 'BANT' | 'CHALLENGER' | 'SNAP') || 'MEDDIC'
  );
  const [passThreshold, setPassThreshold] = useState(user?.company?.passThreshold || 70);

  const save = () => { toast.success('Settings saved'); };

  const isAdminOrAbove = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'MANAGER';

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* ElevenLabs Agent Management */}
      {isAdminOrAbove && (
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-accent" aria-hidden="true" />
              <span className="font-display text-[14px] font-bold">ElevenLabs Agents</span>
            </div>
            <a
              href="https://elevenlabs.io/app/conversational-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-accent/70 hover:text-accent transition-colors"
            >
              elevenlabs.io ↗
            </a>
          </div>
          <AgentsManager />
        </div>
      )}

      {/* Voice Engine */}
      <div className="card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Zap size={14} className="text-accent-3" aria-hidden="true" />
          <span className="font-display text-[14px] font-bold">Voice Engine</span>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <fieldset>
            <legend className="text-xs font-medium mb-2 text-[color:var(--text2)]">TTS Provider</legend>
            <div className="flex flex-col sm:flex-row gap-2">
              {([
                ['elevenlabs', 'ElevenLabs', 'Lowest latency · Best quality'],
                ['google', 'Google TTS', 'Fast · Reliable'],
              ] as const).map(([v, label, desc]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVoiceProvider(v)}
                  className={`flex-1 p-3 rounded-[10px] border text-left transition-all ${voiceProvider === v ? 'border-accent bg-accent/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'}`}
                  aria-pressed={voiceProvider === v ? 'true' : 'false'}
                >
                  <div className="text-[13px] font-semibold mb-0.5">{label}</div>
                  <div className="text-[11px] text-[color:var(--text3)]">{desc}</div>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-medium mb-2 text-[color:var(--text2)]">Latency Mode</legend>
            <div className="flex flex-col sm:flex-row gap-2">
              {([
                ['ultra', 'Ultra Low (Streaming)'],
                ['balanced', 'Balanced'],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLatencyMode(v)}
                  className={`flex-1 p-3 rounded-[10px] border text-left transition-all text-[13px] font-medium ${latencyMode === v ? 'border-accent bg-accent/10 text-accent' : 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'}`}
                  aria-pressed={latencyMode === v ? 'true' : 'false'}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      {/* Company */}
      <div className="card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Globe size={14} className="text-accent-3" aria-hidden="true" />
          <span className="font-display text-[14px] font-bold">Company Defaults</span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label htmlFor="default-framework" className="text-xs font-medium block mb-1.5 text-[color:var(--text2)]">
              Default Framework
            </label>
            <select
              id="default-framework"
              value={defaultFramework}
              onChange={e => setDefaultFramework(e.target.value as typeof defaultFramework)}
              className="input-base max-w-xs"
            >
              {['MEDDIC', 'MEDDICC', 'SPIN', 'BANT', 'CHALLENGER', 'SNAP'].map(fw => (
                <option key={fw} value={fw}>{fw}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pass-threshold" className="text-xs font-medium block mb-1.5 text-[color:var(--text2)]">
              Pass Threshold: <span className="text-accent font-bold">{passThreshold}/100</span>
            </label>
            <input
              id="pass-threshold"
              type="range"
              min={50}
              max={90}
              step={5}
              value={passThreshold}
              onChange={e => setPassThreshold(Number(e.target.value))}
              className="w-full max-w-xs"
            />
          </div>
        </div>
      </div>

      {/* Evaluation Prompts */}
      <div className="card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <FileText size={14} className="text-accent" aria-hidden="true" />
          <span className="font-display text-[14px] font-bold">Evaluation Prompts</span>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] mb-4 text-[color:var(--text3)]">
            Configure the AI scoring rubric and prompt template used to evaluate each roleplay type.
          </p>
          <button
            type="button"
            onClick={() => navigate('/settings/evaluation-prompts')}
            className="flex items-center justify-between w-full p-3.5 rounded-[12px] border border-border-2 bg-bg-2 transition-all hover:border-[rgba(91,111,255,0.4)] hover:bg-[rgba(91,111,255,0.04)] group"
          >
            <div className="flex items-center gap-3">
              <FileText size={14} className="text-accent" aria-hidden="true" />
              <div className="text-left">
                <div className="text-[13px] font-semibold">Manage Evaluation Prompts</div>
                <div className="text-[11px] mt-0.5 text-[color:var(--text3)]">7 roleplay types · Cold Call, Discovery, Sales Pitch and more</div>
              </div>
            </div>
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform text-[color:var(--text3)]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Usage & Costs */}
      {isAdminOrAbove && (
        <div className="card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <DollarSign size={14} className="text-accent-5" aria-hidden="true" />
            <span className="font-display text-[14px] font-bold">API Usage &amp; Estimated Costs</span>
            <TrendingUp size={11} className="text-[color:var(--text3)] ml-auto" aria-hidden="true" />
          </div>
          <UsagePanel />
        </div>
      )}

      {/* Account */}
      <div className="card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Shield size={14} className="text-accent-5" aria-hidden="true" />
          <span className="font-display text-[14px] font-bold">Account</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[color:var(--text2)]">Email</span>
              <div className="font-medium mt-0.5">{user?.email}</div>
            </div>
            <div>
              <span className="text-[color:var(--text2)]">Role</span>
              <div className="font-medium mt-0.5 capitalize">{user?.role?.toLowerCase().replace(/_/g, ' ')}</div>
            </div>
            <div>
              <span className="text-[color:var(--text2)]">Company</span>
              <div className="font-medium mt-0.5">{user?.company?.name || '—'}</div>
            </div>
          </div>
        </div>
      </div>

      <button type="button" onClick={save} className="btn-primary w-fit gap-2">
        <Save size={13} aria-hidden="true" /> Save Changes
      </button>
    </div>
  );
}
