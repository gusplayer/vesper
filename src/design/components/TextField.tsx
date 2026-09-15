import { useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { color, font, rule, space } from '../tokens';

type TextFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  keyboardType?: 'default' | 'number-pad';
  /**
   * Fires once when an editing pass ends — the right moment to persist a draft.
   * iOS and Android disagree on whether that is a blur or an end-editing event, and
   * often send both, so the field listens to both and reports once.
   */
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
  const editing = useRef(false);

  function settle(): void {
    if (editing.current) {
      editing.current = false;
      onEndEditing?.();
    }
  }

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.ink60}
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        onFocus={() => {
          editing.current = true;
        }}
        onEndEditing={settle}
        onBlur={settle}
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
