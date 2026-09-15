# ADR-0010 — El renglón `sin registrar` no suma monedas: resta intervalos

**Estado:** aceptada · 2026-08

## Contexto

La regla 9 de `CLAUDE.md` es dura: **nunca sumar tiempo verificado y declarado en una
misma métrica.** ADR-0005 explica por qué: un score único enseña al usuario que declarar
es más barato que hacer.

Pero `ARCHITECTURE.md` define el renglón `sin registrar` como el día menos la suma del
resto, y eso suma verificado con declarado. La contradicción está en el papel desde el
principio y hoy es invisible porque `healthSamples` siempre llega vacío. En la fase 1.5
deja de serlo: ahí entra tiempo verificado real al libro mayor.

Hay un segundo problema que la suma esconde: **los intervalos se solapan.** Un
entrenamiento verificado puede caer dentro de una sesión de foco declarada. Sumando, ese
rato se cuenta dos veces y el residuo queda corto, o toca piso en 0 sin decir por qué.

Las tres opciones:

1. **Restar la suma y declarar una excepción a la regla 9.** Es el statu quo. Se
   argumenta que el residuo no es un score sino el complemento de una partición. Cuesta
   cero, pero deja la regla más importante del producto con un asterisco, y no arregla el
   solapamiento.
2. **Dejar el verificado fuera del residuo**, restando solo declarado y estimado.
   Cumple la regla al pie de la letra. Pero entonces 8h de sueño confirmado aparecen
   dentro de `sin registrar`, y eso es mentira: el sueño está documentado. El renglón que
   el PRD quiere que provoque una reacción se convierte en ruido, porque a partir de la
   fase 1.5 todo el mundo va a tener 8h ahí para siempre.
3. **Restar intervalos en vez de números.**

## Decisión

Opción 3. `sin registrar` es **la parte del día transcurrido que ningún intervalo
cubre**, calculada como el complemento de la unión de los intervalos de sesiones y de
muestras de salud.

```
sinRegistrar = (min(now, dayEnd) - dayStart) - medida(union(sesiones ∪ muestras))
```

La unión es una operación de conjuntos, no una suma. Ningún número de una procedencia se
suma a un número de otra, así que la regla 9 se cumple **literalmente**, sin excepción y
sin asterisco.

El renglón `redes` (estimado) queda fuera de la resta y se muestra aparte, siempre como
piso. No tiene intervalos: sale de contar umbrales, y ADR-0004 ya prohíbe presentarlo
como cifra exacta. Un número que nunca es exacto no puede entrar en una partición exacta.

## Consecuencias

- El solapamiento desaparece por construcción. Un gym verificado dentro de una sesión de
  foco declarada ocupa el rato una sola vez, y cada renglón sigue mostrando su propio
  total real.
- El residuo es exacto y honesto: el sueño confirmado deja de aparecer como tiempo sin
  registrar, y lo que queda en ese renglón es de verdad tiempo del que no sabemos nada.
- `LedgerInput` ya trae todo lo necesario: las sesiones tienen `startedAt` y `endedAt`, y
  las muestras de salud también. No hace falta ningún dato nuevo.
- **El tope de 6h declarables deja de proteger el residuo.** Existía para que un timer
  falso de 8h no rompiera una suma; en una partición no hay suma que romper: el día tiene
  las horas que tiene. El tope se queda como advertencia visible en la UI —
  *"tope de 6h declarables alcanzado"* — y como límite de los renglones, no de la resta.
  Si eso resulta demasiado permisivo, se corrige con un ADR nuevo, no aflojando este.
- Cuesta reescribir `domain/ledger.ts` y sus tests. Es la única opción de las tres que
  cuesta código, y la única que no deja deuda conceptual.
- Una sesión `running` aporta el intervalo `[startedAt, now]`, coherente con que el libro
  mayor sea una vista viva del día y no un informe escrito a medianoche.

## Nota (2026-09)

`LedgerInput` sí necesitó un dato nuevo: `activities`, para etiquetar los renglones sin
que el ledger resuelva ids por su cuenta. Las claves de renglón llevan espacio de nombres
(`activity:`, `health:`, `usage`, `unknown`). Ver `docs/ARCHITECTURE.md`.
