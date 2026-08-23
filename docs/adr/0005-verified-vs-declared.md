# ADR-0005 — Tiempo verificado y declarado nunca se suman

**Estado:** aceptada · 2026-08

## Contexto

El producto mide dos cosas de naturaleza distinta:

- **Verificado** — gym, pasos, sueño. HealthKit o Health Connect lo confirman. El usuario
  no puede inflarlo.
- **Declarado** — lectura, familia, amigos, foco. Solo existe el timer y la palabra del
  usuario.

La tentación es un score único: "Life Score 78/100". Es la métrica más vendible y la más
corrupta: en dos semanas el usuario aprende que declarar es más barato que hacer, y el
número deja de significar nada.

## Decisión

Tres monedas separadas, con tratamiento visual distinto, nunca sumadas en una métrica
compuesta:

1. **Tiempo invertido** (declarado) — con tope de 6h/día. Se registra.
2. **Tiempo verificado** — sin tope. Se celebra.
3. **Tiempo consumido** (estimado) — siempre como piso.

Cada renglón del libro mayor lleva su procedencia: `verified` | `declared` | `estimated` | `unknown`.

## Consecuencias

- No hay un número único que resuma el día. El libro mayor es la vista principal.
- El tope de 6h declarables se aplica en `domain/ledger.ts`. Un timer de 8h "leyendo"
  no rompe la distribución.
- Cuando el sistema detecta inconsistencia — sesión de lectura declarada con eventos de
  uso en la misma ventana — **no bloquea el registro ni acusa**. Solo anota:
  *"durante esta sesión hubo 4 desbloqueos"*. Espejo, no juez.
- El hábito con `count_mode = 'verified'` se ofrece por defecto cuando el nombre es
  mapeable a un tipo de salud. Es el momento correcto para pedir el permiso, no el
  onboarding.
