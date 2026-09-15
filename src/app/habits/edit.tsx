import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { useAppStore } from '../../data';
import { Button, Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { HabitForm } from '../../features/habits/HabitForm';

/** Edit a habit, or archive it. Archiving keeps the marks; the habit just stops counting. */
export default function EditHabitScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const habit = useAppStore((state) => state.habits.find((h) => h.id === id) ?? null);
  const upsertHabit = useAppStore((state) => state.upsertHabit);
  const archiveHabit = useAppStore((state) => state.archiveHabit);

  if (habit === null) {
    return (
      <Screen>
        <PageHeader title="Editar hábito" onBack={() => router.back()} />
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              Ese hábito ya no está.
            </Text>
            <Text variant="label" tone="secondary">
              Vuelve a la actividad y elige otro.
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  const confirmArchive = () => {
    Alert.alert('¿Archivar este hábito?', 'Las marcas siguen ahí y el hábito deja de contar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        style: 'destructive',
        onPress: () => {
          archiveHabit(habit.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <HabitForm
      title="Editar hábito"
      initial={habit}
      caption="Archivar no borra nada: las marcas siguen ahí y el hábito deja de contar."
      secondary={<Button variant="ghost" label="Archivar hábito" onPress={confirmArchive} />}
      onSubmit={(values) => {
        upsertHabit({ ...values, id: habit.id });
        router.back();
      }}
    />
  );
}
