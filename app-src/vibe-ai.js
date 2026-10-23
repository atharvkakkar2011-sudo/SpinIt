// "Other" in the vibe sheet (plain script, loaded before the design in every build).
//   window.SpinItVibe.interpret(text, { places, moods, kinds }) → Promise of one of:
//     { kind: 'custom', label, ids, say }               – these places fit the typed vibe; the wheel uses only them
//     { kind: 'fallback', mood, setting, kinds, say }    – nothing on the list fits (or the answer was nonsense):
//                                                           the closest of the sheet's own options instead
// The AI answers when one is reachable (the app's backend, window.SpinIt.ai, or window.claude.complete in the
// design preview). Without one, or if it fails or answers in a shape we can't use, a keyword match stands in,
// so the sheet always gets an answer.
(function () {
  var SETTINGS = ['Indoor', 'Outdoor', 'Both'];
  var TIMEOUT_MS = 15000;

  function ask(prompt) {
    var call = window.SpinIt && window.SpinIt.ai ? window.SpinIt.ai(prompt)
      : window.claude && window.claude.complete ? window.claude.complete(prompt) : null;
    if (!call) return Promise.reject(new Error('no_ai'));
    return Promise.race([call, new Promise(function (_, no) { setTimeout(function () { no(new Error('timeout')); }, TIMEOUT_MS); })]);
  }

  function line(p) {
    var tier = ['', '$', '$$', '$$$'][p.budget] || '';
    return [p.id, p.short || p.name, p.area, (p.tags || []).join('/'), (p.moods || []).join('/'), tier, p.indoor ? 'indoor' : '', (p.vibe || '').slice(0, 60)].join(' | ');
  }

  function prompt(text, ctx) {
    return 'A user of Spin It (a Doha night-out app) described the night they want in their own words:\n' +
      '"' + text.replace(/"/g, "'").slice(0, 200) + '"\n\n' +
      'Places (id | name | area | tags | vibes | price | indoor | line):\n' + ctx.places.map(line).join('\n') + '\n\n' +
      'Answer with JSON only, no other text:\n' +
      '{"fits": true or false, "label": "2-3 word name for this vibe", "ids": ["ids from the list that genuinely fit, best first, at most 30"],' +
      ' "fallback": {"mood": one of ' + JSON.stringify(ctx.moods) + ' or null, "setting": one of ' + JSON.stringify(SETTINGS) + ', "kinds": a subset of ' + JSON.stringify(ctx.kinds) + '},' +
      ' "say": "one short, friendly line for the user, under 15 words"}\n' +
      'Rules: use only ids from the list. "fits" is true only if at least 2 places really match what they asked for. ' +
      'If the answer is gibberish, unsafe, not about going out, or nothing on the list matches, set "fits" to false and fill "fallback" ' +
      'with the closest of the given options (always fill "fallback"), and say which one you went with.';
  }

  function parse(reply, ctx) {
    var m = String(reply || '').match(/\{[\s\S]*\}/);
    if (!m) return null;
    var j; try { j = JSON.parse(m[0]); } catch (e) { return null; }
    var known = {}; ctx.places.forEach(function (p) { known[p.id] = 1; });
    var ids = (Array.isArray(j.ids) ? j.ids : []).filter(function (id, i, a) { return known[id] && a.indexOf(id) === i; }).slice(0, 30);
    var label = String(j.label || '').replace(/[<>]/g, '').trim().slice(0, 24);
    var say = String(j.say || '').replace(/[<>]/g, '').trim().slice(0, 120);
    if (j.fits && ids.length >= 2 && label) return { kind: 'custom', label: label, ids: ids, say: say };
    var f = j.fallback || {};
    return {
      kind: 'fallback',
      mood: ctx.moods.indexOf(f.mood) >= 0 ? f.mood : null,
      setting: SETTINGS.indexOf(f.setting) >= 0 ? f.setting : 'Both',
      kinds: (Array.isArray(f.kinds) ? f.kinds : []).filter(function (k) { return ctx.kinds.indexOf(k) >= 0; }),
      say: say,
    };
  }

  // ---- no AI: keywords --------------------------------------------------------------------------------
  var MOOD_WORDS = {
    Romantic: /date|romantic|anniversary|partner|wife|husband|girlfriend|boyfriend|couple|candle|propos/,
    Family: /family|kids?|children|parents|mum|mom|dad|baby|toddler/,
    Adventurous: /adventur|thrill|extreme|desert|dune|safari|kayak|dive|jet ?ski|climb|crazy|wild|adrenaline/,
    Chill: /chill|relax|calm|quiet|cosy|cozy|lazy|slow|peace|unwind|tired/,
  };
  var KIND_WORDS = {
    'Café': /coffee|caf[eé]|karak|latte|tea|brunch|breakfast/,
    Restaurants: /food|dinner|lunch|eat|hungry|restaurant|burger|sushi|steak|shawarma|seafood/,
    Entertainment: /fun|games?|bowling|arcade|cinema|movie|karting|escape|party|club|music/,
    Fitness: /gym|workout|run|running|sport|fitness|yoga|padel|tennis|swim|active/,
    Culture: /museum|art|history|culture|gallery|heritage|souq|exhibit/,
  };
  var STOP = /^(with|the|and|for|want|something|somewhere|place|places|with|that|this|have|some|good|nice|tonight|night|today|just|like|really|very|from|about|where|there|what|going|into|make|need|lets|let's|maybe|kinda|vibe|vibes)$/;

  function local(text, ctx) {
    var t = text.toLowerCase();
    var mood = null, kinds = [], setting = 'Both';
    Object.keys(MOOD_WORDS).forEach(function (m) { if (!mood && MOOD_WORDS[m].test(t)) mood = m; });
    Object.keys(KIND_WORDS).forEach(function (k) { if (KIND_WORDS[k].test(t) && ctx.kinds.indexOf(k) >= 0) kinds.push(k); });
    if (/indoor|inside|\bac\b|air.?con|cool|hot outside|mall/.test(t)) setting = 'Indoor';
    else if (/outdoor|outside|park|fresh air|sunset|walk/.test(t)) setting = 'Outdoor';
    // a vibe the sheet already has (date night → Romantic, kids → Family): use the sheet's own options
    if (mood) return { kind: 'fallback', mood: mood, setting: setting, kinds: kinds, say: 'Sounds ' + [mood, setting !== 'Both' ? setting : null].concat(kinds).filter(Boolean).join(' · ') + ' to me.' };
    // otherwise, places whose own words match what was typed (beach, rooftop, golf, Pearl…)
    var words = t.split(/[^a-z\u00C0-\u024F]+/).filter(function (w) { return w.length >= 4 && !STOP.test(w); });
    var scored = ctx.places.map(function (p) {
      var hay = [p.name, p.short, p.area, (p.tags || []).join(' '), p.vibe, p.about].join(' ').toLowerCase();
      var n = 0; words.forEach(function (w) { if (hay.indexOf(w) >= 0 || hay.indexOf(w.replace(/s$/, '')) >= 0) n++; });
      return { id: p.id, n: n };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    if (scored.length >= 2) {
      var label = words.slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
      return { kind: 'custom', label: label, ids: scored.slice(0, 30).map(function (x) { return x.id; }), say: scored.length + ' spots match that.' };
    }
    var picked = kinds[0] || (setting !== 'Both' ? setting : null);
    if (!picked) mood = 'Chill';
    return { kind: 'fallback', mood: mood, setting: setting, kinds: kinds, say: picked ? 'Went with ' + [setting !== 'Both' ? setting : null].concat(kinds).filter(Boolean).join(' · ') + '.' : 'Couldn\u2019t read that one, so Chill it is.' };
  }

  function interpret(text, ctx) {
    text = String(text || '').trim();
    if (!text) return Promise.resolve(local('', ctx));
    return ask(prompt(text, ctx))
      .then(function (reply) { return parse(reply, ctx) || local(text, ctx); })
      .catch(function () { return local(text, ctx); });
  }

  window.SpinItVibe = { interpret: interpret, local: local, parse: parse, prompt: prompt };
})();
