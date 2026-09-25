import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type NoticeCardProps = {
  /** The one line that says what is going on: 'Aquí no hay notificaciones'. */
  title?: string;
  /** Why, or what to do: usually `status().reason`. */
  body?: string;
  icon?: IconName;
  /** A chevron (the whole card opens something) or a short badge ('5 restantes'). */
  trailing?: 'chevron' | { badge: string };
  /** The whole card is the way forward. Do not combine with `onAction`. */
  onPress?: () => void;
  /** A small action pill under the text ('Activar'), for a static card. */
  actionLabel?: string;
  onAction?: () => void;
  /** 'muted' for a notice that sits among cards and should not compete with them. */
  tone?: 'default' | 'muted';
  /** Defaults to title and body joined, when the card is pressable. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * A card that says one thing: a state that is not a list (unavailable, denied, gone,
 * full), a nudge that leads somewhere (create your profile), a warning (two routines
 * overlap). Title and body, an optional icon, and at most one way forward — the card
 * itself, or one action pill.
 */
export function NoticeCard({
  title,
  body,
  icon,
  trailing,
  onPress,
  actionLabel,
  onAction,
  tone = 'default',
  accessibilityLabel,
  accessibilityHint,
}: NoticeCardProps) {
  const spoken = accessibilityLabel ?? [title, body].filter(Boolean).join('. ');
  const badge = trailing !== undefined && trailing !== 'chevron' ? trailing.badge : null;
  return (
    <Card
      tone={tone}
      onPress={onPress}
      chevron={trailing === 'chevron'}
      accessibilityLabel={onPress === undefined ? undefined : spoken}
      accessibilityHint={accessibilityHint}
    >
      <View style={styles.row}>
        {icon === undefined ? null : <Icon name={icon} size="md" tone="secondary" />}
        <View style={styles.text}>
          {title === undefined ? null : (
            <Text variant="body" weight="medium">
              {title}
            </Text>
          )}
          {body === undefined ? null : (
            <Text variant="label" tone="secondary">
              {body}
            </Text>
          )}
          {actionLabel === undefined || onAction === undefined || onPress !== undefined ? null : (
            <View style={styles.action}>
              <Button label={actionLabel} onPress={onAction} variant="secondary" size="sm" />
            </View>
          )}
        </View>
        {badge === null ? null : <Badge label={badge} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: space.md,
  },
  text: {
    flex: 1,
    rowGap: space.xs,
  },
  action: {
    flexDirection: 'row',
    paddingTop: space.xs,
  },
});
