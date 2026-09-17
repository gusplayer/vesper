import { colors } from './tokens';

/**
 * The look of the iOS shield (ADR-0023): the session's ink. Dark ground, light text,
 * the button in paper. It is the one design piece that never renders in React:
 * react-native-device-activity hands these colors to the ShieldConfiguration
 * extension as 0-255 channels, so they are read from the tokens here and converted
 * once, and no literal color lives outside src/design/.
 */

/** A UIColor as the library's typings expect it: channels 0-255, alpha 0-1. */
export type ShieldColor = { red: number; green: number; blue: number; alpha?: number };

export type ShieldPalette = {
  backgroundColor: ShieldColor;
  titleColor: ShieldColor;
  subtitleColor: ShieldColor;
  iconTint: ShieldColor;
  primaryButtonBackgroundColor: ShieldColor;
  primaryButtonLabelColor: ShieldColor;
};

/** The SF Symbol on the shield: the same square the session and the island use. */
export const SHIELD_ICON = 'square.fill';

export function shieldPalette(): ShieldPalette {
  return {
    backgroundColor: rgb(colors.light.ink),
    titleColor: rgb(colors.dark.ink),
    subtitleColor: rgb(colors.dark.inkSecondary),
    iconTint: rgb(colors.dark.ink),
    primaryButtonBackgroundColor: rgb(colors.light.onInk),
    primaryButtonLabelColor: rgb(colors.light.ink),
  };
}

/** '#1C1B1A' → { red: 28, green: 27, blue: 26 }. Tokens are always six-digit hex. */
function rgb(hex: string): ShieldColor {
  const value = Number.parseInt(hex.slice(1), 16);
  return { red: (value >> 16) & 0xff, green: (value >> 8) & 0xff, blue: value & 0xff };
}
