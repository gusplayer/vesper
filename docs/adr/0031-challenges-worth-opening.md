# ADR-0031 — Retos que valen la pena abrir: riesgo propio, cierre, y una señal del círculo en Focus

**Estado:** aceptada · 2026-09-21 (el dueño del producto aprobó los cuatro bloques; los retos
públicos salieron de aquí al ADR-0032)

## Contexto

El dueño del producto pidió cuatro cosas sobre el mismo módulo:

1. Entender cómo se une hoy el círculo a los retos.
2. Que la vista y la lógica de retos sean más atractivas: es un módulo importante.
3. Avisos cuando estás quedando fuera de un reto, y algo sobre "retos públicos".
4. En Focus, un icono o una animación que haga referencia al círculo y a los retos.

Manda lo que ya está escrito: regla 1 (cuatro pestañas de texto), regla 2 (un primario
por pantalla), regla 4 (máximo 5 hábitos), regla 6 (solo se anima la opacidad), regla 7
(local-first, sin backend sin ADR), regla 11 (sin ranking y sin feed), ADR-0021
(el círculo) y ADR-0027 (presupuesto de dos avisos al día, horas de silencio, silencio
absoluto en sesión).

### Qué hay hoy, exactamente

- Un reto es una fila de `challenges`: `name`, `weeklyTarget`, `startWeekKey`,
  `endDayKey`, `createdBy`, `participantIds`, `habitId`.
- **Tu participación son dos cosas a la vez**: `ME` dentro de `participantIds` y un
  `habitId` que apunta a un hábito tuyo. `linkHabit()`
  (`src/data/stores/circle.ts`) reusa un hábito activo con el mismo nombre o crea uno
  declarado; si los cinco lugares están tomados devuelve null, el store responde
  `'habitsFull'` y no se crea nada (regla 4).
- **Tus marcas son marcas de hábito de siempre.** "Marcar hoy" en `circle/challenge`
  llama a `toggleHabitToday(challenge.habitId)`. Las de los demás son filas de
  `challenge_marks`, que hoy solo escribe la siembra (`src/data/circleSeed.ts`).
- **El círculo entra por `participantIds`.** `challengeStandings()` los cruza con
  `members`; a quien ya no está en el círculo simplemente lo salta. No hay invitación a
  un reto, ni aceptar, ni "alguien entró": los participantes se marcan con casillas al
  crear (`circle/challenge-new`) y quedan dentro sin decir que sí. `joinChallenge` existe
  solo para ti.
- **El reto no notifica nada.** `NotificationKind` no tiene ningún tipo de reto. El
  empujón se guarda en `nudges` y la pantalla dice "Empujado"; la entrega es del backend
  (ADR-0027 §5). `prefs.nudges` es un interruptor que hoy no gobierna ningún aviso.
- **El reto solo existe dentro de `circle/`.** Actividad muestra personas, no retos.
  La pantalla de Hábitos no dice que un hábito sea un reto, aunque sea el mismo hábito.
  Focus no lo menciona. Para llegar hacen falta tres toques desde Actividad.
- **Un reto que termina no pasa nada.** Queda leyéndose "Terminó" para siempre;
  `archiveChallenge` no se llama desde ninguna pantalla.

El diagnóstico corto: hoy un reto es un espejo privado de un hábito, con datos de
demostración al lado. Falta lo que lo haría importar: que se sepa cómo vas, que se note
cuando estás a punto de quedarte fuera, que termine en algo, y que exista fuera de su
pantalla.

## Análisis

**Lo que no se puede hacer sin backend** es todo lo que viene de otra persona: el
empujón entregado, el ánimo agrupado, "Ana entró al reto", los retos públicos.
`platform/circle.status()` sigue en `available: false` y ADR-0021 no se toca aquí.

**Lo que sí se puede hacer hoy, entero y real**, es lo tuyo: tus marcas están en la base
de este teléfono. Que te falten dos marcas y queden dos días es un hecho local, tan local
como la racha del ADR-0027. El aviso más útil del módulo —"estás quedando fuera"— no
necesita servidor. Esa es la oportunidad que este ADR toma.

