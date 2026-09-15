import { weeklyProgress, type HabitProgress } from '../../domain/habits';
import { weekProgress, weekWindow, type WeekProgress } from '../../domain/week';
import * as habitsRepo from '../repositories/habits';
import * as sessionsRepo from '../repositories/sessions';
import * as settingsRepo from '../repositories/settings';

/**
 * Read models. A query composes repositories into what one screen needs to render,
 * so the screen asks one question instead of five. Queries never write.
 */

export type WeekSnapshot = {
  week: WeekProgress;
  habits: HabitProgress[];
  /** Every session started this week, whatever its outcome. */
  sessionCount: number;
};

/** The week so far: focus against the goal, and every habit against its own. */
export function loadWeekSnapshot(now: number): WeekSnapshot {
  const window = weekWindow(now);
  const sessions = sessionsRepo.listBetween(window.from, window.to);

  return {
    week: weekProgress(sessions, settingsRepo.getWeeklyTargetMs(), now),
    habits: weeklyProgress(
      habitsRepo.listActive(),
      habitsRepo.listMarksBetween(window.fromKey, window.toKey),
      window.toKey,
    ),
    sessionCount: sessions.length,
  };
}
