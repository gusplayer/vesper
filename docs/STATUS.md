# Estado — 2026-09-15

Dónde quedamos, qué está probado y qué falta. Se actualiza al cerrar cada tanda de
trabajo. Para el plan por fases, `ROADMAP.md`; para las tareas, `SPRINT_01.md`.

## Resumen en una línea

**Fase 1 cerrada en código, y refactorizada.** Corre en simulador de iOS y en emulador de
Android. Lo que falta para cerrar la fase no es código: es el papeleo de Apple, un
dispositivo físico y siete días de uso.

## Qué existe

**Prototipo navegable de todas las fases, con datos falsos, con la forma de Brick**
(ADR-0016). Corre en el simulador de iOS. Nada de lo que muestra es real: modos, apps,
horarios, estadísticas, salud y uso salen de `src/data/seed.ts`.

| Capa | Estado |
|---|---|
| Sistema de diseño | `src/design/`: tokens por tema (claro / sesión oscura), Outfit, 38 componentes tras un índice |
| Capa de datos | `src/data/`: stores zustand en memoria, sembrados; hooks con la forma de la capa real |
| Pantallas | 4 pestañas + 22 rutas + 9 de onboarding, en `src/app/`; piezas por área en `src/features/` |
| Dominio | `src/domain/` puro y testeado, reutilizado por el prototipo (reloj, semana, hábitos, vida) |
| SQLite | `src/db/` y `src/store/` intactos y testeados, sin conectar a la UI |
| Tests | 289 sobre dominio, lib, db, store y helpers de features |

## Qué está verificado

- `tsc --noEmit` y `npm test` limpios.
- 19 pantallas vistas por captura en el simulador iPhone 17 Pro: Foco, Horarios, Actividad
  semanal, Ajustes, Modos, Editar modo, Sesión activa (oscura), Cierre, Editar horario,
  Emergencia, Salud, Apps bloqueadas, Explorar ideas, Nuevo hábito, y cinco pasos del
  onboarding (bienvenida, objetivo, Tiempo de uso, rutina, tour).

## Qué NO está verificado

- **Ningún toque.** Las capturas se tomaron saltando a cada ruta con `src/dev/route.ts`.
  Hojas, toggles, selectores de hora, búsqueda, el "…" de los modos, la espera de 15 s
  del modo firme y el flujo completo del onboarding no se tocaron con el dedo.
- Actividad mensual y de por vida, Live Activities, Notificaciones, Vida, Ayuda, Acerca de,
  Sitios bloqueados, Editar hábito, y cuatro pasos del onboarding: solo por typecheck.
- Android: no se volvió a compilar desde el pivote.
- Dispositivo físico: nunca.

## Cómo revisar una pantalla sin tocar

En `src/dev/route.ts` poné `DEV_START_ROUTE = '/modes'` (y `DEV_SESSION = 'running'` para
la sesión) y relanzá la app. Volvé a dejarlo en `null` antes de commitear.

## Qué falta

### Decisiones de producto
- Qué se conecta primero a datos reales: la sesión y las estadísticas ya tienen dominio y
  SQLite listos; modos, horarios y ajustes necesitan tablas nuevas (`DATA_MODEL.md` no las
  tiene).
- Si el bloqueo real (fase 2) se hace sobre esta UI o se espera al entitlement.

### Código
- Conectar `src/data/` a `src/db/`: reemplazar los stores sembrados por repositorios, sin
  tocar los hooks.
- Persistir el onboarding (hoy se repite en cada lanzamiento).
- Android build y prueba.
- Historia de sesiones (la intención se lee solo en el cierre).

## Deuda conocida

- Dos lógicas de sesión: `src/data/stores/focus.ts` (prototipo) y `src/store/session.ts`
  (SQLite). Se unifican al conectar datos reales.
- Las etiquetas del libro mayor siguen en `domain/ledger.ts`, pendiente de i18n.
- `src/lib/labels.ts` está en minúscula; `DepthCards` capitaliza localmente.
- El `Button` secundario y las tarjetas comparten tono: el secundario es un paso más oscuro
  desde el 2026-09-15.
