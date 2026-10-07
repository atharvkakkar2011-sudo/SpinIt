// Sends queued pushes (public.notification_queue) through Firebase Cloud Messaging (HTTP v1).
// One FCM token per device works for both Android and iOS because the app registers through
// @capacitor-firebase/messaging. Schedule every minute (Dashboard > Edge Functions > Schedules,
// header x-cron-secret: <CRON_SECRET>).
//
// Secrets: FCM_SERVICE_ACCOUNT (the Firebase service-account JSON), CRON_SECRET
import { env, json } from '../_shared/http.ts';
import { signRS256 } from '../_shared/jwt.ts';
import { admin, isCron } from '../_shared/supabase.ts';

type Tok = { token: string; platform: string };
type Row = { id: string; user_id: string; kind: string; title: string; body: string; data: Record<string, unknown>; tokens: Tok[] };

let cached: { token: string; exp: number } | null = null;

async function googleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signRS256({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }, sa.private_key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!r.ok) throw new Error(`google token ${r.status}: ${await r.text()}`);
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

Deno.serve(async (req) => {
  if (!isCron(req)) return json({ error: 'forbidden' }, 403);
  const sa = JSON.parse(env('FCM_SERVICE_ACCOUNT'));
  const db = admin();
  const { data, error } = await db.rpc('claim_due_notifications', { p_limit: 200 });
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (!rows.length) return json({ sent: 0 });

  const access = await googleAccessToken(sa);
  let sent = 0;
  for (const n of rows) {
    const dead: string[] = [];
    for (const t of n.tokens) {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: {
          token: t.token,
          notification: { title: n.title, body: n.body },
          // data values must be strings
          data: Object.fromEntries(Object.entries({ ...n.data, kind: n.kind }).map(([k, v]) => [k, String(v)])),
          apns: { payload: { aps: { sound: 'default' } } },
          android: { priority: 'high' },
        } }),
      });
      if (r.ok) sent++;
      else if (r.status === 404 || r.status === 400) dead.push(t.token); // unregistered / invalid token
      else console.error('fcm', r.status, await r.text());
    }
    await db.rpc('finish_notification', { p_id: n.id, p_dead_tokens: dead });
  }
  return json({ sent, notifications: rows.length });
});
