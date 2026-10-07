import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useStore } from '../store';
import { colors, fonts } from '../theme';
import { Glass } from './ui';

export function Toast() {
  const toast = useStore((s) => s.toast);
  const { top } = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: top + 10, left: 20, right: 20, alignItems: 'center', zIndex: 100 }}>
      <Animated.View key={toast} entering={FadeInDown.duration(220)} exiting={FadeOut.duration(200)}>
        <Glass radius={22} intensity={40}>
          <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.bodySemi, color: colors.white, fontSize: 14, paddingHorizontal: 18, paddingVertical: 12, textAlign: 'center' }}>{toast}</Text>
        </Glass>
      </Animated.View>
    </View>
  );
}
