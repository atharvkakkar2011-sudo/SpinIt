// window.SpinIt: the surface the (patched) prototype calls instead of localStorage, window.claude
// and browser-only APIs. Loaded before support.js so it exists when the component mounts.
import { ai, booking, content, deals, feedback, night, refreshNight, spin, squad } from './actions.js';
import { auth, setAuthHooks } from './auth.js';
import { errKind, errText } from './errors.js';
import { native } from './native.js';
import { store } from './store.js';
import { nightKey, refillMs } from './time.js';
import { config } from './config.js';
import { idxOf, placeShort, dealTitle } from './ids.js';

const SpinIt = {
  store, auth, spin, refreshNight, booking, night, deals, squad, ai, feedback, content, native,
  errKind, errText,
  time: { nightKey, refillMs },
  app: null, // set by the component on mount
  isOnline: () => navigator.onLine !== false,
  placeShort, dealTitle, idxOf,
  webBase: config.webBase,
};
window.SpinIt = SpinIt;

// After any sign-in, put this device's push state in line with the user's choice and refresh pins.
setAuthHooks({
  onSignedIn: async (blob) => { native.syncPush(blob.notif !== false); if (blob.loc !== false) native.refreshLocation(); },
  onSignedOut: async () => { await native.disablePush(); },
});

window.SpinItReady = (async () => {
  await native.init({
    route: (data) => {
      const a = SpinIt.app;
      if (!a || !data) return;
      const to = data.screen || ({ squad: 'group', booking: 'evening', rate: 'discover', refill: 'spin' })[data.kind] || null;
      if (to) a.go(to);
    },
    resume: async () => {
      await store.flush().catch(() => {});
      try { const n = await refreshNight(); SpinIt.app && SpinIt.app.onNight(n); } catch { /* offline */ }
    },
    online: () => store.flush(),
  });
  const [blob] = await Promise.all([
    auth.restore().catch((e) => { console.warn('[spinit] restore failed', e && e.message); return null; }),
    content.load(),
  ]);
  await native.hideSplash();
  return blob;
})();
