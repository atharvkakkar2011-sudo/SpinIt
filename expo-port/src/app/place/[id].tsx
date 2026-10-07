import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, ScrollView, Switch, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Body, Button, Glass, Headline, Label, RoundButton } from '../../components/ui';
import { photoSource } from '../../data/photos';
import { googleMapsUrl, placeById } from '../../data/places';
import { useStore } from '../../store';
import { colors, fonts } from '../../theme';

export default function PlaceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { acc, saved, toggleSaved, wheel, toggleWheel, wheelName, emoji, setResult } = useStore();
  const [gal, setGal] = useState(0);
  const place = placeById(id);

  if (!place) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Body style={{ color: colors.mid }}>That spot doesn’t exist.</Body>
        <Button label="Back" accent={acc} onPress={() => router.back()} style={{ alignSelf: 'stretch', marginTop: 16 }} />
      </View>
    );
  }
  const onWheel = wheel[place.id] !== false;
  const info: [string, string][] = [['HOURS', place.hours], ['ENTRY', place.price], ['BEST TIME', place.best], ['DINNER NEARBY', place.food[0].name]];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: bottom + 30 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 380 }}>
          <FlatList
            data={place.photos}
            keyExtractor={(p) => p}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setGal(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => <Image source={photoSource(item)} style={{ width, height: 380 }} contentFit="cover" accessibilityLabel={place.name} />}
          />
          <LinearGradient pointerEvents="none" colors={['rgba(14,10,18,0.55)', 'transparent', colors.bg]} locations={[0, 0.4, 1]} style={{ position: 'absolute', width: '100%', height: '100%' }} />
          <View style={{ position: 'absolute', top: top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            <RoundButton glyph="‹" label="Back" onPress={() => router.back()} />
            <RoundButton glyph={saved[place.id] ? '♥' : '♡'} label={saved[place.id] ? 'Remove from saved' : 'Save'} color={saved[place.id] ? acc : colors.white} onPress={() => toggleSaved(place.id)} />
          </View>
          {place.photos.length > 1 && (
            <View style={{ position: 'absolute', bottom: 64, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
              {place.photos.map((p, i) => <View key={p} style={{ width: i === gal ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === gal ? acc : 'rgba(255,255,255,0.5)' }} />)}
            </View>
          )}
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 12 }}>
            <Label style={{ color: acc }}>{place.area.toUpperCase()}</Label>
            <Headline size={30} style={{ marginTop: 6 }}>{place.name}</Headline>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <Body style={{ color: colors.offWhite }}>{place.about}</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {[...place.tags, ...place.moods].map((t) => (
              <Glass key={t} radius={999}><Text style={{ fontFamily: fonts.bodySemi, fontSize: 12.5, color: colors.offWhite, paddingHorizontal: 12, paddingVertical: 6 }}>{t}</Text></Glass>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
            {info.map(([k, v]) => (
              <Glass key={k} radius={16} style={{ width: (width - 50) / 2, padding: 14 }}>
                <Label>{k}</Label>
                <Text numberOfLines={2} style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white, marginTop: 6 }}>{v}</Text>
              </Glass>
            ))}
          </View>

          <Glass radius={18} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 16 }}>
            <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>On {wheelName} {emoji}</Text>
            <Switch value={onWheel} onValueChange={() => { toggleWheel(place.id); }} trackColor={{ true: acc, false: colors.disabled }} thumbColor="#fff" accessibilityLabel={`On ${wheelName}`} />
          </Glass>

          <Button label="Build my night here" accent={acc} style={{ marginTop: 20 }} onPress={() => { setResult(place.id); router.push('/reveal'); }} />
          <Button label="Get directions" variant="glass" accent={acc} style={{ marginTop: 10 }} onPress={() => Linking.openURL(googleMapsUrl(place)).catch(() => useStore.getState().say('Couldn’t open Maps.'))} />
          {place.credit ? <Label style={{ marginTop: 18, color: colors.dim, fontSize: 9 }}>PHOTO: {place.credit.toUpperCase()}</Label> : null}
        </View>
      </ScrollView>
    </View>
  );
}
