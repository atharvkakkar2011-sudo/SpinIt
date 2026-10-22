-- Unlimited spins for now (owner's call during testing). The 3-a-night limit still exists per profile
-- (profiles.limit_on, also a toggle in the app's settings); this just switches it off by default.
-- To bring it back for everyone:
--   alter table public.profiles alter column limit_on set default true;
--   update public.profiles set limit_on = true;
alter table public.profiles alter column limit_on set default false;
update public.profiles set limit_on = false;
