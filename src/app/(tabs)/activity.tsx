import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useDayStats } from '../../data';
import { Screen } from '../../design/components';
import { ActivityHeader, type ActivityView } from '../../features/activity/ActivityHeader';
import { LifetimeView } from '../../features/activity/LifetimeView';
import { MonthlyView } from '../../features/activity/MonthlyView';
import { WeeklyView } from '../../features/activity/WeeklyView';
import { useNow } from '../../lib/useNow';

/**
 * The activity tab: weekly, monthly or lifetime, chosen from the title. The lifetime
 * view is where Vesper's own blocks live (ADR-0016).
 */
export default function ActivityScreen() {
  const now = useNow(60_000);
  const stats = useDayStats();
  // `?view=lifetime` opens a view directly, for links and for reviewing screens.
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<ActivityView>(() =>
    params.view === 'month' || params.view === 'lifetime' ? params.view : 'week',
  );

  return (
    <Screen scroll inTabs>
      <ActivityHeader view={view} onChangeView={setView} />
      {view === 'week' ? (
        <WeeklyView stats={stats} now={now} />
      ) : view === 'month' ? (
        <MonthlyView stats={stats} now={now} />
      ) : (
        <LifetimeView stats={stats} now={now} />
      )}
    </Screen>
  );
}
