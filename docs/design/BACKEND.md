# SpinIt — Backend spec (for Claude Code + Expo)

The prototype (`SpinIt App v2.dc.html`) is the source of truth for UI, copy and flows. This file covers what it fakes and how to make it real.

Recommended stack: **Expo (React Native, TypeScript, expo-router)** + **Supabase** (Auth, Postgres, Realtime, Edge Functions, Storage) + **Expo Notifications**. One vendor for auth/db/realtime keeps it simple; swap for Firebase if preferred.

---

## 1. Accounts and log in

**Prototype today:** user object in localStorage, no password check.

**Build:**
- Supabase Auth: email + password, plus Sign in with Apple and Google (Apple is required on iOS if Google is offered).
- Magic-link "forgot password" (matches the prototype's "Forgot it?" link).
- After sign-up, run the existing 4-step Setup flow and write results to `profiles`.
- Move all persisted prototype state to the server: saved, evenings, history + ratings, deals, wheel config, booking, favVibes, notif, loc, calm, locked night.
- Keep a local cache (MMKV / AsyncStorage) for offline reads; sync on reconnect.

**Tables**
```
profiles      id (=auth.uid) · name · g ('habibi'|'habibti'|'vibes') · avatar_url · fav_vibes text[] · budget_min · budget_max · calm bool · created_at
wheels        id · user_id · name · emoji · accent · place_ids text[] · updated_at
saved_places  user_id · place_id · created_at                      (pk user_id+place_id)
evenings      id · user_id · place_id · food_alt · dessert_alt · created_at
spins         id · user_id · place_id · mode · rating smallint null · created_at
user_deals    id · user_id · deal_id · unlocked_at · redeemed_at null · qr_token
night_locks   user_id · night_key (date, rolls at 6 PM Doha) · place_id · booking_id null
```
Row-level security: every table `user_id = auth.uid()`.

**Spin limit:** enforce server-side. Edge Function `spin()` checks spins used since the last 6 PM Asia/Qatar, plus bonus spins, plus `night_locks`; returns the result place. The client only animates to it. This stops people reinstalling to get more spins.

---

## 2. Live Squad spin

**Prototype today:** Noor/Omar/Lulwa join on timers; WhatsApp button opens a placeholder link.

**Build:**
```
squads         id · code ('SPIN-4821') · host_id · status ('open'|'spun'|'closed') · result_place_id null · expires_at (now+3h)
squad_members  squad_id · user_id null · guest_name null · guest_token null · vote ('Chill'|'Romantic'|'Adventurous'|'Family') null · joined_at
```
- Host taps Squad spin → `create_squad()` returns code + link `https://spinit.app/s/{code}`.
- "Send the vote link on WhatsApp" → `https://wa.me/?text=` + link.
- **No-app voting:** `spinit.app/s/{code}` is a small web page (Next.js/Expo web on Vercel): enter a name, tap a vibe. Writes a guest `squad_members` row via Edge Function (rate-limited, no account needed). If the app is installed, universal links / app links open it instead.
- Host app subscribes with Supabase Realtime to `squad_members where squad_id = …` → members appear, votes land live (same UI as the prototype).
- "Spin for the squad" → Edge Function picks the majority mood, runs `spin()`, sets `result_place_id`, broadcasts. Guests' web page and members' apps all show the reveal at the same time.

---

## 3. Booking tables

**Prototype today:** sheet with party size + time grid; marks the stop as booked locally.

**Build in two phases:**
1. **Launch (no integrations):** "Reserve a table" creates a `bookings` row with status `requested` and sends the venue a WhatsApp/email via an Edge Function. Venue confirms by tapping a link → status `confirmed` → push to user. Works with any partner on day one.
2. **Later:** connect to whatever reservation system each partner venue already uses (many hotel restaurants run a reservation platform with an API). Wrap each in an adapter: `getAvailability(venue, date, size)` and `createBooking(...)`. The time grid shows real availability; "Full" slots come from the API.

```
bookings  id · user_id · venue_id · place_id · party_size · slot_at · status ('requested'|'confirmed'|'declined'|'cancelled') · provider · provider_ref · created_at
venues    id · place_id · name · booking_mode ('manual'|'api') · provider · provider_venue_id · contact_whatsapp · contact_email
```
"Lock it in" = create booking + `night_locks` row + calendar invite (expo-calendar instead of the .ics download).

---

## 4. Push notifications

Expo Notifications (expo-notifications + Expo push service). Store tokens:
```
push_tokens  user_id · token · platform · updated_at
```
| Trigger | Copy (keep the voice) | When |
|---|---|---|
| Spins refilled | "Spins refilled, habibi. 3 fresh ones 🎡" | Daily 6 PM Asia/Qatar (cron Edge Function), only users with notif on who spun in the last 14 days |
| Night starts soon | "Your night starts in 1h. {place} at 6:30 👀" | 1h before first stop of a locked night (scheduled locally on lock) |
| Booking confirmed / declined | "Table’s locked at {food} for {time} ✅" | On booking status change |
| Squad | "{name} just voted {vibe}" / "The wheel spun for the squad" | Realtime → push for members not in the app |
| Bonus expiring | "Your {deal} bonus dies in 30 min" | 30 min before `unlocked_at + 3h` |
| Rate last night | "How was {place}? Rate it, it trains your wheel" | Next day 2 PM |

Respect the Setup answer and Profile toggle; quiet hours 1 AM–10 AM.

---

## 5. Live opening hours

**Prototype today:** static `hours` string; wheel ignores it.

**Build:**
```
places        id · name · short · area · lat · lng · category · vibe · about · moods text[] · budget_tier · price_label · indoor · photos text[] · insta · website · active
place_hours   place_id · weekday (0–6) · opens time · closes time · closes_next_day bool
place_exceptions  place_id · date · closed bool · opens · closes · note ('Ramadan hours', 'Eid')
```
- Seed `places` from `Doha_Night_Out_Places.xlsx` (34 rows). Copy photos into Supabase Storage (don't hotlink).
- Fill hours from the venue's Google Places listing (Places API `regularOpeningHours`), refreshed weekly by cron; `place_exceptions` overrides for Ramadan/Eid/events (editable in an admin sheet).
- `is_open_at(place, ts)` SQL function. `spin()` and the wheel list exclude places closed at the planned arrival time (now, or 6:30 PM for "Tonight"). Wheel shows closed ones greyed with "Closed tonight".
- Discover cards show "Open till 1 AM" / "Opens 4 PM".

---

## Also move server-side
- **Deals / QR:** `deals` table per venue; QR encodes a signed token (`user_deal_id` + expiry, HMAC). Venue staff scan with a tiny staff web page → `redeem_deal()` marks used. Prevents screenshot reuse.
- **AI tab:** replace `window.claude.complete` with an Edge Function calling your LLM provider; pass places (from DB, open now), user's term, ratings. Never ship API keys in the app.
- **Events / local picks:** `events` and `local_picks` tables, edited by you via Supabase dashboard or a simple admin.

## Build order
1. Expo app shell + design port (all screens from the prototype).
2. Auth + profiles + places from the spreadsheet + server spin limit.
3. Opening hours filter.
4. Squad realtime + web vote page.
5. Push notifications.
6. Manual booking, then API adapters.
7. Signed QR deals + staff page.
