import { Pressable, StyleSheet, Text } from 'react-native';

import { color, font, radius, rule, space } from '../tokens';

type ChoiceCardProps = {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

/** An option that needs a sentence to be understood: depth levels, habit types. */
export function ChoiceCard({ title, description, selected, onPress }: ChoiceCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selected : styles.unselected,
        pressed ? styles.pressed : null,
      ]}
    >
      {({ pressed }) => (
        <>
          <Text
            style={[
              styles.title,
              selected ? styles.inkText : styles.mutedText,
              pressed ? styles.paperText : null,
            ]}
          >
            {title}
          </Text>
          <Text style={[styles.description, pressed ? styles.paperText : null]}>
            {description}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.md,
    borderRadius: radius.box,
    rowGap: space.xs,
  },
  selected: {
    borderWidth: rule.thick,
    borderColor: color.ink,
  },
  unselected: {
    borderWidth: rule.thin,
    borderColor: color.ink30,
  },
  title: {
    fontFamily: font.family.medium,
    fontSize: font.size.body,
  },
  inkText: {
    color: color.ink,
  },
  mutedText: {
    color: color.ink60,
  },
  description: {
    fontFamily: font.family.regular,
    fontSize: font.size.label,
    color: color.ink60,
  },
  /** Inverted while held — ADR-0011. */
  pressed: {
    backgroundColor: color.ink,
  },
  paperText: {
    color: color.paper,
  },
});
