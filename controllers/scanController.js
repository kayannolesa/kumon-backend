import db from '../db.js';
import { sendSmsMany } from '../utils/sms.js';
import { renderTemplate } from '../utils/renderTemplate.js';

function withinMinutes(d1, d2, mins) {
  return Math.abs(d1.getTime() - d2.getTime()) <= mins * 60 * 1000;
}

export async function handleScan(req, res, next) {
  const client = await db.pool.connect();
  try {
    const { qrCode, type } = req.body || {};
    if (!qrCode || !type) return res.status(400).json({ error: 'qrCode and type are required' });
    if (!['CHECK_IN', 'CHECK_OUT'].includes(type)) return res.status(400).json({ error: 'type must be CHECK_IN or CHECK_OUT' });

    // 1) Resolve QR → student
    const { rows: qrRows } = await client.query(
      `SELECT q.id as qr_id, q.student_id, s.first_name, s.last_name, s.status
         FROM qr_code q
         JOIN student s ON s.id = q.student_id
        WHERE q.token = $1 AND q.active = TRUE
        LIMIT 1`,
      [qrCode]
    );
    const qr = qrRows[0];
    if (!qr) return res.status(404).json({ error: 'QR code not found or inactive' });
    if (qr.status !== 'ACTIVE') return res.status(400).json({ error: 'Student is inactive' });

    // 2) Duplicate check (same type in last 2 min)
    const { rows: lastScanRows } = await client.query(
      `SELECT id, scanned_at
         FROM scan_event
        WHERE student_id = $1 AND type = $2
        ORDER BY scanned_at DESC
        LIMIT 1`,
      [qr.student_id, type]
    );

    const now = new Date();
    let isDuplicate = false;
    if (lastScanRows[0]) {
      const lastAt = new Date(lastScanRows[0].scanned_at);
      if (withinMinutes(now, lastAt, 2)) isDuplicate = true;
    }

    // 3) Insert scan_event
    const { rows: scanRows } = await client.query(
      `INSERT INTO scan_event (student_id, qr_code_id, type, scanned_by, scanned_at, was_duplicate, meta)
       VALUES ($1,$2,$3,$4,now(),$5,$6)
       RETURNING *`,
      [qr.student_id, qr.qr_id, type, req.user?.id || null, isDuplicate, {}]
    );
    const scan = scanRows[0];

    // If duplicate, return early (no SMS)
    if (isDuplicate) {
      return res.json({
        duplicate: true,
        scan
      });
    }

    // 4) Load template
    const templateKey = type; // 'CHECK_IN' | 'CHECK_OUT'
    const { rows: tRows } = await client.query(
      `SELECT text FROM message_template WHERE key = $1`,
      [templateKey]
    );
    const tpl = tRows[0]?.text || '{studentFirst} has an update at {time}';

    // 5) Load guardians for this student
    const { rows: gRows } = await client.query(
      `SELECT g.id, g.phone_e164
         FROM guardian g
         JOIN student_guardian sg ON sg.guardian_id = g.id
        WHERE sg.student_id = $1 AND g.active = TRUE AND g.phone_valid = TRUE`,
      [qr.student_id]
    );

    // 6) Compose message
    const body = renderTemplate(tpl, {
      studentFirst: qr.first_name,
      studentLast: qr.last_name,
      time: now.toLocaleString()
    });

    // 7) Create message_log
    const { rows: mlRows } = await client.query(
      `INSERT INTO message_log (student_id, trigger_type, scan_event_id, template_key, body_rendered, created_by)
       VALUES ($1,'SCAN',$2,$3,$4,$5)
       RETURNING id`,
      [qr.student_id, scan.id, templateKey, body, req.user?.id || null]
    );
    const messageLogId = mlRows[0].id;

    // 8) Fan out SMS via ClickSend (if guardians exist)
    let results = { messages: [] };
    if (gRows.length > 0) {
      const items = gRows.map(g => ({ to: g.phone_e164, body }));
      try {
        results = await sendSmsMany(items);
      } catch (e) {
        // We still record recipients below with FAILED
        console.error('ClickSend send error:', e.message);
      }
    }

    // 9) Insert recipients w/ statuses
    for (const g of gRows) {
      const found = results.messages.find(m => m.to === g.phone_e164);
      const statusNorm = found?.status === 'SUCCESS' ? 'SENT' : found ? 'SENT' : 'FAILED';
      const gatewayId = found?.message_id || null;
      const gatewayStatus = found?.status || (results.messages.length ? 'UNKNOWN' : 'FAILED');

      await client.query(
        `INSERT INTO message_recipient
           (message_log_id, guardian_id, phone_e164, status, gateway_message_id, gateway_status)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [messageLogId, g.id, g.phone_e164, statusNorm, gatewayId, gatewayStatus]
      );
    }

    res.json({
      scan,
      messageLogId,
      recipients: gRows.map(g => g.phone_e164),
      sent: results.messages.length
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
}
