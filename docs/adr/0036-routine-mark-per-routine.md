# ADR-0036 — La marca de una ventana de rutina es por rutina

**Estado:** aceptada · 2026-09-23

## Contexto

ADR-0019 prometió que "una ventana ya arrancada nunca arranca dos veces, aunque su
sesión se haya terminado antes: terminarla fue una decisión". El motor lo implementó con
**una sola** marca en `settings`:

```ts
lastRoutineStart: { routineId: string; windowStart: number } | null;
```

`dueRoutine` elige la ventana abierta que empezó más recientemente, así que con dos
rutinas solapadas la segunda le roba la marca a la primera y, al cerrarse la segunda
ventana, la primera vuelve a leerse como no arrancada:

- "Trabajo", L-V 09:00–18:00. "Lectura", L-V 13:00–13:30.
- 09:00 → arranca Trabajo, marca `{trabajo, 09:00}`. El usuario termina a las 09:30.
- 13:00 → `dueRoutine` prefiere Lectura, arranca, marca `{lectura, 13:00}`.
- 13:30 → Lectura cerró. `dueRoutine` devuelve Trabajo, cuya ventana sigue abierta;
  `isMarked` da falso → **arranca sola una sesión de 4 h 30 con el bloqueo puesto.**

El usuario no pidió nada y la app le bloquea el teléfono la tarde entera. Es el peor
modo de fallo del motor de rutinas: rompe la confianza de la única funcionalidad que
actúa sin que nadie la toque.

Las rutinas solapadas son legales a propósito: la pantalla de horarios avisa "Horarios
superpuestos" pero no lo impide, porque una rutina larga de trabajo con una corta de
lectura adentro es un caso real.

## Decisión

**La marca es por rutina, no una sola global.** `settings.lastRoutineStart` pasa de un
objeto a un mapa `Record<routineId, windowStart>`, y `isMarked` consulta la entrada de
la rutina que está vencida. La invariante que ADR-0019 prometió pasa a sostenerse con
cualquier número de rutinas solapadas.

La **migración 008** convierte la marca existente en un mapa de una entrada: nadie
pierde la marca del día y ninguna ventana ya arrancada revive por migrar.

Las entradas de rutinas borradas se limpian al guardar, para que el mapa no crezca sin
techo en `settings`.

## Consecuencias

- Dos rutinas solapadas se comportan como dice el ADR-0019: cada ventana arranca una vez.
- `settings` gana una columna con forma de mapa; `DATA_MODEL.md` lo documenta.
- Alternativas descartadas: prohibir rutinas solapadas (la pantalla ya decidió
  permitirlas, y el caso es real); guardar la marca en la fila de la rutina en vez de en
  `settings` (más limpio conceptualmente, pero obliga a escribir en `routines` en cada
  arranque, que es la tabla que el usuario edita; se puede reconsiderar si el mapa
  estorba).
