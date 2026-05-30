import { Router, Response } from 'express';
import { AxiosError } from 'axios';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import {
  getSignedUrl,
  textToSpeech,
  listVoices,
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  checkHealth,
  AgentConfig,
} from '../services/elevenlabs';
import { Persona } from '../models/Persona';
import { SystemConfig } from '../models/SystemConfig';

const router = Router();
router.use(authenticate);

// ── Health / diagnostics ──────────────────────────────────────────────────────

router.get('/health', async (_req: AuthRequest, res: Response): Promise<void> => {
  const health = await checkHealth();
  const status = health.convaiAvailable ? 200 : 503;
  res.status(status).json(health);
});

// ── Signed URL ────────────────────────────────────────────────────────────────

// Returns a signed ElevenLabs WebSocket URL.
// Accepts optional ?personaId=<id> — uses that persona's dedicated agent if it has one,
// otherwise falls back to the global auto-created agent.
router.get('/signed-url', async (req: AuthRequest, res: Response): Promise<void> => {
  const { personaId, agentId: directAgentId } = req.query as { personaId?: string; agentId?: string };
  let resolvedAgentId: string | undefined;

  if (directAgentId) {
    // Caller supplied an explicit voice agent template ID
    resolvedAgentId = directAgentId;
    console.log(`[voice/signed-url] using explicit agentId=${resolvedAgentId}`);
  } else if (personaId) {
    // Legacy path — look up the persona's dedicated agent
    const persona = await Persona.findById(personaId).select('agentId name').lean();
    resolvedAgentId = persona?.agentId ?? undefined;
    console.log(`[voice/signed-url] personaId=${personaId} persona="${persona?.name}" agentId=${resolvedAgentId ?? '(none → global fallback)'}`);
  } else {
    console.log('[voice/signed-url] no agentId/personaId → using global default agent');
  }

  try {
    const signedUrl = await getSignedUrl(resolvedAgentId);
    console.log('[voice/signed-url] ✅ signed URL issued agentId=%s url_prefix=%s',
      resolvedAgentId ?? 'global', signedUrl.slice(0, 80));
    res.json({ signedUrl });
  } catch (err) {
    const status = (err as AxiosError)?.response?.status;
    console.error('[voice/signed-url] ElevenLabs error status=%s', status, (err as Error).message);
    if (status === 401 || status === 403) {
      res.status(503).json({
        error: 'ElevenLabs Conversational AI is not accessible with your current API key. ' +
               'Upgrade to Creator plan or above at elevenlabs.io/pricing.',
        code: 'CONVAI_UNAVAILABLE',
      });
    } else {
      throw err;
    }
  }
});

// ── TTS ───────────────────────────────────────────────────────────────────────

router.post('/tts/:voiceId', async (req: AuthRequest, res: Response): Promise<void> => {
  const { text } = req.body as { text: string };
  if (!text) { res.status(400).json({ error: 'text is required' }); return; }
  const audioBuffer = await textToSpeech(text, req.params.voiceId);
  res.set('Content-Type', 'audio/mpeg');
  res.send(audioBuffer);
});

// ── Voices ────────────────────────────────────────────────────────────────────

router.get('/voices', async (_req: AuthRequest, res: Response): Promise<void> => {
  const voices = await listVoices();
  res.json(voices);
});

// ── Agent management (admin/manager only) ────────────────────────────────────

router.get('/agents', requireRole('COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const [agents, defaultCfg] = await Promise.all([
    listAgents(),
    SystemConfig.findOne({ key: 'defaultAgentId' }).lean(),
  ]);
  const defaultAgentId = defaultCfg?.value ?? null;
  res.json({ agents, defaultAgentId });
});

router.get('/agents/:agentId', requireRole('COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const agent = await getAgent(req.params.agentId);
  res.json(agent);
});

router.post('/agents', requireRole('COMPANY_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const payload = req.body as AgentConfig;
  try {
    const result = await createAgent(payload);
    res.status(201).json(result);
  } catch (err) {
    const status = (err as AxiosError)?.response?.status;
    if (status === 401 || status === 403) {
      res.status(503).json({
        error: 'ElevenLabs Conversational AI is not accessible. Upgrade to Creator plan or above.',
        code: 'CONVAI_UNAVAILABLE',
      });
    } else {
      throw err;
    }
  }
});

router.patch('/agents/:agentId', requireRole('COMPANY_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const payload = req.body as AgentConfig;
  const result = await updateAgent(req.params.agentId, payload);
  res.json(result);
});

router.delete('/agents/:agentId', requireRole('COMPANY_ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const defaultCfg = await SystemConfig.findOne({ key: 'defaultAgentId' }).lean();
  if (defaultCfg?.value === req.params.agentId) {
    res.status(409).json({ error: 'Cannot delete the default voice agent. Set another agent as default first.' });
    return;
  }
  await deleteAgent(req.params.agentId);
  res.status(204).send();
});

export default router;
