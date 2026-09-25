import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useChrome } from '../chrome';
import { layout } from '../tokens';
import { IconCircle } from './IconCircle';
import { ProgressDots } from './ProgressDots';
import { Text } from './Text';

type PageHeaderProps = {
  title?: string;
  /** A chevron: every pushed route. */
  onBack?: () => void;
  /** An x: only a route entered from outside the app (circle/join). */
  onClose?: () => void;
  /** Usually a plus. */
  right?: ReactNode;
  /**
   * Where a flow is ('paso 2 de 7'), drawn as dots in the centre when there is no
   * title. The label is what VoiceOver reads, supplied by the screen.
   */
  progress?: { count: number; index: number; accessibilityLabel: string };
};

/** Back (or close) on the left, a centered title, an optional action on the right. */
export function PageHeader({ title, onBack, onClose, right, progress }: PageHeaderProps) {
  const { back, close } = useChrome();
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack !== undefined ? (
          <IconCircle name="chevron-left" onPress={onBack} accessibilityLabel={back} />
        ) : onClose !== undefined ? (
          <IconCircle name="x" onPress={onClose} accessibilityLabel={close} />
        ) : null}
      </View>
      <View style={styles.center}>
        {title !== undefined ? (
          <Text variant="body" weight="medium" align="center" accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
        ) : progress !== undefined ? (
          <ProgressDots count={progress.count} index={progress.index} accessibilityLabel={progress.accessibilityLabel} />
        ) : null}
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
