# Going live

Everything here is a one-time setup. It takes about an hour, most of it waiting on Apple and Google.

## 1. Supabase (backend)

1. Create a project at supabase.com. Choose a region close to Doha (for example `eu-central-1` or `me-central-1` if offered).
2. Install the CLI, link and push the schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR-REF
   npx supabase db push            # runs supabase/migrations/*
   psql "$(npx supabase db url)" -f supabase/seed.sql   # 34 places, deals, venues, hours, events
   ```
3. **Auth → Providers → Email:** on. Email confirmation is off in `supabase/config.toml` so people go straight into setup. If you turn it on, the app tells people to check their inbox.
4. **Auth → URL configuration:** add `https://spinit.app/reset/` as a redirect URL (password reset page).
5. **Make yourself admin** (lets you edit places, hours, events and set venue staff keys): sign up in the app, then in the SQL editor:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
   ```
6. **Venue staff keys** (for the bonus scanner), one per venue, at least 12 characters, shared privately with the venue:
   ```sql
   select public.set_venue_staff_key('katara', 'a-long-random-key');   -- run while signed in as admin, or as postgres
   ```
   Add venue contacts for booking requests: `update venues set contact_whatsapp = '+974…', contact_email = '…' where place_id = '…';`

## 2. Edge functions

```bash
npx supabase functions deploy ai-chat push-dispatch notify-venues refresh-hours
npx supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-... \
  CRON_SECRET=$(openssl rand -hex 24) \
  SPINIT_WEB_BASE=https://spinit.app \
  FCM_SERVICE_ACCOUNT="$(cat firebase-service-account.json)"
# optional: venue messages
npx supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_ID=...       # Meta WhatsApp Cloud API
npx supabase secrets set RESEND_API_KEY=... BOOKINGS_FROM_EMAIL=bookings@spinit.app
# optional: weekly opening-hours refresh (fill places.google_place_id first)
npx supabase secrets set GOOGLE_PLACES_API_KEY=...
```

`ai-chat` uses Claude Opus 5.5 at low effort. Set `ANTHROPIC_MODEL` to change it and `AI_HOURLY_LIMIT` (default 30) to cap questions per person per hour.

**Schedules** (Dashboard → Edge Functions → each function → Schedules), each with header `x-cron-secret: <CRON_SECRET>`:

| Function | Schedule |
|---|---|
| `push-dispatch` | every minute |
| `notify-venues` | every minute |
| `refresh-hours` | weekly |

The 6 PM refill reminder and the next-day rating reminder are scheduled inside Postgres by the realtime_cron migration (pg_cron). Enable the `pg_cron` extension under Database → Extensions if the migration skipped it.

## 3. Firebase (push notifications)

1. Create a Firebase project and add an iOS app (`app.spinit.mobile`) and an Android app (`app.spinit.mobile`).
2. Download `GoogleService-Info.plist` → `ios/App/App/` (add it to the App target in Xcode) and `google-services.json` → `android/app/`.
3. Upload your APNs key (Apple Developer → Keys) in Firebase → Project settings → Cloud Messaging.
4. Create a service-account key (Project settings → Service accounts) and store it as the `FCM_SERVICE_ACCOUNT` secret above.

## 4. Build the app

```bash
cp .env.example .env    # fill in SPINIT_SUPABASE_URL / SPINIT_SUPABASE_ANON_KEY
npm install
npm run sync
```

**iOS** (needs a Mac with Xcode): `npx cap open ios`. In Signing & Capabilities pick your team, then add **Push Notifications** and **Associated Domains** (`applinks:spinit.app`); `App/App.entitlements` already lists both. Run on a phone, then Product → Archive for TestFlight.

**Android** (Android Studio): `npx cap open android`, then Run, or Build → Generate Signed Bundle for the Play Store.

## 5. Web pages

```bash
npm run build:web   # -> web-dist/
```

Deploy `web-dist/` to Vercel (or any static host) on `spinit.app`. The short links the app shares work through the rewrites in `web-dist/vercel.json`:

| Link | Page |
|---|---|
| `spinit.app/s/4821` | squad vote (no app needed) |
| `spinit.app/b/<token>` | venue confirms or declines a table |
| `spinit.app/staff` | staff bonus scanner (uses the venue staff key) |
| `spinit.app/reset` | new password |
| `spinit.app/i/<code>` | invite landing |

Set `SPINIT_IOS_TEAM_ID` and `SPINIT_ANDROID_SHA256` before building so `/i/` and `/s/` links open the installed app.

## Day-to-day

- **What's on tonight / local picks / places / hours:** edit the `events`, `local_picks`, `places`, `place_hours` tables in the dashboard. Ramadan or Eid hours go in `place_exceptions`; they override the weekly hours for that date.
- **Changing the design:** export again from Claude Design into `design/`, run `npm run build:www`. If a patch no longer matches, the build says which one; update it in `scripts/patches.mjs`.
