import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useAppStore, useLife, useSettings } from '../../data';
import {
  Button,
  Chip,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Sheet,
  Stack,
  StatCard,
  Text,
} from '../../design/components';
import {
  COUNTRIES,
  expectancySourceText,
  findCountry,
  resolveExpectancy,
  yearsText as yearsLabel,
  type Sex,
} from '../../domain/lifeExpectancy';
import { formatBirthDate, parseBirthDate } from '../../lib/birthDate';
import { useNow } from '../../lib/useNow';

/** The weeks counter only needs to move once a minute. */
const CLOCK_MS = 60_000;

const SEX_OPTIONS: ReadonlyArray<{ value: Sex | null; label: string }> = [
  { value: 'female', label: 'Mujer' },
  { value: 'male', label: 'Hombre' },
  { value: null, label: 'Prefiero no decirlo' },
];

/**
 * Vida: the birth date behind the weeks grid, and two optional facts — country and
 * sex — that turn the reference life expectancy into the user's own. Nothing is
 * required beyond the date, and nothing else is ever asked (no weight, no height).
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
  const [country, setCountry] = useState<string | null>(settings.country);
  const [sex, setSex] = useState<Sex | null>(settings.sex);
  const [yearsText, setYearsText] = useState(String(settings.lifeExpectancyYears));
  const [choosingCountry, setChoosingCountry] = useState(false);

  const birthDate = parseBirthDate(birthText, now);
  const years = Number.parseFloat(yearsText.replace(',', '.'));
  const canSave = birthDate !== null && Number.isFinite(years) && years > 0;
  const resolved = resolveExpectancy(country, sex);
  const manual = Number.isFinite(years) && years !== resolved.years;

  // Changing what is known re-derives the number; a hand-typed one stays until then.
  function chooseCountry(code: string | null): void {
    setCountry(code);
    setYearsText(String(resolveExpectancy(code, sex).years));
    setChoosingCountry(false);
  }
  function chooseSex(value: Sex | null): void {
    setSex(value);
    setYearsText(String(resolveExpectancy(country, value).years));
  }

  const save = () => {
    if (birthDate === null) {
      return;
    }
    updateSettings({ birthDate, country, sex, lifeExpectancyYears: years });
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

      <Section title="Opcional">
        <ListGroup>
          <ListRow
            label="País"
            value={findCountry(country)?.name ?? 'Sin elegir'}
            onPress={() => setChoosingCountry(true)}
          />
        </ListGroup>
        <Stack direction="row" gap="sm" wrap>
          {SEX_OPTIONS.map((option) => (
            <Chip
              key={option.label}
              label={option.label}
              selected={option.value === sex}
              onPress={() => chooseSex(option.value)}
            />
          ))}
        </Stack>
        <Text variant="caption" tone="tertiary">
          Solo sirven para afinar la esperanza de vida de referencia. Sin ellos usamos un
          promedio. No pedimos peso ni altura: no los usamos.
        </Text>
      </Section>

      <Section title="Esperanza de vida">
        <FieldRow
          label="Años"
          value={yearsText}
          onChangeText={setYearsText}
          placeholder="años"
          keyboardType="number-pad"
        />
        <Text variant="caption" tone="tertiary">
          {manual
            ? `Sobre ${yearsLabel(years)} años: lo pusiste vos. Cambiar el país o el sexo lo vuelve a calcular.`
            : expectancySourceText(resolved, sex)}
        </Text>
      </Section>

      <StatCard
        label="SEMANAS RESTANTES"
        value={life === null ? '—' : life.left.toLocaleString('es-CO')}
        description={
          life === null
            ? 'Escribí tu fecha de nacimiento para verlas.'
            : `${life.lived.toLocaleString('es-CO')} vividas de ${life.total.toLocaleString('es-CO')} en total.`
        }
      />
      <Text variant="caption" tone="tertiary" align="center">
        Se guarda solo en este teléfono.
      </Text>

      <Sheet visible={choosingCountry} title="País" onClose={() => setChoosingCountry(false)}>
        <Stack direction="row" gap="sm" wrap>
          <Chip label="Sin elegir" selected={country === null} onPress={() => chooseCountry(null)} />
          {COUNTRIES.map((item) => (
            <Chip
              key={item.code}
              label={item.name}
              selected={item.code === country}
              onPress={() => chooseCountry(item.code)}
            />
          ))}
        </Stack>
      </Sheet>
    </Screen>
  );
}
