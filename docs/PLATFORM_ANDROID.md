# Plataforma Android

Referencia técnica. Relevante a partir de la fase 2.

## Datos de uso

`UsageStatsManager.queryEvents()` con permiso `PACKAGE_USAGE_STATS`.
Da eventos `ACTIVITY_RESUMED` / `ACTIVITY_PAUSED` por paquete con timestamps reales.

Todo lo que iOS niega: desglose por app, nombres reales, histórico de ~7-14 días
anterior a la instalación, precisión de milisegundos.

El permiso no se pide con un diálogo — hay que mandar al usuario a
`Settings.ACTION_USAGE_ACCESS_SETTINGS`. Fricción alta. Pedirlo tarde en el onboarding.

## Bloqueo

**Camino elegido: foreground service + overlay.**

- Foreground service con polling de `queryEvents` cada 500-1000ms
- Al detectar un paquete bloqueado, lanzar Activity propia o
  `TYPE_APPLICATION_OVERLAY` (`SYSTEM_ALERT_WINDOW`)
- Declarar `foregroundServiceType` válido en Android 14+ y justificarlo en Play Console

**Camino prohibido: `AccessibilityService`.**

Android 17 revoca automáticamente el permiso a apps que no son herramientas de
accesibilidad cuando Advanced Protection está activo, y el usuario no puede volver a
concederlo sin apagar ese modo. Declararse `isAccessibilityTool="true"` sin serlo es
rechazo directo en Play.

Es una capacidad que Google está desmantelando. No construir sobre ella.

## Notificaciones

`NotificationListenerService` permite detectar y descartar notificaciones durante una
sesión. Es lo único que iOS no puede hacer de ninguna forma.

Permiso sensible con declaración en Play, pero defendible para una app de foco.

## Los tres dolores

1. **Battery management de OEM.** Xiaomi, Oppo, Vivo y Samsung matan foreground
   services. Necesita onboarding específico por fabricante (referencia: dontkillmyapp.com)
   y detección de service muerto con recuperación.
2. **Foreground service types.** Android 14+ exige tipo declarado y justificado.
   `specialUse` requiere texto de justificación en la consola.
3. **Fricción de permisos.** Usage access y overlay se conceden en Ajustes, no con
   diálogos. Cada uno pierde usuarios.

## Salud

**Health Connect**, no Google Fit. Los APIs de Google Fit se soportan solo hasta finales
de 2026 y Google recomienda migrar a Health Connect para apps móviles.

Tipos relevantes: `StepsRecord`, `ExerciseSessionRecord`, `SleepSessionRecord`,
`TotalCaloriesBurnedRecord`.

**Advertencia de producto:** los datos existentes de Google Fit no se transfieren
automáticamente a Health Connect — los usuarios conectan cada fuente ellos mismos.
Un usuario nuevo puede tener Health Connect completamente vacío aunque lleve años
con Fit. El onboarding tiene que detectarlo y guiarlo.

Play exige formulario de declaración específico para Health Connect. Sumar una semana
extra de review.

## Módulo `vesper-blocking` (fase 1)

Módulo Expo local en Kotlin, solo Android: `modules/vesper-blocking/`. Sin dependencias
de terceros y sin `AccessibilityService` (ADR-0019). Se autoenlaza desde `modules/` en
`npx expo prebuild`; su `AndroidManifest.xml` se fusiona con el de la app.

### Qué existe

- **Superficie JS**: `src/platform/blocking.android.ts` exporta lo mismo que
  `blocking.ios.ts` (`status`, `isAuthorized`, `requestAuthorization`,
  `selectionSummary`, `applyPlan`, `release`, `configureShield`, `isShielding`…). Los
  stores y las pantallas no saben qué plataforma responde. El token de selección
  (`Mode.selectionToken`) es un JSON con nombres de paquete; `src/domain/packageSelection.ts`
  lo lee y lo escribe.
- **Selector de apps**: `src/platform/BlockingSelectionView.tsx` lista las apps con
  actividad de lanzador (`AppCatalog.kt`, vía `<queries>`; nunca `QUERY_ALL_PACKAGES`)
  con su icono real (`AppImage`), búsqueda y casilla.
