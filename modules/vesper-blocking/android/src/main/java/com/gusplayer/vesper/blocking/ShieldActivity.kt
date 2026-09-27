package com.gusplayer.vesper.blocking

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import java.lang.ref.WeakReference

/**
 * The shield as an activity, for when the overlay window cannot be added. Translucent
 * theme, but the view paints the whole screen; singleInstance and out of recents so it
 * never becomes a place the user lands in. Back is swallowed: the buttons are the exit.
 * It draws the same view as the overlay, from the stored plan and the app it covers
 * (ADR-0053); with no plan left there is nothing to cover and it closes.
 */
class ShieldActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    current = WeakReference(this)
    val plan = PlanStore.load(this)
    if (plan == null) {
      finish()
      return
    }
    setContentView(Shield.build(this, plan, intent.getStringExtra(EXTRA_PACKAGE) ?: ""))
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    return keyCode == KeyEvent.KEYCODE_BACK || super.onKeyDown(keyCode, event)
  }

  override fun onDestroy() {
    if (current?.get() === this) {
      current = null
    }
    super.onDestroy()
  }

  companion object {
    private const val TAG = "VesperBlocking"
    private const val EXTRA_PACKAGE = "package"

    private var current: WeakReference<ShieldActivity>? = null

    /** True when the activity was started; false when the system refused it. */
    fun open(context: Context, blockedPackage: String): Boolean {
      val intent = Intent(context, ShieldActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
        .putExtra(EXTRA_PACKAGE, blockedPackage)
      return try {
        context.startActivity(intent)
        Log.i(TAG, "shield up (activity)")
        true
      } catch (error: Exception) {
        // Background activity starts are restricted on Android 10+; without the overlay
        // permission this can be refused too. Nothing more to try this tick; the caller
        // leaves `isShowing` false so the next tick tries again.
        Log.w(TAG, "ShieldActivity refused: ${error.message}")
        false
      }
    }

    fun close() {
      current?.get()?.finish()
      current = null
    }
  }
}
