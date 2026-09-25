import { router } from 'expo-router';
import { useState } from 'react';

import { appsById, useApps } from '../../data';
import { MAX_SELECTION } from '../../data/modeDraft';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import {
  AppRow,
  AppTile,
  Button,
  ListGroup,
  PageHeader,
  Screen,
  SearchField,
  Section,
  Stack,
  StatusNote,
  Text,
  useTooltip,
} from '../../design/components';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { status as blockingStatus } from '../../platform/blocking';
import { stepProgress } from './steps';

/**
 * The onboarding's apps step where this phone has no real picker (a simulator, iOS
 * without Apple's entitlement, a build without the module): the example catalogue,
 * saved on the mode as names and blocking nothing. The platform's reason is said once,
 * at the top. Three of the chosen apps are shown large; "Elegir apps" opens the list
 * in place, with what is chosen on top and the whole catalogue below. An empty choice
 * is allowed, like everywhere else.
 */
export function CatalogueApps({ onContinue }: { onContinue: () => void }) {
  const t = useStrings();
  const modeName = useOnboardingDraft((state) => state.modeName);
  const appIds = useOnboardingDraft((state) => state.appIds);
  const setAppIds = useOnboardingDraft((state) => state.setAppIds);
  const apps = useApps();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const tooltip = useTooltip();

  const copy = t.onboarding.apps;
  const picker = t.modes.picker;
  const featured = appsById(appIds).slice(0, 3);
  const needle = query.trim().toLowerCase();
  const searching = needle !== '';
  const selected = apps.filter((app) => appIds.includes(app.id));
  const results = searching ? apps.filter((app) => app.name.toLowerCase().includes(needle)) : apps;

  // Only reached where this phone has no real picker (appsStep.ts): its reason is a
  // fact, said once at the top of the page.
  const reason = blockingStatus().reason;
  const notice = reason === null ? null : copy.exampleNote(reason);

  const toggle = (id: string) => {
    if (appIds.includes(id)) {
      setAppIds(appIds.filter((appId) => appId !== id));
      return;
    }
    if (appIds.length >= MAX_SELECTION) {
      tooltip.show(t.modes.apps.fullTip);
      return;
    }
    setAppIds([...appIds, id]);
  };

  const row = (app: (typeof apps)[number]) => (
    <AppRow
      key={app.id}
      initial={app.initial}
      color={app.color}
      name={app.name}
      description={app.category}
      selection="checkbox"
      selected={appIds.includes(app.id)}
      onPress={() => toggle(app.id)}
    />
  );

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={t.common.continue} onPress={onContinue} />
          <StatusNote text={copy.limit(MAX_SELECTION)} align="center" />
        </>
      }
    >
      <PageHeader onBack={() => goBack(router)} progress={stepProgress('apps', t.onboarding.progress)} />
      <Text variant="title">{copy.title(modeName)}</Text>
      <Text variant="label" tone="secondary">
        {copy.subtitle}
      </Text>
      {notice === null ? null : <StatusNote text={notice} icon="info" />}

      <Stack direction="row" justify="center" gap="lg">
        {featured.map((app) => (
          <AppTile key={app.id} initial={app.initial} color={app.color} size="lg" accessibilityLabel={app.name} />
        ))}
      </Stack>

      {picking ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder={copy.search} />
          {tooltip.element}
          {searching ? (
            <Section title={picker.results}>
              {results.length === 0 ? (
                <StatusNote text={picker.noResults} kind="empty" />
              ) : (
                <ListGroup>{results.map(row)}</ListGroup>
              )}
            </Section>
          ) : (
            <>
              <Section
                title={copy.selected}
                right={
                  <Text variant="label" tone="secondary">
                    {picker.count(appIds.length, MAX_SELECTION)}
                  </Text>
                }
              >
                {selected.length === 0 ? (
                  <StatusNote text={picker.nothingYet} kind="empty" />
                ) : (
                  <ListGroup>{selected.map(row)}</ListGroup>
                )}
              </Section>
              <Section title={t.modes.apps.all}>
                <ListGroup>{apps.map(row)}</ListGroup>
              </Section>
            </>
          )}
        </>
      ) : (
        <Button label={copy.pickApps} variant="secondary" onPress={() => setPicking(true)} />
      )}
    </Screen>
  );
}
