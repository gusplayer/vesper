# ADR-0027 — Racha diaria con días de gracia, empujones del círculo y avisos que traen de vuelta

**Estado:** aceptada · 2026-09-17 (el dueño del producto reafirmó la decisión tras las objeciones)

## Contexto

El dueño del producto pidió tres cosas con un objetivo explícito: **que la app se use
más**. Los usuarios olvidan abrirla o activar una sesión.

1. Notificaciones que traigan de vuelta: ánimo recibido, alguien entró al círculo, y
   recordatorios de uso.
2. Una **racha diaria** sencilla: basta con activar la app unos minutos al día. Si se
   rompe, tres "salvavidas" por mes.
3. **Retos entre amigos con avisos**: poder empujar a quien no está cumpliendo, porque
   las metas en grupo funcionan mejor. Duración por defecto 21 días, o sin límite.
4. Con una condición firme: **durante el foco no llega ninguna notificación ni
   distracción.**

Esto deroga en parte tres decisiones escritas, y el ADR lo dice con todas sus letras:

- **Regla 11 / ADR-0021, principio 2** ("el círculo no notifica, nunca").
- **PRD, "Metas semanales, no rachas diarias"** y la lista de "Qué NO hacer" de
  `CLAUDE.md` ("no agregues rachas diarias").
- **PRD, fuera de alcance**: "rachas, notificaciones sociales".

La objeción original sigue siendo válida y este ADR la incorpora como guardarraíl: una
app de foco que pide atención se parece a lo que combate. La respuesta no es no hacerlo,
sino hacerlo con presupuesto, horario, interruptores y silencio absoluto en sesión.

Hecho técnico que ordena las fases: **el círculo no tiene backend** (regla 7,
`platform/circle` reporta `available: false`). Nada que venga de otra persona puede
llegar a un teléfono real hasta que exista. La racha y los recordatorios de uso son
locales y se pueden hacer ya.

## Análisis de producto

### Qué mueve la retención en una app de hábitos

- **El recordatorio atado a una intención propia** (la rutina con hora) rinde más que el
  genérico. Ya existe. Lo que falta es el caso de quien no tiene rutina.
- **La racha** funciona porque convierte "hoy no" en una pérdida concreta. Y castiga: el
  día enfermo, el viaje. Los días de gracia son el antídoto conocido (Duolingo lo llama
  *streak freeze*) y son lo que pidió el dueño.
- **Otra persona** es el mecanismo más probado para sostener un hábito. El ADR-0021 ya
  lo dijo; lo que negó fue el canal. Un empujón de un amigo es distinto a un aviso del
  sistema: tiene remitente, ocurre una vez y responde a un hecho ("hoy no marcaste").
- **La fatiga de avisos** es el riesgo simétrico: cada notificación de más acerca el
  interruptor de sistema, que apaga todas, incluida la de fin de sesión. Por eso hay
  presupuesto.

### Lo que este ADR no hace

- No mide. La app es local-first y no tiene telemetría; no sabremos si esto retiene
  hasta que exista un backend con métricas opt-in (otro ADR). Se decide por criterio.
- No agrega badges, medallas, puntos ni ranking. La racha es un número; los días de
  gracia son un contador. Nada brilla.

## Decisión propuesta

### 1. Silencio en sesión (la regla que manda sobre todas)

Mientras una sesión corre o está en pausa, el plan de notificaciones contiene **solo**
fin de sesión y fin de pausa. Todo lo demás se cancela al arrancar y se replanifica al
cerrar. `plannedNotifications` ya es una función del estado con la sesión dentro, así
que esto es una condición, no una arquitectura nueva. Las notificaciones de otras
personas que lleguen por push durante una sesión se **retienen** y se muestran al
cerrar, en la pantalla de cierre, como la línea de ánimo de hoy.

### 2. Presupuesto y horario

- **Máximo dos avisos por día** fuera de los de sesión (fin, pausa) y de rutina (que son
  citas que el usuario puso). Si hay más candidatos, ganan en este orden: empujón >
  racha en riesgo > ánimo/círculo > uso.
- **Horas de silencio**: nada entre 22:00 y 8:00, configurables.
- **Cada tipo tiene su interruptor** en Ajustes › Notificaciones. Los sociales viven
  también en Ajustes › Círculo.

### 3. Racha diaria con días de gracia

- **Un día cuenta** con **10 minutos de foco verificado** (sesiones, no declarado). Es
  "unos minutos": suficiente para que valga y poco para que no cueste.
- **La racha** es el número de días seguidos que cuentan, terminando hoy o ayer (hoy
  todavía está abierto).
- **Tres días de gracia por mes** (`GRACE_DAYS_PER_MONTH = 3`). Se aplican **solos** al
  primer día que falla, sin preguntar: la racha no se rompe y el contador baja. Se
  llaman *días de gracia*, no salvavidas: el salvavidas ya es el icono del desbloqueo
  de emergencia (ADR-0025) y significa otra cosa.
- **Se ve** en Focus, bajo la píldora de hoy ("12 días seguidos · 2 de gracia") y en
  Actividad. Sin fuego, sin animación. La meta semanal sigue donde está.
