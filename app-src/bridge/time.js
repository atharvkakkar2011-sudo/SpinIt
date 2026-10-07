// Doha time helpers. The server rolls a "night" over at 6 PM Asia/Qatar; the app must agree
// no matter what time zone the phone is set to.
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Qatar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function qatarParts(ms = Date.now()) {
  const o = {};
  for (const p of fmt.formatToParts(new Date(ms))) o[p.type] = Number(p.value);
  return o; // year, month (1-12), day, hour, minute
}

/** Same string shape the prototype used ('YYYY-M-D' with a 0-based month), computed in Doha time. */
export function nightKey(ms = Date.now()) {
  const q = qatarParts(ms - 18 * 3600e3);
  return `${q.year}-${q.month - 1}-${q.day}`;
}

/** Server date ('YYYY-MM-DD') -> prototype night key. */
export function nightKeyFromDate(d) {
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return `${y}-${m - 1}-${day}`;
}

/** Milliseconds until the next 6 PM in Doha (15:00 UTC). */
export function refillMs(now = Date.now()) {
  const t = new Date(now);
  t.setUTCHours(15, 0, 0, 0);
  if (t.getTime() <= now) t.setUTCDate(t.getUTCDate() + 1);
  return t.getTime() - now;
}

/** When the user plans to arrive: now, or 6:30 PM today (Doha) if it is earlier than that. */
export function plannedArrival(now = Date.now()) {
  const t = new Date(now);
  t.setUTCHours(15, 30, 0, 0); // 18:30 Doha
  const q = qatarParts(now);
  const hour = q.hour + q.minute / 60;
  return new Date(hour >= 6 && hour < 18.5 ? t.getTime() : now).toISOString();
}

export function timeLabel(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function historyLabel(ms) {
  const d = new Date(ms), now = new Date();
  const same = d.toDateString() === now.toDateString();
  return (same ? 'TODAY ' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }).toUpperCase() + ' ') + timeLabel(ms);
}
