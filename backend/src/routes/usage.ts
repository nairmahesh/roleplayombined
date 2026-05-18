import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { UsageLog } from '../models/UsageLog';

const router = Router();
router.use(authenticate);
router.use(requireRole('COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN'));

// GET /api/usage?days=30&companyId=<id>
// Returns a cost summary + per-service breakdown for the requested window.
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const days    = Math.min(parseInt(req.query.days as string) || 30, 365);
  const since   = new Date(Date.now() - days * 86_400_000);
  const filter: Record<string, unknown> = { createdAt: { $gte: since } };

  // Superadmins can query any company; others are scoped to their own.
  if (req.userRole !== 'SUPER_ADMIN') {
    filter.companyId = req.companyId;
  } else if (req.query.companyId) {
    filter.companyId = req.query.companyId;
  }

  const [totals, byService, byDay, recent] = await Promise.all([
    // Overall totals
    UsageLog.aggregate([
      { $match: filter },
      { $group: {
        _id: null,
        totalCostUsd:        { $sum: '$estimatedCostUsd' },
        geminiPromptTokens:  { $sum: { $cond: [{ $eq: ['$service', 'gemini'] }, '$promptTokens', 0] } },
        geminiOutputTokens:  { $sum: { $cond: [{ $eq: ['$service', 'gemini'] }, '$completionTokens', 0] } },
        ttsCharacters:       { $sum: { $cond: [{ $eq: ['$service', 'elevenlabs_tts'] }, '$characters', 0] } },
        convaiMinutes:       { $sum: { $cond: [{ $eq: ['$service', 'elevenlabs_convai'] }, { $divide: ['$durationSeconds', 60] }, 0] } },
        callCount:           { $sum: { $cond: [{ $eq: ['$service', 'elevenlabs_convai'] }, 1, 0] } },
        requestCount:        { $sum: 1 },
      }},
    ]),

    // Cost by service
    UsageLog.aggregate([
      { $match: filter },
      { $group: {
        _id:         '$service',
        costUsd:     { $sum: '$estimatedCostUsd' },
        requestCount:{ $sum: 1 },
      }},
      { $sort: { costUsd: -1 } },
    ]),

    // Daily cost trend
    UsageLog.aggregate([
      { $match: filter },
      { $group: {
        _id:     { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        costUsd: { $sum: '$estimatedCostUsd' },
      }},
      { $sort: { _id: 1 } },
    ]),

    // Recent 20 entries
    UsageLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .select('service operation modelName promptTokens completionTokens characters durationSeconds estimatedCostUsd createdAt')
      .lean(),
  ]);

  res.json({
    period: { days, since },
    totals: totals[0] ?? { totalCostUsd: 0, requestCount: 0 },
    byService,
    dailyTrend: byDay,
    recent,
    pricing: {
      geminiInputPerMToken:  0.075,
      geminiOutputPerMToken: 0.30,
      ttsPerKChars:          0.15,
      convaiPerMinute:       0.08,
    },
  });
});

export default router;
