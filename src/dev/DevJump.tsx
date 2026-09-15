import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAppStore, useFocusStore } from '../data';
import { MINUTE } from '../domain/time';
import { DEV_SESSION, DEV_START_ROUTE } from './route';

/** Pushes DEV_START_ROUTE on mount, optionally with a fake session. Dev builds only. */
export function DevJump() {
  const router = useRouter();
  useEffect(() => {
    if (!__DEV__ || DEV_START_ROUTE === null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      if (DEV_SESSION !== null) {
        const modeId = useAppStore.getState().activeModeId;
        useFocusStore.getState().start(modeId, 25 * MINUTE, Date.now() - 3 * MINUTE);
        if (DEV_SESSION === 'completed') {
          useFocusStore.getState().setIntention('terminar el esquema de la charla');
          useFocusStore.getState().finish('completed', Date.now());
        }
      }
      router.push(DEV_START_ROUTE as never);
    }, 300);
    return () => clearTimeout(timer);
  }, [router]);
  return null;
}
