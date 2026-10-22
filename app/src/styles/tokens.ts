// src/styles/tokens.ts
// 从 FRONTEND_GUIDELINES.md 提取的设计 tokens

export const colors = {
    // Primary (Blue for financial/subscription management)
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    primaryLight: '#93C5FD',
    
    // Backgrounds
    backgroundLight: '#F9FAFB',
    backgroundDark: '#111827',
    surfaceDark: '#1F2937',
    
    // Semantic
    danger: '#EF4444',
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',

    // Additional Colors
    purple: '#8B5CF6',
    teal: '#14B8A6',

    // Grays (flat structure for backward compatibility)
    gray50: '#F9FAFB',
    gray100: '#F3F4F6',
    gray200: '#E5E7EB',
    gray400: '#9CA3AF',
    gray500: '#6B7280',
    gray700: '#374151',
    gray800: '#1F2937',
    gray900: '#111827',

    // Grays (object structure for convenience)
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      400: '#9CA3AF',
      500: '#6B7280',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    
    // Slate
    slate50: '#F8FAFC',
    slate100: '#F1F5F9',
    slate200: '#E2E8F0',
    slate400: '#94A3B8',
    slate800: '#1E293B',
    slate900: '#0F172A',
    
    // Text
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',

    // Basic colors
    white: '#FFFFFF',
    black: '#000000',
  };
  
  export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
    xxxl: 48,
  };
  
  export const borderRadius = {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
    full: 9999,
  };
  
  export const fontSize = {
    // Ultra-micro
    xxs: 9,
    // Micro
    xs: 10,
    // Small
    sm: 12,
    // Base
    base: 16,
    // Medium
    md: 18,
    // Large
    lg: 20,
    xl: 24,
    xxl: 28,
    xxxl: 36,
    xxxxl: 48,
  };
  
  export const fontWeight = {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  };
  
  export const shadows = {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.15,
      shadowRadius: 15,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.2,
      shadowRadius: 25,
      elevation: 12,
    },
    // Primary colored shadow
    primaryShadow: {
      shadowColor: '#3B82F6',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 10,
    },
  };
  
  export const letterSpacing = {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
    extraWide: 3.2, // 0.2em for uppercase labels
  };