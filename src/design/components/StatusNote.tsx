import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type StatusNoteProps = {
  text: string;
  /** 'danger' for a result that failed ('Ese código no existe'); secondary otherwise. */
  tone?: 'secondary' | 'danger';
  /** A small icon before the text: 'info' for a reason, 'alert-circle' for a warning. */
  icon?: IconName;
  align?: 'left' | 'center';
  /**
   * 'status' (default) is the small line under a control: a `status().reason`, a
   * result, a demo note. 'empty' is the "nothing here yet" line inside a section, one
   * size up so it reads as the section's content.
   */
  kind?: 'status' | 'empty';
  /** The line changes after an action (a result): announced when it does. */
  live?: boolean;
};

/**
 * The one small line that explains: why a capability is missing (rule 8), what an
 * action answered, why a list is empty. Placed right under the control or inside the
 * section it is about, never at the far end of the page.
 */
export function StatusNote({ text, tone = 'secondary', icon, align = 'left', kind = 'status', live = false }: StatusNoteProps) {
  const variant = kind === 'empty' ? 'label' : 'caption';
  if (icon === undefined) {
    return (
      <Text variant={variant} tone={tone} align={align} live={live}>
        {text}
      </Text>
    );
  }
  return (
    <View style={[styles.row, align === 'center' ? styles.center : null]}>
      <Icon name={icon} size="sm" tone={tone} />
      <View style={align === 'center' ? styles.shrink : styles.grow}>
        <Text variant={variant} tone={tone} align={align} live={live}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: space.xs,
  },
  center: {
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  // Centred, the text keeps its natural width but may still wrap: without shrinking, a
  // long line would push past the row by the icon's width.
  shrink: {
    flexShrink: 1,
  },
});
