import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Fixed dimmed photo behind a screen. */
export function Backdrop({ source, dim = 0.72 }: { source: number | { uri: string } | null; dim?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {source != null && <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />}
      <LinearGradient
        colors={[`rgba(14,10,18,${dim - 0.15})`, `rgba(14,10,18,${dim})`, colors.bg]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
