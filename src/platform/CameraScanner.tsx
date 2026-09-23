import { useRef } from 'react';
import { StyleSheet } from 'react-native';

import { nativeModule, status } from './camera';

type CameraScannerProps = {
  /**
   * Fires once per code read. The scanner keeps running: it is the caller who decides
   * whether a code was the right one, and a wrong one should not kill the camera.
   */
  onCode: (text: string) => void;
  /** Ignore reads for this long after one fires, so a code is not read forty times a second. */
  quietMs?: number;
};

const DEFAULT_QUIET_MS = 1200;

/**
 * The camera, reading QR only, filling its parent (ADR-0035). Renders nothing where the
 * capability is missing, so a screen can drop it in and let `status().reason` explain
 * the gap — the same shape as `SelectionPicker` in BlockingSelectionView.
 *
 * It lives in `src/platform/` and not in the design system because it is a native view.
 * The parent gives it a size; the frame drawn around it is a design component.
 */
export function CameraScanner({ onCode, quietMs = DEFAULT_QUIET_MS }: CameraScannerProps) {
  const lastAt = useRef(0);
  const module = nativeModule();
  if (module === null || !status().available) {
    return null;
  }
  const View = module.CameraView;
  return (
    <View
      style={StyleSheet.absoluteFill}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={(result) => {
        const now = Date.now();
        if (now - lastAt.current < quietMs) {
          return;
        }
        lastAt.current = now;
        onCode(result.data);
      }}
    />
  );
}
