import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PLACES, type Mood, type Place } from './data/places';
import {
  MAX_SPINS,
  defaultFilters,
  fmtDuration,
  msUntilRefill,
  nightKey,
  wheelList,
  type Filters,
} from './lib/logic';
import { ACCENTS } from './theme';

export type SpinMode = 'place' | 'food' | 'dessert';

export interface WheelItem {
  key: string;
  placeId: string;
  /** 0/1 — which food/dessert option this slice stands for (place mode: unused). */
  alt: 0 | 1;
  label: string;
  photo: string;
}

export interface Evening {
  id: string;
  placeId: string;
  foodAlt: 0 | 1;
  dessertAlt: 0 | 1;
  at: number;
}
export interface Deal { placeId: string; used: boolean; at: number }
export interface HistoryEntry { placeId: string; mode: SpinMode; at: number; rating?: number }

/** Items on the wheel for the current mode. */
export function wheelItems(mode: SpinMode, wheel: Record<string, boolean>, f: Filters): WheelItem[] {
  const places = wheelList(PLACES, wheel, f);
  if (mode === 'place') {
    return places.map((p) => ({ key: p.id, placeId: p.id, alt: 0, label: p.short, photo: p.photos[0] }));
  }
  return places.flatMap((p) =>
    (mode === 'food' ? p.food : p.dessert).slice(0, 2).map((m, i) => ({
      key: `${p.id}:${i}`,
      placeId: p.id,
      alt: i as 0 | 1,
      label: m.name,
      photo: p.photos[Math.min(i + 1, p.photos.length - 1)],
    })),
  );
}

interface State {
  // persisted
  saved: Record<string, boolean>;
  evenings: Evening[];
  deals: Deal[];
  history: HistoryEntry[];
  wheel: Record<string, boolean>;
  wheelName: string;
  emoji: string;
  acc: string;
  filters: Filters;
  calm: boolean;
  limitOn: boolean;
  spinsLeft: number;
  night: string;
  locked: { key: string; placeId: string } | null;
  // transient
  mode: SpinMode;
  spinning: boolean;
  result: string | null;
  foodAlt: 0 | 1;
  dessertAlt: 0 | 1;
  toast: string;
  hydrated: boolean;
  autoSpin: boolean;

  say: (m: string) => void;
  setMode: (m: SpinMode) => void;
  setFilters: (f: Partial<Filters>) => void;
  toggleSaved: (placeId: string) => void;
  toggleWheel: (placeId: string) => boolean;
  setWheelStyle: (s: Partial<Pick<State, 'wheelName' | 'emoji' | 'acc'>>) => void;
  refill: () => void;
  beginSpin: () => { ok: true; items: WheelItem[]; k: number } | { ok: false };
  land: (item: WheelItem) => void;
  setResult: (placeId: string) => void;
  swap: (which: 'food' | 'dessert') => void;
  keepEvening: () => boolean;
  lockIn: () => void;
  toggleDeal: (placeId: string) => void;
  rate: (index: number, rating: number) => void;
  setCalm: (v: boolean) => void;
  setLimit: (v: boolean) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
const pick = (): 0 | 1 => (Math.random() < 0.5 ? 0 : 1);

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      saved: {},
      evenings: [],
      deals: [],
      history: [],
      wheel: Object.fromEntries(PLACES.map((p) => [p.id, true])),
      wheelName: 'Night Shift',
      emoji: '🌙',
      acc: ACCENTS[0],
      filters: defaultFilters,
      calm: false,
      limitOn: true,
      spinsLeft: MAX_SPINS,
      night: nightKey(),
      locked: null,
      mode: 'place',
      spinning: false,
      result: null,
      foodAlt: 0,
      dessertAlt: 0,
      toast: '',
      hydrated: false,
      autoSpin: false,

