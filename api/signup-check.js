const { env, json, safeEqual, supabase } = require('./_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const { signupCode, userId, nickname } = req.body || {};
    if (!safeEqual(signupCode, env('SIGNUP_CODE'))) return json(res, 400, { error: 'INVALID_SIGNUP_CODE' });
    const uid = String(userId || '').trim().toLowerCase();
    const nick = String(nickname || '').trim();
    if (!uid || !nick) return json(res, 400, { error: 'INVALID_INPUT' });

    const q1 = encodeURIComponent(`eq.${uid}`);
    const q2 = encodeURIComponent(`eq.${nick}`);
    const [users, nicks] = await Promise.all([
      supabase(`/rest/v1/members?select=id&user_id=${q1}&limit=1`),
      supabase(`/rest/v1/members?select=id&nickname=${q2}&limit=1`)
    ]);
    if (users.length) return json(res, 409, { error: 'DUPLICATE_USER_ID' });
    if (nicks.length) return json(res, 409, { error: 'DUPLICATE_NICKNAME' });
    return json(res, 200, { ok: true });
  } catch (error) {
    return json(res, 500, { error: 'SERVER_ERROR', message: error.message });
  }
};
