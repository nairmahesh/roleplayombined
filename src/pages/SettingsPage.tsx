// pitchiq/frontend/src/pages/SettingsPage.tsx

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';
import { Save, Zap, Globe, Shield } from 'lucide-react';

export function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const [voiceProvider, setVoiceProvider] = useState('elevenlabs');
  const [latencyMode, setLatencyMode] = useState('ultra');
  const [defaultFramework, setDefaultFramework] = useState<'MEDDIC' | 'MEDDICC' | 'SPIN' | 'BANT' | 'CHALLENGER' | 'SNAP'>(
    (user?.company?.defaultFramework as 'MEDDIC' | 'MEDDICC' | 'SPIN' | 'BANT' | 'CHALLENGER' | 'SNAP') || 'MEDDIC'
  );
  const [passThreshold, setPassThreshold] = useState(user?.company?.passThreshold || 70);

  const save = () => toast.success('Settings saved');

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Voice */}
      <div className="card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
          <Zap size={14} className="text-accent" />
          <span className="font-display text-[14px] font-bold">Voice Engine</span>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <div>
            <label className="text-xs font-medium text-white/70 block mb-2">TTS Provider</label>
            <div className="flex flex-col sm:flex-row gap-2">
              {[['elevenlabs', 'ElevenLabs', 'Lowest latency · Best quality'], ['google', 'Google TTS', 'Fast · Reliable']].map(([v, label, desc]) => (
                <button
                  key={v}
                  onClick={() => setVoiceProvider(v)}
                  className={`flex-1 p-3 rounded-[10px] border text-left transition-all ${voiceProvider === v ? 'border-accent bg-accent/10' : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]'}`}
                >
                  <div className="text-[13px] font-semibold mb-0.5">{label}</div>
                  <div className="text-[11px] text-white/80">{desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-2">Latency Mode</label>
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
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
          <Globe size={14} className="text-accent-3" />
          <span className="font-display text-[14px] font-bold">Company Defaults</span>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1.5">Default Framework</label>
            <select value={defaultFramework} onChange={e => setDefaultFramework(e.target.value as any)} className="input-base max-w-xs">
              {['MEDDIC', 'MEDDICC', 'SPIN', 'BANT', 'CHALLENGER', 'SNAP'].map(fw => (
                <option key={fw} value={fw}>{fw}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-white/70 block mb-1.5">
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
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
          <Shield size={14} className="text-accent-5" />
          <span className="font-display text-[14px] font-bold">Account</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="text-white/80">Email</span><div className="font-medium mt-0.5">{user?.email}</div></div>
            <div><span className="text-white/80">Role</span><div className="font-medium mt-0.5 capitalize">{user?.role?.toLowerCase().replace(/_/g, ' ')}</div></div>
            <div><span className="text-white/80">Company</span><div className="font-medium mt-0.5">{user?.company?.name || '—'}</div></div>
          </div>
        </div>
      </div>

      <button onClick={save} className="btn-primary w-fit gap-2">
        <Save size={13} /> Save Changes
      </button>
    </div>
  );
}
