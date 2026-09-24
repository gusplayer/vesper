# PRD — Vesper

## Problema

Las apps de screen time dicen cuánto tiempo perdiste. Ninguna dice cuánto invertiste.
El usuario objetivo no quiere un informe de uso: quiere sentir que su tiempo se está
gastando en lo que eligió.

## Propuesta

Un libro mayor del día. Tres monedas separadas, nunca sumadas:

1. **Tiempo invertido** — sesiones de foco y actividades que el usuario declara con timer.
2. **Tiempo verificado** — gym, pasos, sueño. Confirmado por HealthKit / Health Connect.
3. **Tiempo consumido** — uso de redes. Estimado, siempre presentado como piso.

Y un denominador: las semanas de vida restantes.

## Usuario objetivo

Alguien que ya intentó reducir su uso del teléfono y falló. Sabe que el problema no es
información — es fricción y honestidad. No quiere otro dashboard.

## Estructura desde ADR-0016

Cuatro pestañas de texto: **Focus**, **Rutinas**, **Actividad**, **Ajustes**. La sesión
activa y sus salidas son rutas a pantalla completa. Los modos reemplazan a la
configuración de sesión (apps, sitios, comportamiento y profundidad viven en el modo);
las rutinas encienden una sesión con su modo a la hora programada, o a mano si no tienen
hora (ADR-0019); Actividad reúne las estadísticas, la meta semanal, los hábitos, el libro
mayor del día, las semanas de vida y el círculo. La descripción detallada por pantalla
está en `docs/PROTOTYPE_GUIDE.md`.

Lo que existe hoy y este documento no describe en detalle, porque nació en los ADR:

| Área | Dónde se define |
|---|---|
| Modos (`modes/*`), rutinas (`(tabs)/schedules`, `schedules/edit`), Ajustes y sus páginas, onboarding de nueve pasos | ADR-0016, `PROTOTYPE_GUIDE.md` |
| Persistencia real, notificaciones, Salud (iOS), Live Activity, bloqueo | ADR-0017, ADR-0023, `PLATFORM_*.md` |
| Arte de foco durante la sesión | ADR-0018 |
| Rutinas que arrancan sesiones; bloqueo en Android | ADR-0019 |
| Español e inglés, Ajustes › Idioma | ADR-0020 |
| Sesión sin límite, pausas de 15 min, botón de un toque | ADR-0022 |
| Salida consciente con el dedo, emergencia como ruta, cierre breve | ADR-0025 |

Lo que sigue es la versión anterior, vigente en su fondo (monedas separadas,
profundidades, meta semanal, vida); donde la forma cambió, se dice.

## Las tres pantallas (versión e-ink, superada en forma)

Sin tab bar. Sin pantalla de ajustes. **Hoy hay cuatro pestañas y Ajustes existe** (ADR-0016).

El swipe horizontal va entre **inicio y vida**. La sesión activa no es una página del
swipe: es una ruta a pantalla completa de la que solo se sale terminando el timer o
manteniendo pulsado. Si fuera una página, un deslizamiento abandonaría una sesión
`profunda` y el nivel no significaría nada. Ver ADR-0009.

### 1. Inicio (también es la pantalla de arranque de sesión)

Hoy es la pestaña Focus: "Xh Ym enfocado hoy", la grilla de los últimos días, el modo
activo con cuántas apps bloquea, la próxima rutina, la fila de duración y el botón. La
meta semanal y el libro mayor viven en Actividad.

- Encabezado: fecha, progreso de la meta semanal
- Duración de la próxima sesión, grande, con la última configuración ya aplicada
- Línea de contexto: `actividad · profundidad · sin bloqueo` en fase 1. Cuando llegue el
  bloqueo, el tercer término pasa a ser el perfil
- Botón único: `Enfocarme 25 min` / `Enfocarme sin límite`, con la duración en una fila
  tocable encima. Un toque arranca; solo un modo profundo pide mantener (ADR-0022). Si
  hay una sesión corriendo, dice `Seguir` y vuelve a ella
- Libro mayor del día abajo, en tipo pequeño, incluyendo el renglón `sin registrar`

**Regla:** un tap desde abrir la app hasta estar en sesión.

Toda la configuración se abría desde donde se leía (ADR-0007, superado por ADR-0016).
Hoy: el modo se elige en una hoja desde su nombre y se edita en `modes/*`; la duración en
la fila "25 min ⌄"; la meta semanal tocando su tarjeta en Actividad › De por vida; los
hábitos ahí mismo (tocar marca hoy, mantener edita, "Agregar hábito" crea).

### 2. Sesión activa

- Encabezado: actividad, `sesión N de hoy`
- Timer grande, centrado, serif
- Intención escrita por el usuario, en la misma pantalla
- Barra de progreso fina
- Si hubo interrupciones, una línea que las cuenta. Se anotan, no se castigan
- Al vencer el timer la ruta no se va: muestra la duración servida, la intención tal como
  se escribió y `volver`. Una sesión cancelada no pasa por ahí. Ver ADR-0015
