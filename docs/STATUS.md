# Estado — 2026-09-14

Dónde quedamos, qué está probado y qué falta. Se actualiza al cerrar cada tanda de
trabajo. Para el plan por fases, `ROADMAP.md`; para las tareas, `SPRINT_01.md`.

## Resumen en una línea

**Fase 1 cerrada en código, y refactorizada.** Corre en simulador de iOS y en emulador de
Android. Lo que falta para cerrar la fase no es código: es el papeleo de Apple, un
dispositivo físico y siete días de uso.

## Qué existe

| Capa | Estado |
|---|---|
| Sistema de diseño | 23 componentes a mano, tokens desde `DESIGN_SYSTEM.md` |
| Dominio | `session`, `ledger`, `life`, `habits`, `week`, `day`, `time`, `activities` — puros, sin React ni DB |
| Presentación | `lib/`: `format`, `labels`, `tone`, `text`, `birthDate`, `useNow`, `useRevision`, `uuid` |
| Base de datos | op-sqlite, migraciones en TS, 5 tablas, 5 archivos de repositorio + 1 query de semana |
| Pantallas | inicio, sesión, vida + 4 rutas de configuración |
| Marca | Ícono y splash propios: cuadrícula de semanas, tinta sobre papel |
| Tests | 278 unit tests con vitest sobre dominio, lib, db y store; cobertura medible con `--coverage` |

Stack: Expo SDK 57, RN 0.86, React 19.2, TypeScript 6 con `strict`,
`noUncheckedIndexedAccess`, `noUnusedLocals` y `noUnusedParameters`.

## Qué está verificado, y cómo

Distinguir el tipo de evidencia importa: `tsc` no prueba que algo funcione.

| Qué | Cómo se probó |
|---|---|
| Dominio, lib, repositorios, queries y store | 278 tests con vitest, zona horaria fijada a `America/Bogota`. Los repositorios corren contra `src/db/testing/fakeDb.ts`, no contra op-sqlite |
| Migraciones y seed | Contra el SQLite real del simulador y del emulador |
| Invariante 6 (marca manual única) | Insert duplicado rechazado por el índice UNIQUE |
| Invariante 7 (sesiones huérfanas) | Dos sesiones plantadas: la vencida volvió `expired`, la viva siguió |
| Libro mayor | `sin registrar 18h 43m` a las 18:44 — el día transcurrido, no 24h |
| Colores | Muestreo de pixeles: fondo `#F2F0EA`, regla `#1B1A18` |
| Dynamic Type | `extra-extra-extra-large` (~135%): nada se corta |
| Estado de pulsado | Captura a mitad de un toque real en Android: bloque invertido |
| Mantener pulsado | Barra al 58% a mitad del gesto; el bucle completo termina la sesión |
| Timer en tinta (ADR-0014) | Captura en simulador de iOS: cuadro relleno con dígitos en papel |
| Android | Build correcto, `db ready · 6 activities`, fuentes y pager funcionando |

## Qué NO está verificado

- **Dispositivo físico.** Ni iOS ni Android. Requiere hardware y firma.
- **El cierre de sesión (ADR-0015)** solo por typecheck y tests del store. Nadie vio
  todavía el estado de cierre ni tocó `volver`.
- **El refactor del 2026-09-14** se verificó con `tsc`, los tests y una sola captura de
  la pantalla de inicio. Ninguna ruta de configuración ni la sesión se volvieron a tocar
  con el dedo después de moverles el código.
- **El modo `firme` y el `profundo`** end to end: la espera de 15 segundos y la ausencia
  de respuesta se probaron por typecheck y por tests del dominio, no con el dedo.
- **`WeekGrid` con rendimiento medido.** Dibuja 4049 cuadros y se ve bien, pero nadie
  midió el tiempo de montaje.
- **Nada en producción.** No hay build de release ni firma configurada.

## Refactor 2026-09-14

Commit `cb5f7dd`: la lógica de producto salió de las pantallas hacia `domain/`, `lib/` y
`db/queries/`. Lo que se movió:

- El dominio ganó `time.ts` (unidades), `resolveSessionConfig` (config validada contra
  las actividades reales), `served()` y `expire()`, la ventana de semana por calendario,
  las pistas de salud por nombre y la matemática de la cuadrícula de semanas.
- `lib/` ganó `labels`, `tone`, `birthDate`, `text` y el hook `useRevision`: toda palabra
  en español que necesita el dominio vive ahí, no en las pantallas.
- `db/` ganó `rowsAs`, `pendingMigrations`, `findById` en actividades y hábitos, y
  `queries/week.ts`, que inicio y la ruta de la meta comparten en vez de dos copias a mano.
- Cuatro componentes nuevos —`Pager`, `FieldGroup`, `OptionChips`, `WeekGridRow`— toman
  el layout que las pantallas hacían por su cuenta.
- Bugs arreglados de paso: la espera del modo firme llamaba `router.back()` en cada tick;
  un hábito renombrado podía guardarse como verificado sin tipo de salud; la fila del
  libro mayor no mostraba nada al presionar; `TextField` disparaba `onEndEditing` dos
  veces; el campo de minutos custom desaparecía a mitad de tecleo; el primer toque después
  de escribir solo cerraba el teclado; iOS rebotaba en el overscroll.
