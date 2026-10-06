// Makes an `expo export --platform web` build servable from any sub-path (e.g. a hosted artifact).
// Rewrites absolute asset URLs to relative ones and pins <base> before the router reads the URL.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/web-relative.mjs <dist-dir>');

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
for (const f of walk(dir).filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(f, 'utf8');
  writeFileSync(f, src.replaceAll('"/assets/', '"./assets/').replaceAll("'/assets/", "'./assets/").replaceAll('`/assets/', '`./assets/'));
}

const prelude =
  '<script>(function(){var b=location.href.split("#")[0].split("?")[0].replace(/[^\\/]*$/,"");document.write(\'<base href="\'+b+\'">\');try{history.replaceState(null,"","/")}catch(e){}})()</script>';
const htmlPath = join(dir, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
html = html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />${prelude}`).replaceAll('src="/_expo/', 'src="./_expo/').replaceAll('href="/favicon', 'href="./favicon');
writeFileSync(htmlPath, html);
console.log('relative-path web build ready:', dir);
