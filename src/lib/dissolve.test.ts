import { describe, expect, it } from 'vitest';

import { dissolveLayers } from './dissolve';

const dotsIn = (path: string): number => (path.match(/M/g) ?? []).length;

describe('dissolveLayers', () => {
  it('places every dot of the grid in exactly one layer', () => {
    const layers = dissolveLayers({ width: 90, height: 30, spacing: 10, layers: 4, direction: { kind: 'inward' } });

    expect(layers).toHaveLength(4);
    expect(layers.reduce((total, layer) => total + dotsIn(layer.path), 0)).toBe(9 * 3);
  });

  it('is deterministic for the same seed and differs for another', () => {
    const options = { width: 60, height: 20, spacing: 5, layers: 6, direction: { kind: 'inward' } as const };

    expect(dissolveLayers(options)).toEqual(dissolveLayers(options));
    expect(dissolveLayers({ ...options, seed: 99 })).not.toEqual(dissolveLayers(options));
  });

  it('with no noise, inward fills the ends first and the middle last', () => {
    const layers = dissolveLayers({
      width: 100,
      height: 10,
      spacing: 10,
      layers: 5,
      direction: { kind: 'inward' },
      noise: 0,
    });

    expect(layers[0]?.path).toContain('M1.5 1.5');
    expect(layers[0]?.path).toContain('M91.5 1.5');
    expect(layers[4]?.path).toContain('M41.5 1.5');
    expect(layers[4]?.path).toContain('M51.5 1.5');
  });

  it('with no noise, radial starts at the origin and ends at the farthest corner', () => {
    const layers = dissolveLayers({
      width: 100,
      height: 100,
      spacing: 10,
      layers: 10,
      direction: { kind: 'radial', x: 0, y: 0 },
      noise: 0,
    });

    expect(layers[0]?.path).toContain('M1.5 1.5');
    expect(layers[9]?.path).toContain('M91.5 91.5');
    expect(dotsIn(layers[9]?.path ?? '')).toBeGreaterThan(0);
  });

  it('returns empty layers for an empty field', () => {
    const layers = dissolveLayers({ width: 0, height: 50, spacing: 8, layers: 3, direction: { kind: 'inward' } });

    expect(layers).toEqual([{ path: '' }, { path: '' }, { path: '' }]);
  });
});
