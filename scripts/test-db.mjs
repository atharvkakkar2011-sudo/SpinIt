import assert from 'node:assert/strict';
import { startCluster } from './lib-pg.mjs';

const { db, stop } = await startCluster({ port: 54329 });
process.on('exit', stop);

// --- helpers --------------------------------------------------------------------------------------
const as = async (uid, fn, role = 'authenticated') => {
  await db.query('begin');
  try {
    await db.query(`set local role ${role}`);
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [uid ? JSON.stringify({ sub: uid, role }) : '']);
    const r = await fn((sql, args) => db.query(sql, args));
    await db.query('commit');
    return r;
  } catch (e) { await db.query('rollback'); throw e; }
};
const rejects = async (promise, re) => { try { await promise; } catch (e) { assert.match(e.message, re); return; } assert.fail(`expected rejection matching ${re}`); };
const newUser = async (name, meta = {}) => (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1,$2) returning id`, [`${name}@x.co`, { name, ...meta }])).rows[0].id;
const rpc = (q, name, args = []) => q(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) as r`, args).then((r) => r.rows[0].r);
// Doha wall-clock (UTC+3) -> timestamptz literal
const doha = (iso) => new Date(new Date(iso + 'Z').getTime() - 3 * 3600e3).toISOString();

let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ', name); } catch (e) { console.error('  FAIL', name, '\n', e); process.exitCode = 1; } };

// --- tests ----------------------------------------------------------------------------------------
await test('seed: places, deals, venues, hours, events', async () => {
  const c = async (t) => Number((await db.query(`select count(*) from public.${t}`)).rows[0].count);
  assert.equal(await c('places'), 154); assert.equal(await c('deals'), 154); assert.equal(await c('venues'), 154);
  assert.ok((await c('place_hours')) > 50); assert.equal(await c('events'), 6); assert.equal(await c('local_picks'), 3);
});

await test('sign-up creates a profile and wheel from metadata', async () => {
  const id = await newUser('noor', { name: 'Noor', g: 'habibti' });
  const r = await db.query('select p.name, p.g, p.limit_on, w.name as wheel from public.profiles p join public.wheels w on w.user_id = p.id where p.id = $1', [id]);
  assert.deepEqual(r.rows[0], { name: 'Noor', g: 'habibti', limit_on: true, wheel: 'Night Shift' });
});

await test('row-level security: users only see and change their own rows', async () => {
  const a = await newUser('a'), b = await newUser('b');
  await as(a, (q) => q(`insert into public.saved_places (user_id, place_id) values ($1,'katara')`, [a]));
  assert.equal((await as(b, (q) => q('select * from public.saved_places'))).rowCount, 0);
  assert.equal((await as(b, (q) => q('select * from public.profiles'))).rowCount, 1);
  await rejects(as(b, (q) => q(`insert into public.saved_places (user_id, place_id) values ($1,'souq')`, [a])), /row-level security/);
  await rejects(as(a, (q) => q('update public.profiles set bonus_spins = 99 where id = $1', [a])), /permission denied/);
  await rejects(as(a, (q) => q(`insert into public.spins (user_id, place_id, mode, night_key) values ($1,'katara','place', current_date)`, [a])), /permission denied/);
  await rejects(as(null, (q) => q('select * from public.profiles'), 'anon'), /permission denied/);
  assert.equal((await as(null, (q) => q('select * from public.places'), 'anon')).rowCount, 154);
});

await test('spin: 3 a night, 4th refused, bonus spin extends, results stay inside the candidates', async () => {
  const u = await newUser('spinner');
  const cand = ['katara', 'souq', 'corniche'];
  for (let i = 0; i < 3; i++) {
    const r = await as(u, (q) => rpc(q, 'spin', ['place', cand]));
    assert.ok(cand.includes(r.place_id)); assert.equal(r.spins_left, 2 - i);
  }
  await rejects(as(u, (q) => rpc(q, 'spin', ['place', cand])), /out_of_spins/);
  await db.query('update public.profiles set bonus_spins = 1 where id = $1', [u]);
  const r = await as(u, (q) => rpc(q, 'spin', ['place', cand]));
  assert.equal(r.spins_left, 0);
  await rejects(as(u, (q) => rpc(q, 'spin', ['place', cand])), /out_of_spins/);
  // a new night resets the allowance
  await db.query(`update public.spins set night_key = night_key - 1 where user_id = $1`, [u]);
  assert.equal((await as(u, (q) => rpc(q, 'spin', ['place', cand]))).spins_left, 2);
  // limit switched off by the user
  await db.query('update public.profiles set limit_on = false where id = $1', [u]);
  for (let i = 0; i < 5; i++) await as(u, (q) => rpc(q, 'spin', ['place', cand]));
  assert.equal(Number((await db.query('select count(*) from public.user_deals where user_id = $1', [u])).rows[0].count), cand.length > 0 ? new Set((await db.query('select place_id from public.spins where user_id = $1', [u])).rows.map((x) => x.place_id)).size : 0);
});

