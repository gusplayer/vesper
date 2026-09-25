import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '../theme';
import { font, type Colors } from '../tokens';

export type TextVariant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption';
export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'onInk'
  | 'onInkSecondary'
  | 'accent'
  | 'danger';

type TextProps = {
  children: React.ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: 'regular' | 'medium' | 'semibold';
  align?: 'left' | 'center' | 'right';
  style?: StyleProp<TextStyle>;
  /** `title` is a heading by default; pass 'text' to opt out. */
  accessibilityRole?: 'header' | 'text';
  /** A glyph that only decorates (a dot, a colon): VoiceOver skips it. */
  decorative?: boolean;
  /** Clip instead of wrapping: chart labels, values in tight rows. */
  numberOfLines?: number;
  /**
   * The text changes on its own and the change matters (a phase word, a result line):
   * Android reads it as a polite live region, iOS announces each new value.
   */
  live?: boolean;
  /** A long press selects and copies it: a code, a key. */
  selectable?: boolean;
};

const DEFAULT_WEIGHT: Record<TextVariant, 'regular' | 'medium' | 'semibold'> = {
  hero: 'medium',
  title: 'medium',
  heading: 'medium',
  body: 'regular',
  label: 'regular',
  caption: 'regular',
};

export function toneColor(colors: Colors, tone: TextTone): string {
  switch (tone) {
    case 'primary':
      return colors.ink;
    case 'secondary':
      return colors.inkSecondary;
    case 'tertiary':
      return colors.inkTertiary;
    case 'onInk':
      return colors.onInk;
    case 'onInkSecondary':
      return colors.onInkSecondary;
    case 'accent':
      return colors.accent;
    case 'danger':
      return colors.danger;
  }
}

/** The words of `children` when they are plain text, for the iOS announcement. */
function spokenText(children: React.ReactNode): string | null {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children) && children.every((child) => typeof child === 'string' || typeof child === 'number')) {
    return children.join('');
  }
  return null;
}

/** Every piece of text in the app. Variant sets size, tone sets color, weight is optional. */
export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  weight,
  align = 'left',
  style,
  accessibilityRole,
  decorative = false,
  numberOfLines,
  live = false,
  selectable,
}: TextProps) {
  const { colors } = useTheme();
  const resolvedWeight = weight ?? DEFAULT_WEIGHT[variant];
  const role = accessibilityRole ?? (variant === 'title' ? 'header' : undefined);

  // iOS has no live regions: say each new value once it is on screen. The first
  // render is not announced; the screen reader reads it with the page.
  const spoken = live ? spokenText(children) : null;
  const previous = useRef(spoken);
  useEffect(() => {
    if (!live || Platform.OS !== 'ios' || spoken === null || spoken === '' || spoken === previous.current) {
      previous.current = spoken;
      return;
    }
    previous.current = spoken;
    AccessibilityInfo.announceForAccessibility(spoken);
  }, [live, spoken]);

  return (
    <RNText
      accessibilityRole={role}
      numberOfLines={numberOfLines}
      accessible={decorative ? false : undefined}
      importantForAccessibility={decorative ? 'no' : undefined}
      accessibilityLiveRegion={live ? 'polite' : undefined}
      selectable={selectable}
      // Big type is welcome on titles; captions and labels stop at 1.6× so fixed
      // layouts (the grid, the tab bar) survive the largest accessibility sizes.
      maxFontSizeMultiplier={variant === 'caption' || variant === 'label' ? 1.6 : 2}
      style={[
        {
          fontFamily: font.family[resolvedWeight],
          fontSize: font.size[variant],
          lineHeight: font.lineHeight[variant],
          color: toneColor(colors, tone),
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
