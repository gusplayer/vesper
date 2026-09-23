const { getDefaultConfig } = require('expo/metro-config');

/**
 * The only reason this file exists: `server/` is the circle's backend (ADR-0033) and
 * `web/` is the invite page (ADR-0034). Both live in this repo, neither belongs to the
 * app, and `server/` even has its own `node_modules` that Metro would crawl on every
 * start. Nothing in `src/` imports either, so both are blocked outright.
 */
const config = getDefaultConfig(__dirname);

config.resolver.blockList = [/\/server\/.*/, /\/web\/.*/];

module.exports = config;
