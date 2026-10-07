import jsQR from 'jsqr';
import { rpc, $ } from './api.js';

const REASONS = { bad_signature: 'Not a real Spin It code.', malformed: 'Not a Spin It code.', unknown: 'Code not found.', wrong_venue: 'This bonus belongs to another venue (or the staff key is wrong).', expired: 'Expired. Bonuses last 3 hours.', already_used: 'Already used.' };
let key = localStorage.getItem('spinit-staff-key') || '';
let busy = false, last = '';

function verdict(ok, title, detail) {
  $('#verdict').textContent = title; $('#verdict').style.color = ok ? 'var(--ok)' : 'var(--bad)'; $('#detail').textContent = detail;
  if (navigator.vibrate) navigator.vibrate(ok ? 60 : [40, 60, 40]);
}

async function redeem(token) {
  if (busy || !token || token === last) return;
  busy = true; last = token;
  try {
    const r = await rpc('redeem_deal', { p_token: token.trim(), p_staff_key: key });
    if (r.ok) verdict(true, 'Valid ✓', `${r.title} (${r.code}). Marked as used.`);
    else verdict(false, 'Not valid', REASONS[r.reason] || 'Not valid.');
  } catch { verdict(false, 'No connection', 'Check the internet and scan again.'); last = ''; }
  busy = false;
  setTimeout(() => { last = ''; }, 4000);
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const v = $('#video'); v.srcObject = stream; await v.play();
    const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
    const loop = () => {
      if (v.readyState === v.HAVE_ENOUGH_DATA) {
        c.width = v.videoWidth; c.height = v.videoHeight; ctx.drawImage(v, 0, 0);
        const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
        if (code && code.data) redeem(code.data);
      }
      requestAnimationFrame(loop);
    };
    loop();
  } catch { $('#video').hidden = true; $('#detail').textContent = 'No camera access. Type the code under the QR instead.'; }
}

function show() { $('#keybox').hidden = !!key; $('#scanner').hidden = !key; if (key) startCamera(); }
$('#savekey').onclick = () => { key = $('#key').value.trim(); if (key.length < 8) return; localStorage.setItem('spinit-staff-key', key); show(); };
$('#forget').onclick = () => { localStorage.removeItem('spinit-staff-key'); location.reload(); };
$('#check').onclick = () => redeem($('#manual').value);
show();
