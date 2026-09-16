import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Icon, ListGroup, ListRow, PageHeader, Screen, Text } from '../../design/components';
import { useStrings } from '../../i18n';

/** Centro de ayuda: five questions; tapping one opens its answer under it. */
export default function HelpScreen() {
  const router = useRouter();
  const t = useStrings();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <Screen scroll>
      <PageHeader onBack={() => router.back()} title={t.settings.help.title} />

      <ListGroup title={t.settings.help.faqTitle}>
        {t.settings.help.faqs.map((faq, index) => {
          const open = openIndex === index;
          return (
            <ListRow
              key={faq.question}
              label={faq.question}
              description={open ? faq.answer : undefined}
              right={<Icon name={open ? 'chevron-up' : 'chevron-down'} size="sm" tone="secondary" />}
              onPress={() => setOpenIndex(open ? null : index)}
            />
          );
        })}
      </ListGroup>

      <Text variant="caption" tone="tertiary" align="center">
        {t.settings.help.footer}
      </Text>
    </Screen>
  );
}
