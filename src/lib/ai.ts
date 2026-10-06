import { buildPrompt, localReply, type AiContext } from './extra';

/**
 * Set EXPO_PUBLIC_AI_ENDPOINT to a backend route (see docs/design/BACKEND.md, "AI tab")
 * that accepts `{ prompt }` and returns `{ text }`. Without it the app answers locally.
 */
const ENDPOINT = process.env.EXPO_PUBLIC_AI_ENDPOINT;

export async function complete(history: { role: 'user' | 'ai'; text: string }[], ctx: AiContext): Promise<string> {
  const last = history[history.length - 1]?.text ?? '';
  if (!ENDPOINT) {
    await new Promise((r) => setTimeout(r, 700));
    return localReply(last, ctx);
  }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: buildPrompt(history, ctx) }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return String(data.text ?? '').trim();
}
