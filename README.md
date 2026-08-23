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
npx expo prebuild --clean
npx expo run:ios          # o run:android
```

Después del primer build, el ciclo normal es `npx expo start --dev-client`.

`/ios` y `/android` están en `.gitignore`: son carpetas generadas por prebuild.

## Tests

```bash
npx vitest run       # unit tests de src/domain/
npx tsc --noEmit     # obligatorio antes de cerrar cualquier tarea
```

## Estado

Fase 1 — prototipo sin permisos ni bloqueo. Ver `docs/ROADMAP.md`.
