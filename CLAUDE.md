# CLAUDE.md

Instrucciones para Claude Code trabajando en **Vesper**.

## Qué es Vesper

App móvil de foco y asignación de tiempo. Modos que bloquean apps, rutinas que los
encienden, sesiones con profundidad, hábitos, meta semanal, conciencia del tiempo de vida
y un círculo pequeño. Desde ADR-0016 la UI sigue de cerca a Brick (iOS). Desde ADR-0017
la app es real por dentro: SQLite, notificaciones, Salud, Live Activity y bloqueo detrás
de `src/platform/`; los datos de demostración se siembran una vez y se borran desde
Ajustes. El círculo le habla a su servidor desde ADR-0044, y desde ADR-0048 no hay login:
una identidad anónima y un respaldo cifrado devuelven todo en un teléfono nuevo. Sigue
siendo de demostración, solo en iOS, el uso por app de Actividad › Hoy (ADR-0029), y lo
dice en pantalla.

Lee `docs/STATUS.md` para saber qué existe, qué está verificado y dónde, antes de empezar.
Lee `docs/PRD.md` antes de tomar cualquier decisión de producto.
Lee `docs/ARCHITECTURE.md` antes de tocar datos, plataforma o navegación.
Lee `docs/DESIGN_SYSTEM.md` antes de escribir cualquier componente de UI.
Lee `docs/PROTOTYPE_GUIDE.md` antes de escribir cualquier pantalla.
Lee `docs/adr/README.md` antes de proponer cambios de arquitectura; ahí dice qué ADR
sigue vigente y cuál fue superado.

## Reglas duras (no negociables sin un ADR nuevo)

1. **Cuatro pestañas de solo texto**: Focus, Rutinas, Actividad, Ajustes. La sesión activa
   y sus salidas (`session/*`) son rutas a pantalla completa sin gesto de volver
   (ADR-0016, ADR-0009, ADR-0025).
2. **Un botón primario por pantalla**, pinneado abajo. Lo secundario es `ghost` o una fila.
3. **Ningún color ni tamaño literal fuera de `src/design/tokens.ts`.** Las pantallas no
   importan tokens ni tema: solo componentes de `src/design/components`.
4. **Máximo 5 hábitos** por usuario. Es una decisión de producto, no una limitación técnica.
5. **Dos esquemas, una paleta de roles.** Claro en la app, oscuro en la sesión; la pausa
   vuelve a claro. Nunca `#000` ni `#fff`.
6. **Sin animaciones de spring, escala o parallax.** Fade de 160 ms entre rutas, sin rebote
   de scroll. Lo único que se anima es opacidad (disoluciones, grilla, respiración).
7. **Local-first, sin login.** Todo funciona sin red y sin registro. Desde ADR-0048 cada
   persona tiene una identidad anónima —un id y un secreto, sin correo— que **nace en el
   primer arranque**, se registra cuando hay red y viaja sola al teléfono nuevo (llavero de
   iCloud, Block Store) o con la clave de respaldo. Salen del teléfono solo tres cosas: lo
   que el usuario comparte con su círculo, un **respaldo cifrado que el servidor no puede
   leer** (encendido por defecto, se apaga y se borra en Ajustes › Respaldo) y, de la
   identidad, cuándo nació, cuándo se vio, plataforma y versión. Nada viaja en claro. Si el
   usuario lo da, un **correo de recuperación** (ADR-0050) con una copia de su clave cifrada
   con una llave del servidor: es opcional y la pantalla dice su precio. Una identidad es un
   dispositivo activo a la vez. No agregues backend sin ADR.
8. **Cada permiso se pide en su flujo y donde no existe, la pantalla lo dice.** Nunca un
   permiso "concedido" con un flag: `status().reason` de `src/platform/` explica por qué
   no (ADR-0017). El onboarding puede pedirlos, pero nunca los exige (ADR-0026).
9. **Nunca sumar tiempo verificado y declarado en una misma métrica.** Ver ADR-0005.
10. **Nunca persistir datos de `DeviceActivityReport`.** Es técnicamente imposible y arquitectónicamente prohibido. Ver ADR-0004.
11. **El círculo no rankea y no tiene feed.** Hasta 12 personas por invitación, comparación
    sin posiciones, ánimo y empujón una vez al día, y cada métrica se comparte solo si el
    usuario lo elige. Un reto ocupa un hábito (regla 4). Notifica solo lo que otra persona
    hizo, con interruptor, y **nunca durante una sesión** (ADR-0021, enmendado por ADR-0027).
