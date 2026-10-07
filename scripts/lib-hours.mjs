// Parses the human-readable opening hours in Doha_Night_Out_Places.xlsx ("Sat–Thu 8 AM–8 PM; Fri 4 PM–8 PM")
// into rows for public.place_hours. Text it cannot read yields no rows, which the database treats as "open".
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseTime(s) {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(s.trim());
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2] ?? 0);
}
const fmt = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function parseDays(s) {
  const out = new Set();
  for (const part of s.split(',')) {
    const [a, b] = part.trim().toLowerCase().split(/[–-]/).map((x) => DAYS.indexOf(x.trim().slice(0, 3)));
    if (a < 0) return null;
    if (b === undefined || Number.isNaN(b)) out.add(a);
    else for (let d = a; ; d = (d + 1) % 7) { out.add(d); if (d === b) break; }
  }
  return [...out];
}

export function parseHours(text) {
  const rows = [];
  for (const seg of String(text ?? '').split(';')) {
    const s = seg.trim();
    const m = /^(daily|[A-Za-z–\-, ]+?)\s+(24 hours|closed|.+)$/i.exec(s);
    if (!m) continue;
    const days = m[1].toLowerCase() === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : parseDays(m[1]);
    if (!days) continue;
    const rest = m[2].trim();
    if (/^closed$/i.test(rest)) continue;
    if (/^24 hours$/i.test(rest)) { for (const d of days) rows.push({ weekday: d, opens: '00:00', closes: '00:00', closes_next_day: false }); continue; }
    const [o, c] = rest.split(/[–-]/).map((x) => parseTime(x));
    if (o == null || c == null) continue;
    for (const d of days) rows.push({ weekday: d, opens: fmt(o), closes: fmt(c), closes_next_day: c <= o });
  }
  return rows;
}
