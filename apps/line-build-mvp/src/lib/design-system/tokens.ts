/**
 * Design System Tokens
 * ====================
 *
 * Enterprise-grade "quiet confidence" aesthetic inspired by Linear, Notion, and Figma.
 *
 * These tokens form the foundation of our visual language. They are:
 * - Type-safe TypeScript constants
 * - Mapped to CSS custom properties in globals.css
 * - Consumed by Tailwind via tailwind.config.ts
 *
 * Philosophy:
 * - Neutral palette as the foundation (warm stone tones)
 * - Restrained use of color - let the content breathe
 * - Subtle shadows and borders for depth without distraction
 * - Professional typography with excellent readability
 */

// =============================================================================
// COLOR TOKENS
// =============================================================================

/**
 * Primary brand color - Indigo
 * Used for primary actions, links, and interactive elements.
 * The 600 shade is our anchor; lighter/darker for states.
 */
export const primaryColors = {
  50: '#eef2ff',
  100: '#e0e7ff',
  200: '#c7d2fe',
  300: '#a5b4fc',
  400: '#818cf8',
  500: '#6366f1',
  600: '#4f46e5', // Primary anchor
  700: '#4338ca',
  800: '#3730a3',
  900: '#312e81',
  950: '#1e1b4b',
} as const;

/**
 * Neutral palette - Warm Stone
 * The backbone of our UI. Warm undertones create a sophisticated,
 * approachable feel while maintaining excellent contrast ratios.
 */
export const neutralColors = {
  50: '#fafaf9',   // Backgrounds, cards
  100: '#f5f5f4',  // Subtle backgrounds, hover states
  200: '#e7e5e4',  // Borders, dividers
  300: '#d6d3d1',  // Disabled states, muted borders
  400: '#a8a29e',  // Placeholder text, icons
  500: '#78716c',  // Secondary text
  600: '#57534e',  // Body text (light mode)
  700: '#44403c',  // Headings (light mode)
  800: '#292524',  // Primary text (light mode)
  900: '#1c1917',  // High emphasis text
  950: '#0c0a09',  // Maximum contrast
} as const;

/**
 * Success colors - Emerald
 * For positive feedback, success states, and confirmations.
 */
export const successColors = {
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981', // Primary success
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#064e3b',
} as const;

/**
 * Warning colors - Amber
 * For cautionary messages, pending states, and attention-needed indicators.
 */
export const warningColors = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b', // Primary warning
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
} as const;

/**
 * Danger colors - Rose
 * For errors, destructive actions, and critical alerts.
 */
export const dangerColors = {
  50: '#fff1f2',
  100: '#ffe4e6',
  200: '#fecdd3',
  300: '#fda4af',
  400: '#fb7185',
  500: '#f43f5e', // Primary danger
  600: '#e11d48',
  700: '#be123c',
  800: '#9f1239',
  900: '#881337',
} as const;

/**
 * Accent colors
 * For visual variety in data visualization, tags, and decorative elements.
 * Use sparingly to maintain the "quiet confidence" aesthetic.
 */
export const accentColors = {
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
  },
  cyan: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
  },
  orange: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
    700: '#c2410c',
  },
} as const;

/**
 * Combined colors export
 */
export const colors = {
  primary: primaryColors,
  neutral: neutralColors,
  success: successColors,
  warning: warningColors,
  danger: dangerColors,
  accent: accentColors,
} as const;

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

/**
 * Font families
 * - Sans: Inter for UI text - excellent readability, professional feel
 * - Mono: JetBrains Mono for code - clear distinction between similar characters
 */
export const fontFamily = {
  sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
} as const;

/**
 * Font sizes with corresponding line heights
 * Designed for optimal readability at each size.
 */
export const fontSize = {
  xs: ['0.75rem', { lineHeight: '1rem' }],        // 12px - Fine print, labels
  sm: ['0.875rem', { lineHeight: '1.25rem' }],    // 14px - Secondary text, captions
  base: ['1rem', { lineHeight: '1.5rem' }],       // 16px - Body text
  lg: ['1.125rem', { lineHeight: '1.75rem' }],    // 18px - Large body text
  xl: ['1.25rem', { lineHeight: '1.75rem' }],     // 20px - Small headings
  '2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px - Section headings
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px - Page headings
  '4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px - Hero text
  '5xl': ['3rem', { lineHeight: '1' }],           // 48px - Display text
} as const;

