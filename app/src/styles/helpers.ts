import { StyleProp, ViewStyle, TextStyle, ImageStyle } from 'react-native';

/**
 * Safely compose multiple styles, filtering out falsy values
 *
 * @example
 * <View style={composeStyles(
 *   commonStyles.card,
 *   isActive && { backgroundColor: colors.primary },
 *   { margin: spacing.md }
 * )}>
 */
export const composeStyles = <T extends StyleProp<ViewStyle | TextStyle | ImageStyle>>(
  ...styles: (T | false | null | undefined)[]
): T => {
  return styles.filter(Boolean) as T;
};

/**
 * Create a style variant based on a condition
 *
 * @example
 * <View style={variant(isActive, styles.active, styles.inactive)}>
 */
export const variant = <T>(
  condition: boolean,
  trueStyle: T,
  falseStyle?: T
): T | undefined => {
  return condition ? trueStyle : falseStyle;
};

/**
 * Merge styles conditionally based on an object of conditions
 *
 * @example
 * <View style={mergeStyles(
 *   baseStyle,
 *   {
 *     [styles.active]: isActive,
 *     [styles.disabled]: isDisabled,
 *     [styles.error]: hasError,
 *   }
 * )}>
 */
export const mergeStyles = <T extends StyleProp<ViewStyle | TextStyle | ImageStyle>>(
  baseStyle: T,
  conditionalStyles: Record<string, boolean>
): T => {
  const activeStyles = Object.keys(conditionalStyles)
    .filter(key => conditionalStyles[key])
    .map(key => key as T);

  return [baseStyle, ...activeStyles] as T;
};
