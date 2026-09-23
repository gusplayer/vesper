# Plataforma iOS — Screen Time

Referencia técnica. Léelo antes de tocar cualquier cosa de bloqueo, de uso o de la Live
Activity. La integración existe desde ADR-0017 (`src/platform/blocking.ios.ts`,
`liveActivity.ts`, `targets/`); **nada del bloqueo se ha verificado en un teléfono**
porque falta el entitlement. La primera mitad de este documento es la referencia de la
API; la segunda ("Integración") describe lo que hay en el repo.

## Entitlement

`com.apple.developer.family-controls` en modalidad de distribución requiere
**aprobación manual de Apple**. Tarda días o semanas.

Sin él no se puede ni construir un dev client de Expo — se queda uno atrapado en builds
locales de Xcode. Hay que pedirlo para **cada bundle identifier**, y con las tres
extensiones son cuatro solicitudes.

Requisito del usuario final: el iPhone debe tener FaceID o código configurado.
Sin eso, la autorización de Screen Time no se puede conceder. Hay que detectarlo antes
de mostrar la pantalla de permisos.

## Los cuatro componentes de Screen Time

| Componente | Sandbox | Puede escribir a App Group | En Vesper |
|---|---|---|---|
| App principal | normal | sí | `com.gusplayer.vesper` |
| `DeviceActivityMonitor` extension | normal | **sí** | `targets/ActivityMonitorExtension` |
| `ShieldAction` extension | normal | **sí** | `targets/ShieldAction` (y `ShieldConfiguration`, que solo dibuja) |
| `DeviceActivityReport` extension | solo lectura | **no** | **No existe** en el proyecto (ADR-0004) |

El proyecto de Xcode tiene además `ExpoWidgetsTarget` (la Live Activity), que no es de
Screen Time: en total cuatro targets más la app.

## Lo que se puede persistir

**Eventos de `DeviceActivityMonitor`:** `eventDidReachThreshold`,
`eventWillReachThresholdWarning`, `intervalDidStart`, `intervalDidEnd`.

**Eventos de `ShieldAction`:** cada vez que el usuario choca con un bloqueo y pulsa un
botón. Es la señal más valiosa de toda la integración: intentos de apertura, hora del
día, rendiciones. Va a `usage_events` con `kind = 'shield_hit'` y derivados.

## Lo que NO se puede persistir

Nada de `DeviceActivityReport`. La extensión corre en un sandbox de solo lectura por
diseño de Apple. Fallan silenciosamente: escrituras a `UserDefaults` de App Group,
escrituras a archivos del contenedor compartido, HTTP, notificaciones locales,
`UIPasteboard`, iCloud KVS.

Dato útil: `Application.bundleIdentifier` solo devuelve un valor no nulo **dentro de la
Report Extension**. En la app principal y en el Monitor siempre es nil.

**Consecuencia de arquitectura:** la app tiene dos superficies que nunca se reconcilian.
Ver ADR-0004.

## Estimación de uso por eventos

El API no fue diseñado para time tracking. La técnica es registrar umbrales acumulativos
y contar cuántos se disparan.

- Bloques de 2h con eventos cada 5 min: 5, 10, 15 … 115 → 23 eventos por schedule
- 12 schedules cubren el día
- Cada evento tiene su propio set de tokens, así que **se puede estimar por app**
  registrando N eventos por app dentro del mismo schedule

### Presupuesto de schedules

iOS acepta ~20-21 `DeviceActivityName` simultáneos antes de lanzar error.
Reparto propuesto:

| Uso | Schedules |
|---|---|
| Tracking de uso | 12 |
| Sesión de foco activa | 1 |
| Schedules recurrentes del usuario | 3 |
| Reserva | 4 |

**No gastar los 20.** Cuando se acaban, `startMonitoring` falla y el tracking se detiene
en silencio — el peor modo de falla posible.

### Precisión

El conteo por umbrales **siempre subcuenta**, hasta 5 min por bloque activo.
Con 4-6 bloques activos al día son 10-15 min diarios de subconteo sistemático.

