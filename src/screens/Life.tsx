import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { weeksLived, weeksRemaining, weeksTotal } from '../domain/life';
import * as settings from '../db/repositories/settings';
import { Caption } from '../design/components/Caption';
import { DisplayNumber } from '../design/components/DisplayNumber';
import { Label } from '../design/components/Label';
import { PrimaryAction } from '../design/components/PrimaryAction';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';
import { TextField } from '../design/components/TextField';
import { WeekGrid } from '../design/components/WeekGrid';

type LifeProps = {
  revision: number;
};

/** 'aaaa-mm-dd' to epoch ms, or null. Deliberately strict: no partial dates. */
function parseBirthDate(text: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (match === null) {
    return null;
  }
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day) ||
    parsed.getTime() > Date.now()
  ) {
    return null;
  }
  return parsed.getTime();
}

function formatBirthDate(birthDate: number): string {
  const date = new Date(birthDate);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Weeks remaining. Never the initial page, never a notification, opt-in by nature:
 * with no birth date there is no number, only an invitation.
 *
 * The birth date is configured from here, because this is where it is used — there is
 * no settings screen (ADR-0007).
 */
export function Life({ revision }: LifeProps) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(0);

  const stored = useMemo(() => {
    return {
      birthDate: settings.getNumber(settings.SETTING_KEYS.birthDate),
      expectancy:
        settings.getNumber(settings.SETTING_KEYS.lifeExpectancyYears) ??
        settings.DEFAULT_LIFE_EXPECTANCY_YEARS,
    };
    // saved and revision are the signals that the settings table changed.
  }, [revision, saved]);

  function save(): void {
    const parsed = parseBirthDate(draft);
    if (parsed === null) {
      return;
    }
    const now = Date.now();
    settings.setNumber(settings.SETTING_KEYS.birthDate, parsed, now);
    settings.setBoolean(settings.SETTING_KEYS.lifeScreenEnabled, true, now);
    setEditing(false);
    setSaved((current) => current + 1);
  }

  if (stored.birthDate === null || editing) {
    return (
      <Screen scroll>
        <ScreenHeader left="vida" />
        <Label>fecha de nacimiento</Label>
        <TextField
          value={draft}
          onChangeText={setDraft}
          placeholder="aaaa-mm-dd"
          accessibilityLabel="fecha de nacimiento"
        />
        <Caption>
          se guarda solo en este teléfono. es la única forma de contar semanas, y podés
          dejarla en blanco
        </Caption>
        <PrimaryAction label="guardar" onPress={save} disabled={parseBirthDate(draft) === null} />
      </Screen>
    );
  }

  const now = Date.now();
  const lived = weeksLived(stored.birthDate, now);
  const total = weeksTotal(stored.expectancy);
  const left = weeksRemaining(stored.birthDate, stored.expectancy, now);

  return (
    <Screen scroll>
      <ScreenHeader left="vida" />

      <DisplayNumber value={String(left)} suffix="semanas" />
      <WeekGrid lived={lived} total={total} />

      <View>
        <Caption>
          la proyección de tiempo en redes llega con los datos de uso, en la fase 3
        </Caption>
        <Pressable
          onPress={() => {
            setDraft(stored.birthDate === null ? '' : formatBirthDate(stored.birthDate));
            setEditing(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="cambiar la fecha de nacimiento"
        >
          <Caption>
            {`nacido el ${formatBirthDate(stored.birthDate)} · esperanza ${stored.expectancy} años · toca para cambiar`}
          </Caption>
        </Pressable>
      </View>
    </Screen>
  );
}
