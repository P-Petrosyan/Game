import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import 'react-native-reanimated';

import { NaturePalette } from '@/constants/theme';
import { AuthProvider } from '@/context/AuthContext';
import { GameLobbyProvider } from '@/context/GameLobbyContext';

export const unstable_settings = {
  initialRouteName: 'index',
};

function LobbyButton() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/')} style={{ marginLeft: 16 }}>
      <Ionicons name="home" size={24} color={NaturePalette.accent} />
    </Pressable>
  );
}

export default function RootLayout() {
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: NaturePalette.tint,
      background: 'transparent',
      card: NaturePalette.surface,
      text: NaturePalette.text,
      border: NaturePalette.border,
      notification: NaturePalette.accentSoft,
    },
  } as const;

  return (
    <AuthProvider>
      <GameLobbyProvider>
        <ThemeProvider value={navigationTheme}>
          <Stack initialRouteName="index">
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="local-play" options={{ title: 'Local Play' }} />
            <Stack.Screen name="online/index" options={{ title: 'Online Games', headerLeft: () => <LobbyButton /> }} />
            <Stack.Screen name="online/create" options={{ title: 'Create Game', headerLeft: () => <LobbyButton /> }} />
            <Stack.Screen name="online/game/[id]" options={{ title: 'Online Match', headerShown: false }} />
            <Stack.Screen name="auth/login" options={{ title: 'Sign in' }} />
            <Stack.Screen name="auth/register" options={{ title: 'Create account' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </GameLobbyProvider>
    </AuthProvider>
  );
}
