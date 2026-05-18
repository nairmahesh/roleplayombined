import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Session } from '../models/Session';
import { Persona } from '../models/Persona';
import { User } from '../models/User';
import { EvaluationPrompt } from '../models/EvaluationPrompt';
import { generatePersonaResponse, generateSessionFeedback } from '../services/gemini';
import { logConvaiUsage } from '../services/usage';

const router = Router();
router.use(authenticate);

function serializeSession(s: InstanceType<typeof Session>, persona?: InstanceType<typeof Persona> | null) {
  const obj = s.toObject() as unknown as Record<string, unknown>;
  return {
    ...obj,
    id: s._id.toString(),
    userId: s.userId.toString(),
    companyId: s.companyId.toString(),
    personaId: s.personaId?.toString(),
    persona: persona
      ? {
          id: persona._id.toString(),
          name: persona.name,
          title: persona.title,
          emoji: persona.emoji,
          difficulty: persona.difficulty,
        }
      : undefined,
    messages: s.messages.map((m) => ({
      id: m._id?.toString(),
      sessionId: s._id.toString(),
      role: m.role,
      content: m.content,
      timestampMs: m.timestampMs,
      audioUrl: m.audioUrl,
    })),
    frameworkScores: s.frameworkScores.map((fs) => ({
      id: fs._id?.toString(),
      component: fs.component,
      score: fs.score,
      feedback: fs.feedback,
      evidence: fs.evidence,
    })),
    timelineEvents: s.timelineEvents.map((te) => ({
      id: te._id?.toString(),
      type: te.type,
      timestampMs: te.timestampMs,
      title: te.title,
      description: te.description,
      suggestion: te.suggestion,
      transcriptRef: te.transcriptRef,
      betterResponse: te.betterResponse,
    })),
  };
}

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = req.companyId;
  const userId = req.userId;
  const role = req.userRole;

  const filter: Record<string, unknown> =
    role === 'AGENT' ? { userId, companyId } : { companyId };

  const sessions = await Session.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const personaIds = [...new Set(sessions.map((s) => s.personaId?.toString()).filter(Boolean))];
  const personas = await Persona.find({ _id: { $in: personaIds } }).lean();
  const personaMap = new Map(personas.map((p) => [p._id.toString(), p]));

  const userIds = [...new Set(sessions.map((s) => s.userId.toString()))];
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const result = sessions.map((s) => {
    const u = userMap.get(s.userId.toString());
    const p = s.personaId ? personaMap.get(s.personaId.toString()) : undefined;
    return {
      id: s._id.toString(),
      type: s.type,
      status: s.status,
      framework: s.framework,
      totalScore: s.totalScore,
      durationSeconds: s.durationSeconds,
      recordingUrl: s.recordingUrl,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      createdAt: s.createdAt,
      user: u ? { id: u._id.toString(), firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl } : undefined,
      persona: p ? { id: p._id.toString(), name: p.name, title: p.title, emoji: p.emoji, difficulty: p.difficulty } : undefined,
      frameworkScores: s.frameworkScores,
      timelineEvents: s.timelineEvents,
    };
  });

  res.json({ sessions: result, total: result.length });
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { type, framework, personaId, scenarioConfig } = req.body as {
    type: string;
    framework: string;
    personaId?: string;
    scenarioConfig?: Record<string, unknown>;
  };

  const session = await Session.create({
    type,
    framework,
    status: 'PENDING',
    userId: req.userId,
    companyId: req.companyId,
    personaId: personaId ? new mongoose.Types.ObjectId(personaId) : undefined,
    scenarioConfig,
  });

  const persona = personaId ? await Persona.findById(personaId) : null;
  res.status(201).json(serializeSession(session, persona));
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await Session.findById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const persona = session.personaId ? await Persona.findById(session.personaId) : null;
  const user = await User.findById(session.userId).lean();

  const data = serializeSession(session, persona) as Record<string, unknown>;
  if (user) {
    data.user = { id: user._id.toString(), firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl };
  }
  res.json(data);
});

// General update — used by the frontend to persist recordingUrl after upload
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const allowed: Record<string, unknown> = {};
  if (req.body.recordingUrl !== undefined) allowed.recordingUrl = req.body.recordingUrl;
  if (req.body.notes !== undefined) allowed.notes = req.body.notes;
  const session = await Session.findByIdAndUpdate(req.params.id, allowed, { new: true });
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json({ ok: true });
});

router.patch('/:id/start', async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await Session.findByIdAndUpdate(
    req.params.id,
    { status: 'IN_PROGRESS', startedAt: new Date() },
    { new: true }
  );
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  res.json({ status: session.status });
});

