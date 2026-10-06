import { PLACES, placeById, type Place } from '../data/places';
import { COST_BY_TIER, distanceM } from './logic';

export type Gender = 'habibi' | 'habibti' | 'vibes';
export const term = (g?: Gender | null) => (g === 'habibi' ? 'habibi' : g === 'habibti' ? 'habibti' : 'bestie');
export const eraLabel = (g?: Gender | null) => (g === 'habibi' ? 'Habibi era' : g === 'habibti' ? 'Habibti era' : 'Just vibes');

export const okEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** 0–4 password strength, matching the prototype's bar. */
export function passStrength(p: string): number {
  const l = p.length;
  if (l === 0) return 0;
  if (l < 6) return 1;
  if (l < 9) return 2;
  return /[^a-zA-Z]/.test(p) ? 4 : 3;
}
export const PASS_MOOD = ['Waiting on you…', 'Too short, bestie.', 'Mid. Works though.', 'Solid. Respect.', 'Unhackable. Main character.'];

// ---------- Route map ----------
const OFFSETS: [number, number, number, number][] = [
  [0.0032, 0.0021, -0.0018, 0.0042], [0.0024, -0.003, 0.004, 0.0012], [-0.0028, 0.0026, -0.001, -0.0036],
  [0.003, 0.0014, 0.001, -0.0034], [-0.0022, -0.0028, 0.0036, -0.0012], [0.0026, -0.0022, -0.0034, -0.0016],
];
const DOHA_CENTER: [number, number] = [25.2867, 51.526];
export const HOME: [number, number] = [25.322, 51.528];

export const coordsOf = (p: Place): [number, number] => (p.lat != null && p.lng != null ? [p.lat, p.lng] : DOHA_CENTER);

const leg = (m: number) => {
  const km = m / 1000;
  return km < 1.3 ? { mins: Math.max(2, Math.round((km / 5) * 60)), mode: 'walk' } : { mins: Math.round((km / 30) * 60 + 5), mode: 'drive' };
};
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

export interface RoutePlan {
  pts: { x: number; y: number }[];
  others: { name: string; x: number; y: number }[];
  legs: string[];
  totalMins: number;
  fromYouMins: number;
}

export function routeFor(place: Place, index: number): RoutePlan {
  const g0 = coordsOf(place);
  const o = OFFSETS[index % 6];
  const geo: [number, number][] = [g0, [g0[0] + o[0], g0[1] + o[1]], [g0[0] + o[2], g0[1] + o[3]]];
  const lats = geo.map((p) => p[0]);
  const lngs = geo.map((p) => p[1]);
  const cLa = (Math.max(...lats) + Math.min(...lats)) / 2;
  const cLo = (Math.max(...lngs) + Math.min(...lngs)) / 2;
  const span = Math.max(Math.max(...lats) - Math.min(...lats), (Math.max(...lngs) - Math.min(...lngs)) * 0.45, 0.004) * 1.7;
  const proj = (p: [number, number]) => ({ x: 50 + ((p[1] - cLo) / (span / 0.45)) * 100, y: 50 - ((p[0] - cLa) / span) * 100 });
  const pts = geo.map(proj);
  const d1 = distanceM(geo[0], geo[1]);
  const d2 = distanceM(geo[1], geo[2]);
  const l1 = leg(d1);
  const l2 = leg(d2);
  const others = PLACES.filter((p) => p.id !== place.id && p.lat != null)
    .map((p) => ({ name: p.short, ...proj(coordsOf(p)) }))
    .filter((q) => q.x > 4 && q.x < 96 && q.y > 6 && q.y < 94);
  return {
    pts,
    others,
    legs: [`${l1.mins} min ${l1.mode} · ${fmtDist(d1)}`, `${l2.mins} min ${l2.mode} · ${fmtDist(d2)}`],
    totalMins: l1.mins + l2.mins,
    fromYouMins: Math.round((distanceM(HOME, g0) / 1000 / 30) * 60 + 5),
  };
}

// ---------- Content ----------
export const EVENTS: { place: string; time: string; name: string; tag: string; img: string }[] = [
  { place: 'katara', time: '8:00 PM', name: 'Open-air cinema at the amphitheatre', tag: 'Free', img: 'katara-3' },
  { place: 'souq', time: '9:30 PM', name: 'Live oud in the courtyard', tag: 'Free', img: 'souq-1' },
  { place: 'lusail', time: '7:00 PM', name: 'Marina night market', tag: 'QAR 20', img: 'lusail-2' },
  { place: 'msheireb', time: 'Till 11 PM', name: 'Gallery late night', tag: 'Free', img: 'msheireb-2' },
  { place: 'pearl', time: '8:30 PM', name: 'Canal lights boat ride', tag: 'QAR 40', img: 'pearl-3' },
  { place: 'corniche', time: 'Sunset', name: 'Dhow sunset cruise', tag: 'QAR 50', img: 'corniche-1' },
];

export const LOCALS: { handle: string; initial: string; av: string; place: string; quote: string }[] = [
  { handle: '@noor.eats', initial: 'N', av: '#F5EEF6', place: 'souq', quote: 'Skip the main alley. The luqaimat cart near the falcon souq is the real one.' },
  { handle: '@doha.after.dark', initial: 'D', av: '#3DF2FF', place: 'corniche', quote: 'Park by the dhow harbour after 10. Karak, chapati, skyline. Whole night for 15 riyals.' },
  { handle: '@hamad.walks', initial: 'H', av: '#FFB23D', place: 'msheireb', quote: 'Saffron ice cream, then ride the tram loop. Cheapest cute date in Doha.' },
];

