# ADR-0022 — El botón de Focus, sesiones sin límite y pausas

**Estado:** aceptada · 2026-09-16

## Contexto

El botón primario de Focus dice "Mantén para enfocar" con la línea "25 min · toca para
cambiar" debajo. Un mismo control hace dos cosas con dos gestos: tocar abre la hoja de
duración, mantener arranca con la última duración. En pruebas de uso no queda claro qué
hace el botón ni cómo se elige el tiempo. El dueño del producto pidió tres cosas:

1. Un mensaje que diga qué pasa al tocar, del tipo "Entrar en modo focus".
2. Una sesión **sin límite** de tiempo, para "trabajar toda la mañana en algo".
3. **Pausas** dentro de la sesión: de hasta 15 minutos, con reloj, con un cambio claro en
   la interfaz cuando se reanuda, y con las redes desbloqueadas mientras dura la pausa.

Lo que hay hoy y que esto toca:

- `Session.plannedMs` es obligatorio y todo cuelga de él: `isDue`, `sessionProgress`,
  la notificación de fin, la cuenta regresiva de la Live Activity, la recuperación de
  huérfanas al arrancar (`started_at + planned_ms <= now`) e invariante 2 de
  `DATA_MODEL.md` (`actualMs <= plannedMs`).
- La profundidad regula la salida (PRD §2): suave sale con una ronda de respiración,
  firme con dos y una frase, profundo no sale hasta que vence el timer.
- El desbloqueo de emergencia es otra cosa: termina la sesión, cuenta como cancelada y
  gasta uno de cinco al mes. No es una pausa.
- Regla 2 de `CLAUDE.md`: un botón primario por pantalla. Regla del PRD: un toque desde
  abrir la app hasta estar en sesión.
- Rutinas (ADR-0019): una rutina en ventana arranca una sesión con la duración de la
  ventana; si hay una corriendo, espera a que termine.

## Decisión propuesta

### 1. El botón dice qué hace, y el gesto sigue al riesgo

- **Tocar arranca.** El botón dice **"Enfocar 25 min"** o **"Enfocar sin límite"**. La
  duración se ve en el propio botón, así que la línea de abajo desaparece.
- La duración se elige en una **fila tocable encima del botón**: "25 min ⌄". Abre la
  misma hoja de hoy, que suma **"Sin límite"** a los chips (5 · 25 · 50 · 90 · 120 ·
  Sin límite). Elegir cierra la hoja y actualiza el botón; no arranca.
- **Mantener solo cuando no hay vuelta atrás.** Con un modo *profundo*, el botón vuelve
  a ser de mantener y lo dice: "Mantén para enfocar 25 min · profundo". Es la única
  sesión de la que no se puede salir, y la fricción va donde está el riesgo. Suave y
  firme arrancan con un toque, como pide el PRD.

Alternativas de copy consideradas para el botón, por si "Enfocar" no convence:

| Copy | Por qué sí | Por qué no |
|---|---|---|
| Enfocar 25 min | Verbo del producto, dice la duración, cabe en inglés ("Focus 25 min") | — |
| Entrar en modo focus | Lo pidió el dueño; "Focus" ya es el nombre de la pestaña | Mezcla idiomas, no dice cuánto, "modo" ya significa otra cosa en la app (No socials, Deep work) |
| Empezar | Corto, universal | No dice qué empieza ni por cuánto |
| Bloquear 25 min | Dice lo que de verdad pasa con el teléfono | Suena a castigo; el producto vende foco, no bloqueo |

Recomendación: **"Enfocar 25 min"**, y en inglés "Focus for 25 min".

### 2. Sesión sin límite

- `plannedMs` pasa a ser `number | null`. `null` es una sesión abierta.
- **Se termina como cualquier otra**: con "Terminar" y el ritual de la profundidad.
- **Nunca es profunda.** Profundo significa "solo el timer termina"; sin timer no hay
  salida. Si el modo es profundo y la duración es sin límite, la sesión corre como
  *firme*. La hoja lo dice en una línea al elegir "Sin límite".
- **Tiene un techo escondido**: termina sola al **final del día local (medianoche)** o
  a las **12 horas**, lo que llegue primero, con resultado `completed`. Es la
  protección contra una sesión olvidada que acredita tres días de foco. No aparece
  en la interfaz como límite; aparece como "la sesión terminó con el día".
- En pantalla: reloj que cuenta hacia arriba (ya lo hace), sin barra de progreso; en su
  lugar la línea "Sin límite · desde las 8:05". La Live Activity muestra el tiempo
  transcurrido en vez de la cuenta regresiva. No se planifica notificación de fin.
