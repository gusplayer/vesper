package com.gusplayer.vesper.blocking

import android.content.BroadcastReceiver
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import android.util.Log
import java.io.ByteArrayOutputStream
import java.text.Collator

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

  /**
   * How many rendered icons are held at once. Each one is 7-20 KB of base64, and the
   * picker asks for every launchable app in a single call: on a phone with 150 apps an
   * unbounded cache pinned one to three megabytes for the life of the process. Thirty
   * two covers what is read again and again — the packages of the modes, which
   * UsageQuery asks for every few minutes — and leaves the picker's sweep to be what it
   * always was: a one-off render whose result JS holds, not the module.
   */
  private const val MAX_CACHED_ICONS = 32

  /**
   * Icons rendered once per process, most recently used last. Access order, so the
   * picker's alphabetical sweep evicts itself instead of the handful of packages the
   * activity tab keeps asking for. Every read and write goes through the synchronized
   * helpers below: an access-ordered LinkedHashMap mutates on `get`.
   */
  private val iconCache = object : LinkedHashMap<String, String>(MAX_CACHED_ICONS, 0.75f, true) {
    override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, String>): Boolean =
      size > MAX_CACHED_ICONS
  }

  @Volatile
  private var listening = false

  fun launchable(context: Context, withIcons: Boolean): List<LaunchableApp> {
    listen(context)
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

  /** The cached 96px PNG of a package, rendering it once; shared with UsageQuery. */
  internal fun icon(packageName: String, load: () -> Drawable): String? {
    cached(packageName)?.let { return it }
    val encoded = runCatching { encode(load()) }.getOrNull() ?: return null
    remember(packageName, encoded)
    return encoded
  }

  /**
   * Starts dropping cached icons when they stop being true or when the system needs
   * the memory back, once per process. An app that is installed, updated or removed
   * takes its own icon with it (a launcher-visible package is one this app can see
   * through <queries>, so its broadcast arrives); a memory trim empties the cache and
   * the next read renders again.
   *
   * Context-registered, not in the manifest: the package broadcasts stopped reaching
   * manifest receivers in Android 8, and this cache only matters while the process
   * lives anyway.
   */
  // onLowMemory has been deprecated in favour of onTrimMemory since API 14, but
  // ComponentCallbacks2 still requires it.
  @Suppress("OVERRIDE_DEPRECATION")
  internal fun listen(context: Context) {
    if (listening) {
      return
    }
    synchronized(this) {
      if (listening) {
        return
      }
      listening = true
      val app = context.applicationContext
      val filter = IntentFilter().apply {
        addAction(Intent.ACTION_PACKAGE_ADDED)
        addAction(Intent.ACTION_PACKAGE_REPLACED)
        addAction(Intent.ACTION_PACKAGE_REMOVED)
        addAction(Intent.ACTION_PACKAGE_CHANGED)
        addDataScheme("package")
      }
      val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
          // "package:com.example" -> the package half; no data means nothing to trust.
          when (val packageName = intent.data?.schemeSpecificPart) {
            null -> forgetAll()
            else -> forget(packageName)
          }
        }
      }
      // No RECEIVER_EXPORTED / RECEIVER_NOT_EXPORTED flag, as in BlockingService: the
      // package broadcasts are protected and only the system sends them.
      runCatching { app.registerReceiver(receiver, filter) }
        .onFailure { Log.w(TAG, "package receiver refused: ${it.message}") }
      app.registerComponentCallbacks(object : ComponentCallbacks2 {
        override fun onConfigurationChanged(newConfig: Configuration) = Unit

        override fun onLowMemory() = forgetAll()

        /**
         * UI_HIDDEN and above: no screen of ours is showing an icon any more. The
         * lower "running low" levels are deprecated since Android 14 and never sent.
         */
        override fun onTrimMemory(level: Int) {
          if (level >= ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) {
            forgetAll()
          }
        }
      })
    }
  }

  @Synchronized
  private fun cached(packageName: String): String? = iconCache[packageName]

  @Synchronized
  private fun remember(packageName: String, encoded: String) {
    iconCache[packageName] = encoded
  }

  @Synchronized
  private fun forget(packageName: String) {
    iconCache.remove(packageName)
  }

  @Synchronized
  private fun forgetAll() {
    iconCache.clear()
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

  private const val TAG = "VesperBlocking"
}
