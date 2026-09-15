import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { IconCircle } from './IconCircle';
import type { IconName } from './Icon';
import { Text } from './Text';

type ExplainerBlockProps = {
  icon: IconName;
  heading: string;
  body: string;
};

/**
 * An icon in a circle, a short heading and a paragraph beside it. Permission pages
 * stack three of these to say what is asked, how it is used and why it matters.
 */
export function ExplainerBlock({ icon, heading, body }: ExplainerBlockProps) {
  return (
    <View style={styles.row}>
      <IconCircle name={icon} tone="card" />
      <View style={styles.text}>
        <Text variant="body" weight="medium">
          {heading}
        </Text>
        <Text variant="label" tone="secondary">
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: space.lg,
  },
  text: {
    flex: 1,
    rowGap: space.xs,
  },
});
