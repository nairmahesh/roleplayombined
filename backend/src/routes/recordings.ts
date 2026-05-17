import { Router, Response, Request } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Session } from '../models/Session';
import { config } from '../config';

const router = Router();

// ── S3 client ─────────────────────────────────────────────────────────────────

function makeS3(): S3Client | null {
  if (!config.s3.bucket || !config.s3.accessKeyId || !config.s3.secretAccessKey) return null;
  return new S3Client({
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
    ...(config.s3.endpoint ? { endpoint: config.s3.endpoint, forcePathStyle: true } : {}),
  });
}

const s3 = makeS3();
const s3Configured = Boolean(s3);

// multer memory storage — file bytes never touch disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

router.use(authenticate);

// POST /api/recordings/upload/:sessionId
router.post('/upload/:sessionId', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { sessionId } = req.params;
  console.log(`[recordings/upload] sessionId=${sessionId} file=${req.file?.originalname} size=${req.file?.size} s3=${s3Configured}`);

  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  if (!s3Configured) {
    // S3 not configured — acknowledge upload but don't persist.
    console.log('[recordings/upload] S3 not configured — recording discarded (set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env)');
    res.json({ key: null, warning: 'S3 not configured — recording not stored' });
    return;
  }

  const ext = req.file.originalname.split('.').pop() ?? 'webm';
  const key = `recordings/${sessionId}-${Date.now()}.${ext}`;

  await s3!.send(new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    Body: req.file.buffer,
    ContentType: req.file.mimetype || 'audio/webm',
  }));

  await Session.findByIdAndUpdate(sessionId, { recordingUrl: key });
  console.log(`[recordings/upload] uploaded to S3 key=${key}`);

  res.json({ key });
});

// GET /api/recordings/playback/:sessionId — returns a short-lived pre-signed URL
router.get('/playback/:sessionId', async (req: AuthRequest, res: Response): Promise<void> => {
  const session = await Session.findById(req.params.sessionId).select('recordingUrl').lean();
  if (!session?.recordingUrl) {
    res.status(404).json({ error: 'No recording for this session' });
    return;
  }

  if (!s3Configured) {
    res.status(503).json({ error: 'S3 not configured — recordings unavailable' });
    return;
  }

  const url = await getSignedUrl(
    s3!,
    new GetObjectCommand({ Bucket: config.s3.bucket, Key: session.recordingUrl }),
    { expiresIn: 3600 }
  );
  res.json({ url });
});

export default router;
