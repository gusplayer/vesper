import { useLocalSearchParams, useRouter } from 'expo-router';

import { goBack } from '../../lib/goBack';
import { Alert } from 'react-native';

import { useAppStore } from '../../data';
import { Button, Card, PageHeader, Screen, Stack, Text } from '../../design/components';
import { HabitForm } from '../../features/habits/HabitForm';
import { useStrings } from '../../i18n';

/** Edit a habit, or archive it. Archiving keeps the marks; the habit just stops counting. */
export default function EditHabitScreen() {
  const t = useStrings();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const habit = useAppStore((state) => state.habits.find((h) => h.id === id) ?? null);
  const upsertHabit = useAppStore((state) => state.upsertHabit);
  const archiveHabit = useAppStore((state) => state.archiveHabit);

  if (habit === null) {
    return (
      <Screen>
        <PageHeader title={t.habits.edit.title} onBack={() => goBack(router)} />
        <Card>
          <Stack gap="xs">
            <Text variant="body" weight="medium">
              {t.habits.edit.goneTitle}
            </Text>
            <Text variant="label" tone="secondary">
              {t.habits.edit.goneDescription}
            </Text>
          </Stack>
        </Card>
      </Screen>
    );
  }

  const confirmArchive = () => {
    Alert.alert(t.habits.edit.archiveQuestion, t.habits.edit.archiveMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.habits.edit.archive,
        style: 'destructive',
        onPress: () => {
          archiveHabit(habit.id);
          goBack(router);
        },
      },
    ]);
  };

  return (
    <HabitForm
      title={t.habits.edit.title}
      initial={habit}
      caption={t.habits.edit.archiveCaption}
      secondary={<Button variant="ghost" label={t.habits.edit.archiveHabit} onPress={confirmArchive} />}
      onSubmit={(values) => {
        upsertHabit({ ...values, id: habit.id });
        goBack(router);
      }}
    />
  );
}
