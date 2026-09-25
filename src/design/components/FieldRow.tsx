import { StyleSheet, TextInput, View, type ReturnKeyTypeOptions } from 'react-native';

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
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'email-address';
  /**
   * What the system may fill in: 'email' offers the person's addresses, 'one-time-code'
   * the code that just arrived by mail or message. On iOS it sets the content type.
   */
  autoComplete?: 'email' | 'one-time-code' | 'off';
  /** 'none' for values kept lowercase, like a handle; 'characters' for a code. Defaults to the keyboard's sentences. */
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  /** Off for codes, handles and the exit sentence, which must be typed as they are. */
  autoCorrect?: boolean;
  spellCheck?: boolean;
  /** Hard limit on what can be typed, for values with a fixed shape (an invite code). */
  maxLength?: number;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  /**
   * A longer answer (the reason for leaving a session): the label goes above and the
   * input wraps over several lines.
   */
  multiline?: boolean;
  /** Read after the label by VoiceOver: what the field is for. */
  accessibilityHint?: string;
  editable?: boolean;
};

/** 'Nombre ........ Familia' — a label on the left and the input on the right, in a card. */
export function FieldRow({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus = false,
  keyboardType = 'default',
  autoComplete,
  autoCapitalize = 'sentences',
  autoCorrect,
  spellCheck,
  maxLength,
  returnKeyType,
  onSubmitEditing,
  multiline = false,
  accessibilityHint,
  editable,
}: FieldRowProps) {
  const { colors } = useTheme();
  const input = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.inkTertiary}
      autoFocus={autoFocus}
      keyboardType={keyboardType}
      autoComplete={autoComplete}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      maxLength={maxLength}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      multiline={multiline}
      editable={editable}
      selectionColor={colors.accent}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      textAlign={multiline ? 'left' : 'right'}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[
        multiline ? styles.multilineInput : styles.input,
        { color: colors.ink, fontFamily: multiline ? font.family.regular : font.family.medium },
      ]}
    />
  );

  if (multiline) {
    return (
      <Card>
        <View style={styles.stacked}>
          <Text variant="label" tone="secondary">
            {label}
          </Text>
          {input}
        </View>
      </Card>
    );
  }

  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.row}>
        <Text variant="body" tone="secondary">
          {label}
        </Text>
        {input}
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
  stacked: {
    rowGap: space.xs,
  },
  multilineInput: {
    fontSize: font.size.body,
    lineHeight: font.lineHeight.body,
    minHeight: layout.touchTarget * 2,
    paddingVertical: space.xs,
  },
});
