import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import type { SessionConfig } from '../../domain/session';
import type { Depth } from '../../domain/types';
import * as activitiesRepo from '../../db/repositories/activities';
import * as sessionConfigRepo from '../../db/repositories/sessionConfig';
import { Caption } from '../../design/components/Caption';
import { ChoiceCard } from '../../design/components/ChoiceCard';
import { Chip } from '../../design/components/Chip';
import { Label } from '../../design/components/Label';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';
import { TextField } from '../../design/components/TextField';
import { ChipRow } from '../../design/components/ChipRow';

const MINUTE = 60_000;
const PRESET_MINUTES = [25, 50, 90];

const DEPTHS: ReadonlyArray<{ value: Depth; title: string; description: string }> = [
  { value: 'soft', title: 'suave', description: 'mantener pulsado termina de inmediato' },
  { value: 'firm', title: 'firme', description: 'te pregunta por qué y espera 15 segundos' },
  { value: 'deep', title: 'profundo', description: 'no responde. solo el timer termina' },
];

/**
 * Session config. Opened by tapping the big number on the home screen, which is its
 * only entry point — there is no settings screen (ADR-0007).
 *
 * It is a route rather than a native modal presentation on purpose: a modal slides up,
 * and the design language allows instant or a 120ms fade, nothing else.
 *
 * Every change saves immediately, so the next session inherits it without a save step.
 */
export default function SessionConfigScreen() {
  const router = useRouter();
  // Re-read after creating one, so the new chip appears immediately.
  const [activityRevision, setActivityRevision] = useState(0);
  const activities = useMemo(() => activitiesRepo.listActive(), [activityRevision]);
  const [config, setConfig] = useState<SessionConfig | null>(() =>
    sessionConfigRepo.loadOrDefault(),
  );
  const [customMinutes, setCustomMinutes] = useState('');
  const [newActivity, setNewActivity] = useState<string | null>(null);

  function update(next: SessionConfig): void {
    setConfig(next);
    sessionConfigRepo.save(next, Date.now());
  }

  if (config === null) {
    return (
      <Screen>
        <ScreenHeader left="sesión" right="listo" onPressRight={() => router.back()} />
        <Caption>no hay actividades disponibles</Caption>
      </Screen>
    );
  }

  const minutes = Math.round(config.plannedMs / MINUTE);
  const isPreset = PRESET_MINUTES.includes(minutes);

  return (
    <Screen scroll>
      <ScreenHeader left="sesión" right="listo" onPressRight={() => router.back()} />

      <Label>duración</Label>
      <ChipRow>
        {PRESET_MINUTES.map((preset) => (
          <Chip
            key={preset}
            label={String(preset)}
            selected={minutes === preset}
            onPress={() => update({ ...config, plannedMs: preset * MINUTE })}
          />
        ))}
        <Chip
          label="otra"
          selected={!isPreset}
          onPress={() => setCustomMinutes(String(minutes))}
        />
      </ChipRow>
      {isPreset && customMinutes === '' ? null : (
        <View>
          <TextField
            value={customMinutes}
            onChangeText={(text) => {
              const digits = text.replace(/[^0-9]/g, '');
              setCustomMinutes(digits);
              const parsed = Number(digits);
              if (parsed > 0 && parsed <= 240) {
                update({ ...config, plannedMs: parsed * MINUTE });
              }
            }}
            placeholder="minutos"
            keyboardType="number-pad"
            accessibilityLabel="duración en minutos"
          />
          <Caption>entre 1 y 240 minutos</Caption>
        </View>
      )}

      <Label>actividad</Label>
      <ChipRow>
        {activities.map((activity) => (
          <Chip
            key={activity.id}
            label={activity.label}
            selected={config.activityId === activity.id}
            onPress={() => update({ ...config, activityId: activity.id })}
          />
        ))}
        <Chip label="otra" selected={false} onPress={() => setNewActivity('')} />
      </ChipRow>
      {newActivity === null ? null : (
        <View>
          <TextField
            value={newActivity}
            onChangeText={setNewActivity}
            placeholder="nombre de la actividad"
            autoFocus
            onEndEditing={() => {
              const label = newActivity.trim().toLowerCase();
              if (label.length === 0) {
                setNewActivity(null);
                return;
              }
              // The key is the name: activities are the user's own vocabulary, and a
              // duplicate name is a duplicate activity.
              const existing = activitiesRepo.findByKey(label);
              const activity =
                existing ?? activitiesRepo.insert(label, label, Date.now());
              update({ ...config, activityId: activity.id });
              setActivityRevision((current) => current + 1);
              setNewActivity(null);
            }}
            accessibilityLabel="nombre de la actividad nueva"
          />
          <Caption>en minúscula, como todo en la app</Caption>
        </View>
      )}

      <Label>profundidad</Label>
      {DEPTHS.map((depth) => (
        <ChoiceCard
          key={depth.value}
          title={depth.title}
          description={depth.description}
          selected={config.depth === depth.value}
          onPress={() => update({ ...config, depth: depth.value })}
        />
      ))}

      <Label>bloqueo</Label>
      <ChipRow>
        <Chip label="nada" selected onPress={() => undefined} />
      </ChipRow>
      <Caption>bloquear apps llega en la fase 2</Caption>
    </Screen>
  );
}
