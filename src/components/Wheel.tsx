import { memo, useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Image as SvgImage, Line, Path, Text as SvgText } from 'react-native-svg';
import { photoSource } from '../data/photos';
import type { WheelItem } from '../store';
import { colors, fonts } from '../theme';

export const WHEEL_SIZE = 322;
export const SPIN_MS = 4200;
const SPIN_EASING = Easing.bezier(0.12, 0.72, 0.14, 1);

const polar = (c: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
};

function wedge(c: number, r: number, a0: number, a1: number) {
  const p0 = polar(c, r, a0);
  const p1 = polar(c, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${c} ${c} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`;
}

interface Props {
  items: WheelItem[];
  rotation: number;
  accent: string;
  emoji: string;
  size?: number;
}

function WheelImpl({ items, rotation, accent, emoji, size = WHEEL_SIZE }: Props) {
  const rot = useSharedValue(rotation);
  const c = size / 2;
  const r = c - 6;
  const n = items.length;
  const per = 360 / n;

  useEffect(() => {
    if (Math.abs(rot.value - rotation) < 0.001) return;
    if (rotation < rot.value) rot.value = rotation; // reset without animating (never spin backwards)
    else rot.value = withTiming(rotation, { duration: SPIN_MS, easing: SPIN_EASING });
    return () => cancelAnimation(rot);
  }, [rotation, rot]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  const slices = useMemo(
    () =>
      items.map((it, i) => {
        const a0 = i * per;
        const a1 = a0 + per;
        const pts = [polar(c, 0, 0), polar(c, r, a0), polar(c, r, a1), polar(c, r, (a0 + a1) / 2)];
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const w = Math.max(...xs) - x;
        const h = Math.max(...ys) - y;
        const mid = a0 + per / 2;
        return { it, path: wedge(c, r, a0, a1), x, y, w, h, mid, a0, edge: polar(c, r, a0) };
      }),
    [items, per, c, r],
  );

  // Dense wheels read along the radius; sparse ones read across the slice.
  const radial = n > 10;
  const fontSize = n > 16 ? 8 : n > 10 ? 10 : n > 6 ? 11 : 13;
  const maxChars = radial ? 16 : 14;

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`Wheel with ${n} options`}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size}>
          <Defs>
            {slices.map((s, i) => (
              <ClipPath id={`clip${i}`} key={i}>
                <Path d={s.path} />
              </ClipPath>
            ))}
          </Defs>
          <Circle cx={c} cy={c} r={r} fill={colors.card} />
          {slices.map((s, i) => (
            <G key={s.it.key} clipPath={`url(#clip${i})`}>
              <SvgImage x={s.x} y={s.y} width={s.w} height={s.h} href={photoSource(s.it.photo)} preserveAspectRatio="xMidYMid slice" />
              <Path d={s.path} fill="rgba(14,10,18,0.28)" />
              {[true, false].map((outline) => (
                <SvgText
                  key={outline ? 'o' : 'f'}
                  x={radial ? c + r * 0.94 : c}
                  y={radial ? c + fontSize * 0.35 : c - r * 0.62}
                  transform={`rotate(${radial ? s.mid - 90 : s.mid} ${c} ${c})`}
                  fill={outline ? 'rgba(14,10,18,0.9)' : '#fff'}
                  stroke={outline ? 'rgba(14,10,18,0.9)' : undefined}
                  strokeWidth={outline ? 3 : 0}
                  fontFamily={fonts.headline}
                  fontSize={fontSize}
                  textAnchor={radial ? 'end' : 'middle'}
                >
                  {s.it.label.length > maxChars ? s.it.label.slice(0, maxChars - 1) + '…' : s.it.label}
                </SvgText>
              ))}
            </G>
          ))}
          {slices.map((s, i) => (
            <Line key={i} x1={c} y1={c} x2={s.edge.x} y2={s.edge.y} stroke="#0E0A12" strokeWidth={2.5} />
          ))}
          <Circle cx={c} cy={c} r={r} fill="none" stroke={accent} strokeWidth={4} />
        </Svg>
      </Animated.View>
      {/* Neon glow ring */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, borderRadius: size / 2, shadowColor: accent, shadowOpacity: 0.8, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } }} />
      {/* Hub */}
      <View pointerEvents="none" style={{ position: 'absolute', left: c - 28, top: c - 28, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.bg, borderWidth: 3, borderColor: accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      {/* Pointer */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -14, left: c - 14, width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 26, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: accent }} />
    </View>
  );
}

export const Wheel = memo(WheelImpl);
