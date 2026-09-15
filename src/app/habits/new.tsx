import { useRouter } from 'expo-router';

import { useAppStore } from '../../data';
import { Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { MAX_HABITS } from '../../domain/types';
import { HabitForm } from '../../features/habits/HabitForm';

/** A new habit, unless the five slots are taken: that is a product decision. */
export default function NewHabitScreen() {
  const router = useRouter();
  const activeCount = useAppStore(
    (state) => state.habits.filter((habit) => habit.archivedAt === null).length,
  );
  const upsertHabit = useAppStore((state) => state.upsertHabit);
  const left = MAX_HABITS - activeCount;

  if (left <= 0) {
    return (
      <Screen>
        <PageHeader title="Nuevo hábito" onBack={() => router.back()} />
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              Ya tenés cinco hábitos.
            </Text>
            <Text variant="label" tone="secondary">
              Cinco es el máximo, a propósito: la atención no escala. Archivá uno para hacer
              lugar.
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  return (
    <HabitForm
      title="Nuevo hábito"
      caption={`Podés tener ${left} más`}
      onSubmit={(values) => {
        upsertHabit(values);
        router.back();
      }}
    />
  );
}
