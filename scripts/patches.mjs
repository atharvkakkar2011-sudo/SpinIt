import { PALETTE, THEMES, jsColour, recolour } from './palette.mjs';
// The prototype's markup and styling are left untouched. These patches change only its logic: where
// data is stored, who decides a spin, and which native feature a button reaches. Each patch must
// match the original source exactly once, so a changed prototype fails the build instead of
// silently shipping half-connected.
//
// `window.SpinIt` is defined in app-src/bridge (see index.js).

const SQUAD_SIM = String.raw`  startSquad() {
    (this._sq || []).forEach(clearTimeout); this._sq = [];
    this.setState({ squad: [{ name: 'You', initial: ((this.state.user && this.state.user.name) || 'A')[0].toUpperCase(), vote: this.state.mood || 'Chill' }] });
    const F = [['Noor', 'N', '#F5EEF6', 'Romantic', 1100], ['Omar', 'O', '#9C8FA4', 'Chill', 2600], ['Lulwa', 'L', '#FFB23D', 'Adventurous', 4300]];
    F.forEach(([name, initial, av, vote, t]) => {
      this._sq.push(setTimeout(() => { this.setState(st => ({ squad: [...(st.squad || []), { name, initial, av, justJoined: true }] })); this.say(name + ' pulled up 👀'); }, t));
      this._sq.push(setTimeout(() => this.setState(st => ({ squad: (st.squad || []).map(x => x.name === name ? { ...x, vote, justJoined: false } : x) })), t + 1300 + Math.random() * 900));
    });
  }
`;

// saved accents that are no longer options (Sunset, before and after the palette swap, and the brief violet)
// become Desert gold; written so recolour() leaves the keys alone
const oldAccents = () => '({ ' + ['#FFB23D', '#F0A35E', '#9D6BFF'].map((c) => `[${jsColour(c)}]: '${THEMES[0][0]}'`).join(', ') + ' })';

// Profile → Theme, moved above the Doha passport (exact text from the design)
const THEME_BLOCK = "\n            <div style=\"display:flex;align-items:baseline;justify-content:space-between;margin-top:26px\"><div style=\"font-family:'Unbounded',sans-serif;font-size:17px;font-weight:700;color:#FFFFFF\">Theme</div></div>\n            <div style=\"display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px\">\n              <sc-for list=\"{{ themeOpts }}\" as=\"c\" hint-placeholder-count=\"4\">\n                <div onClick=\"{{ c.pick }}\" style=\"display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 4px;border-radius:16px;border:1.5px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.07);backdrop-filter:blur(8px) saturate(160%);-webkit-backdrop-filter:blur(8px) saturate(160%);box-shadow:inset 0 1px 1px rgba(255,255,255,0.35);cursor:pointer;border-color:{{ c.bd }}\">\n                  <div style=\"width:34px;height:34px;border-radius:50%;background:{{ c.v }};box-shadow:0 0 16px {{ c.v }}\"></div>\n                  <div style=\"font-size:11.5px;font-weight:600;color:#FFFFFF;text-align:center\">{{ c.name }}</div>\n                </div>\n              </sc-for>\n            </div>\n\n";
const PASSPORT_HEAD = "            <div style=\"display:flex;align-items:baseline;justify-content:space-between;margin-top:26px\"><div style=\"font-family:'Unbounded',sans-serif;font-size:17px;font-weight:700;color:#FFFFFF\">Doha passport</div>";

