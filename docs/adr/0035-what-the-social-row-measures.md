# ADR-0035 — Qué mide la fila "redes" y qué de eso se comparte

**Estado:** aceptada · 2026-09-23

## Contexto

ADR-0029 puso el uso por app detrás de `platform/usage` y lo presentó bajo la fila
"redes" de Actividad › Hoy. Dio por supuesto que lo que se mide es uso social, pero no
dijo **de dónde sale la lista de apps a medir**. La implementación tomó la unión de los
`selectionToken` de todos los modos, y ahí aparecen dos agujeros que una revisión
encontró por tres caminos distintos:

1. **Los modos `allow`.** Un modo tiene `behavior: 'block' | 'allow'` y `blockPlan`
   (`domain/blocking.ts`) usa el mismo token con `kind: mode.behavior`. En un modo
   *permitir solo seleccionadas*, el token son las apps que el usuario **deja vivas**:
   Mapas, Teléfono, Notas. Hoy sus minutos aterrizan bajo "Redes (estimado)", con su
   nombre y su icono, entran a la proyección de la tarjeta Vida y se comparten al
   círculo. Cuarenta minutos navegando con Maps se leen como cuarenta minutos de redes.

2. **El piso de demostración viajando como dato propio.** `weekUsageMs` cae a la
   constante `USAGE.weekMs` de la semilla (11 h 40 min) cuando el teléfono no responde
   —o sea **siempre en iOS**—, y `useCircleWeek` la mete en `socialMs` cuando el
   interruptor de Ajustes › Círculo está encendido. Una cifra inventada publicada a
   hasta doce personas como el uso real de quien la comparte. Es la misma clase de error
   que ADR-0033 ya corrigió del lado del servidor, donde `null` significa "no lo
   comparte" y cero significa "no hice nada".

## Decisión

1. **Se miden solo las selecciones de los modos `block`.** En un modo `allow`, lo que
   tira del teléfono es todo lo *no* seleccionado, y eso no se puede enumerar sin listar
   las apps del teléfono entero — que es justo lo que el catálogo de Android evita a
   propósito (`<queries>`, nunca `QUERY_ALL_PACKAGES`) y lo que iOS prohíbe. Un modo
   `allow` no aporta nada a la lista medida.
2. **El interruptor decide si se comparte; el origen decide si hay algo que compartir.**
   Mientras `usage.source === 'demo'`, el círculo recibe `null` en `socialMs`, encendido
   o apagado el interruptor. No se comparte una cifra que no salió del teléfono.
3. **Actividad › Hoy no cambia**: sigue mostrando el estimado de demostración con su
   nota y su razón. Eso lo decidió ADR-0029 §3 y sigue en pie. La diferencia es que lo
   que se muestra con una nota al lado no es lo mismo que lo que se publica a otras
   personas sin ella.
4. **Un fallo de lectura no es un cero.** La capa nativa devuelve una fila por cada
   paquete pedido, incluso con cero milisegundos, así que una respuesta vacía con
   paquetes pedidos solo puede significar que la lectura falló. En ese caso la pantalla
   vuelve al estimado con su razón, y nunca dice "≥ 0 min · leído a las 14:32".

## Consecuencias

- Quien solo tenga modos `allow` no ve desglose: la fila "redes" queda en el estimado
  con su razón, que es la verdad.
- En iOS la línea de redes desaparece de la fila del círculo en vez de mostrar un número
  inventado. Es una fila menos y una mentira menos.
- El día que iOS tenga uso real (fase 3), `source` pasa a `device` y la línea vuelve
  sola, sin tocar esta decisión.
- Alternativas descartadas: medir también los modos `allow` invirtiendo el conjunto
  (imposible sin enumerar el teléfono); marcar la cifra compartida como "estimada" en la
  fila del círculo (traslada al lector el trabajo de desconfiar, y ADR-0021 dice que el
  círculo no compara cifras que no son comparables).
