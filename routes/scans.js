import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { handleScan } from '../controllers/scanController.js';

const router = express.Router();

router.post('/', requireAuth, handleScan);

export default router;
