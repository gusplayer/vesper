import { describe, expect, it } from 'vitest';

import { workoutKindFromHealthConnect, workoutKindFromHealthKit } from './workoutKinds';

describe('workoutKindFromHealthKit', () => {
  it('reads cycling, hand cycling, running and swimming', () => {
    expect(workoutKindFromHealthKit(13)).toBe('cycling');
    expect(workoutKindFromHealthKit(74)).toBe('cycling');
    expect(workoutKindFromHealthKit(37)).toBe('running');
    expect(workoutKindFromHealthKit(46)).toBe('swimming');
  });

  it('reads every other type as other, never as a guess', () => {
    // Walking, hiking, yoga, strength, wheelchair run pace, swim-bike-run, Other.
    for (const raw of [52, 24, 57, 50, 71, 82, 3000]) {
      expect(workoutKindFromHealthKit(raw)).toBe('other');
    }
  });

  it('reads a missing or malformed type as other', () => {
    for (const raw of [undefined, null, '13', 13.5, Number.NaN, {}]) {
      expect(workoutKindFromHealthKit(raw)).toBe('other');
    }
  });
});

describe('workoutKindFromHealthConnect', () => {
  it('reads biking, running and swimming, indoors and out', () => {
    expect(workoutKindFromHealthConnect(8)).toBe('cycling');
    expect(workoutKindFromHealthConnect(9)).toBe('cycling');
    expect(workoutKindFromHealthConnect(56)).toBe('running');
    expect(workoutKindFromHealthConnect(57)).toBe('running');
    expect(workoutKindFromHealthConnect(73)).toBe('swimming');
    expect(workoutKindFromHealthConnect(74)).toBe('swimming');
  });

  it('reads every other type as other', () => {
    // Other workout, walking, hiking, yoga, strength, rowing machine.
    for (const raw of [0, 79, 37, 83, 70, 54]) {
      expect(workoutKindFromHealthConnect(raw)).toBe('other');
    }
  });

  it('reads a missing or malformed type as other', () => {
    for (const raw of [undefined, null, '8', 8.5, Number.NaN]) {
      expect(workoutKindFromHealthConnect(raw)).toBe('other');
    }
  });

  it('never borrows the other platform table', () => {
    // 37 is running in HealthKit and hiking in Health Connect; 74 is hand cycling and pool.
    expect(workoutKindFromHealthKit(37)).toBe('running');
    expect(workoutKindFromHealthConnect(37)).toBe('other');
    expect(workoutKindFromHealthKit(74)).toBe('cycling');
    expect(workoutKindFromHealthConnect(74)).toBe('swimming');
  });
});
