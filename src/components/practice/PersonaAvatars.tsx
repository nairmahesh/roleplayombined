import { useState } from 'react';
import clsx from 'clsx';

export type Ethnicity = 'east-asian' | 'south-asian' | 'black' | 'white' | 'hispanic' | 'middle-eastern';

export interface VoiceConfig {
  elevenlabsId: string;
  lang: string;
  nameHints: string[];
  pitch: number;
  rate: number;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const AVATARS = [
  // ── Original set (local files) ──────────────────────────────────────────────
  { id: 'alex',   name: 'Alex Chen',      ethnicity: 'east-asian'     as Ethnicity, gender: 'male'   },
  { id: 'sarah',  name: 'Sarah Mitchell', ethnicity: 'white'          as Ethnicity, gender: 'female' },
  { id: 'james',  name: "James O'Brien",  ethnicity: 'white'          as Ethnicity, gender: 'male'   },
  { id: 'maria',  name: 'Maria Santos',   ethnicity: 'hispanic'       as Ethnicity, gender: 'female' },
  { id: 'robert', name: 'Robert Hayes',   ethnicity: 'white'          as Ethnicity, gender: 'male'   },
  { id: 'emma',   name: 'Emma Wilson',    ethnicity: 'white'          as Ethnicity, gender: 'female' },
  { id: 'priya',  name: 'Priya Kapoor',   ethnicity: 'south-asian'    as Ethnicity, gender: 'female' },
  { id: 'jordan', name: 'Jordan Lee',     ethnicity: 'east-asian'     as Ethnicity, gender: 'male'   },
  { id: 'marcus', name: 'Marcus Johnson', ethnicity: 'black'          as Ethnicity, gender: 'male'   },
  { id: 'layla',  name: 'Layla Hassan',   ethnicity: 'middle-eastern' as Ethnicity, gender: 'female' },
  { id: 'ravi',   name: 'Ravi Patel',     ethnicity: 'south-asian'    as Ethnicity, gender: 'male'   },
  { id: 'yuki',   name: 'Yuki Tanaka',    ethnicity: 'east-asian'     as Ethnicity, gender: 'female' },
  { id: 'aisha',  name: 'Aisha Brown',    ethnicity: 'black'          as Ethnicity, gender: 'female' },
  { id: 'carlos', name: 'Carlos Rivera',  ethnicity: 'hispanic'       as Ethnicity, gender: 'male'   },
  // ── Extended set (AI-generated faces via thispersondoesnotexist.com, stored locally) ──
  { id: 'noah',    name: 'Noah Williams',    ethnicity: 'white'          as Ethnicity, gender: 'male'   },
  { id: 'sofia',   name: 'Sofia Reyes',      ethnicity: 'hispanic'       as Ethnicity, gender: 'female' },
  { id: 'kwame',   name: 'Kwame Asante',     ethnicity: 'black'          as Ethnicity, gender: 'male'   },
  { id: 'nina',    name: 'Nina Petrova',     ethnicity: 'white'          as Ethnicity, gender: 'female' },
  { id: 'wei',     name: 'Wei Zhang',        ethnicity: 'east-asian'     as Ethnicity, gender: 'male'   },
  { id: 'amara',   name: 'Amara Okafor',     ethnicity: 'black'          as Ethnicity, gender: 'female' },
  { id: 'hassan',  name: 'Hassan Al-Rashid', ethnicity: 'middle-eastern' as Ethnicity, gender: 'male'   },
  { id: 'mei',     name: 'Mei Lin',           ethnicity: 'east-asian'     as Ethnicity, gender: 'female' },
  { id: 'diego',   name: 'Diego Morales',    ethnicity: 'hispanic'       as Ethnicity, gender: 'male'   },
  { id: 'fatima',  name: 'Fatima Al-Sayed',  ethnicity: 'middle-eastern' as Ethnicity, gender: 'female' },
  { id: 'dev',     name: 'Dev Sharma',       ethnicity: 'south-asian'    as Ethnicity, gender: 'male'   },
  { id: 'zara',    name: 'Zara Khan',        ethnicity: 'south-asian'    as Ethnicity, gender: 'female' },
] as const;

export type AvatarId = typeof AVATARS[number]['id'];

// ── Voice config per avatar ───────────────────────────────────────────────────

export const AVATAR_VOICE_CONFIG: Record<AvatarId, VoiceConfig> = {
  alex:   { elevenlabsId: 'ErXwobaYiN019PkySvjV', lang: 'en-US', nameHints: ['Daniel', 'Alex', 'Google US English'],           pitch: 1.05, rate: 0.95 },
  sarah:  { elevenlabsId: 'MF3mGyEYCl7XYWbV9V6O', lang: 'en-US', nameHints: ['Samantha', 'Zira', 'Google US English Female'],   pitch: 1.1,  rate: 1.0  },
  james:  { elevenlabsId: 'VR6AewLTigWG4xSOukaG', lang: 'en-US', nameHints: ['Alex', 'David', 'Google US English'],             pitch: 0.95, rate: 0.95 },
  maria:  { elevenlabsId: 'AZnzlk1XvdvUeBnXmlld', lang: 'en-US', nameHints: ['Samantha', 'Karen', 'Google US English Female'],  pitch: 1.1,  rate: 1.0  },
  robert: { elevenlabsId: 'pNInz6obpgDQGcFmaJgB', lang: 'en-US', nameHints: ['Fred', 'Alex', 'Google US English'],              pitch: 0.85, rate: 0.9  },
  emma:   { elevenlabsId: 'ThT5KcBeYPX3keUQqHPh', lang: 'en-GB', nameHints: ['Kate', 'Moira', 'Google UK English Female'],      pitch: 1.1,  rate: 1.0  },
  priya:  { elevenlabsId: 'EXAVITQu4vr4xnSDxMaL', lang: 'en-US', nameHints: ['Samantha', 'Serena', 'Google US English Female'], pitch: 1.15, rate: 1.0  },
  jordan: { elevenlabsId: 'TX3LPaxmHKxFdv7VOQHJ', lang: 'en-US', nameHints: ['Daniel', 'Alex', 'Google US English'],            pitch: 1.0,  rate: 1.0  },
  marcus: { elevenlabsId: 'TxGEqnHWrfWFTfGW9XjX', lang: 'en-US', nameHints: ['Alex', 'Google US English'],                     pitch: 0.92, rate: 0.95 },
  layla:  { elevenlabsId: '21m00Tcm4TlvDq8ikWAM', lang: 'en-US', nameHints: ['Samantha', 'Serena', 'Google US English Female'], pitch: 1.05, rate: 1.0  },
  ravi:   { elevenlabsId: 'onwK4e9ZLuTAKqWW03F9', lang: 'en-GB', nameHints: ['Daniel', 'Google UK English Male'],               pitch: 0.97, rate: 0.95 },
  yuki:   { elevenlabsId: 'XB0fDUnXU5powFXDhCwa', lang: 'en-GB', nameHints: ['Kate', 'Google UK English Female'],               pitch: 1.08, rate: 1.0  },
  aisha:  { elevenlabsId: 'jBpfuIE2acCO8z3wKNLl', lang: 'en-US', nameHints: ['Samantha', 'Google US English Female'],          pitch: 1.12, rate: 1.05 },
  carlos:  { elevenlabsId: 'bIHbv24MWmeRgasZH58o', lang: 'en-US', nameHints: ['Alex', 'Google US English'],                     pitch: 0.98, rate: 0.97 },
  noah:    { elevenlabsId: 'VR6AewLTigWG4xSOukaG', lang: 'en-US', nameHints: ['Alex', 'David', 'Google US English'],             pitch: 1.0,  rate: 1.0  },
  sofia:   { elevenlabsId: 'AZnzlk1XvdvUeBnXmlld', lang: 'en-US', nameHints: ['Samantha', 'Google US English Female'],          pitch: 1.1,  rate: 1.02 },
  kwame:   { elevenlabsId: 'TxGEqnHWrfWFTfGW9XjX', lang: 'en-US', nameHints: ['Alex', 'Google US English'],                     pitch: 0.90, rate: 0.95 },
  nina:    { elevenlabsId: 'ThT5KcBeYPX3keUQqHPh', lang: 'en-GB', nameHints: ['Kate', 'Google UK English Female'],              pitch: 1.08, rate: 1.0  },
  wei:     { elevenlabsId: 'ErXwobaYiN019PkySvjV', lang: 'en-US', nameHints: ['Daniel', 'Google US English'],                   pitch: 1.02, rate: 0.97 },
  amara:   { elevenlabsId: 'jBpfuIE2acCO8z3wKNLl', lang: 'en-US', nameHints: ['Samantha', 'Google US English Female'],          pitch: 1.08, rate: 1.0  },
  hassan:  { elevenlabsId: 'pNInz6obpgDQGcFmaJgB', lang: 'en-US', nameHints: ['Fred', 'Google US English'],                     pitch: 0.88, rate: 0.93 },
  mei:     { elevenlabsId: 'XB0fDUnXU5powFXDhCwa', lang: 'en-GB', nameHints: ['Kate', 'Google UK English Female'],              pitch: 1.12, rate: 1.0  },
  diego:   { elevenlabsId: 'bIHbv24MWmeRgasZH58o', lang: 'en-US', nameHints: ['Alex', 'Google US English'],                     pitch: 0.96, rate: 1.0  },
  fatima:  { elevenlabsId: '21m00Tcm4TlvDq8ikWAM', lang: 'en-US', nameHints: ['Samantha', 'Google US English Female'],          pitch: 1.06, rate: 1.0  },
  dev:     { elevenlabsId: 'onwK4e9ZLuTAKqWW03F9', lang: 'en-GB', nameHints: ['Daniel', 'Google UK English Male'],              pitch: 0.98, rate: 0.97 },
  zara:    { elevenlabsId: 'EXAVITQu4vr4xnSDxMaL', lang: 'en-US', nameHints: ['Serena', 'Google US English Female'],            pitch: 1.1,  rate: 1.0  },
};

// ── Static AI-generated avatar photos (public/avatars/*.jpg) ─────────────────

const AVATAR_PHOTOS: Record<string, string> = Object.fromEntries(
  AVATARS.map(a => [a.id, `/avatars/${a.id}.jpg`])
);

export function AvatarPhotoProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function useAvatarPhotos() {
  return AVATAR_PHOTOS;
}

// ── AvatarDisplay ─────────────────────────────────────────────────────────────

export function AvatarDisplay({
  avatarId,
  size = 56,
  className = '',
  speaking = false,
}: {
  avatarId?: string;
  size?: number;
  className?: string;
  speaking?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const photos   = useAvatarPhotos();
  const found    = AVATARS.find(a => a.id === avatarId) ?? AVATARS[0];
  const photoUrl = photos[found.id];

  return (
    <div
      className={clsx('rounded-full flex-shrink-0 relative overflow-hidden', className)}
      style={{ width: size, height: size }}
    >
      {photoUrl && !imgError
        ? <img
            src={photoUrl}
            alt={found.name}
            className="w-full h-full object-cover"
            style={{ objectPosition: 'center 15%' }}
            draggable={false}
            onError={() => setImgError(true)}
          />
        : <div className="w-full h-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
            <span className="text-white/75 font-semibold select-none" style={{ fontSize: size * 0.38 }}>
              {found.name.charAt(0)}
            </span>
          </div>
      }
      {speaking && (
        <div className="absolute inset-0 rounded-full border-[3px] border-accent animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

// ── EthnicityAvatarPicker ─────────────────────────────────────────────────────

const ETHNICITY_FILTERS: Array<{ key: Ethnicity | 'all'; label: string }> = [
  { key: 'all',             label: 'All' },
  { key: 'east-asian',      label: 'East Asian' },
  { key: 'south-asian',     label: 'South Asian' },
  { key: 'black',           label: 'Black' },
  { key: 'white',           label: 'White' },
  { key: 'hispanic',        label: 'Hispanic' },
  { key: 'middle-eastern',  label: 'Middle Eastern' },
];

function AvatarPickerCard({
  av, selected, photoUrl, onClick,
}: {
  av: typeof AVATARS[number];
  selected: boolean;
  photoUrl: string;
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${av.name} · ${av.gender} · ${av.ethnicity}`}
      className={clsx(
        'flex items-center justify-center p-1.5 rounded-[10px] border transition-all flex-shrink-0',
        selected ? 'border-accent bg-accent/[0.08]' : 'border-white/[0.07] hover:border-white/20'
      )}
    >
      <div className={clsx(
        'w-10 h-10 rounded-full overflow-hidden ring-2 transition-all bg-white/10',
        selected ? 'ring-accent' : 'ring-transparent'
      )}>
        {photoUrl && !imgError
          ? <img src={photoUrl} alt={av.name} className="w-full h-full object-cover" style={{ objectPosition: 'center 15%' }} draggable={false} onError={() => setImgError(true)} />
          : <div className="w-full h-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
              <span className="text-white/75 text-[14px] font-semibold select-none">{av.name.charAt(0)}</span>
            </div>
        }
      </div>
    </button>
  );
}

export function EthnicityAvatarPicker({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string) => void;
}) {
  const [ethnFilter, setEthnFilter]     = useState<Ethnicity | 'all'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const photos = useAvatarPhotos();

  const visible = AVATARS.filter(a => {
    const ethMatch    = ethnFilter   === 'all' || a.ethnicity === ethnFilter;
    const genderMatch = genderFilter === 'all' || a.gender    === genderFilter;
    return ethMatch && genderMatch;
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Gender filter */}
      <div className="flex gap-1.5">
        {(['all', 'male', 'female'] as const).map(g => (
          <button
            key={g}
            type="button"
            onClick={() => setGenderFilter(g)}
            className={clsx(
              'text-[10.5px] px-2.5 py-0.5 rounded-full border transition-colors capitalize',
              genderFilter === g
                ? 'bg-accent-5/15 border-accent-5 text-accent-5'
                : 'border-white/15 text-white/80 hover:text-white/70 hover:border-white/30'
            )}
          >
            {g === 'all' ? 'Any Gender' : g === 'male' ? 'Male' : 'Female'}
          </button>
        ))}
      </div>

      {/* Ethnicity filter */}
      <div className="flex flex-wrap gap-1.5">
        {ETHNICITY_FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setEthnFilter(f.key)}
            className={clsx(
              'text-[10.5px] px-2.5 py-0.5 rounded-full border transition-colors',
              ethnFilter === f.key
                ? 'bg-accent/15 border-accent text-accent'
                : 'border-white/15 text-white/80 hover:text-white/70 hover:border-white/30'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Avatar grid */}
      {visible.length === 0 ? (
        <p className="text-[11px] text-white/70 py-1">No avatars match these filters.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visible.map(av => (
            <AvatarPickerCard key={av.id} av={av} selected={value === av.id} photoUrl={photos[av.id]} onClick={() => onChange(av.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
