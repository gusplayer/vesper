import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useChrome } from '../chrome';
import { useTheme } from '../theme';
import { font, layout, radius, space } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
};

/** A pill with a magnifier, a clear button while typing, and a cancel word beside it. */
export function SearchField({ value, onChangeText, placeholder }: SearchFieldProps) {
  const { colors } = useTheme();
  const { clear, cancel } = useChrome();
  const active = value.length > 0;
  return (
    <View style={styles.row}>
      <View style={[styles.pill, { backgroundColor: colors.cardMuted }]}>
        <Icon name="search" size="sm" tone="secondary" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={colors.accent}
          accessibilityLabel={placeholder}
          style={[styles.input, { color: colors.ink }]}
        />
        {active ? (
          <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={clear}>
            <Icon name="x-circle" size="sm" tone="secondary" />
          </Pressable>
        ) : null}
      </View>
      {active && cancel !== undefined ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityRole="button">
          <Text variant="body">{cancel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.md,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space.sm,
    minHeight: layout.touchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
  },
  input: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: font.size.body,
    paddingVertical: space.sm,
  },
});
