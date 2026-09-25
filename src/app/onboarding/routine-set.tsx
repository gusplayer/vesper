import { router } from 'expo-router';

import { goBack } from '../../lib/goBack';

import { useOnboardingDraft } from '../../data/onboardingDraft';
import { Button, PageHeader, ScheduleCard, Screen, Text } from '../../design/components';
import { commitOnboarding } from '../../features/onboarding/commit';
import { readAppsStepKind } from '../../features/onboarding/readAppsStepKind';
import { stepProgress } from '../../features/onboarding/steps';
import { windowText } from '../../features/schedules/format';
import { useStrings } from '../../i18n';
import { selectionSummary } from '../../platform/blocking';

function holdsApps(token: string | null): boolean {
  const summary = selectionSummary(token);
  return summary.apps + summary.categories + summary.websites > 0;
}

/**
 * A preview of the routine the way the Routines tab will list it — its name, its
 * window, its mode — then save. It is the Rutinas card itself in its preview state:
 * nothing presses, and the badge stands where the switch will be.
 */
export default function RoutineSetScreen() {
  const t = useStrings();
  const modeName = useOnboardingDraft((state) => state.modeName);
  const schedule = useOnboardingDraft((state) => state.schedule);
  const selectionToken = useOnboardingDraft((state) => state.selectionToken);
  const appIds = useOnboardingDraft((state) => state.appIds);
  // A routine whose mode blocks no apps is a valid choice (ADR-0047 §1): the preview
  // says it as a plain fact, the way Rutinas does. The example catalogue counts as a
  // list here; the page that showed it already said the phone cannot block.
  const kind = readAppsStepKind();
  const blocksNone =
    kind === 'example' ? appIds.length === 0 : kind === 'notGranted' || !holdsApps(selectionToken);

  const copy = t.onboarding.routineSet;

  const save = () => {
    commitOnboarding({ withSchedule: true });
    router.push('/onboarding/notifications');
  };

  return (
    <Screen
      scroll
      footer={
        <>
          <Button label={copy.save} onPress={save} />
          <Button label={copy.edit} variant="ghost" onPress={() => goBack(router)} />
        </>
      }
    >
      <PageHeader onBack={() => goBack(router)} progress={stepProgress('routine-set', t.onboarding.progress)} />
      <Text variant="title">{copy.title}</Text>
      <Text variant="label" tone="secondary">
        {copy.subtitle}
      </Text>

      <ScheduleCard
        preview
        title={modeName}
        lines={[windowText(schedule, t.format, t.routines.edit.nextDay), copy.modeLine(modeName)]}
        enabled
        badge={copy.activeLabel}
        warning={blocksNone ? t.onboarding.apps.blocksNone : undefined}
        warningTone="secondary"
      />
    </Screen>
  );
}
