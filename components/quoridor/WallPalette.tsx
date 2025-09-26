import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

import { Orientation } from './game-logic';

type WallPaletteProps = {
  wallsRemaining: number;
  onWallSelect: (orientation: Orientation) => void;
  selectedOrientation?: Orientation;
  disabled?: boolean;
};

export function WallPalette({ wallsRemaining, onWallSelect, selectedOrientation, disabled }: WallPaletteProps) {
  if (wallsRemaining <= 0 || disabled) {
    return null;
  }

  return (
    <View style={styles.palette}>
      <ThemedText style={styles.title}>Drag & Drop Walls ({wallsRemaining} remaining)</ThemedText>
      <View style={styles.wallsContainer}>
        <Pressable 
          style={[
            styles.wallItem, 
            selectedOrientation === 'horizontal' && styles.selectedWallItem
          ]}
          onPress={() => onWallSelect('horizontal')}
        >
          <View style={[styles.wall, styles.horizontalWall]} />
          <ThemedText style={styles.wallLabel}>Horizontal</ThemedText>
        </Pressable>
        
        <Pressable 
          style={[
            styles.wallItem,
            selectedOrientation === 'vertical' && styles.selectedWallItem
          ]}
          onPress={() => onWallSelect('vertical')}
        >
          <View style={[styles.wall, styles.verticalWall]} />
          <ThemedText style={styles.wallLabel}>Vertical</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  palette: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: Colors.heading,
  },
  wallsContainer: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
  },
  wallItem: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.outline,
    shadowColor: Colors.translucentDark,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
  },
  selectedWallItem: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentSoft,
  },
  wall: {
    backgroundColor: Colors.board.wall,
    borderRadius: 2,
  },
  horizontalWall: {
    width: 40,
    height: 8,
  },
  verticalWall: {
    width: 8,
    height: 40,
  },
  wallLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.heading,
  },
});