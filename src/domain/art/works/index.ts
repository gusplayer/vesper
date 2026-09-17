import type { Artwork } from '../types';
import { dog } from './dog';
import { eiffel } from './eiffel';
import { face } from './face';
import { liberty } from './liberty';
import { pagoda } from './pagoda';

/** Registered artworks. Add a file per work and list it here. */
export const WORKS: readonly Artwork[] = [pagoda, eiffel, liberty, face, dog];
