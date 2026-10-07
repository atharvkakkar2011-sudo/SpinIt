import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface Piece { x0: number; y0: number; vx: number; vy: number; g: number; w: number; h: number; color: string; spin: number; delay: number; dur: number }

function makePieces(width: number, height: number, accent: string, burst: number, rain: number): Piece[] {
  const colors = [accent, '#FFFFFF', '#3DF2FF', '#C6FF3D', '#FFB23D', '#FF3D8B', '#B03DFF'];
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const out: Piece[] = [];
  for (let i = 0; i < burst; i++) {
    const ang = rnd(-Math.PI, 0);
    const sp = rnd(180, 520);
    out.push({ x0: width / 2, y0: height * 0.42, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: rnd(700, 1000), w: rnd(6, 11), h: rnd(8, 16), color: colors[i % colors.length], spin: rnd(-720, 720), delay: 0, dur: rnd(2, 4) });
  }
  for (let i = 0; i < rain; i++) {
    out.push({ x0: rnd(0, width), y0: -20, vx: rnd(-30, 30), vy: rnd(60, 160), g: rnd(150, 300), w: rnd(6, 10), h: rnd(8, 14), color: colors[i % colors.length], spin: rnd(-540, 540), delay: rnd(0, 1.2), dur: rnd(2.5, 4) });
  }
  return out;
}

function Piece({ p, t }: { p: Piece; t: { value: number } }) {
  const style = useAnimatedStyle(() => {
    const s = Math.max(0, t.value - p.delay);
    const k = Math.min(1, s / p.dur);
    return {
      opacity: s <= 0 ? 0 : 1 - Math.max(0, (k - 0.75) / 0.25),
      transform: [
        { translateX: p.x0 + p.vx * s },
        { translateY: p.y0 + p.vy * s + 0.5 * p.g * s * s },
        { rotate: `${p.spin * s}deg` },
      ],
    };
  });
  return <Animated.View style={[{ position: 'absolute', width: p.w, height: p.h, borderRadius: 2, backgroundColor: p.color }, style]} />;
}

/** One-shot confetti: burst from the wheel + rain from the top. Renders nothing in calm mode. */
export function Confetti({ accent, calm }: { accent: string; calm: boolean }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => (calm ? [] : makePieces(width, height, accent, 80, 90)), [calm, width, height, accent]);
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(6, { duration: 6000, easing: Easing.linear });
  }, [t]);
  if (calm) return null;
  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Piece key={i} p={p} t={t} />
      ))}
    </Animated.View>
  );
}
