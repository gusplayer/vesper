# ADR-0012 — La fase 1 no tiene onboarding: tiene una primera vez

**Estado:** aceptada · 2026-08

## Contexto

La regla 8 dice que el onboarding es saltable en todos sus pasos y que la primera sesión
no requiere ningún permiso. `onboarding_completed_at` está en `DATA_MODEL.md` desde el
principio y nada lo escribe. Pero **ningún documento dice qué muestra el onboarding**, ni
cuántos pasos tiene.

Tres cosas del producto empujan en la misma dirección:

- En fase 1 no hay **nada** que pedir. Cero permisos, cero cuenta, cero configuración
  obligatoria: la sesión arranca con `25 / trabajo / suave` sin que el usuario decida nada.
- La métrica de éxito es *un tap desde abrir la app hasta estar en sesión, menos de 3
  segundos.* Cualquier pantalla previa trabaja contra la única cifra que el PRD mide.
- ADR-0007 eliminó la pantalla de ajustes con el argumento de que la configuración vive
  en el flujo donde se usa. Un onboarding es exactamente lo contrario: configuración y
  explicación por adelantado.

La tentación era inventar tres o cuatro pantallas de bienvenida. Eso habría sido inventar
producto que no está definido, y contradecir las tres cosas de arriba.

## Decisión

**No hay pantallas de onboarding en la fase 1.** Hay una primera vez, que consiste en:

1. La pantalla de inicio, tal cual, con los valores por defecto ya aplicados. Un tap y
   estás en sesión.
2. **Una línea** debajo del control primario que nombra las tres monedas, y que desaparece
   para siempre en cuanto se completa la primera sesión.
3. `onboarding_completed_at` se escribe al cerrar esa primera sesión — no al abrir la app.
   La regla 8 habla de *"cero permisos requeridos para la primera sesión"*, así que el
   hito es haber hecho una, no haber leído algo.

Cuando la fase 1.5 y la fase 2 traigan permisos reales que pedir, cada uno se pide **en su
flujo**: el de salud al crear un hábito verificado (ADR-0005), el de bloqueo al configurar
un perfil (ADR-0007). Sigue sin haber un onboarding que los junte.

## Consecuencias

- Un usuario nuevo puede empezar a usar la app sin leer una palabra, que es la prueba que
  el criterio de salida de la fase 1 realmente mide.
- La línea de la primera vez es el único texto explicativo de la app. Si en las pruebas
  resulta que nadie entiende las tres monedas con una línea, el arreglo es una mejor línea
  antes que una pantalla más.
- El nombrado de apps de ADR-0004 y los perfiles de bloqueo de ADR-0007 dicen "en el
  onboarding". Léase: **en el setup de bloqueo de la fase 2**, que es un flujo aparte y no
  existe todavía. Son dos cosas distintas con el mismo nombre y esta es la aclaración.
- Riesgo asumido: sin explicación previa, parte de la gente no va a entender la pantalla de
  vida ni el renglón `sin registrar` la primera vez. Ese renglón está diseñado para
  provocar una pregunta, no para responderla.
