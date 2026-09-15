import { describe, expect, it } from 'vitest';

import { blockPlan, isEmptyPlan, shieldCopy, type BlockRules } from './blocking';

const NO_RULES: BlockRules = { blockInstalls: false, blockPurchases: false, blockMature: false };
const ALL_RULES: BlockRules = { blockInstalls: true, blockPurchases: true, blockMature: true };
const TOKEN = 'ZmFrZS1zZWxlY3Rpb24=';

describe('blockPlan', () => {
  it('blocks the selection of a block mode', () => {
    const plan = blockPlan({ behavior: 'block', selectionToken: TOKEN }, NO_RULES);

    expect(plan.kind).toBe('block');
    expect(plan.token).toBe(TOKEN);
  });

  it('allows only the selection of an allow mode', () => {
    const plan = blockPlan({ behavior: 'allow', selectionToken: TOKEN }, NO_RULES);

    expect(plan.kind).toBe('allow');
    expect(plan.token).toBe(TOKEN);
  });

  it('is none without a mode', () => {
    const plan = blockPlan(null, NO_RULES);

    expect(plan.kind).toBe('none');
    expect(plan.token).toBeNull();
  });

  it('is none when the mode has no real selection, whatever its behavior', () => {
    expect(blockPlan({ behavior: 'block', selectionToken: null }, NO_RULES).kind).toBe('none');
    expect(blockPlan({ behavior: 'allow', selectionToken: null }, NO_RULES).kind).toBe('none');
  });

  it('treats a blank token as no selection', () => {
    const plan = blockPlan({ behavior: 'block', selectionToken: '   ' }, NO_RULES);

    expect(plan.kind).toBe('none');
    expect(plan.token).toBeNull();
  });

  it('carries the rules through, with or without a selection', () => {
    const withSelection = blockPlan({ behavior: 'block', selectionToken: TOKEN }, ALL_RULES);
    const without = blockPlan(null, ALL_RULES);

    for (const plan of [withSelection, without]) {
      expect(plan.blockInstalls).toBe(true);
      expect(plan.blockPurchases).toBe(true);
      expect(plan.blockMature).toBe(true);
    }
  });

  it('ignores rule fields it does not know', () => {
    const plan = blockPlan(null, { ...ALL_RULES, strictMode: true } as BlockRules);

    expect(plan).toEqual({
      kind: 'none',
      token: null,
      blockInstalls: true,
      blockPurchases: true,
      blockMature: true,
    });
  });
});

describe('isEmptyPlan', () => {
  it('is true only when there is no selection and no rule', () => {
    expect(isEmptyPlan(blockPlan(null, NO_RULES))).toBe(true);
    expect(isEmptyPlan(blockPlan({ behavior: 'block', selectionToken: TOKEN }, NO_RULES))).toBe(false);
    expect(isEmptyPlan(blockPlan(null, { ...NO_RULES, blockMature: true }))).toBe(false);
  });
});

describe('shieldCopy', () => {
  it('names the mode in the title', () => {
    const copy = shieldCopy('Sin redes');

    expect(copy.title).toBe('Vesper · Sin redes');
    expect(copy.subtitle).toBe('Estás enfocado. Esta app espera.');
    expect(copy.primaryButtonLabel).toBe('Volver a Vesper');
  });

  it('trims the name and falls back to Vesper alone', () => {
    expect(shieldCopy('  Lectura ').title).toBe('Vesper · Lectura');
    expect(shieldCopy('').title).toBe('Vesper');
    expect(shieldCopy('   ').title).toBe('Vesper');
  });
});
