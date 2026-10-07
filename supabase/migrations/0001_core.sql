-- Spin It backend, part 1: accounts, user data, content tables, row-level security.
-- Runs on Supabase (auth/storage/realtime provided) and on plain Postgres for tests
-- (see scripts/test-db.mjs, which stubs the Supabase roles and auth.uid()).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Content (public read, admin write)
-- ---------------------------------------------------------------------------
create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create table public.places (
  id            text primary key,
  name          text not null,
  short         text not null,
  area          text not null default '',
  lat           double precision,
  lng           double precision,
  category      text not null default 'Spot',
  vibe          text not null default '',
  about         text not null default '',
  moods         text[] not null default '{}',
  tags          text[] not null default '{}',
  budget_tier   smallint not null default 1 check (budget_tier between 1 and 3),
  price_label   text not null default '',
  hours_text    text not null default '',
  best_time     text not null default '',
  indoor        boolean not null default false,
  photos        text[] not null default '{}',  -- bundled image names or Storage URLs
  food          jsonb not null default '[]',
  dessert       jsonb not null default '[]',
  insta         text,
  website       text,
  image_credit  text,
  sort_order    int not null default 0,
  active        boolean not null default true,
  updated_at    timestamptz not null default now()
);

create table public.deals (
  id        uuid primary key default gen_random_uuid(),
  place_id  text not null references public.places(id) on delete cascade,
  title     text not null,
  code      text not null unique,
  active    boolean not null default true
);

create table public.place_hours (
  place_id         text not null references public.places(id) on delete cascade,
  weekday          smallint not null check (weekday between 0 and 6), -- 0 = Sunday (Postgres extract(dow))
  opens            time not null,
  closes           time not null,
  closes_next_day  boolean not null default false,
  primary key (place_id, weekday, opens)
);

create table public.place_exceptions (
  place_id  text not null references public.places(id) on delete cascade,
  date      date not null,
  closed    boolean not null default false,
  opens     time,
  closes    time,
  note      text,
  primary key (place_id, date)
);

create table public.events (
  id        uuid primary key default gen_random_uuid(),
  place_id  text not null references public.places(id) on delete cascade,
  title     text not null,
  time_text text not null,
  tag       text not null default 'Free',
  image     text,
  starts_on date,
  ends_on   date,
  active    boolean not null default true,
  sort_order int not null default 0
);

create table public.local_picks (
  id        uuid primary key default gen_random_uuid(),
  place_id  text not null references public.places(id) on delete cascade,
  handle    text not null,
  initial   text not null,
  color     text not null default '#F5EEF6',
  quote     text not null,
  active    boolean not null default true,
  sort_order int not null default 0
);

create table public.venues (
  id                 uuid primary key default gen_random_uuid(),
  place_id           text not null unique references public.places(id) on delete cascade,
  name               text not null,
  booking_mode       text not null default 'manual' check (booking_mode in ('manual','api')),
  provider           text,
  provider_venue_id  text,
  contact_whatsapp   text,
  contact_email      text,
  slot_capacity      int not null default 40,
  staff_key_hash     text  -- sha256 hex of the staff key given to the venue (redeem page)
);

-- ---------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null default '' check (char_length(name) <= 40),
  g            text not null default 'vibes' check (g in ('habibi','habibti','vibes')),
  avatar       text not null default 'sp-avatar',
  fav_vibes    text[] not null default '{}',
  budget_min   int not null default 0 check (budget_min >= 0),
  budget_max   int not null default 400 check (budget_max <= 400),
  mood         text check (mood in ('Chill','Romantic','Adventurous','Family')),
  who          text not null default 'Friends',
  calm         boolean not null default false,
  notif        boolean not null default true,
  loc          boolean not null default true,
  limit_on     boolean not null default true,
  mystery      boolean not null default false,
  squad_used   boolean not null default false,
  bonus_spins  int not null default 0 check (bonus_spins >= 0),
  ref_code     text not null unique default upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6)),
  referred_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.wheels (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null default 'Night Shift' check (char_length(name) <= 18),
  emoji      text not null default '🌙',
  accent     text not null default '#FF3D8B' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  place_ids  text[] not null default '{}',   -- places switched ON; empty = never configured (all on)
  updated_at timestamptz not null default now()
);

create table public.saved_places (
  user_id    uuid not null references auth.users(id) on delete cascade,
  place_id   text not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.evenings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  place_id    text not null references public.places(id) on delete cascade,
  food_alt    smallint not null default 0 check (food_alt in (0,1)),
  dessert_alt smallint not null default 0 check (dessert_alt in (0,1)),
  created_at  timestamptz not null default now(),
  unique (user_id, place_id, food_alt, dessert_alt)
);

