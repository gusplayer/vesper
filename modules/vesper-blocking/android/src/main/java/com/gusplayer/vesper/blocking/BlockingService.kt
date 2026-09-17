package com.gusplayer.vesper.blocking

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * The foreground service behind a focus session. It exists so the watcher can keep
 * polling while Vesper is in the background; the notification is the price Android
 * asks for that, and it is Android's lock screen for the session (ADR-0023): the
 * shield title, "Sesión de foco" and a native chronometer counting down to the
 * plan's end (up from its start when it has none). Tapping it opens the session.
 *
 * START_STICKY: if the system kills it, it comes back and reads the plan from
 * PlanStore. It stops itself on release() and at `endsAt` (a main-looper callback
 * while alive; an AlarmReceiver PLAN_END alarm if it was killed before then).
 *
 * A break is the service's too (ADR-0023, decision 5): `pause(until)` takes the shield
 * down, stops the watcher and turns the notification into the break countdown, and
 * the service resumes watching at `until` by itself: a main-looper callback while it
 * lives, a PLAN_RESUME alarm if it was killed, and a look at the stored pause when
 * START_STICKY brings it back. No JS in that path.
 *
 * `onStateChanged` tells the module, and through it JS, when it comes and goes.
 */
class BlockingService : Service() {
  private val main = Handler(Looper.getMainLooper())
  private var watcher: ForegroundWatcher? = null
  private var screenReceiver: BroadcastReceiver? = null
  private val stopAtEnd = Runnable {
    Log.i(TAG, "plan ended; stopping")
    PlanStore.clear(this)
    stopSelf()
  }
  private val resumeAtEnd = Runnable {
    Log.i(TAG, "break over; resuming")
    resume(this, endsAt = null)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    isRunning = true
    onStateChanged?.invoke(true)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    val now = System.currentTimeMillis()
    val plan = PlanStore.load(this)
    if (plan == null) {
      Log.i(TAG, "no plan stored; stopping")
      stopSelf()
      return START_NOT_STICKY
    }
    val pause = PlanStore.loadPause(this)
    if (pause != null && pause.until > now) {
      // Whether the pause was just asked for or found again after a restart, the
      // rest of the break is spent the same way.
      enterBreak(plan, pause)
      return START_STICKY
    }
    if (pause != null) {
      // A restart after the break ran out with nobody to end it: the plan's end moves
      // by what the break took, as it would have had the service lived.
      Log.i(TAG, "restarted after the break ended; resuming")
      PlanStore.clearPause(this)
      val shifted = plan.copy(endsAt = plan.endsAt?.let { it + (pause.until - pause.startedAt) })
      PlanStore.save(this, shifted)
      shifted.endsAt?.let { WindowScheduler.armPlanEnd(this, it) }
      enterFocus(shifted, now)
      return START_STICKY
    }
    if (plan.endsAt != null && plan.endsAt <= now) {
      Log.i(TAG, "plan already over; stopping")
      PlanStore.clear(this)
      stopSelf()
      return START_NOT_STICKY
    }
    enterFocus(plan, now)
    return START_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    onStateChanged?.invoke(false)
    main.removeCallbacks(stopAtEnd)
    main.removeCallbacks(resumeAtEnd)
    watcher?.stop()
    watcher = null
    screenReceiver?.let { runCatching { unregisterReceiver(it) } }
    screenReceiver = null
    Shield.hide()
    Log.i(TAG, "service stopped")
    super.onDestroy()
  }

  /** Watching, with the focus notification. Also the way back from a break. */
  private fun enterFocus(plan: Plan, now: Long) {
    main.removeCallbacks(resumeAtEnd)
    WindowScheduler.cancelPlanResume(this)
    startInForeground(plan, buildFocusNotification(plan))
    restartWatcher(plan)
    main.removeCallbacks(stopAtEnd)
    plan.endsAt?.let { main.postDelayed(stopAtEnd, it - now) }
  }

