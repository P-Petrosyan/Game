import * as Haptics from 'expo-haptics';

class SoundManager {
  private isEnabled = true;

  async loadSounds() {
    // No loading needed for haptics
  }

  async playPawnMove() {
    if (!this.isEnabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn('Failed to play pawn move haptic:', error);
    }
  }

  async playWallPlace() {
    if (!this.isEnabled) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn('Failed to play wall place haptic:', error);
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  async cleanup() {
    // No cleanup needed for haptics
  }
}

export const soundManager = new SoundManager();