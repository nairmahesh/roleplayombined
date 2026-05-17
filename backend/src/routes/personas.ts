import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Persona } from '../models/Persona';

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

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const persona = await Persona.findById(req.params.id);
  if (!persona) { res.status(404).json({ error: 'Persona not found' }); return; }
  if (persona.isPreset) { res.status(403).json({ error: 'Cannot delete preset personas' }); return; }
  await persona.deleteOne();
  res.json({ message: 'Deleted' });
});

export default router;
