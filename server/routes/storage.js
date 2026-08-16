import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { StorageBackendError, getStorageInfo } from '../storage-service.js';

const router = Router();

// GET /api/storage — the authenticated user's Seed Cloud logical quota
// (512 MB by default). This is Seed Cloud's own allowance, independent of the
// user's connected provider accounts. Returns { used, limit, available,
// percentage, overQuota }. No storage authorization is required to read it.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await getStorageInfo(req.user.id));
  } catch (err) {
    if (err instanceof StorageBackendError) {
      const status = err.code === 'schema_missing' ? 503 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    next(err);
  }
});

export default router;