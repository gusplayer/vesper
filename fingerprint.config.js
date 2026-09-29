/**
 * What the runtime version hashes beyond Expo's defaults (ADR-0054).
 *
 * An update only reaches binaries whose fingerprint matches its own (ADR-0052). The default
 * one reads each Screen Time extension's expo-target.config.js but not its Swift,
 * entitlements or Info.plist. Since react-native-device-activity no longer copies its
 * templates over targets/ on every config evaluation, that folder is ours, and a change
 * there has to ask for a build. It also counts on Android, where it changes nothing.
 */

/** @type {import('expo/fingerprint').Config} */
module.exports = {
  extraSources: [{ type: 'dir', filePath: 'targets', reasons: ['screenTimeExtensions'] }],
};
