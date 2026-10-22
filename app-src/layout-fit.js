// Keeps the Spin screen usable on every phone (plain script, loaded before the design in every build).
// The design was laid out for a 874 px tall screen; on shorter ones (most iPhones once Safari's bars or
// the notch are taken off) the YALLA SPIN button slid under the tab bar and couldn't be tapped.
// This shrinks the wheel (CSS zoom on #spinit-wheelbox) just enough for the button and the links under
// it to sit above the tab bar, and grows it back on taller screens. Nothing changes where it already fits.
(function () {
  var MIN = 0.55;

  function fit() {
    var box = document.getElementById('spinit-wheelbox');
    if (!box) return;
    var screen = box.parentElement, last = screen && screen.lastElementChild;
    if (!last) return;
    var pad = parseFloat(getComputedStyle(screen).paddingBottom) || 0;
    var limit = screen.getBoundingClientRect().bottom - pad;          // top of the tab bar area
    var overflow = last.getBoundingClientRect().bottom - limit;       // >0: the bottom row is hidden
    var z = parseFloat(box.style.zoom) || 1;
    var h = box.getBoundingClientRect().height || 322;                 // the wheel's height as drawn now
    var next = z;
    if (overflow > 1) next = Math.max(MIN, z * (h - overflow - 4) / h);
    else if (overflow < -12 && z < 1) next = Math.min(1, z * (h - overflow - 8) / h);
    if (Math.abs(next - z) > 0.005) box.style.zoom = String(Math.round(next * 1000) / 1000);
  }

  function loop() { try { fit(); } catch (e) { /* layout not ready */ } setTimeout(loop, 250); }
  window.addEventListener('resize', function () { try { fit(); } catch (e) { /* ignore */ } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loop); else loop();
  window.SpinItLayoutFit = { fit: fit };
})();
