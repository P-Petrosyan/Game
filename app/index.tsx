import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  },
  {
    key: 'create',
    title: 'Create Game',
    description: 'Host a new online room and invite other players to join.',
    route: '/online/create',
  },
] as const;

type Action = (typeof actions)[number];

function HomeActionButton({ action, onPress }: { action: Action; onPress: (route: string) => void }) {
  const colorScheme = useColorScheme() ?? 'light';
  const tintColor = Colors[colorScheme].tint;
  const textColor = colorScheme === 'dark' ? Colors.dark.background : '#fff';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={action.description}
      onPress={() => onPress(action.route)}
      style={({ pressed }) => [styles.actionButton, { backgroundColor: tintColor }, pressed && styles.actionButtonPressed]}>
      <ThemedText type="subtitle" style={[styles.actionButtonTitle, { color: textColor }]}>
        {action.title}
      </ThemedText>
      <ThemedText style={[styles.actionButtonDescription, { color: textColor }]}>
        {action.description}
      </ThemedText>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Path Blocker
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Choose how you want to play and jump into the action.
          </ThemedText>
        </View>
        <View style={styles.actions}>
          {actions.map((action) => (
            <HomeActionButton key={action.key} action={action} onPress={(route) => router.push(route)} />
          ))}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  header: {
    gap: 16,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: {
    gap: 16,
  },
  actionButton: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 8,
  },
  actionButtonTitle: {
    textAlign: 'left',
  },
  actionButtonDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.99 }],
  },
});
