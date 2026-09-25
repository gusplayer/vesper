import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useDayStats, useHasDemoData } from '../../data';
import { Screen, StatusNote, Tappable } from '../../design/components';
import { ActivityHeader, type ActivityView } from '../../features/activity/ActivityHeader';
import { LifetimeView } from '../../features/activity/LifetimeView';
import { MonthlyView } from '../../features/activity/MonthlyView';
import { WeeklyView } from '../../features/activity/WeeklyView';
import { useStrings } from '../../i18n';
import { useNow } from '../../lib/useNow';

/**
 * The activity tab: weekly, monthly or lifetime, chosen from the title. The lifetime
 * view is where Vesper's own blocks live (ADR-0016); the habits are marked in the
 * weekly one (ADR-0047 §7). While any seeded row is left, a line under the title says
 * the figures include sample data and opens Ajustes, where it is removed (§1).
 */
export default function ActivityScreen() {
  const t = useStrings();
  const router = useRouter();
  const now = useNow(60_000);
  const stats = useDayStats();
  const hasDemoData = useHasDemoData();
  // `?view=lifetime` opens a view directly, for links and for reviewing screens.
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<ActivityView>(() =>
    params.view === 'month' || params.view === 'lifetime' ? params.view : 'week',
  );

  return (
    // A view switch starts the new view at its top, not at the old one's scroll.
    <Screen scroll inTabs scrollResetKey={view}>
      <ActivityHeader view={view} onChangeView={setView} />
      {hasDemoData ? (
        <Tappable
          onPress={() => router.push('/(tabs)/settings')}
          accessibilityLabel={t.activity.demo.line}
          accessibilityHint={t.activity.demo.hint}
        >
          <StatusNote text={t.activity.demo.line} align="center" />
        </Tappable>
      ) : null}
      {view === 'week' ? (
        <WeeklyView stats={stats} now={now} />
      ) : view === 'month' ? (
        <MonthlyView stats={stats} now={now} />
      ) : (
        <LifetimeView stats={stats} now={now} onShowWeek={() => setView('week')} />
      )}
    </Screen>
  );
}
