import { useState, useRef, useEffect } from 'react';
import { Play, Square, Star, Globe as Globe2, RefreshCw, Library } from 'lucide-react';
import { api } from '@/lib/api';
import { AVATARS, AVATAR_VOICE_CONFIG, type AvatarId, type Ethnicity } from './PersonaAvatars';
import clsx from 'clsx';

export interface CuratedVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  accent: string;
  style: string;
  preview_url?: string;
}

interface RegionalVoice {
  id: string;
  public_owner_id: string | null;
  name: string;
  gender: string;
  accent: string;
  preview_url: string | null;
}

// Maps avatar ethnicity to ElevenLabs shared-voice accent label
const ETHNICITY_ACCENT: Partial<Record<Ethnicity, string>> = {
  'south-asian':    'Indian',
  'middle-eastern': 'Arabic',
  'hispanic':       'Spanish',
  'east-asian':     'Japanese',
};

export const CURATED_VOICES: CuratedVoice[] = [
  // ── Male ──────────────────────────────────────────────────────────────────
  { id: 'ErXwobaYiN019PkySvjV', name: 'Adam',    gender: 'male',   accent: 'American', style: 'Professional'  },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold',  gender: 'male',   accent: 'American', style: 'Strong'        },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Sam',     gender: 'male',   accent: 'American', style: 'Authoritative' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',    gender: 'male',   accent: 'American', style: 'Casual'        },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Marcus',  gender: 'male',   accent: 'American', style: 'Warm'          },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will',    gender: 'male',   accent: 'American', style: 'Friendly'      },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  gender: 'male',   accent: 'British',  style: 'Articulate'    },
  // ── Female ────────────────────────────────────────────────────────────────
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',    gender: 'female', accent: 'American', style: 'Professional'  },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',     gender: 'female', accent: 'American', style: 'Bright'        },
  { id: 'ThT5KcBeYPX3keUQqHPh', name: 'Dorothy',  gender: 'female', accent: 'British',  style: 'Warm'          },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Mimi',     gender: 'female', accent: 'American', style: 'Conversational'},
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel',   gender: 'female', accent: 'American', style: 'Calm'          },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte',gender: 'female', accent: 'British',  style: 'Assertive'     },
  { id: 'jBpfuIE2acCO8z3wKNLl', name: 'Gigi',     gender: 'female', accent: 'American', style: 'Energetic'     },
];

const PREVIEW_TEXT = "Hi there! Great to connect with you today. How can I help move things forward?";

