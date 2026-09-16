import type { DepthStrings } from '../es/depth';

export const depth: DepthStrings = {
  label: {
    soft: 'soft',
    firm: 'firm',
    deep: 'deep',
  },
  description: {
    soft: 'holding ends it right away',
    firm: 'asks you why and waits 15 seconds',
    deep: 'does not answer. only the timer ends it',
  },
  giveUp: {
    soft: 'hold to end',
    firm: 'hold to end',
    deep: 'deep · only the timer ends it',
  },
};
