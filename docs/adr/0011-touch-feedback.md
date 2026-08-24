# ADR-0011 — Cómo se ve que algo responde al dedo

**Estado:** aceptada · 2026-08

## Contexto

La regla 3 dice que hay un control primario por pantalla y que **todo lo demás es texto
tocable**. La regla 6 prohíbe animación. Las dos juntas dejaron dos agujeros que se ven
en el primer minuto de uso:

1. **Nada acusa el toque.** Tocás un chip o `empezar` y no pasa nada visible hasta que
   aparece el resultado. Con transiciones instantáneas no hay ni un frame de respuesta.
2. **No se distingue qué texto responde.** `agregar hábito`, `listo` y `toca para
   cambiar` se ven idénticos a cualquier `Caption`. La regla 3 apoya el producto entero
   en un tipo de control que no se anuncia.

Prohibir animación no obliga a prohibir un cambio de estado: un estado es instantáneo por
definición. Las opciones para el toque eran tres:

1. **Opacidad**, el default de React Native. Es un fundido, o sea animación, y además el
   papel cálido se ve sucio al 60%.
2. **Renderizar el elemento como seleccionado** mientras está presionado. Coherente, pero
   invisible en un chip que ya está seleccionado, que es justo el que más se toca.
3. **Invertirlo**: cuadro relleno de tinta, texto en papel.

## Decisión

**Los controles con caja se invierten mientras están presionados.** Fondo `ink`, texto
`paper`. Instantáneo al presionar, instantáneo al soltar. Aplica a `Chip`, `ChoiceCard` y
`PrimaryAction`.

Un Kindle invierte lo que tocás. Es el gesto nativo del medio que la app imita, usa
únicamente dos de los cuatro tonos, y no puede confundirse con un estado persistente
porque desaparece al levantar el dedo. La frase de `DESIGN_SYSTEM.md` *"no hay estados de
fondo relleno"* se refiere a la selección, que sigue comunicándose solo con el grosor del
borde.

**El texto tocable lleva una regla fina debajo**, y al presionarlo pasa de `ink60` a
`ink`. La regla fina bajo el texto ya es el vocabulario de la app para "acá se actúa":
es exactamente lo que hace `TextField`. Aplica a las acciones de encabezado, a las
etiquetas tocables y a las filas de hábito del libro mayor.

`HoldToConfirm` no lleva nada de esto: su barra de progreso ya es la respuesta al dedo, y
en profundidad `profundo` la ausencia de respuesta es la funcionalidad.

## Consecuencias

- Se agrega `paper` como color de texto. Sigue habiendo cuatro tonos.
- El área tocable mínima pasa a 44pt en todos los controles. Los chips medían 34pt y las
  filas de hábito 26pt, y esas filas son controles desde que se marcan tocándolas.
- En el texto tocable los 44pt se logran con `hitSlop`, no con altura. Crecer la caja
  dentro de una fila de encabezado empujaba la regla gruesa lejos del título: el área
  táctil llega sin que el layout se entere.
- Un chip seleccionado y presionado se ve invertido, no doblemente seleccionado. La
  jerarquía sigue siendo legible porque el borde no cambia.
- La regla fina bajo el texto tocable agrega una línea horizontal más por pantalla. En un
  lenguaje hecho de reglas horizontales eso es densidad, no ruido — pero si la pantalla
  de inicio se siente rayada, la regla se reserva para las acciones y las filas la
  pierden, con un ADR nuevo.
