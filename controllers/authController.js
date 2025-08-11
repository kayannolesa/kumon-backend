import db from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows } = await db.query(
      `SELECT id, email, password_hash, role, active
         FROM app_user
        WHERE email = $1
        LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user || !user.active) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    await db.query(`UPDATE app_user SET last_login_at = now() WHERE id = $1`, [user.id]);

    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req, res) {
  res.json({ user: req.user });
}
