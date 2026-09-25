import { useRouter } from 'expo-router';

import { BACK_FALLBACK, goBack } from '../../lib/goBack';
import { useState } from 'react';

import { useAppStore, useSettings } from '../../data';
import {
  Button,
  ChipGroup,
  FieldRow,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
  Section,
  Sheet,
  Stack,
  StatCard,
  StatusNote,
  Text,
} from '../../design/components';
import { weeksLived, weeksRemaining, weeksTotal } from '../../domain/life';
import {
  COUNTRIES,
  countryName,
  expectancySourceText,
  resolveExpectancy,
  yearsText as yearsLabel,
  type Sex,
} from '../../domain/lifeExpectancy';
import { useLocale, useStrings } from '../../i18n';
import { formatBirthDate, parseBirthDate, typeBirthDate } from '../../lib/birthDate';
import { useNow } from '../../lib/useNow';

/** The weeks counter only needs to move once a minute. */
const CLOCK_MS = 60_000;

type SexChoice = 'female' | 'male' | 'undisclosed';

/** The chips speak in choices; 'undisclosed' is stored as no sex at all. */
const SEX_CHOICES: readonly SexChoice[] = ['female', 'male', 'undisclosed'];

function sexOf(choice: SexChoice): Sex | null {
  return choice === 'undisclosed' ? null : choice;
}

/** The years field back to a number. It is filled as the language writes it ('77,6'), and either mark is read. */
function parseYears(text: string): number {
  return Number.parseFloat(text.trim().replace(',', '.'));
}

/**
 * Vida: the birth date behind the weeks grid, and two optional facts — country and
 * sex — that turn the reference life expectancy into the user's own. Nothing is
 * required: an empty date turns Vida off (docs/PRD.md §3, opt-in), and nothing else is
 * ever asked (no weight, no height). The draft is local; the store changes only on
 * Guardar, but the weeks card reads the draft, so what is typed shows before saving.
 */
export default function LifeScreen() {
  const router = useRouter();
  const settings = useSettings();
  const updateSettings = useAppStore((state) => state.updateSettings);
  const now = useNow(CLOCK_MS);
  const t = useStrings();
  const { tag } = useLocale();

  const [birthText, setBirthText] = useState(
    settings.birthDate === null ? '' : formatBirthDate(settings.birthDate),
  );
  const [country, setCountry] = useState<string | null>(settings.country);
  const [sex, setSex] = useState<Sex | null>(settings.sex);
  const [yearsText, setYearsText] = useState(yearsLabel(settings.lifeExpectancyYears, tag));
  const [choosingCountry, setChoosingCountry] = useState(false);

  // The sheet lists countries by their name in the current language, not by code.
  const countryNames = t.settings.lifeExpectancy.countries;
  const countries = [...COUNTRIES].sort((a, b) => countryNames[a.code].localeCompare(countryNames[b.code], tag));

  const cleared = birthText.trim() === '';
  const birthDate = parseBirthDate(birthText, now);
  const years = parseYears(yearsText);
  const validYears = Number.isFinite(years) && years > 0;
  const canSave = (cleared || birthDate !== null) && validYears;
  const resolved = resolveExpectancy(country, sex);
  const manual = Number.isFinite(years) && years !== resolved.years;

  // The card follows the draft: a valid date and valid years, or nothing to count.
  const draftLife =
    birthDate !== null && validYears
      ? {
          lived: weeksLived(birthDate, now),
          total: weeksTotal(years),
          left: weeksRemaining(birthDate, years, now),
        }
      : null;

  // Changing what is known re-derives the number; a hand-typed one stays until then.
  function chooseCountry(code: string | null): void {
    setCountry(code);
    setYearsText(yearsLabel(resolveExpectancy(code, sex).years, tag));
    setChoosingCountry(false);
  }
  function chooseSex(value: Sex | null): void {
    setSex(value);
    setYearsText(yearsLabel(resolveExpectancy(country, value).years, tag));
  }

  const save = () => {
    if (!canSave) {
      return;
    }
    updateSettings({ birthDate: cleared ? null : birthDate, country, sex, lifeExpectancyYears: years });
    goBack(router, BACK_FALLBACK.settings);
  };

  return (
    <Screen scroll avoidKeyboard footer={<Button label={t.common.save} onPress={save} disabled={!canSave} />}>
      <PageHeader onBack={() => goBack(router, BACK_FALLBACK.settings)} title={t.settings.life.title} />

      <Stack gap="sm">
        <FieldRow
          label={t.settings.life.birth}
          value={birthText}
          onChangeText={(text) => setBirthText(typeBirthDate(text))}
          placeholder={t.settings.life.birthPlaceholder}
          keyboardType="number-pad"
          maxLength={10}
        />
        <StatusNote text={t.settings.life.birthHint} />
      </Stack>

      <Section title={t.settings.life.optional}>
        <ListGroup>
          <ListRow
            label={t.settings.life.country}
            value={countryName(country, t.settings.lifeExpectancy) ?? t.settings.life.notChosen}
            onPress={() => setChoosingCountry(true)}
          />
        </ListGroup>
        <Stack gap="sm">
          <Text variant="label" tone="secondary">
            {t.settings.life.sexLabel}
          </Text>
          <ChipGroup
            options={SEX_CHOICES.map((choice) => ({ value: choice, label: t.settings.life.sex[choice] }))}
            value={sex ?? 'undisclosed'}
            onChange={(choice) => chooseSex(sexOf(choice))}
            accessibilityLabel={t.settings.life.sexLabel}
          />
        </Stack>
        <StatusNote text={t.settings.life.optionalHint} />
      </Section>

      <Section title={t.settings.life.expectancy}>
        <FieldRow
          label={t.settings.life.years}
          value={yearsText}
          onChangeText={setYearsText}
          placeholder={t.settings.life.yearsPlaceholder}
          keyboardType="decimal-pad"
        />
        <StatusNote
          text={
            manual
              ? t.settings.life.manual(yearsLabel(years, tag))
              : expectancySourceText(resolved, sex, t.settings.lifeExpectancy, tag)
          }
        />
      </Section>

      <StatCard
        label={t.settings.life.weeksLeft}
        value={draftLife === null ? t.common.empty : draftLife.left.toLocaleString(tag)}
        description={
          draftLife === null
            ? t.settings.life.noBirthDate
            : t.settings.life.livedOfTotal(draftLife.lived.toLocaleString(tag), draftLife.total.toLocaleString(tag))
        }
      />
      <StatusNote text={t.settings.life.localOnly} align="center" />

      <Sheet visible={choosingCountry} title={t.settings.life.countrySheet} onClose={() => setChoosingCountry(false)}>
        <ListGroup>
          <ListRow
            label={t.settings.life.notChosen}
            selection="radio"
            selected={country === null}
            onPress={() => chooseCountry(null)}
          />
          {countries.map((item) => (
            <ListRow
              key={item.code}
              label={countryNames[item.code]}
              selection="radio"
              selected={item.code === country}
              onPress={() => chooseCountry(item.code)}
            />
          ))}
        </ListGroup>
      </Sheet>
    </Screen>
  );
}
