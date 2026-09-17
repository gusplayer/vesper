# Estado — 2026-09-15

Dónde quedamos, qué está probado y qué falta. Se actualiza al cerrar cada tanda de
trabajo. Para el plan por fases, `ROADMAP.md`; para las tareas, `SPRINT_01.md`.

## Resumen en una línea

**Fase 1 cerrada en código, y refactorizada.** Corre en simulador de iOS y en emulador de
Android. Lo que falta para cerrar la fase no es código: es el papeleo de Apple, un
dispositivo físico y siete días de uso.

## Qué existe

Desde ADR-0017 el prototipo tiene capacidades reales detrás de `src/platform/`:

| Capacidad | Estado | Dónde se probó |
|---|---|---|
| Persistencia | Real. SQLite con migración 002; sesiones, modos, horarios, hábitos, marcas y ajustes sobreviven al relanzar. Datos de demo sembrados una vez, "Borrar todo y reiniciar" en Ajustes | Simulador: 120 sesiones demo, sesión corriendo hidratada tras relanzar |
| Notificaciones locales | Real con `expo-notifications`: fin de sesión, inicio de horarios, cierre semanal; plan determinista con tests y sincronización por identificador | Simulador consulta pendientes; no se concedió permiso, así que no se vio una notificación |
| Salud | Real con `react-native-health`: entrenamientos, pasos y sueño se leen y marcan hábitos verificados con función pura testeada | Solo compila. Sin datos de Salud en el simulador |
| Live Activity | Real con `expo-widgets`: banner, Dynamic Island y cuenta regresiva nativa | El proceso del widget ejecutó en el simulador; no se vio la pantalla bloqueada |
| Bloqueo de apps | Integrado con `react-native-device-activity`: selector nativo, token por modo, shield al iniciar sesión y liberación al terminar. **No funciona en simulador ni sin el entitlement de Apple** | Solo compila. Las tres extensiones se generan en `targets/` |

Tests: 588 en 46 archivos. `tsc` limpio. Compilación iOS con cuatro targets verificada.

## Qué NO está verificado

- **Nada en un teléfono.** Todo lo anterior se probó en el simulador iPhone 17 Pro, sin
  tocar la pantalla. Notificaciones, Salud y Live Activity necesitan el dispositivo con
  permisos concedidos.
- **Bloqueo**: imposible aquí. Requiere el entitlement de Family Controls aprobado por
  Apple, cuatro veces (app y tres extensiones). Ver `docs/PLATFORM_IOS.md`.
- Android: no se compiló desde el pivote. Bloqueo y Live Activity son solo iOS.
- Las reglas "modo estricto", "bloquear instalaciones" y "bloquear compras" son UI: la
  librería no expone esas claves de ManagedSettings. Solo el filtro de contenido adulto
  llega al sistema.

## Cómo probar en tu iPhone

1. Pedí a Apple el entitlement de Family Controls (Distribution) para
   `com.gusplayer.vesper` y sus tres extensiones `.ActivityMonitor`, `.ShieldAction`,
   `.ShieldConfiguration`. Tarda semanas; todo lo demás no lo necesita.
2. Conectá el iPhone y corré `npx expo run:ios --device` eligiendo tu teléfono. Firma con
   el team `2D3R79CT8F` (`app.json`). Con cuenta gratuita, la firma dura siete días.
3. En el teléfono: onboarding → permitir notificaciones y Salud → crear un modo → iniciar
   sesión. Deberías ver la Live Activity en la pantalla bloqueada y la notificación al
   terminar.
4. `Ajustes › Borrar todo y reiniciar` deja la base como recién instalada.

## Sesión: reloj y modo horizontal (2026-09-15)

- El timer es un reloj split-flap (`FlipClock`): cada dígito cae en dos mitades con
  aceleración natural, 340 ms, sin rebote. Verificado con capturas a mitad del giro.
- Girar el teléfono durante la sesión muestra solo el reloj grande, el modo y la barra.
  El resto de la app queda en vertical (`expo-screen-orientation`, `src/platform/orientation.ts`).
  Verificado rotando el simulador por script.

## Arte de foco (2026-09-15)

Cinco obras puntillistas que se dibujan punto a punto durante la sesión (ADR-0018):
pagoda, Torre Eiffel, Estatua de la Libertad, rostro y perro. Cada una se revisó a ojo
con el visor a 25, 50, 75 y 100 %. Verificado en simulador: la vista abre con `?art=1` y
el dibujo avanza con el reloj. No verificado: el rendimiento del trazado con 6.000 puntos
en una sesión de 90 minutos en un teléfono real.