**Retos públicos: no aquí.** Un catálogo de retos abiertos necesita servidor *y*
descubrimiento de desconocidos, así que no cabe en esta tanda por mucho que se quiera.
El dueño del producto los pidió de todas formas y su forma se decide en el **ADR-0032**;
lo que queda aquí son los retos sugeridos, que son nuestros y funcionan hoy.

**Sobre "más atractivo".** El sistema prohíbe color, medallas, puntos y animación que no
sea opacidad. Lo que queda —y es lo que hace ver bien al resto de la app— es composición,
escala tipográfica, ritmo y densidad de tinta: la grilla de Focus, los puntos del arte de
foco, la celda de hoy que respira. Un reto atractivo aquí no es uno con más adornos, es
uno que en dos segundos dice cómo vas y qué falta.

## Decisión

### 1. Riesgo de reto, en el dominio (local, sin backend)

`domain/circle.ts` gana una función pura `challengeRisk(standing, daysLeftInWeek)` que
devuelve `'met' | 'onTrack' | 'tight' | 'atRisk' | 'missed'`:

- `met`: `done >= target`.
- `atRisk`: faltan tantas marcas como días quedan en la semana (hay que marcar todos).
- `tight`: queda un día de holgura.
- `missed`: faltan más marcas que días quedan; la semana ya no se puede cumplir.
- `onTrack`: el resto.

Se calcula por participante, así que sirve para tu línea y para saber a quién tiene
sentido empujar. Con tests, como todo el dominio.

### 2. Un aviso local: "estás quedando fuera"

Nuevo `NotificationKind: 'challengeRisk'` en `domain/reminders.ts`, con las mismas
reglas que los demás: a `reminderMinutes` (20:00 por defecto), dentro del presupuesto de
dos avisos al día, fuera de las horas de silencio, nunca en sesión, con interruptor
propio (`prefs.challenges`) en Ajustes › Notificaciones.

- **Cuándo**: estás unido, el reto está activo, hoy no marcaste y tu estado es `atRisk`.
  Es decir, solo cuando de verdad se está yendo.
- **Cuántos**: uno al día como máximo, el del reto más apretado, aunque haya dos retos.
- **Qué dice**: "Leer · te faltan 2 y quedan 2 días. Márcalo hoy." Tocarlo abre el reto.
- **Prioridad** dentro del presupuesto del ADR-0027 §2: empujón > racha en riesgo >
  **reto en riesgo** > ánimo/círculo > uso.

