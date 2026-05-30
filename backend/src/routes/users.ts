import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Session } from '../models/Session';

const router = Router();
router.use(authenticate);

function formatUser(u: InstanceType<typeof User>) {
  return {
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    companyId: u.companyId?.toString(),
    avatarUrl: u.avatarUrl,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    location: u.location,
    region: u.region,
    team: u.team,
    territory: u.territory,
    zone: u.zone,
    managerId: u.managerId?.toString(),
  };
}

router.get('/', requireRole('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.companyId) { res.json([]); return; }
  const users = await User.find({ companyId: req.companyId }).lean();
  res.json(users.map((u) => ({ ...formatUser(u as InstanceType<typeof User>) })));
});

router.post('/invite', requireRole('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, firstName, lastName, role, location, region, team, territory, zone } = req.body as Record<string, string>;

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) { res.status(409).json({ error: 'Email already in use' }); return; }

  const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    role: role ?? 'AGENT',
    companyId: req.companyId,
    isActive: true,
    location,
    region,
    team,
    territory,
    zone,
  });

  res.status(201).json({ ...formatUser(user), tempPassword });
});

router.patch('/:id', requireRole('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const allowed = ['firstName', 'lastName', 'role', 'isActive', 'location', 'region', 'team', 'territory', 'zone', 'managerId'];
  const update = Object.fromEntries(
    Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
  );
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json(formatUser(user));
});

router.get('/:id/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  const [sessionCount, agg] = await Promise.all([
    Session.countDocuments({ userId: req.params.id, status: 'COMPLETED' }),
    Session.aggregate([
      { $match: { userId: req.params.id, status: 'COMPLETED' } },
      { $group: { _id: null, avgScore: { $avg: '$totalScore' } } },
    ]),
  ]);
  res.json({ sessionCount, avgScore: Math.round(agg[0]?.avgScore ?? 0) });
});

router.post('/:id/reset-password', requireRole('SUPER_ADMIN', 'COMPANY_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  await User.findByIdAndUpdate(req.params.id, { passwordHash, refreshTokens: [] });
  res.json({ tempPassword });
});

export default router;
