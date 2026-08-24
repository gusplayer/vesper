import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import * as habitsRepo from '../../db/repositories/habits';
import { Caption } from '../../design/components/Caption';
import { ChipRow } from '../../design/components/ChipRow';
import { Chip } from '../../design/components/Chip';
import { Label } from '../../design/components/Label';
import { PrimaryAction } from '../../design/components/PrimaryAction';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';
import { TextAction } from '../../design/components/TextAction';
import { TextField } from '../../design/components/TextField';

const TARGETS = [2, 4, 6];

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
  const habit = habitsRepo.listActive().find((candidate) => candidate.id === params.id) ?? null;

  const [name, setName] = useState(habit?.name ?? '');
  const [target, setTarget] = useState(habit?.weeklyTarget ?? 4);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  if (habit === null) {
    return (
      <Screen>
        <ScreenHeader left="hábito" right="volver" onPressRight={() => router.back()} />
        <Caption>ese hábito ya no existe</Caption>
      </Screen>
    );
  }

  const { id } = habit;

  function save(): void {
    habitsRepo.rename(id, name.trim());
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
      <ChipRow>
        {TARGETS.map((option) => (
          <Chip
            key={option}
            label={String(option)}
            selected={target === option}
            onPress={() => setTarget(option)}
          />
        ))}
      </ChipRow>

      <PrimaryAction label="guardar" onPress={save} disabled={name.trim().length === 0} />

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