Y un segundo aviso, también local y de una sola vez: **el reto terminó** ("Terminó Leer.
Cumpliste 3 de 3 semanas."), a la hora del recordatorio del día siguiente al último día
—no a una hora nueva inventada para él—, bajo el mismo interruptor y el mismo
presupuesto.

### 3. La pantalla del reto: la semana como imagen, no como lista

- **Cabecera con objeto**: el reto abre con la semana dibujada en tinta —una fila de
  siete celdas por participante, la de hoy respirando— con la misma gramática que
  `HeatGrid` en Focus. Se dibuja con `DotGrid`/`HeatGrid`, sin componentes nuevos de
  librería y sin animación que no sea opacidad.
- **Una línea de estado con verbo**, en vez de "You · 3 of 4": "Te faltan 2 · quedan 3
  días", "Vas cumplido", "Esta semana ya no sale". Para los demás, "Ana va 3 de 4".
- **El empujón se ofrece donde importa**: el chip sigue apareciendo junto a cualquiera
  que no marcó hoy, y lo que cambia es que su línea dice cómo va ("Ana va 1 de 4"), así
  se ve a quién le sirve. Ordenar a las personas por quién está fallando se leería como
  un ranking (regla 11), así que el orden del reto no cambia.
- **Cierre del reto**: al terminar, una tarjeta quieta con el resultado por persona
  (cumplió / no cumplió, marca y raya, sin premio) y una fila "Repetir 21 días" que crea
  el siguiente con los mismos participantes. Al cerrarlo se llama `archiveChallenge`,
  que hoy no llama nadie.

### 4. El reto deja de estar escondido

- **En Hábitos**: el hábito vinculado dice en su línea "Reto con Ana y Luis" en vez de
  "Lo marcas tú". Tocarlo sigue marcando el día —una fila tiene un solo toque— y el reto
  se abre desde las filas del círculo, que están justo debajo en la misma pantalla.
- **En Actividad › Semanal**: la sección del círculo lista, debajo de las personas, tus
  retos activos con su línea de estado. Es una fila, no una sección nueva.

### 5. En vez de retos públicos: retos sugeridos y retos por invitación

- **Sugeridos (hoy, local)**: un catálogo corto y curado en `src/domain/` —"Leer 4 veces
  por semana", "Caminar 5", "Sin teléfono en la mesa", "Dormir sin pantalla"— que
  aparece como chips en "Nuevo reto" y como estado vacío cuando no tienes ninguno.
  Prellenan nombre y veces por semana. Sin servidor, sin desconocidos, sin contadores de
  cuánta gente lo hace.
- **Abiertos de verdad**: el dueño pidió retos públicos y eso se decide aparte, en el
  ADR-0032, porque necesita servidor, identidad, reporte y bloqueo. Lo de aquí es lo que
  funciona hoy sin nada de eso.

### 6. En Focus, una señal del círculo y los retos

Regla 1 y regla 2 impiden una quinta pestaña o un segundo botón; regla 6 impide una
animación que no sea opacidad. La señal es, entonces, la línea que ya existe:

- Bajo la píldora de hoy y la línea de racha, **una tercera línea que solo aparece cuando
  hay algo cierto que decir hoy**: "Leer · te faltan 2 y quedan 2 días", o "Ana y Luis te
  dieron ánimo". Es texto, es una línea, se va cuando no hay nada, y al tocarla abre el
  reto o el círculo.
- **Y una fila de siete puntos bajo la grilla** cuando tienes un reto activo: tu semana
  del reto en la misma gramática que tu semana de foco, con la celda de hoy respirando
  como ya respira la del `HeatGrid`. Ese es el "icono con animación" que pide el dueño,
  dicho en el idioma de la app: sin insignia, sin número que brille.

## Alternativas consideradas

- **Quinta pestaña "Círculo".** Rompe la regla 1 y convierte una capa opcional en un
  cuarto del producto.
- **Un icono del círculo en la cabecera de Focus con punto rojo.** Es una insignia; es
  exactamente el mecanismo de atención que el producto combate.
- **Aviso de reto cada día que no marcas.** Se convierte en ruido en una semana y gasta
  el presupuesto que protege el aviso de fin de sesión. Solo cuando de verdad está en
  riesgo.
- **Ranking del reto ("vas segundo").** Regla 11.
- **Retos públicos con contador de participantes.** Backend, desconocidos y feed. Ver
  punto 5.

## Consecuencias

- Dominio: `challengeRisk` y su tabla de casos, con tests. Sin migración: todo sale de
  `habit_marks`, `challenge_marks` y `challenges`, que ya existen.
- `domain/reminders.ts`: dos tipos nuevos (`challengeRisk`, `challengeEnd`), su lugar en
  la prioridad y un interruptor nuevo en `NotificationPrefs` (`challenges`), con su fila
  en Ajustes › Notificaciones y sus strings en los dos idiomas.
- UI: `circle/challenge` reescrita alrededor de la semana dibujada, `ChallengeCard` con
  la línea de estado, cierre del reto con "Repetir", la línea en Hábitos, los retos en
  Actividad, los chips sugeridos en "Nuevo reto", y la línea más la fila de puntos en
  Focus. Sin dependencias nuevas y sin componentes de librería.
- Sigue sin backend: el empujón se sigue guardando y mostrando como enviado, y
  `platform/circle` sigue diciendo que nada sale del teléfono. Lo que cambia es que el
  módulo ya no depende del servidor para ser útil: tu mitad del reto es real hoy.
- Queda pendiente para el ADR del backend: entrega del empujón, ánimo agrupado, entrar a
  un reto por invitación, y los estados "invitado" frente a "dentro" en
  `participantIds` (hoy la siembra hace como si todos hubieran aceptado).
