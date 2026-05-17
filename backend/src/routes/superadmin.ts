import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { Session } from '../models/Session';

const router = Router();
router.use(authenticate, requireRole('SUPER_ADMIN'));

async function companyDetail(company: InstanceType<typeof Company>) {
  const [agentCount, adminCount, totalSessions, admins] = await Promise.all([
    User.countDocuments({ companyId: company._id, role: 'AGENT', isActive: true }),
    User.countDocuments({ companyId: company._id, role: 'COMPANY_ADMIN', isActive: true }),
    Session.countDocuments({ companyId: company._id }),
    User.find({ companyId: company._id, role: 'COMPANY_ADMIN' })
      .select('email firstName lastName isActive lastLoginAt')
      .lean(),
  ]);

  return {
    id: company._id.toString(),
    name: company.name,
    slug: company.slug,
    defaultFramework: company.defaultFramework,
    passThreshold: company.passThreshold,
    isActive: company.isActive,
    industry: company.industry,
    createdAt: company.createdAt,
    agentCount,
    adminCount,
    totalSessions,
    admins: admins.map((a) => ({
      id: a._id.toString(),
      email: a.email,
      firstName: a.firstName,
      lastName: a.lastName,
      isActive: a.isActive,
      lastLoginAt: a.lastLoginAt,
    })),
  };
}

router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalCompanies, activeCompanies, totalUsers, totalSessions, activeUsersThisMonth] = await Promise.all([
    Company.countDocuments(),
    Company.countDocuments({ isActive: true }),
    User.countDocuments(),
    Session.countDocuments(),
    User.countDocuments({ lastLoginAt: { $gte: monthStart } }),
  ]);

  res.json({ totalCompanies, activeCompanies, totalUsers, totalSessions, activeUsersThisMonth });
});

router.get('/companies', async (_req: AuthRequest, res: Response): Promise<void> => {
  const companies = await Company.find().lean();
  const details = await Promise.all(companies.map(companyDetail));
  res.json(details);
});

router.post('/companies', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, slug, defaultFramework, passThreshold, industry, contactEmail, adminEmail, adminFirstName, adminLastName } = req.body as Record<string, string>;

  const company = await Company.create({
    name,
    slug: slug.toLowerCase(),
    defaultFramework: defaultFramework ?? 'MEDDIC',
    passThreshold: parseInt(passThreshold ?? '70', 10),
    industry,
    contactEmail,
    isActive: true,
  });

  if (adminEmail) {
    const tempPw = Math.random().toString(36).slice(-8) + 'A1!';
    const passwordHash = await bcrypt.hash(tempPw, 12);
    await User.create({
      email: adminEmail.toLowerCase(),
      passwordHash,
      firstName: adminFirstName ?? 'Admin',
      lastName: adminLastName ?? '',
      role: 'COMPANY_ADMIN',
      companyId: company._id,
      isActive: true,
    });
  }

  res.status(201).json(await companyDetail(company));
});

router.get('/companies/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const company = await Company.findById(req.params.id);
  if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
  res.json(await companyDetail(company));
});

router.patch('/companies/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const allowed = ['name', 'defaultFramework', 'passThreshold', 'isActive', 'industry', 'contactEmail', 'planTier'];
  const update = Object.fromEntries(
    Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
  );
  const company = await Company.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!company) { res.status(404).json({ error: 'Company not found' }); return; }
  res.json(await companyDetail(company));
});

router.get('/companies/:id/users', async (req: AuthRequest, res: Response): Promise<void> => {
  const users = await User.find({ companyId: req.params.id }).lean();
  res.json(users.map((u) => ({
    id: u._id.toString(),
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    companyId: u.companyId?.toString(),
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    location: u.location,
    region: u.region,
    team: u.team,
  })));
});

router.patch('/companies/:id/users/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  const allowed = ['firstName', 'lastName', 'role', 'isActive', 'location', 'region', 'team'];
  const update = Object.fromEntries(
    Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
  );
  const user = await User.findByIdAndUpdate(req.params.userId, update, { new: true });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ id: user._id.toString(), ...update });
});

export default router;
