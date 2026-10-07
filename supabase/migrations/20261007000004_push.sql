-- Spin It backend, part 4: push notifications. Rows are queued here (by triggers, cron or the
-- app) and sent by the `push-dispatch` edge function through FCM, one place for quiet hours,
-- opt-out and dead-token clean-up.

create table public.notification_queue (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}',
  send_at     timestamptz not null default now(),
  dedupe_key  text unique,
  locked_at   timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notification_due on public.notification_queue (send_at) where sent_at is null;
alter table public.notification_queue enable row level security;
revoke all on public.notification_queue from anon, authenticated;

-- 1 AM - 10 AM Doha time is quiet: anything due then goes out at 10:00.
create or replace function public.after_quiet_hours(ts timestamptz) returns timestamptz
language plpgsql immutable as $$
declare local_ts timestamp := ts at time zone 'Asia/Qatar'; h int := extract(hour from local_ts);
begin
  if h >= 1 and h < 10 then
    return (date_trunc('day', local_ts) + interval '10 hours') at time zone 'Asia/Qatar';
  end if;
  return ts;
end $$;

-- Queue a push unless the user turned notifications off. dedupe_key makes retries harmless.
create or replace function public.enqueue_push(p_user uuid, p_kind text, p_title text, p_body text,
                                               p_data jsonb default '{}', p_send_at timestamptz default now(), p_dedupe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select notif from public.profiles where id = p_user), false) then return; end if;
  insert into public.notification_queue (user_id, kind, title, body, data, send_at, dedupe_key)
  values (p_user, p_kind, p_title, p_body, p_data, public.after_quiet_hours(p_send_at), p_dedupe)
  on conflict (dedupe_key) do nothing;
end $$;

create or replace function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  -- a device token belongs to whoever signed in last
  delete from public.push_tokens where token = p_token and user_id <> auth.uid();
  insert into public.push_tokens (user_id, token, platform) values (auth.uid(), p_token, p_platform)
  on conflict (user_id, token) do update set updated_at = now(), platform = excluded.platform;
end $$;

create or replace function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

-- Dispatcher (service role): take due rows and mark them locked so two workers never double-send.
create or replace function public.claim_due_notifications(p_limit int default 100)
returns table (id uuid, user_id uuid, kind text, title text, body text, data jsonb, tokens jsonb)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select q.id from public.notification_queue q
    where q.sent_at is null and q.send_at <= now() and (q.locked_at is null or q.locked_at < now() - interval '5 minutes')
    order by q.send_at limit p_limit for update skip locked
  ), marked as (
    update public.notification_queue q set locked_at = now() from due where q.id = due.id returning q.*
  )
  select m.id, m.user_id, m.kind, m.title, m.body, m.data,
         coalesce((select jsonb_agg(jsonb_build_object('token', t.token, 'platform', t.platform))
                   from public.push_tokens t where t.user_id = m.user_id), '[]'::jsonb)
  from marked m;
end $$;

