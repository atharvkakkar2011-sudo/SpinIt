# Handoff: Spin It — Night Out Wheel

## Overview

Spin It is a playful decision-making app for Doha night-goers. Users spin a wheel of six iconic places, get paired with nearby food and dessert, unlock bonuses, and build their whole evening in one tap. The app emphasizes limited spins (for tension), photo-heavy cards, dark neon aesthetics, and a cheeky local voice.

## About the Design Files

The file `SpinIt App v2.dc.html` is a **high-fidelity HTML prototype** showing final colors, typography, spacing, animations and interactions. This is a **design reference only** — not production code to ship. Your task is to **recreate this design in React Native / Expo** using its patterns and libraries, maintaining pixel-perfect fidelity to the visual design and interaction model.

## Fidelity

**High-fidelity (hifi)**: All colors, typography, spacing, shadows, border radius and animations are finalized. Implement these values exactly. The prototype demonstrates all interactions, state transitions and animations.

## Design System

**Colors:**
- Background: `#0E0A12` (almost-black)
- Primary accent: `#FF3D8B` (hot pink, customizable per wheel)
- Alternatives: `#C6FF3D` (lime), `#3DF2FF` (cyan), `#FFB23D` (amber)
- Text: `#FFFFFF` (white), `#F5EEF6` (off-white), `#B9ADC0` (mid-grey), `#7D7086` (dark grey)
- Cards: `#1A1320` (dark bg), `#2C2233` (borders), `#3A2E42` (disabled)

**Typography:**
- Headlines: Unbounded, 800 weight, tight letter-spacing (-0.6 to -1.2px)
- Body: Instrument Sans, 400–600 weight
- Labels: Space Mono, 700 weight, 1–2px letter-spacing

**Spacing:** 8px grid, 14–20px padding, 12–16px gaps

**Border Radius:** 50% for circles, 10–24px for cards

## Screens

### 1. Discover
Browse six places, search by cuisine, filter by mood/budget.
- Header: time, profile pic, search bar
- Hero: Souq photo cutout card
- Chips: Food, Coffee, Culture, Outdoors filters
- Grid: 2 columns, 6 place cards (place photo, number, bookmark, name, vibe)
- CTA: "Can't choose?" bar with wheel

**Interactions:**
- Tap card → Detail
- Tap bookmark → save/unsave
- Chip toggle → filter radar
- Search → live filter

### 2. Spin
Spin the wheel for place (or food/dessert depending on mode).
- Header: wheel name + emoji (edit), filter badge
- Status: "3 spins a night" + dots (filled = used)
- Mode toggle: Place / Food / Dessert
- Wheel: 322×322px, each slice = photo, name overlay, neon ring, pointer at top
- Button: "SPIN IT" (accent glow)
- Footer: "Edit wheel" · "Squad spin"

**Wheel behavior:**
- Six slices, each shows place/food/dessert photo
- Spins 5 full rotations + offset to land on picked item (4.2s curve)
- While spinning: trippy background (neon stripes rotating, rings pulsing, all masked to wheel)
- Landing: chosen photo fades in as screen background, status updates

**Interactions:**
- Tap wheel name → Shortlist
- Tap filter → Mood sheet
- Tap SPIN → spin sequence

### 3. Mood Sheet
Bottom sheet with vibe/budget/group/timing filters.
- Sections: VIBE (Chill/Romantic/Adventurous/Family), BUDGET, WHO, WHEN
- Buttons: Reset, Apply ("Show me X spots")

**Interactions:**
- Tap chip → toggle
- Reset → clear all
- Apply → filter wheel, close sheet

### 4. Reveal
Full-screen landing with confetti and result.
- Background: chosen place's photo + gradient overlay
- Center: "🌙 THE WHEEL HAS SPOKEN" (flickers)
- Headline: "Yalla, it's {{ place }}."
- Three rows (staggered in):
  - Place: photo + name + vibe
  - Food: photo + name + price
  - Dessert: photo + name + price
- Bonus card: code + title (dashed border, glow)
- Buttons: "Show me the plan" (accent), "Not feeling it? Reroll"

**Animations:**
- Confetti: burst from wheel centre + rain from top
- Text: pop in with bounce
- Rows: slide up + fade (0.35s–0.95s stagger)

