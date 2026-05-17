import { Router } from 'express';
import authRoutes from './auth';
import sessionsRoutes from './sessions';
import personasRoutes from './personas';
import analyticsRoutes from './analytics';
import usersRoutes from './users';
import superadminRoutes from './superadmin';
import practiceRoutes from './practice';
import teamRoleplaysRoutes from './teamRoleplays';
import evaluationPromptsRoutes from './evaluationPrompts';
import voiceRoutes from './voice';
import peerSessionsRoutes from './peerSessions';
import usageRoutes from './usage';
import recordingsRoutes from './recordings';

const router = Router();

router.use('/auth', authRoutes);
router.use('/sessions', sessionsRoutes);
router.use('/personas', personasRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/users', usersRoutes);
router.use('/superadmin', superadminRoutes);
router.use('/practice', practiceRoutes);
router.use('/team-roleplays', teamRoleplaysRoutes);
router.use('/evaluation-prompts', evaluationPromptsRoutes);
router.use('/voice', voiceRoutes);
router.use('/peer-sessions', peerSessionsRoutes);
router.use('/usage', usageRoutes);
router.use('/recordings', recordingsRoutes);

export default router;
