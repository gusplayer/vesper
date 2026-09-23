import { describe, expect, it } from 'vitest';

import { dotMatrixPaths, inFinder } from './dotMatrix';
import { encodeQr } from './qr';

/**
 * The code has to stay readable: a decoder finds the three finder patterns first, so
 * those stay square while everything else becomes a dot. These tests hold that line.
 * Whether a real camera reads it is verified on a phone, not here.
 */

describe('inFinder', () => {
  const size = 29; // a version 3 code, what a key's code encodes to

  it('covers the three corners and not the fourth', () => {
    expect(inFinder(0, 0, size)).toBe(true);
    expect(inFinder(6, 6, size)).toBe(true);
    expect(inFinder(size - 1, 0, size)).toBe(true);
    expect(inFinder(0, size - 1, size)).toBe(true);
    // Bottom right is where the alignment pattern lives, never a finder.
    expect(inFinder(size - 1, size - 1, size)).toBe(false);
  });

  it('leaves the middle alone', () => {
    expect(inFinder(7, 7, size)).toBe(false);
    expect(inFinder(14, 14, size)).toBe(false);
    expect(inFinder(6, 7, size)).toBe(false);
  });
});

describe('dotMatrixPaths', () => {
  const matrix = encodeQr('VK1:0199a3c1:0badc0ffee11');

  it('draws every dark module exactly once, as a square or as a dot', () => {
    const dark = matrix.flat().filter(Boolean).length;
    const { finders, dots } = dotMatrixPaths(matrix);
    const squares = (finders.match(/M/g) ?? []).length;
    const circles = (dots.match(/M/g) ?? []).length;

    expect(squares + circles).toBe(dark);
    expect(squares).toBeGreaterThan(0);
    expect(circles).toBeGreaterThan(0);
  });

  it('puts the corners in the square path and nothing else there', () => {
    const size = matrix.length;
    const { finders } = dotMatrixPaths(matrix);
    // The top-left finder is dark at its origin in every QR code.
    expect(matrix[0]?.[0]).toBe(true);
    expect(finders).toContain('M0 0h1v1h-1z');
    // A module in the middle is never in the square path.
    const middle = Math.floor(size / 2);
    expect(finders).not.toContain(`M${middle} ${middle}h1v1h-1z`);
  });

  it('writes dots as closed arcs, with no NaN from the rounding', () => {
    const { dots } = dotMatrixPaths(matrix);
    expect(dots).not.toContain('NaN');
    expect(dots.endsWith('z')).toBe(true);
    expect(dots).toMatch(/^M[\d.]+ [\d.]+a/);
  });

  it('gives an empty pair for an empty matrix rather than throwing', () => {
    expect(dotMatrixPaths([])).toEqual({ finders: '', dots: '' });
  });
});
