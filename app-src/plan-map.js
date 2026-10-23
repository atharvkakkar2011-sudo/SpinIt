// The real map on the night plan (plain script; needs Leaflet, loaded before it).
//   window.SpinItPlanMap.sync([{ lat, lng, label, approx }...], accentColour)
// called by the design each time the plan screen renders. It finds the map box (#spinit-map), creates the
// map once per box, and redraws the numbered pins and the dashed route only when the stops change.
// Tiles: window.SPINIT_CONFIG.mapTiles if set (e.g. a MapTiler/Stadia URL with your key for launch),
// otherwise CARTO's dark basemap. Tapping the map opens directions (app-src/maps.js).
// The route follows real roads: window.SPINIT_CONFIG.routeUrl (an OSRM-compatible /route/v1/driving/
// endpoint) or the public OSRM demo server; until it answers (or if it can't), a straight dashed line.
// Where the map imagery can't load (no internet, or a page that blocks outside content), a short note says so.
(function () {
  var DEFAULT_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  var ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  var DEFAULT_ROUTER = 'https://router.project-osrm.org/route/v1/driving/';
  var state = { el: null, map: null, layer: null, key: '' };
  var routes = {}; // "lng,lat;lng,lat" → [[lat, lng], …] road geometry

  function road(latlngs) {
    var path = latlngs.map(function (p) { return p[1].toFixed(5) + ',' + p[0].toFixed(5); }).join(';');
    if (routes[path]) return Promise.resolve(routes[path]);
    var base = (window.SPINIT_CONFIG || {}).routeUrl || DEFAULT_ROUTER;
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    return fetch(base + path + '?overview=full&geometries=geojson', ctl ? { signal: ctl.signal } : {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        clearTimeout(timer);
        var c = j && j.routes && j.routes[0] && j.routes[0].geometry && j.routes[0].geometry.coordinates;
        if (!c || c.length < 2) return null;
        return (routes[path] = c.map(function (x) { return [x[1], x[0]]; }));
      })
      .catch(function () { clearTimeout(timer); return null; });
  }

  function note(el, show) {
    var n = el.querySelector('.spinit-map-note');
    if (!show) { if (n) n.remove(); return; }
    if (n) return;
    n = document.createElement('div');
    n.className = 'spinit-map-note';
    n.style.cssText = 'position:absolute;left:50%;top:12px;transform:translateX(-50%);z-index:500;padding:4px 10px;border-radius:10px;background:rgba(8,12,24,0.8);border:1px solid rgba(255,255,255,0.15);color:#BDB3A2;font:500 11px \'Instrument Sans\',sans-serif;white-space:nowrap;pointer-events:none';
    n.textContent = 'Map needs internet. The route and stops still work.';
    el.appendChild(n);
  }

  function pin(n, label, acc, first, approx) {
    var bg = first ? acc : '#0B1020', fg = first ? '#0B1020' : acc;
    return window.L.divIcon({
      className: 'spinit-pin',
      iconSize: [0, 0],
      html: '<div style="transform:translate(-50%,-13px);display:flex;flex-direction:column;align-items:center;gap:4px;opacity:' + (approx ? 0.75 : 1) + '">' +
        '<div style="width:26px;height:26px;border-radius:50%;background:' + bg + ';color:' + fg + ';border:2px ' + (approx ? 'dashed' : 'solid') + ' ' + acc + ';box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:700 12px \'Space Mono\',monospace;box-shadow:0 0 14px ' + acc + '">' + n + '</div>' +
        '<div style="font:700 10.5px \'Instrument Sans\',sans-serif;color:#fff;white-space:nowrap;text-shadow:0 1px 4px #000;padding:1px 6px;border-radius:6px;background:rgba(8,12,24,0.75)">' + String(label).replace(/[<>&]/g, '') + '</div></div>',
    });
  }

  function sync(stops, acc) {
    var L = window.L, el = document.getElementById('spinit-map');
    if (!L || !el) return;
    var seen = {};
    var pts = (stops || []).filter(function (s) {
      if (!s || s.lat == null || s.lng == null || seen[s.label]) return false; // dinner at the place itself: one pin
      seen[s.label] = 1; return true;
    });
    if (!pts.length) { el.style.display = 'none'; return; }
    el.style.display = '';
    if (state.el !== el) { // the screen was re-created: start a fresh map in the new box
      if (state.map) state.map.remove();
      var map = L.map(el, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, tap: false });
      var cfg = window.SPINIT_CONFIG || {};
      var tiles = L.tileLayer(cfg.mapTiles || DEFAULT_TILES, { maxZoom: 19, subdomains: 'abcd', attribution: cfg.mapAttribution || ATTRIB, detectRetina: true }).addTo(map);
      var loaded = 0, failed = 0;
      tiles.on('tileload', function () { loaded++; note(el, false); });
      tiles.on('tileerror', function () { failed++; if (!loaded && failed >= 2) note(el, true); });
      map.attributionControl.setPrefix(false);
      map.attributionControl.setPosition('topright');
      map.on('click', function () { if (window.SpinItMaps) window.SpinItMaps.go(state.stops || []); });
      state = { el: el, map: map, layer: L.layerGroup().addTo(map), key: '' };
    }
    var key = JSON.stringify(pts) + acc;
    if (key === state.key) return;
    state.key = key; state.stops = stops;
    state.layer.clearLayers();
    // stops at the same spot (two picks only located by their area): fan them out a little so each pin reads
    var latlngs = pts.map(function (p, i) {
      var clash = pts.slice(0, i).filter(function (q) { return Math.abs(q.lat - p.lat) < 0.0006 && Math.abs(q.lng - p.lng) < 0.0006; }).length;
      return clash ? [p.lat - 0.0012 * clash, p.lng + 0.0016 * clash] : [p.lat, p.lng];
    });
    if (latlngs.length > 1) {
      var glow = L.polyline(latlngs, { color: acc, weight: 7, opacity: 0.25 }).addTo(state.layer);
      var line = L.polyline(latlngs, { color: acc, weight: 3, dashArray: '6 8', className: 'spinit-route' }).addTo(state.layer);
      // swap the straight line for the real road route when it arrives (still for these same stops)
      var forKey = key;
      road(latlngs).then(function (path) {
        if (!path || state.key !== forKey) return;
        glow.setLatLngs(path); line.setLatLngs(path); line.setStyle({ dashArray: null });
        state.map.fitBounds(L.latLngBounds(path).extend(latlngs), { padding: [46, 46], maxZoom: 16 });
      });
    }
    pts.forEach(function (p, i) { L.marker(latlngs[i], { icon: pin(i + 1, p.label, acc, i === 0, p.approx), keyboard: false }).addTo(state.layer); });
    setTimeout(function () {
      state.map.invalidateSize();
      if (latlngs.length > 1) state.map.fitBounds(latlngs, { padding: [46, 46], maxZoom: 16 });
      else state.map.setView(latlngs[0], 15);
    }, 0);
  }

  window.SpinItPlanMap = { sync: sync };
})();
