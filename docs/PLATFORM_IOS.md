# Plataforma iOS — Screen Time

Referencia técnica. Relevante a partir de la fase 2. Léelo antes de tocar cualquier cosa
de bloqueo o de uso.

## Entitlement

`com.apple.developer.family-controls` en modalidad de distribución requiere
**aprobación manual de Apple**. Tarda días o semanas.

Sin él no se puede ni construir un dev client de Expo — se queda uno atrapado en builds
locales de Xcode. Hay que pedirlo para **cada bundle identifier**, y con las tres
extensiones son cuatro solicitudes.

Requisito del usuario final: el iPhone debe tener FaceID o código configurado.
Sin eso, la autorización de Screen Time no se puede conceder. Hay que detectarlo antes
de mostrar la pantalla de permisos.

## Los cuatro componentes

| Componente | Sandbox | Puede escribir a App Group |
|---|---|---|
| App principal | normal | sí |
| `DeviceActivityMonitor` extension | normal | **sí** |
| `ShieldAction` extension | normal | **sí** |
| `DeviceActivityReport` extension | solo lectura | **no** |

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
al firmar. El código de `src/platform/blocking.ts` lo sabe y no depende de ello.

### Qué funciona dónde

| Dónde | `status()` | Qué pasa |
|---|---|---|
| Android | `solo iPhone` | Nada se carga. Las pantallas no muestran la fila de apps reales. |
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
     primaryButtonLabel: 'Volver a Vesper' }, { primary: { behavior: 'close' } })`;
   - `kind === 'block'` → `disableBlockAllMode` + `blockSelection({ activitySelectionToken })`;
   - `kind === 'allow'` → `enableBlockAllMode` + `addSelectionToWhitelistAndUpdateBlock(...)`;
   - `blockMature` → `setWebContentFilterPolicy({ type: 'auto' })`.
2. **Termina** (`session` vuelve a `null`): `release()` → `resetBlocks`,
   `disableBlockAllMode`, `clearWhitelistAndUpdateBlock`, `clearWebContentFilterPolicy`.
3. **Al montar con una sesión corriendo**: aplica de nuevo. ManagedSettings sobrevive
   reinicios, así que casi siempre es idempotente.

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
