import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Globe, FileText, AlignLeft, ChevronRight, CircleCheck as CheckCircle, Play, ChevronDown, ExternalLink, Clock } from 'lucide-react';
import { KnowledgeBaseEntry } from '@/types';
import clsx from 'clsx';

interface PreCallBriefingProps {
  personaName: string;
  personaTitle: string;
  briefing: KnowledgeBaseEntry[];
  onReady: () => void;
  onSkip: () => void;
}

function EntryIcon({ type }: { type: string }) {
  if (type === 'url') return <Globe size={14} />;
  if (type === 'file') return <FileText size={14} />;
  return <AlignLeft size={14} />;
}

export function PreCallBriefing({ personaName, personaTitle, briefing, onReady, onSkip }: PreCallBriefingProps) {
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
      className="flex flex-col gap-6 max-w-2xl mx-auto"
    >
      {/* Header */}
      <div className="rounded-[16px] border px-6 py-5 relative overflow-hidden" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[var(--accent)] via-[var(--accent3)] to-[var(--accent5)]" />
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(91,111,255,0.12)', border: '1px solid rgba(91,111,255,0.25)' }}>
            <BookOpen size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-[18px] font-bold" style={{ color: 'var(--text)' }}>Pre-Call Briefing</h2>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
              Review the material below before your call with <strong style={{ color: 'var(--text2)' }}>{personaName}</strong>
              {personaTitle && <span style={{ color: 'var(--text3)' }}>, {personaTitle}</span>}.
              You'll be assessed on how well you apply this knowledge.
            </p>
          </div>
        </div>

        {/* Progress */}
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
            {readCount}/{briefing.length} read
          </span>
        </div>
      </div>

      {/* Briefing entries */}
      <div className="flex flex-col gap-3">
        {briefing.map((entry, i) => {
          const isRead = readIds.has(entry.id);
          const isExpanded = expandedId === entry.id;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-[12px] border overflow-hidden transition-all"
              style={{
                background: 'var(--bg2)',
                borderColor: isRead ? 'rgba(6,214,160,0.3)' : 'var(--border)',
              }}
            >
              {/* Entry header */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggle(entry.id)}
              >
                <span className={clsx('flex-shrink-0 transition-colors', isRead ? 'text-[var(--accent3)]' : 'text-[var(--accent)]')}>
                  {isRead ? <CheckCircle size={14} /> : <EntryIcon type={entry.type} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--text)' }}>{entry.label}</span>
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>{entry.type}</span>
                    {!isRead && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(91,111,255,0.12)', color: 'var(--accent)' }}>Unread</span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  size={14}
                  className="flex-shrink-0 transition-transform"
                  style={{ color: 'var(--text3)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {/* Entry content */}
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
                        <div className="mt-3 flex flex-col gap-2">
                          <a
                            href={entry.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[12px] font-medium transition-colors hover:underline"
                            style={{ color: 'var(--accent)' }}
                          >
                            <ExternalLink size={12} />
                            {entry.content}
                          </a>
                          <p className="text-[11px]" style={{ color: 'var(--text3)' }}>
                            Open the link above and review the content, then come back to continue.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[12.5px] leading-relaxed mt-3 whitespace-pre-wrap" style={{ color: 'var(--text2)' }}>
                          {entry.content}
                        </p>
                      )}
                      {!isRead && (
                        <button
                          onClick={e => { e.stopPropagation(); markRead(entry.id); }}
                          className="mt-3 flex items-center gap-1.5 text-[11px] font-medium transition-all hover:scale-105"
                          style={{ color: 'var(--accent3)' }}
                        >
                          <CheckCircle size={12} /> Mark as read
                        </button>
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
      <div className="rounded-[12px] border p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <div className="flex-1">
          {allRead ? (
            <>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--accent3)' }}>All material reviewed!</p>
              <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text3)' }}>You're ready to start the call. Good luck!</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Clock size={12} style={{ color: 'var(--text3)' }} />
                <p className="text-[12px]" style={{ color: 'var(--text2)' }}>{briefing.length - readCount} item{briefing.length - readCount !== 1 ? 's' : ''} still unread</p>
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text3)' }}>Review all content for the best score, or start now if you feel ready.</p>
            </>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onSkip}
            className="px-3 py-2 rounded-[9px] text-[12px] transition-colors"
            style={{ color: 'var(--text3)' }}
          >
            Skip briefing
          </button>
          <button
            onClick={onReady}
            className="flex items-center gap-2 px-4 py-2 rounded-[9px] text-[13px] font-semibold transition-all hover:scale-105 active:scale-95"
            style={{ background: allRead ? 'var(--accent3)' : 'var(--accent)', color: '#fff' }}
          >
            <Play size={13} fill="white" />
            {allRead ? "I'm Ready — Start Call" : "Start Call Anyway"}
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
