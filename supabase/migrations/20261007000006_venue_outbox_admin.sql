-- Spin It backend, part 6: messages to venues (booking requests) and small admin helpers.

-- Every new booking request queues a WhatsApp/email message to the venue; `notify-venues` sends it.
create table public.venue_outbox (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  locked_at   timestamptz,
  sent_at     timestamptz,
  channel     text,
  error       text
);
alter table public.venue_outbox enable row level security;
revoke all on public.venue_outbox from anon, authenticated;

create or replace function public._queue_venue_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.venue_outbox (booking_id) values (new.id);
  return new;
end $$;
create trigger bookings_notify_venue after insert on public.bookings for each row execute function public._queue_venue_message();

-- Dispatcher (service role): due messages with everything needed to write them.
create or replace function public.claim_venue_messages(p_limit int default 20)
returns table (id uuid, booking_id uuid, confirm_token text, party_size int, slot_at timestamptz, dish text, place text,
               venue text, whatsapp text, email text)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select o.id from public.venue_outbox o
    where o.sent_at is null and (o.locked_at is null or o.locked_at < now() - interval '5 minutes')
    order by o.created_at limit p_limit for update skip locked
  ), marked as (update public.venue_outbox o set locked_at = now() from due where o.id = due.id returning o.*)
  select m.id, b.id, b.confirm_token, b.party_size::int, b.slot_at, (p.food -> b.food_alt) ->> 'name', p.name, v.name, v.contact_whatsapp, v.contact_email
  from marked m join public.bookings b on b.id = m.booking_id join public.places p on p.id = b.place_id
  left join public.venues v on v.id = b.venue_id;
end $$;

create or replace function public.finish_venue_message(p_id uuid, p_channel text, p_error text default null) returns void
language sql security definer set search_path = public as $$
  update public.venue_outbox set sent_at = case when p_error is null then now() end, locked_at = case when p_error is null then locked_at end,
         channel = p_channel, error = p_error where id = p_id;
$$;

-- Admin: give a venue its staff key (shown once to the venue; only the hash is kept).
create or replace function public.set_venue_staff_key(p_place text, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'admins only' using errcode = '42501'; end if;
  if length(coalesce(p_key, '')) < 12 then raise exception 'use at least 12 characters'; end if;
  update public.venues set staff_key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex') where place_id = p_place;
end $$;

-- Opening-hours refresh (service role) replaces a place's weekly rows in one go.
create or replace function public.replace_place_hours(p_place text, p_rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.place_hours where place_id = p_place;
  insert into public.place_hours (place_id, weekday, opens, closes, closes_next_day)
  select p_place, (r->>'weekday')::smallint, (r->>'opens')::time, (r->>'closes')::time, coalesce((r->>'closes_next_day')::boolean, false)
  from jsonb_array_elements(p_rows) r
  on conflict do nothing;
end $$;

revoke execute on function public._queue_venue_message(), public.claim_venue_messages(int), public.finish_venue_message(uuid, text, text),
       public.set_venue_staff_key(text, text), public.replace_place_hours(text, jsonb) from public, anon;
grant execute on function public.claim_venue_messages(int), public.finish_venue_message(uuid, text, text),
      public.replace_place_hours(text, jsonb) to service_role;
grant execute on function public.set_venue_staff_key(text, text) to authenticated;

-- Google Places id per place, used by the weekly `refresh-hours` function.
alter table public.places add column if not exists google_place_id text;
