package com.gusplayer.vesper.blocking

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId

/**
 * What the shield saw (ADR-0053), kept two ways in SharedPreferences:
 *
 * - A queue of events for JS, which drains it (`drain`) at boot and whenever the app
 *   comes back, and writes them to `usage_events`. Kotlin never writes SQLite. The queue
 *   is capped so a phone where JS never runs again cannot grow it without end; the
 *   oldest go first.
 * - Today's count per app, so the shield can say "Hoy: 4 intentos · 2 pausas, 20 min"
 *   with no JS awake. It starts over at local midnight and holds nothing older.
 *
 * Counts, never time of use: a break's minutes are the break's, and nobody knows what
 * was opened during it. Every call is synchronized: the shield and the service write on
 * the main thread, JS drains on the module's.
 */
object ShieldLedger {
  private const val TAG = "VesperBlocking"
  private const val PREFS = "vesper_shield"
  private const val KEY_QUEUE = "queue"
  private const val KEY_DAY = "day"
  private const val KEY_TALLY = "tally"
  private const val MAX_QUEUE = 2000

  const val KIND_HIT = "shield_hit"
  const val KIND_BACK = "backed_off"
  const val KIND_BREAK = "unlock_granted"

  /** One app's line for today. */
  data class Tally(val attempts: Int = 0, val breaks: Int = 0, val breakMs: Long = 0L)

  private val lock = Any()

  /** The shield covered `packageName`. */
  fun recordAttempt(context: Context, packageName: String, at: Long) = synchronized(lock) {
    enqueue(context, KIND_HIT, packageName, at, null)
    updateToday(context, packageName, at) { it.copy(attempts = it.attempts + 1) }
  }

  /** "Volver al foco". */
  fun recordBack(context: Context, packageName: String, at: Long) = synchronized(lock) {
    enqueue(context, KIND_BACK, packageName, at, null)
  }

  /** A break of `lengthMs` taken from the shield over `packageName`. What it took is added when it ends. */
  fun recordBreak(context: Context, packageName: String, at: Long, lengthMs: Long) = synchronized(lock) {
    enqueue(context, KIND_BREAK, packageName, at, lengthMs)
    updateToday(context, packageName, at) { it.copy(breaks = it.breaks + 1) }
  }

  /** A shield break ended, early or on time: its minutes join its app's line. */
  fun recordBreakTaken(context: Context, pause: Pause, endedAt: Long) = synchronized(lock) {
    val packageName = pause.packageName ?: return@synchronized
    val took = (minOf(endedAt, pause.until) - pause.startedAt).coerceAtLeast(0L)
    updateToday(context, packageName, pause.startedAt) { it.copy(breakMs = it.breakMs + took) }
  }

  /** Today's line for `packageName`. Zeros for an app the shield has not seen today. */
  fun today(context: Context, packageName: String, now: Long): Tally = synchronized(lock) {
    val prefs = prefs(context)
    if (prefs.getString(KEY_DAY, null) != dayKey(now)) {
      return@synchronized Tally()
    }
    val line = tally(prefs.getString(KEY_TALLY, null)).optJSONObject(packageName) ?: return@synchronized Tally()
    Tally(line.optInt("attempts"), line.optInt("breaks"), line.optLong("breakMs"))
  }

  /** Every queued event, oldest first, and the queue emptied in the same step. */
  fun drain(context: Context): List<Map<String, Any?>> = synchronized(lock) {
    val prefs = prefs(context)
    val queue = queue(prefs.getString(KEY_QUEUE, null))
    prefs.edit().remove(KEY_QUEUE).apply()
    (0 until queue.length()).mapNotNull { i ->
      val event = queue.optJSONObject(i) ?: return@mapNotNull null
      mapOf(
        "kind" to event.optString("kind"),
        "packageName" to event.optString("packageName"),
        "at" to event.optLong("at").toDouble(),
        "lengthMs" to if (event.has("lengthMs")) event.optLong("lengthMs").toDouble() else null,
      )
    }
  }

  private fun enqueue(context: Context, kind: String, packageName: String, at: Long, lengthMs: Long?) {
    val prefs = prefs(context)
    val queue = queue(prefs.getString(KEY_QUEUE, null))
    val event = JSONObject().put("kind", kind).put("packageName", packageName).put("at", at)
    lengthMs?.let { event.put("lengthMs", it) }
    queue.put(event)
    val kept = if (queue.length() > MAX_QUEUE) {
      Log.w(TAG, "shield queue over $MAX_QUEUE; dropping the oldest")
      JSONArray().also { trimmed -> (queue.length() - MAX_QUEUE until queue.length()).forEach { trimmed.put(queue.get(it)) } }
    } else {
      queue
    }
    prefs.edit().putString(KEY_QUEUE, kept.toString()).apply()
  }

  /** Changes today's line of one app; a line from another day is dropped first. */
  private fun updateToday(context: Context, packageName: String, at: Long, change: (Tally) -> Tally) {
    val prefs = prefs(context)
    val day = dayKey(at)
    val all = if (prefs.getString(KEY_DAY, null) == day) tally(prefs.getString(KEY_TALLY, null)) else JSONObject()
    val line = all.optJSONObject(packageName)
    val next = change(Tally(line?.optInt("attempts") ?: 0, line?.optInt("breaks") ?: 0, line?.optLong("breakMs") ?: 0L))
    all.put(packageName, JSONObject().put("attempts", next.attempts).put("breaks", next.breaks).put("breakMs", next.breakMs))
    prefs.edit().putString(KEY_DAY, day).putString(KEY_TALLY, all.toString()).apply()
  }

  private fun queue(raw: String?): JSONArray = raw?.let { runCatching { JSONArray(it) }.getOrNull() } ?: JSONArray()

  private fun tally(raw: String?): JSONObject = raw?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()

  /** The local day of an instant, 'YYYY-MM-DD', the same key JS uses for days. */
  private fun dayKey(at: Long): String = Instant.ofEpochMilli(at).atZone(ZoneId.systemDefault()).toLocalDate().toString()

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
