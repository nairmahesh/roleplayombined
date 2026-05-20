import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore, useElevenLabsStore } from '@/lib/store';
import { Save, Zap, Globe, Shield, Eye, EyeOff, ExternalLink } from 'lucide-react';

export function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const { agentId, apiKey, setAgentId, setApiKey } = useElevenLabsStore();

  const [voiceProvider, setVoiceProvider] = useState('elevenlabs');
  const [latencyMode, setLatencyMode] = useState('ultra');
  const [defaultFramework, setDefaultFramework] = useState<'MEDDIC' | 'MEDDICC' | 'SPIN' | 'BANT' | 'CHALLENGER' | 'SNAP'>(
    (user?.company?.defaultFramework as 'MEDDIC' | 'MEDDICC' | 'SPIN' | 'BANT' | 'CHALLENGER' | 'SNAP') || 'MEDDIC'
  );
  const [passThreshold, setPassThreshold] = useState(user?.company?.passThreshold || 70);

  const [localAgentId, setLocalAgentId] = useState(agentId);
  const [localApiKey, setLocalApiKey]   = useState(apiKey);
  const [showApiKey, setShowApiKey]     = useState(false);

  const save = () => {
    setAgentId(localAgentId.trim());
    setApiKey(localApiKey.trim());
    toast.success('Settings saved');
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* ElevenLabs Credentials */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-accent" />
            <span className="font-display text-[14px] font-bold">ElevenLabs</span>
          </div>
          <a
            href="https://elevenlabs.io/app/conversational-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-accent/70 hover:text-accent transition-colors"
          >
            Dashboard <ExternalLink size={10} />
          </a>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>
              Agent ID
              <span className="ml-1.5 font-normal text-[10px]" style={{ color: 'var(--text3)' }}>
                — from your Conversational AI agent page
              </span>
            </label>
            <input
              type="text"
              value={localAgentId}
              onChange={e => setLocalAgentId(e.target.value)}
              placeholder="e.g. agent_01jx…"
              className="input-base font-mono text-[12.5px]"
              spellCheck={false}
            />
            {!localAgentId.trim() && (
              <p className="text-[10.5px] mt-1.5 text-amber-400/70">
                Required — calls won't connect without an Agent ID.
              </p>
            )}
            {localAgentId.trim() && (
              <p className="text-[10.5px] mt-1.5" style={{ color: 'var(--text3)' }}>
                Agent ID configured.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>
              API Key
              <span className="ml-1.5 font-normal text-[10px]" style={{ color: 'var(--text3)' }}>
                — for voice previews and loading your voice library
              </span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={localApiKey}
                onChange={e => setLocalApiKey(e.target.value)}
                placeholder="sk_…"
                className="input-base font-mono text-[12.5px] pr-10"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text3)' }}
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {!localApiKey.trim() && (
              <p className="text-[10.5px] mt-1.5 text-amber-400/70">
                Without an API key, voice previews and loading your voice library will not work.
              </p>
            )}
          </div>

          <div className="p-3 rounded-[10px] border text-[11.5px] leading-relaxed" style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text3)' }}>
            Get your Agent ID from{' '}
            <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener noreferrer" className="text-accent/80 hover:text-accent underline">
              ElevenLabs Conversational AI
            </a>
            {' '}and your API key from{' '}
            <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent/80 hover:text-accent underline">
              API Keys settings
            </a>.
            These are stored locally in your browser only.
          </div>
        </div>
      </div>

      {/* Voice Engine */}
      <div className="card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <Zap size={14} className="text-accent-3" />
          <span className="font-display text-[14px] font-bold">Voice Engine</span>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text2)' }}>TTS Provider</label>
            <div className="flex flex-col sm:flex-row gap-2">
              {[['elevenlabs', 'ElevenLabs', 'Lowest latency · Best quality'], ['google', 'Google TTS', 'Fast · Reliable']].map(([v, label, desc]) => (
                <button
                  key={v}
                  onClick={() => setVoiceProvider(v)}
                  className={`flex-1 p-3 rounded-[10px] border text-left transition-all ${voiceProvider === v ? 'border-accent bg-accent/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'}`}
                >
                  <div className="text-[13px] font-semibold mb-0.5">{label}</div>
                  <div className="text-[11px]" style={{ color: 'var(--text3)' }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text2)' }}>Latency Mode</label>
            <div className="flex flex-col sm:flex-row gap-2">
              {[['ultra', 'Ultra Low (Streaming)', 'accent-3'], ['balanced', 'Balanced', 'accent-5']].map(([v, label, color]) => (
                <button
                  key={v}
                  onClick={() => setLatencyMode(v)}
                  className={`flex-1 p-3 rounded-[10px] border text-left transition-all text-[13px] font-medium ${latencyMode === v ? `border-${color} bg-${color}/10 text-${color}` : 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Company */}
      <div className="card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <Globe size={14} className="text-accent-3" />
          <span className="font-display text-[14px] font-bold">Company Defaults</span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>Default Framework</label>
            <select value={defaultFramework} onChange={e => setDefaultFramework(e.target.value as any)} className="input-base max-w-xs">
              {['MEDDIC', 'MEDDICC', 'SPIN', 'BANT', 'CHALLENGER', 'SNAP'].map(fw => (
                <option key={fw} value={fw}>{fw}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text2)' }}>
              Pass Threshold: <span className="text-accent font-bold">{passThreshold}/100</span>
            </label>
            <input
              type="range" min={50} max={90} step={5}
              value={passThreshold}
              onChange={e => setPassThreshold(Number(e.target.value))}
              className="w-full max-w-xs"
            />
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border)]">
          <Shield size={14} className="text-accent-5" />
          <span className="font-display text-[14px] font-bold">Account</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span style={{ color: 'var(--text2)' }}>Email</span><div className="font-medium mt-0.5">{user?.email}</div></div>
            <div><span style={{ color: 'var(--text2)' }}>Role</span><div className="font-medium mt-0.5 capitalize">{user?.role?.toLowerCase().replace(/_/g, ' ')}</div></div>
            <div><span style={{ color: 'var(--text2)' }}>Company</span><div className="font-medium mt-0.5">{user?.company?.name || '—'}</div></div>
          </div>
        </div>
      </div>

      <button onClick={save} className="btn-primary w-fit gap-2">
        <Save size={13} /> Save Changes
      </button>
    </div>
  );
}
