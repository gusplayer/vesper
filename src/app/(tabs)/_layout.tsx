import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '../../design/components';

/** Four tabs, text only, like Brick: Focus, Rutinas, Actividad, Ajustes. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Focus' }} />
      <Tabs.Screen name="schedules" options={{ title: 'Rutinas' }} />
      <Tabs.Screen name="activity" options={{ title: 'Actividad' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
