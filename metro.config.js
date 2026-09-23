const { getDefaultConfig } = require('expo/metro-config');

/**
 * The only reason this file exists: `server/` is the circle's backend (ADR-0033), it
 * lives in this repo and it has its own `node_modules`. Metro would crawl all of it on
 * every start and resolve two copies of half the toolchain. Nothing in `src/` imports
 * it, so it is blocked outright.
 */
const config = getDefaultConfig(__dirname);

config.resolver.blockList = [/\/server\/.*/];

module.exports = config;
