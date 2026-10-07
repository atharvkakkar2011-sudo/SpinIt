import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '../theme';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const { top } = useSafeAreaInsets();
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false || s.isInternetReachable === false)), []);
  if (!offline) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: top + 4, paddingBottom: 6, backgroundColor: '#FF5A7A', zIndex: 200 }}>
      <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center', fontFamily: fonts.label, fontSize: 11, letterSpacing: 1, color: '#0E0A12' }}>OFFLINE · SHOWING WHAT WE’VE GOT</Text>
    </View>
  );
}
