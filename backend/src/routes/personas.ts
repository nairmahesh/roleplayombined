import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Persona } from '../models/Persona';
import { Session } from '../models/Session';
import { User } from '../models/User';

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
  res.json({ ...updated, id: updated!._id.toString() });
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
