import { describe, expect, it } from 'vitest';

import { dotsPath, stipple, visibleDots } from './stipple';
import type { Artwork } from './types';

const square: Artwork = {
  id: 'pagoda',
  strokes: [
    { points: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]] },
    { points: [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7], [0.3, 0.3]], fill: true, weight: 0.5 },
  ],
};

describe('stipple', () => {
  it('is deterministic for a seed and different across seeds', () => {
    const a = stipple(square, 300, 7);
    const b = stipple(square, 300, 7);
    const c = stipple(square, 300, 8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('spends about the requested budget and keeps every dot inside the unit square', () => {
    const dots = stipple(square, 500, 1);
    expect(dots.length).toBeGreaterThan(450);
    expect(dots.length).toBeLessThan(560);
    for (const dot of dots) {
      expect(dot.x).toBeGreaterThan(0);
      expect(dot.x).toBeLessThan(1);
      expect(dot.y).toBeGreaterThan(0);
      expect(dot.y).toBeLessThan(1);
      expect(dot.r).toBeGreaterThan(0);
    }
  });

  it('keeps stroke order: the outline comes before the fill', () => {
    const dots = stipple(square, 400, 3);
    const first = dots[0];
    const last = dots[dots.length - 1];
    // Outline dots sit near an edge of the outer square; fill dots sit strictly inside the inner one.
    expect(first === undefined ? 0 : Math.min(Math.abs(first.x - 0.2), Math.abs(first.y - 0.2))).toBeLessThan(0.02);
    expect(last === undefined ? 0 : last.x).toBeGreaterThan(0.3);
    expect(last === undefined ? 1 : last.x).toBeLessThan(0.7);
  });

  it('gives every stroke at least two dots even on a tiny budget', () => {
    expect(stipple(square, 1, 1).length).toBeGreaterThanOrEqual(4);
  });
});

describe('visibleDots', () => {
  it('is linear over the planned time and clamps at both ends', () => {
    expect(visibleDots(1000, 0, 60_000)).toBe(0);
    expect(visibleDots(1000, 30_000, 60_000)).toBe(500);
    expect(visibleDots(1000, 60_000, 60_000)).toBe(1000);
    expect(visibleDots(1000, 90_000, 60_000)).toBe(1000);
    expect(visibleDots(1000, -5, 60_000)).toBe(0);
  });

  it('shows everything when there is no planned time', () => {
    expect(visibleDots(42, 0, 0)).toBe(42);
  });
});

describe('dotsPath', () => {
  it('draws only the visible dots as arcs in one path', () => {
    const dots = stipple(square, 50, 1);
    const path = dotsPath(dots, 10, 300);
    expect(path.split('M').length - 1).toBe(10);
    expect(path).toMatch(/^M[\d.]+ [\d.]+m-/);
  });

  it('is empty with nothing visible', () => {
    expect(dotsPath(stipple(square, 50, 1), 0, 300)).toBe('');
  });
});
