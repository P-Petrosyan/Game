/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, NaturePalette } from '@/constants/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light
) {
  const colorFromProps = props.light ?? props.dark;

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return NaturePalette[colorName];
  }
}
