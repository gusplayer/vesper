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
