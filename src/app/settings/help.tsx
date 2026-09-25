import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import { ListGroup, ListRow, PageHeader, Screen } from '../../design/components';
import { useStrings } from '../../i18n';

/**
 * Where to write (ADR-0047 §13). The same address closes web/privacy.html and
 * web/terms.html; it is an address, not a word, so it is not in the dictionaries.
 */
const CONTACT_EMAIL = 'gusmoreno.dev@gmail.com';

/**
 * Centro de ayuda: five questions; tapping one opens its answer under it. Below them,
 * a way to write: the row opens the mail app, and shows the address so it can be
 * copied by hand when there is none.
 */
export default function HelpScreen() {
  const router = useRouter();
  const t = useStrings();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const writeToUs = (): void => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {
      Alert.alert(t.settings.help.contactFailed(CONTACT_EMAIL));
    });
  };

  return (
    <Screen scroll>
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.settings.help.title} />

      <ListGroup title={t.settings.help.faqTitle}>
        {t.settings.help.faqs.map((faq, index) => {
          const open = openIndex === index;
          return (
            <ListRow
              key={faq.question}
              label={faq.question}
              description={open ? faq.answer : undefined}
              expanded={open}
              onPress={() => setOpenIndex(open ? null : index)}
            />
          );
        })}
      </ListGroup>

      <ListGroup title={t.settings.help.contactTitle}>
        <ListRow icon="mail" label={t.settings.help.contact} description={CONTACT_EMAIL} onPress={writeToUs} />
      </ListGroup>
    </Screen>
  );
}
