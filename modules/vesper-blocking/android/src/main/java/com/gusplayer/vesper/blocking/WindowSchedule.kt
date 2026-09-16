package com.gusplayer.vesper.blocking

import java.util.Calendar

/** One occurrence of a window: epoch ms, end exclusive. */
data class WindowInstants(val start: Long, val end: Long)

/** What to arm for a window right now: the next start and the next end, epoch ms. */
data class AlarmInstants(val nextStart: Long?, val nextEnd: Long?)

/**
 * The clock arithmetic of a routine window, without AlarmManager. This is a line-by-
 * line mirror of `nextWindowInstants` in src/platform/routineWindows.ts, which mirrors
 * activeWindow/nextStart in src/domain/routines.ts: the TS version is the reference and
 * carries the tests; a change here must be a change there first.
 *
 * - Days are Monday first (Calendar's Sunday=1 is folded to index 6).
 * - The day starts at local midnight, so a 23- or 25-hour day is honoured.
 * - An end at or before the start crosses midnight: 21:30 → 06:30 ends the next day.
 * - A null end is the start plus the cap.
 * - A window that crossed midnight may have started yesterday, so "active now" looks
 *   at yesterday's occurrence as well as today's.
 * - The next start looks eight days ahead: a window on one weekday recurs in seven.
 */
object WindowSchedule {
  private const val MINUTE_MS = 60_000L
  private const val DAY_MS = 24 * 60 * MINUTE_MS
  private const val LOOKAHEAD_DAYS = 8

  /** Monday-first weekday index of an instant. */
  private fun weekdayOf(at: Long): Int {
    val calendar = Calendar.getInstance().apply { timeInMillis = at }
    return (calendar.get(Calendar.DAY_OF_WEEK) + 5) % 7
  }

  /** Local midnight of the day containing `at`. */
  private fun dayStartOf(at: Long): Long {
    val calendar = Calendar.getInstance().apply {
      timeInMillis = at
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    return calendar.timeInMillis
  }

  /** The window the spec would have if it started on the day containing `dayAt`. */
  fun windowOnDay(spec: WindowSpec, dayAt: Long): WindowInstants? {
    if (spec.days.getOrNull(weekdayOf(dayAt)) != true) {
      return null
    }
    val dayStart = dayStartOf(dayAt)
    val start = dayStart + spec.startMinute * MINUTE_MS
    val endMinute = spec.endMinute
    val end = when {
      endMinute == null -> start + spec.capMinutes * MINUTE_MS
      endMinute > spec.startMinute -> dayStart + endMinute * MINUTE_MS
      else -> dayStart + DAY_MS + endMinute * MINUTE_MS
    }
    return WindowInstants(start, end)
  }

  /** The window containing `now`, if the spec is inside one right now. */
  fun activeWindow(spec: WindowSpec, now: Long): WindowInstants? {
    for (dayAt in longArrayOf(now - DAY_MS, now)) {
      val window = windowOnDay(spec, dayAt) ?: continue
      if (now >= window.start && now < window.end) {
        return window
      }
    }
    return null
  }

  /** The first window whose start is at or after `at`, looking a week ahead. */
  fun nextWindow(spec: WindowSpec, at: Long): WindowInstants? {
    for (offset in 0 until LOOKAHEAD_DAYS) {
      val window = windowOnDay(spec, at + offset * DAY_MS) ?: continue
      if (window.start >= at) {
        return window
      }
    }
    return null
  }

  /**
   * The two instants to arm at `now`. Inside a window the end is that window's and
   * the start is the following occurrence's (strictly after the one already open, so
   * a start alarm handled at its own instant never re-arms itself). Outside, both
   * belong to the next occurrence. Both null when no day is on.
   */
  fun alarms(spec: WindowSpec, now: Long): AlarmInstants {
    val active = activeWindow(spec, now)
    if (active != null) {
      return AlarmInstants(nextStart = nextWindow(spec, active.start + 1)?.start, nextEnd = active.end)
    }
    val next = nextWindow(spec, now) ?: return AlarmInstants(null, null)
    return AlarmInstants(nextStart = next.start, nextEnd = next.end)
  }
}