### 5. Tonight's Plan
Three-stop itinerary: place, dinner, dessert.
- Photo header: place photo (330px), back + share buttons
- Name + tags (When, Who, Budget)
- Timeline: 3 stops (6:30 PM place, 8:00 PM food + swap, 9:30 PM dessert + swap)
- Bonus card: "+ BONUS UNLOCKED"
- Buttons: "Keep it" (bookmark), "Take me there" (Maps, accent)

**Interactions:**
- Tap swap → toggle food/dessert variant
- Tap Keep → bookmark evening
- Tap "Take me there" → Google Maps
- Tap "Not feeling it?" → re-spin

### 6. Place Detail
Full details: hours, price, gallery, tags, info grid, add to wheel, build evening here.
- Photo gallery: swipe to cycle (dots show progress)
- Back + bookmark (top corners)
- Name + area (over last photo)
- About text + tags + info grid (2×2: HOURS/ENTRY/BEST TIME/DINNER NEARBY)
- Toggle: "On {{ wheel name }} 🌙"
- Button: "Build my night here"
- Link: "Get directions"

**Interactions:**
- Swipe/tap arrows → cycle photos
- Tap bookmark → save
- Toggle switch → add/remove from wheel
- "Build my night here" → reveals with this place
- "Get directions" → Google Maps

### 7. Saved (Bookmarks)
Two tabs: Spots (saved places), Nights (saved evenings).
- Card grid: photo + name + subtitle + remove X
- Empty states with emoji + CTA

**Interactions:**
- Tap tab → switch
- Tap card → Detail or Evening
- Tap X → remove

### 8. Make It Yours (Edit Wheel)
Customize wheel: name, glow color, emoji, which places.
- Back button
- Title: "Make it yours."
- Wheel preview (big circle, current glow + emoji)
- Name input (max 18 chars)
- Color swatches (4)
- Emoji picker (8)
- Toggle list: 6 places on/off
  - Disabled if fewer than 2 (toast: "Two minimum. It's a wheel, not a stick.")
- Button: "Looks good. Spin it."

**Interactions:**
- Type name → updates wheel
- Tap color → changes accent
- Tap emoji → changes wheel face
- Toggle place → on/off
- CTA → Spin

### 9. Squad Spin
Group voting with shared code.
- Code: "SPIN-4821" (dashed border, glow)
- Buttons: Copy, Share
- Members list: avatar + name + status + mood button (cycle Chill/Romantic/Adventurous/Family)
- Leading mood display
- Button: "Spin for the squad"

**Interactions:**
- Tap Copy → clipboard
- Tap Share → share sheet
- Tap mood → cycle, state updates
- Spin → goes to Spin with majority mood

### 10. Profile
User stats, bonuses, history.
- Avatar + name + "Spins with {{ wheel name }}"
- Stats: Spins | Nights kept | Bonuses used
- Bonuses list (tap to toggle used/unused)
- History (recent spins, tap to see evening)

## Animations

**Spin sequence (4.4s total):**
1. Wheel rotates: 360 × 5 + offset, cubic-bezier(.12,.72,.14,1)
2. Background trippy (4s):
   - Neon stripes (repeating-conic-gradient) sweep round, hue-shifting
   - Rings pulse out from wheel
   - All masked radially to wheel area
3. Land + fade in chosen photo (Ken Burns zoom-out 6s)
4. Reveal pops in with confetti

**Confetti:**
- Burst (~90 items): radiates from wheel, parabolic fall (2–4s)
- Rain (~110 items): falls from top (2–4s)
- Colors: accent + white + alt colors

**Transitions:**
- Screens: fadeIn .3s
- Sheets: slideUp .3s from bottom
- Reveal rows: stagger revealIn .5s (0.35–1.25s delays)
- Buttons: scale .98 on active

## State Management

**Global:**
- `screen`: current view
- `result`: selected place index
- `mode`: "place" | "food" | "dessert"
- `spinning`, `landed`, `reveal`: booleans
- `spinsLeft`: count (default 3)
- `hue`: rainbow hue during spin (0–360)

**Filters:**
- `mood`, `budget`, `who`, `when`, `chip`, `query`

**Wheel:**
- `wheel`: { placeId: boolean } (on/off)
- `wheelName`, `acc`, `emoji`

**User data (localStorage):**
- `saved`: { placeId: boolean }
- `evenings`: [{ i, fa, da }]
- `deals`: [{ i, used }]
- `history`: [{ i, mode, at }]

