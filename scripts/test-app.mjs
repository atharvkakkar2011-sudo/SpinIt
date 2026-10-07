// End-to-end: the real prototype UI (www/) against the real database through PostgREST.
// Starts the dev backend + static servers, drives Chromium, checks the database after each step.
// Needs: PostgreSQL server binaries, POSTGREST_BIN (or `postgrest` on PATH), Playwright + Chromium.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright'))); }
const { existsSync } = await import('node:fs');
const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const procs = [];
const start = (args, env = {}, ready) => new Promise((ok, fail) => {
  const p = spawn('node', args, { cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  procs.push(p);
  const t = setTimeout(() => fail(new Error(`timeout starting ${args.join(' ')}`)), 60000);
  p.stdout.on('data', (d) => { if (String(d).includes(ready)) { clearTimeout(t); ok(p); } });
  p.on('exit', (c) => fail(new Error(`${args.join(' ')} exited ${c}`)));
});
const cleanup = () => procs.forEach((p) => { try { p.kill(); } catch { /* gone */ } });
process.on('exit', cleanup); process.on('SIGINT', () => { cleanup(); process.exit(1); });

execFileSync('node', ['scripts/build-www.mjs'], { cwd: root, env: { ...process.env, SPINIT_SUPABASE_URL: 'http://127.0.0.1:54321', SPINIT_SUPABASE_ANON_KEY: 'dev-anon-key' } });
execFileSync('node', ['scripts/build-web.mjs'], { cwd: root, env: { ...process.env, SPINIT_SUPABASE_URL: 'http://127.0.0.1:54321', SPINIT_SUPABASE_ANON_KEY: 'dev-anon-key' } });
await start(['scripts/dev-backend.mjs'], {}, 'dev backend ready');
await start(['scripts/serve.mjs', 'www', '8096'], {}, 'serving');
await start(['scripts/serve.mjs', 'web-dist', '8095'], {}, 'serving');

const sql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-At', '-c', q]).toString().trim().split('\n').pop();
const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
const open = async () => {
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, geolocation: { latitude: 25.30, longitude: 51.52 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  const click = async (t, exact = true) => { await p.getByText(t, { exact }).first().click({ timeout: 8000 }); await p.waitForTimeout(250); };
  const st = (k) => p.evaluate((k) => window.SpinIt.app.state[k], k);
  return { p, errs, click, st, ctx };
};
let passed = 0;
const step = (name) => { passed++; console.log('  ok  ', name); };

try {
  // ---- app ---------------------------------------------------------------------------------------------
  const email = `e2e${Date.now()}@x.co`;
  const a = await open();
  await a.p.goto('http://127.0.0.1:8096/', { waitUntil: 'networkidle' }); await a.p.waitForTimeout(1200);
  await a.click('Sign up, it’s free');
  await a.p.getByPlaceholder('Your name (or your aura)').fill('Noor'); await a.p.getByPlaceholder('you@whatever.com').fill(email); await a.click('Next');
  await a.p.getByPlaceholder('Make it hard to guess').fill('hunter22!'); await a.click('Next');
  await a.click('Habibti'); await a.click('Yalla, let’s go habibti');
  await a.click('Allow location'); await a.click('Turn on notifications'); await a.click('Chill'); await a.click('Next'); await a.click('Balanced'); await a.click('Build my wheel');
  await a.p.waitForTimeout(800);
  const uid = sql(`select id from auth.users where email='${email}'`);
  assert.equal(sql(`select name||'/'||g||'/'||budget_min||'-'||budget_max from public.profiles where id='${uid}'`), 'Noor/habibti/50-150');
  assert.equal(await a.p.evaluate(() => Object.values(window.SpinIt.app.state.wheel).filter(Boolean).length), 154);
  step('sign-up and setup answers land in profiles; all 154 places start on the wheel');

  await a.p.evaluate(() => { const x = window.SpinIt.app; x.toggleSave(3); x.setState({ wheelName: 'Friday Crew', emoji: '🔥', acc: '#C6FF3D' }); });
  await a.p.waitForTimeout(1500);
  assert.equal(sql(`select place_id from public.saved_places where user_id='${uid}'`), 'souq');
  assert.equal(sql(`select name||'/'||accent from public.wheels where user_id='${uid}'`), 'Friday Crew/#C6FF3D');
  step('saved spots and wheel style sync to the database');

  await a.click('Spin'); await a.click('YALLA SPIN'); await a.p.waitForTimeout(7800);
  const placeId = sql(`select place_id from public.spins where user_id='${uid}'`);
  assert.equal(await a.p.evaluate((i) => window.SpinIt.app.P[i].id, await a.st('result')), placeId);
  assert.equal(await a.st('spinsLeft'), 2);
  step(`the server picks the spin (${placeId}) and the wheel lands on it`);

  await a.click('Yalla, show me the plan');
  await a.click('Reserve a table'); await a.click('Book for', false);
  assert.equal(sql(`select party_size||'/'||status from public.bookings where user_id='${uid}'`), '2/requested');
  await a.click('Lock it in 🔒'); await a.p.waitForTimeout(1000);
  assert.equal(sql(`select place_id from public.night_locks where user_id='${uid}'`), placeId);
  await a.p.evaluate(() => window.SpinIt.app.go('spin')); await a.p.waitForTimeout(300);
  await a.click('YALLA SPIN'); await a.p.waitForTimeout(600);
  assert.match(await a.st('toast'), /locked/i);
  assert.equal(sql(`select count(*) from public.spins where user_id='${uid}'`), '1');
  step('booking request + lock are stored; a locked night refuses spins');

  await a.p.evaluate(() => window.SpinIt.app.go('evening')); await a.p.waitForTimeout(400);
  await a.click('SPIN-ONLY BONUS, W'); await a.p.waitForTimeout(1500);
  const tok = await a.p.evaluate(() => Object.values(window.SpinIt.app.state.qrTokens || {})[0]?.token);
  assert.ok(tok && tok.split('.').length === 3);
  assert.match(sql(`select public.redeem_deal('${tok}','dev-staff')`), /"ok": true/);
  await a.p.waitForTimeout(5000);
  assert.ok(await a.p.evaluate(() => window.SpinIt.app.state.deals.every((d) => d.used)));
  step('signed QR token shown; staff redemption flips the bonus to USED');

  await a.p.evaluate(() => window.SpinIt.app.go('group')); await a.p.waitForTimeout(1500);
  const code = await a.st('squadCode');
  assert.match(code, /^SPIN-\d{4}$/);
  const g = await open();
  await g.p.goto(`http://127.0.0.1:8095/s/${code.slice(5)}`, { waitUntil: 'networkidle' });
  await g.p.fill('#name', 'Omar'); await g.p.getByRole('button', { name: /Romantic/ }).click(); await g.p.waitForTimeout(4200);
  assert.ok((await a.st('squad')).some((m) => m.name === 'Omar' && m.vote === 'Romantic'));
  step('a friend votes from the web page and the host sees it live');

  await a.p.evaluate(() => window.SpinIt.app.go('ai')); await a.p.waitForTimeout(400);
  await a.click('Somewhere chill with good karak'); await a.p.waitForTimeout(1500);
  assert.match((await a.st('aiMsgs')).slice(-1)[0].text, /Katara/);
  step('AI tab answers through the backend function');

  await a.p.evaluate(() => window.SpinIt.store.flush()); await a.p.waitForTimeout(400);
  await a.p.evaluate(() => window.SpinIt.app.go('profile')); await a.click('Log out'); await a.p.waitForTimeout(600);
  assert.equal(await a.p.evaluate(() => localStorage.getItem('spinit-cache-v1')), null);
  const c = await open();
  await c.p.goto('http://127.0.0.1:8096/', { waitUntil: 'networkidle' }); await c.p.waitForTimeout(1200);
  await c.click('I already have an account');
  await c.p.getByPlaceholder('you@whatever.com').fill(email); await c.p.getByPlaceholder('The secret one').fill('hunter22!');
  await c.click('Let me in'); await c.p.waitForTimeout(2500);
  const s = await c.p.evaluate(() => { const x = window.SpinIt.app.state; return { saved: x.saved, wheelName: x.wheelName, spinsLeft: x.spinsLeft, history: x.history.length, booking: x.booking && x.booking.size, locked: !!x.locked, used: x.deals.map((d) => d.used), screen: x.screen }; });
  assert.deepEqual(s, { saved: { 3: true }, wheelName: 'Friday Crew', spinsLeft: 2, history: 1, booking: 2, locked: true, used: [true], screen: 'discover' });
  step('logging in on a fresh device restores everything from the server');

  await c.p.evaluate(() => window.SpinIt.app.go('profile')); await c.click('Log out');
  await c.click('I already have an account');
  await c.p.getByPlaceholder('you@whatever.com').fill(email); await c.p.getByPlaceholder('The secret one').fill('wrong-pass');
  await c.click('Let me in'); await c.p.waitForTimeout(800);
  assert.match(await c.st('authErr'), /Wrong combo/);
  step('a wrong password is refused');

  // ---- web pages ---------------------------------------------------------------------------------------
  const bid = sql(`select id from public.bookings where user_id='${uid}' and status='requested' limit 1`);
  const ctok = sql(`select confirm_token from public.bookings where id='${bid}'`);
  await g.p.goto(`http://127.0.0.1:8095/b/${ctok}`, { waitUntil: 'networkidle' }); await g.p.waitForTimeout(500);
  await g.p.click('#yes'); await g.p.waitForTimeout(800);
  assert.equal(sql(`select status from public.bookings where id='${bid}'`), 'confirmed');
  assert.equal(sql(`select count(*) from public.notification_queue where user_id='${uid}' and kind='booking'`), '1');
  step('the venue confirms from its link; the guest gets a push queued');

  const errs = [...a.errs, ...g.errs, ...c.errs];
  assert.deepEqual(errs, [], errs.join('\n'));
  step('no JavaScript errors on any page');
  console.log(`\n${passed} passed`);
} catch (e) {
  console.error('  FAIL', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  cleanup();
}
