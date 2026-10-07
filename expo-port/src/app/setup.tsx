import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../components/Backdrop';
import { Body, Button, Glass, Headline, Label, tap } from '../components/ui';
import { photoSource } from '../data/photos';
import { MOODS, type Mood } from '../data/places';
import { term } from '../lib/extra';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const BUDGETS = [
  { label: 'Broke era', note: 'QAR 0–60', lo: 0, hi: 60 },
  { label: 'Balanced', note: 'QAR 50–150', lo: 50, hi: 150 },
  { label: 'Bougie', note: 'QAR 150+', lo: 150, hi: 400 },
  { label: 'No limits', note: 'ANY', lo: 0, hi: 400 },
];
const VIBE_NOTES: Record<Mood, string> = { Chill: 'karak + sea breeze', Romantic: 'date night coded', Adventurous: 'chaos, the good kind', Family: 'bring the parents' };

export default function Setup() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const s = useStore();
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState<number | null>(null);
  const t = term(s.user?.g);

  const STEPS = [
    { icon: '📍', k: 'STEP 1 · LOCATION', t: 'Where you at?', sub: 'We’ll show spots near you first and work out drive times. Never shared, promise.', cta: 'Allow location', no: 'Not now', bg: 'souq-3' },
    { icon: '🔔', k: 'STEP 2 · NOTIFICATIONS', t: 'Want a heads-up?', sub: 'One ping when spins refill at 6 PM, and when the shabab start a squad spin. No spam, fr.', cta: 'Turn on notifications', no: 'Maybe later', bg: 'corniche-1' },
    { icon: '✨', k: 'STEP 3 · YOUR VIBE', t: 'What’s your usual vibe?', sub: 'Pick as many as you want. Your wheel leans this way.', cta: s.favVibes.length ? 'Next' : 'Pick at least one', no: '', bg: 'katara-1' },
    { icon: '💸', k: 'STEP 4 · BUDGET', t: 'What’s the budget looking like?', sub: 'Per person, roughly. You can change it anytime.', cta: 'Build my wheel', no: '', bg: 'pearl-2' },
  ][step];

  const finish = (msg: string) => { s.say(msg); router.replace('/'); };

  const yes = async () => {
    if (step === 0) {
      let ok = true;
      try {
        // A denied/ignored browser prompt must never block onboarding.
        const res = await Promise.race([Location.requestForegroundPermissionsAsync(), new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
        ok = res ? res.status === 'granted' : false;
      } catch { ok = false; }
      s.patch({ loc: ok });
      s.say(ok ? 'Location on. We see you 📍' : 'No location. We’ll guess Doha.');
      return setStep(1);
    }
    if (step === 1) { s.patch({ notif: true }); return setStep(2); }
    if (step === 2) {
      if (!s.favVibes.length) return s.say(`Pick at least one, ${t}.`);
      s.setFilters({ mood: s.favVibes.length === 1 ? s.favVibes[0] : null });
      return setStep(3);
    }
    if (budget != null) s.setFilters({ bMin: BUDGETS[budget].lo, bMax: BUDGETS[budget].hi });
    finish(`Wheel built around you. Yalla, ${t}.`);
  };
  const no = () => { if (step === 0) s.patch({ loc: false }); if (step === 1) s.patch({ notif: false }); setStep(step + 1); };
  const pickStyle = (on: boolean) => (on ? { backgroundColor: s.acc, borderColor: s.acc } : undefined);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop source={photoSource(STEPS.bg)} dim={0.8} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: top + 16, paddingBottom: bottom + 24, paddingHorizontal: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[0, 1, 2, 3].map((k) => <View key={k} style={{ width: 28, height: 5, borderRadius: 3, backgroundColor: k <= step ? s.acc : 'rgba(255,255,255,0.2)' }} />)}
          </View>
          <Pressable onPress={() => { tap(); finish('Skipped. You can set it up in Profile.'); }} hitSlop={10} accessibilityRole="button"><Label>SKIP</Label></Pressable>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 30 }}>
          <Text style={{ fontSize: 54 }}>{STEPS.icon}</Text>
          <Label style={{ color: s.acc, marginTop: 18 }}>{STEPS.k}</Label>
          <Headline size={32} style={{ marginTop: 8 }}>{STEPS.t}</Headline>
          <Body style={{ color: colors.mid, marginTop: 10 }}>{STEPS.sub}</Body>

          {step === 2 && (
            <View style={{ gap: 10, marginTop: 22 }}>
              {MOODS.map((m) => {
                const on = s.favVibes.includes(m);
                return (
                  <Pressable key={m} onPress={() => { tap(); s.patch({ favVibes: on ? s.favVibes.filter((x) => x !== m) : [...s.favVibes, m] }); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <Glass radius={18} style={pickStyle(on)}>
                      <View style={{ padding: 16 }}>
                        <Text style={{ fontFamily: fonts.headline, fontSize: 17, letterSpacing: -0.5, color: on ? '#0E0A12' : colors.white }}>{m}</Text>
                        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: on ? '#0E0A12' : colors.offWhite, marginTop: 2 }}>{VIBE_NOTES[m]}</Text>
                      </View>
                    </Glass>
                  </Pressable>
                );
              })}
            </View>
          )}
          {step === 3 && (
            <View style={{ gap: 10, marginTop: 22 }}>
              {BUDGETS.map((b, i) => {
                const on = budget === i;
                return (
                  <Pressable key={b.label} onPress={() => { tap(); setBudget(i); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <Glass radius={18} style={pickStyle(on)}>
                      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontFamily: fonts.headline, fontSize: 17, letterSpacing: -0.5, color: on ? '#0E0A12' : colors.white }}>{b.label}</Text>
                        <Text style={{ fontFamily: fonts.label, fontSize: 11, color: on ? '#0E0A12' : colors.offWhite }}>{b.note}</Text>
                      </View>
                    </Glass>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <Button label={STEPS.cta} accent={s.acc} onPress={yes} />
        {STEPS.no ? (
          <Pressable onPress={() => { tap(); no(); }} accessibilityRole="button" style={{ alignItems: 'center', padding: 16 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.mid }}>{STEPS.no}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
