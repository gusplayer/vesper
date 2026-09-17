/**
 * Design tokens. The one place a color, size, radius or shadow is written down.
 * Components read them through `useTheme()`; screens never import this file.
 *
 * Two schemes: light is the page, dark is the active session (ADR-0016). Both are
 * warm greys, never pure black or white.
 */

export type Scheme = 'light' | 'dark';

export type Colors = {
  /** Page background. */
  bg: string;
  /** Slightly lifted areas: tab bar, sheets. */
  bgElevated: string;
  /** Cards. */
  card: string;
  /** A card inside a card, chips, inactive segments. */
  cardMuted: string;
  /** Primary text and the primary button. */
  ink: string;
  inkSecondary: string;
  inkTertiary: string;
  /** Hairlines between rows. */
  line: string;
  /** Text on top of `ink`. */
  onInk: string;
  /** Toggles and links. The only saturated color. */
  accent: string;
  /** The check on the active mode. */
  success: string;
  /** Destructive text actions. */
  danger: string;
  /** Shadow color for cards and the hero object. */
  shadow: string;
  /** The dimmed page behind a sheet. Ink with alpha, never pure black. */
  scrim: string;
};

export const colors: Record<Scheme, Colors> = {
  light: {
    bg: '#E8E6E2',
    bgElevated: '#EEECE8',
    card: '#F8F7F5',
    cardMuted: '#E3E1DC',
    ink: '#1C1B1A',
    inkSecondary: '#66645F',
    /** Placeholders and hints only: ~2:1 on the page, never text that informs. */
    inkTertiary: '#A6A39E',
    line: '#DCD9D3',
    onInk: '#F8F7F5',
    accent: '#2F7BF6',
    success: '#3B7A4A',
    danger: '#C0392B',
    shadow: '#1C1B1A',
    scrim: 'rgba(28, 27, 26, 0.45)',
  },
  dark: {
    bg: '#191919',
    bgElevated: '#202020',
    card: '#262626',
    cardMuted: '#303030',
    ink: '#F2F1EE',
    inkSecondary: '#A9A7A2',
    inkTertiary: '#6F6D69',
    line: '#343434',
    onInk: '#191919',
    accent: '#3B84F5',
    success: '#5FA46F',
    danger: '#E06B5E',
    shadow: '#191919',
    scrim: 'rgba(25, 25, 25, 0.6)',
  },
};

/** Outfit, a geometric sans. Three weights, addressed by family name per weight. */
export const font = {
  family: {
    regular: 'Outfit_400Regular',
    medium: 'Outfit_500Medium',
    semibold: 'Outfit_600SemiBold',
  },
  size: {
    /** The counter during a session, the big stat. */
    hero: 44,
    /** Onboarding and page titles. */
    title: 30,
    /** Section titles, the mode name on the home page. */
    heading: 22,
    body: 16,
    label: 14,
    caption: 12,
  },
  lineHeight: {
    hero: 50,
    title: 36,
    heading: 28,
    body: 22,
    label: 20,
    caption: 16,
  },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const layout = {
  pageMargin: 20,
  touchTarget: 44,
  tabBarHeight: 56,
  /** Feather icon sizes. `row` is the list-row icon: lighter than text next to it. */
  icon: { sm: 16, md: 20, lg: 24, row: 18 },
  /** The centered object on the home page. */
  hero: 132,
  appIcon: { sm: 24, md: 40, lg: 56 },
  /** The invite QR code, quiet zone included. */
  qr: 168,
} as const;

/** Soft, wide shadows. iOS reads them; Android gets `elevation`. */
export const shadow = {
  card: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  hero: {
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;

/** Transitions are short. Nothing bounces. */
export const motion = {
  fadeMs: 160,
  /** The tab indicator and anything that slides into place. */
  slideMs: 220,
  /** Holding the focus button: how long until it starts. */
  holdMs: 900,
  /** The ink flood from the button over the page, before the session route opens. */
  floodMs: 520,
  /** Stipple dissolves: distance between dots and how many opacity layers they fold into. */
  dissolve: { spacing: 9, layers: 24, buttonSpacing: 6, buttonLayers: 16 },
  /** The recent-days grid lighting up: each square waits and takes its own time within these. */
  lightDelayMaxMs: 1800,
  lightMinMs: 700,
  lightMaxMs: 1600,
  /** Today's square breathing, one way. Slow enough to be noticed, not watched. */
  breathMs: 2200,
} as const;
