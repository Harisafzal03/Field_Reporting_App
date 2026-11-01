export const colors = {
  // Pure monochrome base
  background: '#09090B',
  surface: '#121214',
  surfaceElevated: '#18181B',
  surfaceInput: '#0E0E10',
  surfaceActive: '#27272A',
  
  // High-precision hairline borders
  border: '#27272A',
  borderHighlight: '#3F3F46',
  borderLight: '#52525B',

  // Monochromatic typography
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textInverse: '#09090B',

  // High-contrast monochrome buttons & chips
  accentLight: '#FFFFFF',
  accentDark: '#09090B',

  // Minimal functional accents (used strictly for status clarity)
  amber: '#EAB308',
  amberMuted: 'rgba(234, 179, 8, 0.12)',
  emerald: '#22C55E',
  emeraldMuted: 'rgba(34, 197, 94, 0.12)',
  blue: '#3B82F6',
  blueMuted: 'rgba(59, 130, 246, 0.12)',
  red: '#EF4444',
  redMuted: 'rgba(239, 68, 68, 0.12)',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.85)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    letterSpacing: 0.5,
  },
  h2: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  h3: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 19,
  },
  bodySemibold: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 19,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  micro: {
    fontSize: 10,
    fontWeight: '700' as const,
    lineHeight: 13,
    letterSpacing: 0.8,
  },
  mono: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
} as const;

export const hitTargets = {
  minTouchTarget: 48,
} as const;
