import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteMap } from '../components/RouteMap';
import { Body, Button, Glass, Headline, Label, RoundButton, tap } from '../components/ui';
import { photoSource } from '../data/photos';
import { PLACES, googleMapsUrl } from '../data/places';
import { addNightToCalendar } from '../lib/calendar';
import { routeFor, term } from '../lib/extra';
import { budgetLabel, nightKey } from '../lib/logic';
import { planText, whatsappUrl } from '../lib/plan';
import { placeOf, useStore } from '../store';
import { colors, fonts } from '../theme';

function Stop({ time, kind, title, note, price, leg, onSwap, onBook, bookLabel, booked, accent, last }: {
  time: string; kind: string; title: string; note: string; price?: string; leg?: string; onSwap?: () => void;
  onBook?: () => void; bookLabel?: string; booked?: boolean; accent: string; last?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center', width: 18 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }} />
        {!last && <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 8 }}>
        <Label style={{ color: accent }}>{time} · {kind}</Label>
        <Text style={{ fontFamily: fonts.headline, fontSize: 18, letterSpacing: -0.6, color: colors.white, marginTop: 5 }}>{title}</Text>
        <Body style={{ color: colors.mid, fontSize: 14, marginTop: 3 }}>{note}{price ? ` · ${price}` : ''}</Body>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {onSwap && (
            <Pressable onPress={() => { tap(); onSwap(); }} accessibilityRole="button" accessibilityLabel={`Swap ${kind.toLowerCase()}`} hitSlop={8}>
              <Glass radius={999}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: colors.offWhite, paddingHorizontal: 12, paddingVertical: 6 }}>⇄ Swap</Text></Glass>
            </Pressable>
          )}
          {onBook && (
            <Pressable onPress={() => { tap(); onBook(); }} accessibilityRole="button" hitSlop={8}>
              <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: accent, backgroundColor: booked ? accent : 'transparent', paddingHorizontal: 12, paddingVertical: 6 }}>
                <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: booked ? '#0E0A12' : accent }}>{bookLabel}</Text>
              </View>
            </Pressable>
          )}
        </View>
        {leg ? <Text style={{ fontFamily: fonts.label, fontSize: 10.5, letterSpacing: 0.8, color: colors.dim, marginTop: 12, marginBottom: 6 }}>↓ {leg.toUpperCase()}</Text> : null}
      </View>
    </View>
  );
}

