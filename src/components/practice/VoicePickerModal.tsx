import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Play, Square, Star, RefreshCw, Check, ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { AVATAR_VOICE_CONFIG, AVATARS, type AvatarId } from './PersonaAvatars';
import { CURATED_VOICES } from './VoicePicker';
import clsx from 'clsx';

interface Voice {
  id: string;
  name: string;
  gender: string;
  accent: string;
  style: string;
  preview_url?: string;
  source: 'library' | 'curated' | 'regional';
}

const GENDER_OPTIONS   = ['Any', 'Male', 'Female'];
const ACCENT_OPTIONS   = ['Any', 'American', 'British', 'Australian', 'Irish', 'Scottish', 'Indian', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Arabic', 'Japanese', 'Chinese'];
const TONE_OPTIONS     = ['Any', 'Professional', 'Conversational', 'Authoritative', 'Warm', 'Energetic', 'Calm', 'Casual', 'Friendly', 'Assertive', 'Narration', 'News', 'Characters'];

const PREVIEW_TEXT = "Hi, great to connect. I've got a few minutes — what would you like to cover?";

function normalise(s: string) { return s.toLowerCase().trim(); }
function matches(value: string, filter: string) {
  if (filter === 'any') return true;
  return normalise(value).includes(normalise(filter));
}

export function VoicePickerModal({
  avatarId,
  value,
  onSelect,
  onClose,
}: {
  avatarId?: string;
  value?: string;
  onSelect: (id: string | undefined) => void;
  onClose: () => void;
}) {
  const [search, setSearch]         = useState('');
  const [genderFilter, setGender]   = useState('Any');
  const [accentFilter, setAccent]   = useState('Any');
  const [toneFilter, setTone]       = useState('Any');

  const [voices, setVoices]         = useState<Voice[]>([]);
  const [loading, setLoading]       = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const avatar      = AVATARS.find(a => a.id === avatarId);
  const recommendedId = avatarId ? AVATAR_VOICE_CONFIG[avatarId as AvatarId]?.elevenlabsId : undefined;

  // ── Load voices ─────────────────────────────────────────────────────────────
  const loadVoices = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Account library voices
      let libraryVoices: Voice[] = [];
      try {
        const libRes = await api.get('/voice/voices');
        const raw = (libRes.data as any)?.voices ?? [];
        libraryVoices = raw.map((v: any) => ({
          id: v.voice_id,
          name: v.name,
          gender: ((v.labels?.gender) || '').toLowerCase(),
          accent: v.labels?.accent || '',
          style:  v.labels?.use_case || v.labels?.description || '',
          preview_url: v.preview_url ?? undefined,
          source: 'library' as const,
        }));
      } catch { /* no API key */ }

      // 2. Curated fallbacks — merge with library, library wins on duplicates
      const libraryIds = new Set(libraryVoices.map(v => v.id));
      const curated: Voice[] = CURATED_VOICES
        .filter(v => !libraryIds.has(v.id))
        .map(v => ({ ...v, source: 'curated' as const }));

      setVoices([...libraryVoices, ...curated]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVoices(); }, [loadVoices]);

  // ── Regional voices fetch when accent filter changes ─────────────────────────
  useEffect(() => {
    if (accentFilter === 'Any' || ['American','British','Australian','Irish','Scottish'].includes(accentFilter)) return;
    const genderParam = genderFilter === 'Any' ? '' : genderFilter.toLowerCase();
    api.get('/voice/library', { params: { accent: accentFilter, gender: genderParam } })
      .then((res: any) => {
        const regional: Voice[] = (res.data as any[]).map((v: any) => ({
          id: v.id,
          name: v.name,
          gender: v.gender,
          accent: v.accent,
          style: '',
          preview_url: v.preview_url ?? undefined,
          source: 'regional' as const,
        }));
        setVoices(prev => {
          const existingIds = new Set(prev.map(v => v.id));
          return [...prev, ...regional.filter(v => !existingIds.has(v.id))];
        });
      })
      .catch(() => {});
  }, [accentFilter, genderFilter]);

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = voices.filter(v => {
    if (!matches(v.gender || '', genderFilter)) return false;
    if (!matches(v.accent || '', accentFilter)) return false;
    if (!matches(v.style  || '', toneFilter))   return false;
    if (search.trim()) {
      const q = normalise(search);
      return normalise(v.name).includes(q) || normalise(v.accent).includes(q) || normalise(v.style).includes(q);
    }
    return true;
  });

  // Recommended first, then the rest sorted alphabetically
  const sorted = [
    ...filtered.filter(v => v.id === recommendedId),
    ...filtered.filter(v => v.id !== recommendedId).sort((a, b) => a.name.localeCompare(b.name)),
  ];

  // ── Preview ──────────────────────────────────────────────────────────────────
  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewing(null);
  };

  const playPreview = async (v: Voice) => {
    if (previewing === v.id) { stopPreview(); return; }
    stopPreview();
    setPreviewErr(null);
    setPreviewing(v.id);

    if (v.preview_url) {
      const audio = new Audio(v.preview_url);
      audioRef.current = audio;
      audio.onended = () => { setPreviewing(null); audioRef.current = null; };
      audio.onerror = () => { setPreviewing(null); audioRef.current = null; setPreviewErr(v.id); };
      audio.play().catch(() => { setPreviewing(null); setPreviewErr(v.id); });
      return;
    }
    // Fall back to TTS endpoint
    try {
      const res = await api.post(`/voice/tts/${v.id}`, { text: PREVIEW_TEXT }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPreviewing(null); audioRef.current = null; };
      audio.onerror = () => { URL.revokeObjectURL(url); setPreviewing(null); audioRef.current = null; setPreviewErr(v.id); };
      audio.play();
    } catch { setPreviewing(null); setPreviewErr(v.id); }
  };

  // ── Select ───────────────────────────────────────────────────────────────────
  const selectVoice = (v: Voice) => {
    stopPreview();
    // If it's a regional (shared) voice, add to library in bg
    if (v.source === 'regional') {
      api.get('/voice/library', { params: { accent: v.accent, gender: v.gender } })
        .then((res: any) => {
          const match = (res.data as any[]).find((r: any) => r.id === v.id);
          if (match?.public_owner_id) {
            api.post(`/voice/library/add/${match.public_owner_id}/${v.id}`).catch(() => {});
          }
        }).catch(() => {});
    }
    onSelect(v.id);
    onClose();
  };

  // ── Keyboard close ───────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { stopPreview(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => { stopPreview(); onClose(); }}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[16px] border overflow-hidden"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="font-display font-bold text-[15px]">Choose Voice</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              {voices.length} voices loaded{avatar ? ` · Persona: ${avatar.name.split(' ')[0]}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadVoices()}
              disabled={loading}
              title="Reload voices"
              className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ borderColor: 'var(--border2)', color: 'var(--text3)' }}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => { stopPreview(); onClose(); }}
              className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors"
              style={{ borderColor: 'var(--border2)', color: 'var(--text3)' }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 flex flex-wrap gap-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg3)' }}>
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text3)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, accent…"
              className="input-base pl-7 text-[12px] w-full h-8"
            />
          </div>
          <FilterSelect label="Gender" options={GENDER_OPTIONS} value={genderFilter} onChange={setGender} />
          <FilterSelect label="Accent" options={ACCENT_OPTIONS} value={accentFilter} onChange={setAccent} />
          <FilterSelect label="Tone"   options={TONE_OPTIONS}   value={toneFilter}   onChange={setTone} />
        </div>

        {/* Results count */}
        <div className="px-5 py-2 flex items-center justify-between" style={{ background: 'var(--bg3)', borderBottom: `1px solid var(--border)` }}>
          <span className="text-[10.5px]" style={{ color: 'var(--text3)' }}>
            {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          </span>
          {value && (
            <button
              onClick={() => { stopPreview(); onSelect(undefined); onClose(); }}
              className="text-[10.5px] transition-colors hover:opacity-80"
              style={{ color: 'var(--text3)' }}
            >
              Clear selection
            </button>
          )}
        </div>

        {/* Voice list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--text3)' }} />
              <span className="ml-2 text-[12px]" style={{ color: 'var(--text3)' }}>Loading voices…</span>
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[13px]" style={{ color: 'var(--text3)' }}>No voices match your filters.</p>
              <button onClick={() => { setSearch(''); setGender('Any'); setAccent('Any'); setTone('Any'); }} className="mt-2 text-[11px] text-accent hover:opacity-80 transition-opacity">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {sorted.map(v => (
                <VoiceCard
                  key={v.id}
                  voice={v}
                  isSelected={value === v.id}
                  isRecommended={v.id === recommendedId}
                  isPreviewing={previewing === v.id}
                  hasError={previewErr === v.id}
                  onSelect={() => selectVoice(v)}
                  onPreview={() => playPreview(v)}
                />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FilterSelect({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative flex items-center gap-1 h-8">
      <span className="text-[10px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--text3)' }}>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input-base h-8 text-[12px] pr-6 pl-2 appearance-none cursor-pointer min-w-[90px]"
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text3)' }} />
      </div>
    </div>
  );
}

function VoiceCard({ voice, isSelected, isRecommended, isPreviewing, hasError, onSelect, onPreview }: {
  voice: Voice;
  isSelected: boolean;
  isRecommended: boolean;
  isPreviewing: boolean;
  hasError: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const genderColor = voice.gender === 'female' ? 'text-pink-400/70' : voice.gender === 'male' ? 'text-sky-400/70' : 'text-white/50';

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'flex items-center gap-3 p-2.5 rounded-[10px] border cursor-pointer transition-all select-none group',
        isSelected
          ? 'border-accent bg-accent/[0.08]'
          : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]',
      )}
      style={{ borderColor: isSelected ? undefined : 'var(--border)' }}
    >
      {/* Selection indicator */}
      <div className={clsx(
        'w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
        isSelected ? 'border-accent bg-accent' : 'border-white/20 group-hover:border-white/40'
      )}>
        {isSelected && <Check size={8} className="text-white" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx('text-[12.5px] font-semibold truncate', isSelected ? 'text-accent' : 'text-white/90')}>
            {voice.name}
          </span>
          {isRecommended && (
            <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent/80 font-bold uppercase tracking-wide leading-none flex-shrink-0">
              <Star size={6} /> Pick
            </span>
          )}
          {voice.source === 'library' && !isRecommended && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-white/40 font-medium uppercase tracking-wide leading-none flex-shrink-0">
              My Library
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {voice.gender && <span className={clsx('text-[9.5px] font-medium capitalize', genderColor)}>{voice.gender}</span>}
          {voice.accent && <span className="text-[9.5px] text-white/45 truncate">{voice.accent}</span>}
          {voice.style  && <span className="text-[9.5px] text-white/35 truncate">· {voice.style}</span>}
        </div>
        {hasError && <p className="text-[9px] text-red-400/70 mt-0.5">Preview unavailable</p>}
      </div>

      {/* Preview button */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onPreview(); }}
        title={isPreviewing ? 'Stop' : 'Preview'}
        className={clsx(
          'w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
          isPreviewing
            ? 'border-accent-3 bg-accent-3/15 text-accent-3'
            : 'border-white/15 text-white/50 hover:border-accent hover:text-accent hover:bg-accent/10'
        )}
      >
        {isPreviewing ? <Square size={8} fill="currentColor" /> : <Play size={9} />}
      </button>
    </div>
  );
}
