# ADR-0042 — Retos de pasos: la meta va en el nombre, el círculo ve días y no cifras, y cada línea dice cómo se contó

**Estado:** aceptada · 2026-09-24 (el dueño del producto pidió implementarla)

## Contexto

El dueño del producto quiere retos de pasos con el círculo: que los pasos lleguen de
Salud (y de las apps que escriben en Salud) y que el reto se marque solo. Manda lo que ya
está escrito: regla 8 (el permiso se pide en su flujo), regla 9 y ADR-0005 (verificado y
declarado nunca se suman), regla 11 (sin ranking y cada métrica se comparte solo si el
usuario lo elige), ADR-0008 (el hábito se define por su nombre), ADR-0031 (el reto es un
hábito con testigos) y ADR-0041 (un verificado que nada puede verificar cae a declarado).

### Qué hay hoy, exactamente

- **iOS lee pasos.** `platform/health.ts` pide `StepCount` y `readWeek` entrega
  `stepsByDay`. HealthKit ya junta iPhone, Apple Watch y las apps que escriben en Salud
  (Garmin, Oura, Strava…), así que no hace falta integrar cada app.
- **La meta es fija.** `STEP_GOAL = 8000` en `domain/healthMarks.ts`, para todo hábito de
  pasos. El sueño, en cambio, ya lee su meta del nombre (`sleepHoursFor`: "Dormir 7,5 h").
- **Un reto nunca es verificado.** `linkHabit()` (`src/data/stores/circle.ts`) reusa un
  hábito con el mismo nombre o crea uno con `countMode: 'declared'` siempre. Un reto
  "Caminar" recién creado no recibe marcas de Salud aunque Salud esté conectada.
- **La marca de reto no dice de dónde vino.** `challenge_marks` (local y en
  `server/src/schema.sql`) guarda reto, persona y día. Nada distingue un día confirmado
  por Salud de un día marcado a mano.
- **Android no tiene Salud.** `status()` lo dice; Health Connect no está integrado
  (`docs/PLATFORM_ANDROID.md`).
- **El círculo sigue sin red.** La app aún no le habla al servidor (ADR-0021, ADR-0033):
  lo que aquí se decide que "se comparte" viaja cuando llegue el sync.

## Decisión

### 1. La meta de pasos se escribe en el nombre, como las horas de sueño

`domain/healthMarks.ts` gana `stepGoalFor(name)`, hermana de `sleepHoursFor`:
"Caminar 10.000 pasos" → 10 000, "10,000 steps" → 10 000, "10k pasos" → 10 000,
"12 mil pasos" → 12 000. Lo que falte o sea absurdo (fuera de 1 000–50 000) cae a
`STEP_GOAL`, que sigue en 8 000. `stepDays` recibe la meta del hábito en vez de la
constante.

Vale para todo hábito de pasos, no solo para los retos. Y en un reto resuelve lo difícil
sin tocar el esquema: **el nombre del reto es el mismo para todos, así que la meta es la
misma para todos.** Nadie cumple "10.000 pasos" con 8.000.

