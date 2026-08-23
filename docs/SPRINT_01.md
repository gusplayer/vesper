# Sprint 01 — primer prototipo

Objetivo: app corriendo en un dispositivo físico, tres pantallas, cero permisos.

Lee `CLAUDE.md`, `docs/PRD.md` y `docs/DESIGN_SYSTEM.md` antes de empezar.

## Tareas en orden

### 1. Scaffold — hecho

- [x] `npx create-expo-app vesper --template blank-typescript` (SDK 57, RN 0.86, React 19.2)
- [x] `strict: true` en `tsconfig.json`
- [x] `expo-dev-client`, `expo-router`, `@op-engineering/op-sqlite`, `zustand`, `expo-font`,
      `@expo-google-fonts/literata`, `expo-crypto`, `vitest`
- [x] Cargar Literata (400 regular, 500 medium) con `expo-font`
- [x] `src/lib/uuid.ts` — UUID v7 sobre `expo-crypto`, sin dependencias extra
- [x] Verificar con `npx tsc --noEmit`

### 2. Tokens y componentes base

- [x] `src/design/tokens.ts` — copiar exactamente los valores de `DESIGN_SYSTEM.md`
- [x] `Screen`, `ScreenHeader`, `Rule`, `Label`, `Caption`
- [ ] `DisplayNumber`, `Timer`
- [ ] `LedgerRow`, `Chip`, `ChoiceCard`
- [ ] `PrimaryAction`, `HoldToConfirm`, `ProgressRule`
- [ ] `TextField` — lo necesita el modo `firme` de la tarea 6
- [ ] `WeekGrid`

Criterio: ningún componente importa un color literal. Todos vienen de `tokens.ts`.

### 3. Base de datos

- [x] `src/db/client.ts` con op-sqlite
- [x] Runner de migraciones: tabla `_migrations`, cada migración en su transacción
- [x] `001_init.ts` con las tablas de fase 1 de `DATA_MODEL.md`
- [x] Seed de actividades por defecto: trabajo, lectura, aprender, gym, familia, amigos
- [x] Repositorios: `sessions`, `habits`, `activities`, `settings`
- [x] `sessions.recoverOrphans(now)` — cierra como `expired` las sesiones `running` que
      sobrevivieron a una muerte del proceso. Se llama antes del primer render

### 4. Dominio

- [x] `src/domain/types.ts`
- [x] `src/domain/session.ts` — `createSession`, `close`, `elapsed`
- [x] `src/domain/ledger.ts` — construcción del libro mayor con procedencia
- [x] `src/domain/life.ts` — semanas vividas, restantes, proyección
- [x] Unit tests de los tres módulos con vitest (`domain/` es TS puro, no necesita
      transform de RN). Cobertura objetivo 80%

Criterio: `domain/` no importa React ni la base de datos.

### 5. Pantallas

- [x] `_layout.tsx` con dos rutas y sin tab bar. El swipe vive en el pager, no acá (ADR-0009)
- [x] `app/index.tsx` — host del pager, arranca siempre en inicio
- [ ] `screens/Home.tsx` — inicio con arranque en un tap
- [ ] `app/session.tsx` — timer calculado como `now - startedAt`, no por acumulación de ticks
- [ ] `screens/Life.tsx` — la página no se monta si `life_screen_enabled` es falso
- [ ] `config/session.tsx` — modal desde tap en el número
- [ ] `config/habit.tsx` — modal de creación de hábito, con tope de 5

### 6. Comportamiento de sesión

- [ ] Los tres niveles de profundidad en `HoldToConfirm`
- [ ] Modo firme: campo de texto + espera de 15s
- [ ] Modo profundo: mantener pulsado no responde
- [ ] Background: recalcular al volver, incrementar `interruptions`

### 7. Cierre

- [ ] `npx tsc --noEmit` sin errores
- [ ] Correr en dispositivo físico iOS y Android
- [ ] README con instrucciones de arranque verificadas

## Definición de terminado

Desde abrir la app hasta estar en sesión: **un tap, menos de 3 segundos.**

Si esa condición no se cumple, el sprint no está terminado por más que todo lo demás
funcione.

## Fuera de este sprint

Permisos, salud, bloqueo, widgets, onboarding elaborado, modo oscuro, tests de UI.

La **notificación local al terminar el timer** también queda fuera, y es la única exclusión
que sorprende: exige permiso de notificaciones y el criterio de fase 1 es cero permisos.
El timer avisa con la app abierta. Ver `docs/ROADMAP.md`, fase 1.75.
