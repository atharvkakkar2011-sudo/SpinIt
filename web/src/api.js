// Tiny client for the public database functions these pages call (no account needed).
const cfg = window.SPINIT_CONFIG || {};
export async function rpc(name, args) {
  const r = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error((body && (body.message || body.hint)) || `HTTP ${r.status}`);
  return body;
}
export const $ = (s) => document.querySelector(s);
export const lastSegment = () => decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() || '') || location.hash.slice(1);
export const config = cfg;
