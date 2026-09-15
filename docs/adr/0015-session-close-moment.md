# ADR-0015 — Cuando el timer termina, la sesión se cierra en la misma ruta

**Estado:** aceptada · 2026-09

## Contexto

Hoy, cuando el timer llega a cero, la ruta de sesión hace `back()` y aparece la pantalla
de inicio. No hay un instante entre terminar y estar de vuelta. La intención que el
usuario escribió se guarda y no se vuelve a leer nunca; `STATUS.md` lo lista como decisión
pendiente bajo "historia".

Referencia externa: Brick cierra cada sesión con una ficha de tres filas —modo, apps
bloqueadas, duración— y un botón para seguir. Sin confeti, sin insignia. Es lo segundo de
Brick que vale la pena traer.

El PRD dice que de la sesión "solo se sale terminando el timer o manteniendo pulsado", y
la regla 2 no deja lugar para una cuarta pantalla. ADR-0013 ya resolvió un caso igual: el
cierre del domingo no es una pantalla nueva, es un estado de la ruta de la meta.

Las opciones:

1. **Nada.** Terminar es volver. Es lo que hay.
2. **Un estado de cierre en la ruta de sesión.** Al vencer el timer la ruta no se va: el
   timer muestra la duración servida, debajo aparece la intención tal como se escribió, y
   `mantén pulsado para terminar` se reemplaza por un texto tocable `volver`. Una sesión
   cancelada no pasa por acá: no hay nada que cerrar.
3. **Una línea en el inicio**: `última sesión · 25m de trabajo`. Sin tap extra, pero
   mezcla el cierre con el libro mayor del día, que es lo que la moneda separada no quiere.

## Decisión

**Opción 2.** Es el mismo patrón de ADR-0013 aplicado a la sesión: la ruta
cambia de estado en vez de existir una pantalla nueva. Tres cosas y un texto tocable:
actividad, duración servida, intención, `volver`.

El costo es un tap más al terminar. Se acepta porque el timer venció solo: el usuario no
está esperando volver, está terminando algo, y un segundo de página en blanco con lo que
escribió es la única vez que la app le devuelve su propia palabra.

## Consecuencias

- Cero pantallas nuevas. La regla 2 no se toca.
- La ruta de sesión pasa a tener tres estados: corriendo, saliendo (firme), cerrada.
- La intención se lee por primera vez. Si esto resulta valioso, la vista de historia que
  `STATUS.md` deja pendiente tiene un punto de partida: la lista de estos cierres.
- `onboarding_completed_at` se sigue escribiendo al completar, no al tocar `volver`.
- Riesgo asumido: si el usuario deja la app en segundo plano y el timer vence, vuelve a
  una pantalla de cierre en vez de al inicio. Es correcto: terminó algo mientras no
  miraba, y eso es lo que ve.
