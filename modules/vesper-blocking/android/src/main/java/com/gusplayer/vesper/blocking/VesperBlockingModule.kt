package com.gusplayer.vesper.blocking

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Log
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
  @Field val shieldTitle: String = "Vesper"
  @Field val shieldSubtitle: String = ""
  @Field val shieldButton: String = "Volver"
}

class UsageAccessMissingException : CodedException("E_USAGE_ACCESS", "Usage access is not granted", null)
class BadPlanException(reason: String) : CodedException("E_BAD_PLAN", reason, null)

/**
 * The JS-facing surface of Android blocking. Thin on purpose: it checks the two
 * permissions, opens their Settings pages, lists launchable apps and hands a plan to
 * BlockingService. Everything user-facing on the shield comes from JS, in Spanish.
 */
class VesperBlockingModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VesperBlocking")

    Function("getStatus") {
      mapOf(
        "usageAccess" to Permissions.hasUsageAccess(context),
        "overlay" to Permissions.canDrawOverlays(context),
        "running" to BlockingService.isRunning,
      )
    }

    Function("isShielding") { Shield.isShowing }

    AsyncFunction("openUsageAccessSettings") {
      // With a package URI Android 10+ lands on the app's own row on most devices;
      // if the OEM cannot resolve that, the general list is the fallback.
      openSettings(Settings.ACTION_USAGE_ACCESS_SETTINGS, withPackage = true)
    }

    AsyncFunction("openOverlaySettings") {
      openSettings(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, withPackage = true)
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
      val mode = when (record.mode) {
        "block" -> PlanMode.BLOCK
        "allow" -> PlanMode.ALLOW
        else -> throw BadPlanException("mode must be 'block' or 'allow', got '${record.mode}'")
      }
      val plan = Plan(
        packageNames = record.packageNames.toSet(),
        mode = mode,
        endsAt = record.endsAt?.toLong(),
        shield = ShieldCopy(record.shieldTitle, record.shieldSubtitle, record.shieldButton),
      )
      Log.i(TAG, "applyPlan: ${plan.packageNames.size} packages, ${plan.mode}, endsAt=${plan.endsAt}")
      BlockingService.apply(context, plan)
    }

    AsyncFunction("release") {
      Log.i(TAG, "release")
      BlockingService.release(context)
    }
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
  }
}
