// Weekly: pull opening hours from Google Places (regularOpeningHours) for each place that has a
// Google place id, and replace its weekly rows. Exceptions (Ramadan, Eid) stay in place_exceptions.
// Schedule weekly with x-cron-secret.
//
// Secrets: CRON_SECRET, GOOGLE_PLACES_API_KEY. Places need `google_place_id` (see places table).
import { env, json } from '../_shared/http.ts';
import { admin, isCron } from '../_shared/supabase.ts';

type Period = { open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } };
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

Deno.serve(async (req) => {
  if (!isCron(req)) return json({ error: 'forbidden' }, 403);
  const key = env('GOOGLE_PLACES_API_KEY');
  const db = admin();
  const { data: places, error } = await db.from('places').select('id, google_place_id').not('google_place_id', 'is', null).eq('active', true);
  if (error) throw error;
  const done: string[] = [];
  for (const p of places ?? []) {
    const r = await fetch(`https://places.googleapis.com/v1/places/${p.google_place_id}`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'regularOpeningHours' },
    });
    if (!r.ok) { console.error(p.id, r.status, await r.text()); continue; }
    const periods: Period[] = (await r.json()).regularOpeningHours?.periods ?? [];
    // Google days: 0 = Sunday, same as Postgres extract(dow). A period without close = open 24h.
    const rows = periods.map((x) => x.close
      ? { weekday: x.open.day, opens: hhmm(x.open.hour, x.open.minute), closes: hhmm(x.close.hour, x.close.minute), closes_next_day: x.close.day !== x.open.day }
      : { weekday: x.open.day, opens: '00:00', closes: '00:00', closes_next_day: false });
    if (!rows.length) continue;
    const { error: e2 } = await db.rpc('replace_place_hours', { p_place: p.id, p_rows: rows });
    if (e2) console.error(p.id, e2.message); else done.push(p.id);
  }
  return json({ updated: done });
});
