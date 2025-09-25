import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Pressable, StyleSheet, View, ImageBackground } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

const actions = [
  {
    key: 'local',
    title: 'Local Match',
    description: 'Challenge a friend on the same device with the classic board.',
    route: '/local-play',
  },
  {
    key: 'online',
    title: 'Online Lobby',
    description: 'Browse open rooms and join an online opponent.',
    route: '/online',
    requiresAuth: true,
  },
  {
    key: 'create',
    title: 'Create Game',
    description: 'Host a new online room and invite other players to join.',
    route: '/online/create',
    requiresAuth: true,
  },
] as const;

type Action = (typeof actions)[number];

type HomeActionButtonProps = {
  action: Action;
  onPress: (action: Action) => void;
  locked?: boolean;
};

function HomeActionButton({ action, onPress, locked }: HomeActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={action.description}
      onPress={() => onPress(action)}
      style={({ pressed }) => [
        styles.actionButton,
        pressed && styles.actionButtonPressed,
      ]}>
      <ThemedText type="subtitle" style={styles.actionButtonTitle}>
        {action.title}
      </ThemedText>
      {/*<ThemedText style={[styles.actionButtonDescription, { color: textColor }]}>*/}
      {/*  {action.description}*/}
      {/*</ThemedText>*/}
      {locked ? (
        <ThemedText style={styles.actionBadge}>Sign in required</ThemedText>
      ) : null}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout, initializing } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleAction = (action: Action) => {
    if (action.requiresAuth && !user) {
      router.push('/auth/login');
      return;
    }

    router.push(action.route);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/backgrounds/homeScreen.webp')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <ThemedView style={[styles.container, styles.overlay]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Path Blocker
            </ThemedText>
            {/*<ThemedText style={styles.subtitle}>*/}
            {/*  Choose how you want to play and jump into the action.*/}
            {/*</ThemedText>*/}
          </View>
          <View style={styles.authCard}>
            <ThemedText type="subtitle" style={styles.authHeading}>
              {initializing ? 'Checking session…' : user ? `Welcome, ${user.displayName ?? user.email}` : 'You are not signed in'}
            </ThemedText>
            <ThemedText style={styles.authMessage}>
              {user
                ? 'Access your online lobby, create new rooms, and sync moves across devices.'
                : 'Create an account or sign in to host online matches.'}
            </ThemedText>
            <View style={styles.authButtonsRow}>
              {user ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={handleSignOut}
                  disabled={signingOut}
                  style={({ pressed }) => [
                    styles.authButton,
                    pressed && styles.authButtonPressed,
                  ]}>
                  {signingOut ? (
                    <ActivityIndicator />
                  ) : (
                    <ThemedText type="defaultSemiBold" style={styles.authButtonText}>
                      Sign out
                    </ThemedText>
                  )}
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/auth/login')}
                    style={({ pressed }) => [
                      styles.authButton,
                      pressed && styles.authButtonPressed,
                    ]}>
                    <ThemedText type="defaultSemiBold" style={styles.authButtonText}>
                      Sign in
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/auth/register')}
                    style={({ pressed }) => [
                      styles.authButton,
                      pressed && styles.authButtonPressed,
                    ]}>
                    <ThemedText type="defaultSemiBold" style={styles.authButtonText}>
                      Create account
                    </ThemedText>
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            {actions.map((action) => (
              <HomeActionButton
                key={action.key}
                action={action}
                onPress={handleAction}
                locked={Boolean(action.requiresAuth && !user)}
              />
            ))}
          </View>

          {/*<View style={styles.itemsCard}>*/}
          {/*  <ThemedText type="subtitle" style={styles.itemsHeading}>*/}
          {/*    Featured items*/}
          {/*  </ThemedText>*/}
          {/*  {itemsLoading ? (*/}
          {/*    <ActivityIndicator />*/}
          {/*  ) : itemsError ? (*/}
          {/*    <ThemedText style={styles.itemsMessage}>Unable to load items: {itemsError}</ThemedText>*/}
          {/*  ) : items.length === 0 ? (*/}
          {/*    <ThemedText style={styles.itemsMessage}>*/}
          {/*      Add items to your Firestore database to see them here.*/}
          {/*    </ThemedText>*/}
          {/*  ) : (*/}
          {/*    items.slice(0, 3).map((item) => (*/}
          {/*      <View key={item.id} style={styles.itemRow}>*/}
          {/*        <View style={styles.itemBadge} />*/}
          {/*        <View style={styles.itemContent}>*/}
          {/*          <ThemedText type="defaultSemiBold">{item.name}</ThemedText>*/}
          {/*          {item.description ? (*/}
          {/*            <ThemedText style={styles.itemDescription}>{item.description}</ThemedText>*/}
          {/*          ) : null}*/}
          {/*          {item.rarity ? (*/}
          {/*            <ThemedText style={styles.itemRarity}>{item.rarity}</ThemedText>*/}
          {/*          ) : null}*/}
          {/*        </View>*/}
          {/*      </View>*/}
          {/*    ))*/}
          {/*  )}*/}
          {/*</View>*/}
        </View>
        </ThemedView>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  overlay: {
    backgroundColor: Colors.overlay,
  },
  scrollContainer: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    paddingBottom: 32,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
    justifyContent: 'space-between',
    gap: 32,
  },
  header: {
    gap: 16,
  },
  title: {
    textAlign: 'center',
    color: Colors.heading,
  },
  subtitle: {
    textAlign: 'center',
    // lineHeight: 22,
    color: Colors.textMuted,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  actionBadge: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.9,
    color: Colors.danger,
  },
  actionButtonTitle: {
    textAlign: 'left',
    fontSize: 18,
    lineHeight: 20,
    color: Colors.heading,
  },
  actionButtonDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.05,
  },
  authCard: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  authHeading: {
    textAlign: 'left',
    fontSize: 16,
    color: Colors.heading,
  },
  authMessage: {
    lineHeight: 20,
    fontSize: 14,
    color: Colors.textMuted,
  },
  authButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  authButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: Colors.accent,
    borderRadius: 999,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  authButtonText: {
    color: Colors.buttonText,
  },
  authButtonPressed: {
    opacity: 0.85,
  },
  itemsCard: {
    borderRadius: 7,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
  },
  itemsHeading: {
    textAlign: 'left',
  },
  itemsMessage: {
    opacity: 0.7,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  itemBadge: {
    width: 12,
    height: 12,
    borderRadius: 7,
    marginTop: 6,
    backgroundColor: '#f39c12',
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemDescription: {
    lineHeight: 18,
  },
  itemRarity: {
    fontSize: 12,
    opacity: 0.7,
    textTransform: 'uppercase',
  },
});