create table public.spins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  place_id   text not null references public.places(id),
  mode       text not null check (mode in ('place','food','dessert')),
  night_key  date not null,
  rating     smallint check (rating between 1 and 5),
  skip_rate  boolean not null default false,
  created_at timestamptz not null default now()
);
create index spins_user_night on public.spins (user_id, night_key);
create index spins_user_created on public.spins (user_id, created_at desc);

create table public.user_deals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  deal_id      uuid not null references public.deals(id) on delete cascade,
  unlocked_at  timestamptz not null default now(),
  redeemed_at  timestamptz,
  qr_token     text unique,
  unique (user_id, deal_id)
);

create table public.night_locks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  night_key  date not null,
  place_id   text not null references public.places(id),
  booking_id uuid,
  primary key (user_id, night_key)
);

create table public.push_tokens (
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,
  platform   text not null check (platform in ('ios','android','web')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  tag        text,
  body       text not null default '' check (char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  at      timestamptz not null default now()
);
create index ai_usage_user_at on public.ai_usage (user_id, at desc);

-- A profile + wheel appear with every new account. Name/gender/referral come from signUp metadata.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare ref uuid;
begin
  select id into ref from public.profiles
   where ref_code = upper(coalesce(new.raw_user_meta_data->>'ref', '')) limit 1;
  insert into public.profiles (id, name, g, referred_by)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)), 40),
          case when new.raw_user_meta_data->>'g' in ('habibi','habibti','vibes') then new.raw_user_meta_data->>'g' else 'vibes' end,
          ref);
  insert into public.wheels (user_id) values (new.id);
  if ref is not null then
    update public.profiles set bonus_spins = bonus_spins + 1 where id in (ref, new.id); -- both sides get a spin
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.admins          enable row level security;
alter table public.places          enable row level security;
alter table public.deals           enable row level security;
alter table public.place_hours     enable row level security;
alter table public.place_exceptions enable row level security;
alter table public.events          enable row level security;
alter table public.local_picks     enable row level security;
alter table public.venues          enable row level security;
alter table public.profiles        enable row level security;
alter table public.wheels          enable row level security;
alter table public.saved_places    enable row level security;
alter table public.evenings        enable row level security;
alter table public.spins           enable row level security;
alter table public.user_deals      enable row level security;
alter table public.night_locks     enable row level security;
alter table public.push_tokens     enable row level security;
alter table public.feedback        enable row level security;
alter table public.ai_usage        enable row level security;

-- content: everyone reads, admins write
do $$ declare t text; begin
  foreach t in array array['places','deals','place_hours','place_exceptions','events','local_picks'] loop
    execute format('create policy %I on public.%I for select using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())', t || '_admin', t);
  end loop;
end $$;
create policy venues_admin on public.venues for all using (public.is_admin()) with check (public.is_admin());

-- own rows only
create policy profiles_own on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy wheels_own on public.wheels for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saved_own on public.saved_places for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy evenings_own on public.evenings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy spins_read on public.spins for select using (user_id = auth.uid());
create policy user_deals_read on public.user_deals for select using (user_id = auth.uid());
create policy night_locks_read on public.night_locks for select using (user_id = auth.uid());
create policy push_own on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy feedback_insert on public.feedback for insert with check (user_id = auth.uid());
create policy feedback_read on public.feedback for select using (public.is_admin());

-- Grants. Users cannot write protected columns (bonus_spins, ref_code, referred_by) or the
-- server-owned tables (spins, user_deals, night_locks): those change only through functions.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.places, public.deals, public.place_hours, public.place_exceptions,
                public.events, public.local_picks to anon, authenticated;
grant insert, update, delete on public.places, public.deals, public.place_hours,
                public.place_exceptions, public.events, public.local_picks, public.venues to authenticated;
grant select on public.venues to authenticated;
grant select on public.profiles to authenticated;
grant update (name, g, avatar, fav_vibes, budget_min, budget_max, mood, who, calm, notif, loc,
              limit_on, mystery, squad_used) on public.profiles to authenticated;
grant select, insert, update, delete on public.wheels, public.saved_places, public.evenings,
                public.push_tokens to authenticated;
grant select on public.spins, public.user_deals, public.night_locks to authenticated;
grant insert on public.feedback to authenticated;
grant select on public.feedback, public.admins to authenticated;
