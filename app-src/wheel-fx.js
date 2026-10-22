// Makes the wheel feel physical (plain script, loaded before the design in every build):
// a tick sound, a light haptic and a pointer flick each time a peg passes the pointer, and a chime
// plus a stronger haptic when it lands. It reads the wheel's real rotation every frame, so the ticks
// follow the actual easing: fast at first, then tick… tick… tick as it crawls to a stop.
//   window.SpinItWheelFx.start({ calm })   – called by the design when a spin starts
// Haptics (one per peg): window.SpinItWheelFx.haptic(kind) is replaced by the Capacitor bridge (native) or uses the
// Expo app's bridge / navigator.vibrate. "Calm mode" (the design's reduced-motion setting) is silent.
(function () {
  var ctx = null, running = false;

  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  // iOS only lets audio start inside a tap: unlock on the first touch anywhere
  ['pointerdown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, audio, { once: true, passive: true }); });

  function tick(speed) {
    var a = audio(); if (!a) return;
    var t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1500 + Math.random() * 300, t);
    o.frequency.exponentialRampToValueAtTime(600, t + 0.03);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.min(0.22, 0.08 + 0.14 / (1 + speed / 6)), t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.05);
  }

  function chime() {
    var a = audio(); if (!a) return;
    [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
      var t = a.currentTime + i * 0.07, o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.55);
    });
  }

  function haptic(kind) {
    if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', payload: { kind: kind } })); return; }
    if (navigator.vibrate) navigator.vibrate(kind === 'win' ? [30, 50, 60] : 10);
  }

  function angleOf(el) {
    var m = getComputedStyle(el).transform;
    if (!m || m === 'none') return 0;
    var v = m.match(/matrix\(([^)]+)\)/); if (!v) return 0;
    var p = v[1].split(',').map(parseFloat);
    return Math.atan2(p[1], p[0]) * 180 / Math.PI;
  }

  function flick(pointer) {
    if (!pointer) return;
    pointer.style.transition = 'transform 40ms ease-out';
    pointer.style.transform = 'rotate(-22deg)';
    clearTimeout(pointer._back);
    pointer._back = setTimeout(function () { pointer.style.transition = 'transform 160ms cubic-bezier(.3,1.8,.5,1)'; pointer.style.transform = 'rotate(0deg)'; }, 45);
  }

  function start(opts) {
    opts = opts || {};
    if (running) return;
    var rotor = document.getElementById('spinit-rotor'), pointer = document.getElementById('spinit-pointer');
    var n = document.querySelectorAll('[data-spinit-peg]').length;
    if (!rotor || n < 2) return;
    running = true;
    var per = 360 / n, prev = angleOf(rotor), total = 0, lastPeg = null, lastTick = 0, lastHaptic = 0, still = 0, started = performance.now();
    var api = window.SpinItWheelFx;
    function frame(now) {
      var a = angleOf(rotor), d = a - prev;
      if (d < -180) d += 360; else if (d > 180) d -= 360;
      prev = a; total += d;
      var peg = Math.floor((total + per / 2) / per);
      if (lastPeg === null) lastPeg = peg;
      var speed = Math.abs(d); // degrees per frame
      if (peg !== lastPeg) {
        lastPeg = peg;
        if (now - lastTick > 28) { if (!opts.calm) tick(speed); flick(pointer); lastTick = now; }
        // a buzz for every peg; only while it's spinning very fast do some merge (phones can't buzz faster)
        if (now - lastHaptic > 22 && !opts.calm) { api.haptic('tick'); lastHaptic = now; }
      }
      still = speed < 0.01 ? still + 1 : 0;
      // stopped (after it got going) → the win moment; give up after 10 s whatever happens
      if ((still > 6 && now - started > 800) || now - started > 10000) {
        running = false;
        if (!opts.calm) { chime(); api.haptic('win'); }
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  window.SpinItWheelFx = { start: start, haptic: haptic, tick: tick, chime: chime };
})();