- **Servicio** `BlockingService.kt`: primer plano, tipo `specialUse`, canal
  `vesper_focus`, notificación con el título del escudo y "Sesión de foco".
  `START_STICKY`; guarda el plan en SharedPreferences (`PlanStore.kt`) para
  reencontrarlo si el sistema lo reinicia. Se detiene solo en `release()` o al llegar
  `endsAt`.
- **Vigilante** `ForegroundWatcher.kt`: cada ~800 ms con la pantalla encendida,
  `UsageStatsManager.queryEvents` sobre la ventana anterior más 2 s de solapamiento;
  actúa sobre `ACTIVITY_RESUMED`. Vesper y el launcher bajan el escudo; SystemUI y el
  teclado se ignoran; el marcador nunca se bloquea; Ajustes pasa en modo `allow`.
- **Escudo** `Shield.kt`: ventana `TYPE_APPLICATION_OVERLAY` a pantalla completa, oscura
  (`res/values/colors.xml` copia los tokens de `src/design/tokens.ts`), título,
  subtítulo y un botón "Volver" que manda al inicio. `ShieldActivity.kt` (translúcida,
  `singleInstance`, fuera de recientes) muestra lo mismo cuando `addView` falla o
  cuando la app de enfrente tiene `HIDE_NON_SYSTEM_OVERLAY_WINDOWS` (Ajustes, el
  controlador de permisos, el instalador): con ellas la superposición se añade pero el
  sistema la esconde. Android permite ese arranque desde el servicio porque la app
  tiene la superposición concedida (`BAL_ALLOW_SAW_PERMISSION`). Atrás no cierra el escudo.

### Los dos permisos

Ninguno se pide con un diálogo; `requestAuthorization()` abre la página de Ajustes,
espera a que la app vuelva al frente y vuelve a comprobar:

1. **Acceso de uso** (`PACKAGE_USAGE_STATS`, `Settings.ACTION_USAGE_ACCESS_SETTINGS`).
   Sin él no hay detección: `status()` responde "Falta el acceso de uso".
2. **Mostrar sobre otras apps** (`SYSTEM_ALERT_WINDOW`,
   `Settings.ACTION_MANAGE_OVERLAY_PERMISSION`). Sin él el escudo cae a la actividad,
   que Android 10+ puede negar desde segundo plano: "Falta mostrar sobre otras apps".

`POST_NOTIFICATIONS` (Android 13+) decide si la notificación permanente se ve; el
servicio corre igual sin ella.

### Límites

- El sistema abre la app bloqueada y el escudo la cubre en menos de un segundo; no la
  impide. Es la naturaleza del sondeo.
- Notificación permanente durante toda la sesión.
- Fabricantes que matan servicios (Xiaomi, Samsung, OnePlus…) pueden apagar el bloqueo
  en silencio. Fase 2 lo detecta (`getStatus().running`) y lo dice.
- Las reglas de instalación, compras y contenido adulto no tienen equivalente: no se
  aplican en Android y `settings/rules` lo dice.
- Si la app muere durante una sesión, el servicio sigue hasta `release()` o `endsAt`;
  la fase 1 no pasa `endsAt` todavía (llega con las ventanas de rutina, fase 2).
- Google Play revisa a mano el servicio `specialUse`: `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`
  ya lleva el texto; hace falta video antes de publicar (fase 3).

### Cómo probar con adb

```sh
export ANDROID_HOME=$HOME/Library/Android/sdk
npx expo prebuild --platform android --clean
npx expo run:android --no-bundler --device Pixel_6_API_34
adb reverse tcp:8081 tcp:8081

# Los dos permisos, sin pasar por Ajustes:
adb shell appops set com.gusplayer.vesper GET_USAGE_STATS allow
adb shell appops set com.gusplayer.vesper SYSTEM_ALERT_WINDOW allow

# Gancho de desarrollo: en src/dev/route.ts, DEV_BLOCK_TEST = 'com.android.settings'.
# A los 2 s de arrancar, la app aplica un plan 'block' con ese paquete.
npx expo start --dev-client   # en otra terminal
adb shell am start -n com.gusplayer.vesper/.MainActivity
adb shell am start -a android.settings.SETTINGS
adb exec-out screencap -p > shield.png   # el escudo cubre Ajustes

adb logcat -s VesperBlocking             # applyPlan, watching, blocked app in front, shield up/down
```

