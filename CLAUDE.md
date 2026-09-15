# CLAUDE.md

Instrucciones para Claude Code trabajando en **Vesper**.

## Qué es Vesper

App móvil de foco y asignación de tiempo. Modos que bloquean apps, sesiones con
profundidad, hábitos, meta semanal y conciencia del tiempo de vida. Desde ADR-0016 la UI
sigue de cerca a Brick (iOS) y el repo contiene un **prototipo navegable de todas las
fases con datos falsos** sobre una capa de datos en memoria (`src/data/`).

Lee `docs/STATUS.md` para saber dónde quedó todo antes de empezar.
Lee `docs/PRD.md` antes de tomar cualquier decisión de producto.
Lee `docs/DESIGN_SYSTEM.md` antes de escribir cualquier componente de UI.
Lee `docs/PROTOTYPE_GUIDE.md` antes de escribir cualquier pantalla.
Lee `docs/adr/` antes de proponer cambios de arquitectura.

## Reglas duras (no negociables sin un ADR nuevo)

1. **Cuatro pestañas de solo texto**: Focus, Rutinas, Actividad, Ajustes. La sesión activa
   y su cierre son rutas a pantalla completa sin gesto de volver (ADR-0016, ADR-0009).
2. **Un botón primario por pantalla**, pinneado abajo. Lo secundario es `ghost` o una fila.
3. **Ningún color ni tamaño literal fuera de `src/design/tokens.ts`.** Las pantallas no
   importan tokens ni tema: solo componentes de `src/design/components`.
4. **Máximo 5 hábitos** por usuario. Es una decisión de producto, no una limitación técnica.
5. **Dos esquemas, una paleta de roles.** Claro en la app, oscuro en la sesión. Nunca `#000` ni `#fff`.
6. **Sin animaciones de spring, escala o parallax.** Fade de 160 ms entre rutas, sin rebote de scroll.
7. **Local-first.** La app funciona completa sin red y sin cuenta. No agregues backend sin ADR.
8. **Cada permiso se pide en su flujo y donde no existe, la pantalla lo dice.** Nunca un permiso "concedido" con un flag: `status().reason` de `src/platform/` explica por qué no (ADR-0012, ADR-0017).
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
- Fuente Outfit (`@expo-google-fonts/outfit`) e iconos Feather (`@expo/vector-icons`)
- `src/data/`: stores zustand que cachean SQLite. Hidratan al arrancar y escriben a través
  de `src/db/repositories/`. La UI solo habla con los hooks de `src/data/index.ts`
- `src/db/`: SQLite con migraciones; `queries/` deriva modelos de lectura (estadísticas por
  día salen de `sessions`, no se guardan)
- `src/platform/`: una capa por capacidad nativa (notificaciones, Salud, Live Activity,
  bloqueo). Cada módulo expone `status()` y degrada sin romper; se suscribe a los stores
  desde `src/platform/hooks/`, nunca al revés. Ver ADR-0017
- vitest para `src/domain/`, `src/lib/`, `src/db/` y `src/store/`
- react-native-health (iOS) / react-native-health-connect (Android) en fase 1.5

## Convenciones de código

- Componentes funcionales con hooks. Sin clases.
- Un componente por archivo. Nombre del archivo = nombre del componente.
- Estilos con `StyleSheet.create` solo en `src/design/components/`, colores vía `useTheme()`. **Nunca colores literales en componentes.**
- Toda escritura a la base de datos pasa por `src/db/repositories/`. Los componentes no ejecutan SQL.
- Toda lectura compuesta para una pantalla vive en `src/db/queries/`. Las queries nunca escriben.
- Los tipos de dominio viven en `src/domain/types.ts` y son la fuente de verdad.
- Las palabras en español que necesita el dominio viven en `src/lib/labels.ts`, `format.ts`
  y `tone.ts`. El dominio habla en identificadores.
- Fechas siempre en epoch ms (`number`), nunca strings. Conversión a local solo en la capa de UI.
  La única excepción es `habit_marks.day_key`, y está justificada en `docs/DATA_MODEL.md`.
- **Código en inglés, UI en español.** Identificadores, comentarios, nombres de archivo y
  mensajes de commit en inglés. Los strings que ve el usuario, en español y hardcodeados:
  no hay i18n en fase 1 (`docs/ARCHITECTURE.md`).
- **Los tokens solo se importan en `src/design/`.** Las pantallas de `src/app/` y las
  piezas de `src/features/` no conocen `space` ni `colors`: todo el layout vive en
  componentes de `design/components/`. Si una pantalla necesita un token, falta un componente.
- Piezas compartidas por varias pantallas de un área van en `src/features/<área>/`, nunca
  dentro de `src/app/` (expo-router convierte cada archivo en ruta).
- **Copy en español neutro, de tú, en oración**: "Toca para enfocar", "Elige un modo", "Puedes
  cambiarlo". Nunca voseo (tocá, podés, vos), nunca usted, nunca regionalismos. Sin
  mayúsculas completas. Tildes correctas. Números con coma decimal ("77,6").
- Commits convencionales: `feat:`, `fix:`, `chore:`, `docs:`.

## Cómo trabajar

- Antes de implementar una pantalla, verifica que exista en el PRD. Si no existe, pregunta.
- Antes de agregar una dependencia, justifícala. El bundle importa.
- Cuando una decisión tenga más de una opción razonable, escribe un ADR en `docs/adr/` con el siguiente número disponible y pregunta antes de implementar.
- Corre `npx tsc --noEmit` antes de dar por terminada cualquier tarea.

## Qué NO hacer

- No agregues librerías de UI ni de gráficos. Los componentes son 32 y se escriben a mano;
  las barras y grillas se dibujan con `View`.
- No agregues rachas diarias, badges, ni gamificación fuera de la meta semanal.
- No implementes bloqueo de apps real: lo que existe es su UI con datos falsos. Ver ADR-0003 y ADR-0016.
- No presentes como real lo que `src/platform/` reporta como no disponible. Los datos de
  demostración se siembran una vez y se borran desde Ajustes.
- No uses `AccessibilityService` en Android bajo ninguna circunstancia. Ver `docs/PLATFORM_ANDROID.md`.
- No intentes resolver los tokens opacos de iOS a nombres de apps por OCR ni ningún otro medio. Es motivo de rechazo en App Store.
