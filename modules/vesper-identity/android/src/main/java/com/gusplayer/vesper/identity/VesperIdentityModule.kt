package com.gusplayer.vesper.identity

import android.util.Log
import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.BlockstoreClient
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.tasks.Task
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * The identity that travels by itself on Android (ADR-0048, point 4): Google Play
 * services Block Store. One entry under one key, stored with cloud backup on, so it
 * reaches a new phone through the Google account (device-to-device transfer or cloud
 * restore) and survives an uninstall while Google backup is on. expo-secure-store
 * cannot do this: its Keystore key never leaves the phone.
 *
 * Four calls, none of which throws: no Play services, a Play services that fails or a
 * call that never answers resolve to null, false or 'unavailable', and the app goes on
 * with the identity it has in memory or makes a new one.
 *
 * The value is never logged: only which call failed and Play's status code.
 */
class VesperIdentityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VesperIdentity")

    AsyncFunction("getCredential") Coroutine { ->
      val client = client() ?: return@Coroutine null
      val request = RetrieveBytesRequest.Builder().setKeys(listOf(KEY)).build()
      val response = call("retrieve") { client.retrieveBytes(request) } ?: return@Coroutine null
      val bytes = response.blockstoreDataMap[KEY]?.bytes ?: return@Coroutine null
      String(bytes, Charsets.UTF_8).takeIf { it.isNotEmpty() }
    }

    AsyncFunction("setCredential") Coroutine { value: String ->
      if (value.isEmpty()) {
        return@Coroutine false
      }
      val client = client() ?: return@Coroutine false
      // To the cloud only when it goes end-to-end encrypted (a screen lock on Android 9+).
      // The backup's key is derived from this secret, so a copy Google could read would
      // be a backup Google could read — and ADR-0048 promises that nobody but the user
      // can. Without a lock the secret stays on the phone and in a device-to-device
      // transfer, and the backup key is how it travels; describe() says so. Storing with
      // it off also deletes a cloud copy made while there was a lock, on the next sync.
      val endToEnd = call("isEndToEndEncryptionAvailable") { client.isEndToEndEncryptionAvailable() } == true
      val data = StoreBytesData.Builder()
        .setKey(KEY)
        .setBytes(value.toByteArray(Charsets.UTF_8))
        .setShouldBackupToCloud(endToEnd)
        .build()
      // The key and the bytes together must fit in BlockstoreClient.MAX_SIZE (1024);
      // `<uuid>.<secret>` is well under it, and a longer value fails here as false.
      call("store") { client.storeBytes(data) } != null
    }

    AsyncFunction("clearCredential") Coroutine { ->
      val client = client() ?: return@Coroutine
      val request = DeleteBytesRequest.Builder().setKeys(listOf(KEY)).build()
      // False when there was nothing to delete: the same outcome.
      call("delete") { client.deleteBytes(request) }
      Unit
    }

    AsyncFunction("describe") Coroutine { ->
      val client = client() ?: return@Coroutine transport(false, false, REASON_UNAVAILABLE)
      // True needs Android 9 or later and a screen lock (PIN, pattern or password). An
      // Android 8 phone reports false too and reads as "no screen lock": rare, and a
      // lock is still what the screen can ask for.
      //
      // Neither answer can see whether the user turned Google backup off: then nothing
      // reaches the cloud, though a device-to-device transfer still carries it. "Travels"
      // is the promise of the mechanism, not a fact about this phone.
      when (call("isEndToEndEncryptionAvailable") { client.isEndToEndEncryptionAvailable() }) {
        true -> transport(true, true, REASON_BLOCK_STORE)
        // setCredential keeps it off the cloud without a lock, so it does not travel.
        false -> transport(false, false, REASON_NO_SCREEN_LOCK)
        null -> transport(false, false, REASON_UNAVAILABLE)
      }
    }
  }

  /** Block Store, or null when Play services is missing, disabled or too old to answer. */
  private fun client(): BlockstoreClient? {
    val context = appContext.reactContext ?: return null
    return try {
      val availability = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)
      if (availability != ConnectionResult.SUCCESS) {
        Log.i(TAG, "Play services not available: $availability")
        return null
      }
      Blockstore.getClient(context)
    } catch (error: Exception) {
      Log.w(TAG, "Block Store client failed: ${error.javaClass.simpleName}")
      null
    }
  }

  /**
   * One Block Store call, awaited with a ceiling. Null when it failed or did not answer
   * in time. The exception itself is not logged: only its class and status code.
   */
  private suspend fun <T> call(name: String, start: () -> Task<T>): T? = try {
    val result = withTimeoutOrNull(TIMEOUT_MS) { start().await() }
    if (result == null) {
      Log.w(TAG, "$name gave no answer")
    }
    result
  } catch (error: Exception) {
    val code = (error as? ApiException)?.statusCode
    Log.w(TAG, "$name failed: ${error.javaClass.simpleName} ${code ?: ""}")
    null
  }

  /** A Play services Task as a suspension, the way kotlinx-coroutines-play-services does it. */
  private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
    addOnCompleteListener { task ->
      val error = task.exception
      when {
        error != null -> continuation.resumeWithException(error)
        task.isCanceled -> continuation.cancel()
        else -> continuation.resume(task.result)
      }
    }
  }

  private fun transport(travels: Boolean, endToEnd: Boolean, reason: String): Map<String, Any> =
    mapOf("travels" to travels, "endToEnd" to endToEnd, "reason" to reason)

  private companion object {
    const val TAG = "VesperIdentity"

    /** One of at most 16 entries Block Store keeps per app (BlockstoreClient.MAX_ENTRY_COUNT). */
    const val KEY = "vesper.identity"

    /** Block Store answers in well under a second; this only keeps a stuck call from holding the boot. */
    const val TIMEOUT_MS = 10_000L

    const val REASON_BLOCK_STORE = "block-store"
    const val REASON_NO_SCREEN_LOCK = "block-store-no-screen-lock"
    const val REASON_UNAVAILABLE = "unavailable"
  }
}
