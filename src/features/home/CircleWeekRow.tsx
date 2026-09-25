import { useRouter } from 'expo-router';

import { Stack } from '../../design/components';
import { useStrings } from '../../i18n';
import { ChallengeWeek } from '../circle/ChallengeWeek';
import { useLinkedChallengeWeeks } from '../circle/useChallengeLink';
import { pickHomeChallenge } from './homeChallenge';

type CircleWeekRowProps = {
  now: number;
  /** 0 for Monday: the cell that breathes, the same one the grid above uses. */
  todayIndex: number;
};

/**
 * The challenge's week under the grid of focus: the same seven days, the same ink,
 * today breathing. It is the home page's only reference to a challenge that is not a
 * word, and it is there only while one runs.
 */
export function CircleWeekRow({ now, todayIndex }: CircleWeekRowProps) {
  const t = useStrings().circle;
  const router = useRouter();
  const challenge = pickHomeChallenge(useLinkedChallengeWeeks(now));

  if (challenge === null) {
    return null;
  }
  return (
    <Stack align="center" gap="xs">
      <ChallengeWeek
        days={challenge.days}
        todayIndex={todayIndex}
        pitch="md"
        onPress={() => router.push({ pathname: '/circle/challenge', params: { id: challenge.id } })}
        accessibilityLabel={t.challenge.openA11y(challenge.name)}
      />
    </Stack>
  );
}
