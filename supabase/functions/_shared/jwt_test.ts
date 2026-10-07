import { signRS256 } from './jwt.ts';

Deno.test('signRS256 produces a JWT that verifies with the matching public key', async () => {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(String.fromCharCode(...der)).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
  const jwt = await signRS256({ iss: 'svc@x.iam.gserviceaccount.com', aud: 'https://oauth2.googleapis.com/token', iat: 1, exp: 2 }, pem);
  const [h, p, s] = jwt.split('.');
  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', kp.publicKey, sig, new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('signature did not verify');
  const claims = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  if (claims.iss !== 'svc@x.iam.gserviceaccount.com') throw new Error('claims mangled');
});
