# Vesper

App de foco y asignación de tiempo con la forma de Brick (ADR-0016) y capacidades reales
detrás de `src/platform/` (ADR-0017): SQLite, notificaciones, Salud, Live Activity y
bloqueo de apps. Corre en simulador y emulador; nada se ha verificado aún en un teléfono.

> Pomodoro que respeta tu tiempo, hábitos que se verifican solos, y un recordatorio honesto de cuánta vida te queda.

## Documentación

| Documento | Para qué |
|---|---|
| `CLAUDE.md` | Reglas de trabajo para Claude Code |
| `docs/PRD.md` | Qué se construye y qué no |
| `docs/DESIGN_SYSTEM.md` | Tokens, tipografía, componentes |
| `docs/PROTOTYPE_GUIDE.md` | Cómo se escribe una pantalla del prototipo |
| `docs/ARCHITECTURE.md` | Stack, estructura, flujo de datos |
| `docs/DATA_MODEL.md` | Esquema de base de datos |
| `docs/ROADMAP.md` | Fases y criterios de salida |
| `docs/STATUS.md` | Qué existe, dónde se verificó y qué falta. **Empieza aquí** |
| `docs/SPRINT_01.md` | Tareas del primer prototipo (histórico) |
| `docs/PLATFORM_IOS.md` | Screen Time API, entitlement, límites |
| `docs/PLATFORM_ANDROID.md` | Usage stats, bloqueo, políticas de Play |
| `docs/PLAY_DECLARATIONS.md` | Declaraciones de Google Play para el módulo de bloqueo |
| `docs/STORE_LISTING.md` | Ficha de Google Play |
| `docs/adr/README.md` | Índice de decisiones de arquitectura |

## Empezar

Expo Go no sirve: hay seis módulos nativos (SQLite, notificaciones, Salud, widgets,
Tiempo de uso en iOS y el módulo local `modules/vesper-blocking` en Android), así que
hace falta un dev build (ADR-0001, ADR-0017, ADR-0019). `postinstall` aplica el parche
de `patches/` a `react-native-health`. Con una cuenta gratuita de Apple,
`VESPER_FREE_TEAM=1` deja fuera widgets y Tiempo de uso (`app.config.js`).

```bash
npm install
```

### iOS

```bash
npx expo prebuild --platform ios
npx expo run:ios --device "iPhone 17 Pro"
```

Después del primer build, el ciclo normal es `npx expo start --dev-client`.

### Android

Requiere el SDK de Android y Java 17. Si `ANDROID_HOME` no está en el entorno:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
```

```bash
npx expo prebuild --platform android
npx expo run:android --device Pixel_6_API_34
```

`--device` toma el **nombre del AVD**, no el id de adb: `emulator-5554` falla con
`Could not find device with name`. Los AVDs disponibles salen con
`$ANDROID_HOME/emulator/emulator -list-avds`.

El primer build de Android compila Kotlin de op-sqlite, pager-view y expo-modules-core, y
tarda bastante más que el de iOS.

Cada vez que el emulador arranca hace falta abrirle el puerto de Metro, o la app queda
esperando el bundle para siempre:

```bash
$ANDROID_HOME/platform-tools/adb reverse tcp:8081 tcp:8081
```

`/ios` y `/android` están en `.gitignore`: son carpetas generadas por prebuild.

### Si `npm install <paquete>` falla

`.npmrc` fija `legacy-peer-deps=true`. El árbol de SDK 57 tiene un conflicto de peers con
`react-dom` que hace fallar cualquier instalación sin ese flag.

## Tests

```bash
npm test                     # vitest sobre src/**/*.test.ts: domain, lib, db, data, i18n, features, platform
npx vitest run --coverage    # lo mismo, con cobertura; falla bajo el 80%
npm run typecheck            # obligatorio antes de cerrar cualquier tarea
```

Los módulos puros se testean con vitest; los repositorios y las queries, contra un handle
falso de base de datos, sin módulo nativo. Los stores, las pantallas, los componentes y
la plataforma se verifican corriendo la app (`docs/STATUS.md`, "Cómo probar").

## Estado

Completa en código, verificada en simulador y emulador, pendiente de teléfonos reales y
del entitlement de Family Controls. Ver `docs/STATUS.md`; el plan por fases, en
`docs/ROADMAP.md`.
