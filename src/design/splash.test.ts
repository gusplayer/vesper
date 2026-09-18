import { describe, expect, it } from 'vitest';

import appJson from '../../app.json';
import { colors } from './tokens';

type ExpoConfig = { expo: { plugins: (string | [string, Record<string, unknown>])[] } };

function splashConfig(): Record<string, unknown> {
  const plugin = (appJson as unknown as ExpoConfig).expo.plugins.find(
    (entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen',
  );
  if (!Array.isArray(plugin)) {
    throw new Error('expo-splash-screen is not configured');
  }
  return plugin[1];
}

describe('boot reveal seam (ADR-0028)', () => {
  it('the native splash is the same ink the reveal starts from', () => {
    expect(splashConfig().backgroundColor).toBe(colors.light.ink);
  });

  it('the native splash draws no mark of its own: the reveal draws it', () => {
    expect(splashConfig().image).toBe('./assets/splash-ink.png');
  });
});