- **Aviso de racha en riesgo**: a una hora elegida (por defecto 20:00) si hoy no hay 10
  minutos y la racha es de 2 días o más: "Tu racha de 12 días termina a medianoche. 10
  minutos bastan." Si un día de gracia se aplicó solo, al día siguiente una línea en
  Focus lo dice; no notifica.
- **Datos**: la racha se deriva de `sessions` (queries, no se guarda). Los días de gracia
  usados se guardan en una tabla `grace_days (month_key, day_key)`; migración 007.
  `domain/streak.ts` puro con tests: días que cuentan, aplicación de gracia, mes en
  curso, reinicio mensual.

### 4. Avisos que traen de vuelta (locales, sin backend)

- **Día sin foco**: si a la hora elegida no hubo sesión y no hay racha que avisar, un
  recordatorio suave: "Hoy no has enfocado. 25 minutos y listo." Uno solo; no se repite
  al día siguiente si el usuario lo ignoró dos días seguidos (se apaga solo hasta que
  abra la app).
- **Reactivación**: a los 3 y a los 7 días sin abrir la app, un aviso cada vez, y nunca
  más hasta que vuelva. Copy sobre lo que sabe la app: "Llevas 7 días sin enfocar. Tu
  círculo sigue ahí." si tiene círculo; "Tu racha se detuvo en 12" si tenía racha.
- Ambos con interruptor propio, encendidos por defecto, y sujetos al presupuesto.

### 5. Círculo: empujones, ánimo, entradas (necesita backend)

- **Empujón** (*nudge*): un miembro puede empujar a otro **que no marcó hoy** un reto
  que comparten. Una vez al día por persona, como el ánimo. Llega como push con
  remitente: "Ana te empuja: hoy no has leído." Tocarlo abre el reto. El que lo recibe
  puede apagarlo en Ajustes › Círculo; por defecto encendido, porque es la razón de
  estar en un reto.
- **Ánimo recibido**: se agrupa en **un aviso al día** al final del día ("Ana y Luis te
  dieron ánimo"), nunca uno por ánimo.
- **Alguien entró / te invitaron a un reto**: inmediato; son raros y esperan respuesta.
- **Retos**: duración por defecto **21 días** (chip nuevo junto a 1, 2 y 4 semanas) y
  **sin límite** (`weeks: null`). Un reto sin límite se lee por semanas, como hoy, y
  cualquiera puede salir cuando quiera. Un reto de 21 días termina el día 21, no al
  cierre de la semana; `endsAt` pasa a ser un día, no una semana.
- **Mientras no hay backend**: la UI del empujón existe con datos de demostración y
  `platform/circle` sigue diciendo que nada sale del teléfono. El botón "Empujar" marca
  el empujón localmente y muestra "Enviado", como el ánimo. La entrega real llega con
  el ADR del backend (push por Expo sobre APNs/FCM).

### 6. Lo que cambia en las reglas

Al aceptarse este ADR:

- Regla 11 pasa a: "El círculo no rankea y no tiene feed. Notifica solo lo que otra
  persona hizo (empujón, ánimo agrupado, entrada, invitación), con interruptor y nunca
  en sesión."
- `CLAUDE.md`, "Qué NO hacer": "No agregues badges ni gamificación. La única racha es la
  diaria de este ADR, con días de gracia; la meta semanal sigue siendo la métrica."
- PRD: la sección "Metas semanales, no rachas diarias" se reescribe como "Meta semanal
  y racha diaria con gracia"; "rachas" y "notificaciones sociales" salen de fuera de
  alcance.

## Alternativas consideradas

- **Racha por abrir la app** (sin minutos). Es lo que más infla el número y lo que menos
  significa; se descarta. Diez minutos de foco es el mínimo que aún es foco.
- **Días de gracia manuales** ("¿usar un día de gracia?"). Añade un diálogo en el peor
  momento (el día que fallaste). Automático y visible después es más amable.
- **Un aviso por ánimo**. Es el feed por la puerta de atrás. Agrupado al día.
- **Empujón como notificación del sistema** ("tu círculo nota que no marcaste").
  Sin remitente no motiva; con remitente es una persona. Solo persona a persona.
- **Sin presupuesto**. Es lo que hace que la gente apague todo. Dos al día y horario.

## Consecuencias

- Migración 007 (`grace_days`; `challenges.weeks` nullable y `ends_on` por día),
  `domain/streak.ts`, cambios en `domain/reminders.ts` (nuevos tipos con su gate y el
  filtro por sesión y horario), Ajustes › Notificaciones con seis interruptores y la
  hora, Focus y Actividad con la racha, chips de reto nuevos, botón "Empujar" en el reto.
- Sin dependencias nuevas. Sin backend todavía: el círculo sigue en demostración.
- El ADR-0021 queda enmendado en su principio 2; el resto sigue.
- Riesgo asumido: más avisos, más gente que apaga el permiso. El presupuesto y los
  interruptores son la apuesta para que no pase.
