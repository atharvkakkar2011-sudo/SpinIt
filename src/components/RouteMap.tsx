import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Polyline, Rect, Stop } from 'react-native-svg';
import type { RoutePlan } from '../lib/extra';
import { colors, fonts } from '../theme';

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

/** Neon route map: dark grid, faint sea, other spots as dots, three numbered pins on a glowing dashed route. */
export function RouteMap({ route, labels, accent, showFromYou, calm }: { route: RoutePlan; labels: string[]; accent: string; showFromYou: boolean; calm: boolean }) {
  const dash = useSharedValue(0);
  useEffect(() => {
    if (calm) return;
    dash.value = withRepeat(withTiming(-24, { duration: 1400, easing: Easing.linear }), -1);
  }, [calm, dash]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));
  const pts = route.pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={{ borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.glassBorder, backgroundColor: '#120C18', height: 220 }} accessible accessibilityLabel={`Route map, ${route.totalMins} minutes between stops`}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sea" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0.62" stopColor="#3DF2FF" stopOpacity="0" />
            <Stop offset="0.78" stopColor="#3DF2FF" stopOpacity="0.07" />
            <Stop offset="1" stopColor="#3DF2FF" stopOpacity="0.14" />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill="url(#sea)" />
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
          <Line key={`h${v}`} x1="0" y1={v} x2="100" y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
        ))}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
          <Line key={`v${v}`} x1={v} y1="0" x2={v} y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
        ))}
        <Polyline points={pts} fill="none" stroke={accent} strokeOpacity={0.35} strokeWidth={3} strokeLinejoin="round" />
        <AnimatedPolyline points={pts} fill="none" stroke={accent} strokeWidth={1.2} strokeDasharray="4 3" strokeLinejoin="round" animatedProps={props} />
      </Svg>

      {route.others.map((o) => (
        <View key={o.name} style={{ position: 'absolute', left: `${o.x}%`, top: `${o.y}%`, width: 6, height: 6, borderRadius: 3, marginLeft: -3, marginTop: -3, backgroundColor: 'rgba(255,255,255,0.28)' }} />
      ))}
      {route.pts.map((p, k) => (
        <View key={k} style={{ position: 'absolute', left: `${p.x}%`, top: `${p.y}%`, alignItems: 'center', width: 80, marginLeft: -40, marginTop: -13 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: k === 0 ? accent : '#0E0A12', borderWidth: 2, borderColor: accent, alignItems: 'center', justifyContent: 'center', shadowColor: accent, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }}>
            <Text style={{ fontFamily: fonts.headline, fontSize: 11, color: k === 0 ? '#0E0A12' : accent }}>{k + 1}</Text>
          </View>
          <Text numberOfLines={1} style={{ fontFamily: fonts.label, fontSize: 8.5, color: colors.white, marginTop: 3, textShadowColor: '#000', textShadowRadius: 4 }}>{labels[k]?.toUpperCase()}</Text>
        </View>
      ))}
      <View style={{ position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', gap: 6 }}>
        <View style={{ backgroundColor: 'rgba(14,10,18,0.8)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ fontFamily: fonts.label, fontSize: 9.5, color: colors.white }}>{route.totalMins} MIN BETWEEN STOPS</Text></View>
        {showFromYou && <View style={{ backgroundColor: 'rgba(14,10,18,0.8)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ fontFamily: fonts.label, fontSize: 9.5, color: accent }}>{route.fromYouMins} MIN DRIVE FROM YOU</Text></View>}
      </View>
    </View>
  );
}
