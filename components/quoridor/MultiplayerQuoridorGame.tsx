import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { doc, updateDoc, serverTimestamp, increment, getDoc, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NaturePalette } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGameLobby } from '@/context/GameLobbyContext';
import { useRealtimeGame } from '@/hooks/use-realtime-game';
import { db } from '@/services/firebase';

import {
  INITIAL_POSITIONS,
  MAX_WALLS_PER_PLAYER,
  Orientation,
  PlayerId,
  Position,
  Wall,
  buildBlockedEdges,
  canPlaceWall,
  computeAvailableWalls,
  getOpponent,
  getValidPawnMoves,
  isWinningPosition,
} from './game-logic';
import { QuoridorBoard } from './QuoridorBoard';

type MultiplayerQuoridorGameProps = {
  gameId: string;
};

export function MultiplayerQuoridorGame({ gameId }: MultiplayerQuoridorGameProps) {
  const { user } = useAuth();
  const { gameState } = useRealtimeGame(gameId);
  const { createGame } = useGameLobby();
  const router = useRouter();
  const [mode, setMode] = useState<'move' | 'wall' | 'drag'>('move');
  const [wallOrientation, setWallOrientation] = useState<Orientation>('horizontal');
  const [playAgainVote, setPlayAgainVote] = useState(false);

  const gameData = gameState?.state as any;
  const positions = useMemo(
    () => gameData?.positions || INITIAL_POSITIONS,
    [gameData?.positions],
  );
  const walls = useMemo(() => gameData?.walls || [], [gameData?.walls]);
  const wallsRemaining = useMemo(
    () => gameData?.wallsRemaining || { north: MAX_WALLS_PER_PLAYER, south: MAX_WALLS_PER_PLAYER },
    [gameData?.wallsRemaining],
  );
  const currentPlayer = gameData?.currentPlayer || 'north';
  const winner = gameData?.winner;

  const playerIds = gameState?.playerIds || [];
  const myPlayerId = user?.uid;
  const opponentId = playerIds.find(id => id !== user?.uid);

  // Determine which side this player controls based on consistent playerIds array
  const myPlayerSide: PlayerId = myPlayerId === playerIds[0] ? 'north' : 'south';
  const isMyTurn = currentPlayer === myPlayerSide && !!myPlayerId;

  const blockedEdges = useMemo(() => buildBlockedEdges(walls), [walls]);
  const validMoves = useMemo(() => {
    if (!isMyTurn || winner) return [];
    const opponent = getOpponent(myPlayerSide);
    return getValidPawnMoves(positions[myPlayerSide], positions[opponent], blockedEdges);
  }, [blockedEdges, myPlayerSide, positions, winner, isMyTurn]);

  const availableWalls = useMemo(() => {
    if (!isMyTurn || winner || mode === 'move' || wallsRemaining[myPlayerSide] <= 0) return [];
    return computeAvailableWalls(wallOrientation, walls, positions);
  }, [isMyTurn, mode, positions, wallOrientation, walls, wallsRemaining, winner, myPlayerSide]);

  const updateGameState = React.useCallback(
    async (updates: any) => {
      if (!gameId) return;
      try {
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
          state: { ...gameData, ...updates },
          updatedAt: serverTimestamp(),
        });
      } catch {
        Alert.alert('Error', 'Failed to update game');
      }
    },
    [gameData, gameId],
  );

  const updateGame = async (updates: any) => {
    if (!gameId) return;
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        ...updates, // ✅ apply updates at root level
        updatedAt: serverTimestamp(),
      });
    } catch {
      Alert.alert('Error', 'Failed to update game');
    }
  };

  const handleCellPress = async (target: Position) => {
    if (!isMyTurn || winner || mode !== 'move') return;

    const isLegalMove = validMoves.some(move => move.row === target.row && move.col === target.col);
    if (!isLegalMove) return;

    const nextPositions = { ...positions };
    nextPositions[myPlayerSide] = target;

    const hasWon = isWinningPosition(myPlayerSide, target);
    const nextPlayer = hasWon ? myPlayerSide : getOpponent(myPlayerSide);

    await updateGameState({
      positions: nextPositions,
      currentPlayer: nextPlayer,
      winner: hasWon ? myPlayerSide : null,
      status: hasWon ? 'completed' : 'playing',
    });

    if (hasWon) {
      // Update stats for both players
      updatePlayerStats(user.uid, true); // Winner
      if (opponentId) {
        updatePlayerStats(opponentId, false); // Loser
      }
    }
  };

  const handleWallPlacement = async (wall: Wall) => {
    if (!isMyTurn || winner || (mode !== 'wall' && mode !== 'drag')) return;
    if (wallsRemaining[myPlayerSide] <= 0) return;
    if (!canPlaceWall(wall, walls, positions)) return;

    const nextWalls = [...walls, wall];
    const nextWallsRemaining = {
      ...wallsRemaining,
      [myPlayerSide]: wallsRemaining[myPlayerSide] - 1,
    };

    await updateGameState({
      walls: nextWalls,
      wallsRemaining: nextWallsRemaining,
      currentPlayer: getOpponent(myPlayerSide),
    });

    setMode('move');
  };

  // Handle opponent leaving
  useEffect(() => {
    if (!gameState?.playerIds || !user || playerIds.length !== 2) return;

    const currentPlayers = Object.keys(gameState.players || {});
    if (currentPlayers.length === 1 && currentPlayers.includes(user.uid)) {
      if (!winner && gameState.status === 'playing') {
        updateGameState({
          winner: myPlayerSide,
          gameEndReason: 'opponent_left',
        });
        const gameRef = doc(db, 'games', gameId);
        updateDoc(gameRef, {
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
        updatePlayerStats(user.uid, true);
      }
    }
  }, [gameId, gameState?.players, gameState?.playerIds, gameState?.status, myPlayerSide, playerIds.length, updateGameState, updatePlayerStats, user, winner]);

  // new game redirection for Play Again
  useEffect(() => {
    if (gameState?.newGameId && winner) {
      router.replace(`/online/game/${gameState.newGameId}?oldGameId=${gameId}`);
    }
  }, [gameId, gameState?.newGameId, router, winner]);

  // Clean up old game if redirected from previous game
  useEffect(() => {
    if (!gameState?.oldGameId) return;
    const deleteGame = setTimeout(async () => {
      try {
        // @ts-ignore
        await deleteDoc(doc(db, 'games', gameState?.oldGameId));
        console.log('Deleted game:', gameState?.oldGameId);
      } catch (error) {
        console.error('Failed to delete game:', error);
      }
    }, 3000) ;

    return () => clearTimeout(deleteGame);
  }, [gameState?.oldGameId]);

  const updatePlayerStats = React.useCallback(async (playerId: string, isWinner: boolean) => {
    try {
      const userRef = doc(db, 'users', playerId);
      const points = isWinner ? 100 : 10;

      await updateDoc(userRef, {
        'stats.points': increment(points),
        'stats.gamesPlayed': increment(1),
        'stats.wins': increment(isWinner ? 1 : 0),
        lastUpdated: serverTimestamp(),
      });

      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentPoints = userData.stats?.points || 0;
        const newLevel = ((currentPoints / 500) + 1).toString();
        await updateDoc(userRef, { 'stats.level': newLevel });
      }
    } catch (error) {
      console.error('Failed to update player stats:', error);
    }
  }, []);

  const handleSurrender = async () => {
    Alert.alert(
      'Surrender Game',
      'Are you sure you want to surrender? Your opponent will win.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Surrender',
          style: 'destructive',
          onPress: async () => {
            await updateGameState({
              winner: getOpponent(myPlayerSide),
              gameEndReason: 'surrender',
            });
            if (opponentId) {
              updatePlayerStats(opponentId, true);
              updatePlayerStats(user.uid, false);
            }
          },
        },
      ]
    );
  };

  const handlePlayAgain = async () => {
    if (!user || !opponentId) return;

    const newVote = !playAgainVote;
    setPlayAgainVote(newVote);

    await updateGame({
      [`playAgainVotes.${user.uid}`]: newVote,
    });

    // Check if both players voted to play again
    const currentVotes = { ...gameState?.playAgainVotes };
    currentVotes[user.uid] = newVote;

    if (currentVotes[user.uid] && currentVotes[opponentId]) {
      try {
        // Generate new game name with incremented number
        const baseName = gameState?.name?.replace(/ \d+$/, '') || 'Game';
        const currentNumber = gameState?.name?.match(/ (\d+)$/)?.[1];
        const nextNumber = currentNumber ? parseInt(currentNumber) + 1 : 2;
        const newGameName = `${baseName} ${nextNumber}`;

        const newGame = await createGame(newGameName, '');

        // Add opponent to the new game immediately
        const gameRef = doc(db, 'games', newGame.id);
        const opponentName = gameState?.players?.[opponentId]?.displayName || 'Player';
        await updateDoc(gameRef, {
          playerIds: [user.uid, opponentId],
          playerCount: 2,
          status: 'active',
          oldGameId: gameId,
          [`players.${opponentId}`]: {
            displayName: opponentName,
            joinedAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        });

        // Store new game ID for redirection
        await updateGame({
          newGameId: newGame.id,
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to create new game');
        console.error('Error creating new game:', error);
      }
    }
  };

  const handleLeaveGame = () => {
    router.replace('/online');
    deleteDoc(doc(db, 'games', gameId));
  };

  const playerColors = useMemo(
    () => ({ north: NaturePalette.boardNorth, south: NaturePalette.boardSouth }),
    [],
  );

  const myPlayerName = gameState?.players?.[myPlayerId || '']?.displayName || 'You';
  const opponentName = gameState?.players?.[opponentId || '']?.displayName || 'Opponent';

  const myVote = gameState?.playAgainVotes?.[user?.uid || ""];
  const opponentVote = gameState?.playAgainVotes?.[opponentId || ""];

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: playerColors[currentPlayer] }]} />
            <ThemedText style={[styles.statusHeading, { color: playerColors[currentPlayer] }]}>
              {winner 
                ? `${winner === myPlayerSide ? myPlayerName : opponentName} wins!`
                : `${isMyTurn ? 'Your' : `${opponentName}'s`} turn`
              }
            </ThemedText>
          </View>
          {winner && (
            <ThemedText style={styles.winMessage}>
              {winner === myPlayerSide ? '+100 points! 🎉' : '+10 points for playing'}
            </ThemedText>
          )}
        </View>

        <View style={styles.playersRow}>
          <View style={styles.playerInfo}>
            <View style={[styles.playerBadge, { backgroundColor: playerColors[myPlayerSide] }]} />
            <View>
              <ThemedText style={styles.playerName}>{myPlayerName} (You)</ThemedText>
              <ThemedText style={styles.wallCount}>Walls: {wallsRemaining[myPlayerSide]}</ThemedText>
            </View>
          </View>
          <View style={styles.playerInfo}>
            <View style={[styles.playerBadge, { backgroundColor: playerColors[getOpponent(myPlayerSide)] }]} />
            <View>
              <ThemedText style={styles.playerName}>{opponentName}</ThemedText>
              <ThemedText style={styles.wallCount}>Walls: {wallsRemaining[getOpponent(myPlayerSide)]}</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.boardWrapper}>
          <QuoridorBoard
            currentPlayer={currentPlayer}
            positions={positions}
            walls={walls}
            validMoves={validMoves}
            mode={mode}
            availableWalls={availableWalls}
            onCellPress={handleCellPress}
            onWallPress={handleWallPlacement}
            myPlayerSide={myPlayerSide}
          />
        </View>

        {!winner && (
          <View style={styles.controlsSection}>
            {isMyTurn && (
              <>
                <View style={styles.modeRow}>
                  <Pressable
                    onPress={() => setMode('move')}
                    style={[styles.controlButton, mode === 'move' && styles.activeButton]}>
                    <ThemedText
                      style={[styles.controlButtonText, mode === 'move' && styles.controlButtonTextActive]}>
                      Move
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setMode('wall')}
                    disabled={wallsRemaining[myPlayerSide] <= 0}
                    style={[styles.controlButton, mode === 'wall' && styles.activeButton]}>
                    <ThemedText
                      style={[styles.controlButtonText, mode === 'wall' && styles.controlButtonTextActive]}>
                      Wall
                    </ThemedText>
                  </Pressable>
                </View>
                {mode === 'wall' && (
                  <View style={styles.wallControls}>
                    <Pressable
                      onPress={() => setWallOrientation('horizontal')}
                      style={[styles.orientationButton, wallOrientation === 'horizontal' && styles.activeButton]}>
                      <ThemedText
                        style={[styles.controlButtonText, wallOrientation === 'horizontal' && styles.controlButtonTextActive]}>
                        Horizontal
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setWallOrientation('vertical')}
                      style={[styles.orientationButton, wallOrientation === 'vertical' && styles.activeButton]}>
                      <ThemedText
                        style={[styles.controlButtonText, wallOrientation === 'vertical' && styles.controlButtonTextActive]}>
                        Vertical
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </>
            )}
            <Pressable
              onPress={handleSurrender}
              style={styles.surrenderButton}>
              <ThemedText style={styles.surrenderText}>🏳️ Surrender</ThemedText>
            </Pressable>
          </View>
        )}

        {winner && (
          <View style={styles.gameEndSection}>
            <View style={styles.gameEndButtons}>
              <Pressable
                onPress={handlePlayAgain}
                style={[styles.playAgainButton, myVote && styles.activeButton]}>
                <ThemedText
                  style={[styles.controlButtonText, myVote && styles.controlButtonTextActive]}>
                  {myVote ? '✓ Play Again' : 'Play Again'}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleLeaveGame}
                style={styles.leaveButton}>
                <ThemedText style={styles.leaveButtonText}>Leave Game</ThemedText>
              </Pressable>
            </View>
            <ThemedText style={styles.voteStatus}>
              {myVote && opponentVote ? 'Starting new game...' :
               myVote ? 'Waiting for opponent...' :
               opponentVote ? 'Opponent wants to play again' : ''}
            </ThemedText>
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 24,
    paddingVertical: 36,
    paddingBottom: 48,
    backgroundColor: NaturePalette.background,
  },
  container: {
    gap: 20,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    backgroundColor: NaturePalette.surfaceGlass,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  statusCard: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    backgroundColor: NaturePalette.surfaceGlassAlt,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusHeading: {
    fontSize: 20,
    fontWeight: '600',
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  playersRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    backgroundColor: NaturePalette.surfaceGlassAlt,
  },
  playerBadge: {
    width: 12,
    height: 46,
    borderRadius: 3,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  wallCount: {
    fontSize: 14,
    color: NaturePalette.mutedText,
  },
  boardWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  controlsSection: {
    gap: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  wallControls: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    alignItems: 'center',
    backgroundColor: NaturePalette.surfaceGlass,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  orientationButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    alignItems: 'center',
    backgroundColor: NaturePalette.surfaceGlass,
  },
  activeButton: {
    backgroundColor: NaturePalette.buttonColor,
    borderColor: NaturePalette.buttonColor,
  },
  controlButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: NaturePalette.text,
  },
  controlButtonTextActive: {
    color: NaturePalette.buttonText,
  },
  winMessage: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  surrenderButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: NaturePalette.surfaceGlass,
    borderWidth: 1,
    borderColor: NaturePalette.destructive,
    alignItems: 'center',
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
    marginTop: 8,
  },
  surrenderText: {
    color: NaturePalette.destructive,
    fontSize: 14,
    fontWeight: '600',
  },
  gameEndSection: {
    gap: 12,
  },
  gameEndButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  playAgainButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NaturePalette.success,
    backgroundColor: NaturePalette.surfaceGlass,
    alignItems: 'center',
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  leaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    alignItems: 'center',
    backgroundColor: NaturePalette.surfaceGlass,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  leaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: NaturePalette.destructive,
  },
  voteStatus: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
    color: NaturePalette.mutedText,
  },
});