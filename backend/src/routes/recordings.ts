import path from 'path';
import fs from 'fs';
import { Router, Response, Request } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Session } from '../models/Session';

const router = Router();

// ── Storage setup ─────────────────────────────────────────────────────────────

const uploadsDir = path.resolve(process.cwd(), 'uploads', 'recordings');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req: Request, _file, cb) => {
    const sessionId = (req as AuthRequest).params.sessionId ?? 'unknown';
    const ext = _file.originalname.split('.').pop() ?? 'webm';
    cb(null, `${sessionId}-${Date.now()}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max
});

router.use(authenticate);

// POST /api/recordings/upload/:sessionId
router.post('/upload/:sessionId', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const key = `/recordings/${req.file.filename}`;

  // Persist the recording URL on the session
  await Session.findByIdAndUpdate(sessionId, { recordingUrl: key });

  res.json({ key });
});

// GET /api/recordings/playback/:sessionId
router.get('/playback/:sessionId', async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await Session.findById(req.params.sessionId).select('recordingUrl').lean();
  if (!session?.recordingUrl) {
    res.status(404).json({ error: 'No recording for this session' });
    return;
  }
  // Return a direct URL that the frontend can use to fetch the file
  res.json({ url: `/api/recordings/file/${path.basename(session.recordingUrl)}` });
});

// GET /api/recordings/file/:filename  — serve the raw file
router.get('/file/:filename', (req: Request, res: Response): void => {
  const filename = path.basename(req.params.filename); // strip any path traversal
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }
  res.sendFile(filePath);
});

export default router;