**Decisión:** no aplicar factor de corrección. Presentar siempre como piso:
*"al menos 2h 15m"*. Un número que nunca exagera compra credibilidad cuando el usuario
lo compara con Ajustes.

Otros límites conocidos:
- Los eventos llegan con latencia de minutos
- Los últimos 5 min de cada intervalo son poco confiables: `intervalDidEnd` se dispara
  sin importar si hubo uso
- Registrar muchos eventos es lento; mover a background task
- No hay límite documentado de eventos por actividad, pero hay reportes de eventos que
  dejan de dispararse con conteos altos. **Medir empíricamente en device físico durante
  48h antes de dar el desglose por app por bueno**

## Bloqueo

```swift
let store = ManagedSettingsStore(named: .init("focus"))
store.shield.applications = selection.applicationTokens
store.shield.applications = nil   // liberar
```

Personalizable con `ShieldConfiguration` (diseño) y `ShieldAction` (botones).
El shield sobrevive reinicios del teléfono. Documentarlo para el usuario.

**Lista de nunca bloqueables:** teléfono, mensajes, mapas, cámara, ajustes de emergencia.
Esto no es negociable — un usuario encerrado sin poder llamar es un problema de
responsabilidad, no una reseña mala.

## Cámara (ADR-0035)

La única capacidad de **entrada** de la app: hasta la llave, iOS solo recibía órdenes
(notificaciones, escudo, Live Activity) o entregaba lecturas (Salud). Leer un código es la
primera vez que el mundo exterior cambia el estado de una sesión.

- `expo-camera`, solo QR, solo en la pantalla que lo pide. No toma fotos, no graba audio.
- `NSCameraUsageDescription` en `app.json`. El permiso se pide en el flujo del escaneo y
  en ningún otro sitio (regla 8).
- **En el simulador no existe**, y `src/platform/camera.ts` lo dice en vez de mostrar un
  rectángulo negro. Por eso el ciclo completo de la llave necesita un teléfono.
- El ADR-0021 había decidido lo contrario —"no hay escáner dentro de la app ni permiso de
  cámara"— y el ADR-0035 lo reemplaza solo en ese punto.
- El decodificador es el nativo de `expo-camera`. El **codificador** sigue siendo propio
  (`src/lib/qr.ts`): dibujar se puede a mano, leer no.

## Prohibiciones

- No resolver tokens a nombres de apps por OCR ni ningún otro medio. Apple ofusca a
  propósito y circunvalarlo es motivo de rechazo.
- No usar VPN ni perfiles MDM para bloquear. Es el camino viejo y está cerrado.

## Integración (2026-09)

Lo que hay en el repo desde ADR-0017. Nada de esto se ha podido verificar en un
teléfono: el entitlement de Family Controls todavía no está aprobado.

### El plugin

`react-native-device-activity` (0.6.x) con su config plugin en `app.json`:

```json
["react-native-device-activity", { "appleTeamId": "2D3R79CT8F", "appGroup": "group.com.gusplayer.vesper" }]
```

En `npx expo prebuild --platform ios --clean` el plugin:

- agrega `com.apple.developer.family-controls = true` y el app group a los entitlements
  de la app principal;
- escribe `REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP` en el `Info.plist`;
- copia las tres extensiones a `targets/` (ya versionadas) y las convierte en targets de
  Xcode a través de `@kingstinct/expo-apple-targets`.

### Los tres targets de `targets/`

| Carpeta | Tipo | Qué hace |
|---|---|---|
| `ActivityMonitorExtension` | `device-activity-monitor` | Recibe `intervalDidStart/End` y `eventDidReachThreshold`. Puede escribir al app group. |
| `ShieldConfiguration` | `shield-configuration` | Dibuja la pantalla de bloqueo con lo que dejó `updateShield`: título, subtítulo, botón. |
| `ShieldAction` | `shield-action` | Responde a los botones del shield. Con `behavior: 'close'` solo cierra. |

