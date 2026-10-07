import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { colors, fonts } from '../theme';
import { tap } from './ui';

const ICONS: Record<string, string> = { index: '🧭', spin: '🎡', ai: '✦', profile: '☻' };
const LABELS: Record<string, string> = { index: 'Explore', spin: 'Spin', ai: 'AI', profile: 'You' };
const SPRING = { damping: 14, stiffness: 180, mass: 0.8 };

/** Floating glass pill with a draggable lens that snaps to the active tab. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets();
  const acc = useStore((s) => s.acc);
  const [w, setW] = useState(0);
  const n = state.routes.length;
  const inner = Math.max(0, w - 12);
  const cell = inner / n;
  const x = useSharedValue(0);
  const stretch = useSharedValue(1);

  useEffect(() => {
    if (cell) x.value = withSpring(state.index * cell, SPRING);
  }, [state.index, cell, x]);

  const go = (i: number) => {
    const r = state.routes[i];
    if (i !== state.index) {
      tap();
      navigation.navigate(r.name);
    }
  };

  const pan = Gesture.Pan()
    .onChange((e) => {
      x.value = Math.min(inner - cell, Math.max(0, x.value + e.changeX));
      stretch.value = Math.min(1.7, 1 + Math.abs(e.velocityX) / 2500);
    })
    .onEnd(() => {
      const i = Math.round(x.value / cell);
      x.value = withSpring(i * cell, SPRING);
      stretch.value = withSpring(1, SPRING);
      runOnJS(go)(i);
    });

  const lens = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scaleX: stretch.value }, { scaleY: 1 / Math.sqrt(stretch.value) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(bottom, 0) + 20 }}>
      <View onLayout={onLayout} style={styles.pill}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1, padding: 6, flexDirection: 'row' }}>
            {cell > 0 && (
              <Animated.View style={[styles.lens, { width: cell, backgroundColor: acc + '30', borderColor: acc + '88' }, lens]} />
            )}
            {state.routes.map((r, i) => {
              const on = state.index === i;
              return (
                <Pressable
                  key={r.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={LABELS[r.name]}
                  onPress={() => go(i)}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}
                >
                  <Text style={{ fontSize: 20, color: on ? acc : colors.mid }}>{ICONS[r.name]}</Text>
                  <Text style={{ fontFamily: fonts.label, fontSize: 9, letterSpacing: 1, color: on ? acc : colors.dim }}>{LABELS[r.name]?.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { height: 68, borderRadius: 34, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  lens: { position: 'absolute', top: 6, bottom: 6, left: 6, borderRadius: 28, borderWidth: 1.5 },
});