await test('spin: night rolls over at 6 PM Doha time', async () => {
  const k = async (iso) => (await db.query('select public.night_key($1::timestamptz) as k', [doha(iso)])).rows[0].k.toISOString().slice(0, 10);
  assert.equal(await k('2026-10-07T17:59:00'), '2026-10-06');
  assert.equal(await k('2026-10-07T18:00:00'), '2026-10-07');
  assert.equal(await k('2026-10-08T02:00:00'), '2026-10-07');
});

await test('spin: locked night refuses, unlock restores; unsigned callers refused', async () => {
  const u = await newUser('locker');
  await as(u, (q) => rpc(q, 'lock_night', ['souq']));
  await rejects(as(u, (q) => rpc(q, 'spin', ['place', ['katara', 'souq']])), /locked/);
  assert.equal((await as(u, (q) => rpc(q, 'my_night'))).locked.place_id, 'souq');
  await as(u, (q) => rpc(q, 'unlock_night'));
  await as(u, (q) => rpc(q, 'spin', ['place', ['katara', 'souq']]));
  await rejects(as(null, (q) => rpc(q, 'spin', ['place', ['katara']]), 'anon'), /permission denied/);
});

await test('opening hours: weekly windows, past-midnight windows, exceptions, unknown = open', async () => {
  const open = async (id, iso) => (await db.query('select public.is_open_at($1, $2::timestamptz) as o', [id, doha(iso)])).rows[0].o;
  await db.query(`insert into public.places (id,name,short) values ('t-late','Late','Late')`);
  // Fridays 18:00 -> 02:00 next day
  await db.query(`insert into public.place_hours values ('t-late', 5, '18:00', '02:00', true)`);
  assert.equal(await open('t-late', '2026-10-09T17:00:00'), false); // Fri 5 PM
  assert.equal(await open('t-late', '2026-10-09T19:00:00'), true);  // Fri 7 PM
  assert.equal(await open('t-late', '2026-10-10T01:00:00'), true);  // Sat 1 AM, still Friday's window
  assert.equal(await open('t-late', '2026-10-10T03:00:00'), false); // Sat 3 AM
  assert.equal(await open('t-late', '2026-10-08T19:00:00'), false); // Thu 7 PM, no hours that day
  // exception: closed Friday for Eid
  await db.query(`insert into public.place_exceptions (place_id, date, closed, note) values ('t-late', '2026-10-09', true, 'Eid')`);
  assert.equal(await open('t-late', '2026-10-09T19:00:00'), false);
  // exception with special hours
  await db.query(`insert into public.place_exceptions (place_id, date, opens, closes) values ('t-late', '2026-10-08', '20:00', '23:00')`);
  assert.equal(await open('t-late', '2026-10-08T21:00:00'), true);
  // no hours rows at all: treated as open
  assert.equal(await open('katara', '2026-10-09T04:00:00'), true);
  // 24h park from the spreadsheet
  assert.equal(await open('aspire-park', '2026-10-09T04:00:00'), true);
  // oxygen-park: Daily 6 AM-10 PM
  assert.equal(await open('oxygen-park', '2026-10-09T05:00:00'), false);
  assert.equal(await open('oxygen-park', '2026-10-09T12:00:00'), true);
});

await test('spin: closed places are never picked', async () => {
  const u = await newUser('hours');
  await db.query(`insert into public.place_exceptions (place_id, date, closed) values ('katara', (now() at time zone 'Asia/Qatar')::date, true)`);
  await rejects(as(u, (q) => rpc(q, 'spin', ['place', ['katara']])), /none_open/);
  for (let i = 0; i < 3; i++) assert.equal((await as(u, (q) => rpc(q, 'spin', ['place', ['katara', 'souq']]))).place_id, 'souq');
  const open = await as(u, (q) => rpc(q, 'open_places', [['katara', 'souq']]));
  assert.deepEqual(open, ['souq']);
  await db.query(`delete from public.place_exceptions where place_id = 'katara'`);
});

