import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';
import { useStore } from '../store';

export function Headline({ children, size = 28, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[{ fontFamily: fonts.headline, fontSize: size, color: colors.white, letterSpacing: -size * 0.04, lineHeight: size * 1.1 }, style]}>
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: fonts.label, fontSize: 11, letterSpacing: 1.5, color: colors.mid }, style]}>{children}</Text>;
}

export function Body({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.offWhite }, style]}>
      {children}
    </Text>
  );
}

export function tap() {
  if (!useStore.getState().calm) Haptics.selectionAsync().catch(() => {});
}

/** Liquid-glass surface: translucent fill, 1.5px edge, blur, inset top highlight. */
export function Glass({ children, style, radius = 20, intensity = 24 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; radius?: number; intensity?: number }) {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.glassBorder }, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glassFill }]} />
      <View pointerEvents="none" style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]} />
      {children}
    </View>
  );
}

export function Chip({ label, on, onPress, accent }: { label: string; on?: boolean; onPress?: () => void; accent: string }) {
  return (
    <Pressable onPress={() => { tap(); onPress?.(); }} accessibilityRole="button" accessibilityState={{ selected: !!on }}>
      <Glass radius={999} style={on ? { borderColor: accent, backgroundColor: accent + '33' } : undefined}>
        <Text style={{ fontFamily: fonts.bodySemi, fontSize: 14, color: on ? accent : colors.offWhite, paddingHorizontal: 16, paddingVertical: 9 }}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

export function Button({ label, onPress, accent, variant = 'solid', disabled, style }: { label: string; onPress?: () => void; accent: string; variant?: 'solid' | 'glass'; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const inner = (
    <Text style={{ fontFamily: fonts.headline, fontSize: 15, letterSpacing: -0.4, color: variant === 'solid' ? '#0E0A12' : colors.white, textAlign: 'center' }}>{label}</Text>
  );
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { tap(); onPress?.(); }}
      accessibilityRole="button"
      style={({ pressed }) => [{ minHeight: 52, justifyContent: 'center', opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {variant === 'solid' ? (
        <View style={{ backgroundColor: accent, borderRadius: 26, paddingVertical: 16, shadowColor: accent, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>{inner}</View>
      ) : (
        <Glass radius={26} style={{ paddingVertical: 16 }}>{inner}</Glass>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' },
});

export function RoundButton({ glyph, onPress, label, color = colors.white }: { glyph: string; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}>
      <Glass radius={22} intensity={30} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, color }}>{glyph}</Text>
      </Glass>
    </Pressable>
  );
}

export function Field({ value, onChangeText, placeholder, secure, keyboardType, label, right, autoCapitalize = 'none', onSubmitEditing }: {
  value: string; onChangeText: (t: string) => void; placeholder: string; secure?: boolean; keyboardType?: 'email-address' | 'default';
  label: string; right?: ReactNode; autoCapitalize?: 'none' | 'words'; onSubmitEditing?: () => void;
}) {
  return (
    <Glass radius={16} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.dim}
        secureTextEntry={secure}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        accessibilityLabel={label}
        onSubmitEditing={onSubmitEditing}
        style={{ flex: 1, fontFamily: fonts.bodySemi, fontSize: 16, color: colors.white, padding: 16 }}
      />
      {right}
    </Glass>
  );
}

export function Toggle({ value, onValueChange, acc, label }: { value: boolean; onValueChange: (v: boolean) => void; acc: string; label: string }) {
  return <Switch value={value} onValueChange={onValueChange} trackColor={{ true: acc, false: colors.disabled }} thumbColor="#fff" accessibilityLabel={label} />;
}
