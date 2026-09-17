package com.gusplayer.vesper.blocking

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * What the shield says. Comes from JS in the app's language; Kotlin never writes
 * user-facing copy. `releaseTemplate` is the third line of a plan with an end, with a
 * `{time}` placeholder that Shield fills with the device's short time format.
 */
data class ShieldCopy(
  val title: String,
  val subtitle: String,
  val button: String,
  val releaseTemplate: String = DEFAULT_RELEASE_TEMPLATE,
) {
  companion object {
    const val DEFAULT_RELEASE_TEMPLATE = "Se libera a las {time}"
  }
}

/**
 * What the notification says: the channel (seen in Settings › Notifications), the line
 * under the title while focusing and the same line during a break. From JS, in the
 * app's language, so the channel is renamed whenever the language changes. The
 * defaults exist only for a plan written by an older version of the app.
 */
data class NotificationCopy(
  val channelName: String = "Sesión de foco",
  val channelDescription: String = "Se muestra mientras una sesión bloquea apps.",
  val sessionText: String = "Sesión de foco",
  val breakText: String = "Pausa",
)

enum class PlanMode { BLOCK, ALLOW }

/**
 * A blocking plan as the service runs it. 'BLOCK' shields the packages; 'ALLOW'
 * shields every other app. `endsAt` is epoch ms, or null for "until release()", in
 * which case the notification counts up from `startedAt` instead of down.
 * `windowId` names the routine window that raised it, or null for a session started
 * from JS: the end alarm of a window only lowers a plan that is its own.
 */
data class Plan(
  val packageNames: Set<String>,
  val mode: PlanMode,
  val endsAt: Long?,
  val shield: ShieldCopy,
  val windowId: String? = null,
  val startedAt: Long = System.currentTimeMillis(),
  val notification: NotificationCopy = NotificationCopy(),
  /** An open session (ADR-0022): `endsAt` is only its cap, so the notification counts up. */
  val open: Boolean = false,
)

/**
 * A break (ADR-0022, ADR-0023): the service keeps running but nothing is shielded
 * until `until`. `startedAt` is when it began, so a resume the service does by itself
 * can push the plan's end back by what the break took, the way JS does.
 */
data class Pause(val startedAt: Long, val until: Long)

/**
 * A routine window as JS registers it. Mirrors `RoutineWindowSpec` in
 * src/platform/blockingTypes.ts, with the token already opened into package names.
 * Minutes are from local midnight; `days` is Monday first; `endMinute` null means
 * start + capMinutes; an end at or before the start crosses midnight.
 */
data class WindowSpec(
  val id: String,
  val startMinute: Int,
  val endMinute: Int?,
  val capMinutes: Int,
  val days: List<Boolean>,
  val packageNames: Set<String>,
  val mode: PlanMode,
  val shield: ShieldCopy,
  val notification: NotificationCopy = NotificationCopy(),
) {
  /** The plan this window raises when it opens, ending when the window does. */
  fun plan(startsAt: Long, endsAt: Long): Plan =
    Plan(packageNames, mode, endsAt, shield, windowId = id, startedAt = startsAt, notification = notification)

  fun toJson(): JSONObject = JSONObject()
    .put("id", id)
    .put("startMinute", startMinute)
    .put("endMinute", endMinute ?: JSONObject.NULL)
    .put("capMinutes", capMinutes)
    .put("days", JSONArray().also { array -> days.forEach { array.put(it) } })
    .put("packageNames", JSONArray().also { array -> packageNames.forEach { array.put(it) } })
    .put("mode", mode.name)
    .put("shieldTitle", shield.title)
    .put("shieldSubtitle", shield.subtitle)
    .put("shieldButton", shield.button)
    .put("shieldReleasesAt", shield.releaseTemplate)
    .put("channelName", notification.channelName)
    .put("channelDescription", notification.channelDescription)
    .put("sessionText", notification.sessionText)
    .put("breakText", notification.breakText)

  companion object {
    const val DAYS_PER_WEEK = 7

    fun fromJson(json: JSONObject): WindowSpec {
      val days = json.getJSONArray("days")
      val packages = json.getJSONArray("packageNames")
      val defaults = NotificationCopy()
      return WindowSpec(
        id = json.getString("id"),
        startMinute = json.getInt("startMinute"),
        endMinute = if (json.isNull("endMinute")) null else json.getInt("endMinute"),
        capMinutes = json.getInt("capMinutes"),
        days = List(DAYS_PER_WEEK) { i -> i < days.length() && days.getBoolean(i) },
        packageNames = (0 until packages.length()).map { packages.getString(it) }.toSet(),
        mode = runCatching { PlanMode.valueOf(json.getString("mode")) }.getOrDefault(PlanMode.BLOCK),
        shield = ShieldCopy(
          title = json.optString("shieldTitle", "Vesper"),
          subtitle = json.optString("shieldSubtitle", ""),
          button = json.optString("shieldButton", "Volver"),
          releaseTemplate = json.optString("shieldReleasesAt", ShieldCopy.DEFAULT_RELEASE_TEMPLATE),
        ),
        notification = NotificationCopy(
          channelName = json.optString("channelName", defaults.channelName),
          channelDescription = json.optString("channelDescription", defaults.channelDescription),
          sessionText = json.optString("sessionText", defaults.sessionText),
          breakText = json.optString("breakText", defaults.breakText),
        ),
      )
    }
  }
}

