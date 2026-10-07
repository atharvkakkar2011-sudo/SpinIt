// Runtime config comes from www/config.js (written by scripts/build-www.mjs from the environment).
const c = (typeof window !== 'undefined' && window.SPINIT_CONFIG) || {};
export const config = {
  supabaseUrl: c.supabaseUrl || 'http://127.0.0.1:54321',
  // Local-development anon key (matches scripts/dev-backend.mjs). Real projects set SPINIT_SUPABASE_ANON_KEY.
  supabaseAnonKey: c.supabaseAnonKey || 'dev-anon-key',
  webBase: (c.webBase || 'https://spinit.app').replace(/\/$/, ''),
};
