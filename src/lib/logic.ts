import type { Mood, Place } from '../data/places';

export const MAX_SPINS = 3;
/** Hour (Asia/Qatar local) at which the nightly spins refill. */
export const REFILL_HOUR = 18;
/** Typical per-person cost used by the budget slider, QAR. */
export const COST_BY_TIER: Record<1 | 2 | 3, number> = { 1: 35, 2: 100, 3: 200 };

export interface Filters {
  mood: Mood | null;
  bMin: number;
  bMax: number; // 400 means "400+" (no upper limit)
  cool: boolean;
  chip: string | null;
  query: string;
}

export const defaultFilters: Filters = { mood: null, bMin: 0, bMax: 400, cool: false, chip: null, query: '' };

export function matches(p: Place, f: Filters): boolean {
  if (f.mood && !p.moods.includes(f.mood)) return false;
  if (f.cool && !p.indoor) return false;
  const cost = COST_BY_TIER[p.budget];
  if (cost < f.bMin || (f.bMax < 400 && cost > f.bMax)) return false;
  if (f.chip && !p.tags.includes(f.chip)) return false;
  const q = f.query.trim().toLowerCase();
  if (q && !`${p.name} ${p.area} ${p.vibe} ${p.tags.join(' ')}`.toLowerCase().includes(q)) return false;
  return true;
}

/** Places that are switched on for the wheel and pass the filters. */
export function wheelList(places: Place[], wheel: Record<string, boolean>, f: Filters): Place[] {
  return places.filter((p) => wheel[p.id] !== false && matches(p, { ...f, chip: null, query: '' }));
}

/**
 * Target rotation (degrees) that lands slice `k` of `n` under the pointer at the top,
 * after `turns` full rotations from the current rotation `cur`.
 */
export function targetRotation(cur: number, k: number, n: number, turns = 5): number {
  const per = 360 / n;
  const want = (360 - k * per - per / 2 + 360) % 360;
  const have = ((cur % 360) + 360) % 360;
  const delta = (want - have + 360) % 360;
  return cur + 360 * turns + delta;
}

/** Index of the slice under the pointer for a given rotation (inverse of targetRotation). */
export function sliceAtRotation(rot: number, n: number): number {
  const per = 360 / n;
  const a = (((-rot) % 360) + 360) % 360;
  return Math.floor(a / per) % n;
}

/** Night key rolls over at 6 PM, matching the spin refill. */
export function nightKey(now = Date.now()): string {
  const d = new Date(now - REFILL_HOUR * 3600e3);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function msUntilRefill(now = new Date()): number {
  const t = new Date(now);
  t.setHours(REFILL_HOUR, 0, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  return t.getTime() - now.getTime();
}

export function fmtDuration(ms: number): string {
  const h = Math.floor(ms / 3600e3);
  const m = Math.floor((ms % 3600e3) / 60e3);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function budgetLabel(min: number, max: number): string {
  if (max >= 400 && min === 0) return 'no limits';
  if (max <= 60) return 'broke era';
  if (max <= 150) return 'balanced queen';
  return 'bougie mode';
}

/** Haversine distance in metres. */
export function distanceM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
