import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Chip, Glass, Headline, Label } from '../components/ui';
import { MOODS, PLACES } from '../data/places';
import { defaultFilters, matches } from '../lib/logic';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const BUDGETS = [
  { label: 'Broke era', sub: 'QAR 0–60', min: 0, max: 60 },
  { label: 'Balanced', sub: 'QAR 50–150', min: 50, max: 150 },
  { label: 'Bougie', sub: 'QAR 150+', min: 150, max: 400 },
  { label: 'No limits', sub: 'Anything', min: 0, max: 400 },
];

export default function MoodSheet() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { filters, setFilters, acc } = useStore();
  const count = PLACES.filter((p) => matches(p, { ...filters, chip: null, query: '' })).length;
  const budgetOn = (b: (typeof BUDGETS)[number]) => filters.bMin === b.min && filters.bMax === b.max;

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel="Close" />
      <Glass radius={28} intensity={60} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: colors.card }}>
        <ScrollView style={{ maxHeight: 640 }} contentContainerStyle={{ padding: 22, paddingBottom: bottom + 22 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.disabled, alignSelf: 'center', marginBottom: 16 }} />
          <Headline size={24}>What’s the vibe?</Headline>

          <Label style={{ marginTop: 20, marginBottom: 10 }}>VIBE</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MOODS.map((m) => (
              <Chip key={m} label={m} accent={acc} on={filters.mood === m} onPress={() => setFilters({ mood: filters.mood === m ? null : m })} />
            ))}
          </View>

          <Label style={{ marginTop: 20, marginBottom: 10 }}>BUDGET</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BUDGETS.map((b) => (
              <Chip key={b.label} label={`${b.label} · ${b.sub}`} accent={acc} on={budgetOn(b) && !(b.min === 0 && b.max === 400)} onPress={() => setFilters({ bMin: b.min, bMax: b.max })} />
            ))}
          </View>

          <Label style={{ marginTop: 20, marginBottom: 10 }}>WEATHER</Label>
          <Chip label="🥵 Stay cool (indoor-friendly)" accent={acc} on={filters.cool} onPress={() => setFilters({ cool: !filters.cool })} />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 26 }}>
            <Button label="Reset" variant="glass" accent={acc} onPress={() => setFilters({ ...defaultFilters, chip: filters.chip, query: filters.query })} style={{ flex: 1 }} />
            <Button label={count === 0 ? 'Nothing here' : `Show me ${count} spot${count === 1 ? '' : 's'}`} accent={acc} disabled={count === 0} onPress={() => router.back()} style={{ flex: 2 }} />
          </View>
          {count < 2 && count > 0 && <Text style={{ fontFamily: fonts.body, color: colors.mid, fontSize: 13, marginTop: 10, textAlign: 'center' }}>Heads up: the wheel needs two spots minimum.</Text>}
        </ScrollView>
      </Glass>
    </View>
  );
}
