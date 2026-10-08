// Spin It in Expo Go: the same pages the Capacitor app ships (www-demo/ or www/), shown full screen.
// `npm run phone` (repo root) builds and serves them from your computer; this app finds that computer
// through the Expo dev server address. The design's share / copy / maps / WhatsApp / location calls
// are passed to the phone through a small injected script.
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';

const BG = '#0E0A12';
const PORT = 8096; // scripts/phone.mjs serves the app here
const host = (Constants.expoConfig?.hostUri || '').split(':')[0];
const APP_URL = process.env.EXPO_PUBLIC_SPINIT_URL || (host ? `http://${host}:${PORT}/` : '');
const APP_ORIGIN = APP_URL.replace(/^(https?:\/\/[^/]+).*$/, '$1');

// Runs in the page before the design loads.
const BRIDGE = `(function () {
  var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
  var pending = {}, n = 0;
  window.__rn = function (id, ok, data) { var p = pending[id]; delete pending[id]; if (p) (ok ? p[0] : p[1])(data); };
  var ask = function (type, payload) { return new Promise(function (res, rej) { var id = ++n; pending[id] = [res, rej]; post({ id: id, type: type, payload: payload || {} }); }); };
  var def = function (obj, key, value) { try { Object.defineProperty(obj, key, { value: value, configurable: true, writable: true }); } catch (e) {} };
  def(navigator, 'share', function (d) { d = d || {}; return ask('share', { title: d.title, text: d.text, url: d.url }); });
  def(navigator, 'canShare', function () { return true; });
  def(navigator, 'clipboard', { writeText: function (t) { return ask('copy', { text: String(t) }); }, readText: function () { return Promise.resolve(''); } });
  var geo = {
    getCurrentPosition: function (ok, fail) { ask('geo').then(function (c) { ok({ coords: c, timestamp: Date.now() }); }, function (e) { if (fail) fail({ code: 1, message: String(e) }); }); },
    watchPosition: function (ok, fail) { geo.getCurrentPosition(ok, fail); return 1; },
    clearWatch: function () {}
  };
  def(navigator, 'geolocation', geo);
  window.open = function (u) { if (u) post({ type: 'open', payload: { url: String(u) } }); return null; };
})(); true;`;

export default function App() {
  const web = useRef(null);
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);

  const reply = (id, ok, data) => {
    web.current?.injectJavaScript(`window.__rn(${id}, ${ok}, ${JSON.stringify(data ?? null)}); true;`);
  };

  const onMessage = useCallback(async (event) => {
    let msg;
    try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }
    const { id, type, payload } = msg;
    try {
      if (type === 'share') {
        const message = [payload.text, payload.url].filter(Boolean).join('\n');
        await Share.share({ message, url: payload.url, title: payload.title });
        reply(id, true);
      } else if (type === 'copy') {
        await Clipboard.setStringAsync(payload.text || '');
        reply(id, true);
      } else if (type === 'open') {
        await Linking.openURL(payload.url);
      } else if (type === 'geo') {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') throw new Error('Location permission denied');
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        reply(id, true, { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
      }
    } catch (e) {
      if (id) reply(id, false, String(e?.message || e));
    }
  }, []);

  // Links that leave the app (Maps, WhatsApp, Instagram, tel:) open in the phone's own apps.
  const onNav = useCallback((req) => {
    const url = req.url || '';
    if (url.startsWith(APP_ORIGIN) || url.startsWith('about:') || url.startsWith('blob:') || url.startsWith('data:')) return true;
    Linking.openURL(url).catch(() => {});
    return false;
  }, []);

  if (!APP_URL || failed) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.title}>Can’t reach Spin It</Text>
        <Text style={styles.body}>
          {APP_URL ? `Tried ${APP_URL}\n\n` : ''}
          Run <Text style={styles.code}>npm run phone</Text> on your computer and keep it running.
          Your phone and computer need to be on the same Wi-Fi.
        </Text>
        <Pressable style={styles.button} onPress={() => { setFailed(false); setKey((k) => k + 1); }}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WebView
        key={key}
        ref={web}
        source={{ uri: APP_URL }}
        style={styles.root}
        originWhitelist={['*']}
        injectedJavaScriptBeforeContentLoaded={BRIDGE}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onNav}
        onError={() => setFailed(true)}
        onHttpError={(e) => { if (e.nativeEvent.url?.replace(/\/$/, '') === APP_URL.replace(/\/$/, '')) setFailed(true); }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        bounces={false}
        overScrollMode="never"
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures={false}
        webviewDebuggingEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { color: '#F5EEF6', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  body: { color: '#9C8FA4', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  code: { color: '#FF3D8B', fontWeight: '700' },
  button: { marginTop: 24, backgroundColor: '#FF3D8B', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 28 },
  buttonText: { color: BG, fontWeight: '800', fontSize: 16 },
});