Cada `expo-target.config.js` llama a `createConfig(<tipo>)`, que pide para la
extensión los mismos dos entitlements que la app: Family Controls y el app group.

### El app group

`group.com.gusplayer.vesper`. Es el único canal entre la app y las extensiones: la
librería guarda ahí, en `UserDefaults` compartidos, la blocklist, la whitelist, el modo
"bloquear todo", la configuración del shield y los ids de selección. La extensión de
`DeviceActivityReport` no existe en este proyecto (ADR-0004: no persiste nada).

### Las cuatro solicitudes de entitlement

Apple aprueba `com.apple.developer.family-controls` por bundle identifier. Hay que
pedirlo para:

1. `com.gusplayer.vesper` (la app)
2. `com.gusplayer.vesper.ActivityMonitorExtension`
3. `com.gusplayer.vesper.ShieldConfiguration`
4. `com.gusplayer.vesper.ShieldAction`

Hasta que lleguen, un dev client firmado para dispositivo con estas extensiones falla
al firmar. El código de `src/platform/blocking.ios.ts` lo sabe y no depende de ello.
Con una cuenta gratuita, `VESPER_FREE_TEAM=1` (`app.config.js`) deja fuera estas
extensiones y el widget, y el resto de la app corre en el teléfono.

### Qué funciona dónde

| Dónde | `status()` | Qué pasa |
|---|---|---|
| Android | responde `blocking.android.ts` | Su propio módulo, con la misma superficie. Ver `PLATFORM_ANDROID.md`. |
| Simulador iOS | `el simulador no tiene Tiempo de uso` | El módulo existe pero Family Controls no funciona. Onboarding continúa, "Mis reglas" lo dice, `modes/apps?native=1` muestra la razón y "Volver". |
| iPhone sin entitlement | `falta el entitlement de Family Controls de Apple` | `requestAuthorization()` falla; se recuerda durante el lanzamiento y todo lo demás se apaga. |
| iPhone, permiso denegado | `el permiso de Tiempo de uso está denegado` | El usuario dijo que no. Se puede cambiar en Ajustes del sistema. |
| iPhone con entitlement y permiso | disponible | Selección real por modo, shield en cada sesión, filtro de adultos si la regla está activa. |

El módulo se carga con `require` dentro de un `try/catch` y una sola vez
(`nativeModule()`); ninguna pantalla lo importa directo. `BlockingSelectionView.tsx`
envuelve `DeviceActivitySelectionView` y devuelve `null` donde no está disponible.

### Cómo una sesión aplica y libera el shield

`src/platform/hooks/useBlockingSync.ts` se suscribe a `useFocusStore` (los stores no
importan la plataforma):

1. **Empieza una sesión** (`session` pasa de `null` a algo): busca el modo por
   `modeId`, arma el plan con `blockPlan(mode, settings.rules)` de
   `src/domain/blocking.ts`, y si `status().available`:
   - `configureShield(mode.name)` → `updateShield({ title: 'Vesper · <modo>', subtitle,
     primaryButtonLabel: 'Cerrar' }, { primary: { behavior: 'close' } })`, con la
     paleta de `shieldPalette.ts` (ver "Escudo", abajo);
   - `kind === 'block'` → `disableBlockAllMode` + `blockSelection({ activitySelectionToken })`;
   - `kind === 'allow'` → `enableBlockAllMode` + `addSelectionToWhitelistAndUpdateBlock(...)`;
   - `blockMature` → `setWebContentFilterPolicy({ type: 'auto' })`.
2. **Termina** (`session` vuelve a `null`): `release()` → `resetBlocks`,
   `disableBlockAllMode`, `clearWhitelistAndUpdateBlock`, `clearWebContentFilterPolicy`.
3. **Al montar con una sesión corriendo**: aplica de nuevo. ManagedSettings sobrevive
   reinicios, así que casi siempre es idempotente.
