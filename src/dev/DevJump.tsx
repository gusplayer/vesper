import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAppStore, useFocusStore } from '../data';
import { MINUTE } from '../domain/time';
import { applyPlan, configureShield } from '../platform/blocking';
import { DEV_BLOCK_TEST, DEV_SESSION, DEV_START_ROUTE } from './route';

/** Pushes DEV_START_ROUTE on mount, optionally with a fake session. Dev builds only. */
export function DevJump() {
  const router = useRouter();
  useEffect(() => {
    if (!__DEV__ || DEV_BLOCK_TEST === null || Platform.OS !== 'android') {
      return undefined;
    }
    const timer = setTimeout(() => {
      configureShield('Prueba');
      applyPlan({
        kind: 'block',
        token: JSON.stringify([DEV_BLOCK_TEST]),
        blockInstalls: false,
        blockPurchases: false,
        blockMature: false,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
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
