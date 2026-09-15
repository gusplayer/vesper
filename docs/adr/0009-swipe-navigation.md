# ADR-0009 — Cómo se implementa el swipe horizontal

**Estado:** aceptada · 2026-08

## Contexto

El PRD pide swipe horizontal entre tres pantallas, sin tab bar. `ARCHITECTURE.md` dice
expo-router con tres rutas. Las dos cosas juntas no salen solas: un `Stack` de expo-router
no hace swipe entre hermanos, y los `Tabs` de expo-router tampoco.

Hay un problema de producto encima del técnico: **la pantalla 2 no existe casi nunca.**
Es la sesión activa, y la mayor parte del tiempo no hay ninguna. Ningún documento dice qué
muestra el swipe del medio cuando no hay sesión corriendo. Y en nivel `profundo`, poder
salirse de la sesión deslizando contradice el punto entero del nivel.

Las opciones:

1. **`react-native-pager-view`** con una ruta que contiene las páginas. expo-router queda
   para los dos modales. Paginación nativa (`UIPageViewController` / `ViewPager2`), sigue
   el dedo, sin animación en JS.
2. **`@react-navigation/material-top-tabs`** con la tab bar oculta. Mantiene rutas reales
   y hace swipe, pero por debajo usa `react-native-tab-view` + `react-native-pager-view`:
   tres dependencias para el mismo mecanismo nativo de la opción 1.
3. **Sin swipe.** Tres rutas con transición instantánea, navegadas con texto tocable, que
   ya es el lenguaje del producto (regla 3: "todo lo demás es texto tocable"). Cero
   dependencias. Contradice el PRD.

## Decisión

Opción 1, con una corrección de producto: **la sesión no es una página del pager, es una
ruta.**

- El pager tiene **dos páginas**: `inicio` y `vida`. Si `life_screen_enabled` es falso,
  tiene una sola y el swipe no hace nada.
- `sesión` es una ruta que se empuja al tocar `empezar`, a pantalla completa, sin swipe.
  Se sale por `HoldToConfirm` o porque el timer termina, que es exactamente lo que los
  tres niveles de profundidad regulan.

Siguen siendo tres pantallas y dos modales: la regla 2 de `CLAUDE.md` no se toca.

## Consecuencias

- Desaparece la pregunta de qué muestra el swipe del medio sin sesión: no hay página del
  medio.
- El nivel `profundo` es defendible. Con la sesión como página del pager, un swipe la
  abandonaba y el nivel no significaba nada.
- `inicio` y `vida` no son rutas, así que no hay deep link a ellas. En fase 1 no hay deep
  links; el widget de fase 1.75 apunta a `sesión`, que sí es ruta.
- Una dependencia nativa nueva (`react-native-pager-view`). Se justifica: es el mismo
  módulo que usaría la opción 2, sin las dos capas de JS encima.
- El pager arranca en `inicio` siempre. Nunca en `vida` — el PRD lo exige.

## Nota (2026-09)

`life_screen_enabled` se eliminó del código: el pager siempre tiene dos páginas y vida se
muestra siempre, con una invitación cuando no hay fecha de nacimiento. La variante de una
sola página no está implementada y ocultar vida es una decisión pendiente en `docs/STATUS.md`.

## Nota (2026-09-15)

Superada por ADR-0016: cuatro pestañas de texto. La sesión sigue siendo una ruta sin gesto de volver.