/**
 * The current plan, in SharedPreferences, so a START_STICKY restart of the service
 * finds it again without JS being alive. Cleared on release. A break lives next to
 * it (`pausedAt`/`pausedUntil`), so a restart during one stays paused until then.
 *
 * The registered windows live in a second preferences file, one JSON object per
 * window id, so clearing the plan never forgets a routine and BootReceiver can re-arm
 * every window after a restart.
 */
object PlanStore {
  private const val PREFS = "vesper_blocking"
  private const val KEY_PACKAGES = "packageNames"
  private const val KEY_MODE = "mode"
  private const val KEY_ENDS_AT = "endsAt"
  private const val KEY_STARTED_AT = "startedAt"
  private const val KEY_OPEN = "open"
  private const val KEY_TITLE = "shieldTitle"
  private const val KEY_SUBTITLE = "shieldSubtitle"
  private const val KEY_BUTTON = "shieldButton"
  private const val KEY_RELEASES_AT = "shieldReleasesAt"
  private const val KEY_WINDOW_ID = "windowId"
  private const val KEY_CHANNEL_NAME = "channelName"
  private const val KEY_CHANNEL_DESCRIPTION = "channelDescription"
  private const val KEY_SESSION_TEXT = "sessionText"
  private const val KEY_BREAK_TEXT = "breakText"
  private const val KEY_PAUSED_AT = "pausedAt"
  private const val KEY_PAUSED_UNTIL = "pausedUntil"

  private const val WINDOW_PREFS = "vesper_windows"

  /** Saves a plan. A new plan is never paused: the break keys go with the old one. */
  fun save(context: Context, plan: Plan) {
    val packages = JSONArray()
    plan.packageNames.forEach { packages.put(it) }
    prefs(context).edit()
      .putString(KEY_PACKAGES, packages.toString())
      .putString(KEY_MODE, plan.mode.name)
      .putLong(KEY_ENDS_AT, plan.endsAt ?: -1L)
      .putLong(KEY_STARTED_AT, plan.startedAt)
      .putBoolean(KEY_OPEN, plan.open)
      .putString(KEY_TITLE, plan.shield.title)
      .putString(KEY_SUBTITLE, plan.shield.subtitle)
      .putString(KEY_BUTTON, plan.shield.button)
      .putString(KEY_RELEASES_AT, plan.shield.releaseTemplate)
      .putString(KEY_WINDOW_ID, plan.windowId)
      .putString(KEY_CHANNEL_NAME, plan.notification.channelName)
      .putString(KEY_CHANNEL_DESCRIPTION, plan.notification.channelDescription)
      .putString(KEY_SESSION_TEXT, plan.notification.sessionText)
      .putString(KEY_BREAK_TEXT, plan.notification.breakText)
      .remove(KEY_PAUSED_AT)
      .remove(KEY_PAUSED_UNTIL)
      .apply()
  }

