import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import { config } from './config.js';
import { supabase, unwrap } from './client.js';
import { fetchBlob, store } from './store.js';
import { errKind } from './errors.js';

const REF_KEY = 'spinit-pending-ref';
export const pendingRef = {
  async set(code) { try { await Preferences.set({ key: REF_KEY, value: String(code).toUpperCase().slice(0, 12) }); } catch { /* ignore */ } },
  async take() { try { const v = (await Preferences.get({ key: REF_KEY })).value; if (v) await Preferences.remove({ key: REF_KEY }); return v; } catch { return null; } },
};

let hooks = { onSignedIn: async () => {}, onSignedOut: async () => {} };
export const setAuthHooks = (h) => { hooks = { ...hooks, ...h }; };

async function enter(user) {
  const blob = await fetchBlob(user);
  store.adopt(user.id, blob);
  await hooks.onSignedIn(blob);
  return blob;
}

export const auth = {
  async signUp({ name, email, password, g }) {
    const ref = await pendingRef.take();
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, g, ...(ref ? { ref } : {}) } } });
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    if (!data.session) throw new Error('confirm_email'); // project requires email confirmation
    const blob = await enter(data.user);
    return blob.user;
  },

  async signIn(email, password) {
    const data = await unwrap(supabase.auth.signInWithPassword({ email, password }));
    return enter(data.user);
  },

  async signOut() {
    try { await hooks.onSignedOut(); } catch { /* ignore */ }
    await store.flush().catch(() => {});
    store.clear();
    await supabase.auth.signOut().catch(() => {});
  },

  async resetPassword(email) {
    await unwrap(supabase.auth.resetPasswordForEmail(email, { redirectTo: `${config.webBase}/reset/` }));
  },

  async deleteAccount() {
    try { await hooks.onSignedOut(); } catch { /* ignore */ }
    await unwrap(supabase.rpc('delete_my_account'));
    store.clear();
    await supabase.auth.signOut().catch(() => {});
  },

  /** At launch: restore the session, bring edits made offline up, return the user's data (or null). */
  async restore() {
    const { data } = await supabase.auth.getSession();
    const user = data.session && data.session.user;
    if (!user) return null;
    await store.boot(user.id);
    try {
      return await enter(user);
    } catch (e) {
      const k = errKind(e);
      if (k === 'auth') { await store.flush().catch(() => {}); store.clear(); await supabase.auth.signOut().catch(() => {}); return null; }
      const offline = store.cachedFor(user.id); // server unreachable: run from the cache
      if (offline) { store.adopt(user.id, offline); store.set(offline); return offline; }
      throw e;
    }
  },

  isNative: Capacitor.isNativePlatform(),
};