- **Salida consciente** (ADR-0025): `Terminar` no termina. Abre una ruta a pantalla
  completa donde el usuario sostiene el objeto de Vesper, el tile, y el tile respira con
  él: 4 s inhala, 4 s sostiene, 6 s exhala. Suave respira una ronda y ahí mismo puede
  terminar; firme respira dos y escribe la frase "Elijo dejar esto ahora", con un motivo
  opcional; profundo no tiene salida. El reloj solo avanza con el dedo puesto: soltar a
  mitad de ronda la devuelve a su inicio y las rondas completas se conservan. Corto a
  propósito: el ritual no debe costar el tiempo que protege. En cada paso el botón grande
  es `Seguir enfocado`
- **Cierre** (ADR-0025): al confirmar, la página se disuelve en papel desde el botón que
  se tocó y debajo aparece una ruta breve: `Sesión cerrada.`, el tiempo que queda contado,
  el modo, la duración, el motivo si se escribió y, si fue una emergencia, lo que costó.
  Botón `Continuar`, sin gesto de volver. No celebra: eso es de la sesión completa
- **Emergencia** (ADR-0025): una ruta oscura a pantalla completa, a la que se llega desde
  el icono de salvavidas arriba a la derecha. Muestra el tile en reposo y lo que cuesta,
  espera 10 s y entonces habilita `Usar un desbloqueo`, que gasta uno de los cinco del
  mes. `Seguir enfocado` es el primario. Sin desbloqueos, la ruta lo dice y solo queda
  seguir. En Ajustes solo se ve cuántos quedan

Comportamiento por nivel de profundidad (ADR-0025):
- **Suave** — una ronda de respiración y termina
- **Firme** — dos rondas, la frase y el motivo opcional
- **Profundo** — no hay salida; bajo la barra una línea lo dice: `Profundo · solo el timer
  termina`. Queda la emergencia, arriba a la derecha

**Pausas** (ADR-0022): en suave y firme, cada 25 minutos de foco se habilita una pausa
de hasta 15 minutos (`Pausa de 15 min`, ghost, junto a `Terminar`). Al tocarla, el papel
se disuelve sobre la tinta desde el botón y debajo aparece la pausa en esquema claro
(ADR-0025). Mientras dura, el bloqueo se levanta y la pantalla es un reloj que cuenta
hacia abajo con el primario `Volver ahora`, que corre la tinta de vuelta desde el botón.
Al vencer vuelve sola con el fade de ruta, con aviso si la app está en segundo plano. La
pausa no es foco y detiene el reloj: una sesión de 60 min con una pausa de 15 termina a
los 60 de foco real. No gasta emergencias. Profundo no tiene pausas.

### 3. Vida

Hoy es la tarjeta Vida al final de Actividad › De por vida, y Ajustes › Vida guarda la
fecha de nacimiento, el país y el sexo opcionales (ajustan la esperanza de vida,
`domain/lifeExpectancy`) y la esperanza editable.

- Semanas restantes, número grande
- Cuadrícula de semanas (vividas en tinta, restantes en gris)
- Una línea de proyección: *"a tu ritmo actual, X de eso en redes"*. Llega en fase 3,
  con los datos de uso; hasta entonces la página lo dice en una línea

**Regla:** nunca es la pantalla inicial. Nunca genera notificaciones. Opt-in: sin fecha
de nacimiento no cuenta nada, solo invita. Nada más se pregunta: ni peso ni altura.

## Configuración de sesión

Versión e-ink. Hoy la duración se elige en la fila sobre el botón de Focus
(5 · 25 · 50 · 90 · 120 · Sin límite; la elegida vive en memoria, no se persiste) y la
actividad, la profundidad y qué se bloquea son del modo activo.

Se abría tocando el número grande. Cuatro decisiones, todas con valor por defecto
heredado de la última sesión. Cada cambio se guarda al instante; no hay botón de guardar.

| Decisión | Opciones | Default |
|---|---|---|
| Duración | 5 / 25 / 50 / 90 / 120 / `sin límite` (termina cuando el usuario diga o a las 12 h, y corre como firme si el modo es profundo) | última usada |
| Actividad | chips de las actividades activas + `otra`, que crea una ahí mismo con el nombre tecleado | última usada |
| Profundidad | suave / firme / profundo | última usada |
| Perfil de bloqueo | `nada`, única opción en fase 1. `redes` y `todo menos esenciales` llegan en fase 2 | `nada` |

## Hábitos

Máximo 5. Cada hábito tiene:

- Nombre (texto libre)
- Meta semanal (2× / 4× / 6×; sin valor custom en fase 1)
- Tipo de conteo: **verificado** (Health lo confirma) o **declarado** (el usuario marca o pone timer)

El nombre es texto libre porque hay hábitos que nunca son sesiones de foco —sueño y pasos son
los dos casos verificados— y no caben en la lista de actividades. Ver ADR-0008.

Cuando el nombre coincide con una actividad existente, el hábito se vincula a ella. La
intención es que el libro mayor muestre un solo renglón en vez de dos que hablan de lo
mismo; el vínculo ya se guarda, pero el libro mayor todavía no lo usa.

