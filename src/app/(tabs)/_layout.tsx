import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '../../design/components';

/** Four tabs, text only, like Brick: Foco, Horarios, Actividad, Ajustes. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Foco' }} />
      <Tabs.Screen name="schedules" options={{ title: 'Horarios' }} />
      <Tabs.Screen name="activity" options={{ title: 'Actividad' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
