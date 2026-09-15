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
- [x] `DisplayNumber`, `Timer`
- [x] `LedgerRow`, `Chip`, `ChipRow`, `ChoiceCard`
- [x] `PrimaryAction`, `HoldToConfirm`, `ProgressRule`
- [x] `TextField` — lo necesita el modo `firme` de la tarea 6
- [x] `WeekGrid`
- [x] `TextAction` y `FatalError` — no estaban previstos. Ver ADR-0011 y `_layout.tsx`

Criterio: ningún componente importa un color literal. Todos vienen de `tokens.ts`.

### 3. Base de datos

- [x] `src/db/client.ts` con op-sqlite
- [x] Runner de migraciones: tabla `_migrations`, cada migración en su transacción
- [x] `001_init.ts` con las tablas de fase 1 de `DATA_MODEL.md`
- [x] Seed de actividades por defecto: trabajo, lectura, aprender, gym, familia, amigos
- [x] Repositorios: `sessions`, `habits`, `activities`, `settings`, `sessionConfig`
- [x] `queries/week.ts` — el modelo de lectura de la semana que comparten inicio y la
      ruta de la meta. Las queries componen repositorios y nunca escriben
- [x] `sessions.recoverOrphans(now)` — cierra como `expired` las sesiones `running` que
      sobrevivieron a una muerte del proceso. Se llama antes del primer render

### 4. Dominio

- [x] `src/domain/types.ts`
- [x] `src/domain/session.ts` — `createSession`, `close`, `expire`, `elapsed`, `served`,
      `resolveSessionConfig`
- [x] `src/domain/ledger.ts` — construcción del libro mayor con procedencia
- [x] `src/domain/life.ts` — semanas vividas, restantes, proyección, filas de la cuadrícula
- [x] `src/domain/day.ts`, `week.ts`, `habits.ts` — día local, meta semanal, progreso de hábitos
- [x] Unit tests de los seis módulos con vitest (`domain/` es TS puro, no necesita
      transform de RN). Cobertura objetivo 80%, medida con `npx vitest run --coverage`

Criterio: `domain/` no importa React ni la base de datos.

### 5. Pantallas

- [x] `_layout.tsx` con seis rutas y sin tab bar. El swipe vive en el pager, no acá (ADR-0009)
- [x] `app/index.tsx` — host del pager, arranca siempre en inicio
- [x] `screens/Home.tsx` — inicio con arranque en un tap
- [x] `app/session.tsx` — timer calculado como `now - startedAt`, no por acumulación de ticks
- [x] `screens/Life.tsx` — sin fecha de nacimiento invita, no cuenta. Siempre está en el
      pager; ocultarla es una decisión pendiente (`STATUS.md`)
- [x] `config/session.tsx` — se abre con el tap en el número. Es ruta, no modal nativo:
      un modal nativo sube deslizándose y el lenguaje visual solo permite fade de 120ms
- [x] `config/habit.tsx` — creación de hábito, con tope de 5. Se llega desde
      `agregar hábito` en el libro mayor, su único punto de entrada
- [x] `config/week.tsx` — meta semanal, y el domingo el cierre de la semana (ADR-0013).
      Se llega desde el progreso del encabezado de inicio
- [x] `config/habit-edit.tsx` — editar o archivar un hábito. Se llega manteniendo pulsada
      su fila en el libro mayor

### 6. Comportamiento de sesión

- [x] Los tres niveles de profundidad en `HoldToConfirm`
- [x] Modo firme: campo de texto + espera de 15s, con salida para seguir
- [x] Modo profundo: mantener pulsado no responde, y el gesto de volver está desactivado
- [x] Background: recalcular al volver, incrementar `interruptions`

### 7. Cierre

- [x] Ícono y splash propios: tinta sobre papel, sin flash blanco al arrancar
- [x] Dynamic Type verificado a `extra-extra-extra-large` (~135%, sobre el 130% exigido)
- [x] Primera vez sin onboarding, y cierre del domingo sin pantalla nueva (ADR-0012, ADR-0013)
- [x] `npx tsc --noEmit` sin errores, con `noUnusedLocals` y `noUnusedParameters`
- [x] Correr en emulador de Android: build, fuentes, pager y SQLite verificados
- [x] README con instrucciones de arranque verificadas en las dos plataformas
- [ ] Correr en dispositivo físico iOS y Android

## Definición de terminado

Desde abrir la app hasta estar en sesión: **un tap, menos de 3 segundos.**

Si esa condición no se cumple, el sprint no está terminado por más que todo lo demás
funcione.

## Desviaciones del PRD, deliberadas

- **Duración custom.** El PRD dice "scroll en tap largo". Implementado como chip `otra`
  que abre un campo numérico. Un scroll en tap largo es un picker, y un picker es
  lenguaje de iOS. Si el campo resulta peor, el cambio no requiere migración.
- **La intención se escribe en la sesión**, no en la configuración. El PRD la muestra en
  la pantalla de sesión y no dice dónde se escribe; la configuración tiene tres
  decisiones y meter una cuarta la rompe.
- **`sesión N de hoy`** en vez de `sesión N de M del día`. Ningún documento define M.
- **Meta de hábito sin custom.** El PRD dice `2× / 4× / 6× o custom`. Van los tres chips;
  un campo numérico para "veces por semana" era una decisión más en un modal que ya tiene
  tres, y nadie pidió 5.
- **Una sola opción de bloqueo.** El selector muestra `nada` y una línea que dice que el
  bloqueo llega en fase 2. La UI no cambia de forma cuando lleguen los perfiles (ADR-0003).
- **`sin bloqueo` en vez de `N apps`** en la línea de contexto de inicio. No hay apps que
  contar hasta la fase 2.
- **La proyección de vida se difiere a fase 3.** La línea *"a tu ritmo actual, X de eso en
  redes"* necesita el estimado de uso, que no existe. La página lo dice en una línea.
- **Creación de actividad inline.** El PRD solo lista chips de actividades existentes. Un
  chip `otra` abre un campo y crea la actividad ahí mismo; sin eso, la lista por defecto
  era la única posible y no había dónde agregar una.
- **`seguir`.** El botón de inicio dice `seguir` cuando hay una sesión corriendo y vuelve a
  ella, y el modo firme tiene un `seguir` durante los 15 segundos. El PRD no contemplaba
  ninguna de las dos vueltas.

## Fuera de este sprint

Permisos, salud, bloqueo, widgets, onboarding elaborado, modo oscuro, tests de UI.

La **notificación local al terminar el timer** también queda fuera, y es la única exclusión
que sorprende: exige permiso de notificaciones y el criterio de fase 1 es cero permisos.
El timer avisa con la app abierta. Ver `docs/ROADMAP.md`, fase 1.75.