      say: (m) => {
        clearTimeout(toastTimer);
        set({ toast: m });
        toastTimer = setTimeout(() => set({ toast: '' }), 2300);
      },
      setMode: (mode) => set({ mode }),
      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
      toggleSaved: (id) => {
        const on = !get().saved[id];
        set((s) => ({ saved: { ...s.saved, [id]: on } }));
        get().say(on ? 'Saved. Taste is immaculate.' : 'Removed.');
      },
      toggleWheel: (id) => {
        const s = get();
        const on = s.wheel[id] !== false;
        if (on && PLACES.filter((p) => s.wheel[p.id] !== false).length <= 2) {
          s.say('Two minimum. It’s a wheel, not a stick.');
          return false;
        }
        set({ wheel: { ...s.wheel, [id]: !on } });
        return true;
      },
      setWheelStyle: (st) => set(st),
      refill: () => {
        const k = nightKey();
        if (get().night !== k) set({ night: k, spinsLeft: MAX_SPINS });
      },
      beginSpin: () => {
        const s = get();
        s.refill();
        const st = get();
        if (st.spinning) return { ok: false };
        if (st.locked && st.locked.key === nightKey()) {
          st.say('Tonight’s locked. No take-backs, habibi 🔒');
          return { ok: false };
        }
        if (st.limitOn && st.spinsLeft <= 0) {
          st.say(`Out of spins. Refill in ${fmtDuration(msUntilRefill())}, habibi.`);
          return { ok: false };
        }
        const items = wheelItems(st.mode, st.wheel, st.filters);
        if (items.length < 2) {
          st.say('Need two spots minimum, habibi');
          return { ok: false };
        }
        set({ spinning: true, spinsLeft: st.limitOn ? st.spinsLeft - 1 : st.spinsLeft });
        return { ok: true, items, k: Math.floor(Math.random() * items.length) };
      },
      land: (item) =>
        set((s) => ({
          spinning: false,
          result: item.placeId,
          foodAlt: s.mode === 'food' ? item.alt : pick(),
          dessertAlt: s.mode === 'dessert' ? item.alt : pick(),
          history: [{ placeId: item.placeId, mode: s.mode, at: Date.now() }, ...s.history].slice(0, 30),
          deals: s.deals.some((d) => d.placeId === item.placeId)
            ? s.deals
            : [{ placeId: item.placeId, used: false, at: Date.now() }, ...s.deals],
        })),
      setResult: (placeId) => set({ result: placeId, foodAlt: pick(), dessertAlt: pick() }),
      swap: (which) =>
        set((s) => (which === 'food' ? { foodAlt: s.foodAlt === 0 ? 1 : 0 } : { dessertAlt: s.dessertAlt === 0 ? 1 : 0 })),
      keepEvening: () => {
        const s = get();
        if (!s.result) return false;
        const dup = s.evenings.some((e) => e.placeId === s.result && e.foodAlt === s.foodAlt && e.dessertAlt === s.dessertAlt);
        if (dup) {
          s.say('Already kept. Calm down 😭');
          return false;
        }
        set({
          evenings: [
            { id: String(Date.now()), placeId: s.result, foodAlt: s.foodAlt, dessertAlt: s.dessertAlt, at: Date.now() },
            ...s.evenings,
          ],
        });
        s.say('Night kept. Taste is immaculate.');
        return true;
      },
      lockIn: () => {
        const s = get();
        if (!s.result) return;
        set({ locked: { key: nightKey(), placeId: s.result } });
        s.say('Locked in. No take-backs 🔒');
      },
      toggleDeal: (placeId) =>
        set((s) => ({ deals: s.deals.map((d) => (d.placeId === placeId ? { ...d, used: !d.used } : d)) })),
      rate: (index, rating) => set((s) => ({ history: s.history.map((h, i) => (i === index ? { ...h, rating } : h)) })),
      setCalm: (calm) => set({ calm }),
      setLimit: (limitOn) => set({ limitOn }),
    }),
    {
      name: 'spinit-app-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        saved: s.saved, evenings: s.evenings, deals: s.deals, history: s.history, wheel: s.wheel,
        wheelName: s.wheelName, emoji: s.emoji, acc: s.acc, filters: s.filters, calm: s.calm,
        limitOn: s.limitOn, spinsLeft: s.spinsLeft, night: s.night, locked: s.locked,
      }),
      onRehydrateStorage: () => () => useStore.setState({ hydrated: true }),
    },
  ),
);

export const placeOf = (id: string | null): Place | undefined => PLACES.find((p) => p.id === id);
export type { Mood };