4. **Pausa** (ADR-0022, ADR-0023): `pausePlan(untilMs)` es `release()` en iOS y
   `resumePlan(plan, timing)` es `applyPlan`; el `PlanTiming` (`startedAt`, `endsAt`,
   `open`) que viaja con el plan lo ignora iOS, que espera a `release()`.

Un modo sin `selectionToken` produce `kind: 'none'`: la sesión corre igual y no bloquea
nada. El token se elige en `modes/edit` → "Apps reales (Tiempo de uso)" →
`modes/apps?native=1`, y se guarda en `Mode.selectionToken` sin resolverlo nunca a
nombres.

### Lo que la librería no expone todavía

- `blockInstalls`, `blockPurchases` y `strictMode` corresponden a
  `ManagedSettingsStore.application.denyAppInstallation`, `.appStore.denyInAppPurchases`
  y `.application.denyAppRemoval`. No hay función para ellos: quedan como UI y el pie
  de "Mis reglas" lo dice.
- El picker inline (`DeviceActivitySelectionView`) no acepta `includeEntireCategory`;
  solo la variante persistida. Por eso, en un modo "Permitir solo seleccionadas", las
  categorías elegidas pueden no pasar por la whitelist (la librería avisa por consola).
- No hay forma de distinguir "sin entitlement" de otros fallos de
  `requestAuthorization` salvo por el texto del error; cualquier fallo que no sea una
  cancelación se trata como entitlement ausente.

### Escudo (ADR-0023)

Lo que iOS dibuja encima de una app bloqueada lo decide la extensión
`ShieldConfiguration` de la librería leyendo un diccionario del app group
(`targets/ShieldConfiguration/ShieldConfigurationExtension.swift`, `buildShield`). La app
lo escribe con `updateShield` (sesión) y `updateShieldWithId` (ventanas de rutina), y las
dos llamadas pasan por `shieldConfiguration()` en `blocking.ios.ts`, así que la sesión y
la rutina se ven igual:

| Pieza | Valor | Token |
|---|---|---|
| Fondo | tinta `#1C1B1A` sobre desenfoque `dark` (`UIBlurEffectStyle.dark`) | `colors.light.ink` |
| Título | `Vesper · <modo>`, en `#F2F1EE` | `colors.dark.ink` |
| Subtítulo | "Estás enfocado. Esta app espera.", en `#A9A7A2` | `colors.dark.inkSecondary` |
| Icono | SF Symbol `square.fill`, teñido de `#F2F1EE` | `SHIELD_ICON`, `colors.dark.ink` |
| Botón | papel `#F8F7F5` con texto en tinta; dice **"Cerrar"** / **"Close"** | `colors.light.onInk`, `colors.light.ink` |

Los colores salen de `src/design/shieldPalette.ts`, que convierte los tokens a los
canales 0-255 que espera `getColor` en `ios/Shared.swift` (`UIColor(red: r / 255, …)`).
Ningún color literal vive fuera de `src/design/`. Las palabras vienen de
`session.shield` en `src/i18n` y pasan por `shieldCopy` (`src/domain/blocking.ts`).

**El botón solo cierra la app bloqueada, y por eso dice "Cerrar".** La librería ofrece
la acción `{ type: 'openApp' }`, que en `ios/Shared.swift` hace
`openUrl(urlString: "device-activity://")` y luego `sleep(ms: 1000)`; `openUrl` crea un
`NSExtensionContext()` nuevo y llama `context.open(url)`. Ese contexto no está ligado a
ningún proceso anfitrión (el sistema entrega el suyo solo a los widgets de Hoy), una
extensión no puede llamar a `UIApplication.shared.open`, y la propia librería lo tiene
abierto como issue #81 ("`openApp` action does not work"). Prometer "Volver a Vesper" con
un botón que no vuelve es peor que decir lo que hace. Por lo mismo no se registra el
esquema `device-activity` en `app.json`. El único camino honesto para traer al usuario
sería una notificación local desde la acción (`sendNotification`), que no está hecha.

