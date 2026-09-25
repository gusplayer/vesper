import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useAppStore } from '../../data';
import { Button, NoticeCard, PageHeader, Screen } from '../../design/components';
import { activeHabitCount, canAddHabit } from '../../domain/habits';
import { MAX_HABITS } from '../../domain/types';
import { HabitForm } from '../../features/habits/HabitForm';
import { useStrings } from '../../i18n';
import { goBack } from '../../lib/goBack';

/** A new habit, unless the five slots are taken: that is a product decision. */
export default function NewHabitScreen() {
  const t = useStrings();
  const router = useRouter();
  const activeCount = useAppStore((state) => activeHabitCount(state.habits));
  const upsertHabit = useAppStore((state) => state.upsertHabit);
  // The store holds the cap on its own (rule 4): a save it refuses stays here and says why.
  const [refused, setRefused] = useState(false);
  const left = MAX_HABITS - activeCount;

  if (!canAddHabit(activeCount)) {
    return (
      <Screen footer={<Button label={t.common.back} onPress={() => goBack(router)} />}>
        <PageHeader title={t.habits.new.title} onBack={() => goBack(router)} />
        <NoticeCard title={t.habits.new.fullTitle} body={t.habits.new.fullDescription} />
      </Screen>
    );
  }

  return (
    <HabitForm
      title={t.habits.new.title}
      caption={refused ? t.habits.new.fullDescription : t.habits.new.left(left)}
      onSubmit={(values) => {
        if (!upsertHabit(values)) {
          setRefused(true);
          return;
        }
        goBack(router);
      }}
    />
  );
}
