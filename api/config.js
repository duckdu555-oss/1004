module.exports = function handler(req, res) {
  const config = {
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
    PHOTO_BUCKET: process.env.PHOTO_BUCKET || "member-history"
  };
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).send(`window.APP_CONFIG = ${JSON.stringify(config)};`);
};
