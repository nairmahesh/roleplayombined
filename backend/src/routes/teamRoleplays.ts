import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { TeamRoleplay } from '../models/TeamRoleplay';
import { User } from '../models/User';

const router = Router();
router.use(authenticate);

function serialize(tr: InstanceType<typeof TeamRoleplay>, createdBy: { firstName: string; lastName: string; _id: { toString(): string } }) {
  return {
    id: tr._id.toString(),
    name: tr.name,
    description: tr.description,
    scenarioConfig: tr.scenarioConfig,
    isActive: tr.isActive,
    companyId: tr.companyId.toString(),
    createdById: tr.createdById.toString(),
    createdBy: { id: createdBy._id.toString(), firstName: createdBy.firstName, lastName: createdBy.lastName },
    assignmentTarget: tr.assignmentTarget,
    allowPeerListening: tr.allowPeerListening,
    completionCount: tr.completionCount,
    createdAt: tr.createdAt,
    updatedAt: tr.updatedAt,
  };
}

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const roleplays = await TeamRoleplay.find({ companyId: req.companyId })
    .sort({ createdAt: -1 })
    .lean();

  const creatorIds = [...new Set(roleplays.map((r) => r.createdById.toString()))];
  const creators = await User.find({ _id: { $in: creatorIds } }).lean();
  const creatorMap = new Map(creators.map((u) => [u._id.toString(), u]));

  res.json(
    roleplays.map((r) => {
      const creator = creatorMap.get(r.createdById.toString());
      return {
        id: r._id.toString(),
        name: r.name,
        description: r.description,
        scenarioConfig: r.scenarioConfig,
        isActive: r.isActive,
        createdById: r.createdById.toString(),
        createdBy: creator
          ? { id: creator._id.toString(), firstName: creator.firstName, lastName: creator.lastName }
          : { id: r.createdById.toString(), firstName: '', lastName: '' },
        assignmentTarget: r.assignmentTarget,
        allowPeerListening: r.allowPeerListening,
        completionCount: r.completionCount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    })
  );
});

router.post('/', requireRole('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'AGENT'), async (req: AuthRequest, res: Response): Promise<void> => {
  const data = req.body as Record<string, unknown>;
  const tr = await TeamRoleplay.create({
    ...data,
    companyId: req.companyId,
    createdById: req.userId,
    isActive: true,
    completionCount: 0,
  });
  const creator = await User.findById(req.userId).lean();
  res.status(201).json(serialize(tr, creator!));
});

router.patch('/:id', requireRole('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  const tr = await TeamRoleplay.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!tr) { res.status(404).json({ error: 'Not found' }); return; }
  const creator = await User.findById(tr.createdById).lean();
  res.json(serialize(tr, creator!));
});

router.delete('/:id', requireRole('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response): Promise<void> => {
  await TeamRoleplay.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

router.get('/target-options', async (req: AuthRequest, res: Response): Promise<void> => {
  const users = await User.find({ companyId: req.companyId, isActive: true }).lean();
  const regions = [...new Set(users.map((u) => u.region).filter(Boolean))];
  const teams = [...new Set(users.map((u) => u.team).filter(Boolean))];
  const territories = [...new Set(users.map((u) => u.territory).filter(Boolean))];

  res.json({
    regions,
    teams,
    territories,
    users: users.map((u) => ({
      id: u._id.toString(),
      name: `${u.firstName} ${u.lastName}`,
      team: u.team,
      region: u.region,
    })),
  });
});

export default router;
