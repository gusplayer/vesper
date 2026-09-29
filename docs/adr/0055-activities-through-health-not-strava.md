# ADR-0055 — Las actividades llegan por Salud, no por Strava

**Estado:** aceptada · 2026-09-29. Tres informes en `docs/research/strava-activities/`: la API de
Strava (`strava-api.md`), la vía de Salud y Health Connect (`health-path.md`) y producto
(`product.md`). Cambia las metas semanales del PRD (2, 4 o 6) y las de los retos (2 a 6).

## Contexto

El dueño del producto quiere que Vesper traiga las actividades de Strava, con permiso, para que un
hábito o un reto se marque solo: "hacer ejercicio 3 veces por semana", un número que elige la
persona, o "montar bicicleta un día a la semana".

Hoy casi todo eso ya existe, pero con dos huecos. Un hábito verificado por entrenamiento se marca
con cualquier entrenamiento de 10 minutos que llegue a Salud o a Health Connect. Pero el tipo del
entrenamiento se descarta al leerlo, así que "Montar en bici" se marca con una clase de yoga. Y un
hábito solo acepta 2, 4 o 6 días por semana, así que "un día a la semana" no se puede pedir.

Hay dos caminos para llenar esos huecos.

**Strava directo** (`strava-api.md`) choca con cuatro cosas:

1. **Los términos.** La Política de la API, vigente desde el 1 de junio de 2026, dice en §2.3:
   *"Strava Data provided by a specific Strava user may be displayed or disclosed in your Developer
   Application only to that user."* Un reto es justo mostrarle al círculo qué días rodó alguien.
2. **Un servidor con secretos.** El canje y el refresco del token piden el `client_secret`, que no
   puede ir en la app. Vesper tendría que guardar tokens de Strava en su servidor: una cuenta ajena,
   con estado, fuera de lo que la regla 7 deja salir.
3. **La capacidad.** Una app nueva conecta a 10 personas. Pasar de ahí pide una revisión sin plazo,
   y una suscripción de Strava pagada por el desarrollador.
4. **La cobertura.** Solo sirve a quien registra en Strava. Deja fuera a quien usa solo un Apple
   Watch, un Garmin sin Strava o un Galaxy Watch.

**Salud y Health Connect** (`health-path.md`) ya reciben lo que Strava registra, cuando la persona
enciende "Send to Health" en iPhone, o Health Connect en Android, donde su ayuda habla solo de las
actividades con GPS. También reciben lo del Apple Watch, Garmin Connect, Samsung Health, Fitbit y Google. Vesper
ya pide ese permiso, ya lee esos entrenamientos y los datos no salen del teléfono. Solo falta no
descartar el tipo.

La misma investigación encontró tres fallas en lo que ya existe:

- **`react-native-health` pierde entrenamientos.** `getAnchoredWorkouts` arma cada uno con
  `@"metadata" : [sample metadata]` y con el `productType` del dispositivo. Si alguno viene en `nil`,
  el diccionario lanza una excepción, el `@catch` la traga y el entrenamiento desaparece. Se verificó
  en `RCTAppleHealthKit+Queries.m` de la 1.19.0.
- **Un entrenamiento que llega tarde se pierde.** Se lee solo la semana en curso, y solo al abrir la
  app. Una salida del domingo que Strava o Garmin escriben después de la última vez que se abrió
  Vesper ese domingo nunca se lee.
- **Un entrenamiento escrito a mano en Salud cuenta como verificado.** Eso contradice el ADR-0005.

## Decisión

1. **No hay integración con la API de Strava por ahora.** La fuente es Salud en iOS y Health
   Connect en Android. Strava se nombra en la app solo para decir cómo hacer que sus actividades
   lleguen a Salud. Se vuelve a evaluar solo si se cumplen las cuatro condiciones de
   `strava-api.md` §8:
   - Strava confirma por escrito que un día marcado se puede mostrar a un círculo de hasta 12
     personas invitadas, y que puede contar junto a los días de Salud. La Política §5.4 prohíbe
     *"combine Strava Data with other customer data"*.
   - Hay personas reales cuya actividad no llega a Salud por ningún camino.
   - Un ADR enmienda la regla 7 para que el servidor guarde solo el secreto y el vínculo con la
     cuenta de Strava, nunca una actividad.
   - El dueño acepta una suscripción mensual a Strava y una revisión sin plazo.

