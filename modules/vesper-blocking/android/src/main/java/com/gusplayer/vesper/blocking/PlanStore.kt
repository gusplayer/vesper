package com.gusplayer.vesper.blocking

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** What the shield says. Comes from JS in Spanish; Kotlin never writes user-facing copy. */
data class ShieldCopy(val title: String, val subtitle: String, val button: String)

enum class PlanMode { BLOCK, ALLOW }

/**
 * A blocking plan as the service runs it. 'BLOCK' shields the packages; 'ALLOW'
 * shields every other app. `endsAt` is epoch ms, or null for "until release()".
 * `windowId` names the routine window that raised it, or null for a session started
 * from JS: the end alarm of a window only lowers a plan that is its own.
 */
data class Plan(
  val packageNames: Set<String>,
  val mode: PlanMode,
  val endsAt: Long?,
  val shield: ShieldCopy,
  val windowId: String? = null,
)

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
) {
  /** The plan this window raises when it opens, ending when the window does. */
  fun plan(endsAt: Long): Plan = Plan(packageNames, mode, endsAt, shield, windowId = id)

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

  companion object {
    const val DAYS_PER_WEEK = 7

    fun fromJson(json: JSONObject): WindowSpec {
      val days = json.getJSONArray("days")
      val packages = json.getJSONArray("packageNames")
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
        ),
      )
    }
  }
}

/**
 * The current plan, in SharedPreferences, so a START_STICKY restart of the service
 * finds it again without JS being alive. Cleared on release.
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
  private const val KEY_TITLE = "shieldTitle"
  private const val KEY_SUBTITLE = "shieldSubtitle"
  private const val KEY_BUTTON = "shieldButton"
  private const val KEY_WINDOW_ID = "windowId"

  private const val WINDOW_PREFS = "vesper_windows"

  fun save(context: Context, plan: Plan) {
    val packages = JSONArray()
    plan.packageNames.forEach { packages.put(it) }
    prefs(context).edit()
      .putString(KEY_PACKAGES, packages.toString())
      .putString(KEY_MODE, plan.mode.name)
      .putLong(KEY_ENDS_AT, plan.endsAt ?: -1L)
      .putString(KEY_TITLE, plan.shield.title)
      .putString(KEY_SUBTITLE, plan.shield.subtitle)
      .putString(KEY_BUTTON, plan.shield.button)
      .putString(KEY_WINDOW_ID, plan.windowId)
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
    return Plan(
      packageNames = packages,
      mode = mode,
      endsAt = endsAt,
      shield = ShieldCopy(
        title = prefs.getString(KEY_TITLE, null) ?: "Vesper",
        subtitle = prefs.getString(KEY_SUBTITLE, null) ?: "",
        button = prefs.getString(KEY_BUTTON, null) ?: "Volver",
      ),
      windowId = prefs.getString(KEY_WINDOW_ID, null),
    )
  }

  fun clear(context: Context) {
    prefs(context).edit().clear().apply()
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
