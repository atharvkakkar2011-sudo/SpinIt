import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../../components/Backdrop';
import { PlaceCard } from '../../components/PlaceCard';
import { Body, Chip, Glass, Headline, Label, tap } from '../../components/ui';
import { avatarSource, coverPhoto, photoSource } from '../../data/photos';
import { CHIPS, PLACES, placeById } from '../../data/places';
import { EVENTS, LOCALS, isHot, term } from '../../lib/extra';
import { matches } from '../../lib/logic';
import { useStore } from '../../store';
import { colors, fonts } from '../../theme';

export default function Discover() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { acc, filters, saved, setFilters, toggleSaved, user, history, loc, say } = useStore();
  const t = term(user?.g);
  const last = history[0];
  const lastPlace = last ? placeById(last.placeId) : undefined;
  const hot = isHot();
  const gap = 12;
  const cardW = (width - 40 - gap) / 2;

  const list = useMemo(() => PLACES.filter((p) => matches(p, filters)), [filters]);
  const activeFilters = (filters.mood ? 1 : 0) + (filters.cool ? 1 : 0) + (filters.bMin > 0 || filters.bMax < 400 ? 1 : 0);

  const header = (
    <View style={{ paddingTop: top + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Image source={require('../../../assets/images/logo-pink.png')} style={{ width: 70, height: 16 }} contentFit="contain" accessibilityLabel="Spin It" />
          <Headline size={28} style={{ marginTop: 14 }}>Where to, {t}?</Headline>
        </View>
        <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel="Profile"><Image source={avatarSource(user?.avatar)} style={{ width: 44, height: 44, borderRadius: 22 }} /></Pressable>
      </View>

      <Glass radius={18} style={{ marginTop: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
        <Text style={{ color: colors.mid, fontSize: 16 }}>⌕</Text>
        <TextInput
          value={filters.query}
          onChangeText={(query) => setFilters({ query })}
          placeholder="Search spots, vibes, cuisines"
          placeholderTextColor={colors.dim}
          returnKeyType="search"
          accessibilityLabel="Search places"
          style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.white, paddingVertical: 14, paddingHorizontal: 10 }}
        />
        <Pressable onPress={() => { tap(); router.push('/mood'); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Filters">
          <Text style={{ fontFamily: fonts.label, fontSize: 11, letterSpacing: 1.2, color: activeFilters ? acc : colors.mid }}>
            {activeFilters ? `VIBE · ${activeFilters}` : 'VIBE'}
          </Text>
        </Pressable>
      </Glass>

      {lastPlace && last && !last.rating && !last.skipRate && (
        <Glass radius={22} style={{ marginTop: 16, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={coverPhoto(lastPlace)} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" />
            <Text style={{ flex: 1, fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.4, color: colors.white }}>How was {lastPlace.short}?</Text>
            <Pressable onPress={() => useStore.setState((s) => ({ history: s.history.map((h, i) => (i === 0 ? { ...h, skipRate: true } : h)) }))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss"><Text style={{ color: colors.mid, fontSize: 16 }}>✕</Text></Pressable>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            {[['😴', 'mid'], ['😐', 'ok'], ['🙂', 'decent'], ['🔥', 'fire'], ['💯', 'core memory']].map(([e, label], k) => (
              <Pressable key={label} onPress={() => { useStore.getState().rate(0, k + 1); say(k >= 3 ? 'Noted. The AI will remember that W.' : `Noted. We’ll do better, ${t}.`); }} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
                <Text style={{ fontFamily: fonts.label, fontSize: 8, color: colors.mid }}>{label.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </Glass>
      )}

      {hot && (
        <Glass radius={22} style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
          <Text style={{ fontSize: 28 }}>{filters.cool ? '❄️' : '🥵'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 15, color: colors.white }}>{filters.cool ? 'Indoor-friendly only' : '36° tonight. It’s giving sauna.'}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.mid }}>{filters.cool ? 'Showing spots with AC and shade' : 'Want spots with AC and shade?'}</Text>
          </View>
          <Pressable onPress={() => { setFilters({ cool: !filters.cool }); say(filters.cool ? 'All spots back.' : `AC mode on. Stay cool, ${t}.`); }} accessibilityRole="button" accessibilityState={{ selected: filters.cool }}>
            <View style={{ borderRadius: 999, borderWidth: 1.5, borderColor: acc, backgroundColor: filters.cool ? acc : 'transparent', paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: filters.cool ? '#0E0A12' : acc }}>{filters.cool ? 'On' : 'Stay cool'}</Text>
            </View>
          </Pressable>
        </Glass>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {CHIPS.map((c) => (
          <Chip key={c} label={c} accent={acc} on={filters.chip === c} onPress={() => setFilters({ chip: filters.chip === c ? null : c })} />
        ))}
      </View>

      <Pressable onPress={() => { tap(); router.push('/spin'); }} accessibilityRole="button" style={{ marginTop: 18, marginBottom: 20 }}>
        <Glass radius={22} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderColor: acc + '99' }}>
          <View style={{ flex: 1 }}>
            <Label style={{ color: acc }}>CAN’T DECIDE?</Label>
            <Headline size={18} style={{ marginTop: 6 }}>Let the wheel cook</Headline>
          </View>
          <Text style={{ fontSize: 34 }}>🎡</Text>
        </Glass>
      </Pressable>
      <Label style={{ marginBottom: 10 }}>WHAT’S ON TONIGHT · {new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 22 }}>
        {EVENTS.map((e) => (
          <Pressable key={e.name} onPress={() => router.push(`/place/${e.place}`)} accessibilityRole="button" accessibilityLabel={`${e.name}, ${e.time}`} style={{ width: 220, height: 130, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.glassBorder }}>
            <Image source={photoSource(e.img)} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
            <LinearGradient colors={['transparent', 'rgba(14,10,18,0.92)']} style={{ position: 'absolute', width: '100%', height: '100%' }} />
            <View style={{ position: 'absolute', left: 12, right: 12, bottom: 10 }}>
              <Text style={{ fontFamily: fonts.label, fontSize: 10, color: acc }}>{e.time.toUpperCase()} · {e.tag.toUpperCase()}</Text>
              <Text numberOfLines={2} style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white, marginTop: 3 }}>{e.name}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <Label style={{ marginBottom: 10 }}>LOCAL PICKS</Label>
      <View style={{ gap: 10, marginBottom: 24 }}>
        {LOCALS.map((l) => {
          const lp = placeById(l.place);
          return (
            <Pressable key={l.handle} onPress={() => router.push(`/place/${l.place}`)} accessibilityRole="button">
              <Glass radius={20} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: l.av, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.headline, fontSize: 12, color: '#0E0A12' }}>{l.initial}</Text></View>
                  <Text style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white }}>{l.handle}</Text>
                  <Text style={{ fontFamily: fonts.label, fontSize: 10, color: acc }}>{lp?.short.toUpperCase()}</Text>
                </View>
                <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 20, color: colors.offWhite, marginTop: 10 }}>“{l.quote}”</Text>
              </Glass>
            </Pressable>
          );
        })}
      </View>

      <Label style={{ marginBottom: 12 }}>{list.length} SPOT{list.length === 1 ? '' : 'S'}</Label>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop source={photoSource(placeById('souq')!.photos[0])} />
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, gap }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: 50 }}>
            <Text style={{ fontSize: 40 }}>🫥</Text>
            <Body style={{ color: colors.mid, textAlign: 'center', marginTop: 10 }}>Nothing matches. Loosen the filters, shabab.</Body>
          </View>
        }
        renderItem={({ item }) => (
          <PlaceCard
            place={item}
            index={PLACES.indexOf(item)}
            saved={!!saved[item.id]}
            accent={acc}
            width={cardW}
            onPress={() => router.push(`/place/${item.id}`)}
            onSave={() => toggleSaved(item.id)}
          />
        )}
      />
    </View>
  );
}
