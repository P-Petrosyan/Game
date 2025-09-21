import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
  const accentColor = Colors[colorScheme].tint;
  const [updatingTurn, setUpdatingTurn] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!gameId) {
      router.replace('/online');
    }
  }, [gameId, router]);

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

  const handleAdvanceTurn = async () => {
    if (!gameId || !gameState) {
      return;
    }

    if (!user) {
      Alert.alert('Sign in required', 'You must be signed in to sync moves online.');
      return;
    }

    setUpdatingTurn(true);

    try {
      const nextPlayer = currentPlayer === 'north' ? 'south' : 'north';
      const gameRef = doc(db, 'games', gameId);

      await updateDoc(gameRef, {
        'state.currentPlayer': nextPlayer,
        'state.lastUpdatedAt': serverTimestamp(),
      });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Unable to update the turn. Try again shortly.';
      Alert.alert('Sync failed', message);
    } finally {
      setUpdatingTurn(false);
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
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <ThemedView style={styles.container}>
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
            <Pressable onPress={() => router.replace('/online')} style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
              <ThemedText type="defaultSemiBold">Back to lobby</ThemedText>
            </Pressable>
          </View>
        ) : !gameState ? (
          <View style={styles.errorState}>
            <ThemedText type="subtitle">This match could not be found.</ThemedText>
            <Pressable onPress={() => router.replace('/online')} style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
              <ThemedText type="defaultSemiBold">Back to lobby</ThemedText>
            </Pressable>
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
              <View style={[styles.statusPill, { backgroundColor: accentColor }]}>
                <ThemedText style={styles.statusPillText}>
                  {(gameState.status ?? 'waiting').toUpperCase()}
                </ThemedText>
              </View>
            </View>

            <View style={styles.card}>
              <ThemedText type="subtitle" style={styles.cardHeading}>
                Players in this match
              </ThemedText>
              {playerEntries.length === 0 ? (
                <ThemedText style={styles.cardMessage}>No one has joined yet. Share the lobby with your friends!</ThemedText>
              ) : (
                playerEntries.map((player) => (
                  <View key={player.id} style={styles.playerRow}>
                    <View style={[styles.playerBadge, { backgroundColor: accentColor }]} />
                    <ThemedText style={styles.playerName}>{player.displayName}</ThemedText>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <ThemedText type="subtitle" style={styles.cardHeading}>
                Gameplay sync
              </ThemedText>
              <ThemedText style={styles.cardMessage}>
                The current turn is set to <ThemedText type="defaultSemiBold">{currentPlayer.toUpperCase()}</ThemedText>. Update the
                value below to synchronise moves across all connected devices.
              </ThemedText>
              <ThemedText style={styles.cardHint}>
                Seats occupied: {(gameState.playerIds?.length ?? playerEntries.length)}/{gameState.maxPlayers ?? '—'}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={handleAdvanceTurn}
                disabled={updatingTurn}
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: accentColor },
                  (pressed || updatingTurn) && styles.primaryButtonPressed,
                ]}>
                <ThemedText type="defaultSemiBold" style={styles.primaryButtonText}>
                  {updatingTurn ? 'Updating…' : 'Pass turn to opponent'}
                </ThemedText>
              </Pressable>
            </View>

            <View style={styles.card}>
              <ThemedText type="subtitle" style={styles.cardHeading}>
                Leave match
              </ThemedText>
              <ThemedText style={styles.cardMessage}>
                Leaving removes you from the active roster so another player can take your seat in the lobby.
              </ThemedText>
              <Pressable
                accessibilityRole="button"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
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
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  header: {
    alignItems: 'center',
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
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
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
