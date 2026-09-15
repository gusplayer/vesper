# ADR-0007 — No existe pantalla de ajustes

**Estado:** aceptada · 2026-08

## Contexto

Las apps minimalistas se ven limpias hasta que abres "Ajustes" y hay cuarenta filas.
Una pantalla de ajustes es donde va a morir cada decisión que no se quiso tomar: se
convierte en un vertedero de opciones y traslada al usuario el trabajo de diseño.

El producto además exige velocidad: un tap desde abrir hasta estar en sesión.
Un ícono de engranaje compite con ese objetivo.

## Decisión

No hay pantalla de ajustes ni ícono de engranaje. Toda la configuración vive en el flujo
donde se usa:

- **Configuración de sesión** — se abre tocando el número grande de la pantalla de inicio
- **Perfiles de bloqueo** — se configuran una vez en el onboarding, se eligen en la
  configuración de sesión
- **Hábitos** — se crean y editan desde el libro mayor del día
- **Fecha de nacimiento y pantalla de vida** — se configuran desde la propia pantalla de vida

Toda decisión de configuración **hereda el valor de la última sesión**. La app nunca
pregunta dos veces lo mismo.

## Consecuencias

- La navegación son 3 rutas y 2 modales. No crece.
- Cualquier opción nueva tiene que encontrar un lugar natural en un flujo existente.
  Si no lo encuentra, probablemente no debía existir. Ese es el punto.
- El `FamilyActivityPicker` de iOS es una hoja del sistema que no se puede estilizar y
  choca con la estética. Por eso aparece **una sola vez**, en el onboarding, y nunca en
  el flujo diario.
- Cosas que normalmente viven en ajustes y aquí no existen: tema, idioma, unidades,
  sonidos, exportar datos, cuenta. Si alguna se vuelve necesaria, requiere un ADR que
  supere a este.

## Nota (2026-09)

Las rutas son seis: `index`, `session` y cuatro de configuración (`config/session`,
`config/habit`, `config/week`, `config/habit-edit`), todas con fade, ninguna modal.
`habit-edit` no tiene ADR propio: es el "se editan desde el libro mayor" de esta decisión,
alcanzado con un toque largo. Ver `docs/ARCHITECTURE.md`.
