import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Play, Square, Star, RefreshCw, Check, ChevronDown, Loader } from 'lucide-react';
import { api } from '@/lib/api';
import { AVATAR_VOICE_CONFIG, AVATARS, type AvatarId } from './PersonaAvatars';
import { CURATED_VOICES } from './VoicePicker';
import clsx from 'clsx';

export interface VoiceEntry {
  id: string;
  name: string;
  gender: string;   // lowercase: 'male' | 'female' | ''
  accent: string;
  style: string;
  preview_url?: string;
  source: 'library' | 'curated' | 'regional';
}

// All unique accents present across curated voices + extra EL shared library ones
const ACCENT_OPTIONS = [
  'Any',
  'American', 'British', 'Australian', 'Irish', 'Scottish',
  'Indian', 'Spanish', 'French', 'German', 'Italian',
  'Portuguese', 'Arabic', 'Japanese', 'Chinese',
];

// These accents require a live ElevenLabs shared-library search
const REGIONAL_ACCENTS = new Set(['Indian','Spanish','French','German','Italian','Portuguese','Arabic','Japanese','Chinese']);

const TONE_OPTIONS = [
  'Any',
  'Professional', 'Conversational', 'Authoritative', 'Warm',
  'Energetic', 'Calm', 'Casual', 'Friendly', 'Assertive',
  'Narration', 'News', 'Characters',
];

const PREVIEW_TEXT = "Hi, great to connect. I've got a few minutes — what would you like to cover?";

