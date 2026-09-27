import type { ChallengePhoto } from '../../domain/types';
import { photoUri } from '../../platform/camera';

/**
 * The file:// uris of a photo for `<Image>`, through `platform/camera`, so a screen
 * never reads the photos directory itself. Null when the file is not on this phone:
 * the grid then shows the mark alone and a card keeps an empty frame.
 */
export function thumbUriOf(photo: Pick<ChallengePhoto, 'thumbFile'>): string | null {
  return photoUri(photo.thumbFile);
}

export function fullUriOf(photo: Pick<ChallengePhoto, 'fullFile'>): string | null {
  return photoUri(photo.fullFile);
}
