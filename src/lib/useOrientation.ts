import { useWindowDimensions } from 'react-native';

/** 'landscape' when the window is wider than tall. Reacts to rotation. */
export function useOrientation(): 'portrait' | 'landscape' {
  const { width, height } = useWindowDimensions();
  return width > height ? 'landscape' : 'portrait';
}
