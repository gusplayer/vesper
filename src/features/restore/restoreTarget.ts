import { create } from 'zustand';

import type { Credentials } from '../../platform/circleApi';

/**
 * The key a restore is about to use, handed from the screen that got it (a pasted key,
 * or the previous Vesper the welcome screen found) to the screen that runs it. In
 * memory only and never in a route: a route's params can end up in a log or a link,
 * and this is the whole account.
 */
type RestoreTargetState = {
  credentials: Credentials | null;
  setTarget: (credentials: Credentials | null) => void;
};

export const useRestoreTarget = create<RestoreTargetState>((set) => ({
  credentials: null,
  setTarget: (credentials) => set({ credentials }),
}));
