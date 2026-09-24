# ADR-0043 — Salud en Android es Health Connect, leído por un módulo Kotlin propio

**Estado:** aceptada · 2026-09-24 (el dueño del producto eligió el módulo propio y pidió
implementarlo)

## Contexto

`src/platform/health.ts` solo existe en iOS: en Android `status()` dice "Salud solo existe
en iPhone" y un hábito verificado cae a declarado (ADR-0041). Eso deja a medio círculo sin
hábitos verificados y sin retos de pasos que se marquen solos (ADR-0042).

El dato ya está en el teléfono. Android no guarda un historial de pasos por sí mismo, pero
**Health Connect** sí: viene en el sistema desde Android 14 y se instala desde Play en
Android 9 a 13. Samsung Health, Fit, Fitbit, Garmin y los relojes escriben ahí, y en los
teléfonos recientes el propio Health Connect cuenta pasos. Google Fit deja de estar
soportado a fines de 2026 (`docs/PLATFORM_ANDROID.md`).

Medir los pasos nosotros quedó descartado antes de este ADR: un servicio en primer plano
leyendo el sensor todo el día gasta batería, exige una notificación fija que choca con el
presupuesto de avisos (ADR-0027), no ve el reloj ni el pasado, y da una cifra distinta de
la que el usuario ve en su app de salud.

## Decisión

### 1. Un módulo Expo local, `modules/vesper-health/`

Kotlin, solo Android, con la misma forma que `vesper-blocking` (ADR-0019). Su única
dependencia es la oficial de Google, `androidx.health.connect:connect-client:1.1.0` (la
última estable). No se usa `react-native-health-connect`: el trabajo es chico —estado,
permisos, tres lecturas de una semana— y una librería de terceros agrega una API más
ancha que la que usamos y un calendario de mantenimiento que no controlamos.

El módulo expone cinco cosas y nada más:

- `sdkStatus()`: `available`, `updateRequired` (Health Connect falta o está viejo; Play lo
  resuelve) o `unsupported` (Android 8 o menos, o un teléfono sin Health Connect).
- `requestPermissions()`: abre la hoja de Health Connect para leer pasos, entrenamientos y
  sueño. Devuelve lo concedido. Si ya estaba todo concedido, no abre nada. En Android 14+
  los permisos de Health Connect son permisos de runtime y se piden como tales
  (`appContext.permissions`): el contrato de la librería devuelve ahí el intent genérico
  `REQUEST_PERMISSIONS`, que ninguna actividad resuelve. En Android 9 a 13 se abre la
  actividad de la app Health Connect y su respuesta llega por `OnActivityResult`.
- `readWeek(from, sleepFrom, to)`: pasos por día con `aggregateGroupByPeriod` (Health
  Connect deduplica entre fuentes, así el reloj y el teléfono no suman dos veces), las
  sesiones de ejercicio y las sesiones de sueño con sus etapas. Cada lectura falla por su
  cuenta: un permiso negado deja su parte vacía, no la semana.
- `openInstallPage()` y `openHealthConnect()`: Play Store en la ficha de Health Connect, y
  la pantalla de Health Connect donde el usuario conecta sus fuentes.

Nunca se escribe en Health Connect y nada de lo leído se guarda fuera de las marcas de
hábito que ya existen, igual que en iOS.

### 2. Una sola superficie en JS: `platform/health.ios.ts` y `platform/health.android.ts`

`health.ts` se parte en dos archivos con la misma superficie, como `blocking`. Las
pantallas siguen importando `platform/health` y no saben cuál contestó. La traducción de lo
que da Kotlin a `HealthWeek` es pura y vive en `platform/healthConnectReading.ts`, con
tests.

El sueño se traduce por sesión, no por etapa: una sesión con etapas cuenta solo el tiempo
en etapas de sueño (dormido, ligero, profundo, REM) y cierra a la hora en que terminó la
sesión. Así una noche de 23:00 a 7:00 cae entera en la mañana en que te despiertas, que es
lo que `domain/healthMarks.ts` espera. Una sesión sin etapas cuenta entera.

### 3. Lo que no está, la pantalla lo dice (regla 8)

- Android 8 o menos, o sin Health Connect: `status()` dice por qué y el botón no se
  toca, como hoy.
- Health Connect falta o está viejo (Android 9 a 13): el botón de Ajustes › Salud dice
  "Instalar Health Connect" y abre Play. Al volver, la pantalla vuelve a preguntar.
- Conectado: Ajustes › Salud dice que los datos vienen de Health Connect y ofrece "Abrir
  Health Connect", porque un Health Connect vacío es lo más probable en un usuario nuevo
  (sus datos viejos de Fit no se pasan solos).

### 4. Lo que exige Android

- Los tres permisos de lectura en el manifest del módulo, el `<queries>` del paquete de
  Health Connect y la actividad que muestra por qué pedimos los permisos, con los dos
  filtros que Health Connect busca (Android 13 o menos, y 14 o más). Es un diálogo del
  sistema en su propia tarea, con el texto en recursos de Android en los dos idiomas: puede
  abrirse con la app cerrada, sin JS. No lleva a Ajustes › Salud porque traer
  `MainActivity` (que es `singleTask`) al frente cerraba la hoja de permisos de encima.
- **`minSdkVersion` sube de 24 a 26**, porque `connect-client` lo exige. Android 7 queda
  fuera; ya no podía usar Health Connect, que empieza en Android 9. Se fija con
  `expo-build-properties`.
- La declaración de Health Connect en Play Console (`docs/PLAY_DECLARATIONS.md`): qué tipos
  se leen y para qué. Suma una semana de revisión.

## Alternativas consideradas

- **`react-native-health-connect` con su plugin de Expo.** Menos Kotlin propio, pero una
  dependencia de terceros entera para cinco funciones. Ya mantenemos un módulo Kotlin.
- **Medir con el sensor de pasos del teléfono.** Ver el contexto.
- **Google Fit.** Deja de estar soportado en 2026.
- **Mantener `minSdk` 24 con `tools:overrideLibrary`.** Evita subir el piso, a cambio de
  cuidar que ninguna clase de Health Connect se cargue en Android 7. No vale la
  fragilidad por teléfonos que tampoco tendrían Health Connect.

## Consecuencias

- Un hábito verificado funciona en Android: gym, pasos y sueño se marcan solos, y ADR-0041
  deja de hacerlo caer a declarado donde Health Connect existe.
- ADR-0042 no cambia: en cuanto `status()` dice `available`, unirse a un reto de pasos pide
  el permiso en Android igual que en iOS.
- El texto "Salud solo existe en iPhone" desaparece; las razones nuevas dicen qué falta.
- El diálogo de justificación es la única pantalla cuyas palabras no viven en `src/i18n`:
  viven en `modules/vesper-health/android/src/main/res/values{,-es}/strings.xml`.
- Sin tests de UI: el módulo se verifica en el emulador (hoja de permisos, justificación,
  lectura vacía). Con datos reales y el caso de Play (Android 9 a 13), en un teléfono.
