# ADR-0053 — El escudo de la sesión pregunta y cuenta: intentos y pausas por app

**Estado:** propuesta · 2026-09-27

## Contexto

Hoy el escudo es una pared con una sola salida. En Android dice el modo, "Se libera a las
11:26" y "Volver"; en iOS, la tinta de la sesión y "Cerrar" (ADR-0023). Para pausar, la
persona tiene que volver a Vesper, abrir la sesión y tocar "Pausa de 15 min" (ADR-0022).
Y lo que pasa en el escudo no deja rastro: nadie sabe cuántas veces se intentó abrir
Instagram durante una sesión.

Eso último estaba previsto desde el principio. ADR-0004 separó la "Realidad" (el Report,
efímero) del "Progreso" (persistente) y puso en el Progreso los intentos bloqueados.
`DATA_MODEL.md` define `usage_events` con `shield_hit`, `backed_off` y `unlock_granted`,
pero la tabla nunca llegó a una migración. De las pausas solo se guarda la suma por sesión
(`sessions.break_ms`, migración 005): ni cuántas fueron ni por qué app.

La revisión de minimalist phone (2026-09-27) trajo la idea de una pausa antes de abrir una
app. La evidencia dice que la espera se desgasta:
- En el experimento controlado de one sec (PNAS 2023), lo que más movió fue ofrecer la
  decisión de no abrir, no la espera ni el mensaje.
- Con 1.039 usuarios durante 13 semanas (CHI 2024), la tasa de rechazo bajó de ~50 % a ~22 %.
- Los usuarios de minimalist phone describen el hábito de esperar y tocar "15 minutos".

El dueño del producto propuso otra cosa: que el escudo pregunte por cuánto tiempo pausar el
foco y muestre cuántas veces, hoy, se tocó ese botón y cuánto tiempo sumó. Un número
honesto en el momento de la decisión, en vez de una espera.

En iOS hay además un dato que decide: el tiempo por app vive dentro del
`DeviceActivityReport` y no se puede guardar (regla 10). Los toques en el escudo, en
cambio, sí se guardan, porque `ShieldAction` escribe al app group. Por eso los intentos son
la única métrica por app que Vesper puede guardar en las dos plataformas.

## Decisión

1. **El escudo es un punto de decisión.** Sobre una app de la sesión dice:

   ```
   Instagram
   Trabajo profundo · quedan 32 min
   Hoy aquí: 4 intentos · 2 pausas, 20 min

   [ Volver al foco ]              primario
   Pausar el foco: 5 · 10 · 15 min
   ```

   `Volver al foco` es el primario (regla 2). La pausa es la de ADR-0022 y hace lo mismo:
   detiene el reloj, levanta todo el bloqueo, no es foco y vuelve sola. Cambian dos cosas:
   ahora se elige su largo (5, 10 o 15 min, con `BREAK_MS` como techo) y se puede empezar
   desde el escudo, sin abrir Vesper. No hay notificación nueva: la pausa empieza en el
   escudo mismo y nunca se usa una notificación para saltar a Vesper (ADR-0027).

2. **El escudo respeta las reglas de la pausa y solo las muestra donde uno choca con ellas.**
   - Profundo no ofrece pausa: el escudo dice "Profundo · solo el timer termina" y solo
     tiene `Volver al foco`. La emergencia sigue en la sesión (ADR-0025).
   - Si la próxima pausa todavía no se habilita (cada 25 min de foco, ADR-0026), el escudo
     dice "Tu próxima pausa en 12 min" y solo tiene `Volver al foco`.

3. **Qué se cuenta, por app.**
   - *Intento*: el escudo apareció sobre una app de la sesión. Android lo sabe cada vez,
     porque el servicio lo dibuja. iOS solo lo sabe cuando la persona toca un botón: si
     sale deslizando a inicio, no queda rastro. En iOS es un piso y la pantalla dice
     "al menos".
   - *Volver*: tocó `Volver al foco`.
   - *Pausa por app*: pausó desde el escudo de esa app. Se guardan los minutos elegidos y
     los que duró de verdad, porque la pausa puede terminar antes con `Volver ahora`.

   Una pausa tomada desde la sesión cuenta como pausa, sin app.

   La app se identifica por el nombre de paquete en Android y por el `ApplicationToken`
   codificado en iOS: sus bytes, nunca `hashValue`, que cambia con cada proceso. El token
   nunca se resuelve a un nombre (CLAUDE.md, ADR-0004).

4. **Son conteos y pausas, nunca tiempo de uso.** Los minutos de una pausa son minutos
   fuera del foco, no minutos en Instagram: la pausa levanta todo el bloqueo y Vesper no
   sabe qué se abrió después. El texto lo dice así: "20 min de pausa", nunca "20 min en
   Instagram". Nada de esto se suma a ninguna moneda del libro mayor (regla 9, ADR-0005)
   ni sale del Report (regla 10).

