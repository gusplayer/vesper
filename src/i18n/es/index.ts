import { activity } from './activity';
import { circle } from './circle';
import { common } from './common';
import { demo } from './demo';
import { depth } from './depth';
import { focus } from './focus';
import { format } from './format';
import { habits } from './habits';
import { keys } from './keys';
import { modes } from './modes';
import { notifications } from './notifications';
import { onboarding } from './onboarding';
import { routines } from './routines';
import { session } from './session';
import { settings } from './settings';

/**
 * Spanish is the source of truth: `Strings` is its shape and every other language
 * has to match it, key for key, or `tsc` fails (ADR-0020).
 *
 * Rules for every namespace file, in both languages:
 * - Plain objects, never `as const`: the type is the shape, not the literal text.
 * - Text with variables is a function: `(count: number) => string`. Plurals are
 *   decided inside it, per language.
 * - Neutral Spanish addressed as tú, sentence case; English in the same voice.
 */
export const es = {
  common,
  onboarding,
  focus,
  session,
  depth,
  modes,
  routines,
  activity,
  habits,
  keys,
  circle,
  settings,
  notifications,
  demo,
  format,
};

export type Strings = typeof es;
