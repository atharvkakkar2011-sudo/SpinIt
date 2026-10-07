// Phase-1 booking: tell the venue about each new request (WhatsApp Cloud API, else email via
// Resend) with a link to confirm or decline. Schedule every minute with x-cron-secret.
//
// Secrets: CRON_SECRET, SPINIT_WEB_BASE (e.g. https://spinit.app)
//          WHATSAPP_TOKEN + WHATSAPP_PHONE_ID   (optional, Meta WhatsApp Cloud API)
//          RESEND_API_KEY + BOOKINGS_FROM_EMAIL (optional, email fallback)
import { env, json } from '../_shared/http.ts';
import { admin, isCron } from '../_shared/supabase.ts';

type Msg = { id: string; confirm_token: string; party_size: number; slot_at: string; dish: string | null; place: string; venue: string | null; whatsapp: string | null; email: string | null };

const when = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));

async function whatsapp(to: string, text: string) {
  const token = Deno.env.get('WHATSAPP_TOKEN'), phone = Deno.env.get('WHATSAPP_PHONE_ID');
  if (!token || !phone) return false;
  const r = await fetch(`https://graph.facebook.com/v21.0/${phone}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/[^\d]/g, ''), type: 'text', text: { body: text, preview_url: true } }),
  });
  if (!r.ok) throw new Error(`whatsapp ${r.status}: ${await r.text()}`);
  return true;
}

async function email(to: string, subject: string, text: string) {
  const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('BOOKINGS_FROM_EMAIL');
  if (!key || !from) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!r.ok) throw new Error(`email ${r.status}: ${await r.text()}`);
  return true;
}

Deno.serve(async (req) => {
  if (!isCron(req)) return json({ error: 'forbidden' }, 403);
  const base = env('SPINIT_WEB_BASE', 'https://spinit.app').replace(/\/$/, '');
  const db = admin();
  const { data, error } = await db.rpc('claim_venue_messages', { p_limit: 50 });
  if (error) throw error;
  let sent = 0;
  for (const m of (data ?? []) as Msg[]) {
    const link = `${base}/b/${m.confirm_token}`;
    const text = `New Spin It table request 🎡\n${m.party_size} people · ${when(m.slot_at)}\n${m.dish ?? 'Dinner'} near ${m.place}\nConfirm or decline: ${link}`;
    try {
      let channel = '';
      if (m.whatsapp && await whatsapp(m.whatsapp, text)) channel = 'whatsapp';
      else if (m.email && await email(m.email, `Table request: ${m.party_size} people, ${when(m.slot_at)}`, text)) channel = 'email';
      if (!channel) { await db.rpc('finish_venue_message', { p_id: m.id, p_channel: 'none', p_error: 'venue has no contact or no channel configured' }); continue; }
      await db.rpc('finish_venue_message', { p_id: m.id, p_channel: channel });
      sent++;
    } catch (e) {
      await db.rpc('finish_venue_message', { p_id: m.id, p_channel: 'failed', p_error: String(e) });
    }
  }
  return json({ sent });
});
