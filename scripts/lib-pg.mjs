// A throwaway PostgreSQL cluster with the bits of Supabase the migrations rely on
// (roles, auth.users, auth.uid(), pgcrypto in `extensions`). Used by the database tests and by the
// local dev backend. Needs the PostgreSQL server binaries (apt install postgresql-16).
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function findBin() {
  for (const v of [16, 17, 15, 14]) {
    const d = `/usr/lib/postgresql/${v}/bin`;
    try { readdirSync(d); return d; } catch { /* next */ }
  }
  throw new Error('PostgreSQL server binaries not found (apt install postgresql-16)');
}

const mode = (p) => parseInt(execFileSync('stat', ['-c', '%a', p]).toString().trim(), 8);

export async function startCluster({ port = 54329, withSeed = true } = {}) {
  const BIN = findBin();
  const dir = mkdtempSync(join(tmpdir(), 'spinit-pg-'));
  // the postgres user must be able to reach the data directory
  for (let p = dir; p !== '/' && p !== dirname(p); p = dirname(p)) { try { chmodSync(p, mode(p) | 0o001); } catch { /* not ours */ } }
  chmodSync(dir, 0o777);

  const asPg = (cmd, args) => {
    const r = process.getuid?.() === 0 ? spawnSync('runuser', ['-u', 'postgres', '--', cmd, ...args], { encoding: 'utf8' }) : spawnSync(cmd, args, { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${cmd} failed:\n${r.stdout}\n${r.stderr}`);
  };
  const data = join(dir, 'data');
  asPg(`${BIN}/initdb`, ['-D', data, '-A', 'trust', '-U', 'postgres']);
  asPg(`${BIN}/pg_ctl`, ['-D', data, '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1`, '-l', join(dir, 'log'), '-w', 'start']);
  let stopped = false;
  const stop = () => {
    if (stopped) return; stopped = true;
    try { asPg(`${BIN}/pg_ctl`, ['-D', data, '-m', 'immediate', 'stop']); } catch { /* already down */ }
    rmSync(dir, { recursive: true, force: true });
  };

  const db = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' });
  await db.connect();
  await db.query(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create role authenticator noinherit login; grant anon, authenticated, service_role to authenticator;
    create schema extensions; create extension pgcrypto schema extensions;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb not null default '{}',
                             encrypted_password text, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
    grant usage on schema public, extensions, auth to anon, authenticated, service_role;
  `);
  for (const f of readdirSync(join(root, 'supabase/migrations')).sort()) {
    const sql = readFileSync(join(root, 'supabase/migrations', f), 'utf8');
    await db.query(sql).catch((e) => {
      throw new Error(`${f}: ${e.message}${e.position ? ' near: ' + JSON.stringify(sql.slice(Math.max(0, e.position - 80), Number(e.position) + 40)) : ''}`);
    });
  }
  if (withSeed) await db.query(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
  await db.query('grant usage on schema public to anon, authenticated, service_role');
  return { db, stop, port, dir };
}
