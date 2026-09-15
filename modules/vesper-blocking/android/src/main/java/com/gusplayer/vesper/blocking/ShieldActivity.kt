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
 * never becomes a place the user lands in. Back is swallowed: the button is the exit.
 */
class ShieldActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    current = WeakReference(this)
    val copy = ShieldCopy(
      title = intent.getStringExtra(EXTRA_TITLE) ?: "Vesper",
      subtitle = intent.getStringExtra(EXTRA_SUBTITLE) ?: "",
      button = intent.getStringExtra(EXTRA_BUTTON) ?: "Volver",
    )
    setContentView(Shield.build(this, copy) { goHome() })
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

  private fun goHome() {
    val home = Intent(Intent.ACTION_MAIN)
      .addCategory(Intent.CATEGORY_HOME)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { startActivity(home) }
    Shield.hide()
  }

  companion object {
    private const val TAG = "VesperBlocking"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_SUBTITLE = "subtitle"
    private const val EXTRA_BUTTON = "button"

    private var current: WeakReference<ShieldActivity>? = null

    fun open(context: Context, copy: ShieldCopy) {
      val intent = Intent(context, ShieldActivity::class.java)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
        .putExtra(EXTRA_TITLE, copy.title)
        .putExtra(EXTRA_SUBTITLE, copy.subtitle)
        .putExtra(EXTRA_BUTTON, copy.button)
      try {
        context.startActivity(intent)
        Log.i(TAG, "shield up (activity)")
      } catch (error: Exception) {
        // Background activity starts are restricted on Android 10+; without the overlay
        // permission this can be refused too. Nothing more to try this tick.
        Log.w(TAG, "ShieldActivity refused: ${error.message}")
      }
    }

    fun close() {
      current?.get()?.finish()
      current = null
    }
  }
}
