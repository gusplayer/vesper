/**
 * Design tokens. Values come from docs/DESIGN_SYSTEM.md — do not invent new ones here.
 *
 * These are the only place literal colors and sizes are allowed to exist. Screens in
 * src/app/ must not import this module: layout belongs to design/components/.
 */

/** Four tones. There is no fifth. Never #000000 or #FFFFFF. */
export const color = {
  /** Primary text, thick rules, filled boxes. */
  ink: '#1B1A18',
  /** Labels, secondary text. ~4.8:1 on paper — only for 12px and up. */
  ink60: '#6E6C66',
  /** Thin rules and empty boxes. Never carries text. */
  ink30: '#C9C6BE',
  /** Background. Slightly warm on purpose. Do not cool it down. */
  paper: '#F2F0EA',
} as const;

/**
 * Serif everywhere. In React Native a custom font is addressed by family name per
 * weight, not by numeric weight, so the two loaded faces are named here.
 */
export const font = {
  family: {
    regular: 'Literata_400Regular',
    medium: 'Literata_500Medium',
  },
  size: {
    /** Session duration, weeks remaining. */
    display: 44,
    /** Session timer only. */
    timer: 50,
    title: 26,
    body: 15,
    label: 12,
    caption: 10,
  },
  /** Hierarchy comes from size and tone, never from weight. Two weights only. */
  letterSpacing: {
    display: -1,
    timer: -2,
    normal: 0,
  },
} as const;

export const space = { xs: 4, sm: 8, md: 14, lg: 18, xl: 24 } as const;

/** Max 4px. Rounder corners are iOS language, not paper. */
export const radius = { box: 4 } as const;

export const rule = { thick: 1, thin: 0.5, progress: 3 } as const;

export const layout = {
  /** Side margins. Vertical margins are generous, like a page. */
  pageMargin: 16,
  /** Minimum tappable height for anything that responds — ADR-0011. */
  touchTarget: 44,
} as const;
