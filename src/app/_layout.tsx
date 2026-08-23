import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_500Medium } from '@expo-google-fonts/literata/500Medium';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { stackScreenOptions } from '../design/navigation';

/**
 * Root layout. Serif is 70% of the effect, so nothing renders until Literata is
 * loaded — a flash of system sans is worse than a blank paper screen.
 *
 * TODO: horizontal swipe between inicio / sesión / vida is still undecided.
 * A Stack does not swipe. See the pending ADR-0009 before building the three
 * screens (docs/SPRINT_01.md, task 5).
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Literata_400Regular, Literata_500Medium });

  if (!fontsLoaded) {
    return null;
  }

  return <Stack screenOptions={stackScreenOptions} />;
}
