import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { RangeSlider } from '../components/RangeSlider';
import { Sheet } from '../components/Sheet';
import { Button, Chip, Headline, Label } from '../components/ui';
import { MOODS, PLACES } from '../data/places';
import { budgetLabel, defaultFilters, matches } from '../lib/logic';
import { useStore } from '../store';
import { colors, fonts } from '../theme';

const WHO = ['Solo', 'Date', 'Friends', 'Family'];
const WHEN = ['Tonight', 'This weekend'];

export default function MoodSheet() {
  const router = useRouter();
  const { filters, setFilters, acc, who, when, patch } = useStore();
  const count = PLACES.filter((p) => matches(p, { ...filters, chip: null, query: '' })).length;

  return (
    <Sheet>
          <Headline size={24}>What’s the vibe?</Headline>

          <Label style={{ marginTop: 20, marginBottom: 10 }}>VIBE</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {MOODS.map((m) => (
              <Chip key={m} label={m} accent={acc} on={filters.mood === m} onPress={() => setFilters({ mood: filters.mood === m ? null : m })} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, marginBottom: 2 }}>
            <Label>BUDGET · PER PERSON</Label>
            <Text style={{ fontFamily: fonts.bodySemi, fontSize: 13, color: acc }}>
              {filters.bMin > 0 || filters.bMax < 400 ? `QAR ${filters.bMin}–${filters.bMax}${filters.bMax >= 400 ? '+' : ''}` : 'Any budget'} · {budgetLabel(filters.bMin, filters.bMax)}
            </Text>
          </View>
          <RangeSlider lo={filters.bMin} hi={filters.bMax} accent={acc} onChange={(bMin, bMax) => setFilters({ bMin, bMax })} />

          <Label style={{ marginTop: 14, marginBottom: 10 }}>WHO’S COMING</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WHO.map((w) => <Chip key={w} label={w} accent={acc} on={who === w} onPress={() => patch({ who: w })} />)}
          </View>
          <Label style={{ marginTop: 20, marginBottom: 10 }}>WHEN</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {WHEN.map((w) => <Chip key={w} label={w} accent={acc} on={when === w} onPress={() => patch({ when: w })} />)}
          </View>

          <Label style={{ marginTop: 20, marginBottom: 10 }}>WEATHER</Label>
          <Chip label="🥵 Stay cool (indoor-friendly)" accent={acc} on={filters.cool} onPress={() => setFilters({ cool: !filters.cool })} />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 26 }}>
            <Button label="Reset" variant="glass" accent={acc} onPress={() => setFilters({ ...defaultFilters, chip: filters.chip, query: filters.query })} style={{ flex: 1 }} />
            <Button label={count === 0 ? 'Nothing here' : `Show me ${count} spot${count === 1 ? '' : 's'}`} accent={acc} disabled={count === 0} onPress={() => router.back()} style={{ flex: 2 }} />
          </View>
          {count < 2 && count > 0 && <Text style={{ fontFamily: fonts.body, color: colors.mid, fontSize: 13, marginTop: 10, textAlign: 'center' }}>Heads up: the wheel needs two spots minimum.</Text>}
    </Sheet>
  );
}
