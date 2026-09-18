import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * One read of the system's "reduce motion" setting, for animations that start on mount
 * and cannot wait for a hook to settle (the boot reveal). Unavailable reads as off.
 */
export function readReduceMotion(): Promise<boolean> {
  return AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
}

/**
 * Whether the system asked for less motion, kept current while mounted. Components
 * that animate (HeatGrid, BreathingObject) snap to their final state when it is on.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) {
          setReduced(value);
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
