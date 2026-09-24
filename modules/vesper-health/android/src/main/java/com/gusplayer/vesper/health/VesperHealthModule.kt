package com.gusplayer.vesper.health

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId
import kotlin.reflect.KClass

/**
 * Health Connect, read-only (ADR-0043). Five calls: whether it exists, the permission
 * sheet, one week of steps, workouts and sleep, and two ways out to the system (Play
 * for an install, Health Connect for linking sources). Nothing is written and nothing
 * is kept: JS turns the week into habit marks, as it does with HealthKit on iOS.
 *
 * Every read fails on its own. A permission the user did not grant, or a Health
 * Connect that answers with an error, leaves that part empty instead of the week.
 */
class VesperHealthModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** The sheet that is open, answered by OnActivityResult. At most one at a time. */
  private var pendingSheet: CompletableDeferred<Unit>? = null

  override fun definition() = ModuleDefinition {
    Name("VesperHealth")

    OnActivityResult { _, payload ->
      if (payload.requestCode == PERMISSION_REQUEST_CODE) {
        Log.i(TAG, "permission sheet closed with ${payload.resultCode}")
        pendingSheet?.complete(Unit)
        pendingSheet = null
      }
    }

    Function("sdkStatus") {
      sdkStatus(context)
    }

    AsyncFunction("requestPermissions") Coroutine { ->
      if (sdkStatus(context) != STATUS_AVAILABLE) {
        return@Coroutine emptyList<String>()
      }
      val client = HealthConnectClient.getOrCreate(context)
      val granted = client.permissionController.getGrantedPermissions()
      if (granted.containsAll(READ_PERMISSIONS)) {
        return@Coroutine granted.intersect(READ_PERMISSIONS).toList()
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        askAsRuntimePermissions()
      } else {
        askThroughHealthConnectApp()
      }
      // Whatever the sheet says it returned, what counts is what Health Connect now holds.
      client.permissionController.getGrantedPermissions().intersect(READ_PERMISSIONS).toList()
    }

    AsyncFunction("readWeek") Coroutine { fromMs: Double, sleepFromMs: Double, toMs: Double ->
      if (sdkStatus(context) != STATUS_AVAILABLE) {
        return@Coroutine emptyWeek()
      }
      val client = HealthConnectClient.getOrCreate(context)
      val from = fromMs.toLong()
      val to = toMs.toLong()
      mapOf(
        "steps" to guarded("steps") { readSteps(client, from, to) },
        "workouts" to guarded("workouts") { readWorkouts(client, from, to) },
        "sleep" to guarded("sleep") { readSleep(client, sleepFromMs.toLong(), to) },
      )
    }

    Function("openInstallPage") {
      open(Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_URL)).setPackage(PLAY_PACKAGE))
        || open(Intent(Intent.ACTION_VIEW, Uri.parse(PLAY_WEB_URL)))
    }

    Function("openHealthConnect") {
      if (sdkStatus(context) != STATUS_AVAILABLE) {
        return@Function false
      }
      open(HealthConnectClient.getHealthConnectManageDataIntent(context))
    }
  }

  /**
   * Android 14 and later: Health Connect is part of the system and its permissions are
   * runtime permissions. The library's contract hands back the generic
   * REQUEST_PERMISSIONS intent, which no activity resolves; the system sheet opens
   * through the ordinary permission request instead.
   */
  private suspend fun askAsRuntimePermissions() {
    val permissions = appContext.permissions ?: return
    val sheet = CompletableDeferred<Unit>()
    withContext(Dispatchers.Main) {
      permissions.askForPermissions({ sheet.complete(Unit) }, *READ_PERMISSIONS.toTypedArray())
    }
    sheet.await()
  }

  /** Android 9 to 13: Health Connect is an app with its own activity, answered by OnActivityResult. */
  private suspend fun askThroughHealthConnectApp() {
    val activity = appContext.currentActivity ?: return
    pendingSheet?.complete(Unit)
    val sheet = CompletableDeferred<Unit>()
    pendingSheet = sheet
    withContext(Dispatchers.Main) {
      val intent = PermissionController.createRequestPermissionResultContract().createIntent(activity, READ_PERMISSIONS)
      activity.startActivityForResult(intent, PERMISSION_REQUEST_CODE)
    }
    sheet.await()
  }

  private fun open(intent: Intent): Boolean = try {
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
  } catch (error: Exception) {
    Log.w(TAG, "could not open ${intent.data ?: intent.action}", error)
    false
  }

  private suspend fun guarded(
    part: String,
    read: suspend () -> List<Map<String, Any>>,
  ): List<Map<String, Any>> = try {
    read()
  } catch (error: Exception) {
    // SecurityException when the user left this type unchecked: an empty part.
    Log.w(TAG, "reading $part failed", error)
    emptyList()
  }

  /**
   * Steps per local day, deduplicated by Health Connect across sources: a watch and
   * the phone walking the same steps count once. Sliced by LocalDateTime so a day is
   * a calendar day even across a DST change.
   */
  private suspend fun readSteps(client: HealthConnectClient, fromMs: Long, toMs: Long): List<Map<String, Any>> {
    val zone = ZoneId.systemDefault()
    val groups = client.aggregateGroupByPeriod(
      AggregateGroupByPeriodRequest(
        metrics = setOf(StepsRecord.COUNT_TOTAL),
        timeRangeFilter = TimeRangeFilter.between(localOf(fromMs, zone), localOf(toMs, zone)),
        timeRangeSlicer = Period.ofDays(1),
      ),
    )
    return groups.mapNotNull { group ->
      val count = group.result[StepsRecord.COUNT_TOTAL] ?: return@mapNotNull null
      mapOf(
        "start" to group.startTime.atZone(zone).toInstant().toEpochMilli().toDouble(),
        "count" to count.toDouble(),
      )
    }
  }

  private suspend fun readWorkouts(client: HealthConnectClient, fromMs: Long, toMs: Long): List<Map<String, Any>> =
    readAll(client, ExerciseSessionRecord::class, between(fromMs, toMs)).map { session ->
      mapOf(
        "start" to session.startTime.toEpochMilli().toDouble(),
        "end" to session.endTime.toEpochMilli().toDouble(),
      )
    }

  /** Sessions with their stages as Health Connect's ints; JS decides what counts as asleep. */
  private suspend fun readSleep(client: HealthConnectClient, fromMs: Long, toMs: Long): List<Map<String, Any>> =
    readAll(client, SleepSessionRecord::class, between(fromMs, toMs)).map { session ->
      mapOf(
        "start" to session.startTime.toEpochMilli().toDouble(),
        "end" to session.endTime.toEpochMilli().toDouble(),
        "stages" to session.stages.map { stage ->
          mapOf(
            "start" to stage.startTime.toEpochMilli().toDouble(),
            "end" to stage.endTime.toEpochMilli().toDouble(),
            "stage" to stage.stage,
          )
        },
      )
    }

  private suspend fun <T : Record> readAll(
    client: HealthConnectClient,
    type: KClass<T>,
    filter: TimeRangeFilter,
  ): List<T> {
    val records = mutableListOf<T>()
    var pageToken: String? = null
    do {
      val response = client.readRecords(
        ReadRecordsRequest(recordType = type, timeRangeFilter = filter, pageToken = pageToken),
      )
      records += response.records
      pageToken = response.pageToken
    } while (!pageToken.isNullOrEmpty() && records.size < MAX_RECORDS)
    return records
  }

  private fun emptyWeek(): Map<String, List<Map<String, Any>>> =
    mapOf("steps" to emptyList(), "workouts" to emptyList(), "sleep" to emptyList())

  private companion object {
    const val TAG = "VesperHealth"

    /** Any number the app's activity does not already use for a result. */
    const val PERMISSION_REQUEST_CODE = 0x4845

    const val STATUS_AVAILABLE = "available"
    const val STATUS_UPDATE_REQUIRED = "updateRequired"
    const val STATUS_UNSUPPORTED = "unsupported"

    /** Health Connect runs on Android 9 and later; below that there is nothing to ask. */
    const val MIN_SDK = Build.VERSION_CODES.P

    /** A week of workouts and nights is a few dozen records; this only stops a runaway loop. */
    const val MAX_RECORDS = 5_000

    const val PLAY_PACKAGE = "com.android.vending"

    /** Health Connect's app on Android 9 to 13; the library keeps its own copy internal. */
    const val HEALTH_CONNECT_PACKAGE = "com.google.android.apps.healthdata"
    const val PLAY_URL =
      "market://details?id=$HEALTH_CONNECT_PACKAGE&url=healthconnect%3A%2F%2Fonboarding"
    const val PLAY_WEB_URL =
      "https://play.google.com/store/apps/details?id=$HEALTH_CONNECT_PACKAGE"

    val READ_PERMISSIONS: Set<String> = setOf(
      HealthPermission.getReadPermission(StepsRecord::class),
      HealthPermission.getReadPermission(ExerciseSessionRecord::class),
      HealthPermission.getReadPermission(SleepSessionRecord::class),
    )

    fun sdkStatus(context: Context): String {
      if (Build.VERSION.SDK_INT < MIN_SDK) {
        return STATUS_UNSUPPORTED
      }
      return when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> STATUS_AVAILABLE
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> STATUS_UPDATE_REQUIRED
        else -> STATUS_UNSUPPORTED
      }
    }

    fun localOf(ms: Long, zone: ZoneId): LocalDateTime = LocalDateTime.ofInstant(Instant.ofEpochMilli(ms), zone)

    fun between(fromMs: Long, toMs: Long): TimeRangeFilter =
      TimeRangeFilter.between(Instant.ofEpochMilli(fromMs), Instant.ofEpochMilli(toMs))
  }
}
