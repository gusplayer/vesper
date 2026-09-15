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
 * asks for that, and it says what is happening: the shield title and 'Sesión de foco'.
 *
 * START_STICKY: if the system kills it, it comes back and reads the plan from
 * PlanStore. It stops itself on release() and at `endsAt`.
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

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    isRunning = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    val plan = PlanStore.load(this)
    if (plan == null) {
      Log.i(TAG, "no plan stored; stopping")
      stopSelf()
      return START_NOT_STICKY
    }
    if (plan.endsAt != null && plan.endsAt <= System.currentTimeMillis()) {
      Log.i(TAG, "plan already over; stopping")
      PlanStore.clear(this)
      stopSelf()
      return START_NOT_STICKY
    }
    startInForeground(plan)
    restartWatcher(plan)
    main.removeCallbacks(stopAtEnd)
    plan.endsAt?.let { main.postDelayed(stopAtEnd, it - System.currentTimeMillis()) }
    return START_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    main.removeCallbacks(stopAtEnd)
    watcher?.stop()
    watcher = null
    screenReceiver?.let { runCatching { unregisterReceiver(it) } }
    screenReceiver = null
    Shield.hide()
    Log.i(TAG, "service stopped")
    super.onDestroy()
  }

  private fun startInForeground(plan: Plan) {
    ensureChannel()
    val notification = buildNotification(plan)
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

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW).apply {
      description = CHANNEL_DESCRIPTION
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(plan: Plan): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launch?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_vesper_focus)
      .setContentTitle(plan.shield.title)
      .setContentText(SESSION_TEXT)
      .setOngoing(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_STATUS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(contentIntent)
      .build()
  }

  companion object {
    private const val TAG = "VesperBlocking"
    const val ACTION_APPLY = "com.gusplayer.vesper.blocking.APPLY"
    const val ACTION_STOP = "com.gusplayer.vesper.blocking.STOP"
    private const val CHANNEL_ID = "vesper_focus"
    // Spanish because the user sees it in the notification settings. UI is Spanish.
    private const val CHANNEL_NAME = "Sesión de foco"
    private const val CHANNEL_DESCRIPTION = "Se muestra mientras una sesión bloquea apps."
    private const val SESSION_TEXT = "Sesión de foco"
    private const val NOTIFICATION_ID = 7101

    @Volatile
    var isRunning: Boolean = false
      private set

    fun apply(context: Context, plan: Plan) {
      PlanStore.save(context, plan)
      val intent = Intent(context, BlockingService::class.java).setAction(ACTION_APPLY)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun release(context: Context) {
      PlanStore.clear(context)
      Shield.hide()
      context.stopService(Intent(context, BlockingService::class.java))
    }
  }
}
