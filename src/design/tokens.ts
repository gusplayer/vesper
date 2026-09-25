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
  /** Quieter text on top of `ink`: the second line of an ink card. */
  onInkSecondary: string;
  /** A switch that is off: one step darker than `line`, so the track reads on a card. */
  trackOff: string;
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
    /** Also the native splash color in app.json: the boot reveal starts from one seamless ink sheet (ADR-0028). */
    ink: '#1C1B1A',
    inkSecondary: '#66645F',
    /** Placeholders and hints only: ~2:1 on the page, never text that informs. */
    inkTertiary: '#A6A39E',
    line: '#DCD9D3',
    onInk: '#F8F7F5',
    onInkSecondary: '#A9A7A2',
    trackOff: '#C9C6C0',
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
    onInkSecondary: '#66645F',
    trackOff: '#4A4947',
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
  /** Letter spacing for the few words set in capitals: StatCard labels, the VESPER mark. */
  tracking: {
    caps: 1,
    mark: 2,
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
  /** Between two lines of the same block: a row's label and its description. */
  xxs: 2,
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
  /** The mark alone, as on the app icon: four by four cells at boot (ADR-0028). */
  mark: { cell: 26, gap: 6 },
  /**
   * Bars and tracks drawn with Views, since there is no chart library. `track` is the
   * thin progress bar, `row` one line of HorizontalBars, `column` how wide a BarChart
   * bar may get, and `min` keeps a nearly empty bar a mark instead of a gap. `label`
   * and `value` are the fixed columns on either side of a horizontal bar.
   */
  bar: { track: 6, row: 12, column: 28, min: 2, label: 32, value: 52 },
  /**
   * BarChart: the plot's height, the room above the tallest bar for the top guide's
   * label, the right gutter shared by guide text and the average pill, the width of a
   * label under a bar, the shortest bar that still reads as one, half the average
   * pill's height (so its line meets the pill's middle), the guide line's weight, and
   * how close a guide may sit to the average before its label hides under the pill.
   */
  chart: { height: 160, topRoom: 16, gutter: 52, labelWidth: 36, minBar: 3, pillHalf: 9, guide: 1, pillClearance: 28 },
  /** DotGrid: a cell and its gap when the grid does not fill, the dense gap, and the corner as a share of the side. */
  dotGrid: { size: 14, gap: 3, denseGap: 1, cornerRatio: 0.2 },
  /** A DayPicker circle; its hit area grows to `touchTarget`. */
  day: 40,
  /** The ink bar under the active tab. */
  tabIndicator: 3,
  /** The small round mark for "today" next to a caption. */
  todayDot: 6,
  /** A Sheet never covers more than this share of the window; past it, its content scrolls. */
  sheetMaxHeight: 0.85,
  /** The checkbox and radio: the square, its border, and the corner of the box form. */
  check: { size: 22, border: 1.5, radius: 6 },
  /** Onboarding pager dots: a dot, and the current one stretched into a short bar. */
  dot: { size: 6, active: 18 },
  /** The tooltip bubble: how wide it may get, and the triangle that points at the row. */
  tooltip: { maxWidth: 280, tail: 8 },
} as const;

/** Opacity roles. A disabled control fades as a whole, on top of its muted colors. */
export const opacity = {
  disabled: 0.4,
  /** A pressed control, for the frame the finger is on it. */
  pressed: 0.6,
  /** The dashed guide lines of a chart. */
  guide: 0.6,
  /** An empty cell of a DotGrid, so the shape of what is left still reads. */
  emptyCell: 0.35,
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
  /** The route fade, and the tab indicator crossfading from one word to the next. */
  fadeMs: 160,
  /** Holding the focus button: how long until it starts. */
  holdMs: 900,
  /** The ink flood from the button over the page, before the session route opens. */
  floodMs: 520,
  /**
   * Boot: the splash ink dissolves off the page until only the mark is left, the mark
   * stays for a beat, then one route fade into the app (ADR-0028).
   */
  revealMs: 680,
  revealHoldMs: 220,
  /** Stipple dissolves: distance between dots and how many opacity layers they fold into. */
  dissolve: { spacing: 9, layers: 24, buttonSpacing: 6, buttonLayers: 16 },
  /** The recent-days grid lighting up: each square waits and takes its own time within these. */
  lightDelayMaxMs: 1800,
  lightMinMs: 700,
  lightMaxMs: 1600,
  /** Today's square breathing, one way. Slow enough to be noticed, not watched. */
  breathMs: 2200,
  /** How long a Tooltip, or the HoldButton's "hold it" line, stays up. */
  tooltipMs: 2500,
} as const;
