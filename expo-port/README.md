# Spin It

Night-out wheel for Doha. Spin a wheel of 34 places, get paired with dinner and dessert, unlock a bonus, and keep the night.

Expo (React Native, TypeScript, expo-router) port of the design handoff in [`docs/design/`](docs/design). The prototype `SpinIt App v2.dc.html` is the source of truth for UI and copy; `BACKEND.md` is the plan for the server side.

## Run on your phone

1. Install **Expo Go** from the App Store or Google Play.
2. On a computer with Node 20+:
   ```bash
   git clone https://github.com/atharvkakkar2011-sudo/SpinIt.git
   cd SpinIt
   git checkout claude/new-session-2ay0s8
   npm install
   npx expo start
   ```
3. Scan the QR code (iOS: Camera app, Android: Expo Go). Use `npx expo start --tunnel` if your phone and computer are on different networks.

Other commands: `npm run typecheck`, `npm test` (wheel, filter and route logic checks).

### Installable builds (TestFlight / APK)

Needs a free Expo account (`npm i -g eas-cli && eas login`). `eas build -p android --profile preview` produces an installable APK. iOS builds need an Apple Developer account (`eas build -p ios --profile preview`). Build profiles are in `eas.json`.

## What's built

Everything in the design handoff except the real backend: sign up / log in, 4-step setup, Explore (search, chips, vibe sheet with budget slider, heat mode, what's on tonight, local picks, post-night rating), Spin (photo wheel, Place/Food/Dessert modes, 3 spins a night refilling at 6 PM, trippy spin layer, haptics, calm mode, mystery mode), Reveal (confetti, bonus QR), Tonight's plan (neon route map, swap, table booking, lock it in with calendar, WhatsApp, story card), Place detail, AI tab, Squad spin, Profile (Wrapped, badges, bonus wallet, Doha passport, saved, history + ratings, theme, shabab invite, settings, edit profile, help, logout, delete).

## What is simulated

No backend is connected, so these run locally: accounts (stored on the device, passwords are not checked), squad members and votes, table availability and booking, QR bonuses (the QR encodes an unsigned token), and the AI tab (keyword matcher over the same place data; set `EXPO_PUBLIC_AI_ENDPOINT` to a route that takes `{prompt}` and returns `{text}` to use a real model). Remote place photos need a network connection. `docs/design/BACKEND.md` is the plan for making these real.

## Web build

`npm run build:web` writes a static build to `dist/` that works from any sub-path.
