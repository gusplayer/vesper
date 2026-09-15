package com.gusplayer.vesper.blocking

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telecom.TelecomManager
import android.util.Log

/**
 * Watches which app is in front and raises or lowers the shield. Polls
 * UsageStatsManager.queryEvents on the main looper about every 800 ms while the screen
 * is on; the service pauses it when the screen goes off.
 *
 * Verdict per resumed package:
 * - Vesper itself and the launcher clear the shield: the user left the blocked app.
 * - SystemUI and the keyboard are ignored: they sit on top of whatever is there.
 * - The dialer is never blocked (calls).
 * - In ALLOW mode system Settings passes too, so permissions stay reachable; in BLOCK
 *   mode an explicit choice wins.
 */
class ForegroundWatcher(private val context: Context, private val plan: Plan) {
  private enum class Verdict { BLOCK, CLEAR, IGNORE }

  private val handler = Handler(Looper.getMainLooper())
  private val usage = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
  private val ownPackage = context.packageName
  private val launchers: Set<String> = findLaunchers()
  private val neutral: Set<String> = setOfNotNull(SYSTEM_UI, currentIme())
  private val dialer: String? = runCatching {
    (context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager).defaultDialerPackage
  }.getOrNull()

  /** The end of the last window queried; the next one overlaps it by [OVERLAP_MS]. */
  private var lastQueryTs = System.currentTimeMillis() - LOOKBACK_MS
  /** The newest event acted on, so the overlap never replays one. */
  private var lastEventTs = 0L
  private var running = false

  private val tick = object : Runnable {
    override fun run() {
      if (!running) {
        return
      }
      poll()
      handler.postDelayed(this, INTERVAL_MS)
    }
  }

  fun start() {
    if (running) {
      return
    }
    running = true
    Log.i(TAG, "watching ${plan.packageNames.size} packages in ${plan.mode} mode")
    handler.post(tick)
  }

  fun stop() {
    running = false
    handler.removeCallbacks(tick)
  }

  private fun poll() {
    val now = System.currentTimeMillis()
    val events = try {
      usage.queryEvents(lastQueryTs - OVERLAP_MS, now)
    } catch (error: Exception) {
      Log.w(TAG, "queryEvents failed: ${error.message}")
      return
    }
    lastQueryTs = now
    val event = UsageEvents.Event()
    var latestPackage: String? = null
    var latestClass: String? = null
    var latestTs = lastEventTs
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      if (event.timeStamp <= lastEventTs || !isResume(event.eventType)) {
        continue
      }
      if (event.timeStamp >= latestTs) {
        latestTs = event.timeStamp
        latestPackage = event.packageName
        latestClass = event.className
      }
    }
    val packageName = latestPackage ?: return
    lastEventTs = latestTs
    when (verdict(packageName, latestClass)) {
      Verdict.BLOCK -> {
        Log.i(TAG, "blocked app in front: $packageName")
        Shield.show(context, plan.shield, packageName)
      }
      Verdict.CLEAR -> Shield.hide()
      Verdict.IGNORE -> Unit
    }
  }

  private fun verdict(packageName: String, className: String?): Verdict {
    if (packageName == ownPackage) {
      // The fallback activity is ours: seeing it resume must not take it down again.
      return if (className == ShieldActivity::class.java.name) Verdict.IGNORE else Verdict.CLEAR
    }
    if (packageName in launchers || packageName == dialer) {
      return Verdict.CLEAR
    }
    if (packageName in neutral) {
      return Verdict.IGNORE
    }
    val chosen = packageName in plan.packageNames
    return when (plan.mode) {
      PlanMode.BLOCK -> if (chosen) Verdict.BLOCK else Verdict.CLEAR
      PlanMode.ALLOW -> if (chosen || packageName == SETTINGS) Verdict.CLEAR else Verdict.BLOCK
    }
  }

  private fun isResume(type: Int): Boolean {
    @Suppress("DEPRECATION")
    val legacy = UsageEvents.Event.MOVE_TO_FOREGROUND
    return type == legacy || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && type == UsageEvents.Event.ACTIVITY_RESUMED)
  }

  private fun findLaunchers(): Set<String> {
    val pm = context.packageManager
    val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
    val all = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.queryIntentActivities(home, PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_DEFAULT_ONLY.toLong()))
    } else {
      @Suppress("DEPRECATION")
      pm.queryIntentActivities(home, PackageManager.MATCH_DEFAULT_ONLY)
    }
    // Settings declares FallbackHome (priority -1000) for the moments before the user
    // unlocks; it is not a launcher and must stay blockable.
    return all.filter { it.priority >= 0 }.map { it.activityInfo.packageName }.toSet()
  }

  /** "com.google.android.inputmethod.latin/.LatinIME" -> the package half. */
  private fun currentIme(): String? {
    val ime = runCatching {
      Settings.Secure.getString(context.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)
    }.getOrNull() ?: return null
    return ime.substringBefore('/').takeIf { it.isNotEmpty() }
  }

  companion object {
    private const val TAG = "VesperBlocking"
    private const val INTERVAL_MS = 800L
    private const val OVERLAP_MS = 2_000L
    /** On start, look this far back to catch the app already in front. */
    private const val LOOKBACK_MS = 5_000L
    private const val SYSTEM_UI = "com.android.systemui"
    private const val SETTINGS = "com.android.settings"
  }
}
