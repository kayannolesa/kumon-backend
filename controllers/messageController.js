import db from '../db.js';

export async function listMessages(req, res, next) {
  try {
    const { studentId, limit = 50, offset = 0 } = req.query;
    const params = [Number(limit), Number(offset)];
    let where = '';
    if (studentId) {
      where = 'WHERE ml.student_id = $3';
      params.push(Number(studentId));
    }
    const { rows } = await db.query(
      `SELECT ml.id, ml.student_id, ml.template_key, ml.body_rendered, ml.created_at,
              (SELECT json_agg(json_build_object(
                  'id', mr.id,
                  'to', mr.phone_e164,
                  'status', mr.status,
                  'gateway_message_id', mr.gateway_message_id,
                  'gateway_status', mr.gateway_status,
                  'updated_at', mr.updated_at
              ) ORDER BY mr.id)
               FROM message_recipient mr WHERE mr.message_log_id = ml.id) AS recipients
         FROM message_log ml
         ${where}
         ORDER BY ml.created_at DESC
         LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
}
