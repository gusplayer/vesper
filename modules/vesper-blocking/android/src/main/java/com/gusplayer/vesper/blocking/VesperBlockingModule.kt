package com.gusplayer.vesper.blocking

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import expo.modules.interfaces.permissions.PermissionsStatus
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** The plan as JS sends it. Mirrors `NativePlan` in modules/vesper-blocking/index.ts. */
class PlanRecord : Record {
  @Field val packageNames: List<String> = emptyList()
  @Field val mode: String = "block"
  /** Epoch ms; JS numbers arrive as Double. */
  @Field val endsAt: Double? = null
  /** Epoch ms; the notification counts up from here when there is no end. Now when absent. */
  @Field val startedAt: Double? = null
  /** An open session: `endsAt` is only its cap and the notification counts up. */
  @Field val open: Boolean = false
  @Field val shieldTitle: String = "Vesper"
  @Field val shieldSubtitle: String = ""
  @Field val shieldButton: String = "Volver"
  /** "Se libera a las {time}"; null keeps the Spanish default. */
  @Field val shieldReleasesAt: String? = null
  @Field val channelName: String? = null
  @Field val channelDescription: String? = null
  @Field val sessionText: String? = null
  @Field val breakText: String? = null
}

/** A routine window as JS sends it. Mirrors `NativeWindow` in index.ts. */
class WindowRecord : Record {
  @Field val id: String = ""
  @Field val startMinute: Int = 0
  @Field val endMinute: Int? = null
  @Field val capMinutes: Int = 8 * 60
  @Field val days: List<Boolean> = emptyList()
  @Field val packageNames: List<String> = emptyList()
  @Field val mode: String = "block"
  @Field val shieldTitle: String = "Vesper"
  @Field val shieldSubtitle: String = ""
  @Field val shieldButton: String = "Volver"
  @Field val shieldReleasesAt: String? = null
  @Field val channelName: String? = null
  @Field val channelDescription: String? = null
  @Field val sessionText: String? = null
  @Field val breakText: String? = null
}

/** The copy a record carries for the notification; a missing field keeps the default. */
private fun notificationCopy(
  channelName: String?,
  channelDescription: String?,
  sessionText: String?,
  breakText: String?,
): NotificationCopy {
  val defaults = NotificationCopy()
  return NotificationCopy(
    channelName = channelName ?: defaults.channelName,
    channelDescription = channelDescription ?: defaults.channelDescription,
    sessionText = sessionText ?: defaults.sessionText,
    breakText = breakText ?: defaults.breakText,
  )
}

class UsageAccessMissingException : CodedException("E_USAGE_ACCESS", "Usage access is not granted", null)
class BadPlanException(reason: String) : CodedException("E_BAD_PLAN", reason, null)
class NoPlanException : CodedException("E_NO_PLAN", "No plan is applied", null)

/**
 * The JS-facing surface of Android blocking. Thin on purpose: it checks the
 * permissions, opens their Settings pages, lists launchable apps, hands a plan to
 * BlockingService and a window to WindowScheduler, and pauses or resumes the running
 * plan for a break. Everything user-facing on the shield and the notification comes
 * from JS, in the app's language.
 */
class VesperBlockingModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val main = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("VesperBlocking")

    Events(EVENT_SERVICE_STATE)

    OnCreate {
      // JS is alive again: a plan whose end passed while the process was dead is
      // stale, and a service still running for it is stopped. Alarms that a force
      // stop or an update wiped are set again from the stored windows.
      val plan = PlanStore.load(context)
      val endsAt = plan?.endsAt
      if (endsAt != null && endsAt <= System.currentTimeMillis()) {
        Log.i(TAG, "stored plan ended at $endsAt; clearing")
        BlockingService.release(context)
      } else if (endsAt != null) {
        // A force stop drops every alarm, this one included; the plan is still ahead.
        WindowScheduler.armPlanEnd(context, endsAt)
      }
      WindowScheduler.armAll(context)
      BlockingService.onStateChanged = { running ->
        main.post { runCatching { sendEvent(EVENT_SERVICE_STATE, mapOf("running" to running)) } }
      }
    }

    OnDestroy {
      BlockingService.onStateChanged = null
    }

    Function("getStatus") {
      mapOf(
        "usageAccess" to Permissions.hasUsageAccess(context),
        "overlay" to Permissions.canDrawOverlays(context),
        "running" to BlockingService.isRunning,
        "exactAlarm" to WindowScheduler.canScheduleExact(context),
        "notifications" to NotificationManagerCompat.from(context).areNotificationsEnabled(),
      )
    }

    Function("isShielding") { Shield.isShowing }

    Function("serviceAlive") { BlockingService.isRunning }

    Function("canScheduleExactAlarms") { WindowScheduler.canScheduleExact(context) }

    Function("listWindows") { PlanStore.loadWindows(context).map { it.id } }

    AsyncFunction("openUsageAccessSettings") {
      // With a package URI Android 10+ lands on the app's own row on most devices;
      // if the OEM cannot resolve that, the general list is the fallback.
      openSettings(Settings.ACTION_USAGE_ACCESS_SETTINGS, withPackage = true)
    }

    AsyncFunction("openOverlaySettings") {
      openSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, withPackage = true)
    }

    AsyncFunction("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        openSettings(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, withPackage = true)
      }
    }

    AsyncFunction("openBatterySettings") {
      // The list, not the per-app dialog: the dialog needs REQUEST_IGNORE_BATTERY_
      // OPTIMIZATIONS, which Play only allows for a narrow set of app kinds.
      openSettings(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS, withPackage = false)
    }

    AsyncFunction("requestNotificationPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        promise.resolve(NotificationManagerCompat.from(context).areNotificationsEnabled())
        return@AsyncFunction
      }
      val permissions = appContext.permissions
      if (permissions == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      permissions.askForPermissions(
        { result ->
          val granted = result[Manifest.permission.POST_NOTIFICATIONS]?.status == PermissionsStatus.GRANTED
          promise.resolve(granted)
        },
        Manifest.permission.POST_NOTIFICATIONS,
      )
    }

    AsyncFunction("listLaunchableApps") { withIcons: Boolean ->
      AppCatalog.launchable(context, withIcons).map { app ->
        mapOf(
          "packageName" to app.packageName,
          "label" to app.label,
          "iconBase64" to app.iconBase64,
        )
      }
    }

    AsyncFunction("applyPlan") { record: PlanRecord ->
      if (!Permissions.hasUsageAccess(context)) {
        throw UsageAccessMissingException()
      }
      val plan = Plan(
        packageNames = record.packageNames.toSet(),
        mode = parseMode(record.mode),
        endsAt = record.endsAt?.toLong(),
        shield = ShieldCopy(
          record.shieldTitle,
          record.shieldSubtitle,
          record.shieldButton,
          record.shieldReleasesAt ?: ShieldCopy.DEFAULT_RELEASE_TEMPLATE,
        ),
        startedAt = record.startedAt?.toLong() ?: System.currentTimeMillis(),
        open = record.open,
        notification = notificationCopy(record.channelName, record.channelDescription, record.sessionText, record.breakText),
      )
      Log.i(TAG, "applyPlan: ${plan.packageNames.size} packages, ${plan.mode}, endsAt=${plan.endsAt}, open=${plan.open}")
      BlockingService.apply(context, plan)
    }

    AsyncFunction("release") {
      Log.i(TAG, "release")
      BlockingService.release(context)
    }

    AsyncFunction("pausePlan") { untilMs: Double ->
      if (PlanStore.load(context) == null) {
        throw NoPlanException()
      }
      Log.i(TAG, "pausePlan until ${untilMs.toLong()}")
      BlockingService.pause(context, untilMs.toLong())
    }

    AsyncFunction("resumePlan") { endsAt: Double? ->
      if (PlanStore.load(context) == null) {
        throw NoPlanException()
      }
      Log.i(TAG, "resumePlan endsAt=${endsAt?.toLong()}")
      BlockingService.resume(context, endsAt?.toLong())
    }

    AsyncFunction("scheduleWindow") { record: WindowRecord ->
      if (record.id.isEmpty()) {
        throw BadPlanException("window id must not be empty")
      }
      if (record.days.size != WindowSpec.DAYS_PER_WEEK) {
        throw BadPlanException("days must have ${WindowSpec.DAYS_PER_WEEK} entries, got ${record.days.size}")
      }
      if (record.startMinute !in 0 until MINUTES_PER_DAY) {
        throw BadPlanException("startMinute out of range: ${record.startMinute}")
      }
      val spec = WindowSpec(
        id = record.id,
        startMinute = record.startMinute,
        endMinute = record.endMinute?.takeIf { it in 0 until MINUTES_PER_DAY },
        capMinutes = record.capMinutes.coerceAtLeast(1),
        days = record.days,
        packageNames = record.packageNames.toSet(),
        mode = parseMode(record.mode),
        shield = ShieldCopy(
          record.shieldTitle,
          record.shieldSubtitle,
          record.shieldButton,
          record.shieldReleasesAt ?: ShieldCopy.DEFAULT_RELEASE_TEMPLATE,
        ),
        notification = notificationCopy(record.channelName, record.channelDescription, record.sessionText, record.breakText),
      )
      Log.i(TAG, "scheduleWindow ${spec.id}: ${spec.startMinute}-${spec.endMinute ?: "cap ${spec.capMinutes}"} days=${spec.days} ${spec.packageNames.size} packages")
      WindowScheduler.schedule(context, spec)
    }

    AsyncFunction("cancelWindow") { id: String ->
      WindowScheduler.cancel(context, id)
    }
  }

  private fun parseMode(mode: String): PlanMode = when (mode) {
    "block" -> PlanMode.BLOCK
    "allow" -> PlanMode.ALLOW
    else -> throw BadPlanException("mode must be 'block' or 'allow', got '$mode'")
  }

  private fun openSettings(action: String, withPackage: Boolean) {
    val flags = Intent.FLAG_ACTIVITY_NEW_TASK
    if (withPackage) {
      val scoped = Intent(action, Uri.parse("package:${context.packageName}")).addFlags(flags)
      if (runCatching { context.startActivity(scoped) }.isSuccess) {
        return
      }
    }
    context.startActivity(Intent(action).addFlags(flags))
  }

  companion object {
    private const val TAG = "VesperBlocking"
    private const val EVENT_SERVICE_STATE = "onServiceStateChanged"
    private const val MINUTES_PER_DAY = 24 * 60
  }
}
