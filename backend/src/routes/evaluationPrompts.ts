import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { EvaluationPrompt } from '../models/EvaluationPrompt';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyFilter = req.companyId
    ? { $or: [{ companyId: req.companyId }, { companyId: null }] }
    : { companyId: null };

  const prompts = await EvaluationPrompt.find({ ...companyFilter, isActive: true }).lean();

  res.json(
    prompts.map((p) => ({
      id: p._id.toString(),
      companyId: p.companyId?.toString(),
      roleplayType: p.roleplayType,
      displayName: p.displayName,
      scoringCriteria: p.scoringCriteria,
      promptTemplate: p.promptTemplate,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  );
});

router.get('/:type', async (req: AuthRequest, res: Response): Promise<void> => {
  const companyFilter = req.companyId
    ? { $or: [{ companyId: req.companyId }, { companyId: null }] }
    : { companyId: null };

  const prompt = await EvaluationPrompt.findOne({
    roleplayType: req.params.type,
    ...companyFilter,
  }).lean();

  if (!prompt) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ...prompt, id: prompt._id.toString() });
});

router.patch('/:id', requireRole('SUPER_ADMIN', 'COMPANY_ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  const allowed = ['displayName', 'scoringCriteria', 'promptTemplate', 'isActive'];
  const update = Object.fromEntries(
    Object.entries(req.body as Record<string, unknown>).filter(([k]) => allowed.includes(k))
  );
  const prompt = await EvaluationPrompt.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!prompt) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ...prompt.toObject(), id: prompt._id.toString() });
});

export default router;
