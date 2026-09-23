# ADR-0041 — Un hábito verificado que nada puede verificar cae a declarado, y lo dice

**Estado:** aceptada · 2026-09-23

## Contexto

Un hábito puede marcarse solo (`countMode: 'verified'`) cuando Salud puede confirmarlo.
`domain/healthMarks.ts` traduce el nombre del hábito a un tipo de Salud —entrenamiento,
pasos, sueño— y, cuando no reconoce ninguno, hace `continue`: el hábito se queda
verificado y **nunca recibe una marca**.

Un hábito verificado tampoco se marca a mano, porque marcarlo a mano es justo lo que la
verificación evita. Así que "Meditar" creado como verificado es un callejón sin salida:
no se puede cumplir de ninguna manera, no dice por qué, y su contador se queda en cero
toda la semana arrastrando la meta.

El dominio no es el lugar para arreglarlo. Saltar en silencio es lo correcto ahí: la
función traduce lo que reconoce. El problema es que la pantalla permite crear un estado
que el sistema no puede honrar.

## Decisión

**El editor de hábitos no ofrece "verificado" cuando nada puede verificar ese hábito.**
Si el nombre escrito no mapea a ningún tipo de Salud, la opción cae a "declarado" y la
pantalla dice por qué, en una línea, con la forma de la regla 8: lo que no se puede, se
explica.

Cae, no se bloquea. El usuario puede llamar a su hábito como quiera —ADR-0008 dice que el
hábito tiene nombre propio— y se lleva un hábito que funciona, marcándolo él. Negarle el
guardado le quitaría el hábito para defender una casilla.

## Consecuencias

- Deja de existir un hábito imposible de cumplir. Es el único estado de la app que no
  tenía salida ninguna.
- Al renombrar un hábito, la casilla puede caer sola de verificado a declarado. La línea
  lo dice en el momento, no después.
- Un hábito ya guardado en ese estado se corrige al editarlo. No hay migración: el estado
  es recuperable en cuanto la pantalla lo toca.
- No cambia nada de Salud: los tres tipos que se reconocen siguen siendo los mismos.
- Alternativa descartada: pedir al usuario que elija el tipo de Salud a mano. Añade un
  selector a la pantalla más simple de la app para un caso de borde, y ADR-0008 ya decidió
  que el hábito se define por su nombre.
