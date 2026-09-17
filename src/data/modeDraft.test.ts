import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_DEPTH } from '../domain/session';
import { draftToMode, MAX_SELECTION, useModeDraftStore } from './modeDraft';
import type { Mode } from './types';

const mode: Mode = {
  id: 'mode-1',
  name: 'Sin redes',
  behavior: 'block',
  appIds: ['instagram', 'tiktok'],
  websiteIds: ['x.com'],
  depth: 'firm',
  activityId: 'trabajo',
  selectionToken: 'token',
  createdAt: 1,
};

beforeEach(() => {
  useModeDraftStore.getState().reset();
});

describe('useModeDraftStore', () => {
  it('starts blank and loads a mode by copying its lists', () => {
    const store = useModeDraftStore.getState();
    expect(store.id).toBeNull();
    expect(store.depth).toBe(DEFAULT_DEPTH);

    store.load(mode);
    useModeDraftStore.getState().toggleApp('youtube');

    expect(useModeDraftStore.getState().appIds).toEqual(['instagram', 'tiktok', 'youtube']);
    // The mode the draft was loaded from is not touched.
    expect(mode.appIds).toEqual(['instagram', 'tiktok']);
  });

  it('toggles an id in and out', () => {
    const { toggleApp, toggleWebsite } = useModeDraftStore.getState();

    toggleApp('x');
    toggleWebsite('x.com');
    expect(useModeDraftStore.getState().appIds).toEqual(['x']);
    expect(useModeDraftStore.getState().websiteIds).toEqual(['x.com']);

    toggleApp('x');
    toggleWebsite('x.com');
    expect(useModeDraftStore.getState().appIds).toEqual([]);
    expect(useModeDraftStore.getState().websiteIds).toEqual([]);
  });

  it('adds nothing past the selection cap, but still removes', () => {
    const { toggleApp } = useModeDraftStore.getState();
    for (let i = 0; i < MAX_SELECTION; i += 1) {
      toggleApp(`app-${i}`);
    }

    toggleApp('one-too-many');
    expect(useModeDraftStore.getState().appIds).toHaveLength(MAX_SELECTION);
    expect(useModeDraftStore.getState().appIds).not.toContain('one-too-many');

    toggleApp('app-0');
    expect(useModeDraftStore.getState().appIds).toHaveLength(MAX_SELECTION - 1);
  });

  it('reset and load(null) both return to the blank draft', () => {
    useModeDraftStore.getState().load(mode);
    useModeDraftStore.getState().load(null);
    expect(useModeDraftStore.getState().id).toBeNull();
    expect(useModeDraftStore.getState().appIds).toEqual([]);

    useModeDraftStore.getState().setName('x');
    useModeDraftStore.getState().reset();
    expect(useModeDraftStore.getState().name).toBe('');
  });
});

describe('draftToMode', () => {
  it('sends the id only while editing, and trims the name', () => {
    useModeDraftStore.getState().load(mode);
    useModeDraftStore.getState().setName('  Sin redes ');

    const editing = draftToMode(useModeDraftStore.getState());
    expect(editing.id).toBe('mode-1');
    expect(editing.name).toBe('Sin redes');
    expect(editing.selectionToken).toBe('token');

    useModeDraftStore.getState().load(null);
    expect('id' in draftToMode(useModeDraftStore.getState())).toBe(false);
  });
});