export function VoicePicker({
  avatarId,
  value,
  onChange,
}: {
  avatarId?: string;
  value?: string;
  onChange: (id: string | undefined) => void;
}) {
  const [previewing, setPreviewing]         = useState<string | null>(null);
  const [previewError, setPreviewError]     = useState(false);
  const [regionalVoices, setRegionalVoices] = useState<RegionalVoice[]>([]);
  const [loadingRegional, setLoadingRegional] = useState(false);
  // Account library voices fetched from ElevenLabs via our backend
  const [libraryVoices, setLibraryVoices]   = useState<CuratedVoice[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryLoaded, setLibraryLoaded]   = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const avatar        = AVATARS.find(a => a.id === avatarId);
  const recommendedId = avatarId ? AVATAR_VOICE_CONFIG[avatarId as AvatarId]?.elevenlabsId : undefined;
  const genderFilter  = avatar?.gender;
  const accentTarget  = avatar?.ethnicity ? ETHNICITY_ACCENT[avatar.ethnicity as Ethnicity] : undefined;

  // Merge curated with library voices, library takes precedence for metadata
  const allCurated: CuratedVoice[] = (() => {
    const curatedIds = new Set(CURATED_VOICES.map(v => v.id));
    const extras = libraryVoices.filter(v => !curatedIds.has(v.id));
    return [...CURATED_VOICES, ...extras];
  })();

  const recommendedVoice = recommendedId ? allCurated.find(v => v.id === recommendedId) : undefined;

  const otherVoices = allCurated.filter(v => {
    if (v.id === recommendedId) return false;
    return !genderFilter || v.gender === genderFilter;
  });

  // Load account voice library from ElevenLabs via backend
  const fetchLibrary = async (force = false) => {
    if (libraryLoaded && !force) return;
    setLoadingLibrary(true);
    try {
      const res = await api.get('/voice/voices');
      const raw = (res.data as any)?.voices ?? [];
      const mapped: CuratedVoice[] = raw.map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        gender: ((v.labels?.gender) || '').toLowerCase() as 'male' | 'female',
        accent: v.labels?.accent || 'Unknown',
        style:  v.labels?.use_case || v.labels?.description || 'Voice',
        preview_url: v.preview_url ?? undefined,
      }));
      setLibraryVoices(mapped);
      setLibraryLoaded(true);
    } catch {
      // silently fail — curated list still shows
    } finally {
      setLoadingLibrary(false);
    }
  };

  // Fetch regional accent voices from ElevenLabs shared library when avatar changes
  useEffect(() => {
    if (!accentTarget || !genderFilter) {
      setRegionalVoices([]);
      return;
    }
    let cancelled = false;
    setLoadingRegional(true);
    api.get('/voice/library', { params: { accent: accentTarget, gender: genderFilter } })
      .then((res: any) => { if (!cancelled) setRegionalVoices((res.data as RegionalVoice[]).slice(0, 8)); })
      .catch(() => { if (!cancelled) setRegionalVoices([]); })
      .finally(() => { if (!cancelled) setLoadingRegional(false); });
    return () => { cancelled = true; };
  }, [accentTarget, genderFilter]);

  // Auto-load library on first open
  useEffect(() => { fetchLibrary(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPreview = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPreviewing(null);
  };

  const playTTSPreview = async (voiceId: string, previewUrl?: string) => {
    stopPreview();
    setPreviewError(false);
    setPreviewing(voiceId);
    // For voices with a hosted preview URL, use it directly (no API key needed)
    if (previewUrl) {
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      audio.onended = () => { setPreviewing(null); audioRef.current = null; };
      audio.onerror = () => { setPreviewing(null); audioRef.current = null; setPreviewError(true); };
      audio.play();
      return;
    }
    try {
      const res = await api.post(`/voice/tts/${voiceId}`, { text: PREVIEW_TEXT }, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setPreviewing(null); audioRef.current = null; };
      audio.onerror = () => { URL.revokeObjectURL(url); setPreviewing(null); audioRef.current = null; setPreviewError(true); };
      audio.play();
    } catch {
      setPreviewing(null);
      setPreviewError(true);
    }
  };

  const playDirectPreview = (previewUrl: string, voiceId: string) => {
    stopPreview();
    setPreviewing(voiceId);
    const audio = new Audio(previewUrl);
    audioRef.current = audio;
    audio.onended = () => { setPreviewing(null); audioRef.current = null; };
    audio.onerror = () => { setPreviewing(null); audioRef.current = null; };
    audio.play();
  };

  const renderVoiceCard = (v: CuratedVoice, isRecommended = false) => {
    const isSelected   = value === v.id;
    const isPreviewing = previewing === v.id;
    return (
      <div
        key={v.id}
        onClick={() => { stopPreview(); onChange(v.id); }}
        className={clsx(
          'flex items-center gap-2 p-2 rounded-[8px] border cursor-pointer transition-all select-none',
          isSelected
            ? 'border-accent bg-accent/[0.08]'
            : 'border-white/[0.07] hover:border-white/20 hover:bg-white/[0.03]'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={clsx('text-[12px] font-semibold leading-tight truncate', isSelected ? 'text-accent' : 'text-white/80')}>
              {v.name}
            </span>
            {isRecommended && (
              <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent/80 font-semibold uppercase tracking-wide leading-none flex-shrink-0">
                Pick
              </span>
            )}
          </div>
          <div className="text-[9.5px] text-white/55 mt-0.5 truncate">
            {[v.accent, v.style].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); if (isPreviewing) stopPreview(); else playTTSPreview(v.id, v.preview_url); }}
          title={isPreviewing ? 'Stop' : 'Preview'}
          className={clsx(
            'w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
            isPreviewing
              ? 'border-accent-3 bg-accent-3/15 text-accent-3'
              : 'border-white/20 text-white/75 hover:border-accent hover:text-accent hover:bg-accent/10'
          )}
        >
          {isPreviewing ? <Square size={7} fill="currentColor" /> : <Play size={8} />}
        </button>
      </div>
    );
  };

  const selectRegionalVoice = (v: RegionalVoice) => {
    stopPreview();
    onChange(v.id);
    if (v.public_owner_id) {
      api.post(`/voice/library/add/${v.public_owner_id}/${v.id}`).catch(() => {});
    }
  };

  const renderRegionalCard = (v: RegionalVoice) => {
    const isSelected   = value === v.id;
    const isPreviewing = previewing === v.id;
    return (
      <div
        key={v.id}
        onClick={() => selectRegionalVoice(v)}
        className={clsx(
          'flex items-center gap-2 p-2 rounded-[8px] border cursor-pointer transition-all select-none',
          isSelected
            ? 'border-accent bg-accent/[0.08]'
            : 'border-white/[0.07] hover:border-white/20 hover:bg-white/[0.03]'
        )}
      >
        <div className="flex-1 min-w-0">
          <div className={clsx('text-[12px] font-semibold leading-tight truncate', isSelected ? 'text-accent' : 'text-white/80')}>
            {v.name}
          </div>
          <div className="text-[9.5px] text-white/55 mt-0.5 truncate">{v.accent} accent</div>
        </div>
        {v.preview_url && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              if (isPreviewing) stopPreview();
              else playDirectPreview(v.preview_url!, v.id);
            }}
            title={isPreviewing ? 'Stop' : 'Preview'}
            className={clsx(
              'w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 transition-all',
              isPreviewing
                ? 'border-accent-3 bg-accent-3/15 text-accent-3'
                : 'border-white/20 text-white/75 hover:border-accent hover:text-accent hover:bg-accent/10'
            )}
          >
            {isPreviewing ? <Square size={7} fill="currentColor" /> : <Play size={8} />}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => fetchLibrary(true)}
          disabled={loadingLibrary}
          title="Reload your ElevenLabs voice library"
          className="flex items-center gap-1 text-[10px] text-white/55 hover:text-white/80 transition-colors disabled:opacity-40"
        >
          {loadingLibrary
            ? <RefreshCw size={9} className="animate-spin" />
            : <Library size={9} />
          }
          {loadingLibrary ? 'Loading…' : `${libraryVoices.length > 0 ? libraryVoices.length + ' library voices' : 'Load library'}`}
        </button>
        <button
          type="button"
          onClick={() => { stopPreview(); onChange(undefined); }}
          className={clsx(
            'text-[10px] px-2 py-0.5 rounded border transition-colors',
            !value
              ? 'border-white/25 text-white/70 bg-white/[0.05]'
              : 'border-white/[0.08] text-white/55 hover:text-white/55 hover:border-white/20'
          )}
        >
          {!value
            ? <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',marginRight:'3px'}}><polyline points="20 6 9 17 4 12"/></svg>Default (Browser)</>
            : 'Use Default'}
        </button>
      </div>

      {previewError && (
        <p className="text-[10.5px] text-accent-4/70">
          Preview failed — check your ElevenLabs API key in Settings.
        </p>
      )}

      <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-0.5 [scrollbar-width:thin]">

        {/* Regional / accent-specific voices */}
        {accentTarget && (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1">
              <Globe2 size={8} className="text-accent-2/60" />
              {accentTarget} Accent Voices
            </span>
            {loadingRegional ? (
              <div className="text-[10px] text-white/70 py-1 pl-0.5">Loading…</div>
            ) : regionalVoices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {regionalVoices.map(v => renderRegionalCard(v))}
              </div>
            ) : null}
          </div>
        )}

        {/* Avatar's recommended voice */}
        {recommendedVoice && (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wider flex items-center gap-1">
              <Star size={8} className="text-accent/50" />
              {avatar ? `Recommended for ${avatar.name.split(' ')[0]}` : 'Recommended'}
            </span>
            {renderVoiceCard(recommendedVoice, true)}
          </div>
        )}

        {/* All other voices (curated + library) */}
        {otherVoices.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wider">
              {accentTarget || recommendedVoice
                ? `Other ${genderFilter ?? ''} voices`
                : `All voices${libraryVoices.length > 0 ? ' (library + curated)' : ''}`}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {otherVoices.map(v => renderVoiceCard(v))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
