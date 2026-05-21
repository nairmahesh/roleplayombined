import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Company } from '../models/Company';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  authenticate,
  AuthRequest,
} from '../middleware/auth';

const router = Router();

function formatUser(user: InstanceType<typeof User>, companyId: string) {
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    companyId,
    avatarUrl: user.avatarUrl,
    isActive: user.isActive,
    location: user.location,
    region: user.region,
    team: user.team,
    territory: user.territory,
    zone: user.zone,
  };
}

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  user.lastLoginAt = new Date();
  const companyId = user.companyId?.toString() ?? '';
  const accessToken = signAccessToken(user._id.toString(), user.role, companyId);
  const refreshToken = signRefreshToken(user._id.toString());

  user.refreshTokens.push(refreshToken);
  if (user.refreshTokens.length > 5) user.refreshTokens.shift();
  await user.save();

  res.json({ user: formatUser(user, companyId), accessToken, refreshToken });
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password, firstName, lastName, companyName, companySlug } = req.body as {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    companySlug?: string;
  };

  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  let company = await Company.findOne();
  if (companyName && companySlug) {
    company = await Company.create({ name: companyName, slug: companySlug });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    role: 'COMPANY_ADMIN',
    companyId: company?._id,
    isActive: true,
  });

  const companyId = company?._id?.toString() ?? '';
  const accessToken = signAccessToken(user._id.toString(), user.role, companyId);
  const refreshToken = signRefreshToken(user._id.toString());

  user.refreshTokens.push(refreshToken);
  await user.save();

  res.status(201).json({ user: formatUser(user, companyId), accessToken, refreshToken });
});

router.post('/logout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (req.userId && refreshToken) {
    await User.findByIdAndUpdate(req.userId, {
      $pull: { refreshTokens: refreshToken },
    });
  }
  res.json({ message: 'Logged out' });
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.userId);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const companyId = user.companyId?.toString() ?? '';
    const newAccess = signAccessToken(user._id.toString(), user.role, companyId);
    const newRefresh = signRefreshToken(user._id.toString());

    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
    user.refreshTokens.push(newRefresh);
    if (user.refreshTokens.length > 5) user.refreshTokens.shift();
    await user.save();

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId).lean();
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  const companyId = user.companyId?.toString() ?? '';
  const { _id, passwordHash: _pw, refreshTokens: _rt, __v: _v, ...rest } = user as typeof user & { __v?: number };
  res.json({ ...rest, id: user._id.toString(), companyId });
});

export default router;
