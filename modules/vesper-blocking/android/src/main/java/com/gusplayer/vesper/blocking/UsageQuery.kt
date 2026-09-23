package com.gusplayer.vesper.blocking

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log

/** Foreground time of one package inside a window. `iconBase64` as in LaunchableApp. */
data class PackageUsage(val packageName: String, val label: String, val iconBase64: String?, val ms: Long)

/**
 * How long each chosen package was in front between two instants (ADR-0029). Folds
 * UsageStatsManager.queryEvents per activity: a package is in front while at least
 * one of its activities is resumed, so the interval opens with the first resume and
 * closes when the last resumed activity pauses or stops. Folding per package alone
 * undercounts: an app that hands over from one activity to another (Chrome's first
 * run, a splash) fires RESUMED B, PAUSED A, STOPPED A, and the stop of A would close
 * B's interval. An interval still open at `to` is clipped there; an app already in
 * front at `from` starts counting at its first event inside the window, so the figure
 * is a floor, never more than what Settings shows.
 *
 * Read on demand and never stored: the phone keeps about a week of events, which is
 * as far back as the activity tab ever asks. Nothing here touches the shield.
 */
object UsageQuery {
  fun query(context: Context, fromMs: Long, toMs: Long, packageNames: Set<String>, withIcons: Boolean): List<PackageUsage> {
    if (packageNames.isEmpty() || toMs <= fromMs) {
      return emptyList()
    }
    val usage = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = try {
      usage.queryEvents(fromMs, toMs)
    } catch (error: Exception) {
      Log.w(TAG, "queryEvents failed: ${error.message}")
      return emptyList()
    }
    val totals = HashMap<String, Long>()
    val openSince = HashMap<String, Long>()
    /** The activities of each package resumed right now, by class name. */
    val resumed = HashMap<String, MutableSet<String>>()
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val packageName = event.packageName ?: continue
      if (packageName !in packageNames) {
        continue
      }
      val at = event.timeStamp.coerceIn(fromMs, toMs)
      val activity = event.className ?: ""
      val front = resumed.getOrPut(packageName) { HashSet() }
      when {
        isResume(event.eventType) -> {
          if (front.add(activity) && front.size == 1) {
            openSince[packageName] = at
          }
        }
        isPause(event.eventType) -> {
          if (front.remove(activity) && front.isEmpty()) {
            val since = openSince.remove(packageName) ?: continue
            totals[packageName] = (totals[packageName] ?: 0L) + (at - since).coerceAtLeast(0L)
          }
        }
      }
    }
    for ((packageName, since) in openSince) {
      totals[packageName] = (totals[packageName] ?: 0L) + (toMs - since).coerceAtLeast(0L)
    }
    val pm = context.packageManager
    return packageNames
      .map { packageName -> describe(pm, packageName, totals[packageName] ?: 0L, withIcons) }
      .sortedByDescending { it.ms }
  }

  private fun describe(pm: PackageManager, packageName: String, ms: Long, withIcons: Boolean): PackageUsage {
    val info = runCatching {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.getApplicationInfo(packageName, PackageManager.ApplicationInfoFlags.of(0L))
      } else {
        @Suppress("DEPRECATION")
        pm.getApplicationInfo(packageName, 0)
      }
    }.getOrNull()
    // An uninstalled package keeps its name as the label: the row is still honest.
    val label = info?.let { pm.getApplicationLabel(it).toString() } ?: packageName
    val icon = if (withIcons && info != null) AppCatalog.icon(packageName) { info.loadIcon(pm) } else null
    return PackageUsage(packageName, label, icon, ms)
  }

  private fun isResume(type: Int): Boolean {
    @Suppress("DEPRECATION")
    val legacy = UsageEvents.Event.MOVE_TO_FOREGROUND
    return type == legacy || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && type == UsageEvents.Event.ACTIVITY_RESUMED)
  }

  private fun isPause(type: Int): Boolean {
    @Suppress("DEPRECATION")
    val legacy = UsageEvents.Event.MOVE_TO_BACKGROUND
    if (type == legacy) {
      return true
    }
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      (type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.ACTIVITY_STOPPED)
  }

  private const val TAG = "VesperBlocking"
}
