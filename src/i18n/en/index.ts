import type { Strings } from '../es';
import { activity } from './activity';
import { common } from './common';
import { demo } from './demo';
import { depth } from './depth';
import { focus } from './focus';
import { format } from './format';
import { habits } from './habits';
import { modes } from './modes';
import { notifications } from './notifications';
import { onboarding } from './onboarding';
import { routines } from './routines';
import { session } from './session';
import { settings } from './settings';

/** English, in the same voice as the Spanish: direct, short, sentence case (ADR-0020). */
export const en: Strings = {
  common,
  onboarding,
  focus,
  session,
  depth,
  modes,
  routines,
  activity,
  habits,
  settings,
  notifications,
  demo,
  format,
};
