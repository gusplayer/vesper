import { ListGroup, ListRow, Sheet, Text } from '../../design/components';
import { useStrings } from '../../i18n';
import { isAndroid } from '../../platform/capabilities';
import { WORKOUT_FLOOR_MINUTES } from './countLine';

type IntoHealthSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * "Que llegue a Salud" (ADR-0055 §7): how Strava and Garmin Connect leave their workouts
 * in Health, or in Health Connect on Android, where a workout habit reads them. Vesper
 * never connects to those apps, so there is nothing to press: one row per app with its
 * path, and what to check when a workout does not count. No logos, and no primary
 * button, because the screen underneath already has its own. The habit form and
 * Ajustes › Salud open it.
 */
export function IntoHealthSheet({ visible, onClose }: IntoHealthSheetProps) {
  const t = useStrings().habits.intoHealth;
  const here = isAndroid ? t.android : t.ios;

  return (
    <Sheet visible={visible} title={t.title} onClose={onClose}>
      <Text variant="label" tone="secondary">
        {here.intro}
      </Text>
      <ListGroup footer={here.footer(WORKOUT_FLOOR_MINUTES)}>
        {here.sources.map((source) => (
          <ListRow key={source.name} label={source.name} description={source.path} />
        ))}
      </ListGroup>
    </Sheet>
  );
}
