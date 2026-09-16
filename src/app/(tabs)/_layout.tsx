import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '../../design/components';
import { useStrings } from '../../i18n';

/** Four tabs, text only, like Brick: Focus, Rutinas, Actividad, Ajustes. */
export default function TabsLayout() {
  const t = useStrings();
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t.common.tabs.focus }} />
      <Tabs.Screen name="schedules" options={{ title: t.common.tabs.routines }} />
      <Tabs.Screen name="activity" options={{ title: t.common.tabs.activity }} />
      <Tabs.Screen name="settings" options={{ title: t.common.tabs.settings }} />
    </Tabs>
  );
}
