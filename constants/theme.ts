/**
 * Theme definitions for the Quoridor app.
 * The palette leans into warm wood tones inspired by the game's environments.
 */

import { Platform } from 'react-native';

export const Colors = {
  background: 'rgba(246, 233, 214, 0.76)',
  backgroundStrong: 'rgba(234, 214, 188, 0.9)',
  surface: 'rgba(247, 236, 220, 0.88)',
  surfaceMuted: 'rgba(232, 209, 177, 0.75)',
  overlay: 'rgba(246, 233, 214, 0.62)',
  overlayStrong: 'rgba(219, 196, 162, 0.65)',
  translucentDark: 'rgba(37, 23, 14, 0.35)',
  text: '#2d1b10',
  textMuted: 'rgba(45, 27, 16, 0.72)',
  heading: '#1c1209',
  accent: '#c97a33',
  accentStrong: '#9f5c1d',
  accentSoft: '#f1c27d',
  button: '#d9913d',
  buttonText: '#fff8ed',
  outline: 'rgba(112, 77, 42, 0.35)',
  badge: 'rgba(255, 247, 235, 0.55)',
  success: '#2f8f4e',
  danger: '#c04a3a',
  info: '#784421',
  board: {
    background: '#f5ede1',
    cell: '#fdf6e3',
    grid: '#c8a46d',
    wall: '#a8672d',
    pawnNorth: '#274971',
    pawnSouth: '#c16034',
    pawnOutline: '#ffffff',
    currentOutline: '#f0b04b',
    move: 'rgba(30, 142, 107, 0.7)',
    wallHint: 'rgba(240, 177, 74, 0.35)',
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
