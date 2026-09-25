import { describe, expect, it } from 'vitest';

import { appsStepKind } from './appsStep';

const DENIED = 'el permiso de Tiempo de uso está denegado';

describe('appsStepKind', () => {
  it('is the real picker once blocking is granted', () => {
    expect(appsStepKind({ available: true, reason: null }, true)).toBe('real');
  });

  it('picks nothing where the access can still be given', () => {
    // iOS, not asked yet ("Ahora no" on the Screen Time step).
    expect(appsStepKind({ available: true, reason: null }, false)).toBe('notGranted');
    // iOS after a no: system Settings can undo it.
    expect(appsStepKind({ available: false, reason: DENIED, detail: { denied: true } }, false)).toBe('notGranted');
    // Android with usage access or the overlay off.
    expect(
      appsStepKind({ available: false, reason: 'falta el acceso', detail: { missing: 'usageAccess' } }, false),
    ).toBe('notGranted');
    expect(
      appsStepKind({ available: false, reason: 'falta mostrar', detail: { missing: 'overlay' } }, false),
    ).toBe('notGranted');
  });

  it('is the example catalogue only where no real picker exists', () => {
    expect(appsStepKind({ available: false, reason: 'el simulador no tiene Tiempo de uso' }, false)).toBe(
      'example',
    );
    expect(appsStepKind({ available: false, reason: 'esta versión de Vesper no puede bloquear apps' }, false)).toBe(
      'example',
    );
  });
});
