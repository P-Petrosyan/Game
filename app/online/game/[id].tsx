import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View, ImageBackground } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MultiplayerQuoridorGame } from '@/components/quoridor/MultiplayerQuoridorGame';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGameLobby } from '@/context/GameLobbyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRealtimeGame } from '@/hooks/use-realtime-game';
import { db } from '@/services/firebase';
import { serverTimestamp, updateDoc, doc } from 'firebase/firestore';

type RouteParams = {
  id?: string;
};

type PlayerEntry = {
  id: string;
  displayName: string;
};

export default function GameSessionScreen() {
  const { id } = useLocalSearchParams<RouteParams>();
  const router = useRouter();
  const gameId = typeof id === 'string' ? id : null;
  const { gameState, loading, error } = useRealtimeGame(gameId);
  const { user } = useAuth();
  const { leaveGame } = useGameLobby();
  const colorScheme = useColorScheme() ?? 'light';
  const accentColor = Colors[colorScheme].background;
  const [leaving, setLeaving] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // useEffect(() => {
  //   if (!gameId) {
  //     router.replace('/online');
  //   }
  // }, [gameId, router]);

  useEffect(() => {
    if (!gameState?.players || !user) return;
    
    const playerIds = Object.keys(gameState.players);
    if (playerIds.length === 1 && playerIds[0] !== user.uid) {
      // Game was abandoned, delete it
      handleLeaveGame();
    }
  }, [gameState?.players, user]);

  useEffect(() => {
    if (gameState?.status === 'starting' && countdown === 0) {
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            updateGameStatus('playing');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState?.status]);

  const currentPlayer = useMemo(() => {
    const rawValue = (gameState?.state?.currentPlayer as string | undefined) ?? 'north';
    return rawValue === 'south' ? 'south' : 'north';
  }, [gameState?.state?.currentPlayer]);

  const playerEntries: PlayerEntry[] = useMemo(() => {
    if (!gameState?.players) {
      return [];
    }

    return Object.entries(gameState.players).map(([playerId, profile]) => ({
      id: playerId,
      displayName:
        (profile && typeof profile.displayName === 'string' && profile.displayName.length > 0)
          ? profile.displayName
          : 'Anonymous player',
    }));
  }, [gameState?.players]);

  const isWaitingForPlayers = playerEntries.length < 2;
  const bothPlayersReady = playerEntries.length === 2 && 
    Object.values(gameState?.players || {}).every(p => p.ready);
  const isGameStarted = gameState?.status === 'playing';
  const isCountingDown = gameState?.status === 'starting' && countdown > 0;

  const handleReady = async () => {
    if (!gameId || !user) return;
    
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        [`players.${user.uid}.ready`]: !isReady,
        updatedAt: serverTimestamp(),
      });
      setIsReady(!isReady);
      
      // Check if both players are ready
      const playerIds = Object.keys(gameState?.players || {});
      if (playerIds.length === 2) {
        const allReady = playerIds.every(id => 
          gameState?.players?.[id]?.ready || (id === user.uid && !isReady)
        );
        if (allReady) {
          await updateDoc(gameRef, {
            status: 'starting',
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update ready status');
    }
  };

  const updateGameStatus = async (status: string) => {
    if (!gameId) return;
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to update game status:', error);
    }
  };

  const handleLeaveGame = async () => {
    if (!gameId) {
      return;
    }

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    setLeaving(true);
    try {
      await leaveGame(gameId);
      router.replace('/online');
    } catch (leaveError) {
      const message = leaveError instanceof Error ? leaveError.message : 'Unable to leave the match.';
      Alert.alert('Leave game', message);
    } finally {
      setLeaving(false);
    }
  };

  if (!gameId) {
    return null;
  }

  return (
    <ImageBackground
      source={require('@/assets/backgrounds/gameReady.webp')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <ThemedView style={[styles.container, styles.overlay]}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={styles.errorState}>
            <ThemedText type="subtitle" style={styles.errorText}>
              Unable to load the match
            </ThemedText>
            <ThemedText style={styles.errorMessage}>{error}</ThemedText>
            <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
              <ThemedText type="defaultSemiBold">Back to lobby</ThemedText>
            </Pressable>
          </View>
        ) : !gameState ? (
          <View style={styles.errorState}>
            <ThemedText type="subtitle">Opponent left the match.</ThemedText>
            <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
              <ThemedText type="defaultSemiBold">Back to lobby</ThemedText>
            </Pressable>
          </View>
        ) : isGameStarted ? (
          <MultiplayerQuoridorGame gameId={gameId} />
        ) : isCountingDown ? (
          <View style={styles.countdownContainer}>
            <ThemedText type="title" style={styles.countdownText}>
              {countdown}
            </ThemedText>
            <ThemedText style={styles.countdownLabel}>Game starting...</ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                {gameState.name}
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Hosted by {gameState.hostName ?? 'Unknown host'}
              </ThemedText>
              <View style={[styles.statusPill, { backgroundColor: '#444' }]}>
                <ThemedText style={styles.statusPillText}>
                  {isWaitingForPlayers ? 'WAITING' : 'READY CHECK'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.card}>
              <ThemedText type="subtitle" style={styles.cardHeading}>
                Players ({playerEntries.length}/2)
              </ThemedText>
              {isWaitingForPlayers ? (
                <ThemedText style={styles.cardMessage}>Waiting for another player to join...</ThemedText>
              ) : null}
              {playerEntries.map((player) => {
                const playerData = gameState?.players?.[player.id];
                const isPlayerReady = playerData?.ready || false;
                return (
                  <View key={player.id} style={styles.playerRow}>
                    <View style={[styles.playerBadge, { backgroundColor: isPlayerReady ? '#27ae60' : accentColor }]} />
                    <ThemedText style={styles.playerName}>{player.displayName}</ThemedText>
                    <ThemedText style={styles.readyStatus}>
                      {isPlayerReady ? 'Ready' : 'Not Ready'}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            {!isWaitingForPlayers && (
              <View style={styles.card}>
                <ThemedText type="subtitle" style={styles.cardHeading}>
                  Ready to play?
                </ThemedText>
                <ThemedText style={styles.cardMessage}>
                  Both players must be ready to start the game.
                </ThemedText>
                <Pressable
                  onPress={handleReady}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    { backgroundColor: isReady ? 'rgba(39,174,96,0.4)' : accentColor },
                    pressed && styles.primaryButtonPressed,
                  ]}>
                  <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                    {isReady ? 'Ready!' : 'Mark as Ready'}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            <View style={styles.card}>
              <ThemedText type="subtitle" style={styles.cardHeading}>
                Leave match
              </ThemedText>
              <ThemedText style={styles.cardMessage}>
                Leaving will delete the game if you're the only player.
              </ThemedText>
              <Pressable
                onPress={handleLeaveGame}
                disabled={leaving}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}>
                <ThemedText type="defaultSemiBold" style={styles.secondaryButtonText}>
                  {leaving ? 'Leaving…' : 'Leave game'}
                </ThemedText>
              </Pressable>
            </View>
          </>
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
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  // scrollContainer: {
  //   flexGrow: 1,
  // },
  container: {
    flex: 1,
    paddingTop: 62,
    paddingBottom: 32,
    gap: 24,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorState: {
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    textAlign: 'center',
  },
  errorMessage: {
    textAlign: 'center',
    opacity: 0.7,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.dark.backgroundOpacity
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  header: {
    alignItems: 'center',
    backgroundColor: Colors.light.backgroundOpacity ,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.8,
  },
  statusPill: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  statusPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
    backgroundColor: Colors.light.backgroundOpacity,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  cardHeading: {
    textAlign: 'left',
  },
  cardMessage: {
    lineHeight: 20,
  },
  cardHint: {
    fontSize: 12,
    opacity: 0.7,
  },
  readyStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  countdownContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  countdownText: {
    lineHeight: 60,
    fontSize: 60,
    fontWeight: 'bold',
  },
  countdownLabel: {
    fontSize: 18,
    opacity: 0.8,
  },
  playerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  playerBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  playerName: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    color: '#c0392b',
  },
});
