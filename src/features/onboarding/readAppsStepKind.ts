import { isAuthorized, status as blockingStatus } from '../../platform/blocking';
import { appsStepKind, type AppsStepKind } from './appsStep';

/** `appsStepKind` for this phone, right now: the apps step, the commit and the preview agree. */
export function readAppsStepKind(): AppsStepKind {
  return appsStepKind(blockingStatus(), isAuthorized());
}
