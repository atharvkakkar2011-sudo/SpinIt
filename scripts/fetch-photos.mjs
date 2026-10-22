// Downloads every web-linked place photo into app-src/place-photos/ so the app ships them and never shows
// an empty card when a website is slow, blocks hotlinking or moves the picture.
//   node scripts/fetch-photos.mjs          # then: node scripts/gen-seed.mjs && npm run build
// Each downloaded photo replaces its link in supabase/seed-src/places.json (named <place id>.jpg,
// <place id>-2.jpg, …). On a Mac, big photos are shrunk to 1200 px with the built-in `sips` tool.
// Photos that fail are listed and left as links (the app shows a backdrop if they don't load).
// Only download photos you have the right to use in the app.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PLACES = 'supabase/seed-src/places.json';
const DIR = 'app-src/place-photos';
mkdirSync(DIR, { recursive: true });
const places = JSON.parse(readFileSync(PLACES, 'utf8'));
const failed = [];
let saved = 0;

const shrink = (file) => {
  if (process.platform !== 'darwin' || statSync(file).size < 350_000) return;
  try { execFileSync('sips', ['-Z', '1200', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', file, '--out', file], { stdio: 'ignore' }); } catch { /* keep original */ }
};

for (const p of places) {
  const photos = [];
  for (const [i, src] of (p.photos || []).entries()) {
    if (!/^https?:\/\//.test(src)) { photos.push(src); continue; }
    const name = i === 0 && !(p.photos || []).some((x) => x === p.id) ? p.id : `${p.id}-${i + 1}`;
    const file = join(DIR, `${name}.jpg`);
    if (existsSync(file)) { photos.push(name); continue; }
    try {
      const res = await fetch(src, { headers: { 'user-agent': 'Mozilla/5.0 (SpinIt photo import)' }, redirect: 'follow' });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) throw new Error(`${res.status} ${type}`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      shrink(file);
      photos.push(name); saved++;
      console.log(`✓ ${p.id} ${i + 1}`);
    } catch (e) {
      failed.push(`${p.id}: ${src} (${e.message})`);
      photos.push(src);
    }
  }
  p.photos = photos;
}

writeFileSync(PLACES, JSON.stringify(places, null, 1) + '\n');
console.log(`\n${saved} photos saved to ${DIR}.`);
if (failed.length) console.log(`Could not download (left as links):\n  ${failed.join('\n  ')}`);