await test('deals: signed QR token, staff redemption, replay/forgery/expiry refused', async () => {
  const u = await newUser('deals');
  await rejects(as(u, (q) => rpc(q, 'deal_token', ['souq'])), /not_unlocked/);
  await as(u, (q) => rpc(q, 'spin', ['place', ['souq']]));
  const t = await as(u, (q) => rpc(q, 'deal_token', ['souq']));
  assert.ok(t.token.length <= 32, `token too long for a version-2 QR code: ${t.token.length}`);
  assert.equal((await as(u, (q) => rpc(q, 'deal_token', ['souq']))).token, t.token); // stable
  const staff = async (token, key) => (await as(null, (q) => rpc(q, 'redeem_deal', [token, key]), 'anon'));
  await db.query(`update public.venues set staff_key_hash = encode(extensions.digest('souq-staff', 'sha256'), 'hex') where place_id = 'souq'`);
  assert.equal((await staff(t.token, 'wrong')).reason, 'wrong_venue');
  assert.equal((await staff(t.token.slice(0, -1) + (t.token.endsWith('0') ? '1' : '0'), 'souq-staff')).reason, 'bad_signature');
  assert.equal((await staff('garbage', 'souq-staff')).reason, 'malformed');
  assert.equal((await as(u, (q) => rpc(q, 'deal_status', ['souq']))).redeemed_at, null);
  assert.equal((await staff(t.token, 'souq-staff')).ok, true);
  assert.equal((await staff(t.token, 'souq-staff')).reason, 'already_used');
  assert.ok((await as(u, (q) => rpc(q, 'deal_status', ['souq']))).redeemed_at);
  // expiry: 3 hours after unlock
  const u2 = await newUser('deals2');
  await as(u2, (q) => rpc(q, 'spin', ['place', ['souq']]));
  const t2 = await as(u2, (q) => rpc(q, 'deal_token', ['souq']));
  await db.query(`update public.user_deals set unlocked_at = now() - interval '4 hours' where user_id = $1`, [u2]);
  // the token minted earlier still carries its own expiry; mint a fresh stale one
  await db.query(`update public.user_deals set qr_token = null where user_id = $1`, [u2]);
  const t3 = await as(u2, (q) => rpc(q, 'deal_token', ['souq']));
  assert.equal((await staff(t3.token, 'souq-staff')).reason, 'expired');
  assert.ok(t2.token);
});

await test('squad: host + guests vote, majority wins, host is notified, closed squads refuse votes', async () => {
  const host = await newUser('host', { name: 'Atharv' });
  const sq = await as(host, (q) => rpc(q, 'create_squad', ['Chill']));
  assert.match(sq.code, /^SPIN-\d{4}$/);
  assert.equal((await as(host, (q) => rpc(q, 'create_squad', ['Chill']))).code, sq.code); // reused while open
  const guest = async (n, tok, vote) => as(null, (q) => rpc(q, 'squad_vote', [sq.code.toLowerCase(), n, tok, vote]), 'anon');
  await guest('Noor', 'a'.repeat(20), 'Romantic');
  await guest('Omar', 'b'.repeat(20), 'Chill');
  let st = await guest('Lulwa', 'c'.repeat(20), 'Romantic');
  assert.equal(st.members.length, 4);
  assert.deepEqual(st.members.map((m) => m.name), ['Atharv', 'Noor', 'Omar', 'Lulwa']);
  st = await guest('', 'c'.repeat(20), 'Adventurous'); // same token changes the vote
  assert.equal(st.members.find((m) => m.name === 'Lulwa').vote, 'Adventurous');
  await rejects(guest('', 'd'.repeat(20), 'Chill'), /need_name/);
  await rejects(guest('X', 'short', 'Chill'), /bad_token/);
  await rejects(guest('X', 'e'.repeat(20), 'Nope'), /bad_vote/);
  await guest('Lulwa', 'c'.repeat(20), 'Chill');
  const tally = await as(host, (q) => rpc(q, 'squad_tally', [sq.code]));
  assert.equal(tally.mood, 'Chill'); assert.equal(tally.counts.Chill, 3);
  assert.ok((await db.query(`select 1 from public.notification_queue where user_id = $1 and kind = 'squad'`, [host])).rowCount >= 3);
  // outsiders cannot read or finish someone else's squad
  const other = await newUser('other');
  await rejects(as(other, (q) => rpc(q, 'squad_tally', [sq.code])), /no_squad/);
  assert.equal((await as(other, (q) => q('select * from public.squad_members'))).rowCount, 0);
  await as(host, (q) => rpc(q, 'squad_finish', [sq.code, 'souq']));
  assert.equal((await as(null, (q) => rpc(q, 'squad_state', [sq.code]), 'anon')).result.id, 'souq');
  await rejects(guest('Late', 'f'.repeat(20), 'Chill'), /closed/);
  assert.equal((await as(null, (q) => rpc(q, 'squad_state', ['SPIN-0000']), 'anon')).status, 'missing');
});

