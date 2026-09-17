package com.gusplayer.vesper.blocking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Where a routine window's alarms land. Runs without JS: the app may be closed.
 *
 * - Start: if the window is open right now (an inexact alarm can be late enough to
 *   miss a short one) the window's plan goes to PlanStore and the service starts.
 *   Android lets a foreground service start from here because the app holds
 *   SYSTEM_ALERT_WINDOW, which blocking needs anyway.
 * - End: releases only if the running plan is this window's. A session the user
 *   started by hand, or another window's, is never cut short by a stranger's alarm.
 * - Plan end: the safety net under a JS plan with `endsAt` whose service was killed.
 * - Plan resume: the safety net under a break whose service was killed (ADR-0023).
 *
 * After either window alarm the next occurrence is armed again.
 */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val now = System.currentTimeMillis()
    when (intent.action) {
      ACTION_WINDOW_START -> {
        val spec = window(context, intent) ?: return
        val active = WindowSchedule.activeWindow(spec, now)
        if (active == null) {
          Log.w(TAG, "window ${spec.id} start alarm arrived outside the window; not starting")
        } else if (spec.packageNames.isEmpty()) {
          Log.w(TAG, "window ${spec.id} has no packages; not starting")
        } else if (PlanStore.sessionPlanRunning(context, now)) {
          // ADR-0019: a session the user started is never cut short or re-skinned by a
          // routine. JS starts the routine's session when this one ends.
          Log.i(TAG, "window ${spec.id} opens but a session plan is running; left alone")
        } else {
          Log.i(TAG, "window ${spec.id} opens; blocking until ${active.end}")
          BlockingService.apply(context, spec.plan(active.start, active.end))
        }
        WindowScheduler.arm(context, spec, now)
      }
      ACTION_WINDOW_END -> {
        val spec = window(context, intent) ?: return
        val plan = PlanStore.load(context)
        if (plan?.windowId == spec.id) {
          Log.i(TAG, "window ${spec.id} closes; releasing")
          BlockingService.release(context)
        } else {
          Log.i(TAG, "window ${spec.id} closes; running plan is not its own (${plan?.windowId}), left alone")
        }
        WindowScheduler.arm(context, spec, now)
      }
      ACTION_PLAN_END -> {
        val plan = PlanStore.load(context) ?: return
        val endsAt = plan.endsAt
        if (PlanStore.loadPause(context) != null) {
          // The end moves with the break; the resume path re-arms it.
          Log.i(TAG, "plan end alarm during a break; left to the resume")
        } else if (endsAt != null && endsAt <= now) {
          Log.i(TAG, "plan end alarm; releasing")
          BlockingService.release(context)
        }
      }
      ACTION_PLAN_RESUME -> {
        val pause = PlanStore.loadPause(context)
        if (pause != null && pause.until <= now) {
          Log.i(TAG, "plan resume alarm; resuming")
          BlockingService.resume(context, endsAt = null)
        }
      }
    }
  }

  /** The window the alarm names, or null when it was cancelled after the alarm was set. */
  private fun window(context: Context, intent: Intent): WindowSpec? {
    val id = intent.getStringExtra(EXTRA_WINDOW_ID) ?: return null
    val spec = PlanStore.loadWindow(context, id)
    if (spec == null) {
      Log.i(TAG, "alarm for forgotten window $id; ignoring")
    }
    return spec
  }

  companion object {
    private const val TAG = "VesperBlocking"
    const val ACTION_WINDOW_START = "com.gusplayer.vesper.blocking.WINDOW_START"
    const val ACTION_WINDOW_END = "com.gusplayer.vesper.blocking.WINDOW_END"
    const val ACTION_PLAN_END = "com.gusplayer.vesper.blocking.PLAN_END"
    const val ACTION_PLAN_RESUME = "com.gusplayer.vesper.blocking.PLAN_RESUME"
    const val EXTRA_WINDOW_ID = "windowId"
  }
}
