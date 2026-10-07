import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { Glass } from './ui';

/** Bottom sheet used by the transparent-modal routes (vibe, booking, QR, edit profile, help, story). */
export function Sheet({ children, maxHeight = 680 }: { children: ReactNode; maxHeight?: number }) {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel="Close" />
      <Glass radius={28} intensity={60} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, backgroundColor: colors.card }}>
        <ScrollView style={{ maxHeight }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, paddingBottom: bottom + 22 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.disabled, alignSelf: 'center', marginBottom: 16 }} />
          {children}
        </ScrollView>
      </Glass>
    </KeyboardAvoidingView>
  );
}
