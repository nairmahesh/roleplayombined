import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Bot, Plus, Trash2, CreditCard as Edit2, X, Check, RefreshCw, Zap, Link2, CircleAlert as AlertCircle } from 'lucide-react';
import { voiceApi, superadminApi, VoiceAgentSummary, VoiceAgentConfig } from '@/lib/api';

// ── Agent row ──────────────────────────────────────────────────────────────────

function AgentRow({
  agent,
  isDefault,
  onDelete,
  onUpdate,
}: {
  agent: VoiceAgentSummary;
  isDefault: boolean;
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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3.5 rounded-[12px] border border-border bg-bg-2"
    >
      <div className="w-8 h-8 rounded-[8px] bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
        <Bot size={14} className="text-accent" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            className="input-base text-[13px] w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            aria-label="Agent name"
            autoFocus
          />
        ) : (
          <>
            <div className="flex items-center gap-2 truncate">
              <div className="text-[13.5px] font-medium truncate">{agent.name}</div>
              {isDefault && (
                <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                  default
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono truncate text-[color:var(--text3)] mt-0.5">{agent.agent_id}</div>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {editing ? (
          <>
            <button type="button" onClick={save} className="icon-btn text-green-400" aria-label="Save agent name">
              <Check size={14} />
            </button>
            <button type="button" onClick={cancel} className="icon-btn" aria-label="Cancel editing">
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEditing(true)} className="icon-btn" aria-label={`Rename ${agent.name}`}>
              <Edit2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(agent.agent_id)}
              disabled={isDefault}
              title={isDefault ? 'Cannot delete the default voice agent' : `Delete ${agent.name}`}
              className="icon-btn text-red-400/70 hover:text-red-400 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:text-red-400/70"
              aria-label={`Delete ${agent.name}`}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function SuperAdminAgentsPage() {
  const [agents, setAgents]         = useState<VoiceAgentSummary[]>([]);
  const [defaultAgentId, setDefaultAgentId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [saving, setSaving]     = useState(false);
  const [syncing, setSyncing]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await voiceApi.listAgents();
      setAgents(result.agents);
      setDefaultAgentId(result.defaultAgentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load agents';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const payload: VoiceAgentConfig = {
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
      toast.success('Voice agent created');
      setNewName('');
      setNewPrompt('');
      setCreating(false);
      load();
    } catch {
      toast.error('Failed to create voice agent — check your ElevenLabs plan (Creator+ required for ConvAI)');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agentId: string) => {
    try {
      await voiceApi.deleteAgent(agentId);
      setAgents(a => a.filter(x => x.agent_id !== agentId));
      toast.success('Voice agent deleted');
    } catch {
      toast.error('Failed to delete voice agent');
    }
  };

  const handleSyncPersonas = async () => {
    setSyncing(true);
    try {
      const result = await superadminApi.syncPersonaAgents();
      const created = result.results.filter(r => r.status === 'created').length;
      const skipped = result.results.filter(r => r.status === 'already_set').length;
      toast.success(`Sync complete: ${created} agents created, ${skipped} already set`);
      load(); // refresh agent list
    } catch {
      toast.error('Sync failed — check ElevenLabs ConvAI access');
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdate = async (agentId: string, name: string) => {
    try {
      await voiceApi.updateAgent(agentId, { name });
      setAgents(a => a.map(x => x.agent_id === agentId ? { ...x, name } : x));
      toast.success('Voice agent renamed');
    } catch {
      toast.error('Failed to rename voice agent');
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="font-display text-xl font-bold">ElevenLabs Voice Agents</h2>
        <p className="text-sm text-white/70 mt-0.5">
          Manage ConvAI voice agents used during live practice sessions.
          Requires ElevenLabs Creator plan or above.
        </p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-accent" aria-hidden="true" />
            <span className="font-display text-[14px] font-bold">Voice Agents</span>
            {!loading && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-semibold">
                {agents.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} className="icon-btn" aria-label="Refresh agents">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={handleSyncPersonas}
              disabled={syncing}
              className="btn-ghost py-1.5 px-3 text-[12px] gap-1.5"
              title="Create ElevenLabs agents for personas that don't have one yet"
            >
              <Link2 size={12} aria-hidden="true" />
              {syncing ? 'Syncing…' : 'Sync Personas'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(v => !v)}
              className="btn-primary py-1.5 px-3 text-[12px] gap-1.5"
            >
              <Plus size={12} aria-hidden="true" /> New Voice Agent
            </button>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {creating && (
            <div className="flex flex-col gap-3 p-4 rounded-[12px] border border-accent/25 bg-accent/5">
              <div className="text-[12px] font-semibold text-accent mb-1">New Voice Agent</div>
              <div>
                <label htmlFor="agent-name" className="sr-only">Agent name</label>
                <input
                  id="agent-name"
                  className="input-base text-[13px]"
                  placeholder="Voice agent name (e.g. Outbound SDR — Skeptical)"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) handleCreate(); }}
                />
              </div>
              <div>
                <label htmlFor="agent-prompt" className="sr-only">System prompt</label>
                <textarea
                  id="agent-prompt"
                  className="input-base text-[13px] resize-none"
                  placeholder="System prompt — leave blank for the default sales roleplay prompt"
                  rows={4}
                  value={newPrompt}
                  onChange={e => setNewPrompt(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setCreating(false); setNewName(''); setNewPrompt(''); }} className="btn-ghost py-1.5 px-3 text-[12px]">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="btn-primary py-1.5 px-3 text-[12px]"
                  disabled={!newName.trim() || saving}
                >
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-[12px] text-center py-8 text-[color:var(--text3)]">
              <RefreshCw size={16} className="animate-spin mx-auto mb-2 text-accent/50" />
              Loading agents…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle size={18} className="text-red-400" />
              </div>
              <div>
                <div className="text-[13px] font-medium text-red-400">Could not connect to backend</div>
                <div className="text-[11.5px] text-[color:var(--text3)] mt-1 max-w-xs">
                  ElevenLabs agent management requires the backend server. Make sure the API is running and reachable.
                </div>
              </div>
              <button type="button" onClick={load} className="btn-ghost py-1.5 px-3 text-[12px] gap-1.5 mt-1">
                <RefreshCw size={12} /> Retry
              </button>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 flex flex-col items-center gap-2 text-[color:var(--text3)]">
              <Bot size={24} className="opacity-30" />
              <div className="text-[12.5px]">No voice agents yet.</div>
              <div className="text-[11px]">A default voice agent is auto-created on the first call session if ConvAI is available.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {agents.map(a => (
                <AgentRow key={a.agent_id} agent={a} isDefault={a.agent_id === defaultAgentId} onDelete={handleDelete} onUpdate={handleUpdate} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
