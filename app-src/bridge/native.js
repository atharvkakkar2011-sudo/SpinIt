// Native device features for the web UI: push notifications, location, the share sheet, clipboard,
// external links, calendar-file sharing, status bar and splash. Every function degrades to a
// browser behaviour so the same bundle runs in a plain browser for development.
import { App } from '@capacitor/app';
import { AppLauncher } from '@capacitor/app-launcher';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Geolocation } from '@capacitor/geolocation';
import { Keyboard } from '@capacitor/keyboard';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { supabase } from './client.js';
import { pendingRef } from './auth.js';
import { idxOf, placeShort } from './ids.js';

const isNative = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
let position = null;
let pushToken = null;
let onRoute = () => {};
let onResume = () => {};
let onOnline = () => {};

const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) % 2147483000 + 1; };

export const native = {
  isNative, platform,

  /** Called once at start-up. */
  async init({ route, resume, online }) {
    onRoute = route || onRoute; onResume = resume || onResume; onOnline = online || onOnline;
    patchBrowserAPIs();
    if (!isNative) return;
    try { await StatusBar.setStyle({ style: Style.Dark }); if (platform === 'android') { await StatusBar.setOverlaysWebView({ overlay: true }); await StatusBar.setBackgroundColor({ color: '#00000000' }); } } catch { /* optional */ }
    try { await Keyboard.setResizeMode({ mode: 'none' }); } catch { /* optional */ }
    App.addListener('appUrlOpen', ({ url }) => handleLink(url));
    App.addListener('resume', () => onResume());
    Network.addListener('networkStatusChange', (s) => { if (s.connected) onOnline(); });
    FirebaseMessaging.addListener('tokenReceived', ({ token }) => { pushToken = token; registerToken(token); });
    FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => onRoute(notification && notification.data));
    LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => onRoute(notification && notification.extra));
    try { const launch = await App.getLaunchUrl(); if (launch && launch.url) handleLink(launch.url); } catch { /* none */ }
  },

  async hideSplash() { if (isNative) { try { await SplashScreen.hide({ fadeOutDuration: 250 }); } catch { /* ignore */ } } },

  // ---- location --------------------------------------------------------------------------------
  /** Ask once, then read a coarse position for "X min drive from you". Resolves to whether it is allowed. */
  async requestLocation() {
    try {
      if (isNative) {
        let p = await Geolocation.checkPermissions();
        if (p.location !== 'granted' && p.coarseLocation !== 'granted') p = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (p.location !== 'granted' && p.coarseLocation !== 'granted') return false;
      }
      await native.refreshLocation();
      return isNative ? true : !!position;
    } catch { return false; }
  },
  async refreshLocation() {
    try {
      const r = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60e3 });
      position = [r.coords.latitude, r.coords.longitude];
    } catch { /* keep last known */ }
    return position;
  },
  lastPosition: () => position,

  // ---- push --------------------------------------------------------------------------------------
  /** Ask for permission and register this device for the pushes in BACKEND.md. Resolves to whether it is on. */
  async enablePush() {
    if (!isNative) return true;
    try {
      const p = await FirebaseMessaging.requestPermissions();
      if (p.receive !== 'granted') return false;
      LocalNotifications.requestPermissions().catch(() => {});
      const { token } = await FirebaseMessaging.getToken();
      pushToken = token;
      await registerToken(token);
      return true;
    } catch (e) { console.warn('[spinit] push setup failed', e && e.message); return false; }
  },
  async disablePush() {
    if (!isNative) return;
    try {
      if (pushToken) await supabase.rpc('unregister_push_token', { p_token: pushToken });
      await FirebaseMessaging.deleteToken();
      pushToken = null;
    } catch { /* ignore */ }
  },
  /** Re-register after sign-in when the user already allows pushes. */
  async syncPush(allowed) {
    if (!isNative) return;
    if (!allowed) return native.disablePush();
    try {
      const p = await FirebaseMessaging.checkPermissions();
      if (p.receive === 'granted') { const { token } = await FirebaseMessaging.getToken(); pushToken = token; await registerToken(token); }
    } catch { /* ignore */ }
  },

  // local reminders (scheduled on the device, no server round trip)
  async schedule(key, at, title, body, extra) {
    if (!isNative || at <= Date.now()) return;
    try { await LocalNotifications.schedule({ notifications: [{ id: hash(key), title, body, schedule: { at: new Date(at), allowWhileIdle: true }, extra }] }); } catch { /* ignore */ }
  },
  async cancel(key) { if (isNative) { try { await LocalNotifications.cancel({ notifications: [{ id: hash(key) }] }); } catch { /* ignore */ } } },
  nightReminder(placeIdx, firstStopAt) { return native.schedule('night', firstStopAt - 3600e3, 'Your night starts in 1h', `${placeShort(placeIdx)} at 6:30 👀`, { screen: 'evening' }); },
  bonusReminder(placeIdx, title, unlockedAt) { return native.schedule(`bonus:${placeIdx}`, unlockedAt + 2.5 * 3600e3, `Your ${title} bonus dies in 30 min`, 'Flash the QR before it expires.', { screen: 'profile' }); },

  // ---- sharing, links, clipboard ----------------------------------------------------------------
  async share({ title, text, url }) {
    try { await Share.share({ title, text, url, dialogTitle: title }); return true; } catch { return false; }
  },
  async copy(text) {
    try { await Clipboard.write({ string: text }); return true; } catch { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
  },
  async openUrl(url) {
    try {
      if (isNative && /^https?:\/\/(wa\.me|api\.whatsapp\.com)/.test(url)) { await AppLauncher.openUrl({ url }); return; }
      if (isNative) { await Browser.open({ url }); return; }
    } catch { /* fall through */ }
    window.open(url, '_blank', 'noopener');
  },
};

async function registerToken(token) {
  try { await supabase.rpc('register_push_token', { p_token: token, p_platform: platform === 'ios' ? 'ios' : 'android' }); } catch { /* retried on next token event / sign-in */ }
}

/** spinit.app/i/CODE (invite) and spinit.app/s/CODE (squad) links. */
function handleLink(url) {
  try {
    const u = new URL(url);
    // https://spinit.app/i/CODE or spinit://i/CODE
    const path = u.protocol === 'spinit:' ? `/${u.host}${u.pathname}` : u.pathname;
    const m = /^\/i\/([A-Za-z0-9]{4,12})\/?$/.exec(path);
    if (m) pendingRef.set(m[1]);
  } catch { /* ignore */ }
}

/** The prototype uses navigator.share / navigator.clipboard / window.open / <a download>: make them native. */
function patchBrowserAPIs() {
  if (!isNative) return;
  try {
    Object.defineProperty(navigator, 'share', { configurable: true, value: (d = {}) => Share.share({ title: d.title, text: d.text, url: d.url }) });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => Clipboard.write({ string: String(t) }), readText: async () => '' } });
  } catch { /* read-only on some engines */ }
  window.open = (url) => { native.openUrl(String(url)); return null; };
  // .ics (calendar) download: write the file and hand it to the share sheet so "Calendar" can take it
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patched() {
    if (this.download && /^blob:/.test(this.href)) {
      const name = this.download;
      fetch(this.href).then((r) => r.blob()).then((b) => new Promise((res) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1]); f.readAsDataURL(b); }))
        .then((data) => Filesystem.writeFile({ path: name, data, directory: Directory.Cache }))
        .then((f) => Share.share({ title: 'Add to calendar', url: f.uri }))
        .catch(() => {});
      return;
    }
    return click.call(this);
  };
}

export { idxOf };
