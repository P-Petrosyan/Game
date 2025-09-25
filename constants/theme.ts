import { Platform } from 'react-native';

const palette = {
  text: '#214235',
  mutedText: 'rgba(33, 66, 53, 0.72)',
  heading: '#16382A',
  background: '#F2F6F3',
  overlay: 'rgba(18, 49, 35, 0.32)',
  surface: 'rgba(255, 255, 255, 0.86)',
  surfaceAlt: 'rgba(232, 243, 236, 0.82)',
  surfaceStrong: 'rgba(210, 229, 219, 0.9)',
  surfaceGlass: 'rgba(250, 255, 252, 0.82)',
  surfaceGlassAlt: 'rgba(230, 244, 236, 0.78)',
  tint: '#6FAF94',
  accent: '#4F9374',
  accentSoft: '#86C1A4',
  icon: '#4F9374',
  tabIconDefault: 'rgba(79, 147, 116, 0.55)',
  tabIconSelected: '#6FAF94',
  buttonColor: '#4F9374',
  buttonText: '#F6FBF8',
  border: 'rgba(79, 147, 116, 0.32)',
  borderStrong: 'rgba(79, 147, 116, 0.5)',
  backgroundOpacity: 'rgba(255, 255, 255, 0.72)',
  highlight: 'rgba(111, 175, 148, 0.24)',
  success: '#3E8C68',
  successSurface: 'rgba(62, 140, 104, 0.16)',
  destructive: '#C36D6D',
  destructiveSurface: 'rgba(195, 109, 109, 0.18)',
  placeholder: 'rgba(33, 66, 53, 0.48)',
  focus: 'rgba(79, 147, 116, 0.4)',
  boardNorth: '#4F9374',
  boardSouth: '#C98C5C',
  boardWall: '#B88A63',
  boardMove: 'rgba(111, 175, 148, 0.34)',
  boardHint: 'rgba(111, 175, 148, 0.24)',
  boardDragHint: 'rgba(240, 203, 116, 0.45)',
} as const;

export type ThemeColors = typeof palette;

export const Colors: { light: ThemeColors; dark: ThemeColors } = {
  light: palette,
  dark: palette,
};

export const NaturePalette = palette;

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
