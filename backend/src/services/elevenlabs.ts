/**
 * ElevenLabs service — API key only required.
 * If ELEVENLABS_AGENT_ID is not set, one default agent is auto-created on the
 * first request and its ID is logged to console so you can persist it in .env.
 *
 * NOTE: Conversational AI endpoints (/v1/convai/) require the ElevenLabs
 * Creator plan or above. TTS endpoints (/v1/text-to-speech/) work on all plans.
 *
 * Client-side overrides (prompt, first_message, voice_id) must be enabled per-agent
 * in the ElevenLabs dashboard → Agent settings → Security → Allowed overrides.
 * Each persona should have its own dedicated agent with the system prompt baked in.
 */
import axios, { AxiosError } from 'axios';
import mongoose from 'mongoose';
import { config } from '../config';
import { logTtsUsage } from './usage';
import { SystemConfig } from '../models/SystemConfig';

const EL_BASE = 'https://api.elevenlabs.io/v1';

const authHeader = () => ({ 'xi-api-key': config.elevenlabs.apiKey });

// ── Agent management ──────────────────────────────────────────────────────────

function isValidAgentId(id: string): boolean {
  if (!id) return false;
  if (id.startsWith('your-') || id.includes('placeholder') || id.includes('example')) return false;
  return id.length > 4;
}

// Cached for process lifetime. Seeded from env if available and looks valid.
let _agentId: string = isValidAgentId(config.elevenlabs.agentId) ? config.elevenlabs.agentId : '';

export async function getOrCreateAgentId(): Promise<string> {
  if (_agentId) return _agentId;

  // 1. Check MongoDB for a previously persisted agent ID
  try {
    const stored = await SystemConfig.findOne({ key: 'defaultAgentId' }).lean();
    if (stored && isValidAgentId(stored.value)) {
      _agentId = stored.value;
      return _agentId;
    }
  } catch {
    // DB may not be connected yet — continue
  }

  // 2. Check ElevenLabs for an existing default agent to avoid duplicate creation
  try {
    const existingRes = await axios.get<{ agents: AgentSummary[] }>(
      `${EL_BASE}/convai/agents`,
      { headers: authHeader() }
    );
    const existing = (existingRes.data.agents ?? []).find(a => a.name === 'PitchIQ Default Agent');
    if (existing) {
      _agentId = existing.agent_id;
      await SystemConfig.findOneAndUpdate(
        { key: 'defaultAgentId' },
        { value: _agentId },
        { upsert: true }
      ).catch(() => {});
      return _agentId;
    }
  } catch {
    // If listing fails, fall through to creation
  }

  // 3. Create a new default agent and persist its ID to DB
  const body: AgentConfig = {
    name: 'PitchIQ Default Agent',
    conversation_config: {
      agent: {
        // Runtime overrides this per session — this is a safe inbound-call fallback.
        first_message: 'Hello?',
        language: 'en',
        prompt: {
          prompt: `You are a sales prospect in a roleplay scenario. Stay in character as a realistic business decision-maker. Be slightly busy, raise reasonable objections, and ask clarifying questions. Keep responses concise.

CONVERSATION OPENING RULES:
- If receiving an inbound phone call, answer with a short terse greeting: "Hello?" or "Speaking."
- If joining an online meeting, greet warmly: "Hi — thanks for joining, how can I help?"
- If the scenario involves you having made an outbound/cold call, do NOT speak first — wait for the user to respond.
- Never volunteer your full name and title unless the user asks or you are pitching.`,
          llm: 'gemini-2.0-flash',
          temperature: 0.7,
        },
      },
      tts: {
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        model_id: 'eleven_turbo_v2',
      },
    },
  };

  const res = await axios.post<{ agent_id: string }>(
    `${EL_BASE}/convai/agents/create`,
    body,
    { headers: { ...authHeader(), 'Content-Type': 'application/json' } }
  );

  _agentId = res.data.agent_id;
  await SystemConfig.findOneAndUpdate(
    { key: 'defaultAgentId' },
    { value: _agentId },
    { upsert: true }
  ).catch(() => {});
  console.log(`\n✓ ElevenLabs default agent created and saved to DB: ${_agentId}\n`);
  return _agentId;
}

// ── Signed URL ────────────────────────────────────────────────────────────────

// agentId: persona-specific agent ID. Falls back to the global auto-created agent if omitted.
export async function getSignedUrl(agentId?: string): Promise<string> {
  const id = (agentId && isValidAgentId(agentId)) ? agentId : await getOrCreateAgentId();
  console.log(`[elevenlabs] getSignedUrl using agentId=${id}`);
  const res = await axios.get<{ signed_url: string }>(
    `${EL_BASE}/convai/conversation/get_signed_url?agent_id=${id}`,
    { headers: authHeader() }
  );
  return res.data.signed_url;
}

