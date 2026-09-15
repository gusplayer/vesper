import { useCallback, useState } from 'react';

/**
 * A counter that says "the database changed underneath you". Screens read SQLite
 * synchronously inside useMemo, so the only thing a write needs to do is bump this and
 * list it as a dependency. It names an idiom that used to be spelled out by hand.
 */
export function useRevision(): [number, () => void] {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((current) => current + 1), []);
  return [revision, bump];
}
