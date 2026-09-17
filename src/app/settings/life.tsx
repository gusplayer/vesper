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
  countryName,
  expectancySourceText,
  resolveExpectancy,
  yearsText as yearsLabel,
  type Sex,
} from '../../domain/lifeExpectancy';
import { useLocale, useStrings } from '../../i18n';
import { formatBirthDate, parseBirthDate } from '../../lib/birthDate';
import { useNow } from '../../lib/useNow';

/** The weeks counter only needs to move once a minute. */
const CLOCK_MS = 60_000;

const SEX_OPTIONS: readonly { value: Sex | null; key: 'female' | 'male' | 'undisclosed' }[] = [
  { value: 'female', key: 'female' },
  { value: 'male', key: 'male' },
  { value: null, key: 'undisclosed' },
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
  const t = useStrings();
  const { tag } = useLocale();

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
    <Screen scroll footer={<Button label={t.common.save} onPress={save} disabled={!canSave} />}>
      <PageHeader onBack={() => router.back()} title={t.settings.life.title} />

      <FieldRow
        label={t.settings.life.birth}
        value={birthText}
        onChangeText={setBirthText}
        placeholder={t.settings.life.birthPlaceholder}
        keyboardType="number-pad"
      />

      <Section title={t.settings.life.optional}>
        <ListGroup>
          <ListRow
            label={t.settings.life.country}
            value={countryName(country, t.settings.lifeExpectancy) ?? t.settings.life.notChosen}
            onPress={() => setChoosingCountry(true)}
          />
        </ListGroup>
        <Stack direction="row" gap="sm" wrap>
          {SEX_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={t.settings.life.sex[option.key]}
              selected={option.value === sex}
              onPress={() => chooseSex(option.value)}
            />
          ))}
        </Stack>
        <Text variant="caption" tone="tertiary">
          {t.settings.life.optionalHint}
        </Text>
      </Section>

      <Section title={t.settings.life.expectancy}>
        <FieldRow
          label={t.settings.life.years}
          value={yearsText}
          onChangeText={setYearsText}
          placeholder={t.settings.life.yearsPlaceholder}
          keyboardType="number-pad"
        />
        <Text variant="caption" tone="tertiary">
          {manual
            ? t.settings.life.manual(yearsLabel(years, tag))
            : expectancySourceText(resolved, sex, t.settings.lifeExpectancy, tag)}
        </Text>
      </Section>

      <StatCard
        label={t.settings.life.weeksLeft}
        value={life === null ? t.common.empty : life.left.toLocaleString(tag)}
        description={
          life === null
            ? t.settings.life.noBirthDate
            : t.settings.life.livedOfTotal(life.lived.toLocaleString(tag), life.total.toLocaleString(tag))
        }
      />
      <Text variant="caption" tone="tertiary" align="center">
        {t.settings.life.localOnly}
      </Text>

      <Sheet visible={choosingCountry} title={t.settings.life.countrySheet} onClose={() => setChoosingCountry(false)}>
        <Stack direction="row" gap="sm" wrap>
          <Chip label={t.settings.life.notChosen} selected={country === null} onPress={() => chooseCountry(null)} />
          {COUNTRIES.map((item) => (
            <Chip
              key={item.code}
              label={t.settings.lifeExpectancy.countries[item.code]}
              selected={item.code === country}
              onPress={() => chooseCountry(item.code)}
            />
          ))}
        </Stack>
      </Sheet>
    </Screen>
  );
}
