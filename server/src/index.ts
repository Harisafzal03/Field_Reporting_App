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

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, HEAD, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Expose-Headers', '*');
  next();
});

app.use(express.json());
// Serve uploaded images statically with CORS headers so mobile client can view them directly
app.use(
  '/uploads',
  express.static(UPLOAD_DIR, {
    setHeaders: (res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Cache-Control', 'public, max-age=31536000');
    },
  }),
);

// File-backed data store & idempotency ledger
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

const DB_FILE = path.join(UPLOAD_DIR, 'reports_db.json');

function loadReportsFromDisk(): StoredReport[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load reports from disk:', err);
  }
  return [];
}

function saveReportsToDisk(reports: StoredReport[]) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(reports, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save reports to disk:', err);
  }
}

let reportsDatabase: StoredReport[] = loadReportsFromDisk();
const processedIdempotencyKeys = new Map<string, StoredReport>();
reportsDatabase.forEach(r => {
  if (r.reportId) processedIdempotencyKeys.set(r.reportId, r);
  if (r.id) processedIdempotencyKeys.set(r.id, r);
});

// Tus Resumable Upload Sessions
interface TusSession {
  uploadId: string;
  reportId: string;
  attachmentIndex: number;
  fileName: string;
  fileSizeBytes: number;
  partFilePath: string;
  finalFilePath: string;
  finalUrl: string;
  offset?: number;
  isComplete: boolean;
}

const TUS_DIR = path.join(UPLOAD_DIR, 'tus');
if (!fs.existsSync(TUS_DIR)) {
  fs.mkdirSync(TUS_DIR, { recursive: true });
}

const tusSessions = new Map<string, TusSession>();

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
const isChaosApplicable = (reqPath: string, method: string) => {
  return (
    (reqPath === '/reports' && method === 'POST') ||
    (reqPath.startsWith('/uploads/tus') && (method === 'PATCH' || method === 'POST')) ||
    (reqPath === '/reports/finalize' && method === 'POST')
  );
};

const chaosMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!isChaosApplicable(req.path, req.method)) {
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
    saveReportsToDisk(reportsDatabase);

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

// --- Tus Resumable Byte-Offset Endpoints (Tus 1.0.0 Protocol) ---

// Tus OPTIONS (pre-flight & capability discovery)
const handleTusOptions = (_req: Request, res: Response) => {
  res.set({
    'Tus-Resumable': '1.0.0',
    'Tus-Version': '1.0.0',
    'Tus-Extension': 'creation,termination',
    'Tus-Max-Size': MAX_FILE_SIZE_BYTES.toString(),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, HEAD, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Upload-Offset, Upload-Length, Upload-Metadata, Tus-Resumable, Idempotency-Key, X-Report-Id, X-Attachment-Index, X-File-Name',
    'Access-Control-Expose-Headers': 'Upload-Offset, Upload-Length, Tus-Resumable, Location',
  });
  res.status(204).end();
};

app.options('/uploads/tus', handleTusOptions);
app.options('/uploads/tus/:uploadId', handleTusOptions);

// Tus POST: Initialize resumable upload session
app.post('/uploads/tus', (req: Request, res: Response): void => {
  const uploadLengthHeader = req.headers['upload-length'];
  const reportId = (req.headers['x-report-id'] as string) || req.body?.reportId || 'default';
  const attachmentIndex = parseInt(
    (req.headers['x-attachment-index'] as string) || req.body?.attachmentIndex || '0',
    10,
  );
  const fileName = (req.headers['x-file-name'] as string) || req.body?.fileName || `photo_${attachmentIndex + 1}.jpg`;
  const fileSizeBytes = parseInt((uploadLengthHeader as string) || req.body?.fileSizeBytes || '0', 10);

  if (!fileSizeBytes || fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    res.status(413).json({ error: `File exceeds 5 MB destination ceiling (${fileSizeBytes} bytes)` });
    return;
  }

  // Deterministic uploadId per report and attachment so session creation is idempotent
  const uploadId = `tus_${reportId}_${attachmentIndex}`;
  const partFilePath = path.join(TUS_DIR, `${uploadId}.part`);
  const finalFilename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${path.basename(fileName)}`;
  const finalFilePath = path.join(UPLOAD_DIR, finalFilename);
  const finalUrl = `/uploads/${finalFilename}`;

  let session = tusSessions.get(uploadId);
  if (!session) {
    session = {
      uploadId,
      reportId,
      attachmentIndex,
      fileName,
      fileSizeBytes,
      partFilePath,
      finalFilePath,
      finalUrl,
      isComplete: false,
    };
    tusSessions.set(uploadId, session);
  }

  const currentOffset = fs.existsSync(partFilePath) ? fs.statSync(partFilePath).size : 0;

  res.set({
    'Location': `/uploads/tus/${uploadId}`,
    'Upload-Offset': currentOffset.toString(),
    'Tus-Resumable': '1.0.0',
    'Access-Control-Expose-Headers': 'Location, Upload-Offset, Tus-Resumable',
  });
  res.status(201).json({
    uploadId,
    location: `/uploads/tus/${uploadId}`,
    offset: currentOffset,
    length: fileSizeBytes,
  });
});

// Tus HEAD: Inspect current byte offset on server
app.head('/uploads/tus/:uploadId', (req: Request, res: Response): void => {
  const uploadId = req.params.uploadId as string;
  const session = tusSessions.get(uploadId);

  if (!session) {
    res.status(404).end();
    return;
  }

  const currentOffset = fs.existsSync(session.partFilePath)
    ? fs.statSync(session.partFilePath).size
    : 0;

  res.set({
    'Upload-Offset': currentOffset.toString(),
    'Upload-Length': session.fileSizeBytes.toString(),
    'Tus-Resumable': '1.0.0',
    'Cache-Control': 'no-store',
    'Access-Control-Expose-Headers': 'Upload-Offset, Upload-Length, Tus-Resumable',
  });
  res.status(200).end();
});

// Tus PATCH: Stream chunk starting from Upload-Offset
app.patch('/uploads/tus/:uploadId', (req: Request, res: Response): void => {
  const uploadId = req.params.uploadId as string;
  const session = tusSessions.get(uploadId);

  if (!session) {
    res.status(404).json({ error: 'Tus upload session not found' });
    return;
  }

  const offsetHeader = req.headers['upload-offset'];
  const clientOffset = parseInt(offsetHeader as string, 10);

  const currentOffset = fs.existsSync(session.partFilePath)
    ? fs.statSync(session.partFilePath).size
    : 0;

  if (isNaN(clientOffset) || clientOffset !== currentOffset) {
    res.set({
      'Upload-Offset': currentOffset.toString(),
      'Tus-Resumable': '1.0.0',
    });
    res.status(409).json({
      error: `Byte-offset mismatch. Server has ${currentOffset} bytes, request sent offset ${clientOffset}`,
      currentOffset,
    });
    return;
  }

  const writeStream = fs.createWriteStream(session.partFilePath, {
    flags: clientOffset === 0 ? 'w' : 'r+',
    start: clientOffset,
  });

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    const newOffset = fs.existsSync(session.partFilePath)
      ? fs.statSync(session.partFilePath).size
      : 0;

    session.offset = newOffset;

    if (newOffset >= session.fileSizeBytes) {
      session.isComplete = true;
      try {
        fs.copyFileSync(session.partFilePath, session.finalFilePath);
      } catch (err) {
        console.error('Failed to copy completed tus file to final destination:', err);
      }
    }

    res.set({
      'Upload-Offset': newOffset.toString(),
      'Tus-Resumable': '1.0.0',
      'Access-Control-Expose-Headers': 'Upload-Offset, Tus-Resumable',
    });
    res.status(204).end();
  });

  writeStream.on('error', (err) => {
    console.error('Tus part file write error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed writing chunk to disk' });
    }
  });
});

// Finalize Tus Report: assemble completed chunks into ground-truth report
app.post('/reports/finalize', (req: Request, res: Response): void => {
  const { reportId, description, uploadIds } = req.body;

  if (!reportId || !description || !Array.isArray(uploadIds) || uploadIds.length === 0) {
    res.status(400).json({ error: 'Missing reportId, description, or uploadIds' });
    return;
  }

  // Idempotency guarantee
  if (processedIdempotencyKeys.has(reportId)) {
    const existing = processedIdempotencyKeys.get(reportId)!;
    res.status(200).json({
      ok: true,
      reportId: existing.reportId,
      message: 'Report already received (Idempotent response)',
    });
    return;
  }

  const attachments: ServerAttachment[] = [];
  for (let i = 0; i < uploadIds.length; i++) {
    const uid = uploadIds[i];
    const session = tusSessions.get(uid);
    if (!session || !session.isComplete || !fs.existsSync(session.finalFilePath)) {
      res.status(400).json({ error: `Attachment ${uid} is incomplete or missing on server` });
      return;
    }
    attachments.push({
      id: `att_${i + 1}`,
      fileName: session.fileName,
      fileSizeBytes: session.fileSizeBytes,
      url: session.finalUrl,
    });
  }

  const newReport: StoredReport = {
    id: crypto.randomUUID(),
    reportId,
    description: description.trim(),
    attachments,
    receivedAt: new Date().toISOString(),
  };

  processedIdempotencyKeys.set(reportId, newReport);
  reportsDatabase.unshift(newReport);
  saveReportsToDisk(reportsDatabase);

  console.log(`[TUS FINALIZED] Report ${reportId} finalized with ${attachments.length} resumable photos`);

  if (chaosConfig.lostResponse) {
    console.log(`[CHAOS - LOST RESPONSE] Report ${reportId} saved, killing socket before reply`);
    if (res.socket) {
      res.socket.destroy();
    }
    return;
  }

  res.status(201).json({ ok: true, report: newReport });
});

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
  tusSessions.clear();
  saveReportsToDisk([]);

  // Purge files from disk
  if (fs.existsSync(UPLOAD_DIR)) {
    const diskFiles = fs.readdirSync(UPLOAD_DIR);
    for (const f of diskFiles) {
      try {
        if (f !== 'tus') {
          fs.unlinkSync(path.join(UPLOAD_DIR, f));
        }
      } catch {}
    }
  }

  // Purge Tus part files
  if (fs.existsSync(TUS_DIR)) {
    const tusFiles = fs.readdirSync(TUS_DIR);
    for (const f of tusFiles) {
      try {
        fs.unlinkSync(path.join(TUS_DIR, f));
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
