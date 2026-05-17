import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Session } from '../models/Session';
import { User } from '../models/User';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);

  const sessions = await Session.find({ companyId, status: 'COMPLETED' })
    .sort({ totalScore: -1 })
    .limit(20)
    .lean();

  const userIds = sessions.map((s) => s.userId.toString());
  const users = await User.find({ _id: { $in: userIds } }).lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const scored = sessions.map((s, i) => {
    const u = userMap.get(s.userId.toString());
    return {
      sessionId: s._id.toString(),
      userId: s.userId.toString(),
      userName: u ? `${u.firstName} ${u.lastName}` : 'Unknown',
      userLocation: u?.location,
      userTeam: u?.team,
      score: s.totalScore ?? 0,
      rank: i + 1,
      durationSeconds: s.durationSeconds ?? 0,
      completedAt: s.endedAt,
      canListen: !!s.recordingUrl,
      playbackUrl: s.recordingUrl,
    };
  });

  res.json(scored);
});

export default router;
