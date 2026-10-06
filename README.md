# Spin It

Night-out wheel for Doha. Spin a wheel of 34 places, get paired with dinner and dessert, unlock a bonus, and keep the night.

Expo (React Native, TypeScript, expo-router) port of the design handoff in [`docs/design/`](docs/design). The prototype `SpinIt App v2.dc.html` is the source of truth for UI and copy; `BACKEND.md` is the plan for the server side.

## Run

```bash
npm install
npx expo start      # Expo Go / simulator
npm run typecheck
npm test            # wheel + filter logic checks
```

## What's built (phase 1: core flow, local data only)

Discover (search, chips, vibe sheet), Spin (photo wheel, Place/Food/Dessert modes, 3 spins/night refilling at 6 PM, trippy spin layer, haptics), Reveal (confetti, bonus), Tonight's plan (swap, keep, lock it in, Maps), Place detail, Saved, Profile (stats, bonus wallet, history + ratings, settings), Make it yours (wheel name, glow, emoji, places).

State persists on-device (zustand + AsyncStorage). Places come from `src/data/places.json` (34 places, from `Doha_Night_Out_Places.xlsx`; the 6 originals use bundled photos, the rest load remote images).

## Not built yet

Auth + setup, AI tab, live squad spin, booking, QR bonus redemption, route map, opening hours, push, and the backend (Supabase). See `docs/design/BACKEND.md` for the build order.
