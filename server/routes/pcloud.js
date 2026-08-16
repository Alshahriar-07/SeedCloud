import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import pcloud from '../providers/pcloud/index.js';
import { getConnection } from '../connections.js';
import { webStreamToNode } from '../providers/pcloud/api.js';

const router = Router();

router.use(requireAuth);

async function withConnection(req, res, next) {
  try {
    const conn = await getConnection(req.user, 'pcloud');
    if (!conn) {
      return res.status(404).json({ error: 'pCloud is not connected for this account' });
    }
    const connection = {
      accessToken: conn.access_token,
      apiHost: conn.api_host,
    };
    req.pcloud = { conn: connection };
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/account', withConnection, async (req, res, next) => {
  try {
    const account = await pcloud.getAccount(req.pcloud.conn);
    res.json(account);
  } catch (err) {
    next(err);
  }
});

router.get('/storage', withConnection, async (req, res, next) => {
  try {
    const usage = await pcloud.getStorageUsage(req.pcloud.conn);
    res.json(usage);
  } catch (err) {
    next(err);
  }
});

router.get('/files', withConnection, async (req, res, next) => {
  try {
    const folderId = Number(req.query.folderId) || 0;
    const files = await pcloud.listFiles(req.pcloud.conn, { folderId });
    res.json({ files, folderId });
  } catch (err) {
    next(err);
  }
});

router.post('/folders', withConnection, async (req, res, next) => {
  try {
    const { name, parentId = 0 } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });
    const folder = await pcloud.createFolder(req.pcloud.conn, {
      name,
      parentId: Number(parentId),
    });
    res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
});

router.post('/files/:id/rename', withConnection, async (req, res, next) => {
  try {
    const { newName, isFolder } = req.body || {};
    if (!newName) return res.status(400).json({ error: 'newName is required' });
    await pcloud.rename(req.pcloud.conn, {
      fileId: req.params.id,
      newName,
      isFolder: Boolean(isFolder),
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/files/:id', withConnection, async (req, res, next) => {
  try {
    const isFolder = req.query.isFolder === 'true';
    await pcloud.delete(req.pcloud.conn, { fileId: req.params.id, isFolder });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/files/:id/share', withConnection, async (req, res, next) => {
  try {
    const isFolder = Boolean(req.body && req.body.isFolder);
    const result = await pcloud.createShareLink(req.pcloud.conn, {
      fileId: req.params.id,
      isFolder,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/upload',
  withConnection,
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
      const filename = req.headers['x-file-name'];
      const folderId = Number(req.headers['x-folder-id']) || 0;
      if (!filename) return res.status(400).json({ error: 'x-file-name header is required' });
      const file = await pcloud.upload(req.pcloud.conn, {
        filename,
        folderId,
        data: req.rawBody,
      });
      res.status(201).json(file);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/files/:id/download', withConnection, async (req, res, next) => {
  try {
    const response = await pcloud.download(req.pcloud.conn, req.params.id);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    const disposition = response.headers.get('content-disposition');
    if (disposition) res.setHeader('content-disposition', disposition);
    webStreamToNode(response.body).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