export const patches = [
  // ---- document head: local scripts, offline fonts, safe-area viewport ------------------------------
  // With 150+ places the wheel can't show everything: it shows at most 25 of the places that match,
  // a random set per app open, and a respin deals a new set. The server only picks from what's shown.
  {
    name: 'wheel: at most 25 slices',
    find: '  wheelList(s) { return this.P.map((p, i) => ({ p, i })).filter(x => s.wheel[x.p.id] && this.matches(x.p, s)); }',
    replace: [
      '  WHEEL_MAX = 25;',
      '  _seed0 = (Math.random() * 1e9) | 0;',
      '  wheelList(s) {',
      '    const all = this.P.map((p, i) => ({ p, i })).filter(x => s.wheel[x.p.id] && this.matches(x.p, s));',
      '    if (all.length <= this.WHEEL_MAX) return all;',
      '    const seed = s.wheelSeed ?? this._seed0, h = id => { let v = 2166136261 ^ seed; for (let c = 0; c < id.length; c++) v = Math.imul(v ^ id.charCodeAt(c), 16777619); return v >>> 0; };',
      '    return all.map(x => [h(x.p.id), x]).sort((a, b) => a[0] - b[0]).slice(0, this.WHEEL_MAX).map(([, x]) => x);',
      '  }',
    ].join('\n'),
  },
  // Owner asked (preview comment, Oct 2026) to remove the "Tonight's main character" hero card from Explore.
  {
    name: 'explore: no "Tonight\u2019s main character" hero card',
    find: "          <div onClick=\"{{ openHero }}\" style=\"position:relative;margin:16px 14px 0 14px;height:340px;border-radius:24px;overflow:hidden;clip-path:inset(0 round 24px);cursor:pointer;background:linear-gradient(180deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.02) 100%);box-shadow:inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -1px 1px rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.25);\">\n            <div style=\"position:fixed;left:0;top:0;width:402px;height:874px;background-image:url(./img/s/souq-2.jpg);background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none\"></div>\n            <div style=\"position:absolute;left:0;right:0;bottom:0;height:200px;background:linear-gradient(180deg,rgba(14,10,18,0) 0%,rgba(14,10,18,0.92) 100%)\"></div>\n            <div style=\"position:absolute;left:16px;top:16px;height:28px;padding:0 12px;border-radius:14px;background:{{ acc }};color:#0E0A12;font-family:'Space Mono',monospace;font-size:11.5px;font-weight:700;letter-spacing:1px;display:flex;align-items:center;box-shadow:0 0 18px {{ accGlow }}\">TONIGHT\u2019S MAIN CHARACTER</div>\n            <div style=\"position:absolute;left:20px;right:20px;bottom:20px;color:#FFFFFF\">\n              <div style=\"font-family:'Unbounded',sans-serif;font-size:32px;font-weight:800;line-height:1.05;letter-spacing:-1px\">Souq<br />after dark.</div>\n              <div style=\"font-size:14.5px;color:#D9CEDD;margin-top:8px\">Lanterns, spice and karak. Lowkey better after midnight.</div>\n            </div>\n          </div>\n",
    replace: '',
  },
  // Owner asked (preview comment, Oct 2026) to remove the "DOHA · time" label next to the Explore logo.
  {
    name: 'explore: no "DOHA · time" label',
    find: "<span style=\"font-family:'Space Mono',monospace;font-size:12px;letter-spacing:1.5px;color:#9C8FA4\">DOHA · {{ nowTime }}</span>",
    replace: '',
  },
  // Owner's Explore categories (Oct 2026). Membership comes from scripts/place-cats.mjs via places-extra.js;
  // seven chips don't fit in one row, so the row scrolls sideways and each chip sizes to its label.
  {
    name: 'explore: owner\u2019s categories',
    find: "CHIPS = ['Food', 'Coffee', 'Culture', 'Outdoors'];",
    replace: "CHIPS = ['Restaurants', 'Outdoor', 'Indoor', 'Coffee shops', 'Entertainment', 'Fitness', 'Culture'];",
  },
  {
    name: 'explore: a category chip filters by the place\u2019s categories',
    find: '(!s.chip || x.p.tags.includes(s.chip))',
    replace: '(!s.chip || ((window.SPINIT_PLACE_CATS || {})[x.p.id] || []).includes(s.chip))',
  },
  {
    name: 'explore: category row scrolls sideways',
    find: '<div style="display:flex;gap:8px;padding:12px 14px 0 14px">',
    replace: '<div style="display:flex;gap:8px;padding:12px 14px 0 14px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch">',
  },
  {
    name: 'explore: category chips size to their label',
    find: 'saturate(160%);flex:1;height:40px;border-radius:12px;',
    replace: 'saturate(160%);flex:none;padding:0 16px;white-space:nowrap;height:40px;border-radius:12px;',
  },
  // Directions open the phone's maps app (app-src/maps.js): the night plan routes place → dinner → dessert.
  {
    name: 'explore: directions open Apple Maps or Google Maps',
    find: "directions: () => window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((s.screen === 'detail' ? d.name : r.name) + ', Doha, Qatar'), '_blank'),",
    replace: "directions: () => window.SpinItMaps.go(s.screen === 'detail' ? [d] : s.screen === 'evening' ? [r, food, des] : [r]),",
  },
  {
    name: 'explore: mystery drive opens Apple Maps or Google Maps',
    find: "window.open('https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(r.name + ', Doha'), '_blank');",
    replace: 'window.SpinItMaps.go([r]);',
  },
  // A more satisfying wheel (app-src/wheel-fx.js): rainbow slices over the photos, white pegs on the
  // rim, a pointer that flicks on every peg with a tick sound and haptic, and a longer spin with a slow,
  // suspenseful finish.
  {
    name: 'wheel: rainbow slices',
    find: "shade: k % 2 ? 'rgba(14,10,18,0.42)' : 'rgba(14,10,18,0.28)'",
    replace: "shade: 'hsla(' + Math.round(k * 360 / n) + ',92%,56%,0.8)'",
  },
  {
    name: 'wheel: white slice dividers and rim pegs',
    find: 'background:#0E0A12;transform-origin:50% 100%;transform:{{ d.tf }}"></div>\n                    </sc-for>',
    replace: 'background:rgba(255,255,255,0.85);transform-origin:50% 100%;transform:{{ d.tf }}"></div>\n                    </sc-for>\n                    <sc-for list="{{ pegs }}" as="g" hint-placeholder-count="6">\n                      <div data-spinit-peg="1" style="position:absolute;left:50%;top:50%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:#FFFFFF;box-shadow:0 1px 3px rgba(0,0,0,0.7);transform:{{ g.tf }}"></div>\n                    </sc-for>',
  },
  {
    name: 'wheel: pegs on the rim',
    find: 'rot: s.rot, wheelBg, wedges, dividers, segs,',
    replace: "rot: s.rot, wheelBg, wedges, dividers, segs, pegs: dividers.map(d => ({ tf: d.tf + ' translateY(-147px)' })),",
  },
  {
    name: 'wheel: longer spin with a slow finish',
    find: '<div style="position:absolute;inset:0;transform:rotate({{ rot }}deg);transition:transform 4.2s cubic-bezier(0.12,0.72,0.14,1)">',
    replace: '<div id="spinit-rotor" style="position:absolute;inset:0;transform:rotate({{ rot }}deg);transition:transform 5.8s cubic-bezier(0.12,0.7,0.08,1)">',
  },
  {
    name: 'wheel: more turns',
    find: 'cur + 360 * 5 + delta',
    replace: 'cur + 360 * 8 + delta',
  },
  {
    name: 'wheel: background effects last the whole spin',
    find: 'tripSpin 4.4s',
    replace: 'tripSpin 6s',
  },
  {
    name: 'wheel: background effects last the whole spin (2)',
    find: 'tripRev 4.4s',
    replace: 'tripRev 6s',
  },
  {
    name: 'wheel: pointer flicks on each peg',
    find: '<div style="position:absolute;left:147px;top:-16px;width:28px;height:34px;',
    replace: '<div id="spinit-pointer" style="position:absolute;left:147px;top:-16px;width:28px;height:34px;transform-origin:50% 0;',
  },
  {
    name: 'wheel: ticks, haptics and chime start with the spin',
    find: 'this._hi = setInterval(() => this.setState(st => ({ hue:',
    replace: 'if (window.SpinItWheelFx) window.SpinItWheelFx.start({ calm: this.state.calm });\n    this._hi = setInterval(() => this.setState(st => ({ hue:',
  },
  // A real map on the night plan (Leaflet, app-src/plan-map.js) over the design's drawn one, with the real
  // positions of the place, dinner and dessert; walk/drive times use the same real positions.
  {
    name: 'map: real positions for dinner and dessert',
    find: 'const g0 = GEO[r.id] || [25.2867, 51.526], o = OFF[s.result % 6];\n        const pts = [g0, [g0[0] + o[0], g0[1] + o[1]], [g0[0] + o[2], g0[1] + o[3]]];',
    replace: 'const g0 = r.lat != null ? [r.lat, r.lng] : GEO[r.id] || [25.2867, 51.526], o = OFF[s.result % 6];\n        const fd = r.food[s.foodAlt] || {}, ds = r.dessert[s.dessertAlt] || {};\n        const pts = [g0, fd.lat != null ? [fd.lat, fd.lng] : [g0[0] + o[0], g0[1] + o[1]], ds.lat != null ? [ds.lat, ds.lng] : [g0[0] + o[2], g0[1] + o[3]]];',
  },
  {
    name: 'map: stop-list travel times use the real positions too',
    find: 'const p1 = [g[0] + O[0], g[1] + O[1]], p2 = [g[0] + O[2], g[1] + O[3]];',
    replace: 'const p1 = food && food.lat != null ? [food.lat, food.lng] : [g[0] + O[0], g[1] + O[1]], p2 = des && des.lat != null ? [des.lat, des.lng] : [g[0] + O[2], g[1] + O[3]];',
  },
  {
    name: 'map: stops in the same spot read "nearby", not "0 m"',
    find: "(km < 1 ? Math.round(km * 100) * 10 + ' m' : km.toFixed(1) + ' km')",
    replace: "(km < 0.05 ? 'nearby' : km < 1 ? Math.round(km * 100) * 10 + ' m' : km.toFixed(1) + ' km')",
  },
  {
    name: 'map: stops in the same spot read "nearby", not "0 m" (map chips)',
    find: "const fmt = km => km < 1 ? Math.round(km * 1000 / 10) * 10 + ' m' : km.toFixed(1) + ' km';",
    replace: "const fmt = km => km < 0.05 ? 'nearby' : km < 1 ? Math.round(km * 1000 / 10) * 10 + ' m' : km.toFixed(1) + ' km';",
  },
  {
    name: 'map: draw the plan on a real map',
    find: 'routePts: P3.map(',
    replace: "planMap: (s.screen === 'evening' && window.SpinItPlanMap && setTimeout(() => window.SpinItPlanMap.sync([{ lat: g0[0], lng: g0[1], name: r.name, label: r.short, approx: r.geo === 'area', geo: r.geo }, fd.lat != null && { lat: fd.lat, lng: fd.lng, name: fd.name, label: fd.tag, approx: fd.geo === 'area', geo: fd.geo }, ds.lat != null && { lat: ds.lat, lng: ds.lng, name: ds.name, label: ds.tag, approx: ds.geo === 'area', geo: ds.geo }], A), 0), ''),\n          routePts: P3.map(",
  },
  {
    name: 'map: map box under the travel chips',
    find: '<div style="position:absolute;left:12px;bottom:10px;display:flex;gap:6px">',
    replace: '<div id="spinit-map" style="position:absolute;inset:0;z-index:1;background:#0E0A12"></div>\n              <div style="position:absolute;left:12px;bottom:10px;display:flex;gap:6px;z-index:2;pointer-events:none">',
  },
  // Photos never leave a blank card: a backdrop sits under every photo (shows if a web photo fails to
  // load), and built-in stand-ins (data: URLs from scripts/photo-fallback.mjs) are used as they are.
  {
    name: 'explore: photos always show something',
    find: "I = n => /^https?:/.test(n) ? 'url(\"' + n + '\")' : 'url(./img/s/' + n + '.jpg)';",
    replace: "I = n => (!n ? '' : (/^(https?:|data:)/.test(n) ? 'url(\"' + n + '\")' : 'url(./img/s/' + n + '.jpg)') + ', ') + 'radial-gradient(circle at 30% 20%, #3A2350 0%, #1C1424 55%, #0E0A12 100%)';",
  },
  // Owner's pre-spin filters (vibe sheet): WHERE (Indoor / Outdoor / Both) and WHAT KIND OF PLACE
  // (Café, Restaurants, Entertainment, Fitness, Culture; several allowed, none = everything). Kinds use the
  // same categories as the Explore chips (scripts/place-cats.mjs); indoor uses the design's INDOOR list.
  {
    name: 'filters: the wheel honours where and what kind',
    find: 'matches(p, s) { if (s.mood && !p.moods.includes(s.mood)) return false;',
    replace: "KINDS = ['Café', 'Restaurants', 'Entertainment', 'Fitness', 'Culture'];\n  matches(p, s) { if (s.mood && !p.moods.includes(s.mood)) return false; if (s.setting === 'Indoor' && !this.INDOOR[p.id]) return false; if (s.setting === 'Outdoor' && this.INDOOR[p.id]) return false; if ((s.kinds || []).length) { const c = (window.SPINIT_PLACE_CATS || {})[p.id] || []; if (!s.kinds.some(k => c.includes(k === 'Café' ? 'Coffee shops' : k))) return false; }",
  },
  {
    name: 'filters: where and what-kind choices in the vibe sheet',
    find: "{ label: 'VIBE', opts: this.MOODS.map(m => ({ label: m, on: s.mood === m, pick: () => this.setState({ mood: s.mood === m ? null : m }) })) }",
    replace: "{ label: 'VIBE', opts: this.MOODS.map(m => ({ label: m, on: s.mood === m, pick: () => this.setState({ mood: s.mood === m ? null : m }) })) },\n        { label: 'WHERE', opts: ['Indoor', 'Outdoor', 'Both'].map(w => ({ label: w, on: (s.setting || 'Both') === w, pick: () => this.setState({ setting: w }) })) },\n        { label: 'WHAT KIND OF PLACE', opts: this.KINDS.map(k => { const on = (s.kinds || []).includes(k); return { label: k, on, pick: () => this.setState(st => ({ kinds: on ? (st.kinds || []).filter(x => x !== k) : [...(st.kinds || []), k] })) }; }) }",
  },
  {
    name: 'filters: reset clears where and what kind',
    find: 'resetFilters: () => { this.setState({ mood: null, budget: null, bMin: 0, bMax: 400 });',
    replace: "resetFilters: () => { this.setState({ mood: null, budget: null, bMin: 0, bMax: 400, setting: 'Both', kinds: [] });",
  },
  {
    name: 'filters: the filter count includes where and what kind',
    find: 'const filterCount = (s.mood ? 1 : 0) + (budgetOn ? 1 : 0);',
    replace: "const filterCount = (s.mood ? 1 : 0) + (budgetOn ? 1 : 0) + (s.setting && s.setting !== 'Both' ? 1 : 0) + ((s.kinds || []).length ? 1 : 0);",
  },
  {
    name: 'filters: the pills under the wheel show what kind / where when chosen',
    find: "pills: [s.mood || 'Any vibe', budgetLabel, s.who].map((l, k) => { const on = (k === 0 && s.mood) || (k === 1 && budgetOn);",
    replace: "pills: [s.mood || 'Any vibe', budgetLabel, (s.kinds || []).length ? s.kinds[0] + (s.kinds.length > 1 ? ' +' + (s.kinds.length - 1) : '') : s.setting && s.setting !== 'Both' ? s.setting : s.who].map((l, k) => { const on = (k === 0 && s.mood) || (k === 1 && budgetOn) || (k === 2 && ((s.kinds || []).length || (s.setting && s.setting !== 'Both')));",
  },
  // Short phones: the wheel shrinks so YALLA SPIN stays above the tab bar (app-src/layout-fit.js), and the
  // vibe sheet scrolls instead of running off the top of the screen.
  {
    name: 'fit: the wheel box can shrink on short screens',
    find: '<div style="position:relative;width:322px;height:322px;margin-top:26px;flex:none">',
    replace: '<div id="spinit-wheelbox" style="position:relative;width:322px;height:322px;margin-top:26px;flex:none">',
  },
  {
    name: 'fit: the vibe sheet scrolls when the screen is short',
    find: '<sc-if value="{{ isMoodSheet }}" hint-placeholder-val="{{ false }}">\n        <div onClick="{{ closeSheet }}" style="position:absolute;inset:0;background:rgba(0,0,0,0.6);z-index:40;animation:fadeIn .2s ease">\n          <div onClick="{{ stopProp }}" style="position:absolute;left:0;bottom:0;',
    replace: '<sc-if value="{{ isMoodSheet }}" hint-placeholder-val="{{ false }}">\n        <div onClick="{{ closeSheet }}" style="position:absolute;inset:0;background:rgba(0,0,0,0.6);z-index:40;animation:fadeIn .2s ease">\n          <div id="spinit-vibe-sheet" onClick="{{ stopProp }}" style="max-height:100%;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box;position:absolute;left:0;bottom:0;',
  },
  // Places added after the design (docs/design/Doha_120_New_Places.xlsx) join the library.
  {
    name: 'places: extra places join the library',
    find: 'this.P = [...this.P, ...this.LIB];',
    replace: 'this.P = [...this.P, ...this.LIB, ...(window.SPINIT_EXTRA_PLACES || [])].map(p => ({ ...p, ...((window.SPINIT_PLACE_OVERRIDES || {})[p.id] || {}) }));',
  },
  {
    name: 'places: extra indoor places count for the cool-off filter',
    find: 'Object.fromEntries(this.LIB.filter(p => p.indoor)',
    replace: 'Object.fromEntries([...this.LIB, ...(window.SPINIT_EXTRA_PLACES || [])].filter(p => p.indoor)',
  },
  {
    name: 'head: load config, React, bridge before the runtime',
    find: '<script src="./support.js"></script>',
    replace: '<script src="./config.js"></script>\n<script src="./places-extra.js"></script>\n<script src="./maps.js"></script>\n<script src="./wheel-fx.js"></script>\n<script src="./layout-fit.js"></script>\n<script src="./vibe-ai.js"></script>\n<link rel="stylesheet" href="./vendor/leaflet/leaflet.css" />\n<script src="./vendor/leaflet/leaflet.js"></script>\n<script src="./plan-map.js"></script>\n<script src="./react.production.min.js"></script>\n<script src="./react-dom.production.min.js"></script>\n<script src="./spinit-bridge.js"></script>\n<script src="./support.js"></script>',
  },
  {
    name: 'head: full-bleed viewport for notches',
    find: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    replace: '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">',
  },
  {
    name: 'fonts: ship the same Google Fonts subsets inside the app',
    find: [
      '<link rel="preconnect" href="https://fonts.googleapis.com" />',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="crossorigin" />',
      '<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Instrument+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />',
    ].join('\n'),
    replace: '<link href="./fonts/fonts.css" rel="stylesheet" />',
  },
  {
    name: 'props: spin limit default (unlimited for now; the server decides per profile)',
    find: '&quot;unlimitedSpins&quot;:{&quot;editor&quot;:&quot;boolean&quot;,&quot;default&quot;:true',
    // unlimited for now (supabase/migrations/…_unlimited_spins_for_now.sql); set this to false with the limit
    replace: '&quot;unlimitedSpins&quot;:{&quot;editor&quot;:&quot;boolean&quot;,&quot;default&quot;:true',
  },
  {
    name: 'props: hide the demo screen list',
    find: '&quot;showScreenList&quot;:{&quot;editor&quot;:&quot;boolean&quot;,&quot;default&quot;:true',
    replace: '&quot;showScreenList&quot;:{&quot;editor&quot;:&quot;boolean&quot;,&quot;default&quot;:false',
  },

  // ---- squad code shown on screen was hard-coded in the markup ---------------------------------------
  {
    name: 'markup binding: squad code',
    find: 'text-shadow:0 0 14px {{ accGlow }}">SPIN-4821</div>',
    replace: 'text-shadow:0 0 14px {{ accGlow }}">{{ squadCode }}</div>',
  },

  // ---- time: nights roll over at 6 PM in Doha, whatever the phone's time zone -----------------------
  {
    name: 'time: nightKey in Doha time',
    find: "nightKey() { const d = new Date(Date.now() - 18 * 3600e3); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }",
    replace: 'nightKey() { return window.SpinIt.time.nightKey(); }',
  },
  {
    name: 'time: refill in Doha time',
    find: 'refillMs() { const n = new Date(), t = new Date(n); t.setHours(18, 0, 0, 0); if (t <= n) t.setDate(t.getDate() + 1); return t - n; }',
    replace: 'refillMs() { return window.SpinIt.time.refillMs(); }',
  },
  {
    name: 'allowance: when the night changes, ask the server how many spins are left',
    find: "checkRefill() { const k = this.nightKey(); if (this.state.night !== k) this.setState(st => ({ night: k, spinsLeft: st.night ? this.MAX_SPINS + (st.bonusSpins || 0) * 0 : st.spinsLeft })); }",
    replace: [
      "checkRefill() { const k = this.nightKey(); if (this.state.night !== k) { this.setState(st => ({ night: k, spinsLeft: st.night ? this.MAX_SPINS : st.spinsLeft })); if (this.state.user) window.SpinIt.refreshNight().then(n => this.onNight(n)).catch(() => {}); } }",
      '  // server-owned facts about tonight: spins left (incl. bonus), lock',
      '  onNight(n) { this.setState({ night: window.SpinIt.time.nightKey(), spinsLeft: n.spins_left, bonusSpins: n.bonus_spins || 0, locked: n.locked ? { i: window.SpinIt.idxOf(n.locked.place_id), key: window.SpinIt.time.nightKey() } : null }); }',
    ].join('\n'),
  },

  // ---- storage: server is the source of truth ---------------------------------------------------------
  {
    name: 'storage: load from the backend (after sign-in is restored)',
    find: [
      '    try {',
      "      const d = JSON.parse(localStorage.getItem(this.KEY) || 'null');",
      '      if (d) this.setState({ saved: d.saved || {},',
    ].join('\n'),
    replace: [
      '    window.SpinIt.app = this;',
      '    Promise.resolve(window.SpinItReady).then(() => this.applyBlob(window.SpinIt.store.get()));',
      '  }',
      '  applyBlob(d) {',
      '    try {',
      '      if (d) this.setState({ mood: d.mood ?? null, bMin: d.bMin ?? 0, bMax: d.bMax ?? 400, who: d.who || this.state.who, limitOn: d.limitOn, saved: d.saved || {},',
    ].join('\n'),
  },
  {
    name: 'storage: save through the backend',
    find: "try { localStorage.setItem(this.KEY, JSON.stringify({ saved: s.saved,",
    replace: "try { if (s.user) window.SpinIt.store.set({ mood: s.mood, bMin: s.bMin, bMax: s.bMax, who: s.who, limitOn: s.limitOn, saved: s.saved,",
  },
  {
    name: 'storage: save through the backend (close)',
    find: "spinsLeft: s.spinsLeft, seenOnb: s.screen !== 'onb' })); } catch (e) {}\n  }",
    replace: "spinsLeft: s.spinsLeft, seenOnb: s.screen !== 'onb' }); this._qrSync(); } catch (e) {}\n  }",
  },
  {
    name: 'qr: fetch the signed token + poll redemption while the sheet is open',
    find: '  componentWillUnmount() {',
    replace: [
      '  _qrSync() {',
      "    const s = this.state; if (s.sheet !== 'qr' || s.qrI == null || !s.user) return;",
      '    const i = s.qrI, t = (s.qrTokens || {})[i];',
      '    if (!t && !this._qrBusy) {',
      '      this._qrBusy = true;',
      "      window.SpinIt.deals.token(i).then(r => this.setState(st => ({ qrTokens: { ...(st.qrTokens || {}), [i]: { token: r.token, redeemed: !!r.redeemed_at } } }))).catch(() => this.say('Couldn’t load the QR. Check your connection.')).finally(() => { this._qrBusy = false; });",
      '    }',
      '    if (!this._qrPoll) this._qrPoll = setInterval(() => {',
      "      const c = this.state; if (c.sheet !== 'qr') { clearInterval(this._qrPoll); this._qrPoll = null; return; }",
      '      window.SpinIt.deals.status(c.qrI).then(r => { if (r && r.redeemed_at) this.setState(st => ({ deals: st.deals.map(x => x.i === c.qrI ? { ...x, used: true } : x) })); }).catch(() => {});',
      '    }, 4000);',
      '  }',
      '  componentWillUnmount() {',
    ].join('\n'),
  },
  {
    name: 'storage: reset demo data signs out',
    find: "resetAll: () => { try { localStorage.removeItem(this.KEY); } catch (e) {} this.setState({ ...this.blank(), screen: 'auth' }); },",
    replace: "resetAll: () => { window.SpinIt.auth.signOut(); this.setState({ ...this.blank(), screen: 'auth' }); },",
  },

  // ---- spin: the server decides --------------------------------------------------------------------------
  {
    name: 'spin: ignore taps while the server is deciding',
    find: '    const s = this.state, list = this.wheelList(s);\n    if (s.spinning) return;',
    replace: '    const s = this.state;\n    let list = this.wheelList(s);\n    if (s.spinning || this._pend) return;',
  },
  {
    name: 'spin: ask the server for the winner, then animate to it',
    find: '    const n = list.length, k = Math.floor(Math.random() * n), per = 360 / n;\n',
    replace: [
      // a respin deals a fresh set of slices first (see "wheel: at most 25 slices")
      '    if (this._reshuffle) { this._reshuffle = false; const ws = (s.wheelSeed ?? this._seed0) + 1; this.setState({ wheelSeed: ws }); list = this.wheelList({ ...s, wheelSeed: ws }); }',
      '    this._pend = true;',
      "    window.SpinIt.spin(list.map(x => x.p.id), s.mode, s.loc !== false ? window.SpinIt.native.lastPosition() : null).then(res => this._doSpin(list, res)).catch(e => { const kind = window.SpinIt.errKind(e); if (kind === 'out_of_spins') { const ms = this.refillMs(); this.setState({ spinsLeft: 0 }); this.say('Out of spins. Refill in ' + Math.floor(ms / 3600e3) + 'h ' + Math.floor(ms % 3600e3 / 60e3) + 'm, habibi.'); } else { if (kind === 'none_open') this._reshuffle = true; this.say(window.SpinIt.errText(e, 'spin')); } }).finally(() => { this._pend = false; });",
      '  };',
      '  _doSpin = (list, res) => {',
      '    const s = this.state, n = list.length, k = Math.max(0, list.findIndex(x => x.p.id === res.place_id)), per = 360 / n;',
      '',
    ].join('\n'),
  },
  {
    name: 'spin: allowance comes from the server',
    find: 'spinsLeft: this.unl() ? this.MAX_SPINS : s.spinsLeft - 1 });\n    clearTimeout(this._s);',
    replace: 'spinsLeft: this.unl() ? this.MAX_SPINS : res.spins_left });\n    clearTimeout(this._s);',
  },
  {
    name: 'spin: land with the server record',
    find: 'this._s = setTimeout(() => this.land(list[k].i), 4400);',
    replace: 'this._s = setTimeout(() => this.land(list[k].i, res), 4400);',
  },
  {
    name: 'spin: history keeps the spin id (for ratings), bonus reminder, squad result',
    find: "  land(i) {\n    clearInterval(this._hi); clearTimeout(this._rv);",
    replace: [
      '  land(i, res) {',
      '    if (res) this._reshuffle = true;',
      '    if (res) { window.SpinIt.native.bonusReminder(i, window.SpinIt.dealTitle(i), Date.now()); if (this._squadCode) { window.SpinIt.squad.finish(i).catch(() => {}); this._squadCode = null; } }',
      '    clearInterval(this._hi); clearTimeout(this._rv);',
    ].join('\n'),
  },
  {
    name: 'spin: history entry carries the server spin id',
    find: "history: [{ i, mode: s.mode, at: 'TODAY ' + t }, ...s.history].slice(0, 12),",
    replace: "history: [{ i, mode: s.mode, at: 'TODAY ' + t, sid: res && res.spin_id, ts: Date.now() }, ...s.history].slice(0, 12),",
  },

  // ---- accounts ----------------------------------------------------------------------------------------------
  {
    name: 'auth: sign up',
    find: "this.setState({ user: { name: s.fName.trim(), email: s.fEmail.trim(), g: s.fG }, authErr: '', fPass: '', showPass: false, signStep: 0, setupStep: 0 }); this.go('setup'); this.say('You’re in, ' + term(s.fG) + '. Quick setup.');",
    replace: [
      "window.SpinIt.auth.signUp({ name: s.fName.trim(), email: s.fEmail.trim(), password: s.fPass, g: s.fG })",
      "              .then(blob => { this.applyBlob(blob); this.setState({ authErr: '', fPass: '', showPass: false, signStep: 0, setupStep: 0 }); this.go('setup'); this.say('You’re in, ' + term(s.fG) + '. Quick setup.'); })",
      "              .catch(e => this.setState({ authErr: window.SpinIt.errText(e, 'signup') }));",
    ].join('\n'),
  },
  {
    name: 'auth: log in',
    find: [
      "            const prev = s.user && s.user.email === s.fEmail.trim() ? s.user : null;",
      "            const u = prev || { name: s.fEmail.split('@')[0], email: s.fEmail.trim(), g: 'vibes' };",
      "            finish(u, 'Welcome back, ' + term(u.g) + '. Missed you.');",
    ].join('\n'),
    replace: [
      "            window.SpinIt.auth.signIn(s.fEmail.trim(), s.fPass)",
      "              .then(blob => { this.applyBlob(blob); finish(blob.user, 'Welcome back, ' + term(blob.user.g) + '. Missed you.'); })",
      "              .catch(e => this.setState({ authErr: window.SpinIt.errText(e, 'login') }));",
    ].join('\n'),
  },
  {
    name: 'auth: forgot password',
    find: "forgotPass: () => this.say(okEmail(s.fEmail || '') ? 'Reset link sent. Check your inbox.' : 'Drop your email first, bestie.'),",
    replace: "forgotPass: () => { if (!okEmail(s.fEmail || '')) return this.say('Drop your email first, bestie.'); window.SpinIt.auth.resetPassword(s.fEmail.trim()).then(() => this.say('Reset link sent. Check your inbox.')).catch(() => this.say('Couldn’t send that. Try again?')); },",
  },
  {
    name: 'auth: log out clears the in-memory data too',
    find: "logOut: () => { this.setState({ authMode: 'welcome', fPass: '', authErr: '' }); this.go('auth'); this.say('Logged out. Come back soon, ' + term(s.user && s.user.g) + '.'); }",
    replace: "logOut: () => { window.SpinIt.auth.signOut(); this.setState({ ...this.blank(), screen: 'auth', authMode: 'welcome', authErr: '' }); this.say('Logged out. Come back soon, ' + term(s.user && s.user.g) + '.'); }",
  },
  {
    name: 'auth: delete account deletes it on the server',
    find: "try { localStorage.removeItem(this.KEY); } catch (e) {} this.setState({ ...this.blank(), screen: 'auth', authMode: 'welcome' }); this.say('Account deleted. It was real, ' + term + '.'); },",
    replace: "window.SpinIt.auth.deleteAccount().then(() => { this.setState({ ...this.blank(), screen: 'auth', authMode: 'welcome' }); this.say('Account deleted. It was real, ' + term + '.'); }).catch(() => this.say('Couldn’t delete it. Check your connection.')); },",
  },

  // ---- device features -----------------------------------------------------------------------------------------
  {
    name: 'location: ask for permission at the setup step',
    find: "if (ss === 0) { this.setState({ loc: true, setupStep: 1 }); this.say('Location on. We see you 📍'); return; }",
    replace: "if (ss === 0) { window.SpinIt.native.requestLocation().then(ok => { this.setState({ loc: ok, setupStep: 1 }); this.say(ok ? 'Location on. We see you 📍' : 'Location is off. You can turn it on in Profile.'); }); return; }",
  },
  {
    name: 'push: ask for permission at the setup step',
    find: "if (ss === 1) { this.setState({ notif: true, setupStep: 2 }); return; }",
    replace: "if (ss === 1) { window.SpinIt.native.enablePush().then(ok => this.setState({ notif: ok, setupStep: 2 })); return; }",
  },
  {
    name: 'settings: notifications toggle registers/unregisters the device',
    find: "toggle: () => this.setState({ notif: !tog('notif', true) }) },",
    replace: "toggle: () => { const on = !tog('notif', true); if (on) window.SpinIt.native.enablePush().then(ok => { this.setState({ notif: ok }); if (!ok) this.say('Notifications are blocked in system settings.'); }); else { window.SpinIt.native.disablePush(); this.setState({ notif: false }); } } },",
  },
  {
    name: 'settings: location toggle asks for permission',
    find: "toggle: () => this.setState({ loc: !tog('loc', true) }) },",
    replace: "toggle: () => { const on = !tog('loc', true); if (on) window.SpinIt.native.requestLocation().then(ok => { this.setState({ loc: ok }); if (!ok) this.say('Location is blocked in system settings.'); }); else this.setState({ loc: false }); } },",
  },
  {
    name: 'location: real position for the "min drive from you" chip',
    find: 'const home = [25.3220, 51.5280], dHome = hv(home, g0);',
    replace: 'const home = (s.loc !== false && window.SpinIt.native.lastPosition()) || [25.3220, 51.5280], dHome = hv(home, g0);',
  },
  {
    name: 'share: the in-app share sheet opens the system share menu',
    find: "go: () => { this.setState({ sheet: null }); this.say(label === 'Copy link' ? 'Link copied' : 'Sent via ' + label); } })),",
    replace: [
      "go: () => {",
      "        const text = s.screen === 'group' ? 'Shabab, vote for tonight 🎡 ' + window.SpinIt.squad.link() + ' (code ' + window.SpinIt.squad.code() + ')' : r.short + ' → ' + food.name + ' → ' + des.name + ' · Spun on SpinIt';",
      "        this.setState({ sheet: null });",
      "        if (label === 'Copy link') window.SpinIt.native.copy(text).then(() => this.say('Link copied'));",
      "        else if (label === 'WhatsApp') window.SpinIt.native.openUrl('https://wa.me/?text=' + encodeURIComponent(text));",
      "        else window.SpinIt.native.share({ title: 'SpinIt', text });",
      "      } })),",
    ].join('\n'),
  },
  {
    name: 'share: Spin Wrapped',
    find: "shareWrap: () => this.say('Wrapped copied. Post it, ' + term + '.'),",
    replace: "shareWrap: () => { window.SpinIt.native.share({ title: 'My Spin Wrapped', text: (top ? top.short + ' is my whole personality fr. ' : '') + 'Spin It → spinit.app' }).then(ok => ok && this.say('Post it, ' + term + '.')); },",
  },
  {
    name: 'share: invite link (the friend gets a code, you both get a spin when they join)',
    find: "invite: () => { this.setState(st => ({ bonusSpins: (st.bonusSpins || 0) + 1, spinsLeft: st.spinsLeft + 1 })); this.say('Invite sent. +1 spin, W.'); },",
    replace: "invite: () => { window.SpinIt.native.share({ title: 'Join me on Spin It', text: 'Spin a wheel of Doha. We both get a bonus spin when you join 🎡', url: window.SpinIt.webBase + '/i/' + window.SpinIt.store.meta().refCode }).then(ok => ok && this.say('Invite sent. You both get a spin when they join.')); },",
  },

  // ---- squad: real ---------------------------------------------------------------------------------------------------
  {
    name: 'squad: create a real squad and stream votes (replaces the simulated friends)',
    find: SQUAD_SIM,
    replace: [
      '  startSquad() {',
      "    const me = (this.state.user && this.state.user.name) || 'A';",
      "    this.setState({ squad: [{ name: 'You', initial: me[0].toUpperCase(), vote: this.state.mood || 'Chill' }] });",
      "    window.SpinIt.squad.start(this.state.mood || 'Chill', me, (members, fresh) => { fresh.forEach(n => this.say(n + ' pulled up 👀')); this.setState({ squad: members, squadCode: window.SpinIt.squad.code() }); })",
      "      .then(r => { this._squadCode = r.code; this.setState({ squadCode: r.code }); })",
      "      .catch(() => this.say('Couldn’t start a squad. Check your connection.'));",
      '  }',
      '',
    ].join('\n'),
  },
  {
    name: 'squad: leaving the screen stops the live feed',
    find: "go(screen) { this.setState(s => ({ screen,",
    replace: "go(screen) { if (this.state.screen === 'group' && screen !== 'group') window.SpinIt.squad.stop(); this.setState(s => ({ screen,",
  },
  {
    name: 'squad: host changes their own vote on the server',
    find: "cycle: () => { if (k !== 0) return; this.setState(st => ({ squad: st.squad.map((x, j) => j === 0 ? { ...x, vote: this.MOODS[(this.MOODS.indexOf(x.vote) + 1) % 4] } : x) })); } })),",
    replace: "cycle: () => { if (k !== 0) return; const next = this.MOODS[(this.MOODS.indexOf(m.vote) + 1) % 4]; this.setState(st => ({ squad: st.squad.map((x, j) => j === 0 ? { ...x, vote: next } : x) })); window.SpinIt.squad.hostVote(next).catch(() => this.say('Couldn’t save your vote.')); } })),",
  },
  {
    name: 'squad: code binding, copy, WhatsApp',
    find: "copyCode: () => { try { navigator.clipboard.writeText('SPIN-4821'); } catch (e) {} this.say('Code copied, shabab'); },",
    replace: "squadCode: s.squadCode || 'SPIN-····',\n      copyCode: () => { window.SpinIt.native.copy(window.SpinIt.squad.code()).then(() => this.say('Code copied, shabab')); },",
  },
  {
    name: 'squad: the majority is counted on the server, the winner is recorded for everyone',
    find: "spinTogether: () => { this.setState({ mood: groupMood, who: 'Friends', squadUsed: true }); this.go('spin'); setTimeout(this.spin, 400); },",
    replace: "spinTogether: () => { window.SpinIt.squad.tally().then(t => { this.setState({ mood: t.mood || groupMood, who: 'Friends', squadUsed: true }); this._squadCode = window.SpinIt.squad.code(); this.go('spin'); setTimeout(this.spin, 400); }).catch(() => this.say('Couldn’t count the votes. Try again?')); },",
  },
  {
    name: 'squad: WhatsApp link points at the real vote page',
    find: "squadWa: () => wa('Shabab, vote for tonight 🎡 Tap to pick your vibe, the wheel decides: spinit.app/s/4821'),",
    replace: "squadWa: () => wa('Shabab, vote for tonight 🎡 Tap to pick your vibe, the wheel decides: ' + window.SpinIt.squad.link()),",
  },

  // ---- booking, lock, QR ---------------------------------------------------------------------------------------------------
  {
    name: 'booking: request the table on the server',
    find: "confirmBook: () => { this.setState({ booking: { i: s.result, fa: s.foodAlt, size: s.bSize || 2, time: s.bTime || '8:00 PM' }, sheet: null }); this.say('Booked! Table for ' + (s.bSize || 2) + ' at ' + (s.bTime || '8:00 PM') + ' ✓'); },",
    replace: [
      "confirmBook: () => {",
      "            const b = { i: s.result, fa: s.foodAlt, size: s.bSize || 2, time: s.bTime || '8:00 PM' };",
      "            window.SpinIt.booking.request(b, s.booking && s.booking.id)",
      "              .then(id => { this.setState({ booking: { ...b, id }, sheet: null }); this.say('Requested! Table for ' + b.size + ' at ' + b.time + '. We’ll ping you when it’s confirmed ✓'); })",
      "              .catch(e => this.say(window.SpinIt.errKind(e) === 'slot_full' ? b.time + ' just filled up. Try another time.' : 'Couldn’t book that. Try again?'));",
      "          },",
    ].join('\n'),
  },
  {
    name: 'booking: cancel on the server',
    find: "cancelBook: () => { this.setState({ booking: null, sheet: null }); this.say('Booking cancelled. No worries.'); }",
    replace: "cancelBook: () => { window.SpinIt.booking.cancel(s.booking && s.booking.id).catch(() => {}); this.setState({ booking: null, sheet: null }); this.say('Booking cancelled. No worries.'); }",
  },
  {
    name: 'lock: record the lock (and the default table) on the server, remind 1h before',
    find: "lockIn: () => { this.setState({ locked: { i: s.result, key: this.nightKey() }, booking: bk || { i: s.result, fa: s.foodAlt, size: 2, time: '8:00 PM' } }); ics(); this.say('Locked in. No take-backs 🔒'); },",
    replace: [
      "lockIn: () => {",
      "            const nb = bk || { i: s.result, fa: s.foodAlt, size: 2, time: '8:00 PM' };",
      "            const withId = nb.id ? Promise.resolve(nb.id) : window.SpinIt.booking.request(nb);",
      "            withId.then(id => window.SpinIt.night.lock(s.result, id).then(() => {",
      "              this.setState({ locked: { i: s.result, key: this.nightKey() }, booking: { ...nb, id } }); ics();",
      "              const at = new Date(); at.setUTCHours(15, 30, 0, 0); window.SpinIt.native.nightReminder(s.result, at.getTime() > Date.now() ? at.getTime() : Date.now() + 3600e3 * 2);",
      "              this.say('Locked in. No take-backs 🔒');",
      "            })).catch(e => this.say(window.SpinIt.errKind(e) === 'slot_full' ? 'That table filled up. Pick another time first.' : 'Couldn’t lock it in. Try again?'));",
      "          },",
    ].join('\n'),
  },
  {
    name: 'lock: unlock on the server',
    find: "unlock: () => { this.setState({ locked: null }); this.say('Unlocked. The wheel is judging you.'); },",
    replace: "unlock: () => { window.SpinIt.night.unlock().then(() => { window.SpinIt.native.cancel('night'); this.setState({ locked: null }); this.say('Unlocked. The wheel is judging you.'); }).catch(() => this.say('Couldn’t unlock. Check your connection.')); },",
  },
  {
    name: 'qr: render the signed token as a real QR code',
    find: [
      '        let seed = 0; const code = qp.deal.code; for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;',
    ].join('\n'),
    replace: "        const qrTok = (s.qrTokens || {})[qi]; let seed = 0; const code = qp.deal.code; for (const ch of code) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;",
  },
  {
    name: 'qr: cells come from the token (placeholder pattern until it loads)',
    find: "cells.push({ c: (f === 1 || (f === -1 && !near && rnd() < 0.5)) ? '#0E0A12' : '#FFFFFF' }); }",
    replace: "cells.push({ c: (f === 1 || (f === -1 && !near && rnd() < 0.5)) ? '#0E0A12' : '#FFFFFF' }); }\n        if (qrTok) { cells.length = 0; cells.push(...window.SpinIt.deals.qrCells(qrTok.token)); }",
  },
  {
    name: 'qr: staff redeem it, so the button only checks',
    find: "qrToggle: () => { if (!left && !(qd && qd.used)) { this.say('This one expired. Spin for a new one.'); return; } this.setState(st => ({ deals: st.deals.map(x => x.i === qi ? { ...x, used: !x.used } : x) })); this.say(qd && qd.used ? 'Bonus is back on' : 'Redeemed. Eat up, ' + term + '.'); }",
    replace: "qrToggle: () => { if (qd && qd.used) { this.say('Already redeemed. Eat up, ' + term + '.'); return; } if (!left) { this.say('This one expired. Spin for a new one.'); return; } window.SpinIt.deals.status(qi).then(r => { if (r && r.redeemed_at) { this.setState(st => ({ deals: st.deals.map(x => x.i === qi ? { ...x, used: true } : x) })); this.say('Redeemed. Eat up, ' + term + '.'); } else this.say('Not scanned yet. Show the code to the staff.'); }).catch(() => this.say('Check your connection and try again.')); }",
  },

  // ---- AI, feedback, content ------------------------------------------------------------------------------------------------
  {
    name: 'ai: backend function instead of window.claude',
    find: 'try { reply = await window.claude.complete(prompt); }',
    replace: 'try { reply = await window.SpinIt.ai(prompt); }',
  },
  {
    name: 'feedback: store it',
    find: "this.setState({ sheet: null, fbText: '', fbTag: null }); this.say('Sent. We read everything, fr.'); }",
    replace: "window.SpinIt.feedback(s.fbTag, s.fbText).then(() => { this.setState({ sheet: null, fbText: '', fbTag: null }); this.say('Sent. We read everything, fr.'); }).catch(() => this.say('Couldn’t send that. Try again?')); }",
  },
  {
    name: 'content: what’s on tonight comes from the database',
    find: 'const EV = [[0,',
    replace: 'const EV = window.SpinIt.content.events() || [[0,',
  },
  {
    name: 'content: local picks come from the database',
    find: "const LO = [['@noor.eats',",
    replace: "const LO = window.SpinIt.content.locals() || [['@noor.eats',",
  },
  // after 'spin: land with the server record', which rewrites this line
  {
    name: 'spin: land when the longer spin stops',
    find: 'list[k].i, res), 4400);',
    replace: 'list[k].i, res), 6000);',
  },
  // Opening the Spin page from another screen pops "What's the vibe?" straight away (owner's request).
  // The app's own jumps to Spin to start a spin (respin, squad spin) pass quiet, so it never covers a turning wheel.
  {
    name: 'vibe: reroll label has no countdown while spins are unlimited',
    find: "`Not the vibe? Reroll (${s.spinsLeft} left)`",
    replace: "(this.unl() ? 'Not the vibe? Reroll' : `Not the vibe? Reroll (${s.spinsLeft} left)`)",
  },
  {
    name: 'vibe: go() takes a quiet flag',
    find: '  go(screen) {',
    replace: '  go(screen, quiet) { this._navAt = Date.now();',
  },
  {
    // a phone fires a click right after the tab bar's pointer-up switched screens; it would land on the
    // newly opened sheet's backdrop and close it again
    name: 'vibe: the tap that opened the Spin page does not close its sheet',
    find: 'closeSheet: () => this.setState({ sheet: null }),',
    replace: 'closeSheet: () => { if (Date.now() - (this._navAt || 0) < 500) return; this.setState({ sheet: null }); },',
  },
  {
    name: 'vibe: arriving on Spin opens the vibe sheet',
    find: 'prev: s.screen === screen ? s.prev : s.screen, sheet: null,',
    replace: "prev: s.screen === screen ? s.prev : s.screen, sheet: screen === 'spin' && s.screen !== 'spin' && !quiet && !s.spinning ? 'mood' : null,",
  },
  {
    name: 'vibe: not when a spin starts from another screen',
    find: "if (s.screen !== 'spin') this.go('spin');",
    replace: "if (s.screen !== 'spin') this.go('spin', true);",
  },
  {
    name: 'vibe: not on "spin again"',
    find: 'this.setState({ reveal: false }); this.go(\'spin\'); setTimeout(this.spin, 350);',
    replace: 'this.setState({ reveal: false }); this.go(\'spin\', true); setTimeout(this.spin, 350);',
  },
  {
    name: 'spin: squad spin goes straight to the wheel (no vibe sheet)',
    find: "this._squadCode = window.SpinIt.squad.code(); this.go('spin');",
    replace: "this._squadCode = window.SpinIt.squad.code(); this.go('spin', true);",
  },
  // Respins after locking in (for now): spinning again just drops tonight's lock (the server does the
  // same, supabase/migrations/20261022000009_respin_after_lock.sql). Remove these to bring "no take-backs" back.
  {
    name: 'respin: spinning again clears tonight\u2019s lock',
    find: "if (s.locked && s.locked.key === this.nightKey()) { this.say('Tonight’s locked. No take-backs, habibi 🔒'); return; }",
    replace: "if (s.locked && s.locked.key === this.nightKey()) { this.setState({ locked: null }); try { if (window.SpinIt) window.SpinIt.native.cancel('night'); } catch (e) { /* no reminder */ } }",
  },
  {
    name: 'respin: lock card copy',
    find: 'color:{{ acc }}">NO TAKE-BACKS</div>',
    replace: 'color:{{ acc }}">LOCK IT IN</div>',
  },
  {
    name: 'respin: lock card says you can still spin',
    find: 'tells the group. No more spins tonight.</div>',
    replace: 'tells the group. Change of plans? Just spin again.</div>',
  },
  {
    name: 'respin: locked checklist',
    find: "{ t: 'Spins frozen till tomorrow' }",
    replace: "{ t: 'Still free to respin' }",
  },
  {
    name: 'colour: a saved theme colour from the old palette maps to the new one',
    find: 'acc: d.acc || this.state.acc,',
    replace: 'acc: ' + oldAccents() + '[String(d.acc).toUpperCase()] || d.acc || this.state.acc,',
  },
  {
    name: 'colour: theme picker has the Desert colours and a Neon row',
    find: "const themes = [['#FF3D8B', 'Neon pink'], ['#C6FF3D', 'Acid lime'], ['#3DF2FF', 'Ice cyan'], ['#FFB23D', 'Sunset']];",
    replace: 'const themes = [' + THEMES.map(([c, n]) => `[${jsColour(c)}, '${n}']`).join(', ') + '];',
  },
  {
    name: 'colour: wheel glow picker offers the same colours',
    find: "COLORS = ['#FF3D8B', '#C6FF3D', '#3DF2FF', '#FFB23D'];",
    replace: 'COLORS = [' + THEMES.map(([c]) => jsColour(c)).join(', ') + '];',
  },
  {
    name: 'colour: glow picker wraps onto two rows',
    find: '<div style="display:flex;gap:12px;margin-top:8px">\n              <sc-for list="{{ colorOpts }}"',
    replace: '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px">\n              <sc-for list="{{ colorOpts }}"',
  },
  // ---- start: a signed-in launch opens on Spin (with the vibe sheet up), and sign-in / setup land there too
  {
    name: 'start: reopening the app lands on Spin',
    find: "screen: this.props.startScreen ?? (d.user ? 'discover' : 'auth') });",
    replace: "...(() => { const forced = this.props.startScreen && this.props.startScreen !== 'auth' ? this.props.startScreen : null; const to = forced || (d.user ? 'spin' : 'auth'); return { screen: to, sheet: !forced && to === 'spin' ? 'mood' : null }; })() });",
  },
  {
    name: 'start: logging in lands on Spin',
    find: "const finish = (user, msg) => { this.setState({ user, authErr: '', fPass: '', showPass: false, signStep: 0 }); this.go('discover'); this.say(msg); };",
    replace: "const finish = (user, msg) => { this.setState({ user, authErr: '', fPass: '', showPass: false, signStep: 0 }); this.go('spin'); this.setState({ sheet: 'mood' }); this.say(msg); };",
  },
  {
    name: 'start: finishing setup lands on Spin',
    find: "const done = (msg) => { this.setState({ setupStep: 0 }); this.go('discover'); this.say(msg); };",
    replace: "const done = (msg) => { this.setState({ setupStep: 0 }); this.go('spin'); this.say(msg); };",
  },
  {
    name: 'profile: Theme leaves its old spot',
    find: THEME_BLOCK,
    replace: '',
  },
  {
    name: 'profile: Theme sits above the Doha passport',
    find: PASSPORT_HEAD,
    replace: THEME_BLOCK + PASSPORT_HEAD,
  },
  {
    name: 'respin: lock toast',
    find: "this.say('Locked in. No take-backs 🔒');",
    replace: "this.say('Locked in 🔒');",
  },
  {
    name: 'respin: share text',
    find: "'\\nNo take-backs. Spun on SpinIt",
    replace: "'\\nSpun on SpinIt",
  },
  {
    name: 'respin: calendar note',
    find: "' + d.name + '. No take-backs.',",
    replace: "' + d.name + '.',",
  },
  // ---- vibe: "Other" – type any vibe; the AI picks the places that fit (app-src/vibe-ai.js), or, when it
  // can't (nonsense, nothing on the list fits), falls back to the closest of the sheet's own options
  {
    name: 'vibe: the wheel can be narrowed to the places a typed vibe fits',
    find: 'matches(p, s) { ',
    replace: 'matches(p, s) { if (s.vibeIds && s.vibeIds.length && !s.vibeIds.includes(p.id)) return false; ',
  },
  {
    name: 'vibe: Other chip after the four vibes',
    find: "{ label: 'VIBE', opts: this.MOODS.map(m => ({ label: m, on: s.mood === m, pick: () => this.setState({ mood: s.mood === m ? null : m }) })) }",
    replace: "{ label: 'VIBE', opts: [...this.MOODS.map(m => ({ label: m, on: s.mood === m, pick: () => { this._vibeAsked = null; this.setState({ mood: s.mood === m ? null : m, vibeIds: null, vibeLabel: null, otherOpen: false, vibeNote: '' }); } })), { label: s.vibeLabel ? '\u2728 ' + s.vibeLabel : 'Other \u270D\uFE0F', on: !!(s.otherOpen || s.vibeLabel), pick: () => { this.setState({ otherOpen: !s.otherOpen }); if (!s.otherOpen) setTimeout(() => { const el = document.getElementById('spinit-vibe-input'); if (el) el.focus(); }, 60); } }] }",
  },
  {
    name: 'vibe: the Other text box in the sheet',
    find: "            </sc-for>\n            <div style=\"margin-top:18px\">\n              <div style=\"display:flex;align-items:baseline;justify-content:space-between\">\n                <div style=\"font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1.5px;color:#9C8FA4\">BUDGET / PERSON</div>",
    replace: "            </sc-for>\n            <sc-if value=\"{{ otherOpen }}\" hint-placeholder-val=\"{{ false }}\">\n              <div style=\"margin-top:12px;padding:12px;border-radius:18px;border:1.5px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06)\">\n                <div style=\"font-size:13px;color:#D9CEDD;line-height:1.35\">Enter in what you\u2019re looking for.</div>\n                <div style=\"display:flex;gap:8px;margin-top:10px\">\n                  <input id=\"spinit-vibe-input\" value=\"{{ vibeDraft }}\" onChange=\"{{ onVibeDraft }}\" onKeyDown=\"{{ vibeKey }}\" placeholder=\"e.g. rooftop shisha, rainy day with kids\" onBlur=\"{{ vibeBlur }}\" maxLength=\"200\" enterkeyhint=\"go\" style=\"flex:1;min-width:0;height:46px;border-radius:14px;border:1.5px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.08);padding:0 14px;color:#FFFFFF;font-family:'Instrument Sans',sans-serif;font-size:16px;outline:none;box-sizing:border-box\" />\n                </div>\n                <sc-if value=\"{{ vibeNoteOn }}\" hint-placeholder-val=\"{{ false }}\">\n                  <div style=\"font-size:12.5px;color:{{ acc }};margin-top:8px;line-height:1.35\">{{ vibeNote }}</div>\n                </sc-if>\n              </div>\n            </sc-if>\n            <div style=\"margin-top:18px\">\n              <div style=\"display:flex;align-items:baseline;justify-content:space-between\">\n                <div style=\"font-family:'Space Mono',monospace;font-size:11px;letter-spacing:1.5px;color:#9C8FA4\">BUDGET / PERSON</div>",
  },
  {
    name: 'vibe: Other box bindings',
    find: '      moodGroupsA: [',
    replace: "      otherOpen: !!s.otherOpen, vibeDraft: s.vibeDraft || '', onVibeDraft: e => { const v = e.target.value; this.setState({ vibeDraft: v }); clearTimeout(this._vt); if (v.trim().length >= 3) this._vt = setTimeout(() => this.askVibe(), 1200); },\n      vibeKey: e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(this._vt); this.askVibe(); e.target.blur(); } }, vibeBlur: () => { clearTimeout(this._vt); this.askVibe(); },\n      vibeNoteOn: !!(s.vibeBusy || s.vibeNote), vibeNote: s.vibeBusy ? 'Finding spots for that\u2026' : s.vibeNote || '',\n      moodGroupsA: [",
  },
  {
    name: 'vibe: asking the AI about a typed vibe',
    find: '  wheelList(s) {',
    replace: [
      '  askVibe() {',
      "    const s = this.state, text = (s.vibeDraft || '').trim();",
      "    if (!text || text === this._vibeAsked) return;",
      "    this._vibeAsked = text;",
      "    this.setState({ vibeBusy: true, vibeNote: '' });",
      '    const ask = window.SpinItVibe ? window.SpinItVibe.interpret(text, { places: this.P, moods: this.MOODS, kinds: this.KINDS }) : Promise.resolve(null);',
      '    ask.then(r => {',
      "      if (this._vibeAsked !== text) return; // they kept typing; the newer text is being read",
      "      if (!r) { this.setState({ vibeBusy: false }); return; }",
      "      if (r.kind === 'custom') {",
      "        // the typed vibe replaces the vibe chips; if the other filters would leave fewer than 2, open them up",
      "        const st = this.state, next = { ...st, vibeIds: r.ids, mood: null }, fits = this.P.filter(p => st.wheel[p.id] && this.matches(p, next)).length;",
      "        const open = fits < 2 ? { bMin: 0, bMax: 400, setting: 'Both', kinds: [] } : {};",
      "        this.setState({ vibeBusy: false, vibeIds: r.ids, vibeLabel: r.label, mood: null, ...open, vibeNote: (r.say || (r.ids.length + ' spots fit that vibe.')) + (fits < 2 ? ' Opened up the budget so they fit.' : '') });",
      "        return;",
      "      }",
      "      // nothing fits the words: the closest of the sheet's own options, loosened step by step until 2+ spots fit",
      "      const st = this.state, base = { vibeIds: null, vibeLabel: null, mood: r.mood || st.mood, setting: r.setting || st.setting, kinds: r.kinds && r.kinds.length ? r.kinds : st.kinds || [] };",
      "      const count = x => this.P.filter(p => st.wheel[p.id] && this.matches(p, { ...st, ...x })).length;",
      "      const steps = [{}, { kinds: [] }, { kinds: [], bMin: 0, bMax: 400 }, { kinds: [], bMin: 0, bMax: 400, setting: 'Both' }, { kinds: [], bMin: 0, bMax: 400, setting: 'Both', mood: null }];",
      "      const k = steps.findIndex(x => count({ ...base, ...x }) >= 2), chosen = { ...base, ...steps[Math.max(0, k)] };",
      "      this.setState({ vibeBusy: false, ...chosen, vibeNote: (r.say || 'Went with the closest match.') + (k > 0 ? ' Loosened the other filters so spots fit.' : ' Tweak the options below if it\u2019s off.') });",
      "    }).catch(() => { if (this._vibeAsked === text) this.setState({ vibeBusy: false, vibeNote: 'Couldn\u2019t read that one. Pick a vibe above?' }); });",
      '  }',
      '  wheelList(s) {',
    ].join('\n'),
  },
  {
    name: 'vibe: reset clears a typed vibe',
    find: "setting: 'Both', kinds: [] });",
    replace: "setting: 'Both', kinds: [], vibeIds: null, vibeLabel: null, vibeDraft: '', vibeNote: '', otherOpen: false }); this._vibeAsked = null;",
  },
  {
    name: 'vibe: a typed vibe counts as a filter',
    find: 'const filterCount = (s.mood ? 1 : 0)',
    replace: 'const filterCount = (s.mood || s.vibeLabel ? 1 : 0)',
  },
  {
    name: 'vibe: the first pill shows a typed vibe',
    find: "pills: [s.mood || 'Any vibe',",
    replace: "pills: [s.vibeLabel || s.mood || 'Any vibe',",
  },
  {
    name: 'vibe: the first pill lights up for a typed vibe',
    find: 'const on = (k === 0 && s.mood)',
    replace: 'const on = (k === 0 && (s.mood || s.vibeLabel))',
  },
];