Volver a poner `DEV_BLOCK_TEST = null` antes de commitear.

## Fase 2: ventanas de rutina por el sistema

Una rutina con hora se registra en Android como **ventana** (`RoutineWindowSpec`,
`src/platform/blockingTypes.ts`): el sistema sube el escudo al empezar y lo baja al
terminar aunque la app esté cerrada. Sin JS en ningún punto del camino.

### Qué existe

- **Superficie JS** (`blocking.android.ts`): `scheduleWindow(spec)`, `cancelWindow(id)`,
  `listWindowIds()`, `requestExactAlarms()`, `requestNotifications()`,
  `openBatterySettings()`, `serviceAlive()`, `onServiceStateChanged(listener)`, y
  `applyPlan(plan, endsAt?)` que ahora lleva el fin de la sesión al servicio.
- **Aritmética compartida** `src/platform/routineWindows.ts` (`nextWindowInstants`):
  próximo inicio y próximo fin de una ventana desde el reloj, con la misma semántica que
  `src/domain/routines.ts` (lunes primero, fin ≤ inicio cruza la medianoche, fin nulo =
  inicio + `capMinutes`). Tiene tests y es la referencia; `WindowSchedule.kt` la copia
  línea por línea.
- **`WindowScheduler.kt`**: dos alarmas por ventana (inicio y fin) en `AlarmManager`,
  cada una un `PendingIntent` con URI `vesper://window/<id>` para que nunca choquen.
  `setExactAndAllowWhileIdle` cuando `canScheduleExactAlarms()`; si no,
  `setWindow` con diez minutos de holgura. Tras cada disparo se vuelve a armar la
  siguiente ocurrencia. Las ventanas se guardan como JSON en `SharedPreferences`
  (`vesper_windows`, aparte del plan) para rearmarlas sin JS.
- **`AlarmReceiver.kt`**: inicio → guarda el plan de la ventana (con `endsAt` = fin y
  `windowId`) y arranca `BlockingService`; fin → `release()` solo si el plan que corre
  es de esa ventana (una sesión manual o de otra rutina no se corta). Además
  `PLAN_END`: red de seguridad bajo un plan con `endsAt` cuyo servicio murió.
- **`BootReceiver.kt`**: `BOOT_COMPLETED`, `MY_PACKAGE_REPLACED`, `TIME_SET` y
  `TIMEZONE_CHANGED` rearman todas las ventanas; si una está abierta ahora, arranca el
  servicio. Solo `BOOT_COMPLETED`, no `LOCKED_BOOT_COMPLETED`: las preferencias no se
  leen antes del primer desbloqueo.
- **Restos de la fase 1**: el servicio se detiene solo en `endsAt` (callback en el
  main looper mientras vive; alarma `PLAN_END` si lo mataron); al cargar el módulo, un
  plan vencido se limpia y el servicio se para; evento `onServiceStateChanged` y
  `serviceAlive()` para detectar un servicio muerto; `getStatus()` suma `exactAlarm` y
  `notifications`; `openBatterySettings()` abre la lista de optimización de batería.
- **Permisos nuevos** en el manifest del módulo: `SCHEDULE_EXACT_ALARM` (toggle en
  Ajustes, apagado por defecto desde Android 13) y `RECEIVE_BOOT_COMPLETED`.
  `POST_NOTIFICATIONS` se pide con diálogo (`requestNotifications()`), vía el servicio
  de permisos de Expo.

### Por qué el servicio puede arrancar desde una alarma

Android 12+ prohíbe arrancar un servicio en primer plano desde segundo plano, con
excepciones. Dos nos cubren: `BOOT_COMPLETED` está exento, y una app con
`SYSTEM_ALERT_WINDOW` concedido también lo está. Como el bloqueo ya exige esa
superposición, la alarma puede arrancar el servicio. Si aun así el sistema lo niega, el
error se registra y no tumba el proceso.

### Cómo probar con adb