- Invariante 2 se reescribe: `actualMs <= plannedMs` cuando `plannedMs` no es null.
- Recuperación de huérfanas: una sesión abierta que sobrevivió a una muerte del proceso
  se cierra como `expired` al arrancar si pasó su techo; si no, sigue viva.
- Rutinas: una rutina con hora sigue siendo una ventana con duración; "Sin límite" es
  solo para sesiones a mano. Si una sesión abierta está corriendo cuando abre una
  ventana, la rutina espera, como hoy.

### 3. Pausas

Una pausa es un descanso corto **dentro** de la sesión, distinto de terminar y distinto
de la emergencia.

- **Dónde**: un botón `ghost` "Pausa de 15 min" en la sesión activa, entre "Terminar" y
  el desbloqueo de emergencia. Disponible en **suave y firme**; **profundo no tiene
  pausas** (es su definición).
- **Cuánto**: hasta **15 minutos**, con reloj. Se puede volver antes con "Volver ahora".
  Al vencer, vuelve sola.
- **Cuántas**: **una por cada hora de sesión**, con la primera disponible desde el
  inicio (sesión de 25 min: una; sin límite: una cada hora servida). Sin límite total
  duro; el techo lo pone la sesión.
- **Qué pasa mientras dura**: el bloqueo se levanta (`applyPlan` a nada), la interfaz
  **cambia de esquema a claro** (claro en la app, oscuro en la sesión: la pausa no es
  sesión), y la pantalla es un reloj que cuenta hacia abajo con el botón primario
  "Volver ahora". Al terminar la pausa: esquema oscuro otra vez, bloqueo de vuelta,
  Live Activity actualizada, y una notificación local "Se acabó la pausa" si la app
  está en segundo plano.
- **Qué pasa con el tiempo**: la pausa **no cuenta como foco** y **detiene el reloj**.
  En una sesión con duración, el fin planificado se corre lo que duró la pausa. En
  `actualMs` no entra. No es una interrupción (regla de firme y profundo para irse a
  segundo plano): irse durante la pausa es lo esperado.
- **Datos**: tabla nueva `session_breaks (id, session_id, started_at, ended_at)`,
  migración 004. `elapsed(session, now)` resta las pausas. Las estadísticas por día
  siguen saliendo de `sessions.actual_ms`, así que no cambian.
- **No gasta emergencias** y no aparece en el libro mayor como salida.

## Consecuencias

- El gesto de mantener deja de ser el gesto por defecto; solo lo ve quien usa modos
  profundos. `HoldButton` se queda para ese caso.
- Focus gana una fila (la duración) y pierde la línea de pista bajo el botón. Sigue
  habiendo un solo botón primario.
- `Session` y su tabla cambian (`planned_ms` nullable, tabla de pausas). Hay que tocar
  dominio, repositorio, queries, notificaciones, Live Activity, bloqueo y el guardián
  de sesión. Es la parte grande del trabajo.
- Profundo se vuelve un poco menos absoluto en un caso: profundo + sin límite corre
  como firme. Se documenta en la hoja y en el PRD.
- Una sesión sin límite puede acreditar hasta 12 horas de foco en un día. Es lo que se
  pidió; el techo de medianoche evita el caso absurdo.

## Decisiones del dueño del producto (2026-09-16)

1. El botón lleva la duración y dice **"Enfocarme 25 min"** / **"Enfocarme sin límite"**
   (en inglés "Focus for 25 min" / "Focus with no limit"): primera persona, más personal.
2. Un toque arranca; **mantener solo en modos profundos**.
3. El techo de la sesión sin límite es **12 horas**, sin regla de medianoche. Pasadas, se
   asume que el usuario olvidó terminarla: cierra como `expired` y la pantalla de cierre
   lo dice ("La sesión llegó a las 12 horas. Se cerró sola.").
4. **Una pausa nueva cada 25 minutos de foco**: la primera a los 25 minutos, la siguiente
   25 minutos de foco después de terminar la anterior.
5. La pausa **no es foco y detiene el reloj**: una hora de trabajo con 15 minutos de pausa
   es una hora.

## Cómo quedó

- Sin tabla nueva: `open`, `break_ms`, `break_started_at` y `next_break_at_ms` en
  `sessions` (migración 005). Una pausa a la vez; después solo importa el total.
- `domain/session`: `elapsed` resta las pausas; `plannedEndAt` es null durante una pausa;
  `settle` asienta lo que pasó mientras nadie miraba (pausa vencida, sesión vencida) y lo
  usan el arranque y el guardián al volver al frente.
- `SessionGate` cierra la sesión al vencer (`completed`, o `expired` si es abierta) y
  termina la pausa a los 15 minutos. Los recordatorios, la Live Activity y el bloqueo
  siguen las pausas desde sus hooks.
