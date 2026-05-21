import mongoose from 'mongoose';
import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { UsageLog } from '../models/UsageLog';
import { User } from '../models/User';
import { Session } from '../models/Session';
import { Company } from '../models/Company';

const router = Router();
router.use(authenticate);
router.use(requireRole('COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN'));

const PRICING = {
  geminiInputPerMToken:  0.075,
  geminiOutputPerMToken: 0.30,
  ttsPerKChars:          0.15,
  convaiPerMinute:       0.08,
};

// Shared helper: build a usage summary for a given filter
async function buildSummary(filter: Record<string, unknown>, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  filter.createdAt = { $gte: since };

  const [totals, byService, byDay, recent] = await Promise.all([
    UsageLog.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        totalCostUsd:       { $sum: '$estimatedCostUsd' },
        geminiPromptTokens: { $sum: { $cond: [{ $eq: ['$service', 'gemini'] }, '$promptTokens', 0] } },
        geminiOutputTokens: { $sum: { $cond: [{ $eq: ['$service', 'gemini'] }, '$completionTokens', 0] } },
        ttsCharacters:      { $sum: { $cond: [{ $eq: ['$service', 'elevenlabs_tts'] }, '$characters', 0] } },
        convaiMinutes:      { $sum: { $cond: [{ $eq: ['$service', 'elevenlabs_convai'] }, { $divide: ['$durationSeconds', 60] }, 0] } },
        callCount:          { $sum: { $cond: [{ $eq: ['$service', 'elevenlabs_convai'] }, 1, 0] } },
        requestCount:       { $sum: 1 },
      }},
    ]),
    UsageLog.aggregate([
      { $match: filter },
      { $group: {
        _id:          '$service',
        costUsd:      { $sum: '$estimatedCostUsd' },
        requestCount: { $sum: 1 },
      }},
      { $sort: { costUsd: -1 } },
    ]),
    UsageLog.aggregate([
      { $match: filter },
      { $group: {
        _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        costUsd: { $sum: '$estimatedCostUsd' },
        sessions: { $addToSet: '$sessionId' },
      }},
      { $project: { _id: 1, costUsd: 1, sessions: { $size: '$sessions' } } },
      { $sort: { _id: 1 } },
    ]),
    UsageLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .select('service operation modelName promptTokens completionTokens characters durationSeconds estimatedCostUsd createdAt')
      .lean(),
  ]);

  return {
    period: { days, since },
    totals: totals[0] ?? { totalCostUsd: 0, geminiPromptTokens: 0, geminiOutputTokens: 0, ttsCharacters: 0, convaiMinutes: 0, callCount: 0, requestCount: 0 },
    byService,
    dailyTrend: byDay,
    recent,
    pricing: PRICING,
  };
}

// GET /api/usage?days=30&companyId=<id>
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const filter: Record<string, unknown> = {};

  if (req.userRole !== 'SUPER_ADMIN') {
    filter.companyId = new mongoose.Types.ObjectId(req.companyId);
  } else if (req.query.companyId) {
    filter.companyId = new mongoose.Types.ObjectId(req.query.companyId as string);
  }

  res.json(await buildSummary(filter, days));
});

