# Estado — 2026-09-14

Dónde quedamos, qué está probado y qué falta. Se actualiza al cerrar cada tanda de
trabajo. Para el plan por fases, `ROADMAP.md`; para las tareas, `SPRINT_01.md`.

## Resumen en una línea

**Fase 1 cerrada en código.** Corre en simulador de iOS y en emulador de Android. Lo que
falta para cerrar la fase no es código: es el papeleo de Apple, un dispositivo físico y
siete días de uso.

## Qué existe

| Capa | Estado |
|---|---|
| Sistema de diseño | 19 componentes a mano, tokens desde `DESIGN_SYSTEM.md` |
| Dominio | `session`, `ledger`, `life`, `habits`, `week`, `day` — puros, sin React ni DB |
| Base de datos | op-sqlite, migraciones en TS, 5 tablas, repositorios de 5 entidades |
| Pantallas | inicio, sesión, vida + 4 rutas de configuración |
| Marca | Ícono y splash propios: cuadrícula de semanas, tinta sobre papel |
| Tests | 76 unit tests sobre los módulos puros |

Stack: Expo SDK 57, RN 0.86, React 19.2, TypeScript 6 con `strict` y
`noUncheckedIndexedAccess`.

## Qué está verificado, y cómo

Distinguir el tipo de evidencia importa: `tsc` no prueba que algo funcione.

| Qué | Cómo se probó |
|---|---|
| Lógica de dominio | 76 tests con vitest |
| Migraciones y seed | Contra el SQLite real del simulador y del emulador |
| Invariante 6 (marca manual única) | Insert duplicado rechazado por el índice UNIQUE |
| Invariante 7 (sesiones huérfanas) | Dos sesiones plantadas: la vencida volvió `expired`, la viva siguió |
| Libro mayor | `sin registrar 18h 43m` a las 18:44 — el día transcurrido, no 24h |
| Colores | Muestreo de pixeles: fondo `#F2F0EA`, regla `#1B1A18` |
| Dynamic Type | `extra-extra-extra-large` (~135%): nada se corta |
| Estado de pulsado | Captura a mitad de un toque real en Android: bloque invertido |
| Mantener pulsado | Barra al 58% a mitad del gesto; el bucle completo termina la sesión |
| Android | Build correcto, `db ready · 6 activities`, fuentes y pager funcionando |

## Qué NO está verificado

- **Dispositivo físico.** Ni iOS ni Android. Requiere hardware y firma.
- **El cierre de sesión (ADR-0015) y el timer en tinta (ADR-0014)** solo por typecheck.
  Nadie vio todavía el cuadro negro en pantalla ni tocó `volver`.
- **El modo `firme` y el `profundo`** end to end: la espera de 15 segundos y la ausencia
  de respuesta se probaron por typecheck y por tests del dominio, no con el dedo.
- **`WeekGrid` con rendimiento medido.** Dibuja 4049 cuadros y se ve bien, pero nadie
  midió el tiempo de montaje.
- **Nada en producción.** No hay build de release ni firma configurada.

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
- **Historia.** La app no tiene ninguna vista del pasado: la intención y el motivo de
  salida se guardan y nadie los vuelve a leer. Es una decisión pendiente, no un olvido.
- **Sin backup ni export.** Un cambio de teléfono pierde todo (ADR-0002 lo asume para el
  prototipo, y dice que hay que resolverlo antes de cualquier lanzamiento).

## Deuda conocida

- **Android necesita `adb reverse tcp:8081 tcp:8081`** cada vez que el emulador arranca,
  para que alcance a Metro.
- **`.npmrc` fija `legacy-peer-deps`.** El árbol de SDK 57 tiene un conflicto de peers con
  `react-dom`; sin ese flag falla cualquier `npm install <paquete>`.
- **Las claves de `activities` están en español** (`trabajo`, `lectura`). Cuando llegue
  i18n en fase 2 hay que migrarlas a slugs neutrales.
- **Sin i18n.** Español hardcodeado, por decisión de fase 1.

## Cómo retomar

```bash
cd ~/Dev/vesper
npm run typecheck && npm test        # debe dar 76 tests en verde
npx expo start --dev-client          # iOS: la app ya está instalada en el simulador
```

En Android, con el emulador arriba:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
$ANDROID_HOME/platform-tools/adb reverse tcp:8081 tcp:8081
```

Lo primero que conviene leer antes de tocar algo: `CLAUDE.md`, y después el ADR que toque
el área que vas a cambiar.
