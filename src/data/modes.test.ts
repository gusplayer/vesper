import { describe, expect, it } from 'vitest';

import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { duplicateName, findModeByName, modeSummaryText } from './modes';

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

describe('modeSummaryText', () => {
  const mode = { behavior: 'block' as const, appIds: ['instagram', 'tiktok', 'x', 'facebook'], websiteIds: ['x.com'] };

  it('counts the real selection where there is a real picker', () => {
    expect(modeSummaryText(mode, es.modes, { kind: 'real', selection: '3 apps' })).toBe('Bloquea 3 apps');
    expect(modeSummaryText({ ...mode, behavior: 'allow' }, es.modes, { kind: 'real', selection: '2 apps' })).toBe(
      'Permite solo 2 apps',
    );
  });

  it('asks for the apps again when they were picked on the phone this was restored from', () => {
    expect(modeSummaryText(mode, es.modes, { kind: 'real', selection: null, repick: true })).toBe('Vuelve a elegir las apps');
    expect(modeSummaryText(mode, en.modes, { kind: 'real', selection: null, repick: true })).toBe('Pick the apps again');
    expect(modeSummaryText(mode, es.modes, { kind: 'real', selection: '3 apps', repick: true })).toBe('Bloquea 3 apps');
  });

  it('says a mode with nothing picked blocks no apps, as a plain fact', () => {
    expect(modeSummaryText(mode, es.modes, { kind: 'real', selection: null })).toBe('No bloquea apps');
    expect(modeSummaryText(mode, en.modes, { kind: 'real', selection: null })).toBe('Blocks no apps');
  });

  it('labels the catalogue as an example where no real picker exists, and claims no blocking', () => {
    expect(modeSummaryText(mode, es.modes, { kind: 'example' })).toBe('4 apps · 1 sitio de ejemplo');
    expect(modeSummaryText(mode, en.modes, { kind: 'example' })).toBe('4 apps · 1 site (example)');
    expect(modeSummaryText({ ...mode, appIds: [], websiteIds: [] }, es.modes, { kind: 'example' })).toBe(
      'No bloquea apps',
    );
  });
});

describe('duplicateName', () => {
  it('numbers the first copy (1) and the next free number after that', () => {
    expect(duplicateName('Sin redes', ['Sin redes'])).toBe('Sin redes (1)');
    expect(duplicateName('Sin redes', ['Sin redes', 'Sin redes (1)'])).toBe('Sin redes (2)');
  });

  it('counts a copy of a copy from the same base', () => {
    expect(duplicateName('Sin redes (1)', ['Sin redes', 'Sin redes (1)'])).toBe('Sin redes (2)');
  });

  it('compares names the way the user reads them', () => {
    expect(duplicateName('Leer', ['leer (1) '])).toBe('Leer (2)');
  });
});
