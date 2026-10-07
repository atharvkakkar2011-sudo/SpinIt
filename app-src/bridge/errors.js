/** Classify a Supabase/network error so the UI can answer in its own voice. */
export function errKind(e) {
  const m = String((e && (e.message || e.error_description || e.msg)) || e || '').toLowerCase();
  if (/failed to fetch|networkerror|network request failed|load failed|timeout|offline/.test(m)) return 'offline';
  for (const k of ['out_of_spins', 'locked', 'none_open', 'slot_full', 'not_unlocked', 'no_squad', 'closed', 'need_name', 'full', 'not_signed_in']) {
    if (m.includes(k)) return k;
  }
  if (/invalid login credentials/.test(m)) return 'bad_login';
  if (/already registered|already been registered/.test(m)) return 'exists';
  if (/email not confirmed|confirm_email/.test(m)) return 'confirm_email';
  if (/rate limit|too many/.test(m)) return 'rate_limit';
  if (/password/.test(m) && /(least|short|weak)/.test(m)) return 'weak_password';
  if (/jwt|refresh_token|not authenticated/.test(m)) return 'auth';
  return 'other';
}

const TEXT = {
  signup: { exists: 'That email already has an account. Try logging in?', weak_password: '6+ characters, bestie. Security is hot.', confirm_email: 'Check your inbox to confirm your email, then log in.', rate_limit: 'Slow down a sec, then try again.', offline: 'No connection. Try again when you’re back online.', other: 'Couldn’t sign you up. Try again?' },
  login: { bad_login: 'Wrong combo? Check your email and password.', confirm_email: 'Confirm your email first, then log in.', rate_limit: 'Too many tries. Give it a minute.', offline: 'No connection. Try again when you’re back online.', other: 'Couldn’t log you in. Try again?' },
  spin: { offline: 'Spins need a connection. Get back online and go again.', locked: 'Tonight’s locked. No take-backs 🔒', none_open: 'Everything on your wheel is closed right now. Loosen the filters?', not_signed_in: 'Log in again to spin.', auth: 'Log in again to spin.', other: 'The wheel hiccuped. Try again?' },
};
export const errText = (e, ctx) => (TEXT[ctx] || {})[errKind(e)] || (TEXT[ctx] || {}).other || 'Something went wrong. Try again?';