function norm(s: string) { return (s ?? '').toLowerCase().trim(); }

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
  const [search, setSearch]       = useState('');
  const [gender, setGender]       = useState<'Any'|'Male'|'Female'>('Any');
  const [accent, setAccent]       = useState('Any');
  const [tone, setTone]           = useState('Any');

  // All voices: curated + library account + fetched regional
  const [voices, setVoices]       = useState<VoiceEntry[]>(() =>
    CURATED_VOICES.map(v => ({ ...v, source: 'curated' as const }))
  );
  const [loadingLib, setLoadingLib]         = useState(false);
  const [loadingRegional, setLoadingRegional] = useState(false);
  const fetchedRegional = useRef<Set<string>>(new Set());

  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewErr, setPreviewErr] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const avatar        = AVATARS.find(a => a.id === avatarId);
  const recommendedId = avatarId ? AVATAR_VOICE_CONFIG[avatarId as AvatarId]?.elevenlabsId : undefined;

  // ── Load account voice library on mount ─────────────────────────────────────
  const loadLibrary = useCallback(async (force = false) => {
    setLoadingLib(true);
    try {
      const res = await api.get('/voice/voices');
      const raw: any[] = (res.data as any)?.voices ?? [];
      const mapped: VoiceEntry[] = raw.map(v => ({
        id:          v.voice_id,
        name:        v.name ?? '',
        gender:      norm(v.labels?.gender ?? ''),
        accent:      v.labels?.accent ?? '',
        style:       v.labels?.use_case ?? v.labels?.description ?? '',
        preview_url: v.preview_url ?? undefined,
        source:      'library' as const,
      }));
      setVoices(prev => {
        const libIds = new Set(mapped.map(v => v.id));
        // Replace curated entries that exist in library, add new library-only voices
        const kept = prev.filter(v => v.source !== 'library' && !libIds.has(v.id));
        return [...mapped, ...kept];
      });
    } catch {
      // No API key or backend offline — curated list stays
    } finally {
      setLoadingLib(false);
    }
  }, []);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  // ── Fetch regional voices when accent filter switches to a regional one ──────
  useEffect(() => {
    if (!REGIONAL_ACCENTS.has(accent)) return;
    if (fetchedRegional.current.has(accent)) return;
    fetchedRegional.current.add(accent);

    const gParam = gender === 'Any' ? '' : gender.toLowerCase();
    setLoadingRegional(true);
    api.get('/voice/library', { params: { accent, gender: gParam } })
      .then((res: any) => {
        const regional: VoiceEntry[] = (res.data as any[]).slice(0, 12).map((v: any) => ({
          id:          v.id,
          name:        v.name ?? '',
          gender:      norm(v.gender ?? ''),
          accent:      v.accent ?? accent,
          style:       '',
          preview_url: v.preview_url ?? undefined,
          source:      'regional' as const,
        }));
        setVoices(prev => {
          const existing = new Set(prev.map(v => v.id));
          return [...prev, ...regional.filter(v => !existing.has(v.id))];
        });
      })
      .catch(() => {})
      .finally(() => setLoadingRegional(false));
  }, [accent, gender]);

  // ── Filter logic ─────────────────────────────────────────────────────────────
  const filtered = voices.filter(v => {
    // Gender — case-insensitive exact match
    if (gender !== 'Any' && v.gender && norm(v.gender) !== norm(gender)) return false;

    // Accent — substring match, OR "Any"
    if (accent !== 'Any' && !norm(v.accent).includes(norm(accent))) return false;

    // Tone — substring match against style, OR "Any"
    if (tone !== 'Any' && v.style && !norm(v.style).includes(norm(tone))) return false;
    // If tone filter active but voice has no style, don't hide it — unknown style passes
    // (only hide when style is explicitly set and doesn't match)

    // Search — against name, accent, style
    if (search.trim()) {
      const q = norm(search);
      return norm(v.name).includes(q) || norm(v.accent).includes(q) || norm(v.style).includes(q);
    }
    return true;
  });

  // Recommended first, then alphabetical
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

  const playPreview = async (v: VoiceEntry) => {
    if (previewing === v.id) { stopPreview(); return; }
    stopPreview();
    setPreviewing(v.id);

    const tryPlay = (url: string) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPreviewing(null); audioRef.current = null; };
      audio.onerror = () => {
        setPreviewing(null);
        audioRef.current = null;
        setPreviewErr(prev => new Set([...prev, v.id]));
      };
      audio.play().catch(() => {
        setPreviewing(null);
        setPreviewErr(prev => new Set([...prev, v.id]));
      });
    };

    if (v.preview_url) { tryPlay(v.preview_url); return; }

    try {
      const res = await api.post(`/voice/tts/${v.id}`, { text: PREVIEW_TEXT }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPreviewing(null); audioRef.current = null; };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setPreviewing(null);
        audioRef.current = null;
        setPreviewErr(prev => new Set([...prev, v.id]));
      };
      audio.play();
    } catch {
      setPreviewing(null);
      setPreviewErr(prev => new Set([...prev, v.id]));
    }
  };

  // ── Select & save ────────────────────────────────────────────────────────────
  const selectVoice = (v: VoiceEntry) => {
    stopPreview();
    // Add regional/shared voices to account library in background
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

  // ── Keyboard close ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { stopPreview(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const isLoading = loadingLib || loadingRegional;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={() => { stopPreview(); onClose(); }}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative z-10 w-full sm:max-w-2xl flex flex-col rounded-t-[20px] sm:rounded-[16px] overflow-hidden"
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          maxHeight: '88vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-display font-bold text-[15px]">Choose Voice</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              {voices.length} voices · {sorted.length} match{sorted.length !== 1 ? 'es' : ''}
              {avatar ? ` · ${avatar.name.split(' ')[0]}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchedRegional.current.clear(); loadLibrary(true); }}
              disabled={isLoading}
              title="Reload voices"
              className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:opacity-40"
              style={{ borderColor: 'var(--border2)', color: 'var(--text3)' }}
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => { stopPreview(); onClose(); }}
              className="w-7 h-7 rounded-full border flex items-center justify-center transition-colors hover:bg-white/[0.05]"
              style={{ borderColor: 'var(--border2)', color: 'var(--text3)' }}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div
          className="px-4 py-3 flex flex-wrap gap-2 items-center flex-shrink-0"
          style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}
        >
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text3)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, accent, tone…"
              className="input-base pl-7 text-[12px] w-full h-8"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60" style={{ color: 'var(--text3)' }}>
                <X size={10} />
              </button>
            )}
          </div>

          <DropFilter
            label="Gender"
            options={['Any', 'Male', 'Female']}
            value={gender}
            onChange={v => setGender(v as any)}
          />
          <DropFilter
            label="Accent"
            options={ACCENT_OPTIONS}
            value={accent}
            onChange={setAccent}
          />
          <DropFilter
            label="Tone"
            options={TONE_OPTIONS}
            value={tone}
            onChange={setTone}
          />

          {/* Clear filters */}
          {(gender !== 'Any' || accent !== 'Any' || tone !== 'Any' || search) && (
            <button
              onClick={() => { setSearch(''); setGender('Any'); setAccent('Any'); setTone('Any'); }}
              className="text-[10px] px-2 py-1 rounded border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border2)', color: 'var(--text3)' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 px-5 py-1.5 text-[10.5px] flex-shrink-0" style={{ background: 'var(--bg3)', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
            <Loader size={9} className="animate-spin" />
            {loadingLib ? 'Loading your voice library…' : `Fetching ${accent} voices…`}
          </div>
        )}

        {/* Voice grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin]">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <p className="text-[13px] font-medium" style={{ color: 'var(--text2)' }}>No voices match your filters</p>
              <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
                {REGIONAL_ACCENTS.has(accent)
                  ? 'Regional voices load from ElevenLabs — check your API key in Settings.'
                  : 'Try adjusting gender, accent, or tone filters.'}
              </p>
              <button
                onClick={() => { setSearch(''); setGender('Any'); setAccent('Any'); setTone('Any'); }}
                className="mt-1 text-[11px] text-accent hover:opacity-80 transition-opacity"
              >
                Clear all filters
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
                  hasError={previewErr.has(v.id)}
                  onSelect={() => selectVoice(v)}
                  onPreview={() => playPreview(v)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--bg3)' }}
        >
          <span className="text-[10.5px]" style={{ color: 'var(--text3)' }}>
            {sorted.length} result{sorted.length !== 1 ? 's' : ''}
            {loadingRegional && REGIONAL_ACCENTS.has(accent) ? ' · loading more…' : ''}
          </span>
          <div className="flex gap-2">
            {value && (
              <button
                onClick={() => { stopPreview(); onSelect(undefined); onClose(); }}
                className="btn-ghost text-[12px] px-3 py-1.5"
              >
                Clear voice
              </button>
            )}
            <button
              onClick={() => { stopPreview(); onClose(); }}
              className="btn-ghost text-[12px] px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Filter dropdown ────────────────────────────────────────────────────────────
function DropFilter({ label, options, value, onChange }: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const active = value !== 'Any' && value !== '';
  return (
    <div className="relative flex items-center gap-1">
      <label className="text-[9.5px] font-semibold uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--text3)' }}>
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={clsx(
            'input-base h-8 text-[12px] pr-6 pl-2.5 appearance-none cursor-pointer min-w-[90px] transition-colors',
            active && 'border-accent/40 bg-accent/[0.05] text-accent'
          )}
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={9} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text3)' }} />
      </div>
    </div>
  );
}

// ── Voice card ────────────────────────────────────────────────────────────────
function VoiceCard({ voice, isSelected, isRecommended, isPreviewing, hasError, onSelect, onPreview }: {
  voice: VoiceEntry;
  isSelected: boolean;
  isRecommended: boolean;
  isPreviewing: boolean;
  hasError: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  const gColor =
    norm(voice.gender) === 'female' ? '#f472b6' :
    norm(voice.gender) === 'male'   ? '#60a5fa' :
    'var(--text3)';

  return (
    <div
      onClick={onSelect}
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer transition-all select-none group',
        isSelected ? 'border-accent bg-accent/[0.08]' : 'hover:bg-white/[0.03]',
      )}
      style={{ borderColor: isSelected ? 'var(--accent)' : 'var(--border)' }}
    >
      {/* Checkmark */}
      <div className={clsx(
        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
        isSelected ? 'bg-accent border-accent' : 'border-white/20 group-hover:border-white/40'
      )}>
        {isSelected && <Check size={8} strokeWidth={3} className="text-white" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={clsx('text-[12.5px] font-semibold truncate leading-tight', isSelected ? 'text-accent' : 'text-white/90')}>
            {voice.name}
          </span>
          {isRecommended && (
            <span className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent/80 font-bold uppercase tracking-wide leading-none flex-shrink-0">
              <Star size={6} fill="currentColor" /> Pick
            </span>
          )}
          {voice.source === 'library' && (
            <span className="text-[7.5px] px-1 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-white/35 font-medium uppercase tracking-wide leading-none flex-shrink-0">
              Library
            </span>
          )}
          {voice.source === 'regional' && (
            <span className="text-[7.5px] px-1 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-400/60 font-medium uppercase tracking-wide leading-none flex-shrink-0">
              Shared
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {voice.gender && (
            <span className="text-[9.5px] font-medium capitalize" style={{ color: gColor }}>
              {voice.gender}
            </span>
          )}
          {voice.accent && (
            <span className="text-[9.5px] truncate" style={{ color: 'var(--text3)' }}>{voice.accent}</span>
          )}
          {voice.style && (
            <span className="text-[9.5px] truncate" style={{ color: 'var(--text3)', opacity: 0.7 }}>· {voice.style}</span>
          )}
        </div>
        {hasError && <p className="text-[9px] text-red-400/70 mt-0.5">Preview unavailable</p>}
      </div>

      {/* Preview */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onPreview(); }}
        title={isPreviewing ? 'Stop preview' : 'Play preview'}
        className={clsx(
          'w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
          isPreviewing
            ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400'
            : 'border-white/15 text-white/45 hover:border-accent/50 hover:text-accent hover:bg-accent/10'
        )}
      >
        {isPreviewing ? <Square size={7} fill="currentColor" /> : <Play size={9} />}
      </button>
    </div>
  );
}
