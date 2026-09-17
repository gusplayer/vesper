# ADR-0026 — Cierre de decisiones anteriores

**Estado:** aceptada · 2026-09-17

## Contexto

La revisión de documentación del 2026-09-17 encontró cinco ADR que el código ya no
cumple al pie de la letra y que ningún ADR posterior cerró de forma explícita, más un
puñado de restos de la fase 1 con tests y sin llamador. ADR-0016 superó en forma las
reglas e-ink y dejó "vigentes en su fondo" varios ADR sin decir qué queda de cada uno.
Este ADR lo dice, uno por sección, para que el índice deje de tener estados ambiguos y
nadie construya sobre una decisión que ya no rige.

## Decisión

### 1. ADR-0013, el cierre del domingo — superado

El cierre de la semana es el aviso del domingo ("Cierra la semana", `domain/reminders`)
más Actividad › Semanal, que ya muestra cómo cerró la semana y cómo va la que empieza.
**No se construye una pantalla ni una sección de cierre.** Lo que ADR-0013 defendía
—que el cierre no sea una cuarta pantalla— se cumple por omisión: no hay cierre aparte
porque Actividad ya lo es.

### 2. ADR-0015, la sesión se cierra en la misma ruta — superado

Escrito cuando la sesión era una ruta única. Hoy el cierre lo decide `SessionGate`
(`src/features/session/SessionGate.tsx`), esté o no montada la pantalla, y aterriza en
`session/complete` cuando el tiempo vence y en `session/closed` cuando el usuario sale
por el ritual o por la emergencia (ADR-0025). Las tres son rutas a pantalla completa sin
gesto de volver. Lo que ADR-0015 defendía —que terminar no sea un `back()` a inicio, y
que la intención se lea al cerrar— sigue en pie; la forma ("la misma ruta") no.

### 3. ADR-0012, sin onboarding — superado en forma

Hay un onboarding de nueve pantallas (`src/app/onboarding/`) desde ADR-0016. Lo que se
conserva es la regla 8 de `CLAUDE.md`: cada permiso se pide en su flujo con
`platform/*.requestAuthorization()`, siempre con "Ahora no", nunca se finge concedido
con un flag, y la app funciona entera sin ninguno. El onboarding explica y ofrece; no
exige. La "primera vez" de ADR-0012 como única explicación de la app deja de existir.

### 4. ADR-0022, sesiones sin límite y pausas — fijado a lo construido

ADR-0022 propuso un techo a medianoche o a las 12 h con resultado `completed`, y una
pausa por cada hora de sesión. Lo que se construyó y se verificó (`docs/STATUS.md`) es:

- Una sesión sin límite termina sola **a las 12 horas** (`OPEN_SESSION_CAP_MS`) y cierra
  como **`expired`**: nadie presenció ese foco, y `expired` es exactamente eso. No hay
  techo a medianoche: una sesión que empieza a las 23:00 no tiene por qué morir a las 24:00.
- Las pausas se habilitan **cada 25 minutos de foco** (`BREAK_EVERY_MS`) y duran
  **15 minutos como máximo** (`BREAK_MS`), en suave y firme; profundo no tiene pausas.

Estas cuatro cifras son la decisión. ADR-0022 no se edita; donde difiera, manda este.

### 5. ADR-0011, el toque invierte la caja — superado por ADR-0016

Escrito para la UI e-ink, donde no había color ni sombra con que acusar el toque. Los
componentes de `src/design/components/` acusan el toque con su propio estado pulsado
(opacidad, `cardMuted`, el relleno de `HoldButton`), no invirtiendo la caja, y el texto
tocable no lleva regla. Lo que sigue vigente es el fondo: todo control acusa el toque en
el mismo frame y sin animación de escala ni rebote (regla 6).

### 6. Restos de la fase 1 — borrados

Se borran, por no tener ningún llamador fuera de sus tests:

- `src/db/repositories/sessionConfig.ts` y su test.
- `src/db/queries/week.ts` y su test (`loadWeekSnapshot`; los stores derivan la semana
  de `dayStats` y de `habitMarks`).
- Las claves de `settings` `last_session_config`, `birth_date`, `life_expectancy_years`,
  `weekly_focus_target_ms` y `onboarding_completed_at`, con sus accesores en
  `settings.ts`. Sus valores viven en `prototype_settings` desde ADR-0017.

No hay migración: `settings` es clave-valor y una fila vieja que nadie lee no molesta;
"Borrar todo y reiniciar" la vacía con el resto.

## Consecuencias

- El índice de ADR queda sin estados "en su fondo": cada ADR es aceptado, superado por
  otro, o propuesto.
- `docs/DATA_MODEL.md` y `docs/ARCHITECTURE.md` dejan de listar lo borrado.
- Si algún día se quiere un cierre semanal en pantalla, una sesión que termine con el
  día o pausas con otra cadencia, es un ADR nuevo, no una vuelta a los superados.
