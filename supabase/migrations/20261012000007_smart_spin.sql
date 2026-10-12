-- Smarter spins. Every slice on the wheel can still win, but the server leans the odds toward what
-- fits tonight: places near the user, places they rated well, places they haven't just been to,
-- and (once scripts/enrich-places.mjs has run) places with a strong Google rating.

alter table public.places
  add column if not exists rating numeric(2,1) check (rating between 1 and 5),
  add column if not exists rating_count int check (rating_count >= 0);

create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
       + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

-- How strongly one candidate is favoured for one user. 1 is neutral.
create or replace function public.spin_weight(p_user uuid, p_place text, p_lat double precision, p_lng double precision)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare
  w   double precision := 1;
  pl  public.places;
  mine numeric;
  nk  date := public.night_key();
begin
  select * into pl from public.places where id = p_place;
  -- nearer is likelier: half as likely 8 km away, a third 16 km away
  if p_lat is not null and p_lng is not null and pl.lat is not null then
    w := w / (1 + public.km_between(p_lat, p_lng, pl.lat, pl.lng) / 8);
  end if;
  -- Google rating, only when enough people rated it: 4.5★ ≈ ×1.3, 3.5★ ≈ ×0.7
  if pl.rating is not null and coalesce(pl.rating_count, 0) >= 20 then
    w := w * least(1.7, greatest(0.4, 1 + (pl.rating - 4) * 0.6));
  end if;
  -- the user's own ratings of past nights there
  select avg(rating) into mine from public.spins where user_id = p_user and place_id = p_place and rating is not null;
  if mine >= 4 then w := w * 2; elsif mine <= 2 then w := w * 0.25; end if;
  -- variety: less likely to land on the same place again tonight, or one from the last week
  if exists (select 1 from public.spins where user_id = p_user and place_id = p_place and night_key = nk) then
    w := w * 0.25;
  elsif exists (select 1 from public.spins where user_id = p_user and place_id = p_place and night_key > nk - 7) then
    w := w * 0.5;
  end if;
  return greatest(w, 0.01);
end $$;

-- Weighted draw among the open candidates (Efraimidis–Spirakis: smallest -ln(u)/w wins).
create or replace function public.spin_pick(p_user uuid, p_candidates text[], p_arrive timestamptz,
                                            p_lat double precision default null, p_lng double precision default null)
returns text language sql volatile security definer set search_path = public as $$
  select p.id from public.places p
  where p.id = any (coalesce(p_candidates, '{}')) and p.active and public.is_open_at(p.id, p_arrive)
  order by -ln(1 - random()) / public.spin_weight(p_user, p.id, p_lat, p_lng)
  limit 1;
$$;

drop function if exists public.spin(text, text[], timestamptz);

create or replace function public.spin(p_mode text, p_candidates text[], p_arrive timestamptz default null,
                                       p_lat double precision default null, p_lng double precision default null)
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

  -- coarse position only (2 decimals ≈ 1 km); it is used for this draw and not stored
  pick := public.spin_pick(uid, p_candidates, arrive, round(p_lat::numeric, 2)::double precision, round(p_lng::numeric, 2)::double precision);
  if pick is null then raise exception 'none_open' using errcode = 'P0001'; end if;

  insert into public.spins (user_id, place_id, mode, night_key) values (uid, pick, p_mode, nk) returning id into new_id;

  select * into d from public.deals where place_id = pick and active order by code limit 1;
  if found then
    insert into public.user_deals (user_id, deal_id) values (uid, d.id) on conflict (user_id, deal_id) do nothing;
  end if;

  return jsonb_build_object('place_id', pick, 'spin_id', new_id, 'at', now(), 'spins_left', public.spins_left(uid));
end $$;

revoke all on function public.spin_weight(uuid, text, double precision, double precision) from public, anon, authenticated;
revoke all on function public.spin_pick(uuid, text[], timestamptz, double precision, double precision) from public, anon, authenticated;
revoke all on function public.spin(text, text[], timestamptz, double precision, double precision) from public, anon;
grant execute on function public.spin(text, text[], timestamptz, double precision, double precision) to authenticated;
grant execute on function public.km_between(double precision, double precision, double precision, double precision) to anon, authenticated;
