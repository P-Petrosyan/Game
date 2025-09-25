import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ImageBackground, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NaturePalette } from '@/constants/theme';
import { useGameLobby } from '@/context/GameLobbyContext';

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
  const palette = NaturePalette;
  const isFull = players >= maxPlayers;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${players} of ${maxPlayers} players`}
      disabled={disabled}
      style={({ pressed }) => [
        styles.gameCard,
        {
          backgroundColor: palette.surfaceGlassAlt,
          borderColor: palette.border,
        },
        pressed && { backgroundColor: palette.surfaceStrong },
        (disabled || isFull) && { opacity: 0.6 },
      ]}>
      <View style={styles.gameHeader}>
        <View style={styles.gameTitleGroup}>
          <ThemedText type="subtitle" style={styles.gameTitle}>
            {name}
          </ThemedText>
          <ThemedText style={styles.gamePlayers}>
            {isFull ? 'Room full' : `${players}/${maxPlayers} players`}
          </ThemedText>
        </View>
        <View style={styles.gameMeta}>
          {status ? (
            <View style={styles.statusPill}>
              <ThemedText style={styles.statusPillText}>{status}</ThemedText>
            </View>
          ) : null}
          {isPrivate ? (
            <View style={styles.statusPill}>
              <ThemedText style={styles.statusPillText}>Private</ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function OnlineGamesScreen() {
  const { games, loading, joinGame } = useGameLobby();
  const router = useRouter();
  const palette = NaturePalette;
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
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
        <ThemedView
          style={[
            styles.container,
            {
              backgroundColor: palette.surfaceGlass,
              borderColor: palette.border,
              shadowColor: palette.focus,
            },
          ]}
          lightColor={palette.surfaceGlass}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Game Lobby
            </ThemedText>
            <ThemedText style={styles.description}>
              Join a room or open a fresh match for your friends.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/online/create')}
              style={({ pressed }) => [
                styles.createButton,
                {
                  backgroundColor: palette.buttonColor,
                  borderColor: palette.buttonColor,
                  shadowColor: palette.focus,
                },
                pressed && { opacity: 0.92 },
              ]}>
              <ThemedText type="defaultSemiBold" style={styles.createButtonText}>
                Create a new game
              </ThemedText>
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={palette.tint} />
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
                  disabled={joiningGameId === item.id || item.players >= item.maxPlayers}
                />
              )}
              ListEmptyComponent={
                <ThemedText style={styles.emptyText}>
                  No games available yet. Be the first to create one!
                </ThemedText>
              }
            />
          )}
        </ThemedView>
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
    paddingVertical: 28,
  },
  container: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 24,
    borderRadius: 28,
    padding: 26,
    gap: 24,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    backgroundColor: NaturePalette.surface,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  header: {
    gap: 12,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    color: NaturePalette.mutedText,
  },
  createButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  createButtonText: {
    textAlign: 'center',
    color: NaturePalette.buttonText,
  },
  listContent: {
    gap: 16,
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: NaturePalette.mutedText,
  },
  gameCard: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  gameTitleGroup: {
    flex: 1,
    gap: 6,
  },
  gameTitle: {
    fontSize: 18,
  },
  gamePlayers: {
    fontSize: 14,
    color: NaturePalette.mutedText,
  },
  gameMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: NaturePalette.surfaceGlass,
    borderWidth: 1,
    borderColor: NaturePalette.border,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: NaturePalette.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
