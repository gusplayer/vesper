import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useAppStore, useLife, useSettings } from '../../data';
import { Button, FieldRow, PageHeader, Screen, StatCard, Text } from '../../design/components';
import { formatBirthDate, parseBirthDate } from '../../lib/birthDate';
import { useNow } from '../../lib/useNow';

/** The weeks counter only needs to move once a minute. */
const CLOCK_MS = 60_000;

/**
 * Vida: the two numbers behind the weeks grid, editable, and the count they yield.
 * The draft is local; the store changes only on Guardar.
 */
export default function LifeScreen() {
  const router = useRouter();
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const now = useNow(CLOCK_MS);
  const life = useLife(now);

  const [birthText, setBirthText] = useState(
    settings.birthDate === null ? '' : formatBirthDate(settings.birthDate),
  );
  const [yearsText, setYearsText] = useState(String(settings.lifeExpectancyYears));

  const birthDate = parseBirthDate(birthText, now);
  const years = Number.parseFloat(yearsText);
  const canSave = birthDate !== null && Number.isFinite(years) && years > 0;

  const save = () => {
    if (birthDate === null) {
      return;
    }
    updateSettings({ birthDate, lifeExpectancyYears: years });
    router.back();
  };

  return (
    <Screen scroll footer={<Button label="Guardar" onPress={save} disabled={!canSave} />}>
      <PageHeader onBack={() => router.back()} title="Vida" />

      <FieldRow
        label="Nacimiento"
        value={birthText}
        onChangeText={setBirthText}
        placeholder="aaaa-mm-dd"
        keyboardType="number-pad"
      />
      <FieldRow
        label="Esperanza"
        value={yearsText}
        onChangeText={setYearsText}
        placeholder="años"
        keyboardType="number-pad"
      />
      <Text variant="caption" tone="tertiary" align="center">
        Se guarda solo en este teléfono.
      </Text>

      <StatCard
        label="semanas restantes"
        value={life === null ? '—' : life.left.toLocaleString('es-CO')}
        description={
          life === null
            ? 'Escribí tu fecha de nacimiento para verlas.'
            : `${life.lived.toLocaleString('es-CO')} vividas de ${life.total.toLocaleString('es-CO')} en total.`
        }
      />
    </Screen>
  );
}
