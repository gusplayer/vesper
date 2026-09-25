import { useMemo } from 'react';

import { useAppStore, useCircleStore, useMyChallengeWeeks, type MyChallengeWeek } from '../../data';
import type { Challenge } from '../../domain/types';
import { challengeLink, type ChallengeLink } from './challengeLink';

/** `challengeLink` for a screen, read against the user's habits as they change. */
export function useChallengeLink(challenge: Challenge | null): ChallengeLink {
  const habits = useAppStore((state) => state.habits);
  return challenge === null ? 'out' : challengeLink(challenge, habits);
}

/**
 * The user's own week in each challenge that is really theirs to mark: `linked`, with
 * an active habit behind it. A challenge whose habit was archived still has a `habitId`,
 * so `useMyChallengeWeeks` alone would keep drawing it on Focus and in Actividad as if
 * it counted; here it waits for the user to join again.
 */
export function useLinkedChallengeWeeks(now: number): MyChallengeWeek[] {
  const weeks = useMyChallengeWeeks(now);
  const challenges = useCircleStore((state) => state.challenges);
  const habits = useAppStore((state) => state.habits);
  return useMemo(
    () =>
      weeks.filter((week) => {
        const challenge = challenges.find((candidate) => candidate.id === week.id);
        return challenge !== undefined && challengeLink(challenge, habits) === 'linked';
      }),
    [weeks, challenges, habits],
  );
}
