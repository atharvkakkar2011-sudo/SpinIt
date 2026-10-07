-- Spin It backend, part 2: nights, opening hours, the server-side spin, ratings, locks, bonuses.

-- ---------------------------------------------------------------------------
-- Time. A "night" rolls over at 6 PM Doha time (Asia/Qatar, UTC+3, no DST).
-- ---------------------------------------------------------------------------
create or replace function public.night_key(ts timestamptz default now()) returns date
language sql immutable as $$
  select ((ts at time zone 'Asia/Qatar') - interval '18 hours')::date;
$$;

-- Is the place open at `ts`? Places with no hours rows are treated as open (unknown, not closed).
-- Exceptions (Ramadan, Eid, events) override the weekly schedule for that calendar date.
create or replace function public.is_open_at(p_place text, ts timestamptz default now()) returns boolean
language plpgsql stable set search_path = public as $$
declare
  local_ts   timestamp := ts at time zone 'Asia/Qatar';
  d          date := local_ts::date;
  t          time := local_ts::time;
  ex         public.place_exceptions;
  dow        smallint := extract(dow from d)::smallint;
  prev_dow   smallint := extract(dow from d - 1)::smallint;
begin
  select * into ex from public.place_exceptions where place_id = p_place and date = d;
  if found then
    if ex.closed then return false; end if;
    if ex.opens is not null and ex.closes is not null then
      return case when ex.closes > ex.opens then t >= ex.opens and t < ex.closes
                  else t >= ex.opens or t < ex.closes end;
    end if;
  end if;
  if not exists (select 1 from public.place_hours where place_id = p_place) then return true; end if;
  return exists (
    select 1 from public.place_hours h
    where h.place_id = p_place and (
      -- today's window
      (h.weekday = dow and (case when h.closes_next_day then t >= h.opens
                                 when h.closes = h.opens then true            -- 24h
                                 else t >= h.opens and t < h.closes end))
      -- yesterday's window that runs past midnight
      or (h.weekday = prev_dow and h.closes_next_day and t < h.closes)
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Allowance. 3 spins per night while the limit is on, plus earned bonus spins.
-- ---------------------------------------------------------------------------
create or replace function public.spins_left(p_user uuid default auth.uid()) returns int
language sql stable security definer set search_path = public as $$
  select case when not p.limit_on then 3
              else greatest(0, 3 - (select count(*) from public.spins s
                                    where s.user_id = p.id and s.night_key = public.night_key()))::int + p.bonus_spins
         end
  from public.profiles p where p.id = p_user;
$$;

-- The one place a spin is decided. The client animates to what this returns, so reinstalling
-- or editing local storage cannot earn extra spins.
create or replace function public.spin(p_mode text, p_candidates text[], p_arrive timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  uid     uuid := auth.uid();
  prof    public.profiles;
  nk      date := public.night_key();
  used    int;
  pick    text;
  new_id  uuid;
  d       public.deals;
  arrive  timestamptz := coalesce(p_arrive, now());
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_mode not in ('place','food','dessert') then raise exception 'bad_mode'; end if;
  select * into prof from public.profiles where id = uid for update;
  if not found then raise exception 'no_profile'; end if;

  if exists (select 1 from public.night_locks where user_id = uid and night_key = nk) then
    raise exception 'locked' using errcode = 'P0001';
  end if;

  select count(*) into used from public.spins where user_id = uid and night_key = nk;
  if prof.limit_on and used >= 3 then
    if prof.bonus_spins > 0 then
      update public.profiles set bonus_spins = bonus_spins - 1 where id = uid;
    else
      raise exception 'out_of_spins' using errcode = 'P0001';
    end if;
  end if;

  select p.id into pick
  from public.places p
  where p.id = any (coalesce(p_candidates, '{}')) and p.active and public.is_open_at(p.id, arrive)
  order by random() limit 1;
  if pick is null then raise exception 'none_open' using errcode = 'P0001'; end if;

  insert into public.spins (user_id, place_id, mode, night_key) values (uid, pick, p_mode, nk) returning id into new_id;

  select * into d from public.deals where place_id = pick and active order by code limit 1;
  if found then
    insert into public.user_deals (user_id, deal_id) values (uid, d.id) on conflict (user_id, deal_id) do nothing;
  end if;

  return jsonb_build_object('place_id', pick, 'spin_id', new_id, 'at', now(), 'spins_left', public.spins_left(uid));
end $$;

create or replace function public.rate_spin(p_spin uuid, p_rating int, p_skip boolean default false) returns void
language sql security definer set search_path = public as $$
  update public.spins
     set rating = case when p_rating between 1 and 5 then p_rating else rating end,
         skip_rate = p_skip or skip_rate
   where id = p_spin and user_id = auth.uid();
$$;

create or replace function public.lock_night(p_place text, p_booking uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  insert into public.night_locks (user_id, night_key, place_id, booking_id)
  values (auth.uid(), public.night_key(), p_place, p_booking)
  on conflict (user_id, night_key) do update set place_id = excluded.place_id, booking_id = excluded.booking_id;
end $$;

create or replace function public.unlock_night() returns void
language sql security definer set search_path = public as $$
  delete from public.night_locks where user_id = auth.uid() and night_key = public.night_key();
$$;

-- Everything the app needs about the current night in one call.
create or replace function public.my_night() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'night_key', public.night_key(),
    'spins_left', public.spins_left(),
    'bonus_spins', (select bonus_spins from public.profiles where id = auth.uid()),
    'locked', (select to_jsonb(l) - 'user_id' from public.night_locks l
               where l.user_id = auth.uid() and l.night_key = public.night_key()));
$$;

-- Which of these places are open at `p_at`? The wheel greys out the rest ("Closed tonight").
create or replace function public.open_places(p_ids text[], p_at timestamptz default null) returns text[]
language sql stable set search_path = public as $$
  select coalesce(array_agg(id), '{}') from public.places
  where id = any (p_ids) and active and public.is_open_at(id, coalesce(p_at, now()));
$$;

-- ---------------------------------------------------------------------------
-- Deals and QR. The QR carries a short signed token so a screenshot cannot be reused:
--   <qr_token>.<expiry base36>.<signature>  (<= 32 bytes, fits a version-2 QR code)
-- Redemption happens when venue staff scan it (redeem_deal), not when the user taps.
-- ---------------------------------------------------------------------------
create table if not exists public.app_secrets (name text primary key, value text not null);
revoke all on public.app_secrets from anon, authenticated;
insert into public.app_secrets (name, value)
values ('qr_hmac', encode(extensions.gen_random_bytes(32), 'hex')) on conflict do nothing;

create or replace function public._sign(p_msg text) returns text
language sql stable security definer set search_path = public, extensions as $$
  select substr(encode(extensions.hmac(p_msg, (select value from public.app_secrets where name = 'qr_hmac'), 'sha256'), 'hex'), 1, 8);
$$;
revoke execute on function public._sign(text) from public, anon, authenticated;

create or replace function public.deal_token(p_place text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare ud public.user_deals; dl public.deals; expiry timestamptz; body text;
begin
  select * into dl from public.deals where place_id = p_place and active order by code limit 1;
  if not found then raise exception 'no_deal'; end if;
  select * into ud from public.user_deals where user_id = auth.uid() and deal_id = dl.id;
  if not found then raise exception 'not_unlocked' using errcode = 'P0001'; end if;
  expiry := ud.unlocked_at + interval '3 hours';
  if ud.qr_token is null then
    update public.user_deals set qr_token = encode(extensions.gen_random_bytes(5), 'hex') where id = ud.id returning * into ud;
  end if;
  -- base36 keeps the token short
  body := ud.qr_token || '.' || public._b36(extract(epoch from expiry)::bigint);
  return jsonb_build_object('token', body || '.' || public._sign(body), 'expires_at', expiry,
                            'redeemed_at', ud.redeemed_at, 'code', dl.code, 'title', dl.title);
end $$;

create or replace function public._b36(n bigint) returns text language plpgsql immutable as $$
declare chars text := '0123456789abcdefghijklmnopqrstuvwxyz'; out text := ''; v bigint := n;
begin
  if v = 0 then return '0'; end if;
  while v > 0 loop out := substr(chars, (v % 36)::int + 1, 1) || out; v := v / 36; end loop;
  return out;
end $$;

create or replace function public._from_b36(s text) returns bigint language plpgsql immutable as $$
declare chars text := '0123456789abcdefghijklmnopqrstuvwxyz'; v bigint := 0; i int;
begin
  for i in 1..length(s) loop v := v * 36 + (position(substr(s, i, 1) in chars) - 1); end loop;
  return v;
end $$;

-- Venue staff page: scan -> redeem. Authenticated by the venue's staff key (shared out of band).
create or replace function public.redeem_deal(p_token text, p_staff_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare parts text[] := string_to_array(coalesce(p_token, ''), '.'); ud public.user_deals; dl public.deals; v public.venues;
begin
  if array_length(parts, 1) <> 3 then return jsonb_build_object('ok', false, 'reason', 'malformed'); end if;
  if public._sign(parts[1] || '.' || parts[2]) <> parts[3] then return jsonb_build_object('ok', false, 'reason', 'bad_signature'); end if;
  select * into ud from public.user_deals where qr_token = parts[1];
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown'); end if;
  select * into dl from public.deals where id = ud.deal_id;
  select * into v from public.venues where place_id = dl.place_id;
  if not found or v.staff_key_hash is null
     or encode(extensions.digest(coalesce(p_staff_key, ''), 'sha256'), 'hex') <> v.staff_key_hash then
    return jsonb_build_object('ok', false, 'reason', 'wrong_venue');
  end if;
  if public._from_b36(parts[2]) < extract(epoch from now()) then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  if ud.redeemed_at is not null then return jsonb_build_object('ok', false, 'reason', 'already_used', 'redeemed_at', ud.redeemed_at); end if;
  update public.user_deals set redeemed_at = now() where id = ud.id;
  return jsonb_build_object('ok', true, 'title', dl.title, 'code', dl.code, 'place', dl.place_id);
end $$;

-- Poll used by the app while the QR sheet is open.
create or replace function public.deal_status(p_place text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('redeemed_at', ud.redeemed_at, 'unlocked_at', ud.unlocked_at)
  from public.user_deals ud join public.deals d on d.id = ud.deal_id
  where ud.user_id = auth.uid() and d.place_id = p_place order by d.code limit 1;
$$;

-- Account deletion (App Store requirement). Cascades through every user table.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Execute rights: everything is callable by signed-in users only unless noted otherwise.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin(), public.night_key(timestamptz), public.is_open_at(text, timestamptz),
      public.open_places(text[], timestamptz) to anon, authenticated;
grant execute on function public.spins_left(uuid), public.spin(text, text[], timestamptz), public.rate_spin(uuid, int, boolean),
      public.lock_night(text, uuid), public.unlock_night(), public.my_night(), public.deal_token(text),
      public.deal_status(text), public.delete_my_account() to authenticated;
-- the staff page has no user session; it proves itself with the venue staff key
grant execute on function public.redeem_deal(text, text) to anon, authenticated;
