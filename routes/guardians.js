import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import { createGuardian, listGuardians } from '../controllers/guardianController.js';

const router = express.Router();

router.get('/', requireAuth, listGuardians);
router.post('/', requireAdmin, createGuardian);

export default router;
