import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Share, Text, View } from 'react-native';
import { Sheet } from '../components/Sheet';
import { Button, Headline, Label } from '../components/ui';
import { photoSource } from '../data/photos';
import { planText } from '../lib/plan';
import { placeOf, useStore } from '../store';
import { colors, fonts } from '../theme';

export default function Story() {
  const { result, foodAlt, dessertAlt, booking, acc } = useStore();
  const p = placeOf(result);
  if (!p) return null;
  const f = p.food[foodAlt] ?? p.food[0];
  const d = p.dessert[dessertAlt] ?? p.dessert[0];
  const bk = booking?.placeId === p.id ? booking : null;
  const rows = [['6:30', p.short], [(bk?.time ?? '8:00 PM').replace(' PM', ''), f.name], ['9:30', d.name]];
  return (
    <Sheet>
      <View style={{ height: 380, borderRadius: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: acc }}>
        <Image source={photoSource(p.photos[0])} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />
        <LinearGradient colors={['rgba(14,10,18,0.5)', 'rgba(14,10,18,0.9)']} style={{ position: 'absolute', width: '100%', height: '100%' }} />
        <View style={{ flex: 1, padding: 22, justifyContent: 'space-between' }}>
          <Label style={{ color: acc }}>🎡 SPIN IT · TONIGHT</Label>
          <View>
            <Headline size={34}>{p.short}</Headline>
            <View style={{ marginTop: 18, gap: 10 }}>
              {rows.map(([t, v]) => (
                <View key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.label, fontSize: 12, color: acc, width: 44 }}>{t}</Text>
                  <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 16, color: colors.white }}>{v}</Text>
                </View>
              ))}
            </View>
          </View>
          <Label>NO TAKE-BACKS · SPINIT.APP</Label>
        </View>
      </View>
      <Button label="Share" accent={acc} style={{ marginTop: 18 }} onPress={() => Share.share({ message: planText(p, f.name, d.name, bk?.time) })} />
    </Sheet>
  );
}