12. **Nada que muestre el sistema con la app cerrada depende de un temporizador de JS.**
    Relojes nativos en la Live Activity y en la notificación de Android. Ver ADR-0023.

## Stack

Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6 con `strict: true`.

**Expo cambia rápido. Lee https://docs.expo.dev/versions/v57.0.0/ antes de escribir código
que toque un módulo de Expo.** No confíes en la memoria para APIs de SDK.

- Expo SDK con dev client (no Expo Go — ver ADR-0001)
- TypeScript estricto, sin `any`
- expo-router para navegación (`Stack` con guardas: onboarding o app)
- op-sqlite para persistencia; migraciones `001`–`009` en `src/db/migrations/`
- Zustand para las cachés de la base (`src/data/stores/`) y el estado efímero
- Ids: UUID v7 propio en `src/lib/uuid.ts` sobre `expo-crypto`. No agregues la librería `uuid`
- Fuente Outfit (`@expo-google-fonts/outfit`) e iconos Feather (`@expo/vector-icons`)
- `src/app/`: rutas de expo-router. `src/features/<área>/`: piezas compartidas por varias
  pantallas de un área. `src/dev/`: `DevJump` y las banderas de `route.ts`, solo en dev
- `src/data/`: stores zustand que cachean SQLite. Hidratan al arrancar y escriben a través
  de `src/db/repositories/`. La UI solo habla con los hooks de `src/data/index.ts`
- `src/db/`: SQLite con migraciones; `queries/` deriva modelos de lectura (estadísticas por
  día salen de `sessions`, no se guardan)
- `src/domain/`: puro. Sesión, rutinas, bloqueo, ritual de salida, círculo, arte de foco
- `src/platform/`: una capa por capacidad nativa (notificaciones, Salud, Live Activity,
  bloqueo, orientación, identidad, respaldo, círculo). Cada módulo expone `status()` y degrada sin romper; se
  suscribe a los stores desde `src/platform/hooks/`, montados en `PlatformEffects`. Ver ADR-0017
- `src/widgets/FocusActivity.tsx`: la Live Activity (expo-widgets). `modules/vesper-blocking/`:
  módulo Expo local en Kotlin para el bloqueo en Android; `modules/vesper-health/`, el de
  Health Connect; `modules/vesper-identity/`, el secreto de la identidad en el llavero de
  iCloud (Swift) y en Block Store (Kotlin) (ADR-0048). `plugins/withAndroidBackup.js`: qué
  entra al backup de Android. `targets/`: las tres extensiones
  de Screen Time en iOS. `patches/`: parche de `react-native-health`
- vitest sobre `src/**/*.test.ts`: dominio, lib, db (con handle falso), data, i18n y las
  funciones puras de features y platform. Sin tests de UI: las pantallas se verifican
  corriendo la app
- Salud: `react-native-health` en iOS; en Android, Health Connect a través del módulo
  local `modules/vesper-health/` (ADR-0043). `platform/health.ios.ts` y
  `health.android.ts` exponen la misma superficie

## Convenciones de código

- Componentes funcionales con hooks. Sin clases.
- Un componente por archivo. Nombre del archivo = nombre del componente.
- Estilos con `StyleSheet.create` solo en `src/design/components/`, colores vía `useTheme()`. **Nunca colores literales en componentes.**
- Toda escritura a la base de datos pasa por `src/db/repositories/`. Los componentes no ejecutan SQL.
- Toda lectura compuesta para una pantalla vive en `src/db/queries/`. Las queries nunca escriben.
- Los tipos de dominio viven en `src/domain/types.ts` y son la fuente de verdad.
- Toda palabra que ve el usuario vive en `src/i18n/es/` y `src/i18n/en/`, un archivo por
  área, y llega a la UI por `useStrings()` (o `getStrings()` fuera de React). El dominio
  habla en identificadores y recibe el diccionario por parámetro; nunca importa el store.
- Fechas siempre en epoch ms (`number`), nunca strings. Conversión a local solo en la capa de UI.
  La única excepción es `habit_marks.day_key` (y las `week_key`/`day_key` del círculo), y
  está justificada en `docs/DATA_MODEL.md`.
