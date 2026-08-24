# Vesper

App de foco y asignación de tiempo con estética de tinta electrónica.

> Pomodoro que respeta tu tiempo, hábitos que se verifican solos, y un recordatorio honesto de cuánta vida te queda.

## Documentación

| Documento | Para qué |
|---|---|
| `CLAUDE.md` | Reglas de trabajo para Claude Code |
| `docs/PRD.md` | Qué se construye y qué no |
| `docs/DESIGN_SYSTEM.md` | Tokens, tipografía, componentes |
| `docs/ARCHITECTURE.md` | Stack, estructura, flujo de datos |
| `docs/DATA_MODEL.md` | Esquema de base de datos |
| `docs/ROADMAP.md` | Fases y criterios de salida |
| `docs/SPRINT_01.md` | Tareas del primer prototipo |
| `docs/PLATFORM_IOS.md` | Screen Time API, entitlement, límites |
| `docs/PLATFORM_ANDROID.md` | Usage stats, bloqueo, políticas de Play |
| `docs/adr/README.md` | Índice de decisiones de arquitectura |

## Empezar

Expo Go no sirve: op-sqlite es un módulo nativo, así que desde el primer día hace falta un
dev build (ADR-0001).

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

`/ios` y `/android` están en `.gitignore`: son carpetas generadas por prebuild.

### Si `npm install <paquete>` falla

`.npmrc` fija `legacy-peer-deps=true`. El árbol de SDK 57 tiene un conflicto de peers con
`react-dom` que hace fallar cualquier instalación sin ese flag.

## Tests

```bash
npm test             # unit tests de src/domain/ y src/db/sql.ts
npm run typecheck    # obligatorio antes de cerrar cualquier tarea
```

Los módulos puros se testean con vitest. Todo lo que toca op-sqlite o React se verifica
corriendo la app.

## Estado

Fase 1 — prototipo sin permisos ni bloqueo. Ver `docs/ROADMAP.md`.