2. **Cuatro clases de actividad, y la clase sale del nombre del hábito**, como la meta de pasos
   (ADR-0042) y las horas de sueño:
   - **Bicicleta**: `bici` (y `bicicleta`), `cicla`, `ciclismo`, `ciclista`, `ciclocross`,
     `cicloturismo`, `pedalear`, `rodar`, `spinning`, `MTB`, `bike`, `cycling`, `cyclocross`,
     `ride`, `spin`.
   - **Correr**: `correr`, `trotar`, `run`, `jog`.
   - **Nadar**: `nadar`, `natación`, `swim`, `swimming`.

   Cada raíz corta lleva un límite de palabra donde se esconde en otra: "no hacer nada",
   "reciclar", "recorrer", "motorbike", "spinach", "swimwear". Las pruebas de
   `domain/habits.test.ts` fijan las dos listas.
   - **Cualquier entrenamiento**: el resto de lo que ya dice entrenamiento (`ejercicio`, `gym`,
     `entrenar`, `pesas`, `workout`…).

   Caminar sigue siendo pasos. La clase no se guarda: se deriva, así que no hay migración ni cambio
   de servidor. Un reto lleva la clase en su nombre, igual en todos los teléfonos, y todos cuentan
   lo mismo.

3. **El tipo del entrenamiento se lee en las dos plataformas** y se traduce en el dominio, con
   funciones puras y probadas:
   - En iOS, del `activityId` de HealthKit (`HKWorkoutActivityType`).
   - En Android, del `exerciseType` de Health Connect. Esto es un cambio en `modules/vesper-health`.

   | Clase | HealthKit | Health Connect |
   |---|---|---|
   | Bicicleta | `cycling` y `handCycling` | `BIKING` y `BIKING_STATIONARY` |
   | Correr | `running` | `RUNNING` y `RUNNING_TREADMILL` |
   | Nadar | `swimming` | `SWIMMING_POOL` y `SWIMMING_OPEN_WATER` |

   La bicicleta estática cuenta como bicicleta y la cinta como correr: la persona pidió montar,
   no salir a la calle. Un tipo desconocido cuenta como entrenamiento, nunca como una clase
   específica. El piso sigue en 10 minutos para todas.

4. **Metas semanales de 1 a 6**, en hábitos y en retos. El 1 existe por "bicicleta un día a la
   semana". El 7 no existe: la meta es de días y un día de descanso es parte del plan. El servidor ya
   acepta cualquier número.

5. **Se cuentan días, no entrenamientos.** Dos salidas el mismo día marcan un día. La misma salida
   escrita por el reloj y por Strava también. El círculo ve qué días, como siempre (ADR-0042), y
   nunca distancia, ritmo, duración, ruta ni qué app la registró.

6. **Las tres fallas se corrigen:**
   - El parche de `react-native-health` cambia `nil` por un valor vacío.
   - Se leen los últimos 8 días: la semana en curso y el final de la anterior.
   - Un entrenamiento escrito a mano no marca un hábito verificado: `HKWasUserEntered` en iOS,
     `RECORDING_METHOD_MANUAL_ENTRY` en Android.

7. **"Que llegue a Salud".** El formulario de un hábito de entrenamiento ofrece una fila secundaria
   que abre una hoja. La hoja da la ruta en Strava y en Garmin Connect para que sus actividades
   lleguen a Salud o a Health Connect. No hay botón "Conectar con Strava" ni logo de Strava.

## Consecuencias

- "Ejercicio 3 veces por semana", un número elegido de 1 a 6, "bici un día a la semana" y un reto
  "Rodar juntos" se marcan solos, sin cuenta nueva, sin servidor, sin permiso nuevo y sin que nada
  salga del teléfono.
- **El iOS y el Android nativos cambian**: el parche y el módulo Kotlin. Con el fingerprint de los
  ADR-0052 y 0054, esto pide un build y no viaja por el aire. Los dev clients se recompilan.
- **Lo que esta vía no ve:**
  - Una salida en e-bike, virtual o de gravel se cuenta como bicicleta, porque ni HealthKit ni
    Health Connect las distinguen.
  - En Android, lo que Strava registra sin GPS probablemente no llega a Health Connect: su
    ayuda solo habla de actividades con GPS.
  - Tampoco lo ve quien no conectó ninguna app a Salud. Esa persona sigue con su hábito declarado.
- **Sin confirmar hasta probarlo con una cuenta real**: qué tipo escribe Strava en Salud para cada
  deporte, si en Android manda algo sin GPS, si sus actividades manuales llegan marcadas como escritas a mano, y las rutas exactas en
  español dentro de Strava y Garmin. La hoja de ayuda se ajusta cuando se vean en un teléfono.
- **Queda abierto** (`product.md`): marcar a mano un hábito verificado cuando el reloj se quedó en
  casa, lo que tocaría el ADR-0041. Y el empujón del círculo a quien ya rodó pero no abrió Vesper,
  porque Salud solo se lee al abrir la app.
- Un hábito llamado "Montar en bici" que hoy se marca con cualquier entrenamiento pasa a marcarse
  solo con bicicleta. Es lo que su nombre siempre dijo.
