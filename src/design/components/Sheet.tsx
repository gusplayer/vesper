import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { layout, radius, space } from '../tokens';
import { IconCircle } from './IconCircle';
import { Text } from './Text';

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** A bottom sheet: dimmed page, a rounded card rising from the bottom, a title and a close. */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="cerrar" />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.bgElevated, paddingBottom: insets.bottom + space.lg },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.spacer} />
          <Text variant="body" weight="medium" align="center" style={styles.title}>
            {title}
          </Text>
          <IconCircle name="x" onPress={onClose} accessibilityLabel="cerrar" />
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: layout.pageMargin,
    paddingTop: space.lg,
    rowGap: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    width: layout.touchTarget,
  },
  title: {
    flex: 1,
  },
});
