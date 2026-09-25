import Foundation
import Security
import os

/**
 The identity credential as one generic-password item in the Keychain (ADR-0048, point 4).

 Synchronizable, so iCloud Keychain carries it to every device on the same Apple ID and
 keeps it across a reinstall. AfterFirstUnlock because a synchronizable item cannot be
 ThisDeviceOnly, and because the sync that runs with the app in the background must be
 able to read it while the phone is locked.

 No access group is named: the item lives in the app's default group, the team prefix
 plus the bundle id, which is the same on every device that installs the same app. A
 build signed by another team (the free-team variant of app.config.js) sees another
 Keychain.

 The value is never logged, only the OSStatus of a call that failed.
 */
enum IdentityKeychain {
  static let service = "com.gusplayer.vesper.identity"
  static let account = "identity"

  private static let logger = os.Logger(subsystem: "com.gusplayer.vesper", category: "identity")

  /// The stored value, or nil when there is none or the Keychain could not be read.
  static func read() -> String? {
    // Any: a copy that iCloud brought in and one written here are the same credential.
    var query = itemQuery(synchronizable: kSecAttrSynchronizableAny)
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    query[kSecReturnData as String] = true

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    switch status {
    case errSecSuccess:
      guard let data = item as? Data, let value = String(data: data, encoding: .utf8), !value.isEmpty else {
        return nil
      }
      return value
    case errSecItemNotFound:
      return nil
    default:
      // errSecInteractionNotAllowed before the first unlock after a reboot, for one.
      logger.warning("reading the identity failed: \(status, privacy: .public)")
      return nil
    }
  }

  /// Updates the item when there is one, adds it otherwise. False when the Keychain refused.
  static func write(_ value: String) -> Bool {
    guard !value.isEmpty, let data = value.data(using: .utf8) else {
      return false
    }
    let query = itemQuery(synchronizable: true)
    let changes: [String: Any] = [kSecValueData as String: data]

    let updated = SecItemUpdate(query as CFDictionary, changes as CFDictionary)
    if updated == errSecSuccess {
      return true
    }
    if updated != errSecItemNotFound {
      logger.warning("updating the identity failed: \(updated, privacy: .public)")
      return false
    }

    var item = query
    item[kSecValueData as String] = data
    item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
    let added = SecItemAdd(item as CFDictionary, nil)
    switch added {
    case errSecSuccess:
      return true
    case errSecDuplicateItem:
      // iCloud brought the item in between the update and the add: update that one.
      let retried = SecItemUpdate(query as CFDictionary, changes as CFDictionary)
      if retried != errSecSuccess {
        logger.warning("updating the identity failed: \(retried, privacy: .public)")
      }
      return retried == errSecSuccess
    default:
      logger.warning("adding the identity failed: \(added, privacy: .public)")
      return false
    }
  }

  /// Removes the item here and, through iCloud Keychain, on the user's other devices.
  static func delete() {
    let status = SecItemDelete(itemQuery(synchronizable: kSecAttrSynchronizableAny) as CFDictionary)
    if status != errSecSuccess && status != errSecItemNotFound {
      logger.warning("deleting the identity failed: \(status, privacy: .public)")
    }
  }

  private static func itemQuery(synchronizable: Any) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrSynchronizable as String: synchronizable,
    ]
  }
}
