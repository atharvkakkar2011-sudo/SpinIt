// `npm run phone`: try Spin It on your phone with Expo Go.
//   1. builds the app pages: www/ when .env points at a real backend, else www-demo/ (data stays on the phone)
//   2. serves them on your Wi-Fi (port 8096)
//   3. starts Expo in expo-go/ — scan the QR code with Expo Go (Android) or the Camera app (iPhone)
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const npm = win ? 'npm.cmd' : 'npm';
const npx = win ? 'npx.cmd' : 'npx';

let backend = process.env.SPINIT_SUPABASE_URL || '';
if (!backend && existsSync(join(root, '.env'))) {
  const m = /^\s*SPINIT_SUPABASE_URL\s*=\s*(.*?)\s*$/m.exec(readFileSync(join(root, '.env'), 'utf8'));
  backend = m ? m[1].replace(/^["']|["']$/g, '') : '';
}
const live = /^https:\/\//.test(backend) && !/YOUR-PROJECT/.test(backend);
const dir = live ? 'www' : 'www-demo';

execFileSync(process.execPath, [join(root, 'scripts/build-www.mjs'), ...(live ? [] : ['--demo'])], { cwd: root, stdio: 'inherit' });

if (!existsSync(join(root, 'expo-go/node_modules'))) {
  console.log('Installing the Expo Go app (first run only)…');
  execFileSync(npm, ['install', '--no-audit', '--no-fund'], { cwd: join(root, 'expo-go'), stdio: 'inherit', shell: win });
}

const server = spawn(process.execPath, [join(root, 'scripts/serve.mjs'), join(root, dir), '8096'], { env: { ...process.env, HOST: '0.0.0.0' }, stdio: 'inherit' });

const ips = Object.values(networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
console.log(`\nSpin It (${live ? 'connected to ' + backend : 'demo: no backend yet, data stays on the phone'})`);
console.log(`Pages: ${ips.map((ip) => `http://${ip}:8096`).join('  ') || 'http://<this computer>:8096'}`);
console.log('Phone and computer must be on the same Wi-Fi. Allow Node through the firewall if asked.\n');

const expo = spawn(npx, ['expo', 'start', '--lan', ...process.argv.slice(2)], { cwd: join(root, 'expo-go'), stdio: 'inherit', shell: win });
const stop = () => { try { server.kill(); } catch { /* gone */ } try { expo.kill(); } catch { /* gone */ } };
expo.on('exit', (code) => { stop(); process.exit(code ?? 0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
