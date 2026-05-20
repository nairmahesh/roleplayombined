import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, ExternalLink, RefreshCw, Unlink, CircleAlert as AlertCircle, Info, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface CrmDef {
  id: string;
  name: string;
  logo: string;
  color: string;
  bg: string;
  tagline: string;
  authMethod: 'oauth2' | 'api_key';
  docsUrl: string;
  features: string[];
  oauthProvider?: string;
  fields?: { key: string; label: string; placeholder: string; type?: string }[];
}

const CRMS: CrmDef[] = [
  {
    id: 'salesforce',
    name: 'Salesforce',
    logo: 'SF',
    color: '#00A1E0',
    bg: 'rgba(0,161,224,0.08)',
    tagline: 'World\'s #1 CRM — sync roleplay sessions as lead activities and update contact scores automatically.',
    authMethod: 'oauth2',
    oauthProvider: 'Salesforce',
    docsUrl: 'https://developer.salesforce.com/docs/apis',
    features: [
      'Log sessions as Lead Activities',
      'Update Contact score field after each call',
      'Sync persona to Opportunity Contact Role',
      'Push coaching highlights to Chatter',
    ],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    logo: 'HS',
    color: '#FF7A59',
    bg: 'rgba(255,122,89,0.08)',
    tagline: 'Log roleplay results as deal timeline events and surface coaching insights on the contact record.',
    authMethod: 'oauth2',
    oauthProvider: 'HubSpot',
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
    features: [
      'Create Timeline Events on Deals',
      'Add Notes with AI feedback summary',
      'Tag Contacts with performance tier',
      'Trigger Workflows on score threshold',
    ],
  },
  {
    id: 'freshsales',
    name: 'Freshsales',
    logo: 'FR',
    color: '#2ECC71',
    bg: 'rgba(46,204,113,0.08)',
    tagline: 'Attach session feedback to contacts and opportunities inside Freshsales Suite.',
    authMethod: 'api_key',
    docsUrl: 'https://developer.freshsales.io/api/',
    features: [
      'Create Activity on Contact/Lead',
      'Update custom score field',
      'Attach transcript as a Note',
      'Map personas to Sales Sequences',
    ],
    fields: [
      { key: 'domain', label: 'Freshsales Domain', placeholder: 'yourcompany.freshsales.io' },
      { key: 'api_key', label: 'API Key', placeholder: 'Paste your API key', type: 'password' },
    ],
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    logo: 'PD',
    color: '#1F4C99',
    bg: 'rgba(31,76,153,0.08)',
    tagline: 'Push session scores and coaching highlights directly to deal notes in Pipedrive.',
    authMethod: 'oauth2',
    oauthProvider: 'Pipedrive',
    docsUrl: 'https://developers.pipedrive.com/docs/api/v1',
    features: [
      'Add Activity on Deal',
      'Create Note with feedback summary',
      'Update custom Deal field with score',
      'Filter pipeline by rep performance',
    ],
  },
  {
    id: 'odoo',
    name: 'Odoo',
    logo: 'OD',
    color: '#875A7B',
    bg: 'rgba(135,90,123,0.08)',
    tagline: 'Create CRM lead activities and link completed sessions to customer records in Odoo.',
    authMethod: 'api_key',
    docsUrl: 'https://www.odoo.com/documentation/17.0/developer/reference/external_api.html',
    features: [
      'Log Activity on CRM Lead',
      'Attach session transcript to Chatter',
      'Update Partner coaching score',
      'Trigger automated follow-up actions',
    ],
    fields: [
      { key: 'url', label: 'Odoo URL', placeholder: 'https://yourcompany.odoo.com' },
      { key: 'db', label: 'Database Name', placeholder: 'yourcompany' },
      { key: 'api_key', label: 'API Key', placeholder: 'Paste your API key', type: 'password' },
    ],
  },
];

interface ConnectionState {
  status: ConnectionStatus;
  connectedAs?: string;
  connectedAt?: string;
  fieldValues?: Record<string, string>;
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1px solid rgba(6,214,160,0.25)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#06D6A0] animate-pulse" />
        Connected
      </span>
    );
  }
  if (status === 'connecting') {
    return (
      <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,209,102,0.12)', color: '#FFD166', border: '1px solid rgba(255,209,102,0.25)' }}>
        <RefreshCw size={9} className="animate-spin" />
        Connecting…
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.25)' }}>
        <AlertCircle size={9} />
        Error
      </span>
    );
  }
  return (
    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text3)', border: '1px solid var(--border)' }}>
      Not connected
    </span>
  );
}