5. **Dónde se ve.**
   - **En el escudo:** la línea de esa app para hoy.
   - **En el cierre de la sesión** (`session/complete`, `session/closed`): una sola línea,
     sin juicio: "4 intentos · 2 pausas, 20 min".
   - **En Actividad:** en Hoy, una fila de intentos con el desglose por app; en Semanal,
     la semana.
     - Android muestra nombre e icono (`AppTile`, ADR-0029).
     - En iOS la app no conoce el nombre. El desglose se dibuja con `Label(token)` de
       SwiftUI, la única vía legal (ADR-0029), en una vista nativa propia, porque
       `react-native-device-activity` no la expone.
     - Hasta que esa vista exista, iOS muestra en Actividad el total del día. El escudo sí
       muestra el nombre con `localizedDisplayName`, que la extensión recibe y que nunca
       sale de ella.
   - El mes sale de la misma tabla, pero esta decisión no le da pantalla.

6. **Se guarda en la base, y el escudo lleva su propia cuenta.**
   - La migración 013 crea dos tablas:
     - `usage_events`, como la dibujó `DATA_MODEL.md`: `shield_hit`, `backed_off` y
       `unlock_granted`; `token`, `session_id`, `duration_ms` (los minutos elegidos) y
       `fired_at`.
     - `breaks`, con cada pausa: `session_id`, `started_at`, `ended_at`, `source`
       (`'session' | 'shield'`) y `token`.
   - `sessions.break_ms` queda como está, porque no se edita una migración publicada.
   - Las cifras por día y por app las derivan las queries de `src/db/queries/`; no se
     guardan.
   - Lo nativo no escribe en SQLite. El servicio de Android y `ShieldAction` dejan cada
     evento en una cola (las preferencias del módulo en Android, el app group en iOS), y un
     hook de `PlatformEffects` la vacía a la base cuando la app vuelve.
   - Para que el escudo no dependa de que la app haya despertado, lo nativo lleva además un
     contador del día por app, que el escudo lee al dibujarse.

7. **El círculo no lo recibe todavía.** Compararse con el círculo es una decisión futura,
   de cada persona, con su propio ADR y apagada por defecto (regla 11: sin posiciones).
   Ese ADR tendrá que resolver dos cosas:
   - **Solo se compara lo que se mide igual.** Los intentos son un piso en iOS y una cuenta
     exacta en Android, así que no son comparables entre sí (ADR-0035). Las pausas desde el
     escudo sí se miden igual en las dos plataformas.
   - **Los nombres de las apps no viajan.** En iOS no se conocen y en Android dicen
     demasiado. Se compartiría el total.

8. **Fuera de la sesión no cambia nada.** Un escudo que pregunte fuera de la sesión cambia
   el alcance de Vesper. En Android, además, obliga a tener el servicio encendido todo el
   día y a reescribir la declaración de Play. Se decide en otro ADR, después de medir este.

## Consecuencias

- **Android** se puede hacer y verificar en el emulador. El escudo es nuestro (`Shield.kt`)
  y el servicio ya pausa sin JS (`pausePlan`). Falta que el servicio empiece una pausa por
  su cuenta y que JS la concilie al volver (`startBreak` con su hora y su largo).
- **iOS** es la mitad difícil, y nada se puede probar sin el entitlement de Family Controls:
  - `ShieldConfiguration` es estático: texto, colores, icono y dos botones. Según la
    documentación de Apple, el menú de 5, 10 y 15 min cabe en `secondaryButtonSubmenuItems`
    desde iOS 26.4. Antes de esa versión solo cabe "Pausar 15 min".
  - `ShieldAction` levanta el escudo y programa su regreso con `DeviceActivity`. El
    intervalo mínimo es de 15 min; los largos más cortos usan `warningTime`. Además corre
    el aviso de fin de sesión y agenda el de fin de pausa. Hay reportes de que
    `intervalDidEnd` no llega en iOS 26.3.1; se mide en teléfono.
  - Es probable que la Live Activity no se pueda actualizar desde la extensión. Si es así,
    la isla sigue contando foco durante la pausa hasta que Vesper despierte. Se verifica en
    teléfono y el resultado se escribe aquí.
  - El texto del escudo no se redibuja si la app ya estaba abierta (foro de Apple, desde
    2022), así que el contador puede quedarse un intento atrás.
  - Que `localizedDisplayName` llegue con el nombre al escudo también se verifica en
    teléfono.
- **Textos:** el escudo recibe sus plantillas de `src/i18n/` (es y en, con singular y
  plural) por `configureShield`. Lo nativo solo pone los números.
- **Privacidad y tiendas:** Android pasa a guardar en la base qué app de la sesión se
  intentó abrir y cuándo. Antes del envío hay que reescribir la frase de
  `PLAY_DECLARATIONS.md` ("the app writes no usage history of its own") y las secciones de
  privacidad de las dos tiendas. El dato sale del teléfono solo dentro del respaldo cifrado
  (ADR-0048).
- **Actualizaciones:** son cambios nativos (extensiones de iOS, módulo de Kotlin), así que
  llegan en un build de tienda y no por el aire (ADR-0052).
- **Cómo saber si funciona:** la proporción de `Volver` sobre intentos, por semana. Si cae
  con el tiempo, como en one sec, la cifra que manda es que los intentos bajen.
- **Descartado:**
  - La espera o la respiración antes de abrir: se aprende a esperarlas. La respiración
    sigue siendo para salir de la sesión (ADR-0025).
  - Contar intentos en iOS con las llamadas a `ShieldConfiguration`: el sistema las guarda
    en caché, así que cuentan de más y de menos.
  - Pedirle a la persona que nombre cada app (ADR-0004). Para este caso lo reemplaza
    `Label(token)`.