// GET /api/usage/users?days=30&companyId=<id>
// Returns per-user cost breakdown with their current caps.
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const since = new Date(Date.now() - days * 86_400_000);

  const companyId = req.userRole !== 'SUPER_ADMIN'
    ? new mongoose.Types.ObjectId(req.companyId)
    : req.query.companyId
      ? new mongoose.Types.ObjectId(req.query.companyId as string)
      : null;

  const usageFilter: Record<string, unknown> = { createdAt: { $gte: since } };
  if (companyId) usageFilter.companyId = companyId;

  const [usageAgg, sessionAgg] = await Promise.all([
    UsageLog.aggregate([
      { $match: usageFilter },
      { $group: {
        _id:        '$userId',
        costUsd:    { $sum: '$estimatedCostUsd' },
        tokensUsed: { $sum: { $add: [{ $ifNull: ['$promptTokens', 0] }, { $ifNull: ['$completionTokens', 0] }] } },
        convaiSecs: { $sum: { $cond: [{ $eq: ['$service', 'elevenlabs_convai'] }, { $ifNull: ['$durationSeconds', 0] }, 0] } },
      }},
    ]),
    Session.aggregate([
      {
        $match: {
          ...(companyId ? { companyId } : {}),
          status: 'COMPLETED',
          endedAt: { $gte: since },
        },
      },
      { $group: { _id: '$userId', sessions: { $sum: 1 } } },
    ]),
  ]);

  const userIds = [...new Set([
    ...usageAgg.map((e) => e._id?.toString()).filter(Boolean),
    ...sessionAgg.map((e) => e._id?.toString()).filter(Boolean),
  ])];

  const userFilter: Record<string, unknown> = { _id: { $in: userIds } };
  if (companyId) userFilter.companyId = companyId;
  const users = await User.find(userFilter).lean();

  const usageMap = new Map(usageAgg.map((e) => [e._id?.toString(), e]));
  const sessionMap = new Map(sessionAgg.map((e) => [e._id?.toString(), e]));

  const result = users.map((u) => {
    const uid = u._id.toString();
    const usage = usageMap.get(uid);
    const sess  = sessionMap.get(uid);
    return {
      userId:     uid,
      firstName:  u.firstName,
      lastName:   u.lastName,
      email:      u.email,
      role:       u.role,
      sessions:   sess?.sessions ?? 0,
      callMinutes: Math.round((usage?.convaiSecs ?? 0) / 60),
      tokensUsed: usage?.tokensUsed ?? 0,
      costUsd:    +(usage?.costUsd ?? 0).toFixed(4),
      sessionCap: u.sessionCap ?? null,
      minutesCap: u.minutesCap ?? null,
      tokensCap:  u.tokensCap  ?? null,
    };
  });

  res.json(result);
});

// PATCH /api/usage/users/:userId/cap
// Update session/minutes/tokens caps for a specific user.
router.patch('/users/:userId/cap', async (req: AuthRequest, res: Response): Promise<void> => {
  const { sessionCap, minutesCap, tokensCap } = req.body as {
    sessionCap: number | null;
    minutesCap: number | null;
    tokensCap:  number | null;
  };

  const user = await User.findByIdAndUpdate(
    req.params.userId,
    { sessionCap: sessionCap ?? null, minutesCap: minutesCap ?? null, tokensCap: tokensCap ?? null },
    { new: true }
  );
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  res.json({ ok: true, sessionCap: user.sessionCap, minutesCap: user.minutesCap, tokensCap: user.tokensCap });
});

// GET /api/usage/platform?days=30  (SUPER_ADMIN only)
// Returns a platform-wide cost summary with per-company breakdown and margin calculation.
router.get('/platform', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const since = new Date(Date.now() - days * 86_400_000);

  const [base, companyAgg, companies] = await Promise.all([
    buildSummary({}, days),
    UsageLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
        _id:      '$companyId',
        costUsd:  { $sum: '$estimatedCostUsd' },
        sessions: { $addToSet: '$sessionId' },
      }},
      { $project: { _id: 1, costUsd: 1, sessions: { $size: '$sessions' } } },
    ]),
    Company.find().lean(),
  ]);

  const companyMap = new Map(companies.map((c) => [c._id.toString(), c.name]));

  const MARKUP = 3.0;
  const byCompany = companyAgg.map((e) => {
    const costUsd   = +(e.costUsd ?? 0).toFixed(4);
    const billedUsd = +(costUsd * MARKUP).toFixed(4);
    return {
      companyId:   e._id?.toString() ?? '',
      companyName: companyMap.get(e._id?.toString() ?? '') ?? 'Unknown',
      sessions:    e.sessions,
      costUsd,
      billedUsd,
    };
  });

  const actualCostUsd  = +(base.totals.totalCostUsd ?? 0).toFixed(4);
  const billedCostUsd  = +(actualCostUsd * MARKUP).toFixed(4);
  const marginUsd      = +(billedCostUsd - actualCostUsd).toFixed(4);
  const marginPct      = billedCostUsd > 0
    ? +((marginUsd / billedCostUsd) * 100).toFixed(1)
    : 0;

  res.json({ ...base, actualCostUsd, billedCostUsd, marginUsd, marginPct, byCompany });
});

export default router;
