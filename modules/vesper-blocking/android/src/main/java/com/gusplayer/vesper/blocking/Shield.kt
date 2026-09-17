package com.gusplayer.vesper.blocking

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import java.text.DateFormat
import java.util.Date

/**
 * The full-screen dark view that covers a blocked app: a title, one line under it,
 * the time the plan releases when it has one ("Se libera a las 18:00", ADR-0023) and
 * a single pill button that sends the user home. Shown as a TYPE_APPLICATION_OVERLAY
 * window; when the window manager refuses (no overlay permission, or an app that keeps
 * overlays out) the same view opens inside ShieldActivity.
 *
 * Everything runs on the main thread. The service and the activity both talk to this
 * singleton, so `isShowing` is the one truth the JS `isShielding()` reads.
 */
object Shield {
  private const val TAG = "VesperBlocking"
  private const val HIDE_OVERLAYS_PERMISSION = "android.permission.HIDE_NON_SYSTEM_OVERLAY_WINDOWS"
  /** What JS leaves in the release template for the formatted time. */
  private const val TIME_PLACEHOLDER = "{time}"
  private val OVERLAY_HIDERS = setOf(
    "com.android.settings",
    "com.android.permissioncontroller",
    "com.google.android.permissioncontroller",
    "com.android.packageinstaller",
    "com.google.android.packageinstaller",
  )

  private val main = Handler(Looper.getMainLooper())
  private var overlay: View? = null
  private var windowManager: WindowManager? = null

  @Volatile
  var isShowing: Boolean = false
    private set

  /**
   * Covers `blockedPackage`, the app now in front, with `copy` and, when the plan has
   * an end, `releaseLine` under the subtitle.
   */
  fun show(context: Context, copy: ShieldCopy, releaseLine: String?, blockedPackage: String) {
    main.post { showNow(context.applicationContext, copy, releaseLine, blockedPackage) }
  }

  /**
   * "Se libera a las 18:00": the plan's template with `{time}` replaced by its end in
   * the device's short time format and locale. Null for a plan with no end.
   */
  fun releaseLine(plan: Plan): String? {
    val endsAt = plan.endsAt ?: return null
    val time = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(endsAt))
    return plan.shield.releaseTemplate.replace(TIME_PLACEHOLDER, time)
  }

  fun hide() {
    main.post { hideNow() }
  }

  private fun showNow(context: Context, copy: ShieldCopy, releaseLine: String?, blockedPackage: String) {
    if (isShowing) {
      return
    }
    isShowing = true
    if (hidesOverlays(context, blockedPackage)) {
      // addView would succeed and the window would be silently kept off screen
      // (mForceHideNonSystemOverlayWindow); the activity is the only shield that shows.
      Log.i(TAG, "$blockedPackage hides overlays; using ShieldActivity")
      ShieldActivity.open(context, copy, releaseLine)
      return
    }
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val view = build(context, copy, releaseLine) { goHome(context) }
    try {
      wm.addView(view, overlayParams())
      overlay = view
      windowManager = wm
      Log.i(TAG, "shield up (overlay)")
    } catch (error: Exception) {
      // WindowManager.BadTokenException without the permission, SecurityException on
      // some OEMs. The activity is the fallback; it looks the same.
      Log.w(TAG, "overlay refused (${error.javaClass.simpleName}); falling back to ShieldActivity")
      ShieldActivity.open(context, copy, releaseLine)
    }
  }

  private fun hideNow() {
    if (!isShowing) {
      return
    }
    isShowing = false
    overlay?.let { view ->
      runCatching { windowManager?.removeViewImmediate(view) }
    }
    overlay = null
    windowManager = null
    ShieldActivity.close()
    Log.i(TAG, "shield down")
  }

  /**
   * System apps holding HIDE_NON_SYSTEM_OVERLAY_WINDOWS (Settings, the permission
   * controller, the package installer) make the window manager hide every third-party
   * overlay while they are in front. The permission is the precise test; the list
   * covers OEM builds where the package is not visible to us.
   */
  private fun hidesOverlays(context: Context, packageName: String): Boolean {
    if (packageName in OVERLAY_HIDERS) {
      return true
    }
    return runCatching {
      context.packageManager.checkPermission(HIDE_OVERLAYS_PERMISSION, packageName) == PackageManager.PERMISSION_GRANTED
    }.getOrDefault(false)
  }

  /** Home, then the shield goes away: the blocked app is no longer in front. */
  private fun goHome(context: Context) {
    val home = Intent(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_HOME)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(home) }
    hideNow()
  }

  private fun overlayParams(): WindowManager.LayoutParams {
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      type,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
      PixelFormat.TRANSLUCENT,
    )
    params.gravity = Gravity.CENTER
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }
    return params
  }

  /**
   * The shield's view tree, built in code so the module ships no layout XML. The
   * session's ink from res/values/colors.xml (a copy of src/design/tokens.ts), with the
   * same roles the iOS shield takes in src/design/shieldPalette.ts: the light scheme's
   * ink as the ground, the dark scheme's ink for the text, and the button in paper. The
   * root eats the back key: leaving the shield means pressing its button.
   */
  fun build(context: Context, copy: ShieldCopy, releaseLine: String?, onBack: () -> Unit): View {
    val bg = ContextCompat.getColor(context, R.color.vesper_light_ink)
    val ink = ContextCompat.getColor(context, R.color.vesper_dark_ink)
    val inkSecondary = ContextCompat.getColor(context, R.color.vesper_dark_ink_secondary)
    val buttonBg = ContextCompat.getColor(context, R.color.vesper_light_on_ink)
    val buttonInk = ContextCompat.getColor(context, R.color.vesper_light_ink)

    val root = object : FrameLayout(context) {
      override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        return event.keyCode == KeyEvent.KEYCODE_BACK || super.dispatchKeyEvent(event)
      }
    }
    root.setBackgroundColor(bg)
    root.isClickable = true
    root.isFocusable = true
    root.isFocusableInTouchMode = true

    val column = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      val pad = dp(context, 32f)
      setPadding(pad, pad, pad, pad)
    }

    val title = TextView(context).apply {
      text = copy.title
      setTextColor(ink)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
      typeface = mediumTypeface()
      gravity = Gravity.CENTER
    }
    val subtitle = TextView(context).apply {
      text = copy.subtitle
      setTextColor(inkSecondary)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      gravity = Gravity.CENTER
      setPadding(0, dp(context, 8f), 0, 0)
    }
    val release = releaseLine?.let { line ->
      TextView(context).apply {
        text = line
        setTextColor(inkSecondary)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        gravity = Gravity.CENTER
        setPadding(0, dp(context, 4f), 0, 0)
      }
    }
    val button = TextView(context).apply {
      text = copy.button
      setTextColor(buttonInk)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      typeface = mediumTypeface()
      gravity = Gravity.CENTER
      minHeight = dp(context, 52f)
      val horizontal = dp(context, 28f)
      setPadding(horizontal, 0, horizontal, 0)
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(context, 999f).toFloat()
        setColor(buttonBg)
      }
      isClickable = true
      isFocusable = true
      contentDescription = copy.button
      setOnClickListener { onBack() }
    }

    column.addView(title, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    column.addView(subtitle, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    release?.let {
      column.addView(it, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    }
    column.addView(
      button,
      LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(context, 32f)
      },
    )
    root.addView(
      column,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER),
    )
    return root
  }

  private fun mediumTypeface(): Typeface = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
    Typeface.create(Typeface.DEFAULT, 500, false)
  } else {
    Typeface.DEFAULT_BOLD
  }

  private fun dp(context: Context, value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, context.resources.displayMetrics).toInt()
}
