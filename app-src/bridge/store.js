// The prototype keeps one JSON blob ("spinit-app-v2") in localStorage. Here the server is the source
// of truth: the blob is assembled from the database after sign-in, edits are diffed back to the
// tables, and a local copy remains only as an offline cache.
import { supabase, unwrap } from './client.js';
import { PLACE_IDS, idxOf, idOf } from './ids.js';
import { historyLabel, nightKeyFromDate } from './time.js';

const CACHE_KEY = 'spinit-cache-v1';
const DEFAULT_AVATAR = './sp-avatar.png';
const MAX_SPINS = 3;

let cached = null;      // { uid, blob, synced }
let meta = { refCode: '' }; // server facts the UI never edits
let uid = null;
let timer = null;
let retry = null;
let flushing = Promise.resolve();

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; } };
const writeCache = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cached)); } catch { /* storage full or blocked */ } };
const clone = (o) => JSON.parse(JSON.stringify(o ?? null));

// ---- server -> blob ---------------------------------------------------------------------------
export async function fetchBlob(user) {
  const id = user.id;
  const [prof, wheel, saved, evenings, spins, deals, night, booking] = await Promise.all([
    unwrap(supabase.from('profiles').select('*').eq('id', id).single()),
    unwrap(supabase.from('wheels').select('*').eq('user_id', id).single()),
    unwrap(supabase.from('saved_places').select('place_id')),
    unwrap(supabase.from('evenings').select('place_id,food_alt,dessert_alt,created_at').order('created_at', { ascending: false })),
    unwrap(supabase.from('spins').select('id,place_id,mode,rating,skip_rate,created_at').order('created_at', { ascending: false }).limit(12)),
    unwrap(supabase.from('user_deals').select('unlocked_at,redeemed_at,deals(place_id)').order('unlocked_at', { ascending: false })),
    unwrap(supabase.rpc('my_night')),
    unwrap(supabase.rpc('my_booking')),
  ]);

  const on = new Set(wheel.place_ids || []);
  const configured = on.size > 0;
  const wheelMap = Object.fromEntries(PLACE_IDS.map((p) => [p, configured ? on.has(p) : true]));

  const blob = {
    saved: Object.fromEntries(saved.map((s) => [idxOf(s.place_id), true]).filter(([i]) => i >= 0)),
    evenings: evenings.map((e) => ({ i: idxOf(e.place_id), fa: e.food_alt, da: e.dessert_alt })).filter((e) => e.i >= 0),
    deals: deals.map((d) => ({ i: idxOf(d.deals?.place_id), used: !!d.redeemed_at, at: Date.parse(d.unlocked_at) })).filter((d) => d.i >= 0),
    history: spins.map((s) => ({
      i: idxOf(s.place_id), mode: s.mode, at: historyLabel(Date.parse(s.created_at)),
      ...(s.rating ? { rating: s.rating } : {}), ...(s.skip_rate ? { skipRate: true } : {}), sid: s.id, ts: Date.parse(s.created_at),
    })).filter((h) => h.i >= 0),
    wheel: wheelMap,
    user: { name: prof.name, email: user.email, g: prof.g, avatar: prof.avatar === 'sp-avatar' ? DEFAULT_AVATAR : prof.avatar },
    calm: prof.calm,
    locked: night.locked ? { i: idxOf(night.locked.place_id), key: nightKeyFromDate(night.locked.night_key) } : null,
    mystery: prof.mystery,
    night: nightKeyFromDate(night.night_key),
    booking: booking ? { i: idxOf(booking.place_id), fa: booking.food_alt, size: booking.party_size, time: slotLabel(booking.slot_at), id: booking.id, status: booking.status } : null,
    favVibes: prof.fav_vibes,
    notif: prof.notif,
    loc: prof.loc,
    squadUsed: prof.squad_used,
    bonusSpins: night.bonus_spins || 0,
    wheelName: wheel.name,
    acc: wheel.accent,
    emoji: wheel.emoji,
    spinsLeft: night.spins_left ?? MAX_SPINS,
    mood: prof.mood,
    bMin: prof.budget_min,
    bMax: prof.budget_max,
    who: prof.who,
    limitOn: prof.limit_on,
    refCode: prof.ref_code,
  };
  return blob;
}

function slotLabel(iso) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Qatar', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
  return parts.replace(/\s?([AP]M)/i, ' $1').toUpperCase().replace(/^0/, '');
}

// ---- blob -> server (diff) ---------------------------------------------------------------------
const evKey = (e) => `${e.i}:${e.fa}:${e.da}`;

function profilePatch(b, s) {
  const p = {};
  const set = (col, v, old) => { if (JSON.stringify(v) !== JSON.stringify(old)) p[col] = v; };
  const u = b.user || {}, o = s?.user || {};
  set('name', (u.name || '').slice(0, 40), (o.name || '').slice(0, 40));
  set('g', u.g, o.g);
  set('avatar', u.avatar === DEFAULT_AVATAR ? 'sp-avatar' : u.avatar, o.avatar === DEFAULT_AVATAR ? 'sp-avatar' : o.avatar);
  set('fav_vibes', b.favVibes || [], s?.favVibes || []);
  set('notif', b.notif !== false, s?.notif !== false);
  set('loc', b.loc !== false, s?.loc !== false);
  set('calm', !!b.calm, !!s?.calm);
  set('mystery', !!b.mystery, !!s?.mystery);
  set('squad_used', !!b.squadUsed, !!s?.squadUsed);
  set('limit_on', b.limitOn !== false, s?.limitOn !== false);
  set('mood', b.mood ?? null, s?.mood ?? null);
  set('budget_min', b.bMin ?? 0, s?.bMin ?? 0);
  set('budget_max', b.bMax ?? 400, s?.bMax ?? 400);
  set('who', b.who || 'Friends', s?.who || 'Friends');
  if (!u.g) delete p.g;
  return p;
}

