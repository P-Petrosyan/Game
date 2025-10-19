import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Platform, StyleSheet, View, ImageBackground } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { soundManager } from '@/utils/sounds';
import { useUserStats } from '@/hooks/use-user-stats';
import { useAuth } from '@/context/AuthContext';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { BannerAd, BannerAdSize, TestIds, RewardedAd, RewardedAdEventType } from "react-native-google-mobile-ads";

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
  describeWallPlacement,
  getOpponent,
  getValidPawnMoves,
  isWinningPosition,
} from './game-logic';
import { QuoridorBoard } from './QuoridorBoard';
import { QuoridorAI, Difficulty } from './QuoridorAI';

type ControlButtonProps = {
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
};

type WallOrientationButtonProps = {
  orientation: Orientation;
  isActive: boolean;
  onPress: () => void;
  disabled?: boolean;
};

type WallsRemaining = Record<PlayerId, number>;

type Mode = 'move' | 'wall' | 'drag';

const PLAYER_LABELS: Record<PlayerId, string> = {
  north: 'You',
  south: 'AI',
};


const adUnitId = __DEV__
  ? TestIds.BANNER
  : Platform.select({
    ios: 'ca-app-pub-4468002211413891/5755554513',     // ✅ iOS banner ID
    android: 'ca-app-pub-4468002211413891/9076987898', // ✅ Android banner ID
  })!;

const rewardedAdUnitId = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
    ios: 'ca-app-pub-4468002211413891/7395760006',     // ✅ iOS banner ID
    android: 'ca-app-pub-4468002211413891/2090821804', // ✅ Android banner ID
  })!;

