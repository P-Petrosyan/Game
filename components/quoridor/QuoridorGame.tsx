import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

type Mode = 'move' | 'wall';

const PLAYER_LABELS: Record<PlayerId, string> = {
  north: 'North',
  south: 'South',
};

function formatPosition(position: Position): string {
  return `row ${position.row + 1}, column ${position.col + 1}`;
}

export function QuoridorGame() {
  const colorScheme = useColorScheme() ?? 'light';
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
  const [wallOrientation, setWallOrientation] = useState<Orientation>('horizontal');
  const [winner, setWinner] = useState<PlayerId | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const opponent = getOpponent(currentPlayer);

  const controlPalette = useMemo(() => {
    if (colorScheme === 'dark') {
      return {
        base: '#2f2720',
        disabled: 'rgba(255,255,255,0.1)',
        accent: '#f1c40f',
        text: '#f8ede0',
        activeText: '#1c130a',
        disabledText: 'rgba(255,255,255,0.45)',
      } as const;
    }

    return {
      base: '#f8f1e4',
      disabled: 'rgba(0,0,0,0.06)',
      accent: '#f39c12',
      text: '#3c2f22',
      activeText: '#fff',
      disabledText: 'rgba(0,0,0,0.35)',
    } as const;
  }, [colorScheme]);

  const playerColors = useMemo(() => {
    if (colorScheme === 'dark') {
      return {
        north: '#9fc5ff',
        south: '#f39c96',
      } as const;
    }
    return {
      north: '#2c3e50',
      south: '#c0392b',
    } as const;
  }, [colorScheme]);

  const blockedEdges = useMemo(() => buildBlockedEdges(walls), [walls]);

  const validMoves = useMemo(() => {
    if (winner) {
      return [];
    }
    return getValidPawnMoves(positions[currentPlayer], positions[opponent], blockedEdges);
  }, [blockedEdges, currentPlayer, opponent, positions, winner]);

  const availableWalls = useMemo(() => {
    if (winner || mode !== 'wall' || wallsRemaining[currentPlayer] <= 0) {
      return [];
    }
    return computeAvailableWalls(wallOrientation, walls, positions);
  }, [currentPlayer, mode, positions, wallOrientation, walls, wallsRemaining, winner]);

  useEffect(() => {
    if (mode !== 'wall' || winner || wallsRemaining[currentPlayer] <= 0) {
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
    const previewColor = colorScheme === 'dark' ? '#f8ede0' : '#5d3b21';

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
            borderColor: isActive
              ? controlPalette.accent
              : colorScheme === 'dark'
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(0,0,0,0.08)',
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

  const helperMessage = winner
    ? 'Tap “Start a new game” to reset the board and challenge a friend again.'
    : statusMessage ??
    (mode === 'wall'
      ? availableWalls.length > 0
        ? `Tap a highlighted groove to place a ${wallOrientation} wall.`
        : 'No legal placements for this orientation. Try switching orientation or move your pawn.'
      : 'Tap a highlighted square to move your pawn.');

  const canCurrentPlayerPlaceWall = wallsRemaining[currentPlayer] > 0;

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
  };

  const handleSelectMode = (nextMode: Mode) => {
    if (winner) {
      return;
    }

    if (nextMode === 'wall') {
      if (!canCurrentPlayerPlaceWall) {
        setStatusMessage('You have no walls left to place.');
        return;
      }
    }

    setStatusMessage(null);
    setMode(nextMode);
  };

  const handleCellPress = (target: Position) => {
    if (winner || mode !== 'move') {
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
    setStatusMessage(null);

    if (isWinningPosition(currentPlayer, target)) {
      setWinner(currentPlayer);
      return;
    }

    setCurrentPlayer(opponent);
  };

  const handleWallPlacement = (wall: Wall) => {
    if (winner || mode !== 'wall') {
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
    setStatusMessage(
      `${PLAYER_LABELS[currentPlayer]} placed ${describeWallPlacement(wall)}. ${PLAYER_LABELS[opponent]} to play.`,
    );
    setCurrentPlayer(opponent);
    setMode('move');
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        {/*<ThemedText type="title" style={styles.title}>*/}
        {/*  Quoridor*/}
        {/*</ThemedText>*/}
        {/*<ThemedText style={styles.lead}>*/}
        {/*  Race your pawn to the opposite side of the board while building fences to slow your opponent down.*/}
        {/*</ThemedText>*/}

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusDot, { backgroundColor: headingColor }]} />
            <ThemedText style={[styles.statusHeading, { color: headingColor }]}>{heading}</ThemedText>
          </View>
          {/*<ThemedText style={styles.helperText}>{helperMessage}</ThemedText>*/}
        </View>

        <View style={styles.summaryRow}>
          {(['north', 'south'] as PlayerId[]).map((player) => (
            <View key={player} style={styles.playerSummary}>
              <View style={[styles.playerBadge, { backgroundColor: playerColors[player] }]} />
              <View style={styles.playerSummaryText}>
                <ThemedText style={styles.playerName}>{PLAYER_LABELS[player]}</ThemedText>
                <ThemedText style={styles.playerDetail}>Walls left: {wallsRemaining[player]}</ThemedText>
                {/*<ThemedText style={styles.playerDetail}>*/}
                {/*  Pawn at {formatPosition(positions[player])}*/}
                {/*</ThemedText>*/}
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
          </View>
          {mode === 'wall' ? (
            <View style={styles.wallControls}>
              <View style={styles.wallOptionsRow}>
                <WallOrientationButton
                  orientation="horizontal"
                  isActive={wallOrientation === 'horizontal'}
                  onPress={() => {
                    setWallOrientation('horizontal');
                    setStatusMessage(null);
                  }}
                  disabled={winner !== null}
                />
                <WallOrientationButton
                  orientation="vertical"
                  isActive={wallOrientation === 'vertical'}
                  onPress={() => {
                    setWallOrientation('vertical');
                    setStatusMessage(null);
                  }}
                  disabled={winner !== null}
                />
              </View>
              <ThemedText style={styles.wallsHint}>
                Walls this turn: {wallsRemaining[currentPlayer]}
              </ThemedText>
            </View>
          ) : null}
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

        {/*<Pressable*/}
        {/*  style={[styles.resetButton, { backgroundColor: Colors[colorScheme].tint }]}*/}
        {/*  onPress={startNewGame}>*/}
        {/*  <ThemedText*/}
        {/*    style={[*/}
        {/*      styles.resetButtonText,*/}
        {/*      { color: colorScheme === 'dark' ? '#151718' : '#fff' },*/}
        {/*    ]}>*/}
        {/*    Start a new game*/}
        {/*  </ThemedText>*/}
        {/*</Pressable>*/}

        {/*<ThemedText style={styles.footerNote}>*/}
        {/*  Every turn you must either step one space orthogonally or drop a wall segment. Walls cannot overlap or remove an*/}
        {/*  opponent&apos;s only route to their goal row.*/}
        {/*</ThemedText>*/}
        {/*<ThemedText style={styles.footerNote}>*/}
        {/*  Coordinates are shown as rows and columns to make it easy to discuss moves with a friend while you play.*/}
        {/*</ThemedText>*/}
      </ThemedView>
    </ScrollView>
  );
}

export default QuoridorGame;

const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    paddingBottom: 32,
  },
  container: {
    gap: 14,
    borderRadius: 20,
    padding: 10,
  },
  title: {
    textAlign: 'center',
  },
  lead: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  statusCard: {
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
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
  helperText: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  playerSummary: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  playerBadge: {
    width: 12,
    height: 46,
    borderRadius: 6,
  },
  playerSummaryText: {
    flex: 1,
    gap: 4,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  playerDetail: {
    fontSize: 14,
  },
  controlsSection: {
    gap: 12,
  },
  boardWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  wallControls: {
    gap: 12,
  },
  wallOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  wallOptionButton: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    gap: 12,
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
    borderRadius: 10,
    borderWidth: 1,
  },
  controlButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  wallsHint: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  resetButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
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
});