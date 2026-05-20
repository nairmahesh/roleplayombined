import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Globe, FileText, AlignLeft, ChevronRight, CircleCheck as CheckCircle, Play, ChevronDown, ExternalLink, Clock, Phone, Monitor } from 'lucide-react';
import { KnowledgeBaseEntry, SessionType } from '@/types';
import { AvatarDisplay } from '@/components/practice/PersonaAvatars';
import clsx from 'clsx';

interface PreCallBriefingProps {
  personaName: string;
  personaTitle: string;
  avatarId?: string;
  industry?: string;
  roleplayType?: string;
  difficulty?: string;
  sessionType?: SessionType;
  briefing: KnowledgeBaseEntry[];
  onReady: () => void;
  onSkip: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: 'text-green-400 bg-green-400/10 border-green-400/25',
  Medium: 'text-amber-400 bg-amber-400/10 border-amber-400/25',
  Hard: 'text-red-400 bg-red-400/10 border-red-400/25',
  Expert: 'text-red-500 bg-red-500/10 border-red-500/30',
};

function EntryIcon({ type }: { type: string }) {
  if (type === 'url') return <Globe size={14} />;
  if (type === 'file') return <FileText size={14} />;
  return <AlignLeft size={14} />;
}

export function PreCallBriefing({
  personaName, personaTitle, avatarId, industry, roleplayType, difficulty, sessionType,
  briefing, onReady, onSkip,
}: PreCallBriefingProps) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(briefing[0]?.id ?? null);

  const markRead = (id: string) => setReadIds(prev => new Set([...prev, id]));
  const allRead = briefing.every(e => readIds.has(e.id));
  const readCount = readIds.size;

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    markRead(id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="flex flex-col gap-5 max-w-2xl mx-auto"
    >
      {/* Who you're calling */}
      <div className="rounded-[16px] border relative overflow-hidden" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent3))' }} />
        <div className="px-6 py-5">
          <p className="text-[10.5px] font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text3)' }}>You are about to call</p>
          <div className="flex items-center gap-4">
            {avatarId ? (
              <div className="rounded-full overflow-hidden ring-2 ring-white/10 flex-shrink-0">
                <AvatarDisplay avatarId={avatarId} size={64} />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(91,111,255,0.1)', border: '1px solid rgba(91,111,255,0.2)' }}>
                <span className="text-2xl">👤</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-display text-[20px] font-bold leading-tight" style={{ color: 'var(--text)' }}>{personaName}</div>
              {personaTitle && (
                <div className="text-[13px] mt-0.5" style={{ color: 'var(--text3)' }}>{personaTitle}</div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {difficulty && (
                  <span className={clsx('text-[11px] px-2 py-0.5 rounded border font-medium', DIFFICULTY_COLORS[difficulty] || 'text-white/80 bg-white/5 border-white/10')}>
                    {difficulty}
                  </span>
                )}
                {industry && (
                  <span className="text-[11px] px-2 py-0.5 rounded border font-medium" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text2)' }}>
                    {industry}
                  </span>
                )}
                {roleplayType && (
                  <span className="text-[11px] px-2 py-0.5 rounded border font-medium" style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', color: 'var(--text2)' }}>
                    {roleplayType}
                  </span>
                )}
                {sessionType && (
                  <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border font-medium" style={{ background: 'rgba(91,111,255,0.08)', borderColor: 'rgba(91,111,255,0.2)', color: 'var(--accent)' }}>
                    {sessionType === 'PHONE_CALL' ? <Phone size={10} /> : <Monitor size={10} />}
                    {sessionType === 'PHONE_CALL' ? 'Phone Call' : 'Online Meeting'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Briefing header with progress */}
      <div className="rounded-[14px] border px-5 py-4" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(91,111,255,0.12)', border: '1px solid rgba(91,111,255,0.25)' }}>
            <BookOpen size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[16px] font-bold" style={{ color: 'var(--text)' }}>Pre-Call Briefing</h2>
            <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text3)' }}>
              Review the material below. You'll be scored on how well you apply this knowledge during the call.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--bg4)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--accent)' }}
              animate={{ width: `${briefing.length > 0 ? (readCount / briefing.length) * 100 : 0}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
          <span className="text-[11px] font-mono flex-shrink-0" style={{ color: 'var(--text3)' }}>
            {readCount}/{briefing.length} reviewed
          </span>
        </div>
      </div>

      {/* Briefing entries */}
      <div className="flex flex-col gap-2.5">
        {briefing.map((entry, i) => {
          const isRead = readIds.has(entry.id);
          const isExpanded = expandedId === entry.id;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-[12px] border overflow-hidden transition-colors"
              style={{
                background: 'var(--bg2)',
                borderColor: isRead ? 'rgba(6,214,160,0.35)' : 'var(--border)',
              }}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggle(entry.id)}
              >
                <span className={clsx('flex-shrink-0 transition-colors', isRead ? 'text-[var(--accent3)]' : 'text-[var(--accent)]')}>
                  {isRead ? <CheckCircle size={15} /> : <EntryIcon type={entry.type} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{entry.label}</span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>{entry.type}</span>
                    {!isRead && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(91,111,255,0.12)', color: 'var(--accent)' }}>Unread</span>
                    )}
                    {isRead && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(6,214,160,0.1)', color: 'var(--accent3)' }}>Read</span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  size={14}
                  className="flex-shrink-0 transition-transform"
                  style={{ color: 'var(--text3)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      {entry.type === 'url' ? (
                        <div className="mt-3 flex flex-col gap-3">
                          <a
                            href={entry.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[13px] font-medium transition-colors hover:underline break-all"
                            style={{ color: 'var(--accent)' }}
                          >
                            <ExternalLink size={13} className="flex-shrink-0" />
                            {entry.content}
                          </a>
                          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                            Open this link, review the content, then come back here and mark it as read.
                          </p>
                          {!isRead && (
                            <button
                              onClick={e => { e.stopPropagation(); markRead(entry.id); }}
                              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all hover:scale-105"
                              style={{ background: 'rgba(6,214,160,0.12)', color: 'var(--accent3)', border: '1px solid rgba(6,214,160,0.25)' }}
                            >
                              <CheckCircle size={12} /> Mark as read
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-col gap-3">
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text2)' }}>
                            {entry.content}
                          </p>
                          {!isRead && (
                            <button
                              onClick={e => { e.stopPropagation(); markRead(entry.id); }}
                              className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all hover:scale-105"
                              style={{ background: 'rgba(6,214,160,0.12)', color: 'var(--accent3)', border: '1px solid rgba(6,214,160,0.25)' }}
                            >
                              <CheckCircle size={12} /> Mark as read
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="rounded-[14px] border p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ background: 'var(--bg2)', borderColor: allRead ? 'rgba(6,214,160,0.3)' : 'var(--border)' }}>
        <div className="flex-1">
          {allRead ? (
            <>
              <p className="text-[14px] font-bold" style={{ color: 'var(--accent3)' }}>All material reviewed — you're ready!</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--text3)' }}>Good luck on your call with {personaName}.</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Clock size={13} style={{ color: 'var(--text3)' }} />
                <p className="text-[13px] font-medium" style={{ color: 'var(--text2)' }}>
                  {briefing.length - readCount} item{briefing.length - readCount !== 1 ? 's' : ''} still unreviewed
                </p>
              </div>
              <p className="text-[11.5px]" style={{ color: 'var(--text3)' }}>
                Review all content for the best score, or start the call now if you feel ready.
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onSkip}
            className="px-3 py-2 rounded-[9px] text-[12.5px] transition-colors"
            style={{ color: 'var(--text3)' }}
          >
            Skip
          </button>
          <button
            onClick={onReady}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[13.5px] font-semibold transition-all hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: allRead ? 'var(--accent3)' : 'var(--accent)',
              color: '#fff',
              boxShadow: `0 4px 16px ${allRead ? 'rgba(6,214,160,0.3)' : 'rgba(91,111,255,0.3)'}`,
            }}
          >
            <Play size={13} fill="white" />
            {allRead ? "Start Call" : "Start Call Anyway"}
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
