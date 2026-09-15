# ADR-0006 — Lenguaje visual de tinta electrónica

**Estado:** aceptada · 2026-08

## Contexto

Una app cuyo propósito es que uses menos el teléfono no debería competir por atención
con el resto de la pantalla de inicio. La estética habitual de app moderna —color
saturado, animación con spring, tarjetas con sombra— trabaja en contra del propósito.

Una pantalla de e-ink refresca lento, no tiene color y no anima. Adoptar esas
restricciones como lenguaje visual alinea la forma con la función.

## Decisión

Estética de tinta electrónica, con las restricciones tomadas literalmente:

- Cuatro tonos, ninguno negro ni blanco puro
- Serif en toda la app, dos pesos
- Radio máximo 4px
- Cero sombras, degradados, blur y elevación
- Sin animación de spring, escala o parallax. Fade de 120ms máximo
- **Solo texto, reglas horizontales y cuadros rellenos**

## Consecuencias

- No hay gráficos ni charts en el producto. La única excepción es la cuadrícula de
  semanas, y funciona porque son literalmente cuadros de tinta.
- No se usan librerías de UI. Los ~15 componentes se escriben a mano.
- El estado "hecho" se comunica con la palabra, no con color. No hay verde de éxito.
- Un widget de iOS y una Live Activity se ven idénticos a la app sin trabajo extra.
  Es una ventaja real, no una coincidencia.
- Modo oscuro se difiere. Cuando llegue será papel `#1C1B19` / tinta `#D8D5CD`, nunca
  invertido a negro puro.
- Riesgo aceptado: se lee como "app sin diseño" para parte del público. Es un filtro
  de audiencia deliberado.

## Nota (2026-09)

Los "~15 componentes" son 23, todos escritos a mano. La lista vive en
`docs/DESIGN_SYSTEM.md`.

## Nota (2026-09-15)

Superada por ADR-0016: la estética e-ink se abandona; el sistema de diseño sigue a Brick.
