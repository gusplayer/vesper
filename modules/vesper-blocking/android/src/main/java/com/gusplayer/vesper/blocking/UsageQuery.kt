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
 * B's interval. An app already in front at `from` starts counting at its first event
 * inside the window, so the figure is a floor, never more than what Settings shows.
 *
 * An interval that never sees its close is the one way this could report more than
 * Settings does, and over a week's window it would be hours of it: a reboot with the
 * app in front logs DEVICE_SHUTDOWN, not ACTIVITY_PAUSED; a force stop logs nothing at
 * all; the event log rotates. Three guards keep the floor a floor, in this order:
 * DEVICE_SHUTDOWN and the screen going dark close every open interval where they
 * happen; DEVICE_STARTUP drops whatever is still open, since the phone was off for an
 * unknown stretch and no honest end can be guessed; and an interval still open at `to`
 * counts only if it began less than [MAX_OPEN_MS] ago. Dropping a too-long interval
 * whole, rather than clipping it, is the floor-honest choice: the app really in front
 * at `to` opened its interval far more recently than that.
 *
 * Read on demand and never stored: the phone keeps about a week of events, which is
 * as far back as the activity tab ever asks. Nothing here touches the shield.
 */
object UsageQuery {
  fun query(context: Context, fromMs: Long, toMs: Long, packageNames: Set<String>, withIcons: Boolean): List<PackageUsage> {
    if (packageNames.isEmpty() || toMs <= fromMs) {
      return emptyList()
    }
    // The icons below come from AppCatalog's cache; this is what keeps it honest when
    // the picker was never opened in this process.
    AppCatalog.listen(context)
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
      val at = event.timeStamp.coerceIn(fromMs, toMs)
      // These carry no package of ours (or none at all) and are read before the
      // filter: they say something about every open interval at once.
      if (isShutdown(event.eventType) || isScreenOff(event.eventType)) {
        // The phone went down, or the display did: nothing is in front past here. An
        // app the user goes back to opens a fresh interval on its next resume, which
        // is what the screen-time figure in Settings counts too.
        closeAll(totals, openSince, resumed, at)
        continue
      }
      if (isStartup(event.eventType)) {
        // The phone came up with intervals still open, so their app was never paused
        // and the shutdown that should have closed them is missing (before Android 12
        // it is never logged). There is no honest end to give them.
        openSince.clear()
        resumed.clear()
        continue
      }
      val packageName = event.packageName ?: continue
      if (packageName !in packageNames) {
        continue
      }
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
      val stillOpen = (toMs - since).coerceAtLeast(0L)
      if (stillOpen > MAX_OPEN_MS) {
        // A close that never came: a force stop, a reboot with no DEVICE_SHUTDOWN, a
        // truncated log. Counting it would put hours into the life card and into what
        // the circle sees.
        Log.i(TAG, "dropping ${stillOpen}ms left open by $packageName")
        continue
      }
      totals[packageName] = (totals[packageName] ?: 0L) + stillOpen
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

  /** Closes every open interval at `at`, as a pause for each would have. */
  private fun closeAll(
    totals: HashMap<String, Long>,
    openSince: HashMap<String, Long>,
    resumed: HashMap<String, MutableSet<String>>,
    at: Long,
  ) {
    for ((packageName, since) in openSince) {
      totals[packageName] = (totals[packageName] ?: 0L) + (at - since).coerceAtLeast(0L)
    }
    openSince.clear()
    resumed.clear()
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

  /** Android 12+ logs the shutdown; before that a reboot leaves nothing behind. */
  private fun isShutdown(type: Int): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == UsageEvents.Event.DEVICE_SHUTDOWN

  private fun isStartup(type: Int): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && type == UsageEvents.Event.DEVICE_STARTUP

  /** The display went dark. Nothing is in front of a screen that is off. */
  private fun isScreenOff(type: Int): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && type == UsageEvents.Event.SCREEN_NON_INTERACTIVE

  private const val TAG = "VesperBlocking"

  /**
   * The longest interval with no close in it that is still believable. A real session
   * in front breaks far sooner than this: the display times out and the activity is
   * paused. Four hours leaves room for a film watched to the end on a screen the app
   * itself keeps awake, and still catches the reboot that left an interval open for
   * days inside a week-long window.
   */
  private const val MAX_OPEN_MS = 4 * 60 * 60_000L
}