create or replace function public.finish_notification(p_id uuid, p_dead_tokens text[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.notification_queue set sent_at = now() where id = p_id;
  delete from public.push_tokens where token = any (p_dead_tokens);
end $$;

-- ---- triggers --------------------------------------------------------------------------------
-- Booking confirmed / declined -> user.
create or replace function public._push_booking_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare dish text; t text := to_char(new.slot_at at time zone 'Asia/Qatar', 'FMHH12:MI AM');
begin
  if new.status is not distinct from old.status then return new; end if;
  select (p.food -> new.food_alt) ->> 'name' into dish from public.places p where p.id = new.place_id;
  if new.status = 'confirmed' then
    perform public.enqueue_push(new.user_id, 'booking', 'Table’s locked ✅', coalesce(dish, 'Your table') || ' for ' || t || '. See you there.',
      jsonb_build_object('booking', new.id), now(), 'booking:' || new.id || ':confirmed');
  elsif new.status = 'declined' then
    perform public.enqueue_push(new.user_id, 'booking', 'Table not available', coalesce(dish, 'That spot') || ' can’t fit you at ' || t || '. Try another time.',
      jsonb_build_object('booking', new.id), now(), 'booking:' || new.id || ':declined');
  end if;
  return new;
end $$;
create trigger bookings_push after update of status on public.bookings for each row execute function public._push_booking_change();

-- A friend votes -> host.
create or replace function public._push_squad_vote() returns trigger
language plpgsql security definer set search_path = public as $$
declare sq public.squads;
begin
  if new.user_id is not null or new.vote is null then return new; end if;
  if tg_op = 'UPDATE' and new.vote is not distinct from old.vote then return new; end if;
  select * into sq from public.squads where id = new.squad_id;
  perform public.enqueue_push(sq.host_id, 'squad', new.guest_name || ' just voted ' || new.vote, 'The wheel is listening.',
    jsonb_build_object('squad', sq.code), now(), 'squad:' || new.id || ':' || new.vote);
  return new;
end $$;
create trigger squad_members_push after insert or update of vote on public.squad_members for each row execute function public._push_squad_vote();

-- ---- scheduled jobs (called by pg_cron, see the realtime_cron migration) -----------------------------------------
-- 6 PM Doha: spins refill. Only for people who spun in the last 14 days.
create or replace function public.enqueue_refill_pushes() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in select p.id, p.g from public.profiles p
           where p.notif and exists (select 1 from public.spins s where s.user_id = p.id and s.created_at > now() - interval '14 days')
  loop
    perform public.enqueue_push(r.id, 'refill', 'Spins refilled, ' || case r.g when 'habibi' then 'habibi' when 'habibti' then 'habibti' else 'bestie' end || '. 3 fresh ones 🎡',
      'Tonight’s wheel is loaded.', '{}', now(), 'refill:' || public.night_key() || ':' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- 2 PM next day: "How was X?" for last night's most recent unrated spin.
create or replace function public.enqueue_rate_pushes() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in select distinct on (s.user_id) s.user_id, s.id, p.short
           from public.spins s join public.places p on p.id = s.place_id
           where s.rating is null and not s.skip_rate and s.night_key = public.night_key(now() - interval '1 day')
           order by s.user_id, s.created_at desc
  loop
    perform public.enqueue_push(r.user_id, 'rate', 'How was ' || r.short || '?', 'Rate it, it trains your wheel.',
      jsonb_build_object('spin', r.id), now(), 'rate:' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.night_key(timestamptz), public.is_open_at(text, timestamptz), public.open_places(text[], timestamptz),
      public.is_admin(), public.redeem_deal(text, text), public.slot_time(text, date), public.after_quiet_hours(timestamptz),
      public.squad_vote(text, text, text, text), public.squad_state(text),
      public.venue_booking_view(text), public.venue_respond(text, boolean) to anon, authenticated;
grant execute on function public.spins_left(uuid), public.spin(text, text[], timestamptz), public.rate_spin(uuid, int, boolean),
      public.lock_night(text, uuid), public.unlock_night(), public.my_night(), public.deal_token(text), public.deal_status(text),
      public.delete_my_account(), public.create_squad(text), public.squad_host_vote(text, text), public.squad_tally(text),
      public.squad_finish(text, text), public.slot_seats_left(text, timestamptz), public.booking_availability(text, date),
      public.request_booking(text, int, int, text, uuid), public.cancel_booking(uuid), public.my_booking(),
      public.register_push_token(text, text), public.unregister_push_token(text) to authenticated;
-- service role only (edge functions / cron): enqueue_push, claim_due_notifications, finish_notification,
-- enqueue_refill_pushes, enqueue_rate_pushes
grant execute on function public.enqueue_push(uuid, text, text, text, jsonb, timestamptz, text),
      public.claim_due_notifications(int), public.finish_notification(uuid, text[]),
      public.enqueue_refill_pushes(), public.enqueue_rate_pushes() to service_role;
