import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { Confetti } from '../components/Confetti';
import { Body, Button, Glass, Headline, Label, tap } from '../components/ui';
import { photoSource } from '../data/photos';
import type { MenuItem, Place } from '../data/places';
import { placeOf, useStore } from '../store';
import { colors, fonts } from '../theme';

function Row({ delay, kind, photo, title, sub, price, accent }: { delay: number; kind: string; photo: number | { uri: string }; title: string; sub: string; price?: string; accent: string }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(500)}>
      <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 }}>
        <Image source={photo} style={{ width: 62, height: 62, borderRadius: 14 }} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Label style={{ color: accent }}>{kind}</Label>
          <Text numberOfLines={1} style={{ fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.5, color: colors.white, marginTop: 3 }}>{title}</Text>
          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.mid, marginTop: 2 }}>{sub}</Text>
        </View>
        {price ? <Text style={{ fontFamily: fonts.label, fontSize: 11, color: colors.offWhite }}>{price}</Text> : null}
      </Glass>
    </Animated.View>
  );
}

export default function Reveal() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { result, foodAlt, dessertAlt, acc, calm } = useStore();
  const place: Place | undefined = placeOf(result);
  const flicker = useSharedValue(1);
  useEffect(() => {
    if (calm) return;
    flicker.value = withRepeat(withSequence(withTiming(0.55, { duration: 140 }), withTiming(1, { duration: 140 }), withTiming(0.85, { duration: 90 }), withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })), -1);
  }, [calm, flicker]);
  const flick = useAnimatedStyle(() => ({ opacity: flicker.value }));

  if (!place) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Body style={{ color: colors.mid, textAlign: 'center' }}>Nothing spun yet.</Body>
        <Button label="Back" accent={acc} onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 16 }} />
      </View>
    );
  }
  const food: MenuItem = place.food[foodAlt] ?? place.food[0];
  const dessert: MenuItem = place.dessert[dessertAlt] ?? place.dessert[0];
  const photos = place.photos;

  return (
    <View style={{ flex: 1 }}>
      <Image source={photoSource(photos[0])} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={['rgba(14,10,18,0.35)', 'rgba(14,10,18,0.8)', colors.bg]} locations={[0, 0.45, 0.85]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={{ paddingTop: top + 30, paddingHorizontal: 20, paddingBottom: bottom + 30 }} showsVerticalScrollIndicator={false}>
        <Animated.Text style={[{ fontFamily: fonts.label, fontSize: 12, letterSpacing: 2, color: acc, textAlign: 'center' }, flick]}>🌙 THE WHEEL HAS SPOKEN</Animated.Text>
        <Animated.View entering={ZoomIn.delay(150).springify().damping(9)}>
          <Headline size={38} style={{ textAlign: 'center', marginTop: 14, marginBottom: 26 }}>Yalla, it’s {place.short}.</Headline>
        </Animated.View>

        <View style={{ gap: 10 }}>
          <Row delay={350} kind="PLACE" photo={photoSource(photos[0])} title={place.name} sub={place.vibe} accent={acc} />
          <Row delay={650} kind="DINNER" photo={photoSource(photos[Math.min(1, photos.length - 1)])} title={food.name} sub={food.note} price={food.price} accent={acc} />
          <Row delay={950} kind="DESSERT" photo={photoSource(photos[Math.min(2, photos.length - 1)])} title={dessert.name} sub={dessert.note} price={dessert.price} accent={acc} />
        </View>

        <Animated.View entering={FadeInDown.delay(1250).duration(500)} style={{ marginTop: 16 }}>
          <View style={{ borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: acc, padding: 16, backgroundColor: acc + '14', shadowColor: acc, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }}>
            <Label style={{ color: acc }}>+ BONUS UNLOCKED · {place.deal.code}</Label>
            <Text style={{ fontFamily: fonts.headline, fontSize: 17, letterSpacing: -0.5, color: colors.white, marginTop: 6 }}>{place.deal.title}</Text>
          </View>
        </Animated.View>

        <View style={{ marginTop: 22, gap: 6 }}>
          <Button label="Show me the plan" accent={acc} onPress={() => router.replace('/plan')} />
          <Pressable onPress={() => { tap(); useStore.setState({ autoSpin: true }); router.dismissTo('/spin'); }} accessibilityRole="button" style={{ alignItems: 'center', padding: 14 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.offWhite }}>Not feeling it? <Text style={{ color: acc }}>Reroll</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
      <Confetti accent={acc} calm={calm} />
    </View>
  );
}
