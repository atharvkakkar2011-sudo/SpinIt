// Unit tests for the night planner (scripts/plan-places.mjs), the Explore categories
// (scripts/place-cats.mjs) and the Google Places mapping (scripts/enrich-places.mjs). No network.
//   node --test scripts/test-plan.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { applyMatch, lookUp } from './enrich-places.mjs';
import { categoryMap } from './place-cats.mjs';
import { distanceLabel, planPlaces } from './plan-places.mjs';

const places = JSON.parse(readFileSync(new URL('../supabase/seed-src/places.json', import.meta.url), 'utf8'));
const planned = planPlaces(places);
const byId = Object.fromEntries(planned.map((p) => [p.id, p]));
const PLACEHOLDERS = ['Food nearby', 'Something sweet nearby', 'Karak to go'];

test('every place gets a location', () => {
  assert.equal(planned.filter((p) => p.lat == null || p.lng == null).length, 0);
});

test('no placeholder dinner or dessert is left', () => {
  const left = planned.filter((p) => [...p.food, ...p.dessert].some((f) => PLACEHOLDERS.includes(f.name)));
  assert.deepEqual(left.map((p) => p.id), []);
});

test('the design’s hand-written picks are kept', () => {
  assert.equal(byId.katara.food[0].name, 'Seaside mezze');
  assert.equal(byId.katara.dessert[0].name, 'Kunafa & karak');
});

test('a restaurant with a placeholder suggests itself first', () => {
  const r = planned.find((p, i) => p.category === 'Restaurant' && places[i].food[0].name === 'Food nearby');
  if (r) assert.equal(r.food[0].name, r.name);
});

