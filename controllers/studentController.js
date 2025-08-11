import db from '../db.js';
import logAdminAction from '../utils/logAdminAction.js';

export async function createStudent(req, res, next) {
  try {
    const {
      externalId = null,
      firstName,
      lastName,
      status = 'ACTIVE',
      canLeaveAlone = false,
      notes = null
    } = req.body || {};

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' });
    }

    const { rows } = await db.query(
      `INSERT INTO student (external_id, first_name, last_name, status, can_leave_alone, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [externalId, firstName, lastName, status, !!canLeaveAlone, notes]
    );

    await logAdminAction(req.user.id, 'STUDENT_CREATE', 'student', rows[0].id, { firstName, lastName });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function listStudents(req, res, next) {
  try {
    const { search = '', status, limit = 50, offset = 0 } = req.query;
    const clauses = [];
    const params = [];
    let p = 1;

    if (search) {
      clauses.push(`(first_name ILIKE $${p} OR last_name ILIKE $${p} OR external_id ILIKE $${p})`);
      params.push(`%${search}%`);
      p++;
    }
    if (status) {
      clauses.push(`status = $${p}`);
      params.push(status);
      p++;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    params.push(Number(limit), Number(offset));

    const { rows } = await db.query(
      `SELECT id, external_id, first_name, last_name, status, can_leave_alone, created_at, updated_at
         FROM student
         ${where}
         ORDER BY last_name, first_name
         LIMIT $${p++} OFFSET $${p}`,
      params
    );

    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
}

export async function updateStudent(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const allowed = ['external_id', 'first_name', 'last_name', 'status', 'can_leave_alone', 'notes'];
    const body = req.body || {};
    const sets = [];
    const params = [];
    let p = 1;

    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${p++}`);
        params.push(body[key]);
      }
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);

    const { rows } = await db.query(
      `UPDATE student SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${p}
       RETURNING *`,
      params
    );

    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    await logAdminAction(req.user.id, 'STUDENT_UPDATE', 'student', id, body);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function linkGuardian(req, res, next) {
  try {
    const studentId = Number(req.params.id);
    const guardianId = Number(req.params.gid);
    if (!studentId || !guardianId) return res.status(400).json({ error: 'Invalid ids' });

    await db.query(
      `INSERT INTO student_guardian (student_id, guardian_id, is_primary)
       VALUES ($1,$2,$3)
       ON CONFLICT (student_id, guardian_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
      [studentId, guardianId, !!req.body?.isPrimary]
    );

    await logAdminAction(req.user.id, 'STUDENT_LINK_GUARDIAN', 'student', studentId, { guardianId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
