import db from '../db.js';
import logAdminAction from '../utils/logAdminAction.js';

function isE164(phone) {
  return typeof phone === 'string' && /^\+[1-9][0-9]{1,14}$/.test(phone);
}

export async function createGuardian(req, res, next) {
  try {
    const { name, relationship = 'GUARDIAN', phone } = req.body || {};
    if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });

    const phone_e164 = phone;
    if (!isE164(phone_e164)) return res.status(400).json({ error: 'phone must be E.164 format, e.g., +61412345678' });

    const { rows } = await db.query(
      `INSERT INTO guardian (name, relationship, phone_raw, phone_e164, phone_valid, active)
       VALUES ($1,$2,$3,$4,$5,TRUE)
       RETURNING *`,
      [name, relationship, phone, phone_e164, true]
    );

    await logAdminAction(req.user.id, 'GUARDIAN_CREATE', 'guardian', rows[0].id, { name, phone_e164 });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function listGuardians(req, res, next) {
  try {
    const { studentId } = req.query;
    if (studentId) {
      const { rows } = await db.query(
        `SELECT g.*
           FROM guardian g
           JOIN student_guardian sg ON sg.guardian_id = g.id
          WHERE sg.student_id = $1
          ORDER BY g.name`,
        [Number(studentId)]
      );
      return res.json({ items: rows });
    }
    const { rows } = await db.query(`SELECT * FROM guardian ORDER BY name LIMIT 200`);
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
}
