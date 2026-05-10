import { Router, Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// GET /api/periods
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('nifty_periods')
      .select('id, period_label, period_end_date, period_type, import_status, uploaded_at, source_file_name')
      .eq('import_status', 'completed')
      .order('period_end_date', { ascending: false });

    if (error) throw new Error(error.message);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/periods/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data, error } = await supabase
      .from('nifty_periods')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      res.status(404).json({ error: 'Period not found' });
      return;
    }

    const { count: snapshotCount } = await supabase
      .from('nifty_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('period_id', req.params.id);

    res.json({ data: { ...data, snapshot_count: snapshotCount ?? 0 } });
  } catch (err) {
    next(err);
  }
});

export default router;
