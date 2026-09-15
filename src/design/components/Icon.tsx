import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { useTheme } from '../theme';
import { layout } from '../tokens';
import type { TextTone } from './Text';

export type IconName = ComponentProps<typeof Feather>['name'];

type IconProps = {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';
  tone?: TextTone;
};

/** Feather line icons, sized and toned from tokens. */
export function Icon({ name, size = 'md', tone = 'primary' }: IconProps) {
  const { colors } = useTheme();
  const color =
    tone === 'onInk'
      ? colors.onInk
      : tone === 'secondary'
        ? colors.inkSecondary
        : tone === 'tertiary'
          ? colors.inkTertiary
          : tone === 'accent'
            ? colors.accent
            : tone === 'danger'
              ? colors.danger
              : colors.ink;
  return <Feather name={name} size={layout.icon[size]} color={color} />;
}
