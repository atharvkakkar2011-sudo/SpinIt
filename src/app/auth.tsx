import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Body, Button, Field, Glass, Headline, Label, tap } from '../components/ui';
import { photoSource } from '../data/photos';
import { PASS_MOOD, okEmail, passStrength, term, type Gender } from '../lib/extra';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

type Mode = 'welcome' | 'signup' | 'login';
const BG = { welcome: 'lusail-1', signup: 'corniche-3', login: 'katara-2' } as const;
const STEP_COPY = [
  ['First things first. Who dis?', 'Name and email. That’s it, promise.'],
  ['Lock it in.', '6+ characters. Nothing sus like 123456.'],
  ['So what do we call you?', 'Pick one. The app talks to you different.'],
];
const GENDERS: [Gender, string, string][] = [
  ['habibi', 'Habibi', 'He/him energy'],
  ['habibti', 'Habibti', 'She/her energy'],
  ['vibes', 'Just vibes', 'Keep it neutral, bestie'],
];

export default function Auth() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { acc, user, setUser, say } = useStore();
  const [mode, setMode] = useState<Mode>('welcome');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [g, setG] = useState<Gender | null>(null);
  const [err, setErr] = useState('');
  const strength = passStrength(pass);

  const clear = (fn: () => void) => { setErr(''); fn(); };
  const back = () => (mode === 'signup' && step > 0 ? setStep(step - 1) : setMode('welcome'));

  const next = () => {
    if (step === 0) {
      if (!name.trim()) return setErr('We need a name. No anonymous legends.');
      if (!okEmail(email)) return setErr('That email looks sus. Try again?');
      return clear(() => setStep(1));
    }
    if (step === 1) {
      if (pass.length < 6) return setErr('6+ characters, bestie. Security is hot.');
      return clear(() => setStep(2));
    }
    if (!g) return setErr('Pick one, we don’t bite.');
    setUser({ name: name.trim(), email: email.trim(), g });
    say(`You’re in, ${term(g)}. Quick setup.`);
    router.replace('/setup');
  };

  const login = () => {
    if (!okEmail(email)) return setErr('That email looks sus. Double-check it.');
    if (pass.length < 6) return setErr('Wrong combo? Passwords are 6+ characters.');
    const prev = user && user.email === email.trim() ? user : null;
    const u = prev ?? { name: email.split('@')[0], email: email.trim(), g: 'vibes' as Gender };
    setUser(u);
    say(`Welcome back, ${term(u.g)}. Missed you.`);
    router.replace('/');
  };

  const showPass = (
    <Pressable onPress={() => setShow(!show)} hitSlop={8} accessibilityRole="button" style={{ paddingRight: 14 }}>
      <Label>{show ? 'HIDE' : 'SHOW'}</Label>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop source={photoSource(BG[mode])} dim={mode === 'welcome' ? 0.45 : 0.8} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: top + 16, paddingBottom: bottom + 24, paddingHorizontal: 22 }}>
          {mode === 'welcome' ? (
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Image source={require('../../assets/images/logo-white.png')} style={{ width: 150, height: 46, marginBottom: 22 }} contentFit="contain" accessibilityLabel="Spin It" />
              <Headline size={40}>Can’t decide? Same.</Headline>
              <Body style={{ color: colors.offWhite, marginTop: 12, marginBottom: 28 }}>Spin a wheel of Doha’s best spots, get dinner and dessert lined up, and unlock bonuses. Arguing about where to go is officially over.</Body>
              <Button label="Sign up" accent={acc} onPress={() => { setMode('signup'); setStep(0); setErr(''); }} />
              <Button label="Log in" variant="glass" accent={acc} onPress={() => { setMode('login'); setErr(''); }} style={{ marginTop: 10 }} />
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Pressable onPress={() => { tap(); back(); }} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 8 }}>
                <Label>‹ BACK</Label>
              </Pressable>

              {mode === 'signup' ? (
                <View style={{ marginTop: 14 }}>
                  <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
                    {[0, 1, 2].map((k) => <View key={k} style={{ width: 28, height: 5, borderRadius: 3, backgroundColor: k <= step ? acc : 'rgba(255,255,255,0.2)' }} />)}
                  </View>
                  <Label style={{ color: acc }}>STEP {step + 1} OF 3</Label>
                  <Headline size={32} style={{ marginTop: 8 }}>{STEP_COPY[step][0]}</Headline>
                  <Body style={{ color: colors.mid, marginTop: 8, marginBottom: 24 }}>{STEP_COPY[step][1]}</Body>

                  {step === 0 && (
                    <View style={{ gap: 12 }}>
                      <Field label="Name" value={name} onChangeText={(t) => { setName(t); setErr(''); }} placeholder="Your name" autoCapitalize="words" />
                      <Field label="Email" value={email} onChangeText={(t) => { setEmail(t); setErr(''); }} placeholder="you@email.com" keyboardType="email-address" onSubmitEditing={next} />
                    </View>
                  )}
                  {step === 1 && (
                    <View>
                      <Field label="Password" value={pass} onChangeText={(t) => { setPass(t); setErr(''); }} placeholder="Password" secure={!show} right={showPass} onSubmitEditing={next} />
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14 }}>
                        {[1, 2, 3, 4].map((k) => <View key={k} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: k <= strength ? (strength < 2 ? '#FF7AB0' : acc) : 'rgba(255,255,255,0.18)' }} />)}
                      </View>
                      <Label style={{ marginTop: 10 }}>{PASS_MOOD[strength].toUpperCase()}</Label>
                    </View>
                  )}
                  {step === 2 && (
                    <View style={{ gap: 10 }}>
                      {GENDERS.map(([k, label, note]) => {
                        const on = g === k;
                        return (
                          <Pressable key={k} onPress={() => { tap(); setG(k); setErr(''); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
                            <Glass radius={18} style={on ? { backgroundColor: acc, borderColor: acc } : undefined}>
                              <View style={{ padding: 16 }}>
                                <Text style={{ fontFamily: fonts.headline, fontSize: 18, letterSpacing: -0.5, color: on ? '#0E0A12' : colors.white }}>{label}</Text>
                                <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: on ? '#0E0A12' : colors.offWhite, marginTop: 3 }}>{note}</Text>
                              </View>
                            </Glass>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  {err ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodySemi, color: '#FF7AB0', marginTop: 14 }}>{err}</Text> : null}
                  <Button label={step < 2 ? 'Next' : g ? `Yalla, let’s go ${term(g)}` : 'Yalla, let’s go'} accent={acc} onPress={next} style={{ marginTop: 22 }} />
                </View>
              ) : (
                <View style={{ marginTop: 14 }}>
                  <Headline size={34}>Welcome back.</Headline>
                  <Body style={{ color: colors.mid, marginTop: 8, marginBottom: 24 }}>The wheel missed you.</Body>
                  <View style={{ gap: 12 }}>
                    <Field label="Email" value={email} onChangeText={(t) => { setEmail(t); setErr(''); }} placeholder="you@email.com" keyboardType="email-address" />
                    <Field label="Password" value={pass} onChangeText={(t) => { setPass(t); setErr(''); }} placeholder="Password" secure={!show} right={showPass} onSubmitEditing={login} />
                  </View>
                  <Pressable onPress={() => say(okEmail(email) ? 'Reset link sent. Check your inbox.' : 'Drop your email first, bestie.')} accessibilityRole="button" style={{ alignSelf: 'flex-end', paddingVertical: 12 }}>
                    <Text style={{ fontFamily: fonts.bodySemi, color: acc }}>Forgot it?</Text>
                  </Pressable>
                  {err ? <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodySemi, color: '#FF7AB0', marginBottom: 8 }}>{err}</Text> : null}
                  <Button label="Log in" accent={acc} onPress={login} />
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
