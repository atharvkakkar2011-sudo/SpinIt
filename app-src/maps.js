// Directions in the phone's own maps app (plain script, loaded before the design in every build).
//   window.SpinItMaps.go([place, dinner, dessert])  – stops in visiting order
// Google Maps gets the whole route (stops become waypoints); Apple Maps links take one destination,
// so Apple opens the first stop. A place whose location is only its area's centre (geo: 'area') is
// searched by name instead, so nobody is sent to the middle of a district.
// Where it opens: the Capacitor app asks "Apple Maps or Google Maps?" on iPhone (window.SpinItMaps.native,
// set by app-src/bridge/native.js); the Expo app does the same natively; a browser opens Google Maps.
(function () {
  function where(p) {
    if (p.lat != null && p.lng != null && p.geo !== 'area') return p.lat + ',' + p.lng;
    return p.name + ', Qatar';
  }
  function isReal(p, i) { return p && p.name && (i === 0 || (p.lat != null && !p.onsite)); } // hand-written and on-site picks: the place itself is the stop

  function links(stops) {
    var seen = {}, list = [];
    stops.forEach(function (p, i) { if (isReal(p, i) && !seen[p.name]) { seen[p.name] = 1; list.push(p); } });
    if (!list.length) return null;
    var dest = list[list.length - 1], via = list.slice(0, -1);
    var g = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(where(dest));
    if (dest.google_place_id) g += '&destination_place_id=' + encodeURIComponent(dest.google_place_id);
    if (via.length) g += '&waypoints=' + encodeURIComponent(via.map(where).join('|'));
    var first = list[0];
    var a = 'https://maps.apple.com/?dirflg=d&daddr=' + encodeURIComponent(where(first)) + '&q=' + encodeURIComponent(first.name);
    return { google: g, apple: a, label: first.name, stops: list.length };
  }

  function go(stops) {
    var l = links(stops || []);
    if (!l) return;
    if (window.SpinItMaps.native) return window.SpinItMaps.native(l);
    if (window.ReactNativeWebView) return window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'maps', payload: l }));
    window.open(l.google, '_blank');
  }

  window.SpinItMaps = { links: links, go: go, native: null };
})();
