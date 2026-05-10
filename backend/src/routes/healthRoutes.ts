import { Router } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

router.get('/', async (_req, res) => {
  let dbOk = false;
  try {
    const { error } = await supabase.from('nifty_periods').select('id').limit(1);
    dbOk = !error;
  } catch {}

  res.status(dbOk ? 200 : 503).json({
    status:    dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services:  { database: dbOk ? 'ok' : 'unreachable' },
  });
});

export default router;
