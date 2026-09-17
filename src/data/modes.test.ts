import { describe, expect, it } from 'vitest';

import { findModeByName } from './modes';

const modes = [
  { id: 'mode-no-socials', name: 'Sin redes' },
  { id: 'mode-family', name: 'Familia' },
  { id: 'mode-twin', name: 'sin redes' },
];

describe('findModeByName', () => {
  it('finds a mode by name, ignoring case and surrounding spaces, oldest first', () => {
    expect(findModeByName(modes, 'Sin redes')?.id).toBe('mode-no-socials');
    expect(findModeByName(modes, '  sin REDES ')?.id).toBe('mode-no-socials');
    expect(findModeByName(modes, 'familia')?.id).toBe('mode-family');
  });

  it('is undefined for a new name, an empty one, or no modes', () => {
    expect(findModeByName(modes, 'Trabajo')).toBeUndefined();
    expect(findModeByName(modes, '')).toBeUndefined();
    expect(findModeByName(modes, '   ')).toBeUndefined();
    expect(findModeByName([], 'Sin redes')).toBeUndefined();
  });
});
