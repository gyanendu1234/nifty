import { Router } from 'express';
import adminRoutes     from './adminRoutes';
import companyRoutes   from './companyRoutes';
import ladderRoutes    from './ladderRoutes';
import periodRoutes    from './periodRoutes';
import sectorRoutes    from './sectorRoutes';
import dashboardRoutes from './dashboardRoutes';
import healthRoutes    from './healthRoutes';
import compareRoutes   from './compareRoutes';
import starsRoutes     from './starsRoutes';
import trendsRoutes    from './trendsRoutes';
import nseRoutes       from './nseRoutes';

const router = Router();

router.use('/admin',     adminRoutes);
router.use('/companies', companyRoutes);
router.use('/ladder',    ladderRoutes);
router.use('/periods',   periodRoutes);
router.use('/sectors',   sectorRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/health',    healthRoutes);
router.use('/compare',   compareRoutes);
router.use('/stars',     starsRoutes);
router.use('/trends',    trendsRoutes);
router.use('/nse',       nseRoutes);

export default router;