**Sheet state:**
- `sheet`: "mood" | "share" | null
- `savedTab`: "places" | "evenings"

## Data: Six Places

| Name | Area | Vibe | Budget | Moods | Tags |
|------|------|------|--------|-------|------|
| Katara | West Bay | Pink walls, sea breeze | 2 | Chill, Romantic, Family | Culture, Outdoors, Coffee |
| Msheireb | Downtown | Alleys and cafés | 2 | Chill, Adventurous | Culture, Coffee, Food |
| Lusail | Lusail | Towers and water | 3 | Romantic, Adventurous | Outdoors, Food |
| Souq Waqif | Old Doha | Lanterns and spice | 1 | Adventurous, Family, Chill | Culture, Food, Coffee |
| The Pearl | Qanat Quartier | Pastel canals | 3 | Romantic, Family | Food, Outdoors |
| Corniche | Corniche | Skyline and dhows | 1 | Chill, Family, Romantic | Outdoors, Coffee |

Each place has 2+ food options and 2+ dessert options with names, notes, prices.
Each has a deal code (e.g., "KATARA-KK": "Free karak with any kunafa").

## Assets

**Photos (24 JPGs in `./img/s/`):**
- katara-1/2/3/4.jpg
- msheireb-1/2.jpg
- lusail-1/2.jpg
- souq-1/2/3/4.jpg
- pearl-1/2/3.jpg
- corniche-1/2/3.jpg

**Avatar:** `./sp-avatar.png` (44×44px)

**Fonts:** Unbounded, Instrument Sans, Space Mono (Google Fonts)

## Files in This Package

- `README.md` (this file)
- `SpinIt App v2.dc.html` (design prototype)

## Notes for Implementation

- **Spin limit:** Default 3/night, toggle with `unlimitedSpins` prop
- **Voice:** Cheeky local friend ("Yalla," "habibi," "Too picky")
- **Photo windows:** Each place card is a fixed window onto that place's photo (not a moving background)
- **Persistence:** All user data (saved, history, deals, wheel config) stored in localStorage
- **Responsive:** Designed for 402×874px phone. Adapt for mobile (44px+ tap targets)


---

## UPDATE — features added after the first handoff

The bundled `SpinIt App v2.dc.html` is the source of truth. Everything below is implemented there.

### Brand
- Wordmark: `img/logo-white.png` (welcome screen, 46px tall, pink glow) and `img/logo-pink.png` (Discover header, 16px tall). Original burgundy file: `uploads/…SpinIt burgundy wordmark.png`.

### Visual language (current)
- **Liquid glass everywhere**: cards/inputs/chips = `rgba(255,255,255,0.07–0.08)` fill, `1.5px rgba(255,255,255,0.2)` border, `backdrop-filter: blur(3–8px) saturate(160%)`, inset top highlight `inset 0 1px 1px rgba(255,255,255,0.35–0.45)`.
- **Tab bar**: floating clear-glass pill (14px side inset, 20px from bottom, 68px tall, radius 34). Active-tab bubble is a single draggable glass lens: follows the finger, stretches with velocity (scaleX up to 1.7, scaleY = 1/sqrt(scaleX)), snaps with spring `cubic-bezier(.34,1.5,.5,1)` .55s. Refraction via SVG displacement filter (`#lgRefract`, Chromium only).
- **Place/Food/Dessert toggle** on Spin uses the same draggable lens, tinted with the accent colour.
- **Fixed photo backdrops**: Discover (Souq) and Spin (Corniche) have a dimmed photo fixed to the screen; hero card and "Can't decide?" bar are windows onto the same photo (photo stays still while content scrolls).
- **Spin moment**: accent hue cycles during spin; centred trippy layer (rotating neon stripes, counter-rotating beams, tunnel rings, masked radially to the wheel); landing fades the winning photo in as the background (Ken Burns 6s) and fires ~200 confetti pieces (burst + rain). Calm mode disables trippy layer + confetti.
- **Wheel slices** are full photos (clip-path wedges) with dark dividers.

### Voice
Gen Z English with light Arabic: yalla, habibi/habibti (from sign-up), shabab, wallah. Examples: "Let Night Shift cook", "Hold up… the wheel is cooking", "Saved. Taste is immaculate.", "That email looks sus."

