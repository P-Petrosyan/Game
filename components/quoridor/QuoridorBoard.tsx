import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { BOARD_SIZE, PlayerId, Position, Wall, positionKey } from './game-logic';

export type QuoridorBoardProps = {
  currentPlayer: PlayerId;
  positions: Record<PlayerId, Position>;
  walls: Wall[];
  validMoves: Position[];
  mode: 'move' | 'wall';
  availableWalls: Wall[];
  onCellPress: (position: Position) => void;
  onWallPress: (wall: Wall) => void;
};

const PAWN_LABEL: Record<PlayerId, string> = {
  north: 'N',
  south: 'S',
};

export function QuoridorBoard({
                                currentPlayer,
                                positions,
                                walls,
                                validMoves,
                                mode,
                                availableWalls,
                                onCellPress,
                                onWallPress,
                              }: QuoridorBoardProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 420);
  const wallThickness = Math.max(4, boardSize * 0.035);
  const cellSize = (boardSize - wallThickness * (BOARD_SIZE - 1)) / BOARD_SIZE;
  const wallIndicatorSize = Math.max(10, wallThickness * 0.75);

  const palette = useMemo(() => {
    if (colorScheme === 'dark') {
      return {
        board: '#1f1b16',
        cell: '#3a3128',
        grid: '#7a5b3f',
        wall: '#d7a86e',
        pawn: {
          north: '#9fc5ff',
          south: '#f39c96',
        },
        pawnOutline: '#ffffff',
        currentOutline: '#f1c40f',
        move: 'rgba(46, 204, 113, 0.75)',
        wallHint: 'rgba(241, 196, 15, 0.35)',
      } as const;
    }

    return {
      board: '#f5ede1',
      cell: '#fdf6e3',
      grid: '#c8a46d',
      wall: '#a8672d',
      pawn: {
        north: '#2c3e50',
        south: '#c0392b',
      },
      pawnOutline: '#ffffff',
      currentOutline: '#f39c12',
      move: 'rgba(26, 188, 156, 0.75)',
      wallHint: 'rgba(243, 156, 18, 0.3)',
    } as const;
  }, [colorScheme]);

  const validMoveKeys = useMemo(() => new Set(validMoves.map((move) => positionKey(move))), [validMoves]);

  const boardStyle = useMemo(
    () => [
      styles.board,
      {
        width: boardSize,
        height: boardSize,
        backgroundColor: palette.board,
        borderColor: palette.grid,
      },
    ],
    [boardSize, palette.board, palette.grid],
  );

  return (
    <View style={boardStyle}>
      {Array.from({ length: BOARD_SIZE }).map((_, row) =>
        Array.from({ length: BOARD_SIZE }).map((__, col) => {
          const position: Position = { row, col };
          const key = positionKey(position);
          let occupant: PlayerId | null = null;

          if (positions.north.row === row && positions.north.col === col) {
            occupant = 'north';
          } else if (positions.south.row === row && positions.south.col === col) {
            occupant = 'south';
          }

          const isCurrentPlayer = occupant === currentPlayer;
          const isValidMove = mode === 'move' && validMoveKeys.has(key) && !occupant;

          const left = col * (cellSize + wallThickness);
          const top = row * (cellSize + wallThickness);

          return (
            <Pressable
              key={key}
              disabled={mode !== 'move'}
              accessibilityLabel={`Square ${row + 1},${col + 1}`}
              onPress={() => onCellPress(position)}
              style={[
                styles.cell,
                {
                  left,
                  top,
                  width: cellSize,
                  height: cellSize,
                  borderRadius: cellSize * 0.18,
                  backgroundColor: palette.cell,
                  borderColor: isCurrentPlayer ? palette.currentOutline : palette.grid,
                  borderWidth: Math.max(1, cellSize * 0.04),
                },
              ]}>
              {isValidMove ? (
                <View
                  pointerEvents="none"
                  style={{
                    width: cellSize * 0.3,
                    height: cellSize * 0.3,
                    borderRadius: (cellSize * 0.3) / 2,
                    backgroundColor: palette.move,
                  }}
                />
              ) : null}
              {occupant ? (
                <View
                  pointerEvents="none"
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: cellSize * 0.68,
                    height: cellSize * 0.68,
                    borderRadius: (cellSize * 0.68) / 2,
                    backgroundColor: palette.pawn[occupant],
                    borderColor: isCurrentPlayer ? palette.currentOutline : palette.pawnOutline,
                    borderWidth: Math.max(2, cellSize * 0.08),
                  }}>
                  <ThemedText
                    type="defaultSemiBold"
                    style={{
                      color: colorScheme === 'dark' ? '#1c130a' : '#fff',
                      fontSize: cellSize * 0.32,
                    }}>
                    {PAWN_LABEL[occupant]}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        }),
      )}

      {walls.map((wall) => {
        const baseLeft = wall.col * (cellSize + wallThickness);
        const baseTop = wall.row * (cellSize + wallThickness);

        if (wall.orientation === 'horizontal') {
          return (
            <View
              key={`wall-h-${wall.row}-${wall.col}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: baseLeft,
                top: baseTop + cellSize,
                width: cellSize * 2 + wallThickness,
                height: wallThickness,
                backgroundColor: palette.wall,
                borderRadius: wallThickness / 2,
              }}
            />
          );
        }

        return (
          <View
            key={`wall-v-${wall.row}-${wall.col}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: baseLeft + cellSize,
              top: baseTop,
              width: wallThickness,
              height: cellSize * 2 + wallThickness,
              backgroundColor: palette.wall,
              borderRadius: wallThickness / 2,
            }}
          />
        );
      })}

      {mode === 'wall'
        ? availableWalls.map((wall) => {
          const baseLeft = wall.col * (cellSize + wallThickness);
          const baseTop = wall.row * (cellSize + wallThickness);
          const key = `available-${wall.orientation}-${wall.row}-${wall.col}`;

          if (wall.orientation === 'horizontal') {
            return (
              <Pressable
                key={key}
                accessibilityLabel={`Place horizontal wall at row ${wall.row + 1}, column ${wall.col + 1}`}
                onPress={() => onWallPress(wall)}
                style={{
                  position: 'absolute',
                  left: baseLeft,
                  top: baseTop + cellSize,
                  width: cellSize * 2 + wallThickness,
                  height: wallThickness,
                  borderRadius: wallThickness / 2,
                  backgroundColor: palette.wallHint,
                  borderWidth: 1,
                  borderColor: palette.wall,
                }}
              />
            );
          }

          return (
            <Pressable
              key={key}
              accessibilityLabel={`Place vertical wall at row ${wall.row + 1}, column ${wall.col + 1}`}
              onPress={() => onWallPress(wall)}
              style={{
                position: 'absolute',
                left: baseLeft + cellSize,
                top: baseTop,
                width: wallThickness,
                height: cellSize * 2 + wallThickness,
                borderRadius: wallThickness / 2,
                backgroundColor: palette.wallHint,
                borderWidth: 1,
                borderColor: palette.wall,
              }}
            />
          );
        })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  cell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
