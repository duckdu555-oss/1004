const { env, json, safeEqual, supabase } = require('./_utils');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const b = req.body || {};
    if (!safeEqual(b.signupCode, env('SIGNUP_CODE'))) return json(res, 400, { error: 'INVALID_SIGNUP_CODE' });
    const data = await supabase('/rest/v1/rpc/register_member', {
      method: 'POST',
      body: JSON.stringify({
        p_signup_code: b.signupCode,
        p_user_id: b.userId,
        p_password: b.password,
        p_nickname: b.nickname,
        p_account_holder: b.accountHolder,
        p_bank: b.bank,
        p_account_number: b.accountNumber,
        p_birth_date: b.birthDate,
        p_phone: b.phone,
        p_exchange_password: b.exchangePassword,
        p_referral_code: b.signupCode,
        p_photo_1_path: b.photo1Path || null,
        p_photo_2_path: b.photo2Path || null
      })
    });
    return json(res, 200, data || { ok: true });
  } catch (error) {
    const message = String(error.message || '');
    if (message.includes('DUPLICATE_USER_ID')) return json(res, 409, { error: 'DUPLICATE_USER_ID' });
    if (message.includes('DUPLICATE_NICKNAME')) return json(res, 409, { error: 'DUPLICATE_NICKNAME' });
    if (message.includes('DUPLICATE_MEMBER')) return json(res, 409, { error: 'DUPLICATE_MEMBER' });
    return json(res, 500, { error: 'SERVER_ERROR', message });
  }
};