- **Código en inglés, UI en español e inglés.** Identificadores, comentarios, nombres de
  archivo y mensajes de commit en inglés. Ningún string visible se escribe en una pantalla:
  cada uno se escribe dos veces, en `src/i18n/es/<área>.ts` y `src/i18n/en/<área>.ts`, o
  `tsc` falla. La app sigue el idioma del teléfono y Ajustes › Idioma lo fuerza (ADR-0020).
  Fechas y números con `Intl` y la etiqueta de `useLocale().tag`, nunca `'es-CO'` literal.
- **Los tokens solo se importan en `src/design/`.** Las pantallas de `src/app/` y las
  piezas de `src/features/` no conocen `space` ni `colors`: todo el layout vive en
  componentes de `design/components/`. Si una pantalla necesita un token, falta un componente.
- Piezas compartidas por varias pantallas de un área van en `src/features/<área>/`, nunca
  dentro de `src/app/` (expo-router convierte cada archivo en ruta).
- **Copy en español neutro, de tú, en oración**: "Toca para enfocar", "Elige un modo", "Puedes
  cambiarlo". Nunca voseo (tocá, podés, vos), nunca usted, nunca regionalismos. Sin
  mayúsculas completas. Tildes correctas. Números con coma decimal ("77,6").
- **El inglés tiene la misma voz**: segunda persona directa, oraciones cortas, sentence case,
  sin signos de exclamación ni tono de marketing ("Tap to focus", "Pick a mode"). Nunca
  "Let's", nunca emoji. Punto decimal ("77.6").
- Commits convencionales: `feat:`, `fix:`, `chore:`, `docs:`.

## Cómo trabajar

- Antes de implementar una pantalla, verifica que exista en el PRD o en el mapa de
  `docs/PROTOTYPE_GUIDE.md`. Si no existe, pregunta.
- Antes de agregar una dependencia, justifícala. El bundle importa.
- Cuando una decisión tenga más de una opción razonable, escribe un ADR en `docs/adr/` con el siguiente número disponible y pregunta antes de implementar.
- Para revisar una pantalla sin teclear, usa las banderas de `src/dev/route.ts`
  (`DEV_START_ROUTE`, `DEV_SESSION`, …) y déjalas en `null`/`false` antes de commitear.
  Un solo agente por simulador o emulador a la vez.
- Corre `npx tsc --noEmit`, `npm run lint` y `npx vitest run` antes de dar por terminada cualquier
  tarea. El linter (`eslint.config.js`) codifica las capas: el dominio no importa React ni la
  base; las pantallas no importan tokens ni SQL; nada suma `n * DAY` a un instante (usa
  `domain/day.ts`).
- Al cerrar una tanda, actualiza `docs/STATUS.md`: qué se verificó y dónde.

## Qué NO hacer

- No agregues librerías de UI, de gráficos ni de QR. Los componentes (los que exporta
  `src/design/components/index.ts`, hoy 59 más el hook `useTooltip`) se escriben a mano; las barras, grillas y el QR se
  dibujan con `View` y `react-native-svg`.
- No agregues badges, medallas, puntos ni ranking. La única racha es la diaria del
  ADR-0027 (10 minutos de foco, tres días de gracia al mes), un número sin fuego ni
  animación; la meta semanal sigue siendo la métrica. En el círculo tampoco hay contador
  de ánimos ni de empujones.
- Fuera de una sesión, máximo dos avisos al día además de los de sesión y rutina, y nada
  entre 22:00 y 8:00. Durante una sesión o una pausa solo existen fin de sesión y fin de
  pausa (ADR-0027).
- No simules una capacidad con un flag. El bloqueo, Salud, las notificaciones y la Live
  Activity son reales detrás de `src/platform/`; lo que no está disponible lo dice
  `status().reason` y la pantalla lo muestra. No presentes como verificado lo que
  `docs/STATUS.md` marca como sin verificar.
- No uses `AccessibilityService` en Android bajo ninguna circunstancia. Ver `docs/PLATFORM_ANDROID.md`.
- No intentes resolver los tokens opacos de iOS a nombres de apps por OCR ni ningún otro medio. Es motivo de rechazo en App Store.
- No edites una migración publicada ni el cuerpo de un ADR aceptado: agrega la siguiente.