function CrmCard({ crm }: { crm: CrmDef }) {
  const [state, setState] = useState<ConnectionState>({ status: 'disconnected' });
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries((crm.fields ?? []).map(f => [f.key, '']))
  );

  const handleOAuth = () => {
    setState(s => ({ ...s, status: 'connecting' }));
    // Simulate OAuth popup flow — in production this opens the real OAuth URL
    const popup = window.open(
      `about:blank`,
      `Connect ${crm.name}`,
      'width=520,height=640,scrollbars=yes,resizable=yes'
    );
    if (popup) {
      popup.document.write(`
        <html><head><title>Connect ${crm.name}</title>
        <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#0D0E14;color:#F0F2FF;}
        .logo{width:72px;height:72px;border-radius:18px;background:${crm.color};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:white;margin-bottom:20px;}
        h2{margin:0 0 8px;font-size:18px;}p{color:#aaa;font-size:13px;text-align:center;max-width:300px;}
        .btn{margin-top:24px;padding:12px 32px;border-radius:10px;background:${crm.color};color:white;border:none;font-size:14px;font-weight:600;cursor:pointer;}
        .btn:hover{opacity:0.9;}</style></head>
        <body><div class="logo">${crm.logo}</div>
        <h2>Connect ${crm.name}</h2>
        <p>PitchIQ is requesting access to your ${crm.name} account to sync roleplay sessions and scores.</p>
        <button class="btn" onclick="window.opener.postMessage({type:'pitchiq_oauth_success',crm:'${crm.id}'},'*');window.close()">
          Authorize PitchIQ
        </button></body></html>
      `);
    }
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'pitchiq_oauth_success' && e.data?.crm === crm.id) {
        window.removeEventListener('message', handler);
        setState({ status: 'connected', connectedAs: `your-org@${crm.name.toLowerCase()}.com`, connectedAt: new Date().toLocaleString() });
        toast.success(`${crm.name} connected successfully`);
      }
    };
    window.addEventListener('message', handler);
    // Fallback: if popup is blocked or user closes it without authorizing
    setTimeout(() => {
      window.removeEventListener('message', handler);
      if (!popup || popup.closed) return;
      setState(s => s.status === 'connecting' ? { status: 'error' } : s);
    }, 60000);
  };

  const handleApiKeyConnect = () => {
    const missing = (crm.fields ?? []).filter(f => !fields[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Fill in: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setState(s => ({ ...s, status: 'connecting' }));
    setTimeout(() => {
      setState({ status: 'connected', connectedAs: fields['domain'] || fields['url'] || crm.name, connectedAt: new Date().toLocaleString() });
      toast.success(`${crm.name} connected successfully`);
    }, 1800);
  };

  const handleDisconnect = () => {
    setState({ status: 'disconnected' });
    setFields(Object.fromEntries((crm.fields ?? []).map(f => [f.key, ''])));
    toast(`${crm.name} disconnected`);
  };

  const isConnected = state.status === 'connected';

  return (
    <motion.div
      layout
      className="rounded-[14px] border overflow-hidden transition-colors"
      style={{
        background: 'var(--bg2)',
        borderColor: isConnected ? `${crm.color}44` : 'var(--border)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className="w-11 h-11 rounded-[11px] flex items-center justify-center text-[13px] font-black text-white flex-shrink-0"
          style={{ background: crm.color }}
        >
          {crm.logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-[14px] font-bold" style={{ color: 'var(--text)' }}>{crm.name}</span>
            <StatusBadge status={state.status} />
          </div>
          {isConnected ? (
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
              {state.connectedAs} · connected {state.connectedAt}
            </div>
          ) : (
            <div className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--text3)' }}>
              {crm.tagline.split('—')[0].trim()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isConnected ? (
            <>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11.5px] font-medium border transition-all hover:scale-105"
                style={{ borderColor: 'rgba(255,107,107,0.3)', color: '#FF6B6B', background: 'rgba(255,107,107,0.06)' }}
              >
                <Unlink size={11} /> Disconnect
              </button>
              <button
                onClick={() => setExpanded(v => !v)}
                className="p-2 rounded-[8px] border transition-all hover:scale-105"
                style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}
              >
                <ChevronRight size={13} className={clsx('transition-transform', expanded && 'rotate-90')} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12px] font-semibold transition-all hover:scale-105"
              style={{ background: crm.bg, color: crm.color, border: `1px solid ${crm.color}44` }}
            >
              Configure <ChevronRight size={12} className={clsx('transition-transform', expanded && 'rotate-90')} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded connect panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t flex flex-col gap-4" style={{ borderColor: 'var(--border)' }}>
              {/* What syncs */}
              <div>
                <p className="text-[10.5px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>What syncs</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {crm.features.map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <Check size={11} style={{ color: crm.color, flexShrink: 0 }} />
                      <span className="text-[12px]" style={{ color: 'var(--text2)' }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isConnected ? (
                <div className="flex items-start gap-2 p-3 rounded-[10px]" style={{ background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.2)' }}>
                  <Check size={12} style={{ color: '#06D6A0', flexShrink: 0, marginTop: 2 }} />
                  <p className="text-[12px]" style={{ color: 'var(--text2)' }}>
                    Integration is active. Sessions are being synced to <strong>{crm.name}</strong> automatically after each completed roleplay.
                  </p>
                </div>
              ) : crm.authMethod === 'oauth2' ? (
                /* OAuth single-click connect */
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2 p-3 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <Info size={12} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 2 }} />
                    <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                      Uses <strong style={{ color: 'var(--text2)' }}>OAuth 2.0</strong> — no passwords stored. A popup will open to authorize PitchIQ in your {crm.name} account. You can revoke access any time from {crm.name}'s connected apps settings.
                    </p>
                  </div>
                  <button
                    onClick={handleOAuth}
                    disabled={state.status === 'connecting'}
                    className="flex items-center justify-center gap-2.5 w-full py-3 rounded-[11px] text-[13.5px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: crm.color, color: '#fff' }}
                  >
                    {state.status === 'connecting' ? (
                      <><RefreshCw size={14} className="animate-spin" /> Waiting for authorization…</>
                    ) : (
                      <><Zap size={14} /> Connect with {crm.name}</>
                    )}
                  </button>
                  <a
                    href={crm.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-[11.5px] transition-colors hover:underline"
                    style={{ color: 'var(--text3)' }}
                  >
                    <ExternalLink size={10} /> {crm.name} API docs
                  </a>
                </div>
              ) : (
                /* API key connect */
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-2 p-3 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                    <Info size={12} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 2 }} />
                    <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                      Connects via <strong style={{ color: 'var(--text2)' }}>API Key</strong>. Your key is encrypted at rest and never exposed in the UI after saving.
                    </p>
                  </div>
                  {(crm.fields ?? []).map(field => (
                    <div key={field.key}>
                      <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text3)' }}>
                        {field.label}
                      </label>
                      <input
                        type={field.type ?? 'text'}
                        value={fields[field.key]}
                        onChange={e => setFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="input-base text-[12.5px]"
                      />
                    </div>
                  ))}
                  <button
                    onClick={handleApiKeyConnect}
                    disabled={state.status === 'connecting'}
                    className="flex items-center justify-center gap-2.5 w-full py-3 rounded-[11px] text-[13.5px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{ background: crm.color, color: '#fff' }}
                  >
                    {state.status === 'connecting' ? (
                      <><RefreshCw size={14} className="animate-spin" /> Connecting…</>
                    ) : (
                      <><Zap size={14} /> Connect {crm.name}</>
                    )}
                  </button>
                  <a
                    href={crm.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-[11.5px] transition-colors hover:underline"
                    style={{ color: 'var(--text3)' }}
                  >
                    <ExternalLink size={10} /> {crm.name} API docs
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function IntegrationsPage() {
  const connectedCount = 0; // would derive from real state

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text3)' }}>
          Connect PitchIQ to your CRM so roleplay sessions, scores, and AI coaching highlights sync automatically to lead and contact records.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-[13px] border p-4 flex flex-col gap-3" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { n: '1', title: 'Connect your CRM', desc: 'One click via OAuth or paste an API key. No passwords stored.' },
            { n: '2', title: 'Complete a session', desc: 'After any roleplay ends, PitchIQ packages the score and AI feedback.' },
            { n: '3', title: 'Auto-sync', desc: 'A note, activity, or score update is written to the matching CRM record.' },
          ].map(({ n, title, desc }) => (
            <div key={n} className="flex gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5" style={{ background: 'rgba(91,111,255,0.15)', color: 'var(--accent)' }}>
                {n}
              </div>
              <div>
                <div className="text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{title}</div>
                <div className="text-[11.5px] mt-0.5 leading-snug" style={{ color: 'var(--text3)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CRM cards */}
      <div className="flex flex-col gap-3">
        {CRMS.map(crm => <CrmCard key={crm.id} crm={crm} />)}
      </div>

      {/* Footer note */}
      <p className="text-[11.5px] text-center" style={{ color: 'var(--text3)' }}>
        All integrations use read/write OAuth scopes or encrypted API keys. PitchIQ never stores CRM passwords. You can revoke access at any time.
      </p>
    </div>
  );
}
