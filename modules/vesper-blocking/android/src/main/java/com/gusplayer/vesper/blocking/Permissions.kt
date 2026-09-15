package com.gusplayer.vesper.blocking

import android.Manifest
import android.app.AppOpsManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings

/**
 * The two permissions blocking needs. Neither comes with a dialog: both are toggles in
 * system Settings, so the app can only open the right page and check again afterwards.
 */
object Permissions {
  /** PACKAGE_USAGE_STATS, as an app op ("Usage access" in Settings). */
  fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    // The API 34 replacement wants an attribution tag we do not have; the three-argument
    // form still answers the question and is what the Settings page itself flips.
    @Suppress("DEPRECATION")
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    // MODE_DEFAULT means "ask the permission itself", which for a signature permission
    // is only granted through the op; being explicit keeps OEM variations honest.
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      context.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  /** SYSTEM_ALERT_WINDOW ("Display over other apps"). */
  fun canDrawOverlays(context: Context): Boolean = Settings.canDrawOverlays(context)
}
