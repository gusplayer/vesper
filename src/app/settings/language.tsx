import { useRouter } from 'expo-router';

import { Check, ListGroup, ListRow, PageHeader, Screen } from '../../design/components';
import { LANGUAGE_PREFERENCES, useLocaleStore, useStrings, type LanguagePreference } from '../../i18n';

/**
 * Idioma: three rows, one per choice, with a radio on the selected one. Picking a row
 * writes the preference and the whole app re-renders in that language at once, this
 * page included (ADR-0020). There is nothing to save: the rows are the action.
 */
export default function LanguageScreen() {
  const router = useRouter();
  const t = useStrings();
  const preference = useLocaleStore((state) => state.preference);
  const setPreference = useLocaleStore((state) => state.setPreference);

  // The tap's moment comes in as a parameter, the way the store takes `now`: the row's
  // handler reads the clock, not a helper the list closes over while rendering.
  const choose = (next: LanguagePreference, tappedAt: number) => {
    if (next !== preference) {
      setPreference(next, tappedAt);
    }
  };

  return (
    <Screen scroll>
      <PageHeader onBack={() => router.back()} title={t.settings.language.title} />

      <ListGroup>
        {LANGUAGE_PREFERENCES.map((option) => (
          <ListRow
            key={option}
            label={option === 'auto' ? t.settings.language.auto : t.settings.language.names[option]}
            description={option === 'auto' ? t.settings.language.autoHint : undefined}
            right={<Check checked={option === preference} />}
            kind="action"
            onPress={() => choose(option, Date.now())}
          />
        ))}
      </ListGroup>
    </Screen>
  );
}