async function pushDiff(b, s) {
  const ops = [];
  const pp = profilePatch(b, s);
  if (Object.keys(pp).length) ops.push(unwrap(supabase.from('profiles').update(pp).eq('id', uid)));

  const wp = {};
  if (b.wheelName !== s?.wheelName) wp.name = String(b.wheelName || 'My wheel').slice(0, 18);
  if (b.emoji !== s?.emoji) wp.emoji = b.emoji;
  if (b.acc !== s?.acc) wp.accent = b.acc;
  const onIds = (w) => PLACE_IDS.filter((id) => w?.[id]).sort().join(',');
  if (onIds(b.wheel) !== onIds(s?.wheel)) wp.place_ids = PLACE_IDS.filter((id) => b.wheel?.[id]);
  if (Object.keys(wp).length) ops.push(unwrap(supabase.from('wheels').update({ ...wp, updated_at: new Date().toISOString() }).eq('user_id', uid)));

  const sv = new Set(Object.keys(s?.saved || {}).filter((k) => s.saved[k]));
  const bv = new Set(Object.keys(b.saved || {}).filter((k) => b.saved[k]));
  const add = [...bv].filter((k) => !sv.has(k)), del = [...sv].filter((k) => !bv.has(k));
  if (add.length) ops.push(unwrap(supabase.from('saved_places').upsert(add.map((k) => ({ user_id: uid, place_id: idOf(Number(k)) })), { onConflict: 'user_id,place_id', ignoreDuplicates: true })));
  if (del.length) ops.push(unwrap(supabase.from('saved_places').delete().eq('user_id', uid).in('place_id', del.map((k) => idOf(Number(k))))));

  const se = new Map((s?.evenings || []).map((e) => [evKey(e), e])), be = new Map((b.evenings || []).map((e) => [evKey(e), e]));
  const eAdd = [...be].filter(([k]) => !se.has(k)).map(([, e]) => ({ user_id: uid, place_id: idOf(e.i), food_alt: e.fa, dessert_alt: e.da }));
  if (eAdd.length) ops.push(unwrap(supabase.from('evenings').upsert(eAdd, { onConflict: 'user_id,place_id,food_alt,dessert_alt', ignoreDuplicates: true })));
  for (const [k, e] of se) if (!be.has(k)) ops.push(unwrap(supabase.from('evenings').delete().eq('user_id', uid).eq('place_id', idOf(e.i)).eq('food_alt', e.fa).eq('dessert_alt', e.da)));

  const sh = new Map((s?.history || []).filter((h) => h.sid).map((h) => [h.sid, h]));
  for (const h of b.history || []) {
    const o = sh.get(h.sid);
    if (h.sid && o && (o.rating !== h.rating || !!o.skipRate !== !!h.skipRate)) {
      ops.push(unwrap(supabase.rpc('rate_spin', { p_spin: h.sid, p_rating: h.rating ?? 0, p_skip: !!h.skipRate })));
    }
  }
  await Promise.all(ops);
}

async function flush() {
  if (!uid || !cached || JSON.stringify(cached.blob) === JSON.stringify(cached.synced)) return;
  const snapshot = clone(cached.blob);
  try {
    await pushDiff(snapshot, cached.synced);
    cached.synced = snapshot;
    writeCache();
  } catch (e) {
    console.warn('[spinit] sync failed, will retry', e && e.message);
    clearTimeout(retry);
    retry = setTimeout(() => store.flush(), 15000);
  }
}

export const store = {
  meta() { return meta; },

  /** Synchronous read for the component (a copy of what the server last told us, plus local edits). */
  get() { return cached && cached.uid === uid && uid ? clone(cached.blob) : null; },

  set(blob) {
    if (!uid) return;
    if (cached && JSON.stringify(cached.blob) === JSON.stringify(blob)) return;
    cached = { uid, blob: clone(blob), synced: cached?.synced ?? null };
    writeCache();
    clearTimeout(timer);
    timer = setTimeout(() => store.flush(), 700);
  },

  flush() { flushing = flushing.then(flush); return flushing; },

  /** Server-owned fields (spins, deals, lock, booking, allowance) change outside the diff: record them as already synced. */
  patchServerFields(fields) {
    if (!cached) return;
    Object.assign(cached.blob, clone(fields));
    Object.assign(cached.synced ?? (cached.synced = clone(cached.blob)), clone(fields));
    writeCache();
  },

  /** Adopt a freshly fetched blob (sign-in, launch). */
  adopt(userId, blob) {
    uid = userId;
    meta = { refCode: blob.refCode || meta.refCode };
    cached = { uid, blob: clone(blob), synced: clone(blob) };
    writeCache();
  },

  /** On launch with a stored session: push edits made offline, then pull the server's view. */
  async boot(userId) {
    uid = userId;
    const c = readCache();
    if (c && c.uid === userId) {
      cached = c;
      if (JSON.stringify(c.blob) !== JSON.stringify(c.synced)) await Promise.race([store.flush(), new Promise((r) => setTimeout(r, 2500))]);
    }
  },

  /** Cached copy for when the server is unreachable at launch. */
  cachedFor(userId) { const c = readCache(); return c && c.uid === userId ? c.blob : null; },

  clear() {
    uid = null; cached = null;
    clearTimeout(timer); clearTimeout(retry);
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  },
};
