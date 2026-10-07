import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { config } from './config.js';

// Native: keep the session in Preferences (survives WebView storage eviction). Web: localStorage.
const storage = Capacitor.isNativePlatform()
  ? {
      getItem: async (k) => (await Preferences.get({ key: k })).value,
      setItem: (k, v) => Preferences.set({ key: k, value: v }),
      removeItem: (k) => Preferences.remove({ key: k }),
    }
  : undefined;

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage, storageKey: 'spinit-auth' },
  realtime: { params: { eventsPerSecond: 5 } },
});

/** supabase-js resolves with { data, error }; turn the error into a throw so callers can .catch. */
export async function unwrap(p) {
  const { data, error } = await p;
  if (error) {
    const e = new Error(error.message || String(error));
    e.code = error.code;
    throw e;
  }
  return data;
}
