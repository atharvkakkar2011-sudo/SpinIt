import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Glass, Headline, Label, RoundButton, tap } from '../components/ui';
import { photoSource } from '../data/photos';
import { googleMapsUrl } from '../data/places';
import { nightKey } from '../lib/logic';
import { placeOf, useStore } from '../store';
import { colors, fonts } from '../theme';

const BUDGET_LABEL = { 1: 'QAR 20–50', 2: 'QAR 50–150', 3: 'QAR 150+' } as const;

function Stop({ time, kind, title, note, price, onSwap, accent, last }: { time: string; kind: string; title: string; note: string; price?: string; onSwap?: () => void; accent: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center', width: 18 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }} />
        {!last && <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 22 }}>
        <Label style={{ color: accent }}>{time} · {kind}</Label>
        <Text style={{ fontFamily: fonts.headline, fontSize: 18, letterSpacing: -0.6, color: colors.white, marginTop: 5 }}>{title}</Text>
        <Body style={{ color: colors.mid, fontSize: 14, marginTop: 3 }}>{note}{price ? ` · ${price}` : ''}</Body>
        {onSwap && (
          <Pressable onPress={() => { tap(); onSwap(); }} accessibilityRole="button" accessibilityLabel={`Swap ${kind.toLowerCase()}`} hitSlop={8} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
            <Glass radius={999}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.offWhite, paddingHorizontal: 12, paddingVertical: 6 }}>⇄ Swap</Text></Glass>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function Plan() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { result, foodAlt, dessertAlt, acc, swap, keepEvening, evenings, lockIn, locked } = useStore();
  const who = 'Friends';
  const when = 'Tonight';
  const place = placeOf(result);
  if (!place) return null;
  const food = place.food[foodAlt] ?? place.food[0];
  const dessert = place.dessert[dessertAlt] ?? place.dessert[0];
  const kept = evenings.some((e) => e.placeId === place.id && e.foodAlt === foodAlt && e.dessertAlt === dessertAlt);
  const isLocked = locked?.key === nightKey() && locked.placeId === place.id;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 330 }}>
          <Image source={photoSource(place.photos[0])} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <LinearGradient colors={['rgba(14,10,18,0.5)', 'transparent', colors.bg]} locations={[0, 0.4, 1]} style={{ position: 'absolute', width: '100%', height: '100%' }} />
          <View style={{ position: 'absolute', top: top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <RoundButton glyph="‹" label="Back" onPress={() => router.back()} />
            <RoundButton glyph="⇪" label="Share" onPress={() => Share.share({ message: `Tonight: ${place.name} → ${food.name} → ${dessert.name}. Planned on Spin It 🎡` })} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: -40 }}>
          <Label style={{ color: acc }}>TONIGHT’S PLAN</Label>
          <Headline size={30} style={{ marginTop: 6 }}>{place.name}</Headline>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {[when, who, BUDGET_LABEL[place.budget]].map((t) => (
              <Glass key={t} radius={999}><Text style={{ fontFamily: fonts.label, fontSize: 10.5, letterSpacing: 1, color: colors.offWhite, paddingHorizontal: 12, paddingVertical: 7 }}>{t.toUpperCase()}</Text></Glass>
            ))}
          </View>

          <View style={{ marginTop: 26 }}>
            <Stop time="6:30 PM" kind="PLACE" title={place.short} note={place.vibe} accent={acc} />
            <Stop time="8:00 PM" kind="DINNER" title={food.name} note={food.note} price={food.price} onSwap={() => swap('food')} accent={acc} />
            <Stop time="9:30 PM" kind="DESSERT" title={dessert.name} note={dessert.note} price={dessert.price} onSwap={() => swap('dessert')} accent={acc} last />
          </View>

          <View style={{ marginTop: 26, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: acc, padding: 16, backgroundColor: acc + '14' }}>
            <Label style={{ color: acc }}>+ BONUS UNLOCKED · {place.deal.code}</Label>
            <Text style={{ fontFamily: fonts.headline, fontSize: 16, letterSpacing: -0.5, color: colors.white, marginTop: 6 }}>{place.deal.title}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <Button label={kept ? 'Kept ✓' : 'Keep it'} variant="glass" accent={acc} onPress={keepEvening} style={{ flex: 1 }} />
            <Button label="Take me there" accent={acc} onPress={() => Linking.openURL(googleMapsUrl(place)).catch(() => useStore.getState().say('Couldn’t open Maps.'))} style={{ flex: 1.3 }} />
          </View>
          <Button label={isLocked ? 'Locked in 🔒' : 'Lock it in (no take-backs)'} variant="glass" accent={acc} disabled={isLocked} onPress={lockIn} style={{ marginTop: 10 }} />
          <Pressable onPress={() => { tap(); useStore.setState({ autoSpin: true }); router.dismissTo('/spin'); }} accessibilityRole="button" style={{ alignItems: 'center', padding: 16 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.offWhite }}>Not feeling it? <Text style={{ color: acc }}>Re-spin</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
