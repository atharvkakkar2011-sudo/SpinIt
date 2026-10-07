import { InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { Unbounded_800ExtraBold } from '@expo-google-fonts/unbounded';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '../components/OfflineBanner';
import { Toast } from '../components/Toast';
import { useStore } from '../store';
import { colors } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    SpaceMono_700Bold,
  });
  const hydrated = useStore((s) => s.hydrated);
  const refill = useStore((s) => s.refill);
  const ready = (fontsLoaded || !!fontError) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    // Hydration can finish before the listener is attached on fast storage.
    if (!useStore.persist.hasHydrated()) return;
    useStore.setState({ hydrated: true });
  }, []);

  useEffect(() => {
    if (!ready) return;
    refill();
    const t = setInterval(refill, 30_000);
    return () => clearInterval(t);
  }, [ready, refill]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="setup" />
            <Stack.Screen name="squad" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="place/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="reveal" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="plan" options={{ animation: 'slide_from_right' }} />
            {['mood', 'book', 'qr', 'edit-profile', 'help', 'story'].map((n) => (
              <Stack.Screen key={n} name={n} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
            ))}
            <Stack.Screen name="edit-wheel" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <OfflineBanner />
          <Toast />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
