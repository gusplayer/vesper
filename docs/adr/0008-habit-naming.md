# ADR-0008 — El hábito tiene nombre propio, no hereda el de una actividad

**Estado:** aceptada · 2026-08

## Contexto

`PRD.md` prometía que el nombre del hábito es texto libre, pero la tabla `habits` de
`DATA_MODEL.md` solo tenía `activity_id` con FK a `activities`. El nombre libre no tenía
dónde guardarse.

`activities` no es una tabla cualquiera: es la lista de chips que aparece en la
configuración de sesión. Toda sesión de foco elige una, y el libro mayor del día agrupa
por ahí.

Las dos opciones razonables:

1. **El hábito es una actividad.** Sin columna de nombre. Crear un hábito es elegir una
   actividad y ponerle meta semanal. Modal de dos decisiones sin teclado, mapeo a salud
   determinista por `activities.key`, e imposible duplicar renglones en el libro mayor.
2. **El hábito tiene nombre propio** y una actividad opcional como categoría.

## Decisión

Opción 2. `habits.name TEXT NOT NULL` con `activity_id` **nullable**.

Cuando el nombre coincide con una actividad existente, el repositorio autovincula
`activity_id`. Un solo renglón en el libro mayor, sin trabajo del usuario.

## Consecuencias

- Los dos hábitos verificados que el PRD nombra explícitamente —**sueño y pasos**— son
  posibles. Con la opción 1 había que crear las actividades `dormir` y `pasos`, y entonces
  aparecían como chips elegibles para una sesión de foco: un pomodoro de 25 minutos
  durmiendo. Ese es el argumento que decide, no el esquema.
- Se paga con un campo de texto en el modal de hábito, y con que el tipo `verified` se
  ofrezca por heurística de nombre en vez de por clave exacta. La heurística falla con
  "hierro" o "box"; el usuario puede corregir el tipo a mano.
- Riesgo asumido: dos hábitos con nombres distintos para lo mismo ("gym" y "entrenar").
  Con tope de 5 hábitos es un problema que el usuario ve y arregla solo.
- Si el teclado en el modal resulta demasiada fricción, agregar chips de actividad como
  sugerencias encima del campo es aditivo y no requiere migración. No al revés.

## Nota (2026-09)

El autovínculo por nombre se guarda en `activity_id`, pero el libro mayor todavía no lo usa
para mostrar un solo renglón, y la corrección manual del tipo no está implementada: el
nombre desbloquea `verified` y declarado sigue siendo el default. Ver `docs/STATUS.md`.
