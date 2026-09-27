package com.gusplayer.vesper.blocking

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
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
 * The full-screen dark view that covers a blocked app (ADR-0053): the app's name, the
 * session under it ("Vesper · Trabajo profundo"), the time the plan releases when it has
 * one ("Se libera a las 18:00", ADR-0023), today's count for this app ("Hoy: 4 intentos
 * · 2 pausas, 20 min"), the pill that sends the user home ("Volver al foco") and, under
 * it, the pause row: the lengths when a break is unlocked, when the next one unlocks
 * when it is not yet, deep's line when breaks never come, nothing otherwise. Shown as a
 * TYPE_APPLICATION_OVERLAY window; when the window manager refuses (no overlay
 * permission, or an app that keeps overlays out) the same view opens inside
 * ShieldActivity.
 *
 * Every time the shield goes up over an app it is an attempt, counted in ShieldLedger
 * before the view is built, so the count it shows includes this one.
 *
 * Everything runs on the main thread. The service and the activity both talk to this
 * singleton, so `isShowing` is the one truth the JS `isShielding()` reads.
 *
 * The overlay keeps the screen on for [AWAKE_MS] after it goes up, and no longer: see
 * [letScreenSleepNow].
 */
object Shield {
  private const val TAG = "VesperBlocking"
  private const val HIDE_OVERLAYS_PERMISSION = "android.permission.HIDE_NON_SYSTEM_OVERLAY_WINDOWS"
  /** What JS leaves in the release template for the formatted time. */
  private const val TIME_PLACEHOLDER = "{time}"
  private const val TALLY_SEPARATOR = " · "
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
  private val letScreenSleep = Runnable { letScreenSleepNow() }

  @Volatile
  var isShowing: Boolean = false
    private set

  /** The app the shield is covering right now, so another app coming up counts again. */
  private var shownPackage: String? = null

