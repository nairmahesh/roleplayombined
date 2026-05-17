import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateScenario, generatePracticeQuestions } from '../services/gemini';

const router = Router();
router.use(authenticate);

router.post('/generate-scenario', async (req: AuthRequest, res: Response): Promise<void> => {
  const { industry, roleplayType, difficulty } = req.body as {
    industry: string;
    roleplayType: string;
    difficulty?: string;
  };

  if (!industry || !roleplayType) {
    res.status(400).json({ error: 'industry and roleplayType are required' });
    return;
  }

  const scenario = await generateScenario(industry, roleplayType, difficulty ?? 'MEDIUM');
  res.json(scenario);
});

router.post('/generate-questions', async (req: AuthRequest, res: Response): Promise<void> => {
  const { industry, roleplayType, framework } = req.body as {
    industry: string;
    roleplayType: string;
    framework?: string;
  };

  const result = await generatePracticeQuestions(industry, roleplayType, framework ?? 'MEDDIC');
  res.json(result);
});

export default router;
