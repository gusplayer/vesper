# ADR-0045 — La moneda propia siempre tiene su fila, aunque marque cero

**Estado:** aceptada · 2026-09-24 · enmienda a ADR-0038

## Contexto

ADR-0038 conectó `buildLedger` a Actividad › Hoy y el libro mayor volvió a ser lo que
ADR-0010 decidió. Al verlo corriendo apareció una consecuencia que el ADR no había
previsto y quedó anotada ahí: `buildLedger` solo emite filas con tiempo (`ms > 0`), así
que **un día sin foco no muestra "Enfocado" en absoluto**.

El día sin foco es justamente el día en que esa fila importa. La app entera existe para
una cifra, y la pantalla que la lleva la esconde el día que está en cero, mientras sigue
mostrando "redes" y "sin registrar". El usuario que abre Actividad a media tarde sin
haber enfocado no ve un cero: ve una pantalla donde el foco no se menciona.

Como partición del día, un cero no aporta nada y el dominio hace bien en no emitirlo.
El problema no es el cálculo, es que la pantalla trata a las tres monedas como iguales
cuando una es la de la casa.

## Decisión

**Actividad › Hoy dibuja siempre la fila del foco, aunque el ledger no la traiga.** Es
la primera fila, y en cero cuando el día va en cero.

Su cifra es **el total declarado del propio ledger** (`declaredMs`), no la del contador
de Focus. Las dos son correctas y miden cosas distintas: el contador de Focus acredita
una sesión entera al día en que **empezó**, y el ledger **recorta** cada intervalo al día
que está particionando. Si la fila usara la del contador, la mañana siguiente a una
sesión que cruzó la medianoche una parte sería mayor que su total, y —peor— los renglones
dejarían de sumar el día: "sin registrar" se calcula restando la unión recortada, así que
habría minutos que no aparecen en ninguna fila. Un libro mayor que no particiona no es un
libro mayor, y eso es lo que ADR-0010 vino a arreglar.

El resto no cambia: las filas por actividad, las de Salud cuando existan, el estimado de
redes y "sin registrar" siguen saliendo del ledger y siguen apareciendo solo si tienen
tiempo. El dominio no se toca: la decisión es de presentación y vive en la pantalla.

## Consecuencias

- Un día sin foco se ve como "Enfocado · 0m", que es una frase corta y honesta, en vez
  de una ausencia que no significa nada.
- Cuando hay foco, la fila del total convive con las filas por actividad que el ledger
  emite. Eso es un total con su desglose debajo, la misma forma que "redes" ya tiene con
  sus apps: la pantalla ya sabe dibujarlo y `AppRow subordinate` ya existe para ello.
- El precio, dicho en voz alta: la mañana siguiente a una sesión que cruzó la medianoche,
  la pastilla de Focus y esta fila pueden decir números distintos. Cada una es correcta
  para lo que mide, y esa diferencia ya existía entre Focus y el ledger antes de esta
  enmienda. Unificarlas es cambiar qué cuenta la pastilla de Focus, que es otra decisión.
- Alternativa descartada: hacer que `buildLedger` emita ceros. Ensuciaría una partición
  correcta —y todas las demás filas, incluidas las de Salud— para resolver un problema
  de una sola fila en una sola pantalla.
