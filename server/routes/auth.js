import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, (req, res) => {
  const { user } = req;
  res.json({
    id: user.id,
    email: user.email,
    name: (user.user_metadata && user.user_metadata.full_name) || null,
    emailVerified: user.email_confirmed_at ? true : false,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  });
});

export default router;