### New screens / flows
1. **Auth** (start screen when signed out): Welcome → Sign up (3 steps: name+email → password with strength bar → Habibi / Habibti / Just vibes) or Log in (email, password, forgot). Validation errors in voice. User persisted locally.
2. **Setup** (after sign-up only, 4 steps, skippable): Location permission → Notifications → favourite vibes (multi) → budget preset (Broke era 0–60 / Balanced 50–150 / Bougie 150+ / No limits). Writes `loc`, `notif`, `favVibes`, default `mood`, `bMin/bMax`.
3. **AI tab** (replaced Saved in the tab bar): chat with the wheel. Prompt includes all 6 places, food/dessert/prices/deals, user's gender term, past night ratings. Mentioned places render as tappable cards with "Run it" (jumps to reveal). Suggestion chips, typing state, error + Retry. In production replace `window.claude.complete` with your own backend LLM call.
4. **Profile** with tabs Overview / Saved / History:
   - Header: avatar (edit), name, "Habibi era" tag, wheel; 7-pip spin streak.
   - Overview: Spin Wrapped card (top spot, top vibe, fav bite, share), stats, 6 badges, bonus wallet, wheel customisation link, theme picker (4 accents), shabab list + invite (+1 spin), settings (Calm mode, Notifications, Location, 3-spin limit), Edit profile sheet, Help & feedback sheet, Log out, Delete account (double-tap confirm).
5. **Squad spin (live)**: opens with just the host; Noor/Omar/Lulwa join over ~5s, each "Thinking…" then votes land; live vote bars; host can flip own vote; majority mood drives the spin. (Simulated — needs realtime backend.)
6. **Booking**: "Reserve a table" on the dinner stop → sheet with party size stepper (1–12) and time grid (7:00–10:30, 9:00 shown Full). Booked state changes the stop time and button.
7. **Neon route map** on Tonight's plan: dark grid, real coordinates for the 6 places, 3 numbered pins, animated dashed glowing route, other spots as faint dots, "X min between stops" and "Y min drive from you" chips. Each timeline stop shows the leg ("↓ 6 min walk · 450 m").
8. **QR bonus redemption**: tapping a bonus opens a QR sheet (code, 3h expiry countdown to the second, "Staff scanned it ✓" marks used, USED stamp). Wallet rows open the same sheet.
9. **Post-night rating**: Discover shows "How was {last spot}?" with 5 reactions (mid → core memory). Ratings feed the AI prompt.
10. **Spin refill**: 3 spins/night when the limit is on, refilling daily at 6 PM. Copy: "2 left · refills in 4h 12m" / "Out of spins. Refill in …".
11. **Budget range slider** in the vibe sheet (QAR 0–400+, two glass thumbs, step 10, live label "broke era / balanced queen / bougie mode / no limits"). Places have typical cost 35 / 100 / 200 per person.
12. **Heat mode**: May–Oct Discover shows "36° tonight. It's giving sauna." → "Stay cool" filters to indoor-friendly spots (Msheireb, Souq, The Pearl) on radar and wheel.
13. **States**: offline banner (navigator.onLine), AI failure + retry, empty states for saved/history/wallet/wrapped/radar/wheel.

### Additional state (persisted)
`user {name,email,g,avatar}`, `night` (refill key), `booking {i,fa,size,time}`, `favVibes`, `notif`, `loc`, `calm`, `squadUsed`, `bonusSpins`, `history[].rating`, `deals[].at` (unlock time for expiry).

### Mobile
On viewports < 560px the prototype drops the device frame, fake status bar and screen list and scales the 402px design to the screen width. In Expo, build natively at device size; respect safe areas.

### Added in round 3
- **Library**: 34 places (6 originals + 28 from `Doha_Night_Out_Places.xlsx`), all on the wheel by default; dense wheels (>10) use radial labels.
- **Lock it in** (no take-backs), **Mystery mode**, **Doha passport**, **What's on tonight**, **Local picks**, **Story card**, WhatsApp squad link, spin-only bonuses.

### Backend
See `BACKEND.md` for accounts, live squad, booking, push and opening hours.

### Still needed in the real app (not in the prototype)
- Real backend: auth, user data, squad realtime, bookings, deal validation (server-signed QR), notifications.
- Real venues (client is supplying the list) and real map tiles/routing (Mapbox/Google) styled to match the neon map.
- LLM endpoint for the AI tab.
