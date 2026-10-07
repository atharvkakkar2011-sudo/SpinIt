import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { env } from './http.ts';

/** Service-role client: bypasses RLS. Only for server work (queues, cron jobs). */
export const admin = (): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

/** Client acting as the caller (their JWT), so RLS applies. */
export const asCaller = (req: Request): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

/** Scheduled functions are called by pg_cron / the dashboard with this shared secret. */
export function isCron(req: Request): boolean {
  const want = Deno.env.get('CRON_SECRET');
  return !!want && req.headers.get('x-cron-secret') === want;
}
