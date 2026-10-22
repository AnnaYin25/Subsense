// src/styles/common.ts
import { StyleSheet } from 'react-native';
import {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
  letterSpacing,
} from './tokens';

export const commonStyles = StyleSheet.create({
  /* =====================
   * Containers
   * ===================== */
  container: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  containerCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundLight,
  },

  /* =====================
   * Cards
   * ===================== */
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  cardLarge: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    ...shadows.md,
  },
  cardShadow: shadows.sm,

  /* =====================
   * Buttons
   * ===================== */
  buttonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.primaryShadow,
  },
  buttonSecondary: {
    backgroundColor: colors.slate100,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* =====================
   * Text
   * ===================== */
  textTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.black,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.extraWide,
  },
  textHeading: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.black,
    color: colors.textPrimary,
  },
  textBody: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  textSecondary: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  textMicro: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.black,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.extraWide,
  },

  /* =====================
   * Flex utilities
   * ===================== */
  flexRow: {
    flexDirection: 'row',
  },
  flexColumn: {
    flexDirection: 'column',
  },
  flexCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexBetween: {
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
