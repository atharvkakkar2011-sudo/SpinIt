import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../../components/Backdrop';
import { Trippy } from '../../components/Trippy';
import { SPIN_MS, Wheel, WHEEL_SIZE } from '../../components/Wheel';
import { Body, Button, Glass, Headline, Label, Toggle, tap } from '../../components/ui';
import { photoSource } from '../../data/photos';
import { placeById } from '../../data/places';
import { MAX_SPINS, fmtDuration, msUntilRefill, targetRotation } from '../../lib/logic';
import { placeOf, wheelItems, useStore, type SpinMode } from '../../store';
import { colors, fonts } from '../../theme';

const MODES: { id: SpinMode; label: string }[] = [
  { id: 'place', label: 'Place' },
  { id: 'food', label: 'Food' },
  { id: 'dessert', label: 'Dessert' },
];

export default function Spin() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const s = useStore();
  const items = useMemo(() => wheelItems(s.mode, s.wheel, s.filters), [s.mode, s.wheel, s.filters]);
  const itemsKey = items.map((i) => i.key).join('|');
  const [rot, setRot] = useState(0);
  const [landed, setLanded] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [, tick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => { clearInterval(t); timers.current.forEach(clearTimeout); };
  }, []);

  // A changed wheel starts from a clean rotation.
  useEffect(() => { setRot(0); setLanded(null); }, [itemsKey]);

  const spin = useCallback(() => {
    const r = useStore.getState().beginSpin();
    if (!r.ok) return;
    setLanded(null);
    const calm = useStore.getState().calm;
    if (!calm) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRot((cur) => targetRotation(cur, r.k, r.items.length));
    timers.current.push(
      setTimeout(() => {
        const item = r.items[r.k];
        useStore.getState().land(item);
        setLanded(item.placeId);
        if (!calm) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        timers.current.push(setTimeout(() => router.push('/reveal'), 1500));
      }, SPIN_MS + 200),
    );
  }, [router]);

  // "Reroll" on the reveal screen asks for an immediate spin.
  useFocusEffect(
    useCallback(() => {
      if (useStore.getState().autoSpin) {
        useStore.setState({ autoSpin: false });
        timers.current.push(setTimeout(spin, 350));
      }
    }, [spin]),
  );

  const landedPlace = placeOf(landed);
  const spinsText = !s.limitOn
    ? 'Unlimited spins'
    : s.spinsLeft > 0
      ? `${s.spinsLeft} left · refills in ${fmtDuration(msUntilRefill())}`
      : `Out of spins. Refill in ${fmtDuration(msUntilRefill())}`;
  const filterCount = (s.filters.mood ? 1 : 0) + (s.filters.cool ? 1 : 0) + (s.filters.bMin > 0 || s.filters.bMax < 400 ? 1 : 0);

  return (
    <View style={{ flex: 1 }}>
      <Backdrop source={photoSource((landedPlace ?? placeById('corniche')!).photos[0])} dim={landedPlace ? 0.55 : 0.78} />
      <ScrollView contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 20, paddingBottom: 140, alignItems: 'center' }}>
        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => { tap(); router.push('/edit-wheel'); }} accessibilityRole="button" accessibilityLabel="Edit wheel" style={{ flexShrink: 1 }}>
            <Label>YOUR WHEEL ✎</Label>
            <Headline size={24} style={{ marginTop: 4 }}>{s.wheelName} {s.emoji}</Headline>
          </Pressable>
          <Pressable onPress={() => { tap(); router.push('/mood'); }} accessibilityRole="button" accessibilityLabel="Filters">
            <Glass radius={999} style={filterCount ? { borderColor: s.acc } : undefined}>
              <Text style={{ fontFamily: fonts.label, fontSize: 11, letterSpacing: 1.2, color: filterCount ? s.acc : colors.offWhite, paddingHorizontal: 14, paddingVertical: 9 }}>
                VIBE{filterCount ? ` · ${filterCount}` : ''}
              </Text>
            </Glass>
          </Pressable>
        </View>

        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
          {s.limitOn && (
            <View style={{ flexDirection: 'row', gap: 6 }} accessible accessibilityLabel={`${s.spinsLeft} of ${MAX_SPINS} spins left`}>
              {Array.from({ length: MAX_SPINS }, (_, i) => (
                <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i < s.spinsLeft ? s.acc : colors.disabled }} />
              ))}
            </View>
          )}
          <Label>{spinsText.toUpperCase()}</Label>
        </View>

        <Glass radius={999} style={{ flexDirection: 'row', padding: 4, marginTop: 18, alignSelf: 'stretch' }}>
          {MODES.map((m) => {
            const on = s.mode === m.id;
            return (
              <Pressable
                key={m.id}
                disabled={s.spinning}
                onPress={() => { tap(); s.setMode(m.id); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center', backgroundColor: on ? s.acc + '33' : 'transparent', borderWidth: on ? 1.5 : 0, borderColor: s.acc + '88' }}
              >
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? s.acc : colors.mid }}>{m.label}</Text>
              </Pressable>
            );
          })}
        </Glass>

        <View style={{ marginTop: 44, width: WHEEL_SIZE, height: WHEEL_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: WHEEL_SIZE, height: WHEEL_SIZE }}>
            {!s.calm && <View style={{ position: 'absolute', left: -100, top: -100, width: 520, height: 520 }}><Trippy active={s.spinning} /></View>}
          </View>
          {items.length >= 2 ? (
            <Wheel items={items} rotation={rot} accent={s.acc} emoji={s.emoji} />
          ) : (
            <Body style={{ color: colors.mid, textAlign: 'center' }}>Nothing left on the wheel. Loosen the filters.</Body>
          )}
        </View>

        <Body style={{ color: colors.mid, marginTop: 22, textAlign: 'center', minHeight: 22 }}>
          {s.spinning ? 'Hold up… the wheel is cooking' : landedPlace ? `The wheel has spoken · ${landedPlace.short}` : s.limitOn && s.spinsLeft <= 0 ? 'That’s your 3. Commit, no cap.' : `${items.length} options on the wheel`}
        </Body>

        <Button label={s.spinning ? 'COOKING…' : s.limitOn && s.spinsLeft <= 0 ? 'NO SPINS LEFT' : 'YALLA SPIN'} accent={s.acc} disabled={s.spinning || items.length < 2} onPress={spin} style={{ alignSelf: 'stretch', marginTop: 14 }} />
        <Glass radius={18} style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', padding: 12, marginTop: 18 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>Mystery mode 🕵️</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.mid }}>{s.mystery ? 'On · no spoilers' : 'Hide the spot until you’re close'}</Text>
          </View>
          <Toggle value={s.mystery} onValueChange={(v) => { s.patch({ mystery: v }); s.say(v ? 'Mystery on. No peeking 🕵️' : 'Mystery off.'); }} acc={s.acc} label="Mystery mode" />
        </Glass>
        <View style={{ flexDirection: 'row', gap: 22, marginTop: 14 }}>
          <Pressable onPress={() => { tap(); router.push('/edit-wheel'); }} accessibilityRole="button" style={{ padding: 8 }}><Label>EDIT WHEEL</Label></Pressable>
          <Pressable onPress={() => { tap(); router.push('/squad'); }} accessibilityRole="button" style={{ padding: 8 }}><Label style={{ color: s.acc }}>SQUAD SPIN</Label></Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
