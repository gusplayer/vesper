import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '../theme';
import { font, type Colors } from '../tokens';

export type TextVariant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption';
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'onInk' | 'accent' | 'danger';

type TextProps = {
  children: React.ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: 'regular' | 'medium' | 'semibold';
  align?: 'left' | 'center' | 'right';
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: 'header' | 'text';
};

const DEFAULT_WEIGHT: Record<TextVariant, 'regular' | 'medium' | 'semibold'> = {
  hero: 'medium',
  title: 'medium',
  heading: 'medium',
  body: 'regular',
  label: 'regular',
  caption: 'regular',
};

function toneColor(colors: Colors, tone: TextTone): string {
  switch (tone) {
    case 'primary':
      return colors.ink;
    case 'secondary':
      return colors.inkSecondary;
    case 'tertiary':
      return colors.inkTertiary;
    case 'onInk':
      return colors.onInk;
    case 'accent':
      return colors.accent;
    case 'danger':
      return colors.danger;
  }
}

/** Every piece of text in the app. Variant sets size, tone sets color, weight is optional. */
export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  weight,
  align = 'left',
  numberOfLines,
  style,
  accessibilityRole,
}: TextProps) {
  const { colors } = useTheme();
  const resolvedWeight = weight ?? DEFAULT_WEIGHT[variant];
  return (
    <RNText
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
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
