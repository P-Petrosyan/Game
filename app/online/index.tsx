import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useGameLobby } from '@/context/GameLobbyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

type GameListItemProps = {
  name: string;
  players: number;
  maxPlayers: number;
  status?: string;
  onPress: () => void;
  disabled?: boolean;
};

function GameListItem({ name, players, maxPlayers, status, onPress, disabled }: GameListItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const borderColor = Colors[colorScheme].tint;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${players} of ${maxPlayers} players`}
      disabled={disabled}
      style={({ pressed }) => [
        styles.gameCard,
        { borderColor },
        pressed && styles.gameCardPressed,
        disabled && styles.gameCardDisabled,
      ]}>
      <ThemedText type="subtitle" style={styles.gameTitle}>
        {name}
      </ThemedText>
      <ThemedText style={styles.gamePlayers}>{players >= maxPlayers ? 'Full' : `${players}/${maxPlayers} players`}</ThemedText>
      {status ? <ThemedText style={styles.gameStatus}>{status}</ThemedText> : null}
    </Pressable>
  );
}

export default function OnlineGamesScreen() {
  const { games, loading, joinGame } = useGameLobby();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const accentColor = Colors[colorScheme].tint;
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);

  const handleJoinGame = async (gameId: string) => {
    setJoiningGameId(gameId);

    try {
      await joinGame(gameId);
      router.push({ pathname: '/online/game/[id]', params: { id: gameId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to join this game. Please try again.';
      Alert.alert('Join Game', message);
    } finally {
      setJoiningGameId(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Game Lobby
        </ThemedText>
        <ThemedText style={styles.description}>
          Pick a game from the list to join or create your own room.
        </ThemedText>
        <Pressable
          onPress={() => router.push('/online/create')}
          style={({ pressed }) => [
            styles.createButton,
            { borderColor: accentColor },
            pressed && styles.createButtonPressed,
          ]}>
          <ThemedText type="defaultSemiBold" style={[styles.createButtonText, { color: accentColor }]}>
            Create a new game
          </ThemedText>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, games.length === 0 && styles.emptyListContent]}
          renderItem={({ item }) => (
            <GameListItem
              name={item.name}
              players={item.players}
              maxPlayers={item.maxPlayers}
              status={item.status}
              onPress={() => handleJoinGame(item.id)}
              disabled={item.players >= item.maxPlayers || joiningGameId === item.id}
            />
          )}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No games available yet. Be the first to create one!</ThemedText>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    gap: 24,
  },
  header: {
    gap: 12,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  createButton: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  createButtonPressed: {
    opacity: 0.7,
  },
  createButtonText: {
    textAlign: 'center',
  },
  listContent: {
    gap: 16,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
  },
  gameCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 8,
  },
  gameCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  gameCardDisabled: {
    opacity: 0.6,
  },
  gameTitle: {
    textAlign: 'left',
  },
  gamePlayers: {
    fontSize: 14,
    opacity: 0.7,
  },
  gameStatus: {
    fontSize: 12,
    opacity: 0.7,
    textTransform: 'capitalize',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
