import express from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth.js';
import {
  createStudent,
  listStudents,
  updateStudent,
  linkGuardian
} from '../controllers/studentController.js';

const router = express.Router();

router.get('/', requireAuth, listStudents);
router.post('/', requireAdmin, createStudent);
router.patch('/:id', requireAdmin, updateStudent);
router.post('/:id/guardians/:gid', requireAdmin, linkGuardian);

export default router;
