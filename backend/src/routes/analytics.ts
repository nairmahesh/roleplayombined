import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Session } from '../models/Session';
import { User } from '../models/User';

const router = Router();
router.use(authenticate);

router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const userId = new mongoose.Types.ObjectId(req.userId);
  const isAgent = req.userRole === 'AGENT';

  const matchFilter = isAgent ? { companyId, userId } : { companyId };

  const [totalSessions, sessions] = await Promise.all([
    Session.countDocuments({ ...matchFilter, status: 'COMPLETED' }),
    Session.find({ ...matchFilter, status: 'COMPLETED' })
      .sort({ endedAt: -1 })
      .limit(20)
      .populate<{ userId: InstanceType<typeof User> }>('userId', 'firstName lastName avatarUrl')
      .populate('personaId', 'name emoji')
      .lean(),
  ]);

  const scores = sessions.map((s) => s.totalScore ?? 0).filter((s) => s > 0);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const passRate = scores.length
    ? Math.round((scores.filter((s) => s >= 70).length / scores.length) * 100)
    : 0;

  const activeUsers = isAgent
    ? 1
    : await User.countDocuments({ companyId, isActive: true });

  const recentSessions = sessions.slice(0, 5).map((s) => {
    const u = s.userId as InstanceType<typeof User>;
    const p = s.personaId as Record<string, unknown> | null;
    return {
      id: s._id.toString(),
      endedAt: s.endedAt,
      durationSeconds: s.durationSeconds,
      framework: s.framework,
      sessionType: s.type,
      personaName: (p as { name?: string })?.name ?? '',
      personaEmoji: (p as { emoji?: string })?.emoji ?? '',
      userFirstName: u?.firstName ?? '',
      userLastName: u?.lastName ?? '',
      totalScore: s.totalScore,
    };
  });

  // Framework stats aggregation
  const frameworkAgg = await Session.aggregate([
    { $match: { ...matchFilter, status: 'COMPLETED' } },
    { $unwind: '$frameworkScores' },
    {
      $group: {
        _id: '$frameworkScores.component',
        avgScore: { $avg: '$frameworkScores.score' },
        count: { $sum: 1 },
      },
    },
    { $project: { component: '$_id', avgScore: 1, count: 1, _id: 0 } },
  ]);

  let agentExtra;
  if (isAgent) {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const sessionsThisWeek = await Session.countDocuments({
      userId,
      status: 'COMPLETED',
      endedAt: { $gte: weekAgo },
    });

    // Simple streak: consecutive days with sessions
    const streak = await computeStreak(userId.toString());

    const leaderboard = await Session.aggregate([
      { $match: { companyId, status: 'COMPLETED' } },
      { $group: { _id: '$userId', avgScore: { $avg: '$totalScore' } } },
      { $sort: { avgScore: -1 } },
    ]);
    const rank = leaderboard.findIndex((e) => e._id.toString() === userId.toString()) + 1;

    agentExtra = { sessionsThisWeek, streak, rank: rank || undefined };
  }

  res.json({
    totalSessions,
    avgScore,
    activeUsers,
    passRate,
    recentSessions,
    frameworkStats: frameworkAgg,
    agentExtra,
  });
});

router.get('/leaderboard', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);

  const agg = await Session.aggregate([
    { $match: { companyId, status: 'COMPLETED' } },
    {
      $group: {
        _id: '$userId',
        avgScore: { $avg: '$totalScore' },
        sessionCount: { $sum: 1 },
      },
    },
    { $sort: { avgScore: -1 } },
    { $limit: 20 },
  ]);

  const userIds = agg.map((e) => e._id);
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const result = agg.map((e, i) => {
    const u = userMap.get(e._id.toString());
    return {
      rank: i + 1,
      user: u
        ? { id: u._id.toString(), firstName: u.firstName, lastName: u.lastName, avatarUrl: u.avatarUrl }
        : { id: e._id.toString(), firstName: 'Unknown', lastName: '', avatarUrl: undefined },
      avgScore: Math.round(e.avgScore ?? 0),
      sessionCount: e.sessionCount,
    };
  });

  res.json(result);
});

async function computeStreak(userId: string): Promise<number> {
  const sessions = await Session.find({ userId, status: 'COMPLETED' })
    .sort({ endedAt: -1 })
    .limit(30)
    .lean();

  if (!sessions.length) return 0;

  const days = new Set(sessions.map((s) => {
    const d = new Date(s.endedAt ?? s.createdAt);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (days.has(key)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export default router;
