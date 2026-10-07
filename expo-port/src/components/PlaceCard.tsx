import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';
import { coverPhoto } from '../data/photos';
import type { Place } from '../data/places';
import { colors, fonts } from '../theme';
import { tap } from './ui';

export function PlaceCard({ place, index, saved, onPress, onSave, accent, width }: { place: Place; index: number; saved: boolean; onPress: () => void; onSave: () => void; accent: string; width: number }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={`${place.short}, ${place.vibe}`}
      style={({ pressed }) => ({ width, height: width * 1.3, borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.glassBorder, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <Image source={coverPhoto(place)} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" transition={250} recyclingKey={place.id} />
      <LinearGradient colors={['rgba(14,10,18,0.25)', 'transparent', 'rgba(14,10,18,0.92)']} locations={[0, 0.4, 1]} style={{ position: 'absolute', width: '100%', height: '100%' }} />
      <Text style={{ position: 'absolute', top: 12, left: 14, fontFamily: fonts.label, fontSize: 12, letterSpacing: 1.5, color: accent }}>{String(index + 1).padStart(2, '0')}</Text>
      <Pressable
        onPress={() => { tap(); onSave(); }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
        style={{ position: 'absolute', top: 6, right: 8, padding: 8 }}
      >
        <Text style={{ fontSize: 18, color: saved ? accent : colors.white }}>{saved ? '♥' : '♡'}</Text>
      </Pressable>
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.headline, fontSize: 16, letterSpacing: -0.6, color: colors.white }}>{place.short}</Text>
        <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.mid, marginTop: 3 }}>{place.vibe}</Text>
      </View>
    </Pressable>
  );
}