export function QuoridorGame() {
  const { stats } = useUserStats();
  const { user } = useAuth();
  const [positions, setPositions] = useState<Record<PlayerId, Position>>(() => ({
    north: { ...INITIAL_POSITIONS.north },
    south: { ...INITIAL_POSITIONS.south },
  }));
  const [walls, setWalls] = useState<Wall[]>([]);
  const [wallsRemaining, setWallsRemaining] = useState<WallsRemaining>({
    north: MAX_WALLS_PER_PLAYER,
    south: MAX_WALLS_PER_PLAYER,
  });
  const [currentPlayer, setCurrentPlayer] = useState<PlayerId>('north');
  const [mode, setMode] = useState<Mode>('move');
  const boardRef = useRef<View>(null);
  const [wallOrientation, setWallOrientation] = useState<Orientation>('horizontal');
  const [winner, setWinner] = useState<PlayerId | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [ai] = useState(() => new QuoridorAI('medium'));
  const [showHelp, setShowHelp] = useState(false);
  const [helpMessage, setHelpMessage] = useState<string>('');

  // --- Rewarded Ad Setup ---
  // --- Rewarded Ad (show when page opens) ---
  useEffect(() => {
    soundManager.loadSounds();

    const ad = RewardedAd.createForAdRequest(rewardedAdUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    const onAdLoaded = () => {
      console.log("[AdMob] Rewarded ad loaded ✅");
      ad.show(); // show immediately once loaded
    };

    const onAdEarned = async (reward) => {
      if (user) {
        try {
          await updateDoc(doc(db, "users", user.uid), {
            "stats.points": increment(50),
          });
          setStatusMessage("🎉 You earned 50 points!");
          setTimeout(() => setStatusMessage(null), 3000);
        } catch (err) {
          console.error("Failed to update points:", err);
        }
      }
    };

    // Subscribe to ad events
    const unsubscribeLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, onAdLoaded);
    const unsubscribeEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, onAdEarned);

    // Start loading the ad
    ad.load();

    // Cleanup
    return () => {
      unsubscribeLoaded();
      unsubscribeEarned();
      soundManager.cleanup();
    };
  }, [user]);

  // Auto help system - only for users with less than 5 games played
  useEffect(() => {
    if (winner || !stats || stats.gamesPlayed >= 5) return;
    
    const moveCount = (8 + positions.north.row) - positions.south.row;
    let timer: number | null = null;
    
    if (positions.north.row === 0 && wallsRemaining[currentPlayer] == 10) {
      setShowHelp(true);
      if (currentPlayer === 'north') {
        setHelpMessage('🎯 Your goal: Reach the top row. Click a highlighted square to move your pawn.');
      }
      timer = setTimeout(() => setHelpMessage(''), 1500);
    } else if ( 3 <= moveCount && moveCount <= 7 && currentPlayer === 'north' && wallsRemaining[currentPlayer] == 10) {
      setShowHelp(true);
      setHelpMessage('🧱 Try placing a wall to block the AI! Click "Place wall" then tap a highlighted area.');
      timer = setTimeout(() => setHelpMessage(''), 1500);
    } else if (moveCount >= 10 && currentPlayer === 'north' && wallsRemaining[currentPlayer] > 6 && wallsRemaining[opponent] > 5) {
      setShowHelp(true);
      setHelpMessage('💡 Tip: Walls block movement but can\'t completely trap a player. Plan your strategy!');
      timer = setTimeout(() => setHelpMessage(''), 1500);
    } else if (moveCount > 6) {
      setShowHelp(false);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentPlayer, positions, winner, stats]);

  const opponent = getOpponent(currentPlayer);

  // Update AI difficulty when prop changes
  useEffect(() => {
    ai.setDifficulty(difficulty);
  }, [difficulty, ai]);

  const makeAiMove = () => {
    if (currentPlayer !== 'south' || winner || isAiThinking) return;

    setIsAiThinking(true);

    setTimeout(async () => {
      try {
        const bestMove = await ai.getBestMove(positions, walls, wallsRemaining);

        if (bestMove) {
          if (bestMove.type === 'move') {
            const nextPositions = {...positions, south: bestMove.data as Position};
            setPositions(nextPositions);
            soundManager.playPawnMove();
            if (isWinningPosition('south', bestMove.data as Position)) {
              setWinner('south');
            } else {
              setCurrentPlayer('north');
            }
          } else {
            setWalls(prev => [...prev, bestMove.data as Wall]);
            setWallsRemaining(prev => ({...prev, south: prev.south - 1}));
            soundManager.playWallPlace();
            setCurrentPlayer('north');
          }
        }
      } catch (error) {
        console.warn('[Quoridor] Failed to resolve AI move', error);
      } finally {
        setIsAiThinking(false);
      }
      // setIsAiThinking(false);
    }, ai.getThinkingTime());
  };

  // Trigger AI move when it's AI's turn
  useEffect(() => {
    if (currentPlayer === 'south' && !winner && !isAiThinking) {
      makeAiMove();
    }
  }, [currentPlayer, winner, isAiThinking]);

  const controlPalette = useMemo(
    () => ({
      base: Colors.surface,
      disabled: Colors.overlayStrong,
      accent: Colors.accent,
      text: Colors.text,
      activeText: Colors.buttonText,
      disabledText: 'rgba(45, 27, 16, 0.45)',
    }) as const,
    [],
  );

  const playerColors = useMemo(
    () => ({
      north: Colors.board.pawnNorth,
      south: Colors.board.pawnSouth,
    }) as const,
    [],
  );

  const blockedEdges = useMemo(() => buildBlockedEdges(walls), [walls]);

  const validMoves = useMemo(() => {
    if (winner) {
      return [];
    }
    return getValidPawnMoves(positions[currentPlayer], positions[opponent], blockedEdges);
  }, [blockedEdges, currentPlayer, opponent, positions, winner]);

  const availableWalls = useMemo(() => {
    if (winner || (mode !== 'wall' && mode !== 'drag') || wallsRemaining[currentPlayer] <= 0) {
      return [];
    }
    return computeAvailableWalls(wallOrientation, walls, positions);
  }, [currentPlayer, mode, positions, wallOrientation, walls, wallsRemaining, winner]);

  useEffect(() => {
    if ((mode !== 'wall' && mode !== 'drag') || winner || wallsRemaining[currentPlayer] <= 0) {
      return;
    }

    if (availableWalls.length > 0) {
      return;
    }

    const alternate: Orientation = wallOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    const placements = computeAvailableWalls(alternate, walls, positions);

    if (placements.length > 0) {
      setWallOrientation(alternate);
      setStatusMessage(`No legal ${wallOrientation} wall placements remain. Switched to ${alternate}.`);
    } else {
      setStatusMessage('No legal wall placements remain. Try moving a pawn instead.');
    }
  }, [availableWalls.length, currentPlayer, mode, positions, wallOrientation, walls, wallsRemaining, winner]);

  const ControlButton = ({ label, onPress, active, disabled }: ControlButtonProps) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.controlButton,
        {
          backgroundColor: active
            ? controlPalette.accent
            : disabled
              ? controlPalette.disabled
              : controlPalette.base,
          borderColor: active ? controlPalette.accent : 'transparent',
        },
      ]}>
      <ThemedText
        style={[
          styles.controlButtonText,
          {
            color: active
              ? controlPalette.activeText
              : disabled
                ? controlPalette.disabledText
                : controlPalette.text,
          },
        ]}>
        {label}
      </ThemedText>
    </Pressable>
  );

  const WallOrientationButton = ({ orientation, isActive, onPress, disabled }: WallOrientationButtonProps) => {
    const previewColor = Colors.board.wall;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${orientation === 'horizontal' ? 'Horizontal' : 'Vertical'} wall`}
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.wallOptionButton,
          {
            backgroundColor: isActive
              ? controlPalette.accent
              : disabled
                ? controlPalette.disabled
                : controlPalette.base,
            borderColor: isActive ? controlPalette.accent : Colors.outline,
          },
        ]}>
        <View
          style={[
            styles.wallPreview,
            orientation === 'horizontal' ? styles.horizontalWallPreview : styles.verticalWallPreview,
            { backgroundColor: previewColor },
          ]}
        />
        <ThemedText
          style={[
            styles.wallOptionLabel,
            {
              color: isActive
                ? controlPalette.activeText
                : disabled
                  ? controlPalette.disabledText
                  : controlPalette.text,
            },
          ]}>
          {orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
        </ThemedText>
      </Pressable>
    );
  };

  const heading = winner ? `${PLAYER_LABELS[winner]} wins!` : `${PLAYER_LABELS[currentPlayer]} to play`;
  const headingColor = winner ? playerColors[winner] : playerColors[currentPlayer];

  const canCurrentPlayerPlaceWall = wallsRemaining[currentPlayer] > 0;

  const handleSelectMode = (nextMode: Mode) => {
    if (winner) {
      return;
    }

    if (nextMode === 'wall' || nextMode === 'drag') {
      if (!canCurrentPlayerPlaceWall) {
        setStatusMessage('You have no walls left to place.');
        return;
      }
    }

    setStatusMessage(null);
    setMode(nextMode);
  };

  const startNewGame = () => {
    setPositions({
      north: { ...INITIAL_POSITIONS.north },
      south: { ...INITIAL_POSITIONS.south },
    });
    setWalls([]);
    setWallsRemaining({
      north: MAX_WALLS_PER_PLAYER,
      south: MAX_WALLS_PER_PLAYER,
    });
    setCurrentPlayer('north');
    setMode('move');
    setWallOrientation('horizontal');
    setWinner(null);
    setStatusMessage(null);
    setIsAiThinking(false);
    setShowHelp(true);
    setHelpMessage('');
  };

  const handleDifficultyChange = (newDifficulty: Difficulty) => {
    setDifficulty(newDifficulty);
    ai.setDifficulty(newDifficulty);
    startNewGame();
  };

  // Auto-restart when user wins
  useEffect(() => {
    if (winner === 'north') {
      const timer = setTimeout(() => {
        startNewGame();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [winner]);

  const handleWallSelect = (orientation: Orientation) => {
    setWallOrientation(orientation);
    setStatusMessage(`Selected ${orientation} wall. Tap a highlighted area on the board to place it.`);
  };

  const handleCellPress = (target: Position) => {
    if (winner || mode !== 'move' || currentPlayer === 'south') {
      return;
    }

    const isLegalMove = validMoves.some((move) => move.row === target.row && move.col === target.col);
    if (!isLegalMove) {
      setStatusMessage('You can only move to highlighted squares.');
      return;
    }

    const nextPositions: Record<PlayerId, Position> = {
      north: { ...positions.north },
      south: { ...positions.south },
    };
    nextPositions[currentPlayer] = target;
    setPositions(nextPositions);
    soundManager.playPawnMove();
    setStatusMessage(null);

    if (isWinningPosition(currentPlayer, target)) {
      setWinner(currentPlayer);
      return;
    }

    setCurrentPlayer(opponent);
  };

  const handleWallPlacement = (wall: Wall) => {
    if (winner || (mode !== 'wall' && mode !== 'drag') || currentPlayer === 'south') {
      return;
    }

    if (!canCurrentPlayerPlaceWall) {
      setStatusMessage('You have no walls left to place.');
      setMode('move');
      return;
    }

    if (!canPlaceWall(wall, walls, positions)) {
      setStatusMessage(
        'That wall cannot be placed there because it conflicts with another wall or would block all paths.',
      );
      return;
    }

    setWalls((existing) => [...existing, wall]);
    setWallsRemaining((remaining) => ({
      ...remaining,
      [currentPlayer]: remaining[currentPlayer] - 1,
    }));
    soundManager.playWallPlace();
    setStatusMessage(
      `${PLAYER_LABELS[currentPlayer]} placed ${describeWallPlacement(wall)}. ${PLAYER_LABELS[opponent]} to play.`,
    );
    setCurrentPlayer(opponent);
    setMode('move');
  };

  return (
    <ImageBackground
      source={require('@/assets/backgrounds/homeScreen.webp')}
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
    {/*<ScrollView contentContainerStyle={styles.scrollContainer}>*/}
      <ThemedView style={styles.container}>
        {/*<ThemedText type="title" style={styles.title}>*/}
        {/*  Quoridor*/}
        {/*</ThemedText>*/}
        {/*<ThemedText style={styles.lead}>*/}
        {/*  Race your pawn to the opposite side of the board while building fences to slow your opponent down.*/}
        {/*</ThemedText>*/}

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={{ flexDirection: 'row', gap: 6}}>
              <View style={[styles.statusDot, { backgroundColor: headingColor }]} />
              <ThemedText style={[styles.statusHeading, { color: headingColor }]}>
                {isAiThinking ? 'AI is thinking...' : heading}
              </ThemedText>
            </View>
              <Pressable
                style={[styles.resetButton, { backgroundColor: Colors.accent }]}
                onPress={startNewGame}>
                <ThemedText
                  style={[styles.resetButtonText, { color: Colors.buttonText }]}
                >
                  New game
                </ThemedText>
              </Pressable>
          </View>
          {showHelp && helpMessage && (
            <View style={styles.helpCard}>
              <ThemedText style={styles.helpText}>{helpMessage}</ThemedText>
              <Pressable
                style={[styles.helpButton, { backgroundColor: Colors.surfaceMuted }]}
                onPress={() => setShowHelp(false)}>
                <ThemedText style={[styles.helpButtonText, { color: Colors.textMuted }]}>✕</ThemedText>
              </Pressable>
            </View>
          )}
          <View style={styles.difficultyRow}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((diff) => (
              <Pressable
                key={diff}
                style={[styles.difficultyButton, difficulty === diff && styles.activeDifficultyButton]}
                onPress={() => handleDifficultyChange(diff)}>
                <ThemedText style={[styles.difficultyButtonText, difficulty === diff && styles.activeDifficultyButtonText]}>
                  {diff.charAt(0).toUpperCase() + diff.slice(1)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.summaryRow}>
          {(['north', 'south'] as PlayerId[]).map((player) => (
            <View key={player} style={styles.playerSummary}>
              <View style={[styles.playerBadge, { backgroundColor: playerColors[player] }]} />
              <View style={styles.playerSummaryText}>
                <ThemedText style={styles.playerName}>
                  {PLAYER_LABELS[player]}
                </ThemedText>
                <ThemedText style={styles.playerDetail}>Walls left: {wallsRemaining[player]}</ThemedText>
              </View>
            </View>
          ))}
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

        <View style={styles.controlsSection}>
          <View style={styles.modeRow}>
            <ControlButton
              label="Move pawn"
              onPress={() => handleSelectMode('move')}
              active={mode === 'move'}
              disabled={winner !== null}
            />
            <ControlButton
              label="Place wall"
              onPress={() => handleSelectMode('wall')}
              active={mode === 'wall'}
              disabled={winner !== null || !canCurrentPlayerPlaceWall}
            />
            {/*<ControlButton*/}
            {/*  label="Drag walls"*/}
            {/*  onPress={() => handleSelectMode('drag')}*/}
            {/*  active={mode === 'drag'}*/}
            {/*  disabled={winner !== null || !canCurrentPlayerPlaceWall}*/}
            {/*/>*/}
          </View>

          {/*{mode === 'drag' && (*/}
          {/*  <WallPalette*/}
          {/*    wallsRemaining={wallsRemaining[currentPlayer]}*/}
          {/*    onWallSelect={handleWallSelect}*/}
          {/*    selectedOrientation={wallOrientation}*/}
          {/*    disabled={winner !== null}*/}
          {/*  />*/}
          {/*)}*/}
          {mode === 'wall' && (
            <View style={styles.wallControls}>
              <View style={styles.compactWallRow}>
                <Pressable
                  style={[styles.compactWallButton, wallOrientation === 'horizontal' && styles.activeSettingButton]}
                  onPress={() => {
                    setWallOrientation('horizontal');
                    setStatusMessage(null);
                  }}
                  disabled={winner !== null}>
                  <View style={[styles.wallPreviewSmall, styles.horizontalWallPreviewSmall]} />
                  <ThemedText style={[styles.compactWallText, wallOrientation === 'horizontal' && styles.activeSettingButtonText]}>Horizontal</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.compactWallButton, wallOrientation === 'vertical' && styles.activeSettingButton]}
                  onPress={() => {
                    setWallOrientation('vertical');
                    setStatusMessage(null);
                  }}
                  disabled={winner !== null}>
                  <View style={[styles.wallPreviewSmall, styles.verticalWallPreviewSmall]} />
                  <ThemedText style={[styles.compactWallText, wallOrientation === 'vertical' && styles.activeSettingButtonText]}>Vertical</ThemedText>
                </Pressable>
              </View>
              <ThemedText style={styles.wallHint}>Tap highlighted areas on board to place wall</ThemedText>
            </View>
          )}
          {/*{mode === 'drag' && (*/}
          {/*  <ThemedText style={styles.wallsHint}>*/}
          {/*    Select a wall type below, then tap a highlighted area on the board to place it*/}
          {/*  </ThemedText>*/}
          {/*)}*/}
        </View>

        {/*<View style={styles.boardWrapper}>*/}
        {/*  <QuoridorBoard*/}
        {/*    currentPlayer={currentPlayer}*/}
        {/*    positions={positions}*/}
        {/*    walls={walls}*/}
        {/*    validMoves={validMoves}*/}
        {/*    mode={mode}*/}
        {/*    availableWalls={availableWalls}*/}
        {/*    onCellPress={handleCellPress}*/}
        {/*    onWallPress={handleWallPlacement}*/}
        {/*  />*/}
        {/*</View>*/}


        {/*<ThemedText style={styles.footerNote}>*/}
        {/*  Every turn you must either step one space orthogonally or drop a wall segment. Walls cannot overlap or remove an*/}
        {/*  opponent&apos;s only route to their goal row.*/}
        {/*</ThemedText>*/}
        {/*<ThemedText style={styles.footerNote}>*/}
        {/*  Coordinates are shown as rows and columns to make it easy to discuss moves with a friend while you play.*/}
        {/*</ThemedText>*/}
      </ThemedView>
    {/*</ScrollView>*/}
    </ImageBackground>
  );
}

export default QuoridorGame;

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  // scrollContainer: {
  //   // paddingVertical: 4,
  //   // paddingHorizontal: 5,
  //   paddingBottom: 32,
  // },
  container: {
    gap: 5,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    // marginTop: 10,
    padding: 10,
    backgroundColor: Colors.surface,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 3,
  },
  bannerContainer: {
    flexDirection: "row",
    justifyContent: "center"
  },
  title: {
    textAlign: 'center',
  },
  lead: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  statusCard: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 2,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusHeading: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.heading,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  helperText: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'space-between',
  },
  playerSummary: {
    flex: 1,
    flexDirection: 'row',
    gap: 7,
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
  playerSummaryText: {
    flex: 1,
    gap: 4,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.heading,
  },
  playerDetail: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  controlsSection: {
    gap: 8,
  },
  boardWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  wallControls: {
    gap: 8,
  },
  wallOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  wallOptionButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    gap: 8,
  },
  wallPreview: {
    borderRadius: 3,
  },
  horizontalWallPreview: {
    width: 40,
    height: 8,
  },
  verticalWallPreview: {
    width: 8,
    height: 40,
  },
  wallOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  controlButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
  },
  controlButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  wallsHint: {
    fontSize: 14,
    fontStyle: 'italic',
    color: Colors.textMuted,
  },
  resetButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  resetButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  footerNote: {
    fontSize: 14,
    lineHeight: 20,
  },
  gameSettings: {
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.heading,
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
  difficultyRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  difficultyButton: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderColor: Colors.outline,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  activeDifficultyButton: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  difficultyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  activeDifficultyButtonText: {
    color: Colors.buttonText,
  },
  helpCard: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    backgroundColor: Colors.accent + '99',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    zIndex: 1000,
    elevation: 10,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  helpText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 18,
  },
  helpButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpButtonText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});