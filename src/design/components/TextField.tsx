import { StyleSheet, TextInput, View } from 'react-native';

import { color, font, rule, space } from '../tokens';

type TextFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  keyboardType?: 'default' | 'number-pad';
  /** Fires when the field loses focus — the right moment to persist a draft. */
  onEndEditing?: () => void;
  accessibilityLabel?: string;
};

/** A rule with text on it. No box, no fill, no focus ring. */
export function TextField({
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  keyboardType = 'default',
  onEndEditing,
  accessibilityLabel,
}: TextFieldProps) {
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.ink30}
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        onEndEditing={onEndEditing}
        onBlur={onEndEditing}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        selectionColor={color.ink}
        style={styles.input}
      />
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily: font.family.regular,
    fontSize: font.size.body,
    color: color.ink,
    paddingVertical: space.sm,
    paddingHorizontal: 0,
  },
  rule: {
    height: rule.thin,
    backgroundColor: color.ink30,
  },
});
