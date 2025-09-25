import { StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { NaturePalette } from '@/constants/theme';

export default function RulesScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: NaturePalette.surfaceGlass, dark: NaturePalette.surfaceGlass }}
      headerImage={
        <IconSymbol
          size={260}
          name="gamecontroller.fill"
          color={NaturePalette.accentSoft}
          style={styles.headerIcon}
        />
      }>
      <ThemedView style={styles.titleRow}>
        <ThemedText type="title">How to play Quoridor</ThemedText>
      </ThemedView>
      <ThemedText style={styles.intro}>
        Two players race across a 9×9 grid while dropping fences to redirect their rival. The tabs below recap the official
        rules and share tips for planning your turns on mobile.
      </ThemedText>

      <Collapsible title="Objective">
        <ThemedText style={styles.paragraph}>
          Your pawn begins on the row closest to you. Reach the opposite edge of the board before your opponent does. Pawns can
          never be removed from the board, so the finish line is always reachable.
        </ThemedText>
      </Collapsible>

      <Collapsible title="Moving your pawn">
        <ThemedView style={styles.list}>
          <ThemedText style={styles.paragraph}>• Move one space north, south, east or west if no wall blocks the path.</ThemedText>
          <ThemedText style={styles.paragraph}>
            • When standing next to the opponent you may jump straight over them if the square behind them is free of walls.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • If the jump is blocked, sidestep diagonally to either open square beside the opposing pawn instead.
          </ThemedText>
        </ThemedView>
      </Collapsible>

      <Collapsible title="Placing walls">
        <ThemedView style={styles.list}>
          <ThemedText style={styles.paragraph}>• Each player starts with ten walls. Dropping a wall counts as your entire turn.</ThemedText>
          <ThemedText style={styles.paragraph}>• Walls span two spaces and must sit in an empty groove between four squares.</ThemedText>
          <ThemedText style={styles.paragraph}>
            • You cannot overlap an existing wall, cross through the middle of one, or seal off the final path to any goal row.
          </ThemedText>
        </ThemedView>
      </Collapsible>

      <Collapsible title="Strategy warm‑ups">
        <ThemedView style={styles.list}>
          <ThemedText style={styles.paragraph}>• Advance quickly through the centre to keep your options open.</ThemedText>
          <ThemedText style={styles.paragraph}>
            • When you place a wall, leave yourself at least two routes so you can pivot if your opponent blocks one.
          </ThemedText>
          <ThemedText style={styles.paragraph}>
            • Counting the number of steps to each goal row helps you decide when a wall buys more tempo than a pawn move.
          </ThemedText>
        </ThemedView>
      </Collapsible>

      <Collapsible title="Play on this screen">
        <ThemedText style={styles.paragraph}>
          The Home tab hosts an interactive board. Switch between “Move pawn” and “Place wall” to highlight legal actions, tap a
          target, and the app will track turns, remaining fences, and victory automatically.
        </ThemedText>
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerIcon: {
    position: 'absolute',
    bottom: -40,
    right: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  intro: {
    marginBottom: 12,
    lineHeight: 22,
  },
  list: {
    gap: 8,
  },
  paragraph: {
    lineHeight: 22,
  },
});
