import { describe, expect, it } from 'vitest';

import { en } from '../../i18n/en';
import { es } from '../../i18n/es';
import { blockingLineText, blockingReach, blockingReasonText, closingBlockingNote } from './blockingReach';

const REASON = 'el simulador no tiene Tiempo de uso';

describe('blockingReach', () => {
  it('is unavailable when the phone cannot block, whatever the mode holds', () => {
    expect(blockingReach({ available: false, reason: REASON, selected: 4, summary: '4 apps' })).toEqual({
      kind: 'unavailable',
      reason: REASON,
    });
  });

  it('is nothing picked when the phone can block but the real selection is empty', () => {
    expect(blockingReach({ available: true, reason: null, selected: 0, summary: 'Ninguna' })).toEqual({
      kind: 'nothingPicked',
    });
  });

  it('carries the platform summary when there is a real selection', () => {
    expect(blockingReach({ available: true, reason: null, selected: 3, summary: '2 apps · 1 categoría' })).toEqual({
      kind: 'real',
      summary: '2 apps · 1 categoría',
    });
  });
});

describe('blockingLineText', () => {
  it('names what a block mode blocks and what an allow mode lets through', () => {
    const reach = { kind: 'real', summary: '3 apps' } as const;
    expect(blockingLineText(reach, 'block', es.focus.blocking)).toBe('Bloquea 3 apps');
    expect(blockingLineText(reach, 'allow', es.focus.blocking)).toBe('Permite solo 3 apps');
    expect(blockingLineText(reach, 'block', en.focus.blocking)).toBe('Blocks 3 apps');
  });

  it('says a mode that blocks nothing as a plain fact, with no order and no reason', () => {
    expect(blockingLineText({ kind: 'nothingPicked' }, 'block', es.focus.blocking)).toBe('No bloquea apps');
    expect(blockingLineText({ kind: 'unavailable', reason: REASON }, 'allow', en.focus.blocking)).toBe('Blocks no apps');
  });
});

describe('blockingReasonText', () => {
  it('carries the reason only when the phone cannot block', () => {
    expect(blockingReasonText({ kind: 'unavailable', reason: REASON }, es.focus.blocking)).toBe(
      'Este teléfono no bloquea apps: el simulador no tiene Tiempo de uso.',
    );
    expect(blockingReasonText({ kind: 'unavailable', reason: null }, en.focus.blocking)).toBe(
      'This phone does not block apps.',
    );
    expect(blockingReasonText({ kind: 'nothingPicked' }, es.focus.blocking)).toBeNull();
    expect(blockingReasonText({ kind: 'real', summary: '3 apps' }, es.focus.blocking)).toBeNull();
  });
});

describe('closingBlockingNote', () => {
  it('says nothing when the session blocked something, or when the mode blocks no apps by choice', () => {
    expect(closingBlockingNote({ kind: 'real', summary: '3 apps' }, es.session.complete)).toBeNull();
    expect(closingBlockingNote({ kind: 'nothingPicked' }, en.session.complete)).toBeNull();
  });

  it('gives the reason when the phone could not block', () => {
    expect(closingBlockingNote({ kind: 'unavailable', reason: REASON }, es.session.complete)).toBe(
      'Este teléfono no bloquea apps: el simulador no tiene Tiempo de uso.',
    );
  });
});
