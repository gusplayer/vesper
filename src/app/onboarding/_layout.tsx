import { Stack } from 'expo-router';

import { stackScreenOptions } from '../../design/navigation';

/**
 * Onboarding, in the order of ADR-0016: welcome → goal → screen-time (→ usage-access
 * on Android) → health → apps → routine → routine-set → notifications → tour. The
 * permission comes before the apps on purpose: the real picker only shows what a
 * phone that said yes can block. Each screen pushes the next; the last one marks
 * onboarding done and the root guard swaps to the tabs.
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
