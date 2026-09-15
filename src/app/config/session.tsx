import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { activityKeyOf } from '../../domain/activities';
import {
  PLANNED_MINUTES_MAX,
  PLANNED_MINUTES_MIN,
  PRESET_MINUTES,
  type SessionConfig,
} from '../../domain/session';
import { MINUTE } from '../../domain/time';
import { DEPTHS } from '../../domain/types';
import * as activitiesRepo from '../../db/repositories/activities';
import * as sessionConfigRepo from '../../db/repositories/sessionConfig';
import { Caption } from '../../design/components/Caption';
import { ChoiceCard } from '../../design/components/ChoiceCard';
import { FieldGroup } from '../../design/components/FieldGroup';
import { Label } from '../../design/components/Label';
import { OptionChips } from '../../design/components/OptionChips';
import { Screen } from '../../design/components/Screen';
import { ScreenHeader } from '../../design/components/ScreenHeader';
import { TextField } from '../../design/components/TextField';
import { DEPTH_DESCRIPTION, DEPTH_LABEL } from '../../lib/labels';
import { digitsOnly, emptyToNull, parsePlannedMinutes } from '../../lib/text';
import { useRevision } from '../../lib/useRevision';

const CUSTOM = 'otra';
const NEW_ACTIVITY = 'otra';

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
  const [activityRevision, bumpActivities] = useRevision();
  const activities = useMemo(() => activitiesRepo.listActive(), [activityRevision]);
  const [config, setConfig] = useState<SessionConfig | null>(() =>
    sessionConfigRepo.loadOrDefault(),
  );
  const [customMinutes, setCustomMinutes] = useState<string | null>(null);
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
  const isPreset = (PRESET_MINUTES as ReadonlyArray<number>).includes(minutes);
  // The custom field stays open once opened, even while empty: it closes when a
  // preset is tapped, never because of a keystroke.
  const customOpen = customMinutes !== null || !isPreset;

  function createActivity(): void {
    const label = emptyToNull(newActivity ?? '')?.toLowerCase() ?? null;
    setNewActivity(null);
    if (label === null || config === null) {
      return;
    }
    // The key is the name: activities are the user's own vocabulary, and a duplicate
    // name is a duplicate activity.
    const key = activityKeyOf(label);
    const activity = activitiesRepo.findByKey(key) ?? activitiesRepo.insert(key, label, Date.now());
    update({ ...config, activityId: activity.id });
    bumpActivities();
  }

  return (
    <Screen scroll>
      <ScreenHeader left="sesión" right="listo" onPressRight={() => router.back()} />

      <Label>duración</Label>
      <OptionChips
        options={[
          ...PRESET_MINUTES.map((preset) => ({ value: String(preset) })),
          { value: CUSTOM },
        ]}
        selected={customOpen ? CUSTOM : String(minutes)}
        onSelect={(value) => {
          if (value === CUSTOM) {
            setCustomMinutes(String(minutes));
            return;
          }
          setCustomMinutes(null);
          update({ ...config, plannedMs: Number(value) * MINUTE });
        }}
      />
      {customOpen ? (
        <FieldGroup>
          <TextField
            value={customMinutes ?? String(minutes)}
            onChangeText={(text) => {
              const digits = digitsOnly(text);
              setCustomMinutes(digits);
              const parsed = parsePlannedMinutes(digits);
              if (parsed !== null) {
                update({ ...config, plannedMs: parsed * MINUTE });
              }
            }}
            placeholder="minutos"
            keyboardType="number-pad"
            accessibilityLabel="duración en minutos"
          />
          <Caption>{`entre ${PLANNED_MINUTES_MIN} y ${PLANNED_MINUTES_MAX} minutos`}</Caption>
        </FieldGroup>
      ) : null}

      <Label>actividad</Label>
      <OptionChips
        options={[
          ...activities.map((activity) => ({ value: activity.id, label: activity.label })),
          { value: NEW_ACTIVITY },
        ]}
        selected={newActivity === null ? config.activityId : NEW_ACTIVITY}
        onSelect={(value) => {
          if (value === NEW_ACTIVITY) {
            setNewActivity('');
            return;
          }
          update({ ...config, activityId: value });
        }}
      />
      {newActivity === null ? null : (
        <FieldGroup>
          <TextField
            value={newActivity}
            onChangeText={setNewActivity}
            placeholder="nombre de la actividad"
            autoFocus
            onEndEditing={createActivity}
            accessibilityLabel="nombre de la actividad nueva"
          />
          <Caption>en minúscula, como todo en la app</Caption>
        </FieldGroup>
      )}

      <Label>profundidad</Label>
      {DEPTHS.map((depth) => (
        <ChoiceCard
          key={depth}
          title={DEPTH_LABEL[depth]}
          description={DEPTH_DESCRIPTION[depth]}
          selected={config.depth === depth}
          onPress={() => update({ ...config, depth })}
        />
      ))}

      <Label>bloqueo</Label>
      <OptionChips options={[{ value: 'nada' }]} selected="nada" onSelect={() => undefined} />
      <Caption>bloquear apps llega en la fase 2</Caption>
    </Screen>
  );
}
