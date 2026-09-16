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

## Sesión: reloj y modo horizontal (2026-09-15)

- El timer es un reloj split-flap (`FlipClock`): cada dígito cae en dos mitades con
  aceleración natural, 340 ms, sin rebote. Verificado con capturas a mitad del giro.
- Girar el teléfono durante la sesión muestra solo el reloj grande, el modo y la barra.
  El resto de la app queda en vertical (`expo-screen-orientation`, `src/platform/orientation.ts`).
  Verificado rotando el simulador por script.

## Arte de foco (2026-09-15)

Cinco obras puntillistas que se dibujan punto a punto durante la sesión (ADR-0018):
pagoda, Torre Eiffel, Estatua de la Libertad, rostro y perro. Cada una se revisó a ojo
con el visor a 25, 50, 75 y 100 %. Verificado en simulador: la vista abre con `?art=1` y
el dibujo avanza con el reloj. No verificado: el rendimiento del trazado con 6.000 puntos
en una sesión de 90 minutos en un teléfono real.

## Rutinas y Android (2026-09-16)

- **Motor de rutinas** (ADR-0019): una rutina en ventana arranca su sesión; si hay una
  corriendo, espera; nunca arranca dos veces la misma ventana. Verificado en simulador:
  a las 16:16 de un miércoles la rutina "Trabajo" arrancó sola con "Trabajo profundo".
- **Rutinas sin hora** ("Cuando quieras · 20 min") con botón de arranque. Migración 003.
- **Focus** muestra la próxima rutina, elige el modo desde una hoja, y la píldora lleva
  la meta semanal.
- **Android compila y corre** en el emulador Pixel 6 (API 34). La capa de plataforma
  degrada con razones en español.
- **Bloqueo en Android, fase 1** (`modules/vesper-blocking/`): selector de apps por
  intent de lanzador, servicio `specialUse` que lee eventos de uso, escudo superpuesto
  con actividad de respaldo. Probado por adb en el emulador: el escudo cubrió Ajustes y
  Reloj, y bajó con "Volver".
- **Bloqueo en Android, fase 2**: cada rutina con hora son dos alarmas (`AlarmManager`,
  exactas si el usuario lo permite, con diez minutos de margen si no) que suben y bajan
  el escudo con la app cerrada; `BootReceiver` las rearma tras reiniciar; el plan lleva
  `endsAt` y el servicio se apaga solo al minuto aunque JS haya muerto; `START_STICKY`
  lo revive si lo matan. Verificado en el emulador: ventana abierta con el proceso
  muerto, escudo sobre Reloj, cierre al minuto; alarmas de vuelta tras `adb reboot`;
  servicio revivido tras `kill -9`. `docs/PLATFORM_ANDROID.md`, fase 2.
- **Bloqueo en Android, fase 3**: `docs/PLAY_DECLARATIONS.md` (servicio `specialUse`,
  permisos sensibles, seguridad de datos, notas al revisor), `docs/STORE_LISTING.md` y
  el video `docs/media/vesper-android-demo.mp4` (67 s, flujo completo por la UI real).
- **Ventanas de rutina en iOS**: cada rutina con hora es un `DeviceActivity` por día de
  la semana (uno diario si corre todos los días) con la selección y el texto del escudo
  del modo; `useRoutineWindowsSync` las reconcilia desde el store. Límites: unas 20
  actividades, ventanas de 15 minutos mínimo. Sin verificar: falta el entitlement de
  Family Controls (lo pide el dueño de la cuenta) y un iPhone real.
- No verificado en teléfonos reales de ningún fabricante.

## Cómo revisar una pantalla sin tocar

En `src/dev/route.ts` poné `DEV_START_ROUTE = '/modes'` (y `DEV_SESSION = 'running'` para
la sesión) y relanzá la app. Volvé a dejarlo en `null` antes de commitear.

## Qué falta

- Pedir el entitlement de Family Controls (distribución) en el portal de Apple y
  probar las ventanas de rutina en un iPhone real.
- Probar el bloqueo de Android en teléfonos reales (Samsung, Xiaomi: optimización de
  batería) y la ruta de alarmas inexactas.
- Pantalla de divulgación destacada antes de pedir el acceso de uso (Play la exige);
  subir el video y poner la URL en `docs/PLAY_DECLARATIONS.md`.
- Persistir la duración elegida en la hoja de sesión (`usePlannedStore`, en memoria).
- Verificar en dispositivo cada capacidad y anotar acá qué se vio.
- Historia de sesiones: la intención ahora persiste, pero solo se lee en el cierre.

## Deuda conocida

- `react-native-health` lleva un parche en `patches/` para React Native 0.86.
- Las etiquetas del libro mayor siguen en `domain/ledger.ts`, pendiente de i18n.
- `src/lib/labels.ts` está en minúscula; `DepthCards` capitaliza localmente.
- `ios/` no se versiona; regenerar con `npx expo prebuild --platform ios --clean` tras
  cambiar plugins. `targets/` y `patches/` sí se versionan.
