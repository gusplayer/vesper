# ADR-0013 — El cierre del domingo no es una pantalla nueva

**Estado:** aceptada · 2026-08

## Contexto

El PRD pide una *"pantalla de cierre el domingo"* para la meta semanal. La regla 2 permite
tres pantallas en la navegación principal y ya están las tres. Una cuarta necesitaría un
ADR que superara la regla 2, y el cierre semanal no vale eso.

ADR-0009 dejó un precedente útil: la sesión activa es una **ruta**, no una página del
pager, y sigue contando como una de las tres pantallas porque no compite por el swipe.

Las opciones:

1. **Una ruta nueva `/week-close`.** Alcanzable el domingo desde el encabezado. Es honesta
   con el PRD pero agrega una superficie que solo existe un día de cada siete, y compite
   con la ruta de la meta, que ya vive detrás del mismo texto del encabezado.
2. **Un bloque en el libro mayor del domingo.** Cero superficies nuevas, pero el cierre
   queda mezclado con el día, que es exactamente lo que la moneda separada no quiere.
3. **La ruta de la meta se convierte en el cierre el domingo.**

## Decisión

Opción 3. `/config/week` es el cierre. El domingo, esa ruta muestra **primero cómo cerró la
semana** —foco acumulado contra la meta, y cada hábito contra la suya— y debajo, los chips
para elegir la meta de la semana que empieza.

Es la misma ruta, detrás del mismo texto del encabezado que se toca para leer el progreso.
El domingo ese texto deja de decir cuánto falta y dice `cerrar la semana`.

## Consecuencias

- Cero pantallas nuevas. La regla 2 no se toca y no hace falta un ADR que la supere.
- El cierre y la meta siguiente quedan en el mismo lugar, que es el orden natural: mirás
  cómo fue y decidís la que viene. Una pantalla de cierre aparte tendría que empujarte a
  otra para elegir la meta.
- No hay notificación. Cuando llegue la de cierre semanal en fase 1.75, va a apuntar acá.
- El cierre no se puede ver un lunes. Si mirar la semana pasada resulta necesario, es una
  vista de historia y eso es otro ADR — hoy la app no tiene ninguna.
- Riesgo asumido: un domingo sin meta configurada no tiene nada que cerrar. En ese caso
  muestra lo hecho y ofrece poner una meta, que es la conversión que importa.
