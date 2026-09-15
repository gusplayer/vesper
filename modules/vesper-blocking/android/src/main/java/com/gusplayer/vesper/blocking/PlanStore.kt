package com.gusplayer.vesper.blocking

import android.content.Context
import org.json.JSONArray

/** What the shield says. Comes from JS in Spanish; Kotlin never writes user-facing copy. */
data class ShieldCopy(val title: String, val subtitle: String, val button: String)

enum class PlanMode { BLOCK, ALLOW }

/**
 * A blocking plan as the service runs it. 'BLOCK' shields the packages; 'ALLOW'
 * shields every other app. `endsAt` is epoch ms, or null for "until release()".
 */
data class Plan(
  val packageNames: Set<String>,
  val mode: PlanMode,
  val endsAt: Long?,
  val shield: ShieldCopy,
)

/**
 * The current plan, in SharedPreferences, so a START_STICKY restart of the service
 * finds it again without JS being alive. Cleared on release.
 */
object PlanStore {
  private const val PREFS = "vesper_blocking"
  private const val KEY_PACKAGES = "packageNames"
  private const val KEY_MODE = "mode"
  private const val KEY_ENDS_AT = "endsAt"
  private const val KEY_TITLE = "shieldTitle"
  private const val KEY_SUBTITLE = "shieldSubtitle"
  private const val KEY_BUTTON = "shieldButton"

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
    )
  }

  fun clear(context: Context) {
    prefs(context).edit().clear().apply()
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