test('picks are real places from the list, never the same brand twice', () => {
  const names = new Set(planned.map((p) => p.name));
  for (const p of planned) {
    for (const list of [p.food, p.dessert]) {
      const brands = list.map((f) => f.name.split(/ [–-] | \(| at /)[0].toLowerCase());
      if (list[0].name !== list[1].name) assert.notEqual(brands[0], brands[1], `${p.id}: ${list[0].name} / ${list[1].name}`);
    }
  }
  assert.ok(names.has(byId['west-bay'].food[0].name));
});

test('far-away trips say so instead of pretending there is food nearby', () => {
  assert.equal(byId['dukhan-beach'].food[0].name, 'Eat before you go');
});

test('distance labels are honest about approximate locations', () => {
  const a = { lat: 25.32, lng: 51.52, area: 'West Bay' };
  assert.equal(distanceLabel(a, { lat: 25.3218, lng: 51.5221, area: 'West Bay' }), '300 m away');
  assert.equal(distanceLabel({ ...a, geo: 'area' }, { lat: 25.36, lng: 51.53, area: 'Katara' }), '~5 km away');
  assert.equal(distanceLabel({ ...a, geo: 'area' }, { ...a, geo: 'area' }), 'Also in West Bay');
});

test('every place is in at least one Explore category', () => {
  const m = categoryMap(places);
  assert.deepEqual(places.filter((p) => !m[p.id].length).map((p) => p.id), []);
  assert.ok(m['aspire-park'].includes('Fitness'));
  assert.ok(!m['hyatt-plaza'].includes('Fitness'));
});

test('Google match fills exact location, id, rating and a real price tier', () => {
  const p = { ...places.find((x) => x.lat == null), budgetSource: undefined };
  const c = { lat: 25.3700, lng: 51.5510 };
  const { place, note } = applyMatch({ ...p, area: 'The Pearl' }, { id: 'abc', location: { latitude: c.lat + 0.002, longitude: c.lng }, rating: 4.5, userRatingCount: 900, priceLevel: 'PRICE_LEVEL_MODERATE', displayName: { text: p.name } });
  assert.equal(note, null);
  assert.equal(place.google_place_id, 'abc');
  assert.equal(place.budget, 2);
  assert.equal(place.budgetSource, 'google');
  assert.equal(place.geo, undefined);
});

test('Google never overrides a budget from the spreadsheet, and flags far-off matches', () => {
  const p = { ...places[40], lat: 25.30, lng: 51.50, budget: 1, budgetSource: 'sheet' };
  const { place, note } = applyMatch(p, { id: 'x', location: { latitude: 25.10, longitude: 51.60 }, priceLevel: 'PRICE_LEVEL_EXPENSIVE', displayName: { text: 'Somewhere else' } });
  assert.equal(place.budget, 1);
  assert.match(note, /^check:/);
  assert.equal(applyMatch(p, null).note, 'not found');
});

test('the Google request asks for the right place and fields', async () => {
  let sent;
  const fake = async (url, init) => { sent = { url, init }; return { ok: true, json: async () => ({ places: [{ id: 'g1' }] }) }; };
  const g = await lookUp({ name: 'Zorba', area: 'The Pearl' }, { key: 'k', fetchImpl: fake });
  assert.equal(g.id, 'g1');
  assert.match(sent.url, /places:searchText$/);
  assert.equal(sent.init.headers['X-Goog-Api-Key'], 'k');
  assert.match(sent.init.headers['X-Goog-FieldMask'], /places.location/);
  assert.equal(JSON.parse(sent.init.body).textQuery, 'Zorba, The Pearl, Qatar');
});

// ---- directions (app-src/maps.js is a plain browser script) ----------------------------------------
import { runInNewContext } from 'node:vm';
const mapsCtx = { window: {} };
runInNewContext(readFileSync(new URL('../app-src/maps.js', import.meta.url), 'utf8'), mapsCtx);
const maps = mapsCtx.window.SpinItMaps;

test('directions: the whole night goes to Google Maps as one route, Apple Maps gets the first stop', () => {
  const kz = byId.kidzania;
  const l = maps.links([kz, kz.food[0], kz.dessert[0]]);
  const g = new URL(l.google), a = new URL(l.apple);
  assert.equal(l.stops, 3);
  assert.equal(g.searchParams.get('waypoints').split('|').length, 2);
  assert.equal(g.searchParams.get('destination'), `${kz.dessert[0].name}, Qatar`); // approximate location → by name
  assert.equal(a.searchParams.get('q'), kz.name);
});

test('directions: exact locations go by coordinates, hand-written picks are skipped', () => {
  const k = byId.katara; // real coordinates, design's own "Seaside mezze" pick isn't a place
  const l = maps.links([k, k.food[0], k.dessert[0]]);
  assert.equal(l.stops, 1);
  assert.equal(new URL(l.google).searchParams.get('destination'), `${k.lat},${k.lng}`);
  assert.equal(new URL(l.apple).searchParams.get('daddr'), `${k.lat},${k.lng}`);
});

// ---- "Other" vibe (app-src/vibe-ai.js is a plain browser script) -----------------------------------------
const vibeCtx = { window: {}, setTimeout, Promise };
runInNewContext(readFileSync(new URL('../app-src/vibe-ai.js', import.meta.url), 'utf8'), vibeCtx);
const vibe = vibeCtx.window.SpinItVibe;
const vctx = { places: planned, moods: ['Chill', 'Romantic', 'Adventurous', 'Family'], kinds: ['Café', 'Restaurants', 'Entertainment', 'Fitness', 'Culture'] };

test('vibe: an AI answer that fits keeps only real place ids', () => {
  const r = vibe.parse('Here you go {"fits": true, "label": "Souq night", "ids": ["souq", "made-up", "souq", "katara"], "say": "Old Doha it is."}', vctx);
  assert.equal(r.kind, 'custom');
  assert.deepEqual([...r.ids], ['souq', 'katara']);
  assert.equal(r.label, 'Souq night');
});

test('vibe: when nothing fits, the AI fallback is limited to the sheet’s own options', () => {
  const r = vibe.parse('{"fits": false, "ids": [], "fallback": {"mood": "Sleepy", "setting": "Outdoor", "kinds": ["Fitness", "Spaceships"]}}', vctx);
  assert.equal(r.kind, 'fallback');
  assert.equal(r.mood, null);
  assert.equal(r.setting, 'Outdoor');
  assert.deepEqual([...r.kinds], ['Fitness']);
  assert.equal(vibe.parse('not json at all', vctx), null);
});

test('vibe: without an AI, known vibes map to the sheet, place words narrow the wheel, nonsense becomes Chill', async () => {
  const date = await vibe.interpret('romantic date night', vctx);
  assert.equal(date.kind, 'fallback'); assert.equal(date.mood, 'Romantic');
  const beach = await vibe.interpret('beach day', vctx);
  assert.equal(beach.kind, 'custom'); assert.ok(beach.ids.length >= 2);
  const junk = await vibe.interpret('asdkjh qwe zzz', vctx);
  assert.equal(junk.kind, 'fallback'); assert.equal(junk.mood, 'Chill');
});
