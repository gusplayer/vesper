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
  /** 'none' for values kept lowercase, like a handle. Defaults to the keyboard's sentences. */
  autoCapitalize?: 'none' | 'sentences' | 'words';
  /** Hard limit on what can be typed, for values with a fixed shape (an invite code). */
  maxLength?: number;
};

/** 'Nombre ........ Familia' — a label on the left and the input on the right, in a card. */
export function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
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
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          selectionColor={colors.accent}
          accessibilityLabel={label}
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
