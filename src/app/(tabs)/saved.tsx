import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Chip, Glass, Headline, tap } from '../../components/ui';
import { coverPhoto } from '../../data/photos';
import { PLACES, placeById } from '../../data/places';
import { useStore } from '../../store';
import { colors, fonts } from '../../theme';

function Empty({ emoji, text, cta, onPress, acc }: { emoji: string; text: string; cta: string; onPress: () => void; acc: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Body style={{ color: colors.mid, textAlign: 'center' }}>{text}</Body>
      <Button label={cta} accent={acc} onPress={onPress} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </View>
  );
}

export default function Saved() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { saved, evenings, acc, toggleSaved, setResult } = useStore();
  const [tab, setTab] = useState<'places' | 'evenings'>('places');
  const spots = PLACES.filter((p) => saved[p.id]);

  return (
    <ScrollView contentContainerStyle={{ paddingTop: top + 16, paddingHorizontal: 20, paddingBottom: 140 }}>
      <Headline size={30}>Saved</Headline>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <Chip label={`Spots · ${spots.length}`} accent={acc} on={tab === 'places'} onPress={() => setTab('places')} />
        <Chip label={`Nights · ${evenings.length}`} accent={acc} on={tab === 'evenings'} onPress={() => setTab('evenings')} />
      </View>

      <View style={{ marginTop: 18, gap: 10 }}>
        {tab === 'places' && spots.length === 0 && <Empty emoji="♡" text="No saved spots yet. Tap the heart on anything that looks good." cta="Go browse" onPress={() => router.navigate('/')} acc={acc} />}
        {tab === 'places' && spots.map((p) => (
          <Pressable key={p.id} onPress={() => { tap(); router.push(`/place/${p.id}`); }} accessibilityRole="button">
            <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 }}>
              <Image source={coverPhoto(p)} style={{ width: 64, height: 64, borderRadius: 14 }} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.5, color: colors.white }}>{p.short}</Text>
                <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.mid, marginTop: 3 }}>{p.vibe}</Text>
              </View>
              <Pressable onPress={() => toggleSaved(p.id)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Remove ${p.short}`}><Text style={{ fontSize: 18, color: colors.mid, padding: 6 }}>✕</Text></Pressable>
            </Glass>
          </Pressable>
        ))}

        {tab === 'evenings' && evenings.length === 0 && <Empty emoji="🌙" text="No kept nights yet. Spin, then hit “Keep it” on the plan." cta="Spin it" onPress={() => router.navigate('/spin')} acc={acc} />}
        {tab === 'evenings' && evenings.map((e) => {
          const p = placeById(e.placeId);
          if (!p) return null;
          return (
            <Pressable key={e.id} onPress={() => { tap(); useStore.setState({ result: p.id, foodAlt: e.foodAlt, dessertAlt: e.dessertAlt }); router.push('/plan'); }} accessibilityRole="button">
              <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 }}>
                <Image source={coverPhoto(p)} style={{ width: 64, height: 64, borderRadius: 14 }} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.5, color: colors.white }}>{p.short}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.mid, marginTop: 3 }}>{(p.food[e.foodAlt] ?? p.food[0]).name} → {(p.dessert[e.dessertAlt] ?? p.dessert[0]).name}</Text>
                  <Text style={{ fontFamily: fonts.label, fontSize: 10, color: colors.dim, marginTop: 4 }}>{new Date(e.at).toLocaleDateString()}</Text>
                </View>
                <Pressable onPress={() => useStore.setState((s) => ({ evenings: s.evenings.filter((x) => x.id !== e.id) }))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Remove night"><Text style={{ fontSize: 18, color: colors.mid, padding: 6 }}>✕</Text></Pressable>
              </Glass>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