## Rutinas y Android (2026-09-16)

- **Motor de rutinas** (ADR-0019): una rutina en ventana arranca su sesión; si hay una
  corriendo, espera; nunca arranca dos veces la misma ventana. Verificado en simulador:
  a las 16:16 de un miércoles la rutina "Trabajo" arrancó sola con "Trabajo profundo".
- **Rutinas sin hora** ("Cuando quieras · 20 min") con botón de arranque. Migración 003.
- **Focus** muestra la próxima rutina, elige el modo desde una hoja, y la píldora lleva
  la meta semanal.
- **Android compila y corre** en el emulador Pixel 6 (API 34). La capa de plataforma
  degrada con razones en español.
- **Bloqueo en Android, fase 1** (`modules/vesper-blocking/`): selector de apps por
  intent de lanzador, servicio `specialUse` que lee eventos de uso, escudo superpuesto
  con actividad de respaldo. Probado por adb en el emulador: el escudo cubrió Ajustes y
  Reloj, y bajó con "Volver".
- **Bloqueo en Android, fase 2**: cada rutina con hora son dos alarmas (`AlarmManager`,
  exactas si el usuario lo permite, con diez minutos de margen si no) que suben y bajan
  el escudo con la app cerrada; `BootReceiver` las rearma tras reiniciar; el plan lleva
  `endsAt` y el servicio se apaga solo al minuto aunque JS haya muerto; `START_STICKY`
  lo revive si lo matan. Verificado en el emulador: ventana abierta con el proceso
  muerto, escudo sobre Reloj, cierre al minuto; alarmas de vuelta tras `adb reboot`;
  servicio revivido tras `kill -9`. `docs/PLATFORM_ANDROID.md`, fase 2.
- **Bloqueo en Android, fase 3**: `docs/PLAY_DECLARATIONS.md` (servicio `specialUse`,
  permisos sensibles, seguridad de datos, notas al revisor), `docs/STORE_LISTING.md` y
  el video `docs/media/vesper-android-demo.mp4` (67 s, flujo completo por la UI real).
- **Ventanas de rutina en iOS**: cada rutina con hora es un `DeviceActivity` por día de
  la semana (uno diario si corre todos los días) con la selección y el texto del escudo
  del modo; `useRoutineWindowsSync` las reconcilia desde el store. Límites: unas 20
  actividades, ventanas de 15 minutos mínimo. Sin verificar: falta el entitlement de
  Family Controls (lo pide el dueño de la cuenta) y un iPhone real.
- No verificado en teléfonos reales de ningún fabricante.

## Cómo revisar una pantalla sin tocar

En `src/dev/route.ts` poné `DEV_START_ROUTE = '/modes'` (y `DEV_SESSION = 'running'` para
la sesión) y relanzá la app. Volvé a dejarlo en `null` antes de commitear.

## Idioma: español e inglés (2026-09-15)

La app habla el idioma del teléfono y Ajustes › Idioma lo fuerza (ADR-0020). Todo texto
visible vive en `src/i18n/es/` y `src/i18n/en/`, un archivo por área; `Strings = typeof es`
y `en` lo implementa, así que una clave que falte en inglés no compila. `expo-localization`
es la única fuente del idioma del teléfono y solo se importa en `src/i18n/device.ts`.

- Verificado: `tsc` limpio y 517 tests en 43 archivos, con aserciones en `es` y `en` para
  cada función que produce texto (formato, recordatorios, libro mayor, expectativa de vida,
  ritual de salida, datos de demostración, estado de rutinas).
- **No verificado en simulador.** `expo-localization` es un módulo nativo: hay que regenerar
  `ios/` y recompilar el dev client (`npx expo prebuild --platform ios --clean && npx expo
  run:ios`) antes de ver la página de idioma y el cambio en caliente.
- Los datos de demostración y las actividades por defecto se siembran en el idioma del
  teléfono en la primera apertura y no cambian después: son datos del usuario.
- Las notificaciones se replanifican al cambiar el idioma (`useNotificationSync`), el
  shield de bloqueo, el selector de apps y la Live Activity leen el diccionario. Fuera de
  `src/i18n` solo queda texto en `FatalError`, a propósito: se muestra antes de que exista
  cualquier store.
- El reloj de horarios sigue en formato de 24 horas en los dos idiomas.

## Botón de Focus: sin línea debajo, disolución y tinta (2026-09-17)

