// A designed stand-in for places without a photo: a gradient in the place type's colour with its emoji,
// as an SVG data URL (no file, no network). Used by scripts/build-www.mjs.
const LOOK = {
  Restaurant: ['🍽️', 330], 'Café': ['☕', 28], Dessert: ['🍰', 300], Activity: ['🎢', 190], Trip: ['🏝️', 160], Spot: ['📍', 268],
};

export function placeholderPhoto(p) {
  const [emoji, hue] = LOOK[p.category] || LOOK.Spot;
  // a little variety between places of the same type
  let h = 0; for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) % 997;
  const a = (hue + (h % 30) - 15 + 360) % 360, b = (a + 40) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a},70%,38%)"/><stop offset="1" stop-color="hsl(${b},65%,14%)"/></linearGradient><pattern id="d" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="2" fill="rgba(255,255,255,0.08)"/></pattern></defs><rect width="800" height="600" fill="url(#g)"/><rect width="800" height="600" fill="url(#d)"/><text x="400" y="330" font-size="190" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  // no ';' or brackets in the URL: the design's inline-style parser splits on ';'
  return 'data:image/svg+xml,' + encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

export function withPhotos(places) {
  return places.map((p) => ((p.photos || []).length ? p : { ...p, photos: [placeholderPhoto(p)] }));
}
