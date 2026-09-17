import { router } from 'expo-router';
import { useState } from 'react';

import { appsById, useApps } from '../../data';
import { useOnboardingDraft } from '../../data/onboardingDraft';
import {
  AppIcon,
  Button,
  Check,
  ListGroup,
  PageHeader,
  Screen,
  SearchField,
  Section,
  Stack,
  Text,
 AppRow } from '../../design/components';
import { useStrings } from '../../i18n';

/** How many apps a mode can block. A product number, same as modes/apps. */
const MAX_APPS = 50;

/**
 * The apps the first mode blocks. Starts with the idea's suggestion and shows three
 * of them large; "Pick apps" opens the full picker in place.
 */
export default function AppsScreen() {
  const t = useStrings();
  const modeName = useOnboardingDraft((state) => state.modeName);
  const appIds = useOnboardingDraft((state) => state.appIds);
  const setAppIds = useOnboardingDraft((state) => state.setAppIds);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const featured = appsById(appIds).slice(0, 3);
  const needle = query.trim().toLowerCase();
  const apps = useApps();
  const visible = needle === '' ? apps : apps.filter((app) => app.name.toLowerCase().includes(needle));

  const toggle = (id: string) => {
    if (appIds.includes(id)) {
      setAppIds(appIds.filter((appId) => appId !== id));
      return;
    }
    if (appIds.length >= MAX_APPS) {
      return;
    }
    setAppIds([...appIds, id]);
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button
            label={t.common.continue}
            onPress={() => router.push('/onboarding/screen-time')}
            disabled={appIds.length === 0}
          />
          <Text variant="caption" tone="tertiary" align="center">
            {t.onboarding.apps.limit(MAX_APPS)}
          </Text>
        </>
      }
    >
      <PageHeader onBack={() => router.back()} />
      <Text variant="title">{t.onboarding.apps.title(modeName)}</Text>
      <Text variant="label" tone="secondary">
        {t.onboarding.apps.subtitle}
      </Text>

      <Stack direction="row" justify="center" gap="lg">
        {featured.map((app) => (
          <AppIcon key={app.id} initial={app.initial} color={app.color} size="lg" />
        ))}
      </Stack>

      {picking ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder={t.onboarding.apps.search} />
          <Section
            title={t.onboarding.apps.selected}
            right={
              <Text variant="label" tone="secondary">
                {t.modes.picker.count(appIds.length, MAX_APPS)}
              </Text>
            }
          >
            <ListGroup>
              {visible.map((app) => (
                <AppRow
                  key={app.id}
                  initial={app.initial}
                  color={app.color}
                  name={app.name}
                  description={app.category}
                  right={<Check checked={appIds.includes(app.id)} shape="box" />}
                  onPress={() => toggle(app.id)}
                />
              ))}
            </ListGroup>
          </Section>
        </>
      ) : (
        <Button label={t.onboarding.apps.pickApps} variant="secondary" onPress={() => setPicking(true)} />
      )}
    </Screen>
  );
}
