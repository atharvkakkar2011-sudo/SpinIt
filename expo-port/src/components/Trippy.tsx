import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

const NEON = ['#FF3D8B', '#B03DFF', '#3DF2FF', '#C6FF3D', '#FFB23D'];
const SIZE = 520;
const C = SIZE / 2;

function stripes() {
  const n = 20;
  return Array.from({ length: n }, (_, i) => {
    const a0 = (i * 360) / n;
    const a1 = a0 + 360 / n / 2;
    const p = (a: number) => [C + C * Math.sin((a * Math.PI) / 180), C - C * Math.cos((a * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return { d: `M ${C} ${C} L ${x0} ${y0} A ${C} ${C} 0 0 1 ${x1} ${y1} Z`, fill: NEON[i % NEON.length] };
  });
}
const STRIPES = stripes();

/** Rotating neon stripes + pulsing rings, masked radially so it blooms behind the wheel. */
export function Trippy({ active }: { active: boolean }) {
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(active ? 1 : 0, { duration: active ? 300 : 600 });
    if (active) {
      spin.value = 0;
      spin.value = withRepeat(withTiming(360, { duration: 3200, easing: Easing.linear }), -1);
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1);
    }
  }, [active, spin, pulse, fade]);

  const wrap = useAnimatedStyle(() => ({ opacity: fade.value * 0.75 }));
  const rotate = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ rotate: `${-spin.value * 1.6}deg` }] }));
  const ring = useAnimatedStyle(() => ({ opacity: 1 - pulse.value, transform: [{ scale: 0.6 + pulse.value * 0.7 }] }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, wrap]}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Animated.View style={[StyleSheet.absoluteFill, rotate]}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <RadialGradient id="fade" cx="50%" cy="50%" r="50%">
                <Stop offset="0.3" stopColor="#fff" stopOpacity="1" />
                <Stop offset="1" stopColor="#fff" stopOpacity="0" />
              </RadialGradient>
              <Mask id="m1">
                <Rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#fade)" />
              </Mask>
            </Defs>
            <G mask="url(#m1)">
              {STRIPES.map((s, i) => (
                <Path key={i} d={s.d} fill={s.fill} opacity={0.7} />
              ))}
            </G>
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, counter, { opacity: 0.4 }]}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <RadialGradient id="fade2" cx="50%" cy="50%" r="50%">
                <Stop offset="0.3" stopColor="#fff" stopOpacity="1" />
                <Stop offset="1" stopColor="#fff" stopOpacity="0" />
              </RadialGradient>
              <Mask id="m2">
                <Rect x={0} y={0} width={SIZE} height={SIZE} fill="url(#fade2)" />
              </Mask>
            </Defs>
            <G mask="url(#m2)">
              {STRIPES.filter((_, i) => i % 4 === 0).map((s, i) => (
                <Path key={i} d={s.d} fill="#fff" opacity={0.35} />
              ))}
            </G>
          </Svg>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, ring]}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={C} cy={C} r={C * 0.7} stroke="#fff" strokeWidth={3} fill="none" />
          </Svg>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
