import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, space } from '../tokens';
import { Text } from './Text';

type FatalErrorProps = {
  message: string;
};

/**
 * The only screen that exists because something broke. Rendered outside the theme
 * provider, so it reads its colors straight from the light tokens.
 */
export function FatalError({ message }: FatalErrorProps) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.light.bg }]}>
      <View style={styles.page}>
        <Text variant="heading">algo se rompió al arrancar</Text>
        <Text variant="body" tone="secondary">
          {message}
        </Text>
        <Text variant="label" tone="tertiary">
          cierra la app y vuelve a abrirla. si sigue pasando, es un bug nuestro.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  page: {
    flex: 1,
    padding: layout.pageMargin,
    rowGap: space.lg,
    justifyContent: 'center',
  },
});
