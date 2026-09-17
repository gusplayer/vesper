/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Build variants on top of app.json.
 *
 * VESPER_FREE_TEAM=1 builds for a free Apple developer account (a Personal Team in
 * Xcode). Apple does not let those sign App Groups or Family Controls, so the app
 * blocking extensions and the Live Activity widget are left out; src/platform/
 * reports both as unavailable and the rest of the app runs complete on the phone.
 *
 *   VESPER_FREE_TEAM=1 npx expo prebuild --platform ios --clean
 *   VESPER_FREE_TEAM=1 npx expo run:ios --device
 *
 * Without the variable the config is app.json, untouched.
 */

const { withEntitlementsPlist } = require('expo/config-plugins');

const PAID_TEAM_ONLY_PLUGINS = ['expo-widgets', 'react-native-device-activity'];

/** The Personal Team of the Apple ID signed into Xcode. Override with VESPER_APPLE_TEAM_ID. */
const FREE_TEAM_ID = process.env.VESPER_APPLE_TEAM_ID ?? '5HSPGDA67X';

/** expo-notifications adds the push entitlement; local notifications do not need it. */
const PAID_TEAM_ONLY_ENTITLEMENTS = ['aps-environment'];

function withoutPaidTeamEntitlements(config) {
  return withEntitlementsPlist(config, (mod) => {
    for (const key of PAID_TEAM_ONLY_ENTITLEMENTS) {
      delete mod.modResults[key];
    }
    return mod;
  });
}

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

module.exports = ({ config }) => {
  if (process.env.VESPER_FREE_TEAM !== '1') {
    return config;
  }

  const { build: _paidTeamBuild, ...eas } = config.extra?.eas ?? {};

  return {
    ...config,
    ios: { ...config.ios, appleTeamId: FREE_TEAM_ID },
    // First in the list so it runs after every other plugin's entitlements mod.
    plugins: [
      withoutPaidTeamEntitlements,
      ...(config.plugins ?? []).filter((plugin) => !PAID_TEAM_ONLY_PLUGINS.includes(pluginName(plugin))),
    ],
    extra: { ...config.extra, eas },
  };
};