- Bajo el botón ya no hay texto: la profundidad se cambia en el modo, y el botón de un
  modo profundo dice "Mantén para enfocarme 25 min". `home.deepHint` se fue del
  diccionario.
- Mantener llena la pastilla de puntos de papel desde los extremos hacia el centro; al
  cerrarse, `InkFlood` inunda la página de tinta punteada desde el botón y la sesión
  aparece debajo. Tocar (suave o firme) pasa por la misma inundación. Sin dependencias:
  `src/lib/dissolve.ts` reparte los puntos en capas y cada capa anima solo su opacidad.
- Verificado en un segundo simulador (iPhone 17) manteniendo con `idb` y capturando a
  mitad del gesto: puntos cerrándose, pastilla llena, página en tinta, sesión debajo. El
  toque también se capturó en plena inundación. No verificado: el ritmo a ojo en un
  teléfono real y "Reducir movimiento".
- Convive con el ADR-0022 de otra sesión en el mismo árbol; se commitea junto.

## Círculo (2026-09-15)

Comunidad pequeña y silenciosa (ADR-0021): hasta 12 personas por invitación, comparación
semanal sin posiciones, ánimo una vez al día, retos como hábitos con testigos, y tres
interruptores de qué se comparte. Sin backend: migración 004 con cinco tablas, perfil y
preferencias en `settings`, `src/platform/circle.ts` reporta `available: false` y las
pantallas lo dicen. Datos de demostración: Ana, Luis, Sofía, Mateo (invitación pendiente),
dos semanas de números, un reto "Leer", dos ánimos.

- Verificado en el simulador iPhone 17 Pro tocando con `idb`: `circle/` con la semana
  ordenada por foco y redes en su propia línea marcada como estimado; dar ánimo cambia a
  "Enviado"; el reto muestra mis marcas del hábito y las de los demás; "Marcar hoy"
  escribe en el hábito; crear un reto desde el hábito "gym" con Ana lo vincula sin crear
  otro; aceptar la invitación de Mateo lo pasa al círculo (4 de 12); Ajustes › Círculo
  con perfil y los tres interruptores; la sección "Tu círculo" al final de Actividad ›
  Semanal; todo en inglés y en español cambiando el idioma en caliente.
- **Invitación por link y QR (2026-09-16)**: el código es una solicitud (quien lo usa
  queda pendiente hasta que aceptas), "Generar código nuevo" invalida el anterior, la
  hoja de compartir lleva código y link `vesper://circle/join?code=…`, y la tarjeta
  muestra un QR con ese link generado por `src/lib/qr.ts` (sin librería). Verificado:
  la salida del codificador decodificada con Vision de macOS en las versiones 1 a 5;
  en el simulador, el QR leído por Vision desde la propia captura de pantalla, antes y
  después de "Generar código nuevo"; el deep link abierto con `simctl openurl` cae en
  `circle/join`; la hoja de compartir con el mensaje. No verificado: que la cámara de un
  iPhone real abra el link (necesita el dev client instalado en ese teléfono).
- No verificado: "Salir del círculo",
  "Quitar" a alguien, el tope de 12 y de 5 hábitos desde la UI (los cubren los tests), la
  línea de ánimo en el cierre de sesión.
- `tsc` limpio, 588 tests en 46 archivos (71 nuevos).
- Para revisar las pantallas sin teclear: `DEV_CIRCLE_PROFILE = true` en `src/dev/route.ts`
  crea un perfil al arrancar. Volver a `false` antes de commitear.

## Focus y la sesión como ruta sin salida (2026-09-16)

- **Focus** dice solo hoy ("2h 15m enfocado hoy"); la semana y su meta viven en Actividad.
  Antes la píldora mezclaba dos reglas (hoy contaba la sesión en curso, la semana no) y
  podía decir "7h 59m hoy · 2h 45m esta semana". Se quitó "Ver actividad ›": la pestaña,
  la píldora y la grilla ya llevan ahí.
- Con sesión corriendo, Focus lo dice encima del botón: "En sesión · 12m de 25m".
- **`SessionGate`** (`src/features/session/`) hace que la sesión sea de verdad una ruta
  sin salida: al relanzar la app con una sesión viva abre directo en `/session/active`,
  y cuando una rutina arranca una sesión sola también. Además cierra la sesión como
  completada en el momento exacto en que vence, esté o no montada su pantalla (antes
  solo `active.tsx` lo hacía, y una sesión vencida fuera de esa pantalla quedaba viva
  hasta el siguiente relanzamiento).
