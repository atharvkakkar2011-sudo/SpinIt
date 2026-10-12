// Looks every place up on Google Places and fills in what the spreadsheet didn't have:
// exact location, Google place id (so the weekly opening-hours refresh works), rating, and a real
// price level where the budget was only guessed from the category.
//
//   GOOGLE_PLACES_API_KEY=... node scripts/enrich-places.mjs          # updates supabase/seed-src/places.json
//   GOOGLE_PLACES_API_KEY=... node scripts/enrich-places.mjs --dry    # only prints what it would change
//   ... --all                                                        # re-check places that already have a Google id
//
// Then: node scripts/gen-seed.mjs, and rebuild. Matches it isn't sure about are listed for you to check.
// Google's photos are not copied: their terms don't allow storing them.
import { readFileSync, writeFileSync } from 'node:fs';
import { AREA_CENTRES, km } from './plan-places.mjs';

const PLACES = 'supabase/seed-src/places.json';
const FIELDS = ['places.id', 'places.displayName', 'places.location', 'places.priceLevel', 'places.priceRange', 'places.rating', 'places.userRatingCount', 'places.formattedAddress'].join(',');
const TIER = { PRICE_LEVEL_FREE: 1, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 3 };
const QATAR = { low: { latitude: 24.4, longitude: 50.7 }, high: { latitude: 26.2, longitude: 51.7 } };

export async function lookUp(place, { key, fetchImpl = fetch }) {
  const res = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({ textQuery: `${place.name}, ${place.area}, Qatar`, locationRestriction: { rectangle: QATAR }, maxResultCount: 1 }),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).places?.[0] || null;
}

// What to change on one place, given Google's best match (pure, so it can be tested without Google).
export function applyMatch(place, g) {
  if (!g?.location) return { place, note: 'not found' };
  const out = { ...place, lat: g.location.latitude, lng: g.location.longitude, google_place_id: g.id };
  delete out.geo;
  if (g.rating) { out.rating = g.rating; out.ratingCount = g.userRatingCount || 0; }
  if (TIER[g.priceLevel] && place.budgetSource !== 'sheet') { out.budget = TIER[g.priceLevel]; out.budgetSource = 'google'; }
  const r = g.priceRange;
  if (r?.startPrice?.units && (!place.price || place.price === 'Price varies')) {
    out.price = `QAR ${r.startPrice.units}${r.endPrice?.units ? '–' + r.endPrice.units : '+'} per person`;
  }
  // a match far from where the sheet says the place is is probably the wrong place
  const centre = AREA_CENTRES[place.area];
  const far = place.lat != null ? km(place, out) > 3 : centre ? km({ lat: centre[0], lng: centre[1] }, out) > 8 : false;
  return { place: out, note: far ? `check: matched “${g.displayName?.text}”, ${g.formattedAddress}` : null };
}

async function main() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) { console.error('Set GOOGLE_PLACES_API_KEY (Google Cloud → APIs → Places API (New) → Credentials).'); process.exit(1); }
  const dry = process.argv.includes('--dry'), all = process.argv.includes('--all');
  const places = JSON.parse(readFileSync(PLACES, 'utf8'));
  const review = [];
  let updated = 0;
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    if (p.google_place_id && !all) continue;
    try {
      const { place, note } = applyMatch(p, await lookUp(p, { key }));
      if (note) review.push(`${p.id}: ${note}`);
      if (note === 'not found' || note?.startsWith('check')) continue; // leave doubtful ones for a person
      places[i] = place; updated++;
      console.log(`✓ ${p.id}  ${place.lat.toFixed(4)},${place.lng.toFixed(4)}  tier ${place.budget}${place.rating ? '  ★' + place.rating : ''}`);
    } catch (e) { review.push(`${p.id}: ${e.message}`); }
    await new Promise((r) => setTimeout(r, 120)); // stay well under the rate limit
  }
  if (!dry) writeFileSync(PLACES, JSON.stringify(places, null, 1) + '\n');
  console.log(`\n${updated} places ${dry ? 'would be ' : ''}updated.`);
  if (review.length) console.log(`\nCheck these by hand (not changed):\n  ${review.join('\n  ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