  /** Covers `blockedPackage`, the app now in front, with what `plan` says. */
  fun show(context: Context, plan: Plan, blockedPackage: String) {
    main.post { showNow(context.applicationContext, plan, blockedPackage) }
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

  private fun showNow(context: Context, plan: Plan, blockedPackage: String) {
    if (isShowing && shownPackage == blockedPackage) {
      return
    }
    if (isShowing) {
      // Another app of the session came up under the shield (from recents): it is its
      // own attempt, with its own name and count.
      hideNow()
    }
    isShowing = true
    shownPackage = blockedPackage
    ShieldLedger.recordAttempt(context, blockedPackage, System.currentTimeMillis())
    if (hidesOverlays(context, blockedPackage)) {
      // addView would succeed and the window would be silently kept off screen
      // (mForceHideNonSystemOverlayWindow); the activity is the only shield that shows.
      Log.i(TAG, "$blockedPackage hides overlays; using ShieldActivity")
      // Nothing is up if the start was refused: `isShowing` has to say so, or every
      // later tick returns early and the session runs with no shield at all.
      isShowing = ShieldActivity.open(context, blockedPackage)
      return
    }
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val view = build(context, plan, blockedPackage)
    try {
      wm.addView(view, overlayParams())
      overlay = view
      windowManager = wm
      main.postDelayed(letScreenSleep, AWAKE_MS)
      Log.i(TAG, "shield up (overlay)")
    } catch (error: Exception) {
      // WindowManager.BadTokenException without the permission, SecurityException on
      // some OEMs. The activity is the fallback; it looks the same.
      Log.w(TAG, "overlay refused (${error.javaClass.simpleName}); falling back to ShieldActivity")
      isShowing = ShieldActivity.open(context, blockedPackage)
    }
  }

  /**
   * Takes FLAG_KEEP_SCREEN_ON off the overlay once the shield has been up for
   * [AWAKE_MS].
   *
   * The flag went in with phase 1 (ADR-0019) without a reason of its own: the shield
   * appears without the user asking for it, so it has to survive the seconds left on a
   * short display timeout, or the user taps the app and finds a black screen. That
   * reason lasts half a minute. Keeping the flag for the whole session meant a
   * full-brightness screen for as long as the plan ran — up to the 12 h cap of an open
   * session — on a static image, with ACTION_SCREEN_OFF never arriving, so
   * ForegroundWatcher also went on polling queryEvents every 800 ms. After the grace
   * the display sleeps on its own timeout; a touch on the shield restarts it, the way
   * any other window behaves, and the watcher stops with the screen.
   */
  private fun letScreenSleepNow() {
    val view = overlay ?: return
    val wm = windowManager ?: return
    val params = view.layoutParams as? WindowManager.LayoutParams ?: return
    if (params.flags and WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON == 0) {
      return
    }
    params.flags = params.flags and WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON.inv()
    runCatching { wm.updateViewLayout(view, params) }
      .onSuccess { Log.i(TAG, "shield stopped keeping the screen on") }
      .onFailure { Log.w(TAG, "could not drop KEEP_SCREEN_ON: ${it.message}") }
  }

  private fun hideNow() {
    if (!isShowing) {
      return
    }
    isShowing = false
    shownPackage = null
    main.removeCallbacks(letScreenSleep)
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

  /** "Volver al foco": counted, then home, then the shield goes away. */
  fun backToFocus(context: Context, blockedPackage: String) {
    ShieldLedger.recordBack(context, blockedPackage, System.currentTimeMillis())
    val home = Intent(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_HOME)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { context.startActivity(home) }
    hideNow()
  }

  /**
   * A break of `lengthMs` from the shield: counted, then the service pauses the plan,
   * which takes the shield down and leaves the app in front. JS learns of it from the
   * queue and takes the same break into the session at this instant.
   */
  fun pauseFocus(context: Context, blockedPackage: String, lengthMs: Long) {
    val now = System.currentTimeMillis()
    ShieldLedger.recordBreak(context, blockedPackage, now, lengthMs)
    BlockingService.pause(context, now + lengthMs, blockedPackage)
    hideNow()
  }

  /** What the pause row shows right now (ADR-0053). */
  private sealed class PauseRow {
    data class Offer(val choicesMs: List<Long>) : PauseRow()
    data class Locked(val minutes: Long) : PauseRow()
    data class Note(val text: String) : PauseRow()
    object None : PauseRow()
  }

  /**
   * From the plan's break policy and the clock: offered once unlocked and before the
   * end, locked with the minutes left before that, deep's line when breaks never come,
   * and nothing for a plan that never offers them (a routine window's) or a break that
   * would only unlock after the end.
   */
  private fun pauseRow(plan: Plan, now: Long): PauseRow {
    val asks = plan.shield.asks
    if (asks.pauseLabel.isEmpty()) {
      return PauseRow.None
    }
    val policy = plan.breaks
    if (policy.everyMs <= 0L) {
      return if (asks.noBreak.isEmpty()) PauseRow.None else PauseRow.Note(asks.noBreak)
    }
    val unlocksAt = policy.unlocksAt ?: return PauseRow.None
    val endsAt = plan.endsAt
    if ((endsAt != null && unlocksAt >= endsAt) || policy.choicesMs.isEmpty()) {
      return PauseRow.None
    }
    if (now >= unlocksAt) {
      return PauseRow.Offer(policy.choicesMs)
    }
    return PauseRow.Locked(((unlocksAt - now + MINUTE_MS - 1) / MINUTE_MS).coerceAtLeast(1L))
  }

  /** "Hoy: 4 intentos · 2 pausas, 20 min", or null before JS gave the words. */
  private fun todayLine(context: Context, plan: Plan, blockedPackage: String, now: Long): String? {
    val asks = plan.shield.asks
    if (asks.today.isEmpty()) {
      return null
    }
    val tally = ShieldLedger.today(context, blockedPackage, now)
    val parts = mutableListOf<String>()
    if (tally.attempts > 0) {
      val template = if (tally.attempts == 1) asks.attemptOne else asks.attemptOther
      parts.add(template.replace("{n}", tally.attempts.toString()))
    }
    if (tally.breaks > 0) {
      val template = if (tally.breaks == 1) asks.breakOne else asks.breakOther
      val minutes = (tally.breakMs + MINUTE_MS / 2) / MINUTE_MS
      parts.add(template.replace("{n}", tally.breaks.toString()).replace("{min}", minutes.toString()))
    }
    if (parts.isEmpty()) {
      return null
    }
    return asks.today.replace("{items}", parts.joinToString(TALLY_SEPARATOR))
  }

  /** The app's own name, as the launcher shows it; the session's title when it cannot be read. */
  private fun appLabel(context: Context, packageName: String, fallback: String): String =
    runCatching {
      val pm = context.packageManager
      pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
    }.getOrNull()?.takeIf { it.isNotBlank() } ?: fallback

  /**
   * FLAG_KEEP_SCREEN_ON is here only for the first [AWAKE_MS]; [letScreenSleepNow]
   * takes it away. It must never outlive the grace: the shield is a static image over
   * a session that can last hours.
   */
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
   * lengths of the pause row are outlined in the dark scheme's line, secondary to the
   * one filled button (rule 2). The root eats the back key: leaving the shield means
   * pressing one of its buttons.
   */
  fun build(context: Context, plan: Plan, blockedPackage: String): View {
    val now = System.currentTimeMillis()
    val bg = ContextCompat.getColor(context, R.color.vesper_light_ink)
    val ink = ContextCompat.getColor(context, R.color.vesper_dark_ink)
    val inkSecondary = ContextCompat.getColor(context, R.color.vesper_dark_ink_secondary)
    val line = ContextCompat.getColor(context, R.color.vesper_dark_line)
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
    fun add(view: View, topMargin: Float = 0f) {
      column.addView(
        view,
        LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
          this.topMargin = dp(context, topMargin)
        },
      )
    }
    fun text(value: String, color: Int, sp: Float, medium: Boolean = false): TextView = TextView(context).apply {
      text = value
      setTextColor(color)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
      gravity = Gravity.CENTER
      if (medium) {
        typeface = mediumTypeface()
      }
    }

    add(text(appLabel(context, blockedPackage, plan.shield.title), ink, 22f, medium = true))
    add(text(plan.shield.title, inkSecondary, 16f), topMargin = 8f)
    releaseLine(plan)?.let { add(text(it, inkSecondary, 16f), topMargin = 4f) }
    todayLine(context, plan, blockedPackage, now)?.let { add(text(it, inkSecondary, 16f), topMargin = 16f) }

    val back = pill(context, plan.shield.button, fill = buttonBg, stroke = null, color = buttonInk) {
      backToFocus(context, blockedPackage)
    }
    add(back, topMargin = 32f)

    when (val row = pauseRow(plan, now)) {
      is PauseRow.Offer -> {
        add(text(plan.shield.asks.pauseLabel, inkSecondary, 14f), topMargin = 28f)
        val choices = LinearLayout(context).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER
        }
        row.choicesMs.forEachIndexed { index, lengthMs ->
          val label = plan.shield.asks.minutes.replace("{n}", (lengthMs / MINUTE_MS).toString())
          val chip = pill(context, label, fill = null, stroke = line, color = ink) {
            pauseFocus(context, blockedPackage, lengthMs)
          }
          choices.addView(
            chip,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
              if (index > 0) {
                marginStart = dp(context, 8f)
              }
            },
          )
        }
        add(choices, topMargin = 10f)
      }
      is PauseRow.Locked -> {
        val template = plan.shield.asks.nextBreak
        if (template.isNotEmpty()) {
          add(text(template.replace("{n}", row.minutes.toString()), inkSecondary, 14f), topMargin = 28f)
        }
      }
      is PauseRow.Note -> add(text(row.text, inkSecondary, 14f), topMargin = 28f)
      PauseRow.None -> Unit
    }

