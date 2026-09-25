import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useAppStore, useChallengesByHabit, useCircleStore } from '../../data';
import { Button, NoticeCard, PageHeader, Screen } from '../../design/components';
import { HabitForm, type HabitChallenge } from '../../features/habits/HabitForm';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';
import { useNow } from '../../lib/useNow';

/** A minute is fine: the only thing the clock decides here is whether a challenge has ended. */
const CLOCK_MS = 60_000;

/**
 * Edit a habit, or archive it. Archiving takes it off the list and frees a slot; the
 * marks stay in the database, but no screen lists archived habits yet, so the copy
 * promises nothing about getting it back.
 *
 * A habit that is a challenge's says so (ADR-0031): the target is the challenge's and
 * cannot drift from it, a row opens the challenge, and archiving names it.
 */
export default function EditHabitScreen() {
  const t = useStrings();
  const router = useRouter();
  const now = useNow(CLOCK_MS);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const habit = useAppStore((state) => state.habits.find((h) => h.id === id) ?? null);
  const upsertHabit = useAppStore((state) => state.upsertHabit);
  const archiveHabit = useAppStore((state) => state.archiveHabit);
  const linked = useChallengesByHabit(now).get(id ?? '');
  const challengeTarget = useCircleStore(
    (state) => state.challenges.find((challenge) => challenge.id === linked?.id)?.weeklyTarget,
  );

  // An archived habit still renders the form: archiving goes back right away, and
  // switching to the 'gone' card under the route's fade would flash it.
  if (habit === null) {
    return (
      <Screen footer={<Button label={t.common.back} onPress={() => goBack(router)} />}>
        <PageHeader title={t.habits.edit.title} onBack={() => goBack(router)} />
        <NoticeCard title={t.habits.edit.goneTitle} body={t.habits.edit.goneDescription} />
      </Screen>
    );
  }

  const challenge: HabitChallenge | undefined =
    linked === undefined || challengeTarget === undefined
      ? undefined
      : { id: linked.id, line: t.circle.challenge.habitLine(linked.others), weeklyTarget: challengeTarget };

  const confirmArchive = () => {
    Alert.alert(
      t.habits.edit.archiveQuestion,
      linked === undefined ? t.habits.edit.archiveMessage : t.habits.edit.archiveChallengeMessage(linked.name),
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.habits.edit.archive,
          style: 'destructive',
          onPress: () => {
            archiveHabit(habit.id);
            goBack(router);
          },
        },
      ],
    );
  };

  return (
    <HabitForm
      title={t.habits.edit.title}
      initial={habit}
      challenge={challenge}
      caption={t.habits.edit.archiveCaption}
      secondary={<Button variant="ghost" tone="danger" label={t.habits.edit.archiveHabit} onPress={confirmArchive} />}
      onSubmit={(values) => {
        upsertHabit({ ...values, id: habit.id });
        goBack(router);
      }}
    />
  );
}
