# ADR-0025 — Salir de la sesión: la tinta se disuelve en papel

**Estado:** aceptada · 2026-09-17

## Contexto

Entrar en sesión es una ceremonia: `InkFlood` inunda la página de tinta punteada desde
el botón (ADR-0018, ADR-0022). Salir es un corte. Hoy hay cuatro salidas y cada una
tiene su propio estilo:

| Salida | Dónde vive | Cómo se ve | Al confirmar |
|---|---|---|---|
| Terminar (suave/firme) | Ruta `session/exit`, oscura | "Inhala/Sostén/Exhala" + número + barra; el usuario mira | `dismissTo('/(tabs)')`, fade de 160 ms de oscuro a claro |
| Pausa | La misma ruta `active`, cambia a claro | Reloj hacia abajo | El esquema cambia de golpe, sin transición, dos veces por pausa |
| Emergencia en sesión | `Sheet` modal sobre la sesión | `bgElevated` (#202020) sobre `bg` (#191919): casi no se ve; la espera de 10 s es una caption | `dismissTo`, sin decir qué costó |
| Emergencia en Ajustes | `settings/emergency` | Botón `secondary` sin espera, motivo distinto | `router.replace`; con sesión no se llega (SessionGate) y sin sesión está apagado |

Además, en profundo el botón primario es un pill deshabilitado que dice "Profundo ·
solo el timer termina": un letrero en el lugar del botón. El pie apila tres botones
(Terminar, Pausa, Emergencia) y la emergencia, que cuesta uno de cinco al mes, tiene la
misma jerarquía que la pausa, que es gratis. Nada acusa el costo después de usarla.
El PRD (§2, "comportamiento por nivel de profundidad") y `PROTOTYPE_GUIDE` describen un
ritual anterior (mantener 1,5 s, esperar 15 s, tres rondas) que el código ya no hace.

El dueño del producto pidió que la respiración sea interactiva: que el usuario la haga
con el dedo, y que el objeto de la app pulse con ella.

## Decisión

**Salir usa el mismo lenguaje que entrar, al revés.** Entrar es tinta sobre papel;
salir es papel sobre tinta. Y el objeto de Vesper, el tile con la grilla, es lo que se
sostiene para soltar la sesión.

### 1. Respirar se hace con el dedo

- En `session/exit` el usuario **mantiene el tile** (`BreathingObject`) y el tile respira
  con él: al inhalar (4 s) las 16 celdas se encienden de abajo hacia arriba, al sostener
  (4 s) quedan encendidas, al exhalar (6 s) se apagan de arriba hacia abajo. Solo
  opacidad, sin escala (regla 6). La palabra de la fase y los segundos van encima; una
  `ProgressBar` fina lleva el total.
- El reloj de la respiración solo avanza mientras el dedo está puesto. **Soltar a mitad
  de ronda devuelve a su inicio**; las rondas completas se conservan
  (`domain/exitRitual.releaseBreath`). Suave: una ronda (14 s). Firme: dos (28 s).
- Al terminar las rondas, el tile queda en reposo, la línea dice "Lo hecho queda
  contado; lo que falta, no" y el ghost de abajo se habilita: "Terminar · llevas 12m"
  (suave) o "Quiero terminar" (firme, que pasa a la frase). "Seguir enfocado" sigue
  siendo el único primario.
- La frase de firme y el motivo opcional no cambian.

### 2. Toda salida a mano termina en papel y en un cierre

- Al confirmar Terminar o la emergencia, `InkFlood` corre con `tone="paper"`: el papel
  se disuelve sobre la tinta desde el botón que se tocó, y debajo aparece
  **`session/closed`**, una ruta clara de una línea: "Sesión cerrada.", "12m quedan
  contados.", la fila Modo, la fila Duración, el motivo si se escribió, y si fue una
  emergencia: "Usaste un desbloqueo. Te quedan 3 este mes." Botón "Continuar".
  Sin gesto de volver, como las demás rutas de sesión.
- `session/complete` no cambia: una cancelada no pasa por ahí (PRD §2). `closed` es su
  hermana breve; no celebra.

### 3. La pausa es un respiro del mismo gesto

- Tocar "Pausa de 15 min" corre el papel desde el botón y debajo aparece la pausa clara.
  "Volver ahora" corre la tinta desde el botón y debajo vuelve la sesión oscura. El
  cambio de esquema queda escondido bajo la disolución.
- Si la pausa vence sola (`SessionGate`), la sesión vuelve con el fade de ruta de siempre:
  nadie tocó nada, no hay de dónde salir la tinta.

### 4. La emergencia es una ruta, no una hoja

- `session/emergency` reemplaza `EmergencySheet`: ruta oscura a pantalla completa, con
  el tile en reposo, el costo en una línea y la espera de 10 s como la misma `ProgressBar`
  de la respiración. Primario "Seguir enfocado"; ghost "Usar un desbloqueo" que se
  habilita al final de la espera. Sin desbloqueos, la ruta lo dice y solo queda seguir.
- Se llega desde un `IconCircle` arriba a la derecha de la sesión (`life-buoy`), en la
  vista normal y en la del arte. El pie de la sesión queda en dos: Terminar y Pausa.
- **Ajustes › Desbloqueo de emergencia deja de ser una acción.** Muestra cuántos quedan
  y dice que se usa desde la sesión. Se van `use`, `onlyWhileRunning` y `exitReason`.

### 5. Profundo

- El pill deshabilitado se va. Bajo la barra, una caption: "Profundo · solo el timer
  termina". El pie no tiene botones; la emergencia está arriba a la derecha.

## Alternativas consideradas

- **Respirar sosteniendo el botón primario.** Choca con la regla 2: el primario de la
  ruta es "Seguir enfocado", y un botón que se sostiene 28 s deja de leerse como botón.
  El tile ya es el objeto de la pantalla de sesión; sostenerlo es continuar lo que se
  miraba.
- **Respirar tocando al ritmo (tap en cada fase).** Más juego, menos calma. Sostener es
  un solo gesto largo, como el `HoldButton` de profundo, y se aprende sin explicación.
- **Dejar la emergencia como hoja y subirle contraste.** Arregla lo visible, no la
  incoherencia: seguiría siendo la única salida que no es una ruta ni termina en papel.
- **Reutilizar `session/complete` para las canceladas.** El PRD lo prohíbe y la página
  celebra ("Recuperaste tu tiempo"). Una cancelada merece constancia, no aplauso.
- **Vibración en cada fase de la respiración.** Es el ADR-0024, todavía propuesto. Si
  se acepta, la respiración es el primer lugar donde entra; este ADR no la trae.

## Consecuencias

- `InkFlood` gana `tone: 'ink' | 'paper'`. Nace `BreathingObject` en `design/components`.
  `EmergencySheet` desaparece. Dos rutas nuevas: `session/emergency` y `session/closed`.
- `domain/exitRitual` gana `releaseBreath` y `phaseDurationMs`, con tests.
- El PRD §2 y `PROTOTYPE_GUIDE` se reescriben para decir lo que el código hace.
- "Reducir movimiento": el tile no anima; la fase se lee en la palabra y en la barra. Los
  floods ya respetan lo que hace `InkFlood`.
- Deuda que este ADR no toca: `Sheet` lleva el literal `'cerrar'` fuera de i18n.
