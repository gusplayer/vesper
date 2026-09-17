import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme';
import { layout, motion, radius, shadow, space } from '../tokens';
import { useReduceMotion } from '../useReduceMotion';
import { Text } from './Text';

export type BreathPhaseName = 'rest' | 'inhale' | 'hold' | 'exhale';

type BreathingObjectProps = {
  /** 'rest' looks like HeroObject (9 lived cells in ink, 7 muted). The others animate all 16 cells. */
  phase: BreathPhaseName;
  /** How long the current phase lasts in ms; the cells pace themselves to it. */
  phaseMs: number;
  onPressIn?: () => void;
  onPressOut?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const COLUMNS = 4;
const CELLS = COLUMNS * COLUMNS;
/** The cells HeroObject draws in ink: the lived part of the grid. */
const LIVED = 9;
/** A dim cell is ink at low opacity: readable on both schemes, clearly not lit. */
const DIM_DARK = 0.25;
const DIM_LIGHT = 0.18;
/** Rows start one after another at this share of the phase, and each takes this share. */
const ROW_STAGGER = 1 / 4;
const ROW_DURATION = 1 / 2;

/**
 * The Vesper tile that breathes with the finger holding it (ADR-0025). Same geometry
 * as HeroObject, but its 16 cells are lamps: inhaling lights them row by row from the
 * bottom, holding keeps them lit, exhaling dims them from the top, and rest is the
 * home tile again. Only opacity moves, never scale, never a spring. The whole tile is
 * the button; the cells are the pressed feedback. With "reduce motion" on, the cells
 * snap to where the phase ends and the words above carry the rhythm.
 */
export function BreathingObject({
  phase,
  phaseMs,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  accessibilityHint,
}: BreathingObjectProps) {
  const { colors, scheme } = useTheme();
  const reduceMotion = useReduceMotion();
  const dim = scheme === 'dark' ? DIM_DARK : DIM_LIGHT;
  const side = layout.hero;
  const cellSide = Math.round(side * 0.09);
  const gap = Math.max(2, Math.round(side * 0.03));
  const gridWidth = COLUMNS * cellSide + (COLUMNS - 1) * gap;

  // Born at rest, so the first frame is the home tile and the effect has nothing to move.
  const [lights] = useState(() => Array.from({ length: CELLS }, (_, i) => new Animated.Value(i < LIVED ? 1 : dim)));
  const restTargets = useMemo(() => lights.map((_, i) => (i < LIVED ? 1 : dim)), [lights, dim]);

  useEffect(() => {
    const row = (index: number) => Math.floor(index / COLUMNS);
    const settle = (toValue: number, ms: number) => (light: Animated.Value) =>
      Animated.timing(light, { toValue, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true });
    /**
     * Rows go one after another: `order` is 0 for the first row to move. The last row
     * is clamped so nothing is still moving when the phase ends.
     */
    const wave = (toValue: number, order: (index: number) => number) =>
      lights.map((light, index) => {
        const start = order(index) * phaseMs * ROW_STAGGER;
        const duration = Math.min(phaseMs * ROW_DURATION, phaseMs - start);
        return Animated.sequence([Animated.delay(start), settle(toValue, duration)(light)]);
      });

    let steps: Animated.CompositeAnimation[];
    let targets: number[];
    switch (phase) {
      case 'inhale':
        targets = lights.map(() => 1);
        steps = wave(1, (index) => COLUMNS - 1 - row(index));
        break;
      case 'hold':
        targets = lights.map(() => 1);
        steps = lights.map(settle(1, motion.fadeMs));
        break;
      case 'exhale':
        targets = lights.map(() => dim);
        steps = wave(dim, row);
        break;
      case 'rest':
        targets = restTargets;
        steps = lights.map((light, index) => settle(restTargets[index] ?? dim, motion.fadeMs)(light));
        break;
    }

    if (reduceMotion) {
      lights.forEach((light, index) => light.setValue(targets[index] ?? dim));
      return undefined;
    }
    const animation = Animated.parallel(steps, { stopTogether: true });
    animation.start();
    return () => animation.stop();
  }, [phase, phaseMs, lights, restTargets, dim, reduceMotion]);

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={[
        styles.tile,
        { width: side, height: side, borderRadius: side * 0.22, backgroundColor: colors.card, shadowColor: colors.shadow },
      ]}
    >
      <View style={[styles.grid, { width: gridWidth, gap }]}>
        {lights.map((light, i) => (
          <Animated.View
            key={i}
            style={[styles.cell, { width: cellSide, height: cellSide, backgroundColor: colors.ink, opacity: light }]}
          />
        ))}
      </View>
      <Text variant="caption" weight="semibold" tone="secondary" style={styles.word}>
        VESPER
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: space.sm,
    ...shadow.hero,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    borderRadius: radius.sm / 4,
  },
  word: {
    letterSpacing: 2,
  },
});
