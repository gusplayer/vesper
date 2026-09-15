import { router } from 'expo-router';
import { useState } from 'react';

import { APPS, appsById } from '../../data';
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
} from '../../design/components';
import { AppRow } from '../../design/components';

/** How many apps a mode can block. A product number, same as modes/apps. */
const MAX_APPS = 50;

/**
 * The apps the first mode blocks. Starts with the idea's suggestion and shows three
 * of them large; "Elegir apps" opens the full picker in place.
 */
export default function AppsScreen() {
  const modeName = useOnboardingDraft((state) => state.modeName);
  const appIds = useOnboardingDraft((state) => state.appIds);
  const setAppIds = useOnboardingDraft((state) => state.setAppIds);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const featured = appsById(appIds).slice(0, 3);
  const needle = query.trim().toLowerCase();
  const visible = needle === '' ? APPS : APPS.filter((app) => app.name.toLowerCase().includes(needle));

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
            label="Continuar"
            onPress={() => router.push('/onboarding/screen-time')}
            disabled={appIds.length === 0}
          />
          <Text variant="caption" tone="tertiary" align="center">
            Bloquea hasta 50 distracciones por modo. Puedes editarlo cuando quieras.
          </Text>
        </>
      }
    >
      <PageHeader onBack={() => router.back()} />
      <Text variant="title">{`Bien, tu primer modo se llama ${modeName}`}</Text>
      <Text variant="label" tone="secondary">
        Ahora elige las apps a bloquear cuando lo uses.
      </Text>

      <Stack direction="row" justify="center" gap="lg">
        {featured.map((app) => (
          <AppIcon key={app.id} initial={app.initial} color={app.color} size="lg" />
        ))}
      </Stack>

      {picking ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Buscar apps" />
          <Section
            title="Seleccionadas"
            right={
              <Text variant="label" tone="secondary">
                {`${appIds.length} / ${MAX_APPS}`}
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
        <Button label="Elegir apps" variant="secondary" onPress={() => setPicking(true)} />
      )}
    </Screen>
  );
}
