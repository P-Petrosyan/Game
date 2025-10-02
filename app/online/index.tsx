import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View, ImageBackground } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useGameLobby } from '@/context/GameLobbyContext';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";


type GameListItemProps = {
  name: string;
  players: number;
  maxPlayers: number;
  status?: string;
  isPrivate?: boolean;
  onPress: () => void;
  disabled?: boolean;
};

const adUnitId = __DEV__ ? TestIds.BANNER : "ca-app-pub-3940256099942544/2435281174";

function GameListItem({ name, players, maxPlayers, status, isPrivate, onPress, disabled }: GameListItemProps) {
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
      {/*{status ? <ThemedText style={styles.gameStatus}>{status}</ThemedText> : null}*/}
    </Pressable>
  );
}

export default function OnlineGamesScreen() {
  const { games, loading, joinGame } = useGameLobby();
  const router = useRouter();
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
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>
      <ThemedView style={[styles.container, styles.overlay]}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Game Lobby
        </ThemedText>
        <ThemedText style={styles.description}>
          Pick a game from the list to join or
        </ThemedText>
        <Pressable
          onPress={() => router.push('/online/create')}
          style={({ pressed }) => [
            styles.createButton,
            pressed && styles.createButtonPressed,
          ]}>
          <ThemedText type="defaultSemiBold" style={styles.createButtonText}>
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
    backgroundColor: Colors.overlay,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 16,
  },
  bannerContainer: {
    flexDirection: "row",
    justifyContent: "center"
  },
  header: {
    gap: 10,
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  title: {
    textAlign: 'center',
    color: Colors.heading,
  },
  description: {
    textAlign: 'center',
    color: Colors.textMuted,
  },
  createButton: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: Colors.accent,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  createButtonPressed: {
    opacity: 0.85,
  },
  createButtonText: {
    textAlign: 'center',
    color: Colors.buttonText,
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textMuted,
  },
  gameCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  gameCardPressed: {
    transform: [{ scale: 0.98 }],
    shadowOpacity: 0.05,
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
    fontSize: 14,
    textAlign: 'left',
    flex: 1,
    color: Colors.heading,
  },
  privateFlag: {
    fontSize: 12,
    color: Colors.info,
  },
  gamePlayers: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  gameStatus: {
    fontSize: 12,
    opacity: 0.85,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
