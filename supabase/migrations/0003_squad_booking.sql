-- Spin It backend, part 3: live squad spin and table booking.

-- ---------------------------------------------------------------------------
-- Squad spin. The host creates a squad; friends vote a vibe from the web page with no account.
-- ---------------------------------------------------------------------------
create table public.squads (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  host_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'open' check (status in ('open','spun','closed')),
  result_place_id  text references public.places(id),
  expires_at       timestamptz not null default now() + interval '3 hours',
  created_at       timestamptz not null default now()
);

create table public.squad_members (
  id           uuid primary key default gen_random_uuid(),
  squad_id     uuid not null references public.squads(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  guest_name   text check (char_length(guest_name) between 1 and 24),
  guest_token  text,
  vote         text check (vote in ('Chill','Romantic','Adventurous','Family')),
  joined_at    timestamptz not null default now(),
  voted_at     timestamptz,
  check ((user_id is not null) <> (guest_token is not null)),
  unique (squad_id, user_id),
  unique (squad_id, guest_token)
);

alter table public.squads enable row level security;
alter table public.squad_members enable row level security;
-- The host reads their own squad live (Realtime). Guests never touch tables: they use the functions below.
create policy squads_host on public.squads for select using (host_id = auth.uid());
create policy squad_members_host on public.squad_members for select
  using (exists (select 1 from public.squads s where s.id = squad_id and s.host_id = auth.uid()));
revoke all on public.squads, public.squad_members from anon, authenticated;
grant select on public.squads, public.squad_members to authenticated;

create or replace function public.create_squad(p_vote text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); sq public.squads; c text; tries int := 0; nm text;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  -- one active squad per host: reuse it while it is open
  select * into sq from public.squads where host_id = uid and status = 'open' and expires_at > now() order by created_at desc limit 1;
  if not found then
    loop
      c := 'SPIN-' || lpad((floor(random() * 10000))::int::text, 4, '0');
      exit when not exists (select 1 from public.squads where code = c and expires_at > now());
      tries := tries + 1; if tries > 50 then raise exception 'no_code'; end if;
    end loop;
    delete from public.squads where code = c;           -- clear an expired holder of the same code
    insert into public.squads (code, host_id) values (c, uid) returning * into sq;
    insert into public.squad_members (squad_id, user_id, vote) values (sq.id, uid, p_vote);
    update public.profiles set squad_used = true where id = uid;
  end if;
  return jsonb_build_object('id', sq.id, 'code', sq.code, 'expires_at', sq.expires_at);
end $$;

-- Guests join + vote in one call. Re-calling with the same token changes their vote.
create or replace function public.squad_vote(p_code text, p_guest_name text, p_guest_token text, p_vote text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sq public.squads; m public.squad_members; n int; nm text := left(trim(coalesce(p_guest_name, '')), 24);
begin
  if p_vote is not null and p_vote not in ('Chill','Romantic','Adventurous','Family') then raise exception 'bad_vote'; end if;
  if length(coalesce(p_guest_token, '')) < 16 then raise exception 'bad_token'; end if;
  select * into sq from public.squads where code = upper(p_code) and expires_at > now();
  if not found then raise exception 'no_squad' using errcode = 'P0001'; end if;
  if sq.status <> 'open' then raise exception 'closed' using errcode = 'P0001'; end if;
  select * into m from public.squad_members where squad_id = sq.id and guest_token = p_guest_token;
  if not found then
    if nm = '' then raise exception 'need_name' using errcode = 'P0001'; end if;
    select count(*) into n from public.squad_members where squad_id = sq.id;
    if n >= 30 then raise exception 'full' using errcode = 'P0001'; end if;
    insert into public.squad_members (squad_id, guest_name, guest_token, vote, voted_at)
    values (sq.id, nm, p_guest_token, p_vote, case when p_vote is null then null else now() end);
  else
    update public.squad_members set vote = p_vote, voted_at = now() where id = m.id;
  end if;
  return public.squad_state(p_code);
end $$;

-- Public, name-and-vote-only view for the vote page (no ids, tokens or user data).
create or replace function public.squad_state(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object(
      'status', s.status,
      'expires_at', s.expires_at,
      'result', (select jsonb_build_object('id', p.id, 'short', p.short, 'name', p.name, 'vibe', p.vibe, 'photo', p.photos[1])
                 from public.places p where p.id = s.result_place_id),
      'members', (select coalesce(jsonb_agg(jsonb_build_object(
                    'name', coalesce(m.guest_name, pr.name), 'vote', m.vote, 'host', m.user_id = s.host_id)
                    order by m.joined_at), '[]'::jsonb)
                  from public.squad_members m left join public.profiles pr on pr.id = m.user_id
                  where m.squad_id = s.id)
    ) from public.squads s where s.code = upper(p_code) and s.expires_at > now()
  ), jsonb_build_object('status', 'missing'));
$$;

-- Host changes their own vote.
create or replace function public.squad_host_vote(p_code text, p_vote text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sq public.squads;
begin
  select * into sq from public.squads where code = upper(p_code) and host_id = auth.uid() and expires_at > now();
  if not found then raise exception 'no_squad' using errcode = 'P0001'; end if;
  update public.squad_members set vote = p_vote, voted_at = now() where squad_id = sq.id and user_id = auth.uid();
  return public.squad_state(p_code);
end $$;

-- Majority vibe, ties broken at random. The host then spins with that vibe and records the result.
create or replace function public.squad_tally(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare sq public.squads; win text; counts jsonb;
begin
  select * into sq from public.squads where code = upper(p_code) and host_id = auth.uid() and expires_at > now();
  if not found then raise exception 'no_squad' using errcode = 'P0001'; end if;
  select jsonb_object_agg(vote, c) into counts from (
    select vote, count(*) c from public.squad_members where squad_id = sq.id and vote is not null group by vote) t;
  select vote into win from public.squad_members where squad_id = sq.id and vote is not null
    group by vote order by count(*) desc, random() limit 1;
  return jsonb_build_object('mood', win, 'counts', coalesce(counts, '{}'::jsonb));
end $$;

create or replace function public.squad_finish(p_code text, p_place text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.squads set status = 'spun', result_place_id = p_place
   where code = upper(p_code) and host_id = auth.uid() and expires_at > now() and status = 'open';
  if not found then raise exception 'no_squad' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Bookings. Phase 1: a request goes to the venue, who confirms from a link. Phase 2 adapters
-- (see supabase/functions/_shared/booking-adapters.ts) will fill in real availability.
-- ---------------------------------------------------------------------------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  venue_id      uuid references public.venues(id),
  place_id      text not null references public.places(id),
  food_alt      smallint not null default 0 check (food_alt in (0,1)),
  party_size    smallint not null check (party_size between 1 and 12),
  slot_at       timestamptz not null,
  status        text not null default 'requested' check (status in ('requested','confirmed','declined','cancelled')),
  provider      text not null default 'manual',
  provider_ref  text,
  confirm_token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at    timestamptz not null default now()
);
create index bookings_user on public.bookings (user_id, slot_at desc);
create index bookings_slot on public.bookings (place_id, slot_at);

alter table public.bookings enable row level security;
create policy bookings_own on public.bookings for select using (user_id = auth.uid());
revoke all on public.bookings from anon, authenticated;
grant select (id, user_id, venue_id, place_id, food_alt, party_size, slot_at, status, provider, created_at) on public.bookings to authenticated;

-- '8:00 PM' (today, Doha time) -> timestamptz
create or replace function public.slot_time(p_time text, p_day date default null) returns timestamptz
language plpgsql stable as $$
declare day date := coalesce(p_day, (now() at time zone 'Asia/Qatar')::date); t time := to_timestamp(p_time, 'HH12:MI AM')::time;
begin
  return (day + t) at time zone 'Asia/Qatar';
end $$;

-- Free seats at a venue for one slot.
create or replace function public.slot_seats_left(p_place text, p_slot timestamptz) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select v.slot_capacity from public.venues v where v.place_id = p_place), 40)
       - coalesce((select sum(party_size) from public.bookings b
                   where b.place_id = p_place and b.slot_at = p_slot and b.status in ('requested','confirmed')), 0)::int;
$$;

-- Time grid for the booking sheet: 'Full' when the slot has no seats left.
create or replace function public.booking_availability(p_place text, p_day date default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(t, public.slot_seats_left(p_place, public.slot_time(t, p_day)) < 1), '{}'::jsonb)
  from unnest(array['7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM']) as t;
$$;

create or replace function public.request_booking(p_place text, p_food_alt int, p_size int, p_time text, p_replace uuid default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); slot timestamptz := public.slot_time(p_time); v public.venues; b public.bookings;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_size not between 1 and 12 then raise exception 'bad_size'; end if;
  select * into v from public.venues where place_id = p_place;
  -- replacing an existing booking frees its seats first
  if p_replace is not null then
    update public.bookings set status = 'cancelled' where id = p_replace and user_id = uid and status in ('requested','confirmed');
  end if;
  if public.slot_seats_left(p_place, slot) < p_size then raise exception 'slot_full' using errcode = 'P0001'; end if;
  insert into public.bookings (user_id, venue_id, place_id, food_alt, party_size, slot_at, provider)
  values (uid, v.id, p_place, coalesce(p_food_alt, 0), p_size, slot, coalesce(v.provider, 'manual')) returning * into b;
  return jsonb_build_object('id', b.id, 'status', b.status, 'slot_at', b.slot_at, 'party_size', b.party_size);
end $$;

create or replace function public.cancel_booking(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.bookings set status = 'cancelled' where id = p_id and user_id = auth.uid() and status in ('requested','confirmed');
$$;

create or replace function public.my_booking() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(b) - 'confirm_token' - 'user_id' from public.bookings b
  where b.user_id = auth.uid() and b.status in ('requested','confirmed') and b.slot_at > now() - interval '6 hours'
  order by b.created_at desc limit 1;
$$;

-- Venue taps the link in the WhatsApp/email message: no login, the token is the credential.
create or replace function public.venue_booking_view(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('status', b.status, 'party_size', b.party_size, 'slot_at', b.slot_at,
                            'place', p.name, 'dish', (p.food -> b.food_alt) ->> 'name')
  from public.bookings b join public.places p on p.id = b.place_id where b.confirm_token = p_token;
$$;

create or replace function public.venue_respond(p_token text, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  update public.bookings set status = case when p_accept then 'confirmed' else 'declined' end
   where confirm_token = p_token and status = 'requested' returning * into b;
  if not found then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'status', b.status);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.night_key(timestamptz), public.is_open_at(text, timestamptz), public.open_places(text[], timestamptz),
      public.is_admin(), public.redeem_deal(text, text), public.slot_time(text, date) to anon, authenticated;
-- anonymous web pages
grant execute on function public.squad_vote(text, text, text, text), public.squad_state(text),
      public.venue_booking_view(text), public.venue_respond(text, boolean) to anon, authenticated;
grant execute on function public.spins_left(uuid), public.spin(text, text[], timestamptz), public.rate_spin(uuid, int, boolean),
      public.lock_night(text, uuid), public.unlock_night(), public.my_night(), public.deal_token(text), public.deal_status(text),
      public.delete_my_account(), public.create_squad(text), public.squad_host_vote(text, text), public.squad_tally(text),
      public.squad_finish(text, text), public.slot_seats_left(text, timestamptz), public.booking_availability(text, date),
      public.request_booking(text, int, int, text, uuid), public.cancel_booking(uuid), public.my_booking() to authenticated;
