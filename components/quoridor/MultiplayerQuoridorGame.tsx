import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { doc, updateDoc, serverTimestamp, increment, getDoc, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useGameLobby } from '@/context/GameLobbyContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const colorScheme = useColorScheme() ?? 'light';
  const [mode, setMode] = useState<'move' | 'wall' | 'drag'>('move');
  const [wallOrientation, setWallOrientation] = useState<Orientation>('horizontal');
  const [playAgainVote, setPlayAgainVote] = useState(false);
  const [newGameId, setNewGameId] = useState('')
  const urlParams = new URLSearchParams(window.location.search);
  const oldGameId = urlParams.get('oldGameId');

  const gameData = gameState?.state as any;
  const positions = gameData?.positions || INITIAL_POSITIONS;
  const walls = gameData?.walls || [];
  const wallsRemaining = gameData?.wallsRemaining || { north: MAX_WALLS_PER_PLAYER, south: MAX_WALLS_PER_PLAYER };
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

  const updateGameState = async (updates: any) => {
    if (!gameId) return;
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        'state': { ...gameData, ...updates },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to update game');
    }
  };

  const updateGame = async (updates: any) => {
    if (!gameId) return;
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        ...updates, // ✅ apply updates at root level
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
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
        // Update main game status
        const gameRef = doc(db, 'games', gameId);
        updateDoc(gameRef, {
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
        updatePlayerStats(user.uid, true);
      }
    }
  }, [gameState?.players, gameState?.playerIds, winner, myPlayerSide, gameState?.status]);

  // new game redirection for Play Again
  useEffect(() => {
    // Redirect both players to new game when rematch is ready
    if (gameState?.newGameId && winner) {
      console.log('gameId')
      console.log(gameId)
      console.log('gameState?.oldGameId')
      console.log(gameState?.oldGameId)
      router.replace(`/online/game/${gameState.newGameId}?oldGameId=${gameId}`);
    }
  }, [gameState?.newGameId]);

  // Clean up old game if redirected from previous game
  useEffect(() => {
    console.log('Deleting old game:', gameState?.oldGameId);
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

  const updatePlayerStats = async (playerId: string, isWinner: boolean) => {
    try {
      const userRef = doc(db, 'users', playerId);
      const points = isWinner ? 100 : 10;

      await updateDoc(userRef, {
        'stats.points': increment(points),
        'stats.gamesPlayed': increment(1),
        'stats.wins': increment(isWinner ? 1 : 0),
        lastUpdated: serverTimestamp(),
      });

      // Update level based on new points
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
  };

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

  const playerColors = useMemo(() => {
    if (colorScheme === 'dark') {
      return { north: '#2c3e50', south: '#c0392b' };
    }
    return { north: '#2c3e50', south: '#c0392b' };
  }, [colorScheme]);

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
                    <ThemedText style={styles.controlButtonText}>Move</ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setMode('wall')}
                    disabled={wallsRemaining[myPlayerSide] <= 0}
                    style={[styles.controlButton, mode === 'wall' && styles.activeButton]}>
                    <ThemedText style={styles.controlButtonText}>Wall</ThemedText>
                  </Pressable>
                </View>
                {mode === 'wall' && (
                  <View style={styles.wallControls}>
                    <Pressable
                      onPress={() => setWallOrientation('horizontal')}
                      style={[styles.orientationButton, wallOrientation === 'horizontal' && styles.activeButton]}>
                      <ThemedText style={styles.controlButtonText}>Horizontal</ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => setWallOrientation('vertical')}
                      style={[styles.orientationButton, wallOrientation === 'vertical' && styles.activeButton]}>
                      <ThemedText style={styles.controlButtonText}>Vertical</ThemedText>
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
                <ThemedText style={styles.controlButtonText}>
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
    paddingVertical: 4,
    paddingHorizontal: 5,
    paddingBottom: 32,
  },
  container: {
    gap: 14,
    borderRadius: 7,
    padding: 10,
  },
  statusCard: {
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgb(89,87,87)',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 12,
    justifyContent: 'space-between',
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgb(89,87,87)',
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
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
  },
  orientationButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#f39c12',
    borderColor: '#f39c12',
  },
  controlButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  winMessage: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  surrenderButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(192, 57, 43, 0.1)',
    borderWidth: 1,
    borderColor: '#c0392b',
    alignItems: 'center',
    marginTop: 8,
  },
  surrenderText: {
    color: '#c0392b',
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27ae60',
    backgroundColor: 'rgba(39, 174, 96, 0.1)',
    alignItems: 'center',
  },
  leaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  voteStatus: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
    // opacity: 0.8,
  },
});