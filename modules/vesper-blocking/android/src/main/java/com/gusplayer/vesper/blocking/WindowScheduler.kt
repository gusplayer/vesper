package com.gusplayer.vesper.blocking

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log

/**
 * Arms and disarms the AlarmManager alarms behind routine windows. Two alarms per
 * window, start and end, each a broadcast to AlarmReceiver keyed by a `vesper://`
 * URI so the PendingIntents never collide. Exact and allowed while idle when the app
 * may schedule exact alarms (SCHEDULE_EXACT_ALARM, a Settings toggle on 12+); a
 * ten-minute window otherwise, which is the shortest Android honours anyway.
 *
 * Every arm computes both instants from WindowSchedule at the current clock, so
 * calling it again after a fire re-arms the next occurrence, and calling it at boot
 * rebuilds what the reboot forgot. AlarmManager keeps one alarm per PendingIntent:
 * re-arming replaces, never duplicates.
 */
object WindowScheduler {
  private const val TAG = "VesperBlocking"
  private const val INEXACT_SLOP_MS = 10 * 60_000L

  /** Registers the window and arms it. Replaces a window with the same id. */
  fun schedule(context: Context, spec: WindowSpec) {
    PlanStore.saveWindow(context, spec)
    arm(context, spec, System.currentTimeMillis())
  }

  /** Disarms and forgets a window. A running plan it raised keeps running until its end. */
  fun cancel(context: Context, id: String) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarms.cancel(pending(context, id, AlarmReceiver.ACTION_WINDOW_START))
    alarms.cancel(pending(context, id, AlarmReceiver.ACTION_WINDOW_END))
    PlanStore.removeWindow(context, id)
    Log.i(TAG, "window $id cancelled")
  }

  /** Re-arms every registered window: after boot, an update, or a clock change. */
  fun armAll(context: Context, now: Long = System.currentTimeMillis()): List<WindowSpec> {
    val windows = PlanStore.loadWindows(context)
    windows.forEach { arm(context, it, now) }
    return windows
  }

  /** Arms the next start and end of one window as of `now`. */
  fun arm(context: Context, spec: WindowSpec, now: Long) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val instants = WindowSchedule.alarms(spec, now)
    set(alarms, instants.nextStart, pending(context, spec.id, AlarmReceiver.ACTION_WINDOW_START))
    set(alarms, instants.nextEnd, pending(context, spec.id, AlarmReceiver.ACTION_WINDOW_END))
    Log.i(TAG, "window ${spec.id} armed: start=${instants.nextStart} end=${instants.nextEnd} exact=${canScheduleExact(context)}")
  }

  /**
   * A safety net under a plan with `endsAt` that came from JS: the service stops
   * itself on time while alive, and this alarm clears the plan if it was killed first.
   */
  fun armPlanEnd(context: Context, endsAt: Long) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    set(alarms, endsAt, planEndPending(context))
  }

  fun cancelPlanEnd(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarms.cancel(planEndPending(context))
  }

  /**
   * The safety net under a break: the service resumes watching at `until` by itself
   * while alive, and this alarm brings it back if it was killed during the break.
   */
  fun armPlanResume(context: Context, until: Long) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    set(alarms, until, planResumePending(context))
  }

  fun cancelPlanResume(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    alarms.cancel(planResumePending(context))
  }

  fun canScheduleExact(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return true
    }
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return alarms.canScheduleExactAlarms()
  }

  private fun set(alarms: AlarmManager, at: Long?, pending: PendingIntent) {
    if (at == null) {
      alarms.cancel(pending)
      return
    }
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()) {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
      } else {
        alarms.setWindow(AlarmManager.RTC_WAKEUP, at, INEXACT_SLOP_MS, pending)
      }
    } catch (error: SecurityException) {
      // The toggle was flipped off between the check and the call; inexact still works.
      Log.w(TAG, "exact alarm refused, falling back to a window: ${error.message}")
      alarms.setWindow(AlarmManager.RTC_WAKEUP, at, INEXACT_SLOP_MS, pending)
    }
  }

  private fun pending(context: Context, id: String, action: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java)
      .setAction(action)
      .setData(Uri.parse("vesper://window/${Uri.encode(id)}"))
      .putExtra(AlarmReceiver.EXTRA_WINDOW_ID, id)
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun planEndPending(context: Context): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java)
      .setAction(AlarmReceiver.ACTION_PLAN_END)
      .setData(Uri.parse("vesper://plan/end"))
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun planResumePending(context: Context): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java)
      .setAction(AlarmReceiver.ACTION_PLAN_RESUME)
      .setData(Uri.parse("vesper://plan/resume"))
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }
}
