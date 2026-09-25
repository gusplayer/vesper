import ExpoModulesCore

/**
 The identity that travels by itself on iOS (ADR-0048, point 4): iCloud Keychain.
 expo-secure-store cannot do this, because it never sets kSecAttrSynchronizable.

 Four calls, none of which throws: a Keychain that refuses answers nil or false, and the
 app goes on with the identity it has in memory or makes a new one.
 */
public final class VesperIdentityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VesperIdentity")

    AsyncFunction("getCredential") { () -> String? in
      IdentityKeychain.read()
    }

    AsyncFunction("setCredential") { (value: String) -> Bool in
      IdentityKeychain.write(value)
    }

    AsyncFunction("clearCredential") { () -> Void in
      IdentityKeychain.delete()
    }

    AsyncFunction("describe") { () -> [String: Any] in
      // iCloud Keychain is end-to-end encrypted, so both are true. Whether the user turned
      // it on is not observable: no API says whether iCloud Keychain is enabled, and the
      // Keychain accepts a synchronizable item either way (it just stays on this phone).
      // "Travels" is the promise of the mechanism, not a fact about this phone; the screen
      // words it that way.
      [
        "travels": true,
        "endToEnd": true,
        "reason": "icloud-keychain",
      ]
    }
  }
}
