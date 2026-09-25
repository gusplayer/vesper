import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { useTheme } from '../theme';
import { layout } from '../tokens';
import { toneColor, type TextTone } from './Text';

export type IconName = ComponentProps<typeof Feather>['name'];

type IconProps = {
  name: IconName;
  size?: 'sm' | 'md' | 'lg' | 'row';
  tone?: TextTone;
};

/** Feather line icons, sized and toned from tokens. */
export function Icon({ name, size = 'md', tone = 'primary' }: IconProps) {
  const { colors } = useTheme();
  // Decorative: the text beside it carries the meaning for VoiceOver.
  return (
    <Feather
      name={name}
      size={layout.icon[size]}
      color={toneColor(colors, tone)}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
