import { useRouter } from 'expo-router';

import { useAppStore } from '../../data';
import { Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { MAX_HABITS } from '../../domain/types';
import { HabitForm } from '../../features/habits/HabitForm';
import { useStrings } from '../../i18n';

/** A new habit, unless the five slots are taken: that is a product decision. */
export default function NewHabitScreen() {
  const t = useStrings();
  const router = useRouter();
  const activeCount = useAppStore(
    (state) => state.habits.filter((habit) => habit.archivedAt === null).length,
  );
  const upsertHabit = useAppStore((state) => state.upsertHabit);
  const left = MAX_HABITS - activeCount;

  if (left <= 0) {
    return (
      <Screen>
        <PageHeader title={t.habits.new.title} onBack={() => router.back()} />
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {t.habits.new.fullTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {t.habits.new.fullDescription}
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  return (
    <HabitForm
      title={t.habits.new.title}
      caption={t.habits.new.left(left)}
      onSubmit={(values) => {
        upsertHabit(values);
        router.back();
      }}
    />
  );
}
