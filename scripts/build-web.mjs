// Builds web-dist/: the small pages that work without the app (squad voting, venue booking
// confirmation, staff QR scanner, password reset, invite landing). Deploy the folder to any
// static host; vercel.json maps the short URLs the app shares.
//   SPINIT_SUPABASE_URL, SPINIT_SUPABASE_ANON_KEY  (same as the app)
//   SPINIT_IOS_TEAM_ID, SPINIT_ANDROID_SHA256      (optional, for universal/app links)
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'web/src'), out = join(root, 'web-dist');
const env = { ...process.env };
if (existsSync(join(root, '.env'))) for (const l of readFileSync(join(root, '.env'), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l); if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, '.well-known'), { recursive: true });
for (const f of ['squad.html', 'booking.html', 'staff.html', 'reset.html', 'invite.html', 'base.css', 'api.js']) cpSync(join(src, f), join(out, f));
cpSync(join(root, 'app-src/fonts'), join(out, 'fonts'), { recursive: true });
cpSync(join(root, 'design/img/logo-pink.png'), join(out, 'logo-pink.png'));
writeFileSync(join(out, 'config.js'), `window.SPINIT_CONFIG = ${JSON.stringify({ supabaseUrl: env.SPINIT_SUPABASE_URL || 'http://127.0.0.1:54321', supabaseAnonKey: env.SPINIT_SUPABASE_ANON_KEY || 'dev-anon-key' })};\n`);
await build({ entryPoints: { staff: join(src, 'staff.js'), reset: join(src, 'reset.js') }, outdir: out, bundle: true, format: 'esm', minify: true, target: ['es2020'], logLevel: 'warning' });

writeFileSync(join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/i/SPINIT"><title>Spin It</title>');
// Universal links (iOS) and app links (Android) so spinit.app/s/..., /i/... open the app when installed.
const team = env.SPINIT_IOS_TEAM_ID || 'TEAMID';
writeFileSync(join(out, '.well-known/apple-app-site-association'), JSON.stringify({ applinks: { details: [{ appIDs: [`${team}.app.spinit.mobile`], components: [{ '/': '/i/*' }, { '/': '/s/*' }] }] } }, null, 2));
writeFileSync(join(out, '.well-known/assetlinks.json'), JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'app.spinit.mobile', sha256_cert_fingerprints: [env.SPINIT_ANDROID_SHA256 || 'REPLACE_WITH_RELEASE_SHA256'] } }], null, 2));
writeFileSync(join(out, 'vercel.json'), JSON.stringify({
  cleanUrls: true,
  rewrites: [
    { source: '/s/:code', destination: '/squad.html' },
    { source: '/b/:token', destination: '/booking.html' },
    { source: '/i/:code', destination: '/invite.html' },
    { source: '/staff', destination: '/staff.html' },
    { source: '/reset', destination: '/reset.html' },
  ],
  headers: [{ source: '/.well-known/apple-app-site-association', headers: [{ key: 'Content-Type', value: 'application/json' }] }],
}, null, 2));
console.log('web-dist/ ready');
