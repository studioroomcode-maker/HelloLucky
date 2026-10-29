import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { BRAND_FONT, useIsDark, usePalette } from '@/constants/theme';
import { loadStore, useStoreLoaded } from '@/src/services/findsStore';
import { useJourneyTaps } from '@/src/services/notifications';
import { TitleScreen } from '@/src/ui/TitleScreen';

SplashScreen.preventAutoHideAsync().catch(() => {});

// In release, React Native reports an uncaught JS error through a native call that aborts the app (SIGABRT on the
// TurboModule queue; this is what App Review saw on iPhone 17 Pro Max / iOS 27). Log it and keep running instead.
if (!__DEV__) {
  ErrorUtils.setGlobalHandler((error) => console.error('uncaught', error));
}

export default function RootLayout() {
  const loaded = useStoreLoaded();
  const palette = usePalette();
  const isDark = useIsDark();
  const [showTitle, setShowTitle] = useState(true);
  // A failed font load still renders (fontError): text falls back to the system face.
  const [fontsLoaded, fontError] = useFonts({
    [BRAND_FONT.body]: require('@/assets/fonts/SDGothicNeoRound-dRg.ttf'),
    [BRAND_FONT.medium]: require('@/assets/fonts/SDGothicNeoRound-eMd.ttf'),
    [BRAND_FONT.cute]: require('@/assets/fonts/SDGothicNeoRound-hEb.ttf'),
  });

  const ready = loaded && (fontsLoaded || !!fontError);
  useJourneyTaps(ready);

  useEffect(() => {
    // The native splash stays up until the title art is on screen (TitleScreen.onShown).
    loadStore();
  }, []);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="scan" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="find/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="map" />
        <Stack.Screen name="badges" />
        <Stack.Screen name="letters" />
        <Stack.Screen name="wide" options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }} />
        <Stack.Screen name="journey/[chain]" />
        <Stack.Screen name="passport" />
      </Stack>
      {showTitle ? (
        <TitleScreen onShown={() => SplashScreen.hideAsync().catch(() => {})} onDone={() => setShowTitle(false)} />
      ) : null}
    </>
  );
}
