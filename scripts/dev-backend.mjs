// A local stand-in for Supabase so the app can be run and tested without a cloud project:
//   real Postgres (all migrations + seed)  +  PostgREST (the same REST layer Supabase uses)
//   +  a small gateway on :54321 that speaks the parts of GoTrue (auth) the app needs.
// It is for development only: passwords are salted+hashed with scrypt but there is no email, no
// OAuth and no Realtime socket (the app falls back to polling).
//
//   POSTGREST_BIN=/path/to/postgrest node scripts/dev-backend.mjs
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { startCluster } from './lib-pg.mjs';

const GATEWAY_PORT = Number(process.env.PORT || 54321);
const PG_PORT = Number(process.env.PGPORT || 54322);
const REST_PORT = 54323;
const SECRET = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const POSTGREST = process.env.POSTGREST_BIN || 'postgrest';

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const jwt = (claims) => { const h = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}`; return `${h}.${createHmac('sha256', SECRET).update(h).digest('base64url')}`; };
const verify = (t) => {
  const [h, p, s] = String(t || '').split('.');
  if (!s || createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url') !== s) return null;
  const c = JSON.parse(Buffer.from(p, 'base64url').toString());
  return c.exp && c.exp < Date.now() / 1000 ? null : c;
};
const ANON = jwt({ role: 'anon', iss: 'spinit-dev', exp: 4102444800 });

const { db, stop } = await startCluster({ port: PG_PORT });
await db.query(`alter role authenticator password 'dev'; create table if not exists auth.refresh_tokens (token text primary key, user_id uuid not null);`);
// dev staff key so the redeem page works: venue key is "dev-staff"
await db.query(`update public.venues set staff_key_hash = encode(extensions.digest('dev-staff', 'sha256'), 'hex')`);

const rest = spawn(POSTGREST, [], {
  env: { ...process.env, PGRST_DB_URI: `postgres://authenticator:dev@127.0.0.1:${PG_PORT}/postgres`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
         PGRST_JWT_SECRET: SECRET, PGRST_SERVER_PORT: String(REST_PORT), PGRST_SERVER_HOST: '127.0.0.1', PGRST_DB_POOL: '5' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
const shutdown = () => { rest.kill(); stop(); process.exit(0); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown); process.on('exit', () => { rest.kill(); stop(); });

// ---- GoTrue subset ------------------------------------------------------------------------------------------
const hashPw = (pw) => { const salt = randomBytes(16); return `${salt.toString('hex')}:${scryptSync(pw, salt, 32).toString('hex')}`; };
const checkPw = (pw, stored) => { const [s, h] = String(stored || '').split(':'); if (!h) return false; const x = scryptSync(pw, Buffer.from(s, 'hex'), 32); return x.length === Buffer.from(h, 'hex').length && timingSafeEqual(x, Buffer.from(h, 'hex')); };
const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, user_metadata: u.raw_user_meta_data, app_metadata: { provider: 'email' }, created_at: u.created_at });
async function session(u) {
  const refresh = randomBytes(24).toString('hex');
  await db.query('insert into auth.refresh_tokens (token, user_id) values ($1,$2)', [refresh, u.id]);
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: jwt({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp }), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: refresh, user: userJson(u) };
}
const err = (res, status, code, msg) => send(res, status, { code: status, error_code: code, msg, message: msg });
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': '*' };
const send = (res, status, body, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...CORS, ...extra }); res.end(body === undefined ? '' : JSON.stringify(body)); };
const readJson = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });

async function auth(req, res, url) {
  const path = url.pathname.replace('/auth/v1', '');
  const body = req.method === 'POST' ? await readJson(req) : {};
  if (path === '/signup') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return err(res, 422, 'validation_failed', 'Unable to validate email address: invalid format');
    if (String(body.password || '').length < 6) return err(res, 422, 'weak_password', 'Password should be at least 6 characters.');
    if ((await db.query('select 1 from auth.users where email = $1', [email])).rowCount) return err(res, 422, 'user_already_exists', 'User already registered');
    const { rows } = await db.query('insert into auth.users (email, raw_user_meta_data, encrypted_password) values ($1,$2,$3) returning *', [email, body.data || {}, hashPw(body.password)]);
    return send(res, 200, await session(rows[0]));
  }
  if (path === '/token') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const { rows } = await db.query('select * from auth.users where email = $1', [String(body.email || '').trim().toLowerCase()]);
      if (!rows[0] || !checkPw(body.password, rows[0].encrypted_password)) return err(res, 400, 'invalid_credentials', 'Invalid login credentials');
      return send(res, 200, await session(rows[0]));
    }
    if (grant === 'refresh_token') {
      const { rows } = await db.query('delete from auth.refresh_tokens where token = $1 returning user_id', [body.refresh_token]);
      if (!rows[0]) return err(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
      const u = (await db.query('select * from auth.users where id = $1', [rows[0].user_id])).rows[0];
      return send(res, 200, await session(u));
    }
  }
  if (path === '/user') {
    const c = verify((req.headers.authorization || '').replace(/^Bearer /i, ''));
    if (!c || !c.sub) return err(res, 401, 'bad_jwt', 'invalid JWT');
    const u = (await db.query('select * from auth.users where id = $1', [c.sub])).rows[0];
    return u ? send(res, 200, userJson(u)) : err(res, 401, 'user_not_found', 'User not found');
  }
  if (path === '/logout') return send(res, 204);
  if (path === '/recover') return send(res, 200, {});
  return err(res, 404, 'not_found', 'not found');
}

// ---- edge-function stand-ins ------------------------------------------------------------------------------------
function functions(req, res, url) {
  if (url.pathname.endsWith('/ai-chat')) return readJson(req).then((b) => send(res, 200, { text: `Yalla bestie, go Katara. Seaside mezze, then kunafa & karak. (dev backend: ${String(b.prompt || '').length} chars in)` }));
  return err(res, 404, 'not_found', 'function not found');
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'OPTIONS') return send(res, 204);
    if (url.pathname.startsWith('/auth/v1')) return await auth(req, res, url);
    if (url.pathname.startsWith('/functions/v1')) return functions(req, res, url);
    if (url.pathname.startsWith('/rest/v1')) {
      const headers = { ...req.headers, host: `127.0.0.1:${REST_PORT}` };
      const bearer = (headers.authorization || '').replace(/^Bearer /i, '');
      headers.authorization = `Bearer ${verify(bearer) ? bearer : ANON}`; // the public "anon key" maps to the anon role
      delete headers['content-length'];
      const chunks = []; req.on('data', (c) => chunks.push(c));
      return req.on('end', () => {
        const body = Buffer.concat(chunks);
        const p = httpRequest({ host: '127.0.0.1', port: REST_PORT, method: req.method, path: url.pathname.replace('/rest/v1', '') + url.search, headers: { ...headers, 'content-length': body.length } }, (r) => {
          res.writeHead(r.statusCode, { ...r.headers, ...CORS }); r.pipe(res);
        });
        p.on('error', (e) => err(res, 502, 'bad_gateway', e.message));
        p.end(body);
      });
    }
    return err(res, 404, 'not_found', 'not found');
  } catch (e) { console.error(e); return err(res, 500, 'unexpected', String(e.message || e)); }
}).listen(GATEWAY_PORT, '127.0.0.1', () => {
  console.log(`dev backend ready: http://127.0.0.1:${GATEWAY_PORT}  (Postgres :${PG_PORT}, staff key for every venue: dev-staff)`);
  console.log(`build the app against it with: SPINIT_SUPABASE_URL=http://127.0.0.1:${GATEWAY_PORT} SPINIT_SUPABASE_ANON_KEY=dev-anon-key npm run build:www`);
});
