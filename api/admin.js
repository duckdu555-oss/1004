const { env, json, safeEqual, supabase } = require('./_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const { password, action, id, status, path } = req.body || {};
    if (!safeEqual(password, env('ADMIN_PASSWORD'))) return json(res, 401, { error: 'INVALID_ADMIN_PASSWORD' });

    if (action === 'list') {
      const data = await supabase('/rest/v1/members?select=*&order=created_at.desc');
      return json(res, 200, { members: data });
    }
    if (action === 'status') {
      if (!['approved', 'rejected', 'pending'].includes(status)) return json(res, 400, { error: 'INVALID_STATUS' });
      await supabase(`/rest/v1/members?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          status,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
          rejected_at: status === 'rejected' ? new Date().toISOString() : null
        })
      });
      return json(res, 200, { ok: true });
    }
    if (action === 'signed-url') {
      if (!path) return json(res, 200, { url: null });
      const bucket = process.env.PHOTO_BUCKET || 'member-history';
      const data = await supabase(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST', body: JSON.stringify({ expiresIn: 300 })
      });
      const base = env('SUPABASE_URL').replace(/\/$/, '');
      return json(res, 200, { url: data?.signedURL ? `${base}/storage/v1${data.signedURL}` : null });
    }
    return json(res, 400, { error: 'INVALID_ACTION' });
  } catch (error) {
    return json(res, 500, { error: 'SERVER_ERROR', message: error.message });
  }
};
