import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { motion } from '../tokens';
import { Tooltip } from './Tooltip';

type UseTooltipOptions = {
  /** How long the bubble stays. Defaults to `motion.tooltipMs`. */
  durationMs?: number;
  /** Float over the layout instead of pushing it (see Tooltip). Defaults to true. */
  overlay?: boolean;
};

type TooltipHandle = {
  /** Shows the bubble with this message, announces it, and takes it down after a while. */
  show: (message: string) => void;
  hide: () => void;
  /** The message on screen, or null. */
  message: string | null;
  /** The bubble to render where it should appear; null while hidden. */
  element: ReactNode;
};

/**
 * The bubble that explains why a tap did nothing, with its timer and its voice: every
 * screen that had its own `setTimeout` and forgot iOS gets both from here.
 */
export function useTooltip({ durationMs = motion.tooltipMs, overlay = true }: UseTooltipOptions = {}): TooltipHandle {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setMessage(null);
  }, []);

  const show = useCallback(
    (next: string) => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      setMessage(next);
      // Android reads the bubble as a live region; iOS has none and is told.
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(next);
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        setMessage(null);
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  return {
    show,
    hide,
    message,
    element: message === null ? null : <Tooltip message={message} overlay={overlay} />,
  };
}
