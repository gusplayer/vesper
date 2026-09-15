import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { DEFAULT_HABIT_TARGET, HABIT_TARGET_OPTIONS } from '../../domain/habits';
import * as habitsRepo from '../../db/repositories/habits';
import { Caption } from '../../design/components/Caption';
import { Label } from '../../design/components/Label';
import { OptionChips } from '../../design/components/OptionChips';
import { PrimaryAction } from '../../design/components/PrimaryAction';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';
import { TextAction } from '../../design/components/TextAction';
import { TextField } from '../../design/components/TextField';
import { emptyToNull } from '../../lib/text';

/**
 * Editing and archiving a habit. Reached by holding a habit row in the day ledger,
 * which is where habits are read — ADR-0007 says they are created *and edited* there.
 *
 * Archiving, not deleting: the marks are history, and a verified mark cannot be
 * removed by hand (invariant 5). An archived habit stops counting and frees a slot.
 */
export default function HabitEditScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  // Read once: the row cannot change while this screen is open.
  const [habit] = useState(() => (params.id === undefined ? null : habitsRepo.findById(params.id)));

  const [name, setName] = useState(habit?.name ?? '');
  const [target, setTarget] = useState<number>(habit?.weeklyTarget ?? DEFAULT_HABIT_TARGET);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  if (habit === null || habit.archivedAt !== null) {
    return (
      <Screen>
        <ScreenHeader left="hábito" right="volver" onPressRight={() => router.back()} />
        <Caption>ese hábito ya no existe</Caption>
      </Screen>
    );
  }

  const { id } = habit;
  const trimmed = emptyToNull(name);

  function save(): void {
    if (trimmed === null) {
      return;
    }
    habitsRepo.rename(id, trimmed);
    habitsRepo.setWeeklyTarget(id, target);
    router.back();
  }

  return (
    <Screen scroll>
      <ScreenHeader left="hábito" right="listo" onPressRight={() => router.back()} />

      <Label>nombre</Label>
      <TextField
        value={name}
        onChangeText={setName}
        placeholder="gym, leer, dormir 7h"
        accessibilityLabel="nombre del hábito"
      />

      <Label>veces por semana</Label>
      <OptionChips
        options={HABIT_TARGET_OPTIONS.map((option) => ({ value: option }))}
        selected={target}
        onSelect={setTarget}
      />

      <PrimaryAction label="guardar" onPress={save} disabled={trimmed === null} />

      {confirmingArchive ? (
        <TextAction
          label="confirmar: archivar y liberar un lugar"
          onPress={() => {
            habitsRepo.archive(id, Date.now());
            router.back();
          }}
        />
      ) : (
        <TextAction label="archivar este hábito" onPress={() => setConfirmingArchive(true)} />
      )}
      <Caption>
        archivar no borra nada: las marcas siguen ahí y el hábito deja de contar
      </Caption>
    </Screen>
  );
}