// ── TTS (text-to-speech) ──────────────────────────────────────────────────────

export async function textToSpeech(
  text: string,
  voiceId: string,
  ctx: { sessionId?: mongoose.Types.ObjectId | string; companyId?: mongoose.Types.ObjectId | string; userId?: mongoose.Types.ObjectId | string } = {},
): Promise<Buffer> {
  const res = await axios.post<ArrayBuffer>(
    `${EL_BASE}/text-to-speech/${voiceId}`,
    {
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    },
    {
      headers: { ...authHeader(), Accept: 'audio/mpeg' },
      responseType: 'arraybuffer',
    }
  );
  logTtsUsage({ operation: 'tts', characters: text.length, ...ctx });
  return Buffer.from(res.data);
}

// ── Voices ────────────────────────────────────────────────────────────────────

export async function listVoices(): Promise<{ voice_id: string; name: string }[]> {
  const res = await axios.get<{ voices: { voice_id: string; name: string }[] }>(
    `${EL_BASE}/voices`,
    { headers: authHeader() }
  );
  return res.data.voices;
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export interface ElevenLabsHealth {
  ttsAvailable: boolean;
  convaiAvailable: boolean;
  agentConfigured: boolean;
  issues: string[];
}

export async function checkHealth(): Promise<ElevenLabsHealth> {
  const issues: string[] = [];
  let ttsAvailable = false;
  let convaiAvailable = false;

  if (!config.elevenlabs.apiKey || config.elevenlabs.apiKey.startsWith('your-')) {
    issues.push('ELEVENLABS_API_KEY is not set in backend/.env');
    return { ttsAvailable: false, convaiAvailable: false, agentConfigured: false, issues };
  }

  try {
    await axios.get(`${EL_BASE}/voices`, { headers: authHeader() });
    ttsAvailable = true;
  } catch (err) {
    const status = (err as AxiosError)?.response?.status;
    issues.push(status === 401
      ? 'API key is invalid — check ELEVENLABS_API_KEY in backend/.env'
      : `TTS API error (HTTP ${status})`);
  }

  try {
    await axios.get(`${EL_BASE}/convai/agents`, { headers: authHeader() });
    convaiAvailable = true;
  } catch (err) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 401 || status === 403) {
      issues.push(
        'Conversational AI access denied — your ElevenLabs plan does not include ConvAI. ' +
        'Upgrade to Creator plan or above at elevenlabs.io/pricing'
      );
    } else {
      issues.push(`ConvAI API error (HTTP ${status})`);
    }
  }

  const agentConfigured = convaiAvailable && Boolean(_agentId);

  return { ttsAvailable, convaiAvailable, agentConfigured, issues };
}

// ── Agent management ──────────────────────────────────────────────────────────

export interface AgentConfig {
  name?: string;
  conversation_config?: {
    agent?: {
      prompt?: {
        prompt?: string;
        llm?: string;
        temperature?: number;
      };
      first_message?: string;
      language?: string;
    };
    tts?: {
      voice_id?: string;
      model_id?: string;
    };
  };
}

export interface AgentSummary {
  agent_id: string;
  name: string;
  created_at_unix_secs?: number;
}

export async function listAgents(): Promise<AgentSummary[]> {
  const res = await axios.get<{ agents: AgentSummary[] }>(
    `${EL_BASE}/convai/agents`,
    { headers: authHeader() }
  );
  return res.data.agents ?? [];
}

export async function getAgent(agentId: string): Promise<unknown> {
  const res = await axios.get(
    `${EL_BASE}/convai/agents/${agentId}`,
    { headers: authHeader() }
  );
  return res.data;
}

export async function createAgent(payload: AgentConfig): Promise<{ agent_id: string }> {
  const res = await axios.post<{ agent_id: string }>(
    `${EL_BASE}/convai/agents/create`,
    payload,
    { headers: { ...authHeader(), 'Content-Type': 'application/json' } }
  );
  return res.data;
}

export async function updateAgent(agentId: string, payload: AgentConfig): Promise<unknown> {
  const res = await axios.patch(
    `${EL_BASE}/convai/agents/${agentId}`,
    payload,
    { headers: { ...authHeader(), 'Content-Type': 'application/json' } }
  );
  return res.data;
}

export async function deleteAgent(agentId: string): Promise<void> {
  await axios.delete(
    `${EL_BASE}/convai/agents/${agentId}`,
    { headers: authHeader() }
  );
}
