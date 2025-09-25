import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { NaturePalette } from '@/constants/theme';

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
import { WallPalette } from './WallPalette';

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
  north: 'North',
  south: 'South',
};

export function QuoridorGame() {
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

  const opponent = getOpponent(currentPlayer);

  const controlPalette = useMemo(
    () => ({
      base: NaturePalette.surfaceGlass,
      disabled: NaturePalette.highlight,
      accent: NaturePalette.buttonColor,
      text: NaturePalette.text,
      activeText: NaturePalette.buttonText,
      disabledText: NaturePalette.mutedText,
      border: NaturePalette.border,
    }),
    [],
  );

  const playerColors = useMemo(
    () => ({
      north: NaturePalette.boardNorth,
      south: NaturePalette.boardSouth,
    }),
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
    const previewColor = NaturePalette.accent;

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
            borderColor: isActive ? controlPalette.accent : controlPalette.border,
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

  const handleWallSelect = (orientation: Orientation) => {
    setWallOrientation(orientation);
    setStatusMessage(`Selected ${orientation} wall. Tap a highlighted area on the board to place it.`);
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
    if (winner || (mode !== 'wall' && mode !== 'drag')) {
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
          <ThemedText style={styles.helperText}>{helperMessage}</ThemedText>
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
            boardRef={boardRef}
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
            <ControlButton
              label="Drag walls"
              onPress={() => handleSelectMode('drag')}
              active={mode === 'drag'}
              disabled={winner !== null || !canCurrentPlayerPlaceWall}
            />
          </View>

          {mode === 'drag' && (
            <WallPalette
              wallsRemaining={wallsRemaining[currentPlayer]}
              onWallSelect={handleWallSelect}
              selectedOrientation={wallOrientation}
              disabled={winner !== null}
            />
          )}
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
          {mode === 'drag' && (
            <ThemedText style={styles.wallsHint}>
              Select a wall type below, then tap a highlighted area on the board to place it
            </ThemedText>
          )}
        </View>

      </ThemedView>
    </ScrollView>
  );
}

export default QuoridorGame;

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
  title: {
    textAlign: 'center',
  },
  lead: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: NaturePalette.mutedText,
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
  helperText: {
    fontSize: 15,
    lineHeight: 22,
    color: NaturePalette.mutedText,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  playerSummary: {
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
    color: NaturePalette.mutedText,
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
    gap: 8,
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
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
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
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NaturePalette.border,
    shadowColor: NaturePalette.focus,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  controlButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  wallsHint: {
    fontSize: 14,
    fontStyle: 'italic',
    color: NaturePalette.mutedText,
  },
});