```sh
export ANDROID_HOME=$HOME/Library/Android/sdk
adb shell appops set com.gusplayer.vesper SCHEDULE_EXACT_ALARM allow
adb shell pm grant com.gusplayer.vesper android.permission.POST_NOTIFICATIONS

# Gancho: en src/dev/route.ts, DEV_WINDOW_TEST = 'com.google.android.deskclock'.
# A los 2,5 s de arrancar registra una ventana que abre a los 2 min y dura 3. Va
# después de la reconciliación de useRoutineWindowsSync, que cancela toda ventana
# que no sea de una rutina; editar una rutina durante la prueba la cancela también.
adb shell am start -n com.gusplayer.vesper/.MainActivity
adb shell input keyevent HOME
adb shell am kill com.gusplayer.vesper          # mata el proceso; NO force-stop
adb shell pidof com.gusplayer.vesper            # vacío: no hay JS vivo
# ... esperar la alarma
adb shell am start -n com.google.android.deskclock/com.android.deskclock.DeskClock
adb exec-out screencap -p > window-shield.png   # el escudo cubre el Reloj
adb logcat -s VesperBlocking                    # window ... opens / shield up / closes / shield down

adb reboot && adb wait-for-device               # BootReceiver: "re-armed N windows"
```

**`am force-stop` no sirve para esta prueba**: además de matar el proceso, cancela
todas las alarmas de la app y la deja en estado "detenida", donde tampoco recibe
`BOOT_COMPLETED` hasta que el usuario la abra otra vez. Es comportamiento del sistema,
no del módulo, y aplica también a "Forzar detención" en Ajustes.

Volver a poner `DEV_WINDOW_TEST = null` antes de commitear.

### Qué se probó (emulador Pixel 6, API 34, 2026-09-15)

- **Ventana con el proceso muerto.** `DEV_WINDOW_TEST` registró una ventana para el
  Reloj (`armed: start=… exact=true`); `am kill` dejó `pidof` vacío. A la hora exacta
  (`17:22:00.895`) `AlarmReceiver` arrancó el servicio en un proceso nuevo sin JS
  (`window dev-window-test opens; blocking until …`, `watching 1 packages`); al abrir el
  Reloj, `blocked app in front` y `shield up (overlay)` cuatro segundos después. La
  captura muestra el escudo con el texto de la ventana.
- **Fin de ventana.** A `17:25:00.003` el propio servicio se detuvo por `endsAt`
  (`plan ended; stopping`, `service stopped`, `shield down`); la alarma de fin llegó
  150 ms después, encontró el plan ya limpio (`running plan is not its own (null), left
  alone`) y rearmó la ocurrencia del día siguiente. Las dos vías funcionan y no se pisan.
- **Reinicio.** `adb reboot`: ocho segundos después de `sys.boot_completed`,
  `BOOT_COMPLETED: re-armed 1 windows` y las dos alarmas de vuelta en `dumpsys alarm`.
- **Servicio muerto.** Con la ventana abierta, `am kill` no tumba el proceso (el
  servicio en primer plano lo protege). Con `adb root` y `kill -9` el proceso murió y
  `START_STICKY` lo trajo de vuelta en tres segundos, sin JS: `watching 1 packages`
  desde un pid nuevo y `shield up (overlay)` al abrir el Reloj. Lo que un fabricante
  hace es distinto: mata y además impide el reinicio; eso no se puede simular aquí.

### Límites honestos

- **Sin el toggle de alarmas exactas** la ventana puede abrir y cerrar hasta diez
  minutos tarde (`setWindow`). Android 13+ lo apaga por defecto; la app debe pedirlo
  (`requestExactAlarms()`) y decir qué pasa si no está.
- **Fabricantes que matan procesos** (Xiaomi, Oppo, Vivo, Samsung, OnePlus): pueden
  matar el servicio a mitad de ventana y, en los peores casos, borrar las alarmas al
  "optimizar" la app. `serviceAlive()` y `onServiceStateChanged` lo detectan mientras la
  app está abierta; con la app cerrada no hay quien lo note. `openBatterySettings()`
  es lo que se puede ofrecer; ver dontkillmyapp.com por fabricante.
- **"Forzar detención"** cancela las alarmas hasta la siguiente apertura de la app.
- Una ventana abierta al **reiniciar** arranca el servicio en cuanto el usuario
  desbloquea; el tiempo entre el encendido y el desbloqueo no está cubierto.
- Un **cambio de hora o de zona horaria** rearma las ventanas desde el reloj nuevo; una
  ventana que estaba abierta puede cerrarse o abrirse según dónde caiga ahora.
