import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { adminClient } from '../supabase.js';

const router = Router();

router.use(requireAuth);

// Sharing is not fully wired up yet. This endpoint exposes the real data model:
// files the current user shared ("by me") and files shared with them ("with me").
router.get('/', async (req, res, next) => {
  try {
    const [sharedByMe, sharedWithMe] = await Promise.all([
      adminClient
        .from('file_shares')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false }),
      adminClient
        .from('file_shares')
        .select('*')
        .eq('shared_with_user_id', req.user.id)
        .order('created_at', { ascending: false }),
    ]);

    // file_shares table may not be created in Supabase yet. Treat as empty rather
    // than breaking the page.
    if (sharedByMe.error && sharedByMe.error.code !== '42P01') throw sharedByMe.error;
    if (sharedWithMe.error && sharedWithMe.error.code !== '42P01') throw sharedWithMe.error;

    res.json({
      sharedByMe: sharedByMe.data || [],
      sharedWithMe: sharedWithMe.data || [],
    });
  } catch (err) {
    next(err);
  }
});

export default router;