router.patch('/:id/end', async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await Session.findById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const { skipAnalysis = false, durationSeconds: clientDuration } = req.body as {
    skipAnalysis?: boolean;
    durationSeconds?: number;
    transcript?: unknown;
  };

  const now = new Date();
  const serverDuration = session.startedAt
    ? Math.round((now.getTime() - session.startedAt.getTime()) / 1000)
    : 0;
  const durationSeconds = clientDuration ?? serverDuration;

  session.status = 'COMPLETED';
  session.endedAt = now;
  session.durationSeconds = durationSeconds;

  // Log ConvAI session duration for cost tracking
  if (durationSeconds > 0) {
    logConvaiUsage({
      durationSeconds,
      sessionId: session._id as mongoose.Types.ObjectId,
      companyId: session.companyId as mongoose.Types.ObjectId | undefined,
      userId: session.userId as mongoose.Types.ObjectId,
    });
  }

  // Build transcript for AI feedback (unless client explicitly skipped analysis)
  if (!skipAnalysis && session.messages.length > 0) {
    const transcript = session.messages
      .map((m) => `${m.role === 'user' ? 'Sales Rep' : 'Prospect'}: ${m.content}`)
      .join('\n');

    const evalPrompt = await EvaluationPrompt.findOne({
      roleplayType: session.scenarioConfig?.roleplayType,
      isActive: true,
    });

    const ctx = {
      sessionId: session._id as mongoose.Types.ObjectId,
      companyId: session.companyId as mongoose.Types.ObjectId | undefined,
      userId: session.userId as mongoose.Types.ObjectId,
    };
    const promptTemplate = evalPrompt?.promptTemplate ?? defaultFeedbackPrompt(session.framework);
    try {
      const rawFeedback = await generateSessionFeedback(transcript, session.framework, promptTemplate, ctx);
      const cleanJson = rawFeedback.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      session.aiFeedback = JSON.stringify(parsed);
      session.totalScore = parsed.overallScore;

      if (parsed.scorecardGroups) {
        session.frameworkScores = parsed.scorecardGroups.map((g: { group: string; earnedPoints: number; maxPoints: number }) => ({
          component: g.group,
          score: Math.round((g.earnedPoints / g.maxPoints) * 100),
          feedback: '',
          evidence: [],
        }));
      }

      if (parsed.timelineEvents) {
        session.timelineEvents = parsed.timelineEvents;
      }
    } catch (err) {
      console.error('AI feedback generation failed:', err);
    }
  }

  await session.save();
  const persona = session.personaId ? await Persona.findById(session.personaId) : null;
  res.json(serializeSession(session, persona));
});

router.post('/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const { role, content, timestampMs, audioUrl } = req.body as {
    role: 'user' | 'assistant';
    content: string;
    timestampMs: number;
    audioUrl?: string;
  };

  const session = await Session.findById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const message = { role, content, timestampMs, audioUrl };
  session.messages.push(message);
  await session.save();

  const savedMsg = session.messages[session.messages.length - 1];
  res.status(201).json({
    id: savedMsg._id?.toString(),
    sessionId: session._id.toString(),
    role: savedMsg.role,
    content: savedMsg.content,
    timestampMs: savedMsg.timestampMs,
  });
});

router.post('/:id/ai-response', async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await Session.findById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const persona = session.personaId ? await Persona.findById(session.personaId) : null;
  const systemPrompt = session.scenarioConfig?.personaContext ?? persona?.systemPrompt ?? 'You are a prospect in a sales call.';
  const personaName = session.scenarioConfig?.displayName ?? persona?.name ?? 'Prospect';
  const personaTitle = session.scenarioConfig?.displayTitle ?? persona?.title ?? '';
  const objections = persona?.objections ?? [];

  const history = session.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const response = await generatePersonaResponse(systemPrompt, history, session.framework, personaName, personaTitle, objections);
  res.json({ response });
});

router.post('/:id/share', async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await Session.findById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
  const shareUrl = `${req.protocol}://${req.get('host')}/sessions/${session._id}`;
  res.json({ shareUrl });
});

router.get('/:id/peer-scores', async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await Session.findById(req.params.id);
  if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

  const peers = await Session.find({
    companyId: session.companyId,
    framework: session.framework,
    status: 'COMPLETED',
    _id: { $ne: session._id },
  })
    .sort({ totalScore: -1 })
    .limit(10)
    .populate<{ userId: InstanceType<typeof User> }>('userId', 'firstName lastName');

  const result = peers.map((p, i) => ({
    userId: p.userId._id?.toString(),
    name: `${p.userId.firstName} ${p.userId.lastName}`,
    score: p.totalScore ?? 0,
    rank: i + 1,
  }));

  res.json(result);
});

function defaultFeedbackPrompt(framework: string): string {
  return `You are an expert sales coach evaluating a roleplay transcript.
Framework used: ${framework}

Analyze the transcript and return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "overallFeedback": "<2-3 sentence summary>",
  "scorecardGroups": [
    {
      "group": "<skill area>",
      "maxPoints": <int>,
      "earnedPoints": <int>,
      "criteria": [
        { "question": "<what was evaluated>", "passed": <true|false>, "reasoning": "<1 sentence>" }
      ]
    }
  ],
  "timelineEvents": [
    { "type": "<ISSUE|GOOD|WARNING|NEUTRAL>", "timestampMs": <ms>, "title": "<short>", "description": "<what happened>", "suggestion": "<tip or null>", "transcriptRef": "<quote or null>", "betterResponse": "<alt or null>" }
  ],
  "strengths": ["<strength>"],
  "improvements": ["<improvement>"],
  "proTip": "<single most impactful tip>"
}

TRANSCRIPT:
{transcript}`;
}

export default router;