Nada de esto se ve en el simulador (no hay Tiempo de uso) ni en un teléfono sin el
entitlement: se verifica con `tsc` contra las typings y leyendo el Swift que consume el
diccionario.

### Ventanas de rutina (ADR-0019)

Una rutina con hora también se programa en el sistema, para que el shield suba y baje
aunque la app esté cerrada. `src/platform/hooks/useRoutineWindowsSync.ts` se suscribe a
`useAppStore` (rutinas y modos) y, con 500 ms de espera para que un guardado en ráfaga
se asiente, reconcilia: cada rutina activa con hora cuyo modo tiene `selectionToken`
pasa por `routineWindowPlans` (`src/domain/routineWindows.ts`) y se entrega a
`scheduleWindow`; las que el sistema todavía tiene y ya nadie quiere se cancelan con
`cancelWindow`. Una rutina cuyo spec no cambió no se vuelve a programar. Sin
`status().available` no se toca nada.

Lo que `scheduleWindow` hace por rutina, en `blocking.ios.ts`:

1. `setFamilyActivitySelectionId({ id: 'routine-<id>', familyActivitySelection: token })`
   guarda el token en el app group para que la extensión lo lea sin la app.
2. `updateShieldWithId({ title, subtitle, primaryButtonLabel }, { primary: { behavior: 'close' } }, 'routine-<id>')`
   guarda la copia del shield bajo el mismo id.
3. Por cada intervalo, `configureActions` para `intervalDidStart` e `intervalDidEnd`:
   - `block`: `blockSelection { familyActivitySelectionId, shieldId }` → `unblockSelection`;
   - `allow`: `addSelectionToWhitelist` + `enableBlockAllMode { shieldId }` →
     `disableBlockAllMode` + `clearWhitelistAndUpdateBlock`.
4. `startMonitoring(nombre, schedule, [])`.

El schedule es un `DeviceActivitySchedule` con `repeats: true`:

| Días de la rutina | Actividades | `intervalStart` | `intervalEnd` |
|---|---|---|---|
| Los siete | 1: `routine-<id>-daily` | `{ hour, minute }` | `{ hour, minute }` |
| Algunos | 1 por día: `routine-<id>-<0..6>` (lunes = 0) | `{ hour, minute, weekday }` | `{ hour, minute, weekday }` |

`weekday` es el de Apple (domingo = 1, sábado = 7) y llega al `DateComponents`
nativo: la librería lo copia tal cual (`convertToSwiftDateComponents`), aunque su README
no lo documente. Con `weekday` en ambos extremos el intervalo se repite cada semana en
ese día; una ventana que cruza la medianoche (21:30 → 06:30) termina con el `weekday`
del día siguiente. Una ventana abierta termina en `start + cap` (la duración de la
rutina, o 8 h); si el resultado queda antes del inicio, es del día siguiente.

**La ventana en la que se guardó la rutina no arranca (ADR-0026 §7).** El motor en la
app ignora una ventana que ya estaba abierta cuando la rutina se guardó o se encendió
(`schedules.updated_at`), y el sistema hace lo mismo. `RoutineWindowSpec.notBefore`
lleva ese `updatedAt` (lo pone `routineWindowPlans`; como forma parte del spec, cada
guardado vuelve a entregar la rutina a `scheduleWindow`). Un `DeviceActivitySchedule`
se repite cada semana y no puede saltarse una sola ocurrencia, y si `startMonitoring`
se llama dentro del intervalo, la extensión recibe `intervalDidStart` de inmediato. Por
eso, cuando el reloj está dentro de una ocurrencia que empezó antes de `notBefore`
(`skippedWindow` en `src/platform/routineWindows.ts`), las acciones de
`intervalDidStart` llevan `neverTriggerBefore` = fin de esa ocurrencia:
`shouldExecuteAction` (`Shared.swift`) descarta la acción mientras `now <
neverTriggerBefore`, así que el `intervalDidStart` inmediato no sube nada y la
ocurrencia siguiente, que empieza después de ese instante, corre normal. Las acciones de
`intervalDidEnd` no se condicionan: sobre un escudo que nunca subió,
`unblockSelection` resta la selección de una blocklist vacía y vuelve a aplicar lo
mismo (`difference` + `updateBlock`), y `disableBlockAllMode` sobre un modo que no
estaba activo tampoco cambia nada; y si un registro anterior de la misma rutina sí
había subido el escudo (la rutina se editó con la ventana abierta y `stopMonitoring`
no dispara `intervalDidEnd`), ese fin es el que lo baja. Fuera de una ventana abierta
no se pasa `neverTriggerBefore`. Igual que el resto de esta sección, está escrito
contra el Swift de la librería, no probado en un teléfono.

