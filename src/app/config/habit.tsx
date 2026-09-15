import { useRouter } from 'expo-router';
import { useState } from 'react';

import { DEFAULT_HABIT_TARGET, HABIT_TARGET_OPTIONS, healthTypeFor } from '../../domain/habits';
import { MAX_HABITS, type CountMode } from '../../domain/types';
import * as habitsRepo from '../../db/repositories/habits';
import { Caption } from '../../design/components/Caption';
import { ChoiceCard } from '../../design/components/ChoiceCard';
import { Label } from '../../design/components/Label';
import { OptionChips } from '../../design/components/OptionChips';
import { PrimaryAction } from '../../design/components/PrimaryAction';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';
import { TextField } from '../../design/components/TextField';
import { emptyToNull } from '../../lib/text';

/**
 * Habit creation. Reached from the day ledger, which is the only entry point — habits
 * are created where they are read (ADR-0007).
 *
 * The name is free text, and an activity is linked automatically when it matches
 * (ADR-0008). Five is the cap, and it is a product decision.
 *
 * Verified counting is unlocked by the name, never preselected: in phase 1 nothing can
 * mark a verified habit yet, so declared stays the default until Health arrives.
 */
export default function HabitConfigScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [target, setTarget] = useState<number>(DEFAULT_HABIT_TARGET);
  const [chosenMode, setChosenMode] = useState<CountMode>('declared');
  const [failed, setFailed] = useState(false);
  // Read once: this screen is the only thing that can change the count, and it leaves.
  const [remaining] = useState(() => MAX_HABITS - habitsRepo.countActive());

  const trimmed = emptyToNull(name);
  const healthType = healthTypeFor(name);
  // Verified only makes sense while the name still maps to a health type. Renaming
  // 'gym' to 'leer' with verified chosen would otherwise save a habit nothing can mark.
  const countMode: CountMode = healthType === null ? 'declared' : chosenMode;

  function save(): void {
    if (trimmed === null) {
      return;
    }
    try {
      habitsRepo.insert(
        {
          name: trimmed,
          weeklyTarget: target,
          countMode,
          healthType: countMode === 'verified' ? healthType : null,
        },
        Date.now(),
      );
      router.back();
    } catch {
      // The repository speaks English; the user does not need the detail, only that
      // nothing was saved.
      setFailed(true);
    }
  }

  if (remaining <= 0) {
    return (
      <Screen>
        <ScreenHeader left="hábito" right="listo" onPressRight={() => router.back()} />
        <Caption>
          ya tenés cinco hábitos. es el máximo, y es una decisión de producto: mantené
          pulsado uno en el libro mayor para archivarlo y liberar un lugar
        </Caption>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenHeader left="hábito" right="listo" onPressRight={() => router.back()} />

      <Label>nombre</Label>
      <TextField
        value={name}
        onChangeText={(text) => {
          setName(text);
          setFailed(false);
        }}
        placeholder="gym, leer, dormir 7h"
        autoFocus
        accessibilityLabel="nombre del hábito"
      />

      <Label>veces por semana</Label>
      <OptionChips
        options={HABIT_TARGET_OPTIONS.map((option) => ({ value: option }))}
        selected={target}
        onSelect={setTarget}
      />

      <Label>cómo se cuenta</Label>
      <ChoiceCard
        title="declarado"
        description="lo marcás vos desde el libro mayor"
        selected={countMode === 'declared'}
        onPress={() => setChosenMode('declared')}
      />
      <ChoiceCard
        title="verificado"
        description={
          healthType === null
            ? 'solo para hábitos que Health puede confirmar: entrenamiento, caminata, sueño'
            : 'Health lo confirma solo. llega en la fase 1.5'
        }
        selected={countMode === 'verified'}
        disabled={healthType === null}
        onPress={() => setChosenMode('verified')}
      />
      {healthType === null ? null : (
        <Caption>
          el nombre coincide con un tipo de salud. el permiso se pide cuando el hábito
          empiece a marcarse solo, no ahora
        </Caption>
      )}

      <PrimaryAction label="guardar" onPress={save} disabled={trimmed === null} />
      <Caption>{failed ? 'no se pudo guardar' : `podés tener ${remaining} más`}</Caption>
    </Screen>
  );
}
