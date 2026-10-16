// Turns the place list into real nights out:
//   1. every place gets a location: its own, or (until scripts/enrich-places.mjs runs with a Google key)
//      the centre of its area, marked geo: 'area' so distances are shown as approximate;
//   2. placeholder dinner/dessert picks ("Food nearby", "Something sweet nearby", "Karak to go") are
//      replaced by the nearest real restaurants and dessert/coffee spots from the same list.
// Hand-written picks (the design's own, or ones from the spreadsheet) are kept as they are.
// Used by scripts/build-www.mjs (what the app shows) and scripts/gen-seed.mjs (what the database holds).

// Approximate centres of Doha areas, used only when a place has no coordinates of its own.
export const AREA_CENTRES = {
  'Lusail': [25.4205, 51.4950], 'West Bay': [25.3220, 51.5280], 'West Bay Lagoon': [25.3720, 51.5200],
  'Katara': [25.3600, 51.5260], 'Doha': [25.2854, 51.5310], 'Msheireb': [25.2860, 51.5250],
  'Old Doha': [25.2875, 51.5340], 'Souq Waqif': [25.2867, 51.5333], 'Old Doha Port': [25.2950, 51.5480],
  'Al Corniche': [25.3000, 51.5270], 'Al Bidda': [25.2970, 51.5220], 'Fereej Bin Mahmoud': [25.2790, 51.5100],
  'The Pearl': [25.3700, 51.5510], 'Gewan Island': [25.3850, 51.5550], 'Aspire': [25.2630, 51.4430],
  'Aspire Zone': [25.2630, 51.4430], 'Al Waab': [25.2620, 51.4720], 'Al Rayyan': [25.2920, 51.4240],
  'Al Markhiya': [25.3330, 51.4890], 'Umm Salal Mohammed': [25.4100, 51.4030], 'Al Wusail': [25.4720, 51.4750],
  'Al Wakrah': [25.1715, 51.6035], 'Al Shahaniya': [25.3700, 51.2200],
};

const FOOD_PLACEHOLDERS = new Set(['Food nearby']);
const SWEET_PLACEHOLDERS = new Set(['Something sweet nearby', 'Karak to go']);
const TIER_PRICE = { 1: 'Under QAR 60', 2: 'QAR 60–150', 3: 'QAR 150+' };
const MAX_PAIR_KM = 15;
const FAR_FOOD = { tag: 'Pack food', name: 'Eat before you go', note: 'Nothing on our list within 15 km. Pack a picnic or plan dinner back in Doha.', price: 'Your call' };
const FAR_SWEET = { tag: 'Karak', name: 'Karak on the drive back', note: 'Grab one at a petrol station on the way home.', price: 'QAR 1–5' }; // further than this and we keep the place's own picks

export function km(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceLabel(from, to) {
  const approx = from.geo === 'area' || to.geo === 'area';
  if (approx && from.area === to.area) return `Also in ${to.area}`;
  const d = km(from, to);
  if (approx) return d < 1 ? `Also in ${to.area}` : `~${Math.round(d)} km away`;
  if (d < 1) return `${Math.max(50, Math.round(d * 1000 / 50) * 50)} m away`;
  return `${d < 10 ? d.toFixed(1) : Math.round(d)} km away`;
}

const GENERIC_VIBES = new Set(['Dinner plans just got an upgrade', 'Coffee dates, catch-up energy']);

// One short line about the pick: its own vibe, or the first sentence of its description when the vibe
// is the spreadsheet's generic filler.
function blurb(t) {
  if (t.vibe && !GENERIC_VIBES.has(t.vibe)) return t.vibe;
  let first = (t.about || '').split(/(?<=\.)\s/)[0].replace(/\.$/, '').replace(/^Stop in for /, '');
  first = first.charAt(0).toUpperCase() + first.slice(1);
  return first.length <= 70 ? first : first.slice(0, 67).replace(/\s+\S*$/, '') + '…';
}

function pick(place, target, isSelf) {
  // a tier price only when the budget is real (from the sheet or Google), never a category guess
  const price = target.price && target.price !== 'Price varies' ? target.price : (target.budgetSource && TIER_PRICE[target.budget]) || 'Price varies';
  return {
    // where it is, so directions can route through it (app-src/maps.js)
    lat: target.lat, lng: target.lng, ...(target.geo ? { geo: target.geo } : {}), ...(target.google_place_id ? { google_place_id: target.google_place_id } : {}),
    tag: target.short,
    name: target.name,
    note: isSelf ? blurb(target) || 'Right here.' : [distanceLabel(place, target), blurb(target)].filter(Boolean).join(' · '),
    price,
  };
}

function nearest(place, pool, n) {
  return pool
    .filter((c) => c.id !== place.id)
    .map((c) => ({ c, d: km(place, c) }))
    .filter((x) => x.d <= MAX_PAIR_KM)
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.c);
}

export function planPlaces(input) {
  const places = input.map((p) => {
    if (p.lat != null && p.lng != null) return { ...p };
    const c = AREA_CENTRES[p.area] || AREA_CENTRES.Doha;
    return { ...p, lat: c[0], lng: c[1], geo: 'area' };
  });
  const restaurants = places.filter((p) => p.category === 'Restaurant');
  const sweets = places.filter((p) => p.category === 'Dessert' || p.category === 'Café');

  return places.map((p) => ({
    ...p,
    food: fill(p, p.food, FOOD_PLACEHOLDERS, p.category === 'Restaurant', restaurants, FAR_FOOD),
    dessert: fill(p, p.dessert, SWEET_PLACEHOLDERS, p.category === 'Dessert' || p.category === 'Café', sweets, FAR_SWEET),
  }));
}

// Swap placeholder picks for real ones: the place itself first when it is that kind of place, then the
// nearest others. The design always shows two alternatives, so a missing second one repeats the first.
function fill(place, list, placeholders, selfFirst, pool, farAway) {
  if (!list.some((f) => placeholders.has(f.name))) return list;
  // one pick per brand: "CHAC’LATE" and "CHAC’LATE – Mina District" count as the same
  const brand = (n) => n.split(/ [–-] | \(| at /)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const have = new Set(list.filter((f) => !placeholders.has(f.name)).map((f) => brand(f.name)));
  const targets = [];
  for (const t of [...(selfFirst ? [place] : []), ...nearest(place, pool, 6)]) {
    if (targets.length < 2 && !have.has(brand(t.name))) { targets.push(t); have.add(brand(t.name)); }
  }
  // nothing on the list within reach (desert, far beaches): say so instead of pretending
  if (!targets.length) return list.map((f) => (placeholders.has(f.name) ? farAway : f));
  const real = targets.map((t) => pick(place, t, t.id === place.id));
  const out = list.map((f) => (placeholders.has(f.name) && real.length ? real.shift() : f));
  return out.map((f) => (placeholders.has(f.name) ? out.find((g) => !placeholders.has(g.name)) || f : f));
}

// What the app needs to change on places it already ships inside the design (the first 34).
export function overridesFor(planned, ids) {
  const keep = new Set(ids);
  return Object.fromEntries(planned.filter((p) => keep.has(p.id)).map((p) => [p.id, { lat: p.lat, lng: p.lng, geo: p.geo, food: p.food, dessert: p.dessert }]));
}
