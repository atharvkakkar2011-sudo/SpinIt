# Spin It

The Spin It prototype from Claude Design, shipped as an iOS and Android app with a real backend.

- **UI:** `design/SpinIt App v2.dc.html` and `design/img/`, byte-for-byte as exported. Nothing is redrawn or restyled. The build copies it into the app and patches only its logic (where data is saved, who decides a spin, which native feature a button opens). Every patch is listed in `scripts/patches.mjs` and must match the original exactly once, so a re-exported design fails the build loudly instead of half-working.
- **App shell:** Capacitor 8 (`ios/`, `android/`).
- **Device features:** push notifications (Firebase Cloud Messaging), location, the system share sheet, clipboard, external links (WhatsApp, Maps), calendar file sharing, and local reminders.
- **Backend:** Supabase, implementing everything in `docs/design/BACKEND.md`: accounts, server-side spin limit, opening hours, live squad spin, table bookings, signed QR bonuses, push notifications and the AI tab.
- **Web pages for people without the app:** squad voting, venue booking confirmation, staff QR scanner, password reset, invite landing (`web/`).

`expo-go/` is a small Expo app for trying Spin It on your phone with Expo Go (see below). `expo-port/` is an earlier hand-built React Native version. It is superseded by this one and kept only for reference.

## How it fits together

```
design/ (untouched prototype) ──patches──▶ www/index.html ─┐
app-src/bridge (window.SpinIt) ──esbuild──▶ www/spinit-bridge.js ├─▶ Capacitor ─▶ iOS / Android
app-src/vendor (React, design runtime), fonts ───────────────────┘
                                   │
                                   ▼
              Supabase: Postgres + RLS (supabase/migrations), Auth, Realtime,
              Edge Functions (ai-chat, push-dispatch, notify-venues, refresh-hours)
                                   ▲
web/ (squad vote, venue confirm, staff scanner, reset, invite) ─┘
```

The prototype used to keep everything in one `localStorage` key. Now:

| What | Where it lives now |
|---|---|
| Account, name, gender term, avatar, setup answers, settings | `auth.users` + `profiles` |
| Wheel name, emoji, glow, places on the wheel | `wheels` |
| Saved spots, kept nights | `saved_places`, `evenings` |
| Spins, ratings, 3-a-night limit, bonus spins | `spins` + the `spin()` function (the server picks the result; the wheel animates to it) |
| Bonuses / QR | `user_deals` with a signed token; staff redeem it (`redeem_deal`) |
| Lock it in | `night_locks` (+ a booking) |
| Bookings | `bookings` → venue message → venue confirms by link → push to the guest |
| Squad spin | `squads`, `squad_members` (Realtime + polling) |
| What's on tonight, local picks | `events`, `local_picks` (edit in the Supabase dashboard) |

A copy of the user's data stays on the phone as an offline cache. Edits made offline sync when the connection returns.

## Commands

```bash
npm install
npm run build:www      # www/ for the app (reads .env, see .env.example)
npx cap sync           # copy www/ + plugins into ios/ and android/
npx cap open ios       # or: npx cap open android

npm run test:db        # every migration + 16 database tests (needs PostgreSQL 16 server binaries)
npm run test:app       # the real UI end to end against a local backend (needs PostgREST + Playwright)
node scripts/dev-backend.mjs   # local stand-in for Supabase on :54321 (needs PostgREST)
```

## Try it on your phone (Expo Go)

```bash
npm install
npm run phone          # builds the pages, serves them on your Wi-Fi, starts Expo
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone). Phone and computer must be on the same Wi-Fi; allow Node through the firewall if your computer asks.

- Until `.env` points at a real Supabase project, this runs the **demo**: the design's own on-device saving, with all 154 places, photos and the 25-slice wheel. Accounts and spins stay on that phone, and the AI tab shows its retry message.
- With `SPINIT_SUPABASE_URL` set to your `https://…supabase.co` project, the same command runs the **real app** against the backend.
- Expo Go shows the exact same pages inside a web view. Location, share, copy and Maps/WhatsApp links go to the phone. Push notifications and the calendar file need the real app build (Capacitor), not Expo Go.

Going live (Supabase project, Firebase, store builds, web pages): **[docs/SETUP.md](docs/SETUP.md)**.
