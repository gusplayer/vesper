import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { layout, space } from '../tokens';
import { IconCircle } from './IconCircle';
import { Text } from './Text';

type PageHeaderProps = {
  title?: string;
  onBack?: () => void;
  onClose?: () => void;
  /** Usually a plus. */
  right?: ReactNode;
};

/** Back (or close) on the left, a centered title, an optional action on the right. */
export function PageHeader({ title, onBack, onClose, right }: PageHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack !== undefined ? (
          <IconCircle name="chevron-left" onPress={onBack} accessibilityLabel="volver" />
        ) : onClose !== undefined ? (
          <IconCircle name="x" onPress={onClose} accessibilityLabel="cerrar" />
        ) : null}
      </View>
      <View style={styles.center}>
        {title === undefined ? null : (
          <Text variant="body" weight="medium" align="center">
            {title}
          </Text>
        )}
      </View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.touchTarget,
    marginBottom: space.sm,
  },
  side: {
    width: layout.touchTarget,
  },
  right: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
  },
});
