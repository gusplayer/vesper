package com.gusplayer.vesper.blocking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * A reboot forgets every alarm; so does an app update, and a clock or time-zone
 * change moves the instants they were set for. On each, every registered window is
 * armed again from the current clock, and a window that is open right now raises its
 * plan straight away, unless that occurrence started before the window's `notBefore`
 * (WindowSchedule.activeWindow says so; ADR-0026 §7). Runs without JS.
 *
 * BOOT_COMPLETED only, never LOCKED_BOOT_COMPLETED: SharedPreferences sit in
 * credential-encrypted storage and are unreadable before the first unlock.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action !in HANDLED) {
      return
    }
    val now = System.currentTimeMillis()
    val windows = WindowScheduler.armAll(context, now)
    Log.i(TAG, "$action: re-armed ${windows.size} windows")

    // A plan that ended while the phone was off is stale. A session plan still ahead
    // outranks any window (ADR-0019: the routine waits); otherwise a window open now
    // wins over whatever else was stored.
    val stored = PlanStore.load(context)
    if (stored?.endsAt != null && stored.endsAt <= now) {
      PlanStore.clear(context)
    }
    val sessionRunning = PlanStore.sessionPlanRunning(context, now)
    val open = windows
      .mapNotNull { spec -> WindowSchedule.activeWindow(spec, now)?.let { spec to it } }
      .filter { (spec, _) -> spec.packageNames.isNotEmpty() }
      .maxByOrNull { (_, window) -> window.start }
    if (open == null && stored?.windowId != null) {
      // A window's plan with no window open: the window changed or was cancelled
      // while the phone was off. Nothing should be blocking on its behalf.
      PlanStore.clear(context)
    }
    if (sessionRunning) {
      if (open != null) {
        Log.i(TAG, "$action: window ${open.first.id} is open but a session plan is running; left alone")
      }
      val plan = PlanStore.load(context)
      if (action == Intent.ACTION_BOOT_COMPLETED && plan != null && plan.endsAt != null) {
        // A JS session with an end that is still ahead: the service was killed by
        // the reboot, START_STICKY does not survive one, so it is started again.
        Log.i(TAG, "$action: resuming session plan until ${plan.endsAt}")
        BlockingService.apply(context, plan)
      }
    } else if (open != null) {
      val (spec, window) = open
      Log.i(TAG, "$action: window ${spec.id} is open; starting service until ${window.end}")
      BlockingService.apply(context, spec.plan(window.start, window.end))
    }
  }

  companion object {
    private const val TAG = "VesperBlocking"
    private val HANDLED = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED,
    )
  }
}
