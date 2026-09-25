import { ME, type Challenge, type Habit } from '../../domain/types';

/**
 * Where the user stands in a challenge, which is not the same as "am I a participant":
 *
 * - `linked`: in it, with an active habit of theirs behind it. The only state that can
 *   mark a day, or nudge anyone.
 * - `invited`: a participant with no active habit behind it. Someone in the circle
 *   added them when creating it — the server lists them from the start, and the habit
 *   is local, so it never travels — or the habit it used was archived. Either way
 *   nothing can be marked until they join, and joining is what links (or creates) the
 *   habit: `joinChallenge` in the circle store keeps the participants as they are.
 * - `out`: not a participant.
 */
export type ChallengeLink = 'linked' | 'invited' | 'out';

export function challengeLink(challenge: Challenge, habits: readonly Habit[]): ChallengeLink {
  if (!challenge.participantIds.includes(ME)) {
    return 'out';
  }
  const habit = habits.find((candidate) => candidate.id === challenge.habitId);
  return habit !== undefined && habit.archivedAt === null ? 'linked' : 'invited';
}
