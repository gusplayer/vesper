package com.gusplayer.vesper.health

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle

/**
 * What Health Connect opens when the user asks why Vesper wants to read. A system
 * dialog in a task of its own: sending the user into the app instead would bring
 * MainActivity forward, and being singleTask it would close the permission sheet
 * sitting on top of it. The words are Android resources in both languages, because
 * this can open with the app closed and no JS to ask.
 */
class PermissionsRationaleActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    AlertDialog.Builder(this)
      .setTitle(R.string.vesper_health_rationale_title)
      .setMessage(R.string.vesper_health_rationale_body)
      .setPositiveButton(R.string.vesper_health_rationale_ok) { _, _ -> finish() }
      .setOnDismissListener { finish() }
      .show()
  }
}