/**
 * Font weights
 * Inter supports all these weights natively.
 */
export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

/**
 * Letter spacing (tracking)
 * Tighter tracking for headings, normal/wider for body text.
 */
export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

/**
 * Combined typography export
 */
export const typography = {
  fontFamily,
  fontSize,
  fontWeight,
  letterSpacing,
} as const;

// =============================================================================
// SPACING TOKENS
// =============================================================================

/**
 * Spacing scale
 * Based on a 4px base unit for consistent vertical rhythm.
 * Named keys for semantic use, numeric values in rem.
 */
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  7: '1.75rem',     // 28px
  8: '2rem',        // 32px
  9: '2.25rem',     // 36px
  10: '2.5rem',     // 40px
  11: '2.75rem',    // 44px
  12: '3rem',       // 48px
  14: '3.5rem',     // 56px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
  28: '7rem',       // 112px
  32: '8rem',       // 128px
  36: '9rem',       // 144px
  40: '10rem',      // 160px
  44: '11rem',      // 176px
  48: '12rem',      // 192px
  52: '13rem',      // 208px
  56: '14rem',      // 224px
  60: '15rem',      // 240px
  64: '16rem',      // 256px
  72: '18rem',      // 288px
  80: '20rem',      // 320px
  96: '24rem',      // 384px
} as const;

// =============================================================================
// BORDER RADIUS TOKENS
// =============================================================================

/**
 * Border radius scale
 * Subtle rounding for that modern, approachable feel.
 */
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px - Subtle rounding
  DEFAULT: '0.25rem', // 4px - Default for inputs, buttons
  md: '0.375rem',   // 6px - Medium components
  lg: '0.5rem',     // 8px - Cards, modals
  xl: '0.75rem',    // 12px - Large cards
  '2xl': '1rem',    // 16px - Hero sections
  '3xl': '1.5rem',  // 24px - Extra large
  full: '9999px',   // Circular
} as const;

// =============================================================================
// SHADOW TOKENS
// =============================================================================

/**
 * Box shadows
 * Subtle, layered shadows for depth without harshness.
 * Inspired by Linear's soft shadow aesthetic.
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  // Custom soft shadows for cards and elevated elements
  soft: '0 2px 8px -2px rgb(0 0 0 / 0.08), 0 4px 16px -4px rgb(0 0 0 / 0.12)',
  'soft-lg': '0 4px 16px -4px rgb(0 0 0 / 0.1), 0 8px 32px -8px rgb(0 0 0 / 0.15)',
} as const;

// =============================================================================
// ANIMATION / TRANSITION TOKENS
// =============================================================================

/**
 * Transition durations
 */
export const transitionDuration = {
  75: '75ms',
  100: '100ms',
  150: '150ms',
  200: '200ms',
  300: '300ms',
  500: '500ms',
  700: '700ms',
  1000: '1000ms',
} as const;

/**
 * Transition timing functions
 */
export const transitionTimingFunction = {
  DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

/**
 * Z-index scale
 * Semantic naming for stacking contexts.
 */
export const zIndex = {
  auto: 'auto',
  0: '0',
  10: '10',     // Base elevated elements
  20: '20',     // Dropdowns
  30: '30',     // Fixed elements
  40: '40',     // Modals
  50: '50',     // Tooltips, popovers
  60: '60',     // Toast notifications
  70: '70',     // Loading overlays
} as const;

// =============================================================================
// COMBINED TOKENS EXPORT
// =============================================================================

/**
 * All design tokens combined for easy import.
 *
 * Usage:
 * ```ts
 * import { tokens } from '@/lib/design-system/tokens';
 *
 * const style = {
 *   color: tokens.colors.primary[600],
 *   fontFamily: tokens.typography.fontFamily.sans,
 * };
 * ```
 */
export const tokens = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitionDuration,
  transitionTimingFunction,
  zIndex,
} as const;

// Type exports for TypeScript consumers
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Shadows = typeof shadows;
export type Tokens = typeof tokens;
