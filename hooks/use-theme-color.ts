/**
 * A lightweight color hook that pulls from the single app palette.
 */

import { Colors } from '@/constants/theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors,
) {
  return props.light ?? props.dark ?? Colors[colorName];
}