export default function Plan() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const s = useStore();
  const place = placeOf(s.result);
  if (!place) return null;
  const t = term(s.user?.g);
  const { foodAlt, dessertAlt, acc } = s;
  const food = place.food[foodAlt] ?? place.food[0];
  const dessert = place.dessert[dessertAlt] ?? place.dessert[0];
  const bk = s.booking && s.booking.placeId === place.id && s.booking.foodAlt === foodAlt ? s.booking : null;
  const anyBk = s.booking && s.booking.placeId === place.id ? s.booking : null;
  const kept = s.evenings.some((e) => e.placeId === place.id && e.foodAlt === foodAlt && e.dessertAlt === dessertAlt);
  const isLocked = s.locked?.key === nightKey();
  const route = routeFor(place, PLACES.indexOf(place));
  const text = planText(place, food.name, dessert.name, bk?.time);
  const budget = `QAR ${s.filters.bMin}–${s.filters.bMax}${s.filters.bMax >= 400 ? '+' : ''}`;
  const tags = [s.when, s.who, s.filters.bMin > 0 || s.filters.bMax < 400 ? budget : 'Any budget'];
  const deal = s.deals.find((d) => d.placeId === place.id);

  const lock = async () => {
    s.lockIn();
    const ok = await addNightToCalendar(`Spin It night · ${place.short}`, `${place.name}, Doha`, `${food.name} then ${dessert.name}. No take-backs.`);
    if (!ok) s.say('Locked in. (Couldn’t add to calendar.)');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 330 }}>
          <Image source={photoSource(place.photos[0])} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          <LinearGradient colors={['rgba(14,10,18,0.5)', 'transparent', colors.bg]} locations={[0, 0.4, 1]} style={{ position: 'absolute', width: '100%', height: '100%' }} />
          <View style={{ position: 'absolute', top: top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <RoundButton glyph="‹" label="Back" onPress={() => router.back()} />
            <RoundButton glyph="⇪" label="Share" onPress={() => Share.share({ message: text })} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: -40 }}>
          <Label style={{ color: acc }}>TONIGHT’S PLAN</Label>
          <Headline size={30} style={{ marginTop: 6 }}>{place.name}</Headline>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {tags.map((x) => (
              <Glass key={x} radius={999}><Text style={{ fontFamily: fonts.label, fontSize: 10.5, letterSpacing: 1, color: colors.offWhite, paddingHorizontal: 12, paddingVertical: 7 }}>{x.toUpperCase()}</Text></Glass>
            ))}
          </View>

          <View style={{ marginTop: 20 }}>
            <RouteMap route={route} labels={[place.short, food.tag, dessert.tag]} accent={acc} showFromYou={s.loc} calm={s.calm} />
          </View>

          <View style={{ marginTop: 24 }}>
            <Stop time="6:30 PM" kind="GO" title={place.short} note={place.about} price={place.price} leg={route.legs[0]} accent={acc} />
            <Stop time={bk?.time ?? '8:00 PM'} kind="EAT" title={food.name} note={food.note} price={food.price} leg={route.legs[1]} onSwap={() => { s.swap('food'); s.say('Dinner swapped. Better fr.'); }}
              onBook={() => router.push('/book')} booked={!!bk} bookLabel={bk ? `✓ Booked · ${bk.size} ppl` : 'Reserve a table'} accent={acc} />
            <Stop time="9:30 PM" kind="SWEET" title={dessert.name} note={dessert.note} price={dessert.price} onSwap={() => { s.swap('dessert'); s.say('Dessert swapped. Better fr.'); }} accent={acc} last />
          </View>

          <Pressable onPress={() => { tap(); s.patch({ qrFor: place.id }); router.push('/qr'); }} accessibilityRole="button" style={{ marginTop: 24 }}>
            <View style={{ borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: acc, padding: 16, backgroundColor: acc + '14' }}>
              <Label style={{ color: acc }}>+ BONUS UNLOCKED · {place.deal.code}</Label>
              <Text style={{ fontFamily: fonts.headline, fontSize: 16, letterSpacing: -0.5, color: colors.white, marginTop: 6 }}>{place.deal.title}</Text>
              <Body style={{ color: colors.mid, fontSize: 13, marginTop: 4 }}>{deal?.used ? 'Redeemed. Eat up.' : 'Tap to show the QR at your stop'}</Body>
            </View>
          </Pressable>

          <Glass radius={22} style={{ marginTop: 18, padding: 16 }}>
            {isLocked ? (
              <>
                <Label style={{ color: acc }}>LOCKED IN 🔒</Label>
                {[`Table booked · ${anyBk ? `${anyBk.size} ppl at ${anyBk.time}` : '2 ppl at 8:00 PM'}`, 'In your calendar · 6:30 PM', 'Spins frozen till tomorrow'].map((c) => (
                  <Text key={c} style={{ fontFamily: fonts.bodySemi, fontSize: 14.5, color: colors.white, marginTop: 8 }}>✓ {c}</Text>
                ))}
                <Pressable onPress={() => { tap(); s.unlock(); s.say('Unlocked. The wheel is judging you.'); }} accessibilityRole="button" style={{ marginTop: 14 }}><Text style={{ fontFamily: fonts.bodySemi, color: colors.mid }}>Unlock (the wheel will judge)</Text></Pressable>
              </>
            ) : (
              <>
                <Label>READY?</Label>
                <Body style={{ color: colors.offWhite, marginTop: 6, marginBottom: 12 }}>Lock it in: books a table, adds it to your calendar, freezes your spins. No take-backs.</Body>
                <Button label="Lock it in 🔒" accent={acc} onPress={lock} />
              </>
            )}
          </Glass>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Button label={kept ? 'Kept ✓' : 'Keep it'} variant="glass" accent={acc} onPress={() => (kept ? s.patch({ evenings: s.evenings.filter((e) => !(e.placeId === place.id && e.foodAlt === foodAlt && e.dessertAlt === dessertAlt)) }) : s.keepEvening())} style={{ flex: 1 }} />
            <Button label="Take me there" accent={acc} onPress={() => Linking.openURL(googleMapsUrl(place)).catch(() => s.say('Couldn’t open Maps.'))} style={{ flex: 1.3 }} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button label="WhatsApp" variant="glass" accent={acc} onPress={() => Linking.openURL(whatsappUrl(text)).catch(() => s.say('Couldn’t open WhatsApp.'))} style={{ flex: 1 }} />
            <Button label="Story card" variant="glass" accent={acc} onPress={() => router.push('/story')} style={{ flex: 1 }} />
          </View>
          <Pressable onPress={() => { tap(); if (isLocked) return s.say('Tonight’s locked, ' + t + '. No take-backs.'); s.patch({ autoSpin: true }); router.dismissTo('/spin'); }} accessibilityRole="button" style={{ alignItems: 'center', padding: 16 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.offWhite }}>Not feeling it? <Text style={{ color: acc }}>Re-spin</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
