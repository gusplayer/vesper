# ADR-0002 — Local-first con SQLite, sin backend

**Estado:** aceptada · 2026-08

## Contexto

La tentación es Supabase o Convex desde el día 1 para no "tener que migrar después".
Pero en fase 1 no hay cuenta de usuario, no hay sync, no hay features sociales y no hay
nada que se comparta entre dispositivos.

## Decisión

Toda la persistencia en SQLite local vía op-sqlite. Sin backend, sin auth, sin red.

Los ids son UUID v7 desde el principio para que un sync futuro no requiera migración
de claves.

## Consecuencias

- La app funciona completa en avión y sin cuenta. Eso es coherente con el producto.
- Cero costo de infraestructura mientras se valida.
- Un cambio de dispositivo pierde los datos en fase 1. Aceptable en un prototipo;
  hay que resolverlo antes de cualquier lanzamiento público.
- Añadir backend después requiere un ADR nuevo y una capa de sync explícita.
- Los repositorios en `db/repositories/` aíslan el acceso, así que un sync futuro
  se inserta ahí sin tocar pantallas.