- El botón atrás de Android no saca de la sesión ni del cierre (`useBlockBack`).
- Verificado en simulador: relanzar en frío con una sesión de 25 min a los 11 min abrió
  en la sesión. Deuda: al recargar el JS con la app abierta, op-sqlite se cae al
  destruir su caché de nombres (`ResultPropNames`, SIGSEGV); relanzar en frío no.

## Botón de Focus, sesiones sin límite y pausas (2026-09-16, ADR-0022)

- Focus: fila "25 min ⌄" encima del botón y el botón "Enfocarme 25 min" arranca con un
  toque. Solo un modo profundo pide mantener. La hoja de duración suma "Sin límite".
- Sesión sin límite: tope de 12 h, nunca profunda (corre como firme), sin barra ni aviso
  de fin; al tope cierra como `expired` y el cierre lo dice.
- Pausas: cada 25 min de foco, hasta 15 min, en suave y firme. Levantan el bloqueo, la
  app pasa a claro, el reloj se detiene y la Live Activity cuenta la pausa. `SessionGate`
  la termina sola; aviso "Se acabó la pausa" si la app está en segundo plano.
- Migración 005 (cuatro columnas en `sessions`), `settle` en el dominio para lo que pasó
  con la app dormida. 617 tests.
- Verificado en simulador (2026-09-17): "Sin límite" desde la hoja, botón "Enfocarme sin
  límite", sesión abierta con modo profundo corriendo como firme ("Terminar" activo,
  "Pausa en 24m"); relanzar en frío a los 26 min rehidrata la sesión con la pausa
  habilitada; la pausa pasa a claro con cuenta regresiva y "Vuelves a las 9:01";
  "Volver ahora" devuelve el tema oscuro con el reloj congelado (26:53 tras 50 s de
  pausa) y la siguiente pausa bloqueada; el ritual firme cierra y Focus dice "28m
  enfocado hoy", sin la pausa.
- Sin verificar en dispositivo: el aviso de fin de pausa, la Live Activity en pausa y
  contando hacia arriba (el widget cambió: hay que recompilar el dev client), y el
  escudo bajando y subiendo con la pausa (necesita el entitlement).

## Qué falta

- Pedir el entitlement de Family Controls (distribución) en el portal de Apple y
  probar las ventanas de rutina en un iPhone real.
- Probar el bloqueo de Android en teléfonos reales (Samsung, Xiaomi: optimización de
  batería) y la ruta de alarmas inexactas.
- Pantalla de divulgación destacada antes de pedir el acceso de uso (Play la exige);
  subir el video y poner la URL en `docs/PLAY_DECLARATIONS.md`.
- Persistir la duración elegida en la hoja de sesión (`usePlannedStore`, en memoria).
- Verificar en dispositivo cada capacidad y anotar acá qué se vio.
- Historia de sesiones: la intención ahora persiste, pero solo se lee en el cierre.

## Deuda conocida

- `react-native-health` lleva un parche en `patches/` para React Native 0.86.
- `t.depth.label` está en minúscula; `DepthCards` capitaliza localmente.
- `ios/` no se versiona; regenerar con `npx expo prebuild --platform ios --clean` tras
  cambiar plugins. `targets/` y `patches/` sí se versionan.

## Salir de la sesión: papel sobre tinta y respirar con el dedo (2026-09-17, ADR-0025)

- **Ritual sostenido** en `session/exit`: el usuario mantiene el objeto de Vesper
  (`BreathingObject`) y las 16 celdas respiran con él, 4-4-6: se encienden de abajo hacia
  arriba al inhalar, quedan encendidas al sostener, se apagan de arriba hacia abajo al
  exhalar. El reloj solo corre con el dedo puesto; soltar a mitad de ronda la reinicia
  (`domain/exitRitual.releaseBreath`). Suave una ronda, firme dos y la frase.
