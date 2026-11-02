export const colors = {
  // Outdoor-legible light paper-like base (won't wash out in direct sunlight)
  background: '#F9FAFB',
  surface: '#FFFFFF',
  surfaceElevated: '#F3F4F6',
  surfaceInput: '#FFFFFF',
  surfaceActive: '#E5E7EB',

  // Hairline borders
  border: '#E5E7EB',
  borderHighlight: '#D1D5DB',
  borderLight: '#E5E7EB',

  // Dark ink typography
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',

  // High-contrast primary action buttons
  accentLight: '#111827',
  accentDark: '#FFFFFF',

  // ONE dedicated orange accent reserved specifically for "needs attention"
  amber: '#D97706',
  amberMuted: '#FEF3C7',

  // Ground-truth server confirmation
  emerald: '#059669',
  emeraldMuted: '#D1FAE5',

  blue: '#2563EB',
  blueMuted: '#DBEAFE',
  red: '#DC2626',
  redMuted: '#FEE2E2',

  // Overlays
  overlay: 'rgba(17, 24, 39, 0.7)',
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
  xs: 3,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  h2: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  h3: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
    letterSpacing: 0.1,
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
  },
  micro: {
    fontSize: 10,
    fontWeight: '600' as const,
    lineHeight: 13,
  },
  mono: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
} as const;

export const hitTargets = {
  minTouchTarget: 48,
} as const;