await test('booking: availability, capacity, venue confirms by link, user is notified, cancel', async () => {
  const u = await newUser('diner'), u2 = await newUser('diner2');
  await db.query(`update public.venues set slot_capacity = 4 where place_id = 'lusail'`);
  const b = await as(u, (q) => rpc(q, 'request_booking', ['lusail', 1, 3, '8:00 PM']));
  assert.equal(b.status, 'requested');
  assert.equal((await as(u, (q) => rpc(q, 'booking_availability', ['lusail'])))['8:00 PM'], false);
  await rejects(as(u2, (q) => rpc(q, 'request_booking', ['lusail', 0, 2, '8:00 PM'])), /slot_full/);
  const fits = await as(u2, (q) => rpc(q, 'request_booking', ['lusail', 0, 1, '8:00 PM']));
  assert.equal((await as(u2, (q) => rpc(q, 'booking_availability', ['lusail'])))['8:00 PM'], true);
  assert.equal((await as(u, (q) => rpc(q, 'my_booking'))).party_size, 3);
  const tok = (await db.query('select confirm_token from public.bookings where id = $1', [b.id])).rows[0].confirm_token;
  assert.equal((await as(null, (q) => rpc(q, 'venue_booking_view', [tok]), 'anon')).party_size, 3);
  assert.equal((await as(null, (q) => rpc(q, 'venue_respond', [tok, true]), 'anon')).status, 'confirmed');
  assert.equal((await as(null, (q) => rpc(q, 'venue_respond', [tok, false]), 'anon')).ok, false); // one answer only
  const n = await db.query(`select title from public.notification_queue where user_id = $1 and kind = 'booking'`, [u]);
  assert.equal(n.rowCount, 1); assert.match(n.rows[0].title, /locked/);
  await rejects(as(u2, (q) => q('select confirm_token from public.bookings')), /permission denied/); // token never readable by users
  assert.equal((await as(u2, (q) => q('select id from public.bookings'))).rowCount, 1);            // only their own row
  await as(u2, (q) => rpc(q, 'cancel_booking', [fits.id]));
  assert.equal((await as(u2, (q) => rpc(q, 'my_booking'))), null);
  // changing a booking frees the old seats first
  const moved = await as(u, (q) => rpc(q, 'request_booking', ['lusail', 1, 4, '8:00 PM', b.id]));
  assert.equal(moved.party_size, 4);
});

await test('push: opt-out, quiet hours, dedupe, claim/finish, token handover', async () => {
  const u = await newUser('pushy');
  const q1 = (sql, a) => db.query(sql, a);
  await q1('update public.profiles set notif = false where id = $1', [u]);
  await q1(`select public.enqueue_push($1,'x','t','b')`, [u]);
  assert.equal((await q1('select 1 from public.notification_queue where user_id = $1', [u])).rowCount, 0);
  await q1('update public.profiles set notif = true where id = $1', [u]);
  const q = (iso) => q1(`select public.after_quiet_hours($1::timestamptz) as t`, [doha(iso)]).then((r) => r.rows[0].t.toISOString());
  assert.equal(await q('2026-10-07T03:00:00'), doha('2026-10-07T10:00:00'));
  assert.equal(await q('2026-10-07T00:30:00'), doha('2026-10-07T00:30:00'));
  assert.equal(await q('2026-10-07T10:00:00'), doha('2026-10-07T10:00:00'));
  assert.equal(await q('2026-10-07T20:00:00'), doha('2026-10-07T20:00:00'));
  await q1(`select public.enqueue_push($1,'x','Hi','There','{}', now() - interval '1 minute', 'dup')`, [u]);
  await q1(`select public.enqueue_push($1,'x','Hi','There','{}', now() - interval '1 minute', 'dup')`, [u]);
  assert.equal((await q1(`select 1 from public.notification_queue where dedupe_key = 'dup'`)).rowCount, 1);
  await as(u, (q) => rpc(q, 'register_push_token', ['tok-1', 'android']));
  const u2 = await newUser('pushy2');
  await as(u2, (q) => rpc(q, 'register_push_token', ['tok-1', 'ios'])); // device changed hands
  await as(u, (q) => rpc(q, 'register_push_token', ['tok-2', 'ios']));
  const claimed = (await as(null, (q) => q('select * from public.claim_due_notifications(10)'), 'service_role')).rows.filter((r) => r.user_id === u);
  assert.equal(claimed.length, 1); assert.deepEqual(claimed[0].tokens.map((t) => t.token), ['tok-2']);
  await as(null, (q) => q('select public.finish_notification($1, $2)', [claimed[0].id, ['tok-2']]), 'service_role');
  assert.equal((await q1('select 1 from public.push_tokens where user_id = $1', [u])).rowCount, 0);
  assert.equal((await as(null, (q) => q('select * from public.claim_due_notifications(10)'), 'service_role')).rows.filter((r) => r.user_id === u).length, 0);
  await rejects(as(u, (q) => q(`select public.enqueue_push($1,'x','a','b')`, [u])), /permission denied/);
});

