// Builds www/ (what Capacitor ships) from the untouched design files:
//   design/SpinIt App v2.dc.html  --patches-->  www/index.html
//   design/img, sp-avatar.png     ------------>  www/
//   app-src/place-photos          ------------>  www/img/s
//   app-src/vendor (React + the design runtime), app-src/fonts  -->  www/
//   app-src/bridge  --esbuild-->  www/spinit-bridge.js
// Backend settings come from the environment (or a .env file):
//   SPINIT_SUPABASE_URL, SPINIT_SUPABASE_ANON_KEY, SPINIT_WEB_BASE
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPatches, demoPatches } from './patches.mjs';
import { categoryMap } from './place-cats.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// --demo: no backend; the design keeps its own on-device storage (www-demo/, used by `npm run phone`)
const demo = process.argv.includes('--demo');
const out = join(root, demo ? 'www-demo' : 'www');

// tiny .env reader (no dependency)
const env = { ...process.env };
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const html = applyPatches(readFileSync(join(root, 'design/SpinIt App v2.dc.html'), 'utf8'), demo ? demoPatches : undefined);
writeFileSync(join(out, 'index.html'), html);

cpSync(join(root, 'design/img'), join(out, 'img'), { recursive: true });
// photos of places added after the design (scripts/import_places.py); the design looks them up as img/s/<name>.jpg
cpSync(join(root, 'app-src/place-photos'), join(out, 'img/s'), { recursive: true });
cpSync(join(root, 'design/sp-avatar.png'), join(out, 'sp-avatar.png'));
cpSync(join(root, 'app-src/vendor'), out, { recursive: true });
cpSync(join(root, 'app-src/fonts'), join(out, 'fonts'), { recursive: true });

const config = {
  supabaseUrl: env.SPINIT_SUPABASE_URL || 'http://127.0.0.1:54321',
  supabaseAnonKey: env.SPINIT_SUPABASE_ANON_KEY || 'dev-anon-key',
  webBase: env.SPINIT_WEB_BASE || 'https://spinit.app',
};
writeFileSync(join(out, 'config.js'), `window.SPINIT_CONFIG = ${JSON.stringify(config)};\n`);

// The design ships 6 + 28 places; anything after that in places.json is added on top.
const places = JSON.parse(readFileSync(join(root, 'supabase/seed-src/places.json'), 'utf8'));
// plus every place's Explore categories (scripts/place-cats.mjs)
writeFileSync(join(out, 'places-extra.js'), `window.SPINIT_EXTRA_PLACES = ${JSON.stringify(places.slice(34))};\nwindow.SPINIT_PLACE_CATS = ${JSON.stringify(categoryMap(places))};\n`);

if (demo) {
  console.log('www-demo/ ready (no backend: data stays on the device)');
  process.exit(0);
}

await build({
  entryPoints: [join(root, 'app-src/bridge/index.js')],
  outfile: join(out, 'spinit-bridge.js'),
  bundle: true, format: 'iife', target: ['es2020', 'ios15', 'chrome90'], minify: true, sourcemap: false,
  loader: { '.json': 'json' }, logLevel: 'warning',
});

console.log(`www/ ready (backend: ${config.supabaseUrl})`);
