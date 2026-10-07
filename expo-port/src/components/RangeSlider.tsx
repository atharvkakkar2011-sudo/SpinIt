import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { colors } from '../theme';

const MAX = 400;
const STEP = 10;
const GAP = 20;
const THUMB = 28;

/** Two-thumb QAR budget slider, 0–400+ in steps of 10. */
export function RangeSlider({ lo, hi, onChange, accent }: { lo: number; hi: number; onChange: (lo: number, hi: number) => void; accent: string }) {
  const [w, setW] = useState(0);
  const which = useRef<'lo' | 'hi'>('lo');
  const track = Math.max(1, w - THUMB);
  const toVal = (x: number) => Math.round(Math.max(0, Math.min(1, (x - THUMB / 2) / track)) * (MAX / STEP)) * STEP;

  const begin = (x: number) => {
    const v = toVal(x);
    which.current = v < lo || (Math.abs(v - lo) <= Math.abs(v - hi) && v <= hi) ? 'lo' : 'hi';
    move(x);
  };
  const move = (x: number) => {
    const v = toVal(x);
    if (which.current === 'lo') onChange(Math.min(v, hi - GAP), hi);
    else onChange(lo, Math.max(v, lo + GAP));
  };

  const pan = Gesture.Pan().minDistance(0)
    .onBegin((e) => runOnJS(begin)(e.x))
    .onUpdate((e) => runOnJS(move)(e.x));

  const x = (v: number) => (v / MAX) * track;
  return (
    <GestureDetector gesture={pan}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 44, justifyContent: 'center' }} accessible accessibilityRole="adjustable" accessibilityLabel={`Budget QAR ${lo} to ${hi}`}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.disabled, marginHorizontal: THUMB / 2 }} />
        <View style={{ position: 'absolute', left: THUMB / 2 + x(lo), width: x(hi) - x(lo), height: 6, borderRadius: 3, backgroundColor: accent }} />
        {[lo, hi].map((v, i) => (
          <View key={i} style={{ position: 'absolute', left: x(v), width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: accent, shadowColor: accent, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }} />
        ))}
      </View>
    </GestureDetector>
  );
}