Límites honestos:

- **Presupuesto de actividades.** iOS acepta ~20 `DeviceActivityName` a la vez
  (ver "Presupuesto de schedules"). Una rutina de todos los días cuesta 1; una de
  algunos días cuesta uno por día, así que tres rutinas de lunes a viernes son 15. Al
  pasarse, `startMonitoring` falla en silencio para las que sobran: `safe` lo traga y
  `__DEV__` lo avisa por consola. No hay agrupación de días consecutivos: un
  `DateComponents` lleva un solo `weekday`.
- **Mínimo de 15 minutos.** Apple rechaza intervalos más cortos; `windowEnd` estira la
  ventana a 15 minutos en vez de dejarla sin shield.
- **La sesión manda.** Cuando el motor de la app arranca la sesión de esa rutina,
  `useBlockingSync` aplica el mismo token en primer plano y, al terminar la sesión,
  `release()` hace `resetBlocks`: el shield que puso la ventana también cae. Terminar
  antes fue una decisión (ADR-0019), y el sistema no lo vuelve a subir hasta el
  siguiente `intervalDidStart`.
- **`neverTriggerBefore` es un instante, no una ocurrencia.** Solo cubre la ventana
  abierta en el momento de programar. Si una rutina de 24 h (fin = inicio) encadena
  ocurrencias sin hueco y iOS entrega el siguiente `intervalDidStart` antes del fin
  exacto de la anterior, ese arranque se pierde también; con ventanas más cortas no
  pasa. Y una rutina guardada fuera de su ventana no lleva la marca: se programa como
  siempre.
- **Nada de esto se puede probar sin el entitlement.** El simulador no tiene Tiempo de
  uso y el device sin Family Controls falla en `requestAuthorization`; las cuatro
  funciones (`scheduleWindow`, `cancelWindow`, `listWindowIds` y las acciones de la
  extensión) están escritas contra las typings y el Swift de la librería, no contra un
  teléfono. La aritmética de intervalos sí tiene tests en `src/domain/routineWindows.test.ts`.
- `requestExactAlarms`, `requestNotifications`, `serviceAlive` y `openBatterySettings`
  existen en iOS solo para que los hooks compartidos compilen en ambas plataformas:
  devuelven `true`, `true`, `status().available` y `false`.

### Rutina que arranca con la app cerrada (ADR-0023)

Lo que el usuario ve, en orden: a la hora de la rutina el sistema sube el escudo (solo
con el entitlement) y llega el aviso de `expo-notifications` "Empieza Lectura · Modo
Trabajo. Toca para empezar la sesión." La sesión **no** existe todavía: el motor de
rutinas corre en JS, y iOS suspende el JS en segundo plano (verificado el 2026-09-17:
con la app en segundo plano y el teléfono bloqueado, la base no tenía ninguna sesión
`running` a la hora del aviso). Por eso el aviso dice que tocar empieza la sesión, y no
"toca para enfocar" como si ya estuviera corriendo.

