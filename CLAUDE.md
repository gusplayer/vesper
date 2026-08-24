# CLAUDE.md

Instrucciones para Claude Code trabajando en **Vesper**.

## Qué es Vesper

App móvil de foco y asignación de tiempo con estética de tinta electrónica.
Pomodoro + hábitos + conciencia del tiempo de vida. Bloqueo de apps llega en fase 2.

Lee `docs/PRD.md` antes de tomar cualquier decisión de producto.
Lee `docs/DESIGN_SYSTEM.md` antes de escribir cualquier componente de UI.
Lee `docs/adr/` antes de proponer cambios de arquitectura.

## Reglas duras (no negociables sin un ADR nuevo)

1. **Sin pantalla de ajustes.** Toda configuración vive en el flujo donde se usa.
2. **Máximo 3 pantallas** en la navegación principal: inicio, sesión, vida. Swipe horizontal, sin tab bar.
3. **Un control primario por pantalla.** Todo lo demás es texto tocable.
4. **Máximo 5 hábitos** por usuario. Es una decisión de producto, no una limitación técnica.
5. **Cuatro colores en toda la app.** Ver `docs/DESIGN_SYSTEM.md`. Nunca `#000` ni `#fff`.
6. **Sin animaciones de spring, escala o parallax.** Transiciones instantáneas o fade de 120ms máximo.
7. **Local-first.** La app funciona completa sin red y sin cuenta. No agregues backend sin ADR.
8. **Cero permisos requeridos para la primera sesión.** En fase 1 no hay onboarding: hay una línea que desaparece al completar la primera sesión. Ver ADR-0012.
9. **Nunca sumar tiempo verificado y declarado en una misma métrica.** Ver ADR-0005.
10. **Nunca persistir datos de `DeviceActivityReport`.** Es técnicamente imposible y arquitectónicamente prohibido. Ver ADR-0004.

## Stack

Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6 con `strict: true`.

**Expo cambia rápido. Lee https://docs.expo.dev/versions/v57.0.0/ antes de escribir código
que toque un módulo de Expo.** No confíes en la memoria para APIs de SDK.

- Expo SDK con dev client (no Expo Go — ver ADR-0001)
- TypeScript estricto, sin `any`
- expo-router para navegación
- op-sqlite para persistencia
- Zustand para estado de UI efímero
- Ids: UUID v7 propio en `src/lib/uuid.ts` sobre `expo-crypto`. No agregues la librería `uuid`
- vitest para los tests de `src/domain/`
- react-native-health (iOS) / react-native-health-connect (Android) en fase 1.5

## Convenciones de código

- Componentes funcionales con hooks. Sin clases.
- Un componente por archivo. Nombre del archivo = nombre del componente.
- Estilos con `StyleSheet.create`, tokens importados de `src/design/tokens.ts`. **Nunca colores literales en componentes.**
- Toda escritura a la base de datos pasa por `src/db/repositories/`. Los componentes no ejecutan SQL.
- Los tipos de dominio viven en `src/domain/types.ts` y son la fuente de verdad.
- Fechas siempre en epoch ms (`number`), nunca strings. Conversión a local solo en la capa de UI.
  La única excepción es `habit_marks.day_key`, y está justificada en `docs/DATA_MODEL.md`.
- **Código en inglés, UI en español.** Identificadores, comentarios, nombres de archivo y
  mensajes de commit en inglés. Los strings que ve el usuario, en español y hardcodeados:
  no hay i18n en fase 1 (`docs/ARCHITECTURE.md`).
- **Los tokens solo se importan en `src/design/`.** Las pantallas de `src/app/` y
  `src/screens/` no conocen
  `space` ni `color`: todo el layout vive en componentes de `design/components/`. Si una
  pantalla necesita un token, falta un componente.
- Commits convencionales: `feat:`, `fix:`, `chore:`, `docs:`.

## Cómo trabajar

- Antes de implementar una pantalla, verifica que exista en el PRD. Si no existe, pregunta.
- Antes de agregar una dependencia, justifícala. El bundle importa.
- Cuando una decisión tenga más de una opción razonable, escribe un ADR en `docs/adr/` con el siguiente número disponible y pregunta antes de implementar.
- Corre `npx tsc --noEmit` antes de dar por terminada cualquier tarea.

## Qué NO hacer

- No agregues librerías de UI (NativeBase, Tamagui, gluestack). Los componentes son ~15 y se escriben a mano.
- No agregues gráficos, charts ni visualizaciones. Ver ADR-0006.
- No agregues rachas diarias, badges, ni gamificación fuera de la meta semanal.
- No implementes bloqueo de apps hasta que la fase 1 esté cerrada. Ver ADR-0003.
- No uses `AccessibilityService` en Android bajo ninguna circunstancia. Ver `docs/PLATFORM_ANDROID.md`.
- No intentes resolver los tokens opacos de iOS a nombres de apps por OCR ni ningún otro medio. Es motivo de rechazo en App Store.
