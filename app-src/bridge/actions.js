import QRCode from 'qrcode';
import { supabase, unwrap } from './client.js';
import { config } from './config.js';
import { store } from './store.js';
import { PLACE_IDS, idOf, idxOf } from './ids.js';
import { plannedArrival } from './time.js';

// ---- spin: the server decides, the wheel animates to it ---------------------------------------
export async function spin(candidateIds, mode) {
  const r = await unwrap(supabase.rpc('spin', { p_mode: mode, p_candidates: candidateIds, p_arrive: plannedArrival() }));
  store.patchServerFields({ spinsLeft: r.spins_left });
  return r; // { place_id, spin_id, at, spins_left }
}

export async function refreshNight() {
  const n = await unwrap(supabase.rpc('my_night'));
  return n; // { night_key, spins_left, bonus_spins, locked }
}

// ---- lock + booking -----------------------------------------------------------------------------
export const booking = {
  /** b = { i, fa, size, time }. Returns the booking id. Replaces an earlier one if replaceId is given. */
  async request(b, replaceId) {
    const r = await unwrap(supabase.rpc('request_booking', { p_place: idOf(b.i), p_food_alt: b.fa, p_size: b.size, p_time: b.time, p_replace: replaceId || null }));
    return r.id;
  },
  async cancel(id) { if (id) await unwrap(supabase.rpc('cancel_booking', { p_id: id })); },
  availability(i) { return unwrap(supabase.rpc('booking_availability', { p_place: idOf(i) })); },
};

export const night = {
  async lock(i, bookingId) { await unwrap(supabase.rpc('lock_night', { p_place: idOf(i), p_booking: bookingId || null })); },
  async unlock() { await unwrap(supabase.rpc('unlock_night')); },
};

// ---- deals / QR -----------------------------------------------------------------------------------
export const deals = {
  token: (i) => unwrap(supabase.rpc('deal_token', { p_place: idOf(i) })),
  status: (i) => unwrap(supabase.rpc('deal_status', { p_place: idOf(i) })),
  /** 25x25 cells in the prototype's {c} colour format (version-2 QR holds the 29-30 char signed token). */
  qrCells(token) {
    const qr = QRCode.create(token, { version: 2, errorCorrectionLevel: 'L' });
    const n = qr.modules.size;
    return Array.from({ length: n * n }, (_, k) => ({ c: qr.modules.data[k] ? '#0E0A12' : '#FFFFFF' }));
  },
};

// ---- squad ------------------------------------------------------------------------------------------
const COLORS = ['#F5EEF6', '#9C8FA4', '#FFB23D', '#3DF2FF', '#C6FF3D'];
let sq = { code: null, id: null, channel: null, poll: null, cb: null, seen: new Set() };

const toMembers = (state, me) => (state.members || []).map((m, k) => ({
  name: m.host ? 'You' : m.name,
  initial: (m.host ? me : m.name || '?')[0].toUpperCase(),
  av: COLORS[k % COLORS.length],
  vote: m.vote || undefined,
  key: m.host ? 'host' : m.name,
}));

export const squad = {
  code: () => sq.code || '',
  link: () => (sq.code ? `${config.webBase}/s/${sq.code.replace('SPIN-', '')}` : config.webBase),

  /** Create (or reuse) the squad and stream its members. cb(members, newNames, state) runs on every change. */
  async start(vote, myName, cb) {
    squad.stop();
    const r = await unwrap(supabase.rpc('create_squad', { p_vote: vote || null }));
    sq = { code: r.code, id: r.id, channel: null, poll: null, cb, seen: new Set() };
    const pull = async () => {
      if (!sq.code) return;
      try {
        const st = await unwrap(supabase.rpc('squad_state', { p_code: sq.code }));
        const members = toMembers(st, myName);
        const fresh = members.filter((m) => !sq.seen.has(m.key) && m.key !== 'host').map((m) => m.name);
        members.forEach((m) => sq.seen.add(m.key));
        sq.cb && sq.cb(members, fresh, st);
      } catch { /* transient: next tick */ }
    };
    await pull();
    // Realtime pushes changes the moment a friend votes; polling is the safety net when the socket is down.
    try {
      sq.channel = supabase.channel(`squad:${r.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_members', filter: `squad_id=eq.${r.id}` }, pull)
        .subscribe();
    } catch { /* polling only */ }
    sq.poll = setInterval(pull, 3000);
    return r;
  },

  hostVote: (vote) => (sq.code ? unwrap(supabase.rpc('squad_host_vote', { p_code: sq.code, p_vote: vote })) : Promise.resolve()),
  tally: () => unwrap(supabase.rpc('squad_tally', { p_code: sq.code })),
  finish: (i) => (sq.code ? unwrap(supabase.rpc('squad_finish', { p_code: sq.code, p_place: idOf(i) })) : Promise.resolve()),

  stop() {
    clearInterval(sq.poll);
    if (sq.channel) supabase.removeChannel(sq.channel);
    sq = { code: sq.code, id: sq.id, channel: null, poll: null, cb: null, seen: new Set() };
  },
};

// ---- AI ---------------------------------------------------------------------------------------------
export async function ai(prompt) {
  const { data, error } = await supabase.functions.invoke('ai-chat', { body: { prompt } });
  if (error) throw error;
  if (!data || !data.text) throw new Error('empty reply');
  return data.text;
}

// ---- feedback + content --------------------------------------------------------------------------------
export async function feedback(tag, body) {
  const { data } = await supabase.auth.getUser();
  await unwrap(supabase.from('feedback').insert({ user_id: data.user && data.user.id, tag: tag || null, body: body || '' }));
}

let contentCache = { events: null, locals: null };
export const content = {
  async load() {
    try {
      const [ev, lo] = await Promise.all([
        unwrap(supabase.from('events').select('place_id,title,time_text,tag,image').eq('active', true).order('sort_order')),
        unwrap(supabase.from('local_picks').select('place_id,handle,initial,color,quote').eq('active', true).order('sort_order')),
      ]);
      contentCache = { events: ev, locals: lo };
      try { localStorage.setItem('spinit-content', JSON.stringify(contentCache)); } catch { /* ignore */ }
    } catch {
      try { contentCache = JSON.parse(localStorage.getItem('spinit-content') || 'null') || contentCache; } catch { /* ignore */ }
    }
  },
  /** Same tuple shape as the prototype: [placeIndex, time, name, tag, image]. */
  events: () => (contentCache.events && contentCache.events.length ? contentCache.events.map((e) => [idxOf(e.place_id), e.time_text, e.title, e.tag, e.image]) : null),
  /** [handle, initial, colour, placeIndex, quote] */
  locals: () => (contentCache.locals && contentCache.locals.length ? contentCache.locals.map((l) => [l.handle, l.initial, l.color, idxOf(l.place_id), l.quote]) : null),
};
export { PLACE_IDS };
