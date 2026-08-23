import { useRouter } from 'expo-router';
import { useState } from 'react';

import { MAX_HABITS, type CountMode, type HealthType } from '../../domain/types';
import * as habitsRepo from '../../db/repositories/habits';
import { Caption } from '../../design/components/Caption';
import { ChipRow } from '../../design/components/ChipRow';
import { Chip } from '../../design/components/Chip';
import { ChoiceCard } from '../../design/components/ChoiceCard';
import { Label } from '../../design/components/Label';
import { PrimaryAction } from '../../design/components/PrimaryAction';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';
import { TextField } from '../../design/components/TextField';

const TARGETS = [2, 4, 6];

/**
 * Names that map to a health type. Used to suggest the verified count mode, which is
 * what ADR-0005 calls the right moment to ask for the health permission — not the
 * onboarding.
 */
const HEALTH_HINTS: ReadonlyArray<{ pattern: RegExp; type: HealthType }> = [
  { pattern: /gym|entrena|pesas|ejercicio|correr|bici/i, type: 'workout' },
  { pattern: /camin|pasos|andar/i, type: 'steps' },
  { pattern: /dormir|sueño|sueno/i, type: 'sleep' },
];

function healthTypeFor(name: string): HealthType | null {
  return HEALTH_HINTS.find((hint) => hint.pattern.test(name))?.type ?? null;
}

/**
 * Habit creation. Reached from the day ledger, which is the only entry point — habits
 * are created where they are read (ADR-0007).
 *
 * The name is free text, and an activity is linked automatically when it matches
 * (ADR-0008). Five is the cap, and it is a product decision.
 */
export default function HabitConfigScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [target, setTarget] = useState(4);
  const [countMode, setCountMode] = useState<CountMode>('declared');
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_HABITS - habitsRepo.countActive();
  const healthType = healthTypeFor(name);
  const trimmed = name.trim();

  function save(): void {
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'no se pudo guardar');
    }
  }

  if (remaining <= 0) {
    return (
      <Screen>
        <ScreenHeader left="hábito" right="listo" onPressRight={() => router.back()} />
        <Caption>
          ya tenés cinco hábitos. es el máximo, y es una decisión de producto: archivá uno
          desde el libro mayor si querés otro
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
          setError(null);
        }}
        placeholder="gym, leer, dormir 7h"
        autoFocus
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

      <Label>cómo se cuenta</Label>
      <ChoiceCard
        title="declarado"
        description="lo marcás vos desde el libro mayor"
        selected={countMode === 'declared'}
        onPress={() => setCountMode('declared')}
      />
      <ChoiceCard
        title="verificado"
        description={
          healthType === null
            ? 'solo para hábitos que Health puede confirmar: entrenamiento, caminata, sueño'
            : 'Health lo confirma solo. llega en la fase 1.5'
        }
        selected={countMode === 'verified'}
        onPress={() => (healthType === null ? undefined : setCountMode('verified'))}
      />
      {healthType === null ? null : (
        <Caption>
          el nombre coincide con un tipo de salud. el permiso se pide cuando el hábito
          empiece a marcarse solo, no ahora
        </Caption>
      )}

      <PrimaryAction label="guardar" onPress={save} disabled={trimmed.length === 0} />
      <Caption>{error ?? `podés tener ${remaining} más`}</Caption>
    </Screen>
  );
}
