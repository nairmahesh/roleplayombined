import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Persona } from '../models/Persona';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { createAgent, updateAgent, checkHealth } from '../services/elevenlabs';

// Build the ElevenLabs agent config from a persona document
function buildAgentConfig(persona: { name: string; title: string; systemPrompt: string; voiceId?: string; openingLine?: string; firstSpeaker?: string }) {
  const firstName = persona.name.split(' ')[0];
  const defaultFirstMessage = persona.openingLine || `${firstName} speaking.`;
  const openingInstruction = `\n\n---\nCONVERSATION OPENING RULES:\n- If you are receiving an inbound call (phone), answer with a short, natural phone greeting such as "${firstName} speaking." or "Hello?"\n- If you are in an online meeting and the other party joins, greet them warmly: "Hi! ${firstName} here — thanks for joining."\n- If the roleplay involves you (the prospect) having made an outbound call (e.g. cold call), do NOT speak first. Wait silently for the user to respond.\n- Never introduce your full name and title unprompted unless you are pitching.\n---`;
  return {
    name: `${persona.name} — ${persona.title}`,
    conversation_config: {
      agent: {
        first_message: defaultFirstMessage,
        language: 'en',
        prompt: {
          prompt: (persona.systemPrompt || '') + openingInstruction,
          llm: 'gemini-2.0-flash',
          temperature: 0.8,
        },
      },
      tts: {
        voice_id: persona.voiceId || 'EXAVITQu4vr4xnSDxMaL',
        model_id: 'eleven_turbo_v2',
      },
    },
  };
}

// Try to create an ElevenLabs agent for a persona; returns agentId or null if unavailable.
async function tryCreateAgent(persona: InstanceType<typeof Persona>): Promise<string | null> {
  try {
    const health = await checkHealth();
    if (!health.convaiAvailable) return null;
    const result = await createAgent(buildAgentConfig(persona));
    return result.agent_id;
  } catch {
    return null;
  }
}

// The fields that affect the ElevenLabs agent config
const AGENT_RELEVANT_FIELDS = new Set(['name', 'title', 'systemPrompt', 'voiceId', 'openingLine', 'firstSpeaker']);

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const personas = await Persona.find({
    $or: [{ isPreset: true }, { companyId: req.companyId }],
  }).lean();

  res.json(
    personas.map((p) => ({
      ...p,
      id: p._id.toString(),
      companyId: p.companyId?.toString(),
      createdById: p.createdById?.toString(),
    }))
  );
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const data = req.body as Record<string, unknown>;
  const persona = await Persona.create({
    ...data,
    companyId: req.companyId,
    createdById: req.userId,
    isPreset: false,
  });

  // Auto-create ElevenLabs agent in background (non-blocking — doesn't fail the request)
  const agentId = await tryCreateAgent(persona);
  if (agentId) {
    persona.agentId = agentId;
    await persona.save();
  }

  res.status(201).json({ ...persona.toObject(), id: persona._id.toString() });
});

router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const persona = await Persona.findById(req.params.id);
  if (!persona) { res.status(404).json({ error: 'Persona not found' }); return; }
  if (persona.isPreset) { res.status(403).json({ error: 'Cannot edit preset personas' }); return; }
  if (persona.companyId?.toString() !== req.companyId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  const allowed = ['name', 'title', 'company', 'industry', 'emoji', 'difficulty', 'personality',
    'systemPrompt', 'objections', 'buyingSignals', 'frameworks', 'voiceId', 'agentId',
    'firstSpeaker', 'openingLine', 'personaType', 'avatarId'];
  const update = Object.fromEntries(
    Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
  );

  const updated = await Persona.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
  if (!updated) { res.status(404).json({ error: 'Persona not found' }); return; }

  // Sync ElevenLabs agent when agent-relevant fields changed
  const agentFieldsChanged = Object.keys(update).some(k => AGENT_RELEVANT_FIELDS.has(k));
  if (agentFieldsChanged) {
    const agentConfig = buildAgentConfig({
      name: (update.name as string) ?? updated.name,
      title: (update.title as string) ?? updated.title,
      systemPrompt: (update.systemPrompt as string) ?? updated.systemPrompt,
      voiceId: (update.voiceId as string | undefined) ?? updated.voiceId,
      openingLine: (update.openingLine as string | undefined) ?? updated.openingLine,
      firstSpeaker: (update.firstSpeaker as string | undefined) ?? updated.firstSpeaker,
    });

    if (updated.agentId) {
      // Update existing agent (fire-and-forget)
      updateAgent(updated.agentId, agentConfig).catch(() => {/* ignore — agent may be gone */});
    } else {
      // No agent yet — try to create one using the merged config
      const merged = buildAgentConfig({
        name: (update.name as string) ?? updated.name,
        title: (update.title as string) ?? updated.title,
        systemPrompt: (update.systemPrompt as string) ?? updated.systemPrompt,
        voiceId: (update.voiceId as string | undefined) ?? updated.voiceId,
        openingLine: (update.openingLine as string | undefined) ?? updated.openingLine,
        firstSpeaker: (update.firstSpeaker as string | undefined) ?? updated.firstSpeaker,
      });
      (async () => {
        try {
          const health = await checkHealth();
          if (!health.convaiAvailable) return;
          const result = await createAgent(merged);
          await Persona.findByIdAndUpdate(req.params.id, { agentId: result.agent_id });
        } catch { /* ignore */ }
      })();
    }
  }

  res.json({ ...updated, id: updated._id.toString() });
});

router.get('/:id/analytics', async (req: AuthRequest, res: Response): Promise<void> => {
  const personaId = req.params.id;

  const [agg, lastSession] = await Promise.all([
    Session.aggregate([
      { $match: { personaId: { $exists: true }, status: 'COMPLETED' } },
      { $addFields: { personaIdStr: { $toString: '$personaId' } } },
      { $match: { personaIdStr: personaId } },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          avgScore: { $avg: '$totalScore' },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Session.findOne({ personaId: personaId, status: 'COMPLETED' })
      .sort({ endedAt: -1 })
      .select('endedAt')
      .lean(),
  ]);

  const usageCount = agg.reduce((sum, e) => sum + e.count, 0);
  const avgScore = agg.length
    ? Math.round(agg.reduce((sum, e) => sum + (e.avgScore ?? 0) * e.count, 0) / usageCount)
    : 0;

  const userIds = agg.slice(0, 5).map((e) => e._id);
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const topUsers = agg.slice(0, 5).map((e) => {
    const u = userMap.get(e._id.toString());
    return {
      name: u ? `${u.firstName} ${u.lastName}` : 'Unknown',
      count: e.count,
    };
  });

  res.json({
    usageCount,
    avgScore,
    lastUsed: lastSession?.endedAt ?? null,
    topUsers,
  });
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const persona = await Persona.findById(req.params.id);
  if (!persona) { res.status(404).json({ error: 'Persona not found' }); return; }
  if (persona.isPreset) { res.status(403).json({ error: 'Cannot delete preset personas' }); return; }
  await persona.deleteOne();
  res.json({ message: 'Deleted' });
});

export default router;