El editor de hábitos y "Nuevo reto" dicen la meta leída debajo del nombre ("Cuenta los
días con 10.000 pasos o más"), así el número del nombre nunca es una sorpresa.

### 2. Unirse a un reto de pasos pide Salud ahí mismo

`linkHabit` deja de crear siempre un declarado. Si el nombre mapea a un tipo de Salud
(`healthTypeFor`) y `health.status().available`, el hábito nace **verificado**. Unirse
es el flujo del permiso (regla 8): si Salud aún no está conectada, la pantalla del reto
pide la hoja del sistema en ese momento, con "Ahora no".

- Concedido: hábito verificado; los días se marcan solos desde Salud.
- "Ahora no", denegado o Android: hábito declarado, y la línea de ADR-0041 dice por qué
  ("Salud no está disponible en este teléfono · lo marcas tú"). El reto funciona igual.
- Si el hábito con ese nombre ya existía, se reusa con su modo, como hoy.

### 3. El círculo ve días, nunca pasos

Lo único que sale del teléfono por un reto de pasos es lo que ya sale por cualquier reto:
**qué días cumpliste.** Nunca la cifra de pasos, ni la hora, ni ningún otro dato de Salud.
La línea sigue siendo "Ana va 3 de 5", no "Ana 12.400 · tú 6.200": una cifra al lado de
otra es un ranking aunque no tenga posiciones (regla 11).

### 4. Cada marca dice cómo se contó

Migración `009`: `challenge_marks.source TEXT NOT NULL DEFAULT 'manual'`, con los mismos
tres valores que ya tiene `habit_marks.source` (`'health' | 'session' | 'manual'`), y la
misma columna en `server/src/schema.sql`. Las marcas propias salen de `habit_marks`, así
que los dos lados se leen igual. En la pantalla del reto, bajo el nombre de cada persona,
una línea dice cómo se contó su semana: "con Salud", "con sesiones de foco" o "marcado a
mano". Decide la marca menos verificada (`weekSource`): con que una sea a mano, la
semana se dice a mano. No hay semanas "mezcladas" en pantalla.

No se suma nada entre personas, así que la regla 9 no se rompe con una sola columna. Lo
que se evita es que un día confirmado por el reloj y un día tecleado se vean iguales uno
al lado del otro.

### 5. Consentimiento: unirse es elegir, y la pantalla lo dice antes

Un día cumplido en un reto de pasos es un dato derivado de Salud que sale del teléfono.
Apple (guía 5.1.3) exige consentimiento explícito para eso, y la regla 11 pide que cada
métrica se comparta solo si el usuario lo elige. El gesto que elige es **unirse**, y la
pantalla lo escribe encima del botón: "Tu círculo verá qué días llegaste a 10.000 pasos.
No verá cuántos." Salir del reto deja de compartir desde ese día. `SharePrefs.habits` no
gobierna los retos: el reto se comparte porque te uniste a él, no por el interruptor
general. La política de privacidad se actualiza con esto antes de conectar el sync.

### 6. Android espera a Health Connect, y no se queda afuera

Hasta que Health Connect exista detrás de `platform/health.ts` (su propio ADR, con el
formulario de Play), un participante en Android se une como declarado y su línea dice
"marcado a mano". Cuando llegue Health Connect, nada de este ADR cambia: `status()` pasa a
`available` y el punto 2 hace el resto.

## Alternativas consideradas

- **Una columna `step_goal` en `challenges` (y en `habits`).** Más explícita, pero migra
  dos tablas locales y una del servidor, añade un selector a "Nuevo reto" y contradice
  ADR-0008 y ADR-0041, que ya decidieron que el hábito se define por su nombre. El sueño
  ya resuelve su meta así.
- **Compartir la cifra de pasos, o un total semanal.** Es la tabla de posiciones que la
  regla 11 prohíbe, y además es el dato de Salud más fino que se podría sacar del teléfono.
- **Retos de pasos solo verificados.** Excluye a todo Android hasta Health Connect y a
  quien diga "Ahora no". ADR-0041 ya eligió caer a declarado y decirlo, no bloquear.
- **Que `SharePrefs.habits` gobierne también el reto.** Un reto al que te uniste pero que
  nadie ve no es un reto. El consentimiento es por reto, en el momento de unirse.
- **Leer los pasos de cada app por separado (Garmin, Fitbit…).** Cada una es una API, una
  cuenta y una dependencia. Salud y Health Connect ya son el punto de encuentro.

## Consecuencias

- Dominio: `stepGoalFor` con su tabla de casos (puntos, comas, "k", "mil", absurdos),
  `stepDays` con la meta del hábito, y el origen de la semana por persona en
  `challengeStandings`. Con tests.
- Datos: migración `009` (`challenge_marks.source`), la columna en el esquema del
  servidor y en el `POST /sync` (un valor desconocido llega como `manual`). Nunca se
  edita la `004`.
- Store: `linkHabit` decide el modo por `healthTypeFor` y `health.status()`; unirse a un
  reto de pasos puede abrir la hoja de Salud.
- UI: la línea de meta leída en el editor de hábitos y en "Nuevo reto", la frase de
  consentimiento encima de "Unirme", y "con Salud" / "marcado a mano" en cada persona.
  Strings en los dos idiomas. Sin componentes nuevos de librería.
- El reto sugerido "Caminar 5" de ADR-0031 pasa a "Caminar 8.000 pasos", 5 veces por
  semana, para que su meta se vea.
- Queda fuera: Health Connect en Android (su ADR) y el sync de retos con el servidor
  (ADR-0033). Hasta entonces, las marcas de los demás siguen siendo de demostración.
