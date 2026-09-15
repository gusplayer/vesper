# ADR-0014 — La sesión activa se ve distinta porque está en tinta

**Estado:** aceptada · 2026-09

## Contexto

Hoy la pantalla de sesión es la misma página de papel que la de inicio, con un número
más grande. Se distingue por el contenido, no por el estado. Nada dice "estás adentro".

Referencia externa: Brick invierte el tema entero al iniciar una sesión —claro afuera,
oscuro adentro— y el cambio de estado se entiende sin una palabra. Es lo único de Brick
que vale la pena traer, y no se puede copiar literal: ADR-0006 difiere el modo oscuro y
dice que nunca será papel invertido a negro.

Hay un precedente propio más útil que Brick: ADR-0011 decidió que **lo que se toca se
invierte**, porque eso hace un Kindle. Una sesión es un toque que dura 25 minutos.

Las opciones:

1. **Nada.** La sesión sigue en papel. Es lo que hay.
2. **Invertir la ruta entera de sesión.** Fondo `ink`, texto `paper`. Es el movimiento de
   Brick. Obliga a redefinir roles: `ink60` sobre `ink` no alcanza contraste, así que el
   texto secundario pasaría a `ink30`, que hoy nunca lleva texto. Ocho componentes
   necesitan un contexto de inversión.
3. **Invertir solo el timer.** `Timer` se vuelve un cuadro relleno de tinta con los
   dígitos en papel, y queda así toda la sesión. Es un `PrimaryAction` presionado que no
   se suelta. Un componente, dos tonos, cero reglas nuevas de contraste.

## Decisión

**Opción 3.** El timer es el único cuadro relleno de la pantalla de sesión, y
el único de la app fuera de `WeekGrid`. Dice lo mismo que las semanas vividas: el tiempo
que ya es tuyo está en tinta.

La opción 2 queda abierta como escalón siguiente si en siete días de uso el timer en tinta
no alcanza para sentir el cambio de estado. Si se toma, supera este ADR y define los roles
de tono invertidos.

## Consecuencias

- La sesión tiene una marca de estado que no depende de leer nada.
- `Timer` deja de ser texto suelto y pasa a ser una caja: padding, radio 4, fondo `ink`.
  Ningún otro componente cambia.
- Sigue habiendo cuatro tonos. `paper` como color de texto ya existe desde ADR-0011.
- La Live Activity de fase 1.75 hereda un bloque negro con dígitos claros, que es
  exactamente lo que se ve bien en la Dynamic Island sin trabajo extra.
- Riesgo asumido: un rectángulo negro grande sobre papel pesa. Si pesa demasiado, el
  arreglo es menos padding, no un gris: el quinto tono sigue prohibido.
