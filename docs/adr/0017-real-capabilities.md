# ADR-0017 — Capacidades reales detrás de una capa de plataforma

**Estado:** aceptada · 2026-09-15

## Contexto

El prototipo de ADR-0016 se ve completo y no hace nada: cada permiso es un flag. Para
probarlo en un teléfono de verdad se pidieron cinco cosas: persistencia, notificaciones,
Salud, Live Activity y bloqueo de apps.

Cada una tiene un módulo nativo distinto, con distinta disponibilidad:

| Capacidad | Módulo | Simulador | Dispositivo |
|---|---|---|---|
| Persistencia | `op-sqlite` (ya estaba) | sí | sí |
| Notificaciones locales | `expo-notifications` | sí | sí, con permiso |
| Salud | `react-native-health` (HealthKit) | sí, con datos vacíos | sí, con permiso |
| Live Activity | `expo-widgets` + `@expo/ui` | parcial | sí, iOS 16.2+ |
| Bloqueo | `react-native-device-activity` (Family Controls) | **no** | solo con el entitlement de Apple |

Y una restricción que no es de código: el entitlement de Family Controls lo aprueba
Apple, tarda semanas, hay que pedirlo cuatro veces (app y tres extensiones) y hasta que
llega no se puede ni firmar un dev client con las extensiones para un dispositivo.

## Decisión

1. **Una capa `src/platform/`** con un módulo por capacidad. Cada uno expone `status()`
   con `available` y una razón en español, y funciones que no hacen nada cuando no está
   disponible. Los stores no importan la plataforma: la plataforma **se suscribe** a los
   stores desde `src/platform/hooks/`, montados una vez en `PlatformEffects`. Así la app
   compila y corre igual donde falta un módulo, y la UI dice por qué.
2. **Persistencia real sobre la capa SQLite existente.** Migración 002 con `modes` y
   `schedules`; sesiones, hábitos, marcas y ajustes ya tenían tabla. Los stores hidratan al
   arrancar y escriben a través de repositorios. Los hooks de `src/data/` no cambian de
   firma: las pantallas no se enteran.
3. **Bloqueo integrado pero declarado no verificable aquí.** El plugin genera las tres
   extensiones y el app group; el token de selección de Screen Time se guarda por modo;
   iniciar una sesión bloquea la selección y terminarla la libera. En simulador
   `status().available` es falso y la pantalla lo dice. En dispositivo depende del
   entitlement.
4. **`patch-package`** para `react-native-health`, que llama a un `setBridge:` que
   React Native 0.86 ya no tiene. Es una línea y está en `patches/`.
5. Android queda fuera de esta ronda para bloqueo y Live Activity; notificaciones y
   persistencia funcionan igual.

## Consecuencias

- Seis dependencias nuevas, todas con plugin de Expo. Se justifica: cada una es la única
  vía a una API del sistema.
- `targets/` y `patches/` se versionan. `ios/` sigue fuera de git y se regenera con
  `npx expo prebuild --platform ios --clean`.
- La compilación de iOS tarda más y tiene cuatro targets. Hay que verificarla en cada
  cambio de plugin.
- Los datos falsos de `seed.ts` pasan a ser datos de demostración: se siembran solo si la
  base está vacía, y se puede borrar todo desde Ajustes.
- Lo que sigue sin existir hasta que Apple apruebe: el bloqueo en un teléfono. Todo lo
  demás se puede probar en el dispositivo con un dev build firmado.