Tocar el aviso trae la app al frente; ahí `useRoutineSync` (`AppState` → `active`, o el
montaje si la app estaba muerta) llama `evaluateRoutines`, arranca la sesión de la ventana
vigente y `SessionGate` abre `/session/active`. Nadie escucha
`addNotificationResponseReceivedListener` ni lee un `url` del `data` del aviso: el
aterrizaje lo decide el store, no la notificación, así que un aviso de rutina tocado, un
aviso ignorado y la app abierta a mano llegan al mismo sitio. Verificado en el simulador
(iPhone 17) trayendo la app al frente con la ventana abierta: aterriza en la sesión con el
contador en 0:03. El toque sobre el aviso no se pudo entregar desde `idb` ni `maestro`
(SpringBoard ignora sus toques en la pantalla bloqueada y en el centro de notificaciones);
queda por confirmarlo en un teléfono.

## Live Activity (ADR-0023)

La sesión se ve en la pantalla bloqueada y en la Dynamic Island a través de
`expo-widgets`. La disposición vive en `src/widgets/FocusActivity.tsx`: Babel convierte la
función marcada `'widget'` en un string y la extensión `ExpoWidgetsTarget` lo evalúa con
sus propios globales (`@expo/ui`). Por eso la función no importa nada de la app, declara
sus tokens adentro (copiados de `src/design/tokens.ts`) y recibe cada palabra ya traducida
como prop desde `src/platform/liveActivity.ts`.

Qué manda el JS y qué cuenta el sistema:

- El JS fija `startedAt`, `endsAt`, la fase (`focus`, `open`, `break`) y el texto de la
  fase ("Enfocado", "Enfocado · sin límite", "Pausa"). **Ningún número con tiempo viaja
  como texto.** Cada reloj es un `Text timerInterval` de SwiftUI que cuenta solo: hacia
  abajo en foco y en pausa, hacia arriba en una sesión sin límite. Cuando iOS suspende el
  JS, nada se congela. No hay `setInterval` en `useLiveActivitySync`; se actualiza solo
  al empezar o terminar una pausa, al renombrar el modo y al cambiar el ajuste.
- El foco usa la tinta (fondo oscuro) y la pausa el papel (fondo claro) en el banner de
  la pantalla bloqueada, con `activityBackgroundTint`. La isla es negra siempre, el
  sistema no la tiñe: ahí la pausa se ve por el glifo (`pause.fill` en vez de
  `square.fill`) y por la línea "Pausa".
- Regiones de la isla: compacta con glifo y reloj nativo; mínima con el glifo; expandida
  con el glifo a la izquierda, el reloj a la derecha y, en la fila de abajo a todo el
  ancho, el modo y la fase. Las regiones que flanquean el sensor son estrechas: un nombre
  de modo ahí se corta ("No soci…"), por eso va abajo. La región central queda vacía a
  propósito. El reloj de la isla lleva un `frame` fijo (46/66 pt compacto, 84/118 pt
  expandido según muestre horas): un `Text timerInterval` reserva el ancho de su valor
  más largo y sin el frame la píldora compacta se estira a casi toda la barra.
- En la pantalla bloqueada atenuada iOS oculta los segundos del reloj nativo ("22:––") y
  sigue contando los minutos; es del sistema, no de la app.
- Tocarla abre `/session/active` (la URL viaja en `start()`).

Límites honestos:

- La actividad arranca solo desde la app. ActivityKit no permite crearla desde la
  extensión de `DeviceActivity` ni sin servidor de push, y Vesper no tiene servidor.
  Una rutina que arranca con la app cerrada muestra el aviso del sistema y el escudo;
  la actividad aparece al abrir la app.
- "Pausa · vuelves a las 9:01" no es posible sin formatear la hora en JS, y esa hora se
  congelaría igual que los minutos. La pausa dice "Pausa" y el reloj nativo cuenta lo
  que falta.
- Cambiar la disposición del widget exige recompilar el dev client: el string se
  evalúa en la extensión, pero los componentes que usa se compilan con ella.
- La aritmética (qué intervalo cuenta cada fase, qué texto lleva) está en
  `src/platform/liveActivityProps.ts` y tiene tests en `liveActivityProps.test.ts`.