El tipo verificado solo se desbloquea para hábitos mapeables a datos de salud:
entrenamiento, caminata, sueño. Lo desbloquea el nombre (`healthTypeFor`), y
**declarado sigue siendo el default**. En iOS, con Salud conectada, HealthKit marca
solo los hábitos verificados (ADR-0017); en Android lo hace Health Connect (ADR-0043), y
donde no está, un hábito verificado cae a declarado y la pantalla dice por qué (ADR-0041).

Se editan y archivan desde Actividad › De por vida (mantener la fila) o desde
`habits/edit`. Archivar no borra: las marcas son historia, y el hábito deja de contar y
libera un lugar.

## Meta semanal y racha diaria con gracia

Un objetivo por semana, en horas de foco. Se reinicia el lunes. Es la métrica.

Desde ADR-0027 hay además una **racha diaria**: un día cuenta con 10 minutos de foco en
sesión (nunca declarado). Las rachas diarias castigan a quien se enferma un martes, así
que hay **tres días de gracia por mes** que se aplican solos al primer día que falla. La
racha es un número en Focus y en Actividad, sin fuego ni animación. Un aviso a la hora
elegida (20:00 por defecto) dice cuando está en riesgo; otro, cuando el día no tuvo foco;
y dos más a los 3 y 7 días sin abrir la app. Máximo dos avisos al día fuera de la sesión
y la rutina, nada entre 22:00 y 8:00, y **ninguno durante una sesión o una pausa**.

Se configura tocando su tarjeta en Actividad › De por vida, que es donde se lee (chips
5 / 10 / 15 / 20 / ninguna). **No hay meta por defecto** para un usuario nuevo: la app no
inventa un número contra el cual medirte, y `ninguna` es una respuesta válida. (Los datos
de demostración siembran 15 h.)

El **cierre del domingo** es el aviso "Cierra la semana" más Actividad › Semanal, que ya
muestra cómo cerró la semana. No habrá pantalla ni sección de cierre (ADR-0026, que
supera a ADR-0013).

## Círculo (ADR-0021)

Las metas en compañía se cumplen más que a solas. El círculo es la respuesta de Vesper
a eso, con la condición de no convertirse en lo que combate:

- **Personas, no seguidores.** Hasta 12, por invitación. Sin perfiles públicos ni feed.
- **Silencio.** El círculo nunca notifica. Se ve en Actividad › Semanal y en `circle/`.
- **Sin ranking.** La semana ordena por horas de foco y nada más. Un reto muestra quién
  cumplió y quién no, sin puntos ni premios.
- **Tú decides qué se ve**, métrica por métrica: foco, hábitos y retos, uso estimado de
  redes (apagado por defecto y siempre presentado como piso estimado, aparte).
- **Ánimo, no likes.** Un gesto de persona a persona, una vez al día, sin contador.
- **Retos**: un hábito con testigos. Nombre, veces por semana, 1, 2 o 4 semanas, quiénes.
  Unirse vincula (o crea) un hábito tuyo, y el máximo de 5 sigue valiendo.

El perfil vive en el teléfono; el backend y la identidad real son un ADR posterior. En
el prototipo el círculo es de demostración y las pantallas lo dicen.

## Fuera de alcance en v1

- Sync general de la app (el círculo tiene servidor desde ADR-0033, desplegado; la app
  todavía no le habla, y nada más viaja)
- Gráficos y estadísticas complejas más allá de las vistas de Actividad
- Badges, leaderboards, feed, seguidores (la racha diaria y los avisos del círculo
  entraron con ADR-0027)
- Modo oscuro como ajuste (la sesión es oscura por diseño; la app no)
- Tablet / iPad
- Widget de pantalla de inicio (la Live Activity sí existe)
- Health Connect en Android
- Estimación real de uso en iOS (fase 3): ahí el "tiempo consumido" sigue siendo un
  estimado de demostración. En Android es real por app desde ADR-0029
- Sonido y vibración (ADR-0024, en propuesta)

Lo que la primera versión de este documento dejaba fuera y ya existe: bloqueo de apps
(ADR-0017, ADR-0019), Live Activity (ADR-0017, ADR-0023), español e inglés (ADR-0020),
onboarding (ADR-0016) y pantalla de ajustes (ADR-0016).

## Métricas de éxito del prototipo

No son de negocio, son de validación personal:

- ¿El autor de la app la abre 7 días seguidos sin obligarse?
- ¿El tiempo desde abrir hasta estar en sesión es menor a 3 segundos?
- ¿El renglón `sin registrar` provoca alguna reacción?

Si la respuesta a la primera es no, el problema no era el bloqueo.

## Riesgos de producto

| Riesgo | Mitigación |
|---|---|
| La pantalla de vida genera ansiedad | Opt-in, nunca inicial, nunca push, framing de asignación |
| El usuario infla el tiempo declarado | Tope de 6h/día declarables; separación visual de verificado |
| El onboarding pide demasiado | Ocho pasos que se pueden saltar; cada permiso se pide de verdad, con "Ahora no", y la app funciona sin ninguno. ADR-0026: hay onboarding, ningún permiso es obligatorio |
| Estética e-ink se vuelve decorativa | Regla: solo texto, reglas horizontales y cuadros rellenos |
