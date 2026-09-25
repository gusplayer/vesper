import { useRouter } from 'expo-router';

import { useKudosReceived } from '../../data';
import { Tappable, Text } from '../../design/components';
import { useStrings } from '../../i18n';
import { challengeOutlookText } from '../circle/challengeText';
import { useLinkedChallengeWeeks } from '../circle/useChallengeLink';
import { pickHomeChallenge } from './homeChallenge';

type CircleLineProps = {
  now: number;
};

/**
 * What Focus says about the circle (ADR-0031): one line, and only when there is
 * something true to say today — a challenge that is running, or the cheers of this
 * week. Tapping it opens the challenge or the circle. No badge, no count, no dot:
 * when there is nothing, there is nothing.
 */
export function CircleLine({ now }: CircleLineProps) {
  const t = useStrings().circle;
  const router = useRouter();
  const challenge = pickHomeChallenge(useLinkedChallengeWeeks(now));
  const kudos = useKudosReceived(now);

  if (challenge !== null) {
    const outlook = challengeOutlookText(challenge.outlook, t);
    return (
      <Tappable
        onPress={() => router.push({ pathname: '/circle/challenge', params: { id: challenge.id } })}
        accessibilityLabel={t.home.challengeA11y(challenge.name, outlook)}
      >
        <Text variant="caption" tone="secondary">
          {t.home.challenge(challenge.name, outlook)}
        </Text>
      </Tappable>
    );
  }

  // Names, not the count: a cheer from someone no longer in the circle still counts,
  // and a line with no name in it would read " te dieron ánimo esta semana."
  if (kudos.names.length > 0) {
    const line = t.kudos.received(kudos.names);
    return (
      <Tappable onPress={() => router.push('/circle')} accessibilityLabel={line}>
        <Text variant="caption" tone="secondary">
          {line}
        </Text>
      </Tappable>
    );
  }
  return null;
}
