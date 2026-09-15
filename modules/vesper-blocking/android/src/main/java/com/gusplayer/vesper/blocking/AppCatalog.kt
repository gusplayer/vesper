package com.gusplayer.vesper.blocking

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.text.Collator
import java.util.concurrent.ConcurrentHashMap

/** One row of the app picker. `iconBase64` is a 96px PNG, or null when not requested. */
data class LaunchableApp(val packageName: String, val label: String, val iconBase64: String?)

/**
 * The apps a user can see in their launcher, which is what the picker offers. Found
 * through a MAIN/LAUNCHER intent that the manifest declares in <queries>, so the app
 * never asks for QUERY_ALL_PACKAGES. Vesper itself is left out: a session must never
 * be able to shield the app that ends it.
 */
object AppCatalog {
  private const val ICON_PX = 96

  /** Icons rendered once per process; the picker opens more than once per session. */
  private val iconCache = ConcurrentHashMap<String, String>()

  fun launchable(context: Context, withIcons: Boolean): List<LaunchableApp> {
    val pm = context.packageManager
    val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val resolved: List<ResolveInfo> = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.queryIntentActivities(intent, PackageManager.ResolveInfoFlags.of(0L))
    } else {
      @Suppress("DEPRECATION")
      pm.queryIntentActivities(intent, 0)
    }
    val collator = Collator.getInstance()
    return resolved
      .asSequence()
      .filter { it.activityInfo.packageName != context.packageName }
      .distinctBy { it.activityInfo.packageName }
      .map { info ->
        val packageName = info.activityInfo.packageName
        LaunchableApp(
          packageName = packageName,
          label = info.loadLabel(pm).toString(),
          iconBase64 = if (withIcons) icon(packageName) { info.loadIcon(pm) } else null,
        )
      }
      .sortedWith { a, b -> collator.compare(a.label.lowercase(), b.label.lowercase()) }
      .toList()
  }

  private fun icon(packageName: String, load: () -> Drawable): String? {
    iconCache[packageName]?.let { return it }
    val encoded = runCatching { encode(load()) }.getOrNull() ?: return null
    iconCache[packageName] = encoded
    return encoded
  }

  private fun encode(drawable: Drawable): String {
    val bitmap = Bitmap.createBitmap(ICON_PX, ICON_PX, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, ICON_PX, ICON_PX)
    drawable.draw(canvas)
    val bytes = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes)
    bitmap.recycle()
    return Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
  }
}
