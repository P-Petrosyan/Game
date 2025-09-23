import React from 'react';
import { View, StyleSheet, Pressable, PanResponder } from 'react-native';
import { ThemedText } from '@/components/themed-text';

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
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  wallsContainer: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
  },
  wallItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(104,102,102,0.92)',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedWallItem: {
    borderColor: '#f39c12',
    backgroundColor: 'rgba(243, 156, 18, 0.1)',
  },
  wall: {
    backgroundColor: '#8B4513',
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
  },
});