    root.addView(
      column,
      FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER),
    )
    return root
  }

  /** A pill: filled for the one primary button, outlined for the lengths. */
  private fun pill(context: Context, label: String, fill: Int?, stroke: Int?, color: Int, onTap: () -> Unit): TextView =
    TextView(context).apply {
      text = label
      setTextColor(color)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      typeface = mediumTypeface()
      gravity = Gravity.CENTER
      minHeight = dp(context, if (fill != null) 52f else 44f)
      val horizontal = dp(context, if (fill != null) 28f else 18f)
      setPadding(horizontal, 0, horizontal, 0)
      background = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(context, 999f).toFloat()
        setColor(fill ?: Color.TRANSPARENT)
        stroke?.let { setStroke(dp(context, 1f), it) }
      }
      isClickable = true
      isFocusable = true
      contentDescription = label
      setOnClickListener { onTap() }
    }

  private fun mediumTypeface(): Typeface = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
    Typeface.create(Typeface.DEFAULT, 500, false)
  } else {
    Typeface.DEFAULT_BOLD
  }

  private fun dp(context: Context, value: Float): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, context.resources.displayMetrics).toInt()

  /** How long the shield keeps the screen awake after it goes up. */
  private const val AWAKE_MS = 30_000L
  private const val MINUTE_MS = 60_000L
}
