import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../../components/Backdrop';
import { PlaceCard } from '../../components/PlaceCard';
import { Body, Chip, Glass, Headline, Label, tap } from '../../components/ui';
import { photoSource } from '../../data/photos';
import { CHIPS, PLACES, placeById } from '../../data/places';
import { matches } from '../../lib/logic';
import { useStore } from '../../store';
import { colors, fonts } from '../../theme';

export default function Discover() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { acc, filters, saved, setFilters, toggleSaved } = useStore();
  const gap = 12;
  const cardW = (width - 40 - gap) / 2;

  const list = useMemo(() => PLACES.filter((p) => matches(p, filters)), [filters]);
  const activeFilters = (filters.mood ? 1 : 0) + (filters.cool ? 1 : 0) + (filters.bMin > 0 || filters.bMax < 400 ? 1 : 0);

  const header = (
    <View style={{ paddingTop: top + 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Image source={require('../../../assets/images/logo-pink.png')} style={{ width: 70, height: 16 }} contentFit="contain" accessibilityLabel="Spin It" />
          <Headline size={28} style={{ marginTop: 14 }}>Where to, habibi?</Headline>
        </View>
        <Image source={require('../../../assets/images/sp-avatar.png')} style={{ width: 44, height: 44, borderRadius: 22 }} />
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
