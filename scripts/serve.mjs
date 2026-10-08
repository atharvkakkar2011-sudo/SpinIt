// Minimal static server for local testing: `node scripts/serve.mjs www 8096` or
// `node scripts/serve.mjs web-dist 8095` (applies the same short-URL rewrites as vercel.json).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [dir = 'www', port = '8096'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const REWRITES = [[/^\/s\/[^/]+\/?$/, '/squad.html'], [/^\/b\/[^/]+\/?$/, '/booking.html'], [/^\/i\/[^/]+\/?$/, '/invite.html'], [/^\/staff\/?$/, '/staff.html'], [/^\/reset\/?$/, '/reset.html']];

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const [re, to] of REWRITES) if (re.test(path)) path = to;
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(dir, path));
  if (!file.startsWith(normalize(dir))) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
  // HOST=0.0.0.0 makes it reachable from a phone on the same Wi-Fi (npm run phone)
}).listen(Number(port), process.env.HOST || '127.0.0.1', () => console.log(`serving ${dir} on http://${process.env.HOST || '127.0.0.1'}:${port}`));