  /** Not watching, the shield down, the notification counting the break down. */
  private fun enterBreak(plan: Plan, pause: Pause) {
    Log.i(TAG, "paused until ${pause.until}")
    main.removeCallbacks(stopAtEnd)
    watcher?.stop()
    watcher = null
    Shield.hide()
    startInForeground(plan, buildBreakNotification(plan, pause))
    main.removeCallbacks(resumeAtEnd)
    main.postDelayed(resumeAtEnd, (pause.until - System.currentTimeMillis()).coerceAtLeast(0L))
    WindowScheduler.armPlanResume(this, pause.until)
  }

  private fun startInForeground(plan: Plan, notification: Notification) {
    ensureChannel(plan.notification)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun restartWatcher(plan: Plan) {
    watcher?.stop()
    val next = ForegroundWatcher(this, plan)
    watcher = next
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    if (power.isInteractive) {
      next.start()
    }
    if (screenReceiver == null) {
      screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          // `watcher` is null during a break, so the screen coming on wakes nothing.
          when (intent.action) {
            Intent.ACTION_SCREEN_ON -> watcher?.start()
            Intent.ACTION_SCREEN_OFF -> watcher?.stop()
          }
        }
      }.also {
        registerReceiver(it, IntentFilter().apply {
          addAction(Intent.ACTION_SCREEN_ON)
          addAction(Intent.ACTION_SCREEN_OFF)
        })
      }
    }
  }

  /**
   * The channel, named in the app's language. Creating a channel that exists updates
   * its name and description, so a language change reaches Settings › Notifications
   * with the next plan.
   *
   * Default importance, not low: Android hides "silent" (low) notifications on the
   * lock screen by default, and this notification is the lock screen (ADR-0023). The
   * notification itself never makes a sound (`setSilent`). A channel's importance
   * cannot be raised once it exists, so the low one from phase 1 is deleted and this
   * one has a new id.
   */
  private fun ensureChannel(copy: NotificationCopy) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.deleteNotificationChannel(LEGACY_CHANNEL_ID)
    val channel = NotificationChannel(CHANNEL_ID, copy.channelName, NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = copy.channelDescription
      setShowBadge(false)
      setSound(null, null)
      enableVibration(false)
    }
    manager.createNotificationChannel(channel)
  }

  /**
   * Counting down to the end, or up from the start when there is none or the session
   * is open (its `endsAt` is only a cap the service honours in silence).
   */
  private fun buildFocusNotification(plan: Plan): Notification {
    val builder = baseNotification(plan).setContentText(plan.notification.sessionText)
    val endsAt = plan.endsAt
    if (endsAt != null && !plan.open) {
      builder.setWhen(endsAt).setChronometerCountDown(true)
    } else {
      builder.setWhen(plan.startedAt)
    }
    return builder.build()
  }

  /** "Pausa", counting down to when watching resumes. */
  private fun buildBreakNotification(plan: Plan, pause: Pause): Notification =
    baseNotification(plan)
      .setContentText(plan.notification.breakText)
      .setWhen(pause.until)
      .setChronometerCountDown(true)
      .build()

  /**
   * What both notifications share: public (it is the lock screen), ongoing, silent,
   * a native chronometer so no timer of ours is ever involved, and a tap that lands on
   * the session route. On Android 16 it asks to be promoted to a live update (the chip
   * in the status bar); older versions show a plain ongoing notification.
   */
  private fun baseNotification(plan: Plan): NotificationCompat.Builder {
    val open = Intent(Intent.ACTION_VIEW, Uri.parse(SESSION_URI))
      .setPackage(packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val contentIntent = PendingIntent.getActivity(
      this,
      0,
      open,
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val builder = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_vesper_focus)
      .setContentTitle(plan.shield.title)
      .setOngoing(true)
      .setSilent(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(contentIntent)
    if (Build.VERSION.SDK_INT >= PROMOTED_SDK) {
      // Live update (Android 16). No short critical text: it would need a timer of our
      // own to stay true; the chronometer already counts.
      builder.setRequestPromotedOngoing(true)
    }
    return builder
  }

  companion object {
    private const val TAG = "VesperBlocking"
    const val ACTION_APPLY = "com.gusplayer.vesper.blocking.APPLY"
    const val ACTION_PAUSE = "com.gusplayer.vesper.blocking.PAUSE"
    const val ACTION_RESUME = "com.gusplayer.vesper.blocking.RESUME"
    const val ACTION_STOP = "com.gusplayer.vesper.blocking.STOP"
    private const val CHANNEL_ID = "vesper_session"
    /** Phase 1's low-importance channel, removed on the next start. */
    private const val LEGACY_CHANNEL_ID = "vesper_focus"
    private const val NOTIFICATION_ID = 7101
    /** The session route, the way expo-router's linking resolves it (scheme in app.json). */
    private const val SESSION_URI = "vesper://session/active"
    /** Build.VERSION_CODES.BAKLAVA: promoted ongoing notifications arrived there. */
    private const val PROMOTED_SDK = 36

    @Volatile
    var isRunning: Boolean = false
      private set

    /** Set by the module while JS is alive; called on the main thread with `isRunning`. */
    @Volatile
    var onStateChanged: ((Boolean) -> Unit)? = null

    /**
     * Saves the plan and starts the service. From a receiver with the app closed
     * Android 12+ may refuse a background foreground-service start; the overlay
     * permission exempts us, and the refusal is logged rather than thrown so an
     * alarm never crashes the process.
     *
     * Applying the same session again (the app came back and re-applied) keeps the
     * start it already had, so the count-up notification does not jump.
     */
    fun apply(context: Context, plan: Plan) {
      val stored = PlanStore.load(context)
      val effective = if (stored != null && stored.windowId == null && plan.windowId == null &&
        stored.packageNames == plan.packageNames && stored.mode == plan.mode
      ) {
        plan.copy(startedAt = stored.startedAt)
      } else {
        plan
      }
      PlanStore.save(context, effective)
      WindowScheduler.cancelPlanResume(context)
      effective.endsAt?.let { WindowScheduler.armPlanEnd(context, it) } ?: WindowScheduler.cancelPlanEnd(context)
      start(context, ACTION_APPLY)
    }

    /**
     * A break until `until`: the shield comes down and nothing is watched, but the
     * service and its notification stay. The plan's end alarm is disarmed for the
     * break's length, since the end will move by what the break takes.
     */
    fun pause(context: Context, until: Long) {
      if (PlanStore.load(context) == null) {
        Log.i(TAG, "pause with no plan; ignoring")
        return
      }
      PlanStore.savePause(context, Pause(startedAt = System.currentTimeMillis(), until = until))
      WindowScheduler.cancelPlanEnd(context)
      start(context, ACTION_PAUSE)
    }

    /**
     * Ends the break. With `endsAt` (JS knows the new planned end) the plan takes it;
     * without (the service resuming on its own, or an alarm) the old end is pushed
     * back by what the break took. Nothing happens without a plan.
     */
    fun resume(context: Context, endsAt: Long?) {
      val plan = PlanStore.load(context)
      if (plan == null) {
        Log.i(TAG, "resume with no plan; ignoring")
        return
      }
      val pause = PlanStore.loadPause(context)
      val now = System.currentTimeMillis()
      val newEnd = endsAt ?: plan.endsAt?.let { end ->
        if (pause == null) end else end + (minOf(now, pause.until) - pause.startedAt)
      }
      PlanStore.save(context, plan.copy(endsAt = newEnd))
      WindowScheduler.cancelPlanResume(context)
      newEnd?.let { WindowScheduler.armPlanEnd(context, it) } ?: WindowScheduler.cancelPlanEnd(context)
      start(context, ACTION_RESUME)
    }

    fun release(context: Context) {
      PlanStore.clear(context)
      WindowScheduler.cancelPlanEnd(context)
      WindowScheduler.cancelPlanResume(context)
      Shield.hide()
      context.stopService(Intent(context, BlockingService::class.java))
    }

    private fun start(context: Context, action: String) {
      val intent = Intent(context, BlockingService::class.java).setAction(action)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (error: Exception) {
        Log.w(TAG, "service start refused (${error.javaClass.simpleName}): ${error.message}")
      }
    }
  }
}
