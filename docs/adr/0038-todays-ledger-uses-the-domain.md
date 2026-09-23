# ADR-0038 — Actividad › Hoy usa el libro mayor del dominio

**Estado:** aceptada · 2026-09-23

## Contexto

ADR-0010 decidió que el renglón "sin registrar" no suma monedas: es **el complemento de
la unión de los intervalos** de sesiones y de muestras de Salud, y dejó dicho que *"el
renglón redes (estimado) queda fuera de la resta y se muestra aparte, siempre como
piso"*. El dominio lo implementó entero en `domain/ledger.ts`: filas por actividad y por
tipo de Salud, cada una con su procedencia, la unión medida como operación de conjuntos,
el día real de 23 o 25 horas, el estimado fuera de la partición. Tiene los mejores tests
del repositorio.

**Ninguna pantalla lo importa.** `TodaySection` calcula el residuo a mano:

```ts
unregisteredMs = now - dayStart - focusMs - usage.todayMs
```

Eso resta el estimado —lo que ADR-0010 prohíbe en su línea 47— y suma duraciones en vez
de medir una unión, así que dos sesiones solapadas se cuentan dos veces. ADR-0029 lo
empeoró sin querer: mientras `usage.todayMs` era una constante de semilla el error era
estable; ahora es un número real y variable que se resta de la vida del usuario.

Hay un segundo hueco, más profundo, que conviene nombrar aquí para que no se confunda
con este: **las muestras de Salud no se guardan en ninguna parte.** `platform/health.ts`
lee la semana a demanda con `readWeek` y `useHealthSync` la convierte en marcas de
hábito; la semana cruda no vive en ningún store ni en ninguna tabla. Así que hoy no hay
intervalos de Salud que meter en la unión, vengan de donde vengan.

## Decisión

1. **`TodaySection` pasa a dibujar lo que devuelve `buildLedger`.** El residuo vuelve a
   ser el complemento de una unión, el estimado sale de la resta y se muestra aparte
   como piso, y las filas por actividad son las que `PROTOTYPE_GUIDE.md` describía desde
   el principio ("trabajo, redes estimado, sin registrar").
2. **Las filas de Salud quedan vacías por ahora**, con `healthSamples: []`, porque no
   hay de dónde sacarlas. El libro mayor no finge que no existen: simplemente no hay
   filas verificadas hasta que la semana de Salud viva en algún sitio.
3. **Cuando se construya, la semana de Salud vive donde el uso por app** — un store
   efímero alimentado por la plataforma, sin persistir, exactamente la forma de
   ADR-0029. Es la opción coherente con la casa: leer a demanda, no guardar lo que el
   sistema ya guarda. No se implementa en esta tanda.

## Consecuencias

- Deja de restarse un estimado de un tiempo medido, que era una violación literal de la
  regla 9 escondida en una pantalla.
- Dos sesiones solapadas dejan de contarse dos veces en el residuo.
- La pantalla gana filas: una por actividad con tiempo, en vez de una sola "Enfocado".
  Es lo que el mapa de pantallas ya prometía.
- **Sigue sin arreglarse** que ocho horas de sueño confirmado aparezcan dentro de "Sin
  registrar". No es un defecto de la pantalla ni del dominio: es que nadie guarda esas
  horas. Queda anotado en `STATUS.md` › "Qué falta" y depende del punto 3.
- `declaredCapped` **sigue sin lector**: la pantalla no dibuja ninguna advertencia de
  las seis horas declarables. Inventarle una aquí sería diseñar de más; queda como está,
  dicho en voz alta, para que la próxima tanda decida si merece una línea.
