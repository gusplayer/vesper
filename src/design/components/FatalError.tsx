import { StyleSheet, Text, View } from 'react-native';

import { color, font, layout, space } from '../tokens';

type FatalErrorProps = {
  message: string;
};

/**
 * The only screen that exists because something broke. In a local-first app the
 * database is the product, so a failure to open it has to say so in the app's own voice
 * instead of a red box.
 */
export function FatalError({ message }: FatalErrorProps) {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>algo se rompió</Text>
      <Text style={styles.body}>
        no se pudo abrir la base de datos, así que la app no puede funcionar. cerrala y
        volvé a abrirla. si sigue así, reinstalarla arregla el problema y borra los datos
        locales.
      </Text>
      <Text style={styles.detail}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: color.paper,
    paddingHorizontal: layout.pageMargin,
    justifyContent: 'center',
    rowGap: space.md,
  },
  title: {
    fontFamily: font.family.medium,
    fontSize: font.size.title,
    color: color.ink,
  },
  body: {
    fontFamily: font.family.regular,
    fontSize: font.size.body,
    color: color.ink,
  },
  detail: {
    fontFamily: font.family.regular,
    fontSize: font.size.caption,
    color: color.ink60,
  },
});
