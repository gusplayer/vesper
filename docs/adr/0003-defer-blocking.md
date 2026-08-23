# ADR-0003 — El bloqueo se difiere a fase 2

**Estado:** aceptada · 2026-08

## Contexto

El bloqueo de apps es la feature más visible y la que define la categoría (Opal, one sec,
Jomo). También es la más cara: entitlement con aprobación manual de Apple, tres
extensiones nativas, políticas cambiantes en Play, y anti-bypass que tarda años en
afinarse.

Ninguna parte del bloqueo es lo que diferencia a Vesper. Lo que diferencia es la
contabilidad de la vida: qué se invirtió, no solo qué se perdió.

## Decisión

Fase 1 se construye sin una sola línea de código de bloqueo, y sin pedir ningún permiso.
El bloqueo entra en fase 2, condicionado a que fase 1 pase su criterio de salida.

## Consecuencias

- Hay una app usable en 2 semanas en vez de 3 meses.
- El criterio de salida de fase 1 — *¿el autor la usa 7 días seguidos sin obligarse?* —
  es una prueba real de la hipótesis del producto. Si falla, el bloqueo no la habría
  salvado.
- El campo `block_profile` existe en `sessions` desde `001_init.sql` pero es NULL en
  fase 1. Evita una migración después.
- La configuración de sesión ya muestra el selector de perfil de bloqueo, con la opción
  `nada` como única disponible. La UI no cambia de forma en fase 2.
- Riesgo aceptado: un usuario de prueba puede decir "esto no bloquea nada". Es
  información útil, no un defecto.
