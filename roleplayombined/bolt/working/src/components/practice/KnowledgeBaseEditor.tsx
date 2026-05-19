import { useState } from 'react';
import { Plus, X, Globe, FileText, AlignLeft, ChevronDown, Upload, Link, BookOpen } from 'lucide-react';
import { KnowledgeBaseEntry, KnowledgeBaseEntryType } from '@/types';
import clsx from 'clsx';

interface KnowledgeBaseEditorProps {
  label: string;
  description: string;
  forRole: 'bot' | 'user' | 'both';
  entries: KnowledgeBaseEntry[];
  onChange: (entries: KnowledgeBaseEntry[]) => void;
  maxEntries?: number;
}

type AddMode = 'text' | 'url' | 'file';

function EntryTypeIcon({ type }: { type: KnowledgeBaseEntryType }) {
  if (type === 'url') return <Globe size={12} />;
  if (type === 'file') return <FileText size={12} />;
  return <AlignLeft size={12} />;
}

export function KnowledgeBaseEditor({
  label, description, forRole, entries, onChange, maxEntries = 5,
}: KnowledgeBaseEditorProps) {
  const [addMode, setAddMode] = useState<AddMode | null>(null);
  const [textInput, setTextInput] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const add = (type: AddMode) => {
    const content = type === 'url' ? urlInput.trim() : textInput.trim();
    if (!content) return;
    const lbl = labelInput.trim() || (type === 'url' ? urlInput.trim() : type === 'file' ? 'Document' : 'Text note');
    const entry: KnowledgeBaseEntry = {
      id: `kb-${Date.now()}`,
      type,
      label: lbl,
      content,
      forRole,
      createdAt: new Date().toISOString(),
    };
    onChange([...entries, entry]);
    setTextInput('');
    setUrlInput('');
    setLabelInput('');
    setAddMode(null);
  };

  const remove = (id: string) => onChange(entries.filter(e => e.id !== id));

  const atCap = entries.length >= maxEntries;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <BookOpen size={13} style={{ color: 'var(--accent)' }} />
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(91,111,255,0.12)', color: 'var(--accent)', border: '1px solid rgba(91,111,255,0.2)' }}>
            {entries.length}/{maxEntries}
          </span>
        </div>
        <p className="text-[11.5px]" style={{ color: 'var(--text3)' }}>{description}</p>
      </div>

      {/* Existing entries */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map(e => (
            <div
              key={e.id}
              className="rounded-[10px] border overflow-hidden"
              style={{ background: 'var(--bg3)', borderColor: 'var(--border)' }}
            >
              <div
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
              >
                <span style={{ color: 'var(--accent)' }}><EntryTypeIcon type={e.type} /></span>
                <span className="flex-1 text-[12px] font-medium truncate" style={{ color: 'var(--text)' }}>{e.label}</span>
                <span className="text-[10px] uppercase tracking-wide mr-1" style={{ color: 'var(--text3)' }}>{e.type}</span>
                <ChevronDown
                  size={12}
                  className="transition-transform flex-shrink-0"
                  style={{ color: 'var(--text3)', transform: expandedId === e.id ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
                <button
                  onClick={ev => { ev.stopPropagation(); remove(e.id); }}
                  className="ml-1 flex-shrink-0 transition-colors hover:text-red-400"
                  style={{ color: 'var(--text3)' }}
                >
                  <X size={12} />
                </button>
              </div>
              {expandedId === e.id && (
                <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-[11px] mt-2 leading-relaxed whitespace-pre-wrap break-words line-clamp-6" style={{ color: 'var(--text2)' }}>
                    {e.content}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new */}
      {!atCap && addMode === null && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setAddMode('text')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[11.5px] font-medium transition-all hover:scale-105 border"
            style={{ background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <AlignLeft size={11} /> Paste text
          </button>
          <button
            onClick={() => setAddMode('url')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[11.5px] font-medium transition-all hover:scale-105 border"
            style={{ background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <Link size={11} /> Add URL
          </button>
          <button
            onClick={() => setAddMode('file')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[11.5px] font-medium transition-all hover:scale-105 border"
            style={{ background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--text2)' }}
          >
            <Upload size={11} /> Upload doc
          </button>
        </div>
      )}

      {atCap && (
        <p className="text-[11px]" style={{ color: 'var(--text3)' }}>Maximum {maxEntries} entries reached.</p>
      )}

      {/* Add form */}
      {addMode === 'text' && (
        <AddTextForm
          labelInput={labelInput} setLabelInput={setLabelInput}
          textInput={textInput} setTextInput={setTextInput}
          onAdd={() => add('text')} onCancel={() => { setAddMode(null); setTextInput(''); setLabelInput(''); }}
        />
      )}
      {addMode === 'url' && (
        <AddUrlForm
          labelInput={labelInput} setLabelInput={setLabelInput}
          urlInput={urlInput} setUrlInput={setUrlInput}
          onAdd={() => add('url')} onCancel={() => { setAddMode(null); setUrlInput(''); setLabelInput(''); }}
        />
      )}
      {addMode === 'file' && (
        <AddFileForm
          labelInput={labelInput} setLabelInput={setLabelInput}
          textInput={textInput} setTextInput={setTextInput}
          onAdd={() => add('file')} onCancel={() => { setAddMode(null); setTextInput(''); setLabelInput(''); }}
        />
      )}
    </div>
  );
}

function FormShell({ title, icon, onCancel, onAdd, canAdd, children }: {
  title: string; icon: React.ReactNode; onCancel: () => void; onAdd: () => void; canAdd: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border p-4 flex flex-col gap-3" style={{ background: 'var(--bg3)', borderColor: 'var(--border2)' }}>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text)' }}>{title}</span>
      </div>
      {children}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-[8px] text-[12px] transition-colors" style={{ color: 'var(--text3)' }}>Cancel</button>
        <button
          onClick={onAdd} disabled={!canAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Plus size={11} /> Add
        </button>
      </div>
    </div>
  );
}

function LabelInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10.5px] font-medium block mb-1" style={{ color: 'var(--text3)' }}>Display label (optional)</label>
      <input
        type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder="e.g. Product brochure"
        className="w-full px-3 py-2 rounded-[8px] text-[12px] outline-none border"
        style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text)' }}
      />
    </div>
  );
}

function AddTextForm({ labelInput, setLabelInput, textInput, setTextInput, onAdd, onCancel }: any) {
  return (
    <FormShell title="Paste text content" icon={<AlignLeft size={13} />} onCancel={onCancel} onAdd={onAdd} canAdd={textInput.trim().length > 0}>
      <LabelInput value={labelInput} onChange={setLabelInput} />
      <div>
        <label className="text-[10.5px] font-medium block mb-1" style={{ color: 'var(--text3)' }}>Content</label>
        <textarea
          value={textInput} onChange={e => setTextInput(e.target.value)}
          placeholder="Paste product descriptions, FAQs, brochure copy, LinkedIn bio, talking points…"
          rows={5}
          className="w-full px-3 py-2 rounded-[8px] text-[12px] outline-none border resize-none leading-relaxed"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        <p className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>{textInput.length} chars</p>
      </div>
    </FormShell>
  );
}

function AddUrlForm({ labelInput, setLabelInput, urlInput, setUrlInput, onAdd, onCancel }: any) {
  const valid = urlInput.trim().startsWith('http');
  return (
    <FormShell title="Add URL" icon={<Globe size={13} />} onCancel={onCancel} onAdd={onAdd} canAdd={valid}>
      <LabelInput value={labelInput} onChange={setLabelInput} />
      <div>
        <label className="text-[10.5px] font-medium block mb-1" style={{ color: 'var(--text3)' }}>URL</label>
        <input
          type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
          placeholder="https://yourcompany.com/product or LinkedIn profile URL"
          className="w-full px-3 py-2 rounded-[8px] text-[12px] outline-none border"
          style={{ background: 'var(--bg2)', borderColor: valid || !urlInput ? 'var(--border)' : '#FF6B6B', color: 'var(--text)' }}
        />
        <p className="text-[10px] mt-1" style={{ color: 'var(--text3)' }}>Supports: product pages, LinkedIn profiles, company sites, blog posts</p>
      </div>
    </FormShell>
  );
}

function AddFileForm({ labelInput, setLabelInput, textInput, setTextInput, onAdd, onCancel }: any) {
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File) => {
    setLabelInput(file.name);
    const reader = new FileReader();
    reader.onload = e => setTextInput(e.target?.result as string ?? '');
    reader.readAsText(file);
  };

  return (
    <FormShell title="Upload document" icon={<Upload size={13} />} onCancel={onCancel} onAdd={onAdd} canAdd={textInput.trim().length > 0}>
      <LabelInput value={labelInput} onChange={setLabelInput} />
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        className={clsx('border-2 border-dashed rounded-[10px] p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors', dragging ? 'border-accent bg-accent/5' : 'border-[var(--border2)]')}
        onClick={() => document.getElementById('kb-file-input')?.click()}
        style={{ background: dragging ? undefined : 'var(--bg2)' }}
      >
        <input
          id="kb-file-input" type="file" accept=".txt,.pdf,.doc,.docx,.md,.csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <Upload size={20} style={{ color: 'var(--text3)' }} />
        <p className="text-[11.5px] text-center" style={{ color: 'var(--text3)' }}>
          {textInput ? `File loaded (${textInput.length} chars)` : 'Drag & drop or click to upload'}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--text3)' }}>.txt, .md, .csv, .pdf, .doc</p>
      </div>
      {textInput && (
        <p className="text-[11px]" style={{ color: 'var(--accent3)' }}>Document loaded — {textInput.length.toLocaleString()} characters</p>
      )}
    </FormShell>
  );
}
