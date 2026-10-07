import { createClient } from '@supabase/supabase-js';
import { $, config } from './api.js';

const sb = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { detectSessionInUrl: true, persistSession: false } });
const say = (t, ok) => { $('#msg').className = `msg ${ok ? 'ok' : 'bad'}`; $('#msg').textContent = t; };
$('#save').onclick = async () => {
  const pw = $('#pw').value;
  if (pw.length < 6) return say('6+ characters, bestie.');
  const { data } = await sb.auth.getSession();
  if (!data.session) return say('This link has expired. Ask for a new one from the app.');
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) return say('Couldn’t save it. Try again?');
  say('Done. Go back to the app and log in.', true);
  $('#save').disabled = true;
};
