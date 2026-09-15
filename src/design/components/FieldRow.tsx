import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '../theme';
import { font, layout, space } from '../tokens';
import { Card } from './Card';
import { Text } from './Text';

type FieldRowProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  keyboardType?: 'default' | 'number-pad';
  onEndEditing?: () => void;
  accessibilityLabel?: string;
};

/** 'Nombre ........ Familia' — a label on the left and the input on the right, in a card. */
export function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  keyboardType = 'default',
  onEndEditing,
  accessibilityLabel,
}: FieldRowProps) {
  const { colors } = useTheme();
  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.row}>
        <Text variant="body" tone="secondary">
          {label}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkTertiary}
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          onEndEditing={onEndEditing}
          selectionColor={colors.accent}
          accessibilityLabel={accessibilityLabel ?? label}
          textAlign="right"
          style={[styles.input, { color: colors.ink, fontFamily: font.family.medium }]}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.touchTarget + space.md,
    columnGap: space.md,
  },
  input: {
    flex: 1,
    fontSize: font.size.body,
    paddingVertical: space.sm,
  },
});
