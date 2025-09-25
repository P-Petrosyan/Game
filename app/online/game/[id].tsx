import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View, ImageBackground } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MultiplayerQuoridorGame } from '@/components/quoridor/MultiplayerQuoridorGame';
import { NaturePalette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGameLobby } from '@/context/GameLobbyContext';
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
  const palette = NaturePalette;
  const accentColor = palette.accent;
  const [leaving, setLeaving] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // useEffect(() => {
  //   if (!gameId) {
  //     router.replace('/online');
  //   }
  // }, [gameId, router]);

  useEffect(() => {
    if (!gameState?.players || !user) {
      return;
    }

    const playerIds = Object.keys(gameState.players);
    if (playerIds.length === 1 && playerIds[0] !== user.uid) {
      void handleLeaveGame();
    }
  }, [gameState?.players, handleLeaveGame, user]);

  useEffect(() => {
    if (gameState?.status === 'starting' && countdown === 0) {
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prev) => {
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
  }, [countdown, gameState?.status, updateGameStatus]);

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
  const isGameStarted = gameState?.status === 'playing';
  const isCountingDown = gameState?.status === 'starting' && countdown > 0;

  const lobbyStatusStyles = isWaitingForPlayers
    ? { background: palette.surfaceGlass, border: palette.border, text: palette.accent }
    : { background: palette.successSurface, border: palette.success, text: palette.success };

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
    } catch {
      Alert.alert('Error', 'Failed to update ready status');
    }
  };

  const updateGameStatus = useCallback(
    async (status: string) => {
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
    },
    [gameId],
  );

  const handleLeaveGame = useCallback(async () => {
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
  }, [gameId, leaveGame, router, user]);

  if (!gameId) {
    return null;
  }

  return (
    <ImageBackground
      source={require('@/assets/backgrounds/gameReady.webp')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: palette.overlay }]}>
      <ThemedView
        style={[
          styles.container,
          {
            borderColor: palette.border,
            backgroundColor: palette.surfaceGlass,
            shadowColor: palette.focus,
          },
        ]}
        lightColor={palette.surfaceGlass}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={palette.tint} />
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
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: lobbyStatusStyles.background,
                    borderColor: lobbyStatusStyles.border,
                  },
                ]}>
                <ThemedText style={[styles.statusPillText, { color: lobbyStatusStyles.text }]}>
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
                    <View
                      style={[
                        styles.playerBadge,
                        { backgroundColor: isPlayerReady ? palette.success : accentColor },
                      ]}
                    />
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
                    {
                      backgroundColor: isReady ? palette.successSurface : accentColor,
                      borderColor: isReady ? palette.success : accentColor,
                    },
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
                Leaving will delete the game if you&apos;re the only player.
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
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  container: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 26,
    borderRadius: 30,
    borderWidth: 1,
    gap: 24,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.18,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 7,
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
    color: NaturePalette.mutedText,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: NaturePalette.surfaceGlass,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  backButtonPressed: {
    opacity: 0.85,
  },
  header: {
    alignItems: 'center',
    backgroundColor: NaturePalette.surfaceGlass,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 22,
    gap: 8,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: NaturePalette.mutedText,
  },
  statusPill: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: NaturePalette.surfaceGlass,
    borderWidth: 1,
    borderColor: NaturePalette.border,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
    backgroundColor: NaturePalette.surfaceGlassAlt,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  cardHeading: {
    textAlign: 'left',
  },
  cardMessage: {
    lineHeight: 20,
    color: NaturePalette.mutedText,
  },
  cardHint: {
    fontSize: 12,
    color: NaturePalette.mutedText,
  },
  readyStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: NaturePalette.mutedText,
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
    color: NaturePalette.heading,
  },
  countdownLabel: {
    fontSize: 18,
    color: NaturePalette.mutedText,
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
    backgroundColor: NaturePalette.buttonColor,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: NaturePalette.buttonColor,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    color: NaturePalette.buttonText,
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: NaturePalette.destructive,
    backgroundColor: NaturePalette.surfaceGlass,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    color: NaturePalette.destructive,
    fontWeight: '600',
  },
});
