# ADR-0001 — Expo con dev client, no Expo Go

**Estado:** aceptada · 2026-08

## Contexto

La fase 2 requiere módulos nativos obligatorios: `FamilyControls`, `ManagedSettings` y
tres extensiones en iOS; foreground service y overlay en Android. Nada de eso corre en
Expo Go.

La alternativa era React Native puro con CLI, evitando Expo del todo.

## Decisión

Expo SDK con **development build**, config plugins para la configuración nativa,
y prebuild continuo.

## Consecuencias

- Expo Go queda descartado desde el día 1. No se documenta como opción en ningún lado.
- Se necesita EAS Build o Xcode/Android Studio local para cada cambio nativo.
- Las extensiones de iOS necesitan un config plugin propio que las agregue al proyecto
  generado por prebuild.
- Sin el Family Controls entitlement no se puede construir ni siquiera el dev client,
  así que la solicitud se manda el día 1 (ver `docs/ROADMAP.md`, fase 0).
- A cambio: expo-router, expo-font, expo-notifications y el ecosistema de módulos
  ahorran semanas frente a RN puro.

## Nota (2026-09)

El dev client se construye sin el entitlement mientras no existan las extensiones: el
bloqueo sigue en `docs/ROADMAP.md`, fase 2. La solicitud sigue siendo el paso 1 de la fase 0.
