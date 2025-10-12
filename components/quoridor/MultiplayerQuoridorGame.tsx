import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { doc, updateDoc, serverTimestamp, increment, getDoc, deleteDoc } from 'firebase/firestore';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { AI_PLAYER_ID, useGameLobby } from '@/context/GameLobbyContext';
import { useCustomAlert } from '@/hooks/use-custom-alert';
import { useRealtimeGame } from '@/hooks/use-realtime-game';
import { db } from '@/services/firebase';
import { soundManager } from '@/utils/sounds';

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
import { QuoridorAI } from './QuoridorAI';

type MultiplayerQuoridorGameProps = {
  gameId: string;
};

export function MultiplayerQuoridorGame({ gameId }: MultiplayerQuoridorGameProps) {
  const { user } = useAuth();
  const { gameState } = useRealtimeGame(gameId);
  const { createGame, leaveGame } = useGameLobby();
  const { alertState, showAlert, hideAlert } = useCustomAlert();
  const router = useRouter();
  const [mode, setMode] = useState<'move' | 'wall' | 'drag'>('move');
  const [wallOrientation, setWallOrientation] = useState<Orientation>('horizontal');
  const [playAgainVote, setPlayAgainVote] = useState(false);
  const [turnTimer, setTurnTimer] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTurnChangeRef = useRef<number>(Date.now());

  // Load sounds on component mount
  useEffect(() => {
    soundManager.loadSounds();
    return () => {
      soundManager.cleanup();
    };
  }, []);

  const gameData = gameState?.state as any;
  const positions = useMemo(
    () => (gameData?.positions as Record<PlayerId, Position>) || INITIAL_POSITIONS,
    [gameData?.positions],
  );
  const walls = useMemo(() => (gameData?.walls as Wall[]) || [], [gameData?.walls]);
  const wallsRemaining = useMemo(
    () =>
      (gameData?.wallsRemaining as Record<PlayerId, number>) || {
        north: MAX_WALLS_PER_PLAYER,
        south: MAX_WALLS_PER_PLAYER,
      },
    [gameData?.wallsRemaining],
  );
  const currentPlayer = gameData?.currentPlayer || 'north';
  const winner = gameData?.winner;

  const playerIds = gameState?.playerIds || [];
  const myPlayerId = user?.uid;
  const opponentId = playerIds.find(id => id !== user?.uid);
  const isAIMatch = Boolean(gameState?.aiMatch?.enabled && gameState?.aiMatch?.aiPlayerId);
  const aiPlayerId = isAIMatch ? gameState?.aiMatch?.aiPlayerId ?? null : null;
  const aiPlayerSide: PlayerId | null = isAIMatch && aiPlayerId
    ? playerIds[0] === aiPlayerId
      ? 'north'
      : playerIds[1] === aiPlayerId
        ? 'south'
        : null
    : null;
  const isAiOpponent = Boolean(aiPlayerId && opponentId === aiPlayerId);

  const aiRef = useRef<QuoridorAI | null>(null);
  const aiMoveInProgressRef = useRef(false);
  const aiLastStateRef = useRef<string | null>(null);

  if (!aiRef.current) {
    aiRef.current = new QuoridorAI('hard');
  }

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

  const updateGameState = useCallback(
    async (updates: any) => {
      if (!gameId) return;
      try {
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
          state: { ...gameData, ...updates },
          updatedAt: serverTimestamp(),
        });
      } catch {
        showAlert({
          title: 'Error',
          message: 'Failed to update game',
          buttons: [{ text: 'OK', style: 'default' }],
        });
      }
    },
    [gameData, gameId],
  );

  const updateGame = useCallback(
    async (updates: any) => {
      if (!gameId) return;
      try {
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
          ...updates,
          updatedAt: serverTimestamp(),
        });
      } catch {
        showAlert({
          title: 'Error',
          message: 'Failed to update game',
          buttons: [{ text: 'OK', style: 'default' }],
        });
      }
    },
    [gameId],
  );

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

    soundManager.playPawnMove();

    if (hasWon) {
      // Update stats for both players
      updatePlayerStats(user.uid, true); // Winner
      if (opponentId && opponentId !== AI_PLAYER_ID) {
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

    soundManager.playWallPlace();
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
  }, [gameId, gameState?.playerIds, gameState?.players, gameState?.status, myPlayerSide, playerIds.length, updateGameState, user, winner]);

  // new game redirection for Play Again
  useEffect(() => {
    // Redirect both players to new game when rematch is ready
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
      } catch (error) {
        console.error('Failed to delete game:', error);
      }
    }, 3000) ;

    return () => clearTimeout(deleteGame);
  }, [gameState?.oldGameId]);

  // Timer effect - runs for all players
  useEffect(() => {
    if (winner) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Reset timer when turn changes
    const currentTime = Date.now();
    if (currentTime - lastTurnChangeRef.current > 500) { // Debounce turn changes
      setTurnTimer(30);
      lastTurnChangeRef.current = currentTime;
    }

    timerRef.current = setInterval(() => {
      setTurnTimer(prev => {
        if (prev <= 1) {
          // Time's up - current player loses
          updateGameState({
            winner: getOpponent(currentPlayer),
            gameEndReason: 'timeout',
            status: 'completed',
          });
          if (currentPlayer === myPlayerSide) {
            if (opponentId && opponentId !== AI_PLAYER_ID) {
              updatePlayerStats(opponentId, true);
            }
            updatePlayerStats(user.uid, false);
          } else {
            updatePlayerStats(user.uid, true);
            if (opponentId && opponentId !== AI_PLAYER_ID) {
              updatePlayerStats(opponentId, false);
            }
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentPlayer, isMyTurn, myPlayerSide, opponentId, updateGameState, user?.uid, winner]);

  const updatePlayerStats = useCallback(async (playerId: string, isWinner: boolean) => {
    if (!playerId || playerId === AI_PLAYER_ID) {
      return;
    }

    try {
      const userRef = doc(db, 'users', playerId);
      const points = isWinner ? 50 : 5;

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
        const newLevel = Math.floor(currentPoints / 1000) + 1;
        await updateDoc(userRef, { 'stats.level': newLevel });
      }
    } catch (error) {
      console.error('Failed to update player stats:', error);
    }
  }, []);

  useEffect(() => {
    if (!isAiOpponent || !aiPlayerSide || winner || !gameId) {
      return;
    }

    if (currentPlayer !== aiPlayerSide) {
      aiMoveInProgressRef.current = false;
      return;
    }

    const stateKey = JSON.stringify({ positions, walls, wallsRemaining, currentPlayer });
    if (aiLastStateRef.current === stateKey || aiMoveInProgressRef.current) {
      return;
    }

    const aiInstance = aiRef.current;
    if (!aiInstance) {
      return;
    }

    aiLastStateRef.current = stateKey;
    aiMoveInProgressRef.current = true;

    const thinkingDelay = aiInstance.getThinkingTime();
    const timer = setTimeout(async () => {
      const aiWallsLeft = wallsRemaining[aiPlayerSide] ?? 0;
      const move = aiInstance.getBestMoveForSide(aiPlayerSide, positions, walls, aiWallsLeft);
      aiMoveInProgressRef.current = false;

      if (!move) {
        return;
      }

      if (move.type === 'move') {
        const target = move.data as Position;
        const nextPositions = { ...positions, [aiPlayerSide]: target };
        const hasWon = isWinningPosition(aiPlayerSide, target);
        const nextPlayer = hasWon ? aiPlayerSide : getOpponent(aiPlayerSide);
        await updateGameState({
          positions: nextPositions,
          currentPlayer: nextPlayer,
          winner: hasWon ? aiPlayerSide : null,
          status: hasWon ? 'completed' : 'playing',
        });

        if (hasWon && user?.uid) {
          updatePlayerStats(user.uid, false);
        }
      } else {
        const wallPlacement = move.data as Wall;
        const nextWalls = [...walls, wallPlacement];
        const nextWallsRemaining = {
          ...wallsRemaining,
          [aiPlayerSide]: Math.max(0, (wallsRemaining[aiPlayerSide] ?? 0) - 1),
        };
        await updateGameState({
          walls: nextWalls,
          wallsRemaining: nextWallsRemaining,
          currentPlayer: getOpponent(aiPlayerSide),
        });
      }
    }, thinkingDelay);

    return () => {
      clearTimeout(timer);
      aiMoveInProgressRef.current = false;
    };
  }, [
    aiPlayerSide,
    currentPlayer,
    gameId,
    isAiOpponent,
    myPlayerSide,
    opponentId,
    positions,
    updateGameState,
    updatePlayerStats,
    user?.uid,
    walls,
    wallsRemaining,
    winner,
  ]);

  const handleSurrender = async (timeOut = false) => {
    if (timeOut) {
      await updateGameState({
        winner: getOpponent(myPlayerSide),
        gameEndReason: 'timeout',
      });
      if (opponentId && opponentId !== AI_PLAYER_ID) {
        updatePlayerStats(opponentId, true);
      }
      updatePlayerStats(user.uid, false);
      return;
    }

    showAlert({
      title: 'Surrender Game',
      message: 'Are you sure you want to surrender? Your opponent will win.',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Surrender',
          style: 'destructive',
          onPress: async () => {
            await updateGameState({
              winner: getOpponent(myPlayerSide),
              gameEndReason: 'surrender',
            });
            if (opponentId && opponentId !== AI_PLAYER_ID) {
              updatePlayerStats(opponentId, true);
            }
            updatePlayerStats(user.uid, false);
          },
        },
      ],
    });
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

        // Add opponent to the new game immediately and start playing
        const gameRef = doc(db, 'games', newGame.id);
        const opponentName = gameState?.players?.[opponentId]?.displayName || 'Player';
        const opponentReady = Boolean(gameState?.players?.[opponentId]?.ready);

        const updates: Record<string, unknown> = {
          playerIds: [user.uid, opponentId],
          playerCount: 2,
          status: 'playing',
          oldGameId: gameId,
          [`players.${opponentId}`]: {
            displayName: opponentName,
            joinedAt: serverTimestamp(),
            ready: isAiOpponent ? true : opponentReady,
          },
          updatedAt: serverTimestamp(),
        };

        if (isAiOpponent && aiPlayerId) {
          updates.hostId = aiPlayerId;
          updates.hostName = opponentName;
          updates[`players.${user.uid}.ready`] = true;
          updates.aiMatch = {
            enabled: true,
            difficulty: 'hard',
            aiPlayerId,
            aiName: opponentName,
          };
        }

        await updateDoc(gameRef, updates);

        // Store new game ID for redirection
        await updateGame({
          newGameId: newGame.id,
        });
      } catch (error) {
        showAlert({
          title: 'Error',
          message: 'Failed to create new game',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        console.error('Error creating new game:', error);
      }
    }
  };

  useEffect(() => {
    if (!isAiOpponent || !aiPlayerId || !winner) {
      return;
    }

    if (gameState?.playAgainVotes?.[aiPlayerId]) {
      return;
    }

    const castVote = async () => {
      try {
        await updateGame({
          [`playAgainVotes.${aiPlayerId}`]: true,
        });
      } catch (error) {
        console.error('Failed to record AI rematch vote:', error);
      }
    };

    void castVote();
  }, [aiPlayerId, gameState?.playAgainVotes, isAiOpponent, updateGame, winner]);

  const handleLeaveGame = useCallback(async () => {
    router.replace('/online');
    // deleteDoc(doc(db, 'games', gameId));
    try {
      await leaveGame(gameId);
    } catch (error) {
      console.error('Failed to leave game:', error);
    }
  }, [gameId, leaveGame, router]);

  const playerColors = useMemo(
    () => ({
      north: Colors.board.pawnNorth,
      south: Colors.board.pawnSouth,
    }),
    [],
  );

  const myPlayerName = gameState?.players?.[myPlayerId || '']?.displayName || 'You';
  const opponentName = gameState?.players?.[opponentId || '']?.displayName || 'Opponent';

  const myVote = gameState?.playAgainVotes?.[user?.uid || ""];
  const opponentVote = gameState?.playAgainVotes?.[opponentId || ""];

  return (
    // <ScrollView contentContainerStyle={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusHeaderTurn}>
              <View style={[styles.statusDot, { backgroundColor: playerColors[currentPlayer] }]} />
              <ThemedText style={[styles.statusHeading, { color: playerColors[currentPlayer] }, ]}>
                {winner
                  ? `${winner === myPlayerSide ? myPlayerName : opponentName} wins!`
                  : `${isMyTurn ? 'Your' : `${opponentName}'s`} turn`
                }
              </ThemedText>
              {!winner && (
                <View style={styles.timerContainer}>
                  <ThemedText style={[styles.timerText, turnTimer <= 10 && styles.timerWarning]}>
                    {turnTimer}
                  </ThemedText>
                </View>
              )}
            </View>
            {!winner && (
              <View>
                <Pressable
                  onPress={() => handleSurrender(false)}
                  style={styles.surrenderButton}>
                  <ThemedText style={styles.surrenderText}>🏳️ Leave</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
          {winner && (
            <ThemedText style={styles.winMessage}>
              {winner === myPlayerSide ? '+50 points! 🎉' : '+5 points for playing'}
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
                      style={[styles.controlButtonText, mode === 'move' && styles.controlButtonTextActive]}
                    >
                      Move
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setMode('wall')}
                    disabled={wallsRemaining[myPlayerSide] <= 0}
                    style={[styles.controlButton, mode === 'wall' && styles.activeButton]}>
                    <ThemedText
                      style={[styles.controlButtonText, mode === 'wall' && styles.controlButtonTextActive]}
                    >
                      Wall
                    </ThemedText>
                  </Pressable>
                </View>
                {mode === 'wall' && (
                  <View style={styles.wallControls}>
                    <View style={styles.compactWallRow}>
                      <Pressable
                        style={[styles.compactWallButton, wallOrientation === 'horizontal' && styles.activeSettingButton]}
                        onPress={() => {
                          setWallOrientation('horizontal');
                        }}
                        disabled={winner !== null}>
                        <View style={[styles.wallPreviewSmall, styles.horizontalWallPreviewSmall]} />
                        <ThemedText style={[styles.compactWallText, wallOrientation === 'horizontal' && styles.activeSettingButtonText]}>Horizontal</ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.compactWallButton, wallOrientation === 'vertical' && styles.activeSettingButton]}
                        onPress={() => {
                          setWallOrientation('vertical');
                        }}
                        disabled={winner !== null}>
                        <View style={[styles.wallPreviewSmall, styles.verticalWallPreviewSmall]} />
                        <ThemedText style={[styles.compactWallText, wallOrientation === 'vertical' && styles.activeSettingButtonText]}>Vertical</ThemedText>
                      </Pressable>
                    </View>
                    <ThemedText style={styles.wallHint}>Tap highlighted areas on board to place wall</ThemedText>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {winner && (
          <View style={styles.gameEndSection}>
            <View style={styles.gameEndButtons}>
              <Pressable
                onPress={handlePlayAgain}
                style={[styles.playAgainButton, myVote && styles.activeButton]}>
                <ThemedText
                  style={[styles.controlButtonText, myVote && styles.controlButtonTextActive]}
                >
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
        
        <CustomAlert
          visible={alertState.visible}
          title={alertState.options?.title || ''}
          message={alertState.options?.message || ''}
          buttons={alertState.options?.buttons || []}
          onDismiss={hideAlert}
        />
      </ThemedView>
    // </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    paddingBottom: 32,
  },
  container: {
    gap: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  statusCard: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusHeaderTurn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusHeading: {
    maxWidth: 140,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.heading,
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
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: Colors.surfaceMuted,
  },
  playerBadge: {
    width: 12,
    height: 46,
    borderRadius: 3,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.heading,
  },
  wallCount: {
    fontSize: 14,
    color: Colors.textMuted,
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
    gap: 12,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: Colors.surface,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
    alignItems: 'center',
  },
  orientationButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  controlButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  controlButtonTextActive: {
    color: Colors.buttonText,
  },
  winMessage: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
    color: Colors.heading,
  },
  surrenderButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(192, 74, 58, 0.12)',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  surrenderText: {
    color: Colors.danger,
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
    borderColor: Colors.success,
    backgroundColor: 'rgba(47, 143, 78, 0.12)',
    alignItems: 'center',
  },
  leaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  leaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  voteStatus: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.textMuted,
  },
  timerContainer: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  timerWarning: {
    color: Colors.danger,
  },

  settingButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: Colors.surface,
  },
  activeSettingButton: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  settingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  activeSettingButtonText: {
    color: Colors.buttonText,
  },
  compactWallRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactWallButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.outline,
    backgroundColor: Colors.surface,
  },
  wallPreviewSmall: {
    backgroundColor: Colors.board.wall,
    borderRadius: 2,
  },
  horizontalWallPreviewSmall: {
    width: 20,
    height: 4,
  },
  verticalWallPreviewSmall: {
    width: 4,
    height: 20,
  },
  compactWallText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  wallHint: {
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.textMuted,
    textAlign: 'center',
  },
});