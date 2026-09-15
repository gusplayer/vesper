import { useMemo, useState } from 'react';

import { weeksLived, weeksRemaining, weeksTotal } from '../domain/life';
import * as settings from '../db/repositories/settings';
import { Caption } from '../design/components/Caption';
import { DisplayNumber } from '../design/components/DisplayNumber';
import { FieldGroup } from '../design/components/FieldGroup';
import { Label } from '../design/components/Label';
import { PrimaryAction } from '../design/components/PrimaryAction';
import { Screen } from '../design/components/Screen';
import { ScreenHeader } from '../design/components/ScreenHeader';
import { TextAction } from '../design/components/TextAction';
import { TextField } from '../design/components/TextField';
import { WeekGrid } from '../design/components/WeekGrid';
import { formatBirthDate, parseBirthDate } from '../lib/birthDate';
import { useRevision } from '../lib/useRevision';

type LifeProps = {
  revision: number;
};

/**
 * Weeks remaining. Never the initial page, never a notification, opt-in by nature:
 * with no birth date there is no number, only an invitation.
 *
 * The birth date is configured from here, because this is where it is used — there
 * is no settings screen (ADR-0007). The expectancy is a default the user cannot edit
 * in phase 1; the page says which one it uses.
 */
export function Life({ revision }: LifeProps) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, bumpSaved] = useRevision();

  const stored = useMemo(() => {
    return {
      birthDate: settings.getNumber(settings.SETTING_KEYS.birthDate),
      expectancy:
        settings.getNumber(settings.SETTING_KEYS.lifeExpectancyYears) ??
        settings.DEFAULT_LIFE_EXPECTANCY_YEARS,
    };
    // saved and revision are the signals that the settings table changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, saved]);

  const parsedDraft = parseBirthDate(draft, Date.now());

  function save(): void {
    if (parsedDraft === null) {
      return;
    }
    settings.setNumber(settings.SETTING_KEYS.birthDate, parsedDraft, Date.now());
    setEditing(false);
    bumpSaved();
  }

  if (stored.birthDate === null || editing) {
    return (
      <Screen scroll>
        <ScreenHeader left="vida" />
        <FieldGroup>
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
        </FieldGroup>
        <PrimaryAction label="guardar" onPress={save} disabled={parsedDraft === null} />
      </Screen>
    );
  }

  const now = Date.now();
  const { birthDate } = stored;
  const lived = weeksLived(birthDate, now);
  const total = weeksTotal(stored.expectancy);
  const left = weeksRemaining(birthDate, stored.expectancy, now);

  return (
    <Screen scroll>
      <ScreenHeader left="vida" />

      <DisplayNumber value={String(left)} suffix="semanas" />
      <WeekGrid lived={lived} total={total} />

      <FieldGroup>
        <Caption>
          la proyección de tiempo en redes llega con los datos de uso, en la fase 3
        </Caption>
        <Caption>{`sobre una esperanza de ${stored.expectancy} años`}</Caption>
        <TextAction
          label={`nacido el ${formatBirthDate(birthDate)}`}
          size="caption"
          onPress={() => {
            setDraft(formatBirthDate(birthDate));
            setEditing(true);
          }}
          accessibilityLabel="cambiar la fecha de nacimiento"
        />
      </FieldGroup>
    </Screen>
  );
}
