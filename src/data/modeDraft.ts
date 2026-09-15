import { create } from 'zustand';

import { DEFAULT_DEPTH } from '../domain/session';
import type { Depth } from '../domain/types';
import type { Mode, ModeBehavior } from './types';

/**
 * The mode being written on modes/edit. It lives outside the screen so the app and
 * website pickers, which are their own routes, edit the same draft and the edit screen
 * finds it unchanged when they come back. Saved through useAppStore.upsertMode.
 */

/** Brick's cap on selections per mode. A product number, not a technical one. */
export const MAX_SELECTION = 50;

export type ModeDraft = {
  /** Null while creating; the mode's id while editing. */
  id: string | null;
  name: string;
  behavior: ModeBehavior;
  appIds: string[];
  websiteIds: string[];
  depth: Depth;
  activityId: string;
  /** The real Screen Time selection, when the native picker was used. Null otherwise. */
  selectionToken: string | null;
};

type ModeDraftState = ModeDraft & {
  /** Start from an existing mode, or from a blank draft when null. */
  load: (mode: Mode | null) => void;
  reset: () => void;
  setName: (name: string) => void;
  setBehavior: (behavior: ModeBehavior) => void;
  setDepth: (depth: Depth) => void;
  setActivityId: (activityId: string) => void;
  setSelectionToken: (selectionToken: string | null) => void;
  /** Adds or removes an app; adding past MAX_SELECTION does nothing. */
  toggleApp: (id: string) => void;
  toggleWebsite: (id: string) => void;
};

const EMPTY: ModeDraft = {
  id: null,
  name: '',
  behavior: 'block',
  appIds: [],
  websiteIds: [],
  depth: DEFAULT_DEPTH,
  activityId: 'trabajo',
  selectionToken: null,
};

function toggled(ids: string[], id: string): string[] {
  if (ids.includes(id)) {
    return ids.filter((item) => item !== id);
  }
  return ids.length >= MAX_SELECTION ? ids : [...ids, id];
}

export const useModeDraftStore = create<ModeDraftState>((set) => ({
  ...EMPTY,

  load: (mode) =>
    set(
      mode === null
        ? { ...EMPTY }
        : {
            id: mode.id,
            name: mode.name,
            behavior: mode.behavior,
            appIds: [...mode.appIds],
            websiteIds: [...mode.websiteIds],
            depth: mode.depth,
            activityId: mode.activityId,
            selectionToken: mode.selectionToken,
          },
    ),

  reset: () => set({ ...EMPTY }),
  setName: (name) => set({ name }),
  setBehavior: (behavior) => set({ behavior }),
  setDepth: (depth) => set({ depth }),
  setActivityId: (activityId) => set({ activityId }),
  setSelectionToken: (selectionToken) => set({ selectionToken }),
  toggleApp: (id) => set((state) => ({ appIds: toggled(state.appIds, id) })),
  toggleWebsite: (id) => set((state) => ({ websiteIds: toggled(state.websiteIds, id) })),
}));

/** The draft as upsertMode wants it. The id is only sent while editing. */
export function draftToMode(draft: ModeDraft): Omit<Mode, 'id' | 'createdAt'> & { id?: string } {
  const base = {
    name: draft.name.trim(),
    behavior: draft.behavior,
    appIds: draft.appIds,
    websiteIds: draft.websiteIds,
    depth: draft.depth,
    activityId: draft.activityId,
    selectionToken: draft.selectionToken,
  };
  return draft.id === null ? base : { ...base, id: draft.id };
}
