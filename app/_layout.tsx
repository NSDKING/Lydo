import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Watches for incoming share intents and navigates to the recipes tab.
function ShareIntentNavigator() {
  const { hasShareIntent } = useShareIntentContext();
  const router = useRouter();

  useEffect(() => {
    if (hasShareIntent) {
      router.push('/(tabs)/recipes');
    }
  }, [hasShareIntent]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ShareIntentProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <ShareIntentNavigator />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="paywall" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ShareIntentProvider>
  );
}
