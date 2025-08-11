import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Auth required' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin only' });
  return next();
}