- Más bugs: las claves de renglón podían chocar con una actividad del usuario; la ruta de
  sesión hacía dos SELECT por segundo; el store se hidrataba un frame tarde; `start()`
  ignoraba una sesión ya corriendo; una sesión que vencía sin nadie mirándola en inicio se
  acreditaba como `completed` en vez de `expired`.
- Superficie muerta eliminada: `SessionConfig.intention`, `WeekProgress.ratio`,
  `life_screen_enabled`, `getBoolean/setBoolean`, `servedMs`, `newId`.
- Commit `7ab4da2`: `noUnusedLocals` y `noUnusedParameters` en `tsc`, zona horaria fijada
  en vitest y proveedor de cobertura instalado.

## Decisiones tomadas en esta ronda

Los ADR 0001 a 0007 venían de antes. Los siguientes se decidieron construyendo:

| ADR | Decisión |
|---|---|
| 0008 | El hábito tiene nombre propio, no hereda el de una actividad |
| 0009 | El swipe es un pager de dos páginas; la sesión es una ruta |
| 0010 | `sin registrar` resta intervalos, no suma monedas |
| 0011 | El toque invierte la caja; el texto tocable lleva regla |
| 0012 | La fase 1 no tiene onboarding: tiene una primera vez |
| 0013 | El cierre del domingo no es una pantalla nueva |
| 0014 | El timer de sesión es un cuadro relleno de tinta: la sesión tiene marca de estado |
| 0015 | Al vencer el timer, la ruta de sesión muestra el cierre y lee la intención |

Los ADR aceptados cuyas consecuencias ya no coinciden con el código llevan una
`## Nota (2026-09)` al final. No se reescriben.

## Qué falta

### No es código, y es tuyo

1. **Fase 0, sin empezar.** El entitlement de Family Controls tarda semanas y bloquea la
   fase 2 entera. Faltan también los tres bundle ids de las extensiones y la cuenta de
   Play, que tiene 14 días de espera.
2. **Dispositivo físico.** Cierra la tarea 7 del sprint.
3. **Siete días de uso seguidos.** Es el criterio de salida de la fase 1 y no se acelera.
   Ya hay sesiones reales en la base del simulador.

### Código que sigue pendiente

- **Notificación local al terminar el timer.** Se movió a fase 1.75 porque pide permiso y
  la fase 1 promete cero.
- **Pantalla de bienvenida al bloqueo** (fase 2) y **nombrado de apps** (ADR-0004). Cuando
  los docs viejos dicen "en el onboarding", hablan de ese flujo, no de la primera vez.
- **Historia.** La intención se lee una vez, en el cierre de la sesión (ADR-0015). El
  motivo de salida se guarda y nadie lo vuelve a leer. No hay vista del pasado; es una
  decisión pendiente, no un olvido.
- **Ocultar la página de vida.** `life_screen_enabled` se eliminó del código: vida siempre
  está en el pager, y no hay onboarding donde declinarla. Si hace falta esconderla, es una
  decisión nueva.
- **Esperanza de vida no editable.** Se lee `life_expectancy_years` con default 77.6 y la
  página lo dice; no hay dónde cambiarla en fase 1.
- **Línea de proyección** *"a tu ritmo actual, X de eso en redes"*: fase 3, con el
  estimado de uso. `projectedWeeksConsumed` existe en el dominio y nadie la llama.
- **Vínculo hábito ↔ actividad.** Se guarda en `activity_id` (ADR-0008), pero el libro
  mayor todavía no lo usa para mostrar un solo renglón.
- **Etiquetas del ledger en el dominio.** `sin registrar`, `redes` y los nombres de salud
  están en `domain/ledger.ts`, la única excepción a "el dominio habla en identificadores".
  Pendiente de i18n.
- **Sin backup ni export.** Un cambio de teléfono pierde todo (ADR-0002 lo asume para el
  prototipo, y dice que hay que resolverlo antes de cualquier lanzamiento).

## Deuda conocida

- **Android necesita `adb reverse tcp:8081 tcp:8081`** cada vez que el emulador arranca,
  para que alcance a Metro.
- **`.npmrc` fija `legacy-peer-deps`.** El árbol de SDK 57 tiene un conflicto de peers con
  `react-dom`; sin ese flag falla cualquier `npm install <paquete>`.
- **Las claves de `activities` están en español** (`trabajo`, `lectura`). Cuando llegue
  i18n en fase 2 hay que migrarlas a slugs neutrales.
- **Las actividades creadas por el usuario usan `key = label`**, en minúscula y
  recortado, no un slug. Son su propio vocabulario y no se traducen, pero un nombre con
  acento o espacios internos va tal cual a la clave.
- **Sin i18n.** Español hardcodeado, por decisión de fase 1.

## Cómo retomar

```bash
cd ~/Dev/vesper
npm run typecheck && npm test        # debe dar 278 tests en verde
npx expo start --dev-client          # iOS: la app ya está instalada en el simulador
```

En Android, con el emulador arriba:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
$ANDROID_HOME/platform-tools/adb reverse tcp:8081 tcp:8081
```

Lo primero que conviene leer antes de tocar algo: `CLAUDE.md`, y después el ADR que toque
el área que vas a cambiar.