- **Toda salida a mano termina en papel**: `InkFlood` con `tone="paper"` disuelve la
  página desde el botón y debajo aparece `session/closed` ("Sesión cerrada.", "28m quedan
  contados.", modo, duración, motivo, y el costo si fue emergencia).
- **La pausa entra y sale por la misma disolución**: papel al pausar, tinta al volver. El
  cambio de esquema queda escondido debajo.
- **La emergencia es una ruta** (`session/emergency`) que se abre desde el salvavidas
  arriba a la derecha: tile, costo, espera de 10 s en la misma barra fina, "Seguir
  enfocado" primario y "Usar un desbloqueo" ghost. Ajustes › Desbloqueo de emergencia ya
  solo cuenta. `EmergencySheet` desapareció.
- **Profundo** ya no tiene un pill apagado: pie vacío y la caption "Profundo · solo el
  timer termina" bajo la barra. El pie de suave y firme queda en Terminar y Pausa.
- Verificado en el simulador iPhone 17 tocando con `idb`: pausa y vuelta con las dos
  disoluciones a mitad de camino y el reloj congelado; el ritual firme sostenido 30 s con
  capturas en Inhala, Sostén, Exhala, Ronda 2 de 2 y Listo; la frase, "Terminar · llevas
  28m", el papel sobre la ruta y "Sesión cerrada. 28m quedan contados."; la sesión
  profunda con salvavidas y caption; la emergencia a los 7 s, lista, gastada ("Te quedan 2
  este mes" en el cierre) y cerrada con "Seguir enfocado" sin gastar. `tsc` limpio, 634
  tests en 49 archivos.
- No verificado: "Reducir movimiento" (las celdas saltan al estado final), el ritmo de la
  respiración a ojo en un teléfono real, la ruta de emergencia sin desbloqueos, y la
  pausa venciendo sola (vuelve con el fade de ruta, sin disolución, a propósito).

## Superficies fuera de la app (2026-09-17, ADR-0023)

Lo que la sesión muestra con Vesper cerrada: pantalla bloqueada, Dynamic Island, escudo
y aviso de rutina. Antes cada superficie se había hecho por separado; el ADR-0023 fija la
regla común: **ningún texto con tiempo depende de un temporizador de JS** y la pausa se
ve distinta (clara) en todas partes.

- **Live Activity (iOS)**: relojes nativos (`Text timerInterval`) en el banner y en las
  cinco regiones de la isla; la línea de estado solo dice la fase ("Enfocado", "Pausa").
  Antes "quedan 21m" se congelaba al suspender iOS el JS. En pausa el banner pasa a papel
  y el glifo a `pause.fill`. Lógica pura en `src/platform/liveActivityProps.ts` con tests.
  Verificado en el iPhone 17 Pro: banner contando con la app fuera (23:–– → 22:––), isla
  compacta y expandida en foco y en pausa, banner papel en pausa, tocar la isla abre la
  sesión. Hallazgo: `ios/` no traía el target `ExpoWidgetsTarget`; `prebuild --clean`
  lo regeneró. No verificado: sesión sin límite en la isla (solo tests).
- **Escudo iOS**: tinta de la sesión (fondo ink, texto papel, icono `square.fill`,
  botón papel) desde `src/design/shieldPalette.ts`, igual en sesión y en ventanas de
  rutina. El botón dice "Cerrar": la acción `openApp` de la librería no funciona desde
  la extensión (`NSExtensionContext()` sin anfitrión; issue #81 de la librería). Solo
  compila: sin entitlement no hay escudo.
- **Rutina con la app cerrada (iOS)**: verificado en el iPhone 17 con una rutina a las
  11:15: el aviso "Empieza Lectures · Modo Deep work. Toca para empezar la sesión."
  apareció en la pantalla bloqueada y traer la app al frente cayó en la sesión con
  `lastRoutineStart` correcto. Copy corregido: la sesión empieza al abrir, no antes. La
  Live Activity no puede arrancar desde la extensión ni sin push: aparece al abrir.
- **Android**: la notificación del servicio es la pantalla bloqueada: cronómetro nativo
  hacia el fin (o hacia arriba sin fin), pública, abre `vesper://session/active`, canal
  `vesper_session` con importancia por defecto (con `IMPORTANCE_LOW` no salía en la
  pantalla bloqueada) y textos del diccionario. La pausa vive en el servicio
  (`pausePlan`/`resumePlan`): baja el escudo, cuenta la pausa y vuelve a vigilar sola
  aunque el proceso muera. El escudo dice "Se libera a las 11:26". Android 16 promueve
  la notificación (`setRequestPromotedOngoing`, compileSdk 36) sin poder verse aquí.
  Verificado en el Pixel 6 (API 34): panel con cronómetro, pantalla bloqueada con PIN,
  escudo con hora, notificación en pausa, reanudación al segundo tras `kill -9` con el
  escudo subiendo sobre Ajustes. Pendiente: el hook sigue pasando el tope de 12 h como
  fin en sesiones sin límite (`applyPlan` no sabe decir "abierta").
- `tsc` limpio, 634 tests en 49 archivos.
