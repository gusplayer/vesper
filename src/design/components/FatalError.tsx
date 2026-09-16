import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { readDeviceLocales } from '../../i18n/device';
import { colors, layout, space } from '../tokens';
import { Text } from './Text';

type FatalErrorProps = {
  message: string;
};

type Copy = {
  title: string;
  advice: string;
};

/**
 * This screen renders before any store exists, so it cannot ask `useStrings()`. It
 * carries both languages and picks by the phone's first language: Spanish for `es*`,
 * English for everything else, the same fallback the app itself uses (ADR-0020).
 */
const COPY: Record<'es' | 'en', Copy> = {
  es: {
    title: 'algo se rompió al arrancar',
    advice: 'cierra la app y vuelve a abrirla. si sigue pasando, es un bug nuestro.',
  },
  en: {
    title: 'something broke on startup',
    advice: 'close the app and open it again. if it keeps happening, it is a bug on our side.',
  },
};

function deviceCopy(): Copy {
  const first = readDeviceLocales()[0];
  const language = (first?.languageCode ?? first?.languageTag ?? '').toLowerCase();
  return language.startsWith('es') ? COPY.es : COPY.en;
}

/**
 * The only screen that exists because something broke. Rendered outside the theme
 * provider, so it reads its colors straight from the light tokens.
 */
export function FatalError({ message }: FatalErrorProps) {
  const copy = deviceCopy();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.light.bg }]}>
      <View style={styles.page}>
        <Text variant="heading">{copy.title}</Text>
        <Text variant="body" tone="secondary">
          {message}
        </Text>
        <Text variant="label" tone="tertiary">
          {copy.advice}
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
