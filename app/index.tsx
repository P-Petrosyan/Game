import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NaturePalette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useItems } from '@/hooks/use-items';

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
  const palette = NaturePalette;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={action.description}
      onPress={() => onPress(action)}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: palette.surfaceGlassAlt,
          borderColor: palette.border,
        },
        pressed && { backgroundColor: palette.surfaceStrong, transform: [{ scale: 0.99 }] },
        locked && { opacity: 0.75 },
      ]}>
      <View style={styles.actionButtonContent}>
        <View style={styles.actionTextGroup}>
          <ThemedText type="subtitle" style={styles.actionButtonTitle}>
            {action.title}
          </ThemedText>
          <ThemedText style={styles.actionButtonDescription}>{action.description}</ThemedText>
        </View>
        {locked ? (
          <View style={styles.actionBadge}>
            <ThemedText style={styles.actionBadgeText}>Sign in required</ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout, initializing } = useAuth();
  const { items, loading: itemsLoading, error: itemsError } = useItems();
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

  const palette = NaturePalette;
  const featuredItems = useMemo(() => items.slice(0, 3), [items]);

  return (
    <ImageBackground
      source={require('@/assets/backgrounds/homeScreen.webp')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>
            <View
              style={[
                styles.heroCard,
                {
                  borderColor: palette.border,
                  backgroundColor: palette.surfaceGlass,
                  shadowColor: palette.focus,
                },
              ]}>
              <View style={styles.header}>
                <ThemedText type="title" style={styles.title}>
                  Path Blocker
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  Strategise your moves and enjoy mindful matches on any device.
                </ThemedText>
              </View>

              <View
                style={[
                  styles.authCard,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceGlassAlt,
                  },
                ]}>
                <ThemedText type="subtitle" style={styles.authHeading}>
                  {initializing
                    ? 'Checking session…'
                    : user
                      ? `Welcome back, ${user.displayName ?? user.email}`
                      : 'Sign in to sync your progress'}
                </ThemedText>
                <ThemedText style={styles.authMessage}>
                  {user
                    ? 'Your profile keeps track of online games, points, and rematches wherever you play.'
                    : 'Create a free account to open private rooms, invite friends, and pick up games later.'}
                </ThemedText>
                <View style={styles.authButtonsRow}>
                  {user ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleSignOut}
                      disabled={signingOut}
                      style={({ pressed }) => [
                        styles.signOutButton,
                        pressed && { opacity: 0.85 },
                      ]}>
                      {signingOut ? (
                        <ActivityIndicator color={palette.destructive} />
                      ) : (
                        <ThemedText type="defaultSemiBold" style={styles.signOutText}>
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
                        styles.primaryButton,
                        {
                          backgroundColor: palette.buttonColor,
                          shadowColor: palette.focus,
                        },
                        pressed && { opacity: 0.92 },
                      ]}>
                        <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                          Sign in
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push('/auth/register')}
                        style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && { backgroundColor: palette.surfaceStrong },
                      ]}>
                        <ThemedText type="defaultSemiBold" style={styles.secondaryButtonText}>
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

              <ThemedView
                style={[
                  styles.itemsCard,
                  {
                    borderColor: palette.border,
                    backgroundColor: palette.surfaceGlassAlt,
                  },
                ]}
                lightColor={palette.surfaceGlassAlt}>
                <View style={styles.itemsHeaderRow}>
                  <ThemedText type="subtitle" style={styles.itemsHeading}>
                    Community highlights
                  </ThemedText>
                  <View style={styles.itemsPill}>
                    <ThemedText style={styles.itemsPillText}>
                      Beta
                    </ThemedText>
                  </View>
                </View>
                {itemsLoading ? (
                  <View style={styles.itemsLoading}>
                    <ActivityIndicator color={palette.tint} />
                  </View>
                ) : itemsError ? (
                  <ThemedText style={styles.itemsMessage}>
                    Unable to load highlights: {itemsError}
                  </ThemedText>
                ) : featuredItems.length === 0 ? (
                  <ThemedText style={styles.itemsMessage}>
                    Add curated content in Firestore to showcase it here.
                  </ThemedText>
                ) : (
                  featuredItems.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={[styles.itemBadge, { backgroundColor: palette.accent }]} />
                      <View style={styles.itemContent}>
                        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                        {item.description ? (
                          <ThemedText style={styles.itemDescription}>{item.description}</ThemedText>
                        ) : null}
                        {item.rarity ? (
                          <ThemedText style={styles.itemRarity}>{item.rarity}</ThemedText>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </ThemedView>
            </View>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingVertical: 28,
    paddingBottom: 60,
  },
  container: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    gap: 28,
  },
  heroCard: {
    borderRadius: 32,
    padding: 28,
    gap: 28,
    borderWidth: 1,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  header: {
    gap: 12,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: NaturePalette.mutedText,
    lineHeight: 22,
  },
  authCard: {
    borderRadius: 24,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  authHeading: {
    textAlign: 'left',
  },
  authMessage: {
    lineHeight: 20,
    color: NaturePalette.mutedText,
  },
  authButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NaturePalette.buttonColor,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  primaryButtonText: {
    color: NaturePalette.buttonText,
  },
  secondaryButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NaturePalette.tint,
    backgroundColor: NaturePalette.surfaceGlass,
  },
  secondaryButtonText: {
    color: NaturePalette.accent,
  },
  signOutButton: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NaturePalette.destructive,
    backgroundColor: NaturePalette.surfaceGlass,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  signOutText: {
    color: NaturePalette.destructive,
  },
  actions: {
    gap: 16,
  },
  actionButton: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  actionTextGroup: {
    flex: 1,
    gap: 6,
  },
  actionButtonTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  actionButtonDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: NaturePalette.mutedText,
  },
  actionBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: NaturePalette.highlight,
  },
  actionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: NaturePalette.accent,
  },
  itemsCard: {
    borderRadius: 24,
    padding: 20,
    gap: 18,
    borderWidth: 1,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 5,
  },
  itemsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemsHeading: {
    textAlign: 'left',
  },
  itemsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: NaturePalette.surfaceGlass,
    borderWidth: 1,
    borderColor: NaturePalette.border,
  },
  itemsPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: NaturePalette.accent,
  },
  itemsLoading: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemsMessage: {
    color: NaturePalette.mutedText,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  itemBadge: {
    width: 10,
    height: 34,
    borderRadius: 4,
    marginTop: 4,
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemDescription: {
    lineHeight: 18,
    color: NaturePalette.mutedText,
  },
  itemRarity: {
    fontSize: 12,
    color: NaturePalette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
