// The real map on the night plan (plain script; needs Leaflet, loaded before it).
//   window.SpinItPlanMap.sync([{ lat, lng, label, approx }...], accentColour)
// called by the design each time the plan screen renders. It finds the map box (#spinit-map), creates the
// map once per box, and redraws the numbered pins and the dashed route only when the stops change.
// Tiles: window.SPINIT_CONFIG.mapTiles if set (e.g. a MapTiler/Stadia URL with your key for launch),
// otherwise CARTO's dark basemap. Tapping the map opens directions (app-src/maps.js).
(function () {
  var DEFAULT_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
  var ATTRIB = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
  var state = { el: null, map: null, layer: null, key: '' };

  function pin(n, label, acc, first, approx) {
    var bg = first ? acc : '#0E0A12', fg = first ? '#0E0A12' : acc;
    return window.L.divIcon({
      className: 'spinit-pin',
      iconSize: [0, 0],
      html: '<div style="transform:translate(-50%,-13px);display:flex;flex-direction:column;align-items:center;gap:4px;opacity:' + (approx ? 0.75 : 1) + '">' +
        '<div style="width:26px;height:26px;border-radius:50%;background:' + bg + ';color:' + fg + ';border:2px ' + (approx ? 'dashed' : 'solid') + ' ' + acc + ';box-sizing:border-box;display:flex;align-items:center;justify-content:center;font:700 12px \'Space Mono\',monospace;box-shadow:0 0 14px ' + acc + '">' + n + '</div>' +
        '<div style="font:700 10.5px \'Instrument Sans\',sans-serif;color:#fff;white-space:nowrap;text-shadow:0 1px 4px #000;padding:1px 6px;border-radius:6px;background:rgba(10,7,16,0.75)">' + String(label).replace(/[<>&]/g, '') + '</div></div>',
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
      L.tileLayer(cfg.mapTiles || DEFAULT_TILES, { maxZoom: 19, subdomains: 'abcd', attribution: cfg.mapAttribution || ATTRIB, detectRetina: true }).addTo(map);
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
      L.polyline(latlngs, { color: acc, weight: 7, opacity: 0.25 }).addTo(state.layer);
      L.polyline(latlngs, { color: acc, weight: 3, dashArray: '6 8', className: 'spinit-route' }).addTo(state.layer);
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
