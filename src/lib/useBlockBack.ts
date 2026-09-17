import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * Swallows Android's hardware and gesture back while the screen is focused. The
 * session routes have no way back on iOS (`gestureEnabled: false`); this is the same
 * rule for Android, where the system back button would otherwise pop the session.
 * A no-op on iOS.
 */
export function useBlockBack(): void {
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => subscription.remove();
    }, []),
  );
}
