import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, TextInput, View, ImageBackground } from 'react-native';

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
  isPrivate?: boolean;
  onPress: () => void;
  disabled?: boolean;
};

function GameListItem({ name, players, maxPlayers, status, isPrivate, onPress, disabled }: GameListItemProps) {
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
        pressed && styles.gameCardPressed,
        disabled && styles.gameCardDisabled,
      ]}>
      <View style={styles.gameHeader}>
        <ThemedText type="subtitle" style={styles.gameTitle}>
          {name}
        </ThemedText>
        {isPrivate && <ThemedText style={styles.privateFlag}>🔒 Private</ThemedText>}
      </View>
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

  const handleJoinGame = async (gameId: string, isPrivate?: boolean) => {
    if (isPrivate) {
      Alert.prompt(
        'Private Game',
        'Enter the game code:',
        async (code) => {
          if (!code) return;
          setJoiningGameId(gameId);
          try {
            await joinGame(gameId, code);
            router.push({ pathname: '/online/game/[id]', params: { id: gameId } });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to join this game.';
            Alert.alert('Join Game', message);
          } finally {
            setJoiningGameId(null);
          }
        }
      );
      return;
    }

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
    <ImageBackground 
      source={require('@/assets/backgrounds/onlineScreen.webp')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <ThemedView style={[styles.container, styles.overlay]}>
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
            { backgroundColor: Colors.light.buttonColor },
            pressed && styles.createButtonPressed,
          ]}>
          <ThemedText type="defaultSemiBold" style={[styles.createButtonText, { color: Colors.light.text }]}>
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
              isPrivate={item.isPrivate}
              onPress={() => handleJoinGame(item.id, item.isPrivate)}
              disabled={item.players >= item.maxPlayers || joiningGameId === item.id}
            />
          )}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No games available yet. Be the first to create one!</ThemedText>
          }
        />
      )}
      </ThemedView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  overlay: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
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
    borderRadius: 14,
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
    backgroundColor: Colors.light.backgroundOpacity,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  gameCardPressed: {
    transform: [{ scale: 0.99 }],
  },
  gameCardDisabled: {
    opacity: 0.6,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 18,
    textAlign: 'left',
    flex: 1,
  },
  privateFlag: {
    fontSize: 12,
    opacity: 0.7,
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