await test('push: refill + rate reminders target the right people once', async () => {
  const u = await newUser('active'), idle = await newUser('idle');
  await as(u, (q) => rpc(q, 'spin', ['place', ['katara']]));
  assert.equal((await db.query('select public.enqueue_refill_pushes() as n')).rows[0].n >= 1, true);
  assert.equal((await db.query('select 1 from public.notification_queue where user_id = $1 and kind = $2', [u, 'refill'])).rowCount, 1);
  assert.equal((await db.query('select 1 from public.notification_queue where user_id = $1 and kind = $2', [idle, 'refill'])).rowCount, 0);
  await db.query('select public.enqueue_refill_pushes()'); // same night: no duplicate
  assert.equal((await db.query('select 1 from public.notification_queue where user_id = $1 and kind = $2', [u, 'refill'])).rowCount, 1);
  await db.query(`update public.spins set night_key = night_key - 1 where user_id = $1`, [u]);
  await db.query('select public.enqueue_rate_pushes()');
  assert.equal((await db.query('select 1 from public.notification_queue where user_id = $1 and kind = $2', [u, 'rate'])).rowCount, 1);
});

await test('account deletion removes everything the user owns', async () => {
  const u = await newUser('gone');
  await as(u, (q) => rpc(q, 'spin', ['place', ['souq']]));
  await as(u, (q) => q(`insert into public.evenings (user_id, place_id) values ($1,'souq')`, [u]));
  await as(u, (q) => rpc(q, 'delete_my_account'));
  for (const t of ['profiles', 'wheels', 'spins', 'user_deals', 'evenings']) {
    assert.equal((await db.query(`select 1 from public.${t} where ${t === 'profiles' ? 'id' : 'user_id'} = $1`, [u])).rowCount, 0, t);
  }
});

await test('referral: both sides earn a spin when a friend signs up with a code', async () => {
  const a = await newUser('referrer');
  const code = (await db.query('select ref_code from public.profiles where id = $1', [a])).rows[0].ref_code;
  const b = await newUser('friend', { ref: code.toLowerCase() });
  const bonus = async (id) => (await db.query('select bonus_spins from public.profiles where id = $1', [id])).rows[0].bonus_spins;
  assert.equal(await bonus(a), 1); assert.equal(await bonus(b), 1);
  await newUser('nobody', { ref: 'ZZZZZZ' });
});

await test('venues: a booking queues one message to the venue; admin sets staff keys', async () => {
  const u = await newUser('outbox');
  await db.query(`update public.venues set contact_whatsapp = '+97455500000' where place_id = 'pearl'`);
  const b = await as(u, (q) => rpc(q, 'request_booking', ['pearl', 0, 2, '9:30 PM']));
  const claimed = (await as(null, (q) => q('select * from public.claim_venue_messages(10)'), 'service_role')).rows.filter((r) => r.booking_id === b.id);
  assert.equal(claimed.length, 1); assert.equal(claimed[0].whatsapp, '+97455500000'); assert.equal(claimed[0].party_size, 2);
  assert.ok(claimed[0].confirm_token.length >= 32);
  await as(null, (q) => q('select public.finish_venue_message($1, $2)', [claimed[0].id, 'whatsapp']), 'service_role');
  assert.equal((await as(null, (q) => q('select * from public.claim_venue_messages(10)'), 'service_role')).rows.filter((r) => r.booking_id === b.id).length, 0);
  await rejects(as(u, (q) => q('select * from public.claim_venue_messages(10)')), /permission denied/);
  await rejects(as(u, (q) => rpc(q, 'set_venue_staff_key', ['pearl', 'a-long-staff-key'])), /admins only/);
  await db.query('insert into public.admins values ($1)', [u]);
  await as(u, (q) => rpc(q, 'set_venue_staff_key', ['pearl', 'a-long-staff-key']));
  assert.equal((await db.query(`select staff_key_hash = encode(extensions.digest('a-long-staff-key','sha256'),'hex') as ok from public.venues where place_id='pearl'`)).rows[0].ok, true);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
await db.end();
