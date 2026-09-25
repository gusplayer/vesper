import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChrome } from '../chrome';
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

/**
 * A bottom sheet: dimmed page, a rounded card rising from the bottom, a title and a
 * close. It never covers more than `layout.sheetMaxHeight` of the window; longer
 * content (every mode, every country) scrolls inside it.
 *
 * A field inside it (the session's intention) raises the whole sheet above the
 * keyboard on its own: the backdrop gives up the room, and if the sheet no longer
 * fits it shrinks and its content scrolls. Sheets without fields never see a
 * keyboard, so nothing changes for them. Both platforms: an edge-to-edge Android
 * modal is not resized for the keyboard (seen on Android 14), so the view makes the
 * room itself, as `Screen` does.
 */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const { colors } = useTheme();
  const { close } = useChrome();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.frame} behavior="padding">
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.scrim }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={close}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.bgElevated,
              paddingBottom: insets.bottom + space.lg,
              maxHeight: (height - insets.top) * layout.sheetMaxHeight,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.spacer} />
            <Text variant="body" weight="medium" align="center" style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <IconCircle name="x" onPress={onClose} accessibilityLabel={close} />
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            overScrollMode="never"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    // With the keyboard up the frame can be shorter than the sheet: it shrinks, the
    // scroll inside takes the difference, and the title never goes off the top.
    flexShrink: 1,
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
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  content: {
    rowGap: space.lg,
  },
});
