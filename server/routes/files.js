import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { webStreamToNode } from '../providers/google-drive/drive.js';
import {
  StorageBackendError,
  listFiles,
  getUserFile,
  uploadFile,
  createUserFolder,
  renameFile,
  deleteFile,
  downloadFile,
  safeFile,
} from '../storage-service.js';

const router = Router();
router.use(requireAuth);

function handleError(err, res, next) {
  if (err instanceof StorageBackendError) {
    const status =
      err.status ||
      {
        not_found: 404,
        quota_exceeded: 413,
        schema_missing: 503,
        not_authorized: 503,
        database: 503,
        decrypt: 503,
        provider: 502,
      }[err.code] ||
      400;
    return res.status(status).json({ error: err.message, code: err.code });
  }
  next(err);
}

// GET /api/files?folder=<provider_file_id>
// Lists the authenticated user's files inside a folder (defaults to their own
// Seed Cloud root folder). user_id always comes from the session.
router.get('/', async (req, res, next) => {
  try {
    const files = await listFiles(req.user.id, req.query.folder || null);
    res.json({ files });
  } catch (err) {
    handleError(err, res, next);
  }
});

// POST /api/files/upload — raw file body. Headers: x-file-name (required),
// x-folder-id (optional Drive folder id). Mirrors the existing upload contract.
router.post(
  '/upload',
  (req, res, next) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      req.rawBody = Buffer.concat(chunks);
      next();
    });
    req.on('error', next);
  },
  async (req, res, next) => {
    try {
      const rawName = req.headers['x-file-name'];
      if (!rawName) return res.status(400).json({ error: 'x-file-name header is required' });
      const name = decodeURIComponent(String(rawName));
      const folderId = req.headers['x-folder-id'] || null;
      const mimeType = req.headers['content-type'] || null;
      const file = await uploadFile({
        userId: req.user.id,
        name,
        mimeType,
        data: req.rawBody,
        folderId,
      });
      res.status(201).json(file);
    } catch (err) {
      handleError(err, res, next);
    }
  }
);

// POST /api/files/folders — create a folder inside the user's storage.
router.post('/folders', async (req, res, next) => {
  try {
    const { name, parentId } = req.body || {};
    const folder = await createUserFolder(req.user.id, name, parentId || null);
    res.status(201).json(folder);
  } catch (err) {
    handleError(err, res, next);
  }
});

// GET /api/files/:id — single file metadata.
router.get('/:id', async (req, res, next) => {
  try {
    const file = await getUserFile(req.user.id, req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json(safeFile(file));
  } catch (err) {
    handleError(err, res, next);
  }
});

// GET /api/files/:id/download — streams the file from Google Drive.
router.get('/:id/download', async (req, res, next) => {
  try {
    const { res: driveRes, file } = await downloadFile(req.user.id, req.params.id);
    if (file.mime_type) res.setHeader('content-type', file.mime_type);
    res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    const driveHeaders = driveRes.headers;
    const length = driveHeaders.get('content-length');
    if (length) res.setHeader('content-length', length);
    webStreamToNode(driveRes.body).pipe(res);
  } catch (err) {
    handleError(err, res, next);
  }
});

// PATCH /api/files/:id — rename (Google Drive + Supabase metadata).
router.patch('/:id', async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const file = await renameFile(req.user.id, req.params.id, name);
    res.json(file);
  } catch (err) {
    handleError(err, res, next);
  }
});

// DELETE /api/files/:id — delete from Google Drive + metadata + quota.
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteFile(req.user.id, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    handleError(err, res, next);
  }
});

export default router;