export const DIRECTIONS: Record<string, string> = {
  katara: 'North, by the sea', msheireb: 'Downtown, old meets new', lusail: 'Far north, tall towers',
  souq: 'Old Doha, follow the lanterns', pearl: 'North-east, on the water', corniche: 'Along the bay',
};

export const BOOKING_TIMES: [string, string][] = [
  ['7:00 PM', 'Quiet'], ['7:30 PM', ''], ['8:00 PM', 'Popular'], ['8:30 PM', ''],
  ['9:00 PM', 'Full'], ['9:30 PM', ''], ['10:00 PM', 'Late'], ['10:30 PM', ''],
];

export const AVATARS = ['sp-avatar', 'souq-1', 'katara-3', 'pearl-1', 'corniche-1'];

export const BADGES = (spins: number, distinct: number, used: number, kept: number, squad: boolean): [string, string, string, boolean][] => [
  ['🎡', 'First spin', 'Spin once', spins >= 1],
  ['🦉', 'Night owl', '5 spins', spins >= 5],
  ['🧭', 'Explorer', '4 different spots', distinct >= 4],
  ['💸', 'Deal hunter', 'Redeem a bonus', used >= 1],
  ['📌', 'Committed', 'Keep a night', kept >= 1],
  ['👯', 'Shabab leader', 'Run a squad spin', squad],
];

export const isHot = (d = new Date()) => d.getMonth() >= 4 && d.getMonth() <= 9;

// ---------- AI ----------
export interface AiContext { gender?: Gender | null; ratings: { placeId: string; rating: number }[] }

/** Builds the same grounded prompt the prototype sent to the LLM. */
export function buildPrompt(history: { role: 'user' | 'ai'; text: string }[], ctx: AiContext): string {
  const places = PLACES.slice(0, 40)
    .map((p) => `- ${p.short} (${p.name}, ${p.area}): ${p.vibe}. Moods: ${p.moods.join('/')}. ~QAR ${COST_BY_TIER[p.budget]}/person. Food: ${p.food.map((f) => `${f.name} ${f.price}`).join('; ')}. Dessert: ${p.dessert.map((f) => `${f.name} ${f.price}`).join('; ')}. Deal: ${p.deal.title}.`)
    .join('\n');
  const rated = ctx.ratings.slice(0, 6).map((r) => `${placeById(r.placeId)?.short} ${r.rating}/5`).join(', ');
  const convo = history.slice(-8).map((m) => (m.role === 'user' ? 'User: ' : 'You: ') + m.text).join('\n');
  return `You are the AI inside "Spin It", a Doha night-out app. Talk like a Gen Z friend from Doha: casual English with light Arabic slang (yalla, wallah, shabab). Call the user "${term(ctx.gender)}" sometimes. Only recommend from these places, using their exact short names:\n${places}\n\nRules: 2-4 short sentences, under 70 words, no markdown, no lists, no emojis spam (max 1). Recommend 1-2 places, suggest a food and dessert from that place, mention the deal if it fits. Respect budget and vibe if given.${rated ? ` The user rated past nights: ${rated}. Lean toward what they rated high, avoid low ones.` : ''}\n\nConversation:\n${convo}\nYou:`;
}

/**
 * Offline stand-in for the LLM: picks places from the same data using keywords in the
 * question. Replace `complete()` in `src/lib/ai.ts` with a backend call for real answers.
 */
export function localReply(question: string, ctx: AiContext): string {
  const q = question.toLowerCase();
  const t = term(ctx.gender);
  let pool = PLACES.slice(0, 40);
  const cheap = /cheap|budget|broke|under (qar )?\d{2}\b|student/.test(q);
  const m = q.match(/under (?:qar )?(\d+)/);
  if (m) pool = pool.filter((p) => COST_BY_TIER[p.budget] <= Number(m[1]));
  else if (cheap) pool = pool.filter((p) => p.budget === 1);
  if (/date|romantic|cute|anniversary/.test(q)) pool = pool.filter((p) => p.moods.includes('Romantic'));
  else if (/parent|family|kids|mum|mom|dad/.test(q)) pool = pool.filter((p) => p.moods.includes('Family'));
  else if (/chill|quiet|relax|karak|calm/.test(q)) pool = pool.filter((p) => p.moods.includes('Chill'));
  else if (/shabab|friends|crew|adventur|wild|fun/.test(q)) pool = pool.filter((p) => p.moods.includes('Adventurous'));
  const low = new Set(ctx.ratings.filter((r) => r.rating <= 2).map((r) => r.placeId));
  const high = new Set(ctx.ratings.filter((r) => r.rating >= 4).map((r) => r.placeId));
  pool = pool.filter((p) => !low.has(p.id)).sort((a, b) => Number(high.has(b.id)) - Number(high.has(a.id)) || a.budget - b.budget);
  if (!pool.length) return `Wallah that's a tough one, ${t}. Tell me your vibe and budget and I'll find something.`;
  const a = pool[0];
  const b = pool[1];
  return `Yalla ${t}, go ${a.short}. ${a.food[0].name} for dinner, then ${a.dessert[0].name} to finish, and you unlock ${a.deal.title.toLowerCase()}.${b ? ` Backup plan: ${b.short}.` : ''}`;
}

/** Place short-names mentioned in a reply, in order of appearance (max 3). */
export function placesIn(reply: string): Place[] {
  return PLACES.map((p) => ({ p, at: reply.indexOf(p.short) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
    .map((x) => x.p);
}
