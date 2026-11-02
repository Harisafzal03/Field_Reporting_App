import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;

// Disk storage destination for actual uploaded photos
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Hard 5 MB Ceiling at destination
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const unique = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 5,
  },
});

app.use(express.json());
// Serve uploaded images statically so mobile client can view them directly
app.use('/uploads', express.static(UPLOAD_DIR));

// In-memory data store & idempotency ledger
interface ServerAttachment {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  url: string;
}

interface StoredReport {
  id: string;
  reportId: string;
  description: string;
  attachments: ServerAttachment[];
  receivedAt: string;
}

let reportsDatabase: StoredReport[] = [];
const processedIdempotencyKeys = new Map<string, StoredReport>();

// Chaos state configurable by evaluators
let chaosConfig = {
  latencyMs: 0,
  dropConnection: false,
  simulate500: false,
  hangRequest: false,
  lostResponse: false, // Saves report to disk & DB, then kills reply without responding
};

// Process-level crash protection so no network drops or socket aborts can kill the server
process.on('uncaughtException', (err: any) => {
  console.error('[SERVER PROTECTED] Uncaught exception:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[SERVER PROTECTED] Unhandled rejection:', reason);
});

// Chaos middleware to inject artificial 2G delays, drop connections, or fail
// CRITICAL: Applied exclusively to POST /reports so health checks, chaos configuration,
// report review, and static photo downloads are NEVER locked up or killed.
const chaosMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (req.path !== '/reports' || req.method !== 'POST') {
    return next();
  }

  if (chaosConfig.dropConnection) {
    console.log('[CHAOS] Dropping connection mid-stream for POST /reports');
    req.on('error', () => {});
    res.on('error', () => {});
    if (res.socket) {
      res.socket.on('error', () => {});
      res.socket.destroy();
    }
    return;
  }

  if (chaosConfig.simulate500) {
    console.log('[CHAOS] Simulating HTTP 500 error for POST /reports');
    res.status(500).json({ error: 'Chaos: Simulated 500 internal server error' });
    return;
  }

  if (chaosConfig.hangRequest) {
    console.log('[CHAOS] Hanging POST /reports request indefinitely');
    return; // never answer
  }

  if (chaosConfig.latencyMs > 0) {
    console.log(`[CHAOS] Injecting ${chaosConfig.latencyMs}ms latency for POST /reports`);
    await new Promise(resolve => setTimeout(resolve, chaosConfig.latencyMs));
  }

  next();
};

app.use(chaosMiddleware);

// 1. Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// 2. Fetch ground-truth reports stored on server
app.get('/reports', (_req: Request, res: Response) => {
  res.json({ reports: reportsDatabase });
});

// 3. Ingest field report with photos
app.post(
  '/reports',
  upload.array('images', 5),
  (req: Request, res: Response): void => {
    const idempotencyKey =
      (req.headers['idempotency-key'] as string) || req.body.reportId;

    const files = (req.files as Express.Multer.File[]) || [];

    if (!idempotencyKey) {
      // Clean up orphaned files if missing key
      files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch {}
      });
      res.status(400).json({ error: 'Missing Idempotency-Key header or reportId' });
      return;
    }

    // "Nothing lands twice": Return existing processed report without duplicating.
    // CRITICAL: Clean up the duplicate files Multer just wrote to disk so file count equals photo count!
    if (processedIdempotencyKeys.has(idempotencyKey)) {
      console.log(`[DEDUPLICATION] Idempotent retry absorbed for report ${idempotencyKey}. Cleaning up duplicate upload files.`);
      files.forEach(f => {
        try {
          if (fs.existsSync(f.path)) {
            fs.unlinkSync(f.path);
          }
        } catch {}
      });
      const existing = processedIdempotencyKeys.get(idempotencyKey)!;
      res.status(200).json({
        ok: true,
        reportId: existing.reportId,
        message: 'Report already received (Idempotent response)',
      });
      return;
    }

    const { description } = req.body;
    if (!description || typeof description !== 'string' || !description.trim()) {
      files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch {}
      });
      res.status(400).json({ error: 'Description is required and cannot be blank' });
      return;
    }

    if (files.length < 1 || files.length > 5) {
      files.forEach(f => {
        try { fs.unlinkSync(f.path); } catch {}
      });
      res.status(400).json({ error: 'Reports require between 1 and 5 images' });
      return;
    }

    // Verify 5 MB ceiling explicitly
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        files.forEach(f => {
          try { fs.unlinkSync(f.path); } catch {}
        });
        res.status(413).json({
          error: `File ${file.originalname} exceeds the 5 MB hard ceiling (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
        });
        return;
      }
    }

    const newReport: StoredReport = {
      id: crypto.randomUUID(),
      reportId: idempotencyKey,
      description: description.trim(),
      attachments: files.map((f, i) => ({
        id: `att_${i + 1}`,
        fileName: f.originalname || `photo_${i + 1}.jpg`,
        fileSizeBytes: f.size,
        url: `/uploads/${f.filename}`,
      })),
      receivedAt: new Date().toISOString(),
    };

    processedIdempotencyKeys.set(idempotencyKey, newReport);
    reportsDatabase.unshift(newReport);

    console.log(`[INGESTED] Report ${idempotencyKey} received with ${files.length} images saved to disk`);

    // Check B Simulation: Server saves to disk & DB, but connection drops before reply reaches client
    if (chaosConfig.lostResponse) {
      console.log(`[CHAOS - LOST RESPONSE] Report ${idempotencyKey} saved to disk, now severing socket before sending 201 reply`);
      req.on('error', () => {});
      res.on('error', () => {});
      if (res.socket) {
        res.socket.on('error', () => {});
        res.socket.destroy();
      }
      return;
    }

    res.status(201).json({ ok: true, report: newReport });
  },
);

// 4. Update chaos settings on demand
app.post('/chaos/config', (req: Request, res: Response) => {
  chaosConfig = {
    ...chaosConfig,
    ...req.body,
  };
  console.log('[CHAOS] Updated configuration:', chaosConfig);
  res.json({ ok: true, chaosConfig });
});

// 5. Blast radius reset: purge server database and delete uploaded files from disk
app.delete('/reports', (_req: Request, res: Response) => {
  reportsDatabase = [];
  processedIdempotencyKeys.clear();

  // Purge files from disk
  if (fs.existsSync(UPLOAD_DIR)) {
    const diskFiles = fs.readdirSync(UPLOAD_DIR);
    for (const f of diskFiles) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, f));
      } catch {}
    }
  }

  console.log('[RESET] Server database and uploaded disk files purged to factory clean zero');
  res.json({ ok: true, message: 'Server database purged completely' });
});

// Express error handler to absorb multer stream errors and aborted requests
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[EXPRESS ERROR INTERCEPTED]', err?.message || err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({ error: err?.message || 'Server internal error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
