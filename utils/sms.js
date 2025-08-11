const CLICK_SEND_API = 'https://rest.clicksend.com/v3/sms/send';

function basicAuth() {
  const u = process.env.CLICK_SEND_USERNAME || '';
  const k = process.env.CLICK_SEND_API_KEY || '';
  const token = Buffer.from(`${u}:${k}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * sendSmsMany([{to:'+61...', body:'text'}])
 * Returns { messages: [{to, message_id, status}] }
 */
export async function sendSmsMany(items) {
  if (!items?.length) return { messages: [] };

  const payload = {
    messages: items.map(i => ({ to: i.to, source: 'api', body: i.body }))
  };

  const res = await fetch(CLICK_SEND_API, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.response_msg || data?.error || res.statusText;
    throw new Error(`ClickSend error: ${msg}`);
  }

  const messages = (data?.data?.messages || []).map(m => ({
    to: m.to,
    message_id: m.message_id,
    status: m.status // e.g., "SUCCESS"
  }));

  return { messages };
}