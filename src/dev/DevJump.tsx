import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAppStore, useFocusStore } from '../data';
import { dayBounds } from '../domain/day';
import { MINUTE } from '../domain/time';
import { applyPlan, configureShield } from '../platform/blocking';
// The Android file by name: windows are an Android-only surface for now, and the
// module inside is inert elsewhere (nativeModule() answers null off Android).
import { scheduleWindow } from '../platform/blocking.android';
import { DEV_BLOCK_TEST, DEV_SESSION, DEV_SKIP_ONBOARDING, DEV_START_ROUTE, DEV_WINDOW_TEST } from './route';

const MINUTES_PER_DAY = 24 * 60;
const WINDOW_TEST_LEAD_MIN = 2;
const WINDOW_TEST_LENGTH_MIN = 3;
const WINDOW_TEST_DELAY_MS = 2500;

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
    if (!__DEV__ || DEV_WINDOW_TEST === null || Platform.OS !== 'android') {
      return undefined;
    }
    // After useRoutineWindowsSync's mount reconcile (500 ms), which cancels any
    // window that is not a routine's; a later routine or mode edit cancels it too.
    const timer = setTimeout(() => {
      // Two minutes from now, every day, three minutes long; a start past midnight
      // wraps and an end past midnight crosses it, as the spec allows.
      const now = Date.now();
      const minuteOfDay = Math.floor((now - dayBounds(now).dayStart) / MINUTE);
      const startMinute = (minuteOfDay + WINDOW_TEST_LEAD_MIN) % MINUTES_PER_DAY;
      const endMinute = (startMinute + WINDOW_TEST_LENGTH_MIN) % MINUTES_PER_DAY;
      void scheduleWindow({
        id: 'dev-window-test',
        startMinute,
        endMinute,
        capMinutes: WINDOW_TEST_LENGTH_MIN,
        days: [true, true, true, true, true, true, true],
        token: JSON.stringify([DEV_WINDOW_TEST]),
        kind: 'block',
        shieldTitle: 'Prueba de ventana',
        shieldSubtitle: 'Programada por el sistema',
        shieldButton: 'Volver',
      });
    }, WINDOW_TEST_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (__DEV__ && DEV_SKIP_ONBOARDING && !useAppStore.getState().settings.onboardingDone) {
      useAppStore.getState().updateSettings({ onboardingDone: true });
    }
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
