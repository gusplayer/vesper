import { Stack } from 'expo-router';

import { stackScreenOptions } from '../../design/navigation';

/**
 * Onboarding, in order: welcome → goal → apps → screen-time → health → routine →
 * routine-set → notifications → tour. Each screen pushes the next; the last one marks
 * onboarding done and the root guard swaps to the tabs.
 */
export default function OnboardingLayout() {
  return <Stack screenOptions={stackScreenOptions} />;
}