// Demo build (`node scripts/build-www.mjs --demo`, used by `npm run phone` until a backend is set up):
// the design's own on-device storage, plus the extra places, photos and the 25-slice wheel.
const DEMO_KEEP = ['wheel: at most 25 slices', 'places: extra places join the library', 'places: extra indoor places count for the cool-off filter',
  'head: full-bleed viewport for notches', 'fonts: ship the same Google Fonts subsets inside the app', 'props: hide the demo screen list'];
export const demoPatches = [
  ...patches.filter((p) => DEMO_KEEP.includes(p.name) || p.name.startsWith('explore:') || p.name.startsWith('wheel:') || p.name.startsWith('map:') || p.name.startsWith('filters:') || p.name.startsWith('vibe:') || p.name.startsWith('fit:') || p.name.startsWith('respin:') || p.name.startsWith('colour:') || p.name.startsWith('start:') || p.name.startsWith('profile:')),
  {
    name: 'demo head: React and the extra places before the runtime',
    find: '<script src="./support.js"></script>',
    replace: '<script src="./places-extra.js"></script>\n<script src="./maps.js"></script>\n<script src="./wheel-fx.js"></script>\n<script src="./layout-fit.js"></script>\n<script src="./vibe-ai.js"></script>\n<link rel="stylesheet" href="./vendor/leaflet/leaflet.css" />\n<script src="./vendor/leaflet/leaflet.js"></script>\n<script src="./plan-map.js"></script>\n<script src="./react.production.min.js"></script>\n<script src="./react-dom.production.min.js"></script>\n<script src="./support.js"></script>',
  },
  {
    // the design builds its first wheel before the library joins this.P, so only 6 places start on;
    // the real app gets the wheel from the server (all places on), the demo matches that here
    name: 'demo wheel: every place starts on the wheel',
    find: 'this.P = [...this.P, ...this.LIB, ...(window.SPINIT_EXTRA_PLACES || [])].map(p => ({ ...p, ...((window.SPINIT_PLACE_OVERRIDES || {})[p.id] || {}) })); }',
    replace: 'this.P = [...this.P, ...this.LIB, ...(window.SPINIT_EXTRA_PLACES || [])].map(p => ({ ...p, ...((window.SPINIT_PLACE_OVERRIDES || {})[p.id] || {}) })); this.state = { ...this.state, wheel: Object.fromEntries(this.P.map(p => [p.id, true])) }; }',
  },
  {
    name: 'demo spin: a respin deals a new 25 first',
    find: '    const s = this.state, list = this.wheelList(s);\n    if (s.spinning) return;',
    replace: [
      '    let s = this.state;',
      '    if (s.spinning) return;',
      '    if (this._reshuffle && !(s.locked && s.locked.key === this.nightKey())) { this._reshuffle = false; const ws = (s.wheelSeed ?? this._seed0) + 1; this.setState({ wheelSeed: ws }); s = { ...s, wheelSeed: ws }; }',
      '    const list = this.wheelList(s);',
    ].join('\n'),
  },
  {
    name: 'demo spin: landing arms the reshuffle',
    find: '  land(i) {\n',
    replace: '  land(i) {\n    this._reshuffle = true;\n',
  },
  {
    name: 'demo spin: land when the longer spin stops',
    find: 'list[k].i), 4400);',
    replace: 'list[k].i), 6000);',
  },
  {
    name: 'demo vibe: squad spin goes straight to the wheel',
    find: "squadUsed: true }); this.go('spin'); setTimeout(this.spin, 400);",
    replace: "squadUsed: true }); this.go('spin', true); setTimeout(this.spin, 400);",
  },
];

/** Apply every patch; each `find` must occur exactly once. Then swap in the palette (scripts/palette.mjs). Returns the patched source. */
export function applyPatches(src, list = patches) {
  let out = src;
  const problems = [];
  for (const p of list) {
    const n = out.split(p.find).length - 1;
    if (n !== 1) { problems.push(`${p.name}: expected 1 match, found ${n}`); continue; }
    out = out.replace(p.find, () => p.replace);
  }
  if (problems.length) throw new Error('The prototype changed; update scripts/patches.mjs:\n  ' + problems.join('\n  '));
  return recolour(out);
}
