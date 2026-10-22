-- Respins are allowed even after locking tonight in (for now): a spin clears tonight's lock instead of
-- failing with 'locked'. Same function as 20261012000007_smart_spin.sql otherwise.
-- To bring the "no take-backs" rule back, re-run the spin() definition from that migration.

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

  -- spinning again replaces tonight's locked plan (no take-backs is off for now)
  delete from public.night_locks where user_id = uid and night_key = nk;

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
