# Estado — 2026-09-15

Dónde quedamos, qué está probado y qué falta. Se actualiza al cerrar cada tanda de
trabajo. Para el plan por fases, `ROADMAP.md`; para las tareas, `SPRINT_01.md`.

## Resumen en una línea

**Fase 1 cerrada en código, y refactorizada.** Corre en simulador de iOS y en emulador de
Android. Lo que falta para cerrar la fase no es código: es el papeleo de Apple, un
dispositivo físico y siete días de uso.

## Qué existe

Desde ADR-0017 el prototipo tiene capacidades reales detrás de `src/platform/`:

| Capacidad | Estado | Dónde se probó |
|---|---|---|
| Persistencia | Real. SQLite con migración 002; sesiones, modos, horarios, hábitos, marcas y ajustes sobreviven al relanzar. Datos de demo sembrados una vez, "Borrar todo y reiniciar" en Ajustes | Simulador: 120 sesiones demo, sesión corriendo hidratada tras relanzar |
| Notificaciones locales | Real con `expo-notifications`: fin de sesión, inicio de horarios, cierre semanal; plan determinista con tests y sincronización por identificador | Simulador consulta pendientes; no se concedió permiso, así que no se vio una notificación |
| Salud | Real con `react-native-health`: entrenamientos, pasos y sueño se leen y marcan hábitos verificados con función pura testeada | Solo compila. Sin datos de Salud en el simulador |
| Live Activity | Real con `expo-widgets`: banner, Dynamic Island y cuenta regresiva nativa | El proceso del widget ejecutó en el simulador; no se vio la pantalla bloqueada |
| Bloqueo de apps | Integrado con `react-native-device-activity`: selector nativo, token por modo, shield al iniciar sesión y liberación al terminar. **No funciona en simulador ni sin el entitlement de Apple** | Solo compila. Las tres extensiones se generan en `targets/` |

Tests: 364 en 30 archivos. `tsc` limpio. Compilación iOS con cuatro targets verificada.

## Qué NO está verificado

- **Nada en un teléfono.** Todo lo anterior se probó en el simulador iPhone 17 Pro, sin
  tocar la pantalla. Notificaciones, Salud y Live Activity necesitan el dispositivo con
  permisos concedidos.
- **Bloqueo**: imposible aquí. Requiere el entitlement de Family Controls aprobado por
  Apple, cuatro veces (app y tres extensiones). Ver `docs/PLATFORM_IOS.md`.
- Android: no se compiló desde el pivote. Bloqueo y Live Activity son solo iOS.
- Las reglas "modo estricto", "bloquear instalaciones" y "bloquear compras" son UI: la
  librería no expone esas claves de ManagedSettings. Solo el filtro de contenido adulto
  llega al sistema.

## Cómo probar en tu iPhone

1. Pedí a Apple el entitlement de Family Controls (Distribution) para
   `com.gusplayer.vesper` y sus tres extensiones `.ActivityMonitor`, `.ShieldAction`,
   `.ShieldConfiguration`. Tarda semanas; todo lo demás no lo necesita.
2. Conectá el iPhone y corré `npx expo run:ios --device` eligiendo tu teléfono. Firma con
   el team `2D3R79CT8F` (`app.json`). Con cuenta gratuita, la firma dura siete días.
3. En el teléfono: onboarding → permitir notificaciones y Salud → crear un modo → iniciar
   sesión. Deberías ver la Live Activity en la pantalla bloqueada y la notificación al
   terminar.
4. `Ajustes › Borrar todo y reiniciar` deja la base como recién instalada.

## Cómo revisar una pantalla sin tocar

En `src/dev/route.ts` poné `DEV_START_ROUTE = '/modes'` (y `DEV_SESSION = 'running'` para
la sesión) y relanzá la app. Volvé a dejarlo en `null` antes de commitear.

## Qué falta

- Android: compilar y decidir bloqueo (UsageStatsManager + overlay, sin AccessibilityService).
- Persistir la duración elegida en la hoja de sesión (`usePlannedStore`, en memoria).
- Verificar en dispositivo cada capacidad y anotar acá qué se vio.
- Historia de sesiones: la intención ahora persiste, pero solo se lee en el cierre.

## Deuda conocida

- `react-native-health` lleva un parche en `patches/` para React Native 0.86.
- Las etiquetas del libro mayor siguen en `domain/ledger.ts`, pendiente de i18n.
- `src/lib/labels.ts` está en minúscula; `DepthCards` capitaliza localmente.
- `ios/` no se versiona; regenerar con `npx expo prebuild --platform ios --clean` tras
  cambiar plugins. `targets/` y `patches/` sí se versionan.