  fun load(context: Context): Plan? {
    val prefs = prefs(context)
    val raw = prefs.getString(KEY_PACKAGES, null) ?: return null
    val packages = mutableSetOf<String>()
    val array = JSONArray(raw)
    for (i in 0 until array.length()) {
      packages.add(array.getString(i))
    }
    val mode = runCatching { PlanMode.valueOf(prefs.getString(KEY_MODE, null) ?: "") }.getOrNull() ?: PlanMode.BLOCK
    val endsAt = prefs.getLong(KEY_ENDS_AT, -1L).takeIf { it > 0 }
    val defaults = NotificationCopy()
    return Plan(
      packageNames = packages,
      mode = mode,
      endsAt = endsAt,
      shield = ShieldCopy(
        title = prefs.getString(KEY_TITLE, null) ?: "Vesper",
        subtitle = prefs.getString(KEY_SUBTITLE, null) ?: "",
        button = prefs.getString(KEY_BUTTON, null) ?: "Volver",
        releaseTemplate = prefs.getString(KEY_RELEASES_AT, null) ?: ShieldCopy.DEFAULT_RELEASE_TEMPLATE,
      ),
      windowId = prefs.getString(KEY_WINDOW_ID, null),
      // A plan from before startedAt existed counts up from now; nothing better is known.
      startedAt = prefs.getLong(KEY_STARTED_AT, -1L).takeIf { it > 0 } ?: System.currentTimeMillis(),
      open = prefs.getBoolean(KEY_OPEN, false),
      notification = NotificationCopy(
        channelName = prefs.getString(KEY_CHANNEL_NAME, null) ?: defaults.channelName,
        channelDescription = prefs.getString(KEY_CHANNEL_DESCRIPTION, null) ?: defaults.channelDescription,
        sessionText = prefs.getString(KEY_SESSION_TEXT, null) ?: defaults.sessionText,
        breakText = prefs.getString(KEY_BREAK_TEXT, null) ?: defaults.breakText,
      ),
    )
  }

  fun clear(context: Context) {
    prefs(context).edit().clear().apply()
  }

  /** Marks the current plan paused until `until`. Meaningless without a plan. */
  fun savePause(context: Context, pause: Pause) {
    prefs(context).edit()
      .putLong(KEY_PAUSED_AT, pause.startedAt)
      .putLong(KEY_PAUSED_UNTIL, pause.until)
      .apply()
  }

  fun loadPause(context: Context): Pause? {
    val prefs = prefs(context)
    val until = prefs.getLong(KEY_PAUSED_UNTIL, -1L).takeIf { it > 0 } ?: return null
    val startedAt = prefs.getLong(KEY_PAUSED_AT, -1L).takeIf { it > 0 } ?: until
    return Pause(startedAt, until)
  }

  fun clearPause(context: Context) {
    prefs(context).edit().remove(KEY_PAUSED_AT).remove(KEY_PAUSED_UNTIL).apply()
  }

  fun saveWindow(context: Context, spec: WindowSpec) {
    windowPrefs(context).edit().putString(spec.id, spec.toJson().toString()).apply()
  }

  fun removeWindow(context: Context, id: String) {
    windowPrefs(context).edit().remove(id).apply()
  }

  fun loadWindow(context: Context, id: String): WindowSpec? {
    val raw = windowPrefs(context).getString(id, null) ?: return null
    return runCatching { WindowSpec.fromJson(JSONObject(raw)) }.getOrNull()
  }

  /** Every registered window. A row that no longer parses is dropped, not thrown. */
  fun loadWindows(context: Context): List<WindowSpec> =
    windowPrefs(context).all.values.mapNotNull { raw ->
      (raw as? String)?.let { runCatching { WindowSpec.fromJson(JSONObject(it)) }.getOrNull() }
    }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun windowPrefs(context: Context) = context.getSharedPreferences(WINDOW_PREFS, Context.MODE_PRIVATE)
}
