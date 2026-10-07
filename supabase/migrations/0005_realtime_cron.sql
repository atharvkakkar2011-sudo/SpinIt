-- Spin It backend, part 5: Realtime and scheduled jobs. Both extensions exist on Supabase;
-- the guards keep this migration runnable on plain Postgres for tests.

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.squad_members, public.squads, public.bookings;
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    -- times are UTC; Doha is UTC+3
    perform cron.schedule('spinit-refill-pushes', '0 15 * * *', 'select public.enqueue_refill_pushes()');   -- 18:00 Doha
    perform cron.schedule('spinit-rate-pushes',   '0 11 * * *', 'select public.enqueue_rate_pushes()');     -- 14:00 Doha
    perform cron.schedule('spinit-purge-squads',  '15 * * * *', $q$delete from public.squads where expires_at < now() - interval '1 day'$q$);
    perform cron.schedule('spinit-purge-queue',   '30 3 * * *', $q$delete from public.notification_queue where sent_at < now() - interval '30 days'$q$);
  end if;
end $$;
-- The dispatcher (every minute) and weekly opening-hours refresh call edge functions over HTTP;
-- schedule them from the dashboard (Edge Functions > Schedules) so the project URL and keys stay out of SQL.
